'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Search, CheckCircle, XCircle, AlertTriangle, Loader2, BarChart3, Gamepad2 } from 'lucide-react';

interface DryRunGameResult {
  title: string;
  install_path: string;
  engine_detected: string;
  fast_path: string;
  strings_found: number;
  files_found: number;
  ready_to_translate: boolean;
  error: string | null;
  scan_duration_ms: number;
}

interface DryRunReport {
  total_games: number;
  scanned: number;
  ready: number;
  unsupported: number;
  errors: number;
  by_engine: Record<string, number>;
  games: DryRunGameResult[];
  duration_seconds: number;
}

interface DryRunProgress {
  current: number;
  total: number;
  message: string;
  game?: string;
  done?: boolean;
}

const ENGINE_COLORS: Record<string, string> = {
  tyranoscript: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  gamemaker: 'bg-green-500/20 text-green-300 border-green-500/30',
  rpgmaker: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  visionaire: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  unreal: 'bg-red-500/20 text-red-300 border-red-500/30',
  generic: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  unsupported: 'bg-zinc-700/30 text-zinc-500 border-zinc-600/30',
};

const ENGINE_LABELS: Record<string, string> = {
  tyranoscript: 'TyranoScript',
  gamemaker: 'GameMaker',
  rpgmaker: 'RPG Maker',
  visionaire: 'Visionaire',
  unreal: 'Unreal',
  generic: 'Generico',
  unsupported: 'N/D',
};

export default function DryRunScanner() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DryRunProgress | null>(null);
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'ready' | 'errors' | 'unsupported'>('all');

  // Listen for dryrun-progress events
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setup = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<DryRunProgress>('dryrun-progress', (event) => {
          setProgress(event.payload);
        });
      } catch { /* non-Tauri env */ }
    };
    setup();
    return () => { if (unlisten) unlisten(); };
  }, []);

  const startScan = useCallback(async () => {
    setRunning(true);
    setReport(null);
    setProgress({ current: 0, total: 0, message: 'Avvio scansione...' });
    toast.info('🔍 Dry Run: scansione di tutti i giochi installati...');

    try {
      const result = await invoke('dry_run_scan_all_games') as DryRunReport;
      setReport(result);
      toast.success(`✅ Scansione completata: ${result.ready}/${result.scanned} giochi pronti`);
    } catch (err: unknown) {
      toast.error(`❌ Errore: ${err instanceof Error ? err.message : 'Scansione fallita'}`);
    } finally {
      setRunning(false);
    }
  }, []);

  const filtered = report?.games?.filter(g => {
    if (filter === 'ready') return g.ready_to_translate;
    if (filter === 'errors') return !!g.error;
    if (filter === 'unsupported') return g.fast_path === 'unsupported';
    return true;
  }) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Dry Run — Scansione Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verifica automatica detect + extract su tutti i giochi installati (senza tradurre)
          </p>
        </div>
        <Button
          onClick={startScan}
          disabled={running}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg"
        >
          {running ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scansione...</>
          ) : (
            <><Search className="w-4 h-4 mr-2" /> Scan All Games</>
          )}
        </Button>
      </div>

      {/* Progress bar */}
      {running && progress && (
        <Card className="bg-slate-900/60 border-indigo-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-indigo-300 font-mono">{progress.message}</span>
              <span className="text-xs text-slate-500">{progress.current}/{progress.total}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total * 100) : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Summary */}
      {report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <SummaryCard label="Scansionati" value={report.scanned} icon={<Gamepad2 className="w-4 h-4" />} color="text-white" />
            <SummaryCard label="Pronti" value={report.ready} icon={<CheckCircle className="w-4 h-4" />} color="text-green-400" />
            <SummaryCard label="Errori" value={report.errors} icon={<XCircle className="w-4 h-4" />} color="text-red-400" />
            <SummaryCard label="Non supportati" value={report.unsupported} icon={<AlertTriangle className="w-4 h-4" />} color="text-zinc-400" />
            <SummaryCard label="Tempo" value={`${report.duration_seconds.toFixed(0)}s`} icon={<BarChart3 className="w-4 h-4" />} color="text-indigo-400" />
          </div>

          {/* Engine breakdown */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(report.by_engine).sort((a, b) => b[1] - a[1]).map(([engine, count]) => (
              <span key={engine} className={`text-2xs px-2 py-0.5 rounded-full border font-mono ${ENGINE_COLORS[engine] || 'bg-slate-700/30 text-slate-400 border-slate-600/30'}`}>
                {ENGINE_LABELS[engine] || engine}: {count}
              </span>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 border-b border-slate-800 pb-1">
            {(['all', 'ready', 'errors', 'unsupported'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-2xs px-3 py-1 rounded-t-lg font-medium transition-colors ${
                  filter === f ? 'bg-indigo-600/20 text-indigo-300 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f === 'all' ? `Tutti (${report.games.length})` :
                 f === 'ready' ? `Pronti (${report.ready})` :
                 f === 'errors' ? `Errori (${report.errors})` :
                 `N/D (${report.unsupported})`}
              </button>
            ))}
          </div>

          {/* Games table */}
          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-800/50">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-900/80 sticky top-0">
                <tr className="text-slate-500 uppercase tracking-wider">
                  <th className="text-left p-2">Gioco</th>
                  <th className="text-left p-2">Engine</th>
                  <th className="text-left p-2">Fast Path</th>
                  <th className="text-right p-2">Stringhe</th>
                  <th className="text-right p-2">File</th>
                  <th className="text-right p-2">ms</th>
                  <th className="text-center p-2">Stato</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g, i) => (
                  <tr key={i} className={`border-t border-slate-800/30 hover:bg-white/[0.02] ${g.error ? 'bg-red-500/[0.03]' : ''}`}>
                    <td className="p-2 text-slate-200 font-medium truncate max-w-[200px]" title={g.title}>{g.title}</td>
                    <td className="p-2 text-slate-400">{g.engine_detected}</td>
                    <td className="p-2">
                      <span className={`text-micro px-1.5 py-0.5 rounded border ${ENGINE_COLORS[g.fast_path] || 'bg-slate-700/30 text-slate-400 border-slate-600/30'}`}>
                        {ENGINE_LABELS[g.fast_path] || g.fast_path}
                      </span>
                    </td>
                    <td className="p-2 text-right font-mono text-slate-300">{g.strings_found > 0 ? g.strings_found.toLocaleString() : '-'}</td>
                    <td className="p-2 text-right font-mono text-slate-400">{g.files_found || '-'}</td>
                    <td className="p-2 text-right font-mono text-slate-500">{g.scan_duration_ms}</td>
                    <td className="p-2 text-center">
                      {g.error ? (
                        <span className="text-red-400" title={g.error}>❌</span>
                      ) : g.ready_to_translate ? (
                        <span className="text-green-400">✅</span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800/50">
      <CardContent className="p-3 flex items-center gap-2">
        <span className={color}>{icon}</span>
        <div>
          <div className={`text-lg font-bold ${color}`}>{value}</div>
          <div className="text-micro text-slate-500 uppercase tracking-wider">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
