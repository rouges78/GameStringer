'use client';

/**
 * Live Translation Engine
 *
 * Orchestrates the real-time capture → OCR → translate → overlay loop.
 * Optimized for SPEED: uses fastest providers, diff detection to skip
 * unchanged frames, and translation caching.
 */

import { captureScreen, detectGameProcess, type CaptureOptions } from '@/lib/ocr/screen-capture';
import { recognizeText, type OCRLanguage, type OCRLine } from '@/lib/ocr/ocr-service';
import { translateWithFallback, type TranslateOptions } from '@/lib/ai/ai-translate-direct';
import {
  vlmBatchTranslate,
  vlmFullTranslate,
  type VlmProvider,
  type VlmBatchResult,
  type VlmLineOutput,
} from '@/lib/ocr/vlm-batch-translate';
import { clientLogger } from './client-logger';

// ── Types ──────────────────────────────────────────────────

/** Modalita' di traduzione del loop live. */
export type TranslationMode = 'fast' | 'vlm-hybrid' | 'vlm-full';

export interface LiveTranslationConfig {
  targetLanguage: string;
  sourceLanguage?: string;
  ocrLanguage?: OCRLanguage;
  provider?: string;
  captureIntervalMs?: number;
  captureRegion?: CaptureRegion;
  minConfidence?: number;
  autoHideMs?: number;
  /**
   * 'fast'       -> traduzione solo testo (default, come storicamente).
   * 'vlm-hybrid' -> l'OCR fornisce i bounding box, un VLM traduce vedendo lo screenshot
   *                (disambiguazione visiva). Consigliata per qualita'.
   * 'vlm-full'   -> nessun OCR: il VLM rileva, posiziona (bbox normalizzati) e traduce
   *                tutto il testo. Utile con font stilizzati dove l'OCR fallisce.
   */
  mode?: TranslationMode;
  /** Provider del VLM quando mode e' 'vlm-*'. */
  vlmProvider?: VlmProvider;
  /** Modello VLM specifico (es. 'qwen2-vl', 'gpt-4o'); vuoto = default del provider. */
  vlmModel?: string;
  /** Lato lungo massimo dello screenshot inviato al VLM (0 = nessun downscale). */
  vlmDownscaleMaxPx?: number;
  /** Numero di righe di dialogo precedenti passate come contesto narrativo al VLM. */
  vlmSendContextLines?: number;
  /**
   * Nome del processo del gioco (es. 'RPG_RT.exe'). Se valorizzato e gs-hook
   * sta pubblicando, i fotogrammi arrivano da dentro il gioco invece che dallo
   * schermo: e' l'unica sorgente che garantisce di riprendere il gioco e non
   * la finestra che gli sta davanti. Senza, si cattura dallo schermo come
   * prima.
   */
  gameProcess?: string;
}

export interface CaptureRegion {
  mode: 'fullscreen' | 'region' | 'window';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  windowTitle?: string;
}

export interface LiveTranslationStats {
  captures: number;
  ocrRuns: number;
  translations: number;
  skipped: number;
  errors: number;
  avgLatencyMs: number;
  isRunning: boolean;
  isPaused: boolean;
  lastText: string;
  lastTranslation: string;
  /** Confidenza media dell'ultima traduzione VLM (0..1); 0 nel path 'fast'. */
  lastConfidence: number;
}

export interface TranslatedOverlayText {
  original: string;
  translated: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LiveTranslationEvent =
  | { type: 'started' }
  | { type: 'stopped' }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'frame'; texts: TranslatedOverlayText[]; latencyMs: number }
  | { type: 'skipped'; reason: string }
  | { type: 'error'; message: string }
  | { type: 'stats'; stats: LiveTranslationStats };

type EventCallback = (event: LiveTranslationEvent) => void;

// ── Simple string hash for diff detection ──────────────────

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 32-bit integer
  }
  return hash;
}

