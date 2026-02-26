import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  prismaMock,
  createMockInterview,
  createMockFullResponse,
  createMockQuestion,
  resetMocks,
} from '@/lib/test-utils/prisma-mock';

// Mock db/interview module
const mockGetInterviewById = vi.fn();
vi.mock('@/lib/db/interview', () => ({
  getInterviewById: () => mockGetInterviewById(),
}));

// Mock agent-factory module
const mockExecuteInterviewAnalysis = vi.fn();
vi.mock('@/lib/agents/agent-factory', () => ({
  executeInterviewAnalysis: () => mockExecuteInterviewAnalysis(),
}));

// Mock prisma
vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

// Import route after mocking
import { POST } from '../route';

// Helper to create mock NextRequest
function createMockRequest(
  url: string,
  method: string = 'POST'
): NextRequest {
  const request = new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return request as NextRequest;
}

// Helper to create route context with params
function createRouteContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

describe('POST /api/interviews/[id]/analyze', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Basic Functionality Tests
  // ============================================================================

  describe('Functionality', () => {
    it('should return 404 for non-existent interview', async () => {
      mockGetInterviewById.mockResolvedValue(null);

      const request = createMockRequest('http://localhost/api/interviews/non-existent/analyze');
      const context = createRouteContext('non-existent');
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Interview not found');
    });

    it('should return 400 when interview has no responses', async () => {
      const mockInterview = createMockInterview({
        id: 'interview-123',
        responses: [],
      });
      mockGetInterviewById.mockResolvedValue(mockInterview);

      const request = createMockRequest('http://localhost/api/interviews/interview-123/analyze');
      const context = createRouteContext('interview-123');
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No responses to analyze');
    });

    it('should analyze all responses in interview', async () => {
      const mockResponses = [
        createMockFullResponse({ id: 'response-1' }),
        createMockFullResponse({ id: 'response-2' }),
      ];
      const mockInterview = createMockInterview({
        id: 'interview-123',
        responses: mockResponses,
      });
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockExecuteInterviewAnalysis.mockResolvedValue({
        interviewId: 'interview-123',
        totalResponses: 2,
        analyzedResponses: 2,
        agentExecutions: 10,
        totalProcessingTime: 5000,
        errors: [],
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/analyze');
      const context = createRouteContext('interview-123');
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return correct response structure', async () => {
      const mockInterview = createMockInterview({
        id: 'interview-123',
        responses: [createMockFullResponse()],
      });
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockExecuteInterviewAnalysis.mockResolvedValue({
        interviewId: 'interview-123',
        totalResponses: 1,
        analyzedResponses: 1,
        agentExecutions: 5,
        totalProcessingTime: 2500,
        errors: [],
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/analyze');
      const context = createRouteContext('interview-123');
      const response = await POST(request, context);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.interviewId).toBe('interview-123');
      expect(data.totalResponses).toBe(1);
      expect(data.analyzedResponses).toBe(1);
      expect(data.agentExecutions).toBe(5);
      expect(data.totalProcessingTime).toBe(2500);
    });

    it('should include errors in response when present', async () => {
      const mockInterview = createMockInterview({
        id: 'interview-123',
        responses: [createMockFullResponse()],
      });
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockExecuteInterviewAnalysis.mockResolvedValue({
        interviewId: 'interview-123',
        totalResponses: 1,
        analyzedResponses: 0,
        agentExecutions: 2,
        totalProcessingTime: 1000,
        errors: ['Agent ANALYZER failed', 'Agent TAGGER failed'],
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/analyze');
      const context = createRouteContext('interview-123');
      const response = await POST(request, context);
      const data = await response.json();

      expect(data.errors).toBeDefined();
      expect(data.errors).toHaveLength(2);
      expect(data.errors).toContain('Agent ANALYZER failed');
    });

    it('should not include errors field when empty', async () => {
      const mockInterview = createMockInterview({
        id: 'interview-123',
        responses: [createMockFullResponse()],
      });
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockExecuteInterviewAnalysis.mockResolvedValue({
        interviewId: 'interview-123',
        totalResponses: 1,
        analyzedResponses: 1,
        agentExecutions: 5,
        totalProcessingTime: 2500,
        errors: [],
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/analyze');
      const context = createRouteContext('interview-123');
      const response = await POST(request, context);
      const data = await response.json();

      expect(data.errors).toBeUndefined();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      mockGetInterviewById.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest('http://localhost/api/interviews/interview-123/analyze');
      const context = createRouteContext('interview-123');
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to analyze interview');
      expect(data.message).toBe('Database connection failed');
    });

    it('should return 500 on analysis failure', async () => {
      const mockInterview = createMockInterview({
        id: 'interview-123',
        responses: [createMockFullResponse()],
      });
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockExecuteInterviewAnalysis.mockRejectedValue(new Error('Analysis service unavailable'));

      const request = createMockRequest('http://localhost/api/interviews/interview-123/analyze');
      const context = createRouteContext('interview-123');
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to analyze interview');
      expect(data.message).toBe('Analysis service unavailable');
    });

    it('should handle unknown errors', async () => {
      mockGetInterviewById.mockRejectedValue('Unknown error type');

      const request = createMockRequest('http://localhost/api/interviews/interview-123/analyze');
      const context = createRouteContext('interview-123');
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Unknown error');
    });

    it('should log errors appropriately', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetInterviewById.mockRejectedValue(new Error('Test error'));

      const request = createMockRequest('http://localhost/api/interviews/interview-123/analyze');
      const context = createRouteContext('interview-123');
      await POST(request, context);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle interview with many responses', async () => {
      const mockResponses = Array.from({ length: 50 }, (_, i) =>
        createMockFullResponse({ id: `response-${i}` })
      );
      const mockInterview = createMockInterview({
        id: 'interview-123',
        responses: mockResponses,
      });
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockExecuteInterviewAnalysis.mockResolvedValue({
        interviewId: 'interview-123',
        totalResponses: 50,
        analyzedResponses: 50,
        agentExecutions: 250,
        totalProcessingTime: 60000,
        errors: [],
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/analyze');
      const context = createRouteContext('interview-123');
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalResponses).toBe(50);
    });

    it('should handle partial analysis success', async () => {
      const mockInterview = createMockInterview({
        id: 'interview-123',
        responses: [
          createMockFullResponse({ id: 'response-1' }),
          createMockFullResponse({ id: 'response-2' }),
        ],
      });
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockExecuteInterviewAnalysis.mockResolvedValue({
        interviewId: 'interview-123',
        totalResponses: 2,
        analyzedResponses: 1,
        agentExecutions: 5,
        totalProcessingTime: 3000,
        errors: ['Failed to analyze response-2'],
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/analyze');
      const context = createRouteContext('interview-123');
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.analyzedResponses).toBe(1);
      expect(data.errors).toContain('Failed to analyze response-2');
    });
  });
});
