import { BatchProcessor, BatchItem, createBatchProcessor } from './batch-processor';
import { BatchResult, BatchOperationType, BatchOperationStatus } from '@/lib/types/batch-operations';
import { prisma } from './prisma';

export interface BatchOperationManagerOptions {
  persistResults?: boolean;
  notifyProgress?: boolean;
}

export class BatchOperationManager {
  private activeOperations = new Map<string, BatchProcessor>();
  private options: BatchOperationManagerOptions;

  constructor(options: BatchOperationManagerOptions = {}) {
    this.options = {
      persistResults: options.persistResults ?? true,
      notifyProgress: options.notifyProgress ?? true,
      ...options
    };
  }

  async startBatchOperation<T, R>(
    operationType: BatchOperationType,
    items: BatchItem[],
    processor: (item: BatchItem) => Promise<R>,
    callbacks?: {
      onProgress?: (progress: number, status: string) => void;
      onComplete?: (result: BatchResult) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<string> {
    const batchProcessor = createBatchProcessor(operationType);
    const operationId = `${operationType}-${Date.now()}`;

    // Store the processor for potential cancellation
    this.activeOperations.set(operationId, batchProcessor);

    // Create database record if persistence is enabled
    let dbOperationId: string | undefined;
    if (this.options.persistResults) {
      const dbOperation = await prisma.batchOperation.create({
        data: {
          operationType,
          status: 'pending',
          totalItems: items.length,
          completedItems: 0,
          failedItems: 0,
          progress: 0
        }
      });
      dbOperationId = dbOperation.id;
    }

    // Set up callbacks with database updates
    const enhancedCallbacks = {
      onProgress: async (progress: number, status: string) => {
        if (this.options.persistResults && dbOperationId) {
          await this.updateOperationProgress(dbOperationId, progress, status);
        }
        callbacks?.onProgress?.(progress, status);
      },
      onComplete: async (result: BatchResult) => {
        if (this.options.persistResults && dbOperationId) {
          await this.completeOperation(dbOperationId, result);
        }
        this.activeOperations.delete(operationId);
        callbacks?.onComplete?.(result);
      },
      onError: async (error: Error) => {
        if (this.options.persistResults && dbOperationId) {
          await this.failOperation(dbOperationId, error);
        }
        this.activeOperations.delete(operationId);
        callbacks?.onError?.(error);
      }
    };

    // Start processing in background
    batchProcessor.processBatch(items, processor, operationType)
      .then(enhancedCallbacks.onComplete)
      .catch(enhancedCallbacks.onError);

    return operationId;
  }

  async cancelOperation(operationId: string): Promise<boolean> {
    const processor = this.activeOperations.get(operationId);
    if (processor) {
      processor.cancel();
      this.activeOperations.delete(operationId);
      
      // Update database status
      if (this.options.persistResults) {
        await this.updateOperationStatus(operationId, 'cancelled');
      }
      
      return true;
    }
    return false;
  }

  async getOperationStatus(operationId: string): Promise<BatchOperationStatus | null> {
    if (!this.options.persistResults) {
      return null;
    }

    const operation = await prisma.batchOperation.findUnique({
      where: { id: operationId }
    });

    if (!operation) {
      return null;
    }

    return {
      id: operation.id,
      type: operation.operationType as BatchOperationType,
      status: operation.status as BatchOperationStatus['status'],
      progress: operation.progress,
      totalItems: operation.totalItems,
      completedItems: operation.completedItems,
      failedItems: operation.failedItems,
      startedAt: operation.startedAt,
      completedAt: operation.completedAt || undefined,
      error: operation.error || undefined
    };
  }

  async listActiveOperations(): Promise<BatchOperationStatus[]> {
    if (!this.options.persistResults) {
      return [];
    }

    const operations = await prisma.batchOperation.findMany({
      where: {
        status: {
          in: ['pending', 'running']
        }
      },
      orderBy: {
        startedAt: 'desc'
      }
    });

    return operations.map(op => ({
      id: op.id,
      type: op.operationType as BatchOperationType,
      status: op.status as BatchOperationStatus['status'],
      progress: op.progress,
      totalItems: op.totalItems,
      completedItems: op.completedItems,
      failedItems: op.failedItems,
      startedAt: op.startedAt,
      completedAt: op.completedAt || undefined,
      error: op.error || undefined
    }));
  }

  async getOperationHistory(limit = 50): Promise<BatchOperationStatus[]> {
    if (!this.options.persistResults) {
      return [];
    }

    const operations = await prisma.batchOperation.findMany({
      orderBy: {
        startedAt: 'desc'
      },
      take: limit
    });

    return operations.map(op => ({
      id: op.id,
      type: op.operationType as BatchOperationType,
      status: op.status as BatchOperationStatus['status'],
      progress: op.progress,
      totalItems: op.totalItems,
      completedItems: op.completedItems,
      failedItems: op.failedItems,
      startedAt: op.startedAt,
      completedAt: op.completedAt || undefined,
      error: op.error || undefined
    }));
  }

  private async updateOperationProgress(
    operationId: string, 
    progress: number, 
    status: string
  ): Promise<void> {
    try {
      await prisma.batchOperation.update({
        where: { id: operationId },
        data: {
          progress,
          status: progress > 0 ? 'running' : 'pending'
        }
      });
    } catch (error) {
      console.error('Failed to update operation progress:', error);
    }
  }

  private async completeOperation(
    operationId: string, 
    result: BatchResult
  ): Promise<void> {
    try {
      await prisma.batchOperation.update({
        where: { id: operationId },
        data: {
          status: 'completed',
          progress: 100,
          completedItems: result.successCount,
          failedItems: result.failureCount,
          completedAt: result.completedAt,
          results: JSON.stringify(result)
        }
      });
    } catch (error) {
      console.error('Failed to complete operation:', error);
    }
  }

  private async failOperation(
    operationId: string, 
    error: Error
  ): Promise<void> {
    try {
      await prisma.batchOperation.update({
        where: { id: operationId },
        data: {
          status: 'failed',
          error: error.message,
          completedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to update operation error:', error);
    }
  }

  private async updateOperationStatus(
    operationId: string, 
    status: BatchOperationStatus['status']
  ): Promise<void> {
    try {
      await prisma.batchOperation.update({
        where: { id: operationId },
        data: {
          status,
          completedAt: status === 'cancelled' ? new Date() : undefined
        }
      });
    } catch (error) {
      console.error('Failed to update operation status:', error);
    }
  }
}

// Singleton instance
export const batchOperationManager = new BatchOperationManager();