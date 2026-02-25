import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  prismaMock,
  createMockFullResponse,
  createMockAgentLog,
  resetMocks,
} from '@/lib/test-utils/prisma-mock';

// Mock db/response module
const mockGetResponseById = vi.fn();
vi.mock('@/lib/db/response', () => ({
  getResponseById: () => mockGetResponseById(),
}));

// Mock db/agent-log module
const mockGetResponseAgentLogsGrouped = vi.fn();
vi.mock('@/lib/db/agent-log', () => ({
  getResponseAgentLogsGrouped: () => mockGetResponseAgentLogsGrouped(),
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

describe('GET /api/responses/[id]/agent-analysis', () => {
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
    it('should return 404 for non-existent response', async () => {
      mockGetResponseById.mockResolvedValue(null);

      const request = createMockRequest('http://localhost/api/responses/non-existent/agent-analysis');
      const context = createRouteContext('non-existent');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Response not found');
    });

    it('should fetch agent logs for response', async () => {
      const mockResponse = createMockFullResponse({ id: 'response-123', interviewId: 'interview-123' });
      const mockLogs = {
        ANALYZER: [createMockAgentLog({ id: 'log-1', agentType: 'ANALYZER' })],
        TAGGER: [createMockAgentLog({ id: 'log-2', agentType: 'TAGGER' })],
      };
      
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue(mockLogs);

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agentLogs).toBeDefined();
    });

    it('should group findings by agent type', async () => {
      const mockResponse = createMockFullResponse({ id: 'response-123' });
      const mockLogs = {
        ANALYZER: [createMockAgentLog({
          id: 'log-1',
          agentType: 'ANALYZER',
          findings: { scores: { technical: 8 } },
          confidence: 0.85,
          processingTime: 1500,
        })],
        TAGGER: [createMockAgentLog({
          id: 'log-2',
          agentType: 'TAGGER',
          findings: { skillTags: ['javascript'] },
          confidence: 0.8,
          processingTime: 800,
        })],
      };
      
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue(mockLogs);

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(data.findings.analyzer).toBeDefined();
      expect(data.findings.tagger).toBeDefined();
      expect(data.findings.analyzer.findings).toEqual({ scores: { technical: 8 } });
      expect(data.findings.tagger.findings).toEqual({ skillTags: ['javascript'] });
    });

    it('should return all 5 agent types in findings', async () => {
      const mockResponse = createMockFullResponse({ id: 'response-123' });
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue({
        ANALYZER: [createMockAgentLog({ agentType: 'ANALYZER' })],
        VERIFIER: [createMockAgentLog({ agentType: 'VERIFIER' })],
        TAGGER: [createMockAgentLog({ agentType: 'TAGGER' })],
        SCORER: [createMockAgentLog({ agentType: 'SCORER' })],
        NARRATOR: [createMockAgentLog({ agentType: 'NARRATOR' })],
      });

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(data.findings).toHaveProperty('analyzer');
      expect(data.findings).toHaveProperty('verifier');
      expect(data.findings).toHaveProperty('tagger');
      expect(data.findings).toHaveProperty('scorer');
      expect(data.findings).toHaveProperty('narrator');
    });

    it('should return null for missing agent types', async () => {
      const mockResponse = createMockFullResponse({ id: 'response-123' });
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue({
        ANALYZER: [createMockAgentLog({ agentType: 'ANALYZER' })],
      });

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(data.findings.analyzer).not.toBeNull();
      expect(data.findings.verifier).toBeNull();
      expect(data.findings.tagger).toBeNull();
      expect(data.findings.scorer).toBeNull();
      expect(data.findings.narrator).toBeNull();
    });

    it('should return correct response structure', async () => {
      const mockResponse = createMockFullResponse({
        id: 'response-123',
        interviewId: 'interview-123',
        agentAnalysis: { analyzer: { scores: {} } },
        analyzedAt: new Date('2024-01-01'),
      } as any);
      const mockLogs = {
        ANALYZER: [createMockAgentLog({
          id: 'log-1',
          agentType: 'ANALYZER',
          action: 'analyze',
          findings: { key: 'value' },
          confidence: 0.85,
          processingTime: 1500,
          tokensUsed: 250,
          reflexionLoop: 0,
        })],
      };
      
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue(mockLogs);

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(data.responseId).toBe('response-123');
      expect(data.interviewId).toBe('interview-123');
      expect(data.agentLogs).toBeDefined();
      expect(data.findings).toBeDefined();
      expect(data.agentAnalysis).toBeDefined();
      expect(data.analyzedAt).toBeDefined();

      // Check log structure
      const log = data.agentLogs[0];
      expect(log.id).toBe('log-1');
      expect(log.agentType).toBe('ANALYZER');
      expect(log.action).toBe('analyze');
      expect(log.findings).toEqual({ key: 'value' });
      expect(log.confidence).toBe(0.85);
      expect(log.processingTime).toBe(1500);
      expect(log.tokensUsed).toBe(250);
      expect(log.reflexionLoop).toBe(0);
    });

    it('should handle missing logs gracefully', async () => {
      const mockResponse = createMockFullResponse({ id: 'response-123' });
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue({});

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agentLogs).toEqual([]);
      expect(data.findings.analyzer).toBeNull();
      expect(data.findings.verifier).toBeNull();
      expect(data.findings.tagger).toBeNull();
      expect(data.findings.scorer).toBeNull();
      expect(data.findings.narrator).toBeNull();
    });

    it('should include stored agentAnalysis from response', async () => {
      const storedAnalysis = {
        analyzer: { scores: { technical: 8 } },
        tagger: { skillTags: ['javascript'] },
      };
      const mockResponse = createMockFullResponse({
        id: 'response-123',
        agentAnalysis: storedAnalysis,
      } as any);
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue({});

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(data.agentAnalysis).toEqual(storedAnalysis);
    });

    it('should return null for agentAnalysis when not present', async () => {
      const mockResponse = createMockFullResponse({ id: 'response-123' });
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue({});

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(data.agentAnalysis).toBeNull();
    });

    it('should use latest log when multiple logs exist for an agent type', async () => {
      const mockResponse = createMockFullResponse({ id: 'response-123' });
      const mockLogs = {
        ANALYZER: [
          createMockAgentLog({
            id: 'log-1',
            agentType: 'ANALYZER',
            findings: { old: true },
            confidence: 0.7,
            createdAt: new Date('2024-01-01'),
          }),
          createMockAgentLog({
            id: 'log-2',
            agentType: 'ANALYZER',
            findings: { latest: true },
            confidence: 0.9,
            createdAt: new Date('2024-01-02'),
          }),
        ],
      };
      
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue(mockLogs);

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      // Should use the last log in the array (latest)
      expect(data.findings.analyzer.findings).toEqual({ latest: true });
      expect(data.findings.analyzer.confidence).toBe(0.9);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      mockGetResponseById.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch response agent analysis');
      expect(data.message).toBe('Database connection failed');
    });

    it('should return 500 on agent logs fetch error', async () => {
      const mockResponse = createMockFullResponse({ id: 'response-123' });
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockRejectedValue(new Error('Failed to fetch logs'));

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch response agent analysis');
    });

    it('should handle unknown errors', async () => {
      mockGetResponseById.mockRejectedValue('Unknown error');

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Unknown error');
    });

    it('should log errors appropriately', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetResponseById.mockRejectedValue(new Error('Test error'));

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      await GET(request, context);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle response with no interviewId', async () => {
      const mockResponse = createMockFullResponse({
        id: 'response-123',
        interviewId: '',
      });
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue({});

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.interviewId).toBe('');
    });

    it('should handle many logs for a single response', async () => {
      const mockResponse = createMockFullResponse({ id: 'response-123' });
      const mockLogs = {
        ANALYZER: Array.from({ length: 20 }, (_, i) =>
          createMockAgentLog({ id: `log-analyzer-${i}`, agentType: 'ANALYZER' })
        ),
        TAGGER: Array.from({ length: 15 }, (_, i) =>
          createMockAgentLog({ id: `log-tagger-${i}`, agentType: 'TAGGER' })
        ),
      };
      
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue(mockLogs);

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agentLogs).toHaveLength(35);
    });

    it('should handle large findings object', async () => {
      const largeFindings = {
        insights: Array(100).fill('insight'),
        data: Array(500).fill({ key: 'value' }),
      };
      const mockResponse = createMockFullResponse({ id: 'response-123' });
      const mockLogs = {
        ANALYZER: [createMockAgentLog({
          agentType: 'ANALYZER',
          findings: largeFindings,
        })],
      };
      
      mockGetResponseById.mockResolvedValue(mockResponse);
      mockGetResponseAgentLogsGrouped.mockResolvedValue(mockLogs);

      const request = createMockRequest('http://localhost/api/responses/response-123/agent-analysis');
      const context = createRouteContext('response-123');
      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.findings.analyzer.findings).toEqual(largeFindings);
    });
  });
});
