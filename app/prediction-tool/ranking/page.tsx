'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '@/lib/i18n';
import {
  Brain, ChevronLeft, Loader2, Shield, ShieldOff, Globe,
  Clock, DollarSign, AlertTriangle, CheckCircle, ArrowUpDown,
  Zap, BarChart3, Trophy
} from 'lucide-react';

interface GameQuickSummary {
  gameTitle: string;
  engine: string;
  installPath: string;
  difficultyScore: number;
  difficultyLabel: string;
  estimatedStrings: number;
  estimatedHoursLocal: number;
  estimatedHoursCloud: number;
  estimatedCostCloud: number;
  gsSupported: boolean;
  recommendedMethod: string;
  langCount: number;
  hasItalian: boolean;
  warningsCount: number;
  headerImage: string;
  isDemo: boolean;
  sizeGb: number;
}

type SortKey = 'difficulty' | 'strings' | 'timeLocal' | 'timeCloud' | 'cost' | 'name' | 'size';

function getDifficultyColor(score: number) {
  if (score >= 80) return 'text-red-400 bg-red-500/20 border-red-500/30';
  if (score >= 60) return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
  if (score >= 40) return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
  if (score >= 20) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
  return 'text-green-400 bg-green-500/20 border-green-500/30';
}

function getDifficultyBg(score: number) {
  if (score >= 80) return 'bg-red-500';
  if (score >= 60) return 'bg-orange-500';
  if (score >= 40) return 'bg-yellow-500';
  if (score >= 20) return 'bg-emerald-500';
  return 'bg-green-500';
}

function formatTime(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return `${days}g ${h}h`;
}

