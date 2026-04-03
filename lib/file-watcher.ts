/**
 * 👁️ File Watcher — Auto-trigger su file change
 * 
 * Monitora le cartelle dei giochi per cambiamenti nei file traducibili.
 * Quando un file cambia (es. aggiornamento gioco), notifica l'utente
 * e offre la ri-traduzione automatica.
 * 
 * Architettura:
 * - Usa il backend Tauri (notify/watcher) per monitorare il filesystem
 * - Polling fallback per ambienti senza fs watcher nativo
 * - Debounce per evitare spam di notifiche
 * - Queue di ri-traduzione con priorità
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES
// ============================================================================

export interface WatchedGame {
  id: string;
  gameId: string;
  gameName: string;
  gamePath: string;
  watchPaths: string[];           // Path specifici da monitorare (o tutto il gamePath)
  filePatterns: string[];          // Glob patterns (es. "*.json", "*.csv", "*.po")
  autoRetranslate: boolean;       // Ri-traduzione automatica
  targetLanguage: string;
  lastChecked: string;            // ISO timestamp
  lastChange?: string;            // ISO timestamp ultimo cambiamento rilevato
  changeCount: number;            // Numero di cambiamenti rilevati
  enabled: boolean;
}

export interface FileChangeEvent {
  gameId: string;
  gameName: string;
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted' | 'renamed';
  timestamp: string;
  sizeBytes?: number;
}

export interface WatcherStatus {
  isRunning: boolean;
  watchedGames: number;
  totalChangesDetected: number;
  lastPollTime?: string;
  pendingRetranslations: number;
}

export interface RetranslationJob {
  id: string;
  gameId: string;
  gameName: string;
  filePaths: string[];
  targetLanguage: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  error?: string;
  stringsTranslated?: number;
}

type WatcherEventType = 'change' | 'retranslation_start' | 'retranslation_done' | 'error' | 'status';

interface WatcherEvent {
  type: WatcherEventType;
  change?: FileChangeEvent;
  job?: RetranslationJob;
  error?: string;
  status?: WatcherStatus;
}

type WatcherListener = (event: WatcherEvent) => void;

// ============================================================================
// TRANSLATABLE FILE PATTERNS
// ============================================================================

const TRANSLATABLE_EXTENSIONS = new Set([
  // Testo/Config
  'json', 'csv', 'tsv', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'properties',
  // Localizzazione
  'po', 'pot', 'mo', 'xliff', 'xlf', 'resx', 'strings', 'stringsdict',
  // Script giochi
  'rpy', 'rpyc', 'lua', 'txt', 'ks', 'scn',
  // Game-specific
  'locres', 'uasset', 'assets',
]);

function isTranslatableFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return TRANSLATABLE_EXTENSIONS.has(ext);
}

// ============================================================================
// FILE WATCHER ENGINE
// ============================================================================

const STORAGE_KEY = 'gs_file_watcher';
const POLL_INTERVAL_MS = 60000; // 1 minuto tra i poll

export class FileWatcherEngine {
  private watchedGames: Map<string, WatchedGame> = new Map();
  private listeners: WatcherListener[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private changeQueue: FileChangeEvent[] = [];
  private retranslationQueue: RetranslationJob[] = [];
  private fileSnapshots: Map<string, Map<string, { size: number; mtime: string }>> = new Map();

  constructor() {
    this.loadState();
  }

  // ── Events ────────────────────────────────────────────────────

  on(listener: WatcherListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(event: WatcherEvent) {
    for (const listener of this.listeners) {
      try { listener(event); } catch (e) { console.error('[FileWatcher] Listener error:', e); }
    }
  }

  // ── State Persistence ─────────────────────────────────────────

  private loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.watchedGames) {
          for (const game of data.watchedGames) {
            this.watchedGames.set(game.gameId, game);
          }
        }
      }
    } catch {}
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        watchedGames: Array.from(this.watchedGames.values()),
      }));
    } catch {}
  }

  // ── Watch Management ──────────────────────────────────────────

  addWatch(config: Omit<WatchedGame, 'id' | 'lastChecked' | 'changeCount'>): WatchedGame {
    const watch: WatchedGame = {
      ...config,
      id: `watch_${Date.now()}`,
      lastChecked: new Date().toISOString(),
      changeCount: 0,
    };
    this.watchedGames.set(config.gameId, watch);
    this.saveState();
    console.log(`[FileWatcher] 👁️ Aggiunto watch: ${config.gameName} (${config.gamePath})`);
    return watch;
  }

  removeWatch(gameId: string): boolean {
    const removed = this.watchedGames.delete(gameId);
    if (removed) {
      this.fileSnapshots.delete(gameId);
      this.saveState();
    }
    return removed;
  }

  getWatches(): WatchedGame[] {
    return Array.from(this.watchedGames.values());
  }

  getWatch(gameId: string): WatchedGame | undefined {
    return this.watchedGames.get(gameId);
  }

  updateWatch(gameId: string, updates: Partial<WatchedGame>): boolean {
    const watch = this.watchedGames.get(gameId);
    if (!watch) return false;
    Object.assign(watch, updates);
    this.saveState();
    return true;
  }

  // ── Start / Stop ──────────────────────────────────────────────

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[FileWatcher] 🚀 Avviato — ${this.watchedGames.size} giochi monitorati`);

    // Primo check immediato
    this.pollAll();

    // Poll periodico
    this.pollTimer = setInterval(() => this.pollAll(), POLL_INTERVAL_MS);

    this.emitStatus();
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    console.log('[FileWatcher] 🛑 Fermato');
    this.emitStatus();
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getStatus(): WatcherStatus {
    return {
      isRunning: this.isRunning,
      watchedGames: this.watchedGames.size,
      totalChangesDetected: Array.from(this.watchedGames.values()).reduce((sum, w) => sum + w.changeCount, 0),
      lastPollTime: new Date().toISOString(),
      pendingRetranslations: this.retranslationQueue.filter(j => j.status === 'pending').length,
    };
  }

  private emitStatus() {
    this.emit({ type: 'status', status: this.getStatus() });
  }

  // ── Polling ───────────────────────────────────────────────────

  private async pollAll() {
    const enabledWatches = Array.from(this.watchedGames.values()).filter(w => w.enabled);

    for (const watch of enabledWatches) {
      try {
        await this.pollGame(watch);
      } catch (err) {
        console.error(`[FileWatcher] Errore poll ${watch.gameName}:`, err);
      }
    }
  }

  private async pollGame(watch: WatchedGame) {
    // Usa Tauri per scansionare i file
    let files: Array<{ path: string; size: number; modified: string }>;
    try {
      files = await invoke<Array<{ path: string; size: number; modified: string }>>('scan_game_files_with_info', {
        gamePath: watch.gamePath,
        maxDepth: 8,
      });
    } catch {
      // Fallback: scan semplice
      try {
        const filePaths = await invoke<string[]>('scan_game_files', { gamePath: watch.gamePath });
        files = filePaths.map(p => ({ path: p, size: 0, modified: '' }));
      } catch {
        return; // Gioco non accessibile
      }
    }

    // Filtra solo file traducibili
    const translatableFiles = files.filter(f => {
      const name = f.path.split(/[\\/]/).pop() || '';
      if (watch.filePatterns.length > 0) {
        return watch.filePatterns.some(pattern => {
          const ext = pattern.replace('*.', '');
          return name.toLowerCase().endsWith(`.${ext}`);
        });
      }
      return isTranslatableFile(name);
    });

    // Confronta con snapshot precedente
    const prevSnapshot = this.fileSnapshots.get(watch.gameId) || new Map();
    const newSnapshot = new Map<string, { size: number; mtime: string }>();
    const changes: FileChangeEvent[] = [];

    for (const file of translatableFiles) {
      const key = file.path;
      newSnapshot.set(key, { size: file.size, mtime: file.modified });

      const prev = prevSnapshot.get(key);
      if (!prev) {
        // File nuovo
        if (prevSnapshot.size > 0) { // Skip al primo poll
          changes.push({
            gameId: watch.gameId,
            gameName: watch.gameName,
            filePath: file.path,
            changeType: 'created',
            timestamp: new Date().toISOString(),
            sizeBytes: file.size,
          });
        }
      } else if (prev.mtime !== file.modified || prev.size !== file.size) {
        // File modificato
        changes.push({
          gameId: watch.gameId,
          gameName: watch.gameName,
          filePath: file.path,
          changeType: 'modified',
          timestamp: new Date().toISOString(),
          sizeBytes: file.size,
        });
      }
    }

    // Check file eliminati
    if (prevSnapshot.size > 0) {
      for (const [key] of prevSnapshot) {
        if (!newSnapshot.has(key)) {
          changes.push({
            gameId: watch.gameId,
            gameName: watch.gameName,
            filePath: key,
            changeType: 'deleted',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Aggiorna snapshot
    this.fileSnapshots.set(watch.gameId, newSnapshot);

    // Processa cambiamenti
    if (changes.length > 0) {
      console.log(`[FileWatcher] 📝 ${watch.gameName}: ${changes.length} cambiamenti rilevati`);
      watch.changeCount += changes.length;
      watch.lastChange = new Date().toISOString();
      this.saveState();

      for (const change of changes) {
        this.changeQueue.push(change);
        this.emit({ type: 'change', change });
      }

      // Auto-retranslation se abilitata
      if (watch.autoRetranslate) {
        const modifiedFiles = changes
          .filter(c => c.changeType === 'modified' || c.changeType === 'created')
          .map(c => c.filePath);

        if (modifiedFiles.length > 0) {
          this.queueRetranslation(watch, modifiedFiles);
        }
      }
    }

    watch.lastChecked = new Date().toISOString();
    this.saveState();
  }

  // ── Retranslation Queue ───────────────────────────────────────

  private queueRetranslation(watch: WatchedGame, filePaths: string[]) {
    const job: RetranslationJob = {
      id: `retrans_${Date.now()}`,
      gameId: watch.gameId,
      gameName: watch.gameName,
      filePaths,
      targetLanguage: watch.targetLanguage,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.retranslationQueue.push(job);
    console.log(`[FileWatcher] 🔄 Job ri-traduzione in coda: ${watch.gameName} (${filePaths.length} file)`);
    this.emit({ type: 'retranslation_start', job });
    this.emitStatus();

    // Non eseguiamo automaticamente — l'utente deve confermare o è in auto mode
    // La UI può chiamare executeRetranslation(jobId) per procedere
  }

  getRetranslationQueue(): RetranslationJob[] {
    return [...this.retranslationQueue];
  }

  getPendingJobs(): RetranslationJob[] {
    return this.retranslationQueue.filter(j => j.status === 'pending');
  }

  async executeRetranslation(jobId: string): Promise<boolean> {
    const job = this.retranslationQueue.find(j => j.id === jobId);
    if (!job || job.status !== 'pending') return false;

    job.status = 'running';
    this.emit({ type: 'retranslation_start', job });

    try {
      // Chiama il workflow completo di GameStringer
      const result = await invoke<{ success: boolean; strings_translated: number }>('execute_complete_workflow', {
        installPath: this.watchedGames.get(job.gameId)?.gamePath || '',
        gameTitle: job.gameName,
        engine: 'Unknown',
        sourceLang: 'en',
        targetLang: job.targetLanguage,
      });

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.stringsTranslated = result?.strings_translated || 0;
      
      console.log(`[FileWatcher] ✅ Ri-traduzione completata: ${job.gameName} (${job.stringsTranslated} stringhe)`);
      this.emit({ type: 'retranslation_done', job });
      return true;
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      console.error(`[FileWatcher] ❌ Ri-traduzione fallita: ${job.gameName}:`, job.error);
      this.emit({ type: 'error', error: job.error });
      return false;
    } finally {
      this.emitStatus();
    }
  }

  dismissJob(jobId: string) {
    this.retranslationQueue = this.retranslationQueue.filter(j => j.id !== jobId);
    this.emitStatus();
  }

  clearCompletedJobs() {
    this.retranslationQueue = this.retranslationQueue.filter(j => j.status === 'pending' || j.status === 'running');
    this.emitStatus();
  }

  // ── Change History ────────────────────────────────────────────

  getChangeHistory(gameId?: string, limit: number = 50): FileChangeEvent[] {
    const filtered = gameId
      ? this.changeQueue.filter(c => c.gameId === gameId)
      : this.changeQueue;
    return filtered.slice(-limit);
  }

  clearChangeHistory() {
    this.changeQueue = [];
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let watcherInstance: FileWatcherEngine | null = null;

export function getFileWatcher(): FileWatcherEngine {
  if (!watcherInstance) {
    watcherInstance = new FileWatcherEngine();
  }
  return watcherInstance;
}
