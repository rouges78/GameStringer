/**
 * Undo/Redo Manager for translation operations
 * Implements command pattern with history stack
 */

export interface UndoableAction<T = unknown> {
  id: string;
  type: string;
  timestamp: number;
  description: string;
  data: T;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  historyLength: number;
  currentIndex: number;
}

class UndoRedoManager {
  private history: UndoableAction[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 100;
  private listeners: Set<(state: UndoRedoState) => void> = new Set();

  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Execute an action and add it to history
   */
  execute<T>(action: Omit<UndoableAction<T>, 'id' | 'timestamp'>): void {
    const fullAction: UndoableAction<T> = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    // Execute the action (redo is the "do" action)
    fullAction.redo();

    // Remove any redo history after current index
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Add new action
    this.history.push(fullAction);
    this.currentIndex++;

    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      const overflow = this.history.length - this.maxHistorySize;
      this.history = this.history.slice(overflow);
      this.currentIndex -= overflow;
    }

    this.notifyListeners();
  }

  /**
   * Undo the last action
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo()) return false;

    const action = this.history[this.currentIndex];
    await action.undo();
    this.currentIndex--;

    this.notifyListeners();
    return true;
  }

  /**
   * Redo the next action
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo()) return false;

    this.currentIndex++;
    const action = this.history[this.currentIndex];
    await action.redo();

    this.notifyListeners();
    return true;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get current state
   */
  getState(): UndoRedoState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDescription: this.canUndo() 
        ? this.history[this.currentIndex].description 
        : null,
      redoDescription: this.canRedo() 
        ? this.history[this.currentIndex + 1].description 
        : null,
      historyLength: this.history.length,
      currentIndex: this.currentIndex,
    };
  }

  /**
   * Get history for display
   */
  getHistory(): Array<{ id: string; description: string; timestamp: number; isCurrent: boolean }> {
    return this.history.map((action, index) => ({
      id: action.id,
      description: action.description,
      timestamp: action.timestamp,
      isCurrent: index === this.currentIndex,
    }));
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: UndoRedoState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.notifyListeners();
  }

  /**
   * Jump to specific point in history
   */
  async jumpTo(index: number): Promise<boolean> {
    if (index < -1 || index >= this.history.length) return false;

    while (this.currentIndex > index) {
      await this.undo();
    }
    while (this.currentIndex < index) {
      await this.redo();
    }

    return true;
  }
}

// Translation-specific action creators
export const translationActions = {
  editTranslation: (
    stringId: string,
    oldValue: string,
    newValue: string,
    applyFn: (value: string) => void
  ): Omit<UndoableAction<{ stringId: string; oldValue: string; newValue: string }>, 'id' | 'timestamp'> => ({
    type: 'EDIT_TRANSLATION',
    description: `Modifica traduzione`,
    data: { stringId, oldValue, newValue },
    undo: () => applyFn(oldValue),
    redo: () => applyFn(newValue),
  }),

  batchTranslation: (
    count: number,
    undoFn: () => void,
    redoFn: () => void
  ): Omit<UndoableAction<{ count: number }>, 'id' | 'timestamp'> => ({
    type: 'BATCH_TRANSLATION',
    description: `Traduzione batch (${count} stringhe)`,
    data: { count },
    undo: undoFn,
    redo: redoFn,
  }),

  importTranslation: (
    fileName: string,
    undoFn: () => void,
    redoFn: () => void
  ): Omit<UndoableAction<{ fileName: string }>, 'id' | 'timestamp'> => ({
    type: 'IMPORT_TRANSLATION',
    description: `Import da ${fileName}`,
    data: { fileName },
    undo: undoFn,
    redo: redoFn,
  }),

  deleteTranslation: (
    stringId: string,
    deletedValue: string,
    deleteFn: () => void,
    restoreFn: () => void
  ): Omit<UndoableAction<{ stringId: string; value: string }>, 'id' | 'timestamp'> => ({
    type: 'DELETE_TRANSLATION',
    description: `Elimina traduzione`,
    data: { stringId, value: deletedValue },
    undo: restoreFn,
    redo: deleteFn,
  }),

  applyGlossary: (
    term: string,
    count: number,
    undoFn: () => void,
    redoFn: () => void
  ): Omit<UndoableAction<{ term: string; count: number }>, 'id' | 'timestamp'> => ({
    type: 'APPLY_GLOSSARY',
    description: `Applica glossario "${term}" (${count}x)`,
    data: { term, count },
    undo: undoFn,
    redo: redoFn,
  }),
};

// Singleton instance
export const undoRedoManager = new UndoRedoManager(100);

// React hook for using undo/redo
import { useState, useEffect, useCallback } from 'react';

export function useUndoRedo() {
  const [state, setState] = useState<UndoRedoState>(undoRedoManager.getState());

  useEffect(() => {
    return undoRedoManager.subscribe(setState);
  }, []);

  const undo = useCallback(async () => {
    return undoRedoManager.undo();
  }, []);

  const redo = useCallback(async () => {
    return undoRedoManager.redo();
  }, []);

  const execute = useCallback(<T,>(action: Omit<UndoableAction<T>, 'id' | 'timestamp'>) => {
    undoRedoManager.execute(action);
  }, []);

  const clear = useCallback(() => {
    undoRedoManager.clear();
  }, []);

  return {
    ...state,
    undo,
    redo,
    execute,
    clear,
    getHistory: () => undoRedoManager.getHistory(),
  };
}

export default undoRedoManager;
