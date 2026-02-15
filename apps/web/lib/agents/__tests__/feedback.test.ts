/**
 * Tests for Feedback System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FeedbackCollector,
  AgentPerformanceTracker,
  getFeedbackCollector,
  getPerformanceTracker,
  resetFeedbackSystem,
} from '../feedback';
import { AgentTypes } from '../types';

describe('FeedbackCollector', () => {
  let collector: FeedbackCollector;

  beforeEach(() => {
    resetFeedbackSystem();
    collector = getFeedbackCollector();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getFeedbackCollector();
      const instance2 = getFeedbackCollector();
      expect(instance1).toBe(instance2);
    });

    it('should reset properly', () => {
      const instance1 = getFeedbackCollector();
      resetFeedbackSystem();
      const instance2 = getFeedbackCollector();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Recording Feedback', () => {
    it('should record general feedback', () => {
      const entry = collector.recordFeedback(
        'int-123',
        AgentTypes.ANALYZER,
        'ACCURACY',
        { expected: 0.8, actual: 0.75, delta: 0.05 }
      );

      expect(entry).toBeDefined();
      expect(entry.id).toBeTruthy();
      expect(entry.interviewId).toBe('int-123');
      expect(entry.agentType).toBe(AgentTypes.ANALYZER);
      expect(entry.feedbackType).toBe('ACCURACY');
    });

    it('should record accuracy feedback', () => {
      const entry = collector.recordAccuracyFeedback(
        'int-123',
        AgentTypes.ANALYZER,
        0.8,
        0.75,
        0.05
      );

      expect(entry.feedbackType).toBe('ACCURACY');
      expect(entry.signal.expected).toBe(0.8);
      expect(entry.signal.actual).toBe(0.75);
    });

    it('should record performance feedback', () => {
      const entry = collector.recordPerformanceFeedback(
        'int-123',
        AgentTypes.ANALYZER,
        2500,
        true,
        0.85
      );

      expect(entry.feedbackType).toBe('PERFORMANCE');
      expect(entry.signal.actual).toBe(2500);
      expect(entry.signal.confidence).toBe(0.85);
    });

    it('should record consistency feedback', () => {
      const outputs = [
        {
          type: AgentTypes.ANALYZER,
          result: {},
          confidence: 0.85,
          reflexionLoop: 0,
        },
        {
          type: AgentTypes.TAGGER,
          result: {},
          confidence: 0.82,
          reflexionLoop: 0,
        },
      ];

      const entry = collector.recordConsistencyFeedback(
        'int-123',
        AgentTypes.VERIFIER,
        outputs,
        true
      );

      expect(entry.feedbackType).toBe('CONSISTENCY');
      expect(entry.actionTaken).toBe('Outputs consistent');
    });

    it('should record pattern feedback', () => {
      const entry = collector.recordPatternFeedback(
        'int-123',
        AgentTypes.ANALYZER,
        'technical_depth',
        0.85,
        ['react', 'typescript']
      );

      expect(entry.feedbackType).toBe('PATTERN');
      expect(entry.signal.pattern).toBe('technical_depth');
      expect(entry.signal.confidence).toBe(0.85);
      expect(entry.signal.tags).toContain('react');
    });
  });

  describe('Retrieving Feedback', () => {
    it('should get feedback for agent', () => {
      collector.recordFeedback('int-1', AgentTypes.ANALYZER, 'ACCURACY', {});
      collector.recordFeedback('int-2', AgentTypes.ANALYZER, 'PERFORMANCE', {});
      collector.recordFeedback('int-3', AgentTypes.TAGGER, 'ACCURACY', {});

      const analyzerFeedback = collector.getFeedbackForAgent(AgentTypes.ANALYZER);
      expect(analyzerFeedback.length).toBe(2);
    });

    it('should get feedback for interview', () => {
      collector.recordFeedback('int-123', AgentTypes.ANALYZER, 'ACCURACY', {});
      collector.recordFeedback('int-123', AgentTypes.TAGGER, 'ACCURACY', {});
      collector.recordFeedback('int-456', AgentTypes.ANALYZER, 'ACCURACY', {});

      const interviewFeedback = collector.getFeedbackForInterview('int-123');
      expect(interviewFeedback.length).toBe(2);
    });

    it('should get recent feedback', () => {
      for (let i = 0; i < 5; i++) {
        collector.recordFeedback(`int-${i}`, AgentTypes.ANALYZER, 'ACCURACY', {});
      }

      const recent = collector.getRecentFeedback(3);
      expect(recent.length).toBe(3);
    });
  });

  describe('Accuracy Metrics', () => {
    it('should calculate accuracy metrics', () => {
      collector.recordAccuracyFeedback('int-1', AgentTypes.ANALYZER, 0.8, 0.75, 0.05);
      collector.recordAccuracyFeedback('int-2', AgentTypes.ANALYZER, 0.9, 0.85, 0.05);
      collector.recordAccuracyFeedback('int-3', AgentTypes.ANALYZER, 0.7, 0.6, 0.1);

      const metrics = collector.getAccuracyMetrics(AgentTypes.ANALYZER);
      expect(metrics.totalFeedback).toBe(3);
      expect(metrics.avgDelta).toBeGreaterThan(0);
    });

    it('should return stable trend with no feedback', () => {
      const metrics = collector.getAccuracyMetrics(AgentTypes.ANALYZER);
      expect(metrics.recentTrend).toBe('stable');
      expect(metrics.totalFeedback).toBe(0);
    });
  });

  describe('Data Management', () => {
    it('should clear all feedback', () => {
      collector.recordFeedback('int-1', AgentTypes.ANALYZER, 'ACCURACY', {});
      collector.recordFeedback('int-2', AgentTypes.TAGGER, 'ACCURACY', {});

      collector.clear();

      expect(collector.getRecentFeedback().length).toBe(0);
      expect(collector.getFeedbackForAgent(AgentTypes.ANALYZER).length).toBe(0);
    });

    it('should limit feedback per agent', () => {
      const smallCollector = new FeedbackCollector(3);

      for (let i = 0; i < 5; i++) {
        smallCollector.recordFeedback(`int-${i}`, AgentTypes.ANALYZER, 'ACCURACY', {});
      }

      const feedback = smallCollector.getFeedbackForAgent(AgentTypes.ANALYZER);
      expect(feedback.length).toBe(3);
    });
  });
});

describe('AgentPerformanceTracker', () => {
  let tracker: AgentPerformanceTracker;

  beforeEach(() => {
    resetFeedbackSystem();
    tracker = getPerformanceTracker();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getPerformanceTracker();
      const instance2 = getPerformanceTracker();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Recording Executions', () => {
    it('should record execution metrics', () => {
      tracker.recordExecution(AgentTypes.ANALYZER, 1500, 0.85, true, 0);

      const metrics = tracker.getLatestMetrics(AgentTypes.ANALYZER);
      expect(metrics).toBeDefined();
      expect(metrics?.executions).toBe(1);
      expect(metrics?.avgLatencyMs).toBe(1500);
      expect(metrics?.avgConfidence).toBe(0.85);
      expect(metrics?.successRate).toBe(1);
    });

    it('should aggregate multiple executions', () => {
      tracker.recordExecution(AgentTypes.ANALYZER, 1000, 0.8, true, 0);
      tracker.recordExecution(AgentTypes.ANALYZER, 2000, 0.9, true, 1);

      const metrics = tracker.getLatestMetrics(AgentTypes.ANALYZER);
      expect(metrics?.executions).toBe(2);
      expect(metrics?.avgLatencyMs).toBe(1500);
      expect(metrics?.avgConfidence).toBeCloseTo(0.85, 10);
    });

    it('should track reflexion rate', () => {
      tracker.recordExecution(AgentTypes.ANALYZER, 1000, 0.8, true, 0);
      tracker.recordExecution(AgentTypes.ANALYZER, 1500, 0.9, true, 2);

      const metrics = tracker.getLatestMetrics(AgentTypes.ANALYZER);
      expect(metrics?.reflexionRate).toBe(0.5); // 1 of 2 had reflexion
    });

    it('should track error rate', () => {
      tracker.recordExecution(AgentTypes.ANALYZER, 1000, 0.8, true, 0);
      tracker.recordExecution(AgentTypes.ANALYZER, 500, 0.3, false, 0);

      const metrics = tracker.getLatestMetrics(AgentTypes.ANALYZER);
      expect(metrics?.successRate).toBe(0.5);
      expect(metrics?.errorRate).toBe(0.5);
    });
  });

  describe('Retrieving Metrics', () => {
    it('should get all metrics for agent', () => {
      tracker.recordExecution(AgentTypes.ANALYZER, 1000, 0.8, true, 0);
      tracker.recordExecution(AgentTypes.TAGGER, 800, 0.9, true, 0);

      const allMetrics = tracker.getAllMetrics(AgentTypes.ANALYZER);
      expect(allMetrics.length).toBeGreaterThan(0);
    });

    it('should get aggregated metrics', () => {
      tracker.recordExecution(AgentTypes.ANALYZER, 1000, 0.8, true, 0);
      tracker.recordExecution(AgentTypes.TAGGER, 800, 0.9, true, 0);

      const aggregated = tracker.getAggregatedMetrics();
      expect(aggregated.length).toBe(2);
    });
  });

  describe('Performance Summary', () => {
    it('should calculate performance summary', () => {
      tracker.recordExecution(AgentTypes.ANALYZER, 1000, 0.8, true, 0);
      tracker.recordExecution(AgentTypes.TAGGER, 800, 0.9, true, 1);

      const summary = tracker.getPerformanceSummary();
      expect(summary.totalExecutions).toBe(2);
      expect(summary.avgLatencyMs).toBe(900);
      expect(summary.avgConfidence).toBeCloseTo(0.85, 10);
      expect(summary.overallSuccessRate).toBe(1);
      expect(summary.overallReflexionRate).toBe(0.5);
    });

    it('should handle no executions', () => {
      const summary = tracker.getPerformanceSummary();
      expect(summary.totalExecutions).toBe(0);
      expect(summary.avgLatencyMs).toBe(0);
    });
  });

  describe('Underperforming Agents', () => {
    it('should identify underperforming agents by success rate', () => {
      tracker.recordExecution(AgentTypes.ANALYZER, 1000, 0.8, false, 0);
      tracker.recordExecution(AgentTypes.ANALYZER, 1000, 0.8, false, 0);
      tracker.recordExecution(AgentTypes.TAGGER, 800, 0.9, true, 0);

      const underperforming = tracker.getUnderperformingAgents(0.8);
      expect(underperforming).toContain(AgentTypes.ANALYZER);
      expect(underperforming).not.toContain(AgentTypes.TAGGER);
    });

    it('should identify underperforming agents by latency', () => {
      tracker.recordExecution(AgentTypes.ANALYZER, 10000, 0.8, true, 0);
      tracker.recordExecution(AgentTypes.TAGGER, 800, 0.9, true, 0);

      const underperforming = tracker.getUnderperformingAgents(0.5, 5000);
      expect(underperforming).toContain(AgentTypes.ANALYZER);
      expect(underperforming).not.toContain(AgentTypes.TAGGER);
    });
  });

  describe('Data Management', () => {
    it('should clear all metrics', () => {
      tracker.recordExecution(AgentTypes.ANALYZER, 1000, 0.8, true, 0);

      tracker.clear();

      expect(tracker.getLatestMetrics(AgentTypes.ANALYZER)).toBeUndefined();
    });
  });
});
