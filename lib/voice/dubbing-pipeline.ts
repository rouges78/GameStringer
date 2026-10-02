'use client';

/**
 * AI Dubbing Pipeline
 *
 * End-to-end orchestration: extract game audio → transcribe (Whisper) →
 * translate (AI) → synthesize voice (TTS with character profiles) →
 * duration match → patch audio files → generate lip sync → export subtitles.
 *
 * Each step emits progress events for real-time UI updates.
 */

import { voiceCloneService, type VoiceProfile, type SynthesisResult } from './voice-clone';
import { translateWithFallback, getApiKeys } from '@/lib/ai/ai-translate-direct';
import { clientLogger } from '@/lib/client-logger';
import { tStatic } from '@/lib/i18n/t-static';

// ── Types ──────────────────────────────────────────────────

export interface DubbingConfig {
  gamePath: string;
  gameName: string;
  sourceLanguage: string;
  targetLanguage: string;
  ttsProvider: 'openai' | 'elevenlabs' | 'azure' | 'local';
  sttProvider: 'openai_whisper' | 'groq_whisper' | 'local_whisper';
  translationProvider?: string;
  defaultVoice?: string;         // OpenAI voice id
  characterProfiles?: CharacterVoiceMap[];
  enableLipSync: boolean;
  enableSubtitles: boolean;
  subtitleFormat: 'srt' | 'vtt' | 'ass';
  durationMatching: boolean;     // Match original audio duration
  batchSize: number;             // Parallel processing count
}

export interface CharacterVoiceMap {
  characterName: string;
  voiceProfile: VoiceProfile;
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised';
}

export interface AudioSegment {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  duration?: number;
  // After transcription
  originalText?: string;
  detectedLanguage?: string;
  transcriptionConfidence?: number;
  // After translation
  translatedText?: string;
  // After synthesis
  synthesizedAudioUrl?: string;
  synthesizedDuration?: number;
  durationMatched?: boolean;
  // After lip sync
  lipSyncData?: unknown;
  // Character mapping
  character?: string;
  // Status
  status: 'pending' | 'transcribing' | 'translating' | 'synthesizing' | 'patching' | 'complete' | 'error' | 'skipped';
  error?: string;
}

export type DubbingStepId =
  | 'scan'
  | 'transcribe'
  | 'translate'
  | 'synthesize'
  | 'patch'
  | 'lipsync'
  | 'subtitles';

export interface DubbingStep {
  id: DubbingStepId;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number;    // 0-100
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  result?: string;
  error?: string;
}

export interface DubbingProgress {
  steps: DubbingStep[];
  currentStep: DubbingStepId | null;
  segments: AudioSegment[];
  totalSegments: number;
  completedSegments: number;
  isRunning: boolean;
  isPaused: boolean;
  stats: DubbingStats;
}

export interface DubbingStats {
  totalAudioFiles: number;
  transcribed: number;
  translated: number;
  synthesized: number;
  patched: number;
  errors: number;
  skipped: number;
  totalDurationOriginal: number;   // seconds
  totalDurationSynthesized: number;
  avgTranscriptionConfidence: number;
}

export interface DubbingResult {
  success: boolean;
  segments: AudioSegment[];
  stats: DubbingStats;
  subtitleFile?: string;         // Generated subtitle content
  steps: DubbingStep[];
  totalDurationMs: number;
}

type ProgressCallback = (progress: DubbingProgress) => void;

/** Cosa ha trovato la scansione: la UI lo mostra prima di qualsiasi chiamata a pagamento. */
export interface ScanSummary {
  fileCount: number;
  totalBytes: number;
}

/** true = l'utente ha confermato le chiamate a pagamento (una trascrizione per file). */
export type ConfirmPaidCalls = (summary: ScanSummary) => Promise<boolean>;

// ── Pipeline Steps Definition ──────────────────────────────

