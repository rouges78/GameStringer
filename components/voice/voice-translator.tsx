'use client';

import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Mic,
  Volume2,
  Languages,
  Wand2,
  Download,
  Upload,
  StopCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
  FileAudio,
  Timer
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/lib/i18n';
import { translateSingleWithFallback, getApiKeys } from '@/lib/ai-translate-direct';
import { clientLogger } from '@/lib/client-logger';

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

interface VoiceTranslatorState {
  // Recording
  isRecording: boolean;
  recordingDuration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  
  // Transcription
  isTranscribing: boolean;
  transcription: string;
  transcriptionSegments: TranscriptionSegment[];
  sourceLanguage: string;
  
  // Translation
  isTranslating: boolean;
  translation: string;
  targetLanguage: string;
  
  // TTS
  isSynthesizing: boolean;
  synthesizedAudioUrl: string | null;
  selectedVoice: string;
  speechSpeed: number;

  // Duration matching
  durationMatchEnabled: boolean;
  originalDuration: number; // Duration of original audio in seconds
  synthesizedDuration: number; // Duration of synthesized audio
  effectiveSpeed: number | null;

  // General
  error: string | null;
  step: 'idle' | 'recording' | 'transcribing' | 'translating' | 'synthesizing' | 'done';
}

const LANGUAGES = [
  { code: 'auto', name: 'Auto-Detect' },
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: '日本語' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '中文' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' }
];

const TTS_VOICES = [
  { id: 'nova', name: 'Nova', description: 'Female, natural' },
  { id: 'alloy', name: 'Alloy', description: 'Neutral, versatile' },
  { id: 'echo', name: 'Echo', description: 'Male, deep' },
  { id: 'fable', name: 'Fable', description: 'Narrative, expressive' },
  { id: 'onyx', name: 'Onyx', description: 'Male, authoritative' },
  { id: 'shimmer', name: 'Shimmer', description: 'Female, bright' },
  { id: 'clone', name: '🎤 Voice Clone (Locale/XTTS)', description: 'Clona la voce originale (Richiede XTTS/AllTalk locale)' }
];

