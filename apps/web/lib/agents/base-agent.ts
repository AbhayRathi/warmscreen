/**
 * Base Agent Class for Orchestration Integration
 * 
 * Provides a common interface for agents to integrate with the orchestration framework.
 * Each specialized agent extends this class to participate in the multi-agent pipeline.
 */

import { AgentOutput } from '@warmscreen/shared';
import type { Logger } from 'pino';
import {
  AgentType,
  AgentContext,
  AgentCapability,
  DEFAULT_AGENT_CAPABILITIES,
} from './types';
import { getAgentRegistry } from './registry';
import { createAgentLogger, logError, logPerformance } from './logger';

/**
 * Abstract base class for orchestrated agents
 * 
 * All agents in the orchestration system must extend this class.
 * It provides:
 * - Standard execution interface
 * - Reflexion loop support
 * - Performance tracking
 * - Registry integration
 */
export abstract class BaseOrchestrationAgent {
  /**
   * Unique identifier for this agent type
   */
  abstract readonly id: AgentType;

  /**
   * Human-readable name for the agent
   */
  abstract readonly name: string;

  /**
   * Description of what this agent does
   */
  abstract readonly description: string;

  /**
   * Capabilities this agent provides
   */
  abstract readonly capabilities: string[];

  /**
   * Maximum number of reflexion loops before giving up
   */
  protected maxReflexionLoops: number = 3;

  /**
   * Minimum confidence threshold before triggering reflexion
   */
  protected confidenceThreshold: number = 0.7;

  /**
   * Logger instance for this agent
   */
  protected logger: Logger | null;

  constructor() {
    // Initialize logger lazily to allow subclass to set id first
    this.logger = null;
  }

  /**
   * Get or create the logger instance
   */
  protected getLogger() {
    if (!this.logger) {
      this.logger = createAgentLogger(this.id);
    }
    return this.logger;
  }

  /**
   * Main analysis method that must be implemented by subclasses
   * 
   * @param context - The execution context with interview/response data
   * @returns Promise resolving to the agent's output
   */
  abstract analyze(context: AgentContext): Promise<AgentOutput>;

  /**
   * Execute the agent with full orchestration support
   * 
   * This method wraps the analyze method with:
   * - Performance tracking
   * - Reflexion loop support
   * - Error handling
   * - Registry integration
   * 
   * @param context - The execution context
   * @returns Promise resolving to the agent's output
   */
  async execute(context: AgentContext): Promise<AgentOutput> {
    const logger = this.getLogger();
    const startTime = Date.now();
    let reflexionLoop = 0;

    try {
      let output = await this.analyze(context);
      
      // Reflexion loop if confidence is below threshold
      while (
        output.shouldReflect && 
        output.confidence < this.confidenceThreshold && 
        reflexionLoop < this.maxReflexionLoops
      ) {
        reflexionLoop++;
        const refinedContext: AgentContext = {
          ...context,
          previousAnalysis: context.previousAnalysis 
            ? new Map([...context.previousAnalysis, [this.id, output]])
            : new Map([[this.id, output]]),
        };
        
        output = await this.reflect(output, refinedContext);
        output = { ...output, reflexionLoop };
      }

      logPerformance(logger, 'execute', startTime, {
        agentId: this.id,
        confidence: output.confidence,
        reflexionLoops: reflexionLoop,
      });

      return output;
    } catch (error) {
      logError(logger, error, {
        operation: 'execute',
        agentId: this.id,
        context: {
          interviewId: context.interviewId,
          responseId: context.responseId,
        },
      });

      // Return a fallback output on error
      return this.createErrorOutput(error, reflexionLoop);
    }
  }

  /**
   * Reflexion method for improving low-confidence outputs
   * 
   * Override this method in subclasses to implement custom reflexion logic.
   * Default implementation just re-runs analyze with previous output context.
   * 
   * @param previousOutput - The output from the previous attempt
   * @param context - The updated context with previous analysis
   * @returns Promise resolving to refined output
   */
  protected async reflect(
    previousOutput: AgentOutput,
    context: AgentContext
  ): Promise<AgentOutput> {
    // Default: re-analyze with previous context
    // Subclasses can override for more sophisticated reflexion
    const output = await this.analyze(context);
    
    // Boost confidence slightly if reflexion was triggered
    return {
      ...output,
      confidence: Math.min(1, output.confidence + 0.1),
      shouldReflect: output.confidence + 0.1 < this.confidenceThreshold,
    };
  }

  /**
   * Create a standardized output object
   * 
   * @param result - The analysis result data
   * @param confidence - Confidence score (0-1)
   * @param metadata - Additional metadata
   * @param reflexionLoop - Current reflexion loop count
   * @returns Properly formatted AgentOutput
   */
  protected createOutput(
    result: unknown,
    confidence: number,
    metadata?: Record<string, unknown>,
    reflexionLoop: number = 0
  ): AgentOutput {
    return {
      type: this.id as AgentOutput['type'],
      result,
      confidence,
      metadata,
      shouldReflect: confidence < this.confidenceThreshold,
      reflexionLoop,
    };
  }

  /**
   * Create an error output when execution fails
   * 
   * @param error - The error that occurred
   * @param reflexionLoop - Current reflexion loop count
   * @returns AgentOutput with error information
   */
  protected createErrorOutput(
    error: unknown,
    reflexionLoop: number = 0
  ): AgentOutput {
    return {
      type: this.id as AgentOutput['type'],
      result: {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      confidence: 0,
      metadata: {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        timestamp: new Date().toISOString(),
      },
      shouldReflect: false,
      reflexionLoop,
    };
  }

  /**
   * Get this agent's capability definition
   */
  getCapability(): AgentCapability {
    return DEFAULT_AGENT_CAPABILITIES[this.id] || {
      type: this.id,
      description: this.description,
      inputTypes: ['AgentContext'],
      outputTypes: ['AgentOutput'],
      maxConcurrency: 1,
      reflexionEnabled: true,
    };
  }

  /**
   * Register this agent with the global registry
   */
  register(): void {
    const registry = getAgentRegistry();
    registry.register(this.id, this.getCapability());
  }
}

/**
 * Factory function type for creating agent instances
 */
export type AgentFactory<T extends BaseOrchestrationAgent> = () => T;

/**
 * Agent executor function type compatible with orchestrator
 */
export type AgentExecutor = (context: AgentContext) => Promise<AgentOutput>;

/**
 * Create an executor function from an agent instance
 * 
 * @param agent - The agent instance
 * @returns Executor function for use with orchestrator
 */
export function createAgentExecutor(
  agent: BaseOrchestrationAgent
): AgentExecutor {
  return (context: AgentContext) => agent.execute(context);
}
