/**
 * Orchestrated Narrator Agent
 * 
 * Integrates the Narrator agent with the orchestration framework.
 * Generates human-readable explanations of decisions and outcomes.
 */

import { AgentOutput, DecisionExplanation } from '@warmscreen/shared';
import { BaseOrchestrationAgent } from './base-agent';
import { AgentTypes, AgentContext, AgentType } from './types';
import { ScoringResult, HiringDecision } from './scorer-agent';

/**
 * Narration result structure
 */
export interface NarrationResult {
  summary: string;
  detailedExplanation: string;
  strengths: string[];
  weaknesses: string[];
  keyFactors: {
    factor: string;
    impact: number;
    evidence: string[];
  }[];
  recommendations: string[];
  scoringBreakdown: Record<string, number>;
  agentContributions: Record<string, string>;
  confidence: number;
}

/**
 * Orchestrated Narrator Agent
 * 
 * Responsibilities:
 * - Generate human-readable summaries
 * - Explain hiring decisions
 * - Highlight strengths and areas for improvement
 * - Create stakeholder-appropriate narratives
 */
export class NarratorOrchestrationAgent extends BaseOrchestrationAgent {
  readonly id = AgentTypes.NARRATOR;
  readonly name = 'Narrator Agent';
  readonly description = 'Human-readable explanations of decisions';
  readonly capabilities = [
    'summary-generation',
    'decision-explanation',
    'strength-weakness-analysis',
    'stakeholder-communication',
  ];

  /**
   * Decision explanations templates
   */
  private static readonly DECISION_TEMPLATES: Record<HiringDecision, string> = {
    'STRONG_HIRE': 'demonstrates exceptional qualifications and is highly recommended for the position',
    'HIRE': 'shows solid competencies that meet our requirements and is recommended for the position',
    'NO_HIRE': 'does not fully meet the requirements at this time and is not recommended for the position',
    'STRONG_NO_HIRE': 'does not demonstrate the necessary qualifications and is not recommended to proceed',
  };

  /**
   * Score thresholds for strength/weakness classification
   */
  private static readonly SCORE_THRESHOLDS = {
    STRENGTH: 7.5,
    WEAKNESS: 5.5,
  };

  /**
   * Generate human-readable explanation
   */
  async analyze(context: AgentContext): Promise<AgentOutput> {
    const { position, candidateName, previousAnalysis } = context;

    // Get outputs from previous agents
    const analyzerOutput = previousAnalysis?.get(AgentTypes.ANALYZER);
    const taggerOutput = previousAnalysis?.get(AgentTypes.TAGGER);
    const verifierOutput = previousAnalysis?.get(AgentTypes.VERIFIER);
    const scorerOutput = previousAnalysis?.get(AgentTypes.SCORER);

    const narrationResult = await this.generateNarration(
      candidateName || 'The candidate',
      position,
      analyzerOutput,
      taggerOutput,
      verifierOutput,
      scorerOutput
    );

    return this.createOutput(
      narrationResult,
      narrationResult.confidence,
      {
        wordCount: narrationResult.summary.split(/\s+/).length,
        hasDetailedExplanation: narrationResult.detailedExplanation.length > 0,
      }
    );
  }

  /**
   * Generate comprehensive narration
   */
  private async generateNarration(
    candidateName: string,
    position: string,
    analyzerOutput?: AgentOutput,
    taggerOutput?: AgentOutput,
    verifierOutput?: AgentOutput,
    scorerOutput?: AgentOutput
  ): Promise<NarrationResult> {
    // Get scoring result
    const scoringResult = scorerOutput?.result as ScoringResult | undefined;
    const decision = scoringResult?.decision || 'NO_HIRE';
    const overallScore = scoringResult?.overallScore || 0;

    // Generate summary
    const summary = this.generateSummary(candidateName, position, decision, overallScore);

    // Generate detailed explanation
    const detailedExplanation = this.generateDetailedExplanation(
      candidateName,
      position,
      decision,
      scoringResult,
      analyzerOutput,
      taggerOutput
    );

    // Extract strengths and weaknesses
    const { strengths, weaknesses } = this.extractStrengthsWeaknesses(
      analyzerOutput,
      taggerOutput,
      scoringResult
    );

    // Identify key factors
    const keyFactors = this.identifyKeyFactors(scoringResult, analyzerOutput);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      decision,
      weaknesses,
      verifierOutput
    );

    // Get scoring breakdown
    const scoringBreakdown = scoringResult?.componentScores || {};

    // Generate agent contributions
    const agentContributions = this.generateAgentContributions(
      analyzerOutput,
      taggerOutput,
      verifierOutput,
      scorerOutput
    );

    // Calculate narration confidence
    const confidence = this.calculateNarrationConfidence(
      strengths,
      weaknesses,
      keyFactors,
      scorerOutput?.confidence || 0.5
    );

