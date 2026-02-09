import prisma from './prisma';
import { z } from 'zod';

// Type alias for Question from Prisma
type Question = Awaited<ReturnType<typeof prisma.question.findFirst>> & {};
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const CreateQuestionSchema = z.object({
  content: z.string().min(10, 'Question content must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']),
  position: z.string().min(1, 'Position is required'),
  skillTags: z.array(z.string()).default([]),
  expectedDuration: z.number().optional(),
  scoringCriteria: z.object({
    keywords: z.array(z.string()).optional(),
    keyPoints: z.array(z.string()).optional(),
  }).optional(),
  generatedBy: z.string().optional(),
  generationPrompt: z.string().optional(),
});

export const UpdateQuestionSchema = z.object({
  content: z.string().min(10).optional(),
  category: z.string().min(1).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']).optional(),
  position: z.string().min(1).optional(),
  skillTags: z.array(z.string()).optional(),
  expectedDuration: z.number().optional(),
  scoringCriteria: z.object({
    keywords: z.array(z.string()).optional(),
    keyPoints: z.array(z.string()).optional(),
  }).optional(),
});

export const QuestionFiltersSchema = z.object({
  category: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']).optional(),
  position: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'timesAsked', 'avgScore', 'correlationScore']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const RandomQuestionParamsSchema = z.object({
  position: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']).optional(),
  excludeIds: z.array(z.string()).optional(),
  count: z.number().min(1).max(10).default(1),
});

// ============================================================================
// Type Definitions
// ============================================================================

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;
export type QuestionFilters = z.infer<typeof QuestionFiltersSchema>;
export type RandomQuestionParams = z.infer<typeof RandomQuestionParamsSchema>;

export interface QuestionWithAnalytics extends Question {
  responseCount?: number;
  recentAvgScore?: number;
}

export interface PaginatedQuestions {
  questions: Question[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface QuestionAnalytics {
  id: string;
  content: string;
  totalResponses: number;
  avgScore: number;
  correlationScore: number;
  timesAsked: number;
  lastUsed: Date | null;
  scoreDistribution: { range: string; count: number }[];
  usageOverTime: { date: string; count: number }[];
  difficultyRating: Difficulty;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new question
 */
export async function createQuestion(
  data: CreateQuestionInput,
  createdById: string
): Promise<Question> {
  const validated = CreateQuestionSchema.parse(data);
  
  return await prisma.question.create({
    data: {
      content: validated.content,
      category: validated.category,
      difficulty: validated.difficulty as Difficulty,
      position: validated.position,
      skillTags: validated.skillTags,
      generatedBy: validated.generatedBy,
      generationPrompt: validated.generationPrompt,
      createdById,
    },
  });
}

/**
 * Get a question by ID
 */
export async function getQuestionById(id: string): Promise<Question | null> {
  return await prisma.question.findUnique({
    where: { id },
  });
}

/**
 * Get all questions with filters and pagination
 */
export async function getAllQuestions(
  filters: QuestionFilters
): Promise<PaginatedQuestions> {
  const validated = QuestionFiltersSchema.parse(filters);
  const { category, difficulty, position, page, limit, sortBy, sortOrder } = validated;
  
  const where: any = {};
  
  if (category) {
    where.category = category;
  }
  
  if (difficulty) {
    where.difficulty = difficulty;
  }
  
  if (position) {
    where.position = position;
  }
  
  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.question.count({ where }),
  ]);
  
  return {
    questions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Update a question
 */
export async function updateQuestion(
  id: string,
  data: UpdateQuestionInput
): Promise<Question> {
  const validated = UpdateQuestionSchema.parse(data);
  
  return await prisma.question.update({
    where: { id },
    data: validated,
  });
}

/**
 * Delete a question
 */
export async function deleteQuestion(id: string): Promise<Question> {
  return await prisma.question.delete({
    where: { id },
  });
}

// ============================================================================
// Weighted Random Selection Algorithm
// ============================================================================

/**
 * Calculate weight for a question based on multiple factors
 * 
 * Weight factors:
 * - correlationScore (40%): How well it predicts success
 * - timesAsked (30%): Favor less-used questions (inverse)
 * - lastUsed (20%): Favor older questions
 * - avgScore (10%): Prefer discriminating questions (mid-range scores ~5)
 */
function calculateQuestionWeight(question: Question): number {
  // Correlation weight (40%) - higher is better
  const correlationWeight = Math.max(0, question.correlationScore) * 0.4;
  
  // Usage weight (30%) - less used is better
  // Normalize: questions asked 0 times get max weight, 100+ times get min weight
  const maxUsage = 100;
  const usageScore = Math.max(0, 1 - (question.timesAsked / maxUsage));
  const usageWeight = usageScore * 0.3;
  
  // Recency weight (20%) - older (less recently used) is better
  let recencyWeight = 0.2; // Default if never used
  if (question.lastUsed) {
    const daysSinceUse = (Date.now() - question.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    const maxDays = 30; // Questions not used for 30+ days get max weight
    const recencyScore = Math.min(1, daysSinceUse / maxDays);
    recencyWeight = recencyScore * 0.2;
  }
  
  // Discrimination weight (10%) - mid-range scores are better
  // Questions with avg scores around 5 (on 1-10 scale) discriminate better
  const idealScore = 5;
  const maxDeviation = 4;
  const deviation = Math.abs(question.avgScore - idealScore);
  const discriminationScore = Math.max(0, 1 - (deviation / maxDeviation));
  const discriminationWeight = discriminationScore * 0.1;
  
  // Total weight with minimum floor to ensure all questions have some chance
  const totalWeight = correlationWeight + usageWeight + recencyWeight + discriminationWeight;
  return Math.max(0.05, totalWeight); // Minimum 5% weight
}

/**
 * Get random questions using weighted selection
 */
export async function getRandomQuestion(
  params: RandomQuestionParams
): Promise<Question[]> {
  const validated = RandomQuestionParamsSchema.parse(params);
  const { position, category, difficulty, excludeIds = [], count } = validated;
  
  const where: any = {};
  
  if (position) {
    where.position = position;
  }
  
  if (category) {
    where.category = category;
  }
  
  if (difficulty) {
    where.difficulty = difficulty;
  }
  
  if (excludeIds.length > 0) {
    where.id = { notIn: excludeIds };
  }
  
  // Get all eligible questions
  const candidates = await prisma.question.findMany({
    where,
  });
  
  if (candidates.length === 0) {
    return [];
  }
  
  if (candidates.length <= count) {
    return candidates;
  }
  
  // Calculate weights for each candidate
  const weightedCandidates = candidates.map((q: NonNullable<Question>) => ({
    question: q,
    weight: calculateQuestionWeight(q as NonNullable<Question>),
  }));
  
  // Weighted random selection without replacement
  const selected: Question[] = [];
  const remaining = [...weightedCandidates];
  
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, c) => sum + c.weight, 0);
    let randomPoint = Math.random() * totalWeight;
    
    for (let j = 0; j < remaining.length; j++) {
      randomPoint -= remaining[j].weight;
      if (randomPoint <= 0) {
        selected.push(remaining[j].question);
        remaining.splice(j, 1);
        break;
      }
    }
    
    // Fallback in case of floating point issues
    if (selected.length === i && remaining.length > 0) {
      selected.push(remaining[0].question);
      remaining.splice(0, 1);
    }
  }
  
  return selected;
}

// ============================================================================
// Metrics & Analytics
// ============================================================================

/**
 * Increment question usage count and update lastUsed
 */
export async function incrementQuestionUsage(id: string): Promise<Question> {
  return await prisma.question.update({
    where: { id },
    data: {
      timesAsked: { increment: 1 },
      lastUsed: new Date(),
    },
  });
}

/**
 * Update question metrics using Exponential Moving Average (EMA)
 * 
 * EMA formula: new_avg = alpha * new_value + (1 - alpha) * old_avg
 * Alpha = 0.1 means new values have 10% influence
 */
export async function updateQuestionMetrics(
  id: string,
  newScore: number,
  alpha: number = 0.1
): Promise<Question> {
  const question = await prisma.question.findUnique({
    where: { id },
  });
  
  if (!question) {
    throw new Error(`Question not found: ${id}`);
  }
  
  // Calculate new EMA for avgScore
  const newAvgScore = alpha * newScore + (1 - alpha) * question.avgScore;
  
  return await prisma.question.update({
    where: { id },
    data: {
      avgScore: newAvgScore,
    },
  });
}

/**
 * Get question analytics
 */
export async function getQuestionAnalytics(id: string): Promise<QuestionAnalytics | null> {
  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      responses: {
        orderBy: { createdAt: 'desc' },
        take: 100, // Last 100 responses for analysis
      },
    },
  });
  
  if (!question) {
    return null;
  }
  
  // Calculate score distribution
  const scoreRanges = [
    { range: '0-2', min: 0, max: 2, count: 0 },
    { range: '3-4', min: 3, max: 4, count: 0 },
    { range: '5-6', min: 5, max: 6, count: 0 },
    { range: '7-8', min: 7, max: 8, count: 0 },
    { range: '9-10', min: 9, max: 10, count: 0 },
  ];
  
  // Calculate usage over time (last 30 days)
  const usageMap = new Map<string, number>();
  const today = new Date();
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    usageMap.set(date.toISOString().split('T')[0], 0);
  }
  
  question.responses.forEach((response) => {
    // Score distribution
    const scores = response.scores as { overall?: number } | null;
    if (scores?.overall) {
      const score = scores.overall;
      for (const range of scoreRanges) {
        if (score >= range.min && score <= range.max) {
          range.count++;
          break;
        }
      }
    }
    
    // Usage over time
    const dateKey = response.createdAt.toISOString().split('T')[0];
    if (usageMap.has(dateKey)) {
      usageMap.set(dateKey, (usageMap.get(dateKey) || 0) + 1);
    }
  });
  
  return {
    id: question.id,
    content: question.content,
    totalResponses: question.responses.length,
    avgScore: question.avgScore,
    correlationScore: question.correlationScore,
    timesAsked: question.timesAsked,
    lastUsed: question.lastUsed,
    scoreDistribution: scoreRanges.map(({ range, count }) => ({ range, count })),
    usageOverTime: Array.from(usageMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    difficultyRating: question.difficulty,
  };
}

