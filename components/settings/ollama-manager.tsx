'use client';

// Card sottile: lifecycle Ollama (stato, download, avvio, arresto).
// La gestione dei modelli (pull, delete, speed test, A/B) vive SOLO nel
// Model Manager (/ollama-manager) — niente UI duplicata qui.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  Cpu,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';
import { ollamaArgs } from '@/lib/ai/ollama-endpoint';

interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version: string;
  models: string[];
  install_path: string;
}

interface DownloadProgress {
  stage: string;
  progress: number;
  message: string;
}

interface OllamaManagerProps {
  /** Indirizzo del server Ollama scelto dall'utente (impostazione condivisa). */
  ollamaUrl?: string;
  /** Chiamato a ogni modifica del campo indirizzo. */
  onOllamaUrlChange?: (url: string) => void;
}

export function OllamaManager({ ollamaUrl, onOllamaUrlChange }: OllamaManagerProps = {}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isTauri, setIsTauri] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const isTauriEnv = typeof window !== 'undefined' && ((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ || (window as unknown as Record<string, unknown>).__TAURI_IPC__);
      setIsTauri(!!isTauriEnv);

      // In Tauri il fetch diretto dal webview verso 127.0.0.1:11434 è bloccato da CORS:
      // l'origine del webview (tauri.localhost) non rientra fra le OLLAMA_ORIGINS di default,
      // quindi la fetch fallisce e Ollama appare "Non installato / Spento" pur essendo attivo.
      // Instradiamo la detection via comando Rust (reqwest/TCP + `where ollama`), che non ha CORS.
      if (isTauriEnv) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const s = await invoke<OllamaStatus>('check_ollama_status', ollamaArgs());
          setStatus({
            installed: s.installed,
            running: s.running,
            version: s.version || '',
            models: s.models || [],
            install_path: s.install_path || '',
          });
          return;
        } catch (e: unknown) {
          clientLogger.error('[OllamaManager] check_ollama_status invoke failed, fallback HTTP:', e);
          // prosegue col fallback HTTP diretto qui sotto
        }
      }

      // Browser / dev (o fallback): fetch HTTP diretto
      try {
        const resp = await fetch('http://127.0.0.1:11434/api/tags', {
          signal: AbortSignal.timeout(3000)
        });
        if (resp.ok) {
          const data = await resp.json();
          setStatus({
            installed: true,
            running: true,
            version: '',
            models: data.models?.map((m: { name: string }) => m.name) || [],
            install_path: '',
          });
        } else {
          setStatus({ installed: false, running: false, version: '', models: [], install_path: '' });
        }
      } catch {
        setStatus({ installed: false, running: false, version: '', models: [], install_path: '' });
      }
    } catch (error: unknown) {
      clientLogger.error('[OllamaManager] Check status error:', error);
      setStatus({ installed: false, running: false, version: '', models: [], install_path: '' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Progress del download dell'installer (evento Tauri)
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      if (typeof window !== 'undefined' && ((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ || (window as unknown as Record<string, unknown>).__TAURI_IPC__)) {
        try {
          const { listen } = await import('@tauri-apps/api/event');
          unlisten = await listen<DownloadProgress>('ollama-download-progress', (event) => {
            setDownloadProgress(event.payload);
          }) as unknown as () => void;
        } catch (e: unknown) {
          clientLogger.error('Failed to setup Tauri listener:', e);
        }
      }
    };

    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleDownload = async () => {
    if (!isTauri) {
      window.open('https://ollama.com/download', '_blank');
      return;
    }
    setActionLoading('download');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke<string>('download_ollama');
      toast.success(t('common.installerOllamaAvviato'));
    } catch (error: unknown) {
      toast.error(`${t('ollamaManagerComp.erroreDownload')}: ${error}`);
    } finally {
      setActionLoading(null);
      setDownloadProgress(null);
    }
  };

  const handleStart = async () => {
    setActionLoading('start');
    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<string>('start_ollama', ollamaArgs());
        toast.success(result);
      } else {
        toast.error(t('common.avviaOllamaManualmenteOllamaServe'));
      }
      await checkStatus();
    } catch (error: unknown) {
      toast.error(`${t('ollamaManagerComp.erroreAvvio')}: ${error}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    setActionLoading('stop');
    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<string>('stop_ollama', ollamaArgs());
        toast.success(result);
      }
      await checkStatus();
    } catch (error: unknown) {
      toast.error(`${t('ollamaManagerComp.erroreArresto')}: ${error}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">{t('ollamaManagerComp.verificaOllama')}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-orange-500" />
            <span>{t('ollamaManagerComp.ollamaAiLocale')}</span>
          </div>
          <div className="flex items-center gap-2">
            {status?.installed ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t('gameDetails.installed')}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                {t('gameDetails.notInstalled')}
              </Badge>
            )}
            {status?.running ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                <div className="h-2 w-2 rounded-full bg-green-500 mr-1 animate-pulse" />
                {t('ocrTranslator.active')}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/30 text-xs">
                <div className="h-2 w-2 rounded-full bg-zinc-500 mr-1" />
                {t('ollamaManagerComp.spento')}
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={checkStatus} aria-label={t('common.aggiorna')}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('ollamaManagerComp.descrizioneBreve')}
        </p>

        {/* Indirizzo del server: PRIMA stava nella card «LM Studio (locale)»,
            dove nessuno lo cercava — Davide stesso non lo trovava (14/08).
            L'indirizzo di Ollama vive nella card di Ollama. */}
        {onOllamaUrlChange && (
          <div className="space-y-2 pb-2 border-b border-border/40">
            <Label>{t('settingsPage.ollamaUrlLabel')}</Label>
            <Input
              value={ollamaUrl || ''}
              onChange={(e) => onOllamaUrlChange(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              className="font-mono text-xs"
            />
            <p className="text-2xs text-muted-foreground">{t('settingsPage.ollamaUrlHint')}</p>
          </div>
        )}

        {/* Azioni lifecycle + link Model Manager */}
        <div className="flex flex-wrap items-center gap-2">
          {!status?.installed && (
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={actionLoading === 'download'}
              className="bg-orange-600 hover:bg-orange-500"
            >
              {actionLoading === 'download' ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t('ollamaManagerComp.scaricaOllama')}
            </Button>
          )}

          {status?.installed && !status?.running && (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={actionLoading === 'start'}
              className="bg-green-600 hover:bg-green-500"
            >
              {actionLoading === 'start' ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t('common.avviaOllama')}
            </Button>
          )}

          {status?.running && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleStop}
              disabled={actionLoading === 'stop'}
            >
              {actionLoading === 'stop' ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t('ollamaManagerComp.arresta')}
            </Button>
          )}

          <Link href="/ollama-manager" className="ml-auto">
            <Button size="sm" variant="outline" className="gap-1.5 border-orange-500/30 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10">
              <Cpu className="h-3.5 w-3.5" />
              {t('ollamaManagerComp.gestisciModelli')}
              {status?.running && (
                <Badge variant="secondary" className="text-2xs px-1.5 py-0 font-mono">
                  {status.models.length}
                </Badge>
              )}
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* Download progress */}
        {downloadProgress && (
          <div className="space-y-1.5 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center justify-between text-xs">
              <span className="text-orange-400">{downloadProgress.message}</span>
              <span className="text-orange-300 font-mono">{downloadProgress.progress}%</span>
            </div>
            <Progress value={downloadProgress.progress} className="h-1.5" />
          </div>
        )}

        {/* Info versione */}
        {status?.installed && status.version && (
          <p className="text-2xs text-muted-foreground">
            {status.version} — {status.install_path}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
