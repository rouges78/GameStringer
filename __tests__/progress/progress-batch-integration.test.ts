import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProgressBatchProcessor, createProgressBatchProcessor } from '@/lib/progress-batch-processor';
import type { BatchItem } from '@/lib/batch-processor';
import type { ProgressState } from '@/lib/types/progress';

// Mock del BatchProcessor
vi.mock('@/lib/batch-processor', () => ({
  BatchProcessor: vi.fn().mockImplementation((options, callbacks) => ({
    processBatch: vi.fn().mockImplementation(async (items, processor, operationType) => {
      // Simula elaborazione batch
      const results = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Simula callbacks di progresso
        callbacks?.onItemStart?.(item.id);
        callbacks?.onProgress?.((i / items.length) * 100, `Processing ${i + 1}/${items.length}`);
        
        try {
          const result = await processor(item);
          results.push({
            itemId: item.id,
            success: true,
            result
          });
          callbacks?.onItemComplete?.(item.id, result);
        } catch (error) {
          results.push({
            itemId: item.id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
          callbacks?.onItemError?.(item.id, error as Error, 1);
        }
      }
      
      const batchResult = {
        operationId: `batch-${operationType}-${Date.now()}`,
        totalItems: items.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results,
        duration: 1000,
        completedAt: new Date()
      };
      
      callbacks?.onComplete?.(batchResult);
      return batchResult;
    }),
    cancel: vi.fn(),
    isProcessing: vi.fn(() => false),
    getCurrentOperationId: vi.fn(() => 'test-operation-id')
  }))
}));

describe('ProgressBatchProcessor Integration', () => {
  let mockProgressState: ProgressState;
  let processor: ProgressBatchProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock del ProgressState
    mockProgressState = {
      operations: new Map(),
      startOperation: vi.fn(),
      updateProgress: vi.fn(),
      completeOperation: vi.fn(),
      failOperation: vi.fn(),
      cancelOperation: vi.fn(),
      getOperation: vi.fn()
    };

    processor = new ProgressBatchProcessor(mockProgressState);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should integrate batch processing with progress tracking', async () => {
    const items: BatchItem[] = [
      { id: 'item1', data: { text: 'Hello' } },
      { id: 'item2', data: { text: 'World' } },
      { id: 'item3', data: { text: 'Test' } }
    ];

    const mockProcessor = vi.fn().mockImplementation(async (item: BatchItem) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { translated: `Translated: ${item.data.text}` };
    });

    const result = await processor.processBatch(items, mockProcessor, 'translate');

    // Verifica che l'operazione sia stata avviata
    expect(mockProgressState.startOperation).toHaveBeenCalledWith(
      expect.stringContaining('batch-translate'),
      expect.objectContaining({
        title: expect.stringContaining('Traduzione di 3 elementi'),
        canMinimize: true,
        canCancel: true
      })
    );

    // Verifica che il progresso sia stato aggiornato
    expect(mockProgressState.updateProgress).toHaveBeenCalled();

    // Verifica che l'operazione sia stata completata
    expect(mockProgressState.completeOperation).toHaveBeenCalledWith(
      expect.stringContaining('batch-translate'),
      expect.objectContaining({
        totalItems: 3,
        successCount: 3,
        failureCount: 0
      })
    );

    // Verifica il risultato
    expect(result.totalItems).toBe(3);
    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);
  });

  it('should handle batch processing errors', async () => {
    const items: BatchItem[] = [
      { id: 'item1', data: { text: 'Hello' } },
      { id: 'item2', data: { text: 'Error' } }
    ];

    const mockProcessor = vi.fn().mockImplementation(async (item: BatchItem) => {
      if (item.data.text === 'Error') {
        throw new Error('Processing failed');
      }
      return { translated: `Translated: ${item.data.text}` };
    });

    const result = await processor.processBatch(items, mockProcessor, 'translate');

    // Verifica che l'operazione sia stata completata anche con errori
    expect(mockProgressState.completeOperation).toHaveBeenCalled();

    // Verifica il risultato
    expect(result.totalItems).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
  });

  it('should handle complete batch failure', async () => {
    const items: BatchItem[] = [
      { id: 'item1', data: { text: 'Hello' } }
    ];

    const mockProcessor = vi.fn().mockRejectedValue(new Error('Complete failure'));

    // Mock del batch processor per simulare fallimento completo
    const mockBatchProcessor = {
      processBatch: vi.fn().mockRejectedValue(new Error('Batch processing failed')),
      cancel: vi.fn(),
      isProcessing: vi.fn(() => false),
      getCurrentOperationId: vi.fn(() => 'test-operation-id')
    };

    // Sostituisci il batch processor interno
    (processor as any).batchProcessor = mockBatchProcessor;

    await expect(processor.processBatch(items, mockProcessor, 'translate')).rejects.toThrow('Batch processing failed');

    // Verifica che l'operazione sia stata marcata come fallita
    expect(mockProgressState.failOperation).toHaveBeenCalledWith(
      expect.stringContaining('batch-translate'),
      expect.any(Error)
    );
  });

  it('should create processor with factory function', () => {
    const factoryProcessor = createProgressBatchProcessor(mockProgressState, 'export');
    
    expect(factoryProcessor).toBeInstanceOf(ProgressBatchProcessor);
  });

  it('should handle different operation types with correct configurations', async () => {
    const exportProcessor = createProgressBatchProcessor(mockProgressState, 'export');
    const items: BatchItem[] = [{ id: 'item1', data: { content: 'test' } }];
    const mockProcessor = vi.fn().mockResolvedValue({ exported: true });

    await exportProcessor.processBatch(items, mockProcessor, 'export');

    // Verifica che sia stata usata la configurazione corretta per export
    expect(mockProgressState.startOperation).toHaveBeenCalledWith(
      expect.stringContaining('batch-export'),
      expect.objectContaining({
        title: expect.stringContaining('Esportazione di 1 elementi'),
        isBackground: false // Export non dovrebbe essere background
      })
    );
  });

  it('should handle cancellation', () => {
    processor.cancel();
    
    // Il cancel dovrebbe essere propagato al batch processor interno
    expect(processor.isProcessing()).toBe(false);
  });

  it('should provide operation status', () => {
    const isProcessing = processor.isProcessing();
    const operationId = processor.getCurrentOperationId();
    
    expect(typeof isProcessing).toBe('boolean');
    expect(typeof operationId).toBe('string');
  });

  it('should handle large batches as background operations', async () => {
    // Crea un batch grande (>10 items)
    const items: BatchItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `item${i}`,
      data: { text: `Text ${i}` }
    }));

    const mockProcessor = vi.fn().mockResolvedValue({ processed: true });

    await processor.processBatch(items, mockProcessor, 'translate');

    // Verifica che sia stata configurata come operazione background
    expect(mockProgressState.startOperation).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        isBackground: true
      })
    );
  });

  it('should update progress during batch processing', async () => {
    const items: BatchItem[] = [
      { id: 'item1', data: { text: 'Hello' } },
      { id: 'item2', data: { text: 'World' } }
    ];

    const mockProcessor = vi.fn().mockResolvedValue({ processed: true });

    await processor.processBatch(items, mockProcessor, 'translate');

    // Verifica che updateProgress sia stato chiamato durante l'elaborazione
    expect(mockProgressState.updateProgress).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
      expect.stringContaining('Processing')
    );
  });

  it('should handle custom progress configuration', async () => {
    const items: BatchItem[] = [{ id: 'item1', data: { text: 'Hello' } }];
    const mockProcessor = vi.fn().mockResolvedValue({ processed: true });

    const customConfig = {
      title: 'Custom Operation',
      description: 'Custom description',
      canCancel: false
    };

    await processor.processBatch(items, mockProcessor, 'translate', customConfig);

    // Verifica che la configurazione personalizzata sia stata utilizzata
    expect(mockProgressState.startOperation).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        title: 'Custom Operation',
        description: 'Custom description',
        canCancel: false
      })
    );
  });
});