    return {
      summary,
      detailedExplanation,
      strengths,
      weaknesses,
      keyFactors,
      recommendations,
      scoringBreakdown,
      agentContributions,
      confidence,
    };
  }

  /**
   * Generate executive summary
   */
  private generateSummary(
    candidateName: string,
    position: string,
    decision: HiringDecision,
    score: number
  ): string {
    const decisionText = NarratorOrchestrationAgent.DECISION_TEMPLATES[decision];
    
    return `${candidateName} interviewed for the ${position} position and ${decisionText} ` +
      `with an overall score of ${score.toFixed(1)}/100. ` +
      `This assessment is based on comprehensive analysis across technical competency, ` +
      `communication skills, problem-solving ability, and cultural alignment.`;
  }

  /**
   * Generate detailed explanation
   */
  private generateDetailedExplanation(
    candidateName: string,
    position: string,
    decision: HiringDecision,
    scoringResult?: ScoringResult,
    analyzerOutput?: AgentOutput,
    taggerOutput?: AgentOutput
  ): string {
    const parts: string[] = [];

    // Overview
    parts.push(`## Interview Assessment for ${candidateName}\n`);
    parts.push(`**Position:** ${position}\n`);
    parts.push(`**Recommendation:** ${decision.replace(/_/g, ' ')}\n`);

    if (scoringResult) {
      parts.push(`**Overall Score:** ${scoringResult.overallScore.toFixed(1)}/100\n`);
    }

    // Technical Assessment
    if (analyzerOutput?.result?.scores) {
      parts.push('\n### Technical Assessment\n');
      const scores = analyzerOutput.result.scores;
      for (const [key, value] of Object.entries(scores)) {
        if (typeof value === 'number') {
          const label = this.formatLabel(key);
          const rating = this.getScoreRating(value as number);
          parts.push(`- **${label}:** ${(value as number).toFixed(1)}/10 (${rating})\n`);
        }
      }
    }

    // Skills and Competencies
    if (taggerOutput?.result) {
      const tags = taggerOutput.result;
      if (tags.skillTags?.length > 0) {
        parts.push('\n### Demonstrated Skills\n');
        parts.push(tags.skillTags.map((t: string) => `- ${this.formatLabel(t)}`).join('\n') + '\n');
      }
      if (tags.behavioralTags?.length > 0) {
        parts.push('\n### Behavioral Indicators\n');
        parts.push(tags.behavioralTags.map((t: string) => `- ${this.formatLabel(t)}`).join('\n') + '\n');
      }
    }

    // Insights
    if (analyzerOutput?.result?.insights?.length > 0) {
      parts.push('\n### Key Insights\n');
      parts.push(analyzerOutput.result.insights.map((i: string) => `- ${i}`).join('\n') + '\n');
    }

    return parts.join('');
  }

  /**
   * Extract strengths and weaknesses
   */
  private extractStrengthsWeaknesses(
    analyzerOutput?: AgentOutput,
    taggerOutput?: AgentOutput,
    scoringResult?: ScoringResult
  ): { strengths: string[]; weaknesses: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // From analyzer scores
    if (analyzerOutput?.result?.scores) {
      const scores = analyzerOutput.result.scores;
      for (const [key, value] of Object.entries(scores)) {
        if (typeof value !== 'number') continue;
        
        const label = this.formatLabel(key);
        if (value >= NarratorOrchestrationAgent.SCORE_THRESHOLDS.STRENGTH) {
          strengths.push(`Strong ${label.toLowerCase()} skills demonstrated`);
        } else if (value < NarratorOrchestrationAgent.SCORE_THRESHOLDS.WEAKNESS) {
          weaknesses.push(`${label} could be improved`);
        }
      }
    }

    // From tagger
    if (taggerOutput?.result) {
      const tags = taggerOutput.result;
      
      if (tags.skillTags?.length >= 4) {
        strengths.push('Broad skill set demonstrated');
      } else if (tags.skillTags?.length <= 1) {
        weaknesses.push('Limited skill diversity shown');
      }

      if (tags.behavioralTags?.includes('growth-mindset')) {
        strengths.push('Shows continuous learning mindset');
      }
      if (tags.behavioralTags?.includes('collaborative')) {
        strengths.push('Strong collaboration indicators');
      }
      if (tags.behavioralTags?.includes('concrete-examples')) {
        strengths.push('Provides specific, concrete examples');
      }
    }

    // From scoring breakdown
    if (scoringResult?.breakdown) {
      for (const item of scoringResult.breakdown) {
        if (item.rawScore >= NarratorOrchestrationAgent.SCORE_THRESHOLDS.STRENGTH) {
          if (!strengths.some(s => s.toLowerCase().includes(item.category.toLowerCase()))) {
            strengths.push(`Excellent ${this.formatLabel(item.category).toLowerCase()}`);
          }
        } else if (item.rawScore < NarratorOrchestrationAgent.SCORE_THRESHOLDS.WEAKNESS) {
          if (!weaknesses.some(w => w.toLowerCase().includes(item.category.toLowerCase()))) {
            weaknesses.push(`${this.formatLabel(item.category)} needs development`);
          }
        }
      }
    }

    return {
      strengths: [...new Set(strengths)].slice(0, 5),
      weaknesses: [...new Set(weaknesses)].slice(0, 3),
    };
  }

  /**
   * Identify key factors in the decision
   */
  private identifyKeyFactors(
    scoringResult?: ScoringResult,
    analyzerOutput?: AgentOutput
  ): { factor: string; impact: number; evidence: string[] }[] {
    const factors: { factor: string; impact: number; evidence: string[] }[] = [];

    if (scoringResult?.breakdown) {
      for (const item of scoringResult.breakdown) {
        const impact = (item.rawScore - 5) / 5; // Normalize to -1 to 1
        factors.push({
          factor: this.formatLabel(item.category),
          impact,
          evidence: [
            `Scored ${item.rawScore.toFixed(1)}/10 in this area`,
            `Weight: ${(item.weight * 100).toFixed(0)}% of overall score`,
          ],
        });
      }
    }

    // Sort by absolute impact
    factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    return factors.slice(0, 5);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    decision: HiringDecision,
    weaknesses: string[],
    verifierOutput?: AgentOutput
  ): string[] {
    const recommendations: string[] = [];

    switch (decision) {
      case 'STRONG_HIRE':
        recommendations.push('Proceed to offer stage with competitive compensation');
        recommendations.push('Consider for leadership track or high-impact projects');
        break;
      case 'HIRE':
        recommendations.push('Proceed to offer stage');
        if (weaknesses.length > 0) {
          recommendations.push(`Create development plan focusing on: ${weaknesses[0]}`);
        }
        break;
      case 'NO_HIRE':
        recommendations.push('Consider for future opportunities as skills develop');
        recommendations.push('Provide constructive feedback for candidate development');
        break;
      case 'STRONG_NO_HIRE':
        recommendations.push('Thank candidate for their time');
        recommendations.push('Document assessment for future reference');
        break;
    }

    // Add verification-based recommendations
    if (verifierOutput?.result?.recommendations) {
      const verifierRecs = verifierOutput.result.recommendations as string[];
      recommendations.push(...verifierRecs.slice(0, 2));
    }

    return [...new Set(recommendations)].slice(0, 5);
  }

  /**
   * Generate agent contribution descriptions
   */
  private generateAgentContributions(
    analyzerOutput?: AgentOutput,
    taggerOutput?: AgentOutput,
    verifierOutput?: AgentOutput,
    scorerOutput?: AgentOutput
  ): Record<string, string> {
    const contributions: Record<string, string> = {};

    if (analyzerOutput) {
      contributions[AgentTypes.ANALYZER] = 
        `Analyzed technical and communication competencies with ${(analyzerOutput.confidence * 100).toFixed(0)}% confidence`;
    }

    if (taggerOutput) {
      const tagCount = (taggerOutput.result?.skillTags?.length || 0) + 
        (taggerOutput.result?.behavioralTags?.length || 0);
      contributions[AgentTypes.TAGGER] = 
        `Identified ${tagCount} skill and behavioral indicators`;
    }

    if (verifierOutput) {
      const status = verifierOutput.result?.isConsistent && verifierOutput.result?.isAccurate
        ? 'verified'
        : 'flagged concerns in';
      contributions[AgentTypes.VERIFIER] = 
        `${status.charAt(0).toUpperCase() + status.slice(1)} consistency and accuracy of assessments`;
    }

    if (scorerOutput) {
      contributions[AgentTypes.SCORER] = 
        `Calculated weighted scores and generated hiring recommendation`;
    }

    return contributions;
  }

  /**
   * Calculate narration confidence
   */
  private calculateNarrationConfidence(
    strengths: string[],
    weaknesses: string[],
    keyFactors: { factor: string; impact: number; evidence: string[] }[],
    scorerConfidence: number
  ): number {
    let confidence = scorerConfidence;

    // More complete narrative = higher confidence
    if (strengths.length > 0) confidence += 0.05;
    if (weaknesses.length > 0) confidence += 0.05;
    if (keyFactors.length >= 3) confidence += 0.05;

    return Math.min(1, Math.max(0.3, confidence));
  }

  /**
   * Format a label for display
   */
  private formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/-/g, ' ')
      .trim();
  }

  /**
   * Get rating description for a score
   */
  private getScoreRating(score: number): string {
    if (score >= 9) return 'Exceptional';
    if (score >= 8) return 'Strong';
    if (score >= 7) return 'Good';
    if (score >= 6) return 'Satisfactory';
    if (score >= 5) return 'Average';
    if (score >= 4) return 'Below Average';
    return 'Needs Improvement';
  }
}

/**
 * Singleton instance
 */
let narratorInstance: NarratorOrchestrationAgent | null = null;

/**
 * Get the global Narrator agent instance
 */
export function getNarratorAgent(): NarratorOrchestrationAgent {
  if (!narratorInstance) {
    narratorInstance = new NarratorOrchestrationAgent();
  }
  return narratorInstance;
}

/**
 * Reset the Narrator agent (for testing)
 */
export function resetNarratorAgent(): void {
  narratorInstance = null;
}
