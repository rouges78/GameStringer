/* eslint-disable @typescript-eslint/no-explicit-any */

// Web Speech API type declarations (non incluse in tutti i tsconfig)
interface SpeechRecognitionEvent extends Event { results: SpeechRecognitionResultList; resultIndex: number; }
interface SpeechRecognitionErrorEvent extends Event { error: string; message: string; }
interface SpeechRecognitionResultList { readonly length: number; item(index: number): SpeechRecognitionResult; [index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionResult { readonly length: number; readonly isFinal: boolean; item(index: number): SpeechRecognitionAlternative; [index: number]: SpeechRecognitionAlternative; }
interface SpeechRecognitionAlternative { readonly transcript: string; readonly confidence: number; }
interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

/**
 * 🎙️ Speech-to-Text Game Audio Translator
 * 
 * Per giochi senza sottotitoli: cattura audio di gioco e lo traduce in tempo reale.
 * 
 * Architettura:
 * 1. Cattura audio dal dispositivo di output (WASAPI loopback / Web Audio API)
 * 2. Riconosce il parlato con Whisper (OpenAI API / Whisper locale via Ollama)
 * 3. Traduce il testo riconosciuto con il chain provider attivo
 * 4. Mostra i sottotitoli tradotti in overlay
 * 
 * Provider STT supportati:
 * - OpenAI Whisper API (cloud, preciso, richiede API key)
 * - Whisper locale via Ollama (gratuito, offline)
 * - Groq Whisper (cloud, velocissimo, richiede API key)
 * - Web Speech API (browser-native, gratis, meno preciso)
 */

// ============================================================================
// TYPES
// ============================================================================

export type STTProvider = 'openai_whisper' | 'groq_whisper' | 'local_whisper' | 'web_speech';

export interface STTConfig {
  provider: STTProvider;
  sourceLanguage: string;      // Lingua parlata nel gioco (es. 'ja', 'en')
  targetLanguage: string;      // Lingua traduzione output
  autoDetectLanguage: boolean;
  captureDeviceId?: string;    // ID dispositivo audio da catturare
  silenceThresholdDb: number;  // Soglia silenzio (default: -40dB)
  minSegmentMs: number;        // Minima durata segmento (default: 500ms)
  maxSegmentMs: number;        // Massima durata segmento (default: 30000ms)
  overlayEnabled: boolean;
  overlayPosition: 'top' | 'center' | 'bottom';
  overlayFontSize: number;
  overlayOpacity: number;
  showOriginal: boolean;       // Mostra anche il testo originale
}

export interface STTSegment {
  id: string;
  startTime: number;        // Timestamp inizio (ms)
  endTime: number;           // Timestamp fine (ms)
  originalText: string;      // Testo riconosciuto
  translatedText?: string;   // Testo tradotto
  detectedLanguage?: string;
  confidence: number;        // 0-1
  provider: STTProvider;
}

export interface STTStatus {
  isCapturing: boolean;
  isProcessing: boolean;
  currentProvider: STTProvider;
  segmentsProcessed: number;
  totalDurationMs: number;
  lastError?: string;
  audioLevel: number;        // 0-1 livello audio corrente
}

export type STTEventType = 'segment' | 'status' | 'error' | 'started' | 'stopped';

export interface STTEvent {
  type: STTEventType;
  segment?: STTSegment;
  status?: STTStatus;
  error?: string;
}

type STTListener = (event: STTEvent) => void;

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_STT_CONFIG: STTConfig = {
  provider: 'web_speech',
  sourceLanguage: 'ja',
  targetLanguage: 'it',
  autoDetectLanguage: false,
  silenceThresholdDb: -40,
  minSegmentMs: 500,
  maxSegmentMs: 30000,
  overlayEnabled: true,
  overlayPosition: 'bottom',
  overlayFontSize: 20,
  overlayOpacity: 0.85,
  showOriginal: true,
};

// ============================================================================
// STT ENGINE
// ============================================================================

export class SpeechToTextEngine {
  private config: STTConfig;
  private listeners: STTListener[] = [];
  private status: STTStatus;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private isRunning = false;
  private segmentCounter = 0;
  private segments: STTSegment[] = [];
  private webSpeechRecognition: SpeechRecognition | null = null;

  constructor(config?: Partial<STTConfig>) {
    this.config = { ...DEFAULT_STT_CONFIG, ...config };
    this.status = {
      isCapturing: false,
      isProcessing: false,
      currentProvider: this.config.provider,
      segmentsProcessed: 0,
      totalDurationMs: 0,
      audioLevel: 0,
    };
  }

  // ── Event System ──────────────────────────────────────────────

  on(listener: STTListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: STTEvent) {
    for (const listener of this.listeners) {
      try { listener(event); } catch (e) { console.error('[STT] Listener error:', e); }
    }
  }

  private updateStatus(partial: Partial<STTStatus>) {
    this.status = { ...this.status, ...partial };
    this.emit({ type: 'status', status: { ...this.status } });
  }

  // ── Config ────────────────────────────────────────────────────

  setConfig(config: Partial<STTConfig>) {
    this.config = { ...this.config, ...config };
    this.status.currentProvider = this.config.provider;
  }

  getConfig(): STTConfig {
    return { ...this.config };
  }

  getStatus(): STTStatus {
    return { ...this.status };
  }

  getSegments(): STTSegment[] {
    return [...this.segments];
  }

  // ── Start / Stop ──────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[STT] 🎙️ Avvio con provider: ${this.config.provider}`);
    this.updateStatus({ isCapturing: true });
    this.emit({ type: 'started' });

    try {
      switch (this.config.provider) {
        case 'web_speech':
          await this.startWebSpeech();
          break;
        case 'openai_whisper':
        case 'groq_whisper':
        case 'local_whisper':
          await this.startAudioCapture();
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[STT] Errore avvio:', msg);
      this.emit({ type: 'error', error: msg });
      this.updateStatus({ isCapturing: false, lastError: msg });
      this.isRunning = false;
    }
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Stop Web Speech
    if (this.webSpeechRecognition) {
      this.webSpeechRecognition.stop();
      this.webSpeechRecognition = null;
    }

    // Stop audio capture
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.updateStatus({ isCapturing: false, isProcessing: false });
    this.emit({ type: 'stopped' });
    console.log(`[STT] 🛑 Fermato. ${this.status.segmentsProcessed} segmenti processati.`);
  }

  clearSegments() {
    this.segments = [];
    this.segmentCounter = 0;
    this.updateStatus({ segmentsProcessed: 0, totalDurationMs: 0 });
  }

  // ── Web Speech API (browser-native) ───────────────────────────

  private async startWebSpeech(): Promise<void> {
    const win = window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition };
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      throw new Error('Web Speech API non supportata in questo browser');
    }

    const recognition: SpeechRecognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.mapLanguageCode(this.config.sourceLanguage);
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text.length < 2) continue;

