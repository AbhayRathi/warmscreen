import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  prismaMock,
  createMockQuestion,
  createMockUser,
  createMockSession,
  resetMocks,
} from '@/lib/test-utils/prisma-mock';

// Mock the session module
const mockGetSession = vi.fn();
vi.mock('@/lib/auth/session', () => ({
  getSession: () => mockGetSession(),
}));

// Mock the prisma module
vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

// Mock user lookup
const mockGetUserById = vi.fn();
vi.mock('@/lib/db/user', () => ({
  getUserById: () => mockGetUserById(),
}));

// Import routes after mocking
import { GET, POST } from '../route';
import { GET as GET_BY_ID, PATCH, DELETE } from '../[id]/route';
import { POST as POST_RANDOM } from '../random/route';

// Helper to create mock NextRequest
function createMockRequest(
  url: string,
  method: string = 'GET',
  body?: any
): NextRequest {
  const request = new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return request as NextRequest;
}

// Helper to create route context with params
function createRouteContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

describe('Questions API Routes', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // GET /api/questions Tests
  // ============================================================================

  describe('GET /api/questions', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetSession.mockResolvedValue({ isLoggedIn: false });

      const request = createMockRequest('http://localhost/api/questions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return paginated questions if authenticated', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      
      const mockQuestions = [
        createMockQuestion({ id: 'q1' }),
        createMockQuestion({ id: 'q2' }),
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestions);
      prismaMock.question.count.mockResolvedValue(2);

      const request = createMockRequest('http://localhost/api/questions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.questions).toHaveLength(2);
      expect(data.total).toBe(2);
    });

    it('should apply filters from query params', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.question.count.mockResolvedValue(0);

      const request = createMockRequest(
        'http://localhost/api/questions?category=TECHNICAL&difficulty=HARD&position=Engineer'
      );
      await GET(request);

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'TECHNICAL',
            difficulty: 'HARD',
            position: 'Engineer',
          }),
        })
      );
    });

    it('should apply pagination parameters', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.question.count.mockResolvedValue(100);

      const request = createMockRequest(
        'http://localhost/api/questions?page=2&limit=10'
      );
      await GET(request);

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page-1) * limit = (2-1) * 10
          take: 10,
        })
      );
    });
  });

  // ============================================================================
  // POST /api/questions Tests (ADMIN only)
  // ============================================================================

  describe('POST /api/questions', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetSession.mockResolvedValue({ isLoggedIn: false });

      const request = createMockRequest(
        'http://localhost/api/questions',
        'POST',
        {
          content: 'This is a valid question content.',
          category: 'TECHNICAL',
          difficulty: 'MEDIUM',
          position: 'Software Engineer',
          skillTags: ['javascript'],
        }
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if user is not ADMIN', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ userId: 'user1' }));
      mockGetUserById.mockResolvedValue(createMockUser({ role: 'RECRUITER' }));

      const request = createMockRequest(
        'http://localhost/api/questions',
        'POST',
        {
          content: 'This is a valid question content.',
          category: 'TECHNICAL',
          difficulty: 'MEDIUM',
          position: 'Software Engineer',
          skillTags: ['javascript'],
        }
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    it('should create question if user is ADMIN', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ userId: 'admin1' }));
      mockGetUserById.mockResolvedValue(createMockUser({ role: 'ADMIN' }));
      
      const mockQuestion = createMockQuestion();
      prismaMock.question.create.mockResolvedValue(mockQuestion);

      const request = createMockRequest(
        'http://localhost/api/questions',
        'POST',
        {
          content: 'This is a valid question content.',
          category: 'TECHNICAL',
          difficulty: 'MEDIUM',
          position: 'Software Engineer',
          skillTags: ['javascript'],
        }
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.question).toBeDefined();
    });

    it('should return 400 for invalid data (Zod validation)', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ userId: 'admin1' }));
      mockGetUserById.mockResolvedValue(createMockUser({ role: 'ADMIN' }));

      const request = createMockRequest(
        'http://localhost/api/questions',
        'POST',
        {
          content: 'Short', // Too short
          category: 'TECHNICAL',
          difficulty: 'INVALID', // Invalid difficulty
          position: 'Engineer',
          skillTags: [],
        }
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
      expect(data.details).toBeDefined();
    });
  });

  // ============================================================================
  // GET /api/questions/[id] Tests
  // ============================================================================

  describe('GET /api/questions/[id]', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetSession.mockResolvedValue({ isLoggedIn: false });

      const request = createMockRequest('http://localhost/api/questions/q1');
      const context = createRouteContext('q1');
      const response = await GET_BY_ID(request, context);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 if question does not exist', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      prismaMock.question.findUnique.mockResolvedValue(null);

      const request = createMockRequest('http://localhost/api/questions/non-existent');
      const context = createRouteContext('non-existent');
      const response = await GET_BY_ID(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Question not found');
    });

    it('should return question with creator info', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      const mockQuestion = createMockQuestion({ id: 'q1' });
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const request = createMockRequest('http://localhost/api/questions/q1');
      const context = createRouteContext('q1');
      const response = await GET_BY_ID(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.question.id).toBe('q1');
    });
  });

  // ============================================================================
  // PATCH /api/questions/[id] Tests (ADMIN only)
  // ============================================================================

  describe('PATCH /api/questions/[id]', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetSession.mockResolvedValue({ isLoggedIn: false });

      const request = createMockRequest(
        'http://localhost/api/questions/q1',
        'PATCH',
        { content: 'Updated content for the question.' }
      );
      const context = createRouteContext('q1');
      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if user is not ADMIN', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ userId: 'user1' }));
      mockGetUserById.mockResolvedValue(createMockUser({ role: 'RECRUITER' }));

      const request = createMockRequest(
        'http://localhost/api/questions/q1',
        'PATCH',
        { content: 'Updated content for the question.' }
      );
      const context = createRouteContext('q1');
      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    it('should return 404 if question does not exist', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ userId: 'admin1' }));
      mockGetUserById.mockResolvedValue(createMockUser({ role: 'ADMIN' }));
      prismaMock.question.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost/api/questions/non-existent',
        'PATCH',
        { content: 'Updated content for the question.' }
      );
      const context = createRouteContext('non-existent');
      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Question not found');
    });

    it('should update question if user is ADMIN', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ userId: 'admin1' }));
      mockGetUserById.mockResolvedValue(createMockUser({ role: 'ADMIN' }));
      
      const mockQuestion = createMockQuestion({ id: 'q1' });
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);
      prismaMock.question.update.mockResolvedValue({
        ...mockQuestion,
        content: 'Updated content for the question.',
      });

      const request = createMockRequest(
        'http://localhost/api/questions/q1',
        'PATCH',
        { content: 'Updated content for the question.' }
      );
      const context = createRouteContext('q1');
      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.question.content).toBe('Updated content for the question.');
    });
  });

  // ============================================================================
  // DELETE /api/questions/[id] Tests (ADMIN only)
  // ============================================================================

  describe('DELETE /api/questions/[id]', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetSession.mockResolvedValue({ isLoggedIn: false });

      const request = createMockRequest(
        'http://localhost/api/questions/q1',
        'DELETE'
      );
      const context = createRouteContext('q1');
      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if user is not ADMIN', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ userId: 'user1' }));
      mockGetUserById.mockResolvedValue(createMockUser({ role: 'RECRUITER' }));

      const request = createMockRequest(
        'http://localhost/api/questions/q1',
        'DELETE'
      );
      const context = createRouteContext('q1');
      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    it('should return 404 if question does not exist', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ userId: 'admin1' }));
      mockGetUserById.mockResolvedValue(createMockUser({ role: 'ADMIN' }));
      prismaMock.question.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost/api/questions/non-existent',
        'DELETE'
      );
      const context = createRouteContext('non-existent');
      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Question not found');
    });

    it('should delete question if user is ADMIN', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ userId: 'admin1' }));
      mockGetUserById.mockResolvedValue(createMockUser({ role: 'ADMIN' }));
      
      const mockQuestion = createMockQuestion({ id: 'q1' });
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);
      prismaMock.question.delete.mockResolvedValue(mockQuestion);

      const request = createMockRequest(
        'http://localhost/api/questions/q1',
        'DELETE'
      );
      const context = createRouteContext('q1');
      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');
    });
  });

  // ============================================================================
  // POST /api/questions/random Tests
  // ============================================================================

  describe('POST /api/questions/random', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetSession.mockResolvedValue({ isLoggedIn: false });

      const request = createMockRequest(
        'http://localhost/api/questions/random',
        'POST',
        { count: 3 }
      );
      const response = await POST_RANDOM(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return questions matching criteria', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      
      const mockQuestions = [
        createMockQuestion({ id: 'q1', position: 'Software Engineer' }),
        createMockQuestion({ id: 'q2', position: 'Software Engineer' }),
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestions);
      prismaMock.question.update.mockResolvedValue(mockQuestions[0]);

      const request = createMockRequest(
        'http://localhost/api/questions/random',
        'POST',
        { 
          position: 'Software Engineer',
          count: 2,
        }
      );
      const response = await POST_RANDOM(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.questions).toBeDefined();
      expect(data.count).toBe(2);
    });

    it('should increment timesAsked counter by default', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      
      const mockQuestion = createMockQuestion({ id: 'q1' });
      prismaMock.question.findMany.mockResolvedValue([mockQuestion]);
      prismaMock.question.update.mockResolvedValue(mockQuestion);

      const request = createMockRequest(
        'http://localhost/api/questions/random',
        'POST',
        { count: 1 }
      );
      await POST_RANDOM(request);

      expect(prismaMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'q1' },
          data: expect.objectContaining({
            timesAsked: { increment: 1 },
          }),
        })
      );
    });

    it('should return empty array if no questions match', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      prismaMock.question.findMany.mockResolvedValue([]);

      const request = createMockRequest(
        'http://localhost/api/questions/random',
        'POST',
        { 
          position: 'Non-existent Position',
          count: 1,
        }
      );
      const response = await POST_RANDOM(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.questions).toEqual([]);
      expect(data.count).toBe(0);
    });

    it('should skip usage tracking when trackUsage is false', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      
      const mockQuestion = createMockQuestion({ id: 'q1' });
      prismaMock.question.findMany.mockResolvedValue([mockQuestion]);

      const request = createMockRequest(
        'http://localhost/api/questions/random',
        'POST',
        { 
          count: 1,
          trackUsage: false,
        }
      );
      await POST_RANDOM(request);

      // update should not be called for incrementing usage
      expect(prismaMock.question.update).not.toHaveBeenCalled();
    });
  });
});
