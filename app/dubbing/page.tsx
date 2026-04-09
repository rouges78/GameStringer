'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Mic, Play, Pause, Square, Volume2, Languages, Cpu, Film,
  CheckCircle, AlertCircle, Loader2, FolderOpen, FileAudio,
  Subtitles, Smile, BarChart3, Clock
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';
import { DubbingPipeline, type DubbingConfig, type DubbingProgress, type DubbingResult } from '@/lib/dubbing-pipeline';
import { clientLogger } from '@/lib/client-logger';

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'it', name: 'Italiano' },
  { code: 'es', name: 'Espanol' }, { code: 'fr', name: 'Francais' },
  { code: 'de', name: 'Deutsch' }, { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' }, { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portugues' }, { code: 'ru', name: 'Russian' },
];

const VOICES = [
  { id: 'alloy', name: 'Alloy', desc: 'Neutro' },
  { id: 'echo', name: 'Echo', desc: 'Maschile profondo' },
  { id: 'fable', name: 'Fable', desc: 'Narratore' },
  { id: 'onyx', name: 'Onyx', desc: 'Maschile autorevole' },
  { id: 'nova', name: 'Nova', desc: 'Femminile energico' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Femminile caldo' },
];

export default function DubbingPage() {
  const { t } = useTranslation();

  // Config
  const [gamePath, setGamePath] = useState('');
  const [gameName, setGameName] = useState('');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('it');
  const [ttsProvider, setTtsProvider] = useState<'openai' | 'elevenlabs'>('openai');
  const [sttProvider, setSttProvider] = useState<'openai_whisper' | 'groq_whisper'>('openai_whisper');
  const [defaultVoice, setDefaultVoice] = useState('alloy');
  const [enableLipSync, setEnableLipSync] = useState(false);
  const [enableSubtitles, setEnableSubtitles] = useState(true);
  const [subtitleFormat, setSubtitleFormat] = useState<'srt' | 'vtt' | 'ass'>('srt');
  const [durationMatching, setDurationMatching] = useState(true);

  // Pipeline state
  const [progress, setProgress] = useState<DubbingProgress | null>(null);
  const [result, setResult] = useState<DubbingResult | null>(null);
  const pipelineRef = useRef<DubbingPipeline | null>(null);

  const isRunning = progress?.isRunning || false;

  const selectGameFolder = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({ directory: true, title: 'Seleziona cartella gioco' });
      if (path) {
        setGamePath(path as string);
        const name = (path as string).split(/[/\\]/).pop() || 'Game';
        setGameName(name);
      }
    } catch (err: unknown) {
      clientLogger.error('Folder selection failed:', err);
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!gamePath) {
      toast.error('Seleziona la cartella del gioco');
      return;
    }

    const config: DubbingConfig = {
      gamePath,
      gameName,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      ttsProvider,
      sttProvider,
      defaultVoice,
      enableLipSync,
      enableSubtitles,
      subtitleFormat,
      durationMatching,
      batchSize: 5,
    };

    const pipeline = new DubbingPipeline(config);
    pipelineRef.current = pipeline;

    toast.info('AI Dubbing avviato...');
    const dubbingResult = await pipeline.run(setProgress);
    setResult(dubbingResult);
    pipelineRef.current = null;

    if (dubbingResult.success) {
      toast.success(`Dubbing completato! ${dubbingResult.stats.patched} file audio patchati`);
    } else {
      toast.error(`Dubbing completato con ${dubbingResult.stats.errors} errori`);
    }
  }, [gamePath, gameName, sourceLang, targetLang, ttsProvider, sttProvider, defaultVoice, enableLipSync, enableSubtitles, subtitleFormat, durationMatching]);

  const handlePause = () => pipelineRef.current?.pause();
  const handleResume = () => pipelineRef.current?.resume();
  const handleAbort = () => { pipelineRef.current?.abort(); toast.warning('Dubbing annullato'); };

  const currentStep = progress?.steps.find(s => s.status === 'running');
  const overallProgress = progress ? Math.round(
    (progress.steps.filter(s => s.status === 'completed').length / progress.steps.length) * 100
  ) : 0;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mic className="h-6 w-6 text-purple-400" />
          <h1 className="text-2xl font-bold">AI Dubbing Pipeline</h1>
          <Badge variant="outline" className="text-purple-400 border-purple-400/50">Beta</Badge>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={handleStart} className="bg-purple-600 hover:bg-purple-700 gap-2" disabled={!gamePath}>
              <Play className="h-4 w-4" /> Avvia Dubbing
            </Button>
          ) : (
            <>
              <Button onClick={progress?.isPaused ? handleResume : handlePause} variant="outline" className="gap-2">
                {progress?.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {progress?.isPaused ? 'Riprendi' : 'Pausa'}
              </Button>
              <Button onClick={handleAbort} variant="destructive" className="gap-2">
                <Square className="h-4 w-4" /> Annulla
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Config */}
        <div className="space-y-4">
          {/* Game selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> Gioco
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={selectGameFolder} variant="outline" className="w-full gap-2" disabled={isRunning}>
                <FolderOpen className="h-4 w-4" />
                {gamePath ? gameName : 'Seleziona cartella gioco'}
              </Button>
              {gamePath && <p className="text-xs text-muted-foreground truncate">{gamePath}</p>}
            </CardContent>
          </Card>

          {/* Languages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Languages className="h-4 w-4" /> Lingue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Lingua sorgente</label>
                <Select value={sourceLang} onValueChange={setSourceLang} disabled={isRunning}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Lingua target</label>
                <Select value={targetLang} onValueChange={setTargetLang} disabled={isRunning}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Voice & Providers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Volume2 className="h-4 w-4" /> Voce & Provider
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Voce default</label>
                <Select value={defaultVoice} onValueChange={setDefaultVoice} disabled={isRunning}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICES.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name} — {v.desc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">STT Engine</label>
                <Select value={sttProvider} onValueChange={(v) => setSttProvider(v as typeof sttProvider)} disabled={isRunning}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai_whisper">OpenAI Whisper</SelectItem>
                    <SelectItem value="groq_whisper">Groq Whisper (veloce)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <label className="text-xs">Duration matching</label>
                <Switch checked={durationMatching} onCheckedChange={setDurationMatching} disabled={isRunning} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs">Lip Sync (Rhubarb)</label>
                <Switch checked={enableLipSync} onCheckedChange={setEnableLipSync} disabled={isRunning} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs">Genera sottotitoli</label>
                <Switch checked={enableSubtitles} onCheckedChange={setEnableSubtitles} disabled={isRunning} />
              </div>
              {enableSubtitles && (
                <Select value={subtitleFormat} onValueChange={(v) => setSubtitleFormat(v as typeof subtitleFormat)} disabled={isRunning}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="srt">SRT</SelectItem>
                    <SelectItem value="vtt">WebVTT</SelectItem>
                    <SelectItem value="ass">ASS/SSA</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Pipeline progress */}
        <div className="lg:col-span-2 space-y-4">
          {/* Overall progress */}
          {progress && (
            <Card className="bg-zinc-900/50 border-purple-800/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {currentStep ? currentStep.name : 'Completato'}
                  </span>
                  <span className="text-sm text-muted-foreground">{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Pipeline steps */}
          {progress && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Pipeline Steps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {progress.steps.map((step) => (
                    <div key={step.id} className="flex items-center gap-3 py-1.5">
                      {step.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                      {step.status === 'running' && <Loader2 className="h-4 w-4 text-purple-400 animate-spin shrink-0" />}
                      {step.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      {step.status === 'pending' && <div className="h-4 w-4 rounded-full border border-zinc-600 shrink-0" />}
                      {step.status === 'skipped' && <div className="h-4 w-4 rounded-full bg-zinc-700 shrink-0" />}

                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${step.status === 'running' ? 'text-purple-300 font-medium' : step.status === 'completed' ? 'text-green-400' : 'text-muted-foreground'}`}>
                          {step.name}
                        </span>
                      </div>

                      {step.status === 'running' && (
                        <span className="text-xs text-muted-foreground">{step.progress}%</span>
                      )}
                      {step.durationMs && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {(step.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      {step.result && step.status === 'completed' && (
                        <Badge variant="secondary" className="text-xs">{step.result}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          {progress && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-zinc-900/50">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">{progress.stats.totalAudioFiles}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><FileAudio className="h-3 w-3" /> Audio files</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/50">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{progress.stats.patched}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><CheckCircle className="h-3 w-3" /> Patchati</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/50">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-red-400">{progress.stats.errors}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><AlertCircle className="h-3 w-3" /> Errori</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/50">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {progress.stats.avgTranscriptionConfidence > 0 ? `${Math.round(progress.stats.avgTranscriptionConfidence * 100)}%` : '--'}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Mic className="h-3 w-3" /> Confidenza</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Segments list */}
          {progress && progress.segments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Segmenti audio ({progress.completedSegments}/{progress.totalSegments})</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-1">
                    {progress.segments.slice(0, 50).map((seg) => (
                      <div key={seg.id} className="flex items-center gap-2 py-1 text-xs">
                        {seg.status === 'complete' && <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />}
                        {seg.status === 'error' && <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />}
                        {['transcribing', 'translating', 'synthesizing', 'patching'].includes(seg.status) && <Loader2 className="h-3 w-3 text-purple-400 animate-spin shrink-0" />}
                        {seg.status === 'pending' && <div className="h-3 w-3 rounded-full border border-zinc-700 shrink-0" />}
                        <span className="text-muted-foreground truncate flex-1">{seg.fileName}</span>
                        {seg.originalText && <span className="text-zinc-500 truncate max-w-[150px]">{seg.originalText.substring(0, 30)}</span>}
                        {seg.translatedText && <span className="text-cyan-400 truncate max-w-[150px]">{seg.translatedText.substring(0, 30)}</span>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!progress && (
            <Card className="bg-zinc-900/30 border-dashed border-zinc-700">
              <CardContent className="p-12 text-center">
                <Mic className="h-12 w-12 text-purple-400/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">AI Dubbing Pipeline</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Seleziona una cartella gioco per avviare il dubbing automatico.
                  Il pipeline eseguira: scansione audio → trascrizione Whisper →
                  traduzione AI → sintesi vocale → patching file audio.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
