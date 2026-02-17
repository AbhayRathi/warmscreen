/**
 * Orchestrated Verifier Agent
 * 
 * Integrates the Verifier agent with the orchestration framework.
 * Performs fact-checking and consistency verification across agent outputs.
 */

import { AgentOutput } from '@warmscreen/shared';
import { BaseOrchestrationAgent } from './base-agent';
import { AgentTypes, AgentContext, AgentType } from './types';

/**
 * Verification check result
 */
export interface VerificationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Verification result structure
 */
export interface VerificationResult {
  isConsistent: boolean;
  isAccurate: boolean;
  confidence: number;
  checks: VerificationCheck[];
  issues: string[];
  recommendations: string[];
  reflexionRequired: boolean;
  agentToRefine?: AgentType;
  critiquePrompt?: string;
}

/**
 * Orchestrated Verifier Agent
 * 
 * Performs three-stage verification:
 * 1. Consistency Check - Score-tag alignment and agent agreement
 * 2. Factual Audit - Technical accuracy and concept coverage
 * 3. Reflexion Decision - Generate recommendations and confidence score
 */
export class VerifierOrchestrationAgent extends BaseOrchestrationAgent {
  readonly id = AgentTypes.VERIFIER;
  readonly name = 'Verifier Agent';
  readonly description = 'Fact-checking, consistency verification';
  readonly capabilities = [
    'consistency-check',
    'factual-audit',
    'agent-agreement-analysis',
    'reflexion-decision',
  ];

  /**
   * Confidence penalties for different issues
   */
  private static readonly CONFIDENCE_PENALTIES = {
    SCORE_TAG_MISALIGNMENT: 0.35,
    AGENT_DISAGREEMENT: 0.15,
    FACTUAL_ERROR: 0.3,
    LOW_COVERAGE: 0.1,
    SHORT_TRANSCRIPT: 0.2,
  };

  /**
   * Thresholds for verification
   */
  private static readonly THRESHOLDS = {
    HIGH_SCORE: 0.8,
    LOW_CONFIDENCE: 0.6,
    AGENT_DISAGREEMENT: 0.2,
    SHORT_TRANSCRIPT_LENGTH: 50,
  };

  /**
   * Negative tags that conflict with high scores
   */
  private static readonly NEGATIVE_TAGS = [
    'confused', 'incorrect', 'vague', 'incomplete', 'off-topic',
    'rambling', 'poor', 'weak', 'inadequate',
  ];

  /**
   * Related technical terms for concept matching
   */
  private static readonly RELATED_TERMS: Record<string, string[]> = {
    'one-way binding': ['unidirectional', 'one way', 'single direction', 'props down'],
    'two-way binding': ['bidirectional', 'two way', 'both directions', 'mutable'],
    'component': ['widget', 'element', 'module'],
    'state': ['data', 'variables', 'properties'],
    'props': ['properties', 'attributes', 'parameters'],
    'hooks': ['usestate', 'useeffect', 'usememo', 'custom hook'],
    'api': ['endpoint', 'rest', 'graphql', 'interface'],
  };

  /**
   * Perform verification of agent outputs
   */
  async analyze(context: AgentContext): Promise<AgentOutput> {
    const { question, response, previousAnalysis } = context;
    const transcript = response.transcript;

    // Get outputs from previous agents
    const analyzerOutput = previousAnalysis?.get(AgentTypes.ANALYZER);
    const taggerOutput = previousAnalysis?.get(AgentTypes.TAGGER);

    const verificationResult = await this.performVerification(
      transcript,
      question.expectedConcepts || [],
      question.keyFacts || [],
      analyzerOutput,
      taggerOutput
    );

    return this.createOutput(
      verificationResult,
      verificationResult.confidence,
      {
        checksPerformed: verificationResult.checks.length,
        issuesFound: verificationResult.issues.length,
      }
    );
  }

  /**
   * Perform three-stage verification
   */
  private async performVerification(
    transcript: string,
    expectedConcepts: string[],
    keyFacts: string[],
    analyzerOutput?: AgentOutput,
    taggerOutput?: AgentOutput
  ): Promise<VerificationResult> {
    const checks: VerificationCheck[] = [];
    const issues: string[] = [];
    let totalPenalty = 0;

    // Stage 1: Consistency Check
    const consistencyResult = this.performConsistencyCheck(
      analyzerOutput,
      taggerOutput,
      checks,
      issues
    );
    totalPenalty += consistencyResult.penalty;

    // Stage 2: Factual Audit
    const factualResult = this.performFactualAudit(
      transcript,
      expectedConcepts,
      keyFacts,
      checks,
      issues
    );
    totalPenalty += factualResult.penalty;

    // Stage 3: Reflexion Decision
    const reflexionDecision = this.generateReflexionDecision(
      consistencyResult.passed,
      factualResult.passed,
      issues,
      analyzerOutput,
      taggerOutput
    );

    // Calculate final confidence
    const confidence = Math.max(0, Math.min(1, 1 - totalPenalty));

    return {
      isConsistent: consistencyResult.passed,
      isAccurate: factualResult.passed,
      confidence,
      checks,
      issues,
      recommendations: reflexionDecision.recommendations,
      reflexionRequired: confidence < VerifierOrchestrationAgent.THRESHOLDS.LOW_CONFIDENCE,
      agentToRefine: reflexionDecision.agentToRefine,
      critiquePrompt: reflexionDecision.critiquePrompt,
    };
  }