function createSteps(config: DubbingConfig): DubbingStep[] {
  const steps: DubbingStep[] = [
    { id: 'scan', name: 'Scansione audio', status: 'pending', progress: 0 },
    { id: 'transcribe', name: 'Trascrizione (Whisper)', status: 'pending', progress: 0 },
    { id: 'translate', name: 'Traduzione AI', status: 'pending', progress: 0 },
    { id: 'synthesize', name: 'Sintesi vocale (TTS)', status: 'pending', progress: 0 },
    { id: 'patch', name: 'Patching audio', status: 'pending', progress: 0 },
  ];

  if (config.enableLipSync) {
    steps.push({ id: 'lipsync', name: 'Lip Sync (Rhubarb)', status: 'pending', progress: 0 });
  }
  if (config.enableSubtitles) {
    steps.push({ id: 'subtitles', name: 'Generazione sottotitoli', status: 'pending', progress: 0 });
  }

  return steps;
}

// ── Main Pipeline Class ────────────────────────────────────

export class DubbingPipeline {
  private config: DubbingConfig;
  private steps: DubbingStep[];
  private segments: AudioSegment[] = [];
  private isRunning = false;
  private isPaused = false;
  private abortController: AbortController | null = null;
  private onProgress: ProgressCallback | null = null;
  /** Ultimo errore del passo in corso: diventa il motivo se il passo non produce nulla. */
  private lastError: string | undefined;
  /** Audio sintetizzato per segmento: patchAll lo usa direttamente, senza fetch del blob: URL. */
  private synthesizedBlobs = new Map<string, Blob>();

  private stats: DubbingStats = {
    totalAudioFiles: 0, transcribed: 0, translated: 0, synthesized: 0,
    patched: 0, errors: 0, skipped: 0, totalDurationOriginal: 0,
    totalDurationSynthesized: 0, avgTranscriptionConfidence: 0,
  };

  constructor(config: DubbingConfig) {
    this.config = config;
    this.steps = createSteps(config);
  }

  // ── Public API ──────────────────────────────────────────

  /**
   * `confirmPaidCalls` è obbligatorio: la pipeline non parte con le chiamate a
   * pagamento senza il via dell'utente sul risultato della scansione.
   */
  async run(onProgress: ProgressCallback | undefined, confirmPaidCalls: ConfirmPaidCalls): Promise<DubbingResult> {
    this.onProgress = onProgress || null;
    this.isRunning = true;
    this.abortController = new AbortController();
    const pipelineStart = performance.now();

    clientLogger.info('Dubbing pipeline started', 'DUBBING', {
      game: this.config.gameName,
      source: this.config.sourceLanguage,
      target: this.config.targetLanguage,
    });

    try {
      await this.runAllSteps(confirmPaidCalls);
    } catch (err: unknown) {
      clientLogger.error('Dubbing pipeline failed', 'DUBBING', {
        error: err instanceof Error ? err.message : String(err)
      });
    }

    this.isRunning = false;
    // Ultimo aggiornamento con isRunning=false: senza, la UI restava in "in corso".
    this.emitProgress(null);
    return this.buildResult(pipelineStart);
  }

