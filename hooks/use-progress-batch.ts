'use client';

import { useCallback } from 'react';
import { useProgress } from '@/components/progress/progress-provider';
import { ProgressBatchProcessor, createProgressBatchProcessor } from '@/lib/progress-batch-processor';
import type { BatchItem } from '@/lib/batch-processor';
import type { BatchOperationType, BatchResult } from '@/lib/types/batch-operations';
import type { ProgressConfig } from '@/lib/types/progress';

/**
 * Hook per eseguire operazioni batch con indicatori di progresso
 */
export function useProgressBatch() {
  const progressState = useProgress();

  // Esegue un'operazione batch con progresso
  const executeBatch = useCallback(
    async <T, R>(
      items: BatchItem[],
      processor: (item: BatchItem) => Promise<R>,
      operationType: BatchOperationType = 'translate',
      options?: {
        progressConfig?: Partial<ProgressConfig>;
        concurrency?: number;
        retryAttempts?: number;
        retryDelay?: number;
        autoMinimize?: boolean;
      }
    ): Promise<BatchResult> => {
      const batchProcessor = createProgressBatchProcessor(
        progressState,
        operationType,
        options
      );

      return batchProcessor.processBatch(
        items,
        processor,
        operationType,
        options?.progressConfig
      );
    },
    [progressState]
  );

  // Esegue traduzione batch
  const executeTranslationBatch = useCallback(
    async (
      translations: Array<{ id: string; text: string; targetLanguage: string }>,
      translator: (text: string, targetLanguage: string) => Promise<string>
    ): Promise<BatchResult> => {
      const items: BatchItem[] = translations.map(t => ({
        id: t.id,
        data: t
      }));

      return executeBatch(
        items,
        async (item) => {
          const { text, targetLanguage } = item.data;
          const translatedText = await translator(text, targetLanguage);
          return { translatedText, originalText: text };
        },
        'translate',
        {
          progressConfig: {
            title: `Traduzione di ${translations.length} testi`,
            description: 'Traduzione automatica in corso...',
            canCancel: true,
            isBackground: translations.length > 5
          }
        }
      );
    },
    [executeBatch]
  );

  // Esegue export batch
  const executeExportBatch = useCallback(
    async (
      items: Array<{ id: string; data: any }>,
      exporter: (data: any) => Promise<string>
    ): Promise<BatchResult> => {
      const batchItems: BatchItem[] = items.map(item => ({
        id: item.id,
        data: item.data
      }));

      return executeBatch(
        batchItems,
        async (item) => {
          return exporter(item.data);
        },
        'export',
        {
          progressConfig: {
            title: `Esportazione di ${items.length} elementi`,
            description: 'Generazione file di esportazione...',
            canCancel: false,
            isBackground: false
          }
        }
      );
    },
    [executeBatch]
  );

  // Esegue import batch
  const executeImportBatch = useCallback(
    async (
      items: Array<{ id: string; data: any }>,
      importer: (data: any) => Promise<any>
    ): Promise<BatchResult> => {
      const batchItems: BatchItem[] = items.map(item => ({
        id: item.id,
        data: item.data
      }));

      return executeBatch(
        batchItems,
        async (item) => {
          return importer(item.data);
        },
        'import',
        {
          progressConfig: {
            title: `Importazione di ${items.length} elementi`,
            description: 'Importazione dati in corso...',
            canCancel: true,
            isBackground: false
          }
        }
      );
    },
    [executeBatch]
  );

  // Esegue aggiornamento stato batch
  const executeStatusUpdateBatch = useCallback(
    async (
      items: Array<{ id: string; status: string }>,
      updater: (id: string, status: string) => Promise<void>
    ): Promise<BatchResult> => {
      const batchItems: BatchItem[] = items.map(item => ({
        id: item.id,
        data: item
      }));

      return executeBatch(
        batchItems,
        async (item) => {
          await updater(item.data.id, item.data.status);
          return { updated: true };
        },
        'status_update',
        {
          progressConfig: {
            title: `Aggiornamento di ${items.length} stati`,
            description: 'Aggiornamento stati in corso...',
            canCancel: true,
            isBackground: true
          }
        }
      );
    },
    [executeBatch]
  );

  // Esegue eliminazione batch
  const executeDeleteBatch = useCallback(
    async (
      itemIds: string[],
      deleter: (id: string) => Promise<void>
    ): Promise<BatchResult> => {
      const batchItems: BatchItem[] = itemIds.map(id => ({
        id,
        data: { id }
      }));

      return executeBatch(
        batchItems,
        async (item) => {
          await deleter(item.data.id);
          return { deleted: true };
        },
        'delete',
        {
          progressConfig: {
            title: `Eliminazione di ${itemIds.length} elementi`,
            description: 'Eliminazione in corso...',
            canCancel: true,
            isBackground: false
          }
        }
      );
    },
    [executeBatch]
  );

  // Esegue approvazione batch
  const executeApproveBatch = useCallback(
    async (
      itemIds: string[],
      approver: (id: string) => Promise<void>
    ): Promise<BatchResult> => {
      const batchItems: BatchItem[] = itemIds.map(id => ({
        id,
        data: { id }
      }));

      return executeBatch(
        batchItems,
        async (item) => {
          await approver(item.data.id);
          return { approved: true };
        },
        'approve',
        {
          progressConfig: {
            title: `Approvazione di ${itemIds.length} elementi`,
            description: 'Approvazione in corso...',
            canCancel: false,
            isBackground: true
          }
        }
      );
    },
    [executeBatch]
  );

  return {
    // Funzione generica
    executeBatch,
    
    // Funzioni specifiche
    executeTranslationBatch,
    executeExportBatch,
    executeImportBatch,
    executeStatusUpdateBatch,
    executeDeleteBatch,
    executeApproveBatch,
    
    // Accesso diretto al progress state
    progressState
  };
}

/**
 * Hook semplificato per operazioni batch comuni
 */
export function useSimpleBatch() {
  const { executeBatch } = useProgressBatch();

  const runBatch = useCallback(
    async <T>(
      title: string,
      items: T[],
      processor: (item: T, index: number) => Promise<any>,
      options?: {
        description?: string;
        canCancel?: boolean;
        isBackground?: boolean;
      }
    ) => {
      const batchItems: BatchItem[] = items.map((item, index) => ({
        id: `item-${index}`,
        data: { item, index }
      }));

      return executeBatch(
        batchItems,
        async (batchItem) => {
          const { item, index } = batchItem.data;
          return processor(item, index);
        },
        'translate', // Tipo di default
        {
          progressConfig: {
            title,
            description: options?.description || 'Elaborazione in corso...',
            canCancel: options?.canCancel ?? true,
            isBackground: options?.isBackground ?? items.length > 10
          }
        }
      );
    },
    [executeBatch]
  );

  return { runBatch };
}