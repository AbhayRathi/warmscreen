# Agent Orchestration System

A multi-agent orchestration layer for collaborative interview analysis, designed for enterprise-grade hiring intelligence.

## Architecture Overview

The Agent Orchestration System implements a multi-agent architecture where specialized AI agents analyze interviews collaboratively:

```
Interview Response
       ↓
[Orchestrator Agent] ← Main coordinator
       ↓
├─→ [Analyzer Agent]  → Deep technical analysis
├─→ [Verifier Agent]  → Fact-checking, consistency
├─→ [Tagger Agent]    → Skill extraction, categorization
├─→ [Scorer Agent]    → Multi-dimensional scoring
└─→ [Narrator Agent]  → Human-readable explanations
       ↓
[Feedback Loop System] → Learn from outcomes
       ↓
[Pattern Repository]   → High-signal patterns database
```

### Key Features

- **Multi-agent coordination** with dependency-based execution order
- **Priority-based messaging** for inter-agent communication
- **Pattern detection** for identifying high-signal interview patterns
- **Performance tracking** with rolling averages and trend analysis
- **Health monitoring** with healthy/degraded/unhealthy status
- **Configurable pipelines** for response analysis and interview finalization

## Agents

The orchestration system includes 5 specialized agents that work together to analyze interview responses:

### ANALYZER (`AnalyzerOrchestrationAgent`)
Deep technical analysis of interview responses including:
- Technical competency scoring
- Communication quality assessment
- Response depth evaluation
- Structure analysis (introduction, conclusion, logical flow)
- Technical concept extraction

**Output**: `AnalysisResult` with scores, insights, and technical concepts

### TAGGER (`TaggerOrchestrationAgent`)
Skill extraction and categorization including:
- Technical skill tags (programming, leadership, etc.)
- Behavioral pattern tags (growth-mindset, collaborative, etc.)
- Position-specific competency mapping
- Sentiment analysis
- Keyword extraction

**Output**: `TaggingResult` with skill tags, behavioral tags, and sentiment

### VERIFIER (`VerifierOrchestrationAgent`)
Three-stage verification system:
1. **Consistency Check** - Score-tag alignment, agent agreement
2. **Factual Audit** - Technical accuracy, concept coverage
3. **Reflexion Decision** - Recommendations and confidence scoring

**Output**: `VerificationResult` with checks, issues, and recommendations

### SCORER (`ScorerOrchestrationAgent`)
Multi-dimensional scoring with position-specific models:
- Weighted scoring across dimensions (technical, communication, etc.)
- Position-specific scoring models (Software Engineer, Product Manager, etc.)
- Hiring decision generation (STRONG_HIRE, HIRE, NO_HIRE, STRONG_NO_HIRE)
- Decision confidence calculation

**Output**: `ScoringResult` with overall score, component scores, and decision

### NARRATOR (`NarratorOrchestrationAgent`)
Human-readable explanation generation:
- Executive summary creation
- Strengths and weaknesses analysis
- Key factor identification
- Recommendation generation
- Detailed markdown explanation

**Output**: `NarrationResult` with summary, explanation, and recommendations

## Quick Start

### Using Orchestrated Agents Directly

```typescript
import {
  getAnalyzerAgent,
  getTaggerAgent,
  getVerifierAgent,
  getScorerAgent,
  getNarratorAgent,
  AgentContext,
  AgentTypes,
} from '@/lib/agents';

// Create context for analysis
const context: AgentContext = {
  interviewId: 'int-123',
  responseId: 'resp-456',
  question: {
    id: 'q-1',
    content: 'Explain React state management',
    category: 'technical',
    difficulty: 'MEDIUM',
    position: 'Frontend Engineer',
    expectedConcepts: ['useState', 'useReducer', 'context'],
    keyFacts: ['React state is immutable'],
  },
  response: {
    transcript: 'React manages state using hooks like useState...',
    duration: 120,
  },
  position: 'Frontend Engineer',
  candidateName: 'John Doe',
};

// Execute agents individually
const analyzerOutput = await getAnalyzerAgent().execute(context);
const taggerOutput = await getTaggerAgent().execute(context);

// Pass previous analysis to dependent agents
const verifierContext = {
  ...context,
  previousAnalysis: new Map([
    [AgentTypes.ANALYZER, analyzerOutput],
    [AgentTypes.TAGGER, taggerOutput],
  ]),
};
const verifierOutput = await getVerifierAgent().execute(verifierContext);
```

