import { getResponseById, updateResponse } from '@/lib/db/response';
import { getInterviewById, getInterviewWithQuestions } from '@/lib/db/interview';
import prisma from '@/lib/db/prisma';
import {
  analyzeResponse,
  generateExplainability,
  calculateOverallScore,
  ResponseAnalysis,
} from '@/lib/ai/openai-client';
import {
  getWeightsForPosition,
  DECISION_THRESHOLDS,
} from '@/lib/ai/prompts';

// ============================================================================
// Constants
// ============================================================================

// Maximum number of strength tags to store per response
const MAX_STRENGTH_TAGS = 2;
// Maximum number of weakness tags to store per response
const MAX_WEAKNESS_TAGS = 1;

// ============================================================================
// Types
// ============================================================================

export interface ScoreResponseResult {
  responseId: string;
  scores: Record<string, number>;
  sentiment: number;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

export interface ScoreInterviewResult {
  interviewId: string;
  overallScore: number;
  categoryBreakdown: Record<string, number>;
  decision: 'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE';
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  explainability: {
    summary: string;
    recommendation: string;
    developmentAreas: string[];
    scoringBreakdown: Record<string, number>;
    strengths: string[];
    weaknesses: string[];
  };
}

export interface HiringDecision {
  decision: 'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE';
  confidence: number;
  reasoning: string;
}

// ============================================================================
// Score Individual Response
// ============================================================================

/**
 * Score a single interview response using AI
 * Fetches the response, analyzes it with OpenAI, and updates the database
 */
export async function scoreResponse(responseId: string): Promise<ScoreResponseResult> {
  // Fetch response with question
  const response = await getResponseById(responseId);
  if (!response) {
    throw new Error(`Response not found: ${responseId}`);
  }

  // Get interview for position context
  const interview = await getInterviewById(response.interviewId);
  if (!interview) {
    throw new Error(`Interview not found for response: ${responseId}`);
  }

  // Get question content
  const question = (response as any).question;
  if (!question) {
    throw new Error(`Question not found for response: ${responseId}`);
  }

  // Analyze response with AI
  const analysis: ResponseAnalysis = await analyzeResponse({
    question: question.content,
    answer: response.transcript,
    position: interview.position,
  });

  // Update response in database with top tags from analysis
  await updateResponse(responseId, {
    scores: analysis.scores,
    sentiment: analysis.sentiment,
    confidence: analysis.confidence,
    tags: [...analysis.strengths.slice(0, MAX_STRENGTH_TAGS), ...analysis.weaknesses.slice(0, MAX_WEAKNESS_TAGS)],
  });

  return {
    responseId,
    scores: analysis.scores,
    sentiment: analysis.sentiment,
    confidence: analysis.confidence,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    summary: analysis.summary,
  };
}

// ============================================================================
// Score Entire Interview
// ============================================================================

/**
 * Score all responses in an interview and generate overall assessment
 * Calculates weighted averages and generates hiring decision
 */
export async function scoreInterview(interviewId: string): Promise<ScoreInterviewResult> {
  // Get interview with all responses and questions
  const interview = await getInterviewWithQuestions(interviewId);
  if (!interview) {
    throw new Error(`Interview not found: ${interviewId}`);
  }

  const responses = interview.responses;
  if (responses.length === 0) {
    throw new Error(`No responses found for interview: ${interviewId}`);
  }

  // Collect all scores, strengths, and weaknesses
  const allCategoryScores: Record<string, number[]> = {};
  const allStrengths: string[] = [];
  const allWeaknesses: string[] = [];
  let totalConfidence = 0;

  for (const response of responses) {
    const scores = response.scores as Record<string, number> | null;
    if (scores && typeof scores === 'object') {
      for (const [category, score] of Object.entries(scores)) {
        if (typeof score === 'number' && !isNaN(score)) {
          if (!allCategoryScores[category]) {
            allCategoryScores[category] = [];
          }
          allCategoryScores[category].push(score);
        }
      }
    }
    
    // Collect confidence
    if (response.confidence !== null && response.confidence !== undefined) {
      totalConfidence += response.confidence;
    }
  }

  // Calculate average scores per category
  const categoryBreakdown: Record<string, number> = {};
  for (const [category, scores] of Object.entries(allCategoryScores)) {
    categoryBreakdown[category] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // Get position weights and calculate overall score
  const weights = getWeightsForPosition(interview.position);
  const overallScore = calculateOverallScore(categoryBreakdown, weights);

  // Generate hiring decision
  const avgConfidence = responses.length > 0 ? totalConfidence / responses.length : 0.5;
  const hiringDecision = generateHiringDecision(overallScore, DECISION_THRESHOLDS);

  // Aggregate strengths and weaknesses (take unique top ones)
  const uniqueStrengths = [...new Set(allStrengths)].slice(0, 5);
  const uniqueWeaknesses = [...new Set(allWeaknesses)].slice(0, 5);

  // Generate AI explainability
  const explainabilityResult = await generateExplainability({
    overallScore,
    categoryScores: categoryBreakdown,
    strengths: uniqueStrengths.length > 0 ? uniqueStrengths : ['Strong interview performance'],
    weaknesses: uniqueWeaknesses.length > 0 ? uniqueWeaknesses : ['Minor areas for improvement'],
    decision: hiringDecision.decision,
    position: interview.position,
  });

  // Build full explainability object
  const explainability = {
    summary: explainabilityResult.summary,
    recommendation: explainabilityResult.recommendation,
    developmentAreas: explainabilityResult.developmentAreas,
    scoringBreakdown: categoryBreakdown,
    strengths: uniqueStrengths,
    weaknesses: uniqueWeaknesses,
  };

  // Update interview in database
  await prisma.interview.update({
    where: { id: interviewId },
    data: {
      score: overallScore,
      decision: hiringDecision.decision,
      explainability: explainability,
    },
  });

  return {
    interviewId,
    overallScore,
    categoryBreakdown,
    decision: hiringDecision.decision,
    confidence: avgConfidence,
    strengths: uniqueStrengths,
    weaknesses: uniqueWeaknesses,
    explainability,
  };
}

// ============================================================================
// Hiring Decision Logic
// ============================================================================

/**
 * Map score to hiring decision based on thresholds
 */
export function generateHiringDecision(
  score: number,
  thresholds = DECISION_THRESHOLDS
): HiringDecision {
  let decision: 'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE';
  let confidence: number;
  let reasoning: string;

  if (score >= thresholds.STRONG_HIRE) {
    decision = 'STRONG_HIRE';
    confidence = Math.min(0.95, 0.8 + (score - thresholds.STRONG_HIRE) * 0.05);
    reasoning = `Exceptional candidate with score ${score.toFixed(1)}/10, significantly exceeding the ${thresholds.STRONG_HIRE} threshold for strong hire.`;
  } else if (score >= thresholds.HIRE) {
    decision = 'HIRE';
    confidence = 0.7 + (score - thresholds.HIRE) / (thresholds.STRONG_HIRE - thresholds.HIRE) * 0.1;
    reasoning = `Solid candidate with score ${score.toFixed(1)}/10, meeting the ${thresholds.HIRE} threshold for hire recommendation.`;
  } else if (score >= thresholds.STRONG_NO_HIRE) {
    decision = 'NO_HIRE';
    confidence = 0.6 + (thresholds.HIRE - score) / (thresholds.HIRE - thresholds.STRONG_NO_HIRE) * 0.2;
    reasoning = `Candidate scored ${score.toFixed(1)}/10, below the ${thresholds.HIRE} threshold. Does not meet current requirements.`;
  } else {
    decision = 'STRONG_NO_HIRE';
    confidence = 0.85 + Math.min(0.1, (thresholds.STRONG_NO_HIRE - score) * 0.02);
    reasoning = `Candidate scored ${score.toFixed(1)}/10, significantly below requirements. Clear no hire recommendation.`;
  }

  return {
    decision,
    confidence: Math.min(1, Math.max(0, confidence)),
    reasoning,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if all responses in an interview have been scored
 */
export async function areAllResponsesScored(interviewId: string): Promise<boolean> {
  const interview = await getInterviewWithQuestions(interviewId);
  if (!interview) {
    return false;
  }

  for (const response of interview.responses) {
    const scores = response.scores as Record<string, number> | null;
    if (!scores || Object.keys(scores).length === 0) {
      return false;
    }
  }

  return interview.responses.length > 0;
}

/**
 * Get interview analysis for display
 * Returns full interview data with scoring breakdown
 */
export async function getInterviewAnalysis(interviewId: string): Promise<{
  interview: any;
  scoredResponses: number;
  totalResponses: number;
  isFullyScored: boolean;
}> {
  const interview = await getInterviewWithQuestions(interviewId);
  if (!interview) {
    throw new Error(`Interview not found: ${interviewId}`);
  }

  let scoredResponses = 0;
  for (const response of interview.responses) {
    const scores = response.scores as Record<string, number> | null;
    if (scores && Object.keys(scores).length > 0) {
      scoredResponses++;
    }
  }

  return {
    interview,
    scoredResponses,
    totalResponses: interview.responses.length,
    isFullyScored: scoredResponses === interview.responses.length && interview.responses.length > 0,
  };
}
