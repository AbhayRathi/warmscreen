import { 
  AnalyzerAgent, 
  VerifierAgent, 
  PlannerAgent, 
  TaggerAgent, 
  ScorerAgent, 
  NarratorAgent 
} from '../agents';
import { VerifierInput } from '../agents/verifier';
import { AgentOutput, AgentType } from '@warmscreen/shared';
import { PrismaClient } from '@warmscreen/database';

/**
 * Conductor Agent - The Orchestrator
 * Coordinates all 7 agents and manages the reflexion loops
 */
export class ConductorAgent {
  private analyzer: AnalyzerAgent;
  private verifier: VerifierAgent;
  private planner: PlannerAgent;
  private tagger: TaggerAgent;
  private scorer: ScorerAgent;
  private narrator: NarratorAgent;
  private db: PrismaClient;

  constructor(db: PrismaClient) {
    this.analyzer = new AnalyzerAgent();
    this.verifier = new VerifierAgent();
    this.planner = new PlannerAgent();
    this.tagger = new TaggerAgent();
    this.scorer = new ScorerAgent();
    this.narrator = new NarratorAgent();
    this.db = db;
  }

  /**
   * Process a single interview response through the agent swarm
   */
  async processResponse(context: {
    interviewId: string;
    questionId: string;
    transcript: string;
    questionCategory: string;
    position: string;
    questionText?: string;
    expectedConcepts?: string[];
    keyFacts?: string[];
  }): Promise<{
    analyzed: AgentOutput;
    tagged: AgentOutput;
    verified: AgentOutput;
  }> {
    // Step 1: Analyzer analyzes the response
    const analyzedOutput = await this.analyzer.execute({
      type: 'ANALYZER',
      context: {
        transcript: context.transcript,
        questionCategory: context.questionCategory,
      },
    });

    // Step 2: Tagger tags the response
    const taggedOutput = await this.tagger.execute({
      type: 'TAGGER',
      context: {
        transcript: context.transcript,
        questionCategory: context.questionCategory,
        position: context.position,
      },
    });

    // Step 3: Generate a basic score for this individual response
    // (Note: Final scoring happens in finalizeInterview)
    const responseScore = this.calculateResponseScore(analyzedOutput, taggedOutput);

    // Step 4: Verifier verifies all outputs using new three-stage verification (Issue #4 - CRITICAL)
    const verifierInput: VerifierInput = {
      candidateTranscript: context.transcript,
      question: context.questionText || `Question about ${context.questionCategory}`,
      contextKnowledge: {
        expectedConcepts: context.expectedConcepts || this.getDefaultConcepts(context.questionCategory),
        idealResponseCharacteristics: ['clear', 'detailed', 'accurate'],
        keyFacts: context.keyFacts || [],
      },
      agentOutputs: {
        analyzer: {
          score: this.extractAnalyzerScore(analyzedOutput),
          confidence: analyzedOutput.confidence,
          insights: this.extractAnalyzerInsights(analyzedOutput),
        },
        tagger: {
          tags: this.extractTaggerTags(taggedOutput),
          confidence: taggedOutput.confidence,
        },
        scorer: {
          overallScore: responseScore.score,
          confidence: responseScore.confidence,
          breakdown: responseScore.breakdown,
        },
      },
    };

    // Cast to AgentInput to satisfy type system (verifier uses duck typing internally)
    const verifiedOutput = await this.verifier.execute(verifierInput as unknown as AgentInput);

    // Note: verifiedOutput is AgentOutput wrapping VerifierOutput in result
    // The confidence is mapped from VerifierOutput.confidence_score
    
    // Log agent actions
    await this.logAgentActions(context.interviewId, [
      analyzedOutput,
      taggedOutput,
      verifiedOutput,
    ]);

    return {
      analyzed: analyzedOutput,
      tagged: taggedOutput,
      verified: verifiedOutput,
    };
  }

