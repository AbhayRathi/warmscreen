/**
 * Orchestrated Analyzer Agent
 * 
 * Integrates the Analyzer agent with the orchestration framework.
 * Performs deep technical analysis of interview responses.
 */

import { AgentOutput } from '@warmscreen/shared';
import { calculateConfidence, extractKeywords } from '@warmscreen/shared';
import { BaseOrchestrationAgent } from './base-agent';
import { AgentTypes, AgentContext } from './types';

/**
 * Analysis result structure
 */
export interface AnalysisResult {
  scores: {
    technical: number;
    communication: number;
    depth: number;
    problemSolving?: number;
    clarity?: number;
  };
  confidence: number;
  insights: string[];
  technicalConcepts: string[];
  structureAnalysis: {
    hasIntroduction: boolean;
    hasConclusion: boolean;
    logicalFlow: boolean;
  };
}

/**
 * Orchestrated Analyzer Agent
 * 
 * Analyzes interview responses for:
 * - Technical competency
 * - Communication skills
 * - Problem-solving ability
 * - Response depth and structure
 */
export class AnalyzerOrchestrationAgent extends BaseOrchestrationAgent {
  readonly id = AgentTypes.ANALYZER;
  readonly name = 'Analyzer Agent';
  readonly description = 'Deep technical analysis of interview responses';
  readonly capabilities = [
    'technical-analysis',
    'communication-assessment', 
    'depth-evaluation',
    'concept-extraction',
  ];

  /**
   * Technical keywords by category for scoring
   */
  private static readonly TECH_KEYWORDS: Record<string, string[]> = {
    general: ['algorithm', 'data structure', 'api', 'database', 'performance', 'scalability', 'architecture'],
    frontend: ['react', 'component', 'state', 'props', 'hooks', 'virtual dom', 'jsx', 'typescript'],
    backend: ['server', 'endpoint', 'rest', 'graphql', 'microservice', 'middleware', 'authentication'],
    devops: ['ci/cd', 'docker', 'kubernetes', 'deployment', 'monitoring', 'logging'],
    testing: ['unit test', 'integration test', 'mock', 'test coverage', 'tdd'],
  };

  /**
   * Communication quality indicators
   */
  private static readonly COMMUNICATION_MARKERS = {
    positive: ['for example', 'specifically', 'in my experience', 'the key point', 'to clarify', 'in other words'],
    negative: ['um', 'uh', 'like', 'basically', 'you know', 'i guess'],
    structuring: ['first', 'second', 'finally', 'in conclusion', 'to summarize', 'let me explain'],
  };

  /**
   * Perform deep analysis of the interview response
   */
  async analyze(context: AgentContext): Promise<AgentOutput> {
    const { question, response, position } = context;
    const transcript = response.transcript;

    // Perform analysis
    const analysisResult = await this.performAnalysis(
      transcript,
      question.category,
      question.expectedConcepts || [],
      position
    );

    // Check for previous analysis to refine
    const previousAnalysis = context.previousAnalysis?.get(this.id);
    if (previousAnalysis) {
      return this.refineAnalysis(analysisResult, previousAnalysis);
    }

    return this.createOutput(
      analysisResult,
      analysisResult.confidence,
      {
        keywords: extractKeywords(transcript),
        wordCount: transcript.split(/\s+/).length,
        questionCategory: question.category,
      }
    );
  }

