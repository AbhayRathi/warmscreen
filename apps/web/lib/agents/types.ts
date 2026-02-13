/**
 * Agent Orchestration System - Types
 * 
 * Defines interfaces and types for the multi-agent orchestration layer
 * where specialized AI agents analyze interviews collaboratively.
 */

import {
  AgentOutput,
  AgentType as SharedAgentType,
  AGENT_TYPES,
} from '@warmscreen/shared';

/**
 * Extended Agent Types - Re-export from shared and add ORCHESTRATOR
 * Uses string literal union to maintain compatibility with the shared package
 */
export type AgentType = SharedAgentType | 'ORCHESTRATOR';

/**
 * Agent Type constants - Extend the shared AGENT_TYPES
 */
export const AgentTypes = {
  ...AGENT_TYPES,
  ORCHESTRATOR: 'ORCHESTRATOR' as const,
} as const;

/**
 * Agent execution status
 */
export enum AgentStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  WAITING = 'WAITING',
}

/**
 * Message priority levels for agent communication
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Context provided to agents during execution
 */
export interface AgentContext {
  interviewId: string;
  responseId: string;
  question: {
    id: string;
    content: string;
    category: string;
    difficulty: string;
    position: string;
    expectedConcepts?: string[];
    keyFacts?: string[];
  };
  response: {
    transcript: string;
    audioUrl?: string;
    duration: number;
  };
  position: string;
  candidateName?: string;
  previousAnalysis?: Map<AgentType, AgentOutput>;
  sessionMetadata?: Record<string, unknown>;
}

/**
 * Agent capability definition
 */
export interface AgentCapability {
  type: AgentType;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  maxConcurrency: number;
  reflexionEnabled: boolean;
  dependsOn?: AgentType[];
}

/**
 * Agent registration entry
 */
export interface AgentRegistration {
  type: AgentType;
  capability: AgentCapability;
  status: AgentStatus;
  lastExecutionTime?: Date;
  executionCount: number;
  avgLatencyMs: number;
  avgConfidence: number;
  errorCount: number;
}

/**
 * Message for inter-agent communication
 */
export interface AgentMessage {
  id: string;
  fromAgent: AgentType;
  toAgent: AgentType;
  priority: MessagePriority;
  payload: {
    type: 'REQUEST' | 'RESPONSE' | 'NOTIFICATION' | 'ERROR';
    context?: AgentContext;
    data?: AgentOutput | Record<string, unknown>;
    error?: string;
  };
  timestamp: Date;
  correlationId: string;
  replyTo?: string;
}

/**
 * Agent channel for message routing
 */
export interface AgentChannel {
  name: string;
  agents: AgentType[];
  messageQueue: AgentMessage[];
  maxQueueSize: number;
  processingOrder: 'FIFO' | 'PRIORITY';
}

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  agentType: AgentType;
  output: AgentOutput;
  startTime: Date;
  endTime: Date;
  latencyMs: number;
  reflexionLoops: number;
  success: boolean;
  error?: string;
}

/**
 * Pipeline stage definition
 */
export interface PipelineStage {
  order: number;
  agentType: AgentType;
  required: boolean;
  timeout: number;
  retries: number;
  dependsOn?: AgentType[];
}

/**
 * Orchestration pipeline configuration
 */
export interface OrchestrationPipeline {
  name: string;
  stages: PipelineStage[];
  parallel: boolean;
  maxTotalTime: number;
  onError: 'STOP' | 'CONTINUE' | 'RETRY';
}

/**
 * Feedback entry for learning
 */
export interface FeedbackEntry {
  id: string;
  interviewId: string;
  agentType: AgentType;
  timestamp: Date;
  feedbackType: 'ACCURACY' | 'PERFORMANCE' | 'CONSISTENCY' | 'PATTERN';
  signal: {
    expected?: unknown;
    actual?: unknown;
    delta?: number;
    pattern?: string;
    confidence?: number;
    tags?: string[];
  };
  actionTaken?: string;
  outcome?: string;
}

/**
 * Pattern definition for pattern repository
 */
export interface PatternDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  signal: {
    conditions: PatternCondition[];
    minConfidence: number;
  };
  strength: number;
  occurrences: number;
  successRate?: number;
  amplified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pattern matching condition
 */
export interface PatternCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'matches';
  value: unknown;
  weight: number;
}

/**
 * Pattern match result
 */
export interface PatternMatch {
  pattern: PatternDefinition;
  matchScore: number;
  matchedConditions: PatternCondition[];
  context: Record<string, unknown>;
}

/**
 * Agent performance metrics
 */
export interface AgentPerformanceMetrics {
  agentType: AgentType;
  period: {
    start: Date;
    end: Date;
  };
  executions: number;
  avgLatencyMs: number;
  avgConfidence: number;
  successRate: number;
  reflexionRate: number;
  errorRate: number;
}

/**
 * Orchestration session state
 */
export interface OrchestrationSession {
  id: string;
  interviewId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  pipeline: OrchestrationPipeline;
  currentStage: number;
  results: Map<AgentType, AgentExecutionResult>;
  messages: AgentMessage[];
  startTime: Date;
  endTime?: Date;
  metadata: Record<string, unknown>;
}

