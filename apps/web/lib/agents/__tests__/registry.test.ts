/**
 * Tests for Agent Registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentRegistry,
  getAgentRegistry,
} from '../registry';
import {
  AgentTypes,
  AgentStatus,
  DEFAULT_AGENT_CAPABILITIES,
} from '../types';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    AgentRegistry.resetInstance();
    registry = getAgentRegistry();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getAgentRegistry();
      const instance2 = getAgentRegistry();
      expect(instance1).toBe(instance2);
    });

    it('should reset properly', () => {
      const instance1 = getAgentRegistry();
      AgentRegistry.resetInstance();
      const instance2 = getAgentRegistry();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Default Agents', () => {
    it('should have all default agents registered', () => {
      for (const type of Object.values(AgentTypes)) {
        const agent = registry.getAgent(type);
        expect(agent).toBeDefined();
        expect(agent?.type).toBe(type);
      }
    });

    it('should have correct initial status', () => {
      const agents = registry.getAllAgents();
      for (const agent of agents) {
        expect(agent.status).toBe(AgentStatus.IDLE);
      }
    });

    it('should have zero execution counts initially', () => {
      const agents = registry.getAllAgents();
      for (const agent of agents) {
        expect(agent.executionCount).toBe(0);
        expect(agent.errorCount).toBe(0);
      }
    });
  });

  describe('Agent Registration', () => {
    it('should register a custom agent', () => {
      const customCapability = {
        ...DEFAULT_AGENT_CAPABILITIES[AgentTypes.ANALYZER],
        description: 'Custom analyzer',
      };

      registry.register(AgentTypes.ANALYZER, customCapability);

      const agent = registry.getAgent(AgentTypes.ANALYZER);
      expect(agent?.capability.description).toBe('Custom analyzer');
    });

    it('should unregister an agent', () => {
      const result = registry.unregister(AgentTypes.PLANNER);
      expect(result).toBe(true);
      expect(registry.getAgent(AgentTypes.PLANNER)).toBeUndefined();
    });

    it('should return false when unregistering non-existent agent', () => {
      registry.unregister(AgentTypes.PLANNER);
      const result = registry.unregister(AgentTypes.PLANNER);
      expect(result).toBe(false);
    });
  });

  describe('Status Management', () => {
    it('should update agent status', () => {
      registry.updateStatus(AgentTypes.ANALYZER, AgentStatus.RUNNING);
      const agent = registry.getAgent(AgentTypes.ANALYZER);
      expect(agent?.status).toBe(AgentStatus.RUNNING);
    });

    it('should set lastExecutionTime on completion', () => {
      registry.updateStatus(AgentTypes.ANALYZER, AgentStatus.COMPLETED);
      const agent = registry.getAgent(AgentTypes.ANALYZER);
      expect(agent?.lastExecutionTime).toBeDefined();
    });

    it('should set lastExecutionTime on failure', () => {
      registry.updateStatus(AgentTypes.ANALYZER, AgentStatus.FAILED);
      const agent = registry.getAgent(AgentTypes.ANALYZER);
      expect(agent?.lastExecutionTime).toBeDefined();
    });

    it('should filter agents by status', () => {
      registry.updateStatus(AgentTypes.ANALYZER, AgentStatus.RUNNING);
      registry.updateStatus(AgentTypes.TAGGER, AgentStatus.RUNNING);

      const running = registry.getAgentsByStatus(AgentStatus.RUNNING);
      expect(running.length).toBe(2);
      expect(running.map((a) => a.type)).toContain(AgentTypes.ANALYZER);
      expect(running.map((a) => a.type)).toContain(AgentTypes.TAGGER);
    });
  });

  describe('Execution Recording', () => {
    it('should record successful execution', () => {
      registry.recordExecution(AgentTypes.ANALYZER, 100, 0.85, true);

      const agent = registry.getAgent(AgentTypes.ANALYZER);
      expect(agent?.executionCount).toBe(1);
      expect(agent?.avgLatencyMs).toBe(100);
      expect(agent?.avgConfidence).toBe(0.85);
      expect(agent?.errorCount).toBe(0);
    });

    it('should record failed execution', () => {
      registry.recordExecution(AgentTypes.ANALYZER, 100, 0.3, false);

      const agent = registry.getAgent(AgentTypes.ANALYZER);
      expect(agent?.executionCount).toBe(1);
      expect(agent?.errorCount).toBe(1);
    });

    it('should calculate rolling averages', () => {
      registry.recordExecution(AgentTypes.ANALYZER, 100, 0.8, true);
      registry.recordExecution(AgentTypes.ANALYZER, 200, 0.9, true);

      const agent = registry.getAgent(AgentTypes.ANALYZER);
      expect(agent?.avgLatencyMs).toBe(150);
      expect(agent?.avgConfidence).toBeCloseTo(0.85, 10);
    });
  });

  describe('Dependency Checking', () => {
    it('should allow execution when no dependencies', () => {
      const canExecute = registry.canExecute(AgentTypes.ANALYZER, new Set());
      expect(canExecute).toBe(true);
    });

    it('should block execution when dependencies not met', () => {
      const canExecute = registry.canExecute(AgentTypes.VERIFIER, new Set());
      expect(canExecute).toBe(false);
    });

    it('should allow execution when dependencies met', () => {
      const completed = new Set([AgentTypes.ANALYZER, AgentTypes.TAGGER]);
      const canExecute = registry.canExecute(AgentTypes.VERIFIER, completed);
      expect(canExecute).toBe(true);
    });

    it('should return parallelizable agents', () => {
      const agents = registry.getParallelizableAgents(new Set());
      
      // Analyzer, Tagger, Planner should be parallelizable (no deps)
      expect(agents).toContain(AgentTypes.ANALYZER);
      expect(agents).toContain(AgentTypes.TAGGER);
      expect(agents).toContain(AgentTypes.PLANNER);
      
      // Verifier has dependencies, should not be included
      expect(agents).not.toContain(AgentTypes.VERIFIER);
    });
  });

  describe('Execution Order', () => {
    it('should determine correct execution order', () => {
      const order = registry.getExecutionOrder([
        AgentTypes.ANALYZER,
        AgentTypes.TAGGER,
        AgentTypes.VERIFIER,
        AgentTypes.SCORER,
      ]);

      // First level should have Analyzer and Tagger (no deps)
      expect(order[0]).toContain(AgentTypes.ANALYZER);
      expect(order[0]).toContain(AgentTypes.TAGGER);

      // Second level should have Verifier and Scorer (depend on first level)
      expect(order[1]).toContain(AgentTypes.VERIFIER);
      expect(order[1]).toContain(AgentTypes.SCORER);
    });
  });

  describe('Performance Metrics', () => {
    it('should return performance metrics', () => {
      registry.recordExecution(AgentTypes.ANALYZER, 100, 0.85, true);
      registry.recordExecution(AgentTypes.ANALYZER, 100, 0.85, false);

      const metrics = registry.getPerformanceMetrics(AgentTypes.ANALYZER);
      expect(metrics).toBeDefined();
      expect(metrics?.executions).toBe(2);
      expect(metrics?.successRate).toBe(0.5);
      expect(metrics?.errorRate).toBe(0.5);
    });

    it('should return all performance metrics', () => {
      registry.recordExecution(AgentTypes.ANALYZER, 100, 0.85, true);
      registry.recordExecution(AgentTypes.TAGGER, 80, 0.9, true);

      const allMetrics = registry.getAllPerformanceMetrics();
      expect(allMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('Health Status', () => {
    it('should report healthy agents', () => {
      registry.recordExecution(AgentTypes.ANALYZER, 100, 0.85, true);

      const health = registry.getHealthStatus();
      expect(health.healthy).toContain(AgentTypes.ANALYZER);
    });

    it('should report unhealthy agents with high error rate', () => {
      // Record many failures
      for (let i = 0; i < 10; i++) {
        registry.recordExecution(AgentTypes.ANALYZER, 100, 0.3, false);
      }

      const health = registry.getHealthStatus();
      expect(health.unhealthy).toContain(AgentTypes.ANALYZER);
    });

    it('should report degraded agents with moderate issues', () => {
      // Record some failures
      registry.recordExecution(AgentTypes.ANALYZER, 100, 0.3, true);
      registry.recordExecution(AgentTypes.ANALYZER, 100, 0.3, true);
      registry.recordExecution(AgentTypes.ANALYZER, 100, 0.3, false);

      const health = registry.getHealthStatus();
      expect(health.degraded).toContain(AgentTypes.ANALYZER);
    });
  });

  describe('Available Agents', () => {
    it('should return idle agents as available', () => {
      const available = registry.getAvailableAgents();
      expect(available.length).toBeGreaterThan(0);
      expect(available.every((a) => a.status === AgentStatus.IDLE)).toBe(true);
    });

    it('should exclude running agents from available', () => {
      registry.updateStatus(AgentTypes.ANALYZER, AgentStatus.RUNNING);

      const available = registry.getAvailableAgents();
      expect(available.map((a) => a.type)).not.toContain(AgentTypes.ANALYZER);
    });

    it('should include completed agents in available', () => {
      registry.updateStatus(AgentTypes.ANALYZER, AgentStatus.COMPLETED);

      const available = registry.getAvailableAgents();
      expect(available.map((a) => a.type)).toContain(AgentTypes.ANALYZER);
    });
  });
});
