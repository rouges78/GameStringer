import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  TranslationMemoryDatabase, 
  GlossaryDatabase, 
  DatabaseMaintenance 
} from '@/lib/utils/database';
import type { TranslationMemoryEntry, GlossaryEntry } from '@/lib/types/translation-memory';

// Mock Prisma client
const mockPrisma = {
  translationMemoryEntry: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn()
  },
  glossaryEntry: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn()
  },
  translationProject: {
    count: vi.fn()
  },
  batchOperation: {
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn()
  }
};

vi.mock('@/lib/utils/database', async () => {
  const actual = await vi.importActual('@/lib/utils/database');
  return {
    ...actual,
    prisma: mockPrisma
  };
});

describe('Translation Memory Database Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('TranslationMemoryDatabase Performance', () => {
    it('should handle large batch of memory entries efficiently', async () => {
      const startTime = Date.now();
      const batchSize = 1000;
      
      // Mock database responses
      mockPrisma.translationMemoryEntry.findFirst.mockResolvedValue(null);
      mockPrisma.translationMemoryEntry.create.mockImplementation(() => 
        Promise.resolve({ id: `entry-${Date.now()}` })
      );

      // Add many entries
      const promises = Array.from({ length: batchSize }, (_, i) => 
        TranslationMemoryDatabase.addEntry({
          sourceText: `Source text ${i}`,
          targetText: `Target text ${i}`,
          sourceLanguage: 'en',
          targetLanguage: 'es',
          confidence: 0.9
        })
      );

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds for 1000 entries
      expect(mockPrisma.translationMemoryEntry.create).toHaveBeenCalledTimes(batchSize);
    });

    it('should efficiently search through large dataset', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `entry-${i}`,
        sourceText: `Source text ${i}`,
        targetText: `Target text ${i}`,
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: Math.random(),
        usageCount: Math.floor(Math.random() * 100),
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: i % 10 === 0 ? 'project-1' : null
      }));

      mockPrisma.translationMemoryEntry.findMany.mockResolvedValue(largeDataset.slice(0, 10));

      const startTime = Date.now();
      
      const results = await TranslationMemoryDatabase.searchEntries(
        'Source text',
        'en',
        'es',
        'project-1',
        10
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should be very fast with proper indexing
      expect(results).toHaveLength(10);
      expect(mockPrisma.translationMemoryEntry.findMany).toHaveBeenCalledWith({
        where: {
          sourceLanguage: 'en',
          targetLanguage: 'es',
          projectId: 'project-1',
          OR: [
            { sourceText: { contains: 'Source text' } },
            { sourceText: 'Source text' }
          ]
        },
        orderBy: [
          { usageCount: 'desc' },
          { confidence: 'desc' },
          { updatedAt: 'desc' }
        ],
        take: 10
      });
    });

    it('should handle concurrent memory operations', async () => {
      mockPrisma.translationMemoryEntry.findFirst.mockResolvedValue(null);
      mockPrisma.translationMemoryEntry.create.mockImplementation(() => 
        Promise.resolve({ id: `entry-${Date.now()}-${Math.random()}` })
      );

      const concurrentOperations = 50;
      const startTime = Date.now();

      // Simulate concurrent add operations
      const promises = Array.from({ length: concurrentOperations }, (_, i) => 
        TranslationMemoryDatabase.addEntry({
          sourceText: `Concurrent source ${i}`,
          targetText: `Concurrent target ${i}`,
          sourceLanguage: 'en',
          targetLanguage: 'es',
          confidence: 0.8
        })
      );

      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(concurrentOperations);
      expect(duration).toBeLessThan(2000); // Should handle concurrent operations efficiently
      expect(mockPrisma.translationMemoryEntry.create).toHaveBeenCalledTimes(concurrentOperations);
    });

    it('should efficiently update usage counts', async () => {
      mockPrisma.translationMemoryEntry.update.mockResolvedValue({ id: 'entry-1' });

      const updateOperations = 100;
      const startTime = Date.now();

      // Simulate many usage count updates
      const promises = Array.from({ length: updateOperations }, () => 
        TranslationMemoryDatabase.incrementUsage('entry-1')
      );

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should be fast
      expect(mockPrisma.translationMemoryEntry.update).toHaveBeenCalledTimes(updateOperations);
    });
  });

  describe('GlossaryDatabase Performance', () => {
    it('should handle large glossary efficiently', async () => {
      const largeGlossary = Array.from({ length: 5000 }, (_, i) => ({
        id: `term-${i}`,
        term: `Term ${i}`,
        translation: `Translation ${i}`,
        sourceLanguage: 'en',
        targetLanguage: 'es',
        approved: i % 2 === 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      mockPrisma.glossaryEntry.findMany.mockResolvedValue(largeGlossary.slice(0, 20));

      const startTime = Date.now();
      
      const results = await GlossaryDatabase.searchTerms(
        'Term',
        'en',
        'es',
        'project-1'
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50); // Should be very fast
      expect(results.length).toBeGreaterThan(0);
    });

    it('should efficiently add multiple glossary terms', async () => {
      mockPrisma.glossaryEntry.create.mockImplementation(() => 
        Promise.resolve({ id: `term-${Date.now()}` })
      );

      const termCount = 500;
      const startTime = Date.now();

      const promises = Array.from({ length: termCount }, (_, i) => 
        GlossaryDatabase.addTerm({
          term: `Batch term ${i}`,
          translation: `Batch translation ${i}`,
          sourceLanguage: 'en',
          targetLanguage: 'es'
        })
      );

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000); // Should handle batch operations well
      expect(mockPrisma.glossaryEntry.create).toHaveBeenCalledTimes(termCount);
    });
  });

  describe('DatabaseMaintenance Performance', () => {
    it('should efficiently get memory statistics', async () => {
      mockPrisma.translationMemoryEntry.count.mockResolvedValue(10000);
      mockPrisma.glossaryEntry.count.mockResolvedValue(5000);
      mockPrisma.translationProject.count.mockResolvedValue(10);

      const startTime = Date.now();
      
      const stats = await DatabaseMaintenance.getMemoryStats();
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should be very fast
      expect(stats).toEqual({
        totalEntries: 10000,
        totalGlossaryTerms: 5000,
        totalProjects: 10
      });
    });

    it('should efficiently cleanup old batch operations', async () => {
      mockPrisma.batchOperation.deleteMany.mockResolvedValue({ count: 100 });

      const startTime = Date.now();
      
      await DatabaseMaintenance.cleanupOldBatchOperations(30);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200); // Should be fast
      expect(mockPrisma.batchOperation.deleteMany).toHaveBeenCalledWith({
        where: {
          completedAt: {
            lt: expect.any(Date)
          },
          status: {
            in: ['completed', 'failed', 'cancelled']
          }
        }
      });
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not cause memory leaks with large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate processing large amounts of data
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `entry-${i}`,
        sourceText: `Source text ${i}`.repeat(10), // Make strings longer
        targetText: `Target text ${i}`.repeat(10),
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: Math.random(),
        usageCount: Math.floor(Math.random() * 100),
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      mockPrisma.translationMemoryEntry.findMany.mockResolvedValue(largeDataset);

      // Process the data multiple times
      for (let i = 0; i < 10; i++) {
        await TranslationMemoryDatabase.searchEntries(
          'Source text',
          'en',
          'es',
          undefined,
          1000
        );
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Database Query Optimization', () => {
    it('should use proper indexes for search queries', async () => {
      mockPrisma.translationMemoryEntry.findMany.mockResolvedValue([]);

      await TranslationMemoryDatabase.searchEntries(
        'test query',
        'en',
        'es',
        'project-1',
        10
      );

      // Verify that the query uses indexed fields
      expect(mockPrisma.translationMemoryEntry.findMany).toHaveBeenCalledWith({
        where: {
          sourceLanguage: 'en', // Indexed field
          targetLanguage: 'es', // Indexed field
          projectId: 'project-1', // Indexed field
          OR: [
            { sourceText: { contains: 'test query' } }, // Indexed field
            { sourceText: 'test query' }
          ]
        },
        orderBy: [
          { usageCount: 'desc' }, // Indexed field
          { confidence: 'desc' }, // Indexed field
          { updatedAt: 'desc' } // Indexed field
        ],
        take: 10
      });
    });

    it('should optimize glossary search queries', async () => {
      mockPrisma.glossaryEntry.findMany.mockResolvedValue([]);

      await GlossaryDatabase.searchTerms(
        'test term',
        'en',
        'es',
        'project-1'
      );

      // Verify optimized query structure
      expect(mockPrisma.glossaryEntry.findMany).toHaveBeenCalledWith({
        where: {
          sourceLanguage: 'en', // Indexed field
          targetLanguage: 'es', // Indexed field
          projectId: 'project-1', // Indexed field
          OR: [
            { term: { contains: 'test term' } }, // Indexed field
            { translation: { contains: 'test term' } },
            { definition: { contains: 'test term' } }
          ]
        },
        orderBy: [
          { approved: 'desc' }, // Indexed field
          { term: 'asc' }
        ]
      });
    });
  });
});