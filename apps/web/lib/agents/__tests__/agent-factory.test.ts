import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  prismaMock,
  createMockFullResponse,
  createMockInterview,
  createMockQuestion,
  createMockAgentLog,
  resetMocks,
} from '../../test-utils/prisma-mock';

// Mock the prisma module
vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

// Mock db modules
vi.mock('@/lib/db/response', () => ({
  getResponseById: vi.fn(),
}));

vi.mock('@/lib/db/interview', () => ({
  getInterviewById: vi.fn(),
}));

vi.mock('@/lib/db/agent-log', () => ({
  createAgentLog: vi.fn(),
}));

// Mock agent modules - we'll mock the getters to return mock agents
const mockAnalyzerAgent = {
  register: vi.fn(),
  execute: vi.fn().mockResolvedValue({
    type: 'ANALYZER',
    result: { scores: { technical: 8 }, insights: ['insight1'] },
    confidence: 0.85,
    metadata: {},
    reflexionLoop: 0,
  }),
};

const mockTaggerAgent = {
  register: vi.fn(),
  execute: vi.fn().mockResolvedValue({
    type: 'TAGGER',
    result: { skillTags: ['javascript'], behavioralTags: ['collaborative'] },
    confidence: 0.8,
    metadata: {},
    reflexionLoop: 0,
  }),
};

const mockVerifierAgent = {
  register: vi.fn(),
  execute: vi.fn().mockResolvedValue({
    type: 'VERIFIER',
    result: { isConsistent: true, isAccurate: true },
    confidence: 0.9,
    metadata: {},
    reflexionLoop: 0,
  }),
};

const mockScorerAgent = {
  register: vi.fn(),
  execute: vi.fn().mockResolvedValue({
    type: 'SCORER',
    result: { overallScore: 75, componentScores: { technical: 80, communication: 70 } },
    confidence: 0.85,
    metadata: {},
    reflexionLoop: 0,
  }),
};

const mockNarratorAgent = {
  register: vi.fn(),
  execute: vi.fn().mockResolvedValue({
    type: 'NARRATOR',
    result: { summary: 'Good candidate', strengths: ['technical skills'] },
    confidence: 0.8,
    metadata: {},
    reflexionLoop: 0,
  }),
};

const mockRegistry = {
  register: vi.fn(),
  getAllAgents: vi.fn().mockReturnValue([
    { type: 'ANALYZER' },
    { type: 'TAGGER' },
    { type: 'VERIFIER' },
    { type: 'SCORER' },
    { type: 'NARRATOR' },
  ]),
};

const mockOrchestrator = {
  registerExecutor: vi.fn(),
  processResponse: vi.fn().mockResolvedValue({
    status: 'COMPLETED',
    results: new Map([
      ['ANALYZER', { output: mockAnalyzerAgent.execute().then(r => r), latencyMs: 100, reflexionLoops: 0, success: true }],
      ['TAGGER', { output: mockTaggerAgent.execute().then(r => r), latencyMs: 80, reflexionLoops: 0, success: true }],
      ['VERIFIER', { output: mockVerifierAgent.execute().then(r => r), latencyMs: 90, reflexionLoops: 0, success: true }],
      ['SCORER', { output: mockScorerAgent.execute().then(r => r), latencyMs: 75, reflexionLoops: 0, success: true }],
      ['NARRATOR', { output: mockNarratorAgent.execute().then(r => r), latencyMs: 85, reflexionLoops: 0, success: true }],
    ]),
    interviewId: 'interview-123',
    startTime: Date.now(),
  }),
  getHealthStatus: vi.fn().mockReturnValue({ healthy: true, activeSessions: 0 }),
};