function formatStrings(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function PredictionRankingPage() {
  const { t } = useTranslation();
  const [summaries, setSummaries] = useState<GameQuickSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('difficulty');
  const [sortAsc, setSortAsc] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanned, setScanned] = useState(false);

  const startScan = async () => {
    setLoading(true);
    setError(null);
    setProgress(0);
    try {
      const result = await invoke('analyze_all_installed_games') as GameQuickSummary[];
      setSummaries(result);
      setScanned(true);
    } catch (e: unknown) {
      setError(e?.toString() || 'Errore durante la scansione');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 2, 95));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  const sorted = [...summaries].sort((a, b) => {
    let diff = 0;
    switch (sortKey) {
      case 'difficulty': diff = a.difficultyScore - b.difficultyScore; break;
      case 'strings': diff = a.estimatedStrings - b.estimatedStrings; break;
      case 'timeLocal': diff = a.estimatedHoursLocal - b.estimatedHoursLocal; break;
      case 'timeCloud': diff = a.estimatedHoursCloud - b.estimatedHoursCloud; break;
      case 'cost': diff = a.estimatedCostCloud - b.estimatedCostCloud; break;
      case 'name': diff = a.gameTitle.localeCompare(b.gameTitle); break;
      case 'size': diff = a.sizeGb - b.sizeGb; break;
    }
    return sortAsc ? diff : -diff;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const stats = {
    total: summaries.length,
    easy: summaries.filter(s => s.difficultyScore <= 30).length,
    medium: summaries.filter(s => s.difficultyScore > 30 && s.difficultyScore <= 60).length,
    hard: summaries.filter(s => s.difficultyScore > 60).length,
    withItalian: summaries.filter(s => s.hasItalian).length,
    gsSupported: summaries.filter(s => s.gsSupported).length,
    demos: summaries.filter(s => s.isDemo).length,
    totalStrings: summaries.reduce((acc, s) => acc + s.estimatedStrings, 0),
    totalCost: summaries.reduce((acc, s) => acc + s.estimatedCostCloud, 0),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-noir-950 via-noir-900 to-rouge-950 text-white">
      <div className="max-w-[1400px] mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => window.location.href = '/library'}
            className="text-noir-400 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> {t('predictionRankingPage.backToLibrary')}</button>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rouge-600/30 rounded-2xl border border-rouge-500/30">
              <Trophy className="h-8 w-8 text-rouge-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-rouge-300 to-rouge-300 bg-clip-text text-transparent">
                {t('predictionRankingPage.title')}</h1>
              <p className="text-noir-400 text-sm">{t('predictionRankingPage.subtitle')}</p>
            </div>
          </div>

          <button
            onClick={startScan}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rouge-600 to-rouge-600 hover:from-rouge-500 hover:to-rouge-500 disabled:opacity-50 rounded-xl font-semibold transition-all shadow-lg shadow-rouge-500/25"
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> {t('predictionRankingPage.scanning')}</>
            ) : (
              <><Zap className="h-5 w-5" /> {scanned ? 'Riscansiona Tutti' : 'Scansiona Tutti'}</>
            )}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-noir-800/60 rounded-2xl border border-rouge-500/20 p-8 mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Brain className="h-6 w-6 text-rouge-400 animate-pulse" />
              <span className="text-lg font-semibold">{t('predictionRankingPage.analyzing')}</span>
            </div>
            <div className="w-full h-3 bg-noir-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rouge-500 to-rouge-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-noir-400 text-sm mt-2">
              {t('predictionRankingPage.scanningDetail')}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* Stats Overview */}
        {scanned && !loading && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
              <div className="bg-noir-800/60 rounded-xl p-3 border border-noir-700/50 text-center">
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-2xs text-noir-400 uppercase tracking-wider">{t('common.giochi')}</div>
              </div>
              <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.easy}</div>
                <div className="text-2xs text-green-400/70 uppercase tracking-wider">{t('predictionRankingPage.easy')}</div>
              </div>
              <div className="bg-yellow-500/10 rounded-xl p-3 border border-yellow-500/20 text-center">
                <div className="text-2xl font-bold text-yellow-400">{stats.medium}</div>
                <div className="text-2xs text-yellow-400/70 uppercase tracking-wider">{t('predictionRankingPage.medium')}</div>
              </div>
              <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20 text-center">
                <div className="text-2xl font-bold text-red-400">{stats.hard}</div>
                <div className="text-2xs text-red-400/70 uppercase tracking-wider">{t('predictionRankingPage.hard')}</div>
              </div>
              <div className="bg-noir-500/10 rounded-xl p-3 border border-noir-500/20 text-center">
                <div className="text-2xl font-bold text-noir-400">{stats.withItalian}</div>
                <div className="text-2xs text-noir-400/70 uppercase tracking-wider">{t('predictionRankingPage.withIt')}</div>
              </div>
              <div className="bg-rouge-500/10 rounded-xl p-3 border border-rouge-500/20 text-center">
                <div className="text-2xl font-bold text-rouge-400">{stats.gsSupported}</div>
                <div className="text-2xs text-rouge-400/70 uppercase tracking-wider">{t('predictionRankingPage.gsOk')}</div>
              </div>
              <div className="bg-noir-800/60 rounded-xl p-3 border border-noir-700/50 text-center">
                <div className="text-2xl font-bold text-noir-400">{formatStrings(stats.totalStrings)}</div>
                <div className="text-2xs text-noir-400 uppercase tracking-wider">{t('predictionRankingPage.totalStrings')}</div>
              </div>
              <div className="bg-noir-800/60 rounded-xl p-3 border border-noir-700/50 text-center">
                <div className="text-2xl font-bold text-emerald-400">${stats.totalCost.toFixed(0)}</div>
                <div className="text-2xs text-noir-400 uppercase tracking-wider">{t('predictionRankingPage.totalCloudCost')}</div>
              </div>
            </div>

            {/* Table Header */}
            <div className="bg-noir-800/80 rounded-t-xl border border-noir-700/50 border-b-0">
              <div className="grid grid-cols-[minmax(200px,2fr)_100px_80px_100px_90px_90px_80px_70px_70px] gap-2 px-4 py-3 text-[11px] font-semibold text-noir-400 uppercase tracking-wider">
                <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-white transition-colors text-left">
                  {t('predictionRankingPage.game')}{sortKey === 'name' && <ArrowUpDown className="h-3 w-3" />}
                </button>
                <span>{t('predictionRankingPage.engine')}</span>
                <button onClick={() => toggleSort('difficulty')} className="flex items-center gap-1 hover:text-white transition-colors">
                  {t('predictionRankingPage.difficulty')}{sortKey === 'difficulty' && <ArrowUpDown className="h-3 w-3" />}
                </button>
                <button onClick={() => toggleSort('strings')} className="flex items-center gap-1 hover:text-white transition-colors">
                  {t('predictionRankingPage.strings')}{sortKey === 'strings' && <ArrowUpDown className="h-3 w-3" />}
                </button>
                <button onClick={() => toggleSort('timeLocal')} className="flex items-center gap-1 hover:text-white transition-colors">
                  {t('predictionRankingPage.localTime')}{sortKey === 'timeLocal' && <ArrowUpDown className="h-3 w-3" />}
                </button>
                <button onClick={() => toggleSort('timeCloud')} className="flex items-center gap-1 hover:text-white transition-colors">
                  {t('predictionRankingPage.cloudTime')}{sortKey === 'timeCloud' && <ArrowUpDown className="h-3 w-3" />}
                </button>
                <button onClick={() => toggleSort('cost')} className="flex items-center gap-1 hover:text-white transition-colors">
                  {t('predictionRankingPage.cost')}{sortKey === 'cost' && <ArrowUpDown className="h-3 w-3" />}
                </button>
                <span className="text-center">{t('common.lingue')}</span>
                <span className="text-center">GS</span>
              </div>
            </div>

            {/* Table Rows */}
            <div className="border border-noir-700/50 rounded-b-xl overflow-hidden divide-y divide-noir-700/30">
              {sorted.map((game, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    window.location.href = `/prediction-tool?name=${encodeURIComponent(game.gameTitle)}&installDir=${encodeURIComponent(game.installPath)}&engine=${encodeURIComponent(game.engine)}&headerImage=${encodeURIComponent(game.headerImage)}`;
                  }}
                  className="w-full grid grid-cols-[minmax(200px,2fr)_100px_80px_100px_90px_90px_80px_70px_70px] gap-2 px-4 py-3 items-center hover:bg-noir-800/60 transition-colors text-left group"
                >
                  {/* Game Title + Image */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative rounded-md overflow-hidden flex-shrink-0 bg-noir-700/80 border border-noir-600/30" style={{ width: '120px', height: '45px' }}>
                      {game.headerImage ? (
                        <img
                          src={game.headerImage}
                          alt={game.gameTitle}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { 
                            const el = e.target as HTMLImageElement;
                            el.style.display = 'none';
                            el.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                            const span = document.createElement('span');
                            span.className = 'text-micro text-noir-500 text-center px-1';
                            span.textContent = game.gameTitle.slice(0, 15);
                            el.parentElement!.appendChild(span);
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-micro text-noir-500 text-center px-1">{game.gameTitle.slice(0, 15)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-sm font-medium text-noir-200 group-hover:text-white transition-colors">
                        {game.gameTitle}
                      </span>
                      {game.isDemo && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 text-micro font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                          {t('predictionRankingPage.demo')}</span>
                      )}
                    </div>
                    <span className="text-2xs text-noir-500">{game.sizeGb > 0 ? `${game.sizeGb.toFixed(1)} GB` : ''}</span>
                  </div>

                  {/* Engine */}
                  <span className="text-xs text-noir-400 truncate">{game.engine}</span>

                  {/* Difficulty */}
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getDifficultyColor(game.difficultyScore)}`}>
                      {game.difficultyScore}
                    </div>
                    <div className="w-12 h-1.5 bg-noir-700 rounded-full overflow-hidden hidden lg:block">
                      <div className={`h-full rounded-full ${getDifficultyBg(game.difficultyScore)}`} style={{ width: `${game.difficultyScore}%` }} />
                    </div>
                  </div>

                  {/* Strings */}
                  <span className="text-xs text-noir-300 font-mono">{formatStrings(game.estimatedStrings)}</span>

                  {/* Time Local */}
                  <span className="text-xs text-noir-300 font-mono">
                    <Clock className="h-3 w-3 inline mr-1 text-noir-500" />
                    {formatTime(game.estimatedHoursLocal)}
                  </span>

                  {/* Time Cloud */}
                  <span className="text-xs text-noir-300 font-mono">
                    <Zap className="h-3 w-3 inline mr-1 text-noir-500" />
                    {formatTime(game.estimatedHoursCloud)}
                  </span>

                  {/* Cost */}
                  <span className="text-xs text-emerald-300 font-mono">
                    ${game.estimatedCostCloud.toFixed(2)}
                  </span>

                  {/* Languages */}
                  <div className="flex items-center justify-center gap-1">
                    <Globe className="h-3 w-3 text-noir-500" />
                    <span className="text-xs text-noir-300">{game.langCount}</span>
                    {game.hasItalian && <span className="text-micro text-green-400">🇮🇹</span>}
                  </div>

                  {/* GS Supported */}
                  <div className="flex justify-center">
                    {game.gsSupported ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <ShieldOff className="h-4 w-4 text-noir-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {sorted.length === 0 && (
              <div className="text-center py-12 text-noir-500">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>{t('predictionRankingPage.noGamesFound')}</p>
              </div>
            )}
          </>
        )}

        {/* Initial state */}
        {!scanned && !loading && (
          <div className="text-center py-24">
            <Brain className="h-20 w-20 mx-auto mb-6 text-rouge-500/30" />
            <h2 className="text-xl font-semibold text-noir-300 mb-2">{t('common.classificaDifficoltàTraduzione')}</h2>
            <p className="text-noir-500 max-w-md mx-auto mb-8">
              {t('predictionRankingPage.clickScanPrompt')}</p>
            <div className="flex items-center justify-center gap-6 text-sm text-noir-500">
              <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> {t('predictionRankingPage.difficulty')}</div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {t('predictionRankingPage.times')}</div>
              <div className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> {t('predictionRankingPage.costs')}</div>
              <div className="flex items-center gap-2"><Globe className="h-4 w-4" />{t('common.lingue')}</div>
              <div className="flex items-center gap-2"><Shield className="h-4 w-4" />{t('common.supportoGs')}</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

