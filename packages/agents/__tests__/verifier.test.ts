import { VerifierAgent, VerifierInput, VerifierOutput } from '../src/agents/verifier';

describe('VerifierAgent.execute()', () => {
  let verifier: VerifierAgent;

  beforeEach(() => {
    verifier = new VerifierAgent();
  });

  // TDD-V001: Happy Path - High Consensus
  describe('TDD-V001: Happy Path - High Consensus', () => {
    it('should return high confidence when all agents and facts align', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'React uses one-way data binding, which makes the data flow predictable and easier to debug. Components receive data through props from parent components.',
        question: 'Explain how data binding works in React.',
        contextKnowledge: {
          expectedConcepts: ['one-way binding', 'props', 'data flow'],
          idealResponseCharacteristics: ['mentions unidirectional flow', 'explains props mechanism'],
          keyFacts: ['React uses one-way data binding']
        },
        agentOutputs: {
          analyzer: {
            score: 0.88,
            confidence: 0.90,
            insights: ['Good technical depth', 'Clear explanation']
          },
          tagger: {
            tags: ['Strong Technical Knowledge', 'Clear Explanation', 'Correct Concept'],
            confidence: 0.92
          },
          scorer: {
            overallScore: 0.85,
            confidence: 0.89
          }
        }
      };

      const result = await verifier.execute(input);

      expect(result.confidence_score).toBeGreaterThanOrEqual(0.95);
      expect(result.is_consistent).toBe(true);
      expect(result.is_accurate).toBe(true);
      expect(result.reflexion_required).toBe(false);
    });
  });

  // TDD-V002: Critical Inconsistency (Score vs. Tag)
  describe('TDD-V002: Critical Inconsistency - Score vs. Tag Mismatch', () => {
    it('should detect when high score conflicts with negative tags', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'I think React does some data binding thing.',
        question: 'Explain how data binding works in React.',
        contextKnowledge: {
          expectedConcepts: ['one-way binding', 'props', 'data flow'],
          idealResponseCharacteristics: ['mentions unidirectional flow'],
          keyFacts: ['React uses one-way data binding']
        },
        agentOutputs: {
          analyzer: {
            score: 0.9, // High score
            confidence: 0.85,
            insights: ['Detailed response']
          },
          tagger: {
            tags: ['Vague Answer', 'Missing Key Concept', 'Poor Clarity'], // Negative tags
            confidence: 0.80
          },
          scorer: {
            overallScore: 0.88,
            confidence: 0.82
          }
        }
      };

      const result = await verifier.execute(input);

      expect(result.is_consistent).toBe(false);
      expect(result.confidence_score).toBeLessThanOrEqual(0.70);
      expect(result.reflexion_required).toBe(true);
      expect(['Analyzer', 'Tagger']).toContain(result.recommended_refinement.agent_to_refine);
    });
  });

  // TDD-V003: Factual Error Detected
  describe('TDD-V003: Factual Error Detected', () => {
    it('should catch technical hallucination that contradicts context knowledge', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'React uses two-way data binding like Angular, which allows automatic synchronization between model and view.',
        question: 'Explain how data binding works in React.',
        contextKnowledge: {
          expectedConcepts: ['one-way binding', 'props', 'data flow'],
          idealResponseCharacteristics: ['mentions unidirectional flow'],
          keyFacts: ['React uses one-way data binding']
        },
        agentOutputs: {
          analyzer: {
            score: 0.75,
            confidence: 0.80,
            insights: ['Technical explanation provided']
          },
          tagger: {
            tags: ['Technical Knowledge', 'Clear Explanation'],
            confidence: 0.78
          },
          scorer: {
            overallScore: 0.72,
            confidence: 0.79
          }
        }
      };

      const result = await verifier.execute(input);

      expect(result.is_accurate).toBe(false);
      expect(result.confidence_score).toBeLessThanOrEqual(0.80);
      expect(result.reflexion_required).toBe(true);
      expect(result.critique_reasoning).toMatch(/contradiction|inaccurate|incorrect|two-way|one-way/i);
    });
  });

  // TDD-V004: Low Agent Agreement
  describe('TDD-V004: Low Agent Agreement', () => {
    it('should flag when agent confidence differs by more than 0.2', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'React manages state through useState and useReducer hooks for local component state.',
        question: 'How does React manage state?',
        contextKnowledge: {
          expectedConcepts: ['state management', 'hooks', 'useState'],
          idealResponseCharacteristics: ['mentions hooks'],
          keyFacts: ['React uses hooks for state management']
        },
        agentOutputs: {
          analyzer: {
            score: 0.80,
            confidence: 0.90, // High confidence
            insights: ['Good explanation']
          },
          tagger: {
            tags: ['Technical Knowledge'],
            confidence: 0.65 // Low confidence - difference of 0.25 > 0.2
          },
          scorer: {
            overallScore: 0.78,
            confidence: 0.88
          }
        }
      };

      const result = await verifier.execute(input);

      expect(result.reflexion_required).toBe(true);
      expect(result.recommended_refinement.agent_to_refine).toBe('Tagger');
    });
  });

  // TDD-V005: Refinement Prompt Quality
  describe('TDD-V005: Refinement Prompt Quality', () => {
    it('should provide concise refinement prompt containing "re-evaluate" when reflexion is required', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'Some vague answer about React.',
        question: 'Explain React data binding.',
        contextKnowledge: {
          expectedConcepts: ['one-way binding'],
          idealResponseCharacteristics: [],
          keyFacts: ['React uses one-way data binding']
        },
        agentOutputs: {
          analyzer: {
            score: 0.9,
            confidence: 0.85,
            insights: ['Good response']
          },
          tagger: {
            tags: ['Vague Answer', 'Poor Clarity'],
            confidence: 0.80
          },
          scorer: {
            overallScore: 0.85,
            confidence: 0.82
          }
        }
      };

      const result = await verifier.execute(input);

      if (result.reflexion_required) {
        expect(result.recommended_refinement.critique_prompt_injection.length).toBeLessThanOrEqual(300);
        expect(result.recommended_refinement.critique_prompt_injection.toLowerCase()).toContain('re-evaluate');
      }
    });
  });

  // TDD-V006: Empty Transcript Handling
  describe('TDD-V006: Empty Transcript Handling', () => {
    it('should handle empty transcript gracefully with low score', async () => {
      const input: VerifierInput = {
        candidateTranscript: '',
        question: 'Explain React data binding.',
        contextKnowledge: {
          expectedConcepts: ['one-way binding'],
          idealResponseCharacteristics: [],
          keyFacts: ['React uses one-way data binding']
        },
        agentOutputs: {
          analyzer: {
            score: 0.5,
            confidence: 0.3,
            insights: []
          },
          tagger: {
            tags: [],
            confidence: 0.2
          },
          scorer: {
            overallScore: 0.4,
            confidence: 0.25
          }
        }
      };

      const result = await verifier.execute(input);

      expect(result.confidence_score).toBeLessThan(0.5);
      expect(result.is_accurate).toBe(false);
    });

    it('should handle very short transcript gracefully', async () => {
      const input: VerifierInput = {
        candidateTranscript: 'Yes.',
        question: 'Explain React data binding.',
        contextKnowledge: {
          expectedConcepts: ['one-way binding'],
          idealResponseCharacteristics: [],
          keyFacts: ['React uses one-way data binding']
        },
        agentOutputs: {
          analyzer: {
            score: 0.3,
            confidence: 0.4,
            insights: ['Very brief response']
          },
          tagger: {
            tags: ['Incomplete Answer'],
            confidence: 0.35
          },
          scorer: {
            overallScore: 0.25,
            confidence: 0.38
          }
        }
      };

      const result = await verifier.execute(input);

      expect(result.confidence_score).toBeLessThan(0.7);
      expect(result.reflexion_required).toBe(true);
    });
  });
});
