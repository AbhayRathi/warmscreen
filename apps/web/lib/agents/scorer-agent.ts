/**
 * Orchestrated Scorer Agent
 * 
 * Integrates the Scorer agent with the orchestration framework.
 * Calculates multi-dimensional scores using position-specific models.
 */

import { AgentOutput } from '@warmscreen/shared';
import { calculateAverageScore, normalizeScore } from '@warmscreen/shared';
import { BaseOrchestrationAgent } from './base-agent';
import { AgentTypes, AgentContext, AgentType } from './types';

/**
 * Decision type
 */
export type HiringDecision = 'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE';

/**
 * Scoring model definition
 */
export interface ScoringModel {
  version: number;
  weights: Record<string, number>;
  thresholds: {
    strong_hire: number;
    hire: number;
    no_hire: number;
  };
  adjustments?: Record<string, number>;
}

/**
 * Scoring result structure
 */
export interface ScoringResult {
  overallScore: number;
  componentScores: Record<string, number>;
  decision: HiringDecision;
  decisionConfidence: number;
  weights: Record<string, number>;
  thresholds: { strong_hire: number; hire: number; no_hire: number };
  breakdown: {
    category: string;
    rawScore: number;
    weight: number;
    weightedScore: number;
  }[];
}

/**
 * Orchestrated Scorer Agent
 * 
 * Responsibilities:
 * - Apply position-specific scoring models
 * - Calculate weighted scores across dimensions
 * - Generate hiring decisions with confidence
 * - Support model customization per position
 */
export class ScorerOrchestrationAgent extends BaseOrchestrationAgent {
  readonly id = AgentTypes.SCORER;
  readonly name = 'Scorer Agent';
  readonly description = 'Multi-dimensional scoring using position-specific models';
  readonly capabilities = [
    'weighted-scoring',
    'decision-generation',
    'model-application',
    'threshold-evaluation',
  ];

  /**
   * Default scoring models by position type
   */
  private static readonly DEFAULT_MODELS: Record<string, ScoringModel> = {
    'Software Engineer': {
      version: 1,
      weights: {
        technical: 0.40,
        problemSolving: 0.25,
        communication: 0.20,
        cultural: 0.15,
      },
      thresholds: { strong_hire: 85, hire: 70, no_hire: 55 },
    },
    'Frontend Engineer': {
      version: 1,
      weights: {
        technical: 0.35,
        communication: 0.25,
        problemSolving: 0.20,
        design: 0.10,
        cultural: 0.10,
      },
      thresholds: { strong_hire: 82, hire: 68, no_hire: 52 },
    },
    'Backend Engineer': {
      version: 1,
      weights: {
        technical: 0.45,
        problemSolving: 0.25,
        systemDesign: 0.15,
        communication: 0.10,
        cultural: 0.05,
      },
      thresholds: { strong_hire: 85, hire: 72, no_hire: 58 },
    },
    'Engineering Manager': {
      version: 1,
      weights: {
        leadership: 0.30,
        communication: 0.25,
        technical: 0.20,
        strategic: 0.15,
        cultural: 0.10,
      },
      thresholds: { strong_hire: 80, hire: 65, no_hire: 50 },
    },
    'Product Manager': {
      version: 1,
      weights: {
        communication: 0.30,
        analytical: 0.25,
        strategic: 0.20,
        technical: 0.15,
        cultural: 0.10,
      },
      thresholds: { strong_hire: 78, hire: 65, no_hire: 50 },
    },
    'default': {
      version: 1,
      weights: {
        technical: 0.35,
        communication: 0.25,
        problemSolving: 0.25,
        cultural: 0.15,
      },
      thresholds: { strong_hire: 85, hire: 70, no_hire: 55 },
    },
  };

