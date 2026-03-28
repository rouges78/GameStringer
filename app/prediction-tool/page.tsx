'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSearchParams } from 'next/navigation';
import {
  Brain, Globe, FileText, Clock, AlertTriangle, CheckCircle, XCircle,
  ChevronLeft, Loader2, Zap, Server, Cloud, Layers, Shield,
  BarChart3, HardDrive, Languages, Sparkles, Cpu, DollarSign,
  ArrowRight, Star, Info
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────

interface DetectedLanguage {
  code: string;
  name: string;
  source: string;
  fileCount: number;
  totalSizeKb: number;
}

interface FileSizeInfo {
  path: string;
  sizeKb: number;
  format: string;
}

interface TextStats {
  totalTextFiles: number;
  totalTextSizeKb: number;
  estimatedStrings: number;
  estimatedWords: number;
  estimatedCharacters: number;
  largestFiles: FileSizeInfo[];
  localizationFolders: string[];
}

interface FileFormatInfo {
  extension: string;
  count: number;
  totalSizeKb: number;
  translatable: boolean;
  description: string;
}

interface TimeEstimate {
  modelName: string;
  modelSize: string;
  speedStringsPerMin: number;
  estimatedHours: number;
  qualityScore: number;
  provider: string;
}

interface ChainEstimate {
  chainName: string;
  description: string;
  estimatedHours: number;
  qualityScore: number;
  costEstimate: string;
  steps: string[];
}

interface PredictionResult {
  gameTitle: string;
  engine: string;
  installPath: string;
  detectedLanguages: DetectedLanguage[];
  difficultyScore: number;
  difficultyLabel: string;
  textStats: TextStats;
  fileFormats: FileFormatInfo[];
  timeEstimates: TimeEstimate[];
  chainEstimates: ChainEstimate[];
  warnings: string[];
  gsSupported: boolean;
  recommendedMethod: string;
}

// ── Language Lists ───────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italiano' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'pl', name: 'Polski' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'sv', name: 'Svenska' },
  { code: 'cs', name: 'Čeština' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ar', name: 'العربية' },
  { code: 'th', name: 'ไทย' },
  { code: 'uk', name: 'Українська' },
];

// ── Helper Components ────────────────────────────────────────────────

function DifficultyGauge({ score, label }: { score: number; label: string }) {
  const color = score <= 20 ? 'text-green-400' : score <= 40 ? 'text-emerald-400' : score <= 60 ? 'text-yellow-400' : score <= 80 ? 'text-orange-400' : 'text-red-400';
  const bgColor = score <= 20 ? 'bg-green-500' : score <= 40 ? 'bg-emerald-500' : score <= 60 ? 'bg-yellow-500' : score <= 80 ? 'bg-orange-500' : 'bg-red-500';
  const ringColor = score <= 20 ? 'ring-green-500/30' : score <= 40 ? 'ring-emerald-500/30' : score <= 60 ? 'ring-yellow-500/30' : score <= 80 ? 'ring-orange-500/30' : 'ring-red-500/30';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative w-28 h-28 rounded-full ring-4 ${ringColor} flex items-center justify-center bg-slate-800/80`}>
        <div className="text-center">
          <span className={`text-3xl font-black ${color}`}>{score}</span>
          <span className="text-slate-500 text-xs block">/100</span>
        </div>
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-700/50" />
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className={color}
            strokeDasharray={`${score * 3.27} 327`} strokeLinecap="round" />
        </svg>
      </div>
      <span className={`text-sm font-bold ${color}`}>{label}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-indigo-400' }: { icon: unknown; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg bg-slate-700/50 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-slate-200 truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function QualityBar({ score }: { score: number }) {
  const color = score >= 90 ? 'bg-green-500' : score >= 80 ? 'bg-emerald-500' : score >= 70 ? 'bg-yellow-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-400 w-8 text-right">{score}</span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function PredictionToolPage() {
  const searchParams = useSearchParams();
  const gameTitle = searchParams.get('name') || 'Unknown Game';
  const installDir = searchParams.get('installDir') || '';
  const engineParam = searchParams.get('engine') || '';
  const headerImage = searchParams.get('headerImage') || '';

  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('it');
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChain, setExpandedChain] = useState<string | null>(null);

  const analyze = async () => {
    const dir = installDir || result?.installPath || '';
    if (!dir) {
      setError('Nessuna directory di installazione disponibile. Il gioco deve essere installato.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await invoke<PredictionResult>('analyze_game_translation', {
        installPath: dir,
        gameTitle: gameTitle,
        engine: engineParam || null,
        sourceLang,
        targetLang,
      });
      setResult(res);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze on mount if installDir is available
  useEffect(() => {
    if (installDir) {
      analyze();
    }
  }, []);

  const translatableFormats = useMemo(() =>
    result?.fileFormats.filter(f => f.translatable) || [], [result]);
  const binaryFormats = useMemo(() =>
    result?.fileFormats.filter(f => !f.translatable) || [], [result]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      {/* Header */}
      <div className="relative overflow-hidden">
        {headerImage && (
          <div className="absolute inset-0">
            <img src={headerImage} alt="" className="w-full h-full object-cover opacity-15 blur-sm" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/90 to-slate-950" />
          </div>
        )}
        <div className="relative max-w-6xl mx-auto px-6 py-6">
          <button onClick={() => window.history.back()}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-sm mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Torna alla Libreria
          </button>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-purple-500/20">
              <Brain className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                P.T. <span className="text-purple-400">Prediction Tool</span>
              </h1>
              <p className="text-sm text-slate-500">{gameTitle}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-12">
        {/* Language Selector */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Lingua Origine</label>
              <select value={sourceLang} onChange={e => setSourceLang(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
              </select>
            </div>
            <div className="flex items-center pb-2">
              <ArrowRight className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Lingua Destinazione</label>
              <select value={targetLang} onChange={e => setTargetLang(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
              </select>
            </div>
            <button onClick={analyze} disabled={loading || (!installDir && !result)}
              className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-sm transition-all flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Analisi...' : 'Analizza'}
            </button>
          </div>
          {!installDir && (
            <p className="text-xs text-orange-400/80 mt-3 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Il gioco non è installato. Installalo per analizzare i file.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6 text-sm text-red-300">
            <XCircle className="w-4 h-4 inline mr-2" /> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            <p className="text-slate-400 text-sm">Scansione profonda dei file di gioco...</p>
            <p className="text-slate-600 text-xs">Analisi motore, lingue, formati, volume testo</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Row 1: Difficulty + Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Difficulty Gauge */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col items-center justify-center">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Difficoltà Traduzione</h3>
                <DifficultyGauge score={result.difficultyScore} label={result.difficultyLabel} />
                <div className="mt-4 flex items-center gap-2">
                  {result.gsSupported ? (
                    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">
                      <CheckCircle className="w-3 h-3" /> Supportato da GS
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded-lg">
                      <AlertTriangle className="w-3 h-3" /> Supporto limitato
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard icon={Cpu} label="Motore" value={result.engine} color="text-cyan-400" />
                <StatCard icon={FileText} label="File Testo" value={String(result.textStats.totalTextFiles)} sub={`${result.textStats.totalTextSizeKb} KB totali`} color="text-blue-400" />
                <StatCard icon={BarChart3} label="Stringhe Stimate" value={result.textStats.estimatedStrings.toLocaleString()} color="text-purple-400" />
                <StatCard icon={Languages} label="Lingue Trovate" value={String(result.detectedLanguages.length)} color="text-emerald-400" />
                <StatCard icon={Layers} label="Formati Traducibili" value={String(translatableFormats.length)} sub={`su ${result.fileFormats.length} formati`} color="text-yellow-400" />
                <StatCard icon={HardDrive} label="Metodo" value={result.gsSupported ? 'GS Nativo' : 'Manuale'} sub={result.recommendedMethod.slice(0, 50)} color="text-pink-400" />
              </div>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="bg-amber-900/10 border border-amber-500/20 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Avvisi
                </h3>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-300/70 pl-5">• {w}</p>
                ))}
              </div>
            )}

            {/* Row 2: Languages + Formats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Languages */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" /> Lingue Rilevate
                </h3>
                {result.detectedLanguages.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Nessuna lingua rilevata nei file — le stringhe potrebbero essere in file binari</p>
                ) : (
                  <div className="space-y-2">
                    {result.detectedLanguages.map(lang => (
                      <div key={lang.code} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{lang.code}</span>
                          <span className="text-sm text-slate-300">{lang.name}</span>
                          {lang.code === targetLang && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">TARGET</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400">{lang.fileCount} file</span>
                          {lang.totalSizeKb > 0 && (
                            <span className="text-xs text-slate-500 ml-2">{lang.totalSizeKb} KB</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* File Formats */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" /> Formati File
                </h3>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2">
                  {result.fileFormats.map(fmt => (
                    <div key={fmt.extension} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${fmt.translatable ? 'bg-green-500' : 'bg-slate-600'}`} />
                      <span className="font-mono text-slate-300 w-16">.{fmt.extension}</span>
                      <span className="text-slate-500 flex-1 truncate">{fmt.description}</span>
                      <span className="text-slate-400 tabular-nums">{fmt.count}</span>
                      <span className="text-slate-600 w-16 text-right">{fmt.totalSizeKb > 1024 ? `${(fmt.totalSizeKb/1024).toFixed(1)} MB` : `${fmt.totalSizeKb} KB`}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-3 pt-3 border-t border-slate-700/50 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Traducibile</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600" /> Binario</span>
                </div>
              </div>
            </div>

            {/* Row 3: Largest Files */}
            {result.textStats.largestFiles.length > 0 && (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-yellow-400" /> File di Testo più Grandi
                </h3>
                <div className="space-y-1.5">
                  {result.textStats.largestFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs bg-slate-900/30 rounded-lg px-3 py-2">
                      <span className="text-slate-500 w-5">{i + 1}.</span>
                      <span className="font-mono text-slate-300 flex-1 truncate">{f.path}</span>
                      <span className="font-mono text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">.{f.format}</span>
                      <span className="text-slate-400 tabular-nums w-20 text-right font-semibold">
                        {f.sizeKb > 1024 ? `${(f.sizeKb/1024).toFixed(1)} MB` : `${f.sizeKb} KB`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 4: Time Estimates per Model */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" /> Stima Tempo per Modello
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {result.timeEstimates.map(te => (
                  <div key={te.modelName} className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      {te.provider.includes('locale') ? <Server className="w-3.5 h-3.5 text-cyan-400" /> : <Cloud className="w-3.5 h-3.5 text-blue-400" />}
                      <span className="text-xs font-bold text-slate-200">{te.modelName}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">{te.modelSize} • {te.provider}</p>
                    <div className="mt-2.5">
                      <p className="text-lg font-black text-slate-200">
                        {te.estimatedHours < 1 ? `${Math.round(te.estimatedHours * 60)}m` : `${te.estimatedHours.toFixed(1)}h`}
                      </p>
                      <p className="text-[10px] text-slate-500">{te.speedStringsPerMin}/min</p>
                    </div>
                    <div className="mt-2">
                      <p className="text-[10px] text-slate-500 mb-0.5">Qualità</p>
                      <QualityBar score={te.qualityScore} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 5: Chain Estimates */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Chain di Traduzione
              </h3>
              <div className="space-y-3">
                {result.chainEstimates.map(ce => {
                  const isExpanded = expandedChain === ce.chainName;
                  const isRecommended = ce.chainName.includes('Consigliato');
                  return (
                    <div key={ce.chainName}
                      className={`border rounded-xl overflow-hidden transition-all cursor-pointer ${
                        isRecommended ? 'border-purple-500/40 bg-purple-900/10' : 'border-slate-700/40 bg-slate-900/30'
                      }`}
                      onClick={() => setExpandedChain(isExpanded ? null : ce.chainName)}
                    >
                      <div className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-200">{ce.chainName}</span>
                            {isRecommended && (
                              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <Star className="w-2.5 h-2.5" /> Consigliato
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{ce.description}</p>
                        </div>
                        <div className="flex items-center gap-4 text-right shrink-0">
                          <div>
                            <p className="text-sm font-bold text-slate-200">
                              {ce.estimatedHours < 1 ? `${Math.round(ce.estimatedHours * 60)}m` : `${ce.estimatedHours.toFixed(1)}h`}
                            </p>
                            <p className="text-[10px] text-slate-500">tempo</p>
                          </div>
                          <div className="w-16">
                            <QualityBar score={ce.qualityScore} />
                            <p className="text-[10px] text-slate-500 text-center">qualità</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-emerald-400">{ce.costEstimate}</p>
                            <p className="text-[10px] text-slate-500">costo</p>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-3 pt-1 border-t border-slate-700/30">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Pipeline</p>
                          <div className="space-y-1.5">
                            {ce.steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                                <span className="text-purple-400 mt-0.5">▸</span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Row 6: Recommended Method */}
            <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border border-purple-500/20 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" /> Metodo Consigliato
              </h3>
              <p className="text-sm text-slate-300">{result.recommendedMethod}</p>
              {result.textStats.localizationFolders.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Cartelle Localizzazione Trovate</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.textStats.localizationFolders.map((f, i) => (
                      <span key={i} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
