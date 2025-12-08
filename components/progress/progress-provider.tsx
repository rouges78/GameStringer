'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { 
  ProgressState, 
  OperationProgress, 
  ProgressConfig, 
  ProgressEvent,
  ProgressEventType 
} from '@/lib/types/progress';
import { 
  calculateEstimatedTimeRemaining,
  validateProgress,
  createProgressUpdate 
} from '@/lib/utils/progress-calculations';
import { progressPersistence } from '@/lib/progress-persistence';

// Azioni per il reducer
type ProgressAction =
  | { type: 'START_OPERATION'; payload: { id: string; config: ProgressConfig } }
  | { type: 'UPDATE_PROGRESS'; payload: { id: string; progress: number; status?: string } }
  | { type: 'COMPLETE_OPERATION'; payload: { id: string; result?: any } }
  | { type: 'FAIL_OPERATION'; payload: { id: string; error: Error } }
  | { type: 'CANCEL_OPERATION'; payload: { id: string } }
  | { type: 'CLEANUP_COMPLETED'; payload: { maxAge: number } };

// Stato iniziale
const initialState: { operations: Map<string, OperationProgress> } = {
  operations: new Map()
};

// Reducer per gestire lo stato delle operazioni
function progressReducer(
  state: { operations: Map<string, OperationProgress> },
  action: ProgressAction
): { operations: Map<string, OperationProgress> } {
  const newOperations = new Map(state.operations);

  switch (action.type) {
    case 'START_OPERATION': {
      const { id, config } = action.payload;
      const operation: OperationProgress = {
        id,
        title: config.title,
        description: config.description,
        progress: 0,
        status: 'Inizializzazione...',
        startTime: new Date(),
        canMinimize: config.canMinimize ?? true,
        canCancel: config.canCancel ?? false,
        isBackground: config.isBackground ?? false
      };

      if (config.estimatedDuration) {
        operation.estimatedEndTime = new Date(Date.now() + config.estimatedDuration);
      }

      newOperations.set(id, operation);
      break;
    }

    case 'UPDATE_PROGRESS': {
      const { id, progress, status } = action.payload;
      const operation = newOperations.get(id);
      
      if (operation) {
        const validatedProgress = validateProgress(progress);
        const updatedOperation: OperationProgress = {
          ...operation,
          progress: validatedProgress,
          status: status || operation.status
        };

        // Calcola tempo stimato rimanente
        if (validatedProgress > 0) {
          const estimatedRemaining = calculateEstimatedTimeRemaining(
            operation.startTime,
            validatedProgress
          );
          updatedOperation.estimatedEndTime = new Date(Date.now() + estimatedRemaining);
        }

        newOperations.set(id, updatedOperation);
      }
      break;
    }

    case 'COMPLETE_OPERATION': {
      const { id, result } = action.payload;
      const operation = newOperations.get(id);
      
      if (operation) {
        const completedOperation: OperationProgress = {
          ...operation,
          progress: 100,
          status: 'Completato',
          result,
          estimatedEndTime: new Date()
        };
        newOperations.set(id, completedOperation);
      }
      break;
    }

    case 'FAIL_OPERATION': {
      const { id, error } = action.payload;
      const operation = newOperations.get(id);
      
      if (operation) {
        const failedOperation: OperationProgress = {
          ...operation,
          status: 'Errore: ' + error.message,
          error
        };
        newOperations.set(id, failedOperation);
      }
      break;
    }

    case 'CANCEL_OPERATION': {
      const { id } = action.payload;
      const operation = newOperations.get(id);
      
      if (operation) {
        const cancelledOperation: OperationProgress = {
          ...operation,
          status: 'Annullato'
        };
        newOperations.set(id, cancelledOperation);
      }
      break;
    }

    case 'CLEANUP_COMPLETED': {
      const { maxAge } = action.payload;
      const cutoffTime = Date.now() - maxAge;
      
      for (const [id, operation] of newOperations.entries()) {
        const isCompleted = operation.progress === 100 || operation.error;
        const isOld = operation.startTime.getTime() < cutoffTime;
        
        if (isCompleted && isOld) {
          newOperations.delete(id);
        }
      }
      break;
    }

    default:
      return state;
  }

  return { operations: newOperations };
}

// Context
const ProgressContext = createContext<ProgressState | null>(null);

// Event listeners per notifiche
type ProgressEventListener = (event: ProgressEvent) => void;
const eventListeners = new Set<ProgressEventListener>();

function emitProgressEvent(type: ProgressEventType, operationId: string, data?: any) {
  const event: ProgressEvent = {
    type,
    operationId,
    timestamp: new Date(),
    data
  };

  // Salva evento per persistenza
  progressPersistence.saveEvent(event);

  eventListeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error('Errore nel listener di progresso:', error);
    }
  });
}

// Provider component
interface ProgressProviderProps {
  children: React.ReactNode;
  cleanupInterval?: number; // in millisecondi
  maxCompletedAge?: number; // in millisecondi
}

