'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@/lib/tauri-api';
import { useTranslation } from '@/lib/i18n';
import {
  Smile, AlertTriangle, CheckCircle2, Loader2, Download,
  Play, Pause, FileAudio, Info, BarChart3, Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  type LipSyncResult,
  type MouthCue,
  type VisemeShape,
  VISEME_DESCRIPTIONS,
  VISEME_COLORS,
  checkRhubarbAvailable,
  generateLipSync,
  exportLipSync,
  analyzeLipSync,
  getVisemeAtTime,
  convertToUnityAnimation,
  convertToUnrealFaceFX,
} from '@/lib/rhubarb-lipsync';

// ── Main Component ────────────────────────────────────────────────────

interface LipSyncPanelProps {
  /** Pre-fill audio path (e.g., from audio patcher) */
  audioPath?: string;
  /** Dialog text for better accuracy */
  dialogText?: string;
  /** Compact mode (for embedding in other components) */
  compact?: boolean;
}

export function LipSyncPanel({ audioPath: initialPath, dialogText: initialDialog, compact = false }: LipSyncPanelProps) {
  const { t } = useTranslation();

  // State
  const [rhubarbAvailable, setRhubarbAvailable] = useState<boolean | null>(null);
  const [audioPath, setAudioPath] = useState(initialPath || '');
  const [dialogText, setDialogText] = useState(initialDialog || '');
  const [recognizer, setRecognizer] = useState<'phonetic' | 'dataBased'>('phonetic');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<LipSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'xml' | 'tsv'>('json');
  const [exportEngine, setExportEngine] = useState<'raw' | 'unity' | 'unreal'>('raw');

  // Playback sync state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeViseme, setActiveViseme] = useState<MouthCue | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  // Check Rhubarb availability
  useEffect(() => {
    checkRhubarbAvailable().then(setRhubarbAvailable);
  }, []);

  // Update active viseme during playback
  useEffect(() => {
    if (!isPlaying || !result) return;

    const updateViseme = () => {
      if (audioRef.current) {
        const time = audioRef.current.currentTime;
        setCurrentTime(time);
        setActiveViseme(getVisemeAtTime(result, time));
      }
      animFrameRef.current = requestAnimationFrame(updateViseme);
    };
    animFrameRef.current = requestAnimationFrame(updateViseme);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, result]);

  // Generate lip sync
  const handleGenerate = useCallback(async () => {
    if (!audioPath.trim()) return;
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const lipSync = await generateLipSync({
        audioPath: audioPath.trim(),
        dialogText: dialogText.trim() || undefined,
        recognizer,
      });
      setResult(lipSync);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }, [audioPath, dialogText, recognizer]);

  // Export lip sync data
  const handleExport = useCallback(async () => {
    if (!result) return;

    try {
      const desktopPath = await invoke<string>('get_desktop_path');
      const baseName = audioPath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'lipsync';

      if (exportEngine === 'unity') {
        const unityData = convertToUnityAnimation(result);
        const outputPath = `${desktopPath}/${baseName}_unity_visemes.json`;
        await invoke('write_text_file', { path: outputPath, content: JSON.stringify(unityData, null, 2) });
        return;
      }

      if (exportEngine === 'unreal') {
        const unrealData = convertToUnrealFaceFX(result);
        const outputPath = `${desktopPath}/${baseName}_unreal_facefx.json`;
        await invoke('write_text_file', { path: outputPath, content: JSON.stringify(unrealData, null, 2) });
        return;
      }

      const ext = exportFormat === 'json' ? '.json' : exportFormat === 'xml' ? '.xml' : '.tsv';
      const outputPath = `${desktopPath}/${baseName}_lipsync${ext}`;
      await exportLipSync(result, outputPath, exportFormat);
    } catch (e: unknown) {
      setError(String(e));
    }
  }, [result, audioPath, exportFormat, exportEngine]);

  // Toggle playback
  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const stats = result ? analyzeLipSync(result) : null;

  return (
    <div className={`space-y-4 ${compact ? '' : 'p-6'}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/20 rounded-lg">
              <Smile className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Lip Sync (Rhubarb)</h2>
              <p className="text-xs text-zinc-500">Genera dati di lip-sync da audio per doppiaggio</p>
            </div>
          </div>
          <Badge className={rhubarbAvailable === true ? 'bg-emerald-500/20 text-emerald-400' : rhubarbAvailable === false ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-500/20 text-zinc-400'}>
            {rhubarbAvailable === true ? 'Rhubarb OK' : rhubarbAvailable === false ? 'Non installato' : 'Verifica...'}
          </Badge>
        </div>
      )}

      {/* Rhubarb not available warning */}
      {rhubarbAvailable === false && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Rhubarb Lip Sync non trovato</p>
            <p className="text-amber-300/70 text-xs mt-1">
              Scarica da <a href="https://github.com/DanielSWolf/rhubarb-lip-sync/releases" target="_blank" rel="noopener" className="underline">GitHub</a> e aggiungilo al PATH di sistema.
            </p>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-zinc-500 mb-1 block">File Audio (WAV, OGG, MP3)</Label>
          <Input
            value={audioPath}
            onChange={(e) => setAudioPath(e.target.value)}
            placeholder="Percorso del file audio..."
            className="bg-zinc-800/50 border-zinc-700"
          />
        </div>

        <div>
          <Label className="text-xs text-zinc-500 mb-1 block">Testo del dialogo (opzionale, migliora la precisione)</Label>
          <Textarea
            value={dialogText}
            onChange={(e) => setDialogText(e.target.value)}
            placeholder="Inserisci il testo parlato nel file audio..."
            className="bg-zinc-800/50 border-zinc-700 min-h-[60px]"
            rows={2}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label className="text-xs text-zinc-500 mb-1 block">Recognizer</Label>
            <Select value={recognizer} onValueChange={(v) => setRecognizer(v as 'phonetic' | 'dataBased')}>
              <SelectTrigger className="bg-zinc-800/50 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phonetic">Fonetico (veloce)</SelectItem>
                <SelectItem value="dataBased">Data-based (preciso)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !audioPath.trim() || rhubarbAvailable !== true}
            className="bg-pink-600 hover:bg-pink-500 mt-5"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Smile className="w-4 h-4 mr-2" />}
            {generating ? 'Generazione...' : 'Genera Lip Sync'}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && stats && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="text-[10px] text-zinc-500">Durata</div>
              <div className="text-sm font-bold text-white">{stats.duration.toFixed(2)}s</div>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="text-[10px] text-zinc-500">Cue</div>
              <div className="text-sm font-bold text-white">{stats.totalCues}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="text-[10px] text-zinc-500">Media cue</div>
              <div className="text-sm font-bold text-white">{(stats.avgCueDuration * 1000).toFixed(0)}ms</div>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="text-[10px] text-zinc-500">Parlato</div>
              <div className="text-sm font-bold text-emerald-400">{(stats.speechRatio * 100).toFixed(0)}%</div>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="text-[10px] text-zinc-500">Silenzio</div>
              <div className="text-sm font-bold text-zinc-400">{(stats.silenceRatio * 100).toFixed(0)}%</div>
            </div>
          </div>

          {/* Viseme Timeline Visualization */}
          <div className="bg-zinc-800/30 rounded-lg border border-zinc-700 p-3">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-pink-400" />
              <span className="text-xs font-medium text-zinc-400">Timeline Visemi</span>
              {/* Playback controls */}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={togglePlayback} className="h-6 w-6 p-0">
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </Button>
                <span className="text-[10px] text-zinc-500">{currentTime.toFixed(2)}s</span>
              </div>
            </div>

            {/* Timeline bars */}
            <div className="relative h-10 bg-zinc-900 rounded overflow-hidden">
              {result.mouthCues.map((cue, i) => {
                const left = (cue.start / result.duration) * 100;
                const width = ((cue.end - cue.start) / result.duration) * 100;
                const isActive = activeViseme && cue.start === activeViseme.start;

                return (
                  <div
                    key={i}
                    className={`absolute top-0 h-full transition-opacity ${isActive ? 'opacity-100 ring-1 ring-white/50' : 'opacity-70'}`}
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 0.3)}%`,
                      backgroundColor: VISEME_COLORS[cue.value as VisemeShape] || '#6b7280',
                    }}
                    title={`${cue.value}: ${cue.start.toFixed(2)}s - ${cue.end.toFixed(2)}s`}
                  />
                );
              })}
              {/* Playhead */}
              {isPlaying && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-white z-10"
                  style={{ left: `${(currentTime / result.duration) * 100}%` }}
                />
              )}
            </div>

            {/* Active viseme display */}
            <div className="flex items-center justify-center mt-3 gap-4">
              <div className="text-center">
                <div className="text-4xl font-mono font-bold" style={{ color: VISEME_COLORS[(activeViseme?.value as VisemeShape) || 'X'] }}>
                  {VISEME_DESCRIPTIONS[(activeViseme?.value as VisemeShape) || 'X']?.mouthShape || '·'}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {activeViseme ? `${activeViseme.value} — ${VISEME_DESCRIPTIONS[activeViseme.value as VisemeShape]?.description}` : 'Riposo'}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(Object.entries(VISEME_DESCRIPTIONS) as [VisemeShape, typeof VISEME_DESCRIPTIONS[VisemeShape]][]).map(([shape, info]) => (
                <Badge
                  key={shape}
                  variant="outline"
                  className="text-[9px] gap-1"
                  style={{ borderColor: VISEME_COLORS[shape], color: VISEME_COLORS[shape] }}
                >
                  <span className="font-mono font-bold">{shape}</span> {info.name}
                  {stats.visemeDistribution[shape] ? ` (${stats.visemeDistribution[shape]})` : ''}
                </Badge>
              ))}
            </div>
          </div>

          {/* Hidden audio element for playback sync */}
          {audioPath && (
            <audio
              ref={audioRef}
              src={`tauri://localhost/${audioPath}`}
              onEnded={() => { setIsPlaying(false); setCurrentTime(0); setActiveViseme(null); }}
              onError={() => {
                // Try file:// protocol as fallback
                if (audioRef.current) {
                  audioRef.current.src = `file://${audioPath}`;
                }
              }}
            />
          )}

          {/* Export Section */}
          <div className="bg-zinc-800/30 rounded-lg border border-zinc-700 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-pink-400" />
              <span className="text-xs font-medium text-zinc-400">Esporta Lip Sync</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-zinc-500 mb-1 block">Engine Target</Label>
                <Select value={exportEngine} onValueChange={(v) => setExportEngine(v as 'raw' | 'unity' | 'unreal')}>
                  <SelectTrigger className="bg-zinc-800/50 border-zinc-700 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">Raw (Rhubarb)</SelectItem>
                    <SelectItem value="unity">Unity (Blend Shapes)</SelectItem>
                    <SelectItem value="unreal">Unreal (FaceFX)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {exportEngine === 'raw' && (
                <div>
                  <Label className="text-[10px] text-zinc-500 mb-1 block">Formato</Label>
                  <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'json' | 'xml' | 'tsv')}>
                    <SelectTrigger className="bg-zinc-800/50 border-zinc-700 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="xml">XML</SelectItem>
                      <SelectItem value="tsv">TSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button onClick={handleExport} size="sm" className="w-full bg-pink-600 hover:bg-pink-500">
              <Download className="w-3.5 h-3.5 mr-2" />
              Esporta {exportEngine === 'unity' ? 'per Unity' : exportEngine === 'unreal' ? 'per Unreal' : exportFormat.toUpperCase()}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
