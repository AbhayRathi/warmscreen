import { BaseAgent } from './base-agent';
import { AgentInput, AgentOutput } from '@warmscreen/shared';

// Legacy interfaces for backward compatibility
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

// New three-stage verification interfaces
export interface VerifierInput {
  candidateTranscript: string;
  question: string;
  contextKnowledge: {
    expectedConcepts: string[];
    idealResponseCharacteristics?: string[];
    keyFacts?: string[];
  };
  agentOutputs: {
    analyzer: { score: number; confidence: number; insights: string[] };
    tagger: { tags: string[]; confidence: number };
    scorer: { overallScore: number; confidence: number; breakdown?: any };
  };
}

export interface VerifierOutput {
  confidence_score: number;        // 0.0-1.0 overall confidence
  is_consistent: boolean;          // Passed consistency check?
  is_accurate: boolean;            // Passed factual audit?
  reflexion_required: boolean;     // Should trigger agent re-run?
  critique_reasoning: string;      // Detailed CoT explanation
  recommended_refinement: {
    agent_to_refine: 'Analyzer' | 'Tagger' | 'Scorer' | 'None';
    critique_prompt_injection: string;  // Instruction for re-run
  };
}

/**
 * Verifier Agent
 * Performs three-stage verification of agent outputs:
 * 1. Consistency Check - Score-tag alignment and agent agreement
 * 2. Factual Audit - Technical accuracy and concept coverage
 * 3. Reflexion Decision - Generate recommendations and confidence score
 */
export class VerifierAgent extends BaseAgent {
  // Extract magic numbers to constants (addresses Issue #8)
  private static readonly CONFIDENCE_PENALTIES = {
    SCORE_TAG_MISALIGNMENT: 0.35,
    AGENT_DISAGREEMENT_BASE: 0.15,
    FACTUAL_ERROR: 0.3,
    LOW_COVERAGE_MULTIPLIER: 0.1,
    SHORT_TRANSCRIPT: 0.3,
    EMPTY_TRANSCRIPT: 0.7,
  } as const;

  private static readonly THRESHOLDS = {
    HIGH_SCORE: 0.8,
    LOW_CONFIDENCE: 0.8,
    AGENT_DISAGREEMENT: 0.2,
    SHORT_TRANSCRIPT_LENGTH: 50,
  } as const;

  // Move to class constant (addresses Issue #6)
  private static readonly RELATED_TERMS: Record<string, string[]> = {
    'one-way binding': ['unidirectional', 'one way', 'single direction', 'props down'],
    'two-way binding': ['bidirectional', 'two way', 'both directions', 'mutable'],
    'component': ['widget', 'element', 'module'],
    'state': ['data', 'variables', 'properties'],
    'props': ['properties', 'attributes', 'parameters'],
  } as const;

  private static readonly NEGATIVE_TAGS = [
    'confused',
    'incorrect',
    'vague',
    'incomplete',
    'off-topic',
    'rambling',
    'poor',
    'weak',
    'inadequate',
  ] as const;

  constructor() {
    super('VERIFIER');
  }

