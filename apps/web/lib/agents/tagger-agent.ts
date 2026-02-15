/**
 * Orchestrated Tagger Agent
 * 
 * Integrates the Tagger agent with the orchestration framework.
 * Extracts and categorizes skills, behaviors, and competencies.
 */

import { AgentOutput } from '@warmscreen/shared';
import { extractKeywords } from '@warmscreen/shared';
import { BaseOrchestrationAgent } from './base-agent';
import { AgentTypes, AgentContext } from './types';

/**
 * Tagging result structure
 */
export interface TaggingResult {
  skillTags: string[];
  behavioralTags: string[];
  competencyTags: string[];
  keywords: string[];
  sentiment: number;
  confidence: number;
  categories: Record<string, string[]>;
}

/**
 * Orchestrated Tagger Agent
 * 
 * Identifies and extracts:
 * - Technical skills
 * - Soft skills
 * - Behavioral patterns
 * - Position-specific competencies
 */
export class TaggerOrchestrationAgent extends BaseOrchestrationAgent {
  readonly id = AgentTypes.TAGGER;
  readonly name = 'Tagger Agent';
  readonly description = 'Skill extraction and categorization';
  readonly capabilities = [
    'skill-extraction',
    'behavior-tagging',
    'competency-mapping',
    'sentiment-analysis',
  ];

  /**
   * Skill patterns by category
   */
  private static readonly SKILL_PATTERNS: Record<string, string[]> = {
    technical: ['programming', 'algorithm', 'database', 'api', 'architecture', 'testing', 'debugging', 'code review'],
    leadership: ['led', 'managed', 'mentored', 'coordinated', 'directed', 'supervised', 'delegated'],
    communication: ['explained', 'presented', 'documented', 'collaborated', 'negotiated', 'articulated'],
    problemSolving: ['solved', 'debugged', 'optimized', 'improved', 'analyzed', 'troubleshot', 'diagnosed'],
    analytical: ['analyzed', 'evaluated', 'assessed', 'researched', 'investigated', 'measured'],
    creative: ['designed', 'created', 'innovated', 'developed', 'built', 'implemented'],
  };

  /**
   * Behavioral indicators
   */
  private static readonly BEHAVIORAL_INDICATORS: Record<string, string[]> = {
    'thoughtful': ['i think', 'in my opinion', 'i believe', 'considering'],
    'concrete-examples': ['for example', 'such as', 'like when', 'specifically'],
    'growth-mindset': ['learned', 'improved', 'developed', 'grew', 'evolved'],
    'collaborative': ['team', 'together', 'we', 'collaborated', 'partnered'],
    'proactive': ['initiated', 'proposed', 'took the lead', 'volunteered'],
    'detail-oriented': ['specifically', 'precisely', 'exactly', 'careful'],
    'results-focused': ['achieved', 'delivered', 'completed', 'accomplished'],
    'adaptable': ['adapted', 'adjusted', 'pivoted', 'flexible'],
  };

  /**
   * Position-specific competency mappings
   */
  private static readonly POSITION_COMPETENCIES: Record<string, string[]> = {
    'Software Engineer': ['coding', 'system design', 'debugging', 'testing', 'code review'],
    'Frontend Engineer': ['ui/ux', 'responsive design', 'accessibility', 'performance', 'state management'],
    'Backend Engineer': ['api design', 'database', 'scalability', 'security', 'microservices'],
    'DevOps Engineer': ['ci/cd', 'infrastructure', 'monitoring', 'automation', 'cloud'],
    'Data Engineer': ['data pipeline', 'etl', 'data modeling', 'sql', 'big data'],
    'Product Manager': ['roadmap', 'prioritization', 'stakeholder', 'metrics', 'user research'],
    'Engineering Manager': ['team building', 'mentorship', 'planning', 'execution', 'hiring'],
  };

  /**
   * Sentiment analysis words
   */
  private static readonly SENTIMENT_WORDS = {
    positive: ['good', 'great', 'excellent', 'love', 'enjoy', 'excited', 'successful', 'happy', 'proud', 'amazing'],
    negative: ['bad', 'difficult', 'hard', 'problem', 'issue', 'struggle', 'failed', 'frustrated', 'challenging', 'concern'],
  };

  /**
   * Perform skill and competency tagging
   */
  async analyze(context: AgentContext): Promise<AgentOutput> {
    const { question, response, position } = context;
    const transcript = response.transcript;

    const taggingResult = await this.performTagging(
      transcript,
      question.category,
      position
    );

    // Check for previous analysis to refine
    const previousAnalysis = context.previousAnalysis?.get(this.id);
    if (previousAnalysis) {
      return this.refineTagging(taggingResult, previousAnalysis);
    }

    return this.createOutput(
      taggingResult,
      taggingResult.confidence,
      {
        totalTags: taggingResult.skillTags.length + taggingResult.behavioralTags.length + taggingResult.competencyTags.length,
        questionCategory: question.category,
      }
    );
  }