  /**
   * Extract analyzer score from output
   */
  private extractAnalyzerScore(output: AgentOutput): number {
    if (output.result.scores) {
      const scores = Object.values(output.result.scores) as number[];
      return scores.reduce((a: number, b: number) => a + b, 0) / scores.length / 10; // Normalize to 0-1
    }
    return 0.5; // Default
  }

  /**
   * Extract analyzer insights from output
   */
  private extractAnalyzerInsights(output: AgentOutput): string[] {
    if (output.result.insights) {
      return Array.isArray(output.result.insights) ? output.result.insights : [output.result.insights];
    }
    if (output.result.analysis) {
      return [output.result.analysis];
    }
    return ['Analysis completed'];
  }

  /**
   * Extract tagger tags from output
   */
  private extractTaggerTags(output: AgentOutput): string[] {
    if (output.result.tags) {
      return output.result.tags;
    }
    if (output.result.skillTags && output.result.behavioralTags) {
      return [...output.result.skillTags, ...output.result.behavioralTags];
    }
    return [];
  }

  /**
   * Calculate basic response score for verification
   */
  private calculateResponseScore(analyzedOutput: AgentOutput, taggedOutput: AgentOutput): {
    score: number;
    confidence: number;
    breakdown: any;
  } {
    const analyzerScore = this.extractAnalyzerScore(analyzedOutput);
    const taggerScore = taggedOutput.confidence;
    
    const score = (analyzerScore * 0.6 + taggerScore * 0.4);
    const confidence = (analyzedOutput.confidence + taggedOutput.confidence) / 2;
    
    return {
      score,
      confidence,
      breakdown: {
        analyzer: analyzerScore,
        tagger: taggerScore,
      },
    };
  }

  /**
   * Get default expected concepts based on question category
   */
  private getDefaultConcepts(category: string): string[] {
    const conceptMap: Record<string, string[]> = {
      technical: ['algorithm', 'data structure', 'complexity', 'optimization'],
      behavioral: ['teamwork', 'leadership', 'communication', 'problem-solving'],
      system_design: ['scalability', 'architecture', 'trade-offs', 'design patterns'],
      coding: ['syntax', 'logic', 'testing', 'debugging'],
    };
    
    return conceptMap[category.toLowerCase()] || ['knowledge', 'understanding', 'clarity'];
  }

  /**
   * Plan the next question in the interview
   */
  async planNextQuestion(context: {
    interviewId: string;
    currentResponses: any[];
    availableQuestions: any[];
    position: string;
  }): Promise<AgentOutput> {
    const planOutput = await this.planner.execute({
      type: 'PLANNER',
      context,
    });

    await this.logAgentActions(context.interviewId, [planOutput]);

    return planOutput;
  }

  /**
   * Calculate final scores and generate decision
   */
  async finalizeInterview(context: {
    interviewId: string;
    responses: any[];
    scoringModel: any;
    position: string;
    candidateName: string;
  }): Promise<{
    scoring: AgentOutput;
    explanation: AgentOutput;
  }> {
    // Step 1: Calculate scores
    const scoringOutput = await this.scorer.execute({
      type: 'SCORER',
      context: {
        responses: context.responses,
        scoringModel: context.scoringModel,
        position: context.position,
      },
    });

    // Step 2: Get all agent outputs for this interview
    const agentOutputs = await this.getInterviewAgentOutputs(context.interviewId);

    // Step 3: Generate explanation
    const explanationOutput = await this.narrator.execute({
      type: 'NARRATOR',
      context: {
        decision: scoringOutput.result.decision,
        score: scoringOutput.result.overallScore,
        responses: context.responses,
        agentOutputs: [...agentOutputs, scoringOutput],
        candidateName: context.candidateName,
        position: context.position,
      },
    });

    // Log final agent actions
    await this.logAgentActions(context.interviewId, [scoringOutput, explanationOutput]);

    return {
      scoring: scoringOutput,
      explanation: explanationOutput,
    };
  }

