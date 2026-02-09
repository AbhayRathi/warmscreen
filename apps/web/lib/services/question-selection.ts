import { getRandomQuestion } from '@/lib/db/question';
import { getAnsweredQuestionIds, getResponseCount } from '@/lib/db/response';
import { getInterviewById } from '@/lib/db/interview';

// ============================================================================
// Configuration
// ============================================================================

// Target number of questions per interview
export const TARGET_QUESTIONS = 10;

// Question mix ratios
export const QUESTION_MIX = {
  ROLE_SPECIFIC: 6,    // 60% - position-matched questions
  UNIVERSAL: 3,        // 30% - culture fit and behavioral
  BRAINTEASER: 1,      // 10% - brainteaser questions
};

// Difficulty progression (question index -> difficulty)
export function getDifficultyForPosition(position: number): 'EASY' | 'MEDIUM' | 'HARD' {
  // Easy questions for first 3
  if (position < 3) return 'EASY';
  // Hard questions for last 2
  if (position >= 8) return 'HARD';
  // Medium for the rest
  return 'MEDIUM';
}

// ============================================================================
// Types
// ============================================================================

export interface InterviewProgress {
  current: number;
  total: number;
  percentage: number;
}

export interface QuestionSelection {
  id: string;
  content: string;
  category: string;
  difficulty: string;
  position: string;
}

// ============================================================================
// Question Selection Service
// ============================================================================

/**
 * Get the next question for an interview
 * Uses weighted random selection from PR #7
 * Excludes already-asked questions
 * Returns null if target question count reached
 */
export async function getNextQuestion(
  interviewId: string,
  currentPosition: number
): Promise<QuestionSelection | null> {
  // Check if we've reached the target number of questions
  if (currentPosition >= TARGET_QUESTIONS) {
    return null;
  }

  // Get the interview to know the position/role
  const interview = await getInterviewById(interviewId);
  if (!interview) {
    throw new Error(`Interview not found: ${interviewId}`);
  }

  // Get already-asked question IDs
  const excludeIds = await getAnsweredQuestionIds(interviewId);

  // Determine what type of question to ask based on position
  const { category, position: roleFilter } = getQuestionCriteria(
    currentPosition,
    interview.position
  );

  // Get difficulty based on progression
  const difficulty = getDifficultyForPosition(currentPosition);

  // Try to get a question with specific criteria first
  let questions = await getRandomQuestion({
    position: roleFilter,
    category,
    difficulty,
    excludeIds,
    count: 1,
  });

  // If no matching question, try without difficulty constraint
  if (questions.length === 0) {
    questions = await getRandomQuestion({
      position: roleFilter,
      category,
      excludeIds,
      count: 1,
    });
  }

  // If still no matching question, try with just position filter
  if (questions.length === 0) {
    questions = await getRandomQuestion({
      position: roleFilter,
      excludeIds,
      count: 1,
    });
  }

  // If still no matching question, try any available question
  if (questions.length === 0) {
    questions = await getRandomQuestion({
      excludeIds,
      count: 1,
    });
  }

  if (questions.length === 0) {
    return null;
  }

  const question = questions[0];
  return {
    id: question.id,
    content: question.content,
    category: question.category,
    difficulty: question.difficulty,
    position: question.position,
  };
}

/**
 * Determine question category and position filter based on current question index
 */
function getQuestionCriteria(
  questionIndex: number,
  interviewPosition: string
): { category: string | undefined; position: string | undefined } {
  // Questions 0-5 (6 questions): Role-specific
  if (questionIndex < QUESTION_MIX.ROLE_SPECIFIC) {
    return {
      category: undefined, // Mix of TECHNICAL, BEHAVIORAL, ROLE_SPECIFIC
      position: interviewPosition,
    };
  }

  // Questions 6-8 (3 questions): Universal - Culture Fit and Behavioral
  if (questionIndex < QUESTION_MIX.ROLE_SPECIFIC + QUESTION_MIX.UNIVERSAL) {
    const universalCategories = ['CULTURE_FIT', 'BEHAVIORAL'];
    const categoryIndex = (questionIndex - QUESTION_MIX.ROLE_SPECIFIC) % universalCategories.length;
    return {
      category: universalCategories[categoryIndex],
      position: undefined, // Universal questions, not position-specific
    };
  }

  // Question 9 (1 question): Brainteaser
  return {
    category: 'BRAINTEASER',
    position: undefined,
  };
}

/**
 * Get interview progress
 */
export async function getInterviewProgress(
  interviewId: string
): Promise<InterviewProgress> {
  const responseCount = await getResponseCount(interviewId);
  
  return {
    current: responseCount,
    total: TARGET_QUESTIONS,
    percentage: Math.round((responseCount / TARGET_QUESTIONS) * 100),
  };
}

/**
 * Check if interview is complete (all questions answered)
 */
export async function isInterviewComplete(interviewId: string): Promise<boolean> {
  const responseCount = await getResponseCount(interviewId);
  return responseCount >= TARGET_QUESTIONS;
}