          const segment: STTSegment = {
            id: `stt_${++this.segmentCounter}`,
            startTime: Date.now() - (text.length * 50),
            endTime: Date.now(),
            originalText: text,
            confidence: result[0].confidence || 0.8,
            provider: 'web_speech',
          };

          // Traduci
          await this.translateSegment(segment);
          this.segments.push(segment);
          this.updateStatus({
            segmentsProcessed: this.status.segmentsProcessed + 1,
            totalDurationMs: this.status.totalDurationMs + (segment.endTime - segment.startTime),
          });
          this.emit({ type: 'segment', segment });
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.error('[STT-WebSpeech] Errore:', event.error);
      this.emit({ type: 'error', error: `Web Speech: ${event.error}` });
    };

    recognition.onend = () => {
      if (this.isRunning) {
        // Auto-restart se è stato fermato dal browser
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();
    this.webSpeechRecognition = recognition;
  }

  // ── Audio Capture (per Whisper API) ───────────────────────────

  private async startAudioCapture(): Promise<void> {
    // Cattura audio di sistema (richiede che l'utente condivida la scheda/finestra)
    try {
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1, height: 1 },  // Video minimo (obbligatorio)
        audio: true,
      });
    } catch {
      // Fallback: cattura microfono
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    const audioTracks = this.mediaStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('Nessuna traccia audio trovata. Seleziona una finestra con audio.');
    }

    // Rimuovi video tracks (non necessari)
    this.mediaStream.getVideoTracks().forEach(t => t.stop());

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(
      new MediaStream(audioTracks)
    );

    // Analizzatore livello audio
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    // Recorder per segmenti
    const mediaRecorder = new MediaRecorder(new MediaStream(audioTracks), {
      mimeType: 'audio/webm;codecs=opus',
    });

    let chunks: Blob[] = [];
    let segmentStart = Date.now();

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      if (chunks.length === 0) return;
      const blob = new Blob(chunks, { type: 'audio/webm' });
      chunks = [];

      if (blob.size < 1000) return; // Skip segmenti troppo corti

      const segmentEnd = Date.now();
      this.updateStatus({ isProcessing: true });

      try {
        const text = await this.transcribeAudio(blob);
        if (text && text.length >= 2) {
          const segment: STTSegment = {
            id: `stt_${++this.segmentCounter}`,
            startTime: segmentStart,
            endTime: segmentEnd,
            originalText: text,
            confidence: 0.85,
            provider: this.config.provider,
          };

          await this.translateSegment(segment);
          this.segments.push(segment);
          this.updateStatus({
            segmentsProcessed: this.status.segmentsProcessed + 1,
            totalDurationMs: this.status.totalDurationMs + (segmentEnd - segmentStart),
            isProcessing: false,
          });
          this.emit({ type: 'segment', segment });
        } else {
          this.updateStatus({ isProcessing: false });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[STT-Whisper] Errore trascrizione:', msg);
        this.updateStatus({ isProcessing: false, lastError: msg });
      }

      // Riavvia se ancora attivo
      if (this.isRunning) {
        segmentStart = Date.now();
        mediaRecorder.start();
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, this.config.maxSegmentMs);
      }
    };

    // Avvia la prima registrazione
    mediaRecorder.start();
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, this.config.maxSegmentMs);

    // Monitor livello audio
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const monitorLevel = () => {
      if (!this.isRunning) return;
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
      this.status.audioLevel = Math.min(1, avg / 128);
      requestAnimationFrame(monitorLevel);
    };
    monitorLevel();
  }

  // ── Transcription (Whisper) ───────────────────────────────────

  private async transcribeAudio(audioBlob: Blob): Promise<string> {
    switch (this.config.provider) {
      case 'openai_whisper':
        return this.transcribeWithOpenAI(audioBlob);
      case 'groq_whisper':
        return this.transcribeWithGroq(audioBlob);
      case 'local_whisper':
        return this.transcribeWithLocalWhisper(audioBlob);
      default:
        throw new Error(`Provider STT non supportato: ${this.config.provider}`);
    }
  }

  private async transcribeWithOpenAI(audioBlob: Blob): Promise<string> {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    const apiKey = settings?.translation?.openaiApiKey || settings?.openaiApiKey || settings?.voice?.openaiKey;
    if (!apiKey) throw new Error('API key OpenAI non configurata');

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    if (!this.config.autoDetectLanguage && this.config.sourceLanguage) {
      formData.append('language', this.config.sourceLanguage);
    }

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) throw new Error(`OpenAI Whisper: ${res.status}`);
    const data = await res.json();
    return data.text || '';
  }

  private async transcribeWithGroq(audioBlob: Blob): Promise<string> {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    const apiKey = settings?.translation?.groqApiKey;
    if (!apiKey) throw new Error('API key Groq non configurata');

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-large-v3-turbo');
    if (!this.config.autoDetectLanguage && this.config.sourceLanguage) {
      formData.append('language', this.config.sourceLanguage);
    }

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) throw new Error(`Groq Whisper: ${res.status}`);
    const data = await res.json();
    return data.text || '';
  }

  private async transcribeWithLocalWhisper(audioBlob: Blob): Promise<string> {
    // Usa Ollama o un server Whisper locale
    // Prima prova Ollama con modello whisper
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'whisper',
        prompt: `Transcribe this audio to text. Language: ${this.config.sourceLanguage || 'auto'}`,
        images: [base64], // Ollama usa "images" per dati binari
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      // Fallback: prova openedai-whisper server locale (porta 8000)
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');

      const localRes = await fetch('http://localhost:8000/v1/audio/transcriptions', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000),
      });
      if (!localRes.ok) throw new Error('Whisper locale non disponibile');
      const data = await localRes.json();
      return data.text || '';
    }

    const data = await res.json();
    return data.response || '';
  }

  // ── Translation ───────────────────────────────────────────────

  private async translateSegment(segment: STTSegment): Promise<void> {
    if (segment.originalText.length < 2) return;

    // Se la lingua sorgente è uguale alla target, non tradurre
    const srcLang = this.config.sourceLanguage;
    const tgtLang = this.config.targetLanguage;
    if (srcLang === tgtLang) {
      segment.translatedText = segment.originalText;
      return;
    }

    try {
      const { translateSingleWithFallback } = await import('./ai-translate-direct');
      const result = await translateSingleWithFallback(
        segment.originalText,
        tgtLang,
        srcLang,
        'Game dialogue / audio transcription'
      );
      segment.translatedText = result.translated;
    } catch (err) {
      console.error('[STT] Errore traduzione segmento:', err);
      segment.translatedText = segment.originalText;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  private mapLanguageCode(lang: string): string {
    const map: Record<string, string> = {
      en: 'en-US', it: 'it-IT', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR',
      de: 'de-DE', fr: 'fr-FR', es: 'es-ES', pt: 'pt-BR', ru: 'ru-RU',
      ar: 'ar-SA', hi: 'hi-IN', th: 'th-TH', vi: 'vi-VN', pl: 'pl-PL',
      nl: 'nl-NL', sv: 'sv-SE', tr: 'tr-TR', cs: 'cs-CZ', el: 'el-GR',
    };
    return map[lang] || lang;
  }

  // ── Export ────────────────────────────────────────────────────

  exportTranscript(format: 'srt' | 'txt' | 'json' = 'srt'): string {
    switch (format) {
      case 'srt':
        return this.segments.map((seg, i) => {
          const start = this.formatSRTTime(seg.startTime);
          const end = this.formatSRTTime(seg.endTime);
          const text = seg.translatedText || seg.originalText;
          return `${i + 1}\n${start} --> ${end}\n${text}\n`;
        }).join('\n');

      case 'txt':
        return this.segments.map(seg => {
          const original = seg.originalText;
          const translated = seg.translatedText || '';
          return this.config.showOriginal && translated
            ? `[${original}]\n${translated}`
            : translated || original;
        }).join('\n\n');

      case 'json':
        return JSON.stringify(this.segments, null, 2);
    }
  }

  private formatSRTTime(ms: number): string {
    const date = new Date(ms);
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    const ms2 = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s},${ms2}`;
  }
}

// ============================================================================
// CONFIG PERSISTENCE
// ============================================================================

export function loadSTTConfig(): STTConfig {
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    return { ...DEFAULT_STT_CONFIG, ...settings?.stt };
  } catch {
    return { ...DEFAULT_STT_CONFIG };
  }
}

export function saveSTTConfig(config: Partial<STTConfig>): void {
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    settings.stt = { ...loadSTTConfig(), ...config };
    localStorage.setItem('gameStringerSettings', JSON.stringify(settings));
  } catch {}
}

// ============================================================================
// PROVIDER AVAILABILITY CHECK
// ============================================================================

export interface STTProviderInfo {
  id: STTProvider;
  name: string;
  description: string;
  available: boolean;
  requiresApiKey: boolean;
  free: boolean;
  quality: number;  // 1-5
  speed: number;    // 1-5
}

export async function checkSTTProviders(): Promise<STTProviderInfo[]> {
  const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
  const hasOpenAIKey = !!(settings?.translation?.openaiApiKey || settings?.openaiApiKey || settings?.voice?.openaiKey);
  const hasGroqKey = !!settings?.translation?.groqApiKey;

  // Check Web Speech API
  const win = window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition };
  const hasWebSpeech = !!(win.SpeechRecognition || win.webkitSpeechRecognition);

  // Check Ollama
  let hasOllama = false;
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    hasOllama = res.ok;
  } catch {}

  return [
    {
      id: 'groq_whisper',
      name: 'Groq Whisper',
      description: 'Whisper Large V3 Turbo via Groq — velocissimo (cloud)',
      available: hasGroqKey,
      requiresApiKey: true,
      free: false,
      quality: 5,
      speed: 5,
    },
    {
      id: 'openai_whisper',
      name: 'OpenAI Whisper',
      description: 'Whisper-1 via OpenAI API — preciso (cloud)',
      available: hasOpenAIKey,
      requiresApiKey: true,
      free: false,
      quality: 5,
      speed: 4,
    },
    {
      id: 'local_whisper',
      name: 'Whisper Locale',
      description: 'Whisper via Ollama o server locale — offline, gratuito',
      available: hasOllama,
      requiresApiKey: false,
      free: true,
      quality: 4,
      speed: 3,
    },
    {
      id: 'web_speech',
      name: 'Web Speech API',
      description: 'Riconoscimento vocale browser-native — gratuito, meno preciso',
      available: hasWebSpeech,
      requiresApiKey: false,
      free: true,
      quality: 3,
      speed: 5,
    },
  ];
}

// Singleton
let sttEngineInstance: SpeechToTextEngine | null = null;

export function getSTTEngine(config?: Partial<STTConfig>): SpeechToTextEngine {
  if (!sttEngineInstance) {
    sttEngineInstance = new SpeechToTextEngine(config || loadSTTConfig());
  } else if (config) {
    sttEngineInstance.setConfig(config);
  }
  return sttEngineInstance;
}
