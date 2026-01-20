import { BatchResult, BatchOperationConfig, BatchOperationType, BatchOperationStatus } from '@/lib/types/batch-operations';

export interface BatchProcessorOptions {
  concurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface BatchItem {
  id: string;
  data: any;
}

export interface BatchProcessorCallbacks {
  onProgress?: (progress: number, status: string) => void;
  onItemStart?: (itemId: string) => void;
  onItemComplete?: (itemId: string, result: any) => void;
  onItemError?: (itemId: string, error: Error, attempt: number) => void;
  onComplete?: (result: BatchResult) => void;
  onError?: (error: Error) => void;
}

export class BatchProcessor {
  private options: Required<BatchProcessorOptions>;
  private callbacks: BatchProcessorCallbacks;
  private isRunning = false;
  private isCancelled = false;
  private currentOperationId: string | null = null;

  constructor(
    options: BatchProcessorOptions = {},
    callbacks: BatchProcessorCallbacks = {}
  ) {
    this.options = {
      concurrency: options.concurrency ?? 3,
      retryAttempts: options.retryAttempts ?? 2,
      retryDelay: options.retryDelay ?? 1000,
      timeout: options.timeout ?? 30000,
    };
    this.callbacks = callbacks;
  }

  async processBatch<T, R>(
    items: BatchItem[],
    processor: (item: BatchItem) => Promise<R>,
    operationType: BatchOperationType = 'translate'
  ): Promise<BatchResult> {
    if (this.isRunning) {
      throw new Error('Batch processor is already running');
    }

    this.isRunning = true;
    this.isCancelled = false;
    this.currentOperationId = `${operationType}-${Date.now()}`;

    const startTime = Date.now();
    const results: BatchResult['results'] = [];
    let completedCount = 0;
    let failedCount = 0;

    try {
      // Process items with concurrency control
      await this.processWithConcurrency(
        items,
        async (item) => {
          if (this.isCancelled) {
            throw new Error('Operation cancelled');
          }

          this.callbacks.onItemStart?.(item.id);
          
          try {
            const result = await this.processItemWithRetry(item, processor);
            results.push({
              itemId: item.id,
              success: true,
              result
            });
            completedCount++;
            this.callbacks.onItemComplete?.(item.id, result);
          } catch (error) {
            results.push({
              itemId: item.id,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
            failedCount++;
            this.callbacks.onItemError?.(item.id, error as Error, this.options.retryAttempts);
          }

          // Update progress
          const progress = ((completedCount + failedCount) / items.length) * 100;
          const status = `Processing ${completedCount + failedCount}/${items.length} items`;
          this.callbacks.onProgress?.(progress, status);
        }
      );

      const duration = Date.now() - startTime;
      const batchResult: BatchResult = {
        operationId: this.currentOperationId,
        totalItems: items.length,
        successCount: completedCount,
        failureCount: failedCount,
        results,
        duration,
        completedAt: new Date()
      };

      this.callbacks.onComplete?.(batchResult);
      return batchResult;

    } catch (error) {
      this.callbacks.onError?.(error as Error);
      throw error;
    } finally {
      this.isRunning = false;
      this.currentOperationId = null;
    }
  }

  private async processWithConcurrency<T, R>(
    items: BatchItem[],
    processor: (item: BatchItem) => Promise<R>
  ): Promise<void> {
    const semaphore = new Semaphore(this.options.concurrency);
    
    const promises = items.map(async (item) => {
      await semaphore.acquire();
      try {
        return await processor(item);
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);
  }

  private async processItemWithRetry<T, R>(
    item: BatchItem,
    processor: (item: BatchItem) => Promise<R>
  ): Promise<R> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.retryAttempts; attempt++) {
      try {
        // Add timeout to individual item processing
        return await this.withTimeout(
          processor(item),
          this.options.timeout
        );
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.options.retryAttempts) {
          // Wait before retry
          await this.delay(this.options.retryDelay * (attempt + 1));
          this.callbacks.onItemError?.(item.id, lastError, attempt + 1);
        }
      }
    }

    throw lastError;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cancel(): void {
    this.isCancelled = true;
  }

  isProcessing(): boolean {
    return this.isRunning;
  }

  getCurrentOperationId(): string | null {
    return this.currentOperationId;
  }
}

// Semaphore class for concurrency control
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      this.permits--;
      resolve();
    }
  }
}

// Factory function for creating batch processors with common configurations
export function createBatchProcessor(
  type: BatchOperationType,
  options: BatchProcessorOptions = {}
): BatchProcessor {
  const defaultOptions: Record<BatchOperationType, BatchProcessorOptions> = {
    translate: { concurrency: 2, retryAttempts: 3, retryDelay: 2000 },
    export: { concurrency: 1, retryAttempts: 1, retryDelay: 1000 },
    import: { concurrency: 1, retryAttempts: 2, retryDelay: 1500 },
    status_update: { concurrency: 5, retryAttempts: 2, retryDelay: 500 },
    delete: { concurrency: 3, retryAttempts: 1, retryDelay: 1000 },
    approve: { concurrency: 5, retryAttempts: 1, retryDelay: 500 },
    reject: { concurrency: 5, retryAttempts: 1, retryDelay: 500 },
  };

  const mergedOptions = { ...defaultOptions[type], ...options };
  return new BatchProcessor(mergedOptions);
}