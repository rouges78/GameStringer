'use client';

import { useState, useEffect, useCallback } from 'react';
import { ollamaFetch } from '@/lib/ai/ollama-http';
import { 
  Gamepad2, 
  Clock,
  RefreshCw,
  Sparkles,
  Zap,
  Layers,
  Globe,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Play,
  Cpu,
  Wrench
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InstalledGamesPanel, type HomeGame } from '@/components/home/installed-games-panel';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { activityHistory, Activity, activityColors, activityIcons, ActivityType } from '@/lib/activity-history';
import { useTranslation, translations } from '@/lib/i18n';
import { storageManager } from '@/lib/storage-manager';
import { get } from 'idb-keyval';
import { clientLogger } from '@/lib/client-logger';
import { ollamaArgs } from '@/lib/ai/ollama-endpoint';


interface RecentActivityProps {
  color: string;
  text: string;
  time: string;
  type?: ActivityType;
  icon?: string;
}

interface StoreStats {
  connected: boolean;
  games: number;
}

interface TranslationStats {
  total: number;
  completed: number;
  pending: number;
  edited: number;
}

interface DashboardStats {
  totalGames: number;
  installedGames: number;
  translations: number;
  patches: number;
  lastScan: Date | null;
  storeStats: Record<string, StoreStats>;
  engineStats: Record<string, number>;
  platformStats: Record<string, number>;
  translationStats: TranslationStats;
  tmEntries: number;
  timeSavedMinutes: number;
  estimatedSavings: number;
}

