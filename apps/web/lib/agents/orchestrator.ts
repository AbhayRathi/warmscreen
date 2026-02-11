/**
 * Orchestrator Agent
 * 
 * Main coordinator for the multi-agent orchestration layer.
 * Manages agent execution pipeline, communication, and coordination.
 */

import {
  AgentType,
  AgentTypes,
  AgentStatus,
  AgentContext,
  AgentExecutionResult,
  OrchestrationPipeline,
  OrchestrationSession,
  MessagePriority,
  RESPONSE_ANALYSIS_PIPELINE,
  FINALIZATION_PIPELINE,
} from './types';
import { AgentOutput } from '@warmscreen/shared';
import { getAgentRegistry, AgentRegistry } from './registry';
import {
  getAgentCommunicationManager,
  AgentCommunicationManager,
} from './communication';
import {
  getFeedbackCollector,
  getPerformanceTracker,
  FeedbackCollector,
  AgentPerformanceTracker,
} from './feedback';
import { getPatternRepository, PatternRepository } from './patterns';

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Agent executor function type
 */
type AgentExecutor = (context: AgentContext) => Promise<AgentOutput>;

/**
 * Orchestrator Agent
 * 
 * Coordinates all specialized agents and manages the analysis pipeline.
 */
export class OrchestratorAgent {
  private registry: AgentRegistry;
  private communication: AgentCommunicationManager;
  private feedback: FeedbackCollector;
  private performance: AgentPerformanceTracker;
  private patterns: PatternRepository;
  private executors: Map<AgentType, AgentExecutor>;
  private activeSessions: Map<string, OrchestrationSession>;

  constructor() {
    this.registry = getAgentRegistry();
    this.communication = getAgentCommunicationManager();
    this.feedback = getFeedbackCollector();
    this.performance = getPerformanceTracker();
    this.patterns = getPatternRepository();
    this.executors = new Map();
    this.activeSessions = new Map();
  }

  /**
   * Register an agent executor
   */
  registerExecutor(agentType: AgentType, executor: AgentExecutor): void {
    this.executors.set(agentType, executor);
  }

  /**
   * Process a single interview response through the agent swarm
   */
  async processResponse(context: AgentContext): Promise<OrchestrationSession> {
    const session = this.createSession(
      context.interviewId,
      RESPONSE_ANALYSIS_PIPELINE
    );

    try {
      await this.executePipeline(session, context);
      session.status = 'COMPLETED';
    } catch (error) {
      session.status = 'FAILED';
      console.error('[OrchestratorAgent] Pipeline execution failed:', error);
    }

    session.endTime = new Date();
    return session;
  }

  /**
   * Finalize an interview with scoring and explanation
   */
  async finalizeInterview(
    context: AgentContext,
    responses: AgentOutput[]
  ): Promise<OrchestrationSession> {
    const session = this.createSession(
      context.interviewId,
      FINALIZATION_PIPELINE
    );

    // Add responses to context metadata
    session.metadata.responses = responses;

    try {
      await this.executePipeline(session, context);
      session.status = 'COMPLETED';
    } catch (error) {
      session.status = 'FAILED';
      console.error('[OrchestratorAgent] Finalization failed:', error);
    }

    session.endTime = new Date();
    return session;
  }

  /**
   * Create a new orchestration session
   */
  private createSession(
    interviewId: string,
    pipeline: OrchestrationPipeline
  ): OrchestrationSession {
    const session: OrchestrationSession = {
      id: generateSessionId(),
      interviewId,
      status: 'PENDING',
      pipeline,
      currentStage: 0,
      results: new Map(),
      messages: [],
      startTime: new Date(),
      metadata: {},
    };

    this.activeSessions.set(session.id, session);
    return session;
  }

