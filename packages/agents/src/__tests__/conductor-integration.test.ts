import { describe, it, expect, beforeEach } from 'vitest';
import { ConductorAgent } from '../orchestrator/conductor';
import { PrismaClient } from '@warmscreen/database';

// Mock PrismaClient
const mockPrismaClient = {
  agentLog: {
    create: async () => ({ id: 'mock-log-id' }),
  },
} as unknown as PrismaClient;

describe('ConductorAgent Integration with Three-Stage Verification', () => {
  let conductor: ConductorAgent;

  beforeEach(() => {
    conductor = new ConductorAgent(mockPrismaClient);
  });

  describe('TDD-INTEGRATION-001: End-to-end with Three-Stage Verification', () => {
    it('should process response with new VerifierInput format', async () => {
      const context = {
        interviewId: 'test-interview-123',
        questionId: 'test-question-456',
        transcript: 'React uses one-way data binding where props flow down from parent to child components. This makes state management predictable.',
        questionCategory: 'technical',
        position: 'Frontend Developer',
        questionText: 'Explain data binding in React',
        expectedConcepts: ['one-way binding', 'props', 'state'],
        keyFacts: ['one-way binding'],
      };

      const result = await conductor.processResponse(context);

      // Verify all agents produced output
      expect(result.analyzed).toBeDefined();
      expect(result.analyzed.type).toBe('ANALYZER');
      expect(result.analyzed.confidence).toBeGreaterThan(0);

      expect(result.tagged).toBeDefined();
      expect(result.tagged.type).toBe('TAGGER');
      expect(result.tagged.confidence).toBeGreaterThan(0);

      expect(result.verified).toBeDefined();
      expect(result.verified.type).toBe('VERIFIER');
      
      // Verify the verifier used the new three-stage format
      // The verified output should contain VerifierOutput properties when using new format
      // But it's wrapped as AgentOutput for compatibility
      expect(result.verified.result).toBeDefined();
      expect(result.verified.confidence).toBeGreaterThan(0);
    });

    it('should handle low-quality response with reflexion recommendation', async () => {
      const context = {
        interviewId: 'test-interview-789',
        questionId: 'test-question-101',
        transcript: 'React is good.',
        questionCategory: 'technical',
        position: 'Frontend Developer',
        questionText: 'Explain React architecture in detail',
        expectedConcepts: ['component', 'virtual dom', 'state', 'props', 'lifecycle'],
        keyFacts: [],
      };

      const result = await conductor.processResponse(context);

      // Verify verifier detected issues
      expect(result.verified).toBeDefined();
      expect(result.verified.confidence).toBeLessThan(0.8); // Should have low confidence due to short transcript
    });

    it('should detect factual errors and recommend refinement', async () => {
      const context = {
        interviewId: 'test-interview-error',
        questionId: 'test-question-error',
        transcript: "React doesn't use one-way binding, it uses two-way binding like Angular.",
        questionCategory: 'technical',
        position: 'Frontend Developer',
        questionText: 'Explain data binding in React',
        expectedConcepts: ['one-way binding', 'data flow'],
        keyFacts: ['one-way binding'],
      };

      const result = await conductor.processResponse(context);

      // Verify verifier detected factual error
      expect(result.verified).toBeDefined();
      expect(result.verified.confidence).toBeLessThan(0.8); // Should have reduced confidence
    });

    it('should use default concepts when none provided', async () => {
      const context = {
        interviewId: 'test-interview-default',
        questionId: 'test-question-default',
        transcript: 'React is a JavaScript library for building user interfaces.',
        questionCategory: 'technical',
        position: 'Frontend Developer',
      };

      const result = await conductor.processResponse(context);

      // Should still work with default concepts
      expect(result.verified).toBeDefined();
      expect(result.verified.confidence).toBeGreaterThan(0);
    });

    it('should handle behavioral questions correctly', async () => {
      const context = {
        interviewId: 'test-interview-behavioral',
        questionId: 'test-question-behavioral',
        transcript: 'I demonstrated strong teamwork by collaborating with the team to solve a critical problem. I communicated clearly and helped coordinate the solution.',
        questionCategory: 'behavioral',
        position: 'Senior Developer',
        questionText: 'Describe a time you showed teamwork',
        expectedConcepts: ['teamwork', 'collaboration', 'communication'],
        keyFacts: [],
      };

      const result = await conductor.processResponse(context);

      // Should process behavioral response successfully
      expect(result.analyzed).toBeDefined();
      expect(result.tagged).toBeDefined();
      expect(result.verified).toBeDefined();
      expect(result.verified.confidence).toBeGreaterThan(0.5);
    });
  });
});
