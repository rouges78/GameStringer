'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Crosshair,
  Search,
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { useTranslation } from '@/lib/i18n';

interface HookCandidate {
  address: string;
  module_name: string;
  text_preview: string;
  confidence: number;
  hook_type: string;
}

interface HookScanResult {
  candidates: HookCandidate[];
  scan_duration_ms: number;
  process_name: string;
  process_id: number;
}

export function AutoHookScanner() {
  const { t } = useTranslation();
  const [processId, setProcessId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [result, setResult] = useState<HookScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const handleScan = async () => {
    if (!processId || !searchText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await invoke('scan_for_text_hooks', {
        processId: parseInt(processId),
        searchText: searchText.trim(),
      }) as HookScanResult;
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore durante la scansione');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  return (
    <Card className="border-rose-500/20 bg-rose-950/20 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-rose-400" />
          <CardTitle className="text-base">{t('autoHookScannerComp.autohookScanner')}</CardTitle>
          <Badge variant="outline" className="text-micro px-1.5 border-rose-500/20 text-rose-400">
            Click-to-Hook
          </Badge>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Scansiona la memoria del gioco per trovare automaticamente gli hook point. 
          Niente più reverse engineering manuale — clicca sul testo e agganciati.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-2xs text-slate-500 mb-1 block">{t('autoHookScannerComp.processIdPid')}</label>
            <Input
              value={processId}
              onChange={e => setProcessId(e.target.value.replace(/\D/g, ''))}
              placeholder="es. 12345"
              className="h-8 text-xs bg-rose-950/30 border-rose-500/20"
            />
          </div>
          <div>
            <label className="text-2xs text-slate-500 mb-1 block">{t('autoHookScannerComp.testoDaCercare')}</label>
            <Input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="es. Health Potion"
              className="h-8 text-xs bg-rose-950/30 border-rose-500/20"
              onKeyDown={e => e.key === 'Enter' && handleScan()}
            />
          </div>
        </div>

        <Button
          onClick={handleScan}
          disabled={loading || !processId || !searchText.trim()}
          className="w-full h-8 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300"
          size="sm"
        >
          {loading ? (
            <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Scansione memoria...</>
          ) : (
            <><Search className="h-3 w-3 mr-1" /> Scansiona</>
          )}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-300">{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {result.candidates.length} risultati in {result.scan_duration_ms}ms
              </span>
              <Badge variant="outline" className="text-micro">
                {result.process_name}
              </Badge>
            </div>

            {result.candidates.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500">
                Nessun hook trovato. Prova con un testo diverso visibile a schermo.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {result.candidates.map((c, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/10 hover:border-rose-500/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <code className="text-2xs text-rose-300 font-mono bg-rose-500/10 px-1.5 py-0.5 rounded">
                          {c.address}
                        </code>
                        <Badge className={`text-2xs px-1 py-0 h-3.5 ${
                          c.hook_type === 'UTF-16LE' ? 'bg-violet-500/20 text-violet-300' : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {c.hook_type}
                        </Badge>
                        <span className="text-micro text-slate-500">{c.module_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`h-1.5 w-6 rounded-full overflow-hidden bg-slate-700`}>
                          <div 
                            className={`h-full ${c.confidence > 0.85 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${c.confidence * 100}%` }}
                          />
                        </div>
                        <button 
                          onClick={() => copyAddress(c.address)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedAddr === c.address ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3 text-slate-500 hover:text-white" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-2xs text-slate-400 truncate font-mono">
                      {c.text_preview}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-micro text-slate-600 flex items-center gap-1">
          <Zap className="h-3 w-3" />
          Suggerimento: Apri Task Manager, trova il PID del gioco, inserisci il testo visibile a schermo.
        </div>
      </CardContent>
    </Card>
  );
}

export default AutoHookScanner;