  /**
   * Self-healing: Analyze patterns and update models
   */
  async performSelfHealing(interviewId: string): Promise<void> {
    // Get interview data
    const interview = await this.db.interview.findUnique({
      where: { id: interviewId },
      include: {
        responses: true,
        agentLogs: true,
        feedbackLoops: true,
      },
    });

    if (!interview) return;

    // Analyze agent performance
    const agentPerformance = this.analyzeAgentPerformance(interview.agentLogs);

    // Detect patterns
    const patterns = await this.detectPatterns(interview);

    // Create feedback loops for learning
    for (const pattern of patterns) {
      await this.db.feedbackLoop.create({
        data: {
          interviewId,
          feedbackType: 'PATTERN_DETECTED',
          signal: {
            pattern: pattern.name,
            strength: pattern.strength,
            category: pattern.category,
          },
          actionTaken: 'Pattern recorded for amplification',
        },
      });
    }

    // Store high-signal patterns
    for (const pattern of patterns.filter(p => p.strength > 0.7)) {
      await this.amplifyPattern(pattern);
    }
  }

  private async logAgentActions(
    interviewId: string,
    outputs: AgentOutput[]
  ): Promise<void> {
    for (const output of outputs) {
      await this.db.agentLog.create({
        data: {
          interviewId,
          agentType: output.type,
          action: 'execute',
          input: {},
          output: output.result,
          reflexionLoop: output.reflexionLoop,
          performanceScore: output.confidence,
        },
      });
    }
  }

  private async getInterviewAgentOutputs(interviewId: string): Promise<AgentOutput[]> {
    const logs = await this.db.agentLog.findMany({
      where: { interviewId },
      orderBy: { createdAt: 'asc' },
    });

    return logs.map((log: any) => ({
      type: log.agentType as AgentType,
      result: log.output,
      confidence: log.performanceScore || 0.5,
      reflexionLoop: log.reflexionLoop,
    }));
  }

  private analyzeAgentPerformance(logs: any[]): Record<AgentType, number> {
    const performance: Record<string, number[]> = {};

    logs.forEach(log => {
      if (!performance[log.agentType]) {
        performance[log.agentType] = [];
      }
      if (log.performanceScore) {
        performance[log.agentType].push(log.performanceScore);
      }
    });

    const avgPerformance: any = {};
    Object.entries(performance).forEach(([agent, scores]) => {
      avgPerformance[agent] = scores.reduce((a, b) => a + b, 0) / scores.length;
    });

    return avgPerformance;
  }

  private async detectPatterns(interview: any): Promise<any[]> {
    const patterns: any[] = [];

    // Pattern: High confidence across all agents
    const agentConfidences = interview.agentLogs.map((l: any) => l.performanceScore || 0);
    const avgConfidence = agentConfidences.reduce((a: number, b: number) => a + b, 0) / agentConfidences.length;
    
    if (avgConfidence > 0.8) {
      patterns.push({
        name: 'high_confidence_consensus',
        category: 'agent_performance',
        strength: avgConfidence,
      });
    }

    // Pattern: Consistent high scores
    const scores = interview.responses
      .filter((r: any) => r.scores)
      .flatMap((r: any) => Object.values(r.scores));
    
    if (scores.length > 0) {
      const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      if (avgScore > 7.5) {
        patterns.push({
          name: 'strong_performance',
          category: 'candidate_quality',
          strength: avgScore / 10,
        });
      }
    }

    return patterns;
  }

  private async amplifyPattern(pattern: any): Promise<void> {
    // Check if pattern already exists
    const existing = await this.db.pattern.findFirst({
      where: { name: pattern.name },
    });

    if (existing) {
      // Update occurrence count and strength
      await this.db.pattern.update({
        where: { id: existing.id },
        data: {
          occurrences: existing.occurrences + 1,
          strength: (existing.strength + pattern.strength) / 2,
          amplified: pattern.strength > 0.8,
        },
      });
    } else {
      // Create new pattern
      await this.db.pattern.create({
        data: {
          name: pattern.name,
          description: `Detected pattern: ${pattern.name}`,
          category: pattern.category,
          signal: pattern,
          strength: pattern.strength,
          amplified: pattern.strength > 0.8,
        },
      });
    }
  }
}
