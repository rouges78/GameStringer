'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { BatchResult, BatchOperationType, BatchOperationStatus } from '@/lib/types/batch-operations';
import { batchOperationManager } from '@/lib/batch-operation-manager';
import { BatchItem } from '@/lib/batch-processor';

export interface UseBatchOperationsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface BatchOperationState {
  isRunning: boolean;
  currentOperation: string | null;
  progress: number;
  status: string;
  error: Error | null;
  result: BatchResult | null;
}

export function useBatchOperations(options: UseBatchOperationsOptions = {}) {
  const { autoRefresh = false, refreshInterval = 2000 } = options;
  
  const [operationState, setOperationState] = useState<BatchOperationState>({
    isRunning: false,
    currentOperation: null,
    progress: 0,
    status: '',
    error: null,
    result: null
  });

  const [activeOperations, setActiveOperations] = useState<BatchOperationStatus[]>([]);
  const [operationHistory, setOperationHistory] = useState<BatchOperationStatus[]>([]);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  const refreshActiveOperations = useCallback(async () => {
    try {
      const operations = await batchOperationManager.listActiveOperations();
      setActiveOperations(operations);
    } catch (error) {
      console.error('Failed to refresh active operations:', error);
    }
  }, []);

  const refreshOperationHistory = useCallback(async () => {
    try {
      const history = await batchOperationManager.getOperationHistory();
      setOperationHistory(history);
    } catch (error) {
      console.error('Failed to refresh operation history:', error);
    }
  }, []);

  const startBatchOperation = useCallback(async <T, R>(
    operationType: BatchOperationType,
    items: BatchItem[],
    processor: (item: BatchItem) => Promise<R>
  ): Promise<string> => {
    setOperationState(prev => ({
      ...prev,
      isRunning: true,
      currentOperation: null,
      progress: 0,
      status: 'Starting operation...',
      error: null,
      result: null
    }));

    try {
      const operationId = await batchOperationManager.startBatchOperation(
        operationType,
        items,
        processor,
        {
          onProgress: (progress, status) => {
            setOperationState(prev => ({
              ...prev,
              progress,
              status
            }));
          },
          onComplete: (result) => {
            setOperationState(prev => ({
              ...prev,
              isRunning: false,
              progress: 100,
              status: 'Completed',
              result
            }));
            refreshActiveOperations();
            refreshOperationHistory();
          },
          onError: (error) => {
            setOperationState(prev => ({
              ...prev,
              isRunning: false,
              error,
              status: 'Failed'
            }));
            refreshActiveOperations();
            refreshOperationHistory();
          }
        }
      );

      setOperationState(prev => ({
        ...prev,
        currentOperation: operationId
      }));

      refreshActiveOperations();
      return operationId;
    } catch (error) {
      setOperationState(prev => ({
        ...prev,
        isRunning: false,
        error: error as Error,
        status: 'Failed to start'
      }));
      throw error;
    }
  }, [refreshActiveOperations, refreshOperationHistory]);

  const cancelOperation = useCallback(async (operationId: string): Promise<boolean> => {
    try {
      const success = await batchOperationManager.cancelOperation(operationId);
      if (success) {
        setOperationState(prev => ({
          ...prev,
          isRunning: false,
          status: 'Cancelled'
        }));
        refreshActiveOperations();
      }
      return success;
    } catch (error) {
      console.error('Failed to cancel operation:', error);
      return false;
    }
  }, [refreshActiveOperations]);

  const getOperationStatus = useCallback(async (operationId: string): Promise<BatchOperationStatus | null> => {
    try {
      return await batchOperationManager.getOperationStatus(operationId);
    } catch (error) {
      console.error('Failed to get operation status:', error);
      return null;
    }
  }, []);

  const resetState = useCallback(() => {
    setOperationState({
      isRunning: false,
      currentOperation: null,
      progress: 0,
      status: '',
      error: null,
      result: null
    });
  }, []);

  // Auto-refresh active operations
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        refreshActiveOperations();
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refreshActiveOperations]);

  // Initial load
  useEffect(() => {
    refreshActiveOperations();
    refreshOperationHistory();
  }, [refreshActiveOperations, refreshOperationHistory]);

  return {
    // State
    operationState,
    activeOperations,
    operationHistory,
    
    // Actions
    startBatchOperation,
    cancelOperation,
    getOperationStatus,
    resetState,
    
    // Refresh functions
    refreshActiveOperations,
    refreshOperationHistory,
    
    // Computed values
    hasActiveOperations: activeOperations.length > 0,
    isCurrentlyRunning: operationState.isRunning
  };
}

// Specialized hook for translation batch operations
export function useTranslationBatchOperations() {
  const batchOps = useBatchOperations({ autoRefresh: true });

  const batchTranslate = useCallback(async (
    translationIds: string[],
    targetLanguage: string,
    sourceLanguage = 'en'
  ) => {
    const items: BatchItem[] = translationIds.map(id => ({
      id,
      data: { targetLanguage, sourceLanguage }
    }));

    return batchOps.startBatchOperation(
      'translate',
      items,
      async (item) => {
        // This would be replaced with actual translation API call
        const response = await fetch('/api/translations/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            translationId: item.id,
            targetLanguage: item.data.targetLanguage,
            sourceLanguage: item.data.sourceLanguage
          })
        });

        if (!response.ok) {
          throw new Error(`Translation failed: ${response.statusText}`);
        }

        return response.json();
      }
    );
  }, [batchOps]);

  const batchExport = useCallback(async (
    translationIds: string[],
    format: 'json' | 'csv' | 'xlsx' = 'json'
  ) => {
    const items: BatchItem[] = translationIds.map(id => ({
      id,
      data: { format }
    }));

    return batchOps.startBatchOperation(
      'export',
      items,
      async (item) => {
        const response = await fetch('/api/translations/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            translationIds: [item.id],
            format: item.data.format
          })
        });

        if (!response.ok) {
          throw new Error(`Export failed: ${response.statusText}`);
        }

        return response.json();
      }
    );
  }, [batchOps]);

  const batchStatusUpdate = useCallback(async (
    translationIds: string[],
    status: 'pending' | 'completed' | 'reviewed' | 'edited'
  ) => {
    const items: BatchItem[] = translationIds.map(id => ({
      id,
      data: { status }
    }));

    return batchOps.startBatchOperation(
      'status_update',
      items,
      async (item) => {
        const response = await fetch('/api/translations/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            translationId: item.id,
            status: item.data.status
          })
        });

        if (!response.ok) {
          throw new Error(`Status update failed: ${response.statusText}`);
        }

        return response.json();
      }
    );
  }, [batchOps]);

  return {
    ...batchOps,
    batchTranslate,
    batchExport,
    batchStatusUpdate
  };
}