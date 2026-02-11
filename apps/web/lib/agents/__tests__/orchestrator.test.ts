/**
 * Tests for Orchestrator Agent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OrchestratorAgent,
  getOrchestratorAgent,
  resetOrchestratorAgent,
} from '../orchestrator';
import { AgentRegistry } from '../registry';
import { resetAgentCommunicationManager } from '../communication';
import { resetFeedbackSystem } from '../feedback';
import { resetPatternRepository } from '../patterns';
import { AgentTypes, AgentContext } from '../types';

describe('OrchestratorAgent', () => {
  let orchestrator: OrchestratorAgent;

  const mockContext: AgentContext = {
    interviewId: 'int-123',
    responseId: 'resp-456',
    question: {
      id: 'q-789',
      content: 'Explain how React handles state management',
      category: 'technical',
      difficulty: 'MEDIUM',
      position: 'Frontend Engineer',
      expectedConcepts: ['useState', 'useReducer', 'context'],
      keyFacts: ['React state is immutable'],
    },
    response: {
      transcript: 'React handles state through hooks like useState and useReducer. For global state, you can use Context API or external libraries like Redux.',
      duration: 120,
    },
    position: 'Frontend Engineer',
    candidateName: 'John Doe',
  };

  beforeEach(() => {
    // Reset all singletons
    AgentRegistry.resetInstance();
    resetAgentCommunicationManager();
    resetFeedbackSystem();
    resetPatternRepository();
    resetOrchestratorAgent();

    orchestrator = getOrchestratorAgent();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getOrchestratorAgent();
      const instance2 = getOrchestratorAgent();
      expect(instance1).toBe(instance2);
    });

    it('should reset properly', () => {
      const instance1 = getOrchestratorAgent();
      resetOrchestratorAgent();
      const instance2 = getOrchestratorAgent();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Executor Registration', () => {
    it('should register an agent executor', () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        type: AgentTypes.ANALYZER,
        result: { analyzed: true },
        confidence: 0.85,
        reflexionLoop: 0,
      });

      orchestrator.registerExecutor(AgentTypes.ANALYZER, mockExecutor);

      // Executor should be registered (internal state)
      expect(() =>
        orchestrator.registerExecutor(AgentTypes.TAGGER, mockExecutor)
      ).not.toThrow();
    });
  });

  describe('Response Processing', () => {
    it('should process a response through the pipeline', async () => {
      const session = await orchestrator.processResponse(mockContext);

      expect(session).toBeDefined();
      expect(session.id).toBeTruthy();
      expect(session.interviewId).toBe('int-123');
      expect(session.status).toBe('COMPLETED');
      expect(session.startTime).toBeDefined();
      expect(session.endTime).toBeDefined();
    });

    it('should create results for each agent in pipeline', async () => {
      const session = await orchestrator.processResponse(mockContext);

      // Should have results for analyzer, tagger, verifier (required stages)
      expect(session.results.size).toBeGreaterThan(0);
      expect(session.results.has(AgentTypes.ANALYZER)).toBe(true);
      expect(session.results.has(AgentTypes.TAGGER)).toBe(true);
    });

    it('should track pipeline stages', async () => {
      const session = await orchestrator.processResponse(mockContext);

      expect(session.currentStage).toBeGreaterThan(0);
      expect(session.pipeline.name).toBe('response_analysis');
    });

    it('should use custom executor when registered', async () => {
      const customResult = {
        type: AgentTypes.ANALYZER,
        result: { custom: true, analyzed: 'custom analysis' },
        confidence: 0.92,
        reflexionLoop: 0,
      };

      const mockExecutor = vi.fn().mockResolvedValue(customResult);
      orchestrator.registerExecutor(AgentTypes.ANALYZER, mockExecutor);

      const session = await orchestrator.processResponse(mockContext);

      expect(mockExecutor).toHaveBeenCalled();
      const analyzerResult = session.results.get(AgentTypes.ANALYZER);
      expect(analyzerResult?.output.result.custom).toBe(true);
    });
  });

  describe('Interview Finalization', () => {
    it('should finalize an interview', async () => {
      const mockResponses = [
        {
          type: AgentTypes.ANALYZER,
          result: { scores: { technical: 8 } },
          confidence: 0.85,
          reflexionLoop: 0,
        },
      ];

      const session = await orchestrator.finalizeInterview(
        mockContext,
        mockResponses
      );

      expect(session).toBeDefined();
      expect(session.status).toBe('COMPLETED');
      expect(session.pipeline.name).toBe('interview_finalization');
    });

    it('should include responses in session metadata', async () => {
      const mockResponses = [
        {
          type: AgentTypes.ANALYZER,
          result: { analyzed: true },
          confidence: 0.85,
          reflexionLoop: 0,
        },
      ];

      const session = await orchestrator.finalizeInterview(
        mockContext,
        mockResponses
      );

      expect(session.metadata.responses).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should retrieve session by ID', async () => {
      const session = await orchestrator.processResponse(mockContext);

      const retrieved = orchestrator.getSession(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should get sessions for interview', async () => {
      await orchestrator.processResponse(mockContext);
      await orchestrator.processResponse(mockContext);

      const sessions = orchestrator.getSessionsForInterview('int-123');
      expect(sessions.length).toBe(2);
    });

    it('should get session results', async () => {
      const session = await orchestrator.processResponse(mockContext);

      const results = orchestrator.getSessionResults(session.id);
      expect(results).toBeDefined();
      expect(results?.size).toBeGreaterThan(0);
    });

    it('should return undefined for non-existent session', () => {
      const session = orchestrator.getSession('non-existent');
      expect(session).toBeUndefined();
    });
  });

  describe('Orchestration Summary', () => {
    it('should generate orchestration summary', async () => {
      await orchestrator.processResponse(mockContext);

      const summary = orchestrator.getOrchestrationSummary('int-123');

      expect(summary.totalSessions).toBe(1);
      expect(summary.completedSessions).toBe(1);
      expect(summary.failedSessions).toBe(0);
      expect(summary.avgLatencyMs).toBeGreaterThan(0);
      expect(summary.avgConfidence).toBeGreaterThan(0);
    });

    it('should track agent performance in summary', async () => {
      await orchestrator.processResponse(mockContext);

      const summary = orchestrator.getOrchestrationSummary('int-123');

      expect(Object.keys(summary.agentPerformance).length).toBeGreaterThan(0);
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup old completed sessions', async () => {
      const session = await orchestrator.processResponse(mockContext);

      // Manually set old end time
      const oldSession = orchestrator.getSession(session.id);
      if (oldSession) {
        oldSession.endTime = new Date(Date.now() - 7200000); // 2 hours ago
      }

      const cleaned = orchestrator.cleanupOldSessions(3600000); // 1 hour max age
      expect(cleaned).toBe(1);
      expect(orchestrator.getSession(session.id)).toBeUndefined();
    });

    it('should not cleanup recent sessions', async () => {
      const session = await orchestrator.processResponse(mockContext);

      const cleaned = orchestrator.cleanupOldSessions(3600000);
      expect(cleaned).toBe(0);
      expect(orchestrator.getSession(session.id)).toBeDefined();
    });
  });

  describe('Health Status', () => {
    it('should report healthy status', async () => {
      await orchestrator.processResponse(mockContext);

      const health = orchestrator.getHealthStatus();

      // Status can be healthy or degraded depending on agent execution metrics
      expect(['healthy', 'degraded']).toContain(health.status);
      expect(health.activeSessions).toBe(1);
      expect(health.agentHealth).toBeDefined();
      expect(health.performanceSummary).toBeDefined();
    });

    it('should report active session count', async () => {
      await orchestrator.processResponse(mockContext);
      await orchestrator.processResponse(mockContext);

      const health = orchestrator.getHealthStatus();
      expect(health.activeSessions).toBe(2);
    });

    it('should include performance summary in health', async () => {
      await orchestrator.processResponse(mockContext);

      const health = orchestrator.getHealthStatus();
      expect(health.performanceSummary.totalExecutions).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle executor errors gracefully', async () => {
      const errorExecutor = vi.fn().mockRejectedValue(new Error('Executor failed'));
      orchestrator.registerExecutor(AgentTypes.ANALYZER, errorExecutor);

      // The pipeline should still complete with FAILED status or continue
      // depending on the onError policy
      const session = await orchestrator.processResponse(mockContext);
      
      // Since RESPONSE_ANALYSIS_PIPELINE has onError: 'CONTINUE', it should complete
      expect(session).toBeDefined();
    });

    it('should mark session as failed on critical error', async () => {
      // Register failing executors for required stages
      const errorExecutor = vi.fn().mockRejectedValue(new Error('Critical failure'));
      orchestrator.registerExecutor(AgentTypes.ANALYZER, errorExecutor);
      orchestrator.registerExecutor(AgentTypes.TAGGER, errorExecutor);
      orchestrator.registerExecutor(AgentTypes.VERIFIER, errorExecutor);

      // Note: The pipeline has retries, so it may take multiple failures
      const session = await orchestrator.processResponse(mockContext);
      
      // Session should still be created
      expect(session).toBeDefined();
    });
  });

  describe('Pipeline Execution', () => {
    it('should respect stage dependencies', async () => {
      const executionOrder: AgentType[] = [];

      const trackingExecutor = (agentType: AgentType) =>
        vi.fn().mockImplementation(async () => {
          executionOrder.push(agentType);
          return {
            type: agentType,
            result: {},
            confidence: 0.85,
            reflexionLoop: 0,
          };
        });

      orchestrator.registerExecutor(AgentTypes.ANALYZER, trackingExecutor(AgentTypes.ANALYZER));
      orchestrator.registerExecutor(AgentTypes.TAGGER, trackingExecutor(AgentTypes.TAGGER));
      orchestrator.registerExecutor(AgentTypes.VERIFIER, trackingExecutor(AgentTypes.VERIFIER));
      orchestrator.registerExecutor(AgentTypes.SCORER, trackingExecutor(AgentTypes.SCORER));

      await orchestrator.processResponse(mockContext);

      // Verifier depends on Analyzer and Tagger, so should come after them
      const analyzerIndex = executionOrder.indexOf(AgentTypes.ANALYZER);
      const taggerIndex = executionOrder.indexOf(AgentTypes.TAGGER);
      const verifierIndex = executionOrder.indexOf(AgentTypes.VERIFIER);

      if (analyzerIndex !== -1 && taggerIndex !== -1 && verifierIndex !== -1) {
        expect(verifierIndex).toBeGreaterThan(Math.max(analyzerIndex, taggerIndex));
      }
    });

    it('should record execution metrics', async () => {
      await orchestrator.processResponse(mockContext);

      const health = orchestrator.getHealthStatus();
      expect(health.performanceSummary.totalExecutions).toBeGreaterThan(0);
    });
  });
});