  /**
   * Stage 1: Consistency Check
   */
  private performConsistencyCheck(
    analyzerOutput: AgentOutput | undefined,
    taggerOutput: AgentOutput | undefined,
    checks: VerificationCheck[],
    issues: string[]
  ): { passed: boolean; penalty: number } {
    let penalty = 0;
    let passed = true;

    // Check if we have outputs to verify
    if (!analyzerOutput || !taggerOutput) {
      checks.push({
        name: 'agent_outputs_present',
        passed: false,
        message: 'Missing agent outputs for verification',
        severity: 'high',
      });
      return { passed: false, penalty: 0.3 };
    }

    // Check score-tag alignment
    const analyzerScores = analyzerOutput.result?.scores || {};
    const avgScore = Object.values(analyzerScores).reduce((a: number, b) => a + (b as number), 0) / 
      Math.max(Object.values(analyzerScores).length, 1);
    const normalizedScore = avgScore / 10; // Normalize to 0-1

    const tags = taggerOutput.result?.skillTags || [];
    const behavioralTags = taggerOutput.result?.behavioralTags || [];
    const allTags = [...tags, ...behavioralTags];

    const hasNegativeTags = allTags.some((tag: string) =>
      VerifierOrchestrationAgent.NEGATIVE_TAGS.some(neg => 
        tag.toLowerCase().includes(neg)
      )
    );

    if (normalizedScore > VerifierOrchestrationAgent.THRESHOLDS.HIGH_SCORE && hasNegativeTags) {
      checks.push({
        name: 'score_tag_alignment',
        passed: false,
        message: 'High score with negative tags detected',
        severity: 'high',
      });
      issues.push('Score-tag misalignment: High score with negative tags');
      penalty += VerifierOrchestrationAgent.CONFIDENCE_PENALTIES.SCORE_TAG_MISALIGNMENT;
      passed = false;
    } else {
      checks.push({
        name: 'score_tag_alignment',
        passed: true,
        message: 'Scores and tags are aligned',
        severity: 'low',
      });
    }

    // Check agent confidence agreement
    const confidences = [analyzerOutput.confidence, taggerOutput.confidence];
    const maxConfidence = Math.max(...confidences);
    const minConfidence = Math.min(...confidences);
    const confidenceDiff = maxConfidence - minConfidence;

    if (confidenceDiff > VerifierOrchestrationAgent.THRESHOLDS.AGENT_DISAGREEMENT) {
      checks.push({
        name: 'confidence_agreement',
        passed: false,
        message: `Agent confidence disagreement: ${confidenceDiff.toFixed(2)}`,
        severity: 'medium',
      });
      issues.push(`Agent disagreement: Confidence range ${confidenceDiff.toFixed(2)}`);
      penalty += VerifierOrchestrationAgent.CONFIDENCE_PENALTIES.AGENT_DISAGREEMENT;
      passed = false;
    } else {
      checks.push({
        name: 'confidence_agreement',
        passed: true,
        message: 'Agent confidences are consistent',
        severity: 'low',
      });
    }

    return { passed, penalty };
  }

  /**
   * Stage 2: Factual Audit
   */
  private performFactualAudit(
    transcript: string,
    expectedConcepts: string[],
    keyFacts: string[],
    checks: VerificationCheck[],
    issues: string[]
  ): { passed: boolean; penalty: number } {
    let penalty = 0;
    let passed = true;
    const lowerTranscript = transcript.toLowerCase();

    // Check transcript length
    if (transcript.trim().length === 0) {
      checks.push({
        name: 'transcript_present',
        passed: false,
        message: 'Empty transcript',
        severity: 'high',
      });
      issues.push('Empty transcript - no content to verify');
      return { passed: false, penalty: 0.5 };
    }

    if (transcript.length < VerifierOrchestrationAgent.THRESHOLDS.SHORT_TRANSCRIPT_LENGTH) {
      checks.push({
        name: 'transcript_length',
        passed: false,
        message: 'Very short transcript',
        severity: 'medium',
      });
      issues.push('Very short transcript may lack sufficient detail');
      penalty += VerifierOrchestrationAgent.CONFIDENCE_PENALTIES.SHORT_TRANSCRIPT;
    } else {
      checks.push({
        name: 'transcript_length',
        passed: true,
        message: 'Transcript has adequate length',
        severity: 'low',
      });
    }

    // Check concept coverage
    if (expectedConcepts.length > 0) {
      const coverageScore = this.calculateConceptCoverage(lowerTranscript, expectedConcepts);
      
      if (coverageScore < 0.5) {
        checks.push({
          name: 'concept_coverage',
          passed: false,
          message: `Low concept coverage: ${(coverageScore * 100).toFixed(0)}%`,
          severity: 'medium',
        });
        issues.push(`Low concept coverage: ${(coverageScore * 100).toFixed(0)}% of expected concepts`);
        penalty += (1 - coverageScore) * VerifierOrchestrationAgent.CONFIDENCE_PENALTIES.LOW_COVERAGE;
        passed = false;
      } else {
        checks.push({
          name: 'concept_coverage',
          passed: true,
          message: `Good concept coverage: ${(coverageScore * 100).toFixed(0)}%`,
          severity: 'low',
        });
      }
    }

    // Check for factual contradictions
    const contradictions = this.detectContradictions(lowerTranscript, keyFacts);
    if (contradictions.length > 0) {
      checks.push({
        name: 'factual_accuracy',
        passed: false,
        message: 'Factual contradictions detected',
        severity: 'high',
      });
      issues.push(...contradictions);
      penalty += VerifierOrchestrationAgent.CONFIDENCE_PENALTIES.FACTUAL_ERROR;
      passed = false;
    } else {
      checks.push({
        name: 'factual_accuracy',
        passed: true,
        message: 'No factual contradictions detected',
        severity: 'low',
      });
    }

    return { passed, penalty };
  }

