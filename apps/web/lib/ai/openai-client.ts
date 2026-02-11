import OpenAI from 'openai';
import { aiEnv, isOpenAIConfigured } from './env';
import {
  getPromptForPosition,
  getAnalyzeResponsePrompt,
  getExplainabilityPrompt,
  ScoringCriteria,
} from './prompts';

// ============================================================================
// Types
// ============================================================================

export interface ResponseAnalysis {
  scores: Record<string, number>;
  sentiment: number;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

export interface ExplainabilityResult {
  summary: string;
  recommendation: string;
  developmentAreas: string[];
}

export interface AnalyzeResponseParams {
  question: string;
  answer: string;
  position: string;
}

export interface GenerateExplainabilityParams {
  overallScore: number;
  categoryScores: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  decision: string;
  position: string;
}

// ============================================================================
// OpenAI Client Singleton
// ============================================================================

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI is not configured. Please set OPENAI_API_KEY environment variable.');
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: aiEnv.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Analyze a candidate's response to an interview question
 * Returns scores, sentiment, confidence, and qualitative feedback
 */
export async function analyzeResponse(params: AnalyzeResponseParams): Promise<ResponseAnalysis> {
  const { question, answer, position } = params;

  if (!isOpenAIConfigured()) {
    // Return default scores when OpenAI is not configured
    return getDefaultAnalysis();
  }

  const client = getOpenAIClient();
  const promptConfig = getPromptForPosition(position);
  const userPrompt = getAnalyzeResponsePrompt(question, answer, position, promptConfig.criteria);

  try {
    const response = await client.chat.completions.create({
      model: aiEnv.OPENAI_MODEL,
      max_tokens: aiEnv.OPENAI_MAX_TOKENS,
      messages: [
        { role: 'system', content: promptConfig.system },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content) as ResponseAnalysis;
    return validateAnalysisResponse(parsed, promptConfig.criteria);
  } catch (error) {
    console.error('Error analyzing response with OpenAI:', error);
    // Return default analysis on error for graceful degradation
    return getDefaultAnalysis();
  }
}

/**
 * Generate human-readable explanation for interview scores
 */
export async function generateExplainability(
  params: GenerateExplainabilityParams
): Promise<ExplainabilityResult> {
  const { overallScore, categoryScores, strengths, weaknesses, decision, position } = params;

  if (!isOpenAIConfigured()) {
    return getDefaultExplainability(decision, overallScore);
  }

  const client = getOpenAIClient();
  const promptConfig = getPromptForPosition(position);
  const userPrompt = getExplainabilityPrompt(
    overallScore,
    categoryScores,
    strengths,
    weaknesses,
    decision,
    position
  );

  try {
    const response = await client.chat.completions.create({
      model: aiEnv.OPENAI_MODEL,
      max_tokens: aiEnv.OPENAI_MAX_TOKENS,
      messages: [
        { role: 'system', content: promptConfig.system },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content) as ExplainabilityResult;
    return validateExplainabilityResponse(parsed);
  } catch (error) {
    console.error('Error generating explainability with OpenAI:', error);
    return getDefaultExplainability(decision, overallScore);
  }
}

/**
 * Calculate overall score from category scores using position-specific weights
 */
export function calculateOverallScore(
  categoryScores: Record<string, number>,
  weights: Record<string, number>
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [category, weight] of Object.entries(weights)) {
    const score = categoryScores[category];
    if (score !== undefined && !isNaN(score)) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) {
    // If no matching categories, calculate simple average
    const scores = Object.values(categoryScores).filter(s => !isNaN(s));
    if (scores.length === 0) return 5.0;
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }

  return weightedSum / totalWeight;
}

// ============================================================================
// Validation Helpers
// ============================================================================

function validateAnalysisResponse(
  parsed: Partial<ResponseAnalysis>,
  criteria: ScoringCriteria
): ResponseAnalysis {
  const scores: Record<string, number> = {};
  
  // Validate and clamp scores
  for (const key of Object.keys(criteria)) {
    const score = parsed.scores?.[key];
    if (typeof score === 'number' && !isNaN(score)) {
      scores[key] = Math.max(0, Math.min(10, score));
    } else {
      scores[key] = 5.0; // Default to average
    }
  }

  return {
    scores,
    sentiment: clamp(parsed.sentiment ?? 0, -1, 1),
    confidence: clamp(parsed.confidence ?? 0.5, 0, 1),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 5) : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis complete.',
  };
}

function validateExplainabilityResponse(
  parsed: Partial<ExplainabilityResult>
): ExplainabilityResult {
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Assessment complete.',
    recommendation: typeof parsed.recommendation === 'string' 
      ? parsed.recommendation 
      : 'Review scores and feedback for hiring decision.',
    developmentAreas: Array.isArray(parsed.developmentAreas) 
      ? parsed.developmentAreas.slice(0, 5) 
      : [],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// Default/Fallback Responses
// ============================================================================

function getDefaultAnalysis(): ResponseAnalysis {
  return {
    scores: {
      technical: 5.0,
      problemSolving: 5.0,
      communication: 5.0,
      cultureFit: 5.0,
    },
    sentiment: 0,
    confidence: 0.5,
    strengths: ['Response received'],
    weaknesses: ['Unable to perform AI analysis - scoring pending'],
    summary: 'AI scoring is not configured. Default scores applied.',
  };
}

function getDefaultExplainability(decision: string, score: number): ExplainabilityResult {
  return {
    summary: `Candidate scored ${score.toFixed(1)}/10, resulting in a ${decision.replace(/_/g, ' ')} decision.`,
    recommendation: 'Review individual response scores for detailed assessment.',
    developmentAreas: [],
  };
}
