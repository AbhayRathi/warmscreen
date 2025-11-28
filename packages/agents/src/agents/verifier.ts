import { BaseAgent } from './base-agent';
import { AgentInput, AgentOutput } from '@warmscreen/shared';

export interface VerificationCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface VerificationResult {
  verified: boolean;
  checks: VerificationCheck[];
  issuesFound: number;
  recommendations: string[];
}

// New interfaces for the three-stage verification process
export interface ContextKnowledge {
  expectedConcepts: string[];
  idealResponseCharacteristics: string[];
  keyFacts: string[];
}

export interface AnalyzerOutput {
  score: number;
  confidence: number;
  insights: string[];
}

export interface TaggerOutput {
  tags: string[];
  confidence: number;
}

export interface ScorerOutput {
  overallScore: number;
  confidence: number;
}

export interface AgentOutputs {
  analyzer: AnalyzerOutput;
  tagger: TaggerOutput;
  scorer: ScorerOutput;
}

export interface VerifierInput {
  candidateTranscript: string;
  question: string;
  contextKnowledge: ContextKnowledge;
  agentOutputs: AgentOutputs;
}

export interface RecommendedRefinement {
  agent_to_refine: 'Analyzer' | 'Tagger' | 'Scorer' | 'None';
  critique_prompt_injection: string;
}

export interface VerifierOutput {
  confidence_score: number;
  is_consistent: boolean;
  is_accurate: boolean;
  reflexion_required: boolean;
  critique_reasoning: string;
  recommended_refinement: RecommendedRefinement;
}

// Negative tags that indicate poor response quality
const NEGATIVE_TAGS = [
  'vague answer',
  'missing key concept',
  'poor clarity',
  'incomplete answer',
  'lacks depth',
  'unclear explanation',
  'off-topic',
  'incorrect',
  'confused',
];

/**
 * Verifier Agent
 * Verifies the accuracy and consistency of other agents' outputs
 * 
 * Operates in three sequential stages:
 * 1. CONSISTENCY CHECK (Internal Audit)
 * 2. FACTUAL AUDIT (Truthfulness)
 * 3. REFLEXION DECISION (Output Generation)
 */
export class VerifierAgent extends BaseAgent {
  constructor() {
    super('VERIFIER');
  }

  /**
   * Execute the three-stage verification process with new VerifierInput format
   */
  async execute(input: VerifierInput): Promise<VerifierOutput>;
  async execute(input: AgentInput): Promise<AgentOutput>;
  async execute(input: VerifierInput | AgentInput): Promise<VerifierOutput | AgentOutput> {
    // Check if this is the new VerifierInput format
    if (this.isVerifierInput(input)) {
      return this.executeVerification(input);
    }
    
    // Legacy support for AgentInput format
    return this.executeLegacy(input as AgentInput);
  }

  private isVerifierInput(input: any): input is VerifierInput {
    return 'candidateTranscript' in input && 'agentOutputs' in input && 'contextKnowledge' in input;
  }

  /**
   * New verification process implementing the three stages
   */
  private async executeVerification(input: VerifierInput): Promise<VerifierOutput> {
    const { candidateTranscript, question, contextKnowledge, agentOutputs } = input;

    // Stage 1: CONSISTENCY CHECK
    const consistencyResult = this.performConsistencyCheck(agentOutputs);

    // Stage 2: FACTUAL AUDIT
    const factualResult = this.performFactualAudit(candidateTranscript, contextKnowledge);

    // Stage 3: REFLEXION DECISION
    return this.generateReflexionDecision(
      consistencyResult,
      factualResult,
      agentOutputs,
      candidateTranscript
    );
  }