export default function Dashboard() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const dash = translations[language]?.dashboard || translations.it.dashboard;
  const [stats, setStats] = useState<DashboardStats>({
    totalGames: 0,
    installedGames: 0,
    translations: 0,
    patches: 0,
    lastScan: null,
    storeStats: {
      steam: { connected: false, games: 0 },
      epic: { connected: false, games: 0 },
      gog: { connected: false, games: 0 },
      origin: { connected: false, games: 0 },
      ubisoft: { connected: false, games: 0 },
      battlenet: { connected: false, games: 0 },
      itchio: { connected: false, games: 0 }
    },
    engineStats: {},
    platformStats: {},
    translationStats: { total: 0, completed: 0, pending: 0, edited: 0 },
    tmEntries: 0,
    timeSavedMinutes: 0,
    estimatedSavings: 0
  });
  const [_loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [activities, setActivities] = useState<RecentActivityProps[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [_lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activityOrder, setActivityOrder] = useState<'newest' | 'oldest'>('newest');
  const [lastGame, setLastGame] = useState<{ id: string; title: string; image: string | null; platform: string; visitedAt: number; appId: string; installPath: string | null } | null>(null);
  const [activeTranslation, setActiveTranslation] = useState<{ percent: number; translated: number; total: number; lang: string } | null>(null);
  const [installedGames, setInstalledGames] = useState<HomeGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [ollamaStatus, setOllamaStatus] = useState<{ running: boolean; models: number; bestModel: string } | null>(null);
  const [ollamaStarting, setOllamaStarting] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const startOllama = useCallback(async () => {
    if (ollamaStarting || ollamaStatus?.running) return;
    setOllamaStarting(true);
    try {
      // Prova ad avviare Ollama via Tauri backend (solo per start, non per check)
      try {
        const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
        await tauriInvoke('start_ollama', ollamaArgs()).catch(() => {});
      } catch {
        // Non in ambiente Tauri, l'utente deve avviare Ollama manualmente
      }
      // Retry con backoff usando HTTP diretto (no IPC errors)
      const checkIntervals = [2000, 4000, 6000, 10000];
      let found = false;
      for (const delay of checkIntervals) {
        await new Promise(r => setTimeout(r, delay));
        try {
          const r = await ollamaFetch('/api/tags', { timeoutMs: 3000 });
          if (r.ok) {
            const data = await r.json();
            const models = data.models as unknown[];
            setOllamaStatus({ running: true, models: models.length, bestModel: (models[0] as { name?: string })?.name || '' });
            found = true;
            break;
          }
        } catch {}
      }
      if (!found) {
        setOllamaStatus({ running: false, models: 0, bestModel: '' });
      }
      setOllamaStarting(false);
    } catch {
      setOllamaStarting(false);
    }
  }, [ollamaStarting, ollamaStatus]);

  useEffect(() => {
    fetchDashboardData();
    // Ollama status — HTTP diretto (funziona sia in browser che in Tauri)
    (async () => {
      try {
        const r = await ollamaFetch('/api/tags', { timeoutMs: 3000 });
        if (r.ok) {
          const data = await r.json();
          const models = data.models as unknown[];
          setOllamaStatus({ running: true, models: models.length, bestModel: (models[0] as { name?: string })?.name || '' });
        } else {
          setOllamaStatus({ running: false, models: 0, bestModel: '' });
        }
      } catch {
        setOllamaStatus({ running: false, models: 0, bestModel: '' });
      }
    })();
    const interval = setInterval(fetchDashboardData, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load activities FIRST (fast) - prevents empty flash
      if (activities.length === 0) {
        try {
          const recentFromBackend = await activityHistory.getRecent(10);
          const recentActivities = recentFromBackend.map((a: Activity) => ({
            color: `bg-${activityColors[a.activity_type]}-500`,
            text: a.title,
            time: activityHistory.formatRelativeTime(a.timestamp),
            type: a.activity_type,
            icon: activityIcons[a.activity_type]
          }));
          setActivities(recentActivities);
          setActivitiesLoading(false);
        } catch {
          setActivitiesLoading(false);
        }
      }
      
      let games: unknown[] = [];
      
      // Prima prova dalla cache della libreria (multi-store), che la Libreria e
      // la scansione di avvio scrivono in IndexedDB: qui si leggeva
      // sessionStorage, dove nessuno la scrive, e la home ripiegava sempre su get_games.
      try {
        const cachedGames = await get<unknown[]>('gs_library_games');
        if (Array.isArray(cachedGames) && cachedGames.length > 0) {
          games = cachedGames;
        }
      } catch {}

      // Se non c'è cache, carica da backend
      if (games.length === 0) {
        try {
          const allGames = await invoke('get_games') as unknown[];
          if (allGames && allGames.length > 0) games = allGames;
        } catch {
          try {
            const steamGames = await invoke('get_steam_games', { apiKey: '', steamId: '', forceRefresh: false }) as unknown[];
            if (steamGames && steamGames.length > 0) games = steamGames;
          } catch {
            clientLogger.debug('Dashboard: No games loaded');
          }
        }
      }
      
      setInstalledGames((games as HomeGame[]).filter(g => g && (g as { is_installed?: boolean }).is_installed));
      setGamesLoading(false);

      // --- Dati reali: Activity History ---
      let savedTranslations: unknown[] = [];
      let savedPatches: unknown[] = [];
      
      try {
        const allActivities = await activityHistory.getRecent(500);
        savedTranslations = allActivities.filter((a: Activity) => 
          a.activity_type === 'translation'
        );
        savedPatches = allActivities.filter((a: Activity) => 
          a.activity_type === 'patch' || a.title?.includes('Patch') || a.title?.includes('Applicat')
        );
      } catch {
        // Fallback: IndexedDB
        savedTranslations = await storageManager.getTranslations();
        savedPatches = await storageManager.getPatches();
      }
      
      // --- Dati reali: Translation Memory (backend Rust) ---
      let tmEntries = 0;
      try {
        const tmList = await invoke('list_translation_memories') as unknown[];
        if (tmList && Array.isArray(tmList)) {
          tmEntries = tmList.reduce((sum: number, tm: unknown) => sum + ((tm as Record<string, number>).unit_count || (tm as Record<string, number>).unitCount || 0), 0);
        }
      } catch (e: unknown) {
        clientLogger.debug(`Dashboard: TM not available ${String(e)}`);
      }
      
      // Tempo risparmiato: ~2 min per entry TM (traduzione manuale) salvati con AI
      const timeSavedMinutes = tmEntries * 2 + savedTranslations.length * 15;
      
      // Conta giochi per piattaforma/store dai dati reali
      type GameRecord = Record<string, unknown>;
      const platformCount: Record<string, number> = {};
      games.forEach((_g: unknown) => {
        const g = _g as GameRecord;
        const p = (String(g.platform || g.source || 'Steam')).toLowerCase();
        const key = p.includes('steam') ? 'steam'
          : p.includes('epic') ? 'epic'
          : p.includes('gog') ? 'gog'
          : p.includes('origin') || p.includes('ea') ? 'origin'
          : p.includes('ubisoft') || p.includes('uplay') ? 'ubisoft'
          : p.includes('battle') ? 'battlenet'
          : p.includes('itch') ? 'itchio'
          : 'steam';
        // Anche dall'id del gioco (es. 'gog_123')
        const idKey = String(g.id || g.app_id || '').split('_')[0];
        const resolvedKey = idKey === 'gog' ? 'gog' : idKey === 'epic' ? 'epic' : key;
        platformCount[resolvedKey] = (platformCount[resolvedKey] || 0) + 1;
      });

      const storeStats: Record<string, StoreStats> = {
        steam:     { connected: (platformCount.steam || 0) > 0,     games: platformCount.steam || 0 },
        epic:      { connected: (platformCount.epic || 0) > 0,      games: platformCount.epic || 0 },
        gog:       { connected: (platformCount.gog || 0) > 0,       games: platformCount.gog || 0 },
        origin:    { connected: (platformCount.origin || 0) > 0,    games: platformCount.origin || 0 },
        ubisoft:   { connected: (platformCount.ubisoft || 0) > 0,   games: platformCount.ubisoft || 0 },
        battlenet: { connected: (platformCount.battlenet || 0) > 0, games: platformCount.battlenet || 0 },
        itchio:    { connected: (platformCount.itchio || 0) > 0,    games: platformCount.itchio || 0 },
      };
      
      const engineStats: Record<string, number> = {};
      games.forEach((_g: unknown) => {
        const g = _g as GameRecord;
        const engine = String(g.engine || 'Unknown');
        engineStats[engine] = (engineStats[engine] || 0) + 1;
      });

      const platformStats: Record<string, number> = {};
      games.forEach((_g: unknown) => {
        const g = _g as GameRecord;
        const platform = String(g.platform || 'Unknown');
        platformStats[platform] = (platformStats[platform] || 0) + 1;
      });
      
      const completedTranslations = savedTranslations.filter((_t: unknown) => {
        const t = _t as Record<string, unknown>;
        return t.status === 'completed' || (typeof t.title === 'string' && t.title.includes('completata'));
      }).length || savedTranslations.length;
      
      // Risparmio stimato vs localizzazione professionale
      // ~$0.10/parola, ~8 parole/entry TM, ~$150 per file tradotto
      const estimatedSavings = Math.round((tmEntries * 8 * 0.10) + (completedTranslations * 150));
      
      const translationStats: TranslationStats = {
        total: savedTranslations.length,
        completed: completedTranslations,
        pending: savedTranslations.length - completedTranslations,
        edited: savedTranslations.filter((_t: unknown) => (_t as Record<string, unknown>).status === 'edited').length
      };
      
      let lastScan = new Date(Date.now());
      try {
        const savedLastScan = await get<string>('lastSteamScan');
        if (savedLastScan) {
          lastScan = new Date(savedLastScan);
        }
      } catch {
        // Ignora errore
      }

      // Leggi ultimo gioco visitato su GameStringer da localStorage
      try {
        const saved = localStorage.getItem('gs_last_visited_game');
        if (saved) {
          const lg = JSON.parse(saved);
          if (lg && lg.id && lg.title) {
            setLastGame({
              id: lg.id,
              title: lg.title,
              image: lg.image || null,
              platform: lg.platform || 'Steam',
              visitedAt: lg.visitedAt || Date.now(),
              appId: lg.appId || '',
              // Salvato dalla scheda gioco: "Continua traduzione" lo passa al wizard
              installPath: typeof lg.installPath === 'string' && lg.installPath ? lg.installPath : null
            });
          }
        }
      } catch {}

      // Carica checkpoint traduzione attiva per il gioco corrente
      try {
        const saved = localStorage.getItem('gs_last_visited_game');
        if (saved) {
          const lg = JSON.parse(saved);
          if (lg?.id) {
            // Cerca checkpoint per qualsiasi lingua
            const langs = ['it', 'en', 'fr', 'de', 'es', 'pt', 'ja', 'ko', 'zh', 'ru', 'pl'];
            for (const lang of langs) {
              const cp = await get(`gs_translation_checkpoint_${lg.id}_${lang}`);
              if (cp?.translatedCount > 0 && cp?.totalCount > 0) {
                setActiveTranslation({
                  percent: Math.round((cp.translatedCount / cp.totalCount) * 100),
                  translated: cp.translatedCount,
                  total: cp.totalCount,
                  lang: cp.targetLang || lang,
                });
                break;
              }
            }
          }
        }
      } catch {}

      setStats({
        totalGames: games.length,
        installedGames: games.filter((g: unknown) => (g as GameRecord).is_installed).length,
        translations: savedTranslations.length,
        patches: savedPatches.length,
        tmEntries,
        timeSavedMinutes,
        estimatedSavings,
        lastScan,
        storeStats,
        engineStats,
        platformStats,
        translationStats
      });

      // Silently refresh activities (no loading state change)
      try {
        const recentFromBackend = await activityHistory.getRecent(10);
        const recentActivities = recentFromBackend.map((a: Activity) => ({
          color: `bg-${activityColors[a.activity_type]}-500`,
          text: a.title,
          time: activityHistory.formatRelativeTime(a.timestamp),
          type: a.activity_type,
          icon: activityIcons[a.activity_type]
        }));
        setActivities(recentActivities);
      } catch {
        // Keep existing activities on error
      }
      setLastUpdate(new Date());
      setLoading(false);
      setActivitiesLoading(false);
    } catch (error: unknown) {
      clientLogger.error(`Dashboard loading error: ${String(error)}`);
      setLoading(false);
    }
  };

  const totalGames = Object.values(stats.storeStats).reduce((s, v) => s + v.games, 0);
  const totalTranslated = stats.translationStats.completed;

  // Evita flash durante hydration - mostra schermata di caricamento pulita
  if (!isMounted) {
    return (
      <div className="relative overflow-hidden h-full flex flex-col items-center justify-center" style={{ background: 'linear-gradient(180deg, #161618 0%, #0f0f10 60%, #0f0f10 100%)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Gamepad2 className="h-12 w-12 text-rouge-400 animate-pulse" />
            <div className="absolute inset-0 blur-xl bg-rouge-500/20 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-rouge-400 animate-spin" />
            <span className="text-sm text-noir-400">{t('common.loading')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #161618 0%, #0f0f10 60%, #0f0f10 100%)' }}>
      
      {/* ═══ HERO STATS BAR ═══ */}
      <div className="shrink-0 relative overflow-hidden border-b border-noir-700/50" style={{ background: 'linear-gradient(135deg, #161618 0%, #26262a 50%, #161618 100%)' }}>
        <div className="relative px-5 py-2.5 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Link href="/library" className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-rouge-500/20 to-rouge-500/5 hover:from-rouge-500/30 hover:to-rouge-500/15 border border-rouge-500/25 hover:border-rouge-500/50 transition-all hover:shadow-[0_0_20px_rgba(255,59,74,0.15)] hover:-translate-y-0.5">
              <Sparkles className="h-4 w-4 text-rouge-400 group-hover:text-rouge-500" />
              <span className="text-xs font-semibold text-noir-200 group-hover:text-white transition-colors">{t('common.translateAGame')}</span>
            </Link>
            <Link href="/community-hub" className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-noir-700/20 hover:bg-noir-700/40 border border-noir-700/30 hover:border-rouge-400/30 transition-all hover:-translate-y-0.5">
              <Globe className="h-3.5 w-3.5 text-noir-400 group-hover:text-rouge-400" />
              <span className="text-[11px] font-medium text-noir-400 group-hover:text-noir-200">Community</span>
            </Link>
            {/* 23/08/2026: puntava a /editor pur essendo etichettato «Progetti».
                Nella sidebar sono due voci distinte (Progetti → /projects,
                Editor → /editor), quindi da qui si finiva sull'Editor cliccando
                Progetti. Le altre quattro Link verso /editor nel repo sono
                etichettate «editor» e restano come sono: questa era l'unica
                che diceva una cosa e ne faceva un'altra. */}
            <Link href="/projects" className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-noir-700/20 hover:bg-noir-700/40 border border-noir-700/30 hover:border-rouge-400/30 transition-all hover:-translate-y-0.5">
              <Layers className="h-3.5 w-3.5 text-noir-400 group-hover:text-rouge-400" />
              <span className="text-[11px] font-medium text-noir-400 group-hover:text-noir-200">{t('common.projects')}</span>
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-noir-950/60 border border-noir-700/30 transition-opacity duration-300 ${totalGames > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Gamepad2 className="h-3.5 w-3.5 text-rouge-400" />
              <span className="text-sm font-bold text-rouge-400">{totalGames}</span>
              <span className="text-micro text-noir-400 uppercase tracking-wider">{t('common.games')}</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-noir-950/60 border border-emerald-500/20 transition-opacity duration-300 ${(totalTranslated > 0 || stats.tmEntries > 0) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">{(totalTranslated + stats.tmEntries).toLocaleString()}</span>
              <span className="text-micro text-noir-400 uppercase tracking-wider">{t('common.translatedStrings')}</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-noir-950/60 border border-rouge-500/20 transition-opacity duration-300 ${(stats.tmEntries > 0 && totalTranslated > 0) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Zap className="h-3.5 w-3.5 text-rouge-400" />
              <span className="text-sm font-bold text-rouge-400">{stats.tmEntries.toLocaleString()}</span>
              <span className="text-micro text-noir-400 uppercase tracking-wider">TM</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-noir-950/60 border border-amber-500/20 transition-opacity duration-300 ${stats.patches > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Wrench className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-sm font-bold text-amber-400">{stats.patches}</span>
              <span className="text-micro text-noir-400 uppercase tracking-wider">{t('common.patches')}</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-noir-950/60 border border-noir-500/20 transition-opacity duration-300 ${stats.timeSavedMinutes > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Clock className="h-3.5 w-3.5 text-noir-400" />
              <span className="text-sm font-bold text-noir-400">{stats.timeSavedMinutes >= 60 ? `${Math.round(stats.timeSavedMinutes / 60)}h` : `${stats.timeSavedMinutes}m`}</span>
              <span className="text-micro text-noir-400 uppercase tracking-wider">{t('common.saved')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex min-h-0">
        
        {/* ── COLONNA SINISTRA — giochi installati con String it ── */}
        <InstalledGamesPanel games={installedGames} loading={gamesLoading} />

        {/* ── COLONNA DESTRA — Sidebar ── */}
        <div className="w-[340px] shrink-0 flex flex-col min-h-0 overflow-y-auto custom-scrollbar border-l border-noir-700/40 bg-noir-950">
          <div className="p-4 space-y-4">
          
            {/* Ultimo gioco aperto */}
            {lastGame && (
              <div className="group relative rounded-xl overflow-hidden border border-noir-700/40 hover:border-rouge-400/50 transition-all cursor-pointer hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:-translate-y-0.5">
                <Link href={`/library/?id=${lastGame.id}&name=${encodeURIComponent(lastGame.title)}&platform=${lastGame.platform}${lastGame.appId ? `&appId=${lastGame.appId}` : ''}${lastGame.image ? `&headerImage=${encodeURIComponent(lastGame.image)}` : ''}`} className="block">
                  {lastGame.image ? (
                    <div className="relative h-36">
                      <img
                        src={lastGame.image}
                        alt={lastGame.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.style.display = 'none';
                          const parent = img.parentElement;
                          if (parent && !parent.querySelector('.cover-fallback')) {
                            const div = document.createElement('div');
                            div.className = 'cover-fallback absolute inset-0 flex items-center justify-center bg-gradient-to-br from-noir-800 to-noir-900';
                            div.innerHTML = '<span class="text-2xl">&#x1F3AE;</span>';
                            parent.appendChild(div);
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-noir-950 via-noir-950/60 to-transparent opacity-90" />
                      <div className="absolute inset-0 bg-gradient-to-r from-noir-950/80 via-transparent to-transparent opacity-80" />
                      <div className="absolute bottom-0 left-0 right-0 p-3.5">
                        <div className="flex items-center gap-1.5 mb-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <Play className="h-3 w-3 text-rouge-400" fill="currentColor" />
                          <span className="text-micro text-noir-400 uppercase tracking-[0.2em] font-bold">{t('common.lastOpened')}</span>
                        </div>
                        <p className="text-[15px] font-bold text-white truncate drop-shadow-md">{lastGame.title}</p>
                      </div>
                      {activeTranslation && (
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-noir-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-rouge-500/30 shadow-lg">
                          <span className="text-[11px] font-bold text-rouge-400">{activeTranslation.percent}%</span>
                          <span className="text-2xs text-noir-400 uppercase font-bold">{activeTranslation.lang}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-noir-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-12 h-12 rounded-md bg-noir-700/30 flex items-center justify-center">
                          <Gamepad2 className="h-5 w-5 text-rouge-400/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Play className="h-2.5 w-2.5 text-rouge-400" fill="currentColor" />
                            <span className="text-2xs text-noir-400 uppercase tracking-[0.15em] font-bold">{t('common.lastOpened')}</span>
                          </div>
                          <p className="text-xs font-bold text-noir-200 truncate group-hover:text-white transition-colors">{lastGame.title}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </Link>
                {/* Fuori dal <Link> (niente bottone dentro un'ancora). Prima passava
                    installPath= vuoto e il wizard si apriva senza gioco: ora il path
                    salvato dalla scheda gioco, o il wizard lo risolve da gameId; la
                    lingua del checkpoint fa comparire il banner "Riprendi". */}
                {activeTranslation && (
                  <button
                    onClick={() => {
                      const params = new URLSearchParams({ gameId: lastGame.id, gameName: lastGame.title, platform: lastGame.platform, targetLang: activeTranslation.lang });
                      if (lastGame.installPath) params.set('installPath', lastGame.installPath);
                      if (lastGame.image) params.set('gameImage', lastGame.image);
                      router.push(`/auto-translate?${params.toString()}`);
                    }}
                    className="w-full py-2 bg-gradient-to-r from-rouge-500/15 to-rouge-500/5 hover:from-rouge-500/25 hover:to-rouge-500/15 border-t border-noir-700/30 text-2xs font-bold text-rouge-400 flex items-center justify-center gap-1.5 transition-all uppercase tracking-wider">
                    <Zap className="h-3 w-3" fill="currentColor" /> {t('common.continueTranslation')}
                  </button>
                )}
              </div>
            )}

            {/* Attività Recenti */}
            <div className="rounded-lg bg-noir-900 border border-noir-700/50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-noir-900 border-b border-noir-700/50">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Clock className="h-3.5 w-3.5 text-rouge-400" />
                    {activities.length > 0 && <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-rouge-500 animate-pulse" />}
                  </div>
                  <h3 className="text-[11px] font-bold text-noir-100 uppercase tracking-wider">{dash.recentActivity}</h3>
                </div>
                <button
                  onClick={() => setActivityOrder(activityOrder === 'newest' ? 'oldest' : 'newest')}
                  className="flex items-center text-noir-400/60 hover:text-rouge-400 p-1 rounded transition-colors"
                >
                  {activityOrder === 'newest' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                </button>
              </div>
              
              <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                {activities.length > 0 ? (
                  <div className="p-1.5 space-y-0.5">
                    {(activityOrder === 'oldest' ? [...activities].reverse() : activities)
                      .filter((activity, index, arr) =>
                        index === 0 || activity.text !== arr[index - 1].text
                      )
                      .slice(0, 10)
                      .map((activity, index) => (
                        <div key={index} className="group flex items-start gap-2.5 px-2.5 py-2 rounded-md hover:bg-noir-700/15 transition-colors">
                          <span className="text-[13px] flex-shrink-0 mt-0.5">{activity.icon || '📝'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-noir-100 leading-snug group-hover:text-white transition-colors line-clamp-2">{activity.text}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-micro text-noir-400">{activity.time}</span>
                              <span className="text-2xs text-noir-400/60 uppercase tracking-wider">{activity.type}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : activitiesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-4 w-4 text-rouge-400 animate-spin" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-noir-400/30 gap-2">
                    <Clock className="h-6 w-6 opacity-20" />
                    <span className="text-2xs">{dash.noRecentActivity}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ollama Status - Compact */}
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-noir-900/60 border border-noir-700/30">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-rouge-400" />
                <span className="text-micro text-noir-400 uppercase font-medium">Ollama</span>
              </div>
              {ollamaStatus ? (
                ollamaStarting ? (
                  <span className="text-micro font-bold text-yellow-400 flex items-center gap-1">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  </span>
                ) : ollamaStatus.running ? (
                  <span className="text-micro font-bold text-emerald-400">{ollamaStatus.models} models</span>
                ) : (
                  <button onClick={startOllama} className="text-micro font-bold text-red-400 hover:text-red-300">
                    Offline ↗
                  </button>
                )
              ) : (
                <RefreshCw className="h-2.5 w-2.5 text-noir-400 animate-spin" />
              )}
            </div>

            {/* Support banner */}
            <a href="https://ko-fi.com/gamestringer" target="_blank" rel="noopener noreferrer"
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/15 transition-all cursor-pointer">
              <span className="text-base">❤️</span>
              <div className="flex-1 min-w-0">
                <p className="text-2xs font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">
                  {t('common.supportGamestringer')}
                </p>
                <p className="text-2xs text-noir-400/70">
                  {t('common.helpUsMaintainApisAndDevelopment')}
                </p>
              </div>
              <ExternalLink className="h-3 w-3 text-amber-400/50 group-hover:text-amber-400 transition-colors" />
            </a>

          </div>
        </div>
      </div>
    </div>
  );
}




