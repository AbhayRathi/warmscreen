/**
 * Scoring prompts for AI interview analysis
 * Role-specific criteria and scoring guidelines
 */

// ============================================================================
// Types
// ============================================================================

export interface ScoringCriteria {
  technical?: string;
  problemSolving?: string;
  communication?: string;
  cultureFit?: string;
  strategic?: string;
  analytical?: string;
  leadership?: string;
  creativity?: string;
}

export interface PositionPrompt {
  system: string;
  criteria: ScoringCriteria;
}

// ============================================================================
// Position-Specific Prompts
// ============================================================================

export const SCORING_PROMPTS: Record<string, PositionPrompt> = {
  'Software Engineer': {
    system: `You are an expert technical interviewer evaluating software engineering candidates.
Analyze candidate responses for technical competence, problem-solving ability, and communication skills.
Be fair, objective, and base scores on demonstrated knowledge and articulation.
Consider both depth of understanding and ability to explain concepts clearly.`,
    criteria: {
      technical: 'Evaluate code quality understanding, algorithms, data structures, system design principles, and technical accuracy.',
      problemSolving: 'Assess approach methodology, trade-off analysis, edge case consideration, and solution optimization.',
      communication: 'Evaluate clarity of explanation, structured thinking, and ability to convey complex concepts simply.',
      cultureFit: 'Assess collaboration mindset, learning orientation, and alignment with engineering best practices.',
    },
  },
  'Product Manager': {
    system: `You are an expert product management interviewer.
Analyze candidate responses for strategic thinking, user empathy, and cross-functional leadership.
Evaluate their ability to balance business needs, user requirements, and technical constraints.`,
    criteria: {
      strategic: 'Evaluate market understanding, vision clarity, prioritization skills, and business impact focus.',
      communication: 'Assess stakeholder management, storytelling ability, and clarity in articulating product vision.',
      analytical: 'Evaluate data-driven decision making, metrics understanding, and analytical rigor.',
      leadership: 'Assess cross-functional collaboration, influence without authority, and team alignment skills.',
    },
  },
  'Data Scientist': {
    system: `You are an expert data science interviewer.
Analyze candidate responses for statistical knowledge, ML expertise, and analytical thinking.
Evaluate their ability to translate business problems into data solutions.`,
    criteria: {
      technical: 'Evaluate statistical knowledge, ML algorithms understanding, and data engineering skills.',
      problemSolving: 'Assess problem framing, methodology selection, and experimental design.',
      communication: 'Evaluate ability to explain complex analyses to non-technical stakeholders.',
      analytical: 'Assess data intuition, insight generation, and hypothesis-driven thinking.',
    },
  },
  'Designer': {
    system: `You are an expert design interviewer.
Analyze candidate responses for design thinking, user empathy, and creative problem-solving.
Evaluate their ability to balance aesthetics, usability, and business requirements.`,
    criteria: {
      creativity: 'Evaluate design thinking, innovative approaches, and aesthetic sensibility.',
      problemSolving: 'Assess user-centered design process, iteration methodology, and solution effectiveness.',
      communication: 'Evaluate ability to present and defend design decisions.',
      technical: 'Assess understanding of design systems, prototyping tools, and implementation constraints.',
    },
  },
  'Default': {
    system: `You are an expert interviewer evaluating candidates.
Analyze responses for competence in the role, problem-solving ability, and communication skills.
Be fair, objective, and thorough in your assessment.`,
    criteria: {
      technical: 'Evaluate role-specific technical knowledge and expertise.',
      problemSolving: 'Assess analytical thinking and approach to challenges.',
      communication: 'Evaluate clarity, structure, and effectiveness of communication.',
      cultureFit: 'Assess teamwork orientation and alignment with company values.',
    },
  },
};

// ============================================================================
// Position Weights for Scoring
// ============================================================================

export const POSITION_WEIGHTS: Record<string, Record<string, number>> = {
  'Software Engineer': {
    technical: 0.50,
    problemSolving: 0.25,
    communication: 0.15,
    cultureFit: 0.10,
  },
  'Product Manager': {
    strategic: 0.35,
    communication: 0.30,
    analytical: 0.20,
    leadership: 0.15,
  },
  'Data Scientist': {
    technical: 0.40,
    analytical: 0.30,
    problemSolving: 0.20,
    communication: 0.10,
  },
  'Designer': {
    creativity: 0.35,
    problemSolving: 0.25,
    communication: 0.25,
    technical: 0.15,
  },
  'Default': {
    technical: 0.35,
    problemSolving: 0.25,
    communication: 0.25,
    cultureFit: 0.15,
  },
};

