import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  prismaMock,
  createMockInterview,
  createMockFullResponse,
  createMockQuestion,
  resetMocks,
} from '../../test-utils/prisma-mock';

// Mock prisma
vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

// Mock OpenAI client
vi.mock('@/lib/ai/openai-client', () => ({
  analyzeResponse: vi.fn().mockResolvedValue({
    scores: {
      technical: 8.0,
      problemSolving: 7.5,
      communication: 7.0,
      cultureFit: 6.5,
    },
    sentiment: 0.6,
    confidence: 0.8,
    strengths: ['Good technical skills', 'Clear communication'],
    weaknesses: ['Could improve depth'],
    summary: 'Strong candidate.',
  }),
  generateExplainability: vi.fn().mockResolvedValue({
    summary: 'Candidate performed well overall.',
    recommendation: 'Proceed to next round.',
    developmentAreas: ['System design'],
  }),
  calculateOverallScore: vi.fn().mockReturnValue(7.25),
}));

// Mock env
vi.mock('@/lib/ai/env', () => ({
  aiEnv: {
    OPENAI_API_KEY: 'test-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_MAX_TOKENS: 500,
    isConfigured: true,
  },
  isOpenAIConfigured: () => true,
}));

// Import after mocks
import {
  scoreResponse,
  scoreInterview,
  generateHiringDecision,
} from '../scoring-service';
import { DECISION_THRESHOLDS } from '@/lib/ai/prompts';