/**
 * Update correlation score for a question
 */
export async function updateQuestionCorrelationScore(
  id: string,
  correlationScore: number
): Promise<Question> {
  return await prisma.question.update({
    where: { id },
    data: { correlationScore },
  });
}

/**
 * Get all unique positions from questions
 */
export async function getUniquePositions(): Promise<string[]> {
  const questions = await prisma.question.findMany({
    select: { position: true },
    distinct: ['position'],
  });
  
  return questions.map((q) => q.position);
}

/**
 * Get all unique categories from questions
 */
export async function getUniqueCategories(): Promise<string[]> {
  const questions = await prisma.question.findMany({
    select: { category: true },
    distinct: ['category'],
  });
  
  return questions.map((q) => q.category);
}

/**
 * Bulk create questions
 */
export async function bulkCreateQuestions(
  questions: CreateQuestionInput[],
  createdById: string
): Promise<{ created: number; failed: number; errors: string[] }> {
  const results = {
    created: 0,
    failed: 0,
    errors: [] as string[],
  };
  
  for (const questionData of questions) {
    try {
      const validated = CreateQuestionSchema.parse(questionData);
      await prisma.question.create({
        data: {
          content: validated.content,
          category: validated.category,
          difficulty: validated.difficulty as Difficulty,
          position: validated.position,
          skillTags: validated.skillTags,
          generatedBy: validated.generatedBy,
          generationPrompt: validated.generationPrompt,
          createdById,
        },
      });
      results.created++;
    } catch (error) {
      results.failed++;
      results.errors.push(
        `Failed to create question: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  return results;
}
