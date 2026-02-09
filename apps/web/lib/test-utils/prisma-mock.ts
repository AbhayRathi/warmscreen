import { vi } from 'vitest';

// Mock question type that matches the structure expected by the tests
export interface MockQuestion {
  id: string;
  content: string;
  category: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  position: string;
  skillTags: string[];
  avgScore: number;
  timesAsked: number;
  correlationScore: number;
  lastUsed: Date | null;
  generatedBy: string | null;
  generationPrompt: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  responses?: MockResponse[];
}

export interface MockResponse {
  id: string;
  questionId: string;
  interviewId: string;
  scores: { overall?: number } | null;
  createdAt: Date;
  interview?: {
    decision: 'HIRE' | 'STRONG_HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE' | null;
  };
}

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'RECRUITER' | 'CANDIDATE';
  createdAt: Date;
  updatedAt: Date;
}

// Create mock functions for prisma
export const prismaMock = {
  question: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  response: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  interview: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
};

// Helper to create a mock question
export function createMockQuestion(overrides: Partial<MockQuestion> = {}): MockQuestion {
  return {
    id: 'test-question-id',
    content: 'This is a test question with at least 10 characters',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['javascript', 'testing'],
    avgScore: 5.0,
    timesAsked: 10,
    correlationScore: 0.5,
    lastUsed: null,
    generatedBy: null,
    generationPrompt: null,
    createdById: 'test-user-id',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// Helper to create a mock user
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'RECRUITER',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// Helper to create mock responses with outcomes
export function createMockResponsesWithOutcomes(
  questionId: string,
  hiredScores: number[],
  notHiredScores: number[]
): MockResponse[] {
  const responses: MockResponse[] = [];
  
  hiredScores.forEach((score, index) => {
    responses.push({
      id: `response-hired-${index}`,
      questionId,
      interviewId: `interview-hired-${index}`,
      scores: { overall: score },
      createdAt: new Date(),
      interview: {
        decision: index % 2 === 0 ? 'HIRE' : 'STRONG_HIRE',
      },
    });
  });
  
  notHiredScores.forEach((score, index) => {
    responses.push({
      id: `response-not-hired-${index}`,
      questionId,
      interviewId: `interview-not-hired-${index}`,
      scores: { overall: score },
      createdAt: new Date(),
      interview: {
        decision: index % 2 === 0 ? 'NO_HIRE' : 'STRONG_NO_HIRE',
      },
    });
  });
  
  return responses;
}

// Reset all mocks
export function resetMocks() {
  Object.values(prismaMock).forEach((model) => {
    Object.values(model).forEach((mockFn) => {
      if (typeof mockFn === 'function' && 'mockReset' in mockFn) {
        mockFn.mockReset();
      }
    });
  });
}

// Mock for session
export const sessionMock = {
  getSession: vi.fn(),
};

export function createMockSession(overrides: Partial<{
  userId: string;
  email: string;
  name: string;
  isLoggedIn: boolean;
}> = {}) {
  return {
    userId: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    isLoggedIn: true,
    ...overrides,
  };
}
