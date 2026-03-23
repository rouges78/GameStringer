'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  HardDrive
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';

interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version: string;
  models: string[];
  install_path: string;
}

interface OllamaModelInfo {
  name: string;
  size: string;
  description: string;
}

interface DownloadProgress {
  stage: string;
  progress: number;
  message: string;
}

interface PullProgress {
  model: string;
  status: string;
  progress: number;
  message: string;
}

export function OllamaManager() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [recommendedModels, setRecommendedModels] = useState<OllamaModelInfo[]>([]);
  const [isTauri, setIsTauri] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_IPC__)) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<OllamaStatus>('check_ollama_status');
        setStatus(result);
        setIsTauri(true);
      } else {
        // Browser fallback: check via fetch
        try {
          const resp = await fetch('http://localhost:11434/api/tags', { 
            signal: AbortSignal.timeout(3000) 
          });
          if (resp.ok) {
            const data = await resp.json();
            setStatus({
              installed: true,
              running: true,
              version: '',
              models: data.models?.map((m: any) => m.name) || [],
              install_path: '',
            });
          } else {
            setStatus({ installed: false, running: false, version: '', models: [], install_path: '' });
          }
        } catch {
          setStatus({ installed: false, running: false, version: '', models: [], install_path: '' });
        }
      }
    } catch (error) {
      console.error('[OllamaManager] Check status error:', error);
      setStatus({ installed: false, running: false, version: '', models: [], install_path: '' });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecommendedModels = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_IPC__)) {
        const { invoke } = await import('@tauri-apps/api/core');
        const models = await invoke<OllamaModelInfo[]>('get_recommended_ollama_models');
        setRecommendedModels(models);
      } else {
        setRecommendedModels([
          // Traduzione specializzata
          { name: 'huihui_ai/hy-mt1.5-abliterated:7b', size: '~4.5 GB', description: '⭐ Tencent HY-MT 1.5 7B — #1 WMT25, batte Google Translate in 30/31 lingue. Senza censura.' },
          { name: 'huihui_ai/hy-mt1.5-abliterated:1.8b', size: '~1.2 GB', description: 'Tencent HY-MT 1.5 1.8B — Ultra-leggera e velocissima. Ideale per batch massicci.' },
          { name: 'translategemma:12b', size: '~8.0 GB', description: 'Google TranslateGemma 12B — 55 lingue, qualità alta.' },
          { name: 'translategemma:2b', size: '~1.5 GB', description: 'Google TranslateGemma 2B — 55 lingue, veloce e leggero.' },
          // MoE ultra-veloci (Marzo 2026)
          { name: 'qwen3.5:35b-a3b', size: '~4.5 GB', description: '🚀 Qwen 3.5 35B-A3B (MoE) — 35B parametri, attiva solo 3B. Qualità top!' },
          { name: 'lfm2:24b', size: '~3.5 GB', description: '🚀 LFM2 24B-A2B (MoE) — Liquid AI, attiva solo 2B. Velocissimo su 8GB RAM!' },
          // Multilingue general purpose
          { name: 'glm4:8b', size: '~5.0 GB', description: '🆕 GLM-4.7 Flash 8B — Zhipu AI, tuttofare veloce.' },
          { name: 'qwen3:8b', size: '~5.2 GB', description: 'Alibaba Qwen3 8B — Top multilingue, eccellente su CJK e europee.' },
          { name: 'qwen3:4b', size: '~2.6 GB', description: 'Alibaba Qwen3 4B — Compatto, buon rapporto qualità/velocità.' },
          { name: 'gemma3:12b', size: '~8.1 GB', description: 'Google Gemma 3 12B — Prosa pulita, 128K context.' },
          { name: 'gemma3:4b', size: '~2.8 GB', description: 'Google Gemma 3 4B — Leggera, gira su 8GB RAM.' },
          // Reasoning
          { name: 'deepseek-r1:14b', size: '~9.0 GB', description: 'DeepSeek R1 14B — Chain-of-thought, ragionamento complesso.' },
          { name: 'deepseek-r1:7b', size: '~4.7 GB', description: 'DeepSeek R1 7B — Chain-of-thought leggero, gira su 8GB.' },
          { name: 'phi4:14b', size: '~8.5 GB', description: 'Microsoft Phi-4 14B — Miglior ragionamento per GB.' },
          { name: 'phi4-mini', size: '~2.4 GB', description: 'Microsoft Phi-4 Mini 3.8B — Ultra-leggero.' },
          // Grandi
          { name: 'llama3.3:8b', size: '~5.0 GB', description: 'Meta Llama 3.3 8B — Miglior all-rounder classe 8B.' },
          { name: 'mistral-small3.1:24b', size: '~14 GB', description: 'Mistral Small 3.1 24B — Il più veloce (~50 tok/s).' },
          { name: 'deepseek-r1:32b', size: '~19 GB', description: 'DeepSeek R1 32B — Ragionamento top. Richiede 24GB+ VRAM.' },
          { name: 'llama3.3:70b', size: '~40 GB', description: 'Meta Llama 3.3 70B — Top assoluto. Richiede 48GB+ VRAM.' },
        ]);
      }
    } catch (error) {
      console.error('[OllamaManager] Load models error:', error);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    loadRecommendedModels();
  }, [checkStatus, loadRecommendedModels]);

  // Listen for Tauri events
  useEffect(() => {
    let unlisten1: (() => void) | null = null;
    let unlisten2: (() => void) | null = null;

    const setupListeners = async () => {
      if (typeof window !== 'undefined' && ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_IPC__)) {
        try {
          const { listen } = await import('@tauri-apps/api/event');
          
          unlisten1 = await listen<DownloadProgress>('ollama-download-progress', (event) => {
            setDownloadProgress(event.payload);
          }) as unknown as () => void;
          
          unlisten2 = await listen<PullProgress>('ollama-pull-progress', (event) => {
            setPullProgress(event.payload);
            if (event.payload.status === 'success') {
              setTimeout(() => {
                setPullProgress(null);
                checkStatus();
              }, 2000);
            }
          }) as unknown as () => void;
        } catch (e) {
          console.error('Failed to setup Tauri listeners:', e);
        }
      }
    };

    setupListeners();
    return () => {
      if (unlisten1) unlisten1();
      if (unlisten2) unlisten2();
    };
  }, [checkStatus]);

  const handleDownload = async () => {
    if (!isTauri) {
      window.open('https://ollama.com/download', '_blank');
      return;
    }
    setActionLoading('download');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke<string>('download_ollama');
      toast.success('Installer Ollama avviato!');
    } catch (error) {
      toast.error(`Errore download: ${error}`);
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
        const result = await invoke<string>('start_ollama');
        toast.success(result);
      } else {
        toast.error('Avvia Ollama manualmente: ollama serve');
      }
      await checkStatus();
    } catch (error) {
      toast.error(`Errore avvio: ${error}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    setActionLoading('stop');
    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<string>('stop_ollama');
        toast.success(result);
      }
      await checkStatus();
    } catch (error) {
      toast.error(`Errore arresto: ${error}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePullModel = async (modelName: string) => {
    if (!isTauri) {
      toast.info(`Esegui: ollama pull ${modelName}`);
      return;
    }
    setActionLoading(`pull-${modelName}`);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke<string>('pull_ollama_model', { modelName });
      toast.success(`Modello ${modelName} installato!`);
      await checkStatus();
    } catch (error) {
      toast.error(`Errore pull: ${error}`);
    } finally {
      setActionLoading(null);
      setPullProgress(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
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
                Installato
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                Non installato
              </Badge>
            )}
            {status?.running ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                <div className="h-2 w-2 rounded-full bg-green-500 mr-1 animate-pulse" />
                Attivo
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/30 text-xs">
                <div className="h-2 w-2 rounded-full bg-zinc-500 mr-1" />
                Spento
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={checkStatus}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Ollama permette di eseguire modelli AI localmente per tradurre senza limiti e senza costi.
          Nessun dato viene inviato online.
        </p>

        {/* Azioni principali */}
        <div className="flex flex-wrap gap-2">
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
              Scarica Ollama
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
              Avvia Ollama
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
              Arresta
            </Button>
          )}
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

        {/* Modelli installati */}
        {status?.running && status.models.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" />
              Modelli installati ({status.models.length})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {status.models.map((model) => (
                <Badge key={model} variant="secondary" className="text-xs font-mono">
                  {model}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Pull progress */}
        {pullProgress && (
          <div className="space-y-1.5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-400">{pullProgress.message}</span>
              <span className="text-blue-300 font-mono">{pullProgress.progress}%</span>
            </div>
            <Progress value={pullProgress.progress} className="h-1.5" />
          </div>
        )}

        {/* Modelli consigliati */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            Modelli consigliati per traduzione
          </h4>
          {!status?.running && (
            <p className="text-[10px] text-amber-400/80">{t('ollamaManagerComp.avviaOllamaPerInstallareIModel')}</p>
          )}
          <div className="grid gap-2">
            {recommendedModels.map((model) => {
              const modelBase = model.name.split(':')[0];
              const isInstalled = (status?.models || []).some(m => 
                m.startsWith(modelBase) || m.includes(modelBase.split('/').pop() || '')
              );
              const isPulling = actionLoading === `pull-${model.name}`;
              return (
                <div key={model.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium">{model.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{model.size}</Badge>
                      {isInstalled && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-500 border-green-500/30">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                          Installato
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{model.description}</p>
                  </div>
                  {!isInstalled && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="ml-2 h-7 text-xs shrink-0"
                      onClick={() => handlePullModel(model.name)}
                      disabled={isPulling || !!pullProgress || !status?.running}
                    >
                      {isPulling ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Download className="h-3 w-3 mr-1" />
                          Pull
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Info */}
        {status?.installed && status.version && (
          <p className="text-[10px] text-muted-foreground">
            {status.version} — {status.install_path}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
