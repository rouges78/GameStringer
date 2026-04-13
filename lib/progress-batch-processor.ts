/**
 * Wrapper per BatchProcessor che integra il sistema di progresso
 */

import { BatchProcessor, BatchProcessorOptions, BatchItem } from './batch-processor';
import { BatchOperationType, BatchResult } from '@/lib/types/batch-operations';
import type { ProgressConfig } from '@/lib/types/progress';
import { clientLogger } from '@/lib/client-logger';

interface ProgressStateApi {
  startOperation(id: string, config: ProgressConfig): void;
  completeOperation(id: string, result: BatchResult): void;
  failOperation(id: string, error: Error): void;
  updateProgress(id: string, progress: number, status: string): void;
  getOperation(id: string): { progress: number } | null;
}

export interface ProgressBatchProcessorOptions extends BatchProcessorOptions {
  progressConfig?: Partial<ProgressConfig>;
  showNotifications?: boolean;
  autoMinimize?: boolean;
}

export class ProgressBatchProcessor {
  private batchProcessor: BatchProcessor;
  private progressState: unknown;
  private options: ProgressBatchProcessorOptions;

  private get ps(): ProgressStateApi {
    return this.progressState as ProgressStateApi;
  }

  constructor(
    progressState: unknown,
    options: ProgressBatchProcessorOptions = {}
  ) {
    this.progressState = progressState;
    this.options = options;
    
    // Crea il batch processor con callbacks di progresso
    this.batchProcessor = new BatchProcessor(options, {
      onProgress: this.handleProgress.bind(this),
      onItemStart: this.handleItemStart.bind(this),
      onItemComplete: this.handleItemComplete.bind(this),
      onItemError: this.handleItemError.bind(this),
      onComplete: this.handleComplete.bind(this),
      onError: this.handleError.bind(this)
    });
  }

  async processBatch<T, R>(
    items: BatchItem[],
    processor: (item: BatchItem) => Promise<R>,
    operationType: BatchOperationType = 'translate',
    customProgressConfig?: Partial<ProgressConfig>
  ): Promise<BatchResult> {
    const operationId = `batch-${operationType}-${Date.now()}`;
    
    // Configurazione progresso
    const progressConfig: ProgressConfig = {
      title: this.getOperationTitle(operationType, items.length),
      description: this.getOperationDescription(operationType, items.length),
      canMinimize: this.options.autoMinimize ?? true,
      canCancel: true,
      isBackground: items.length > 10, // Operazioni grandi vanno in background
      onCancel: () => this.batchProcessor.cancel(),
      ...this.options.progressConfig,
      ...customProgressConfig
    };

    // Avvia operazione con progresso
    this.ps.startOperation(operationId, progressConfig);

    try {
      const result = await this.batchProcessor.processBatch(
        items,
        processor,
        operationType
      );

      this.ps.completeOperation(operationId, result);
      return result;
    } catch (error: unknown) {
      this.ps.failOperation(operationId, error as Error);
      throw error;
    }
  }

  private handleProgress(progress: number, status: string) {
    const operationId = this.batchProcessor.getCurrentOperationId();
    if (operationId) {
      this.ps.updateProgress(operationId, progress, status);
    }
  }

  private handleItemStart(itemId: string) {
    // Opzionalmente, potresti aggiornare lo status con l'item corrente
    const operationId = this.batchProcessor.getCurrentOperationId();
    if (operationId) {
      const operation = this.ps.getOperation(operationId);
      if (operation) {
        this.ps.updateProgress(
          operationId,
          operation.progress,
          `Elaborazione: ${itemId}`
        );
      }
    }
  }

  private handleItemComplete(_itemId: string, _result: unknown) {
    // Potresti aggiungere logging o altre azioni qui
  }

  private handleItemError(itemId: string, error: Error, attempt: number) {
    // Potresti aggiungere logging degli errori qui
    clientLogger.warn(`Errore nell'elaborazione di ${itemId} (tentativo ${attempt}):`, error);
  }