// ── Engine ──────────────────────────────────────────────────

class LiveTranslationEngine {
  private isRunning = false;
  private isPaused = false;
  private intervalId: ReturnType<typeof setTimeout> | null = null;
  private config: Required<LiveTranslationConfig>;
  private lastTextHash = 0;
  private translationCache = new Map<number, TranslatedOverlayText[]>();
  private latencies: number[] = [];
  private listeners: EventCallback[] = [];
  /** Ring buffer del dialogo recente, usato come contesto narrativo dal VLM. */
  private recentDialogue: string[] = [];
  private static readonly MAX_DIALOGUE_MEMORY = 20;

  private stats: LiveTranslationStats = {
    captures: 0,
    ocrRuns: 0,
    translations: 0,
    skipped: 0,
    errors: 0,
    avgLatencyMs: 0,
    isRunning: false,
    isPaused: false,
    lastText: '',
    lastTranslation: '',
    lastConfidence: 0,
  };

  constructor() {
    this.config = {
      targetLanguage: 'it',
      sourceLanguage: 'en',
      ocrLanguage: 'eng',
      provider: 'groq',
      captureIntervalMs: 2000,
      captureRegion: { mode: 'fullscreen' },
      minConfidence: 40,
      autoHideMs: 10000,
      mode: 'fast',
      vlmProvider: 'ollama',
      vlmModel: '',
      vlmDownscaleMaxPx: 1280,
      vlmSendContextLines: 5,
      // Vuoto = nessun gioco agganciato, si cattura dallo schermo come prima.
      gameProcess: '',
    };
  }

  // ── Public API ──────────────────────────────────────────

