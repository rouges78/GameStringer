'use client';

import React, { useState, useEffect } from 'react';
import { X, Minimize2, Maximize2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressBar, CircularProgress } from './progress-bar';
import { formatDuration } from '@/lib/utils/progress-calculations';
import type { OperationProgress } from '@/lib/types/progress';

interface ProgressModalProps {
  operation: OperationProgress;
  onClose?: () => void;
  onMinimize?: () => void;
  onCancel?: () => void;
  isMinimized?: boolean;
  className?: string;
}

export function ProgressModal({
  operation,
  onClose,
  onMinimize,
  onCancel,
  isMinimized = false,
  className
}: ProgressModalProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Aggiorna tempo trascorso
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - operation.startTime.getTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [operation.startTime]);

  // Determina stato e variante
  const isCompleted = operation.progress >= 100;
  const hasError = !!operation.error;
  const isInProgress = !isCompleted && !hasError;

  const variant = hasError ? 'error' : isCompleted ? 'success' : 'default';
  const statusIcon = hasError ? XCircle : isCompleted ? CheckCircle : AlertCircle;
  const StatusIcon = statusIcon;

  // Gestione chiusura automatica
  useEffect(() => {
    if (isCompleted && !hasError) {
      const timer = setTimeout(() => {
        onClose?.();
      }, 3000); // Chiudi dopo 3 secondi se completato con successo

      return () => clearTimeout(timer);
    }
  }, [isCompleted, hasError, onClose]);

  if (!isVisible) return null;

  // Versione minimizzata
  if (isMinimized) {
    return (
      <div
        className={cn(
          'fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-3 min-w-[300px] z-50',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <CircularProgress
            progress={operation.progress}
            size={32}
            strokeWidth={3}
            variant={variant}
            showPercentage={false}
          />
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {operation.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {operation.status}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onMinimize}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Expand"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            
            {operation.canCancel && isInProgress && (
              <button
                onClick={onCancel}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-red-500"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Versione completa
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white dark:bg-gray-800 rounded-lg shadow-xl border max-w-md w-full',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <StatusIcon 
              className={cn(
                'w-5 h-5',
                {
                  'text-blue-500': variant === 'default',
                  'text-green-500': variant === 'success',
                  'text-red-500': variant === 'error'
                }
              )}
            />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {operation.title}
            </h3>
          </div>

          <div className="flex items-center gap-1">
            {operation.canMinimize && (
              <button
                onClick={onMinimize}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            )}
            
            {!isInProgress && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Contenuto */}
        <div className="p-6">
          {/* Descrizione */}
          {operation.description && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {operation.description}
            </p>
          )}

          {/* Barra di progresso */}
          <div className="mb-6">
            <ProgressBar
              progress={operation.progress}
              variant={variant}
              showPercentage={true}
              showTimeRemaining={isInProgress}
              estimatedTimeRemaining={operation.estimatedEndTime ? 
                operation.estimatedEndTime.getTime() - Date.now() : undefined
              }
              animated={true}
              striped={isInProgress}
              pulse={isInProgress && operation.progress < 5}
            />
          </div>

          {/* Stato */}
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </div>
            <div className={cn(
              'text-sm',
              {
                'text-gray-600 dark:text-gray-400': variant === 'default',
                'text-green-600 dark:text-green-400': variant === 'success',
                'text-red-600 dark:text-red-400': variant === 'error'
              }
            )}>
              {operation.status}
            </div>
          </div>

          {/* Informazioni temporali */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                Elapsed time
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {formatDuration(elapsedTime)}
              </div>
            </div>

            {operation.estimatedEndTime && isInProgress && (
              <div>
                <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time remaining
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  {formatDuration(operation.estimatedEndTime.getTime() - Date.now())}
                </div>
              </div>
            )}
          </div>

          {/* Messaggio di error */}
          {hasError && operation.error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Error
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                {operation.error.message}
              </div>
            </div>
          )}

          {/* result */}
          {isCompleted && !hasError && operation.result && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                Completed successfully
              </div>
              {typeof operation.result === 'string' && (
                <div className="text-sm text-green-700 dark:text-green-300">
                  {operation.result}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con azioni */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          {operation.canCancel && isInProgress && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          
          {!isInProgress && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente per gestire multiple operazioni
interface ProgressManagerProps {
  operations: Map<string, OperationProgress>;
  onCloseOperation: (id: string) => void;
  onMinimizeOperation: (id: string) => void;
  onCancelOperation: (id: string) => void;
  minimizedOperations: Set<string>;
}

export function ProgressManager({
  operations,
  onCloseOperation,
  onMinimizeOperation,
  onCancelOperation,
  minimizedOperations
}: ProgressManagerProps) {
  const activeOperations = Array.from(operations.values()).filter(op => 
    op.progress < 100 && !op.error
  );

  const completedOperations = Array.from(operations.values()).filter(op => 
    op.progress >= 100 || op.error
  );

  return (
    <>
      {/* Operazioni attive */}
      {activeOperations.map(operation => (
        <ProgressModal
          key={operation.id}
          operation={operation}
          onClose={() => onCloseOperation(operation.id)}
          onMinimize={() => onMinimizeOperation(operation.id)}
          onCancel={() => onCancelOperation(operation.id)}
          isMinimized={minimizedOperations.has(operation.id)}
        />
      ))}

      {/* Operazioni completate (solo minimizzate) */}
      {completedOperations
        .filter(op => minimizedOperations.has(op.id))
        .map(operation => (
          <ProgressModal
            key={operation.id}
            operation={operation}
            onClose={() => onCloseOperation(operation.id)}
            onMinimize={() => onMinimizeOperation(operation.id)}
            isMinimized={true}
          />
        ))}
    </>
  );
}


