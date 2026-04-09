'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
import { clientLogger } from '@/lib/client-logger';
  WifiOff, Download, CheckCircle2, XCircle, Loader2,
  ArrowRightLeft, Trash2, Copy, Plus, ChevronDown, Cpu, Zap
} from 'lucide-react';

interface OfflineStatus {
  ollama_running: boolean;
  available_models: string[];
  recommended_model: string;
}

interface OfflineModelInfo {
  name: string;
  size_gb: number;
  installed: boolean;
  recommended: boolean;
  description: string;
}

interface TranslationResult {
  original: string;
  translated: string;
  model: string;
  duration_ms: number;
}

const LANGUAGES = [
  { code: 'Italian', label: 'Italiano' },
  { code: 'English', label: 'English' },
  { code: 'French', label: 'Français' },
  { code: 'German', label: 'Deutsch' },
  { code: 'Spanish', label: 'Español' },
  { code: 'Portuguese', label: 'Português' },
  { code: 'Russian', label: 'Русский' },
  { code: 'Japanese', label: '日本語' },
  { code: 'Korean', label: '한국어' },
  { code: 'Chinese', label: '中文' },
  { code: 'Polish', label: 'Polski' },
  { code: 'Dutch', label: 'Nederlands' },
  { code: 'Turkish', label: 'Türkçe' },
  { code: 'Czech', label: 'Čeština' },
];

