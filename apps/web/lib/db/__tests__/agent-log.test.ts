import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  prismaMock,
  createMockAgentLog,
  createMockInterview,
  resetMocks,
} from '../../test-utils/prisma-mock';

// Mock the prisma module
vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

// Import after mocking
import {
  createAgentLog,
  getAgentLogs,
  getResponseAgentLogs,
  getResponseAgentLogsGrouped,
  getAgentMetrics,
  getAgentLogsSummary,
  getLatestAgentLog,
  deleteAgentLogs,
  CreateAgentLogSchema,
  AgentMetricsQuerySchema,
} from '../agent-log';

describe('Agent Log Database Utilities', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Schema Validation Tests
  // ============================================================================

  describe('CreateAgentLogSchema', () => {
    it('should validate correct agent log data', () => {
      const data = {
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
        action: 'analyze',
        input: { context: {} },
        output: { result: {} },
      };
      expect(() => CreateAgentLogSchema.parse(data)).not.toThrow();
    });

    it('should validate data with optional fields', () => {
      const data = {
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
        findings: { key: 'value' },
        confidence: 0.85,
        processingTime: 1500,
        tokensUsed: 250,
        action: 'analyze',
        performanceScore: 0.9,
      };
      expect(() => CreateAgentLogSchema.parse(data)).not.toThrow();
    });

    it('should reject empty interview ID', () => {
      const data = {
        interviewId: '',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
      };
      expect(() => CreateAgentLogSchema.parse(data)).toThrow();
    });

    it('should reject empty response ID', () => {
      const data = {
        interviewId: 'interview-123',
        responseId: '',
        agentType: 'ANALYZER' as const,
      };
      expect(() => CreateAgentLogSchema.parse(data)).toThrow();
    });

    it('should reject invalid agentType', () => {
      const data = {
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'INVALID_AGENT',
      };
      expect(() => CreateAgentLogSchema.parse(data)).toThrow();
    });

    it('should accept all valid agent types', () => {
      const agentTypes = ['ANALYZER', 'VERIFIER', 'PLANNER', 'CONDUCTOR', 'TAGGER', 'SCORER', 'NARRATOR'] as const;
      
      for (const agentType of agentTypes) {
        const data = {
          interviewId: 'interview-123',
          responseId: 'response-123',
          agentType,
        };
        expect(() => CreateAgentLogSchema.parse(data)).not.toThrow();
      }
    });

    it('should reject confidence out of range', () => {
      expect(() => CreateAgentLogSchema.parse({
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
        confidence: 1.5,
      })).toThrow();

      expect(() => CreateAgentLogSchema.parse({
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
        confidence: -0.5,
      })).toThrow();
    });

    it('should reject negative processing time', () => {
      const data = {
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
        processingTime: -100,
      };
      expect(() => CreateAgentLogSchema.parse(data)).toThrow();
    });

    it('should reject negative tokens used', () => {
      const data = {
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
        tokensUsed: -50,
      };
      expect(() => CreateAgentLogSchema.parse(data)).toThrow();
    });

    it('should provide defaults for action, input, output, reflexionLoop', () => {
      const data = {
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
      };
      const parsed = CreateAgentLogSchema.parse(data);
      expect(parsed.action).toBe('analyze');
      expect(parsed.input).toEqual({});
      expect(parsed.output).toEqual({});
      expect(parsed.reflexionLoop).toBe(0);
    });
  });

  describe('AgentMetricsQuerySchema', () => {
    it('should validate empty query', () => {
      expect(() => AgentMetricsQuerySchema.parse({})).not.toThrow();
    });

    it('should validate query with agentType', () => {
      const data = { agentType: 'ANALYZER' as const };
      expect(() => AgentMetricsQuerySchema.parse(data)).not.toThrow();
    });

    it('should validate query with date range', () => {
      const data = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };
      expect(() => AgentMetricsQuerySchema.parse(data)).not.toThrow();
    });

    it('should reject invalid agentType', () => {
      const data = { agentType: 'INVALID' };
      expect(() => AgentMetricsQuerySchema.parse(data)).toThrow();
    });
  });

  // ============================================================================
  // CRUD Operations Tests
  // ============================================================================

  describe('createAgentLog', () => {
    it('should create an agent log with valid data', async () => {
      const mockLog = createMockAgentLog();
      prismaMock.agentLog.create.mockResolvedValue(mockLog);

      const input = {
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
        action: 'analyze',
        input: {},
        output: {},
      };

      const result = await createAgentLog(input);

      expect(prismaMock.agentLog.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockLog);
    });

    it('should create agent log with all optional fields', async () => {
      const mockLog = createMockAgentLog({
        confidence: 0.85,
        processingTime: 1500,
        tokensUsed: 250,
        findings: { insights: ['test insight'] },
        performanceScore: 0.9,
      });
      prismaMock.agentLog.create.mockResolvedValue(mockLog);

      const input = {
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
        action: 'analyze',
        input: { context: {} },
        output: { result: {} },
        findings: { insights: ['test insight'] },
        confidence: 0.85,
        processingTime: 1500,
        tokensUsed: 250,
        performanceScore: 0.9,
      };

      const result = await createAgentLog(input);

      expect(result.confidence).toBe(0.85);
      expect(result.processingTime).toBe(1500);
      expect(result.tokensUsed).toBe(250);
    });

    it('should throw error for invalid data', async () => {
      const input = {
        interviewId: '',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
      };

      await expect(createAgentLog(input)).rejects.toThrow();
    });

    it('should throw error for invalid agent type', async () => {
      const input = {
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'INVALID' as any,
      };

      await expect(createAgentLog(input)).rejects.toThrow();
    });
  });

  describe('getAgentLogs', () => {
    it('should return logs for interview ordered by createdAt', async () => {
      const mockLogs = [
        createMockAgentLog({
          id: 'log-1',
          agentType: 'ANALYZER',
          createdAt: new Date('2024-01-01T10:00:00'),
        }),
        createMockAgentLog({
          id: 'log-2',
          agentType: 'TAGGER',
          createdAt: new Date('2024-01-01T11:00:00'),
        }),
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAgentLogs('interview-123');

      expect(prismaMock.agentLog.findMany).toHaveBeenCalledWith({
        where: { interviewId: 'interview-123' },
        orderBy: { createdAt: 'asc' },
        include: {
          interview: {
            select: {
              id: true,
              candidateName: true,
              position: true,
            },
          },
        },
      });
      expect(result).toEqual(mockLogs);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for non-existent interview', async () => {
      prismaMock.agentLog.findMany.mockResolvedValue([]);

      const result = await getAgentLogs('non-existent');

      expect(result).toEqual([]);
    });

    it('should include interview details in logs', async () => {
      const mockInterview = createMockInterview({
        id: 'interview-123',
        candidateName: 'John Doe',
        position: 'Software Engineer',
      });
      const mockLogs = [
        createMockAgentLog({
          id: 'log-1',
          interview: mockInterview,
        }),
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAgentLogs('interview-123');

      expect(result[0].interview).toBeDefined();
    });
  });

  describe('getResponseAgentLogs', () => {
    it('should return logs grouped by agentType', async () => {
      const mockLogs = [
        createMockAgentLog({ id: 'log-1', agentType: 'ANALYZER' }),
        createMockAgentLog({ id: 'log-2', agentType: 'ANALYZER' }),
        createMockAgentLog({ id: 'log-3', agentType: 'TAGGER' }),
        createMockAgentLog({ id: 'log-4', agentType: 'SCORER' }),
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getResponseAgentLogs('response-123');

      expect(result instanceof Map).toBe(true);
      expect(result.get('ANALYZER')).toHaveLength(2);
      expect(result.get('TAGGER')).toHaveLength(1);
      expect(result.get('SCORER')).toHaveLength(1);
    });

    it('should return empty map for response with no logs', async () => {
      prismaMock.agentLog.findMany.mockResolvedValue([]);

      const result = await getResponseAgentLogs('response-123');

      expect(result instanceof Map).toBe(true);
      expect(result.size).toBe(0);
    });
  });

  describe('getResponseAgentLogsGrouped', () => {
    it('should return logs as plain object grouped by agentType', async () => {
      const mockLogs = [
        createMockAgentLog({ id: 'log-1', agentType: 'ANALYZER' }),
        createMockAgentLog({ id: 'log-2', agentType: 'TAGGER' }),
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getResponseAgentLogsGrouped('response-123');

      expect(typeof result).toBe('object');
      expect(result.ANALYZER).toBeDefined();
      expect(result.TAGGER).toBeDefined();
      expect(result.ANALYZER).toHaveLength(1);
      expect(result.TAGGER).toHaveLength(1);
    });

    it('should return empty object for response with no logs', async () => {
      prismaMock.agentLog.findMany.mockResolvedValue([]);

      const result = await getResponseAgentLogsGrouped('response-123');

      expect(result).toEqual({});
    });
  });

  // ============================================================================
  // Metrics Tests
  // ============================================================================

  describe('getAgentMetrics', () => {
    it('should calculate average confidence correctly', async () => {
      const mockLogs = [
        { confidence: 0.8, processingTime: 1000, tokensUsed: 200, performanceScore: 0.9 },
        { confidence: 0.9, processingTime: 1200, tokensUsed: 250, performanceScore: 0.8 },
        { confidence: 0.7, processingTime: 800, tokensUsed: 180, performanceScore: 0.7 },
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAgentMetrics({ agentType: 'ANALYZER' });

      expect(result).toHaveLength(1);
      expect(result[0].avgConfidence).toBeCloseTo(0.8, 2);
    });

    it('should calculate average processing time correctly', async () => {
      const mockLogs = [
        { confidence: 0.8, processingTime: 1000, tokensUsed: 200, performanceScore: 0.9 },
        { confidence: 0.9, processingTime: 2000, tokensUsed: 250, performanceScore: 0.8 },
        { confidence: 0.7, processingTime: 3000, tokensUsed: 180, performanceScore: 0.7 },
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAgentMetrics({ agentType: 'ANALYZER' });

      expect(result[0].avgProcessingTime).toBe(2000);
    });

    it('should calculate average tokens used correctly', async () => {
      const mockLogs = [
        { confidence: 0.8, processingTime: 1000, tokensUsed: 100, performanceScore: 0.9 },
        { confidence: 0.9, processingTime: 2000, tokensUsed: 200, performanceScore: 0.8 },
        { confidence: 0.7, processingTime: 3000, tokensUsed: 300, performanceScore: 0.7 },
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAgentMetrics({ agentType: 'ANALYZER' });

      expect(result[0].avgTokensUsed).toBe(200);
    });

    it('should count total executions correctly', async () => {
      const mockLogs = [
        { confidence: 0.8, processingTime: 1000, tokensUsed: 200, performanceScore: 0.9 },
        { confidence: 0.9, processingTime: 2000, tokensUsed: 250, performanceScore: 0.8 },
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAgentMetrics({ agentType: 'ANALYZER' });

      expect(result[0].totalExecutions).toBe(2);
    });

    it('should calculate success rate correctly', async () => {
      const mockLogs = [
        { confidence: 0.8, processingTime: 1000, tokensUsed: 200, performanceScore: 0.9 }, // success
        { confidence: 0.9, processingTime: 2000, tokensUsed: 250, performanceScore: 0.3 }, // failure
        { confidence: 0.7, processingTime: 3000, tokensUsed: 180, performanceScore: 0.6 }, // success
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAgentMetrics({ agentType: 'ANALYZER' });

      expect(result[0].successRate).toBeCloseTo(0.667, 2);
    });

    it('should return empty array for empty database', async () => {
      prismaMock.agentLog.findMany.mockResolvedValue([]);

      const result = await getAgentMetrics();

      expect(result).toEqual([]);
    });

    it('should return metrics for all agent types when no filter provided', async () => {
      // Return logs only for ANALYZER for simplicity
      prismaMock.agentLog.findMany
        .mockResolvedValueOnce([{ confidence: 0.8, processingTime: 1000, tokensUsed: 200, performanceScore: 0.9 }])
        .mockResolvedValueOnce([]) // VERIFIER
        .mockResolvedValueOnce([]) // PLANNER
        .mockResolvedValueOnce([]) // CONDUCTOR
        .mockResolvedValueOnce([]) // TAGGER
        .mockResolvedValueOnce([]) // SCORER
        .mockResolvedValueOnce([]); // NARRATOR

      const result = await getAgentMetrics();

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].agentType).toBe('ANALYZER');
    });

    it('should handle null values in metrics calculation', async () => {
      const mockLogs = [
        { confidence: null, processingTime: null, tokensUsed: null, performanceScore: null },
        { confidence: 0.8, processingTime: 1000, tokensUsed: 200, performanceScore: 0.9 },
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAgentMetrics({ agentType: 'ANALYZER' });

      expect(result[0].avgConfidence).toBe(0.8);
      expect(result[0].avgProcessingTime).toBe(1000);
      expect(result[0].avgTokensUsed).toBe(200);
      expect(result[0].totalExecutions).toBe(2);
    });

    it('should filter by date range', async () => {
      const mockLogs = [
        { confidence: 0.8, processingTime: 1000, tokensUsed: 200, performanceScore: 0.9 },
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      await getAgentMetrics({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(prismaMock.agentLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-12-31'),
            },
          }),
        })
      );
    });
  });

  // ============================================================================
  // Summary Tests
  // ============================================================================

  describe('getAgentLogsSummary', () => {
    it('should return correct summary for interview', async () => {
      const mockLogs = [
        createMockAgentLog({ id: 'log-1', agentType: 'ANALYZER', confidence: 0.8, findings: { insights: ['insight1', 'insight2'] } }),
        createMockAgentLog({ id: 'log-2', agentType: 'TAGGER', confidence: 0.9, findings: { summary: 'summary text' } }),
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAgentLogsSummary('interview-123');

      expect(result.totalExecutions).toBe(2);
      expect(result.avgConfidence).toBeCloseTo(0.85, 2);
      expect(result.byAgentType.ANALYZER).toBe(1);
      expect(result.byAgentType.TAGGER).toBe(1);
    });

    it('should extract top findings', async () => {
      const mockLogs = [
        createMockAgentLog({ findings: { insights: ['insight1', 'insight2', 'insight3'] } }),
        createMockAgentLog({ findings: { summary: 'summary text' } }),
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAgentLogsSummary('interview-123');

      expect(result.topFindings.length).toBeGreaterThan(0);
      expect(result.topFindings.length).toBeLessThanOrEqual(5);
    });

    it('should return empty summary for empty logs', async () => {
      prismaMock.agentLog.findMany.mockResolvedValue([]);

      const result = await getAgentLogsSummary('interview-123');

      expect(result).toEqual({
        totalExecutions: 0,
        avgConfidence: 0,
        topFindings: [],
        byAgentType: {},
      });
    });

    it('should handle null confidence values', async () => {
      const mockLogs = [
        createMockAgentLog({ id: 'log-1', confidence: null }),
        createMockAgentLog({ id: 'log-2', confidence: 0.8 }),
      ];
      prismaMock.agentLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAgentLogsSummary('interview-123');

      expect(result.avgConfidence).toBe(0.8);
    });
  });

  // ============================================================================
  // Utility Function Tests
  // ============================================================================

  describe('getLatestAgentLog', () => {
    it('should return latest log for response and agent type', async () => {
      const mockLog = createMockAgentLog({
        id: 'latest-log',
        agentType: 'ANALYZER',
        createdAt: new Date('2024-01-02'),
      });
      prismaMock.agentLog.findFirst.mockResolvedValue(mockLog);

      const result = await getLatestAgentLog('response-123', 'ANALYZER');

      expect(prismaMock.agentLog.findFirst).toHaveBeenCalledWith({
        where: {
          responseId: 'response-123',
          agentType: 'ANALYZER',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockLog);
    });

    it('should return null when no log exists', async () => {
      prismaMock.agentLog.findFirst.mockResolvedValue(null);

      const result = await getLatestAgentLog('response-123', 'ANALYZER');

      expect(result).toBeNull();
    });
  });

  describe('deleteAgentLogs', () => {
    it('should delete all logs for an interview', async () => {
      prismaMock.agentLog.deleteMany.mockResolvedValue({ count: 5 });

      const result = await deleteAgentLogs('interview-123');

      expect(prismaMock.agentLog.deleteMany).toHaveBeenCalledWith({
        where: { interviewId: 'interview-123' },
      });
      expect(result).toBe(5);
    });

    it('should return 0 when no logs to delete', async () => {
      prismaMock.agentLog.deleteMany.mockResolvedValue({ count: 0 });

      const result = await deleteAgentLogs('non-existent');

      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle concurrent log creation', async () => {
      const mockLog = createMockAgentLog();
      prismaMock.agentLog.create.mockResolvedValue(mockLog);

      const promises = Array(5).fill(null).map(() => 
        createAgentLog({
          interviewId: 'interview-123',
          responseId: 'response-123',
          agentType: 'ANALYZER' as const,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(prismaMock.agentLog.create).toHaveBeenCalledTimes(5);
    });

    it('should handle special characters in findings', async () => {
      const mockLog = createMockAgentLog({
        findings: { 
          insights: ['Quote: "test"', "Unicode: 日本語", "Special: <>&'"],
          summary: 'Contains "quotes" and <special> chars'
        },
      });
      prismaMock.agentLog.create.mockResolvedValue(mockLog);

      const result = await createAgentLog({
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
        findings: mockLog.findings as Record<string, unknown>,
      });

      expect(result.findings).toEqual(mockLog.findings);
    });

    it('should handle very large findings object', async () => {
      const largeFindings = {
        insights: Array(100).fill('insight'),
        data: Array(1000).fill({ key: 'value' }),
      };
      const mockLog = createMockAgentLog({ findings: largeFindings });
      prismaMock.agentLog.create.mockResolvedValue(mockLog);

      const result = await createAgentLog({
        interviewId: 'interview-123',
        responseId: 'response-123',
        agentType: 'ANALYZER' as const,
        findings: largeFindings,
      });

      expect(result).toBeDefined();
    });
  });
});