export function ProgressProvider({ 
  children, 
  cleanupInterval = 30000, // 30 secondi
  maxCompletedAge = 300000 // 5 minuti
}: ProgressProviderProps) {
  // Inizializza stato con operazioni persistite
  const [state, dispatch] = useReducer(progressReducer, {
    operations: progressPersistence.loadOperations()
  });

  // Salva operazioni quando cambiano
  useEffect(() => {
    progressPersistence.saveOperations(state.operations);
  }, [state.operations]);

  // Cleanup automatico delle operazioni completate
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: 'CLEANUP_COMPLETED', payload: { maxAge: maxCompletedAge } });
      progressPersistence.cleanupEvents();
    }, cleanupInterval);

    return () => clearInterval(interval);
  }, [cleanupInterval, maxCompletedAge]);

  // Implementazione delle funzioni del context
  const startOperation = useCallback((id: string, config: ProgressConfig) => {
    dispatch({ type: 'START_OPERATION', payload: { id, config } });
    emitProgressEvent('operation_started', id, config);
  }, []);

  const updateProgress = useCallback((id: string, progress: number, status?: string) => {
    dispatch({ type: 'UPDATE_PROGRESS', payload: { id, progress, status } });
    emitProgressEvent('operation_updated', id, { progress, status });
  }, []);

  const completeOperation = useCallback((id: string, result?: any) => {
    dispatch({ type: 'COMPLETE_OPERATION', payload: { id, result } });
    emitProgressEvent('operation_completed', id, result);
    
    // Esegui callback se presente
    const operation = state.operations.get(id);
    if (operation && 'onComplete' in operation) {
      try {
        (operation as any).onComplete?.(result);
      } catch (error) {
        console.error('Errore nel callback onComplete:', error);
      }
    }
  }, [state.operations]);

  const failOperation = useCallback((id: string, error: Error) => {
    dispatch({ type: 'FAIL_OPERATION', payload: { id, error } });
    emitProgressEvent('operation_failed', id, error);
    
    // Esegui callback se presente
    const operation = state.operations.get(id);
    if (operation && 'onError' in operation) {
      try {
        (operation as any).onError?.(error);
      } catch (err) {
        console.error('Errore nel callback onError:', err);
      }
    }
  }, [state.operations]);

  const cancelOperation = useCallback((id: string) => {
    const operation = state.operations.get(id);
    if (operation?.canCancel) {
      dispatch({ type: 'CANCEL_OPERATION', payload: { id } });
      emitProgressEvent('operation_cancelled', id);
      
      // Esegui callback se presente
      if ('onCancel' in operation) {
        try {
          (operation as any).onCancel?.();
        } catch (error) {
          console.error('Errore nel callback onCancel:', error);
        }
      }
    }
  }, [state.operations]);

  const getOperation = useCallback((id: string): OperationProgress | undefined => {
    return state.operations.get(id);
  }, [state.operations]);

  const contextValue: ProgressState = {
    operations: state.operations,
    startOperation,
    updateProgress,
    completeOperation,
    failOperation,
    cancelOperation,
    getOperation
  };

  return (
    <ProgressContext.Provider value={contextValue}>
      {children}
    </ProgressContext.Provider>
  );
}

// Hook per utilizzare il context
export function useProgress(): ProgressState {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress deve essere utilizzato all\'interno di un ProgressProvider');
  }
  return context;
}

// Hook per ascoltare eventi di progresso
export function useProgressEvents(listener: ProgressEventListener) {
  useEffect(() => {
    eventListeners.add(listener);
    return () => {
      eventListeners.delete(listener);
    };
  }, [listener]);
}

// Utility per operazioni di progresso
export const ProgressUtils = {
  // Crea un'operazione con aggiornamenti automatici
  createManagedOperation: (
    progressState: ProgressState,
    id: string,
    config: ProgressConfig,
    operation: (updateFn: (progress: number, status?: string) => void) => Promise<any>
  ) => {
    return new Promise((resolve, reject) => {
      progressState.startOperation(id, {
        ...config,
        onComplete: resolve,
        onError: reject
      });

      const updateFn = (progress: number, status?: string) => {
        progressState.updateProgress(id, progress, status);
      };

      operation(updateFn)
        .then(result => {
          progressState.completeOperation(id, result);
        })
        .catch(error => {
          progressState.failOperation(id, error);
        });
    });
  },

  // Gestisce operazioni batch con progresso
  createBatchOperation: (
    progressState: ProgressState,
    id: string,
    config: ProgressConfig,
    items: any[],
    processor: (item: any, index: number) => Promise<any>
  ) => {
    return ProgressUtils.createManagedOperation(
      progressState,
      id,
      config,
      async (updateProgress) => {
        const results = [];
        const total = items.length;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const progress = ((i + 1) / total) * 100;
          
          updateProgress(progress, `Elaborazione elemento ${i + 1} di ${total}`);
          
          try {
            const result = await processor(item, i);
            results.push({ success: true, result, item });
          } catch (error) {
            results.push({ success: false, error, item });
          }
        }

        return results;
      }
    );
  }
};