  /**
   * Main execution method with error handling (addresses Issue #2)
   * Supports both new VerifierInput and legacy AgentInput
   */
  async execute(input: VerifierInput | AgentInput): Promise<VerifierOutput | AgentOutput> {
    try {
      if (this.isVerifierInput(input)) {
        return await this.executeVerification(input);
      }
      return await this.executeLegacy(input);
    } catch (error) {
      console.error('[VerifierAgent] Execution failed:', error);
      // Return safe fallback
      if (this.isVerifierInput(input)) {
        return {
          confidence_score: 0.3,
          is_consistent: false,
          is_accurate: false,
          reflexion_required: true,
          critique_reasoning: `Verification failed due to error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          recommended_refinement: {
            agent_to_refine: 'None',
            critique_prompt_injection: 'Unable to determine refinement due to verification error',
          },
        };
      } else {
        return this.createOutput(
          {
            verified: false,
            checks: [],
            issuesFound: 1,
            recommendations: ['Verification failed due to error'],
          },
          0.3,
          { error: error instanceof Error ? error.message : 'Unknown error' },
          (input as AgentInput).reflexionLoop || 0
        );
      }
    }
  }

  /**
   * Type guard to check if input is VerifierInput
   * Returns false for malformed inputs to allow proper error handling
   */
  private isVerifierInput(input: VerifierInput | AgentInput): input is VerifierInput {
    try {
      return (
        'candidateTranscript' in input &&
        'question' in input &&
        'contextKnowledge' in input &&
        'agentOutputs' in input &&
        typeof (input as VerifierInput).agentOutputs === 'object' &&
        'analyzer' in (input as VerifierInput).agentOutputs &&
        'tagger' in (input as VerifierInput).agentOutputs &&
        'scorer' in (input as VerifierInput).agentOutputs
      );
    } catch {
      return false;
    }
  }

  /**
   * Input validation (addresses Issue #1)
   */
  private validateInput(input: VerifierInput): void {
    // Validate transcript
    if (typeof input.candidateTranscript !== 'string') {
      throw new Error('Invalid input: candidateTranscript must be a string');
    }

    // Validate question
    if (typeof input.question !== 'string') {
      throw new Error('Invalid input: question must be a string');
    }

    // Validate contextKnowledge
    if (!input.contextKnowledge || typeof input.contextKnowledge !== 'object') {
      throw new Error('Invalid input: contextKnowledge must be an object');
    }

    if (!Array.isArray(input.contextKnowledge.expectedConcepts)) {
      throw new Error('Invalid contextKnowledge: expectedConcepts must be an array');
    }

    // Validate agentOutputs structure
    if (!input.agentOutputs || typeof input.agentOutputs !== 'object') {
      throw new Error('Invalid input: agentOutputs must be an object');
    }

    // Validate analyzer output
    if (!input.agentOutputs.analyzer || typeof input.agentOutputs.analyzer !== 'object') {
      throw new Error('Invalid agentOutputs: missing or invalid analyzer output');
    }

    if (typeof input.agentOutputs.analyzer.score !== 'number') {
      throw new Error('Invalid analyzer output: score must be a number');
    }

    if (typeof input.agentOutputs.analyzer.confidence !== 'number') {
      throw new Error('Invalid analyzer output: confidence must be a number');
    }

    if (!Array.isArray(input.agentOutputs.analyzer.insights)) {
      throw new Error('Invalid analyzer output: insights must be an array');
    }

    // Validate tagger output
    if (!input.agentOutputs.tagger || typeof input.agentOutputs.tagger !== 'object') {
      throw new Error('Invalid agentOutputs: missing or invalid tagger output');
    }

    if (!Array.isArray(input.agentOutputs.tagger.tags)) {
      throw new Error('Invalid tagger output: tags must be an array');
    }

    if (typeof input.agentOutputs.tagger.confidence !== 'number') {
      throw new Error('Invalid tagger output: confidence must be a number');
    }

    // Validate scorer output
    if (!input.agentOutputs.scorer || typeof input.agentOutputs.scorer !== 'object') {
      throw new Error('Invalid agentOutputs: missing or invalid scorer output');
    }

    if (typeof input.agentOutputs.scorer.overallScore !== 'number') {
      throw new Error('Invalid scorer output: overallScore must be a number');
    }

    if (typeof input.agentOutputs.scorer.confidence !== 'number') {
      throw new Error('Invalid scorer output: confidence must be a number');
    }
  }

  /**
   * Execute three-stage verification with new format
   */
  private async executeVerification(input: VerifierInput): Promise<VerifierOutput> {
    // Validate input first
    this.validateInput(input);

    // Stage 1: Consistency Check
    const consistencyResult = this.performConsistencyCheck(input);

    // Stage 2: Factual Audit
    const factualResult = this.performFactualAudit(input);

    // Stage 3: Reflexion Decision
    const reflexionResult = this.generateReflexionDecision(
      input,
      consistencyResult,
      factualResult
    );

    return reflexionResult;
  }

  /**
   * Stage 1: Consistency Check
   * Detects score-tag misalignment and agent disagreement
   */
  private performConsistencyCheck(input: VerifierInput): {
    passed: boolean;
    issues: string[];
    penalties: number;
  } {
    const issues: string[] = [];
    let penalties = 0;

    // Check score-tag alignment
    const { analyzer, tagger, scorer } = input.agentOutputs;
    const highScore = scorer.overallScore > VerifierAgent.THRESHOLDS.HIGH_SCORE;
    
    // Check if high score conflicts with negative tags (addresses Issue #7)
    const hasNegativeTags = tagger.tags.some(tag => 
      VerifierAgent.NEGATIVE_TAGS.some(negTag => 
        tag.toLowerCase().includes(negTag)
      )
    );

    if (highScore && hasNegativeTags) {
      issues.push('Score-tag misalignment: High score with negative tags detected');
      penalties += VerifierAgent.CONFIDENCE_PENALTIES.SCORE_TAG_MISALIGNMENT;
    }

    // Check agent agreement (confidence differences)
    const confidences = [analyzer.confidence, tagger.confidence, scorer.confidence];
    const maxConfidence = Math.max(...confidences);
    const minConfidence = Math.min(...confidences);
    
    if (maxConfidence - minConfidence > VerifierAgent.THRESHOLDS.AGENT_DISAGREEMENT) {
      issues.push(`Agent disagreement: Confidence range ${(maxConfidence - minConfidence).toFixed(2)}`);
      penalties += VerifierAgent.CONFIDENCE_PENALTIES.AGENT_DISAGREEMENT_BASE;
    }

    return {
      passed: issues.length === 0,
      issues,
      penalties,
    };
  }

  /**
   * Stage 2: Factual Audit
   * Validates technical accuracy and concept coverage
   */
  private performFactualAudit(input: VerifierInput): {
    passed: boolean;
    issues: string[];
    penalties: number;
  } {
    const issues: string[] = [];
    let penalties = 0;

    // Cache lowercased strings (addresses Issue #5)
    const transcriptLower = input.candidateTranscript.toLowerCase();
    const expectedConcepts = input.contextKnowledge.expectedConcepts;

    // Check for empty or very short transcript first
    if (input.candidateTranscript.trim().length === 0) {
      issues.push('Empty transcript - no content to verify');
      penalties += VerifierAgent.CONFIDENCE_PENALTIES.EMPTY_TRANSCRIPT;
    } else if (input.candidateTranscript.length < VerifierAgent.THRESHOLDS.SHORT_TRANSCRIPT_LENGTH) {
      issues.push('Very short transcript may lack sufficient detail');
      penalties += VerifierAgent.CONFIDENCE_PENALTIES.SHORT_TRANSCRIPT;
    }

    // Check for factual contradictions with negation detection
    const factualErrors = this.detectFactualErrors(transcriptLower, input.contextKnowledge.keyFacts || []);
    if (factualErrors.length > 0) {
      issues.push(...factualErrors);
      penalties += VerifierAgent.CONFIDENCE_PENALTIES.FACTUAL_ERROR;
    }

    // Check concept coverage with related terms
    const coverageScore = this.calculateConceptCoverage(transcriptLower, expectedConcepts);
    if (coverageScore < 0.5) {
      issues.push(`Low concept coverage: ${(coverageScore * 100).toFixed(0)}% of expected concepts mentioned`);
      penalties += (1 - coverageScore) * VerifierAgent.CONFIDENCE_PENALTIES.LOW_COVERAGE_MULTIPLIER;
    }

    return {
      passed: factualErrors.length === 0 && coverageScore >= 0.5 && input.candidateTranscript.trim().length > 0,
      issues,
      penalties,
    };
  }

  /**
   * Detect factual errors using negation pattern detection
   */
  private detectFactualErrors(transcriptLower: string, keyFacts: string[]): string[] {
    const errors: string[] = [];

    for (const fact of keyFacts) {
      const factLower = fact.toLowerCase();
      
      // Improved negation pattern detection (addresses Issue #10)
      const negationPatterns = [
        `not ${factLower}`,
        `no ${factLower}`,
        `never ${factLower}`,
        `isn't ${factLower}`,
        `doesn't ${factLower}`,
        `don't ${factLower}`,
        `cannot ${factLower}`,
        `can't ${factLower}`,
        `doesn't use ${factLower}`,
        `does not use ${factLower}`,
        `not using ${factLower}`,
      ];

      for (const pattern of negationPatterns) {
        if (transcriptLower.includes(pattern)) {
          errors.push(`Factual contradiction detected: "${pattern}" contradicts expected knowledge`);
          break; // Only report one error per fact
        }
      }
    }

    return errors;
  }

  /**
   * Calculate concept coverage with related term matching
   */
  private calculateConceptCoverage(transcriptLower: string, expectedConcepts: string[]): number {
    if (expectedConcepts.length === 0) {
      return 1.0; // No concepts to check
    }

    let coveredCount = 0;

    for (const concept of expectedConcepts) {
      const conceptLower = concept.toLowerCase();
      
      // Check if concept is mentioned directly
      if (transcriptLower.includes(conceptLower)) {
        coveredCount++;
        continue;
      }

      // Check related terms
      const relatedTerms = VerifierAgent.RELATED_TERMS[conceptLower] || [];
      const hasRelatedTerm = relatedTerms.some(term => 
        transcriptLower.includes(term.toLowerCase())
      );

      if (hasRelatedTerm) {
        coveredCount++;
      }
    }

    return coveredCount / expectedConcepts.length;
  }

  /**
   * Stage 3: Reflexion Decision
   * Generate confidence score and recommendations
   */
  private generateReflexionDecision(
    input: VerifierInput,
    consistencyResult: { passed: boolean; issues: string[]; penalties: number },
    factualResult: { passed: boolean; issues: string[]; penalties: number }
  ): VerifierOutput {
    // Calculate confidence score
    const totalPenalties = consistencyResult.penalties + factualResult.penalties;
    const confidenceScore = Math.max(0, Math.min(1, 1.0 - totalPenalties));

    // Determine which agent needs refinement
    let agentToRefine: 'Analyzer' | 'Tagger' | 'Scorer' | 'None' = 'None';
    let critiquePrompt = '';

    if (!consistencyResult.passed || !factualResult.passed) {
      // Identify problematic agent based on issues
      if (consistencyResult.issues.some(issue => issue.includes('Score-tag'))) {
        agentToRefine = 'Tagger';
        critiquePrompt = 'Review tag assignments - detected misalignment with scores. Ensure tags accurately reflect response quality.';
      } else if (consistencyResult.issues.some(issue => issue.includes('Agent disagreement'))) {
        agentToRefine = 'Analyzer';
        critiquePrompt = 'Reassess analysis - significant disagreement detected among agents. Review scoring criteria and confidence levels.';
      } else if (factualResult.issues.some(issue => issue.includes('contradiction'))) {
        agentToRefine = 'Analyzer';
        critiquePrompt = 'Verify factual accuracy - potential contradictions detected in candidate response. Cross-check against expected knowledge.';
      } else if (factualResult.issues.some(issue => issue.includes('coverage'))) {
        agentToRefine = 'Scorer';
        critiquePrompt = 'Adjust scoring - low concept coverage detected. Consider penalizing incomplete responses more heavily.';
      }
    }

    // Build critique reasoning
    const allIssues = [...consistencyResult.issues, ...factualResult.issues];
    const critiqueReasoning = this.buildCritiqueReasoning(
      input,
      consistencyResult.passed,
      factualResult.passed,
      allIssues,
      confidenceScore
    );

    return {
      confidence_score: confidenceScore,
      is_consistent: consistencyResult.passed,
      is_accurate: factualResult.passed,
      reflexion_required: confidenceScore < VerifierAgent.THRESHOLDS.LOW_CONFIDENCE || !consistencyResult.passed || !factualResult.passed,
      critique_reasoning: critiqueReasoning,
      recommended_refinement: {
        agent_to_refine: agentToRefine,
        critique_prompt_injection: critiquePrompt,
      },
    };
  }

  /**
   * Build detailed critique reasoning (Chain of Thought)
   */
  private buildCritiqueReasoning(
    input: VerifierInput,
    consistencyPassed: boolean,
    factualPassed: boolean,
    issues: string[],
    confidenceScore: number
  ): string {
    const parts: string[] = [];

    parts.push('## Verification Analysis\n');

    // Stage 1 results
    parts.push('### Stage 1: Consistency Check');
    if (consistencyPassed) {
      parts.push('✓ Passed - Agent outputs are consistent and aligned');
    } else {
      parts.push('✗ Failed - Consistency issues detected:');
      issues
        .filter(i => i.includes('Score-tag') || i.includes('disagreement'))
        .forEach(issue => parts.push(`  - ${issue}`));
    }

    // Stage 2 results
    parts.push('\n### Stage 2: Factual Audit');
    if (factualPassed) {
      parts.push('✓ Passed - Response is factually accurate with good concept coverage');
    } else {
      parts.push('✗ Failed - Factual accuracy issues detected:');
      issues
        .filter(i => !i.includes('Score-tag') && !i.includes('disagreement'))
        .forEach(issue => parts.push(`  - ${issue}`));
    }

    // Stage 3 decision
    parts.push('\n### Stage 3: Reflexion Decision');
    parts.push(`Confidence Score: ${(confidenceScore * 100).toFixed(1)}%`);
    
    if (confidenceScore >= VerifierAgent.THRESHOLDS.LOW_CONFIDENCE && consistencyPassed && factualPassed) {
      parts.push('Decision: Accept - All verification stages passed');
    } else {
      parts.push('Decision: Reflexion Required - One or more verification stages failed');
    }

    return parts.join('\n');
  }

  /**
   * Legacy execution path for backward compatibility
   */
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
    
    if (scores.length > 0) {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      checks.push({
        name: 'score_validation',
        passed: scores.every(s => s >= 0 && s <= 10),
        message: 'All scores within valid range',
      });
    }

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