export function VoiceTranslator() {
  const { t } = useTranslation();
  const [state, setState] = useState<VoiceTranslatorState>({
    isRecording: false,
    recordingDuration: 0,
    audioBlob: null,
    audioUrl: null,
    isTranscribing: false,
    transcription: '',
    transcriptionSegments: [],
    sourceLanguage: 'auto',
    isTranslating: false,
    translation: '',
    targetLanguage: 'it',
    isSynthesizing: false,
    synthesizedAudioUrl: null,
    selectedVoice: 'nova',
    speechSpeed: 1.0,
    durationMatchEnabled: false,
    originalDuration: 0,
    synthesizedDuration: 0,
    effectiveSpeed: null,
    error: null,
    step: 'idle'
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthesizedAudioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }
      if (state.synthesizedAudioUrl) {
        URL.revokeObjectURL(state.synthesizedAudioUrl);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const duration = await measureDuration(audioBlob);

        setState(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
          originalDuration: duration,
          isRecording: false,
          step: 'idle'
        }));

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          recordingDuration: prev.recordingDuration + 0.1
        }));
      }, 100);

      setState(prev => ({
        ...prev,
        isRecording: true,
        recordingDuration: 0,
        error: null,
        step: 'recording'
      }));

    } catch {
      setState(prev => ({
        ...prev,
        error: 'Unable to access microphone. Check permissions.'
      }));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  // Measure audio blob duration using Web Audio API
  const measureDuration = async (blob: Blob): Promise<number> => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const duration = audioBuffer.duration;
      await audioContext.close();
      return duration;
    } catch {
      return 0;
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const audioUrl = URL.createObjectURL(file);
    const duration = await measureDuration(file);
    setState(prev => ({
      ...prev,
      audioBlob: file,
      audioUrl,
      originalDuration: duration,
      error: null
    }));
  };

  const transcribeAudio = async () => {
    if (!state.audioBlob) return;

    setState(prev => ({ ...prev, isTranscribing: true, step: 'transcribing', error: null }));

    try {
      const { openai: openaiKey } = getApiKeys();
      if (!openaiKey) {
        throw new Error('OpenAI API key non configurata. Vai nelle Impostazioni.');
      }

      // Crea FormData per Whisper API (richiede file, non base64)
      const formData = new FormData();
      formData.append('file', state.audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      if (state.sourceLanguage !== 'auto') {
        formData.append('language', state.sourceLanguage);
      }

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}` },
        body: formData
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Whisper errore ${response.status}`);
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        transcription: data.text || '',
        transcriptionSegments: (data.segments || []).map((s: Record<string, unknown>) => ({
          start: s.start as number, end: s.end as number, text: s.text as string
        })),
        sourceLanguage: data.language || prev.sourceLanguage,
        isTranscribing: false,
        step: 'idle'
      }));

    } catch (error: unknown) {
      setState(prev => ({
        ...prev,
        isTranscribing: false,
        step: 'idle',
        error: error instanceof Error ? error.message : 'Transcription error. Check your OpenAI API key.'
      }));
    }
  };

  const translateText = async () => {
    if (!state.transcription) return;

    setState(prev => ({ ...prev, isTranslating: true, step: 'translating', error: null }));

    try {
      const { translated } = await translateSingleWithFallback(
        state.transcription,
        state.targetLanguage,
        state.sourceLanguage === 'auto' ? undefined : state.sourceLanguage,
        'voice translation'
      );
      
      setState(prev => ({
        ...prev,
        translation: translated,
        isTranslating: false,
        step: 'idle'
      }));

    } catch (error: unknown) {
      setState(prev => ({
        ...prev,
        isTranslating: false,
        step: 'idle',
        error: error instanceof Error ? error.message : 'Translation error.'
      }));
    }
  };

  const synthesizeSpeech = async () => {
    if (!state.translation) return;

    setState(prev => ({ ...prev, isSynthesizing: true, step: 'synthesizing', error: null }));

    try {
      const { openai: openaiKey } = getApiKeys();
      
      let ttsUrl = 'https://api.openai.com/v1/audio/speech';
      // Calculate speed: if duration matching is enabled, auto-calculate
      let effectiveSpeed = state.speechSpeed;

      let requestBody: Record<string, unknown> = {
        model: 'tts-1',
        input: state.translation,
        voice: state.selectedVoice,
        speed: effectiveSpeed,
        response_format: 'mp3',
      };
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Se l'utente sceglie "clone", proviamo a usare un endpoint locale (es. AllTalk/XTTS)
      if (state.selectedVoice === 'clone') {
        if (!state.audioBlob) {
          throw new Error('Per clonare la voce serve prima registrare o caricare un audio sorgente.');
        }
        
        // Converti l'audio sorgente in base64 per inviarlo come reference al server di cloning locale
        const reader = new FileReader();
        const base64Audio = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(state.audioBlob!);
        });

        // Configurazione per server locale XTTS/AllTalk (API compatibile o custom)
        const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
        ttsUrl = settings?.voice?.localTtsUrl || 'http://127.0.0.1:8000/v1/audio/speech';
        
        requestBody = {
          model: 'xtts',
          input: state.translation,
          voice: 'clone',
          language: state.targetLanguage,
          speed: state.speechSpeed,
          reference_audio: base64Audio, // Payload custom per il cloning
          response_format: 'wav',
        };
        
        // Se non abbiamo chiave OpenAI ma usiamo server locale, bypassiamo l'errore
        if ((!openaiKey && ttsUrl.includes('127.0.0.1')) || ttsUrl.includes('localhost')) {
          headers['Authorization'] = 'Bearer local';
        } else if (!openaiKey && !ttsUrl.includes('127.0.0.1') && !ttsUrl.includes('localhost')) {
          throw new Error('Chiave API mancante per server remoto.');
        } else {
          headers['Authorization'] = `Bearer ${openaiKey || 'local'}`;
        }
      } else {
        if (!openaiKey) {
          throw new Error('OpenAI API key non configurata. Vai nelle Impostazioni.');
        }
        headers['Authorization'] = `Bearer ${openaiKey}`;
      }

      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `TTS errore ${response.status}`);
      }

      let audioBlob = await response.blob();
      let synthDuration = await measureDuration(audioBlob);

      // Duration matching: if enabled and we have original duration, re-synthesize with adjusted speed
      if (state.durationMatchEnabled && state.originalDuration > 0 && synthDuration > 0) {
        const tolerance = 0.15; // 15%
        const diff = Math.abs(synthDuration - state.originalDuration) / state.originalDuration;

        if (diff > tolerance) {
          const speedRatio = synthDuration / state.originalDuration;
          effectiveSpeed = Math.max(0.5, Math.min(2.0, state.speechSpeed * speedRatio));

          clientLogger.debug(`[DurationMatch] Original: ${state.originalDuration.toFixed(2)}s, Synthesized: ${synthDuration.toFixed(2)}s → Speed: ${effectiveSpeed.toFixed(2)}x`);

          // Re-synthesize with adjusted speed
          requestBody.speed = effectiveSpeed;
          const response2 = await fetch(ttsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
          });
          if (response2.ok) {
            audioBlob = await response2.blob();
            synthDuration = await measureDuration(audioBlob);
          }
        }
      }

      const synthesizedAudioUrl = URL.createObjectURL(audioBlob);

      setState(prev => ({
        ...prev,
        synthesizedAudioUrl,
        synthesizedDuration: synthDuration,
        effectiveSpeed: state.durationMatchEnabled ? effectiveSpeed : null,
        isSynthesizing: false,
        step: 'done'
      }));

    } catch (error: unknown) {
      setState(prev => ({
        ...prev,
        isSynthesizing: false,
        step: 'idle',
        error: error instanceof Error ? error.message : 'Speech synthesis error.'
      }));
    }
  };

  const runFullPipeline = async () => {
    await transcribeAudio();
    // The subsequent steps will be triggered by useEffect or manually
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStepProgress = () => {
    switch (state.step) {
      case 'recording': return 25;
      case 'transcribing': return 50;
      case 'translating': return 75;
      case 'synthesizing': return 90;
      case 'done': return 100;
      default: return 0;
    }
  };

  return (
    <div className="space-y-3">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 animate-shimmer p-3 shadow-xl shadow-blue-900/50">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Volume2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('voiceTranslator.title')}</h1>
              <p className="text-sm text-white/70">{t('voiceTranslator.subtitle')}</p>
            </div>
          </div>
          
          {/* Progress in header */}
          {state.step !== 'idle' && (
            <div className="flex items-center gap-3">
              <Progress value={getStepProgress()} className="w-32 h-2" />
              <Badge className="bg-white/20 text-white capitalize text-xs">{state.step}</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {state.error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="py-3 flex items-center gap-2 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <span>{state.error}</span>
          </CardContent>
        </Card>
      )}

      {/* Main Content - Layout verticale compatto */}
      <div className="space-y-3">
        {/* Step 1: Recording */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recording Section */}
          <Card>
            <CardHeader className="py-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Mic className="h-4 w-4 text-blue-400" />
                {t('voiceTranslator.recordOrUpload')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Recording Controls */}
              <div className="flex items-center gap-3">
                <Button
                  size="lg"
                  variant={state.isRecording ? 'destructive' : 'default'}
                  className={state.isRecording ? '' : 'bg-blue-500 hover:bg-blue-600'}
                  onClick={state.isRecording ? stopRecording : startRecording}
                >
                  {state.isRecording ? (
                    <>
                      <StopCircle className="h-5 w-5 mr-2" />
                      {t('voiceTranslator.stop')}
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5 mr-2" />
                      {t('voiceTranslator.record')}
                    </>
                  )}
                </Button>

                {state.isRecording && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-mono">{formatDuration(state.recordingDuration)}</span>
                  </div>
                )}

                <div className="flex-1" />

                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      {t('voiceTranslator.uploadFile')}
                    </span>
                  </Button>
                </label>
              </div>

              {/* Audio Preview */}
              {state.audioUrl && (
                <div className="bg-muted rounded-lg p-3">
                  <audio
                    ref={audioRef}
                    src={state.audioUrl}
                    controls
                    className="w-full h-10"
                  />
                </div>
              )}

              {/* Source Language */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('voiceTranslator.audioLanguage')}</span>
                <Select
                  value={state.sourceLanguage}
                  onValueChange={(v) => setState(prev => ({ ...prev, sourceLanguage: v }))}
                >
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.code === 'auto' ? t('voiceTranslator.autoDetect') : lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transcribe Button */}
              <Button
                onClick={transcribeAudio}
                disabled={!state.audioBlob || state.isTranscribing}
                className="w-full bg-blue-600 hover:bg-blue-500"
              >
                {state.isTranscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('voiceTranslator.transcribing')}
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    {t('voiceTranslator.transcribeWithWhisper')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Transcription Result */}
          <Card>
            <CardHeader className="py-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileAudio className="h-4 w-4 text-cyan-400" />
                {t('voiceTranslator.transcription')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={state.transcription}
                onChange={(e) => setState(prev => ({ ...prev, transcription: e.target.value }))}
                placeholder={t('voiceTranslator.transcriptionPlaceholder')}
                className="min-h-[60px] text-sm resize-none"
              />
            </CardContent>
          </Card>
        </div>

        {/* Step 2: Translation & TTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Translation Section */}
          <Card>
            <CardHeader className="py-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Languages className="h-4 w-4 text-blue-400" />
                {t('voiceTranslator.translation')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Target Language */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('voiceTranslator.translateTo')}</span>
                <Select
                  value={state.targetLanguage}
                  onValueChange={(v) => setState(prev => ({ ...prev, targetLanguage: v }))}
                >
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.filter(l => l.code !== 'auto').map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={translateText}
                  disabled={!state.transcription || state.isTranslating}
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  {state.isTranslating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-1" />
                      {t('voiceTranslator.translate')}
                    </>
                  )}
                </Button>
              </div>

              <Textarea
                value={state.translation}
                onChange={(e) => setState(prev => ({ ...prev, translation: e.target.value }))}
                placeholder={t('voiceTranslator.translationPlaceholder')}
                className="min-h-[60px] text-sm resize-none"
              />
            </CardContent>
          </Card>

          {/* TTS Section */}
          <Card>
            <CardHeader className="py-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-cyan-400" />
                {t('voiceTranslator.textToSpeech')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Voice Selection */}
              <div className="grid grid-cols-3 gap-2">
                {TTS_VOICES.map(voice => (
                  <Button
                    key={voice.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setState(prev => ({ ...prev, selectedVoice: voice.id }))}
                    className={`text-xs ${state.selectedVoice === voice.id ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : ''}`}
                  >
                    {voice.name}
                  </Button>
                ))}
              </div>

              {/* Speed Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('voiceTranslator.speed')}</span>
                  <span>{state.speechSpeed.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[state.speechSpeed * 10]}
                  onValueChange={([v]) => setState(prev => ({ ...prev, speechSpeed: v / 10 }))}
                  min={5}
                  max={20}
                  step={1}
                />
              </div>

              {/* Duration Matching Toggle */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-amber-400" />
                  <div>
                    <Label htmlFor="duration-match" className="text-sm text-slate-300">Duration Matching</Label>
                    <p className="text-[10px] text-slate-500">Adatta la velocità per mantenere la durata originale</p>
                  </div>
                </div>
                <Switch
                  id="duration-match"
                  checked={state.durationMatchEnabled}
                  onCheckedChange={(checked) => setState(prev => ({ ...prev, durationMatchEnabled: checked }))}
                  disabled={state.originalDuration <= 0}
                />
              </div>
              {state.durationMatchEnabled && state.originalDuration > 0 && (
                <div className="flex items-center gap-3 text-xs text-slate-400 px-1">
                  <span>Durata originale: <strong className="text-white">{state.originalDuration.toFixed(1)}s</strong></span>
                  {state.synthesizedDuration > 0 && (
                    <>
                      <span>→ Sintetizzata: <strong className="text-white">{state.synthesizedDuration.toFixed(1)}s</strong></span>
                      {state.effectiveSpeed && (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                          {state.effectiveSpeed.toFixed(2)}x
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Synthesize Button */}
              <Button
                onClick={synthesizeSpeech}
                disabled={!state.translation || state.isSynthesizing}
                className="w-full bg-blue-600 hover:bg-blue-500"
              >
                {state.isSynthesizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('voiceTranslator.generatingAudio')}
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    {t('voiceTranslator.generateAudio')}
                  </>
                )}
              </Button>

              {/* Synthesized Audio Preview */}
              {state.synthesizedAudioUrl && (
                <div className="space-y-2">
                  <audio
                    ref={synthesizedAudioRef}
                    src={state.synthesizedAudioUrl}
                    controls
                    className="w-full h-10"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = state.synthesizedAudioUrl!;
                      a.download = 'translated_audio.mp3';
                      a.click();
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t('voiceTranslator.downloadAudio')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pipeline Button */}
      {state.audioBlob && !state.isRecording && (
        <Button
          onClick={runFullPipeline}
          disabled={state.isTranscribing || state.isTranslating || state.isSynthesizing}
          size="lg"
          className="w-full bg-blue-600 hover:bg-blue-500"
        >
          <Wand2 className="h-5 w-5 mr-2" />
          {t('voiceTranslator.runFullPipeline')}
        </Button>
      )}
    </div>
  );
}