### Using the Orchestrator

```typescript
import { getOrchestratorAgent, AgentTypes } from '@/lib/agents';

// Get orchestrator instance
const orchestrator = getOrchestratorAgent();

// Register custom executor for an agent
orchestrator.registerExecutor(AgentTypes.ANALYZER, async (context) => {
  // Your custom analysis logic
  return {
    type: 'ANALYZER',
    result: {
      concepts: ['react', 'hooks', 'state management'],
      keyFacts: ['Explained useState correctly'],
      insights: ['Strong understanding of React fundamentals'],
    },
    confidence: 0.85,
    reflexionLoop: 0,
  };
});

// Process interview response through agent swarm
const session = await orchestrator.processResponse({
  interviewId: 'int-123',
  responseId: 'resp-456',
  question: {
    id: 'q-1',
    content: 'Explain React state management',
    category: 'technical',
    difficulty: 'MEDIUM',
    position: 'Frontend Engineer',
  },
  response: {
    transcript: 'React manages state using hooks like useState...',
    duration: 120,
  },
  position: 'Frontend Engineer',
});

console.log(session.status); // 'COMPLETED'
console.log(session.results); // Map of agent results
```

## Configuration

### Environment Variables

| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `AGENT_MAX_RETRIES` | Maximum retry attempts per agent | 3 | 0-10 |
| `AGENT_RETRY_DELAY_MS` | Base delay between retries (ms) | 1000 | 100-10000 |
| `AGENT_MAX_EXECUTION_TIME_MS` | Agent execution timeout (ms) | 30000 | 1000-300000 |
| `AGENT_MAX_CONCURRENT` | Maximum concurrent agents | 10 | 1-100 |
| `AGENT_PIPELINE_MAX_TOTAL_TIME_MS` | Pipeline timeout (ms) | 45000 | 5000-600000 |
| `AGENT_MESSAGE_QUEUE_MAX_SIZE` | Message queue limit | 1000 | 100-10000 |
| `LOG_LEVEL` | Logging verbosity | info | trace/debug/info/warn/error/fatal |
| `NODE_ENV` | Environment mode | development | development/production/test |

### Usage Example

```typescript
import { agentConfig, getRetryConfig } from '@/lib/agents';

// Access config values
console.log(agentConfig.MAX_RETRIES);
console.log(agentConfig.LOG_LEVEL);

// Get typed config groups
const retryConfig = getRetryConfig();
console.log(retryConfig.maxRetries, retryConfig.delayMs);
```

## Pipelines

### Response Analysis Pipeline

Processes individual interview responses:

1. **ANALYZER** → Extracts concepts and key facts
2. **TAGGER** → Adds skill and topic tags
3. **VERIFIER** → Validates accuracy and consistency
4. **SCORER** → Assigns preliminary scores

### Finalization Pipeline

Generates final interview assessment:

1. **SCORER** → Calculates final scores
2. **NARRATOR** → Creates summary and explanation
3. **VERIFIER** → Final validation check

### Pipeline Configuration

```typescript
import { RESPONSE_ANALYSIS_PIPELINE, FINALIZATION_PIPELINE } from '@/lib/agents';

// Pipelines are pre-configured with:
// - Stage ordering and dependencies
// - Timeout settings
// - Required vs optional stages
// - Error handling behavior
```

## Error Handling

### Automatic Retries

Agents automatically retry on failure with exponential backoff:

```typescript
// Retry behavior (configurable via env vars)
// Attempt 1: Immediate
// Attempt 2: Wait 1 second
// Attempt 3: Wait 2 seconds  
// Attempt 4: Wait 4 seconds (capped at 8s)
```

### Graceful Degradation

Non-required pipeline stages can fail without failing the entire pipeline:

```typescript
// Pipeline continues if optional stage fails
// Required stages will cause pipeline failure
```

### Session Recovery

```typescript
// Get session status
const session = orchestrator.getSession(sessionId);
console.log(session.status); // 'COMPLETED' | 'FAILED' | 'RUNNING' | 'PENDING'

// Get detailed results
const results = orchestrator.getSessionResults(sessionId);
results.forEach((result, agentType) => {
  console.log(agentType, result.success, result.latencyMs);
});
```

## Performance

### Benchmarks

- Handles **20+ concurrent** pipeline executions
- Processes **500+ messages/second** through communication system
- **< 10ms** execution order calculation
- **< 100ms** session cleanup for 50+ sessions

