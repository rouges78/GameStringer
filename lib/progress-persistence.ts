/**
 * Sistema di persistenza per operazioni di progresso in background
 */

import type { OperationProgress, ProgressEvent } from '@/lib/types/progress';

// Chiave per localStorage
const STORAGE_KEY = 'gamestringer_progress_operations';
const EVENTS_STORAGE_KEY = 'gamestringer_progress_events';

// Interfaccia per dati persistiti
interface PersistedOperation {
  id: string;
  title: string;
  description?: string;
  progress: number;
  status: string;
  startTime: string; // ISO string
  estimatedEndTime?: string; // ISO string
  canMinimize: boolean;
  canCancel: boolean;
  isBackground: boolean;
  error?: {
    message: string;
    stack?: string;
  };
  result?: any;
}

interface PersistedProgressData {
  operations: PersistedOperation[];
  lastUpdate: string; // ISO string
  version: number;
}

// Versione corrente del formato dati
const CURRENT_VERSION = 1;

/**
 * Converte OperationProgress in formato persistibile
 */
function serializeOperation(operation: OperationProgress): PersistedOperation {
  return {
    id: operation.id,
    title: operation.title,
    description: operation.description,
    progress: operation.progress,
    status: operation.status,
    startTime: operation.startTime.toISOString(),
    estimatedEndTime: operation.estimatedEndTime?.toISOString(),
    canMinimize: operation.canMinimize,
    canCancel: operation.canCancel,
    isBackground: operation.isBackground ?? false,
    error: operation.error ? {
      message: operation.error.message,
      stack: operation.error.stack
    } : undefined,
    result: operation.result
  };
}

/**
 * Converte dati persistiti in OperationProgress
 */
function deserializeOperation(persisted: PersistedOperation): OperationProgress {
  const operation: OperationProgress = {
    id: persisted.id,
    title: persisted.title,
    description: persisted.description,
    progress: persisted.progress,
    status: persisted.status,
    startTime: new Date(persisted.startTime),
    estimatedEndTime: persisted.estimatedEndTime ? new Date(persisted.estimatedEndTime) : undefined,
    canMinimize: persisted.canMinimize,
    canCancel: persisted.canCancel,
    isBackground: persisted.isBackground
  };

  if (persisted.error) {
    const error = new Error(persisted.error.message);
    if (persisted.error.stack) {
      error.stack = persisted.error.stack;
    }
    operation.error = error;
  }

  if (persisted.result !== undefined) {
    operation.result = persisted.result;
  }

  return operation;
}

/**
 * Classe per gestire la persistenza delle operazioni
 */
export class ProgressPersistence {
  private static instance: ProgressPersistence | null = null;
  private isClient: boolean;

  private constructor() {
    this.isClient = typeof window !== 'undefined';
  }

  static getInstance(): ProgressPersistence {
    if (!ProgressPersistence.instance) {
      ProgressPersistence.instance = new ProgressPersistence();
    }
    return ProgressPersistence.instance;
  }

  /**
   * Salva le operazioni correnti
   */
  saveOperations(operations: Map<string, OperationProgress>): void {
    if (!this.isClient) return;

    try {
      // Filtra solo operazioni in background o non completate
      const operationsToSave = Array.from(operations.values()).filter(op => 
        op.isBackground || (op.progress < 100 && !op.error)
      );

      const data: PersistedProgressData = {
        operations: operationsToSave.map(serializeOperation),
        lastUpdate: new Date().toISOString(),
        version: CURRENT_VERSION
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Errore nel salvare operazioni di progresso:', error);
    }
  }

  /**
   * Carica le operazioni salvate
   */
  loadOperations(): Map<string, OperationProgress> {
    if (!this.isClient) return new Map();

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return new Map();

      const data: PersistedProgressData = JSON.parse(stored);
      
      // Verifica versione
      if (data.version !== CURRENT_VERSION) {
        console.warn('Versione dati progresso non compatibile, reset...');
        this.clearOperations();
        return new Map();
      }

      // Filtra operazioni troppo vecchie (più di 24 ore)
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
      const validOperations = data.operations.filter(op => {
        const startTime = new Date(op.startTime).getTime();
        return startTime > cutoffTime;
      });

      const operations = new Map<string, OperationProgress>();
      validOperations.forEach(persisted => {
        const operation = deserializeOperation(persisted);
        operations.set(operation.id, operation);
      });

      return operations;
    } catch (error) {
      console.error('Errore nel caricare operazioni di progresso:', error);
      this.clearOperations();
      return new Map();
    }
  }

  /**
   * Rimuove un'operazione specifica
   */
  removeOperation(operationId: string): void {
    if (!this.isClient) return;

    try {
      const operations = this.loadOperations();
      operations.delete(operationId);
      this.saveOperations(operations);
    } catch (error) {
      console.error('Errore nel rimuovere operazione:', error);
    }
  }

  /**
   * Pulisce tutte le operazioni salvate
   */
  clearOperations(): void {
    if (!this.isClient) return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Errore nel pulire operazioni:', error);
    }
  }

  /**
   * Salva eventi di progresso per debug/analytics
   */
  saveEvent(event: ProgressEvent): void {
    if (!this.isClient) return;

    try {
      const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
      const events: ProgressEvent[] = stored ? JSON.parse(stored) : [];
      
      // Mantieni solo gli ultimi 100 eventi
      events.push(event);
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }

      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
      console.error('Errore nel salvare evento progresso:', error);
    }
  }

  /**
   * Carica eventi salvati
   */
  loadEvents(): ProgressEvent[] {
    if (!this.isClient) return [];

    try {
      const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Errore nel caricare eventi progresso:', error);
      return [];
    }
  }

  /**
   * Pulisce eventi vecchi
   */
  cleanupEvents(maxAge: number = 24 * 60 * 60 * 1000): void {
    if (!this.isClient) return;

    try {
      const events = this.loadEvents();
      const cutoffTime = Date.now() - maxAge;
      
      const validEvents = events.filter(event => {
        const eventTime = new Date(event.timestamp).getTime();
        return eventTime > cutoffTime;
      });

      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(validEvents));
    } catch (error) {
      console.error('Errore nel pulire eventi:', error);
    }
  }

  /**
   * Ottiene statistiche sulle operazioni
   */
  getOperationStats(): {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
    background: number;
  } {
    const operations = this.loadOperations();
    const stats = {
      total: operations.size,
      completed: 0,
      failed: 0,
      inProgress: 0,
      background: 0
    };

    operations.forEach(op => {
      if (op.error) {
        stats.failed++;
      } else if (op.progress >= 100) {
        stats.completed++;
      } else {
        stats.inProgress++;
      }

      if (op.isBackground) {
        stats.background++;
      }
    });

    return stats;
  }
}

// Istanza singleton
export const progressPersistence = ProgressPersistence.getInstance();

/**
 * Hook per utilizzare la persistenza delle operazioni
 */
export function useProgressPersistence() {
  const persistence = ProgressPersistence.getInstance();

  return {
    saveOperations: persistence.saveOperations.bind(persistence),
    loadOperations: persistence.loadOperations.bind(persistence),
    removeOperation: persistence.removeOperation.bind(persistence),
    clearOperations: persistence.clearOperations.bind(persistence),
    saveEvent: persistence.saveEvent.bind(persistence),
    loadEvents: persistence.loadEvents.bind(persistence),
    cleanupEvents: persistence.cleanupEvents.bind(persistence),
    getOperationStats: persistence.getOperationStats.bind(persistence)
  };
}