  /**
   * Execute a pipeline
   */
  private async executePipeline(
    session: OrchestrationSession,
    context: AgentContext
  ): Promise<void> {
    session.status = 'RUNNING';

    const { stages, parallel, maxTotalTime, onError } = session.pipeline;
    const startTime = Date.now();

    // Get execution order based on dependencies
    const stageOrder = this.registry.getExecutionOrder(
      stages.map((s) => s.agentType)
    );

    for (const levelAgents of stageOrder) {
      // Check timeout
      if (Date.now() - startTime > maxTotalTime) {
        throw new Error(`Pipeline exceeded maximum time of ${maxTotalTime}ms`);
      }

      // Find stages for this level
      const levelStages = stages.filter((s) => levelAgents.includes(s.agentType));

      if (parallel && levelStages.length > 1) {
        // Execute in parallel
        const results = await Promise.allSettled(
          levelStages.map((stage) =>
            this.executeStageWithRetry(session, stage, context)
          )
        );

        // Handle results
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const stage = levelStages[i];

          if (result.status === 'rejected') {
            if (stage.required && onError === 'STOP') {
              throw new Error(`Required agent ${stage.agentType} failed: ${result.reason}`);
            }
          }
        }
      } else {
        // Execute sequentially
        for (const stage of levelStages) {
          try {
            await this.executeStageWithRetry(session, stage, context);
          } catch (error) {
            if (stage.required && onError === 'STOP') {
              throw error;
            }
          }
        }
      }

      session.currentStage++;
    }
  }

  /**
   * Execute a single stage with retry logic
   */
  private async executeStageWithRetry(
    session: OrchestrationSession,
    stage: { agentType: AgentType; timeout: number; retries: number },
    context: AgentContext
  ): Promise<AgentExecutionResult> {
    let lastError: Error | null = null;
    let attempts = 0;

    while (attempts <= stage.retries) {
      try {
        const result = await this.executeAgent(session, stage.agentType, context, stage.timeout);
        return result;
      } catch (error) {
        lastError = error as Error;
        attempts++;

        if (attempts <= stage.retries) {
          // Wait before retry with exponential backoff, capped at 8 seconds
          const delay = Math.min(Math.pow(2, attempts) * 500, 8000);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error(`Agent ${stage.agentType} failed after ${attempts} attempts`);
  }

  /**
   * Execute a single agent
   */
  private async executeAgent(
    session: OrchestrationSession,
    agentType: AgentType,
    context: AgentContext,
    timeout: number
  ): Promise<AgentExecutionResult> {
    const startTime = new Date();
    this.registry.updateStatus(agentType, AgentStatus.RUNNING);

    // Send request message
    this.communication.sendRequest(
      AgentTypes.ORCHESTRATOR,
      agentType,
      context,
      MessagePriority.HIGH
    );

    let output: AgentOutput;
    let reflexionLoops = 0;

    try {
      // Execute with timeout
      const executor = this.executors.get(agentType);
      if (executor) {
        output = await this.executeWithTimeout(executor(context), timeout);
        reflexionLoops = output.reflexionLoop || 0;
      } else {
        // Use mock executor for testing
        output = await this.mockExecutor(agentType, context);
      }

      const endTime = new Date();
      const latencyMs = endTime.getTime() - startTime.getTime();

      // Record metrics
      this.registry.recordExecution(agentType, latencyMs, output.confidence, true);
      this.performance.recordExecution(
        agentType,
        latencyMs,
        output.confidence,
        true,
        reflexionLoops
      );

      // Record feedback
      this.feedback.recordPerformanceFeedback(
        context.interviewId,
        agentType,
        latencyMs,
        true,
        output.confidence
      );

      // Detect patterns
      const patternMatches = this.patterns.matchPatterns({
        agentOutputs: { [agentType.toLowerCase()]: output },
        confidence: output.confidence,
        reflexionLoop: reflexionLoops,
      });

      for (const match of patternMatches) {
        this.patterns.recordOccurrence(match.pattern.id);
        this.feedback.recordPatternFeedback(
          context.interviewId,
          agentType,
          match.pattern.name,
          match.matchScore
        );
      }

      // Create result
      const result: AgentExecutionResult = {
        agentType,
        output,
        startTime,
        endTime,
        latencyMs,
        reflexionLoops,
        success: true,
      };

      session.results.set(agentType, result);
      this.registry.updateStatus(agentType, AgentStatus.COMPLETED);

      // Send response message
      const requestMessage = session.messages.find(
        (m) => m.toAgent === agentType && m.payload.type === 'REQUEST'
      );
      if (requestMessage) {
        this.communication.sendResponse(
          agentType,
          AgentTypes.ORCHESTRATOR,
          output,
          requestMessage.id,
          requestMessage.correlationId
        );
      }

      return result;
    } catch (error) {
      const endTime = new Date();
      const latencyMs = endTime.getTime() - startTime.getTime();

      // Record failure
      this.registry.recordExecution(agentType, latencyMs, 0, false);
      this.performance.recordExecution(agentType, latencyMs, 0, false, reflexionLoops);

      this.registry.updateStatus(agentType, AgentStatus.FAILED);

      // Send error message
      this.communication.sendError(
        agentType,
        AgentTypes.ORCHESTRATOR,
        error instanceof Error ? error.message : 'Unknown error',
        session.id
      );

      throw error;
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Mock executor for testing when no real executor is registered
   */
  private async mockExecutor(
    agentType: AgentType,
    context: AgentContext
  ): Promise<AgentOutput> {
    // Simulate processing time
    await this.delay(100);

    return {
      type: agentType,
      result: {
        mock: true,
        agentType,
        processed: true,
      },
      confidence: 0.8,
      reflexionLoop: 0,
      shouldReflect: false,
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): OrchestrationSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get active sessions for an interview
   */
  getSessionsForInterview(interviewId: string): OrchestrationSession[] {
    return Array.from(this.activeSessions.values()).filter(
      (s) => s.interviewId === interviewId
    );
  }

  /**
   * Get all agent results from a session
   */
  getSessionResults(sessionId: string): Map<AgentType, AgentExecutionResult> | undefined {
    const session = this.activeSessions.get(sessionId);
    return session?.results;
  }

  /**
   * Get orchestration summary for an interview
   */
  getOrchestrationSummary(interviewId: string): {
    totalSessions: number;
    completedSessions: number;
    failedSessions: number;
    avgLatencyMs: number;
    avgConfidence: number;
    agentPerformance: Record<string, { latencyMs: number; confidence: number; success: boolean }>;
  } {
    const sessions = this.getSessionsForInterview(interviewId);
    const completedSessions = sessions.filter((s) => s.status === 'COMPLETED');
    const failedSessions = sessions.filter((s) => s.status === 'FAILED');

    const agentPerformance: Record<string, { latencyMs: number; confidence: number; success: boolean }> = {};
    let totalLatency = 0;
    let totalConfidence = 0;
    let resultCount = 0;

    for (const session of sessions) {
      for (const [agentType, result] of session.results) {
        totalLatency += result.latencyMs;
        totalConfidence += result.output.confidence;
        resultCount++;

        if (!agentPerformance[agentType]) {
          agentPerformance[agentType] = {
            latencyMs: result.latencyMs,
            confidence: result.output.confidence,
            success: result.success,
          };
        } else {
          const prev = agentPerformance[agentType];
          agentPerformance[agentType] = {
            latencyMs: (prev.latencyMs + result.latencyMs) / 2,
            confidence: (prev.confidence + result.output.confidence) / 2,
            success: prev.success && result.success,
          };
        }
      }
    }

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      failedSessions: failedSessions.length,
      avgLatencyMs: resultCount > 0 ? totalLatency / resultCount : 0,
      avgConfidence: resultCount > 0 ? totalConfidence / resultCount : 0,
      agentPerformance,
    };
  }

  /**
   * Clean up completed sessions older than specified age
   */
  cleanupOldSessions(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.activeSessions) {
      if (
        (session.status === 'COMPLETED' || session.status === 'FAILED') &&
        session.endTime &&
        now - session.endTime.getTime() > maxAgeMs
      ) {
        this.activeSessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get health status of the orchestration system
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    agentHealth: ReturnType<AgentRegistry['getHealthStatus']>;
    activeSessions: number;
    performanceSummary: ReturnType<AgentPerformanceTracker['getPerformanceSummary']>;
    underperformingAgents: AgentType[];
  } {
    const agentHealth = this.registry.getHealthStatus();
    const performanceSummary = this.performance.getPerformanceSummary();
    const underperformingAgents = this.performance.getUnderperformingAgents();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (agentHealth.unhealthy.length > 0 || performanceSummary.overallSuccessRate < 0.7) {
      status = 'unhealthy';
    } else if (
      agentHealth.degraded.length > 0 ||
      underperformingAgents.length > 0 ||
      performanceSummary.overallSuccessRate < 0.9
    ) {
      status = 'degraded';
    }

    return {
      status,
      agentHealth,
      activeSessions: this.activeSessions.size,
      performanceSummary,
      underperformingAgents,
    };
  }
}

/**
 * Singleton instance
 */
let orchestratorInstance: OrchestratorAgent | null = null;

/**
 * Get the global orchestrator instance
 */
export function getOrchestratorAgent(): OrchestratorAgent {
  if (!orchestratorInstance) {
    orchestratorInstance = new OrchestratorAgent();
  }
  return orchestratorInstance;
}

/**
 * Reset the orchestrator (for testing)
 */
export function resetOrchestratorAgent(): void {
  orchestratorInstance = null;
}