  /**
   * Ogni passo deve produrre qualcosa: se non produce nulla fallisce col motivo
   * dell'ultimo errore e la pipeline si ferma lì, invece di segnare verdi i passi
   * successivi lavorando a vuoto.
   */
  private async runAllSteps(confirmPaidCalls: ConfirmPaidCalls): Promise<void> {
    // Step 1: Scan audio files
    const scanned = await this.runStep('scan', async () => {
      this.segments = await this.scanAudioFiles();
      this.stats.totalAudioFiles = this.segments.length;
      if (this.segments.length === 0) throw new Error('Nessun file audio trovato nella cartella');
      // La sintesi produce sempre TTS_OUTPUT_FORMAT e la conversione non c'è: un
      // file di altro formato verrebbe rifiutato al patch dopo aver già pagato
      // trascrizione, traduzione e sintesi. Si esclude prima di spendere.
      for (const segment of this.segments) {
        const ext = segment.fileName.split('.').pop()?.toLowerCase() || '';
        if (ext !== TTS_OUTPUT_FORMAT) {
          this.failSegment(segment, tStatic('dubbingPage.patchFormatMismatch')
            .replace('{actual}', TTS_OUTPUT_FORMAT.toUpperCase())
            .replace('{expected}', ext));
        }
      }
      const compatible = this.segments.filter(s => s.status !== 'error').length;
      if (compatible === 0) {
        throw new Error(tStatic('dubbingPage.noCompatibleAudio').replace('{count}', String(this.segments.length)));
      }
      return `${this.segments.length} file audio trovati, ${compatible} sostituibili`;
    });
    if (!scanned) return;

    // La scansione prende ogni .mp3 compatibile, musica compresa, e ogni file
    // è una trascrizione a pagamento: senza il via esplicito dell'utente su
    // quanti file e quanti byte, la pipeline si ferma qui.
    const eligible = this.segments.filter(s => s.status !== 'error');
    const confirmed = await confirmPaidCalls({
      fileCount: eligible.length,
      totalBytes: eligible.reduce((sum, s) => sum + (s.fileSize || 0), 0),
    });
    if (!confirmed) return;

    // Step 2: Transcribe
    const transcribed = await this.runStep('transcribe', async () => {
      await this.transcribeAll();
      if (this.stats.transcribed === 0) throw new Error(this.lastError || 'Nessun parlato rilevato nei file audio');
      // I file senza parlato non sono errori, ma vanno detti: altrimenti spariscono dal conteggio.
      return this.stats.skipped > 0
        ? `${this.stats.transcribed} trascritti, ${this.stats.skipped} senza parlato`
        : `${this.stats.transcribed} trascritti`;
    });
    if (!transcribed) return;

    // Step 3: Translate
    const translated = await this.runStep('translate', async () => {
      await this.translateAll();
      if (this.stats.translated === 0) throw new Error(this.lastError || 'Nessun segmento tradotto');
      return `${this.stats.translated} tradotti`;
    });
    if (!translated) return;

    // Step 4: Synthesize voice
    const synthesized = await this.runStep('synthesize', async () => {
      await this.synthesizeAll();
      if (this.stats.synthesized === 0) throw new Error(this.lastError || 'Nessun segmento sintetizzato');
      return `${this.stats.synthesized} sintetizzati`;
    });
    if (!synthesized) return;

    // Step 5: Patch audio files
    const patched = await this.runStep('patch', async () => {
      await this.patchAll();
      if (this.stats.patched === 0) throw new Error(this.lastError || 'Nessun file patchato');
      return `${this.stats.patched} file patchati`;
    });
    if (!patched) return;

    // Step 6: Lip sync (optional) — se fallisce non ferma i sottotitoli
    if (this.config.enableLipSync) {
      await this.runStep('lipsync', async () => {
        const generated = await this.generateLipSync();
        if (generated === 0) throw new Error(this.lastError || 'Lip sync non generato');
        return `${generated} lip sync generati`;
      });
    }

    // Step 7: Subtitles (optional)
    if (this.config.enableSubtitles) {
      await this.runStep('subtitles', async () => {
        this.generateSubtitles();
        return `Sottotitoli ${this.config.subtitleFormat.toUpperCase()} generati`;
      });
    }
  }

  pause() { this.isPaused = true; }
  resume() { this.isPaused = false; }
  // isPaused=false: altrimenti un annullamento durante la pausa restava fermo nel
  // `while (this.isPaused)` e la pipeline non finiva mai.
  abort() { this.abortController?.abort(); this.isRunning = false; this.isPaused = false; }

  // ── Step Runner ─────────────────────────────────────────

  /** true se il passo è stato completato, false se è fallito o la pipeline è stata annullata. */
  private async runStep(stepId: DubbingStepId, fn: () => Promise<string>): Promise<boolean> {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return false;
    if (this.abortController?.signal.aborted) return false;

    step.status = 'running';
    step.startedAt = Date.now();
    this.lastError = undefined;
    this.emitProgress(stepId);

    let ok = false;
    try {
      const result = await fn();
      step.status = 'completed';
      step.progress = 100;
      step.result = result;
      step.completedAt = Date.now();
      step.durationMs = step.completedAt - step.startedAt;
      ok = true;
    } catch (err: unknown) {
      // Annullato a metà passo: non è un fallimento col motivo dell'ultimo errore.
      step.status = this.abortController?.signal.aborted ? 'skipped' : 'failed';
      step.error = err instanceof Error ? err.message : String(err);
      step.completedAt = Date.now();
      step.durationMs = step.completedAt - (step.startedAt || Date.now());
      clientLogger.warn(`Dubbing step ${stepId} failed: ${step.error}`, 'DUBBING');
    }

    this.emitProgress(stepId);
    return ok;
  }