/**
 * Type guard for AgentType
 */
export function isAgentType(value: string): value is AgentType {
  return Object.values(AgentTypes).includes(value as AgentType);
}

/**
 * Default agent capabilities
 */
export const DEFAULT_AGENT_CAPABILITIES: Record<AgentType, AgentCapability> = {
  [AgentTypes.ORCHESTRATOR]: {
    type: AgentTypes.ORCHESTRATOR,
    description: 'Main coordinator that manages agent pipeline and communication',
    inputTypes: ['AgentContext'],
    outputTypes: ['OrchestrationSession'],
    maxConcurrency: 1,
    reflexionEnabled: false,
  },
  [AgentTypes.ANALYZER]: {
    type: AgentTypes.ANALYZER,
    description: 'Deep technical analysis of interview responses',
    inputTypes: ['transcript', 'questionCategory'],
    outputTypes: ['scores', 'insights'],
    maxConcurrency: 3,
    reflexionEnabled: true,
  },
  [AgentTypes.VERIFIER]: {
    type: AgentTypes.VERIFIER,
    description: 'Fact-checking and consistency verification',
    inputTypes: ['candidateTranscript', 'agentOutputs'],
    outputTypes: ['verification', 'recommendations'],
    maxConcurrency: 2,
    reflexionEnabled: true,
    dependsOn: [AgentTypes.ANALYZER, AgentTypes.TAGGER],
  },
  [AgentTypes.TAGGER]: {
    type: AgentTypes.TAGGER,
    description: 'Skill extraction and categorization',
    inputTypes: ['transcript', 'position'],
    outputTypes: ['skillTags', 'behavioralTags'],
    maxConcurrency: 3,
    reflexionEnabled: true,
  },
  [AgentTypes.SCORER]: {
    type: AgentTypes.SCORER,
    description: 'Multi-dimensional scoring using position-specific models',
    inputTypes: ['responses', 'scoringModel'],
    outputTypes: ['overallScore', 'decision'],
    maxConcurrency: 2,
    reflexionEnabled: true,
    dependsOn: [AgentTypes.ANALYZER, AgentTypes.TAGGER],
  },
  [AgentTypes.NARRATOR]: {
    type: AgentTypes.NARRATOR,
    description: 'Human-readable explanations of decisions',
    inputTypes: ['decision', 'agentOutputs'],
    outputTypes: ['explanation'],
    maxConcurrency: 2,
    reflexionEnabled: true,
    dependsOn: [AgentTypes.SCORER],
  },
  [AgentTypes.PLANNER]: {
    type: AgentTypes.PLANNER,
    description: 'Adaptive question selection and interview planning',
    inputTypes: ['currentResponses', 'availableQuestions'],
    outputTypes: ['nextQuestionId', 'strategy'],
    maxConcurrency: 1,
    reflexionEnabled: true,
  },
  [AgentTypes.CONDUCTOR]: {
    type: AgentTypes.CONDUCTOR,
    description: 'Legacy conductor for backward compatibility',
    inputTypes: ['AgentContext'],
    outputTypes: ['AgentOutput'],
    maxConcurrency: 1,
    reflexionEnabled: false,
  },
};

/**
 * Default response analysis pipeline stages
 */
export const RESPONSE_ANALYSIS_PIPELINE: OrchestrationPipeline = {
  name: 'response_analysis',
  stages: [
    {
      order: 1,
      agentType: AgentTypes.ANALYZER,
      required: true,
      timeout: 10000,
      retries: 2,
    },
    {
      order: 2,
      agentType: AgentTypes.TAGGER,
      required: true,
      timeout: 8000,
      retries: 2,
    },
    {
      order: 3,
      agentType: AgentTypes.VERIFIER,
      required: true,
      timeout: 10000,
      retries: 1,
      dependsOn: [AgentTypes.ANALYZER, AgentTypes.TAGGER],
    },
    {
      order: 4,
      agentType: AgentTypes.SCORER,
      required: false,
      timeout: 8000,
      retries: 1,
      dependsOn: [AgentTypes.ANALYZER, AgentTypes.TAGGER],
    },
  ],
  parallel: false,
  maxTotalTime: 45000,
  onError: 'CONTINUE',
};

/**
 * Interview finalization pipeline stages
 */
export const FINALIZATION_PIPELINE: OrchestrationPipeline = {
  name: 'interview_finalization',
  stages: [
    {
      order: 1,
      agentType: AgentTypes.SCORER,
      required: true,
      timeout: 15000,
      retries: 2,
    },
    {
      order: 2,
      agentType: AgentTypes.NARRATOR,
      required: true,
      timeout: 12000,
      retries: 2,
      dependsOn: [AgentTypes.SCORER],
    },
    {
      order: 3,
      agentType: AgentTypes.VERIFIER,
      required: false,
      timeout: 10000,
      retries: 1,
      dependsOn: [AgentTypes.SCORER, AgentTypes.NARRATOR],
    },
  ],
  parallel: false,
  maxTotalTime: 60000,
  onError: 'STOP',
};
