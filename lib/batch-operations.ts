/**
 * Batch Operations Manager
 * Handle bulk operations on translation strings with progress tracking
 */

export type BatchOperationType = 
  | 'translate'
  | 'review'
  | 'approve'
  | 'reject'
  | 'tag'
  | 'untag'
  | 'delete'
  | 'export'
  | 'find-replace'
  | 'copy-source'
  | 'clear';

export interface BatchOperation {
  id: string;
  type: BatchOperationType;
  stringIds: string[];
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalItems: number;
  processedItems: number;
  successCount: number;
  failedCount: number;
  startedAt?: number;
  completedAt?: number;
  estimatedTimeRemaining?: number;
  errors: Array<{ stringId: string; error: string }>;
  options?: Record<string, unknown>;
}

export interface BatchOperationResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: Array<{ stringId: string; error: string }>;
  duration: number;
}

type ProgressCallback = (operation: BatchOperation) => void;
type ItemProcessor = (stringId: string, options?: Record<string, unknown>) => Promise<boolean>;

class BatchOperationsManager {
  private operations: Map<string, BatchOperation> = new Map();
  private processors: Map<BatchOperationType, ItemProcessor> = new Map();
  private listeners: Set<ProgressCallback> = new Set();
  private activeOperation: BatchOperation | null = null;
  private isPaused: boolean = false;
  private shouldCancel: boolean = false;

  constructor() {
    this.registerDefaultProcessors();
  }