  /**
   * Perform scoring based on previous agent outputs
   */
  async analyze(context: AgentContext): Promise<AgentOutput> {
    const { position, previousAnalysis } = context;

    // Get outputs from previous agents
    const analyzerOutput = previousAnalysis?.get(AgentTypes.ANALYZER);
    const taggerOutput = previousAnalysis?.get(AgentTypes.TAGGER);
    const verifierOutput = previousAnalysis?.get(AgentTypes.VERIFIER);

    // Get appropriate scoring model
    const scoringModel = this.getScoringModel(position);

    // Calculate scores
    const scoringResult = await this.calculateScores(
      analyzerOutput,
      taggerOutput,
      verifierOutput,
      scoringModel
    );

    return this.createOutput(
      scoringResult,
      scoringResult.decisionConfidence,
      {
        modelVersion: scoringModel.version,
        position,
        agentInputsUsed: [
          analyzerOutput ? 'ANALYZER' : null,
          taggerOutput ? 'TAGGER' : null,
          verifierOutput ? 'VERIFIER' : null,
        ].filter(Boolean),
      }
    );
  }

  /**
   * Get the scoring model for a position
   */
  private getScoringModel(position: string): ScoringModel {
    return ScorerOrchestrationAgent.DEFAULT_MODELS[position] ||
      ScorerOrchestrationAgent.DEFAULT_MODELS['default'];
  }

  /**
   * Calculate scores from agent outputs
   */
  private async calculateScores(
    analyzerOutput: AgentOutput | undefined,
    taggerOutput: AgentOutput | undefined,
    verifierOutput: AgentOutput | undefined,
    model: ScoringModel
  ): Promise<ScoringResult> {
    // Extract component scores from analyzer
    const componentScores: Record<string, number> = {};
    const breakdown: ScoringResult['breakdown'] = [];

    // Get scores from analyzer output
    if (analyzerOutput?.result?.scores) {
      const scores = analyzerOutput.result.scores;
      for (const [key, value] of Object.entries(scores)) {
        if (typeof value === 'number') {
          componentScores[key] = value;
        }
      }
    }

    // Add tagger-derived scores
    if (taggerOutput?.result) {
      const tags = taggerOutput.result;
      
      // Convert skill tags to competency scores
      if (tags.skillTags?.length > 0) {
        const skillScore = Math.min(10, 5 + tags.skillTags.length * 0.5);
        if (!componentScores.skillDiversity) {
          componentScores.skillDiversity = skillScore;
        }
      }

      // Convert behavioral tags to cultural fit score
      if (tags.behavioralTags?.length > 0) {
        const culturalScore = Math.min(10, 5 + tags.behavioralTags.length * 0.6);
        if (!componentScores.cultural) {
          componentScores.cultural = culturalScore;
        }
      }

      // Add sentiment as a factor
      if (typeof tags.sentiment === 'number') {
        componentScores.attitude = normalizeScore((tags.sentiment + 1) * 5, 1, 10);
      }
    }

    // Apply verification adjustments
    if (verifierOutput?.result) {
      const verification = verifierOutput.result;
      
      // Penalize if verification failed
      if (!verification.isConsistent || !verification.isAccurate) {
        for (const key of Object.keys(componentScores)) {
          componentScores[key] = componentScores[key] * 0.9; // 10% penalty
        }
      }
    }

    // Fill missing scores with defaults
    for (const key of Object.keys(model.weights)) {
      if (componentScores[key] === undefined) {
        componentScores[key] = 5.0; // Default neutral score
      }
    }

    // Calculate weighted score
    let weightedScore = 0;
    for (const [key, weight] of Object.entries(model.weights)) {
      const rawScore = componentScores[key] || 5;
      const weightedContribution = rawScore * weight;
      weightedScore += weightedContribution;

      breakdown.push({
        category: key,
        rawScore,
        weight,
        weightedScore: weightedContribution,
      });
    }

    // Normalize to 0-100 scale
    const overallScore = normalizeScore(weightedScore * 10, 0, 100);

    // Determine decision
    const decision = this.determineDecision(overallScore, model.thresholds);

    // Calculate decision confidence
    const decisionConfidence = this.calculateDecisionConfidence(
      overallScore,
      model.thresholds,
      componentScores,
      analyzerOutput?.confidence || 0.5,
      taggerOutput?.confidence || 0.5
    );

    return {
      overallScore,
      componentScores,
      decision,
      decisionConfidence,
      weights: model.weights,
      thresholds: model.thresholds,
      breakdown,
    };
  }

