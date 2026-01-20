'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Volume2,
  Languages,
  Wand2,
  Download,
  Upload,
  StopCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileAudio
} from 'lucide-react';

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
  { id: 'shimmer', name: 'Shimmer', description: 'Female, bright' }
];

export function VoiceTranslator() {
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

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setState(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
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

    } catch (error) {
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const audioUrl = URL.createObjectURL(file);
    setState(prev => ({
      ...prev,
      audioBlob: file,
      audioUrl,
      error: null
    }));
  };

  const transcribeAudio = async () => {
    if (!state.audioBlob) return;

    setState(prev => ({ ...prev, isTranscribing: true, step: 'transcribing', error: null }));

    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(state.audioBlob);
      const audioData = await base64Promise;

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData,
          audioFormat: 'webm',
          language: state.sourceLanguage,
          provider: 'openai'
        })
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        transcription: data.text,
        transcriptionSegments: data.segments || [],
        sourceLanguage: data.language || prev.sourceLanguage,
        isTranscribing: false,
        step: 'idle'
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isTranscribing: false,
        step: 'idle',
        error: 'Transcription error. Check your OpenAI API key.'
      }));
    }
  };

  const translateText = async () => {
    if (!state.transcription) return;

    setState(prev => ({ ...prev, isTranslating: true, step: 'translating', error: null }));

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: state.transcription,
          targetLanguage: state.targetLanguage,
          sourceLanguage: state.sourceLanguage === 'auto' ? 'en' : state.sourceLanguage,
          provider: 'openai'
        })
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        translation: data.translatedText,
        isTranslating: false,
        step: 'idle'
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isTranslating: false,
        step: 'idle',
        error: 'Translation error.'
      }));
    }
  };

  const synthesizeSpeech = async () => {
    if (!state.translation) return;

    setState(prev => ({ ...prev, isSynthesizing: true, step: 'synthesizing', error: null }));

    try {
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: state.translation,
          voice: state.selectedVoice,
          speed: state.speechSpeed,
          language: state.targetLanguage,
          provider: 'openai'
        })
      });

      if (!response.ok) {
        throw new Error('TTS failed');
      }

      const data = await response.json();
      
      // Convert base64 to audio URL
      const audioData = atob(data.audioData);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      const audioBlob = new Blob([audioArray], { type: 'audio/mp3' });
      const synthesizedAudioUrl = URL.createObjectURL(audioBlob);

      setState(prev => ({
        ...prev,
        synthesizedAudioUrl,
        isSynthesizing: false,
        step: 'done'
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isSynthesizing: false,
        step: 'idle',
        error: 'Speech synthesis error.'
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
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-black/20 backdrop-blur-sm shadow-lg">
              <Volume2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">Voice Translator</h2>
              <p className="text-white/90 text-[10px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">Audio → Transcription → Translation → TTS</p>
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
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Record or Upload Audio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Recording Controls */}
              <div className="flex items-center gap-3">
                <Button
                  size="lg"
                  variant={state.isRecording ? 'destructive' : 'default'}
                  className={state.isRecording ? '' : 'bg-amber-500 hover:bg-amber-600'}
                  onClick={state.isRecording ? stopRecording : startRecording}
                >
                  {state.isRecording ? (
                    <>
                      <StopCircle className="h-5 w-5 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5 mr-2" />
                      Record
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
                      Upload File
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
                <span className="text-sm text-muted-foreground">Audio language:</span>
                <Select
                  value={state.sourceLanguage}
                  onValueChange={(v) => setState(prev => ({ ...prev, sourceLanguage: v }))}
                >
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transcribe Button */}
              <Button
                onClick={transcribeAudio}
                disabled={!state.audioBlob || state.isTranscribing}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700"
              >
                {state.isTranscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Transcribe with Whisper
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Transcription Result */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileAudio className="h-4 w-4" />
                Transcription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={state.transcription}
                onChange={(e) => setState(prev => ({ ...prev, transcription: e.target.value }))}
                placeholder="Transcription will appear here..."
                className="min-h-[60px] text-sm resize-none"
              />
            </CardContent>
          </Card>
        </div>

        {/* Step 2: Translation & TTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Translation Section */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Languages className="h-4 w-4" />
                Translation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Target Language */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Translate to:</span>
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
                >
                  {state.isTranslating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Translate
                    </>
                  )}
                </Button>
              </div>

              <Textarea
                value={state.translation}
                onChange={(e) => setState(prev => ({ ...prev, translation: e.target.value }))}
                placeholder="Translation will appear here..."
                className="min-h-[60px] text-sm resize-none"
              />
            </CardContent>
          </Card>

          {/* TTS Section */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Text-to-Speech (TTS)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Voice Selection */}
              <div className="grid grid-cols-3 gap-2">
                {TTS_VOICES.map(voice => (
                  <Button
                    key={voice.id}
                    variant={state.selectedVoice === voice.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setState(prev => ({ ...prev, selectedVoice: voice.id }))}
                    className="text-xs"
                  >
                    {voice.name}
                  </Button>
                ))}
              </div>

              {/* Speed Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Speed</span>
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

              {/* Synthesize Button */}
              <Button
                onClick={synthesizeSpeech}
                disabled={!state.translation || state.isSynthesizing}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-600"
              >
                {state.isSynthesizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating audio...
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    Generate Audio
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
                    Download Audio
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
          className="w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500"
        >
          <Wand2 className="h-5 w-5 mr-2" />
          Run Full Pipeline (Transcribe → Translate → Generate Audio)
        </Button>
      )}
    </div>
  );
}
