'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Play, Pause, Square, Monitor, ScanSearch, Zap, Clock, Eye, EyeOff,
  Languages, Cpu, BarChart3, AlertCircle, CheckCircle, SkipForward
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';
import {
  liveTranslationEngine,
  type LiveTranslationConfig,
  type LiveTranslationEvent,
  type LiveTranslationStats,
} from '@/lib/live-translation-engine';
import { useGlobalHotkeys } from '@/hooks/use-global-hotkeys';

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'skip';
}

const PROVIDERS = [
  { id: 'groq', name: 'Groq', speed: '200ms', icon: Zap },
  { id: 'cerebras', name: 'Cerebras', speed: '150ms', icon: Zap },
  { id: 'deepseek', name: 'DeepSeek', speed: '300ms', icon: Cpu },
  { id: 'gemini', name: 'Gemini', speed: '500ms', icon: Cpu },
  { id: 'ollama', name: 'Ollama (Local)', speed: '500-2000ms', icon: Monitor },
];

const LANGUAGES = [
  { code: 'it', name: 'Italiano' }, { code: 'en', name: 'English' },
  { code: 'es', name: 'Espanol' }, { code: 'fr', name: 'Francais' },
  { code: 'de', name: 'Deutsch' }, { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' }, { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portugues' }, { code: 'ru', name: 'Russian' },
  { code: 'pl', name: 'Polski' },
];

