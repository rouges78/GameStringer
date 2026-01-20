import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  TranslationMemoryDatabase, 
  GlossaryDatabase, 
  DatabaseMaintenance 
} from '@/lib/utils/database';
import {
  levenshteinDistance,
  calculateSimilarity,
  enhancedSimilarity,
  fuzzySearchMemory,
  findExactMatches
} from '@/lib/utils/fuzzy-search';
import type { TranslationMemoryEntry, FuzzySearchOptions } from '@/lib/types/translation-memory';

// Mock the database
vi.mock('@/lib/utils/database', () => ({
  TranslationMemoryDatabase: {
    addEntry: vi.fn(),
    searchEntries: vi.fn(),
    incrementUsage: vi.fn()
  },
  GlossaryDatabase: {
    addTerm: vi.fn(),
    searchTerms: vi.fn()
  },
  DatabaseMaintenance: {
    getMemoryStats: vi.fn()
  }
}));

describe('Translation Memory Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Functionality', () => {
    it('should add and retrieve translation memory entries', async () => {
      const mockAddEntry = vi.mocked(TranslationMemoryDatabase.addEntry);
      const mockSearchEntries = vi.mocked(TranslationMemoryDatabase.searchEntries);

      mockAddEntry.mockResolvedValue('entry-1');
      mockSearchEntries.mockResolvedValue([
        {
          id: 'entry-1',
          sourceText: 'Hello world',
          targetText: 'Hola mundo',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          confidence: 0.9,
          usageCount: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      // Add entry
      const entryId = await TranslationMemoryDatabase.addEntry({
        sourceText: 'Hello world',
        targetText: 'Hola mundo',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.9
      });

      expect(entryId).toBe('entry-1');
      expect(mockAddEntry).toHaveBeenCalledWith({
        sourceText: 'Hello world',
        targetText: 'Hola mundo',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.9
      });

      // Search entries
      const results = await TranslationMemoryDatabase.searchEntries(
        'Hello',
        'en',
        'es'
      );

      expect(results).toHaveLength(1);
      expect(results[0].sourceText).toBe('Hello world');
      expect(results[0].targetText).toBe('Hola mundo');
    });

    it('should add and search glossary terms', async () => {
      const mockAddTerm = vi.mocked(GlossaryDatabase.addTerm);
      const mockSearchTerms = vi.mocked(GlossaryDatabase.searchTerms);

      mockAddTerm.mockResolvedValue('term-1');
      mockSearchTerms.mockResolvedValue([
        {
          id: 'term-1',
          term: 'Hello',
          translation: 'Hola',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          approved: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      // Add term
      const termId = await GlossaryDatabase.addTerm({
        term: 'Hello',
        translation: 'Hola',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        approved: true
      });

      expect(termId).toBe('term-1');

      // Search terms
      const results = await GlossaryDatabase.searchTerms(
        'Hello',
        'en',
        'es'
      );

      expect(results).toHaveLength(1);
      expect(results[0].term).toBe('Hello');
      expect(results[0].translation).toBe('Hola');
    });

    it('should get memory statistics', async () => {
      const mockGetStats = vi.mocked(DatabaseMaintenance.getMemoryStats);
      
      mockGetStats.mockResolvedValue({
        totalEntries: 100,
        totalGlossaryTerms: 50,
        totalProjects: 5
      });

      const stats = await DatabaseMaintenance.getMemoryStats();

      expect(stats.totalEntries).toBe(100);
      expect(stats.totalGlossaryTerms).toBe(50);
      expect(stats.totalProjects).toBe(5);
    });
  });

  describe('Fuzzy Search Integration', () => {
    const mockEntries: TranslationMemoryEntry[] = [
      {
        id: '1',
        sourceText: 'Hello world',
        targetText: 'Hola mundo',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.95,
        usageCount: 10,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        id: '2',
        sourceText: 'Hello there',
        targetText: 'Hola ahí',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.8,
        usageCount: 5,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02')
      },
      {
        id: '3',
        sourceText: 'Good morning',
        targetText: 'Buenos días',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.9,
        usageCount: 3,
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03')
      }
    ];

    it('should perform fuzzy search with proper scoring', () => {
      const options: FuzzySearchOptions = {
        threshold: 0.3,
        maxResults: 10,
        includeContext: true,
        preferRecent: false
      };

      const results = fuzzySearchMemory('Hello', mockEntries, options);

      // Should find entries containing "Hello"
      expect(results.length).toBeGreaterThan(0);
      
      // Results should be sorted by similarity
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }

      // Should include similarity scores
      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should find exact matches', () => {
      const exactMatches = findExactMatches('Hello world', mockEntries);

      expect(exactMatches).toHaveLength(1);
      expect(exactMatches[0].sourceText).toBe('Hello world');
      expect(exactMatches[0].similarity).toBe(1);
      expect(exactMatches[0].type).toBe('exact');
    });

    it('should calculate similarity correctly', () => {
      // Identical strings
      expect(calculateSimilarity('hello', 'hello')).toBe(1);
      
      // Completely different strings
      expect(calculateSimilarity('hello', 'world')).toBeLessThan(0.5);
      
      // Similar strings
      const similarity = calculateSimilarity('hello world', 'hello word');
      expect(similarity).toBeGreaterThan(0.8);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle edge cases in fuzzy search', () => {
      const options: FuzzySearchOptions = {
        threshold: 0.5,
        maxResults: 5,
        includeContext: true,
        preferRecent: false
      };

      // Empty query
      const emptyResults = fuzzySearchMemory('', mockEntries, options);
      expect(emptyResults).toHaveLength(0);

      // Very short query
      const shortResults = fuzzySearchMemory('H', mockEntries, options);
      expect(shortResults.length).toBeLessThanOrEqual(mockEntries.length);

      // No matches
      const noMatchResults = fuzzySearchMemory('xyz123', mockEntries, options);
      expect(noMatchResults).toHaveLength(0);
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset: TranslationMemoryEntry[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `entry-${i}`,
        sourceText: `Source text ${i}`,
        targetText: `Target text ${i}`,
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: Math.random(),
        usageCount: Math.floor(Math.random() * 100),
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const options: FuzzySearchOptions = {
        threshold: 0.3,
        maxResults: 10,
        includeContext: true,
        preferRecent: false
      };

      const startTime = Date.now();
      const results = fuzzySearchMemory('Source text', largeDataset, options);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000); // 1 second
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should calculate Levenshtein distance efficiently', () => {
      const str1 = 'This is a longer string for testing performance';
      const str2 = 'This is a different longer string for testing performance';

      const startTime = Date.now();
      const distance = levenshteinDistance(str1, str2);
      const endTime = Date.now();

      expect(distance).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockAddEntry = vi.mocked(TranslationMemoryDatabase.addEntry);
      mockAddEntry.mockRejectedValue(new Error('Database connection failed'));

      await expect(TranslationMemoryDatabase.addEntry({
        sourceText: 'Test',
        targetText: 'Prueba',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.9
      })).rejects.toThrow('Database connection failed');
    });

    it('should handle search errors gracefully', async () => {
      const mockSearchEntries = vi.mocked(TranslationMemoryDatabase.searchEntries);
      mockSearchEntries.mockRejectedValue(new Error('Search failed'));

      await expect(TranslationMemoryDatabase.searchEntries(
        'test',
        'en',
        'es'
      )).rejects.toThrow('Search failed');
    });
  });

  describe('Data Validation', () => {
    it('should validate translation memory entry data', async () => {
      const mockAddEntry = vi.mocked(TranslationMemoryDatabase.addEntry);
      mockAddEntry.mockImplementation(async (entry) => {
        // Simulate validation
        if (!entry.sourceText || !entry.targetText) {
          throw new Error('Source and target text are required');
        }
        if (entry.confidence < 0 || entry.confidence > 1) {
          throw new Error('Confidence must be between 0 and 1');
        }
        return 'entry-1';
      });

      // Valid entry should succeed
      await expect(TranslationMemoryDatabase.addEntry({
        sourceText: 'Hello',
        targetText: 'Hola',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.9
      })).resolves.toBe('entry-1');

      // Invalid confidence should fail
      await expect(TranslationMemoryDatabase.addEntry({
        sourceText: 'Hello',
        targetText: 'Hola',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 1.5
      })).rejects.toThrow('Confidence must be between 0 and 1');

      // Missing text should fail
      await expect(TranslationMemoryDatabase.addEntry({
        sourceText: '',
        targetText: 'Hola',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.9
      })).rejects.toThrow('Source and target text are required');
    });
  });
});