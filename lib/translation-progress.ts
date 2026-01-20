import { useState, useEffect, useCallback } from 'react';
import { safeSetItem, safeGetItem, safeRemoveItem } from './safe-storage';

const PROGRESS_KEY = 'translation_progress';

export interface TranslationProgress {
  id: string;
  gameId: string;
  gameName: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  startedAt: number;
  lastUpdatedAt: number;
  estimatedEndAt: number | null;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentFile?: string;
  error?: string;
}

export interface TranslationProgressState {
  activeTranslations: TranslationProgress[];
}

const defaultState: TranslationProgressState = {
  activeTranslations: [],
};

/**
 * Salva lo stato del progresso traduzioni
 */
export function saveTranslationProgress(state: TranslationProgressState): void {
  try {
    safeSetItem(PROGRESS_KEY, state);
  } catch (error) {
    console.warn('Errore salvataggio progress traduzioni:', error);
  }
}

/**
 * Carica lo stato del progresso traduzioni
 */
export function loadTranslationProgress(): TranslationProgressState {
  try {
    const saved = safeGetItem<TranslationProgressState>(PROGRESS_KEY);
    if (saved) {
      // Filtra traduzioni vecchie (> 7 giorni)
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      saved.activeTranslations = saved.activeTranslations.filter(
        t => now - t.lastUpdatedAt < maxAge
      );
      return saved;
    }
  } catch (error) {
    console.warn('Errore caricamento progress traduzioni:', error);
  }
  return defaultState;
}

/**
 * Calcola la stima del tempo rimanente
 */
export function estimateTimeRemaining(progress: TranslationProgress): {
  remainingMs: number;
  remainingFormatted: string;
  itemsPerSecond: number;
} {
  const elapsed = progress.lastUpdatedAt - progress.startedAt;
  const completed = progress.completedItems + progress.failedItems;
  const remaining = progress.totalItems - completed;
  
  if (completed === 0 || elapsed === 0) {
    return {
      remainingMs: 0,
      remainingFormatted: 'Calcolo...',
      itemsPerSecond: 0,
    };
  }
  
  const itemsPerSecond = completed / (elapsed / 1000);
  const remainingMs = (remaining / itemsPerSecond) * 1000;
  
  // Formatta il tempo rimanente
  const seconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  let formatted: string;
  if (hours > 0) {
    formatted = `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    formatted = `${minutes}m ${seconds % 60}s`;
  } else {
    formatted = `${seconds}s`;
  }
  
  return {
    remainingMs,
    remainingFormatted: formatted,
    itemsPerSecond,
  };
}

/**
 * Hook per gestire il progresso di una traduzione
 */
export function useTranslationProgress(translationId: string) {
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  
  // Carica il progresso esistente
  useEffect(() => {
    const state = loadTranslationProgress();
    const existing = state.activeTranslations.find(t => t.id === translationId);
    if (existing) {
      setProgress(existing);
    }
  }, [translationId]);
  
  // Aggiorna il progresso
  const updateProgress = useCallback((update: Partial<TranslationProgress>) => {
    setProgress(prev => {
      if (!prev) return null;
      
      const updated: TranslationProgress = {
        ...prev,
        ...update,
        lastUpdatedAt: Date.now(),
      };
      
      // Calcola stima tempo fine
      if (updated.status === 'running') {
        const estimate = estimateTimeRemaining(updated);
        updated.estimatedEndAt = Date.now() + estimate.remainingMs;
      }
      
      // Salva in storage
      const state = loadTranslationProgress();
      const index = state.activeTranslations.findIndex(t => t.id === translationId);
      if (index >= 0) {
        state.activeTranslations[index] = updated;
      } else {
        state.activeTranslations.push(updated);
      }
      saveTranslationProgress(state);
      
      return updated;
    });
  }, [translationId]);
  
  // Inizia una nuova traduzione
  const startTranslation = useCallback((
    gameId: string,
    gameName: string,
    totalItems: number
  ) => {
    const newProgress: TranslationProgress = {
      id: translationId,
      gameId,
      gameName,
      totalItems,
      completedItems: 0,
      failedItems: 0,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      estimatedEndAt: null,
      status: 'running',
    };
    
    setProgress(newProgress);
    
    // Salva in storage
    const state = loadTranslationProgress();
    state.activeTranslations.push(newProgress);
    saveTranslationProgress(state);
  }, [translationId]);
  
  // Incrementa completati
  const incrementCompleted = useCallback((count: number = 1) => {
    updateProgress({ completedItems: (progress?.completedItems || 0) + count });
  }, [progress, updateProgress]);
  
  // Incrementa falliti
  const incrementFailed = useCallback((count: number = 1, error?: string) => {
    updateProgress({ 
      failedItems: (progress?.failedItems || 0) + count,
      error,
    });
  }, [progress, updateProgress]);
  
  // Pausa/riprendi
  const pauseTranslation = useCallback(() => {
    updateProgress({ status: 'paused' });
  }, [updateProgress]);
  
  const resumeTranslation = useCallback(() => {
    updateProgress({ status: 'running' });
  }, [updateProgress]);
  
  // Completa
  const completeTranslation = useCallback(() => {
    updateProgress({ status: 'completed' });
  }, [updateProgress]);
  
  // Fallisci
  const failTranslation = useCallback((error: string) => {
    updateProgress({ status: 'failed', error });
  }, [updateProgress]);
  
  // Rimuovi dal tracking
  const removeTranslation = useCallback(() => {
    const state = loadTranslationProgress();
    state.activeTranslations = state.activeTranslations.filter(t => t.id !== translationId);
    saveTranslationProgress(state);
    setProgress(null);
  }, [translationId]);
  
  // Calcola tempo rimanente
  const timeEstimate = progress ? estimateTimeRemaining(progress) : null;
  
  return {
    progress,
    timeEstimate,
    startTranslation,
    updateProgress,
    incrementCompleted,
    incrementFailed,
    pauseTranslation,
    resumeTranslation,
    completeTranslation,
    failTranslation,
    removeTranslation,
  };
}

/**
 * Hook per ottenere tutte le traduzioni attive
 */
export function useActiveTranslations() {
  const [translations, setTranslations] = useState<TranslationProgress[]>([]);
  
  useEffect(() => {
    const load = () => {
      const state = loadTranslationProgress();
      setTranslations(state.activeTranslations);
    };
    
    load();
    
    // Aggiorna ogni 5 secondi
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);
  
  return translations;
}

/**
 * Pulisce traduzioni completate/fallite vecchie
 */
export function cleanupOldTranslations(maxAgeDays: number = 7): number {
  const state = loadTranslationProgress();
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  const original = state.activeTranslations.length;
  state.activeTranslations = state.activeTranslations.filter(t => {
    // Mantieni traduzioni in corso
    if (t.status === 'running' || t.status === 'paused') return true;
    // Rimuovi completate/fallite vecchie
    return now - t.lastUpdatedAt < maxAge;
  });
  
  saveTranslationProgress(state);
  return original - state.activeTranslations.length;
}