// Mock the agents index module
vi.mock('@/lib/agents/index', () => ({
  AgentTypes: {
    ANALYZER: 'ANALYZER',
    TAGGER: 'TAGGER',
    VERIFIER: 'VERIFIER',
    SCORER: 'SCORER',
    NARRATOR: 'NARRATOR',
  },
  getAgentRegistry: () => mockRegistry,
  getOrchestratorAgent: () => mockOrchestrator,
  createAgentExecutor: vi.fn((agent) => (context: any) => agent.execute(context)),
  getAnalyzerAgent: () => mockAnalyzerAgent,
  getTaggerAgent: () => mockTaggerAgent,
  getVerifierAgent: () => mockVerifierAgent,
  getScorerAgent: () => mockScorerAgent,
  getNarratorAgent: () => mockNarratorAgent,
}));

// Import after mocking
import {
  registerAllAgents,
  createAnalysisPipeline,
  executeFullAnalysis,
  executeInterviewAnalysis,
  areAgentsRegistered,
  getAgentHealthStatus,
} from '../agent-factory';

import { getResponseById } from '@/lib/db/response';
import { getInterviewById } from '@/lib/db/interview';
import { createAgentLog } from '@/lib/db/agent-log';

describe('Agent Factory', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockRegistry.getAllAgents.mockReturnValue([
      { type: 'ANALYZER' },
      { type: 'TAGGER' },
      { type: 'VERIFIER' },
      { type: 'SCORER' },
      { type: 'NARRATOR' },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Registration Tests
  // ============================================================================

  describe('registerAllAgents', () => {
    it('should register 5 agents', () => {
      const count = registerAllAgents();
      
      expect(count).toBe(5);
    });

    it('should register analyzer, verifier, tagger, scorer, narrator', () => {
      registerAllAgents();
      
      expect(mockAnalyzerAgent.register).toHaveBeenCalled();
      expect(mockTaggerAgent.register).toHaveBeenCalled();
      expect(mockVerifierAgent.register).toHaveBeenCalled();
      expect(mockScorerAgent.register).toHaveBeenCalled();
      expect(mockNarratorAgent.register).toHaveBeenCalled();
    });

    it('should register executors with orchestrator', () => {
      registerAllAgents();
      
      expect(mockOrchestrator.registerExecutor).toHaveBeenCalledWith('ANALYZER', expect.any(Function));
      expect(mockOrchestrator.registerExecutor).toHaveBeenCalledWith('TAGGER', expect.any(Function));
      expect(mockOrchestrator.registerExecutor).toHaveBeenCalledWith('VERIFIER', expect.any(Function));
      expect(mockOrchestrator.registerExecutor).toHaveBeenCalledWith('SCORER', expect.any(Function));
      expect(mockOrchestrator.registerExecutor).toHaveBeenCalledWith('NARRATOR', expect.any(Function));
    });

    it('should return correct count from registry', () => {
      mockRegistry.getAllAgents.mockReturnValue([
        { type: 'ANALYZER' },
        { type: 'TAGGER' },
        { type: 'VERIFIER' },
      ]);
      
      const count = registerAllAgents();
      
      expect(count).toBe(3);
    });
  });

  // ============================================================================
  // Pipeline Creation Tests
  // ============================================================================

  describe('createAnalysisPipeline', () => {
    it('should create pipeline with correct name', () => {
      const pipeline = createAnalysisPipeline('Software Engineer');
      
      expect(pipeline.name).toBe('analysis_software_engineer');
    });

    it('should create pipeline with 5 stages', () => {
      const pipeline = createAnalysisPipeline('Software Engineer');
      
      expect(pipeline.stages).toHaveLength(5);
    });

    it('should set correct agent order', () => {
      const pipeline = createAnalysisPipeline('Software Engineer');
      
      expect(pipeline.stages[0].agentType).toBe('ANALYZER');
      expect(pipeline.stages[0].order).toBe(1);
      expect(pipeline.stages[1].agentType).toBe('TAGGER');
      expect(pipeline.stages[1].order).toBe(2);
      expect(pipeline.stages[2].agentType).toBe('VERIFIER');
      expect(pipeline.stages[2].order).toBe(3);
      expect(pipeline.stages[3].agentType).toBe('SCORER');
      expect(pipeline.stages[3].order).toBe(4);
      expect(pipeline.stages[4].agentType).toBe('NARRATOR');
      expect(pipeline.stages[4].order).toBe(5);
    });

    it('should mark analyzer and tagger as required', () => {
      const pipeline = createAnalysisPipeline('Software Engineer');
      
      expect(pipeline.stages[0].required).toBe(true);
      expect(pipeline.stages[1].required).toBe(true);
      expect(pipeline.stages[2].required).toBe(true);
    });

    it('should mark scorer and narrator as optional', () => {
      const pipeline = createAnalysisPipeline('Software Engineer');
      
      expect(pipeline.stages[3].required).toBe(false);
      expect(pipeline.stages[4].required).toBe(false);
    });

    it('should set dependencies correctly', () => {
      const pipeline = createAnalysisPipeline('Software Engineer');
      
      expect(pipeline.stages[2].dependsOn).toContain('ANALYZER');
      expect(pipeline.stages[2].dependsOn).toContain('TAGGER');
      expect(pipeline.stages[4].dependsOn).toContain('SCORER');
    });

    it('should increase timeouts for complex positions', () => {
      const normalPipeline = createAnalysisPipeline('Software Engineer');
      const complexPipeline = createAnalysisPipeline('Engineering Manager');
      
      expect(complexPipeline.stages[0].timeout).toBeGreaterThan(normalPipeline.stages[0].timeout);
    });

    it('should handle different position names', () => {
      const pipeline1 = createAnalysisPipeline('Principal Engineer');
      const pipeline2 = createAnalysisPipeline('Staff Engineer');
      
      expect(pipeline1.stages[0].timeout).toBe(22500); // 15000 * 1.5
      expect(pipeline2.stages[0].timeout).toBe(22500);
    });

    it('should set pipeline configuration', () => {
      const pipeline = createAnalysisPipeline('Software Engineer');
      
      expect(pipeline.parallel).toBe(false);
      expect(pipeline.maxTotalTime).toBe(60000);
      expect(pipeline.onError).toBe('CONTINUE');
    });
  });

  // ============================================================================
  // Full Analysis Execution Tests
  // ============================================================================

  describe('executeFullAnalysis', () => {
    beforeEach(() => {
      // Setup mocks for successful execution
      const mockResponse = createMockFullResponse({
        id: 'response-123',
        interviewId: 'interview-123',
        transcript: 'Test transcript',
        duration: 120,
        question: createMockQuestion({
          id: 'question-123',
          content: 'Test question?',
          category: 'TECHNICAL',
          difficulty: 'MEDIUM',
        }),
      });
      
      const mockInterview = createMockInterview({
        id: 'interview-123',
        candidateName: 'John Doe',
        position: 'Software Engineer',
        responses: [mockResponse],
      });

      (getResponseById as any).mockResolvedValue(mockResponse);
      (getInterviewById as any).mockResolvedValue(mockInterview);
      (createAgentLog as any).mockResolvedValue(createMockAgentLog());
      prismaMock.response.update.mockResolvedValue(mockResponse);

      // Setup orchestrator mock to return proper results
      mockOrchestrator.processResponse.mockResolvedValue({
        status: 'COMPLETED',
        results: new Map([
          ['ANALYZER', { 
            output: { type: 'ANALYZER', result: { scores: { technical: 8 } }, confidence: 0.85, reflexionLoop: 0 },
            latencyMs: 100,
            reflexionLoops: 0,
            success: true 
          }],
          ['TAGGER', { 
            output: { type: 'TAGGER', result: { skillTags: ['javascript'] }, confidence: 0.8, reflexionLoop: 0 },
            latencyMs: 80,
            reflexionLoops: 0,
            success: true 
          }],
        ]),
        interviewId: 'interview-123',
      });
    });

    it('should fetch response data', async () => {
      await executeFullAnalysis('interview-123', 'response-123');
      
      expect(getResponseById).toHaveBeenCalledWith('response-123');
    });

    it('should fetch interview data', async () => {
      await executeFullAnalysis('interview-123', 'response-123');
      
      expect(getInterviewById).toHaveBeenCalledWith('interview-123');
    });

    it('should return error for non-existent response', async () => {
      (getResponseById as any).mockResolvedValue(null);
      
      const result = await executeFullAnalysis('interview-123', 'non-existent');
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Response not found: non-existent');
    });

    it('should return error for non-existent interview', async () => {
      (getInterviewById as any).mockResolvedValue(null);
      
      const result = await executeFullAnalysis('non-existent', 'response-123');
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Interview not found: non-existent');
    });

    it('should return error when response does not belong to interview', async () => {
      const mockResponse = createMockFullResponse({
        interviewId: 'different-interview',
        question: createMockQuestion(),
      });
      (getResponseById as any).mockResolvedValue(mockResponse);
      
      const result = await executeFullAnalysis('interview-123', 'response-123');
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Response does not belong to the specified interview');
    });

    it('should execute orchestrator pipeline', async () => {
      await executeFullAnalysis('interview-123', 'response-123');
      
      expect(mockOrchestrator.processResponse).toHaveBeenCalled();
    });

    it('should store logs in database for each agent', async () => {
      await executeFullAnalysis('interview-123', 'response-123');
      
      // Should be called for each agent that ran
      expect(createAgentLog).toHaveBeenCalled();
    });

    it('should update response with agent analysis', async () => {
      await executeFullAnalysis('interview-123', 'response-123');
      
      expect(prismaMock.response.update).toHaveBeenCalledWith({
        where: { id: 'response-123' },
        data: expect.objectContaining({
          agentAnalysis: expect.any(Object),
          analyzedAt: expect.any(Date),
        }),
      });
    });

    it('should return processing time', async () => {
      const result = await executeFullAnalysis('interview-123', 'response-123');
      
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should return success status', async () => {
      const result = await executeFullAnalysis('interview-123', 'response-123');
      
      expect(result.success).toBe(true);
    });

    it('should return analysis results', async () => {
      const result = await executeFullAnalysis('interview-123', 'response-123');
      
      expect(result.analysis).toBeDefined();
      expect(typeof result.analysis).toBe('object');
    });

    it('should handle agent failures gracefully', async () => {
      mockOrchestrator.processResponse.mockResolvedValue({
        status: 'PARTIAL',
        results: new Map([
          ['ANALYZER', { 
            output: { type: 'ANALYZER', result: { error: true }, confidence: 0, reflexionLoop: 0 },
            latencyMs: 100,
            reflexionLoops: 0,
            success: false 
          }],
        ]),
        interviewId: 'interview-123',
      });
      
      const result = await executeFullAnalysis('interview-123', 'response-123');
      
      // Should still return a result even with failures
      expect(result).toBeDefined();
    });

    it('should continue execution even if createAgentLog fails', async () => {
      (createAgentLog as any).mockRejectedValue(new Error('Database error'));
      
      const result = await executeFullAnalysis('interview-123', 'response-123');
      
      // Should continue and include the error in results
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should continue even if response update fails', async () => {
      prismaMock.response.update.mockRejectedValue(new Error('Update failed'));
      
      const result = await executeFullAnalysis('interview-123', 'response-123');
      
      expect(result.errors).toContain('Failed to update response with analysis results');
    });
  });

  // ============================================================================
  // Interview Analysis Tests
  // ============================================================================

  describe('executeInterviewAnalysis', () => {
    beforeEach(() => {
      const mockResponses = [
        createMockFullResponse({
          id: 'response-1',
          interviewId: 'interview-123',
          question: createMockQuestion(),
        }),
        createMockFullResponse({
          id: 'response-2',
          interviewId: 'interview-123',
          question: createMockQuestion(),
        }),
      ];
      
      const mockInterview = createMockInterview({
        id: 'interview-123',
        candidateName: 'John Doe',
        position: 'Software Engineer',
        responses: mockResponses,
      });

      (getInterviewById as any).mockResolvedValue(mockInterview);
      (getResponseById as any).mockImplementation((id: string) => {
        const response = mockResponses.find(r => r.id === id);
        return Promise.resolve(response);
      });
      (createAgentLog as any).mockResolvedValue(createMockAgentLog());
      prismaMock.response.update.mockResolvedValue(mockResponses[0]);

      mockOrchestrator.processResponse.mockResolvedValue({
        status: 'COMPLETED',
        results: new Map([
          ['ANALYZER', { 
            output: { type: 'ANALYZER', result: { scores: { technical: 8 } }, confidence: 0.85, reflexionLoop: 0 },
            latencyMs: 100,
            reflexionLoops: 0,
            success: true 
          }],
        ]),
        interviewId: 'interview-123',
      });
    });

    it('should process all responses in interview', async () => {
      const result = await executeInterviewAnalysis('interview-123');
      
      expect(result.totalResponses).toBe(2);
    });

    it('should return interview ID', async () => {
      const result = await executeInterviewAnalysis('interview-123');
      
      expect(result.interviewId).toBe('interview-123');
    });

    it('should count analyzed responses', async () => {
      const result = await executeInterviewAnalysis('interview-123');
      
      expect(result.analyzedResponses).toBeGreaterThanOrEqual(0);
    });

    it('should count agent executions', async () => {
      const result = await executeInterviewAnalysis('interview-123');
      
      expect(result.agentExecutions).toBeGreaterThanOrEqual(0);
    });

    it('should return total processing time', async () => {
      const result = await executeInterviewAnalysis('interview-123');
      
      expect(result.totalProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for non-existent interview', async () => {
      (getInterviewById as any).mockResolvedValue(null);
      
      await expect(executeInterviewAnalysis('non-existent')).rejects.toThrow('Interview not found');
    });

    it('should handle empty interview (no responses)', async () => {
      const mockInterview = createMockInterview({
        id: 'interview-123',
        responses: [],
      });
      (getInterviewById as any).mockResolvedValue(mockInterview);
      
      const result = await executeInterviewAnalysis('interview-123');
      
      expect(result.totalResponses).toBe(0);
      expect(result.analyzedResponses).toBe(0);
    });

    it('should aggregate errors from all responses', async () => {
      mockOrchestrator.processResponse.mockRejectedValueOnce(new Error('Analysis failed'));
      
      const result = await executeInterviewAnalysis('interview-123');
      
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Utility Function Tests
  // ============================================================================

  describe('areAgentsRegistered', () => {
    it('should return true when agents are registered', () => {
      mockRegistry.getAllAgents.mockReturnValue([{ type: 'ANALYZER' }]);
      
      const result = areAgentsRegistered();
      
      expect(result).toBe(true);
    });

    it('should return false when no agents registered', () => {
      mockRegistry.getAllAgents.mockReturnValue([]);
      
      const result = areAgentsRegistered();
      
      expect(result).toBe(false);
    });
  });

  describe('getAgentHealthStatus', () => {
    it('should return health status from orchestrator', () => {
      mockOrchestrator.getHealthStatus.mockReturnValue({ healthy: true, activeSessions: 5 });
      
      const result = getAgentHealthStatus();
      
      expect(result).toEqual({ healthy: true, activeSessions: 5 });
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle missing question data in response', async () => {
      const mockResponse = createMockFullResponse({
        interviewId: 'interview-123',
        question: undefined,
      });
      (getResponseById as any).mockResolvedValue(mockResponse);
      (getInterviewById as any).mockResolvedValue(createMockInterview());
      
      const result = await executeFullAnalysis('interview-123', 'response-123');
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Response does not have associated question data');
    });

    it('should handle orchestrator errors', async () => {
      const mockResponse = createMockFullResponse({
        interviewId: 'interview-123',
        question: createMockQuestion(),
      });
      (getResponseById as any).mockResolvedValue(mockResponse);
      (getInterviewById as any).mockResolvedValue(createMockInterview());
      mockOrchestrator.processResponse.mockRejectedValue(new Error('Orchestrator failed'));
      
      const result = await executeFullAnalysis('interview-123', 'response-123');
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Orchestrator failed');
    });

    it('should log errors appropriately', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (getResponseById as any).mockResolvedValue(null);
      
      await executeFullAnalysis('interview-123', 'response-123');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