  /**
   * Stage 1: CONSISTENCY CHECK
   * - Goal 1: Score-Tag Alignment
   * - Goal 2: Agent Agreement
   */
  private performConsistencyCheck(agentOutputs: AgentOutputs): {
    isConsistent: boolean;
    scoreTagAligned: boolean;
    agentAgreement: boolean;
    lowestConfidenceAgent: 'Analyzer' | 'Tagger' | 'Scorer';
    maxConfidenceDiff: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    
    // Goal 1: Score-Tag Alignment
    const hasNegativeTags = this.hasNegativeTags(agentOutputs.tagger.tags);
    const hasHighScore = agentOutputs.analyzer.score > 0.8 || agentOutputs.scorer.overallScore > 0.8;
    const scoreTagAligned = !(hasNegativeTags && hasHighScore);

    if (!scoreTagAligned) {
      reasoning.push(
        `CRITICAL INCONSISTENCY: High scores (Analyzer: ${agentOutputs.analyzer.score}, Scorer: ${agentOutputs.scorer.overallScore}) ` +
        `conflict with negative tags (${agentOutputs.tagger.tags.join(', ')}). ` +
        `This indicates the Analyzer/Scorer may have overestimated quality or the Tagger incorrectly tagged the response.`
      );
    }

    // Goal 2: Agent Agreement (confidence comparison)
    const confidences = {
      Analyzer: agentOutputs.analyzer.confidence,
      Tagger: agentOutputs.tagger.confidence,
      Scorer: agentOutputs.scorer.confidence,
    };

    const confidenceValues = Object.values(confidences);
    const maxConfidence = Math.max(...confidenceValues);
    const minConfidence = Math.min(...confidenceValues);
    const maxConfidenceDiff = maxConfidence - minConfidence;
    const agentAgreement = maxConfidenceDiff <= 0.2;

    // Find lowest confidence agent
    const lowestConfidenceAgent = (Object.entries(confidences) as ['Analyzer' | 'Tagger' | 'Scorer', number][])
      .sort((a, b) => a[1] - b[1])[0][0];

    if (!agentAgreement) {
      reasoning.push(
        `MODERATE INCONSISTENCY: Agent confidence differs by ${maxConfidenceDiff.toFixed(2)} (threshold: 0.2). ` +
        `${lowestConfidenceAgent} has the lowest confidence (${confidences[lowestConfidenceAgent].toFixed(2)}) ` +
        `and should re-evaluate its assessment.`
      );
    }

    return {
      isConsistent: scoreTagAligned && agentAgreement,
      scoreTagAligned,
      agentAgreement,
      lowestConfidenceAgent,
      maxConfidenceDiff,
      reasoning,
    };
  }

  /**
   * Stage 2: FACTUAL AUDIT
   * - Goal 3: Technical Accuracy
   * - Goal 4: Depth (key concepts coverage)
   */
  private performFactualAudit(
    candidateTranscript: string,
    contextKnowledge: ContextKnowledge
  ): {
    isAccurate: boolean;
    hasFactualErrors: boolean;
    conceptsCovered: number;
    totalConcepts: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    const lowerTranscript = candidateTranscript.toLowerCase();

    // Handle empty or very short transcripts
    if (candidateTranscript.trim().length === 0) {
      reasoning.push('EMPTY TRANSCRIPT: No response provided to evaluate.');
      return {
        isAccurate: false,
        hasFactualErrors: false,
        conceptsCovered: 0,
        totalConcepts: contextKnowledge.expectedConcepts.length,
        reasoning,
      };
    }

    if (candidateTranscript.trim().length < 10) {
      reasoning.push('INSUFFICIENT RESPONSE: Transcript is too short to evaluate technical accuracy.');
      return {
        isAccurate: false,
        hasFactualErrors: false,
        conceptsCovered: 0,
        totalConcepts: contextKnowledge.expectedConcepts.length,
        reasoning,
      };
    }

    // Goal 3: Technical Accuracy - Check for contradictions with key facts
    let hasFactualErrors = false;
    for (const fact of contextKnowledge.keyFacts) {
      const factLower = fact.toLowerCase();
      
      // Check for specific contradictions
      if (factLower.includes('one-way') && lowerTranscript.includes('two-way')) {
        hasFactualErrors = true;
        reasoning.push(
          `FACTUAL ERROR: Candidate stated "two-way" binding but the key fact indicates "one-way" binding. ` +
          `This is an inaccurate/incorrect technical claim that contradicts the expected knowledge.`
        );
      }
      
      // Check for other contradictions (basic pattern matching)
      if (factLower.includes('does not') && this.checkPositiveAssertion(lowerTranscript, factLower)) {
        hasFactualErrors = true;
        reasoning.push(`FACTUAL ERROR: Candidate made a claim that contradicts: "${fact}"`);
      }
    }

    // Goal 4: Depth - Check for key concepts coverage
    let conceptsCovered = 0;
    for (const concept of contextKnowledge.expectedConcepts) {
      const conceptLower = concept.toLowerCase();
      // Allow for partial matches and related terms
      if (lowerTranscript.includes(conceptLower) || this.hasRelatedTerm(lowerTranscript, conceptLower)) {
        conceptsCovered++;
      }
    }

    const totalConcepts = contextKnowledge.expectedConcepts.length;
    const coverageRatio = totalConcepts > 0 ? conceptsCovered / totalConcepts : 0;

    if (coverageRatio < 0.5 && totalConcepts > 0) {
      reasoning.push(
        `LOW DEPTH: Only ${conceptsCovered}/${totalConcepts} expected concepts were mentioned ` +
        `(${(coverageRatio * 100).toFixed(0)}% coverage).`
      );
    }

    // Accuracy is true only if no factual errors and reasonable coverage
    const isAccurate = !hasFactualErrors && (totalConcepts === 0 || coverageRatio >= 0.3);

    return {
      isAccurate,
      hasFactualErrors,
      conceptsCovered,
      totalConcepts,
      reasoning,
    };
  }

