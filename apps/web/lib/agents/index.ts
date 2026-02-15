/**
 * Agent Orchestration System
 * 
 * Multi-agent orchestration layer for collaborative interview analysis.
 * 
 * Architecture:
 * 
 * Interview Response
 *     ↓
 * [Orchestrator Agent] ← Main coordinator
 *     ↓
 * ├─→ [Analyzer Agent] → Deep technical analysis
 * ├─→ [Verifier Agent] → Fact-checking, consistency
 * ├─→ [Tagger Agent] → Skill extraction, categorization
 * ├─→ [Scorer Agent] → Multi-dimensional scoring
 * └─→ [Narrator Agent] → Human-readable explanations
 *     ↓
 * [Feedback Loop System] → Learn from outcomes
 *     ↓
 * [Pattern Repository] → High-signal patterns database
 */

// Types and interfaces
export {
  type AgentType,
  AgentTypes,
  AgentStatus,
  MessagePriority,
  type AgentContext,
  type AgentCapability,
  type AgentRegistration,
  type AgentMessage,
  type AgentChannel,
  type AgentExecutionResult,
  type PipelineStage,
  type OrchestrationPipeline,
  type FeedbackEntry,
  type PatternDefinition,
  type PatternCondition,
  type PatternMatch,
  type AgentPerformanceMetrics,
  type OrchestrationSession,
  isAgentType,
  DEFAULT_AGENT_CAPABILITIES,
  RESPONSE_ANALYSIS_PIPELINE,
  FINALIZATION_PIPELINE,
} from './types';

// Agent Registry
export {
  AgentRegistry,
  getAgentRegistry,
} from './registry';

// Agent Communication
export {
  AgentCommunicationManager,
  getAgentCommunicationManager,
  resetAgentCommunicationManager,
} from './communication';

// Feedback System
export {
  FeedbackCollector,
  AgentPerformanceTracker,
  getFeedbackCollector,
  getPerformanceTracker,
  resetFeedbackSystem,
  type FeedbackType,
  type FeedbackSignal,
} from './feedback';

// Pattern Repository
export {
  PatternRepository,
  getPatternRepository,
  resetPatternRepository,
  type PatternCategory,
} from './patterns';

// Orchestrator Agent
export {
  OrchestratorAgent,
  getOrchestratorAgent,
  resetOrchestratorAgent,
} from './orchestrator';

// Logger
export {
  agentLogger,
  createAgentLogger,
  createSessionLogger,
  logMetrics,
  logError,
  logPerformance,
  isDebugEnabled,
  isTraceEnabled,
  type AgentLogContext,
} from './logger';

// Configuration
export {
  agentConfig,
  type AgentConfig,
  getConfigValue,
  isDevelopment,
  isProduction,
  isTest,
  getRetryConfig,
  getRateLimitConfig,
  getSessionConfig,
} from './config';

// Base Agent Class
export {
  BaseOrchestrationAgent,
  createAgentExecutor,
  type AgentFactory,
  type AgentExecutor,
} from './base-agent';

// Orchestrated Agent Implementations
export {
  AnalyzerOrchestrationAgent,
  getAnalyzerAgent,
  resetAnalyzerAgent,
  type AnalysisResult,
} from './analyzer-agent';

export {
  TaggerOrchestrationAgent,
  getTaggerAgent,
  resetTaggerAgent,
  type TaggingResult,
} from './tagger-agent';

export {
  VerifierOrchestrationAgent,
  getVerifierAgent,
  resetVerifierAgent,
  type VerificationResult,
  type VerificationCheck,
} from './verifier-agent';

export {
  ScorerOrchestrationAgent,
  getScorerAgent,
  resetScorerAgent,
  type ScoringResult,
  type ScoringModel,
  type HiringDecision,
} from './scorer-agent';

export {
  NarratorOrchestrationAgent,
  getNarratorAgent,
  resetNarratorAgent,
  type NarrationResult,
} from './narrator-agent';
