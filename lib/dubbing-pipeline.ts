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
import { translateWithFallback } from './ai-translate-direct';
import { clientLogger } from './client-logger';

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

  async run(onProgress?: ProgressCallback): Promise<DubbingResult> {
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
      // Step 1: Scan audio files
      await this.runStep('scan', async () => {
        this.segments = await this.scanAudioFiles();
        this.stats.totalAudioFiles = this.segments.length;
        return `${this.segments.length} file audio trovati`;
      });

      if (this.segments.length === 0) {
        return this.buildResult(pipelineStart);
      }

      // Step 2: Transcribe
      await this.runStep('transcribe', async () => {
        await this.transcribeAll();
        return `${this.stats.transcribed} trascritti`;
      });

      // Step 3: Translate
      await this.runStep('translate', async () => {
        await this.translateAll();
        return `${this.stats.translated} tradotti`;
      });

      // Step 4: Synthesize voice
      await this.runStep('synthesize', async () => {
        await this.synthesizeAll();
        return `${this.stats.synthesized} sintetizzati`;
      });

      // Step 5: Patch audio files
      await this.runStep('patch', async () => {
        await this.patchAll();
        return `${this.stats.patched} file patchati`;
      });

      // Step 6: Lip sync (optional)
      if (this.config.enableLipSync) {
        await this.runStep('lipsync', async () => {
          await this.generateLipSync();
          return 'Lip sync generato';
        });
      }

      // Step 7: Subtitles (optional)
      if (this.config.enableSubtitles) {
        await this.runStep('subtitles', async () => {
          const content = this.generateSubtitles();
          return `Sottotitoli ${this.config.subtitleFormat.toUpperCase()} generati`;
        });
      }

    } catch (err: unknown) {
      clientLogger.error('Dubbing pipeline failed', 'DUBBING', {
        error: err instanceof Error ? err.message : String(err)
      });
    }

    this.isRunning = false;
    return this.buildResult(pipelineStart);
  }

  pause() { this.isPaused = true; }
  resume() { this.isPaused = false; }
  abort() { this.abortController?.abort(); this.isRunning = false; }

  // ── Step Runner ─────────────────────────────────────────

  private async runStep(stepId: DubbingStepId, fn: () => Promise<string>): Promise<void> {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'running';
    step.startedAt = Date.now();
    this.emitProgress(stepId);

    try {
      const result = await fn();
      step.status = 'completed';
      step.progress = 100;
      step.result = result;
      step.completedAt = Date.now();
      step.durationMs = step.completedAt - step.startedAt;
    } catch (err: unknown) {
      step.status = 'failed';
      step.error = err instanceof Error ? err.message : String(err);
      step.completedAt = Date.now();
      step.durationMs = step.completedAt - (step.startedAt || Date.now());
    }

    this.emitProgress(stepId);
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
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke<Array<{ path: string; name: string; size: number }>>('scan_game_audio_files', {
        gamePath: this.config.gamePath,
      });

      return (files || []).map((f, i) => ({
        id: `seg_${i}`,
        filePath: f.path,
        fileName: f.name,
        fileSize: f.size,
        status: 'pending' as const,
      }));
    } catch {
      // Fallback: empty list
      return [];
    }
  }

  // ── Step 2: Transcribe ──────────────────────────────────

  private async transcribeAll(): Promise<void> {
    const step = this.steps.find(s => s.id === 'transcribe')!;
    let confidenceSum = 0;

    for (let i = 0; i < this.segments.length; i++) {
      if (this.abortController?.signal.aborted) break;
      while (this.isPaused) await sleep(500);

      const segment = this.segments[i];
      segment.status = 'transcribing';
      step.progress = Math.round((i / this.segments.length) * 100);
      this.emitProgress('transcribe');

      try {
        // Read audio file as base64 via Tauri
        const { invoke } = await import('@tauri-apps/api/core');
        const audioBase64 = await invoke<string>('read_file_base64', { path: segment.filePath });

        // Transcribe via API
        const response = await fetch('/api/voice/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-GS-Client': 'gamestringer' },
          body: JSON.stringify({
            audioData: audioBase64,
            audioFormat: segment.fileName.split('.').pop() || 'wav',
            language: this.config.sourceLanguage,
            provider: this.config.sttProvider === 'groq_whisper' ? 'groq' : 'openai',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          segment.originalText = data.text;
          segment.detectedLanguage = data.language;
          segment.transcriptionConfidence = data.confidence || 0.9;
          segment.status = 'pending';
          this.stats.transcribed++;
          confidenceSum += segment.transcriptionConfidence;
        } else {
          segment.status = 'error';
          segment.error = `Transcription failed: ${response.status}`;
          this.stats.errors++;
        }
      } catch (err: unknown) {
        segment.status = 'error';
        segment.error = err instanceof Error ? err.message : 'Transcription error';
        this.stats.errors++;
      }
    }

    if (this.stats.transcribed > 0) {
      this.stats.avgTranscriptionConfidence = confidenceSum / this.stats.transcribed;
    }
  }

  // ── Step 3: Translate ───────────────────────────────────

  private async translateAll(): Promise<void> {
    const step = this.steps.find(s => s.id === 'translate')!;
    const toTranslate = this.segments.filter(s => s.originalText && s.status !== 'error');

    // Batch translate for efficiency
    const batchSize = 20;
    for (let i = 0; i < toTranslate.length; i += batchSize) {
      if (this.abortController?.signal.aborted) break;
      while (this.isPaused) await sleep(500);

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
            seg.translatedText = result.translations[idx] || seg.originalText;
            seg.status = 'pending';
            this.stats.translated++;
          });
        }
      } catch (err: unknown) {
        batch.forEach(seg => {
          seg.status = 'error';
          seg.error = 'Translation batch failed';
          this.stats.errors++;
        });
      }
    }
  }

  // ── Step 4: Synthesize Voice ────────────────────────────

  private async synthesizeAll(): Promise<void> {
    const step = this.steps.find(s => s.id === 'synthesize')!;
    const toSynthesize = this.segments.filter(s => s.translatedText && s.status !== 'error');

    for (let i = 0; i < toSynthesize.length; i++) {
      if (this.abortController?.signal.aborted) break;
      while (this.isPaused) await sleep(500);

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
        segment.synthesizedDuration = result.duration;
        segment.durationMatched = result.durationMatched;
        segment.status = 'pending';
        this.stats.synthesized++;
        this.stats.totalDurationSynthesized += result.duration;

        // Rate limit: small delay between synthesis calls
        await sleep(300);

      } catch (err: unknown) {
        segment.status = 'error';
        segment.error = err instanceof Error ? err.message : 'Synthesis error';
        this.stats.errors++;
      }
    }
  }

  // ── Step 5: Patch Audio Files ───────────────────────────

  private async patchAll(): Promise<void> {
    const step = this.steps.find(s => s.id === 'patch')!;
    const toPatch = this.segments.filter(s => s.synthesizedAudioUrl && s.status !== 'error');

    for (let i = 0; i < toPatch.length; i++) {
      if (this.abortController?.signal.aborted) break;

      const segment = toPatch[i];
      segment.status = 'patching';
      step.progress = Math.round((i / toPatch.length) * 100);
      this.emitProgress('patch');

      try {
        // Fetch synthesized audio as base64
        const audioResponse = await fetch(segment.synthesizedAudioUrl!);
        const audioBlob = await audioResponse.blob();
        const reader = new FileReader();
        const audioBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(audioBlob);
        });

        // Replace via Tauri command (creates .original backup automatically)
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('replace_audio_file', {
          originalPath: segment.filePath,
          newAudioBase64: audioBase64,
        });

        segment.status = 'complete';
        this.stats.patched++;
      } catch (err: unknown) {
        segment.status = 'error';
        segment.error = err instanceof Error ? err.message : 'Patch error';
        this.stats.errors++;
      }
    }
  }

  // ── Step 6: Lip Sync ────────────────────────────────────

  private async generateLipSync(): Promise<void> {
    const step = this.steps.find(s => s.id === 'lipsync')!;
    const completed = this.segments.filter(s => s.status === 'complete');

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
      } catch {
        // Lip sync is optional — don't fail the pipeline
        clientLogger.warn(`Lip sync failed for ${completed[i].fileName}`, 'DUBBING');
      }
    }
  }

  // ── Step 7: Generate Subtitles ──────────────────────────

  private generateSubtitles(): string {
    const completed = this.segments.filter(s => s.translatedText);
    const format = this.config.subtitleFormat;

    if (format === 'srt') {
      return completed.map((seg, i) => {
        const start = formatSrtTime(i * 5); // Simplified: 5s per segment
        const end = formatSrtTime((i + 1) * 5);
        return `${i + 1}\n${start} --> ${end}\n${seg.translatedText}\n`;
      }).join('\n');
    }

    if (format === 'vtt') {
      let vtt = 'WEBVTT\n\n';
      completed.forEach((seg, i) => {
        const start = formatVttTime(i * 5);
        const end = formatVttTime((i + 1) * 5);
        vtt += `${start} --> ${end}\n${seg.translatedText}\n\n`;
      });
      return vtt;
    }

    // ASS format
    let ass = '[Script Info]\nTitle: GameStringer Dubbing\nScriptType: v4.00+\n\n';
    ass += '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n';
    ass += 'Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1\n\n';
    ass += '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    completed.forEach((seg, i) => {
      const start = formatAssTime(i * 5);
      const end = formatAssTime((i + 1) * 5);
      ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${seg.translatedText}\n`;
    });
    return ass;
  }

  // ── Build Result ────────────────────────────────────────

  private buildResult(startTime: number): DubbingResult {
    const subtitleContent = this.config.enableSubtitles ? this.generateSubtitles() : undefined;

    return {
      success: this.stats.errors === 0 || this.stats.patched > 0,
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

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)},000`;
}

function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}.000`;
}

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}:${pad(m)}:${pad(s)}.00`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default DubbingPipeline;
