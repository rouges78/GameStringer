'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Terminal,
  Trash2,
  Download,
  Pause,
  Play,
  ChevronUp,
  Search,
  Copy,
  X
} from 'lucide-react';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  data?: unknown;
}

const LOG_COLORS: Record<LogLevel, string> = {
  info: 'text-blue-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
  debug: 'text-slate-400',
  success: 'text-emerald-400',
};

const LOG_BG: Record<LogLevel, string> = {
  info: 'border-blue-500/10',
  warn: 'border-amber-500/10 bg-amber-950/10',
  error: 'border-red-500/10 bg-red-950/10',
  debug: 'border-slate-500/10',
  success: 'border-emerald-500/10',
};

const LOG_BADGES: Record<LogLevel, string> = {
  info: 'bg-blue-500/20 text-blue-300',
  warn: 'bg-amber-500/20 text-amber-300',
  error: 'bg-red-500/20 text-red-300',
  debug: 'bg-slate-500/20 text-slate-300',
  success: 'bg-emerald-500/20 text-emerald-300',
};

// Singleton log store
class DebugLogStore {
  private logs: LogEntry[] = [];
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();
  private maxLogs = 500;

  add(level: LogLevel, source: string, message: string, data?: unknown) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      level,
      source,
      message,
      data,
    };
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    this.notify();
  }

  clear() {
    this.logs = [];
    this.notify();
  }

  getAll(): LogEntry[] {
    return [...this.logs];
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    const snapshot = this.getAll();
    this.listeners.forEach(fn => fn(snapshot));
  }
}

export const debugLog = new DebugLogStore();

// Intercept console.log/warn/error
if (typeof window !== 'undefined') {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    origLog.apply(console, args);
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    if (msg.startsWith('[') || msg.includes('Hook') || msg.includes('Translate') || msg.includes('OLLAMA') || msg.includes('fetch')) {
      debugLog.add('info', 'console', msg);
    }
  };
  console.warn = (...args: unknown[]) => {
    origWarn.apply(console, args);
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    debugLog.add('warn', 'console', msg);
  };
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    debugLog.add('error', 'console', msg);
  };
}

export function DebugConsole({ defaultExpanded = false }: { defaultExpanded?: boolean }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [paused, setPaused] = useState(false);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs(debugLog.getAll());
    if (!paused) {
      return debugLog.subscribe(setLogs);
    }
  }, [paused]);

  const filteredLogs = logs.filter(log => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !log.source.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const exportLogs = useCallback(() => {
    const text = filteredLogs.map(l => 
      `[${l.timestamp.toISOString()}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gamestringer-debug-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  const copyLog = useCallback((entry: LogEntry) => {
    navigator.clipboard.writeText(
      `[${entry.timestamp.toISOString()}] [${entry.level}] [${entry.source}] ${entry.message}`
    );
  }, []);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700/50 hover:border-slate-600 transition-all text-xs text-slate-400 hover:text-white backdrop-blur-sm shadow-lg"
      >
        <Terminal className="h-3.5 w-3.5" />
        Debug Console
        {logs.filter(l => l.level === 'error').length > 0 && (
          <Badge className="bg-red-500/20 text-red-300 text-micro px-1 py-0 h-4">
            {logs.filter(l => l.level === 'error').length}
          </Badge>
        )}
        <ChevronUp className="h-3 w-3" />
      </button>
    );
  }

  return (
    <Card className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-700/50 bg-slate-950/95 backdrop-blur-md shadow-2xl rounded-none max-h-[40vh]">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/30">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">Debug Console</span>
            <Badge variant="outline" className="text-micro px-1.5 py-0 h-4 border-slate-600">
              {filteredLogs.length} / {logs.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {/* Level filters */}
            {(['all', 'error', 'warn', 'info', 'success', 'debug'] as const).map(level => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={`text-micro px-1.5 py-0.5 rounded ${
                  filterLevel === level ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {level === 'all' ? 'ALL' : level.toUpperCase()}
              </button>
            ))}
            <div className="w-px h-4 bg-slate-700/50 mx-1" />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPaused(!paused)} title={paused ? 'Riprendi' : 'Pausa'}>
              {paused ? <Play className="h-3 w-3 text-emerald-400" /> : <Pause className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={exportLogs} title="Esporta log">
              <Download className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => debugLog.clear()} title="Pulisci">
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(false)} title="Chiudi">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-1 border-b border-slate-700/20">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Cerca" placeholder="Cerca nei log..."
              className="h-6 text-2xs pl-7 bg-slate-900/50 border-slate-700/30"
            />
          </div>
        </div>

        {/* Log entries */}
        <div ref={scrollRef} className="overflow-y-auto max-h-[30vh] font-mono">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              {logs.length === 0 ? 'Nessun log. Le azioni dell\'app appariranno qui.' : 'Nessun risultato per il filtro corrente.'}
            </div>
          ) : (
            filteredLogs.map(entry => (
              <div
                key={entry.id}
                className={`flex items-start gap-2 px-3 py-1 border-b ${LOG_BG[entry.level]} hover:bg-slate-800/30 group`}
              >
                <span className="text-micro text-slate-600 w-16 flex-shrink-0 pt-0.5">
                  {entry.timestamp.toLocaleTimeString('it-IT', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`text-micro px-1 py-0 rounded ${LOG_BADGES[entry.level]} flex-shrink-0 w-12 text-center`}>
                  {entry.level.toUpperCase()}
                </span>
                <span className="text-micro text-slate-500 flex-shrink-0 w-14 truncate">
                  {entry.source}
                </span>
                <span className={`text-2xs ${LOG_COLORS[entry.level]} flex-1 break-all`}>
                  {entry.message}
                </span>
                <button
                  onClick={() => copyLog(entry)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copia"
                >
                  <Copy className="h-3 w-3 text-slate-600 hover:text-slate-300" />
                </button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default DebugConsole;