describe('Scoring Service', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // scoreResponse Tests
  // ============================================================================

  describe('scoreResponse', () => {
    it('should update database with scores', async () => {
      const mockQuestion = createMockQuestion({
        id: 'q1',
        content: 'Test question?',
      });

      const mockResponse = createMockFullResponse({
        id: 'r1',
        interviewId: 'i1',
        questionId: 'q1',
        transcript: 'Test answer',
        question: mockQuestion,
      });

      const mockInterview = createMockInterview({
        id: 'i1',
        position: 'Software Engineer',
      });

      prismaMock.response.findUnique.mockResolvedValue(mockResponse);
      prismaMock.interview.findUnique.mockResolvedValue(mockInterview);
      prismaMock.response.update.mockResolvedValue({
        ...mockResponse,
        scores: { technical: 8.0 },
        sentiment: 0.6,
        confidence: 0.8,
      });

      const result = await scoreResponse('r1');

      expect(result.responseId).toBe('r1');
      expect(result.scores).toHaveProperty('technical');
      expect(result.sentiment).toBe(0.6);
      expect(result.confidence).toBe(0.8);

      expect(prismaMock.response.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1' },
          data: expect.objectContaining({
            scores: expect.any(Object),
            sentiment: expect.any(Number),
            confidence: expect.any(Number),
          }),
        })
      );
    });

    it('should throw error for non-existent response', async () => {
      prismaMock.response.findUnique.mockResolvedValue(null);

      await expect(scoreResponse('non-existent')).rejects.toThrow('Response not found');
    });

    it('should throw error for non-existent interview', async () => {
      const mockResponse = createMockFullResponse({
        id: 'r1',
        interviewId: 'i1',
      });

      prismaMock.response.findUnique.mockResolvedValue(mockResponse);
      prismaMock.interview.findUnique.mockResolvedValue(null);

      await expect(scoreResponse('r1')).rejects.toThrow('Interview not found');
    });
  });

  // ============================================================================
  // scoreInterview Tests
  // ============================================================================

  describe('scoreInterview', () => {
    it('should calculate overall score correctly', async () => {
      const mockQuestion = createMockQuestion();
      
      const mockResponses = [
        {
          ...createMockFullResponse({
            id: 'r1',
            scores: { technical: 8.0, communication: 7.0 },
            sentiment: 0.5,
            confidence: 0.8,
          }),
          question: mockQuestion,
        },
        {
          ...createMockFullResponse({
            id: 'r2',
            scores: { technical: 7.0, communication: 8.0 },
            sentiment: 0.6,
            confidence: 0.7,
          }),
          question: mockQuestion,
        },
      ];

      const mockInterview = {
        ...createMockInterview({
          id: 'i1',
          position: 'Software Engineer',
        }),
        responses: mockResponses,
      };

      prismaMock.interview.findUnique.mockResolvedValue(mockInterview);
      prismaMock.interview.update.mockResolvedValue({
        ...mockInterview,
        score: 7.5,
        decision: 'HIRE',
      });

      const result = await scoreInterview('i1');

      expect(result.interviewId).toBe('i1');
      expect(result.overallScore).toBeDefined();
      expect(result.decision).toBeDefined();
      expect(result.categoryBreakdown).toBeDefined();

      expect(prismaMock.interview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'i1' },
          data: expect.objectContaining({
            score: expect.any(Number),
            decision: expect.any(String),
            explainability: expect.any(Object),
          }),
        })
      );
    });

    it('should throw error for interview without responses', async () => {
      const mockInterview = {
        ...createMockInterview({ id: 'i1' }),
        responses: [],
      };

      prismaMock.interview.findUnique.mockResolvedValue(mockInterview);

      await expect(scoreInterview('i1')).rejects.toThrow('No responses found');
    });

    it('should throw error for non-existent interview', async () => {
      prismaMock.interview.findUnique.mockResolvedValue(null);

      await expect(scoreInterview('non-existent')).rejects.toThrow('Interview not found');
    });
  });

  // ============================================================================
  // generateHiringDecision Tests
  // ============================================================================

  describe('generateHiringDecision', () => {
    it('should return STRONG_HIRE for scores >= 8.5', () => {
      const result = generateHiringDecision(9.0);

      expect(result.decision).toBe('STRONG_HIRE');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reasoning).toContain('Exceptional');
    });

    it('should return STRONG_HIRE for exactly 8.5', () => {
      const result = generateHiringDecision(8.5);

      expect(result.decision).toBe('STRONG_HIRE');
    });

    it('should return HIRE for scores >= 7.0 and < 8.5', () => {
      const result = generateHiringDecision(7.5);

      expect(result.decision).toBe('HIRE');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.reasoning).toContain('Solid');
    });

    it('should return HIRE for exactly 7.0', () => {
      const result = generateHiringDecision(7.0);

      expect(result.decision).toBe('HIRE');
    });

    it('should return NO_HIRE for scores >= 3.0 and < 7.0', () => {
      const result = generateHiringDecision(5.0);

      expect(result.decision).toBe('NO_HIRE');
      expect(result.reasoning).toContain('below');
    });

    it('should return NO_HIRE for exactly 5.0', () => {
      const result = generateHiringDecision(5.0);

      expect(result.decision).toBe('NO_HIRE');
    });

    it('should return STRONG_NO_HIRE for scores < 3.0', () => {
      const result = generateHiringDecision(2.0);

      expect(result.decision).toBe('STRONG_NO_HIRE');
      expect(result.confidence).toBeGreaterThan(0.85);
      expect(result.reasoning).toContain('Clear no hire');
    });

    it('should return STRONG_NO_HIRE for exactly 2.99', () => {
      const result = generateHiringDecision(2.99);

      expect(result.decision).toBe('STRONG_NO_HIRE');
    });

    it('should use custom thresholds when provided', () => {
      const customThresholds = {
        STRONG_HIRE: 9.0,
        HIRE: 8.0,
        NO_HIRE: 6.0,
        STRONG_NO_HIRE: 4.0,
      };

      const result = generateHiringDecision(8.5, customThresholds);

      expect(result.decision).toBe('HIRE');
    });

    it('should clamp confidence to valid range (0-1)', () => {
      const result = generateHiringDecision(10.0);

      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Decision Threshold Tests
  // ============================================================================

  describe('Decision Thresholds', () => {
    it('should have correct threshold values', () => {
      expect(DECISION_THRESHOLDS.STRONG_HIRE).toBe(8.5);
      expect(DECISION_THRESHOLDS.HIRE).toBe(7.0);
      expect(DECISION_THRESHOLDS.NO_HIRE).toBe(5.0);
      expect(DECISION_THRESHOLDS.STRONG_NO_HIRE).toBe(3.0);
    });
  });
});