### Performance Monitoring

```typescript
// Get health status
const health = orchestrator.getHealthStatus();
console.log(health.status); // 'healthy' | 'degraded' | 'unhealthy'
console.log(health.activeSessions);
console.log(health.performanceSummary);
console.log(health.underperformingAgents);

// Get orchestration summary
const summary = orchestrator.getOrchestrationSummary('int-123');
console.log(summary.avgLatencyMs);
console.log(summary.avgConfidence);
console.log(summary.agentPerformance);
```

### Session Cleanup

```typescript
// Clean up old sessions (default: 1 hour old)
const cleaned = orchestrator.cleanupOldSessions(3600000);
console.log(`Cleaned ${cleaned} sessions`);
```

## Testing

### Test Coverage

- **Unit tests**: 344+ tests covering all modules
- **Load tests**: Concurrent execution and throughput testing
- **Coverage**: 90%+ statements, 90%+ functions, 75%+ branches

### Running Tests

```bash
# Run all agent tests
npm run test -- --filter=web

# Run orchestrated agent tests
npm run test -- lib/agents/__tests__/orchestrated-agents.test.ts

# Run with coverage
npm run test -- --filter=web --coverage

# Run performance tests
npm run test -- --run lib/agents/__tests__/performance.test.ts
```

## Troubleshooting

### Common Issues

#### Pipeline Timeouts

**Symptom**: Pipeline fails with timeout error

**Solution**: Increase `AGENT_MAX_EXECUTION_TIME_MS` or `AGENT_PIPELINE_MAX_TOTAL_TIME_MS`

```bash
AGENT_MAX_EXECUTION_TIME_MS=60000 npm start
```

#### Rate Limiting

**Symptom**: Agents queuing or slow execution

**Solution**: Adjust `AGENT_MAX_CONCURRENT` based on available resources

```bash
AGENT_MAX_CONCURRENT=20 npm start
```

#### Memory Issues

**Symptom**: Memory usage growing over time

**Solution**: Enable session cleanup and reduce message queue size

```typescript
// Periodic cleanup
setInterval(() => {
  orchestrator.cleanupOldSessions(3600000);
}, 300000); // Every 5 minutes
```

#### Debug Logging

**Symptom**: Need more detailed logs

**Solution**: Set `LOG_LEVEL=debug` or `LOG_LEVEL=trace`

```bash
LOG_LEVEL=debug npm start
```

## Monitoring

### Structured Logging

All agent operations are logged with structured JSON:

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:00.000Z",
  "agent": "ORCHESTRATOR",
  "sessionId": "sess_123",
  "interviewId": "int-456",
  "operation": "processResponse",
  "durationMs": 1234,
  "msg": "processResponse completed in 1234ms"
}
```

### Logger Usage

```typescript
import { createAgentLogger, logMetrics, logError } from '@/lib/agents';

const logger = createAgentLogger('MY_AGENT');

// Info logging
logger.info({ operation: 'myOp' }, 'Operation started');

// Metrics logging
logMetrics(logger, 'processItem', {
  latencyMs: 150,
  confidence: 0.92,
  success: true,
});

