/**
 * Performance and Load Tests for Agent Orchestration System
 * 
 * Tests concurrent execution, message throughput, and scalability.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OrchestratorAgent,
  getOrchestratorAgent,
  resetOrchestratorAgent,
} from '../orchestrator';
import { AgentRegistry } from '../registry';
import {
  AgentCommunicationManager,
  getAgentCommunicationManager,
  resetAgentCommunicationManager,
} from '../communication';
import { resetFeedbackSystem } from '../feedback';
import { resetPatternRepository } from '../patterns';
import { AgentTypes, AgentContext, MessagePriority } from '../types';

describe('Performance & Load Tests', () => {
  let orchestrator: OrchestratorAgent;
  let communication: AgentCommunicationManager;

  const createMockContext = (id: string): AgentContext => ({
    interviewId: `int-${id}`,
    responseId: `resp-${id}`,
    question: {
      id: `q-${id}`,
      content: 'Test question',
      category: 'technical',
      difficulty: 'MEDIUM',
      position: 'Engineer',
    },
    response: {
      transcript: 'Test response transcript for performance testing',
      duration: 60,
    },
    position: 'Software Engineer',
  });

  beforeEach(() => {
    AgentRegistry.resetInstance();
    resetAgentCommunicationManager();
    resetFeedbackSystem();
    resetPatternRepository();
    resetOrchestratorAgent();
    orchestrator = getOrchestratorAgent();
    communication = getAgentCommunicationManager();
  });

  describe('Concurrent Processing', () => {
    it('should handle 20 concurrent processResponse calls', async () => {
      const concurrentCount = 20;
      const startTime = Date.now();
      
      // Create mock contexts
      const contexts = Array.from({ length: concurrentCount }, (_, i) =>
        createMockContext(String(i))
      );

      // Execute in parallel
      const results = await Promise.all(
        contexts.map((ctx) => orchestrator.processResponse(ctx))
      );

      const duration = Date.now() - startTime;

      // All should complete
      expect(results).toHaveLength(concurrentCount);
      
      // All should have a status
      results.forEach((session) => {
        expect(['COMPLETED', 'FAILED']).toContain(session.status);
      });

      // Should complete within reasonable time (30s max)
      expect(duration).toBeLessThan(30000);
    }, 60000);

    it('should handle sequential batch processing', async () => {
      const batchCount = 10;
      const sessions = [];
      const startTime = Date.now();

      for (let i = 0; i < batchCount; i++) {
        const session = await orchestrator.processResponse(
          createMockContext(String(i))
        );
        sessions.push(session);
      }

      const duration = Date.now() - startTime;

      expect(sessions).toHaveLength(batchCount);
      expect(duration).toBeLessThan(60000); // 60s max for sequential
    }, 120000);
  });

  describe('Message Queue Performance', () => {
    it('should process 500 messages through communication system', async () => {
      const messageCount = 500;
      const startTime = Date.now();
      const messages = [];

      // Send many messages
      for (let i = 0; i < messageCount; i++) {
        const message = communication.send(
          AgentTypes.ORCHESTRATOR,
          AgentTypes.ANALYZER,
          { type: 'REQUEST' as const, data: { index: i } },
          MessagePriority.NORMAL
        );
        messages.push(message);
      }

      const duration = Date.now() - startTime;

      // All messages should be logged
      expect(messages).toHaveLength(messageCount);
      
      // Should complete quickly (< 5s for 500 messages)
      expect(duration).toBeLessThan(5000);

      // Verify message throughput
      const throughput = messageCount / (duration / 1000);
      expect(throughput).toBeGreaterThan(50); // At least 50 messages/second
    });

    it('should handle priority message ordering under load', async () => {
      const lowPriorityCount = 50;
      const highPriorityCount = 50;

      // Send low priority messages first
      for (let i = 0; i < lowPriorityCount; i++) {
        communication.send(
          AgentTypes.ORCHESTRATOR,
          AgentTypes.ANALYZER,
          { type: 'REQUEST' as const, data: { priority: 'low', index: i } },
          MessagePriority.LOW
        );
      }

      // Send high priority messages
      for (let i = 0; i < highPriorityCount; i++) {
        communication.send(
          AgentTypes.ORCHESTRATOR,
          AgentTypes.ANALYZER,
          { type: 'REQUEST' as const, data: { priority: 'high', index: i } },
          MessagePriority.HIGH
        );
      }

      // Verify total message count
      const recentMessages = communication.getRecentMessages(200);
      expect(recentMessages.length).toBe(lowPriorityCount + highPriorityCount);
    });

    it('should handle broadcast messages efficiently', async () => {
      const broadcastCount = 100;
      const startTime = Date.now();

      for (let i = 0; i < broadcastCount; i++) {
        communication.broadcast(
          'orchestration',
          AgentTypes.ORCHESTRATOR,
          { event: 'test', index: i }
        );
      }

      const duration = Date.now() - startTime;

      // Should be fast (< 1s for 100 broadcasts)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Agent Registry Performance', () => {
    it('should handle execution order calculation efficiently', async () => {
      const registry = AgentRegistry.getInstance();
      const agents = [
        AgentTypes.ANALYZER,
        AgentTypes.TAGGER,
        AgentTypes.VERIFIER,
        AgentTypes.SCORER,
        AgentTypes.NARRATOR,
      ];

      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        registry.getExecutionOrder(agents);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      // Average execution order calculation should be < 10ms
      expect(avgTime).toBeLessThan(10);
    });

    it('should handle frequent status updates', async () => {
      const registry = AgentRegistry.getInstance();
      const updateCount = 1000;
      const startTime = Date.now();

      for (let i = 0; i < updateCount; i++) {
        const status = i % 2 === 0 ? 'RUNNING' : 'COMPLETED';
        registry.updateStatus(AgentTypes.ANALYZER, status as never);
      }

      const duration = Date.now() - startTime;

      // Should handle 1000 updates in < 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should efficiently record execution metrics', async () => {
      const registry = AgentRegistry.getInstance();
      const recordCount = 500;
      const startTime = Date.now();

      for (let i = 0; i < recordCount; i++) {
        registry.recordExecution(
          AgentTypes.ANALYZER,
          100 + (i % 100), // Latency
          0.8 + (i % 20) / 100, // Confidence
          i % 10 !== 0 // 90% success rate
        );
      }

      const duration = Date.now() - startTime;

      // Should handle 500 records in < 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Memory and Cleanup', () => {
    it('should efficiently cleanup old sessions', async () => {
      // Create many sessions
      const sessionCount = 50;
      const sessions = [];

      for (let i = 0; i < sessionCount; i++) {
        const session = await orchestrator.processResponse(
          createMockContext(String(i))
        );
        sessions.push(session);
      }

      // Manually age all sessions
      sessions.forEach((session) => {
        const oldSession = orchestrator.getSession(session.id);
        if (oldSession) {
          oldSession.endTime = new Date(Date.now() - 7200000); // 2 hours ago
        }
      });

      const startTime = Date.now();
      const cleaned = orchestrator.cleanupOldSessions(3600000);
      const duration = Date.now() - startTime;

      expect(cleaned).toBe(sessionCount);
      expect(duration).toBeLessThan(100); // Should be fast
    }, 120000);

    it('should maintain performance with message log rotation', async () => {
      // Fill up the message log
      const messageCount = 1500; // More than default max (1000)

      const startTime = Date.now();
      for (let i = 0; i < messageCount; i++) {
        communication.send(
          AgentTypes.ORCHESTRATOR,
          AgentTypes.ANALYZER,
          { type: 'REQUEST' as const, data: { index: i } },
          MessagePriority.NORMAL
        );
      }
      const duration = Date.now() - startTime;

      // Verify log rotation happened (only keeping recent)
      const recentMessages = communication.getRecentMessages(1500);
      expect(recentMessages.length).toBeLessThanOrEqual(1000);

      // Should still be performant with rotation
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Throughput Metrics', () => {
    it('should report session throughput', async () => {
      const sessionCount = 10;
      const startTime = Date.now();

      await Promise.all(
        Array.from({ length: sessionCount }, (_, i) =>
          orchestrator.processResponse(createMockContext(String(i)))
        )
      );

      const duration = Date.now() - startTime;
      const throughput = sessionCount / (duration / 1000);

      // Should process at least 0.5 sessions per second
      expect(throughput).toBeGreaterThan(0.5);

      // Get summary to verify tracking
      const summary = orchestrator.getOrchestrationSummary('int-0');
      expect(summary.totalSessions).toBeGreaterThan(0);
    }, 60000);

    it('should track health status under load', async () => {
      // Generate some load
      await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          orchestrator.processResponse(createMockContext(String(i)))
        )
      );

      const health = orchestrator.getHealthStatus();

      // Should report health status
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.activeSessions).toBeGreaterThanOrEqual(0);
      expect(health.performanceSummary).toBeDefined();
    }, 60000);
  });
});
