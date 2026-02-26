import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  prismaMock,
  createMockInterview,
  createMockAgentLog,
  resetMocks,
} from '@/lib/test-utils/prisma-mock';

// Mock db/interview module
const mockGetInterviewById = vi.fn();
vi.mock('@/lib/db/interview', () => ({
  getInterviewById: () => mockGetInterviewById(),
}));

// Mock db/agent-log module
const mockGetAgentLogs = vi.fn();
const mockGetAgentLogsSummary = vi.fn();
vi.mock('@/lib/db/agent-log', () => ({
  getAgentLogs: () => mockGetAgentLogs(),
  getAgentLogsSummary: () => mockGetAgentLogsSummary(),
}));

// Mock prisma
vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

// Import route after mocking
import { GET } from '../route';

// Helper to create mock NextRequest
function createMockRequest(url: string): NextRequest {
  const request = new Request(url, {
    method: 'GET',
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

describe('GET /api/interviews/[id]/agent-analysis', () => {
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

      const request = createMockRequest('http://localhost/api/interviews/non-existent/agent-analysis');
      const context = createRouteContext('non-existent');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Interview not found');
    });

    it('should fetch agent logs for interview', async () => {
      const mockInterview = createMockInterview({ id: 'interview-123' });
      const mockLogs = [
        createMockAgentLog({ id: 'log-1', agentType: 'ANALYZER', responseId: 'response-1' }),
        createMockAgentLog({ id: 'log-2', agentType: 'TAGGER', responseId: 'response-1' }),
      ];
      
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockGetAgentLogs.mockResolvedValue(mockLogs);
      mockGetAgentLogsSummary.mockResolvedValue({
        totalExecutions: 2,
        avgConfidence: 0.85,
        topFindings: ['Finding 1'],
        byAgentType: { ANALYZER: 1, TAGGER: 1 },
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agentLogs).toHaveLength(2);
    });

    it('should return logs grouped by response', async () => {
      const mockInterview = createMockInterview({ id: 'interview-123' });
      const mockLogs = [
        createMockAgentLog({ id: 'log-1', agentType: 'ANALYZER', responseId: 'response-1' }),
        createMockAgentLog({ id: 'log-2', agentType: 'TAGGER', responseId: 'response-1' }),
        createMockAgentLog({ id: 'log-3', agentType: 'ANALYZER', responseId: 'response-2' }),
      ];
      
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockGetAgentLogs.mockResolvedValue(mockLogs);
      mockGetAgentLogsSummary.mockResolvedValue({
        totalExecutions: 3,
        avgConfidence: 0.85,
        topFindings: [],
        byAgentType: { ANALYZER: 2, TAGGER: 1 },
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(data.logsByResponse['response-1']).toBeDefined();
      expect(data.logsByResponse['response-2']).toBeDefined();
      expect(data.logsByResponse['response-1']).toHaveLength(2);
      expect(data.logsByResponse['response-2']).toHaveLength(1);
    });

    it('should return summary statistics', async () => {
      const mockInterview = createMockInterview({ id: 'interview-123' });
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockGetAgentLogs.mockResolvedValue([createMockAgentLog()]);
      mockGetAgentLogsSummary.mockResolvedValue({
        totalExecutions: 5,
        avgConfidence: 0.88,
        topFindings: ['Finding 1', 'Finding 2'],
        byAgentType: { ANALYZER: 2, TAGGER: 2, SCORER: 1 },
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(data.summary).toBeDefined();
      expect(data.summary.totalExecutions).toBe(5);
      expect(data.summary.avgConfidence).toBe(0.88);
      expect(data.summary.topFindings).toHaveLength(2);
      expect(data.summary.byAgentType).toEqual({ ANALYZER: 2, TAGGER: 2, SCORER: 1 });
    });

    it('should return correct response structure', async () => {
      const mockInterview = createMockInterview({ id: 'interview-123' });
      const mockLogs = [
        createMockAgentLog({
          id: 'log-1',
          agentType: 'ANALYZER',
          responseId: 'response-1',
          action: 'analyze',
          findings: { key: 'value' },
          confidence: 0.85,
          processingTime: 1500,
          tokensUsed: 250,
          reflexionLoop: 0,
        }),
      ];
      
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockGetAgentLogs.mockResolvedValue(mockLogs);
      mockGetAgentLogsSummary.mockResolvedValue({
        totalExecutions: 1,
        avgConfidence: 0.85,
        topFindings: [],
        byAgentType: { ANALYZER: 1 },
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(data.interviewId).toBe('interview-123');
      expect(data.agentLogs).toBeDefined();
      expect(data.logsByResponse).toBeDefined();
      expect(data.summary).toBeDefined();

      // Check log structure
      const log = data.agentLogs[0];
      expect(log.id).toBe('log-1');
      expect(log.agentType).toBe('ANALYZER');
      expect(log.responseId).toBe('response-1');
      expect(log.action).toBe('analyze');
      expect(log.findings).toEqual({ key: 'value' });
      expect(log.confidence).toBe(0.85);
      expect(log.processingTime).toBe(1500);
      expect(log.tokensUsed).toBe(250);
      expect(log.reflexionLoop).toBe(0);
    });

    it('should handle empty logs gracefully', async () => {
      const mockInterview = createMockInterview({ id: 'interview-123' });
      
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockGetAgentLogs.mockResolvedValue([]);
      mockGetAgentLogsSummary.mockResolvedValue({
        totalExecutions: 0,
        avgConfidence: 0,
        topFindings: [],
        byAgentType: {},
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agentLogs).toEqual([]);
      expect(data.logsByResponse).toEqual({});
      expect(data.summary.totalExecutions).toBe(0);
    });

    it('should calculate avgConfidence correctly', async () => {
      const mockInterview = createMockInterview({ id: 'interview-123' });
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockGetAgentLogs.mockResolvedValue([
        createMockAgentLog({ confidence: 0.8 }),
        createMockAgentLog({ confidence: 0.9 }),
      ]);
      mockGetAgentLogsSummary.mockResolvedValue({
        totalExecutions: 2,
        avgConfidence: 0.85,
        topFindings: [],
        byAgentType: {},
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(data.summary.avgConfidence).toBe(0.85);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      mockGetInterviewById.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch agent analysis');
      expect(data.message).toBe('Database connection failed');
    });

    it('should return 500 on agent logs fetch error', async () => {
      const mockInterview = createMockInterview({ id: 'interview-123' });
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockGetAgentLogs.mockRejectedValue(new Error('Failed to fetch logs'));

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch agent analysis');
    });

    it('should handle unknown errors', async () => {
      mockGetInterviewById.mockRejectedValue('Unknown error');

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Unknown error');
    });

    it('should log errors appropriately', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetInterviewById.mockRejectedValue(new Error('Test error'));

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      await GET(request, context);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle logs without responseId', async () => {
      const mockInterview = createMockInterview({ id: 'interview-123' });
      const mockLogs = [
        createMockAgentLog({ id: 'log-1', responseId: null }),
      ];
      
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockGetAgentLogs.mockResolvedValue(mockLogs);
      mockGetAgentLogsSummary.mockResolvedValue({
        totalExecutions: 1,
        avgConfidence: 0.85,
        topFindings: [],
        byAgentType: {},
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.logsByResponse['unknown']).toBeDefined();
    });

    it('should handle many logs efficiently', async () => {
      const mockInterview = createMockInterview({ id: 'interview-123' });
      const mockLogs = Array.from({ length: 100 }, (_, i) =>
        createMockAgentLog({ id: `log-${i}`, responseId: `response-${i % 10}` })
      );
      
      mockGetInterviewById.mockResolvedValue(mockInterview);
      mockGetAgentLogs.mockResolvedValue(mockLogs);
      mockGetAgentLogsSummary.mockResolvedValue({
        totalExecutions: 100,
        avgConfidence: 0.85,
        topFindings: [],
        byAgentType: {},
      });

      const request = createMockRequest('http://localhost/api/interviews/interview-123/agent-analysis');
      const context = createRouteContext('interview-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agentLogs).toHaveLength(100);
    });
  });
});