  /**
   * Calculate concept coverage with related terms
   */
  private calculateConceptCoverage(transcript: string, concepts: string[]): number {
    if (concepts.length === 0) return 1;

    let covered = 0;
    for (const concept of concepts) {
      const conceptLower = concept.toLowerCase();
      
      // Direct match
      if (transcript.includes(conceptLower)) {
        covered++;
        continue;
      }

      // Check related terms
      const relatedTerms = VerifierOrchestrationAgent.RELATED_TERMS[conceptLower] || [];
      if (relatedTerms.some(term => transcript.includes(term.toLowerCase()))) {
        covered++;
      }
    }

    return covered / concepts.length;
  }

  /**
   * Detect factual contradictions
   */
  private detectContradictions(transcript: string, keyFacts: string[]): string[] {
    const contradictions: string[] = [];
    const negationPatterns = [
      'not {}', 'no {}', 'never {}', "isn't {}", "doesn't {}",
      "don't {}", 'cannot {}', "can't {}",
    ];

    for (const fact of keyFacts) {
      const factLower = fact.toLowerCase();
      for (const pattern of negationPatterns) {
        const negated = pattern.replace('{}', factLower);
        if (transcript.includes(negated)) {
          contradictions.push(`Factual contradiction: "${negated}" contradicts expected knowledge`);
          break;
        }
      }
    }

    return contradictions;
  }

  /**
   * Stage 3: Generate Reflexion Decision
   */
  private generateReflexionDecision(
    consistencyPassed: boolean,
    factualPassed: boolean,
    issues: string[],
    analyzerOutput?: AgentOutput,
    taggerOutput?: AgentOutput
  ): {
    recommendations: string[];
    agentToRefine?: AgentType;
    critiquePrompt?: string;
  } {
    const recommendations: string[] = [];
    let agentToRefine: AgentType | undefined;
    let critiquePrompt: string | undefined;

    if (!consistencyPassed || !factualPassed) {
      // Determine which agent needs refinement
      if (issues.some(i => i.includes('Score-tag'))) {
        agentToRefine = AgentTypes.TAGGER;
        critiquePrompt = 'Review tag assignments - detected misalignment with scores. Ensure tags accurately reflect response quality.';
        recommendations.push('Re-evaluate tagging to better align with analysis scores');
      } else if (issues.some(i => i.includes('disagreement'))) {
        agentToRefine = AgentTypes.ANALYZER;
        critiquePrompt = 'Reassess analysis - significant disagreement detected. Review scoring criteria.';
        recommendations.push('Reassess analysis with more consistent scoring approach');
      } else if (issues.some(i => i.includes('contradiction'))) {
        agentToRefine = AgentTypes.ANALYZER;
        critiquePrompt = 'Verify factual accuracy - contradictions detected in response.';
        recommendations.push('Cross-check facts against expected knowledge base');
      } else if (issues.some(i => i.includes('coverage'))) {
        agentToRefine = AgentTypes.SCORER;
        critiquePrompt = 'Adjust scoring for incomplete responses.';
        recommendations.push('Consider penalizing incomplete concept coverage');
      }
    }

    if (consistencyPassed && factualPassed) {
      recommendations.push('All verification stages passed - accept analysis');
    }

    return { recommendations, agentToRefine, critiquePrompt };
  }
}

/**
 * Singleton instance
 */
let verifierInstance: VerifierOrchestrationAgent | null = null;

/**
 * Get the global Verifier agent instance
 */
export function getVerifierAgent(): VerifierOrchestrationAgent {
  if (!verifierInstance) {
    verifierInstance = new VerifierOrchestrationAgent();
  }
  return verifierInstance;
}

/**
 * Reset the Verifier agent (for testing)
 */
export function resetVerifierAgent(): void {
  verifierInstance = null;
}