const OCR_LANGUAGES = [
  { code: 'eng', name: 'English' }, { code: 'ita', name: 'Italiano' },
  { code: 'spa', name: 'Espanol' }, { code: 'fra', name: 'Francais' },
  { code: 'deu', name: 'Deutsch' }, { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' }, { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'rus', name: 'Russian' }, { code: 'por', name: 'Portugues' },
];

export default function LiveTranslatePage() {
  const { t } = useTranslation();

  // Config state
  const [targetLang, setTargetLang] = useState('it');
  const [sourceLang, setSourceLang] = useState('en');
  const [ocrLang, setOcrLang] = useState('eng');
  const [provider, setProvider] = useState('groq');
  const [intervalMs, setIntervalMs] = useState(2000);

  // Engine state
  const [stats, setStats] = useState<LiveTranslationStats>(liveTranslationEngine.getStats());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('it-IT', { hour12: false });
    setLogs(prev => {
      const updated = [...prev, { time, message, type }];
      return updated.slice(-100); // Keep last 100 entries
    });
  }, []);

  // Subscribe to engine events
  useEffect(() => {
    const unsubscribe = liveTranslationEngine.on((event: LiveTranslationEvent) => {
      switch (event.type) {
        case 'started':
          addLog('Live Translation avviato', 'success');
          break;
        case 'stopped':
          addLog('Live Translation fermato', 'warning');
          break;
        case 'paused':
          addLog('In pausa', 'warning');
          break;
        case 'resumed':
          addLog('Ripreso', 'success');
          break;
        case 'frame':
          if (event.texts.length > 0) {
            const preview = event.texts[0];
            addLog(
              `"${preview.original.substring(0, 40)}" -> "${preview.translated.substring(0, 40)}" (${Math.round(event.latencyMs)}ms)`,
              'success'
            );
          }
          break;
        case 'skipped':
          addLog(`Skip: ${event.reason}`, 'skip');
          break;
        case 'error':
          addLog(`Errore: ${event.message}`, 'error');
          break;
        case 'stats':
          setStats(event.stats);
          break;
      }
      // Always update stats
      setStats(liveTranslationEngine.getStats());
    });

    return unsubscribe;
  }, [addLog]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleStart = useCallback(() => {
    const config: Partial<LiveTranslationConfig> = {
      targetLanguage: targetLang,
      sourceLanguage: sourceLang,
      ocrLanguage: ocrLang as 'eng',
      provider,
      captureIntervalMs: intervalMs,
    };
    liveTranslationEngine.start(config);
  }, [targetLang, sourceLang, ocrLang, provider, intervalMs]);

  const handleStop = useCallback(() => {
    liveTranslationEngine.stop();
  }, []);

  const handlePauseResume = useCallback(() => {
    if (stats.isPaused) {
      liveTranslationEngine.resume();
    } else {
      liveTranslationEngine.pause();
    }
  }, [stats.isPaused]);

  const isRunning = stats.isRunning;

  // Global hotkey: Ctrl+Alt+O toggles live translation
  useGlobalHotkeys({
    toggle_overlay: () => {
      liveTranslationEngine.toggle();
    },
    ocr_capture: () => {
      if (!isRunning) handleStart();
    },
  });

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
          <h1 className="text-2xl font-bold">Live Translation</h1>
          <Badge variant={isRunning ? 'default' : 'secondary'} className={isRunning ? 'bg-green-600' : ''}>
            {isRunning ? (stats.isPaused ? 'PAUSED' : 'ACTIVE') : 'IDLE'}
          </Badge>
        </div>

        {/* Control buttons */}
        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={handleStart} className="bg-green-600 hover:bg-green-700 gap-2">
              <Play className="h-4 w-4" /> Start
            </Button>
          ) : (
            <>
              <Button onClick={handlePauseResume} variant="outline" className="gap-2">
                {stats.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {stats.isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button onClick={handleStop} variant="destructive" className="gap-2">
                <Square className="h-4 w-4" /> Stop
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Languages className="h-4 w-4" /> Configurazione
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Source language (OCR) */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Lingua sorgente (OCR)</label>
                <Select value={ocrLang} onValueChange={setOcrLang} disabled={isRunning}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OCR_LANGUAGES.map(l => (
                      <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target language */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Lingua target</label>
                <Select value={targetLang} onValueChange={setTargetLang} disabled={isRunning}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => (
                      <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Provider */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Provider AI</label>
                <Select value={provider} onValueChange={setProvider} disabled={isRunning}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <Zap className="h-3 w-3 text-yellow-500" />
                          {p.name} <span className="text-xs text-muted-foreground">({p.speed})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Capture interval */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Intervallo cattura: <span className="font-mono text-foreground">{(intervalMs / 1000).toFixed(1)}s</span>
                </label>
                <Slider
                  value={[intervalMs]}
                  onValueChange={([v]) => setIntervalMs(v)}
                  min={500}
                  max={5000}
                  step={250}
                  disabled={isRunning}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.5s (veloce)</span>
                  <span>5s (leggero)</span>
                </div>
              </div>

              {/* Capture mode */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Modalita cattura</label>
                <Select defaultValue="fullscreen" disabled={isRunning}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fullscreen">
                      <span className="flex items-center gap-2"><Monitor className="h-3 w-3" /> Fullscreen</span>
                    </SelectItem>
                    <SelectItem value="region">
                      <span className="flex items-center gap-2"><ScanSearch className="h-3 w-3" /> Regione</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Stats + Log */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-zinc-900/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-cyan-400">{stats.captures}</div>
                <div className="text-xs text-muted-foreground">Catture</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.translations}</div>
                <div className="text-xs text-muted-foreground">Traduzioni</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">{stats.skipped}</div>
                <div className="text-xs text-muted-foreground">Skip (diff)</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {stats.avgLatencyMs > 0 ? `${(stats.avgLatencyMs / 1000).toFixed(1)}s` : '--'}
                </div>
                <div className="text-xs text-muted-foreground">Latenza media</div>
              </CardContent>
            </Card>
          </div>

          {/* Last translation preview */}
          {stats.lastText && (
            <Card className="bg-zinc-900/50 border-cyan-800/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Eye className="h-4 w-4 mt-1 text-cyan-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{stats.lastText}</p>
                    <p className="text-sm font-medium text-cyan-300 truncate mt-1">{stats.lastTranslation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live log */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Log in tempo reale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Premi Start per avviare la traduzione live
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                      <span className="text-zinc-500 shrink-0">[{log.time}]</span>
                      {log.type === 'success' && <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />}
                      {log.type === 'error' && <AlertCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />}
                      {log.type === 'warning' && <AlertCircle className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />}
                      {log.type === 'skip' && <SkipForward className="h-3 w-3 text-zinc-500 mt-0.5 shrink-0" />}
                      {log.type === 'info' && <Clock className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />}
                      <span className={
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'success' ? 'text-green-400' :
                        log.type === 'skip' ? 'text-zinc-500' :
                        log.type === 'warning' ? 'text-yellow-400' :
                        'text-zinc-300'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
