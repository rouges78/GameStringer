import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchProcessor, BatchItem, createBatchProcessor } from '@/lib/batch-processor';
import { BatchOperationType } from '@/lib/types/batch-operations';

describe('BatchProcessor', () => {
  let processor: BatchProcessor;
  let mockItems: BatchItem[];

  beforeEach(() => {
    processor = new BatchProcessor({
      concurrency: 2,
      retryAttempts: 1,
      retryDelay: 100,
      timeout: 5000
    });

    mockItems = [
      { id: '1', data: { text: 'Hello' } },
      { id: '2', data: { text: 'World' } },
      { id: '3', data: { text: 'Test' } }
    ];
  });

  describe('processBatch', () => {
    it('should process all items successfully', async () => {
      const mockProcessor = vi.fn().mockImplementation(async (item: BatchItem) => {
        return `Processed: ${item.data.text}`;
      });

      const result = await processor.processBatch(mockItems, mockProcessor, 'translate');

      expect(result.totalItems).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(mockProcessor).toHaveBeenCalledTimes(3);
    });

    it('should handle processing errors with retry', async () => {
      let callCount = 0;
      const mockProcessor = vi.fn().mockImplementation(async (item: BatchItem) => {
        callCount++;
        if (item.id === '2' && callCount <= 2) {
          throw new Error('Processing failed');
        }
        return `Processed: ${item.data.text}`;
      });

      const result = await processor.processBatch(mockItems, mockProcessor, 'translate');

      expect(result.totalItems).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.results.find(r => r.itemId === '2')?.success).toBe(false);
    });

    it('should respect concurrency limits', async () => {
      let activeCount = 0;
      let maxActiveCount = 0;

      const mockProcessor = vi.fn().mockImplementation(async (item: BatchItem) => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        activeCount--;
        return `Processed: ${item.data.text}`;
      });

      await processor.processBatch(mockItems, mockProcessor, 'translate');

      expect(maxActiveCount).toBeLessThanOrEqual(2); // Concurrency limit
    });

    it('should call progress callbacks', async () => {
      const onProgress = vi.fn();
      const onItemComplete = vi.fn();
      
      const processorWithCallbacks = new BatchProcessor(
        { concurrency: 1 },
        { onProgress, onItemComplete }
      );

      const mockProcessor = vi.fn().mockImplementation(async (item: BatchItem) => {
        return `Processed: ${item.data.text}`;
      });

      await processorWithCallbacks.processBatch(mockItems, mockProcessor, 'translate');

      expect(onProgress).toHaveBeenCalled();
      expect(onItemComplete).toHaveBeenCalledTimes(3);
    });

    it('should handle cancellation', async () => {
      const mockProcessor = vi.fn().mockImplementation(async (item: BatchItem) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return `Processed: ${item.data.text}`;
      });

      const processingPromise = processor.processBatch(mockItems, mockProcessor, 'translate');
      
      // Cancel after a short delay
      setTimeout(() => processor.cancel(), 50);

      await expect(processingPromise).rejects.toThrow('Operation cancelled');
    });
  });

  describe('createBatchProcessor', () => {
    it('should create processor with default options for translate operation', () => {
      const translateProcessor = createBatchProcessor('translate');
      expect(translateProcessor).toBeInstanceOf(BatchProcessor);
    });

    it('should create processor with default options for export operation', () => {
      const exportProcessor = createBatchProcessor('export');
      expect(exportProcessor).toBeInstanceOf(BatchProcessor);
    });

    it('should merge custom options with defaults', () => {
      const customProcessor = createBatchProcessor('translate', { concurrency: 5 });
      expect(customProcessor).toBeInstanceOf(BatchProcessor);
    });
  });

  describe('processor state management', () => {
    it('should track processing state correctly', () => {
      expect(processor.isProcessing()).toBe(false);
      expect(processor.getCurrentOperationId()).toBeNull();
    });

    it('should prevent concurrent processing', async () => {
      const mockProcessor = vi.fn().mockImplementation(async (item: BatchItem) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return `Processed: ${item.data.text}`;
      });

      const firstProcessing = processor.processBatch(mockItems, mockProcessor, 'translate');
      
      await expect(
        processor.processBatch(mockItems, mockProcessor, 'translate')
      ).rejects.toThrow('Batch processor is already running');

      await firstProcessing;
    });
  });
});