  /**
   * Determine hiring decision based on score and thresholds
   */
  private determineDecision(
    score: number,
    thresholds: { strong_hire: number; hire: number; no_hire: number }
  ): HiringDecision {
    if (score >= thresholds.strong_hire) {
      return 'STRONG_HIRE';
    } else if (score >= thresholds.hire) {
      return 'HIRE';
    } else if (score >= thresholds.no_hire) {
      return 'NO_HIRE';
    } else {
      return 'STRONG_NO_HIRE';
    }
  }

  /**
   * Calculate confidence in the hiring decision
   */
  private calculateDecisionConfidence(
    score: number,
    thresholds: { strong_hire: number; hire: number; no_hire: number },
    componentScores: Record<string, number>,
    analyzerConfidence: number,
    taggerConfidence: number
  ): number {
    // Base confidence from input agents
    let confidence = (analyzerConfidence + taggerConfidence) / 2;

    // Adjust for score certainty (how far from thresholds)
    const distances = [
      Math.abs(score - thresholds.strong_hire),
      Math.abs(score - thresholds.hire),
      Math.abs(score - thresholds.no_hire),
    ];
    const minDistance = Math.min(...distances);
    
    // Higher confidence when far from decision boundaries
    if (minDistance > 10) {
      confidence += 0.1;
    } else if (minDistance < 3) {
      confidence -= 0.15; // Lower confidence when near boundary
    }

    // Adjust for score variance (consistent scores = higher confidence)
    const scores = Object.values(componentScores);
    if (scores.length > 1) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
      
      if (variance < 1) {
        confidence += 0.05; // Low variance = consistent
      } else if (variance > 4) {
        confidence -= 0.1; // High variance = inconsistent
      }
    }

    return Math.min(1, Math.max(0.3, confidence));
  }

  /**
   * Override reflect to consider more data sources
   */
  protected async reflect(
    previousOutput: AgentOutput,
    context: AgentContext
  ): Promise<AgentOutput> {
    // Re-analyze with adjusted weights for low-confidence areas
    const output = await this.analyze(context);
    
    // Combine insights from both passes
    const previousResult = previousOutput.result as ScoringResult;
    const currentResult = output.result as ScoringResult;

    // Average the scores for more stability
    const refinedComponentScores: Record<string, number> = {};
    const allKeys = new Set([
      ...Object.keys(previousResult.componentScores),
      ...Object.keys(currentResult.componentScores),
    ]);

    for (const key of allKeys) {
      const prev = previousResult.componentScores[key] || 5;
      const curr = currentResult.componentScores[key] || 5;
      refinedComponentScores[key] = (prev + curr) / 2;
    }

    const refinedScore = (previousResult.overallScore + currentResult.overallScore) / 2;

    return this.createOutput(
      {
        ...currentResult,
        componentScores: refinedComponentScores,
        overallScore: refinedScore,
        decisionConfidence: Math.min(1, currentResult.decisionConfidence + 0.1),
      },
      Math.min(1, currentResult.decisionConfidence + 0.1),
      { refined: true, reflexionLoop: previousOutput.reflexionLoop + 1 },
      previousOutput.reflexionLoop + 1
    );
  }
}

/**
 * Singleton instance
 */
let scorerInstance: ScorerOrchestrationAgent | null = null;

/**
 * Get the global Scorer agent instance
 */
export function getScorerAgent(): ScorerOrchestrationAgent {
  if (!scorerInstance) {
    scorerInstance = new ScorerOrchestrationAgent();
  }
  return scorerInstance;
}

/**
 * Reset the Scorer agent (for testing)
 */
export function resetScorerAgent(): void {
  scorerInstance = null;
}
