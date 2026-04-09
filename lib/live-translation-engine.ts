'use client';

/**
 * Live Translation Engine
 *
 * Orchestrates the real-time capture → OCR → translate → overlay loop.
 * Optimized for SPEED: uses fastest providers, diff detection to skip
 * unchanged frames, and translation caching.
 */

import { captureScreen, type CaptureOptions } from './screen-capture';
import { recognizeText, type OCRLanguage, type OCRLine } from './ocr-service';
import { translateWithFallback, type TranslateOptions } from './ai-translate-direct';
import { clientLogger } from './client-logger';

// ── Types ──────────────────────────────────────────────────

export interface LiveTranslationConfig {
  targetLanguage: string;
  sourceLanguage?: string;
  ocrLanguage?: OCRLanguage;
  provider?: string;
  captureIntervalMs?: number;
  captureRegion?: CaptureRegion;
  minConfidence?: number;
  autoHideMs?: number;
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

// ── Speed-optimized provider chain ─────────────────────────

const SPEED_CHAIN = ['groq', 'cerebras', 'deepseek', 'gemini', 'ollama'];

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

    clientLogger.info('Live Translation started', 'LIVE_TRANSLATE', {
      target: this.config.targetLanguage,
      provider: this.config.provider,
      interval: this.config.captureIntervalMs,
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

      // 2. OCR
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

      // 4. TRANSLATE — speed priority
      const textsToTranslate = lines.map(l => l.text.trim());
      this.stats.lastText = textsToTranslate.join(' | ');

      const translateOpts: TranslateOptions = {
        texts: textsToTranslate,
        targetLanguage: this.config.targetLanguage,
        sourceLanguage: this.config.sourceLanguage,
      };

      const result = await translateWithFallback(translateOpts);
      this.stats.translations++;

      if (!result.success || result.translations.length === 0) {
        this.emit({ type: 'error', message: 'Translation failed' });
        this.stats.errors++;
        return;
      }

      // 5. BUILD OVERLAY TEXTS with positions from OCR bounding boxes
      const overlayTexts = this.buildOverlayTexts(lines, result.translations, capture.width || 1920, capture.height || 1080);

      this.stats.lastTranslation = result.translations.join(' | ');

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

  private async emitToOverlay(texts: TranslatedOverlayText[]) {
    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('ocr-translations', texts);
    } catch {
      // Not in Tauri environment — skip overlay emit
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
