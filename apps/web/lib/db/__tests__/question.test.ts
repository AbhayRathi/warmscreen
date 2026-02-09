import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  prismaMock,
  createMockQuestion,
  resetMocks,
} from '../../test-utils/prisma-mock';

// Mock the prisma module
vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

// Import after mocking
import {
  createQuestion,
  getQuestionById,
  getAllQuestions,
  updateQuestion,
  deleteQuestion,
  getRandomQuestion,
  incrementQuestionUsage,
  updateQuestionMetrics,
  getQuestionAnalytics,
  CreateQuestionSchema,
  UpdateQuestionSchema,
} from '../question';

describe('Question Database Utilities', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Schema Validation Tests
  // ============================================================================
  
  describe('CreateQuestionSchema', () => {
    it('should validate correct question data', () => {
      const data = {
        content: 'This is a valid question with enough content.',
        category: 'TECHNICAL',
        difficulty: 'MEDIUM' as const,
        position: 'Software Engineer',
        skillTags: ['javascript', 'testing'],
      };
      expect(() => CreateQuestionSchema.parse(data)).not.toThrow();
    });

    it('should reject content with less than 10 characters', () => {
      const data = {
        content: 'Short',
        category: 'TECHNICAL',
        difficulty: 'MEDIUM' as const,
        position: 'Software Engineer',
        skillTags: [],
      };
      expect(() => CreateQuestionSchema.parse(data)).toThrow();
    });

    it('should reject missing required fields', () => {
      const data = {
        content: 'This is a valid question',
        // Missing category, difficulty, position
      };
      expect(() => CreateQuestionSchema.parse(data)).toThrow();
    });

    it('should accept all difficulty levels', () => {
      const difficulties = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const;
      difficulties.forEach((difficulty) => {
        const data = {
          content: 'This is a valid question with enough content.',
          category: 'TECHNICAL',
          difficulty,
          position: 'Engineer',
          skillTags: [],
        };
        expect(() => CreateQuestionSchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('UpdateQuestionSchema', () => {
    it('should validate partial updates', () => {
      const data = { content: 'Updated content with enough characters' };
      expect(() => UpdateQuestionSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid difficulty', () => {
      const data = { difficulty: 'INVALID' };
      expect(() => UpdateQuestionSchema.parse(data)).toThrow();
    });
  });

  // ============================================================================
  // CRUD Operations Tests
  // ============================================================================

  describe('createQuestion', () => {
    it('should create a question with valid data', async () => {
      const mockQuestion = createMockQuestion();
      prismaMock.question.create.mockResolvedValue(mockQuestion);

      const input = {
        content: 'This is a valid question with enough content.',
        category: 'TECHNICAL',
        difficulty: 'MEDIUM' as const,
        position: 'Software Engineer',
        skillTags: ['javascript', 'testing'],
      };

      const result = await createQuestion(input, 'test-user-id');

      expect(prismaMock.question.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockQuestion);
    });

    it('should throw error for invalid data', async () => {
      const input = {
        content: 'Short', // Too short
        category: 'TECHNICAL',
        difficulty: 'MEDIUM' as const,
        position: 'Software Engineer',
        skillTags: [],
      };

      await expect(createQuestion(input, 'test-user-id')).rejects.toThrow();
    });
  });

  describe('getQuestionById', () => {
    it('should return question when found', async () => {
      const mockQuestion = createMockQuestion({ id: 'question-123' });
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await getQuestionById('question-123');

      expect(prismaMock.question.findUnique).toHaveBeenCalledWith({
        where: { id: 'question-123' },
      });
      expect(result).toEqual(mockQuestion);
    });

    it('should return null for non-existent ID', async () => {
      prismaMock.question.findUnique.mockResolvedValue(null);

      const result = await getQuestionById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getAllQuestions', () => {
    it('should return paginated results with no filters', async () => {
      const mockQuestions = [
        createMockQuestion({ id: 'q1' }),
        createMockQuestion({ id: 'q2' }),
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestions);
      prismaMock.question.count.mockResolvedValue(10);

      const result = await getAllQuestions({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.questions).toEqual(mockQuestions);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by category', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.question.count.mockResolvedValue(0);

      await getAllQuestions({
        category: 'TECHNICAL',
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'TECHNICAL' }),
        })
      );
    });

    it('should filter by difficulty', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.question.count.mockResolvedValue(0);

      await getAllQuestions({
        difficulty: 'HARD',
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ difficulty: 'HARD' }),
        })
      );
    });

    it('should filter by position', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.question.count.mockResolvedValue(0);

      await getAllQuestions({
        position: 'Software Engineer',
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ position: 'Software Engineer' }),
        })
      );
    });

    it('should calculate totalPages correctly', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.question.count.mockResolvedValue(45);

      const result = await getAllQuestions({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.totalPages).toBe(5); // 45 / 10 = 4.5, ceil = 5
    });
  });

  describe('updateQuestion', () => {
    it('should update question fields', async () => {
      const mockQuestion = createMockQuestion({
        content: 'Updated content with enough characters here',
      });
      prismaMock.question.update.mockResolvedValue(mockQuestion);

      const result = await updateQuestion('question-123', {
        content: 'Updated content with enough characters here',
      });

      expect(prismaMock.question.update).toHaveBeenCalledWith({
        where: { id: 'question-123' },
        data: { content: 'Updated content with enough characters here' },
      });
      expect(result).toEqual(mockQuestion);
    });

    it('should reject invalid update data', async () => {
      await expect(
        updateQuestion('question-123', {
          content: 'Short', // Too short
        })
      ).rejects.toThrow();
    });
  });

  describe('deleteQuestion', () => {
    it('should delete question and return it', async () => {
      const mockQuestion = createMockQuestion({ id: 'question-123' });
      prismaMock.question.delete.mockResolvedValue(mockQuestion);

      const result = await deleteQuestion('question-123');

      expect(prismaMock.question.delete).toHaveBeenCalledWith({
        where: { id: 'question-123' },
      });
      expect(result).toEqual(mockQuestion);
    });
  });

  // ============================================================================
  // Weighted Random Selection Tests (CRITICAL)
  // ============================================================================

  describe('getRandomQuestion', () => {
    it('should return questions matching criteria', async () => {
      const mockQuestions = [
        createMockQuestion({ id: 'q1', position: 'Software Engineer' }),
        createMockQuestion({ id: 'q2', position: 'Software Engineer' }),
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestions);

      const result = await getRandomQuestion({
        position: 'Software Engineer',
        count: 1,
      });

      expect(result.length).toBe(1);
      expect(result[0].position).toBe('Software Engineer');
    });

    it('should exclude IDs in excludeIds array', async () => {
      const mockQuestions = [
        createMockQuestion({ id: 'q1' }),
        createMockQuestion({ id: 'q2' }),
        createMockQuestion({ id: 'q3' }),
      ];
      prismaMock.question.findMany.mockResolvedValue(
        mockQuestions.filter((q) => q.id !== 'q1')
      );

      await getRandomQuestion({
        excludeIds: ['q1'],
        count: 2,
      });

      expect(prismaMock.question.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { notIn: ['q1'] },
        }),
      });
    });

    it('should return empty array when no questions match', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);

      const result = await getRandomQuestion({
        position: 'Non-existent Position',
        count: 1,
      });

      expect(result).toEqual([]);
    });

    it('should return all candidates when count exceeds available', async () => {
      const mockQuestions = [
        createMockQuestion({ id: 'q1' }),
        createMockQuestion({ id: 'q2' }),
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestions);

      const result = await getRandomQuestion({
        count: 10, // Request 10 but only 2 available
      });

      expect(result).toEqual(mockQuestions);
    });

    it('should favor questions with higher correlationScore', async () => {
      // Create questions with different correlation scores
      const lowCorrelation = createMockQuestion({
        id: 'low',
        correlationScore: 0.1,
        timesAsked: 50,
        avgScore: 5,
        lastUsed: new Date(),
      });
      const highCorrelation = createMockQuestion({
        id: 'high',
        correlationScore: 0.9,
        timesAsked: 50,
        avgScore: 5,
        lastUsed: new Date(),
      });
      prismaMock.question.findMany.mockResolvedValue([lowCorrelation, highCorrelation]);

      // Run multiple selections to verify weighting
      const selections: Record<string, number> = { low: 0, high: 0 };
      
      for (let i = 0; i < 100; i++) {
        const result = await getRandomQuestion({ count: 1 });
        if (result.length > 0) {
          selections[result[0].id]++;
        }
      }

      // High correlation should be selected more often
      expect(selections.high).toBeGreaterThan(selections.low);
    });

    it('should favor questions with lower timesAsked (variety)', async () => {
      const highUsage = createMockQuestion({
        id: 'high-usage',
        correlationScore: 0.5,
        timesAsked: 100, // Max usage
        avgScore: 5,
        lastUsed: null,
      });
      const lowUsage = createMockQuestion({
        id: 'low-usage',
        correlationScore: 0.5,
        timesAsked: 0, // Never used
        avgScore: 5,
        lastUsed: null,
      });
      prismaMock.question.findMany.mockResolvedValue([highUsage, lowUsage]);

      const selections: Record<string, number> = { 'high-usage': 0, 'low-usage': 0 };
      
      for (let i = 0; i < 100; i++) {
        const result = await getRandomQuestion({ count: 1 });
        if (result.length > 0) {
          selections[result[0].id]++;
        }
      }

      // Low usage should be selected more often
      expect(selections['low-usage']).toBeGreaterThan(selections['high-usage']);
    });

    it('should favor questions with older lastUsed (freshness)', async () => {
      const recentlyUsed = createMockQuestion({
        id: 'recent',
        correlationScore: 0.5,
        timesAsked: 50,
        avgScore: 5,
        lastUsed: new Date(), // Just now
      });
      const oldUsed = createMockQuestion({
        id: 'old',
        correlationScore: 0.5,
        timesAsked: 50,
        avgScore: 5,
        lastUsed: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      });
      prismaMock.question.findMany.mockResolvedValue([recentlyUsed, oldUsed]);

      const selections: Record<string, number> = { recent: 0, old: 0 };
      
      for (let i = 0; i < 100; i++) {
        const result = await getRandomQuestion({ count: 1 });
        if (result.length > 0) {
          selections[result[0].id]++;
        }
      }

      // Old usage should be selected more often
      expect(selections.old).toBeGreaterThan(selections.recent);
    });
  });

  // ============================================================================
  // Metrics Tests
  // ============================================================================

  describe('incrementQuestionUsage', () => {
    it('should increment timesAsked and update lastUsed', async () => {
      const mockQuestion = createMockQuestion({
        timesAsked: 11,
        lastUsed: new Date(),
      });
      prismaMock.question.update.mockResolvedValue(mockQuestion);

      const result = await incrementQuestionUsage('question-123');

      expect(prismaMock.question.update).toHaveBeenCalledWith({
        where: { id: 'question-123' },
        data: {
          timesAsked: { increment: 1 },
          lastUsed: expect.any(Date),
        },
      });
      expect(result).toEqual(mockQuestion);
    });
  });

  describe('updateQuestionMetrics', () => {
    it('should calculate EMA correctly', async () => {
      const mockQuestion = createMockQuestion({
        avgScore: 5.0,
        timesAsked: 10,
      });
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);
      prismaMock.question.update.mockResolvedValue({
        ...mockQuestion,
        avgScore: 5.5, // EMA result
      });

      // EMA: newAvg = alpha * newScore + (1 - alpha) * oldAvg
      // With alpha=0.1: newAvg = 0.1 * 10 + 0.9 * 5.0 = 1 + 4.5 = 5.5
      const result = await updateQuestionMetrics('question-123', 10, 0.1);

      expect(prismaMock.question.update).toHaveBeenCalledWith({
        where: { id: 'question-123' },
        data: {
          avgScore: 5.5,
        },
      });
      expect(result.avgScore).toBe(5.5);
    });

    it('should throw error for non-existent question', async () => {
      prismaMock.question.findUnique.mockResolvedValue(null);

      await expect(
        updateQuestionMetrics('non-existent', 8)
      ).rejects.toThrow('Question not found');
    });

    it('should handle first response (avgScore=0)', async () => {
      const mockQuestion = createMockQuestion({
        avgScore: 0,
        timesAsked: 0,
      });
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);
      prismaMock.question.update.mockResolvedValue({
        ...mockQuestion,
        avgScore: 0.8, // 0.1 * 8 + 0.9 * 0 = 0.8
      });

      await updateQuestionMetrics('question-123', 8, 0.1);

      expect(prismaMock.question.update).toHaveBeenCalledWith({
        where: { id: 'question-123' },
        data: {
          avgScore: 0.8,
        },
      });
    });

    it('should use custom alpha value', async () => {
      const mockQuestion = createMockQuestion({
        avgScore: 6.0,
      });
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);
      prismaMock.question.update.mockResolvedValue({
        ...mockQuestion,
        avgScore: 6.4, // 0.2 * 8 + 0.8 * 6.0 = 1.6 + 4.8 = 6.4
      });

      await updateQuestionMetrics('question-123', 8, 0.2);

      expect(prismaMock.question.update).toHaveBeenCalledWith({
        where: { id: 'question-123' },
        data: {
          avgScore: 6.4,
        },
      });
    });
  });

  // ============================================================================
  // Analytics Tests
  // ============================================================================

  describe('getQuestionAnalytics', () => {
    it('should return correct statistics', async () => {
      const mockQuestion = createMockQuestion({
        id: 'q1',
        avgScore: 7.5,
        correlationScore: 0.65,
        timesAsked: 25,
        lastUsed: new Date('2024-01-15'),
        responses: [
          { id: 'r1', scores: { overall: 8 }, createdAt: new Date() },
          { id: 'r2', scores: { overall: 6 }, createdAt: new Date() },
        ] as any,
      });
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await getQuestionAnalytics('q1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('q1');
      expect(result?.totalResponses).toBe(2);
      expect(result?.avgScore).toBe(7.5);
      expect(result?.correlationScore).toBe(0.65);
      expect(result?.timesAsked).toBe(25);
      expect(result?.scoreDistribution).toHaveLength(5);
    });

    it('should return null for non-existent question', async () => {
      prismaMock.question.findUnique.mockResolvedValue(null);

      const result = await getQuestionAnalytics('non-existent');

      expect(result).toBeNull();
    });

    it('should handle questions with no responses', async () => {
      const mockQuestion = createMockQuestion({
        id: 'q1',
        responses: [],
      } as any);
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await getQuestionAnalytics('q1');

      expect(result).not.toBeNull();
      expect(result?.totalResponses).toBe(0);
      expect(result?.scoreDistribution.every((s) => s.count === 0)).toBe(true);
    });

    it('should calculate score distribution correctly', async () => {
      const mockQuestion = createMockQuestion({
        id: 'q1',
        responses: [
          { id: 'r1', scores: { overall: 1 }, createdAt: new Date() },
          { id: 'r2', scores: { overall: 3 }, createdAt: new Date() },
          { id: 'r3', scores: { overall: 5 }, createdAt: new Date() },
          { id: 'r4', scores: { overall: 7 }, createdAt: new Date() },
          { id: 'r5', scores: { overall: 9 }, createdAt: new Date() },
        ] as any,
      });
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await getQuestionAnalytics('q1');

      expect(result?.scoreDistribution).toEqual([
        { range: '0-2', count: 1 },
        { range: '3-4', count: 1 },
        { range: '5-6', count: 1 },
        { range: '7-8', count: 1 },
        { range: '9-10', count: 1 },
      ]);
    });
  });
});