// Error logging
logError(logger, error, {
  operation: 'processItem',
  itemId: '123',
});
```

## API Reference

### OrchestratorAgent

| Method | Description |
|--------|-------------|
| `registerExecutor(agentType, executor)` | Register custom agent executor |
| `processResponse(context)` | Process single response through pipeline |
| `finalizeInterview(context, responses)` | Generate final interview assessment |
| `getSession(sessionId)` | Get session by ID |
| `getSessionsForInterview(interviewId)` | Get all sessions for interview |
| `getSessionResults(sessionId)` | Get agent results for session |
| `getOrchestrationSummary(interviewId)` | Get performance summary |
| `cleanupOldSessions(maxAgeMs)` | Clean up old sessions |
| `getHealthStatus()` | Get system health status |

### AgentCommunicationManager

| Method | Description |
|--------|-------------|
| `send(from, to, payload, priority)` | Send message between agents |
| `sendRequest(from, to, context, priority)` | Send request message |
| `sendResponse(from, to, data, replyTo, correlationId)` | Send response message |
| `sendError(from, to, error, correlationId)` | Send error message |
| `broadcast(channel, from, data)` | Broadcast to all agents in channel |
| `subscribe(agentType, handler)` | Subscribe to messages |
| `getRecentMessages(limit)` | Get recent messages |

### PatternRepository

| Method | Description |
|--------|-------------|
| `addPattern(config)` | Add new pattern |
| `getPattern(id)` | Get pattern by ID |
| `matchPatterns(context)` | Match patterns against context |
| `recordOccurrence(patternId)` | Record pattern occurrence |
| `amplifyPattern(patternId)` | Mark pattern as amplified |

### FeedbackCollector

| Method | Description |
|--------|-------------|
| `recordFeedback(interviewId, agentType, type, signal)` | Record feedback |
| `getFeedbackForAgent(agentType)` | Get feedback for agent |
| `getFeedbackForInterview(interviewId)` | Get feedback for interview |
| `getAccuracyTrend(agentType)` | Get accuracy trend |

### BaseOrchestrationAgent (Abstract)

All orchestrated agents extend this base class:

| Property | Description |
|----------|-------------|
| `id` | Agent type identifier (e.g., `ANALYZER`) |
| `name` | Human-readable agent name |
| `description` | What the agent does |
| `capabilities` | List of capabilities provided |

| Method | Description |
|--------|-------------|
| `execute(context)` | Execute agent with full orchestration support |
| `analyze(context)` | Abstract method - core analysis logic |
| `getCapability()` | Get agent capability definition |
| `register()` | Register with global registry |

### AnalyzerOrchestrationAgent

| Method | Description |
|--------|-------------|
| `getAnalyzerAgent()` | Get singleton instance |
| `resetAnalyzerAgent()` | Reset singleton (for testing) |

**Output Type**: `AnalysisResult`
- `scores`: { technical, communication, depth, problemSolving?, clarity? }
- `confidence`: 0-1 confidence score
- `insights`: Array of insight strings
- `technicalConcepts`: Extracted technical concepts
- `structureAnalysis`: { hasIntroduction, hasConclusion, logicalFlow }

### TaggerOrchestrationAgent

| Method | Description |
|--------|-------------|
| `getTaggerAgent()` | Get singleton instance |
| `resetTaggerAgent()` | Reset singleton (for testing) |

**Output Type**: `TaggingResult`
- `skillTags`: Technical/soft skill tags
- `behavioralTags`: Behavioral pattern tags
- `competencyTags`: Position-specific competencies
- `keywords`: Extracted keywords
- `sentiment`: -1 to 1 sentiment score
- `confidence`: 0-1 confidence score

### VerifierOrchestrationAgent

| Method | Description |
|--------|-------------|
| `getVerifierAgent()` | Get singleton instance |
| `resetVerifierAgent()` | Reset singleton (for testing) |

**Output Type**: `VerificationResult`
- `isConsistent`: Boolean - passed consistency check
- `isAccurate`: Boolean - passed factual audit
- `confidence`: 0-1 confidence score
- `checks`: Array of verification checks
- `issues`: Detected issues
- `recommendations`: Action recommendations
- `reflexionRequired`: Should trigger re-run
- `agentToRefine`: Which agent needs refinement
- `critiquePrompt`: Instruction for re-run

### ScorerOrchestrationAgent

| Method | Description |
|--------|-------------|
| `getScorerAgent()` | Get singleton instance |
| `resetScorerAgent()` | Reset singleton (for testing) |

**Output Type**: `ScoringResult`
- `overallScore`: 0-100 overall score
- `componentScores`: Scores per dimension
- `decision`: STRONG_HIRE | HIRE | NO_HIRE | STRONG_NO_HIRE
- `decisionConfidence`: 0-1 confidence in decision
- `weights`: Applied weights per dimension
- `thresholds`: Decision thresholds
- `breakdown`: Detailed score breakdown

### NarratorOrchestrationAgent

| Method | Description |
|--------|-------------|
| `getNarratorAgent()` | Get singleton instance |
| `resetNarratorAgent()` | Reset singleton (for testing) |

**Output Type**: `NarrationResult`
- `summary`: Executive summary string
- `detailedExplanation`: Markdown formatted explanation
- `strengths`: Array of strength descriptions
- `weaknesses`: Array of weakness descriptions
- `keyFactors`: Key decision factors with impact scores
- `recommendations`: Action recommendations
- `scoringBreakdown`: Score per dimension
- `agentContributions`: What each agent contributed
- `confidence`: 0-1 confidence score

## License

See repository LICENSE file for details.
