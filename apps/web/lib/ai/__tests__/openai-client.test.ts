import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the environment before importing the module
vi.mock('@/lib/ai/env', () => ({
  aiEnv: {
    OPENAI_API_KEY: 'test-api-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_MAX_TOKENS: 500,
    isConfigured: true,
  },
  isOpenAIConfigured: () => true,
}));

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

// Import after mocks
import {
  analyzeResponse,
  generateExplainability,
  calculateOverallScore,
} from '../openai-client';

describe('OpenAI Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // analyzeResponse Tests
  // ============================================================================

  describe('analyzeResponse', () => {
    it('should return analysis with valid scores', async () => {
      const mockResponse = {
        scores: {
          technical: 8.5,
          problemSolving: 7.5,
          communication: 8.0,
          cultureFit: 7.0,
        },
        sentiment: 0.6,
        confidence: 0.85,
        strengths: ['Clear explanation', 'Good problem solving'],
        weaknesses: ['Could improve depth'],
        summary: 'Strong technical candidate.',
      };

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mockResponse),
            },
          },
        ],
      });

      const result = await analyzeResponse({
        question: 'What is your experience with React?',
        answer: 'I have 5 years of experience building React applications.',
        position: 'Software Engineer',
      });

      expect(result.scores.technical).toBe(8.5);
      expect(result.scores.problemSolving).toBe(7.5);
      expect(result.sentiment).toBe(0.6);
      expect(result.confidence).toBe(0.85);
      expect(result.strengths).toHaveLength(2);
      expect(result.weaknesses).toHaveLength(1);
      expect(result.summary).toBe('Strong technical candidate.');
    });

    it('should clamp scores to valid range (0-10)', async () => {
      const mockResponse = {
        scores: {
          technical: 15, // Over 10
          problemSolving: -5, // Below 0
          communication: 8.0,
          cultureFit: 7.0,
        },
        sentiment: 0.5,
        confidence: 0.7,
        strengths: [],
        weaknesses: [],
        summary: 'Test.',
      };

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mockResponse),
            },
          },
        ],
      });

      const result = await analyzeResponse({
        question: 'Test question',
        answer: 'Test answer',
        position: 'Software Engineer',
      });

      expect(result.scores.technical).toBe(10);
      expect(result.scores.problemSolving).toBe(0);
    });

    it('should clamp sentiment to valid range (-1 to 1)', async () => {
      const mockResponse = {
        scores: { technical: 7.0 },
        sentiment: 2.5, // Over 1
        confidence: 0.7,
        strengths: [],
        weaknesses: [],
        summary: 'Test.',
      };

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mockResponse),
            },
          },
        ],
      });

      const result = await analyzeResponse({
        question: 'Test',
        answer: 'Test',
        position: 'Software Engineer',
      });

      expect(result.sentiment).toBe(1);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeResponse({
        question: 'Test question',
        answer: 'Test answer',
        position: 'Software Engineer',
      });

      // Should return default analysis on error
      expect(result.scores).toBeDefined();
      expect(result.summary).toContain('not configured');
    });

    it('should handle empty response from OpenAI', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      const result = await analyzeResponse({
        question: 'Test',
        answer: 'Test',
        position: 'Software Engineer',
      });

      // Should return default analysis
      expect(result.scores).toBeDefined();
    });
  });

  // ============================================================================
  // generateExplainability Tests
  // ============================================================================

  describe('generateExplainability', () => {
    it('should produce readable text', async () => {
      const mockExplainability = {
        summary: 'The candidate demonstrated strong technical skills.',
        recommendation: 'Recommend proceeding to next round.',
        developmentAreas: ['System design', 'Leadership'],
      };

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mockExplainability),
            },
          },
        ],
      });

      const result = await generateExplainability({
        overallScore: 8.0,
        categoryScores: { technical: 8.5, communication: 7.5 },
        strengths: ['Good coding skills'],
        weaknesses: ['Needs more depth'],
        decision: 'HIRE',
        position: 'Software Engineer',
      });

      expect(result.summary).toBe('The candidate demonstrated strong technical skills.');
      expect(result.recommendation).toBe('Recommend proceeding to next round.');
      expect(result.developmentAreas).toContain('System design');
    });

    it('should handle API errors gracefully', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await generateExplainability({
        overallScore: 7.0,
        categoryScores: {},
        strengths: [],
        weaknesses: [],
        decision: 'HIRE',
        position: 'Software Engineer',
      });

      // Should return default explainability
      expect(result.summary).toContain('7.0');
      expect(result.summary).toContain('HIRE');
    });
  });

  // ============================================================================
  // calculateOverallScore Tests
  // ============================================================================

  describe('calculateOverallScore', () => {
    it('should calculate weighted average correctly for Software Engineer', () => {
      const scores = {
        technical: 8.0,
        problemSolving: 7.0,
        communication: 6.0,
        cultureFit: 5.0,
      };

      const weights = {
        technical: 0.50,
        problemSolving: 0.25,
        communication: 0.15,
        cultureFit: 0.10,
      };

      const result = calculateOverallScore(scores, weights);

      // Expected: (8*0.5) + (7*0.25) + (6*0.15) + (5*0.1) = 4 + 1.75 + 0.9 + 0.5 = 7.15
      expect(result).toBeCloseTo(7.15, 2);
    });

    it('should calculate weighted average correctly for Product Manager', () => {
      const scores = {
        strategic: 9.0,
        communication: 8.0,
        analytical: 7.0,
        leadership: 6.0,
      };

      const weights = {
        strategic: 0.35,
        communication: 0.30,
        analytical: 0.20,
        leadership: 0.15,
      };

      const result = calculateOverallScore(scores, weights);

      // Expected: (9*0.35) + (8*0.30) + (7*0.20) + (6*0.15) = 3.15 + 2.4 + 1.4 + 0.9 = 7.85
      expect(result).toBeCloseTo(7.85, 2);
    });

    it('should handle missing categories by using available ones', () => {
      const scores = {
        technical: 8.0,
        communication: 7.0,
        // Missing problemSolving and cultureFit
      };

      const weights = {
        technical: 0.50,
        problemSolving: 0.25,
        communication: 0.15,
        cultureFit: 0.10,
      };

      const result = calculateOverallScore(scores, weights);

      // Only technical and communication are present
      // Weighted sum: (8*0.5) + (7*0.15) = 4 + 1.05 = 5.05
      // Total weight: 0.5 + 0.15 = 0.65
      // Result: 5.05 / 0.65 = 7.77
      expect(result).toBeCloseTo(7.77, 2);
    });

    it('should fall back to simple average when no weights match', () => {
      const scores = {
        unknownCategory1: 8.0,
        unknownCategory2: 6.0,
      };

      const weights = {
        technical: 0.50,
        communication: 0.50,
      };

      const result = calculateOverallScore(scores, weights);

      // No matching categories, should use simple average
      expect(result).toBe(7.0);
    });

    it('should return 5.0 for empty scores', () => {
      const scores = {};
      const weights = { technical: 0.50 };

      const result = calculateOverallScore(scores, weights);

      expect(result).toBe(5.0);
    });
  });
});
