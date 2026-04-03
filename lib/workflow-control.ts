/**
 * ⏯️ Workflow Control — Pause/Resume/Cancel
 * 
 * Sistema di controllo per workflow di traduzione lunghi.
 * Permette all'utente di:
 * - Mettere in pausa la traduzione (mantiene lo stato)
 * - Riprendere da dove si era fermato
 * - Cancellare completamente
 * - Monitorare il progresso in tempo reale
 * 
 * Funziona come "signal" globale che il backend/frontend possono controllare.
 */

// ============================================================================
// TYPES
// ============================================================================

export type WorkflowState = 'idle' | 'running' | 'paused' | 'cancelling' | 'cancelled' | 'completed' | 'error';

export interface WorkflowProgress {
  state: WorkflowState;
  currentStage: string;
  currentStageIndex: number;
  totalStages: number;
  stringsProcessed: number;
  stringsTotal: number;
  percentComplete: number;       // 0-100
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;
  elapsedMs: number;
  estimatedRemainingMs: number;
  currentProvider?: string;
  lastTranslatedText?: string;
  errors: string[];
}

export interface WorkflowCheckpoint {
  id: string;
  workflowId: string;
  stageIndex: number;
  stageName: string;
  stringsProcessed: number;
  translatedStrings: Record<string, string>;  // original → translated
  timestamp: string;
  metadata: Record<string, unknown>;
}

type WorkflowEventType = 'state_change' | 'progress' | 'checkpoint' | 'error';

interface WorkflowEvent {
  type: WorkflowEventType;
  progress: WorkflowProgress;
  checkpoint?: WorkflowCheckpoint;
  error?: string;
}

type WorkflowListener = (event: WorkflowEvent) => void;

// ============================================================================
// WORKFLOW CONTROLLER
// ============================================================================

export class WorkflowController {
  private state: WorkflowState = 'idle';
  private progress: WorkflowProgress;
  private listeners: WorkflowListener[] = [];
  private checkpoints: WorkflowCheckpoint[] = [];
  private workflowId: string;
  private pausePromiseResolve: (() => void) | null = null;
  private startTime = 0;
  private pauseTime = 0;
  private totalPauseMs = 0;

  constructor(workflowId?: string) {
    this.workflowId = workflowId || `wf_${Date.now()}`;
    this.progress = this.createEmptyProgress();
  }

  private createEmptyProgress(): WorkflowProgress {
    return {
      state: 'idle',
      currentStage: '',
      currentStageIndex: 0,
      totalStages: 0,
      stringsProcessed: 0,
      stringsTotal: 0,
      percentComplete: 0,
      startedAt: '',
      elapsedMs: 0,
      estimatedRemainingMs: 0,
      errors: [],
    };
  }

  // ── Events ────────────────────────────────────────────────────

  on(listener: WorkflowListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(type: WorkflowEventType, extra?: Partial<WorkflowEvent>) {
    const event: WorkflowEvent = {
      type,
      progress: { ...this.progress },
      ...extra,
    };
    for (const listener of this.listeners) {
      try { listener(event); } catch (e) { console.error('[WorkflowCtrl] Listener error:', e); }
    }
  }

  // ── Control ───────────────────────────────────────────────────

  /**
   * Avvia il workflow. Chiamato all'inizio della traduzione.
   */
  start(totalStages: number, stringsTotal: number) {
    this.state = 'running';
    this.startTime = Date.now();
    this.totalPauseMs = 0;
    this.progress = {
      ...this.createEmptyProgress(),
      state: 'running',
      totalStages,
      stringsTotal,
      startedAt: new Date().toISOString(),
    };
    this.emit('state_change');
    console.log(`[WorkflowCtrl] ▶️ Avviato: ${stringsTotal} stringhe, ${totalStages} stadi`);
  }

  /**
   * Mette in pausa il workflow.
   * Il codice di traduzione deve chiamare `await checkPausePoint()` periodicamente.
   */
  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.pauseTime = Date.now();
    this.progress.state = 'paused';
    this.progress.pausedAt = new Date().toISOString();
    this.emit('state_change');
    console.log(`[WorkflowCtrl] ⏸️ In pausa a ${this.progress.stringsProcessed}/${this.progress.stringsTotal}`);
  }

