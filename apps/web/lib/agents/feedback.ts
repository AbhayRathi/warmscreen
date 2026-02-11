/**
 * Feedback Loop System
 * 
 * Implements feedback collection, agent performance tracking, and learning
 * from interview outcomes to continuously improve agent accuracy.
 */

import {
  AgentType,
  AgentTypes,
  FeedbackEntry,
  AgentPerformanceMetrics,
} from './types';
import { AgentOutput } from '@warmscreen/shared';

/**
 * Generate a unique feedback ID
 */
function generateFeedbackId(): string {
  return `fb_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Feedback types for categorizing feedback entries
 */
export type FeedbackType = 'ACCURACY' | 'PERFORMANCE' | 'CONSISTENCY' | 'PATTERN';

/**
 * Feedback signal for learning
 */
export interface FeedbackSignal {
  expected?: unknown;
  actual?: unknown;
  delta?: number;
  pattern?: string;
  confidence?: number;
  tags?: string[];
}

/**
 * Feedback Collector
 * 
 * Collects and manages feedback for agent learning and improvement.
 */
export class FeedbackCollector {
  private entries: Map<string, FeedbackEntry>;
  private agentFeedback: Map<AgentType, FeedbackEntry[]>;
  private readonly maxEntriesPerAgent: number;

  constructor(maxEntriesPerAgent: number = 500) {
    this.entries = new Map();
    this.agentFeedback = new Map();
    this.maxEntriesPerAgent = maxEntriesPerAgent;

    // Initialize feedback storage for each agent type
    Object.values(AgentTypes).forEach((type) => {
      this.agentFeedback.set(type as AgentType, []);
    });
  }

  /**
   * Record feedback for an agent execution
   */
  recordFeedback(
    interviewId: string,
    agentType: AgentType,
    feedbackType: FeedbackType,
    signal: FeedbackSignal,
    actionTaken?: string,
    outcome?: string
  ): FeedbackEntry {
    const entry: FeedbackEntry = {
      id: generateFeedbackId(),
      interviewId,
      agentType,
      timestamp: new Date(),
      feedbackType,
      signal,
      actionTaken,
      outcome,
    };

    this.entries.set(entry.id, entry);

    // Add to agent-specific feedback
    const agentFeedbackList = this.agentFeedback.get(agentType) || [];
    agentFeedbackList.push(entry);

    // Maintain max size per agent
    if (agentFeedbackList.length > this.maxEntriesPerAgent) {
      agentFeedbackList.shift();
    }

    this.agentFeedback.set(agentType, agentFeedbackList);

    return entry;
  }

  /**
   * Record accuracy feedback when comparing expected vs actual results
   */
  recordAccuracyFeedback(
    interviewId: string,
    agentType: AgentType,
    expected: unknown,
    actual: unknown,
    delta?: number
  ): FeedbackEntry {
    return this.recordFeedback(
      interviewId,
      agentType,
      'ACCURACY',
      { expected, actual, delta },
      delta !== undefined && delta > 0.2 ? 'Significant deviation detected' : undefined
    );
  }

  /**
   * Record performance feedback based on latency and success
   */
  recordPerformanceFeedback(
    interviewId: string,
    agentType: AgentType,
    latencyMs: number,
    success: boolean,
    confidence: number
  ): FeedbackEntry {
    const expectedLatency = this.getExpectedLatency(agentType);
    const delta = (latencyMs - expectedLatency) / expectedLatency;

    return this.recordFeedback(
      interviewId,
      agentType,
      'PERFORMANCE',
      { expected: expectedLatency, actual: latencyMs, delta, confidence },
      success ? 'Execution successful' : 'Execution failed'
    );
  }

  /**
   * Record consistency feedback when verifying agent agreement
   */
  recordConsistencyFeedback(
    interviewId: string,
    agentType: AgentType,
    outputs: AgentOutput[],
    isConsistent: boolean
  ): FeedbackEntry {
    const confidences = outputs.map((o) => o.confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const delta = Math.max(...confidences) - Math.min(...confidences);

    return this.recordFeedback(
      interviewId,
      agentType,
      'CONSISTENCY',
      { expected: 1, actual: isConsistent ? 1 : 0, delta, confidence: avgConfidence },
      isConsistent ? 'Outputs consistent' : 'Inconsistency detected'
    );
  }

  /**
   * Record pattern-based feedback
   */
  recordPatternFeedback(
    interviewId: string,
    agentType: AgentType,
    patternName: string,
    patternStrength: number,
    tags?: string[]
  ): FeedbackEntry {
    return this.recordFeedback(
      interviewId,
      agentType,
      'PATTERN',
      { pattern: patternName, confidence: patternStrength, tags },
      `Pattern "${patternName}" detected with strength ${patternStrength.toFixed(2)}`
    );
  }

  /**
   * Get feedback entries for an agent
   */
  getFeedbackForAgent(agentType: AgentType): FeedbackEntry[] {
    return this.agentFeedback.get(agentType) || [];
  }

  /**
   * Get feedback entries for an interview
   */
  getFeedbackForInterview(interviewId: string): FeedbackEntry[] {
    return Array.from(this.entries.values()).filter(
      (entry) => entry.interviewId === interviewId
    );
  }

  /**
   * Get recent feedback entries
   */
  getRecentFeedback(limit: number = 100): FeedbackEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get expected latency for an agent type (in ms)
   */
  private getExpectedLatency(agentType: AgentType): number {
    const latencies: Record<AgentType, number> = {
      [AgentTypes.ORCHESTRATOR]: 5000,
      [AgentTypes.ANALYZER]: 3000,
      [AgentTypes.VERIFIER]: 2500,
      [AgentTypes.TAGGER]: 2000,
      [AgentTypes.SCORER]: 2500,
      [AgentTypes.NARRATOR]: 3000,
      [AgentTypes.PLANNER]: 2000,
      [AgentTypes.CONDUCTOR]: 5000,
    };
    return latencies[agentType] || 3000;
  }

  /**
   * Calculate average accuracy for an agent
   */
  getAccuracyMetrics(agentType: AgentType): {
    avgDelta: number;
    totalFeedback: number;
    recentTrend: 'improving' | 'stable' | 'declining';
  } {
    const feedback = this.getFeedbackForAgent(agentType).filter(
      (f) => f.feedbackType === 'ACCURACY' && f.signal.delta !== undefined
    );

    if (feedback.length === 0) {
      return { avgDelta: 0, totalFeedback: 0, recentTrend: 'stable' };
    }

    const deltas = feedback.map((f) => Math.abs(f.signal.delta || 0));
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

    // Calculate trend from last 20 entries
    const recentDeltas = deltas.slice(-20);
    const olderDeltas = deltas.slice(-40, -20);

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentDeltas.length > 0 && olderDeltas.length > 0) {
      const recentAvg = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length;
      const olderAvg = olderDeltas.reduce((a, b) => a + b, 0) / olderDeltas.length;

      if (recentAvg < olderAvg * 0.9) {
        trend = 'improving';
      } else if (recentAvg > olderAvg * 1.1) {
        trend = 'declining';
      }
    }

    return { avgDelta, totalFeedback: feedback.length, recentTrend: trend };
  }

  /**
   * Clear all feedback entries
   */
  clear(): void {
    this.entries.clear();
    Object.values(AgentTypes).forEach((type) => {
      this.agentFeedback.set(type as AgentType, []);
    });
  }
}

/**
 * Agent Performance Tracker
 * 
 * Tracks and aggregates agent performance metrics over time.
 */
export class AgentPerformanceTracker {
  private metrics: Map<AgentType, AgentPerformanceMetrics[]>;
  private readonly maxMetricsPerAgent: number;
  private readonly aggregationPeriodMs: number;

  constructor(
    maxMetricsPerAgent: number = 100,
    aggregationPeriodMs: number = 3600000 // 1 hour
  ) {
    this.metrics = new Map();
    this.maxMetricsPerAgent = maxMetricsPerAgent;
    this.aggregationPeriodMs = aggregationPeriodMs;

    // Initialize metrics storage for each agent type
    Object.values(AgentTypes).forEach((type) => {
      this.metrics.set(type as AgentType, []);
    });
  }

  /**
   * Record execution metrics
   */
  recordExecution(
    agentType: AgentType,
    latencyMs: number,
    confidence: number,
    success: boolean,
    reflexionLoops: number
  ): void {
    const agentMetrics = this.metrics.get(agentType) || [];
    const now = new Date();
    const periodStart = new Date(
      Math.floor(now.getTime() / this.aggregationPeriodMs) * this.aggregationPeriodMs
    );
    const periodEnd = new Date(periodStart.getTime() + this.aggregationPeriodMs);

    // Find or create current period metrics
    let currentMetrics = agentMetrics.find(
      (m) =>
        m.period.start.getTime() === periodStart.getTime() &&
        m.period.end.getTime() === periodEnd.getTime()
    );

    if (!currentMetrics) {
      currentMetrics = {
        agentType,
        period: { start: periodStart, end: periodEnd },
        executions: 0,
        avgLatencyMs: 0,
        avgConfidence: 0,
        successRate: 0,
        reflexionRate: 0,
        errorRate: 0,
      };
      agentMetrics.push(currentMetrics);
    }

    // Update metrics with new execution
    const prevExecutions = currentMetrics.executions;
    currentMetrics.executions++;

    currentMetrics.avgLatencyMs =
      (currentMetrics.avgLatencyMs * prevExecutions + latencyMs) / currentMetrics.executions;

    currentMetrics.avgConfidence =
      (currentMetrics.avgConfidence * prevExecutions + confidence) / currentMetrics.executions;

    const prevSuccesses = currentMetrics.successRate * prevExecutions;
    currentMetrics.successRate =
      (prevSuccesses + (success ? 1 : 0)) / currentMetrics.executions;

    const prevReflexions = currentMetrics.reflexionRate * prevExecutions;
    currentMetrics.reflexionRate =
      (prevReflexions + (reflexionLoops > 0 ? 1 : 0)) / currentMetrics.executions;

    currentMetrics.errorRate = 1 - currentMetrics.successRate;

    // Maintain max metrics per agent
    if (agentMetrics.length > this.maxMetricsPerAgent) {
      agentMetrics.shift();
    }

    this.metrics.set(agentType, agentMetrics);
  }

  /**
   * Get latest metrics for an agent
   */
  getLatestMetrics(agentType: AgentType): AgentPerformanceMetrics | undefined {
    const agentMetrics = this.metrics.get(agentType) || [];
    return agentMetrics[agentMetrics.length - 1];
  }

  /**
   * Get all metrics for an agent
   */
  getAllMetrics(agentType: AgentType): AgentPerformanceMetrics[] {
    return this.metrics.get(agentType) || [];
  }

  /**
   * Get aggregated metrics across all agents
   */
  getAggregatedMetrics(): AgentPerformanceMetrics[] {
    const result: AgentPerformanceMetrics[] = [];

    for (const [agentType, metrics] of this.metrics) {
      if (metrics.length === 0) continue;

      const latest = metrics[metrics.length - 1];
      if (latest) {
        result.push(latest);
      }
    }

    return result;
  }

  /**
   * Get performance summary across all agents
   */
  getPerformanceSummary(): {
    totalExecutions: number;
    avgLatencyMs: number;
    avgConfidence: number;
    overallSuccessRate: number;
    overallReflexionRate: number;
  } {
    let totalExecutions = 0;
    let weightedLatency = 0;
    let weightedConfidence = 0;
    let weightedSuccessRate = 0;
    let weightedReflexionRate = 0;

    for (const metrics of this.metrics.values()) {
      for (const m of metrics) {
        totalExecutions += m.executions;
        weightedLatency += m.avgLatencyMs * m.executions;
        weightedConfidence += m.avgConfidence * m.executions;
        weightedSuccessRate += m.successRate * m.executions;
        weightedReflexionRate += m.reflexionRate * m.executions;
      }
    }

    return {
      totalExecutions,
      avgLatencyMs: totalExecutions > 0 ? weightedLatency / totalExecutions : 0,
      avgConfidence: totalExecutions > 0 ? weightedConfidence / totalExecutions : 0,
      overallSuccessRate: totalExecutions > 0 ? weightedSuccessRate / totalExecutions : 0,
      overallReflexionRate: totalExecutions > 0 ? weightedReflexionRate / totalExecutions : 0,
    };
  }

  /**
   * Identify underperforming agents
   */
  getUnderperformingAgents(
    minSuccessRate: number = 0.8,
    maxLatencyMs: number = 5000
  ): AgentType[] {
    const underperforming: AgentType[] = [];

    for (const [agentType, metrics] of this.metrics) {
      if (metrics.length === 0) continue;

      const latest = metrics[metrics.length - 1];
      if (
        latest &&
        (latest.successRate < minSuccessRate || latest.avgLatencyMs > maxLatencyMs)
      ) {
        underperforming.push(agentType);
      }
    }

    return underperforming;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    Object.values(AgentTypes).forEach((type) => {
      this.metrics.set(type as AgentType, []);
    });
  }
}

/**
 * Singleton instances
 */
let feedbackCollectorInstance: FeedbackCollector | null = null;
let performanceTrackerInstance: AgentPerformanceTracker | null = null;

/**
 * Get the global feedback collector instance
 */
export function getFeedbackCollector(): FeedbackCollector {
  if (!feedbackCollectorInstance) {
    feedbackCollectorInstance = new FeedbackCollector();
  }
  return feedbackCollectorInstance;
}

/**
 * Get the global performance tracker instance
 */
export function getPerformanceTracker(): AgentPerformanceTracker {
  if (!performanceTrackerInstance) {
    performanceTrackerInstance = new AgentPerformanceTracker();
  }
  return performanceTrackerInstance;
}

/**
 * Reset singletons (for testing)
 */
export function resetFeedbackSystem(): void {
  feedbackCollectorInstance = null;
  performanceTrackerInstance = null;
}
