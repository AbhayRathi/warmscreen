import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  prismaMock,
  createMockQuestion,
  createMockResponsesWithOutcomes,
  resetMocks,
} from '../../test-utils/prisma-mock';

// Mock the prisma module
vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

// Mock the question module for updateQuestionCorrelationScore
vi.mock('@/lib/db/question', () => ({
  updateQuestionCorrelationScore: vi.fn().mockResolvedValue({}),
}));

// Import after mocking
import {
  updateQuestionCorrelations,
  calculateQuestionCorrelation,
  getQuestionsByCorrelationEffectiveness,
  getCorrelationStats,
} from '../question-correlation';
import { updateQuestionCorrelationScore } from '@/lib/db/question';

describe('Question Correlation Analytics', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Point-Biserial Correlation Tests (CRITICAL)
  // ============================================================================

  describe('calculateQuestionCorrelation', () => {
    it('should return high correlation when hired scores are clearly higher', async () => {
      // Hired candidates: scores 8, 9, 8, 9, 8
      // Not hired: scores 3, 2, 3, 2, 3
      const hiredScores = [8, 9, 8, 9, 8];
      const notHiredScores = [3, 2, 3, 2, 3];
      const responses = createMockResponsesWithOutcomes('q1', hiredScores, notHiredScores);

      const mockQuestion = {
        ...createMockQuestion({ id: 'q1', timesAsked: 10 }),
        responses,
      };
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await calculateQuestionCorrelation('q1');

      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(0.5); // Should be high positive correlation
    });

    it('should return low/no correlation when scores are similar', async () => {
      // Both groups have similar scores
      const hiredScores = [5, 6, 5, 6, 5];
      const notHiredScores = [5, 6, 5, 6, 5];
      const responses = createMockResponsesWithOutcomes('q1', hiredScores, notHiredScores);

      const mockQuestion = {
        ...createMockQuestion({ id: 'q1', timesAsked: 10 }),
        responses,
      };
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await calculateQuestionCorrelation('q1');

      expect(result).not.toBeNull();
      expect(Math.abs(result!)).toBeLessThan(0.2); // Should be near zero
    });

    it('should return null when less than 10 responses with decisions', async () => {
      // Only 5 hired and 4 not hired = 9 total (below 10 minimum)
      const hiredScores = [8, 9, 8, 9, 8];
      const notHiredScores = [3, 2, 3, 2];
      const responses = createMockResponsesWithOutcomes('q1', hiredScores, notHiredScores);

      const mockQuestion = {
        ...createMockQuestion({ id: 'q1', timesAsked: 9 }),
        responses,
      };
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await calculateQuestionCorrelation('q1');

      expect(result).toBeNull();
    });

    it('should return null when all are hired (no not-hired scores)', async () => {
      const hiredScores = [8, 9, 8, 9, 8, 7, 8, 9, 8, 9];
      const notHiredScores: number[] = [];
      const responses = createMockResponsesWithOutcomes('q1', hiredScores, notHiredScores);

      const mockQuestion = {
        ...createMockQuestion({ id: 'q1', timesAsked: 10 }),
        responses,
      };
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await calculateQuestionCorrelation('q1');

      expect(result).toBeNull();
    });

    it('should return null when all are not hired', async () => {
      const hiredScores: number[] = [];
      const notHiredScores = [3, 4, 3, 4, 3, 4, 3, 4, 3, 4];
      const responses = createMockResponsesWithOutcomes('q1', hiredScores, notHiredScores);

      const mockQuestion = {
        ...createMockQuestion({ id: 'q1', timesAsked: 10 }),
        responses,
      };
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await calculateQuestionCorrelation('q1');

      expect(result).toBeNull();
    });

    it('should return null for non-existent question', async () => {
      prismaMock.question.findUnique.mockResolvedValue(null);

      const result = await calculateQuestionCorrelation('non-existent');

      expect(result).toBeNull();
    });

    it('should handle identical scores (zero standard deviation)', async () => {
      // All scores are identical
      const hiredScores = [5, 5, 5, 5, 5];
      const notHiredScores = [5, 5, 5, 5, 5];
      const responses = createMockResponsesWithOutcomes('q1', hiredScores, notHiredScores);

      const mockQuestion = {
        ...createMockQuestion({ id: 'q1', timesAsked: 10 }),
        responses,
      };
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await calculateQuestionCorrelation('q1');

      // With identical scores, SD = 0, so correlation should be 0
      expect(result).toBe(0);
    });

    it('should return negative correlation when not-hired scores are higher', async () => {
      // Inverse relationship
      const hiredScores = [3, 2, 3, 2, 3];
      const notHiredScores = [8, 9, 8, 9, 8];
      const responses = createMockResponsesWithOutcomes('q1', hiredScores, notHiredScores);

      const mockQuestion = {
        ...createMockQuestion({ id: 'q1', timesAsked: 10 }),
        responses,
      };
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await calculateQuestionCorrelation('q1');

      expect(result).not.toBeNull();
      expect(result).toBeLessThan(-0.5); // Should be negative correlation
    });

    it('should validate the point-biserial correlation formula', async () => {
      // Using known values to verify the formula:
      // r = ((M1 - M0) / SD) * sqrt((n1 * n0) / (n * (n - 1)))
      // 
      // Test data:
      // Hired scores: [8, 8, 8, 8, 8] => M1 = 8, n1 = 5
      // Not hired:    [4, 4, 4, 4, 4] => M0 = 4, n0 = 5
      // All scores:   [8,8,8,8,8,4,4,4,4,4]
      // Mean = 6, SD = 2
      // n = 10
      //
      // r = ((8 - 4) / 2) * sqrt((5 * 5) / (10 * 9))
      // r = 2 * sqrt(25 / 90)
      // r = 2 * 0.527 ≈ 1.054 (clamped to 1)
      
      const hiredScores = [8, 8, 8, 8, 8];
      const notHiredScores = [4, 4, 4, 4, 4];
      const responses = createMockResponsesWithOutcomes('q1', hiredScores, notHiredScores);

      const mockQuestion = {
        ...createMockQuestion({ id: 'q1', timesAsked: 10 }),
        responses,
      };
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await calculateQuestionCorrelation('q1');

      expect(result).not.toBeNull();
      // Due to clamping, should be close to 1
      expect(result).toBeCloseTo(1, 1);
    });
  });

  // ============================================================================
  // Update Correlations Tests
  // ============================================================================

  describe('updateQuestionCorrelations', () => {
    it('should update all questions with sufficient data', async () => {
      const hiredScores = [8, 9, 8, 9, 8];
      const notHiredScores = [3, 2, 3, 2, 3];
      const responses = createMockResponsesWithOutcomes('q1', hiredScores, notHiredScores);

      const mockQuestions = [
        {
          ...createMockQuestion({ id: 'q1', timesAsked: 10 }),
          responses,
        },
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestions);

      const result = await updateQuestionCorrelations();

      expect(result.updated).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(updateQuestionCorrelationScore).toHaveBeenCalled();
    });

    it('should skip questions without enough decisions', async () => {
      // Only 4 hired + 5 not hired = 9 total (below 10 minimum)
      const hiredScores = [8, 9, 8, 9];
      const notHiredScores = [3, 2, 3, 2, 3];
      const responses = createMockResponsesWithOutcomes('q1', hiredScores, notHiredScores);

      const mockQuestions = [
        {
          ...createMockQuestion({ id: 'q1', timesAsked: 10 }),
          responses,
        },
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestions);

      const result = await updateQuestionCorrelations();

      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('should skip questions with only hired outcomes', async () => {
      const hiredScores = [8, 9, 8, 9, 8, 7, 8, 9, 8, 9];
      const responses = createMockResponsesWithOutcomes('q1', hiredScores, []);

      const mockQuestions = [
        {
          ...createMockQuestion({ id: 'q1', timesAsked: 10 }),
          responses,
        },
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestions);

      const result = await updateQuestionCorrelations();

      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      prismaMock.question.findMany.mockRejectedValue(new Error('Database error'));

      const result = await updateQuestionCorrelations();

      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Database error');
    });
  });

  // ============================================================================
  // Get Top Predictive Questions Tests
  // ============================================================================

  describe('getQuestionsByCorrelationEffectiveness', () => {
    it('should return questions sorted by correlationScore', async () => {
      const mockQuestions = [
        { id: 'q1', content: 'Q1', correlationScore: 0.9, timesAsked: 20, avgScore: 7 },
        { id: 'q2', content: 'Q2', correlationScore: 0.7, timesAsked: 25, avgScore: 6 },
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestions);

      const result = await getQuestionsByCorrelationEffectiveness(10);

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { correlationScore: 'desc' },
        })
      );
      expect(result).toEqual(mockQuestions);
    });

    it('should filter by minimum timesAsked', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);

      await getQuestionsByCorrelationEffectiveness(10);

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timesAsked: { gte: 10 },
          }),
        })
      );
    });

    it('should filter by position when provided', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);

      await getQuestionsByCorrelationEffectiveness(10, 'Software Engineer');

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            position: 'Software Engineer',
          }),
        })
      );
    });

    it('should respect limit parameter', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);

      await getQuestionsByCorrelationEffectiveness(5);

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      );
    });
  });

  // ============================================================================
  // Correlation Stats Tests
  // ============================================================================

  describe('getCorrelationStats', () => {
    it('should return correct statistics', async () => {
      const mockQuestions = [
        { correlationScore: 0.8 },
        { correlationScore: 0.6 },
        { correlationScore: 0.2 },
        { correlationScore: -0.3 },
        { correlationScore: 0 },
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestions);

      const result = await getCorrelationStats();

      expect(result.totalQuestions).toBe(5);
      expect(result.questionsWithCorrelation).toBe(4); // Excludes 0
      expect(result.avgCorrelation).toBeCloseTo(0.26, 2);
      expect(result.highCorrelationCount).toBe(2); // 0.8, 0.6 >= 0.5
      expect(result.lowCorrelationCount).toBe(0); // None <= -0.5
    });

    it('should handle empty results', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);

      const result = await getCorrelationStats();

      expect(result.totalQuestions).toBe(0);
      expect(result.questionsWithCorrelation).toBe(0);
      expect(result.avgCorrelation).toBe(0);
      expect(result.highCorrelationCount).toBe(0);
      expect(result.lowCorrelationCount).toBe(0);
    });

    it('should count high and low correlations correctly', async () => {
      const mockQuestions = [
        { correlationScore: 0.9 },  // high
        { correlationScore: 0.5 },  // high (exactly at threshold)
        { correlationScore: -0.6 }, // low
        { correlationScore: -0.5 }, // low (exactly at threshold)
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestions);

      const result = await getCorrelationStats();

      expect(result.highCorrelationCount).toBe(2);
      expect(result.lowCorrelationCount).toBe(2);
    });
  });
});