  private handleComplete(_result: BatchResult) {
    // Operazione completata, il progresso è già gestito nel processBatch
  }

  private handleError(_error: Error) {
    // Errore generale, il progresso è già gestito nel processBatch
  }

  private getOperationTitle(operationType: BatchOperationType, itemCount: number): string {
    const titles: Record<BatchOperationType, string> = {
      translate: `Traduzione di ${itemCount} elementi`,
      export: `Esportazione di ${itemCount} elementi`,
      import: `Importazione di ${itemCount} elementi`,
      status_update: `Aggiornamento stato di ${itemCount} elementi`,
      delete: `Eliminazione di ${itemCount} elementi`,
      approve: `Approvazione di ${itemCount} elementi`,
      reject: `Rifiuto di ${itemCount} elementi`
    };

    return titles[operationType] || `Elaborazione di ${itemCount} elementi`;
  }

  private getOperationDescription(operationType: BatchOperationType, _itemCount: number): string {
    const descriptions: Record<BatchOperationType, string> = {
      translate: 'Traduzione automatica in corso...',
      export: 'Esportazione file in corso...',
      import: 'Importazione dati in corso...',
      status_update: 'Aggiornamento stati in corso...',
      delete: 'Eliminazione elementi in corso...',
      approve: 'Approvazione elementi in corso...',
      reject: 'Rifiuto elementi in corso...'
    };

    return descriptions[operationType] || 'Elaborazione in corso...';
  }

  // Metodi di controllo
  cancel(): void {
    this.batchProcessor.cancel();
  }

  isProcessing(): boolean {
    return this.batchProcessor.isProcessing();
  }

  getCurrentOperationId(): string | null {
    return this.batchProcessor.getCurrentOperationId();
  }
}

/**
 * Factory function per creare ProgressBatchProcessor con configurazioni predefinite
 */
export function createProgressBatchProcessor(
  progressState: unknown,
  operationType: BatchOperationType,
  options: ProgressBatchProcessorOptions = {}
): ProgressBatchProcessor {
  const defaultOptions: Record<BatchOperationType, ProgressBatchProcessorOptions> = {
    translate: {
      concurrency: 2,
      retryAttempts: 3,
      retryDelay: 2000,
      autoMinimize: true,
      progressConfig: {
        canMinimize: true,
        canCancel: true,
        isBackground: true
      }
    },
    export: {
      concurrency: 1,
      retryAttempts: 1,
      retryDelay: 1000,
      autoMinimize: false,
      progressConfig: {
        canMinimize: true,
        canCancel: false,
        isBackground: false
      }
    },
    import: {
      concurrency: 1,
      retryAttempts: 2,
      retryDelay: 1500,
      autoMinimize: false,
      progressConfig: {
        canMinimize: true,
        canCancel: true,
        isBackground: false
      }
    },
    status_update: {
      concurrency: 5,
      retryAttempts: 2,
      retryDelay: 500,
      autoMinimize: true,
      progressConfig: {
        canMinimize: true,
        canCancel: true,
        isBackground: true
      }
    },
    delete: {
      concurrency: 3,
      retryAttempts: 1,
      retryDelay: 1000,
      autoMinimize: false,
      progressConfig: {
        canMinimize: true,
        canCancel: true,
        isBackground: false
      }
    },
    approve: {
      concurrency: 5,
      retryAttempts: 1,
      retryDelay: 500,
      autoMinimize: true,
      progressConfig: {
        canMinimize: true,
        canCancel: false,
        isBackground: true
      }
    },
    reject: {
      concurrency: 5,
      retryAttempts: 1,
      retryDelay: 500,
      autoMinimize: true,
      progressConfig: {
        canMinimize: true,
        canCancel: false,
        isBackground: true
      }
    }
  };

  const mergedOptions = { ...defaultOptions[operationType], ...options };
  return new ProgressBatchProcessor(progressState, mergedOptions);
}