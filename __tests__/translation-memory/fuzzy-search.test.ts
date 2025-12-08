import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  calculateSimilarity,
  jaccardSimilarity,
  enhancedSimilarity,
  fuzzySearchMemory,
  findExactMatches,
  highlightMatches,
  extractContext
} from '@/lib/utils/fuzzy-search';
import type { TranslationMemoryEntry, FuzzySearchOptions } from '@/lib/types/translation-memory';

describe('Fuzzy Search Algorithms', () => {
  describe('levenshteinDistance', () => {
    it('should calculate correct distance for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should calculate correct distance for completely different strings', () => {
      expect(levenshteinDistance('hello', 'world')).toBe(4);
    });

    it('should calculate correct distance for single character difference', () => {
      expect(levenshteinDistance('hello', 'hallo')).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', 'world')).toBe(5);
    });

    it('should be case sensitive', () => {
      expect(levenshteinDistance('Hello', 'hello')).toBe(1);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(calculateSimilarity('hello world', 'hello world')).toBe(1);
    });

    it('should return 1 for identical empty strings and 0 for one empty', () => {
      expect(calculateSimilarity('', '')).toBe(1); // Identical empty strings
      expect(calculateSimilarity('hello', '')).toBe(0);
      expect(calculateSimilarity('', 'hello')).toBe(0);
    });

    it('should return high similarity for similar strings', () => {
      const similarity = calculateSimilarity('hello world', 'hello word');
      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should be case insensitive', () => {
      const similarity = calculateSimilarity('Hello World', 'hello world');
      expect(similarity).toBe(1);
    });
  });

  describe('jaccardSimilarity', () => {
    it('should return 1 for identical word sets', () => {
      expect(jaccardSimilarity('hello world', 'world hello')).toBe(1);
    });

    it('should return 0 for completely different word sets', () => {
      expect(jaccardSimilarity('hello world', 'foo bar')).toBe(0);
    });

    it('should calculate correct similarity for partial overlap', () => {
      const similarity = jaccardSimilarity('hello world test', 'hello world example');
      expect(similarity).toBeCloseTo(0.5, 1); // 2 common words out of 4 total unique words
    });

    it('should be case insensitive', () => {
      expect(jaccardSimilarity('Hello World', 'hello world')).toBe(1);
    });
  });

  describe('enhancedSimilarity', () => {
    it('should combine Levenshtein and Jaccard similarities', () => {
      const similarity = enhancedSimilarity('hello world', 'hello word');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should return 1 for identical strings', () => {
      expect(enhancedSimilarity('hello world', 'hello world')).toBe(1);
    });

    it('should handle different string lengths', () => {
      const similarity = enhancedSimilarity('hello', 'hello world test');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('fuzzySearchMemory', () => {
    const mockEntries: TranslationMemoryEntry[] = [
      {
        id: '1',
        sourceText: 'Hello world',
        targetText: 'Hola mundo',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.9,
        usageCount: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        projectId: 'project1'
      },
      {
        id: '2',
        sourceText: 'Hello there',
        targetText: 'Hola ahí',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.8,
        usageCount: 3,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        projectId: 'project1'
      },
      {
        id: '3',
        sourceText: 'Goodbye world',
        targetText: 'Adiós mundo',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.95,
        usageCount: 2,
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03'),
        projectId: 'project2'
      }
    ];

    const defaultOptions: FuzzySearchOptions = {
      threshold: 0.3,
      maxResults: 10,
      includeContext: true,
      preferRecent: false
    };

    it('should find exact matches with highest similarity', () => {
      const results = fuzzySearchMemory('Hello world', mockEntries, defaultOptions);
      
      expect(results.length).toBeGreaterThan(0); // Should find matches
      expect(results[0].similarity).toBe(1); // Exact match should be first
      expect(results[0].type).toBe('exact');
      
      // Verify results are sorted by similarity
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }
    });

    it('should filter by threshold', () => {
      const highThresholdOptions = { ...defaultOptions, threshold: 0.9 };
      const results = fuzzySearchMemory('Hello world', mockEntries, highThresholdOptions);
      
      expect(results.length).toBeLessThanOrEqual(mockEntries.length);
      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should respect maxResults limit', () => {
      const limitedOptions = { ...defaultOptions, maxResults: 1 };
      const results = fuzzySearchMemory('Hello', mockEntries, limitedOptions);
      
      expect(results).toHaveLength(1);
    });

    it('should filter by projectId when provided', () => {
      const projectOptions = { ...defaultOptions, projectId: 'project1' };
      const results = fuzzySearchMemory('Hello', mockEntries, projectOptions);
      
      results.forEach(result => {
        const originalEntry = mockEntries.find(e => e.id === result.id);
        expect(originalEntry?.projectId).toBe('project1');
      });
    });

    it('should sort by similarity descending', () => {
      const results = fuzzySearchMemory('Hello', mockEntries, defaultOptions);
      
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }
    });

    it('should prefer recent entries when specified', () => {
      const recentOptions = { ...defaultOptions, preferRecent: true };
      const results = fuzzySearchMemory('Hello', mockEntries, recentOptions);
      
      // When similarities are equal, should prefer more recent entries
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('findExactMatches', () => {
    const mockEntries: TranslationMemoryEntry[] = [
      {
        id: '1',
        sourceText: 'Hello world',
        targetText: 'Hola mundo',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.9,
        usageCount: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        sourceText: 'hello world', // Different case
        targetText: 'Hola mundo 2',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.8,
        usageCount: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    it('should find exact matches case-insensitively', () => {
      const results = findExactMatches('Hello World', mockEntries);
      
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.similarity).toBe(1);
        expect(result.type).toBe('exact');
      });
    });

    it('should sort by usage count descending', () => {
      const results = findExactMatches('Hello World', mockEntries);
      
      expect(results[0].usageCount).toBeGreaterThanOrEqual(results[1].usageCount);
    });

    it('should return empty array for no matches', () => {
      const results = findExactMatches('No match', mockEntries);
      expect(results).toHaveLength(0);
    });
  });

  describe('highlightMatches', () => {
    it('should highlight matching words', () => {
      const result = highlightMatches('Hello world test', 'world');
      
      const matchingParts = result.filter(part => part.isMatch);
      expect(matchingParts.length).toBeGreaterThan(0);
      expect(matchingParts.some(part => part.text.includes('world'))).toBe(true);
    });

    it('should handle empty query', () => {
      const result = highlightMatches('Hello world', '');
      
      expect(result).toHaveLength(1);
      expect(result[0].isMatch).toBe(false);
      expect(result[0].text).toBe('Hello world');
    });

    it('should be case insensitive', () => {
      const result = highlightMatches('Hello World', 'hello');
      
      const matchingParts = result.filter(part => part.isMatch);
      expect(matchingParts.length).toBeGreaterThan(0);
    });

    it('should only highlight words longer than 2 characters', () => {
      const result = highlightMatches('Hello a world', 'a');
      
      const matchingParts = result.filter(part => part.isMatch);
      expect(matchingParts).toHaveLength(0);
    });
  });

  describe('extractContext', () => {
    const fullText = 'This is a very long text that contains the match word somewhere in the middle of the sentence.';
    
    it('should extract context around match', () => {
      const context = extractContext(fullText, 'match', 20);
      
      expect(context).toContain('match');
      expect(context.length).toBeLessThanOrEqual(fullText.length);
    });

    it('should add ellipsis when text is truncated', () => {
      const context = extractContext(fullText, 'match', 10);
      
      expect(context).toContain('...');
    });

    it('should handle match at beginning', () => {
      const context = extractContext('match at the beginning', 'match', 10);
      
      expect(context).toContain('match');
      expect(context.endsWith('...')).toBe(true);
    });

    it('should handle match at end', () => {
      const context = extractContext('text ending with match', 'match', 10);
      
      expect(context).toContain('match');
      expect(context.startsWith('...')).toBe(true);
    });

    it('should return empty string for no match', () => {
      const context = extractContext(fullText, 'nomatch', 20);
      expect(context).toBe('');
    });
  });
});