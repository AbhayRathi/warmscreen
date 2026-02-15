/**
 * Agent Configuration with Environment Validation
 * 
 * Validates all environment variables using Zod and exports
 * a typed configuration object.
 */

import { z } from 'zod';

/**
 * Agent Configuration Schema
 */
const AgentConfigSchema = z.object({
  // Agent execution limits
  MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  RETRY_DELAY_MS: z.coerce.number().min(100).max(10000).default(1000),
  MAX_EXECUTION_TIME_MS: z.coerce.number().min(1000).max(300000).default(30000),
  
  // Rate limiting
  MAX_CONCURRENT_AGENTS: z.coerce.number().min(1).max(100).default(10),
  
  // Pipeline configuration
  PIPELINE_MAX_TOTAL_TIME_MS: z.coerce.number().min(5000).max(600000).default(45000),
  
  // Message queue
  MESSAGE_QUEUE_MAX_SIZE: z.coerce.number().min(100).max(10000).default(1000),
  
  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Pattern repository
  PATTERN_AMPLIFICATION_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  PATTERN_MIN_OCCURRENCES: z.coerce.number().min(1).max(1000).default(10),
  
  // Performance tracking
  PERFORMANCE_TRACKING_ENABLED: z.coerce.boolean().default(true),
  METRICS_RETENTION_DAYS: z.coerce.number().min(1).max(365).default(30),
  
  // Session management
  SESSION_CLEANUP_INTERVAL_MS: z.coerce.number().min(60000).max(3600000).default(300000),
  SESSION_MAX_AGE_MS: z.coerce.number().min(300000).max(86400000).default(3600000),
});

/**
 * Parse and validate configuration from environment
 */
function parseConfig() {
  return AgentConfigSchema.parse({
    MAX_RETRIES: process.env.AGENT_MAX_RETRIES,
    RETRY_DELAY_MS: process.env.AGENT_RETRY_DELAY_MS,
    MAX_EXECUTION_TIME_MS: process.env.AGENT_MAX_EXECUTION_TIME_MS,
    MAX_CONCURRENT_AGENTS: process.env.AGENT_MAX_CONCURRENT,
    PIPELINE_MAX_TOTAL_TIME_MS: process.env.AGENT_PIPELINE_MAX_TOTAL_TIME_MS,
    MESSAGE_QUEUE_MAX_SIZE: process.env.AGENT_MESSAGE_QUEUE_MAX_SIZE,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_ENV: process.env.NODE_ENV,
    PATTERN_AMPLIFICATION_THRESHOLD: process.env.AGENT_PATTERN_AMPLIFICATION_THRESHOLD,
    PATTERN_MIN_OCCURRENCES: process.env.AGENT_PATTERN_MIN_OCCURRENCES,
    PERFORMANCE_TRACKING_ENABLED: process.env.AGENT_PERFORMANCE_TRACKING_ENABLED,
    METRICS_RETENTION_DAYS: process.env.AGENT_METRICS_RETENTION_DAYS,
    SESSION_CLEANUP_INTERVAL_MS: process.env.AGENT_SESSION_CLEANUP_INTERVAL_MS,
    SESSION_MAX_AGE_MS: process.env.AGENT_SESSION_MAX_AGE_MS,
  });
}

/**
 * Validated agent configuration
 */
export const agentConfig = parseConfig();

/**
 * Type for agent configuration
 */
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Get a specific config value with type safety
 */
export function getConfigValue<K extends keyof AgentConfig>(key: K): AgentConfig[K] {
  return agentConfig[key];
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return agentConfig.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return agentConfig.NODE_ENV === 'production';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return agentConfig.NODE_ENV === 'test';
}

/**
 * Get retry configuration
 */
export function getRetryConfig(): {
  maxRetries: number;
  delayMs: number;
  maxExecutionTimeMs: number;
} {
  return {
    maxRetries: agentConfig.MAX_RETRIES,
    delayMs: agentConfig.RETRY_DELAY_MS,
    maxExecutionTimeMs: agentConfig.MAX_EXECUTION_TIME_MS,
  };
}

/**
 * Get rate limiting configuration
 */
export function getRateLimitConfig(): {
  maxConcurrentAgents: number;
} {
  return {
    maxConcurrentAgents: agentConfig.MAX_CONCURRENT_AGENTS,
  };
}

/**
 * Get session configuration
 */
export function getSessionConfig(): {
  cleanupIntervalMs: number;
  maxAgeMs: number;
} {
  return {
    cleanupIntervalMs: agentConfig.SESSION_CLEANUP_INTERVAL_MS,
    maxAgeMs: agentConfig.SESSION_MAX_AGE_MS,
  };
}