  private registerDefaultProcessors(): void {
    // Copy source to target
    this.processors.set('copy-source', async (_stringId) => {
      // In real implementation, would copy source to target
      await this.simulateDelay(50);
      return true;
    });

    // Clear target
    this.processors.set('clear', async (_stringId) => {
      await this.simulateDelay(30);
      return true;
    });

    // Mark as reviewed
    this.processors.set('review', async (_stringId) => {
      await this.simulateDelay(20);
      return true;
    });

    // Approve
    this.processors.set('approve', async (_stringId) => {
      await this.simulateDelay(20);
      return true;
    });

    // Reject
    this.processors.set('reject', async (_stringId) => {
      await this.simulateDelay(20);
      return true;
    });
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Register custom processor
  registerProcessor(type: BatchOperationType, processor: ItemProcessor): void {
    this.processors.set(type, processor);
  }

  // Create and start a batch operation
  async execute(
    type: BatchOperationType,
    stringIds: string[],
    options?: Record<string, unknown>
  ): Promise<BatchOperationResult> {
    if (this.activeOperation && this.activeOperation.status === 'running') {
      throw new Error('Another batch operation is already running');
    }

    const processor = this.processors.get(type);
    if (!processor) {
      throw new Error(`No processor registered for operation type: ${type}`);
    }

    const operation: BatchOperation = {
      id: `batch_${Date.now()}`,
      type,
      stringIds,
      status: 'running',
      progress: 0,
      totalItems: stringIds.length,
      processedItems: 0,
      successCount: 0,
      failedCount: 0,
      startedAt: Date.now(),
      errors: [],
      options,
    };

    this.operations.set(operation.id, operation);
    this.activeOperation = operation;
    this.isPaused = false;
    this.shouldCancel = false;

    this.notifyListeners(operation);

    const startTime = Date.now();

    try {
      for (let i = 0; i < stringIds.length; i++) {
        // Check for cancel
        if (this.shouldCancel) {
          operation.status = 'cancelled';
          break;
        }

        // Handle pause
        while (this.isPaused && !this.shouldCancel) {
          operation.status = 'paused';
          this.notifyListeners(operation);
          await this.simulateDelay(100);
        }

        if (this.shouldCancel) {
          operation.status = 'cancelled';
          break;
        }

        operation.status = 'running';
        const stringId = stringIds[i];

        try {
          const success = await processor(stringId, options);
          if (success) {
            operation.successCount++;
          } else {
            operation.failedCount++;
            operation.errors.push({ stringId, error: 'Processing failed' });
          }
        } catch (error: unknown) {
          operation.failedCount++;
          operation.errors.push({ 
            stringId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }

        operation.processedItems = i + 1;
        operation.progress = Math.round((operation.processedItems / operation.totalItems) * 100);

        // Estimate remaining time
        const elapsed = Date.now() - startTime;
        const avgTimePerItem = elapsed / operation.processedItems;
        const remaining = operation.totalItems - operation.processedItems;
        operation.estimatedTimeRemaining = Math.round(avgTimePerItem * remaining);

        this.notifyListeners(operation);
      }

      if (operation.status !== 'cancelled') {
        operation.status = operation.failedCount === 0 ? 'completed' : 'failed';
      }
      operation.completedAt = Date.now();
      operation.progress = 100;

    } catch {
      operation.status = 'failed';
      operation.completedAt = Date.now();
    }

    this.activeOperation = null;
    this.notifyListeners(operation);

    return {
      success: operation.status === 'completed',
      processedCount: operation.processedItems,
      failedCount: operation.failedCount,
      errors: operation.errors,
      duration: (operation.completedAt || Date.now()) - (operation.startedAt || Date.now()),
    };
  }

  // Pause current operation
  pause(): void {
    if (this.activeOperation && this.activeOperation.status === 'running') {
      this.isPaused = true;
    }
  }

  // Resume paused operation
  resume(): void {
    if (this.activeOperation && this.isPaused) {
      this.isPaused = false;
    }
  }

  // Cancel current operation
  cancel(): void {
    if (this.activeOperation) {
      this.shouldCancel = true;
    }
  }

  // Get current operation status
  getCurrentOperation(): BatchOperation | null {
    return this.activeOperation;
  }

  // Get operation by ID
  getOperation(operationId: string): BatchOperation | undefined {
    return this.operations.get(operationId);
  }

  // Get operation history
  getHistory(limit: number = 10): BatchOperation[] {
    return Array.from(this.operations.values())
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
      .slice(0, limit);
  }

  // Subscribe to progress updates
  subscribe(callback: ProgressCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(operation: BatchOperation): void {
    this.listeners.forEach(callback => callback(operation));
  }

  // Utility: Find and replace in batch
  async findAndReplace(
    stringIds: string[],
    find: string,
    replace: string,
    options?: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }
  ): Promise<BatchOperationResult> {
    this.registerProcessor('find-replace', async (_stringId) => {
      // In real implementation, would modify the string
      await this.simulateDelay(30);
      return true;
    });

    return this.execute('find-replace', stringIds, { find, replace, ...options });
  }

  // Utility: Translate batch with AI
  async translateBatch(
    stringIds: string[],
    provider: string,
    targetLanguage: string,
    options?: { preserveFormatting?: boolean; useGlossary?: boolean }
  ): Promise<BatchOperationResult> {
    this.registerProcessor('translate', async (_stringId) => {
      // In real implementation, would call AI translation
      await this.simulateDelay(200 + Math.random() * 300);
      return Math.random() > 0.05; // 95% success rate
    });

    return this.execute('translate', stringIds, { provider, targetLanguage, ...options });
  }

  // Clear history
  clearHistory(): void {
    const active = this.activeOperation?.id;
    this.operations = new Map(
      Array.from(this.operations.entries())
        .filter(([id]) => id === active)
    );
  }

  // Get stats
  getStats(): {
    totalOperations: number;
    completedOperations: number;
    totalItemsProcessed: number;
    averageSuccessRate: number;
  } {
    const ops = Array.from(this.operations.values());
    const completed = ops.filter(o => o.status === 'completed');
    const totalProcessed = ops.reduce((sum, o) => sum + o.processedItems, 0);
    const totalSuccess = ops.reduce((sum, o) => sum + o.successCount, 0);

    return {
      totalOperations: ops.length,
      completedOperations: completed.length,
      totalItemsProcessed: totalProcessed,
      averageSuccessRate: totalProcessed > 0 
        ? Math.round((totalSuccess / totalProcessed) * 100) 
        : 0,
    };
  }
}

// Singleton
export const batchOperations = new BatchOperationsManager();

// React hook
import { useState, useEffect, useCallback } from 'react';

export function useBatchOperations() {
  const [currentOperation, setCurrentOperation] = useState<BatchOperation | null>(null);
  const [history, setHistory] = useState<BatchOperation[]>([]);

  useEffect(() => {
    const unsubscribe = batchOperations.subscribe((operation) => {
      setCurrentOperation({ ...operation });
      setHistory(batchOperations.getHistory());
    });

    setHistory(batchOperations.getHistory());
    return unsubscribe;
  }, []);

  const execute = useCallback(async (
    type: BatchOperationType,
    stringIds: string[],
    options?: Record<string, unknown>
  ) => {
    return batchOperations.execute(type, stringIds, options);
  }, []);

  return {
    currentOperation,
    history,
    isRunning: currentOperation?.status === 'running',
    isPaused: currentOperation?.status === 'paused',
    
    execute,
    pause: () => batchOperations.pause(),
    resume: () => batchOperations.resume(),
    cancel: () => batchOperations.cancel(),
    
    translateBatch: batchOperations.translateBatch.bind(batchOperations),
    findAndReplace: batchOperations.findAndReplace.bind(batchOperations),
    
    stats: batchOperations.getStats(),
  };
}

export default batchOperations;
