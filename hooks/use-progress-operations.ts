'use client';

import { useCallback, useRef } from 'react';
import { useProgress } from '@/components/progress/progress-provider';
import type { ProgressConfig } from '@/lib/types/progress';
import { ProgressUtils } from '@/components/progress/progress-provider';

/**
 * Hook per gestire operazioni con indicatori di progresso
 */
export function useProgressOperations() {
  const progressState = useProgress();
  const operationCounter = useRef(0);

  // Genera ID unico per l'operazione
  const generateOperationId = useCallback((prefix: string = 'operation') => {
    operationCounter.current += 1;
    return `${prefix}-${Date.now()}-${operationCounter.current}`;
  }, []);

  // Esegue un'operazione semplice con progresso
  const executeOperation = useCallback(
    async <T>(
      operation: (updateProgress: (progress: number, status?: string) => void) => Promise<T>,
      config: Omit<ProgressConfig, 'onComplete' | 'onError'> & { id?: string }
    ): Promise<T> => {
      const operationId = config.id || generateOperationId();
      
      return ProgressUtils.createManagedOperation(
        progressState,
        operationId,
        config,
        operation
      ) as Promise<T>;
    },
    [progressState, generateOperationId]
  );

  // Esegue operazioni batch con progresso
  const executeBatchOperation = useCallback(
    async <T, R>(
      items: T[],
      processor: (item: T, index: number) => Promise<R>,
      config: Omit<ProgressConfig, 'onComplete' | 'onError'> & { id?: string }
    ): Promise<Array<{ success: boolean; result?: R; error?: Error; item: T }>> => {
      const operationId = config.id || generateOperationId('batch');
      
      return ProgressUtils.createBatchOperation(
        progressState,
        operationId,
        config,
        items,
        processor
      ) as Promise<Array<{ success: boolean; result?: R; error?: Error; item: T }>>;
    },
    [progressState, generateOperationId]
  );

  // Esegue operazioni parallele con progresso combinato
  const executeParallelOperations = useCallback(
    async <T>(
      operations: Array<{
        operation: (updateProgress: (progress: number, status?: string) => void) => Promise<T>;
        weight?: number;
        title: string;
      }>,
      config: Omit<ProgressConfig, 'onComplete' | 'onError'> & { id?: string }
    ): Promise<T[]> => {
      const operationId = config.id || generateOperationId('parallel');
      
      return ProgressUtils.createManagedOperation(
        progressState,
        operationId,
        config,
        async (updateOverallProgress) => {
          const results: T[] = [];
          const totalWeight = operations.reduce((sum, op) => sum + (op.weight || 1), 0);
          let completedWeight = 0;

          // Esegui operazioni in parallelo
          const promises = operations.map(async (op, index) => {
            const weight = op.weight || 1;
            let lastProgress = 0;

            const result = await op.operation((progress, status) => {
              // Calcola progresso parziale per questa operazione
              const progressDelta = (progress - lastProgress) * (weight / totalWeight);
              completedWeight += progressDelta;
              lastProgress = progress;

              const overallProgress = (completedWeight / totalWeight) * 100;
              updateOverallProgress(
                overallProgress,
                status || `${op.title} - ${progress.toFixed(1)}%`
              );
            });

            return result;
          });

          const allResults = await Promise.all(promises);
          return allResults;
        }
      ) as Promise<T[]>;
    },
    [progressState, generateOperationId]
  );

  // Operazione con retry automatico
  const executeWithRetry = useCallback(
    async <T>(
      operation: (updateProgress: (progress: number, status?: string) => void) => Promise<T>,
      config: Omit<ProgressConfig, 'onComplete' | 'onError'> & { 
        id?: string;
        maxRetries?: number;
        retryDelay?: number;
      }
    ): Promise<T> => {
      const { maxRetries = 3, retryDelay = 1000, ...progressConfig } = config;
      const operationId = config.id || generateOperationId('retry');
      
      return ProgressUtils.createManagedOperation(
        progressState,
        operationId,
        progressConfig,
        async (updateProgress) => {
          let lastError: Error | null = null;
          
          for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
              updateProgress(
                0,
                attempt === 1 
                  ? 'Avvio operazione...' 
                  : `Tentativo ${attempt}/${maxRetries + 1}...`
              );

              const result = await operation((progress, status) => {
                updateProgress(progress, status);
              });

              return result;
            } catch (error) {
              lastError = error as Error;
              
              if (attempt <= maxRetries) {
                updateProgress(
                  (attempt / (maxRetries + 1)) * 100,
                  `Tentativo ${attempt} fallito, riprovo in ${retryDelay}ms...`
                );
                
                await new Promise(resolve => setTimeout(resolve, retryDelay));
              }
            }
          }

          throw lastError || new Error('Operazione fallita dopo tutti i tentativi');
        }
      ) as Promise<T>;
    },
    [progressState, generateOperationId]
  );

  // Operazione con timeout
  const executeWithTimeout = useCallback(
    async <T>(
      operation: (updateProgress: (progress: number, status?: string) => void) => Promise<T>,
      config: Omit<ProgressConfig, 'onComplete' | 'onError'> & { 
        id?: string;
        timeout: number;
      }
    ): Promise<T> => {
      const { timeout, ...progressConfig } = config;
      const operationId = config.id || generateOperationId('timeout');
      
      return ProgressUtils.createManagedOperation(
        progressState,
        operationId,
        progressConfig,
        async (updateProgress) => {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Operazione scaduta dopo ${timeout}ms`));
            }, timeout);
          });

          const operationPromise = operation(updateProgress);

          return Promise.race([operationPromise, timeoutPromise]);
        }
      ) as Promise<T>;
    },
    [progressState, generateOperationId]
  );

  return {
    // Operazioni base
    executeOperation,
    executeBatchOperation,
    executeParallelOperations,
    
    // Operazioni avanzate
    executeWithRetry,
    executeWithTimeout,
    
    // Accesso diretto al state
    progressState,
    
    // Utility
    generateOperationId
  };
}

/**
 * Hook semplificato per operazioni comuni
 */
export function useSimpleProgress() {
  const { executeOperation } = useProgressOperations();

  const runWithProgress = useCallback(
    async <T>(
      title: string,
      operation: (updateProgress: (progress: number, status?: string) => void) => Promise<T>,
      options?: {
        description?: string;
        canCancel?: boolean;
        canMinimize?: boolean;
      }
    ): Promise<T> => {
      return executeOperation(operation, {
        title,
        description: options?.description,
        canCancel: options?.canCancel ?? false,
        canMinimize: options?.canMinimize ?? true
      });
    },
    [executeOperation]
  );

  return { runWithProgress };
}