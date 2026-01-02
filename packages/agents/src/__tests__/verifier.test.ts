import { describe, it, expect, beforeEach } from 'vitest';
import { VerifierAgent, VerifierInput, VerifierOutput } from '../agents/verifier';
import { AgentOutput } from '@warmscreen/shared';

describe('VerifierAgent Three-Stage Verification', () => {
  let verifier: VerifierAgent;

  beforeEach(() => {
    verifier = new VerifierAgent();
  });

  describe('TDD-V001: Happy Path - High Consensus', () => {
    it('should pass all verification stages with high-quality consistent output', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'React uses one-way data binding where props flow down from parent to child components. This unidirectional data flow makes the application more predictable and easier to debug.',
        question: 'Explain data binding in React',
        contextKnowledge: {
          expectedConcepts: ['one-way binding', 'props', 'component'],
          keyFacts: ['one-way binding'],
        },
        agentOutputs: {
          analyzer: {
            score: 0.85,
            confidence: 0.9,
            insights: ['Clear explanation', 'Good technical depth'],
          },
          tagger: {
            tags: ['technical', 'accurate', 'clear'],
            confidence: 0.88,
          },
          scorer: {
            overallScore: 0.87,
            confidence: 0.89,
          },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      expect(result.confidence_score).toBeGreaterThan(0.8);
      expect(result.is_consistent).toBe(true);
      expect(result.is_accurate).toBe(true);
      expect(result.reflexion_required).toBe(false);
      expect(result.recommended_refinement.agent_to_refine).toBe('None');
    });
  });

  describe('TDD-V002: Score-Tag Inconsistency', () => {
    it('should detect misalignment between high score and negative tags', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'Um, I think React is like, you know, a framework that does stuff with components.',
        question: 'Explain React architecture',
        contextKnowledge: {
          expectedConcepts: ['component', 'virtual dom', 'state'],
          keyFacts: [],
        },
        agentOutputs: {
          analyzer: {
            score: 0.85, // High score
            confidence: 0.8,
            insights: ['Some understanding shown'],
          },
          tagger: {
            tags: ['vague', 'incomplete', 'poor'], // Negative tags
            confidence: 0.75,
          },
          scorer: {
            overallScore: 0.82, // High score
            confidence: 0.78,
          },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      expect(result.confidence_score).toBeLessThan(0.8);
      expect(result.is_consistent).toBe(false);
      expect(result.reflexion_required).toBe(true);
      expect(result.critique_reasoning).toContain('Score-tag misalignment');
      expect(result.recommended_refinement.agent_to_refine).toBe('Tagger');
    });
  });

  describe('TDD-V003: Factual Error Detection', () => {
    it('should detect factual contradictions using negation patterns', async () => {
      const input: VerifierInput = {
        candidateTranscript: "React doesn't use one-way binding, it actually uses two-way binding like Angular.",
        question: 'Explain data binding in React',
        contextKnowledge: {
          expectedConcepts: ['one-way binding', 'data flow'],
          keyFacts: ['one-way binding'],
        },
        agentOutputs: {
          analyzer: {
            score: 0.4,
            confidence: 0.6,
            insights: ['Incorrect information'],
          },
          tagger: {
            tags: ['incorrect', 'confused'],
            confidence: 0.65,
          },
          scorer: {
            overallScore: 0.45,
            confidence: 0.62,
          },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      expect(result.is_accurate).toBe(false);
      expect(result.confidence_score).toBeLessThanOrEqual(0.7);
      expect(result.reflexion_required).toBe(true);
      expect(result.critique_reasoning).toContain('contradiction');
      expect(result.recommended_refinement.agent_to_refine).toBe('Analyzer');
    });

    it('should handle related term matching for concept coverage', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'React uses unidirectional data flow where properties are passed down from parent to child.',
        question: 'Explain data binding in React',
        contextKnowledge: {
          expectedConcepts: ['one-way binding', 'props'],
        },
        agentOutputs: {
          analyzer: {
            score: 0.8,
            confidence: 0.85,
            insights: ['Good understanding'],
          },
          tagger: {
            tags: ['accurate', 'clear'],
            confidence: 0.83,
          },
          scorer: {
            overallScore: 0.82,
            confidence: 0.84,
          },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      // Should pass because "unidirectional" is a related term for "one-way binding"
      // and "properties" is related to "props"
      expect(result.is_accurate).toBe(true);
      expect(result.confidence_score).toBeGreaterThan(0.7);
    });
  });

  describe('TDD-V004: Low Agent Agreement', () => {
    it('should detect and penalize significant confidence disagreement', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'React is a JavaScript library for building user interfaces with components.',
        question: 'What is React?',
        contextKnowledge: {
          expectedConcepts: ['library', 'components'],
        },
        agentOutputs: {
          analyzer: {
            score: 0.9,
            confidence: 0.95, // Very high
          insights: ['Excellent answer'],
          },
          tagger: {
            tags: ['technical', 'accurate'],
            confidence: 0.45, // Very low - major disagreement
          },
          scorer: {
            overallScore: 0.85,
            confidence: 0.88,
          },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      expect(result.is_consistent).toBe(false);
      expect(result.reflexion_required).toBe(true);
      expect(result.critique_reasoning).toContain('Agent disagreement');
      expect(result.recommended_refinement.agent_to_refine).toBe('Analyzer');
    });
  });

  describe('TDD-V005: Refinement Prompt Quality', () => {
    it('should provide specific and actionable refinement prompts', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'React uses components.',
        question: 'Explain React architecture in detail',
        contextKnowledge: {
          expectedConcepts: ['component', 'virtual dom', 'state', 'props', 'lifecycle'],
        },
        agentOutputs: {
          analyzer: {
            score: 0.5,
            confidence: 0.6,
            insights: ['Incomplete'],
          },
          tagger: {
            tags: ['incomplete', 'brief'],
            confidence: 0.62,
          },
          scorer: {
            overallScore: 0.48,
            confidence: 0.61,
          },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      expect(result.reflexion_required).toBe(true);
      expect(result.recommended_refinement.agent_to_refine).not.toBe('None');
      expect(result.recommended_refinement.critique_prompt_injection).toBeTruthy();
      expect(result.recommended_refinement.critique_prompt_injection.length).toBeGreaterThan(20);
      // Prompt should be specific and actionable
      expect(result.recommended_refinement.critique_prompt_injection).toMatch(/coverage|scoring|analysis|review/i);
    });
  });

  describe('TDD-V006: Empty Transcript Handling', () => {
    it('should handle empty transcript gracefully', async () => {
      const input: VerifierInput = {
        candidateTranscript: '',
        question: 'Explain React',
        contextKnowledge: {
          expectedConcepts: ['component'],
        },
        agentOutputs: {
          analyzer: {
            score: 0.0,
            confidence: 0.5,
            insights: [],
          },
          tagger: {
            tags: ['no-response'],
            confidence: 0.5,
          },
          scorer: {
            overallScore: 0.0,
            confidence: 0.5,
          },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      expect(result.is_accurate).toBe(false);
      expect(result.confidence_score).toBeLessThan(0.5);
      expect(result.reflexion_required).toBe(true);
      expect(result.critique_reasoning).toMatch(/Empty|short transcript/i);
    });

    it('should penalize very short transcripts', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'React is good.',
        question: 'Explain React architecture',
        contextKnowledge: {
          expectedConcepts: ['component', 'virtual dom', 'state'],
        },
        agentOutputs: {
          analyzer: {
            score: 0.3,
            confidence: 0.5,
            insights: ['Too brief'],
          },
          tagger: {
            tags: ['incomplete'],
            confidence: 0.52,
          },
          scorer: {
            overallScore: 0.32,
            confidence: 0.51,
          },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      expect(result.critique_reasoning).toContain('short transcript');
      expect(result.confidence_score).toBeLessThan(0.75);
    });
  });

  describe('TDD-V007: Malformed Input Handling', () => {
    it('should return error result for missing candidateTranscript', async () => {
      const input = {
        question: 'Test question',
        contextKnowledge: { expectedConcepts: [] },
        agentOutputs: {
          analyzer: { score: 0.5, confidence: 0.5, insights: [] },
          tagger: { tags: [], confidence: 0.5 },
          scorer: { overallScore: 0.5, confidence: 0.5 },
        },
      } as any;

      const result = await verifier.execute(input);

      // Should return legacy error result since it doesn't match VerifierInput
      expect(result).toHaveProperty('type');
      expect((result as AgentOutput).result.verified).toBe(false);
      expect((result as AgentOutput).confidence).toBeLessThan(0.5);
    });

    it('should return error result for missing agentOutputs.analyzer', async () => {
      const input = {
        candidateTranscript: 'Test transcript',
        question: 'Test question',
        contextKnowledge: { expectedConcepts: [] },
        agentOutputs: {
          tagger: { tags: [], confidence: 0.5 },
          scorer: { overallScore: 0.5, confidence: 0.5 },
        },
      } as any;

      const result = await verifier.execute(input);

      // Type guard will fail, so it goes to legacy path which also fails
      // Should return legacy error output
      if ('confidence_score' in result) {
        expect((result as VerifierOutput).confidence_score).toBeLessThan(0.5);
        expect((result as VerifierOutput).reflexion_required).toBe(true);
      } else {
        expect((result as AgentOutput).confidence).toBeLessThan(0.5);
        expect((result as AgentOutput).result.verified).toBe(false);
      }
    });

    it('should return error result for invalid analyzer score type', async () => {
      const input: any = {
        candidateTranscript: 'Test transcript',
        question: 'Test question',
        contextKnowledge: { expectedConcepts: [] },
        agentOutputs: {
          analyzer: { score: 'invalid', confidence: 0.5, insights: [] },
          tagger: { tags: [], confidence: 0.5 },
          scorer: { overallScore: 0.5, confidence: 0.5 },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      expect(result.confidence_score).toBeLessThan(0.5);
      expect(result.reflexion_required).toBe(true);
      expect(result.critique_reasoning).toContain('score must be a number');
    });

    it('should return error result for non-array tags', async () => {
      const input: any = {
        candidateTranscript: 'Test transcript',
        question: 'Test question',
        contextKnowledge: { expectedConcepts: [] },
        agentOutputs: {
          analyzer: { score: 0.5, confidence: 0.5, insights: [] },
          tagger: { tags: 'not-an-array', confidence: 0.5 },
          scorer: { overallScore: 0.5, confidence: 0.5 },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      expect(result.confidence_score).toBeLessThan(0.5);
      expect(result.reflexion_required).toBe(true);
      expect(result.critique_reasoning).toContain('tags must be an array');
    });
  });

  describe('TDD-V008: Error Scenarios', () => {
    it('should return safe fallback on unexpected error', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'Test',
        question: 'Test',
        contextKnowledge: { expectedConcepts: [] },
        agentOutputs: {
          analyzer: { score: 0.5, confidence: 0.5, insights: [] },
          tagger: { tags: [], confidence: 0.5 },
          scorer: { overallScore: 0.5, confidence: 0.5 },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      // Should handle the error gracefully and return valid output
      expect(result).toHaveProperty('confidence_score');
      expect(result).toHaveProperty('is_consistent');
      expect(result).toHaveProperty('is_accurate');
      expect(result).toHaveProperty('reflexion_required');
      expect(result).toHaveProperty('critique_reasoning');
      expect(result).toHaveProperty('recommended_refinement');
    });
  });

  describe('Backward Compatibility - Legacy Mode', () => {
    it('should support legacy AgentInput format', async () => {
      const legacyInput = {
        type: 'VERIFIER' as const,
        context: {
          agentOutputs: [
            {
              type: 'ANALYZER' as const,
              result: { scores: { technical: 8, communication: 7 } },
              confidence: 0.85,
              reflexionLoop: 0,
            },
            {
              type: 'TAGGER' as const,
              result: { tags: ['technical', 'clear'] },
              confidence: 0.82,
              reflexionLoop: 0,
            },
          ],
        },
        reflexionLoop: 0,
      };

      const result = await verifier.execute(legacyInput);

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reflexionLoop');
      expect(result.type).toBe('VERIFIER');
    });

    it('should perform legacy verification checks', async () => {
      const legacyInput = {
        type: 'VERIFIER' as const,
        context: {
          agentOutputs: [
            {
              type: 'ANALYZER' as const,
              result: { scores: { technical: 8 } },
              confidence: 0.9,
              reflexionLoop: 0,
            },
            {
              type: 'TAGGER' as const,
              result: { tags: ['good'] },
              confidence: 0.88,
              reflexionLoop: 0,
            },
          ],
        },
        reflexionLoop: 0,
      };

      const result = await verifier.execute(legacyInput);

      expect(result.result).toHaveProperty('verified');
      expect(result.result).toHaveProperty('checks');
      expect(result.result).toHaveProperty('issuesFound');
      expect(result.result).toHaveProperty('recommendations');
    });
  });

  describe('Confidence Penalty System', () => {
    it('should apply correct penalty for score-tag misalignment', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'Some response',
        question: 'Test',
        contextKnowledge: { expectedConcepts: [] },
        agentOutputs: {
          analyzer: { score: 0.9, confidence: 0.85, insights: [] },
          tagger: { tags: ['confused', 'incorrect'], confidence: 0.85 },
          scorer: { overallScore: 0.88, confidence: 0.85 },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      // Should have significant penalty (0.35) for score-tag misalignment
      expect(result.confidence_score).toBeLessThan(0.7);
      expect(result.is_consistent).toBe(false);
    });

    it('should apply cumulative penalties correctly', async () => {
      const input: VerifierInput = {
        candidateTranscript: "React doesn't use one-way binding", // Factual error
        question: 'Test',
        contextKnowledge: {
          expectedConcepts: ['one-way binding'],
          keyFacts: ['one-way binding'],
        },
        agentOutputs: {
          analyzer: { score: 0.9, confidence: 0.95, insights: [] }, // High confidence
          tagger: { tags: ['confused'], confidence: 0.45 }, // Low confidence - disagreement
          scorer: { overallScore: 0.88, confidence: 0.87 },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      // Should have multiple penalties: disagreement (0.15) + factual error (0.25)
      expect(result.confidence_score).toBeLessThan(0.65);
      expect(result.is_consistent).toBe(false);
      expect(result.is_accurate).toBe(false);
    });
  });

  describe('Critique Reasoning Quality', () => {
    it('should provide structured critique with all three stages', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'React is a library',
        question: 'Explain React',
        contextKnowledge: {
          expectedConcepts: ['library', 'component', 'virtual dom'],
        },
        agentOutputs: {
          analyzer: { score: 0.5, confidence: 0.6, insights: [] },
          tagger: { tags: ['incomplete'], confidence: 0.62 },
          scorer: { overallScore: 0.52, confidence: 0.61 },
        },
      };

      const result = await verifier.execute(input) as VerifierOutput;

      expect(result.critique_reasoning).toContain('Stage 1');
      expect(result.critique_reasoning).toContain('Stage 2');
      expect(result.critique_reasoning).toContain('Stage 3');
      expect(result.critique_reasoning).toContain('Consistency Check');
      expect(result.critique_reasoning).toContain('Factual Audit');
      expect(result.critique_reasoning).toContain('Reflexion Decision');
    });
  });
});