  /**
   * Stage 3: REFLEXION DECISION
   * Generate the final output based on the audit results
   */
  private generateReflexionDecision(
    consistencyResult: ReturnType<typeof this.performConsistencyCheck>,
    factualResult: ReturnType<typeof this.performFactualAudit>,
    agentOutputs: AgentOutputs,
    candidateTranscript: string
  ): VerifierOutput {
    const allReasoning = [...consistencyResult.reasoning, ...factualResult.reasoning];

    // Calculate confidence score
    let confidenceScore = 1.0;

    // Reduce confidence for inconsistencies
    if (!consistencyResult.scoreTagAligned) {
      confidenceScore -= 0.35;
    }
    if (!consistencyResult.agentAgreement) {
      confidenceScore -= 0.15 + (consistencyResult.maxConfidenceDiff * 0.2);
    }

    // Reduce confidence for factual issues
    if (factualResult.hasFactualErrors) {
      confidenceScore -= 0.25;
    }
    if (factualResult.totalConcepts > 0) {
      const coverageRatio = factualResult.conceptsCovered / factualResult.totalConcepts;
      if (coverageRatio < 0.5) {
        confidenceScore -= 0.1 * (1 - coverageRatio);
      }
    }

    // Reduce confidence for empty/short transcripts
    if (candidateTranscript.trim().length === 0) {
      confidenceScore = Math.min(confidenceScore, 0.3);
    } else if (candidateTranscript.trim().length < 20) {
      confidenceScore -= 0.2;
    }

    // Factor in average agent confidence
    const avgAgentConfidence = (
      agentOutputs.analyzer.confidence +
      agentOutputs.tagger.confidence +
      agentOutputs.scorer.confidence
    ) / 3;
    confidenceScore = confidenceScore * 0.7 + avgAgentConfidence * 0.3;

    // Clamp confidence score
    confidenceScore = Math.max(0, Math.min(1, confidenceScore));

    // Determine reflexion requirement
    const reflexionRequired = confidenceScore < 0.8 || !consistencyResult.isConsistent;

    // Determine which agent to refine
    let agentToRefine: 'Analyzer' | 'Tagger' | 'Scorer' | 'None' = 'None';
    let critiquePrompt = '';

    if (reflexionRequired) {
      if (!consistencyResult.scoreTagAligned) {
        // Score-tag misalignment - need to figure out which is wrong
        const hasNegativeTags = this.hasNegativeTags(agentOutputs.tagger.tags);
        if (hasNegativeTags) {
          // Tags are negative but scores are high - likely Analyzer/Scorer overestimated
          agentToRefine = agentOutputs.analyzer.score >= agentOutputs.scorer.overallScore ? 'Analyzer' : 'Scorer';
          critiquePrompt = `Please re-evaluate your scoring. The Tagger identified negative quality indicators (${agentOutputs.tagger.tags.join(', ')}). Consider if your score aligns with these issues.`;
        } else {
          agentToRefine = 'Tagger';
          critiquePrompt = 'Please re-evaluate your tags. The response received high scores, so verify if the tags accurately reflect the quality.';
        }
      } else if (!consistencyResult.agentAgreement) {
        agentToRefine = consistencyResult.lowestConfidenceAgent;
        critiquePrompt = `Please re-evaluate your assessment with higher confidence. Your confidence (${agentOutputs[agentToRefine.toLowerCase() as keyof AgentOutputs]?.confidence?.toFixed(2) || 'N/A'}) is significantly lower than peer agents.`;
      } else if (factualResult.hasFactualErrors) {
        agentToRefine = 'Analyzer';
        critiquePrompt = 'Please re-evaluate the technical accuracy. A factual error was detected that contradicts the expected knowledge.';
      } else {
        // Low overall confidence
        agentToRefine = consistencyResult.lowestConfidenceAgent;
        critiquePrompt = `Please re-evaluate your assessment with additional rigor. The overall verification confidence is low (${confidenceScore.toFixed(2)}).`;
      }
    }

    // Build the critique reasoning narrative
    let critiqueReasoning: string;
    if (allReasoning.length > 0) {
      critiqueReasoning = `Verification Analysis: ${allReasoning.join(' ')} ` +
        `Final confidence: ${confidenceScore.toFixed(2)}. ` +
        (reflexionRequired ? `Reflexion required - ${agentToRefine} agent needs refinement.` : 'All checks passed.');
    } else {
      critiqueReasoning = `Verification Analysis: All consistency and factual checks passed. ` +
        `Agent outputs are aligned with scores (Analyzer: ${agentOutputs.analyzer.score.toFixed(2)}, ` +
        `Scorer: ${agentOutputs.scorer.overallScore.toFixed(2)}) matching positive tags. ` +
        `Candidate transcript covers expected concepts adequately. ` +
        `Final confidence: ${confidenceScore.toFixed(2)}.`;
    }

    return {
      confidence_score: confidenceScore,
      is_consistent: consistencyResult.isConsistent,
      is_accurate: factualResult.isAccurate,
      reflexion_required: reflexionRequired,
      critique_reasoning: critiqueReasoning,
      recommended_refinement: {
        agent_to_refine: agentToRefine,
        critique_prompt_injection: critiquePrompt,
      },
    };
  }

