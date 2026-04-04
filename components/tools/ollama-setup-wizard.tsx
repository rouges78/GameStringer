'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Wand2,
  Download,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Cpu,
  ArrowRight,
  RefreshCw,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { listen } from '@tauri-apps/api/event';
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

type WizardStep = 'check' | 'install' | 'start' | 'model' | 'done';

export function OllamaSetupWizard({ onComplete }: { onComplete?: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<WizardStep>('check');
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [models, setModels] = useState<OllamaModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check Ollama status
  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('check_ollama_status') as OllamaStatus;
      setStatus(result);
      
      if (!result.installed) {
        setStep('install');
      } else if (!result.running) {
        setStep('start');
      } else if (result.models.length === 0) {
        setStep('model');
      } else {
        setStep('done');
      }
    } catch (err) {
      setError('Impossibile verificare lo stato di Ollama');
    } finally {
      setLoading(false);
    }
  };

  // Load recommended models
  const loadModels = async () => {
    try {
      const result = await invoke('get_recommended_ollama_models') as OllamaModelInfo[];
      setModels(result);
      if (result.length > 0) setSelectedModel(result[0].name);
    } catch {}
  };

  useEffect(() => {
    checkStatus();
    loadModels();
  }, []);

  // Listen for download progress
  useEffect(() => {
    let unlistenDownload: (() => void) | null = null;
    let unlistenPull: (() => void) | null = null;

    const setup = async () => {
      try {
        unlistenDownload = await listen<unknown>('ollama-download-progress', (event) => {
          const data = event.payload;
          setProgress(data.progress || 0);
          setProgressMessage(data.message || '');
        });
        unlistenPull = await listen<unknown>('ollama-pull-progress', (event) => {
          const data = event.payload;
          setProgress(data.progress || 0);
          setProgressMessage(data.message || '');
          if (data.status === 'success') {
            checkStatus();
          }
        });
      } catch {}
    };
    setup();

    return () => {
      unlistenDownload?.();
      unlistenPull?.();
    };
  }, []);

  const handleInstall = async () => {
    setLoading(true);
    setError(null);
    setProgress(0);
    try {
      await invoke('download_ollama');
      setProgressMessage('Installer avviato. Completa l\'installazione e premi Continua.');
    } catch (err: unknown) {
      setError(err?.toString() || 'Errore durante il download');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await invoke('start_ollama');
      await checkStatus();
    } catch (err: unknown) {
      setError(err?.toString() || 'Impossibile avviare Ollama');
    } finally {
      setLoading(false);
    }
  };

  const handlePullModel = async () => {
    if (!selectedModel) return;
    setLoading(true);
    setError(null);
    setProgress(0);
    try {
      await invoke('pull_ollama_model', { modelName: selectedModel });
      setStep('done');
    } catch (err: unknown) {
      setError(err?.toString() || 'Errore download modello');
    } finally {
      setLoading(false);
    }
  };

  const stepConfig = {
    check: { title: 'Verifica Ollama', icon: RefreshCw, color: 'text-blue-400' },
    install: { title: 'Installa Ollama', icon: Download, color: 'text-amber-400' },
    start: { title: 'Avvia Ollama', icon: Play, color: 'text-emerald-400' },
    model: { title: 'Scarica Modello AI', icon: Cpu, color: 'text-violet-400' },
    done: { title: 'Tutto Pronto!', icon: CheckCircle2, color: 'text-emerald-400' },
  };

  const StepIcon = stepConfig[step].icon;

  return (
    <Card className="border-violet-500/20 bg-violet-950/20 backdrop-blur-sm max-w-lg mx-auto">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/20">
            <Wand2 className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-base">{t('ollamaSetupWizardComp.setupWizardAi')}</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">{t('ollamaSetupWizardComp.configuraLaiLocaleInPochiClick')}</p>
          </div>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-1 mt-3">
          {(['check', 'install', 'start', 'model', 'done'] as WizardStep[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className={`h-1.5 flex-1 rounded-full ${
                step === s ? 'bg-violet-500' : 
                (['check', 'install', 'start', 'model', 'done'].indexOf(step) > i ? 'bg-violet-500/50' : 'bg-slate-700/30')
              }`} />
            </React.Fragment>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="flex items-center gap-2 mb-3">
          <StepIcon className={`h-4 w-4 ${stepConfig[step].color}`} />
          <span className={`text-sm font-semibold ${stepConfig[step].color}`}>{stepConfig[step].title}</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-300">{error}</span>
          </div>
        )}

        {/* Step: Check */}
        {step === 'check' && (
          <div className="text-center py-4">
            <Loader2 className="h-8 w-8 text-violet-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">{t('ollamaSetupWizardComp.verificoSeOllamaÈInstallato')}</p>
          </div>
        )}

        {/* Step: Install */}
        {step === 'install' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Ollama non è installato. È un runtime AI locale gratuito che permette di eseguire modelli di traduzione senza costi e senza connessione internet.
            </p>
            {progress > 0 && (
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-2xs text-slate-500">{progressMessage}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleInstall} disabled={loading} className="flex-1" size="sm">
                {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                Scarica e Installa Ollama
              </Button>
              <Button onClick={checkStatus} variant="outline" size="sm">
                <RefreshCw className="h-3 w-3 mr-1" />
                Ricontrolla
              </Button>
            </div>
          </div>
        )}

        {/* Step: Start */}
        {step === 'start' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-emerald-300">Ollama installato ({status?.version})</span>
            </div>
            <p className="text-xs text-slate-400">Ollama è installato ma non in esecuzione. Avvialo per iniziare a usare i modelli AI.</p>
            <Button onClick={handleStart} disabled={loading} className="w-full" size="sm">
              {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
              Avvia Ollama
            </Button>
          </div>
        )}

        {/* Step: Model */}
        {step === 'model' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-emerald-300">{t('ollamaSetupWizardComp.ollamaInEsecuzione')}</span>
            </div>
            <p className="text-xs text-slate-400">Scegli un modello AI per la traduzione. I modelli più piccoli sono più veloci e usano meno VRAM.</p>
            
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {models.map(model => (
                <button
                  key={model.name}
                  onClick={() => setSelectedModel(model.name)}
                  className={`w-full text-left p-2 rounded-lg border transition-all ${
                    selectedModel === model.name
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-slate-700/30 hover:border-slate-600/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-200">{model.name}</span>
                    <Badge variant="outline" className="text-micro px-1.5 py-0 h-4">{model.size}</Badge>
                  </div>
                  <p className="text-2xs text-slate-400 mt-0.5">{model.description}</p>
                </button>
              ))}
            </div>

            {progress > 0 && (
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-2xs text-slate-500">{progressMessage}</p>
              </div>
            )}

            <Button onClick={handlePullModel} disabled={loading || !selectedModel} className="w-full" size="sm">
              {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
              Scarica {selectedModel?.split(':')[0] || 'modello'}
            </Button>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="text-center py-4 space-y-3">
            <div className="flex items-center justify-center">
              <div className="p-3 rounded-full bg-emerald-500/20">
                <Sparkles className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-300">{t('ollamaSetupWizardComp.aiLocaleConfigurata')}</p>
              <p className="text-xs text-slate-400 mt-1">
                {status?.models.length || 0} modello/i installato/i. Puoi iniziare a tradurre.
              </p>
            </div>
            {status?.models && status.models.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-center">
                {status.models.map(m => (
                  <Badge key={m} variant="outline" className="text-2xs">{m}</Badge>
                ))}
              </div>
            )}
            <Button onClick={onComplete} size="sm" className="mt-2">
              <ArrowRight className="h-3 w-3 mr-1" />
              Inizia a Tradurre
            </Button>
          </div>
        )}

        {/* Skip option */}
        {step !== 'done' && (
          <div className="mt-3 text-center">
            <button
              onClick={onComplete}
              className="text-2xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Salta — userò un provider cloud (Gemini, DeepSeek, Groq)
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OllamaSetupWizard;
