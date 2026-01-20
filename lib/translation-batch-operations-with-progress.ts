/**
 * Operazioni batch per traduzioni con sistema di progresso integrato
 */

import { Languages, Download, Upload, Check, X, Trash2, FileText } from 'lucide-react';
import type { BatchOperation, BatchResult, TranslationBatchItem } from '@/lib/types/batch-operations';
import type { ProgressState } from '@/lib/types/progress';
import { ProgressBatchProcessor, createProgressBatchProcessor } from '@/lib/progress-batch-processor';
import { 
  batchTranslateProcessor,
  batchExportProcessor,
  batchImportProcessor,
  batchStatusUpdateProcessor,
  batchDeleteProcessor,
  batchApproveProcessor,
  batchRejectProcessor
} from './translation-batch-operations';

/**
 * Crea operazioni batch con supporto per indicatori di progresso
 */
export function createProgressBatchOperations(progressState: ProgressState): BatchOperation[] {
  return [
    {
      id: 'batch-translate',
      name: 'Traduci',
      icon: Languages,
      requiresConfirmation: false,
      description: 'Traduzione automatica degli elementi selezionati usando AI',
      action: async (items: string[]) => {
        const processor = createProgressBatchProcessor(progressState, 'translate');
        
        const batchItems: TranslationBatchItem[] = items.map(id => ({
          id,
          data: { targetLanguage: 'it', sourceLanguage: 'en' }
        }));

        return processor.processBatch(
          batchItems,
          batchTranslateProcessor,
          'translate',
          {
            title: `Traduzione di ${items.length} elementi`,
            description: 'Traduzione automatica in corso...',
            canCancel: true,
            isBackground: items.length > 5
          }
        );
      }
    },
    {
      id: 'batch-export',
      name: 'Esporta',
      icon: Download,
      requiresConfirmation: false,
      description: 'Esporta le traduzioni selezionate in un file',
      action: async (items: string[]) => {
        const processor = createProgressBatchProcessor(progressState, 'export');
        
        const batchItems: TranslationBatchItem[] = items.map(id => ({
          id,
          data: { format: 'json' }
        }));

        return processor.processBatch(
          batchItems,
          batchExportProcessor,
          'export',
          {
            title: `Esportazione di ${items.length} traduzioni`,
            description: 'Generazione file di esportazione...',
            canCancel: false,
            isBackground: false
          }
        );
      }
    },
    {
      id: 'batch-import',
      name: 'Importa',
      icon: Upload,
      requiresConfirmation: true,
      description: 'Importa traduzioni da file esterno',
      action: async (items: string[]) => {
        const processor = createProgressBatchProcessor(progressState, 'import');
        
        const batchItems: TranslationBatchItem[] = items.map(id => ({
          id,
          data: { overwrite: false }
        }));

        return processor.processBatch(
          batchItems,
          batchImportProcessor,
          'import',
          {
            title: `Importazione di ${items.length} traduzioni`,
            description: 'Importazione dati in corso...',
            canCancel: true,
            isBackground: false
          }
        );
      }
    },
    {
      id: 'batch-approve',
      name: 'Approva',
      icon: Check,
      requiresConfirmation: false,
      description: 'Approva le traduzioni selezionate',
      action: async (items: string[]) => {
        const processor = createProgressBatchProcessor(progressState, 'approve');
        
        const batchItems: TranslationBatchItem[] = items.map(id => ({
          id,
          data: { status: 'approved' }
        }));

        return processor.processBatch(
          batchItems,
          batchApproveProcessor,
          'approve',
          {
            title: `Approvazione di ${items.length} traduzioni`,
            description: 'Approvazione in corso...',
            canCancel: false,
            isBackground: items.length > 10
          }
        );
      }
    },
    {
      id: 'batch-reject',
      name: 'Rifiuta',
      icon: X,
      requiresConfirmation: true,
      description: 'Rifiuta le traduzioni selezionate',
      action: async (items: string[]) => {
        const processor = createProgressBatchProcessor(progressState, 'reject');
        
        const batchItems: TranslationBatchItem[] = items.map(id => ({
          id,
          data: { status: 'rejected', reason: 'Batch rejection' }
        }));

        return processor.processBatch(
          batchItems,
          batchRejectProcessor,
          'reject',
          {
            title: `Rifiuto di ${items.length} traduzioni`,
            description: 'Rifiuto in corso...',
            canCancel: false,
            isBackground: items.length > 10
          }
        );
      }
    },
    {
      id: 'batch-status-update',
      name: 'Aggiorna Stato',
      icon: FileText,
      requiresConfirmation: false,
      description: 'Aggiorna lo stato delle traduzioni selezionate',
      action: async (items: string[], newStatus: string = 'pending') => {
        const processor = createProgressBatchProcessor(progressState, 'status_update');
        
        const batchItems: TranslationBatchItem[] = items.map(id => ({
          id,
          data: { status: newStatus }
        }));

        return processor.processBatch(
          batchItems,
          batchStatusUpdateProcessor,
          'status_update',
          {
            title: `Aggiornamento stato di ${items.length} traduzioni`,
            description: `Impostazione stato a "${newStatus}"...`,
            canCancel: true,
            isBackground: items.length > 15
          }
        );
      }
    },
    {
      id: 'batch-delete',
      name: 'Elimina',
      icon: Trash2,
      requiresConfirmation: true,
      description: 'Elimina definitivamente le traduzioni selezionate',
      action: async (items: string[]) => {
        const processor = createProgressBatchProcessor(progressState, 'delete');
        
        const batchItems: TranslationBatchItem[] = items.map(id => ({
          id,
          data: { permanent: true }
        }));

        return processor.processBatch(
          batchItems,
          batchDeleteProcessor,
          'delete',
          {
            title: `Eliminazione di ${items.length} traduzioni`,
            description: 'Eliminazione permanente in corso...',
            canCancel: true,
            isBackground: false
          }
        );
      }
    }
  ];
}