  /** Unico punto in cui un segmento diventa errore: così ogni fallimento viene contato. */
  private failSegment(segment: AudioSegment, message: string) {
    segment.status = 'error';
    segment.error = message;
    this.stats.errors++;
    this.lastError = message;
  }

  private emitProgress(currentStep: DubbingStepId | null) {
    this.onProgress?.({
      steps: [...this.steps],
      currentStep,
      segments: [...this.segments],
      totalSegments: this.segments.length,
      completedSegments: this.segments.filter(s => s.status === 'complete').length,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      stats: { ...this.stats },
    });
  }

  // ── Step 1: Scan ────────────────────────────────────────

  private async scanAudioFiles(): Promise<AudioSegment[]> {
    // Niente fallback a lista vuota: un errore di scansione deve far fallire il
    // passo col suo motivo, non sembrare "0 file trovati".
    const { invoke } = await import('@tauri-apps/api/core');
    // Il comando Rust (AudioFile) serializza la dimensione come `size_bytes`:
    // leggendo `size` la dimensione restava undefined.
    const files = await invoke<Array<{ path: string; name: string; size_bytes: number }>>('scan_game_audio_files', {
      gamePath: this.config.gamePath,
    });

    return (files || []).map((f, i) => ({
      id: `seg_${i}`,
      filePath: f.path,
      fileName: f.name,
      fileSize: f.size_bytes,
      status: 'pending' as const,
    }));
  }

  // ── Step 2: Transcribe ──────────────────────────────────

  private async transcribeAll(): Promise<void> {
    const step = this.steps.find(s => s.id === 'transcribe')!;
    let confidenceSum = 0;
    let confidenceCount = 0;

    // Prima qui c'era `fetch('/api/voice/transcribe')`, che nel desktop non esiste:
    // in Tauri ogni segmento veniva saltato senza contarlo e la pipeline finiva
    // "completata" con 0 file. Ora si usa la stessa chiamata Whisper di
    // components/voice/voice-translator.tsx, con la chiave OpenAI delle Impostazioni.
    // Groq Whisper non ha ancora un percorso: fallisce dichiarandolo.
    const apiKey = getApiKeys().openai;
    const setupError = this.config.sttProvider !== 'openai_whisper'
      ? `Trascrizione con ${this.config.sttProvider} non ancora disponibile: scegli OpenAI Whisper`
      : !apiKey ? 'OpenAI API key non configurata. Vai nelle Impostazioni.' : undefined;
    if (setupError) {
      for (const segment of this.segments) {
        if (segment.status !== 'error') this.failSegment(segment, setupError);
      }
      return;
    }

    for (let i = 0; i < this.segments.length; i++) {
      while (this.isPaused) await sleep(500);
      if (this.abortController?.signal.aborted) break;

      const segment = this.segments[i];
      // Escluso alla scansione (formato non sostituibile): nessuna chiamata a pagamento.
      if (segment.status === 'error') continue;
      segment.status = 'transcribing';
      step.progress = Math.round((i / this.segments.length) * 100);
      this.emitProgress('transcribe');

      try {
        const data = await this.transcribeSegment(segment, apiKey);
        const text = (data.text || '').trim();
        segment.duration = data.duration;
        segment.detectedLanguage = data.language;
        if (!text) {
          // Musica o effetti: nulla da doppiare, non è un errore.
          segment.status = 'skipped';
          segment.error = 'Nessun parlato rilevato';
          this.stats.skipped++;
          continue;
        }
        segment.originalText = text;
        // Whisper non restituisce una "confidence": si usa la probabilità media per
        // token (exp di avg_logprob dei suoi segmenti). Prima era un 0.9 inventato.
        const logprobs = (data.segments || []).map(s => s.avg_logprob).filter((p): p is number => typeof p === 'number');
        if (logprobs.length > 0) {
          segment.transcriptionConfidence = Math.exp(logprobs.reduce((a, b) => a + b, 0) / logprobs.length);
          confidenceSum += segment.transcriptionConfidence;
          confidenceCount++;
        }
        segment.status = 'pending';
        this.stats.transcribed++;
        this.stats.totalDurationOriginal += data.duration || 0;
      } catch (err: unknown) {
        this.failSegment(segment, err instanceof Error ? err.message : 'Transcription error');
      }
    }

    if (confidenceCount > 0) {
      this.stats.avgTranscriptionConfidence = confidenceSum / confidenceCount;
    }
  }