  /**
   * Riprende il workflow dalla pausa.
   */
  resume() {
    if (this.state !== 'paused') return;
    this.totalPauseMs += Date.now() - this.pauseTime;
    this.state = 'running';
    this.progress.state = 'running';
    this.progress.pausedAt = undefined;
    
    // Sblocca il checkPausePoint in attesa
    if (this.pausePromiseResolve) {
      this.pausePromiseResolve();
      this.pausePromiseResolve = null;
    }
    
    this.emit('state_change');
    console.log(`[WorkflowCtrl] ▶️ Ripreso`);
  }

  /**
   * Cancella il workflow. I loop di traduzione devono controllare `isCancelled()`.
   */
  cancel() {
    if (this.state === 'idle' || this.state === 'completed' || this.state === 'cancelled') return;
    
    const wasPaused = this.state === 'paused';
    this.state = 'cancelling';
    this.progress.state = 'cancelling';
    this.emit('state_change');
    
    // Se era in pausa, sblocca il checkPausePoint per permettere la cancellazione
    if (wasPaused && this.pausePromiseResolve) {
      this.pausePromiseResolve();
      this.pausePromiseResolve = null;
    }
    
    console.log(`[WorkflowCtrl] ❌ Cancellazione richiesta`);
  }

  /**
   * Segna il workflow come completato.
   */
  complete() {
    this.state = 'completed';
    this.progress.state = 'completed';
    this.progress.completedAt = new Date().toISOString();
    this.progress.percentComplete = 100;
    this.updateElapsed();
    this.emit('state_change');
    console.log(`[WorkflowCtrl] ✅ Completato in ${Math.round(this.progress.elapsedMs / 1000)}s`);
  }

  /**
   * Segna il workflow come fallito.
   */
  fail(error: string) {
    this.state = 'error';
    this.progress.state = 'error';
    this.progress.errors.push(error);
    this.updateElapsed();
    this.emit('error', { error });
    console.error(`[WorkflowCtrl] 💥 Errore: ${error}`);
  }

  // ── Pause Points ──────────────────────────────────────────────

  /**
   * Punto di pausa. Il codice di traduzione deve chiamare questo metodo
   * tra un batch e l'altro. Se il workflow è in pausa, aspetta il resume.
   * Ritorna false se il workflow è stato cancellato.
   */
  async checkPausePoint(): Promise<boolean> {
    // Check cancellation
    if (this.state === 'cancelling' || this.state === 'cancelled') {
      this.state = 'cancelled';
      this.progress.state = 'cancelled';
      this.emit('state_change');
      return false;
    }

    // Check pause
    if (this.state === 'paused') {
      await new Promise<void>((resolve) => {
        this.pausePromiseResolve = resolve;
      });
      
      // Dopo il resume, ri-check cancellation
      const stateAfterResume: string = this.state;
      if (stateAfterResume === 'cancelling' || stateAfterResume === 'cancelled') {
        this.state = 'cancelled';
        this.progress.state = 'cancelled';
        this.emit('state_change');
        return false;
      }
    }

    return true;
  }

  /**
   * Check rapido (sincrono) se il workflow è stato cancellato.
   */
  isCancelled(): boolean {
    return this.state === 'cancelling' || this.state === 'cancelled';
  }

  isPaused(): boolean {
    return this.state === 'paused';
  }

  isRunning(): boolean {
    return this.state === 'running';
  }

  // ── Progress Updates ──────────────────────────────────────────

  /**
   * Aggiorna il progresso. Chiamato dopo ogni batch tradotto.
   */
  updateProgress(updates: {
    stringsProcessed?: number;
    currentStage?: string;
    currentStageIndex?: number;
    currentProvider?: string;
    lastTranslatedText?: string;
  }) {
    if (updates.stringsProcessed !== undefined) {
      this.progress.stringsProcessed = updates.stringsProcessed;
    }
    if (updates.currentStage) this.progress.currentStage = updates.currentStage;
    if (updates.currentStageIndex !== undefined) this.progress.currentStageIndex = updates.currentStageIndex;
    if (updates.currentProvider) this.progress.currentProvider = updates.currentProvider;
    if (updates.lastTranslatedText) this.progress.lastTranslatedText = updates.lastTranslatedText;

    // Calcola percentuale
    if (this.progress.stringsTotal > 0) {
      this.progress.percentComplete = Math.round(
        (this.progress.stringsProcessed / this.progress.stringsTotal) * 100
      );
    }

    // Calcola tempi
    this.updateElapsed();
    
    // Stima tempo rimanente
    if (this.progress.stringsProcessed > 0 && this.progress.elapsedMs > 0) {
      const msPerString = this.progress.elapsedMs / this.progress.stringsProcessed;
      const remaining = this.progress.stringsTotal - this.progress.stringsProcessed;
      this.progress.estimatedRemainingMs = Math.round(msPerString * remaining);
    }

    this.emit('progress');
  }