  on(callback: EventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private emit(event: LiveTranslationEvent) {
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* ignore */ }
    }
  }

  start(config?: Partial<LiveTranslationConfig>) {
    if (this.isRunning) return;

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.isRunning = true;
    this.isPaused = false;
    this.stats.isRunning = true;
    this.stats.isPaused = false;
    this.lastTextHash = 0;
    this.translationCache.clear();
    this.recentDialogue = [];

    // Se nessuno ha indicato un gioco, si guarda chi sta pubblicando fotogrammi.
    // Non blocca l'avvio: la risoluzione arriva quando arriva, e fino ad allora
    // si cattura dallo schermo. Un avvio che aspetta un'enumerazione di processi
    // e' un avvio che sembra rotto.
    if (!this.config.gameProcess) {
      void detectGameProcess().then((nome) => {
        if (nome && this.isRunning) {
          this.config.gameProcess = nome;
          clientLogger.info('Fotogrammi presi dal gioco', 'LIVE_TRANSLATE', { gameProcess: nome });
        }
      });
    }

    clientLogger.info('Live Translation started', 'LIVE_TRANSLATE', {
      target: this.config.targetLanguage,
      provider: this.config.provider,
      mode: this.config.mode,
      interval: this.config.captureIntervalMs,
      gameProcess: this.config.gameProcess || '(dallo schermo)',
    });

    this.emit({ type: 'started' });
    this.scheduleNext();
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.stats.isRunning = false;
    this.stats.isPaused = false;

    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    // Clear overlay
    this.emitToOverlay([]);

    clientLogger.info('Live Translation stopped', 'LIVE_TRANSLATE');
    this.emit({ type: 'stopped' });
  }

  pause() {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.stats.isPaused = true;
    this.emit({ type: 'paused' });
  }

  resume() {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.stats.isPaused = false;
    this.emit({ type: 'resumed' });
    this.scheduleNext();
  }

  toggle() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  getStats(): LiveTranslationStats {
    return { ...this.stats };
  }

  getConfig(): Required<LiveTranslationConfig> {
    return { ...this.config };
  }

  updateConfig(partial: Partial<LiveTranslationConfig>) {
    this.config = { ...this.config, ...partial };
  }

  // ── Core loop ───────────────────────────────────────────

  private scheduleNext() {
    if (!this.isRunning || this.isPaused) return;

    this.intervalId = setTimeout(async () => {
      await this.captureAndTranslate();
      this.scheduleNext();
    }, this.config.captureIntervalMs);
  }

  private async captureAndTranslate(): Promise<void> {
    if (!this.isRunning || this.isPaused) return;

    const frameStart = performance.now();

    try {
      // 1. CAPTURE
      const captureOpts: CaptureOptions = {};
      // Il fotogramma dal gioco, quando disponibile, arriva gia' ritagliato sul
      // gioco: la regione dello schermo non gli si applica ed e' captureScreen
      // a ignorarla in quel caso.
      if (this.config.gameProcess) captureOpts.gameProcess = this.config.gameProcess;
      if (this.config.captureRegion.mode === 'region') {
        captureOpts.x = this.config.captureRegion.x;
        captureOpts.y = this.config.captureRegion.y;
        captureOpts.width = this.config.captureRegion.width;
        captureOpts.height = this.config.captureRegion.height;
      }

      const capture = await captureScreen(captureOpts);
      this.stats.captures++;

      if (!capture.success || !capture.imageData) {
        this.emit({ type: 'skipped', reason: 'Capture failed' });
        return;
      }

      // vlm-full: nessun OCR, il VLM fa tutto (rileva + posiziona + traduce).
      if (this.config.mode === 'vlm-full') {
        await this.handleVlmFullFrame(
          { imageData: capture.imageData, width: capture.width, height: capture.height },
          frameStart,
        );
        return;
      }

      // 2. OCR (path 'fast' e 'vlm-hybrid')
      const ocrResult = await recognizeText(
        capture.imageData,
        this.config.ocrLanguage
      );
      this.stats.ocrRuns++;

      // Filter low-confidence lines
      const lines = ocrResult.lines.filter(
        l => l.confidence >= this.config.minConfidence && l.text.trim().length > 1
      );

      if (lines.length === 0) {
        this.emit({ type: 'skipped', reason: 'No text detected' });
        this.stats.skipped++;
        return;
      }

      // 3. DIFF CHECK — skip if text unchanged
      const currentText = lines.map(l => l.text.trim()).join('\n');
      const currentHash = simpleHash(currentText);

      if (currentHash === this.lastTextHash) {
        this.stats.skipped++;
        this.emit({ type: 'skipped', reason: 'Text unchanged' });
        return;
      }

      // Check translation cache
      const cached = this.translationCache.get(currentHash);
      if (cached) {
        this.lastTextHash = currentHash;
        this.emitToOverlay(cached);
        const latency = performance.now() - frameStart;
        this.emit({ type: 'frame', texts: cached, latencyMs: latency });
        this.stats.skipped++;
        return;
      }

      this.lastTextHash = currentHash;

      // 4. TRANSLATE
      const textsToTranslate = lines.map(l => l.text.trim());
      this.stats.lastText = textsToTranslate.join(' | ');

      const screenW = capture.width || 1920;
      const screenH = capture.height || 1080;
      let overlayTexts: TranslatedOverlayText[];

      if (this.config.mode === 'vlm-hybrid') {
        // Contesto visivo: l'OCR da' i bounding box, il VLM traduce VEDENDO lo schermo.
        const batch = await vlmBatchTranslate({
          imageBase64: capture.imageData,
          lines: lines.map((l, i) => ({ id: i, text: l.text.trim(), bbox: l.bbox })),
          targetLanguage: this.config.targetLanguage,
          sourceLanguage: this.config.sourceLanguage,
          contextLines: this.recentDialogue.slice(-this.config.vlmSendContextLines),
          provider: this.config.vlmProvider,
          model: this.config.vlmModel || undefined,
          downscaleMaxPx: this.config.vlmDownscaleMaxPx,
        });
        this.stats.translations++;
        this.logVlmTelemetry(batch);

        // Riallinea le traduzioni per id alle righe OCR; fallback al testo originale se manca.
        const byId = new Map<number, string>(
          batch.lines.map(l => [l.id, l.translated] as [number, string])
        );
        const translations = lines.map((_, i) => byId.get(i) ?? textsToTranslate[i]);
        overlayTexts = this.buildOverlayTexts(lines, translations, screenW, screenH);
        this.stats.lastTranslation = translations.join(' | ');
      } else {
        // 'fast' (default): traduzione solo testo, priorita' velocita'.
        const translateOpts: TranslateOptions = {
          texts: textsToTranslate,
          targetLanguage: this.config.targetLanguage,
          sourceLanguage: this.config.sourceLanguage,
          reflection: 'off', // Live OCR: niente secondo passaggio LLM, la latenza domina
          semanticRag: 'off', // Live OCR: niente roundtrip embeddings, la latenza domina
        };

        const result = await translateWithFallback(translateOpts);
        this.stats.translations++;

        if (!result.success || result.translations.length === 0) {
          this.emit({ type: 'error', message: 'Translation failed' });
          this.stats.errors++;
          return;
        }

        overlayTexts = this.buildOverlayTexts(lines, result.translations, screenW, screenH);
        this.stats.lastTranslation = result.translations.join(' | ');
      }

      // Aggiorna la memoria del dialogo per il contesto narrativo dei frame successivi.
      this.pushDialogue(currentText);

      // Cache this translation
      this.translationCache.set(currentHash, overlayTexts);
      // Keep cache bounded
      if (this.translationCache.size > 100) {
        const firstKey = this.translationCache.keys().next().value;
        if (firstKey !== undefined) this.translationCache.delete(firstKey);
      }

      // 6. EMIT to overlay window
      this.emitToOverlay(overlayTexts);

      const latency = performance.now() - frameStart;
      this.recordLatency(latency);
      this.emit({ type: 'frame', texts: overlayTexts, latencyMs: latency });
      this.emit({ type: 'stats', stats: this.getStats() });

    } catch (err: unknown) {
      this.stats.errors++;
      const message = err instanceof Error ? err.message : 'Unknown error';
      clientLogger.error('Live translation frame error', 'LIVE_TRANSLATE', { error: message });
      this.emit({ type: 'error', message });
    }
  }

  // ── vlm-full frame (no OCR) ─────────────────────────────

  private async handleVlmFullFrame(
    capture: { imageData: string; width?: number; height?: number },
    frameStart: number,
  ): Promise<void> {
    const screenW = capture.width || 1920;
    const screenH = capture.height || 1080;

    // Diff leggero sull'immagine: evita di richiamare il VLM su frame identici.
    const imgHash = simpleHash(`${capture.imageData.length}:${capture.imageData.slice(0, 4096)}`);
    if (imgHash === this.lastTextHash) {
      this.stats.skipped++;
      this.emit({ type: 'skipped', reason: 'Frame unchanged' });
      return;
    }
    const cached = this.translationCache.get(imgHash);
    if (cached) {
      this.lastTextHash = imgHash;
      this.emitToOverlay(cached);
      this.emit({ type: 'frame', texts: cached, latencyMs: performance.now() - frameStart });
      this.stats.skipped++;
      return;
    }
    this.lastTextHash = imgHash;

    const full = await vlmFullTranslate({
      imageBase64: capture.imageData,
      targetLanguage: this.config.targetLanguage,
      sourceLanguage: this.config.sourceLanguage,
      contextLines: this.recentDialogue.slice(-this.config.vlmSendContextLines),
      provider: this.config.vlmProvider,
      model: this.config.vlmModel || undefined,
      downscaleMaxPx: this.config.vlmDownscaleMaxPx,
    });
    this.stats.translations++;
    this.logVlmTelemetry(full);

    if (full.lines.length === 0) {
      this.emit({ type: 'skipped', reason: 'No text detected' });
      this.stats.skipped++;
      return;
    }

    const overlayTexts = this.buildOverlayFromNormalized(full.lines, screenW, screenH);
    this.stats.lastText = full.scene;
    this.stats.lastTranslation = full.lines.map(l => l.translated).join(' | ');

    this.pushDialogue(full.lines.map(l => l.translated).join('\n'));

    this.translationCache.set(imgHash, overlayTexts);
    if (this.translationCache.size > 100) {
      const firstKey = this.translationCache.keys().next().value;
      if (firstKey !== undefined) this.translationCache.delete(firstKey);
    }

    this.emitToOverlay(overlayTexts);
    const latency = performance.now() - frameStart;
    this.recordLatency(latency);
    this.emit({ type: 'frame', texts: overlayTexts, latencyMs: latency });
    this.emit({ type: 'stats', stats: this.getStats() });
  }

  // ── Helpers ─────────────────────────────────────────────

  private buildOverlayTexts(
    lines: OCRLine[],
    translations: string[],
    _screenWidth: number,
    _screenHeight: number
  ): TranslatedOverlayText[] {
    return lines.map((line, i) => ({
      original: line.text.trim(),
      translated: translations[i] || line.text.trim(),
      x: line.bbox.x0,
      y: line.bbox.y0,
      width: line.bbox.x1 - line.bbox.x0,
      height: line.bbox.y1 - line.bbox.y0,
    }));
  }

  /** Costruisce l'overlay dal path full usando i bbox normalizzati (0..1). */
  private buildOverlayFromNormalized(
    lines: VlmLineOutput[],
    screenWidth: number,
    screenHeight: number,
  ): TranslatedOverlayText[] {
    return lines.map((l, i) => {
      if (l.bbox) {
        return {
          original: '',
          translated: l.translated,
          x: Math.round(l.bbox.x * screenWidth),
          y: Math.round(l.bbox.y * screenHeight),
          width: Math.round(l.bbox.w * screenWidth),
          height: Math.round(l.bbox.h * screenHeight),
        };
      }
      // Fallback: nessun bbox dal modello -> impila verticalmente.
      return {
        original: '',
        translated: l.translated,
        x: Math.round(screenWidth * 0.1),
        y: Math.round(screenHeight * 0.1) + i * 32,
        width: Math.round(screenWidth * 0.8),
        height: 28,
      };
    });
  }

  /** Telemetria: registra confidenza media e disambiguazioni dell'ultima traduzione VLM. */
  private logVlmTelemetry(result: VlmBatchResult) {
    if (result.lines.length === 0) return;
    const avg = result.lines.reduce((s, l) => s + l.confidence, 0) / result.lines.length;
    this.stats.lastConfidence = Math.round(avg * 100) / 100;
    const disambiguations = result.lines
      .map(l => l.disambiguation)
      .filter((d): d is string => !!d);
    clientLogger.debug('VLM telemetry', 'LIVE_TRANSLATE', {
      scene: result.scene,
      avgConfidence: this.stats.lastConfidence,
      disambiguations,
    });
  }

  private async emitToOverlay(texts: TranslatedOverlayText[]) {
    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('ocr-translations', texts);
    } catch {
      // Not in Tauri environment — skip overlay emit
    }
  }

  /** Accoda il testo del frame corrente al ring buffer del dialogo (bounded). */
  private pushDialogue(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.recentDialogue.push(trimmed);
    if (this.recentDialogue.length > LiveTranslationEngine.MAX_DIALOGUE_MEMORY) {
      this.recentDialogue.shift();
    }
  }

  private recordLatency(ms: number) {
    this.latencies.push(ms);
    if (this.latencies.length > 30) this.latencies.shift();
    this.stats.avgLatencyMs = Math.round(
      this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
    );
  }
}

// ── Singleton ──────────────────────────────────────────────

export const liveTranslationEngine = new LiveTranslationEngine();
export default liveTranslationEngine;
