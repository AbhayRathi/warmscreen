import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  prismaMock,
  createMockQuestion,
  createMockInterview,
  resetMocks,
} from '../../test-utils/prisma-mock';

// Mock the prisma module
vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

// Import after mocking
import {
  getNextQuestion,
  getInterviewProgress,
  isInterviewComplete,
  TARGET_QUESTIONS,
  getDifficultyForPosition,
} from '../question-selection';

describe('Question Selection Service', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('TARGET_QUESTIONS', () => {
    it('should be 10', () => {
      expect(TARGET_QUESTIONS).toBe(10);
    });
  });

  describe('getDifficultyForPosition', () => {
    it('should return EASY for positions 0-2', () => {
      expect(getDifficultyForPosition(0)).toBe('EASY');
      expect(getDifficultyForPosition(1)).toBe('EASY');
      expect(getDifficultyForPosition(2)).toBe('EASY');
    });

    it('should return MEDIUM for positions 3-7', () => {
      expect(getDifficultyForPosition(3)).toBe('MEDIUM');
      expect(getDifficultyForPosition(5)).toBe('MEDIUM');
      expect(getDifficultyForPosition(7)).toBe('MEDIUM');
    });

    it('should return HARD for positions 8+', () => {
      expect(getDifficultyForPosition(8)).toBe('HARD');
      expect(getDifficultyForPosition(9)).toBe('HARD');
    });
  });

  // ============================================================================
  // getNextQuestion Tests
  // ============================================================================

  describe('getNextQuestion', () => {
    it('should return null when target reached', async () => {
      const result = await getNextQuestion('interview-123', TARGET_QUESTIONS);

      expect(result).toBeNull();
    });

    it('should throw error for non-existent interview', async () => {
      prismaMock.interview.findUnique.mockResolvedValue(null);

      await expect(getNextQuestion('non-existent', 0)).rejects.toThrow(
        'Interview not found'
      );
    });

    it('should exclude already-asked questions', async () => {
      const mockInterview = createMockInterview();
      prismaMock.interview.findUnique.mockResolvedValue(mockInterview);

      // Mock already answered questions
      prismaMock.response.findMany.mockResolvedValue([
        { questionId: 'q1' },
        { questionId: 'q2' },
      ]);

      // Mock question selection
      const mockQuestion = createMockQuestion({ id: 'q3' });
      prismaMock.question.findMany.mockResolvedValue([mockQuestion]);

      const result = await getNextQuestion('interview-123', 2);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('q3');

      // Verify excludeIds were passed
      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { notIn: ['q1', 'q2'] },
          }),
        })
      );
    });

    it('should return null when no questions available', async () => {
      const mockInterview = createMockInterview();
      prismaMock.interview.findUnique.mockResolvedValue(mockInterview);
      prismaMock.response.findMany.mockResolvedValue([]);
      prismaMock.question.findMany.mockResolvedValue([]);

      const result = await getNextQuestion('interview-123', 0);

      expect(result).toBeNull();
    });

    it('should return question with correct structure', async () => {
      const mockInterview = createMockInterview();
      prismaMock.interview.findUnique.mockResolvedValue(mockInterview);
      prismaMock.response.findMany.mockResolvedValue([]);

      const mockQuestion = createMockQuestion({
        id: 'q1',
        content: 'Test question content',
        category: 'TECHNICAL',
        difficulty: 'MEDIUM',
        position: 'Software Engineer',
      });
      prismaMock.question.findMany.mockResolvedValue([mockQuestion]);

      const result = await getNextQuestion('interview-123', 0);

      expect(result).toEqual({
        id: 'q1',
        content: 'Test question content',
        category: 'TECHNICAL',
        difficulty: 'MEDIUM',
        position: 'Software Engineer',
      });
    });
  });

  // ============================================================================
  // getInterviewProgress Tests
  // ============================================================================

  describe('getInterviewProgress', () => {
    it('should calculate progress correctly at start', async () => {
      prismaMock.response.count.mockResolvedValue(0);

      const result = await getInterviewProgress('interview-123');

      expect(result).toEqual({
        current: 0,
        total: TARGET_QUESTIONS,
        percentage: 0,
      });
    });

    it('should calculate progress correctly mid-interview', async () => {
      prismaMock.response.count.mockResolvedValue(5);

      const result = await getInterviewProgress('interview-123');

      expect(result).toEqual({
        current: 5,
        total: TARGET_QUESTIONS,
        percentage: 50,
      });
    });

    it('should calculate progress correctly at completion', async () => {
      prismaMock.response.count.mockResolvedValue(10);

      const result = await getInterviewProgress('interview-123');

      expect(result).toEqual({
        current: 10,
        total: TARGET_QUESTIONS,
        percentage: 100,
      });
    });

    it('should round percentage correctly', async () => {
      prismaMock.response.count.mockResolvedValue(3);

      const result = await getInterviewProgress('interview-123');

      expect(result.percentage).toBe(30);
    });
  });

  // ============================================================================
  // isInterviewComplete Tests
  // ============================================================================

  describe('isInterviewComplete', () => {
    it('should return false when not all questions answered', async () => {
      prismaMock.response.count.mockResolvedValue(5);

      const result = await isInterviewComplete('interview-123');

      expect(result).toBe(false);
    });

    it('should return true when all questions answered', async () => {
      prismaMock.response.count.mockResolvedValue(10);

      const result = await isInterviewComplete('interview-123');

      expect(result).toBe(true);
    });

    it('should return true when more than target questions answered', async () => {
      prismaMock.response.count.mockResolvedValue(12);

      const result = await isInterviewComplete('interview-123');

      expect(result).toBe(true);
    });
  });
});