  private updateElapsed() {
    if (this.startTime > 0) {
      const now = this.state === 'paused' ? this.pauseTime : Date.now();
      this.progress.elapsedMs = now - this.startTime - this.totalPauseMs;
    }
  }

  // ── Checkpoints ───────────────────────────────────────────────

  /**
   * Salva un checkpoint per poter riprendere in futuro.
   */
  saveCheckpoint(
    stageName: string,
    stageIndex: number,
    translatedStrings: Record<string, string>,
    metadata: Record<string, unknown> = {}
  ): WorkflowCheckpoint {
    const checkpoint: WorkflowCheckpoint = {
      id: `cp_${Date.now()}`,
      workflowId: this.workflowId,
      stageIndex,
      stageName,
      stringsProcessed: this.progress.stringsProcessed,
      translatedStrings,
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.checkpoints.push(checkpoint);
    this.emit('checkpoint', { checkpoint });

    // Persisti ultimo checkpoint
    try {
      localStorage.setItem(`gs_workflow_checkpoint_${this.workflowId}`, JSON.stringify(checkpoint));
    } catch {}

    console.log(`[WorkflowCtrl] 💾 Checkpoint salvato: ${stageName} (${this.progress.stringsProcessed} stringhe)`);
    return checkpoint;
  }

  /**
   * Carica l'ultimo checkpoint per questo workflow.
   */
  loadCheckpoint(): WorkflowCheckpoint | null {
    try {
      const saved = localStorage.getItem(`gs_workflow_checkpoint_${this.workflowId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  /**
   * Elimina i checkpoint salvati.
   */
  clearCheckpoints() {
    this.checkpoints = [];
    try {
      localStorage.removeItem(`gs_workflow_checkpoint_${this.workflowId}`);
    } catch {}
  }

  // ── Getters ───────────────────────────────────────────────────

  getProgress(): WorkflowProgress {
    this.updateElapsed();
    return { ...this.progress };
  }

  getState(): WorkflowState {
    return this.state;
  }

  getWorkflowId(): string {
    return this.workflowId;
  }

  getCheckpoints(): WorkflowCheckpoint[] {
    return [...this.checkpoints];
  }

  /**
   * Formatta il tempo rimanente in formato leggibile.
   */
  getFormattedETA(): string {
    const ms = this.progress.estimatedRemainingMs;
    if (ms <= 0) return '—';
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}min`;
    const hours = Math.floor(ms / 3600000);
    const mins = Math.round((ms % 3600000) / 60000);
    return `${hours}h ${mins}min`;
  }

  /**
   * Formatta il tempo trascorso in formato leggibile.
   */
  getFormattedElapsed(): string {
    this.updateElapsed();
    const ms = this.progress.elapsedMs;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}min`;
    const hours = Math.floor(ms / 3600000);
    const mins = Math.round((ms % 3600000) / 60000);
    return `${hours}h ${mins}min`;
  }
}

// ============================================================================
// SINGLETON — Controller globale per il workflow attivo
// ============================================================================

let activeController: WorkflowController | null = null;

export function getWorkflowController(workflowId?: string): WorkflowController {
  if (!activeController || (workflowId && activeController.getWorkflowId() !== workflowId)) {
    activeController = new WorkflowController(workflowId);
  }
  return activeController;
}

export function hasActiveWorkflow(): boolean {
  if (!activeController) return false;
  const state = activeController.getState();
  return state === 'running' || state === 'paused';
}

export function resetWorkflowController() {
  activeController = null;
}
