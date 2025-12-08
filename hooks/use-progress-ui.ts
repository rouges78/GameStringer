'use client';

import { useState, useCallback, useEffect } from 'react';
import { useProgress, useProgressEvents } from '@/components/progress/progress-provider';
import { useProgressNotifications } from '@/components/progress/progress-notification';
import type { ProgressEvent, OperationProgress } from '@/lib/types/progress';

/**
 * Hook per gestire l'interfaccia utente del sistema di progresso
 */
export function useProgressUI() {
  const progressState = useProgress();
  const { 
    notifications, 
    addNotification, 
    removeNotification, 
    handleNotificationAction 
  } = useProgressNotifications();
  
  const [minimizedOperations, setMinimizedOperations] = useState<Set<string>>(new Set());
  const [showCompletedOperations, setShowCompletedOperations] = useState(false);

  // Gestisce eventi di progresso per creare notifiche
  const handleProgressEvent = useCallback((event: ProgressEvent) => {
    const operation = progressState.getOperation(event.operationId);
    if (!operation) return;

    switch (event.type) {
      case 'operation_started':
        // Notifica per operazioni in background
        if (operation.isBackground) {
          addNotification({
            title: 'Operazione avviata',
            message: operation.title,
            type: 'info',
            progress: 0,
            autoHide: true,
            duration: 3000
          });
        }
        break;

      case 'operation_completed':
        // Notifica di completamento
        addNotification({
          title: 'Operazione completata',
          message: operation.title,
          type: 'success',
          autoHide: true,
          duration: 4000,
          actions: operation.result ? [{
            label: 'Visualizza risultato',
            action: () => {
              // Qui potresti aprire un modal con i risultati
              console.log('Risultato:', operation.result);
            }
          }] : undefined
        });
        
        // Rimuovi dalla lista minimizzate dopo un po'
        setTimeout(() => {
          setMinimizedOperations(prev => {
            const newSet = new Set(prev);
            newSet.delete(event.operationId);
            return newSet;
          });
        }, 5000);
        break;

      case 'operation_failed':
        // Notifica di errore
        addNotification({
          title: 'Operazione fallita',
          message: `${operation.title}: ${operation.error?.message || 'Errore sconosciuto'}`,
          type: 'error',
          autoHide: false, // Non nascondere automaticamente gli errori
          actions: [{
            label: 'Riprova',
            action: () => {
              // Qui potresti implementare la logica di retry
              console.log('Retry operazione:', event.operationId);
            }
          }, {
            label: 'Dettagli',
            action: () => {
              // Mostra dettagli errore
              console.error('Errore dettagliato:', operation.error);
            }
          }]
        });
        break;

      case 'operation_cancelled':
        // Notifica di annullamento
        addNotification({
          title: 'Operazione annullata',
          message: operation.title,
          type: 'warning',
          autoHide: true,
          duration: 3000
        });
        break;
    }
  }, [progressState, addNotification]);

  // Ascolta eventi di progresso
  useProgressEvents(handleProgressEvent);

  // Funzioni per gestire le operazioni
  const minimizeOperation = useCallback((operationId: string) => {
    setMinimizedOperations(prev => new Set([...prev, operationId]));
  }, []);

  const maximizeOperation = useCallback((operationId: string) => {
    setMinimizedOperations(prev => {
      const newSet = new Set(prev);
      newSet.delete(operationId);
      return newSet;
    });
  }, []);

  const closeOperation = useCallback((operationId: string) => {
    // Rimuovi dalle minimizzate
    setMinimizedOperations(prev => {
      const newSet = new Set(prev);
      newSet.delete(operationId);
      return newSet;
    });

    // Se l'operazione è ancora attiva, potresti volerla cancellare
    const operation = progressState.getOperation(operationId);
    if (operation && operation.progress < 100 && !operation.error && operation.canCancel) {
      progressState.cancelOperation(operationId);
    }
  }, [progressState]);

  const cancelOperation = useCallback((operationId: string) => {
    progressState.cancelOperation(operationId);
  }, [progressState]);

  // Ottieni operazioni filtrate
  const getActiveOperations = useCallback(() => {
    return Array.from(progressState.operations.values()).filter(op => 
      op.progress < 100 && !op.error
    );
  }, [progressState.operations]);

  const getCompletedOperations = useCallback(() => {
    return Array.from(progressState.operations.values()).filter(op => 
      op.progress >= 100 || op.error
    );
  }, [progressState.operations]);

  const getMinimizedOperations = useCallback(() => {
    return Array.from(progressState.operations.values()).filter(op => 
      minimizedOperations.has(op.id)
    );
  }, [progressState.operations, minimizedOperations]);

  // Statistiche
  const getOperationStats = useCallback(() => {
    const operations = Array.from(progressState.operations.values());
    return {
      total: operations.length,
      active: operations.filter(op => op.progress < 100 && !op.error).length,
      completed: operations.filter(op => op.progress >= 100 && !op.error).length,
      failed: operations.filter(op => op.error).length,
      minimized: minimizedOperations.size
    };
  }, [progressState.operations, minimizedOperations]);

  // Cleanup automatico delle operazioni completate
  useEffect(() => {
    const cleanup = () => {
      const completedOperations = getCompletedOperations();
      const oldOperations = completedOperations.filter(op => {
        const ageMs = Date.now() - op.startTime.getTime();
        return ageMs > 10 * 60 * 1000; // 10 minuti
      });

      oldOperations.forEach(op => {
        setMinimizedOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(op.id);
          return newSet;
        });
      });
    };

    const interval = setInterval(cleanup, 60000); // Ogni minuto
    return () => clearInterval(interval);
  }, [getCompletedOperations]);

  return {
    // Stato
    progressState,
    minimizedOperations,
    showCompletedOperations,
    notifications,

    // Azioni operazioni
    minimizeOperation,
    maximizeOperation,
    closeOperation,
    cancelOperation,

    // Azioni notifiche
    removeNotification,
    handleNotificationAction,

    // Getters
    getActiveOperations,
    getCompletedOperations,
    getMinimizedOperations,
    getOperationStats,

    // Configurazione
    setShowCompletedOperations
  };
}

/**
 * Hook semplificato per componenti che mostrano solo il progresso
 */
export function useProgressDisplay(operationId?: string) {
  const progressState = useProgress();
  const [operation, setOperation] = useState<OperationProgress | null>(null);

  useEffect(() => {
    if (!operationId) {
      setOperation(null);
      return;
    }

    const op = progressState.getOperation(operationId);
    setOperation(op || null);

    // Aggiorna quando cambia lo stato
    const interval = setInterval(() => {
      const updatedOp = progressState.getOperation(operationId);
      setOperation(updatedOp || null);
    }, 100);

    return () => clearInterval(interval);
  }, [operationId, progressState]);

  return {
    operation,
    isActive: operation && operation.progress < 100 && !operation.error,
    isCompleted: operation && operation.progress >= 100,
    hasError: operation && !!operation.error,
    progress: operation?.progress || 0,
    status: operation?.status || '',
    estimatedTimeRemaining: operation?.estimatedEndTime ? 
      operation.estimatedEndTime.getTime() - Date.now() : undefined
  };
}