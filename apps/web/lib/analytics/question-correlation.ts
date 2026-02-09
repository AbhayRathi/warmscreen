import prisma from '../db/prisma';
import { updateQuestionCorrelationScore } from '../db/question';

/**
 * Point-Biserial Correlation Calculation
 * 
 * Calculates the correlation between a question's scores and hiring outcomes.
 * Formula: r = ((M1 - M0) / SD) * sqrt((n1 * n0) / (n * (n - 1)))
 * 
 * Where:
 * - M1 = mean score of hired candidates
 * - M0 = mean score of not-hired candidates
 * - SD = standard deviation of all scores
 * - n1 = number of hired candidates
 * - n0 = number of not-hired candidates
 * - n = total number of candidates
 */

interface QuestionCorrelationData {
  questionId: string;
  hiredScores: number[];
  notHiredScores: number[];
}

/**
 * Calculate standard deviation of an array of numbers
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate mean of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate point-biserial correlation coefficient
 */
function calculatePointBiserialCorrelation(
  hiredScores: number[],
  notHiredScores: number[]
): number {
  const n1 = hiredScores.length;
  const n0 = notHiredScores.length;
  const n = n1 + n0;
  
  if (n === 0 || n1 === 0 || n0 === 0) {
    return 0;
  }
  
  const m1 = calculateMean(hiredScores);
  const m0 = calculateMean(notHiredScores);
  const allScores = [...hiredScores, ...notHiredScores];
  const sd = calculateStdDev(allScores);
  
  if (sd === 0) {
    return 0; // No variance in scores
  }
  
  // Point-biserial correlation formula with correct denominator
  const correlation = ((m1 - m0) / sd) * Math.sqrt((n1 * n0) / (n * (n - 1)));
  
  // Clamp to valid correlation range [-1, 1]
  return Math.max(-1, Math.min(1, correlation));
}

/**
 * Update correlation scores for all questions
 * 
 * This function:
 * 1. Fetches all questions with at least 10 responses
 * 2. Gathers scores grouped by hiring outcome
 * 3. Calculates point-biserial correlation
 * 4. Updates the correlationScore field
 */
export async function updateQuestionCorrelations(): Promise<{
  updated: number;
  skipped: number;
  errors: string[];
}> {
  const results = {
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };
  
  try {
    // Get all questions with at least 10 responses
    const questions = await prisma.question.findMany({
      where: {
        timesAsked: { gte: 10 },
      },
      include: {
        responses: {
          include: {
            interview: {
              select: {
                decision: true,
              },
            },
          },
        },
      },
    });
    
    for (const question of questions) {
      try {
        const correlationData: QuestionCorrelationData = {
          questionId: question.id,
          hiredScores: [],
          notHiredScores: [],
        };
        
        // Group scores by hiring outcome
        for (const response of question.responses) {
          const scores = response.scores as { overall?: number } | null;
          const overallScore = scores?.overall;
          
          if (overallScore === undefined || overallScore === null) {
            continue;
          }
          
          const decision = response.interview?.decision;
          
          if (decision === 'HIRE' || decision === 'STRONG_HIRE') {
            correlationData.hiredScores.push(overallScore);
          } else if (decision === 'NO_HIRE' || decision === 'STRONG_NO_HIRE') {
            correlationData.notHiredScores.push(overallScore);
          }
          // Skip responses with no decision yet
        }
        
        // Need at least 10 total responses with decisions for valid correlation
        const totalWithDecisions = 
          correlationData.hiredScores.length + correlationData.notHiredScores.length;
        
        if (totalWithDecisions < 10) {
          results.skipped++;
          continue;
        }
        
        // Need at least some responses in both groups
        if (correlationData.hiredScores.length === 0 || correlationData.notHiredScores.length === 0) {
          results.skipped++;
          continue;
        }
        
        // Calculate correlation
        const correlation = calculatePointBiserialCorrelation(
          correlationData.hiredScores,
          correlationData.notHiredScores
        );
        
        // Update the question
        await updateQuestionCorrelationScore(question.id, correlation);
        results.updated++;
        
      } catch (error) {
        results.errors.push(
          `Error processing question ${question.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    
  } catch (error) {
    results.errors.push(
      `Error fetching questions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  
  return results;
}

/**
 * Calculate correlation for a single question
 */
export async function calculateQuestionCorrelation(
  questionId: string
): Promise<number | null> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      responses: {
        include: {
          interview: {
            select: {
              decision: true,
            },
          },
        },
      },
    },
  });
  
  if (!question) {
    return null;
  }
  
  const hiredScores: number[] = [];
  const notHiredScores: number[] = [];
  
  for (const response of question.responses) {
    const scores = response.scores as { overall?: number } | null;
    const overallScore = scores?.overall;
    
    if (overallScore === undefined || overallScore === null) {
      continue;
    }
    
    const decision = response.interview?.decision;
    
    if (decision === 'HIRE' || decision === 'STRONG_HIRE') {
      hiredScores.push(overallScore);
    } else if (decision === 'NO_HIRE' || decision === 'STRONG_NO_HIRE') {
      notHiredScores.push(overallScore);
    }
  }
  
  // Need at least 10 total responses with decisions
  const totalWithDecisions = hiredScores.length + notHiredScores.length;
  if (totalWithDecisions < 10 || hiredScores.length === 0 || notHiredScores.length === 0) {
    return null;
  }
  
  return calculatePointBiserialCorrelation(hiredScores, notHiredScores);
}

/**
 * Get questions sorted by correlation effectiveness
 */
export async function getQuestionsByCorrelationEffectiveness(
  limit: number = 20,
  position?: string
): Promise<Array<{
  id: string;
  content: string;
  correlationScore: number;
  timesAsked: number;
  avgScore: number;
}>> {
  const where: any = {
    timesAsked: { gte: 10 },
  };
  
  if (position) {
    where.position = position;
  }
  
  const questions = await prisma.question.findMany({
    where,
    orderBy: {
      correlationScore: 'desc',
    },
    take: limit,
    select: {
      id: true,
      content: true,
      correlationScore: true,
      timesAsked: true,
      avgScore: true,
    },
  });
  
  return questions;
}

/**
 * Get correlation statistics summary
 */
export async function getCorrelationStats(): Promise<{
  totalQuestions: number;
  questionsWithCorrelation: number;
  avgCorrelation: number;
  highCorrelationCount: number;
  lowCorrelationCount: number;
}> {
  const questions = await prisma.question.findMany({
    where: {
      timesAsked: { gte: 10 },
    },
    select: {
      correlationScore: true,
    },
  });
  
  const totalQuestions = questions.length;
  const questionsWithCorrelation = questions.filter((q: { correlationScore: number }) => q.correlationScore !== 0).length;
  
  const correlations = questions.map((q: { correlationScore: number }) => q.correlationScore);
  const avgCorrelation = correlations.length > 0
    ? correlations.reduce((sum: number, c: number) => sum + c, 0) / correlations.length
    : 0;
  
  const highCorrelationCount = correlations.filter((c: number) => c >= 0.5).length;
  const lowCorrelationCount = correlations.filter((c: number) => c <= -0.5).length;
  
  return {
    totalQuestions,
    questionsWithCorrelation,
    avgCorrelation,
    highCorrelationCount,
    lowCorrelationCount,
  };
}
