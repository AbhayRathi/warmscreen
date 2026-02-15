/**
 * Tests for Orchestrated Agent Implementations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnalyzerOrchestrationAgent,
  getAnalyzerAgent,
  resetAnalyzerAgent,
} from '../analyzer-agent';
import {
  TaggerOrchestrationAgent,
  getTaggerAgent,
  resetTaggerAgent,
} from '../tagger-agent';
import {
  VerifierOrchestrationAgent,
  getVerifierAgent,
  resetVerifierAgent,
} from '../verifier-agent';
import {
  ScorerOrchestrationAgent,
  getScorerAgent,
  resetScorerAgent,
} from '../scorer-agent';
import {
  NarratorOrchestrationAgent,
  getNarratorAgent,
  resetNarratorAgent,
} from '../narrator-agent';
import { AgentContext, AgentTypes } from '../types';
import { AgentRegistry } from '../registry';

describe('Orchestrated Agent Implementations', () => {
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
      transcript: 'React handles state through hooks like useState and useReducer. For global state, you can use Context API or external libraries like Redux. The key point is that React state is immutable, so you always create new state objects rather than mutating existing ones. For example, when updating an array, you would spread the existing array and add new items.',
      duration: 120,
    },
    position: 'Frontend Engineer',
    candidateName: 'John Doe',
  };

  beforeEach(() => {
    // Reset all singletons
    AgentRegistry.resetInstance();
    resetAnalyzerAgent();
    resetTaggerAgent();
    resetVerifierAgent();
    resetScorerAgent();
    resetNarratorAgent();
  });

  describe('AnalyzerOrchestrationAgent', () => {
    let analyzer: AnalyzerOrchestrationAgent;

    beforeEach(() => {
      analyzer = getAnalyzerAgent();
    });

    it('should be singleton', () => {
      const instance1 = getAnalyzerAgent();
      const instance2 = getAnalyzerAgent();
      expect(instance1).toBe(instance2);
    });

    it('should have correct id and capabilities', () => {
      expect(analyzer.id).toBe(AgentTypes.ANALYZER);
      expect(analyzer.capabilities).toContain('technical-analysis');
      expect(analyzer.capabilities).toContain('communication-assessment');
    });

    it('should analyze a response and return scores', async () => {
      const output = await analyzer.execute(mockContext);

      expect(output.type).toBe(AgentTypes.ANALYZER);
      expect(output.confidence).toBeGreaterThan(0);
      expect(output.confidence).toBeLessThanOrEqual(1);
      expect(output.result.scores).toBeDefined();
      expect(output.result.scores.technical).toBeDefined();
      expect(output.result.scores.communication).toBeDefined();
      expect(output.result.scores.depth).toBeDefined();
    });

    it('should extract technical concepts', async () => {
      const output = await analyzer.execute(mockContext);

      expect(output.result.technicalConcepts).toBeDefined();
      expect(Array.isArray(output.result.technicalConcepts)).toBe(true);
    });

    it('should generate insights', async () => {
      const output = await analyzer.execute(mockContext);

      expect(output.result.insights).toBeDefined();
      expect(Array.isArray(output.result.insights)).toBe(true);
      expect(output.result.insights.length).toBeGreaterThan(0);
    });

    it('should analyze structure', async () => {
      const output = await analyzer.execute(mockContext);

      expect(output.result.structureAnalysis).toBeDefined();
      expect(typeof output.result.structureAnalysis.hasIntroduction).toBe('boolean');
      expect(typeof output.result.structureAnalysis.hasConclusion).toBe('boolean');
      expect(typeof output.result.structureAnalysis.logicalFlow).toBe('boolean');
    });

    it('should handle short responses', async () => {
      const shortContext: AgentContext = {
        ...mockContext,
        response: {
          transcript: 'React uses hooks.',
          duration: 10,
        },
      };

      const output = await analyzer.execute(shortContext);

      expect(output.type).toBe(AgentTypes.ANALYZER);
      expect(output.result.scores.depth).toBeLessThan(7);
    });
  });

  describe('TaggerOrchestrationAgent', () => {
    let tagger: TaggerOrchestrationAgent;

    beforeEach(() => {
      tagger = getTaggerAgent();
    });

    it('should be singleton', () => {
      const instance1 = getTaggerAgent();
      const instance2 = getTaggerAgent();
      expect(instance1).toBe(instance2);
    });

    it('should have correct id and capabilities', () => {
      expect(tagger.id).toBe(AgentTypes.TAGGER);
      expect(tagger.capabilities).toContain('skill-extraction');
      expect(tagger.capabilities).toContain('behavior-tagging');
    });

    it('should extract skill tags', async () => {
      const output = await tagger.execute(mockContext);

      expect(output.type).toBe(AgentTypes.TAGGER);
      expect(output.result.skillTags).toBeDefined();
      expect(Array.isArray(output.result.skillTags)).toBe(true);
    });

    it('should extract behavioral tags', async () => {
      const output = await tagger.execute(mockContext);

      expect(output.result.behavioralTags).toBeDefined();
      expect(Array.isArray(output.result.behavioralTags)).toBe(true);
    });

    it('should extract competency tags for position', async () => {
      const output = await tagger.execute(mockContext);

      expect(output.result.competencyTags).toBeDefined();
      expect(Array.isArray(output.result.competencyTags)).toBe(true);
    });

    it('should analyze sentiment', async () => {
      const output = await tagger.execute(mockContext);

      expect(output.result.sentiment).toBeDefined();
      expect(typeof output.result.sentiment).toBe('number');
      expect(output.result.sentiment).toBeGreaterThanOrEqual(-1);
      expect(output.result.sentiment).toBeLessThanOrEqual(1);
    });

    it('should extract keywords', async () => {
      const output = await tagger.execute(mockContext);

      expect(output.result.keywords).toBeDefined();
      expect(Array.isArray(output.result.keywords)).toBe(true);
    });

    it('should detect growth mindset indicators', async () => {
      const growthContext: AgentContext = {
        ...mockContext,
        response: {
          transcript: 'I learned a lot from this project and improved my skills significantly. I developed new techniques and grew as an engineer.',
          duration: 60,
        },
      };

      const output = await tagger.execute(growthContext);

      expect(output.result.behavioralTags).toContain('growth-mindset');
    });
  });

  describe('VerifierOrchestrationAgent', () => {
    let verifier: VerifierOrchestrationAgent;

    beforeEach(() => {
      verifier = getVerifierAgent();
    });

    it('should be singleton', () => {
      const instance1 = getVerifierAgent();
      const instance2 = getVerifierAgent();
      expect(instance1).toBe(instance2);
    });

    it('should have correct id and capabilities', () => {
      expect(verifier.id).toBe(AgentTypes.VERIFIER);
      expect(verifier.capabilities).toContain('consistency-check');
      expect(verifier.capabilities).toContain('factual-audit');
    });

    it('should verify with empty previous analysis', async () => {
      const output = await verifier.execute(mockContext);

      expect(output.type).toBe(AgentTypes.VERIFIER);
      expect(output.result.checks).toBeDefined();
      expect(Array.isArray(output.result.checks)).toBe(true);
    });

    it('should verify consistency with previous agent outputs', async () => {
      const analyzerOutput = {
        type: AgentTypes.ANALYZER as const,
        result: {
          scores: { technical: 8, communication: 7, depth: 7 },
        },
        confidence: 0.85,
        reflexionLoop: 0,
      };

      const taggerOutput = {
        type: AgentTypes.TAGGER as const,
        result: {
          skillTags: ['technical', 'problemSolving'],
          behavioralTags: ['thoughtful'],
        },
        confidence: 0.8,
        reflexionLoop: 0,
      };

      const contextWithAnalysis: AgentContext = {
        ...mockContext,
        previousAnalysis: new Map([
          [AgentTypes.ANALYZER, analyzerOutput],
          [AgentTypes.TAGGER, taggerOutput],
        ]),
      };

      const output = await verifier.execute(contextWithAnalysis);

      expect(output.result.isConsistent).toBeDefined();
      expect(typeof output.result.isConsistent).toBe('boolean');
    });

    it('should detect factual contradictions', async () => {
      const contradictoryContext: AgentContext = {
        ...mockContext,
        response: {
          transcript: 'React does not use virtual DOM for rendering.',
          duration: 30,
        },
        question: {
          ...mockContext.question,
          keyFacts: ['virtual DOM'],
        },
      };

      const output = await verifier.execute(contradictoryContext);

      expect(output.result.issues.length).toBeGreaterThan(0);
    });

    it('should handle empty transcripts', async () => {
      const emptyContext: AgentContext = {
        ...mockContext,
        response: {
          transcript: '',
          duration: 0,
        },
      };

      const output = await verifier.execute(emptyContext);

      expect(output.result.isAccurate).toBe(false);
      expect(output.result.issues.some((i: string) => i.includes('Empty'))).toBe(true);
    });
  });

  describe('ScorerOrchestrationAgent', () => {
    let scorer: ScorerOrchestrationAgent;

    beforeEach(() => {
      scorer = getScorerAgent();
    });

    it('should be singleton', () => {
      const instance1 = getScorerAgent();
      const instance2 = getScorerAgent();
      expect(instance1).toBe(instance2);
    });

    it('should have correct id and capabilities', () => {
      expect(scorer.id).toBe(AgentTypes.SCORER);
      expect(scorer.capabilities).toContain('weighted-scoring');
      expect(scorer.capabilities).toContain('decision-generation');
    });

    it('should calculate scores from previous agent outputs', async () => {
      const analyzerOutput = {
        type: AgentTypes.ANALYZER as const,
        result: {
          scores: { technical: 8, communication: 7, depth: 7, problemSolving: 7 },
        },
        confidence: 0.85,
        reflexionLoop: 0,
      };

      const taggerOutput = {
        type: AgentTypes.TAGGER as const,
        result: {
          skillTags: ['technical', 'problemSolving', 'communication'],
          behavioralTags: ['collaborative', 'growth-mindset'],
          sentiment: 0.3,
        },
        confidence: 0.8,
        reflexionLoop: 0,
      };

      const contextWithAnalysis: AgentContext = {
        ...mockContext,
        previousAnalysis: new Map([
          [AgentTypes.ANALYZER, analyzerOutput],
          [AgentTypes.TAGGER, taggerOutput],
        ]),
      };

      const output = await scorer.execute(contextWithAnalysis);

      expect(output.type).toBe(AgentTypes.SCORER);
      expect(output.result.overallScore).toBeDefined();
      expect(output.result.overallScore).toBeGreaterThan(0);
      expect(output.result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should generate hiring decision', async () => {
      const analyzerOutput = {
        type: AgentTypes.ANALYZER as const,
        result: {
          scores: { technical: 9, communication: 8, depth: 8 },
        },
        confidence: 0.9,
        reflexionLoop: 0,
      };

      const contextWithAnalysis: AgentContext = {
        ...mockContext,
        previousAnalysis: new Map([[AgentTypes.ANALYZER, analyzerOutput]]),
      };

      const output = await scorer.execute(contextWithAnalysis);

      expect(output.result.decision).toBeDefined();
      expect(['STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE']).toContain(output.result.decision);
    });

    it('should provide scoring breakdown', async () => {
      const output = await scorer.execute(mockContext);

      expect(output.result.breakdown).toBeDefined();
      expect(Array.isArray(output.result.breakdown)).toBe(true);
    });

    it('should use position-specific scoring model', async () => {
      const output = await scorer.execute(mockContext);

      expect(output.result.weights).toBeDefined();
      expect(output.result.thresholds).toBeDefined();
    });
  });

  describe('NarratorOrchestrationAgent', () => {
    let narrator: NarratorOrchestrationAgent;

    beforeEach(() => {
      narrator = getNarratorAgent();
    });

    it('should be singleton', () => {
      const instance1 = getNarratorAgent();
      const instance2 = getNarratorAgent();
      expect(instance1).toBe(instance2);
    });

    it('should have correct id and capabilities', () => {
      expect(narrator.id).toBe(AgentTypes.NARRATOR);
      expect(narrator.capabilities).toContain('summary-generation');
      expect(narrator.capabilities).toContain('decision-explanation');
    });

    it('should generate narrative summary', async () => {
      const scorerOutput = {
        type: AgentTypes.SCORER as const,
        result: {
          overallScore: 75,
          decision: 'HIRE',
          componentScores: { technical: 7.5, communication: 7 },
          breakdown: [
            { category: 'technical', rawScore: 7.5, weight: 0.4, weightedScore: 3 },
          ],
        },
        confidence: 0.85,
        reflexionLoop: 0,
      };

      const contextWithAnalysis: AgentContext = {
        ...mockContext,
        previousAnalysis: new Map([[AgentTypes.SCORER, scorerOutput]]),
      };

      const output = await narrator.execute(contextWithAnalysis);

      expect(output.type).toBe(AgentTypes.NARRATOR);
      expect(output.result.summary).toBeDefined();
      expect(typeof output.result.summary).toBe('string');
      expect(output.result.summary.length).toBeGreaterThan(0);
    });

    it('should include strengths and weaknesses', async () => {
      const analyzerOutput = {
        type: AgentTypes.ANALYZER as const,
        result: {
          scores: { technical: 9, communication: 4, depth: 7 },
        },
        confidence: 0.85,
        reflexionLoop: 0,
      };

      const contextWithAnalysis: AgentContext = {
        ...mockContext,
        previousAnalysis: new Map([[AgentTypes.ANALYZER, analyzerOutput]]),
      };

      const output = await narrator.execute(contextWithAnalysis);

      expect(output.result.strengths).toBeDefined();
      expect(Array.isArray(output.result.strengths)).toBe(true);
      expect(output.result.weaknesses).toBeDefined();
      expect(Array.isArray(output.result.weaknesses)).toBe(true);
    });

    it('should provide recommendations', async () => {
      const scorerOutput = {
        type: AgentTypes.SCORER as const,
        result: {
          overallScore: 75,
          decision: 'HIRE',
          componentScores: {},
          breakdown: [],
        },
        confidence: 0.85,
        reflexionLoop: 0,
      };

      const contextWithAnalysis: AgentContext = {
        ...mockContext,
        previousAnalysis: new Map([[AgentTypes.SCORER, scorerOutput]]),
      };

      const output = await narrator.execute(contextWithAnalysis);

      expect(output.result.recommendations).toBeDefined();
      expect(Array.isArray(output.result.recommendations)).toBe(true);
      expect(output.result.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate agent contributions', async () => {
      const analyzerOutput = {
        type: AgentTypes.ANALYZER as const,
        result: { scores: {} },
        confidence: 0.85,
        reflexionLoop: 0,
      };

      const taggerOutput = {
        type: AgentTypes.TAGGER as const,
        result: { skillTags: ['tech'], behavioralTags: [] },
        confidence: 0.8,
        reflexionLoop: 0,
      };

      const contextWithAnalysis: AgentContext = {
        ...mockContext,
        previousAnalysis: new Map([
          [AgentTypes.ANALYZER, analyzerOutput],
          [AgentTypes.TAGGER, taggerOutput],
        ]),
      };

      const output = await narrator.execute(contextWithAnalysis);

      expect(output.result.agentContributions).toBeDefined();
      expect(typeof output.result.agentContributions).toBe('object');
    });

    it('should generate detailed explanation', async () => {
      const scorerOutput = {
        type: AgentTypes.SCORER as const,
        result: {
          overallScore: 85,
          decision: 'STRONG_HIRE',
          componentScores: { technical: 8.5, communication: 8 },
          breakdown: [],
        },
        confidence: 0.9,
        reflexionLoop: 0,
      };

      const contextWithAnalysis: AgentContext = {
        ...mockContext,
        previousAnalysis: new Map([[AgentTypes.SCORER, scorerOutput]]),
      };

      const output = await narrator.execute(contextWithAnalysis);

      expect(output.result.detailedExplanation).toBeDefined();
      expect(typeof output.result.detailedExplanation).toBe('string');
    });
  });

  describe('Agent Pipeline Integration', () => {
    it('should pass outputs through the full pipeline', async () => {
      const analyzer = getAnalyzerAgent();
      const tagger = getTaggerAgent();
      const verifier = getVerifierAgent();
      const scorer = getScorerAgent();
      const narrator = getNarratorAgent();

      // Step 1: Analyzer
      const analyzerOutput = await analyzer.execute(mockContext);
      expect(analyzerOutput.type).toBe(AgentTypes.ANALYZER);

      // Step 2: Tagger
      const taggerOutput = await tagger.execute(mockContext);
      expect(taggerOutput.type).toBe(AgentTypes.TAGGER);

      // Step 3: Verifier with previous outputs
      const verifierContext: AgentContext = {
        ...mockContext,
        previousAnalysis: new Map([
          [AgentTypes.ANALYZER, analyzerOutput],
          [AgentTypes.TAGGER, taggerOutput],
        ]),
      };
      const verifierOutput = await verifier.execute(verifierContext);
      expect(verifierOutput.type).toBe(AgentTypes.VERIFIER);

      // Step 4: Scorer with all previous outputs
      const scorerContext: AgentContext = {
        ...mockContext,
        previousAnalysis: new Map([
          [AgentTypes.ANALYZER, analyzerOutput],
          [AgentTypes.TAGGER, taggerOutput],
          [AgentTypes.VERIFIER, verifierOutput],
        ]),
      };
      const scorerOutput = await scorer.execute(scorerContext);
      expect(scorerOutput.type).toBe(AgentTypes.SCORER);

      // Step 5: Narrator with all outputs
      const narratorContext: AgentContext = {
        ...mockContext,
        previousAnalysis: new Map([
          [AgentTypes.ANALYZER, analyzerOutput],
          [AgentTypes.TAGGER, taggerOutput],
          [AgentTypes.VERIFIER, verifierOutput],
          [AgentTypes.SCORER, scorerOutput],
        ]),
      };
      const narratorOutput = await narrator.execute(narratorContext);
      expect(narratorOutput.type).toBe(AgentTypes.NARRATOR);

      // Verify final output has meaningful content
      expect(narratorOutput.result.summary.length).toBeGreaterThan(50);
      expect(narratorOutput.confidence).toBeGreaterThan(0.3);
    });
  });
});