  /**
   * Perform comprehensive response analysis
   */
  private async performAnalysis(
    transcript: string,
    category: string,
    expectedConcepts: string[],
    position: string
  ): Promise<AnalysisResult> {
    const lowerTranscript = transcript.toLowerCase();
    const wordCount = transcript.split(/\s+/).length;

    // Technical analysis
    const technicalScore = this.analyzeTechnical(lowerTranscript, category, expectedConcepts);
    const technicalConcepts = this.extractTechnicalConcepts(lowerTranscript);

    // Communication analysis
    const communicationScore = this.analyzeCommunication(lowerTranscript, wordCount);

    // Depth analysis
    const depthScore = this.analyzeDepth(lowerTranscript, wordCount);

    // Structure analysis
    const structureAnalysis = this.analyzeStructure(lowerTranscript);

    // Problem solving (if applicable)
    const problemSolvingScore = category === 'technical' || category === 'problem-solving'
      ? this.analyzeProblemSolving(lowerTranscript)
      : undefined;

    // Calculate overall confidence
    const scores = [technicalScore, communicationScore, depthScore];
    if (problemSolvingScore !== undefined) scores.push(problemSolvingScore);
    const confidenceFactors = scores.map(s => s / 10);
    const confidence = calculateConfidence(confidenceFactors);

    // Generate insights
    const insights = this.generateInsights(
      technicalScore,
      communicationScore,
      depthScore,
      wordCount,
      technicalConcepts,
      structureAnalysis
    );

    return {
      scores: {
        technical: technicalScore,
        communication: communicationScore,
        depth: depthScore,
        problemSolving: problemSolvingScore,
        clarity: structureAnalysis.logicalFlow ? 8 : 5,
      },
      confidence,
      insights,
      technicalConcepts,
      structureAnalysis,
    };
  }