  /** Una chiamata Whisper per file, come in voice-translator.tsx (whisper-1, verbose_json). */
  private async transcribeSegment(segment: AudioSegment, apiKey: string): Promise<{
    text?: string;
    language?: string;
    duration?: number;
    segments?: Array<{ avg_logprob?: number }>;
  }> {
    const { invoke } = await import('@tauri-apps/api/core');
    const audioBase64 = await invoke<string>('read_binary_file_base64', { path: segment.filePath });
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const formData = new FormData();
    // Whisper riconosce il formato dall'estensione del nome file.
    formData.append('file', new Blob([bytes]), segment.fileName);
    // ⏰ whisper-1 esce dall'API OpenAI il 26/02/2027: vedi ROADMAP.md, P2.
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    if (this.config.sourceLanguage) {
      formData.append('language', this.config.sourceLanguage);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Whisper errore ${response.status}`);
    }

    return response.json();
  }

  // ── Step 3: Translate ───────────────────────────────────

  private async translateAll(): Promise<void> {
    const step = this.steps.find(s => s.id === 'translate')!;
    const toTranslate = this.segments.filter(s => s.originalText && s.status !== 'error');

    // Batch translate for efficiency
    const batchSize = 20;
    for (let i = 0; i < toTranslate.length; i += batchSize) {
      while (this.isPaused) await sleep(500);
      if (this.abortController?.signal.aborted) break;

      const batch = toTranslate.slice(i, i + batchSize);
      const texts = batch.map(s => s.originalText!);

      step.progress = Math.round((i / toTranslate.length) * 100);
      this.emitProgress('translate');

      try {
        const result = await translateWithFallback({
          texts,
          sourceLanguage: this.config.sourceLanguage,
          targetLanguage: this.config.targetLanguage,
          context: `Game dialogue from "${this.config.gameName}". Maintain character voice and emotion.`,
        });

        if (result.success) {
          batch.forEach((seg, idx) => {
            const translation = result.translations[idx];
            // Niente ripiego sul testo originale: verrebbe doppiato come se fosse tradotto.
            if (!translation) {
              this.failSegment(seg, 'Traduzione mancante per questo segmento');
              return;
            }
            seg.translatedText = translation;
            seg.status = 'pending';
            this.stats.translated++;
          });
        } else {
          // Prima un batch non tradotto restava "pending" senza contare errori.
          batch.forEach(seg => this.failSegment(seg, 'Traduzione fallita: nessun provider ha risposto'));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Translation batch failed';
        batch.forEach(seg => this.failSegment(seg, message));
      }
    }
  }

  // ── Step 4: Synthesize Voice ────────────────────────────

  private async synthesizeAll(): Promise<void> {
    const step = this.steps.find(s => s.id === 'synthesize')!;
    const toSynthesize = this.segments.filter(s => s.translatedText && s.status !== 'error');

    for (let i = 0; i < toSynthesize.length; i++) {
      while (this.isPaused) await sleep(500);
      if (this.abortController?.signal.aborted) break;

      const segment = toSynthesize[i];
      segment.status = 'synthesizing';
      step.progress = Math.round((i / toSynthesize.length) * 100);
      this.emitProgress('synthesize');

      try {
        // Find character voice profile if mapped
        const charProfile = this.config.characterProfiles?.find(
          cp => segment.character && cp.characterName.toLowerCase() === segment.character.toLowerCase()
        );

        const voiceProfile: VoiceProfile = charProfile?.voiceProfile || {
          id: 'default',
          name: 'Default Voice',
          provider: this.config.ttsProvider as VoiceProfile['provider'],
          voiceId: this.config.defaultVoice || 'alloy',
          settings: { speed: 1.0, pitch: 1.0, stability: 0.5, similarityBoost: 0.75 },
          createdAt: new Date().toISOString(),
        };

        const result: SynthesisResult = await voiceCloneService.synthesize({
          text: segment.translatedText!,
          voiceProfile,
          language: this.config.targetLanguage,
          emotion: charProfile?.emotion || 'neutral',
          targetDuration: this.config.durationMatching ? segment.duration : undefined,
          durationTolerance: 0.15, // 15% tolerance
        });

        segment.synthesizedAudioUrl = result.audioUrl;
        this.synthesizedBlobs.set(segment.id, result.audioBlob);
        segment.synthesizedDuration = result.duration;
        segment.durationMatched = result.durationMatched;
        segment.status = 'pending';
        this.stats.synthesized++;
        this.stats.totalDurationSynthesized += result.duration;

        // Rate limit: small delay between synthesis calls
        await sleep(300);

      } catch (err: unknown) {
        this.failSegment(segment, err instanceof Error ? err.message : 'Synthesis error');
      }
    }
  }

  // ── Step 5: Patch Audio Files ───────────────────────────

  private async patchAll(): Promise<void> {
    const step = this.steps.find(s => s.id === 'patch')!;
    const toPatch = this.segments.filter(s => this.synthesizedBlobs.has(s.id) && s.status !== 'error');

    for (let i = 0; i < toPatch.length; i++) {
      if (this.abortController?.signal.aborted) break;

      const segment = toPatch[i];
      segment.status = 'patching';
      step.progress = Math.round((i / toPatch.length) * 100);
      this.emitProgress('patch');

      try {
        // Il Blob arriva direttamente dalla sintesi: un fetch() del blob: URL
        // dipenderebbe dalla CSP (connect-src non elenca blob:).
        const audioBlob = this.synthesizedBlobs.get(segment.id)!;
        const reader = new FileReader();
        const audioBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = () => reject(reader.error ?? new Error('Lettura audio sintetizzato fallita'));
          reader.readAsDataURL(audioBlob);
        });

        // replace_audio_file scrive questi byte così come sono al posto del file del
        // gioco: l'MP3 dei provider TTS dentro un .wav/.ogg/.flac lo romperebbe.
        // Conversione non disponibile: si patcha solo se il formato coincide con
        // l'estensione, altrimenti è un errore col motivo e il file resta intatto.
        // (16 caratteri base64 = i primi 12 byte, bastano per il magic number.)
        const head = Uint8Array.from(atob(audioBase64.slice(0, 16)), c => c.charCodeAt(0));
        const actual = detectAudioFormat(head);
        const expected = segment.fileName.split('.').pop()?.toLowerCase() || '';
        if (actual !== expected) {
          this.failSegment(segment, tStatic('dubbingPage.patchFormatMismatch')
            .replace('{actual}', actual ? actual.toUpperCase() : tStatic('dubbingPage.unknownAudioFormat'))
            .replace('{expected}', expected));
          continue;
        }

        // Replace via Tauri command (creates .original backup automatically)
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('replace_audio_file', {
          originalPath: segment.filePath,
          newAudioBase64: audioBase64,
        });

        segment.status = 'complete';
        this.stats.patched++;
      } catch (err: unknown) {
        this.failSegment(segment, err instanceof Error ? err.message : 'Patch error');
      }
    }
  }

  // ── Step 6: Lip Sync ────────────────────────────────────

  /** Ritorna quanti lip sync sono stati generati davvero. */
  private async generateLipSync(): Promise<number> {
    const step = this.steps.find(s => s.id === 'lipsync')!;
    const completed = this.segments.filter(s => s.status === 'complete');
    let generated = 0;

    for (let i = 0; i < completed.length; i++) {
      step.progress = Math.round((i / completed.length) * 100);
      this.emitProgress('lipsync');

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const lipSync = await invoke('generate_lip_sync', {
          audioPath: completed[i].filePath,
          dialogText: completed[i].translatedText,
          recognizer: 'phonetic',
        });
        completed[i].lipSyncData = lipSync;
        generated++;
      } catch (err: unknown) {
        // Lip sync is optional — don't fail the pipeline (l'audio è già patchato)
        this.lastError = err instanceof Error ? err.message : String(err);
        clientLogger.warn(`Lip sync failed for ${completed[i].fileName}`, 'DUBBING');
      }
    }
    return generated;
  }

  // ── Step 7: Generate Subtitles ──────────────────────────

  private generateSubtitles(): string {
    const format = this.config.subtitleFormat;
    // Tempi dalle durate reali, una battuta dopo l'altra: l'audio doppiato se
    // c'è, altrimenti la durata originale misurata da Whisper. Prima ogni
    // battuta durava 5 s fissi.
    let cursor = 0;
    const completed = this.segments.filter(s => s.translatedText).map(seg => {
      const start = cursor;
      cursor += seg.synthesizedDuration || seg.duration || 0;
      return { seg, start, end: cursor };
    });

    if (format === 'srt') {
      return completed.map(({ seg, start, end }, i) => {
        return `${i + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${seg.translatedText}\n`;
      }).join('\n');
    }

    if (format === 'vtt') {
      let vtt = 'WEBVTT\n\n';
      completed.forEach(({ seg, start, end }) => {
        vtt += `${formatVttTime(start)} --> ${formatVttTime(end)}\n${seg.translatedText}\n\n`;
      });
      return vtt;
    }

    // ASS format
    let ass = '[Script Info]\nTitle: GameStringer Dubbing\nScriptType: v4.00+\n\n';
    ass += '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n';
    ass += 'Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1\n\n';
    ass += '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    completed.forEach(({ seg, start, end }) => {
      ass += `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,,0,0,0,,${seg.translatedText}\n`;
    });
    return ass;
  }

  // ── Build Result ────────────────────────────────────────

  private buildResult(startTime: number): DubbingResult {
    const subtitleContent = this.config.enableSubtitles ? this.generateSubtitles() : undefined;

    return {
      // Successo solo se almeno un file è stato davvero patchato. Prima bastava
      // `errors === 0`, e i segmenti saltati non contavano come errori.
      success: this.stats.patched > 0,
      segments: this.segments,
      stats: this.stats,
      subtitleFile: subtitleContent,
      steps: this.steps,
      totalDurationMs: performance.now() - startTime,
    };
  }
}

// ── Helpers ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** I formati che scan_game_audio_files trova: il nome coincide con l'estensione. */
export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac';

/**
 * Il formato che la sintesi restituisce con ogni provider di voice-clone.ts
 * (OpenAI response_format di default, ElevenLabs, Azure con MP3 fisso).
 * Se un provider imparerà a produrre altri formati, va passato come opzione.
 */
const TTS_OUTPUT_FORMAT: AudioFormat = 'mp3';

/** Formato reale dai primi byte (magic number), null se non riconosciuto. */
export function detectAudioFormat(bytes: Uint8Array): AudioFormat | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'wav';
  if (ascii(0, 4) === 'OggS') return 'ogg';
  if (ascii(0, 4) === 'fLaC') return 'flac';
  if (ascii(0, 3) === 'ID3') return 'mp3';
  // Frame MPEG senza tag ID3 (0xFFFB, 0xFFF3, ...): sync a 11 bit e layer III.
  // Il controllo sul layer esclude l'AAC ADTS (0xFFF1), che ha lo stesso sync.
  if (bytes[0] === 0xFF && (bytes[1] & 0xE6) === 0xE2) return 'mp3';
  return null;
}

/** Le durate reali hanno decimali: i millisecondi non vanno più troncati a ,000. */
function splitTime(seconds: number) {
  const totalMs = Math.round(seconds * 1000);
  return {
    h: Math.floor(totalMs / 3600000),
    m: Math.floor((totalMs % 3600000) / 60000),
    s: Math.floor((totalMs % 60000) / 1000),
    ms: totalMs % 1000,
  };
}

function formatSrtTime(seconds: number): string {
  const { h, m, s, ms } = splitTime(seconds);
  return `${pad(h)}:${pad(m)}:${pad(s)},${ms.toString().padStart(3, '0')}`;
}

function formatVttTime(seconds: number): string {
  const { h, m, s, ms } = splitTime(seconds);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${ms.toString().padStart(3, '0')}`;
}

function formatAssTime(seconds: number): string {
  const { h, m, s, ms } = splitTime(seconds);
  return `${h}:${pad(m)}:${pad(s)}.${pad(Math.floor(ms / 10))}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default DubbingPipeline;

