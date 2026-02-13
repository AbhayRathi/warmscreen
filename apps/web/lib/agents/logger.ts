/**
 * Structured Logging for Agent Orchestration System
 * 
 * Provides structured JSON logging with context for agents.
 * Uses Pino for high-performance logging.
 */

import pino from 'pino';
import type { Logger } from 'pino';

/**
 * Agent log context
 */
export interface AgentLogContext {
  agent?: string;
  sessionId?: string;
  interviewId?: string;
  pipeline?: string;
  stage?: number;
  [key: string]: unknown;
}

/**
 * Get log level from environment
 */
function getLogLevel(): string {
  return process.env.LOG_LEVEL || 'info';
}

/**
 * Create base logger configuration
 */
function createBaseLogger(): Logger {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return pino({
    level: getLogLevel(),
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    transport: isDevelopment ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    } : undefined,
  });
}

/**
 * Main agent logger instance
 */
export const agentLogger = createBaseLogger();

/**
 * Create a child logger with agent context
 */
export function createAgentLogger(agentType: string, additionalContext?: AgentLogContext): Logger {
  return agentLogger.child({
    agent: agentType,
    ...additionalContext,
  });
}

/**
 * Create a session-specific logger
 */
export function createSessionLogger(sessionId: string, interviewId: string): Logger {
  return agentLogger.child({
    sessionId,
    interviewId,
  });
}

/**
 * Log metrics helper
 */
export function logMetrics(
  logger: Logger,
  operation: string,
  metrics: {
    latencyMs?: number;
    confidence?: number;
    success?: boolean;
    agentType?: string;
    [key: string]: unknown;
  }
): void {
  logger.info({ operation, metrics }, `${operation} metrics`);
}

/**
 * Log error with context
 */
export function logError(
  logger: Logger,
  error: Error | unknown,
  context: {
    operation: string;
    agentType?: string;
    sessionId?: string;
    [key: string]: unknown;
  }
): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  logger.error(
    {
      ...context,
      error: {
        message: errorMessage,
        stack: errorStack,
      },
    },
    `${context.operation} failed: ${errorMessage}`
  );
}

/**
 * Performance tracking logger
 */
export function logPerformance(
  logger: Logger,
  operation: string,
  startTime: number,
  additionalInfo?: Record<string, unknown>
): void {
  const duration = Date.now() - startTime;
  logger.info(
    {
      operation,
      durationMs: duration,
      ...additionalInfo,
    },
    `${operation} completed in ${duration}ms`
  );
}

/**
 * Log level check helpers
 */
export function isDebugEnabled(logger: Logger = agentLogger): boolean {
  return logger.isLevelEnabled('debug');
}

export function isTraceEnabled(logger: Logger = agentLogger): boolean {
  return logger.isLevelEnabled('trace');
}