  /**
   * Analyze technical competency
   */
  private analyzeTechnical(
    transcript: string,
    category: string,
    expectedConcepts: string[]
  ): number {
    let score = 5.0; // Base score

    // Check category-specific keywords
    const categoryKeywords = AnalyzerOrchestrationAgent.TECH_KEYWORDS[category] 
      || AnalyzerOrchestrationAgent.TECH_KEYWORDS.general;

    const matchedKeywords = categoryKeywords.filter(kw => transcript.includes(kw));
    score += Math.min(matchedKeywords.length * 0.5, 2.5);

    // Check expected concepts
    if (expectedConcepts.length > 0) {
      const matchedConcepts = expectedConcepts.filter(
        concept => transcript.includes(concept.toLowerCase())
      );
      const conceptCoverage = matchedConcepts.length / expectedConcepts.length;
      score += conceptCoverage * 2;
    }

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Extract technical concepts mentioned
   */
  private extractTechnicalConcepts(transcript: string): string[] {
    const concepts: string[] = [];
    
    for (const [, keywords] of Object.entries(AnalyzerOrchestrationAgent.TECH_KEYWORDS)) {
      for (const keyword of keywords) {
        if (transcript.includes(keyword) && !concepts.includes(keyword)) {
          concepts.push(keyword);
        }
      }
    }

    return concepts;
  }

  /**
   * Analyze communication quality
   */
  private analyzeCommunication(transcript: string, wordCount: number): number {
    let score = 5.0;

    // Positive markers
    const positiveCount = AnalyzerOrchestrationAgent.COMMUNICATION_MARKERS.positive
      .filter(marker => transcript.includes(marker)).length;
    score += positiveCount * 0.5;

    // Negative markers (penalize)
    const negativeCount = AnalyzerOrchestrationAgent.COMMUNICATION_MARKERS.negative
      .filter(marker => transcript.includes(marker)).length;
    score -= Math.min(negativeCount * 0.3, 1.5);

    // Structuring markers
    const structureCount = AnalyzerOrchestrationAgent.COMMUNICATION_MARKERS.structuring
      .filter(marker => transcript.includes(marker)).length;
    score += structureCount * 0.4;

    // Word count bonus for detailed responses
    if (wordCount > 100) score += 1;
    if (wordCount > 200) score += 0.5;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Analyze response depth
   */
  private analyzeDepth(transcript: string, wordCount: number): number {
    let score = 4.0;

    // Length-based scoring
    if (wordCount >= 50) score += 1;
    if (wordCount >= 100) score += 1;
    if (wordCount >= 150) score += 1;
    if (wordCount >= 200) score += 0.5;

    // Check for examples
    if (transcript.includes('for example') || transcript.includes('such as')) {
      score += 1;
    }

    // Check for explanations
    if (transcript.includes('because') || transcript.includes('the reason')) {
      score += 0.5;
    }

    // Check for trade-offs discussion
    if (transcript.includes('however') || transcript.includes('on the other hand')) {
      score += 0.5;
    }

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Analyze response structure
   */
  private analyzeStructure(transcript: string): {
    hasIntroduction: boolean;
    hasConclusion: boolean;
    logicalFlow: boolean;
  } {
    const introMarkers = ['first', 'let me', 'to start', 'my approach'];
    const conclusionMarkers = ['in conclusion', 'to summarize', 'overall', 'finally'];
    const flowMarkers = ['then', 'next', 'after that', 'following'];

    return {
      hasIntroduction: introMarkers.some(m => transcript.includes(m)),
      hasConclusion: conclusionMarkers.some(m => transcript.includes(m)),
      logicalFlow: flowMarkers.filter(m => transcript.includes(m)).length >= 2,
    };
  }

  /**
   * Analyze problem-solving approach
   */
  private analyzeProblemSolving(transcript: string): number {
    let score = 5.0;

    const problemSolvingIndicators = [
      'first i would',
      'my approach',
      'to solve this',
      'the solution',
      'step by step',
      'break down',
      'consider',
      'analyze',
      'evaluate',
      'optimize',
    ];

    const matchCount = problemSolvingIndicators.filter(
      indicator => transcript.includes(indicator)
    ).length;

    score += matchCount * 0.5;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Generate insights based on analysis
   */
  private generateInsights(
    technicalScore: number,
    communicationScore: number,
    depthScore: number,
    wordCount: number,
    technicalConcepts: string[],
    structureAnalysis: { hasIntroduction: boolean; hasConclusion: boolean; logicalFlow: boolean }
  ): string[] {
    const insights: string[] = [];

    // Technical insights
    if (technicalScore >= 7) {
      insights.push('Strong technical knowledge demonstrated');
    } else if (technicalScore < 5) {
      insights.push('Limited technical depth in response');
    }

    if (technicalConcepts.length >= 3) {
      insights.push(`Referenced ${technicalConcepts.length} technical concepts`);
    }

    // Communication insights
    if (communicationScore >= 7) {
      insights.push('Clear and effective communication');
    } else if (communicationScore < 5) {
      insights.push('Communication could be more structured');
    }

    // Depth insights
    if (wordCount > 100) {
      insights.push('Detailed response provided');
    } else if (wordCount < 50) {
      insights.push('Brief response - more detail would strengthen answer');
    }

    // Structure insights
    if (structureAnalysis.logicalFlow) {
      insights.push('Well-organized response with logical flow');
    }
    if (structureAnalysis.hasIntroduction && structureAnalysis.hasConclusion) {
      insights.push('Complete response structure with intro and conclusion');
    }

    return insights;
  }

  /**
   * Refine analysis based on previous attempt
   */
  private refineAnalysis(
    current: AnalysisResult,
    previous: AgentOutput
  ): AgentOutput {
    const previousResult = previous.result as AnalysisResult;
    
    // Combine insights
    const combinedInsights = [
      ...new Set([...current.insights, ...previousResult.insights]),
    ];
    
    // Average scores with slight improvement
    const refinedScores = {
      technical: Math.min(10, (current.scores.technical + previousResult.scores.technical) / 2 + 0.3),
      communication: Math.min(10, (current.scores.communication + previousResult.scores.communication) / 2 + 0.3),
      depth: Math.min(10, (current.scores.depth + previousResult.scores.depth) / 2 + 0.3),
      problemSolving: current.scores.problemSolving,
      clarity: current.scores.clarity,
    };

    const refinedResult: AnalysisResult = {
      scores: refinedScores,
      confidence: Math.min(1, current.confidence + 0.1),
      insights: combinedInsights,
      technicalConcepts: current.technicalConcepts,
      structureAnalysis: current.structureAnalysis,
    };

    return this.createOutput(
      refinedResult,
      refinedResult.confidence,
      { refined: true, reflexionLoop: previous.reflexionLoop + 1 },
      previous.reflexionLoop + 1
    );
  }
}

/**
 * Singleton instance
 */
let analyzerInstance: AnalyzerOrchestrationAgent | null = null;

/**
 * Get the global Analyzer agent instance
 */
export function getAnalyzerAgent(): AnalyzerOrchestrationAgent {
  if (!analyzerInstance) {
    analyzerInstance = new AnalyzerOrchestrationAgent();
  }
  return analyzerInstance;
}

/**
 * Reset the Analyzer agent (for testing)
 */
export function resetAnalyzerAgent(): void {
  analyzerInstance = null;
}
