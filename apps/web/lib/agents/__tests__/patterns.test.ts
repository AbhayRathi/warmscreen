/**
 * Tests for Pattern Repository
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PatternRepository,
  getPatternRepository,
  resetPatternRepository,
} from '../patterns';

describe('PatternRepository', () => {
  let repository: PatternRepository;

  beforeEach(() => {
    resetPatternRepository();
    repository = getPatternRepository();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getPatternRepository();
      const instance2 = getPatternRepository();
      expect(instance1).toBe(instance2);
    });

    it('should reset properly', () => {
      const instance1 = getPatternRepository();
      resetPatternRepository();
      const instance2 = getPatternRepository();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Default Patterns', () => {
    it('should have default patterns loaded', () => {
      const patterns = repository.getAllPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should have deep_technical_knowledge pattern', () => {
      const pattern = repository.getPatternByName('deep_technical_knowledge');
      expect(pattern).toBeDefined();
      expect(pattern?.category).toBe('TECHNICAL_SKILL');
    });

    it('should have red flag patterns', () => {
      const redFlags = repository.getPatternsByCategory('RED_FLAG');
      expect(redFlags.length).toBeGreaterThan(0);
      expect(redFlags.some((p) => p.name === 'vague_responses')).toBe(true);
    });

    it('should have green flag patterns', () => {
      const greenFlags = repository.getPatternsByCategory('GREEN_FLAG');
      expect(greenFlags.length).toBeGreaterThan(0);
    });
  });

  describe('Pattern Management', () => {
    it('should add a custom pattern', () => {
      const pattern = repository.addPattern({
        name: 'custom_pattern',
        category: 'BEHAVIORAL',
        description: 'A custom test pattern',
        signal: {
          conditions: [
            { field: 'test', operator: 'equals', value: true, weight: 1 },
          ],
          minConfidence: 0.7,
        },
        strength: 0.8,
      });

      expect(pattern.id).toBeTruthy();
      expect(repository.getPattern(pattern.id)).toBeDefined();
    });

    it('should get pattern by ID', () => {
      const added = repository.addPattern({
        name: 'test_pattern',
        category: 'TECHNICAL_SKILL',
        description: 'Test',
        signal: { conditions: [], minConfidence: 0.5 },
        strength: 0.5,
      });

      const retrieved = repository.getPattern(added.id);
      expect(retrieved?.name).toBe('test_pattern');
    });

    it('should get pattern by name', () => {
      const pattern = repository.getPatternByName('clear_communication');
      expect(pattern).toBeDefined();
      expect(pattern?.category).toBe('COMMUNICATION');
    });

    it('should get patterns by category', () => {
      const behavioral = repository.getPatternsByCategory('BEHAVIORAL');
      expect(behavioral.length).toBeGreaterThan(0);
      expect(behavioral.every((p) => p.category === 'BEHAVIORAL')).toBe(true);
    });

    it('should remove a pattern', () => {
      const pattern = repository.addPattern({
        name: 'to_remove',
        category: 'TECHNICAL_SKILL',
        description: 'Test',
        signal: { conditions: [], minConfidence: 0.5 },
        strength: 0.5,
      });

      const result = repository.removePattern(pattern.id);
      expect(result).toBe(true);
      expect(repository.getPattern(pattern.id)).toBeUndefined();
    });
  });

  describe('Pattern Matching', () => {
    it('should match patterns against context', () => {
      const context = {
        analyzer: {
          scores: { technical: 9 },
          confidence: 0.9,
          insights: ['practical examples shown'],
        },
        tagger: {
          tags: ['technical', 'concrete-examples'],
          confidence: 0.85,
        },
        verifier: {
          is_accurate: true,
          confidence: 0.88,
        },
        scorer: {
          overallScore: 0.87,
          confidence: 0.85,
        },
        confidence: 0.88,
      };

      const matches = repository.matchPatterns(context);
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should return matches sorted by score', () => {
      const context = {
        analyzer: {
          scores: { technical: 9, communication: 8 },
          confidence: 0.9,
        },
        tagger: {
          tags: ['technical', 'articulate', 'growth-mindset'],
          confidence: 0.88,
        },
        transcript: 'I learned from the experience and improved my team collaboration',
        confidence: 0.9,
      };

      const matches = repository.matchPatterns(context);
      
      // Should be sorted by matchScore descending
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].matchScore).toBeGreaterThanOrEqual(matches[i].matchScore);
      }
    });

    it('should not match when conditions fail', () => {
      // Add a pattern that requires high scores
      repository.addPattern({
        name: 'impossible_pattern',
        category: 'GREEN_FLAG',
        description: 'Requires impossible conditions',
        signal: {
          conditions: [
            { field: 'score', operator: 'greaterThan', value: 100, weight: 1 },
          ],
          minConfidence: 1.0,
        },
        strength: 0.9,
      });

      const context = { score: 50 };
      const matches = repository.matchPatterns(context);
      
      const impossibleMatch = matches.find(
        (m) => m.pattern.name === 'impossible_pattern'
      );
      expect(impossibleMatch).toBeUndefined();
    });
  });

  describe('Condition Evaluation', () => {
    beforeEach(() => {
      // Add test patterns for each operator
      repository.addPattern({
        name: 'equals_test',
        category: 'TECHNICAL_SKILL',
        description: 'Test equals operator',
        signal: {
          conditions: [
            { field: 'status', operator: 'equals', value: 'active', weight: 1 },
          ],
          minConfidence: 0.5,
        },
        strength: 0.5,
      });

      repository.addPattern({
        name: 'contains_array_test',
        category: 'TECHNICAL_SKILL',
        description: 'Test contains on array',
        signal: {
          conditions: [
            { field: 'tags', operator: 'contains', value: 'react', weight: 1 },
          ],
          minConfidence: 0.5,
        },
        strength: 0.5,
      });

      repository.addPattern({
        name: 'contains_string_test',
        category: 'TECHNICAL_SKILL',
        description: 'Test contains on string',
        signal: {
          conditions: [
            { field: 'text', operator: 'contains', value: 'success', weight: 1 },
          ],
          minConfidence: 0.5,
        },
        strength: 0.5,
      });

      repository.addPattern({
        name: 'greater_than_test',
        category: 'TECHNICAL_SKILL',
        description: 'Test greaterThan operator',
        signal: {
          conditions: [
            { field: 'score', operator: 'greaterThan', value: 80, weight: 1 },
          ],
          minConfidence: 0.5,
        },
        strength: 0.5,
      });

      repository.addPattern({
        name: 'less_than_test',
        category: 'TECHNICAL_SKILL',
        description: 'Test lessThan operator',
        signal: {
          conditions: [
            { field: 'errors', operator: 'lessThan', value: 5, weight: 1 },
          ],
          minConfidence: 0.5,
        },
        strength: 0.5,
      });

      repository.addPattern({
        name: 'matches_test',
        category: 'TECHNICAL_SKILL',
        description: 'Test regex matches operator',
        signal: {
          conditions: [
            { field: 'email', operator: 'matches', value: '^[a-z]+@test\\.com$', weight: 1 },
          ],
          minConfidence: 0.5,
        },
        strength: 0.5,
      });
    });

    it('should match equals condition', () => {
      const matches = repository.matchPatterns({ status: 'active' });
      expect(matches.some((m) => m.pattern.name === 'equals_test')).toBe(true);
    });

    it('should not match equals when value differs', () => {
      const matches = repository.matchPatterns({ status: 'inactive' });
      expect(matches.some((m) => m.pattern.name === 'equals_test')).toBe(false);
    });

    it('should match contains on array', () => {
      const matches = repository.matchPatterns({ tags: ['react', 'typescript'] });
      expect(matches.some((m) => m.pattern.name === 'contains_array_test')).toBe(true);
    });

    it('should match contains on string', () => {
      const matches = repository.matchPatterns({ text: 'This is a success story' });
      expect(matches.some((m) => m.pattern.name === 'contains_string_test')).toBe(true);
    });

    it('should match greaterThan condition', () => {
      const matches = repository.matchPatterns({ score: 85 });
      expect(matches.some((m) => m.pattern.name === 'greater_than_test')).toBe(true);
    });

    it('should match lessThan condition', () => {
      const matches = repository.matchPatterns({ errors: 2 });
      expect(matches.some((m) => m.pattern.name === 'less_than_test')).toBe(true);
    });

    it('should match regex pattern', () => {
      const matches = repository.matchPatterns({ email: 'john@test.com' });
      expect(matches.some((m) => m.pattern.name === 'matches_test')).toBe(true);
    });

    it('should handle nested field access', () => {
      const matches = repository.matchPatterns({
        analyzer: { scores: { technical: 9 }, confidence: 0.9 },
        tagger: { tags: ['technical', 'advanced'], confidence: 0.85 },
        verifier: { is_accurate: true, confidence: 0.9 },
      });
      // Should match deep_technical_knowledge pattern (all 3 conditions met)
      expect(matches.some((m) => m.pattern.name === 'deep_technical_knowledge')).toBe(true);
    });
  });

  describe('Pattern Occurrence Tracking', () => {
    it('should record pattern occurrence', () => {
      const pattern = repository.getPatternByName('deep_technical_knowledge');
      const initialOccurrences = pattern?.occurrences || 0;

      repository.recordOccurrence(pattern!.id);

      const updated = repository.getPatternByName('deep_technical_knowledge');
      expect(updated?.occurrences).toBe(initialOccurrences + 1);
    });

    it('should update success rate on occurrence', () => {
      const pattern = repository.addPattern({
        name: 'success_rate_test',
        category: 'GREEN_FLAG',
        description: 'Test',
        signal: { conditions: [], minConfidence: 0.5 },
        strength: 0.5,
      });

      repository.recordOccurrence(pattern.id, true);
      repository.recordOccurrence(pattern.id, true);
      repository.recordOccurrence(pattern.id, false);

      const updated = repository.getPattern(pattern.id);
      expect(updated?.successRate).toBeCloseTo(0.67, 1);
    });
  });

  describe('Pattern Amplification', () => {
    it('should amplify a pattern', () => {
      const pattern = repository.getPatternByName('deep_technical_knowledge');
      repository.amplifyPattern(pattern!.id);

      const updated = repository.getPatternByName('deep_technical_knowledge');
      expect(updated?.amplified).toBe(true);
    });

    it('should get amplified patterns', () => {
      const pattern = repository.getPatternByName('growth_mindset');
      repository.amplifyPattern(pattern!.id);

      const amplified = repository.getAmplifiedPatterns();
      expect(amplified.some((p) => p.name === 'growth_mindset')).toBe(true);
    });

    it('should de-amplify a pattern', () => {
      const pattern = repository.getPatternByName('deep_technical_knowledge');
      repository.amplifyPattern(pattern!.id);
      repository.deamplifyPattern(pattern!.id);

      const updated = repository.getPatternByName('deep_technical_knowledge');
      expect(updated?.amplified).toBe(false);
    });

    it('should auto-amplify high-strength patterns with many occurrences', () => {
      const pattern = repository.addPattern({
        name: 'auto_amplify_test',
        category: 'GREEN_FLAG',
        description: 'Test auto amplification',
        signal: { conditions: [], minConfidence: 0.5 },
        strength: 0.85,
      });

      // Record 10 occurrences
      for (let i = 0; i < 10; i++) {
        repository.recordOccurrence(pattern.id);
      }

      const updated = repository.getPattern(pattern.id);
      expect(updated?.amplified).toBe(true);
    });
  });

  describe('Pattern Strength', () => {
    it('should update pattern strength', () => {
      const pattern = repository.getPatternByName('clear_communication');
      repository.updateStrength(pattern!.id, 0.95);

      const updated = repository.getPatternByName('clear_communication');
      expect(updated?.strength).toBe(0.95);
    });

    it('should clamp strength to 0-1 range', () => {
      const pattern = repository.getPatternByName('clear_communication');
      
      repository.updateStrength(pattern!.id, 1.5);
      expect(repository.getPattern(pattern!.id)?.strength).toBe(1);

      repository.updateStrength(pattern!.id, -0.5);
      expect(repository.getPattern(pattern!.id)?.strength).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should return statistics', () => {
      const stats = repository.getStatistics();

      expect(stats.totalPatterns).toBeGreaterThan(0);
      expect(stats.byCategory).toBeDefined();
      expect(stats.avgStrength).toBeGreaterThan(0);
      expect(typeof stats.amplifiedCount).toBe('number');
    });

    it('should count patterns by category', () => {
      const stats = repository.getStatistics();

      expect(stats.byCategory['TECHNICAL_SKILL']).toBeGreaterThan(0);
      expect(stats.byCategory['RED_FLAG']).toBeGreaterThan(0);
      expect(stats.byCategory['BEHAVIORAL']).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    it('should reset to default patterns', () => {
      // Add custom pattern
      repository.addPattern({
        name: 'custom_to_remove',
        category: 'BEHAVIORAL',
        description: 'Test',
        signal: { conditions: [], minConfidence: 0.5 },
        strength: 0.5,
      });

      // Amplify a pattern
      const pattern = repository.getPatternByName('deep_technical_knowledge');
      repository.amplifyPattern(pattern!.id);

      // Reset
      repository.reset();

      // Custom pattern should be gone
      expect(repository.getPatternByName('custom_to_remove')).toBeUndefined();

      // Default patterns should still exist
      expect(repository.getPatternByName('deep_technical_knowledge')).toBeDefined();

      // Amplifications should be reset
      expect(repository.getAmplifiedPatterns().length).toBe(0);
    });
  });
});