  /**
   * Perform comprehensive tagging
   */
  private async performTagging(
    transcript: string,
    category: string,
    position: string
  ): Promise<TaggingResult> {
    const lowerTranscript = transcript.toLowerCase();

    // Extract different tag types
    const skillTags = this.extractSkillTags(lowerTranscript);
    const behavioralTags = this.extractBehavioralTags(lowerTranscript);
    const competencyTags = this.extractCompetencyTags(lowerTranscript, position);
    
    // Extract keywords
    const keywords = extractKeywords(transcript, 10);

    // Analyze sentiment
    const sentiment = this.analyzeSentiment(lowerTranscript);

    // Calculate confidence based on tag density
    const totalTags = skillTags.length + behavioralTags.length + competencyTags.length;
    const wordCount = transcript.split(/\s+/).length;
    const confidence = this.calculateTaggingConfidence(totalTags, wordCount);

    // Organize by category
    const categories: Record<string, string[]> = {
      skills: skillTags,
      behaviors: behavioralTags,
      competencies: competencyTags,
    };

    return {
      skillTags,
      behavioralTags,
      competencyTags,
      keywords,
      sentiment,
      confidence,
      categories,
    };
  }

  /**
   * Extract skill-related tags
   */
  private extractSkillTags(transcript: string): string[] {
    const tags: string[] = [];

    for (const [skill, patterns] of Object.entries(TaggerOrchestrationAgent.SKILL_PATTERNS)) {
      if (patterns.some(pattern => transcript.includes(pattern))) {
        tags.push(skill);
      }
    }

    return tags;
  }

  /**
   * Extract behavioral tags
   */
  private extractBehavioralTags(transcript: string): string[] {
    const tags: string[] = [];

    for (const [tag, indicators] of Object.entries(TaggerOrchestrationAgent.BEHAVIORAL_INDICATORS)) {
      if (indicators.some(indicator => transcript.includes(indicator))) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Extract position-specific competency tags
   */
  private extractCompetencyTags(transcript: string, position: string): string[] {
    const tags: string[] = [];

    // Find position-specific competencies
    const positionCompetencies = TaggerOrchestrationAgent.POSITION_COMPETENCIES[position] || [];
    
    for (const competency of positionCompetencies) {
      if (transcript.includes(competency.toLowerCase())) {
        tags.push(competency);
      }
    }

    // Generic competencies
    if (transcript.length > 200) tags.push('articulate');
    if (transcript.includes('metric') || transcript.includes('measure')) tags.push('data-driven');
    if (transcript.includes('customer') || transcript.includes('user')) tags.push('user-focused');
    if (transcript.includes('deadline') || transcript.includes('on time')) tags.push('punctual');
    if (transcript.includes('quality') || transcript.includes('standard')) tags.push('quality-conscious');

    return tags;
  }

  /**
   * Analyze sentiment of the response
   */
  private analyzeSentiment(transcript: string): number {
    let score = 0;

    TaggerOrchestrationAgent.SENTIMENT_WORDS.positive.forEach(word => {
      if (transcript.includes(word)) score += 0.1;
    });

    TaggerOrchestrationAgent.SENTIMENT_WORDS.negative.forEach(word => {
      if (transcript.includes(word)) score -= 0.1;
    });

    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Calculate tagging confidence
   */
  private calculateTaggingConfidence(totalTags: number, wordCount: number): number {
    // More tags with appropriate word count = higher confidence
    const tagDensity = totalTags / Math.max(wordCount / 50, 1);
    
    // Base confidence
    let confidence = 0.5;
    
    // Adjust for tag density
    if (tagDensity > 0.5) confidence += 0.2;
    if (tagDensity > 1) confidence += 0.1;
    
    // Adjust for word count (need enough content to tag)
    if (wordCount > 50) confidence += 0.1;
    if (wordCount > 100) confidence += 0.05;

    return Math.min(1, Math.max(0.3, confidence));
  }

  /**
   * Refine tagging based on previous attempt
   */
  private refineTagging(
    current: TaggingResult,
    previous: AgentOutput
  ): AgentOutput {
    const previousResult = previous.result as TaggingResult;

    // Combine and deduplicate tags
    const refinedResult: TaggingResult = {
      skillTags: [...new Set([...current.skillTags, ...previousResult.skillTags])],
      behavioralTags: [...new Set([...current.behavioralTags, ...previousResult.behavioralTags])],
      competencyTags: [...new Set([...current.competencyTags, ...previousResult.competencyTags])],
      keywords: [...new Set([...current.keywords, ...previousResult.keywords])].slice(0, 10),
      sentiment: (current.sentiment + previousResult.sentiment) / 2,
      confidence: Math.min(1, current.confidence + 0.1),
      categories: current.categories,
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
let taggerInstance: TaggerOrchestrationAgent | null = null;

/**
 * Get the global Tagger agent instance
 */
export function getTaggerAgent(): TaggerOrchestrationAgent {
  if (!taggerInstance) {
    taggerInstance = new TaggerOrchestrationAgent();
  }
  return taggerInstance;
}

/**
 * Reset the Tagger agent (for testing)
 */
export function resetTaggerAgent(): void {
  taggerInstance = null;
}