/**
 * Hook per utilizzare le operazioni batch con progresso
 */
export function useProgressBatchOperations(progressState: ProgressState) {
  const operations = createProgressBatchOperations(progressState);

  // Funzioni di utilità per operazioni specifiche
  const executeTranslation = async (translationIds: string[], targetLanguage: string = 'it') => {
    const translateOp = operations.find(op => op.id === 'batch-translate');
    if (!translateOp) throw new Error('Translation operation not found');

    // Personalizza i dati per la traduzione
    const processor = createProgressBatchProcessor(progressState, 'translate');
    const batchItems: TranslationBatchItem[] = translationIds.map(id => ({
      id,
      data: { targetLanguage, sourceLanguage: 'en' }
    }));

    return processor.processBatch(
      batchItems,
      batchTranslateProcessor,
      'translate',
      {
        title: `Traduzione in ${targetLanguage.toUpperCase()} di ${translationIds.length} elementi`,
        description: `Traduzione automatica verso ${targetLanguage}...`,
        canCancel: true,
        isBackground: translationIds.length > 5
      }
    );
  };

  const executeExport = async (translationIds: string[], format: string = 'json') => {
    const exportOp = operations.find(op => op.id === 'batch-export');
    if (!exportOp) throw new Error('Export operation not found');

    const processor = createProgressBatchProcessor(progressState, 'export');
    const batchItems: TranslationBatchItem[] = translationIds.map(id => ({
      id,
      data: { format }
    }));

    return processor.processBatch(
      batchItems,
      batchExportProcessor,
      'export',
      {
        title: `Esportazione ${format.toUpperCase()} di ${translationIds.length} traduzioni`,
        description: `Generazione file ${format}...`,
        canCancel: false,
        isBackground: false
      }
    );
  };

  const executeStatusUpdate = async (translationIds: string[], newStatus: string) => {
    const statusOp = operations.find(op => op.id === 'batch-status-update');
    if (!statusOp) throw new Error('Status update operation not found');

    return statusOp.action(translationIds, newStatus);
  };

  const executeApproval = async (translationIds: string[]) => {
    const approveOp = operations.find(op => op.id === 'batch-approve');
    if (!approveOp) throw new Error('Approve operation not found');

    return approveOp.action(translationIds);
  };

  const executeRejection = async (translationIds: string[]) => {
    const rejectOp = operations.find(op => op.id === 'batch-reject');
    if (!rejectOp) throw new Error('Reject operation not found');

    return rejectOp.action(translationIds);
  };

  const executeDeletion = async (translationIds: string[]) => {
    const deleteOp = operations.find(op => op.id === 'batch-delete');
    if (!deleteOp) throw new Error('Delete operation not found');

    return deleteOp.action(translationIds);
  };

  return {
    operations,
    executeTranslation,
    executeExport,
    executeStatusUpdate,
    executeApproval,
    executeRejection,
    executeDeletion
  };
}