  /**
   * Check if any tags are negative quality indicators
   */
  private hasNegativeTags(tags: string[]): boolean {
    const lowerTags = tags.map(t => t.toLowerCase());
    return lowerTags.some(tag => 
      NEGATIVE_TAGS.some(negTag => tag.includes(negTag))
    );
  }

  /**
   * Check if transcript has related terms for a concept
   */
  private hasRelatedTerm(transcript: string, concept: string): boolean {
    // Define related terms for common concepts
    const relatedTerms: Record<string, string[]> = {
      'one-way binding': ['unidirectional', 'one way', 'single direction', 'props down', 'one-way data binding'],
      'data flow': ['data flows', 'flow of data', 'information flow'],
      'props': ['properties', 'prop', 'parent to child'],
      'state management': ['managing state', 'state handling'],
      'hooks': ['hook', 'usestate', 'useeffect', 'usereducer'],
      'usestate': ['use state', 'state hook'],
    };

    const related = relatedTerms[concept] || [];
    return related.some(term => transcript.includes(term));
  }

  /**
   * Check for positive assertion that might contradict a negative fact
   */
  private checkPositiveAssertion(transcript: string, factWithNegation: string): boolean {
    // Extract the subject from "X does not Y" pattern
    const match = factWithNegation.match(/(.+?)\s+does not\s+(.+)/i);
    if (match) {
      const subject = match[1].trim();
      const action = match[2].trim();
      // Check if transcript positively asserts the action
      return transcript.includes(subject) && transcript.includes(action) && !transcript.includes('does not');
    }
    return false;
  }

  // Legacy execute method for backward compatibility
  private async executeLegacy(input: AgentInput): Promise<AgentOutput> {
    const { context, previousOutput, reflexionLoop = 0 } = input;
    const { agentOutputs } = context;

    const verification = await this.verifyOutputs(agentOutputs);
    const confidence = this.calculateVerificationConfidence(verification);

    const output = this.createOutput(verification, confidence, {
      checksPerformed: verification.checks.length,
    }, reflexionLoop);

    if (output.shouldReflect && reflexionLoop < this.maxReflexionLoops) {
      return this.reflect(output, input);
    }

    return output;
  }

  private async verifyOutputs(agentOutputs: AgentOutput[]): Promise<VerificationResult> {
    const checks: VerificationCheck[] = [];
    
    // Check consistency across agents
    const confidences = agentOutputs.map(o => o.confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    checks.push({
      name: 'confidence_consistency',
      passed: confidences.every(c => Math.abs(c - avgConfidence) < 0.3),
      message: 'Agent confidences are consistent',
    });

    // Check for outliers
    const scores = agentOutputs
      .filter(o => o.result.scores)
      .flatMap(o => Object.values(o.result.scores) as number[]);
    checks.push({
      name: 'score_validation',
      passed: scores.every(s => s >= 0 && s <= 10),
      message: 'All scores within valid range',
    });

    const allChecksPassed = checks.every(c => c.passed);

    return {
      verified: allChecksPassed,
      checks,
      issuesFound: checks.filter(c => !c.passed).length,
      recommendations: allChecksPassed ? [] : ['Re-run agents with failed checks'],
    };
  }

  private calculateVerificationConfidence(verification: VerificationResult): number {
    const passedChecks = verification.checks.filter(c => c.passed).length;
    const totalChecks = verification.checks.length;
    return totalChecks > 0 ? passedChecks / totalChecks : 0.5;
  }
}
