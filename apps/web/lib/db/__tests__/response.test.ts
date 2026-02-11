import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  prismaMock,
  createMockFullResponse,
  createMockQuestion,
  resetMocks,
} from '../../test-utils/prisma-mock';

// Mock the prisma module
vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

// Import after mocking
import {
  createResponse,
  getResponseById,
  getInterviewResponses,
  updateResponse,
  getResponseCount,
  getAnsweredQuestionIds,
  CreateResponseSchema,
  UpdateResponseSchema,
} from '../response';

describe('Response Database Utilities', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Schema Validation Tests
  // ============================================================================

  describe('CreateResponseSchema', () => {
    it('should validate correct response data', () => {
      const data = {
        interviewId: 'interview-123',
        questionId: 'question-123',
        transcript: 'This is my answer to the question.',
        duration: 120,
      };
      expect(() => CreateResponseSchema.parse(data)).not.toThrow();
    });

    it('should reject empty transcript', () => {
      const data = {
        interviewId: 'interview-123',
        questionId: 'question-123',
        transcript: '',
        duration: 120,
      };
      expect(() => CreateResponseSchema.parse(data)).toThrow();
    });

    it('should reject missing interview ID', () => {
      const data = {
        questionId: 'question-123',
        transcript: 'This is my answer.',
        duration: 120,
      };
      expect(() => CreateResponseSchema.parse(data)).toThrow();
    });

    it('should reject negative duration', () => {
      const data = {
        interviewId: 'interview-123',
        questionId: 'question-123',
        transcript: 'This is my answer.',
        duration: -10,
      };
      expect(() => CreateResponseSchema.parse(data)).toThrow();
    });

    it('should accept optional audioUrl', () => {
      const data = {
        interviewId: 'interview-123',
        questionId: 'question-123',
        transcript: 'This is my answer.',
        duration: 120,
        audioUrl: 'https://example.com/audio.mp3',
      };
      expect(() => CreateResponseSchema.parse(data)).not.toThrow();
    });
  });

  describe('UpdateResponseSchema', () => {
    it('should validate partial updates', () => {
      const data = { transcript: 'Updated transcript' };
      expect(() => UpdateResponseSchema.parse(data)).not.toThrow();
    });

    it('should validate scores update', () => {
      const data = { scores: { technical: 8, communication: 7 } };
      expect(() => UpdateResponseSchema.parse(data)).not.toThrow();
    });

    it('should validate sentiment range', () => {
      expect(() => UpdateResponseSchema.parse({ sentiment: 0.5 })).not.toThrow();
      expect(() => UpdateResponseSchema.parse({ sentiment: -1 })).not.toThrow();
      expect(() => UpdateResponseSchema.parse({ sentiment: 1 })).not.toThrow();
    });

    it('should reject sentiment out of range', () => {
      expect(() => UpdateResponseSchema.parse({ sentiment: 1.5 })).toThrow();
      expect(() => UpdateResponseSchema.parse({ sentiment: -1.5 })).toThrow();
    });

    it('should validate confidence range', () => {
      expect(() => UpdateResponseSchema.parse({ confidence: 0.8 })).not.toThrow();
      expect(() => UpdateResponseSchema.parse({ confidence: 0 })).not.toThrow();
      expect(() => UpdateResponseSchema.parse({ confidence: 1 })).not.toThrow();
    });

    it('should reject confidence out of range', () => {
      expect(() => UpdateResponseSchema.parse({ confidence: 1.5 })).toThrow();
      expect(() => UpdateResponseSchema.parse({ confidence: -0.5 })).toThrow();
    });
  });

  // ============================================================================
  // CRUD Operations Tests
  // ============================================================================

  describe('createResponse', () => {
    it('should create a response with valid data', async () => {
      const mockResponse = createMockFullResponse();
      prismaMock.response.create.mockResolvedValue(mockResponse);

      const input = {
        interviewId: 'interview-123',
        questionId: 'question-123',
        transcript: 'This is my answer to the question.',
        duration: 120,
      };

      const result = await createResponse(input);

      expect(prismaMock.response.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });

    it('should throw error for invalid data', async () => {
      const input = {
        interviewId: 'interview-123',
        questionId: 'question-123',
        transcript: '', // Empty transcript
        duration: 120,
      };

      await expect(createResponse(input)).rejects.toThrow();
    });
  });

  describe('getResponseById', () => {
    it('should return response when found', async () => {
      const mockResponse = createMockFullResponse({ id: 'response-123' });
      prismaMock.response.findUnique.mockResolvedValue(mockResponse);

      const result = await getResponseById('response-123');

      expect(prismaMock.response.findUnique).toHaveBeenCalledWith({
        where: { id: 'response-123' },
        include: {
          question: true,
        },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should return null for non-existent ID', async () => {
      prismaMock.response.findUnique.mockResolvedValue(null);

      const result = await getResponseById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getInterviewResponses', () => {
    it('should return responses ordered by createdAt', async () => {
      const mockResponses = [
        createMockFullResponse({
          id: 'response-1',
          createdAt: new Date('2024-01-01T10:00:00'),
          question: createMockQuestion(),
        }),
        createMockFullResponse({
          id: 'response-2',
          createdAt: new Date('2024-01-01T11:00:00'),
          question: createMockQuestion(),
        }),
      ];
      prismaMock.response.findMany.mockResolvedValue(mockResponses);

      const result = await getInterviewResponses('interview-123');

      expect(prismaMock.response.findMany).toHaveBeenCalledWith({
        where: { interviewId: 'interview-123' },
        orderBy: { createdAt: 'asc' },
        include: {
          question: {
            select: {
              id: true,
              content: true,
              category: true,
              difficulty: true,
            },
          },
        },
      });
      expect(result).toEqual(mockResponses);
    });

    it('should return empty array when no responses exist', async () => {
      prismaMock.response.findMany.mockResolvedValue([]);

      const result = await getInterviewResponses('interview-123');

      expect(result).toEqual([]);
    });
  });

  describe('updateResponse', () => {
    it('should update response with scores', async () => {
      const mockResponse = createMockFullResponse({
        id: 'response-123',
        scores: { technical: 8, communication: 7 },
      });
      prismaMock.response.update.mockResolvedValue(mockResponse);

      const result = await updateResponse('response-123', {
        scores: { technical: 8, communication: 7 },
      });

      expect(prismaMock.response.update).toHaveBeenCalledWith({
        where: { id: 'response-123' },
        data: { scores: { technical: 8, communication: 7 } },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should update response with sentiment and confidence', async () => {
      const mockResponse = createMockFullResponse({
        id: 'response-123',
        sentiment: 0.8,
        confidence: 0.9,
      });
      prismaMock.response.update.mockResolvedValue(mockResponse);

      const result = await updateResponse('response-123', {
        sentiment: 0.8,
        confidence: 0.9,
      });

      expect(prismaMock.response.update).toHaveBeenCalledWith({
        where: { id: 'response-123' },
        data: { sentiment: 0.8, confidence: 0.9 },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getResponseCount', () => {
    it('should return correct count', async () => {
      prismaMock.response.count.mockResolvedValue(5);

      const result = await getResponseCount('interview-123');

      expect(prismaMock.response.count).toHaveBeenCalledWith({
        where: { interviewId: 'interview-123' },
      });
      expect(result).toBe(5);
    });

    it('should return 0 when no responses', async () => {
      prismaMock.response.count.mockResolvedValue(0);

      const result = await getResponseCount('interview-123');

      expect(result).toBe(0);
    });
  });

  describe('getAnsweredQuestionIds', () => {
    it('should return question IDs from responses', async () => {
      prismaMock.response.findMany.mockResolvedValue([
        { questionId: 'q1' },
        { questionId: 'q2' },
        { questionId: 'q3' },
      ]);

      const result = await getAnsweredQuestionIds('interview-123');

      expect(prismaMock.response.findMany).toHaveBeenCalledWith({
        where: { interviewId: 'interview-123' },
        select: { questionId: true },
      });
      expect(result).toEqual(['q1', 'q2', 'q3']);
    });

    it('should return empty array when no responses', async () => {
      prismaMock.response.findMany.mockResolvedValue([]);

      const result = await getAnsweredQuestionIds('interview-123');

      expect(result).toEqual([]);
    });
  });
});
