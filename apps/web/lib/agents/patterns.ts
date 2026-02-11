/**
 * Pattern Repository
 * 
 * Manages high-signal patterns for interview analysis.
 * Supports pattern detection, matching, and amplification.
 */

import {
  PatternDefinition,
  PatternCondition,
  PatternMatch,
} from './types';
import { AgentOutput } from '@warmscreen/shared';

/**
 * Generate a unique pattern ID
 */
function generatePatternId(): string {
  return `pat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Pattern categories for organization
 */
export type PatternCategory =
  | 'TECHNICAL_SKILL'
  | 'COMMUNICATION'
  | 'PROBLEM_SOLVING'
  | 'BEHAVIORAL'
  | 'CULTURAL_FIT'
  | 'RED_FLAG'
  | 'GREEN_FLAG'
  | 'AGENT_PERFORMANCE';

/**
 * Pattern Repository
 * 
 * Stores and manages high-signal patterns detected during interviews.
 */
export class PatternRepository {
  private patterns: Map<string, PatternDefinition>;
  private categoryIndex: Map<PatternCategory, Set<string>>;
  private amplifiedPatterns: Set<string>;

  constructor() {
    this.patterns = new Map();
    this.categoryIndex = new Map();
    this.amplifiedPatterns = new Set();

    // Initialize category index
    this.initializeCategoryIndex();

    // Add default patterns
    this.initializeDefaultPatterns();
  }

  /**
   * Initialize category index
   */
  private initializeCategoryIndex(): void {
    const categories: PatternCategory[] = [
      'TECHNICAL_SKILL',
      'COMMUNICATION',
      'PROBLEM_SOLVING',
      'BEHAVIORAL',
      'CULTURAL_FIT',
      'RED_FLAG',
      'GREEN_FLAG',
      'AGENT_PERFORMANCE',
    ];

    for (const category of categories) {
      this.categoryIndex.set(category, new Set());
    }
  }

  /**
   * Initialize default patterns based on hiring best practices
   */
  private initializeDefaultPatterns(): void {
    // Technical skill patterns
    this.addPattern({
      name: 'deep_technical_knowledge',
      category: 'TECHNICAL_SKILL',
      description: 'Candidate demonstrates deep understanding of technical concepts',
      signal: {
        conditions: [
          { field: 'analyzer.scores.technical', operator: 'greaterThan', value: 8, weight: 0.4 },
          { field: 'tagger.tags', operator: 'contains', value: 'technical', weight: 0.3 },
          { field: 'verifier.is_accurate', operator: 'equals', value: true, weight: 0.3 },
        ],
        minConfidence: 0.75,
      },
      strength: 0.8,
    });

    this.addPattern({
      name: 'practical_experience',
      category: 'TECHNICAL_SKILL',
      description: 'Candidate provides concrete examples from real experience',
      signal: {
        conditions: [
          { field: 'tagger.tags', operator: 'contains', value: 'concrete-examples', weight: 0.5 },
          { field: 'analyzer.insights', operator: 'contains', value: 'practical', weight: 0.3 },
          { field: 'confidence', operator: 'greaterThan', value: 0.7, weight: 0.2 },
        ],
        minConfidence: 0.7,
      },
      strength: 0.75,
    });

    // Communication patterns
    this.addPattern({
      name: 'clear_communication',
      category: 'COMMUNICATION',
      description: 'Candidate communicates ideas clearly and effectively',
      signal: {
        conditions: [
          { field: 'analyzer.scores.communication', operator: 'greaterThan', value: 8, weight: 0.4 },
          { field: 'tagger.tags', operator: 'contains', value: 'articulate', weight: 0.3 },
          { field: 'transcript.length', operator: 'greaterThan', value: 200, weight: 0.3 },
        ],
        minConfidence: 0.7,
      },
      strength: 0.7,
    });

    // Problem solving patterns
    this.addPattern({
      name: 'structured_thinking',
      category: 'PROBLEM_SOLVING',
      description: 'Candidate approaches problems with structured methodology',
      signal: {
        conditions: [
          { field: 'analyzer.scores.problemSolving', operator: 'greaterThan', value: 7.5, weight: 0.4 },
          { field: 'tagger.tags', operator: 'contains', value: 'problemSolving', weight: 0.3 },
          { field: 'tagger.tags', operator: 'contains', value: 'data-driven', weight: 0.3 },
        ],
        minConfidence: 0.7,
      },
      strength: 0.75,
    });

    // Behavioral patterns
    this.addPattern({
      name: 'growth_mindset',
      category: 'BEHAVIORAL',
      description: 'Candidate shows willingness to learn and improve',
      signal: {
        conditions: [
          { field: 'tagger.tags', operator: 'contains', value: 'growth-mindset', weight: 0.5 },
          { field: 'transcript', operator: 'contains', value: 'learn', weight: 0.25 },
          { field: 'transcript', operator: 'contains', value: 'improve', weight: 0.25 },
        ],
        minConfidence: 0.65,
      },
      strength: 0.7,
    });

    this.addPattern({
      name: 'team_collaboration',
      category: 'BEHAVIORAL',
      description: 'Candidate demonstrates strong teamwork abilities',
      signal: {
        conditions: [
          { field: 'tagger.tags', operator: 'contains', value: 'collaborative', weight: 0.4 },
          { field: 'transcript', operator: 'contains', value: 'team', weight: 0.3 },
          { field: 'tagger.tags', operator: 'contains', value: 'leadership', weight: 0.3 },
        ],
        minConfidence: 0.65,
      },
      strength: 0.7,
    });

    // Red flag patterns
    this.addPattern({
      name: 'vague_responses',
      category: 'RED_FLAG',
      description: 'Candidate provides vague or evasive answers',
      signal: {
        conditions: [
          { field: 'tagger.tags', operator: 'contains', value: 'vague', weight: 0.4 },
          { field: 'analyzer.scores.depth', operator: 'lessThan', value: 5, weight: 0.3 },
          { field: 'verifier.is_accurate', operator: 'equals', value: false, weight: 0.3 },
        ],
        minConfidence: 0.6,
      },
      strength: 0.6,
    });

    this.addPattern({
      name: 'inconsistent_answers',
      category: 'RED_FLAG',
      description: 'Candidate provides inconsistent or contradictory information',
      signal: {
        conditions: [
          { field: 'verifier.is_consistent', operator: 'equals', value: false, weight: 0.5 },
          { field: 'tagger.tags', operator: 'contains', value: 'confused', weight: 0.3 },
          { field: 'confidence', operator: 'lessThan', value: 0.6, weight: 0.2 },
        ],
        minConfidence: 0.6,
      },
      strength: 0.65,
    });

    // Green flag patterns
    this.addPattern({
      name: 'high_confidence_consensus',
      category: 'GREEN_FLAG',
      description: 'All agents agree with high confidence on positive assessment',
      signal: {
        conditions: [
          { field: 'analyzer.confidence', operator: 'greaterThan', value: 0.85, weight: 0.33 },
          { field: 'tagger.confidence', operator: 'greaterThan', value: 0.85, weight: 0.33 },
          { field: 'scorer.confidence', operator: 'greaterThan', value: 0.85, weight: 0.34 },
        ],
        minConfidence: 0.85,
      },
      strength: 0.9,
    });

    // Agent performance patterns
    this.addPattern({
      name: 'reflexion_success',
      category: 'AGENT_PERFORMANCE',
      description: 'Agent successfully improved output through reflexion',
      signal: {
        conditions: [
          { field: 'reflexionLoop', operator: 'greaterThan', value: 0, weight: 0.3 },
          { field: 'confidence', operator: 'greaterThan', value: 0.8, weight: 0.4 },
          { field: 'shouldReflect', operator: 'equals', value: false, weight: 0.3 },
        ],
        minConfidence: 0.7,
      },
      strength: 0.75,
    });
  }

  /**
   * Add a new pattern to the repository
   */
  addPattern(config: {
    name: string;
    category: string;
    description: string;
    signal: {
      conditions: PatternCondition[];
      minConfidence: number;
    };
    strength: number;
  }): PatternDefinition {
    const pattern: PatternDefinition = {
      id: generatePatternId(),
      name: config.name,
      category: config.category,
      description: config.description,
      signal: config.signal,
      strength: config.strength,
      occurrences: 0,
      amplified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.patterns.set(pattern.id, pattern);

    // Update category index
    const categorySet = this.categoryIndex.get(config.category as PatternCategory);
    if (categorySet) {
      categorySet.add(pattern.id);
    }

    return pattern;
  }

  /**
   * Get a pattern by ID
   */
  getPattern(id: string): PatternDefinition | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get pattern by name
   */
  getPatternByName(name: string): PatternDefinition | undefined {
    for (const pattern of this.patterns.values()) {
      if (pattern.name === name) {
        return pattern;
      }
    }
    return undefined;
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): PatternDefinition[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get patterns by category
   */
  getPatternsByCategory(category: PatternCategory): PatternDefinition[] {
    const patternIds = this.categoryIndex.get(category) || new Set();
    return Array.from(patternIds)
      .map((id) => this.patterns.get(id))
      .filter((p): p is PatternDefinition => p !== undefined);
  }

  /**
   * Get amplified patterns
   */
  getAmplifiedPatterns(): PatternDefinition[] {
    return Array.from(this.amplifiedPatterns)
      .map((id) => this.patterns.get(id))
      .filter((p): p is PatternDefinition => p !== undefined);
  }

  /**
   * Match patterns against agent outputs
   */
  matchPatterns(context: {
    transcript?: string;
    agentOutputs?: Record<string, AgentOutput>;
    confidence?: number;
    reflexionLoop?: number;
  }): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const pattern of this.patterns.values()) {
      const match = this.evaluatePattern(pattern, context);
      if (match) {
        matches.push(match);
      }
    }

    // Sort by match score (descending)
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return matches;
  }

  /**
   * Evaluate a single pattern against context
   */
  private evaluatePattern(
    pattern: PatternDefinition,
    context: Record<string, unknown>
  ): PatternMatch | null {
    const matchedConditions: PatternCondition[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const condition of pattern.signal.conditions) {
      totalWeight += condition.weight;
      const value = this.getNestedValue(context, condition.field);

      if (this.evaluateCondition(condition, value)) {
        matchedConditions.push(condition);
        matchedWeight += condition.weight;
      }
    }

    const matchScore = totalWeight > 0 ? matchedWeight / totalWeight : 0;

    // Check if match score meets minimum confidence
    if (matchScore >= pattern.signal.minConfidence) {
      return {
        pattern,
        matchScore,
        matchedConditions,
        context: context as Record<string, unknown>,
      };
    }

    return null;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PatternCondition, value: unknown): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'contains':
        if (Array.isArray(value)) {
          return value.includes(condition.value);
        }
        if (typeof value === 'string') {
          return value.toLowerCase().includes(String(condition.value).toLowerCase());
        }
        return false;

      case 'greaterThan':
        return typeof value === 'number' && value > (condition.value as number);

      case 'lessThan':
        return typeof value === 'number' && value < (condition.value as number);

      case 'matches':
        if (typeof value === 'string' && typeof condition.value === 'string') {
          try {
            const regex = new RegExp(condition.value, 'i');
            return regex.test(value);
          } catch {
            return false;
          }
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Record a pattern occurrence
   */
  recordOccurrence(patternId: string, successfulOutcome?: boolean): void {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.occurrences++;
      pattern.updatedAt = new Date();

      // Update success rate if outcome provided
      if (successfulOutcome !== undefined) {
        const currentSuccessCount = (pattern.successRate || 0) * (pattern.occurrences - 1);
        pattern.successRate =
          (currentSuccessCount + (successfulOutcome ? 1 : 0)) / pattern.occurrences;
      }

      // Auto-amplify high-strength, frequently occurring patterns
      if (pattern.strength > 0.8 && pattern.occurrences >= 10) {
        this.amplifyPattern(patternId);
      }
    }
  }

  /**
   * Amplify a pattern (mark it as high-signal)
   */
  amplifyPattern(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.amplified = true;
      pattern.updatedAt = new Date();
      this.amplifiedPatterns.add(patternId);
    }
  }

  /**
   * De-amplify a pattern
   */
  deamplifyPattern(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.amplified = false;
      pattern.updatedAt = new Date();
      this.amplifiedPatterns.delete(patternId);
    }
  }

  /**
   * Update pattern strength
   */
  updateStrength(patternId: string, newStrength: number): void {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.strength = Math.max(0, Math.min(1, newStrength));
      pattern.updatedAt = new Date();
    }
  }

  /**
   * Remove a pattern
   */
  removePattern(patternId: string): boolean {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return false;

    // Remove from category index
    const categorySet = this.categoryIndex.get(pattern.category as PatternCategory);
    if (categorySet) {
      categorySet.delete(patternId);
    }

    // Remove from amplified set
    this.amplifiedPatterns.delete(patternId);

    return this.patterns.delete(patternId);
  }

  /**
   * Get pattern statistics
   */
  getStatistics(): {
    totalPatterns: number;
    amplifiedCount: number;
    byCategory: Record<string, number>;
    avgStrength: number;
    avgOccurrences: number;
  } {
    const patterns = Array.from(this.patterns.values());
    const byCategory: Record<string, number> = {};

    for (const [category, ids] of this.categoryIndex) {
      byCategory[category] = ids.size;
    }

    const totalStrength = patterns.reduce((sum, p) => sum + p.strength, 0);
    const totalOccurrences = patterns.reduce((sum, p) => sum + p.occurrences, 0);

    return {
      totalPatterns: patterns.length,
      amplifiedCount: this.amplifiedPatterns.size,
      byCategory,
      avgStrength: patterns.length > 0 ? totalStrength / patterns.length : 0,
      avgOccurrences: patterns.length > 0 ? totalOccurrences / patterns.length : 0,
    };
  }

  /**
   * Clear all patterns (keeps default patterns)
   */
  reset(): void {
    this.patterns.clear();
    this.amplifiedPatterns.clear();
    this.initializeCategoryIndex();
    this.initializeDefaultPatterns();
  }
}

/**
 * Singleton instance
 */
let patternRepositoryInstance: PatternRepository | null = null;

/**
 * Get the global pattern repository instance
 */
export function getPatternRepository(): PatternRepository {
  if (!patternRepositoryInstance) {
    patternRepositoryInstance = new PatternRepository();
  }
  return patternRepositoryInstance;
}

/**
 * Reset the pattern repository (for testing)
 */
export function resetPatternRepository(): void {
  patternRepositoryInstance = null;
}