// ============================================================================
// Decision Thresholds
// ============================================================================

export const DECISION_THRESHOLDS = {
  STRONG_HIRE: 8.5,  // Exceptional performance
  HIRE: 7.0,         // Good fit
  NO_HIRE: 5.0,      // Below bar
  STRONG_NO_HIRE: 3.0, // Clear no
};

// ============================================================================
// Prompt Templates
// ============================================================================

export function getAnalyzeResponsePrompt(
  question: string,
  answer: string,
  position: string,
  criteria: ScoringCriteria
): string {
  const criteriaList = Object.entries(criteria)
    .map(([key, desc]) => `- ${key}: ${desc}`)
    .join('\n');

  return `Analyze this interview response for a ${position} position.

QUESTION:
${question}

CANDIDATE'S ANSWER:
${answer}

EVALUATION CRITERIA:
${criteriaList}

Provide a JSON response with the following structure:
{
  "scores": {
    ${Object.keys(criteria).map(key => `"${key}": <score 0-10>`).join(',\n    ')}
  },
  "sentiment": <number between -1 (negative) and 1 (positive)>,
  "confidence": <number between 0 and 1 indicating your confidence in this assessment>,
  "strengths": [<list of 1-3 key strengths>],
  "weaknesses": [<list of 1-3 areas for improvement>],
  "summary": "<brief 1-2 sentence assessment>"
}

Be objective and fair. A score of 5 is average, 7-8 is good, 9-10 is exceptional.
Respond only with valid JSON, no additional text.`;
}

export function getExplainabilityPrompt(
  overallScore: number,
  categoryScores: Record<string, number>,
  strengths: string[],
  weaknesses: string[],
  decision: string,
  position: string
): string {
  return `Generate a human-readable explanation for this interview assessment.

POSITION: ${position}
OVERALL SCORE: ${overallScore.toFixed(1)}/10
DECISION: ${decision}

CATEGORY SCORES:
${Object.entries(categoryScores).map(([k, v]) => `- ${k}: ${v.toFixed(1)}/10`).join('\n')}

STRENGTHS:
${strengths.map(s => `- ${s}`).join('\n')}

AREAS FOR IMPROVEMENT:
${weaknesses.map(w => `- ${w}`).join('\n')}

Provide a JSON response:
{
  "summary": "<2-3 sentence summary explaining the decision>",
  "recommendation": "<specific hiring recommendation with reasoning>",
  "developmentAreas": [<list of specific areas where the candidate could grow>]
}

Be constructive and professional. Respond only with valid JSON.`;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the prompt configuration for a position
 * Falls back to Default if position not found
 */
export function getPromptForPosition(position: string): PositionPrompt {
  // Try exact match first
  if (SCORING_PROMPTS[position]) {
    return SCORING_PROMPTS[position];
  }
  
  // Try case-insensitive match
  const lowerPosition = position.toLowerCase();
  for (const [key, prompt] of Object.entries(SCORING_PROMPTS)) {
    if (key.toLowerCase() === lowerPosition) {
      return prompt;
    }
  }
  
  // Try partial match
  for (const [key, prompt] of Object.entries(SCORING_PROMPTS)) {
    if (lowerPosition.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerPosition)) {
      return prompt;
    }
  }
  
  return SCORING_PROMPTS['Default'];
}

/**
 * Get position weights for scoring
 * Falls back to Default if position not found
 */
export function getWeightsForPosition(position: string): Record<string, number> {
  // Try exact match first
  if (POSITION_WEIGHTS[position]) {
    return POSITION_WEIGHTS[position];
  }
  
  // Try case-insensitive match
  const lowerPosition = position.toLowerCase();
  for (const [key, weights] of Object.entries(POSITION_WEIGHTS)) {
    if (key.toLowerCase() === lowerPosition) {
      return weights;
    }
  }
  
  // Try partial match
  for (const [key, weights] of Object.entries(POSITION_WEIGHTS)) {
    if (lowerPosition.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerPosition)) {
      return weights;
    }
  }
  
  return POSITION_WEIGHTS['Default'];
}