export default function OfflineTranslator() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [models, setModels] = useState<OfflineModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState('');
  const [sourceLang, setSourceLang] = useState('English');
  const [targetLang, setTargetLang] = useState('Italian');
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState<TranslationResult[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPulling, setIsPulling] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchTexts, setBatchTexts] = useState('');

  const refreshStatus = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        invoke<OfflineStatus>('offline_translation_status'),
        invoke<OfflineModelInfo[]>('offline_translation_models'),
      ]);
      setStatus(s);
      setModels(m);
      if (s.recommended_model && !selectedModel) {
        setSelectedModel(s.recommended_model);
      }
    } catch (err: unknown) {
      clientLogger.error('Errore status offline:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleStartOllama = async () => {
    try {
      toast.loading(t('offlineTranslator.startingOllama'));
      await invoke<string>('start_ollama');
      toast.success(t('offlineTranslator.ollamaStarted'));
      await refreshStatus();
    } catch (err: unknown) {
      toast.error(t('offlineTranslator.errorStartOllama'), { description: String(err) });
    }
  };

  const handlePullModel = async (modelName: string) => {
    setIsPulling(modelName);
    try {
      toast.loading(`${t('offlineTranslator.downloading')} ${modelName}...`, { id: `pull-${modelName}` });
      await invoke<string>('pull_ollama_model', { modelName });
      toast.success(`${modelName} ${t('offlineTranslator.installed')}`, { id: `pull-${modelName}` });
      await refreshStatus();
    } catch (err: unknown) {
      toast.error(`${t('offlineTranslator.errorDownload')} ${modelName}`, { description: String(err), id: `pull-${modelName}` });
    } finally {
      setIsPulling('');
    }
  };

  const handleTranslate = async () => {
    if (batchMode) {
      await handleBatchTranslate();
      return;
    }

    if (!inputText.trim()) {
      toast.error(t('offlineTranslator.enterText'));
      return;
    }

    setIsTranslating(true);
    try {
      const result = await invoke<TranslationResult>('offline_translate_text', {
        text: inputText.trim(),
        sourceLang: sourceLang,
        targetLang: targetLang,
        model: selectedModel || null,
      });
      setResults(prev => [result, ...prev]);
      toast.success(`${t('offlineTranslator.translatedIn')} ${result.duration_ms}ms`);
    } catch (err: unknown) {
      toast.error(t('offlineTranslator.errorTranslation'), { description: String(err) });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleBatchTranslate = async () => {
    const lines = batchTexts.split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      toast.error(t('offlineTranslator.enterOneLine'));
      return;
    }

    setIsTranslating(true);
    const toastId = toast.loading(`Traduzione batch: 0/${lines.length}...`);
    try {
      const batchResults = await invoke<TranslationResult[]>('offline_translate_batch', {
        texts: lines,
        sourceLang: sourceLang,
        targetLang: targetLang,
        model: selectedModel || null,
      });
      setResults(prev => [...batchResults.reverse(), ...prev]);
      toast.success(`${t('offlineTranslator.batchComplete')} ${batchResults.length} ${t('offlineTranslator.textsTranslated')}`, { id: toastId });
    } catch (err: unknown) {
      toast.error(t('offlineTranslator.errorBatch'), { description: String(err), id: toastId });
    } finally {
      setIsTranslating(false);
    }
  };

  const copyResult = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('offlineTranslator.copied'));
  };

  const copyAllResults = () => {
    const text = results.map(r => r.translated).join('\n');
    navigator.clipboard.writeText(text);
    toast.success(`${results.length} ${t('offlineTranslator.copiedAll')}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  const ollamaReady = status?.ollama_running && (status.available_models.length > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 shadow-lg">
            <WifiOff className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t('offlineTranslator.title')}</h1>
            <p className="text-xs text-slate-400">{t('offlineTranslator.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            status?.ollama_running
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {status?.ollama_running ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {status?.ollama_running ? t('offlineTranslator.ollamaActive') : t('offlineTranslator.ollamaOff')}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs bg-black/30 border-white/10"
            onClick={() => setShowSetup(!showSetup)}
          >
            <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${showSetup ? 'rotate-180' : ''}`} />
            {t('offlineTranslator.setup')}
          </Button>
        </div>
      </div>

      {/* Setup Panel */}
      {showSetup && (
        <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-4 animate-in slide-in-from-top-2">
          {/* Ollama Status */}
          {!status?.ollama_running && (
            <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium text-red-400">{t('offlineTranslator.ollamaNotRunning')}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t('offlineTranslator.ollamaNotRunningDesc')}</p>
              </div>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleStartOllama}>
                {t('offlineTranslator.startOllama')}
              </Button>
            </div>
          )}

          {/* Models */}
          <div>
            <h3 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-purple-400" /> {t('offlineTranslator.availableModels')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {models.map(model => (
                <div
                  key={model.name}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    model.installed
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-black/20 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{model.name}</span>
                      {model.recommended && (
                        <span className="text-micro bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded-full font-bold">
                          {t('offlineTranslator.recommended')}
                        </span>
                      )}
                      <span className="text-2xs text-slate-500">{model.size_gb} GB</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{model.description}</p>
                  </div>
                  {model.installed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-xs shrink-0"
                      onClick={() => handlePullModel(model.name)}
                      disabled={!status?.ollama_running || isPulling !== ''}
                    >
                      {isPulling === model.name ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <><Download className="h-3 w-3 mr-1" /> {t('offlineTranslator.download')}</>
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Translation Area */}
      <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-3">
        {/* Language Selector + Model */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sourceLang}
            onChange={e => setSourceLang(e.target.value)}
            className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>

          <button
            onClick={() => { setSourceLang(targetLang); setTargetLang(sourceLang); }}
            className="p-2 rounded-lg bg-black/30 hover:bg-purple-600/30 text-slate-400 hover:text-purple-400 transition-colors"
            title="Inverti lingue"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </button>

          <select
            value={targetLang}
            onChange={e => setTargetLang(e.target.value)}
            className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>

          <div className="flex-1" />

          {status && status.available_models.length > 0 && (
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              {status.available_models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setBatchMode(!batchMode)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              batchMode
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                : 'bg-black/30 text-slate-400 border border-white/10 hover:text-white'
            }`}
          >
            {batchMode ? t('offlineTranslator.batchOn') : t('offlineTranslator.single')}
          </button>
        </div>

        {/* Input */}
        {batchMode ? (
          <div>
            <label className="text-2xs text-slate-500 uppercase font-semibold mb-1 block">
              {t('offlineTranslator.batchPlaceholder')}
            </label>
            <textarea
              value={batchTexts}
              onChange={e => setBatchTexts(e.target.value)}
              placeholder={"Hello, how are you?\nWelcome to the game.\nPress any key to continue."}
              rows={6}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 resize-none"
            />
            <p className="text-2xs text-slate-500 mt-1">
              {batchTexts.split('\n').filter(l => l.trim()).length} {t('offlineTranslator.lines')}
            </p>
          </div>
        ) : (
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={t('offlineTranslator.inputPlaceholder')}
            rows={3}
            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleTranslate();
              }
            }}
          />
        )}

        {/* Translate Button */}
        <div className="flex items-center gap-2">
          <Button
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-sm flex-1"
            onClick={handleTranslate}
            disabled={isTranslating || !ollamaReady}
          >
            {isTranslating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('offlineTranslator.translating')}</>
            ) : (
              <><Zap className="h-4 w-4 mr-2" /> {t('offlineTranslator.translateBtn')} {batchMode ? '(Batch)' : ''}</>
            )}
          </Button>
          {!ollamaReady && (
            <p className="text-2xs text-red-400">
              {!status?.ollama_running ? t('offlineTranslator.startOllamaHint') : t('offlineTranslator.downloadModelHint')} {t('offlineTranslator.toTranslate')}
            </p>
          )}
        </div>
        <p className="text-2xs text-slate-600">{t('offlineTranslator.ctrlEnter')}</p>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-white/5 bg-black/30">
            <span className="text-xs font-semibold text-white/70 uppercase">
              {t('offlineTranslator.results')} ({results.length})
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="text-xs text-slate-400 hover:text-white h-7" onClick={copyAllResults}>
                <Copy className="h-3 w-3 mr-1" /> {t('offlineTranslator.copyAll')}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs text-red-400 hover:text-red-300 h-7" onClick={() => setResults([])}>
                <Trash2 className="h-3 w-3 mr-1" /> {t('offlineTranslator.clear')}
              </Button>
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-white/5">
            {results.map((r, i) => (
              <div key={i} className="p-3 hover:bg-white/[0.02] transition-colors group">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-2xs text-slate-500 uppercase mb-1">{t('offlineTranslator.original')}</p>
                    <p className="text-sm text-slate-300">{r.original}</p>
                  </div>
                  <div>
                    <p className="text-2xs text-emerald-500 uppercase mb-1">{t('offlineTranslator.translation')}</p>
                    <p className="text-sm text-white font-medium">{r.translated}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3 text-2xs text-slate-500">
                    <span className="flex items-center gap-1"><Cpu className="h-2.5 w-2.5" /> {r.model}</span>
                    <span className="flex items-center gap-1"><Zap className="h-2.5 w-2.5" /> {r.duration_ms}ms</span>
                  </div>
                  <button
                    onClick={() => copyResult(r.translated)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-all"
                    title="Copia traduzione"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
