import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  batchTranslateProcessor,
  batchStatusUpdateProcessor,
  batchDeleteProcessor,
  translationBatchOperations
} from '@/lib/translation-batch-operations';
import { TranslationBatchItem } from '@/lib/translation-batch-operations';

// Mock Prisma
const mockPrisma = {
  translation: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn()
  }
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}));

describe('Translation Batch Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('batchTranslateProcessor', () => {
    it('should translate a pending translation', async () => {
      const mockTranslation = {
        id: 'trans1',
        originalText: 'Hello World',
        translatedText: '',
        status: 'pending',
        game: { title: 'Test Game' }
      };

      const mockUpdatedTranslation = {
        ...mockTranslation,
        translatedText: 'Ciao Mondo',
        status: 'completed',
        confidence: 0.85
      };

      mockPrisma.translation.findUnique.mockResolvedValue(mockTranslation);
      mockPrisma.translation.update.mockResolvedValue(mockUpdatedTranslation);

      const item: TranslationBatchItem = {
        id: 'trans1',
        data: { targetLanguage: 'it', sourceLanguage: 'en' }
      };

      const result = await batchTranslateProcessor(item);

      expect(result.translationId).toBe('trans1');
      expect(result.translatedText).toBe('Ciao Mondo');
      expect(result.updated).toBe(true);
      expect(mockPrisma.translation.update).toHaveBeenCalledWith({
        where: { id: 'trans1' },
        data: expect.objectContaining({
          translatedText: 'Ciao Mondo',
          targetLanguage: 'it',
          status: 'completed',
          confidence: 0.85
        })
      });
    });

    it('should skip already translated items', async () => {
      const mockTranslation = {
        id: 'trans1',
        originalText: 'Hello World',
        translatedText: 'Ciao Mondo',
        status: 'completed',
        game: { title: 'Test Game' }
      };

      mockPrisma.translation.findUnique.mockResolvedValue(mockTranslation);

      const item: TranslationBatchItem = {
        id: 'trans1',
        data: { targetLanguage: 'it', sourceLanguage: 'en' }
      };

      const result = await batchTranslateProcessor(item);

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Already translated');
      expect(mockPrisma.translation.update).not.toHaveBeenCalled();
    });

    it('should throw error for non-existent translation', async () => {
      mockPrisma.translation.findUnique.mockResolvedValue(null);

      const item: TranslationBatchItem = {
        id: 'nonexistent',
        data: { targetLanguage: 'it', sourceLanguage: 'en' }
      };

      await expect(batchTranslateProcessor(item)).rejects.toThrow(
        'Translation not found: nonexistent'
      );
    });
  });

  describe('batchStatusUpdateProcessor', () => {
    it('should update translation status', async () => {
      const mockUpdatedTranslation = {
        id: 'trans1',
        status: 'reviewed'
      };

      mockPrisma.translation.update.mockResolvedValue(mockUpdatedTranslation);

      const item: TranslationBatchItem = {
        id: 'trans1',
        data: { status: 'reviewed' }
      };

      const result = await batchStatusUpdateProcessor(item);

      expect(result.translationId).toBe('trans1');
      expect(result.newStatus).toBe('reviewed');
      expect(result.updated).toBe(true);
      expect(mockPrisma.translation.update).toHaveBeenCalledWith({
        where: { id: 'trans1' },
        data: expect.objectContaining({
          status: 'reviewed'
        })
      });
    });

    it('should throw error when status is missing', async () => {
      const item: TranslationBatchItem = {
        id: 'trans1',
        data: {}
      };

      await expect(batchStatusUpdateProcessor(item)).rejects.toThrow(
        'Status is required for status update operation'
      );
    });
  });

  describe('batchDeleteProcessor', () => {
    it('should delete translation', async () => {
      const mockDeletedTranslation = {
        id: 'trans1',
        originalText: 'Hello World'
      };

      mockPrisma.translation.delete.mockResolvedValue(mockDeletedTranslation);

      const item: TranslationBatchItem = {
        id: 'trans1',
        data: {}
      };

      const result = await batchDeleteProcessor(item);

      expect(result.translationId).toBe('trans1');
      expect(result.deleted).toBe(true);
      expect(result.originalText).toBe('Hello World');
      expect(mockPrisma.translation.delete).toHaveBeenCalledWith({
        where: { id: 'trans1' }
      });
    });
  });

  describe('translationBatchOperations', () => {
    it('should have all required batch operations', () => {
      expect(translationBatchOperations).toHaveLength(4);
      
      const operationIds = translationBatchOperations.map(op => op.id);
      expect(operationIds).toContain('batch-translate');
      expect(operationIds).toContain('batch-export');
      expect(operationIds).toContain('batch-approve');
      expect(operationIds).toContain('batch-delete');
    });

    it('should have proper operation configurations', () => {
      const translateOp = translationBatchOperations.find(op => op.id === 'batch-translate');
      expect(translateOp?.requiresConfirmation).toBe(false);
      expect(translateOp?.name).toBe('Translate');

      const deleteOp = translationBatchOperations.find(op => op.id === 'batch-delete');
      expect(deleteOp?.requiresConfirmation).toBe(true);
      expect(deleteOp?.name).toBe('Delete');
    });

    it('should execute translate operation', async () => {
      const mockTranslation = {
        id: 'trans1',
        originalText: 'Hello',
        translatedText: '',
        status: 'pending',
        game: { title: 'Test Game' }
      };

      mockPrisma.translation.findUnique.mockResolvedValue(mockTranslation);
      mockPrisma.translation.update.mockResolvedValue({
        ...mockTranslation,
        translatedText: 'Ciao',
        status: 'completed'
      });

      const translateOp = translationBatchOperations.find(op => op.id === 'batch-translate');
      const result = await translateOp!.action(['trans1']);

      expect(result.totalItems).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
    });

    it('should handle operation errors gracefully', async () => {
      mockPrisma.translation.findUnique.mockRejectedValue(new Error('Database error'));

      const translateOp = translationBatchOperations.find(op => op.id === 'batch-translate');
      const result = await translateOp!.action(['trans1']);

      expect(result.totalItems).toBe(1);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('Database error');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large batches efficiently', async () => {
      const itemCount = 100;
      const items = Array.from({ length: itemCount }, (_, i) => `trans${i}`);

      // Mock successful responses for all items
      mockPrisma.translation.findUnique.mockResolvedValue({
        id: 'trans1',
        originalText: 'Test',
        translatedText: '',
        status: 'pending',
        game: { title: 'Test Game' }
      });

      mockPrisma.translation.update.mockResolvedValue({
        id: 'trans1',
        translatedText: 'Test Translated',
        status: 'completed'
      });

      const translateOp = translationBatchOperations.find(op => op.id === 'batch-translate');
      const startTime = Date.now();
      
      const result = await translateOp!.action(items);
      
      const duration = Date.now() - startTime;

      expect(result.totalItems).toBe(itemCount);
      expect(result.successCount).toBe(itemCount);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle mixed success/failure scenarios', async () => {
      const items = ['trans1', 'trans2', 'trans3', 'trans4', 'trans5'];

      // Mock alternating success/failure
      mockPrisma.translation.findUnique.mockImplementation((args) => {
        const id = args.where.id;
        if (id === 'trans2' || id === 'trans4') {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.resolve({
          id,
          originalText: 'Test',
          translatedText: '',
          status: 'pending',
          game: { title: 'Test Game' }
        });
      });

      mockPrisma.translation.update.mockResolvedValue({
        translatedText: 'Test Translated',
        status: 'completed'
      });

      const translateOp = translationBatchOperations.find(op => op.id === 'batch-translate');
      const result = await translateOp!.action(items);

      expect(result.totalItems).toBe(5);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(2);
    });
  });
});