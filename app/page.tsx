'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Gamepad2, 
  Clock,
  RefreshCw,
  Settings,
  Languages,
  BarChart3,
  Sparkles,
  Home,
  Zap,
  FolderOpen,
  Layers,
  Globe,
  Wand2,
  Newspaper,
  ExternalLink,
  MessageCircle,
  Database,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Play,
  Settings2,
  ChevronRight,
  ArrowRight,
  Download
} from 'lucide-react';
import Link from 'next/link';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { ScanButton } from '@/components/scan-button';
import { AINetworkBackground } from '@/components/ui/ai-network-background';
import { activityHistory, Activity, activityColors, activityIcons, ActivityType } from '@/lib/activity-history';
import { useTranslation, translations } from '@/lib/i18n';
import { blogService, BlogPost } from '@/lib/blog';
import { storageManager } from '@/lib/storage-manager';
import { get } from 'idb-keyval';
import { communityHubService, type TranslationPack } from '@/lib/community-hub-service';
import { Users, Star, TrendingUp, Award } from 'lucide-react';

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
}

export default function Dashboard() {
  const { t, language } = useTranslation();
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
    timeSavedMinutes: 0
  });
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<RecentActivityProps[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [communityPacks, setCommunityPacks] = useState<TranslationPack[]>([]);
  const [activityOrder, setActivityOrder] = useState<'newest' | 'oldest'>('newest');
  const [lastGame, setLastGame] = useState<{ id: string; title: string; image: string | null; platform: string; visitedAt: number; appId: string } | null>(null);
  const [activeTranslation, setActiveTranslation] = useState<{ percent: number; translated: number; total: number; lang: string } | null>(null);

  useEffect(() => {
    fetchDashboardData();
    setBlogPosts(blogService.getRecentPosts(5));
    // Carica packs community per lo Spotlight
    communityHubService.searchPacks({ sortBy: 'downloads' }).then(res => {
      setCommunityPacks(res.packs.slice(0, 4));
    }).catch(() => {});
    const interval = setInterval(fetchDashboardData, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      let games: any[] = [];
      
      // Prima prova dalla cache sessione della libreria (già popolata, multi-store)
      try {
        const cached = sessionStorage.getItem('gs_library_games');
        if (cached) {
          const cachedGames = JSON.parse(cached);
          if (Array.isArray(cachedGames) && cachedGames.length > 0) {
            games = cachedGames;
          }
        }
      } catch {}

      // Se non c'è cache, carica da backend
      if (games.length === 0) {
        try {
          const allGames = await invoke('get_games') as any[];
          if (allGames && allGames.length > 0) games = allGames;
        } catch {
          try {
            const steamGames = await invoke('get_steam_games', { apiKey: '', steamId: '', forceRefresh: false }) as any[];
            if (steamGames && steamGames.length > 0) games = steamGames;
          } catch {
            console.log('Dashboard: No games loaded');
          }
        }
      }
      
      // --- Dati reali: Activity History ---
      let savedTranslations: any[] = [];
      let savedPatches: any[] = [];
      
      try {
        const allActivities = await activityHistory.getRecent(500);
        savedTranslations = allActivities.filter((a: Activity) => 
          a.activity_type === 'translation'
        );
        savedPatches = allActivities.filter((a: Activity) => 
          a.activity_type === 'patch' || a.title?.includes('Patch') || a.title?.includes('Applicat')
        );
      } catch (e) {
        // Fallback: IndexedDB
        savedTranslations = await storageManager.getTranslations();
        savedPatches = await storageManager.getPatches();
      }
      
      // --- Dati reali: Translation Memory (backend Rust) ---
      let tmEntries = 0;
      try {
        const tmList = await invoke('list_translation_memories') as any[];
        if (tmList && Array.isArray(tmList)) {
          tmEntries = tmList.reduce((sum: number, tm: any) => sum + (tm.unit_count || tm.unitCount || 0), 0);
        }
      } catch (e) {
        console.log('Dashboard: TM not available', e);
      }
      
      // Tempo risparmiato: ~2 min per entry TM (traduzione manuale) salvati con AI
      const timeSavedMinutes = tmEntries * 2 + savedTranslations.length * 15;
      
      // Conta giochi per piattaforma/store dai dati reali
      const platformCount: Record<string, number> = {};
      games.forEach((g: any) => {
        const p = (g.platform || g.source || 'Steam').toLowerCase();
        const key = p.includes('steam') ? 'steam'
          : p.includes('epic') ? 'epic'
          : p.includes('gog') ? 'gog'
          : p.includes('origin') || p.includes('ea') ? 'origin'
          : p.includes('ubisoft') || p.includes('uplay') ? 'ubisoft'
          : p.includes('battle') ? 'battlenet'
          : p.includes('itch') ? 'itchio'
          : 'steam';
        // Anche dall'id del gioco (es. 'gog_123')
        const idKey = (g.id || g.app_id || '').toString().split('_')[0];
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
      games.forEach((g: any) => {
        const engine = g.engine || 'Unknown';
        engineStats[engine] = (engineStats[engine] || 0) + 1;
      });
      
      const platformStats: Record<string, number> = {};
      games.forEach((g: any) => {
        const platform = g.platform || 'Unknown';
        platformStats[platform] = (platformStats[platform] || 0) + 1;
      });
      
      const completedTranslations = savedTranslations.filter((t: any) => 
        t.status === 'completed' || t.title?.includes('completata')
      ).length || savedTranslations.length;
      
      const translationStats: TranslationStats = {
        total: savedTranslations.length,
        completed: completedTranslations,
        pending: savedTranslations.length - completedTranslations,
        edited: savedTranslations.filter((t: any) => t.status === 'edited').length
      };
      
      let lastScan = new Date(Date.now());
      try {
        const savedLastScan = await get<string>('lastSteamScan');
        if (savedLastScan) {
          lastScan = new Date(savedLastScan);
        }
      } catch (e) {
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
              appId: lg.appId || ''
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
        installedGames: games.filter((g: any) => g.is_installed).length,
        translations: savedTranslations.length,
        patches: savedPatches.length,
        tmEntries,
        timeSavedMinutes,
        lastScan,
        storeStats,
        engineStats,
        platformStats,
        translationStats
      });

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
      } catch (e) {
        setActivities([]);
      }
      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Dashboard loading error:', error);
      setLoading(false);
    }
  };

  return (
    <div className="relative p-4 pt-2 gap-2 overflow-hidden h-full flex flex-col">
      {/* Sfondo AI Network */}
      <AINetworkBackground />
      
      {/* Quick Actions Bar */}
      <div className="shrink-0 relative overflow-hidden rounded-xl bg-black/40 backdrop-blur-md p-2 shadow-lg border border-white/5">
        <div className="grid grid-cols-3 gap-2">
          {/* Action 1: Traduci un gioco */}
          <Link href="/library" className="group relative overflow-hidden rounded-lg border border-white/10 hover:border-emerald-500/50 bg-gradient-to-b from-white/5 to-white/[0.02] hover:from-emerald-500/10 hover:to-emerald-500/5 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <div className="relative p-2.5 flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-500/20 group-hover:bg-emerald-500/30 group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all shadow-sm">
                <Sparkles className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white group-hover:text-emerald-100 transition-colors drop-shadow-sm">{language === 'it' ? 'Traduci un gioco' : 'Translate a game'}</p>
                <p className="text-[10px] text-white/50 group-hover:text-emerald-200/70 transition-colors">{language === 'it' ? 'Libreria o seleziona EXE' : 'Library or pick EXE'}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-emerald-500/0 group-hover:text-emerald-400/80 -translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </Link>

          {/* Action 2: Community Hub */}
          <Link href="/community-hub" className="group relative overflow-hidden rounded-lg border border-white/10 hover:border-amber-500/50 bg-gradient-to-b from-white/5 to-white/[0.02] hover:from-amber-500/10 hover:to-amber-500/5 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <div className="relative p-2.5 flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/20 group-hover:bg-amber-500/30 group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all shadow-sm">
                <Globe className="h-4 w-4 text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white group-hover:text-amber-100 transition-colors drop-shadow-sm">{language === 'it' ? 'Scarica traduzioni' : 'Browse translations'}</p>
                <p className="text-[10px] text-white/50 group-hover:text-amber-200/70 transition-colors">{language === 'it' ? 'Pacchetti della community' : 'Community packages'}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-amber-500/0 group-hover:text-amber-400/80 -translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </Link>

          {/* Action 3: I Miei Progetti */}
          <Link href="/editor" className="group relative overflow-hidden rounded-lg border border-white/10 hover:border-blue-500/50 bg-gradient-to-b from-white/5 to-white/[0.02] hover:from-blue-500/10 hover:to-blue-500/5 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <div className="relative p-2.5 flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/20 group-hover:bg-blue-500/30 group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all shadow-sm">
                <Layers className="h-4 w-4 text-blue-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white group-hover:text-blue-100 transition-colors drop-shadow-sm">{language === 'it' ? 'I miei progetti' : 'My projects'}</p>
                <p className="text-[10px] text-white/50 group-hover:text-blue-200/70 transition-colors">{language === 'it' ? 'Editor locale & revisione' : 'Local editor & review'}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-blue-500/0 group-hover:text-blue-400/80 -translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </Link>
        </div>
      </div>

      {/* Ultimo Gioco + Store Connessi affiancati */}
      <div className="shrink-0 grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Ultimo Gioco Aperto - SINISTRA */}
        {lastGame ? (
          <Link href={`/library/?id=${lastGame.id}&name=${encodeURIComponent(lastGame.title)}&platform=${lastGame.platform}${lastGame.appId ? `&appId=${lastGame.appId}` : ''}${lastGame.image ? `&headerImage=${encodeURIComponent(lastGame.image)}` : ''}`}>
            <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 to-slate-950/60 backdrop-blur-md hover:border-indigo-400/40 hover:shadow-[0_0_15px_rgba(99,102,241,0.15)] transition-all duration-300 cursor-pointer group h-full">
              <CardContent className="p-3 relative overflow-hidden">
                {/* Effetto bagliore on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                
                <div className="flex items-center gap-3 relative z-10">
                  {lastGame.image ? (
                    <img
                      src={lastGame.image}
                      alt={lastGame.title}
                      className="w-[104px] h-[52px] rounded object-cover border border-indigo-500/20 group-hover:border-indigo-400/50 shadow-md transition-colors"
                    />
                  ) : (
                    <div className="w-[104px] h-[52px] rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-md">
                      <Gamepad2 className="h-6 w-6 text-indigo-400/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Play className="h-3 w-3 text-indigo-400" fill="currentColor" />
                      <span className="text-[9px] text-indigo-300/80 uppercase tracking-widest font-semibold">{language === 'en' ? 'Last opened' : 'Ultimo gioco'}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-100 truncate group-hover:text-indigo-200 transition-colors drop-shadow-sm">{lastGame.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[8px] h-4 px-1.5 bg-indigo-950/50 text-indigo-300/80 border-indigo-500/20">{lastGame.platform}</Badge>
                      <span className="text-[9px] text-slate-500">
                        {new Date(lastGame.visitedAt).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {activeTranslation ? (
                    <div className="flex flex-col items-center gap-1 bg-indigo-950/40 p-1.5 rounded-lg border border-indigo-500/10 shadow-inner">
                      <div className="relative h-9 w-9">
                        <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" className="text-indigo-950" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="url(#progressGrad)" strokeWidth="3"
                            strokeDasharray={`${activeTranslation.percent} ${100 - activeTranslation.percent}`} strokeLinecap="round" />
                          <defs><linearGradient id="progressGrad"><stop offset="0%" stopColor="#818cf8"/><stop offset="100%" stopColor="#c084fc"/></linearGradient></defs>
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-100 drop-shadow-md">{activeTranslation.percent}%</span>
                      </div>
                      <span className="text-[8px] font-medium text-indigo-300 uppercase tracking-wider">{activeTranslation.lang}</span>
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-indigo-500/5 flex items-center justify-center text-indigo-400/30 group-hover:text-indigo-300 group-hover:bg-indigo-500/20 transition-all">
                      <ExternalLink className="h-4 w-4" />
                    </div>
                  )}
                </div>
                {activeTranslation && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/auto-translate?gameId=${lastGame.id}&gameName=${encodeURIComponent(lastGame.title)}&installPath=&platform=${lastGame.platform}`; }}
                    className="mt-2.5 relative w-full overflow-hidden rounded group/btn border border-indigo-500/20">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 group-hover/btn:from-indigo-500/30 group-hover/btn:to-purple-500/30 transition-colors" />
                    <div className="relative px-2 py-1.5 flex items-center justify-center gap-1.5 text-[10px] font-medium text-indigo-200">
                      <Zap className="h-3 w-3 text-amber-400" fill="currentColor" /> {language === 'it' ? 'Continua Traduzione' : 'Continue Translation'} <span className="opacity-50">({activeTranslation.translated}/{activeTranslation.total})</span>
                    </div>
                  </button>
                )}
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="border-indigo-500/20 bg-indigo-950/20 backdrop-blur-sm h-full">
            <CardContent className="p-3 flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-indigo-300/40">
                <Gamepad2 className="h-5 w-5" />
                <span className="text-xs">{language === 'en' ? 'No game opened yet' : 'Nessun gioco aperto'}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Store Connessi - DESTRA */}
        <Card className="border-slate-700/30 bg-gradient-to-br from-slate-900/60 to-black/40 backdrop-blur-md h-full">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1 rounded bg-slate-800/80 border border-slate-700/50">
                <Gamepad2 className="h-3.5 w-3.5 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-200 tracking-wide">{language === 'en' ? 'Connected Stores' : 'Store Connessi'}</h3>
              <span className="ml-auto text-xs font-medium bg-slate-800/50 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700/30">
                {Object.values(stats.storeStats).reduce((s, v) => s + v.games, 0)} {language === 'en' ? 'games' : 'giochi'}
              </span>
            </div>
            {Object.values(stats.storeStats).some(s => s.games > 0) ? (
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'steam',     label: 'Steam',      icon: <img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg" className="w-3 h-3 opacity-80" alt="Steam"/>, color: 'text-white', bg: 'bg-gradient-to-r from-[#171a21]/80 to-[#1b2838]/80 border-[#66c0f4]/30 hover:border-[#66c0f4]/60' },
                  { key: 'epic',      label: 'Epic',       icon: <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center"><span className="text-[7px] text-black font-bold">E</span></div>, color: 'text-white', bg: 'bg-gradient-to-r from-[#2a2a2a]/80 to-[#121212]/80 border-white/20 hover:border-white/40' },
                  { key: 'gog',       label: 'GOG',        icon: <div className="w-3 h-3 bg-purple-500 rounded-full"/>, color: 'text-white', bg: 'bg-gradient-to-r from-purple-900/50 to-purple-800/30 border-purple-500/30 hover:border-purple-400/50' },
                  { key: 'ubisoft',   label: 'Ubisoft',    icon: <div className="w-3 h-3 bg-sky-500 rounded-full"/>, color: 'text-sky-100', bg: 'bg-gradient-to-r from-sky-900/50 to-sky-800/30 border-sky-500/30 hover:border-sky-400/50' },
                  { key: 'origin',    label: 'EA/Origin',  icon: <div className="w-3 h-3 bg-orange-500 rounded-full"/>, color: 'text-orange-100', bg: 'bg-gradient-to-r from-orange-900/50 to-orange-800/30 border-orange-500/30 hover:border-orange-400/50' },
                  { key: 'battlenet', label: 'Battle.net', icon: <div className="w-3 h-3 bg-blue-500 rounded-full"/>, color: 'text-blue-100', bg: 'bg-gradient-to-r from-blue-900/50 to-blue-800/30 border-blue-500/30 hover:border-blue-400/50' },
                  { key: 'itchio',    label: 'itch.io',    icon: <div className="w-3 h-3 bg-rose-500 rounded-full"/>, color: 'text-rose-100', bg: 'bg-gradient-to-r from-rose-900/50 to-rose-800/30 border-rose-500/30 hover:border-rose-400/50' },
                ].filter(s => stats.storeStats[s.key]?.games > 0).map(store => (
                  <div key={store.key} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs shadow-sm transition-colors cursor-default ${store.bg}`}>
                    {store.icon}
                    <span className="text-[10px] font-medium text-slate-300">{store.label}</span>
                    <span className={`font-bold ml-0.5 ${store.color}`}>{stats.storeStats[store.key].games}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-2 text-slate-400/40">
                <span className="text-xs">{language === 'en' ? 'No stores connected' : 'Nessuno store connesso'}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Community Spotlight — Agorà */}
      {communityPacks.length > 0 && (
        <Card className="shrink-0 border-purple-500/20 bg-gradient-to-br from-purple-950/40 to-slate-950/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {language === 'it' ? 'Traduzioni dalla community' : 'Community Translations'}
              </h3>
              <Link href="/community-hub" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                {language === 'it' ? 'Esplora tutto' : 'Browse all'} <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {communityPacks.map(pack => (
                <Link key={pack.id} href="/community-hub">
                  <div className="group p-2.5 rounded-lg bg-gradient-to-b from-purple-900/30 to-purple-950/50 border border-purple-500/10 hover:border-purple-500/40 hover:shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-all cursor-pointer">
                    <div className="flex items-center gap-2 mb-1.5">
                      {pack.coverImage ? (
                        <img src={pack.coverImage} alt={pack.gameName} className="w-8 h-8 rounded object-cover shadow-sm" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center shadow-sm">
                          <Gamepad2 className="h-4 w-4 text-purple-400/50" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-purple-100/90 truncate group-hover:text-purple-50 transition-colors drop-shadow-sm">{pack.gameName}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[8px] font-medium px-1 py-0.5 rounded bg-purple-500/20 text-purple-200/80">{pack.sourceLanguage.toUpperCase()}</span>
                          <ArrowRight className="h-2 w-2 text-purple-500/50" />
                          <span className="text-[8px] font-medium px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300/80">{pack.targetLanguage.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-500/10">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400/30" />
                        <span className="text-[10px] font-medium text-amber-300">{pack.rating.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-medium text-purple-300/60">
                        <span className="flex items-center gap-0.5"><Download className="h-2.5 w-2.5" /> {pack.downloads}</span>
                        <span className="text-emerald-400/80">{pack.completionPercentage}%</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid: News (sinistra) + Attività Recenti (destra) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-0 flex-1">
        {/* Mini Blog / News - SINISTRA */}
        <Card className="border-fuchsia-500/30 bg-fuchsia-950/20 backdrop-blur-sm overflow-hidden h-full flex flex-col">
          <CardContent className="p-3 flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-fuchsia-300 flex items-center gap-2">
                <Newspaper className="h-4 w-4" />
                {dash.newsUpdates}
              </h3>
              <Link href="/blog" className="text-xs text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 transition-colors">
                {dash.manage} <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            
            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {blogPosts.length > 0 ? blogPosts.slice(0, 4).map((post) => {
                // Scegli icone/colori in base al tag
                let icon = <Database className="h-3.5 w-3.5" />;
                let colorClass = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
                
                if (post.tag.toLowerCase().includes('ui') || post.tag.toLowerCase().includes('design')) {
                  icon = <Layers className="h-3.5 w-3.5" />;
                  colorClass = 'text-pink-400 bg-pink-500/10 border-pink-500/20';
                } else if (post.tag.toLowerCase().includes('security') || post.tag.toLowerCase().includes('key')) {
                  icon = <Settings2 className="h-3.5 w-3.5" />;
                  colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                } else if (post.tag.toLowerCase().includes('ai') || post.tag.toLowerCase().includes('model')) {
                  icon = <Wand2 className="h-3.5 w-3.5" />;
                  colorClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                } else if (post.tag.toLowerCase().includes('feature') || post.tag.toLowerCase().includes('nuovo')) {
                  icon = <Sparkles className="h-3.5 w-3.5" />;
                  colorClass = 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20';
                }

                return (
                  <Link href="/blog" key={post.id}>
                    <div className="group flex items-center gap-3 p-2 rounded-lg bg-fuchsia-950/30 border border-fuchsia-500/10 hover:border-fuchsia-500/30 hover:bg-fuchsia-900/40 transition-all cursor-pointer">
                      <div className={`p-1.5 rounded-md border flex-shrink-0 transition-colors ${colorClass}`}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] text-fuchsia-300/50">{post.date}</span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded border ${colorClass}`}>{post.tag}</span>
                        </div>
                        <p className="text-[12px] font-medium text-fuchsia-100/90 truncate group-hover:text-white transition-colors">{post.title}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-fuchsia-500/30 group-hover:text-fuchsia-400/80 transition-colors flex-shrink-0" />
                    </div>
                  </Link>
                );
              }) : (
                <div className="flex flex-col items-center justify-center h-full text-fuchsia-300/40 gap-2">
                  <Newspaper className="h-8 w-8 opacity-20" />
                  <p className="text-xs">Nessun aggiornamento recente.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity - DESTRA */}
        <Card className="border-cyan-500/20 bg-cyan-950/20 backdrop-blur-sm overflow-hidden h-full flex flex-col">
          <CardContent className="p-3 flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                <div className="relative">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  <div className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                </div>
                {dash.recentActivity}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActivityOrder(activityOrder === 'newest' ? 'oldest' : 'newest')}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-cyan-300/60 hover:text-cyan-300 hover:bg-cyan-500/10 px-2 py-1 rounded transition-colors"
                  title={activityOrder === 'newest' ? 'Ordina: più recenti prima' : 'Ordina: più vecchi prima'}
                >
                  {activityOrder === 'newest' ? dash.latestActions : (dash.oldestFirst || 'Meno recenti')}
                  {activityOrder === 'newest' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="relative flex items-center justify-center h-12 w-12 rounded-full bg-cyan-900/30 border border-cyan-500/20">
                  <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin" />
                </div>
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-0 relative flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {/* Linea verticale timeline */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-cyan-500/50 via-cyan-500/10 to-transparent z-0" />
                
                {(activityOrder === 'oldest' ? [...activities].reverse() : activities)
                  .filter((activity, index, arr) => 
                    index === 0 || activity.text !== arr[index - 1].text
                  )
                  .slice(0, 4)
                  .map((activity, index) => (
                    <div key={index} className="relative z-10 flex items-start gap-3 py-1.5 group">
                      {/* Nodo timeline */}
                      <div className="flex-shrink-0 mt-0.5 relative flex items-center justify-center w-8 h-8 rounded-full bg-cyan-950 border-2 border-cyan-800 group-hover:border-cyan-500 group-hover:bg-cyan-900 transition-colors shadow-[0_0_10px_rgba(6,182,212,0.1)] group-hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                        <span className="text-[14px]">{activity.icon || '📝'}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0 bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/10 group-hover:border-cyan-500/30 transition-colors">
                        <div className="flex justify-between items-center mb-0.5 gap-2">
                          <p className="text-xs text-cyan-50 truncate font-medium group-hover:text-white transition-colors">{activity.text}</p>
                          <span className="text-[9px] font-medium text-cyan-400/60 whitespace-nowrap">{activity.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className={`h-1.5 w-1.5 rounded-full shadow-sm ${activity.color} shadow-${activity.color.replace('bg-', '')}/50`} />
                          <span className="text-[9px] uppercase tracking-widest text-cyan-300/40 font-semibold">{activity.type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-cyan-300/40 gap-2">
                <Clock className="h-8 w-8 opacity-20" />
                <div className="text-center">
                  <span className="text-xs font-medium block text-cyan-300/60">{dash.noRecentActivity}</span>
                  <span className="text-[10px] opacity-70">{dash.actionsWillAppear}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress Card */}
      {stats.translationStats.total > 0 && (
        <Card className="shrink-0 border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-slate-950/60 backdrop-blur-md">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2 tracking-wide">
                  <Languages className="h-4 w-4" />
                  {dash.translationProgress}
                </h3>
                <Link href="/ai-translator" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group">
                  {dash.newTranslation} <ChevronRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              
              <div className="flex items-center gap-6 bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/10 shadow-inner">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-emerald-200/70 font-medium">{dash.completion}</span>
                    <span className="text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      {stats.translationStats.total > 0 
                        ? Math.round((stats.translationStats.completed / stats.translationStats.total) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <Progress 
                    value={stats.translationStats.total > 0 
                      ? (stats.translationStats.completed / stats.translationStats.total) * 100 
                      : 0} 
                    className="h-2.5 bg-emerald-950"
                  />
                </div>
                
                <div className="flex gap-4">
                  <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-xl font-bold text-emerald-400">{stats.translationStats.completed}</div>
                    <div className="text-[9px] font-semibold text-emerald-200/60 uppercase tracking-widest">{dash.completed}</div>
                  </div>
                  <div className="text-center px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="text-xl font-bold text-amber-400">{stats.translationStats.pending}</div>
                    <div className="text-[9px] font-semibold text-amber-200/60 uppercase tracking-widest">{dash.pending}</div>
                  </div>
                </div>
              </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Footer */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-1.5">
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 p-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-violet-500/20">
              <Languages className="h-3 w-3 text-violet-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-violet-300">{(stats.translationStats.completed + stats.tmEntries).toLocaleString()}</div>
              <div className="text-[8px] text-violet-400/70 uppercase tracking-wider">{dash.totalTranslations}</div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 p-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-emerald-500/20">
              <Gamepad2 className="h-3 w-3 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-300">{stats.patches}</div>
              <div className="text-[8px] text-emerald-400/70 uppercase tracking-wider">{dash.gamesPatched}</div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-amber-500/20">
              <Clock className="h-3 w-3 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-300">{stats.timeSavedMinutes >= 60 ? `${Math.round(stats.timeSavedMinutes / 60)}h` : `${stats.timeSavedMinutes}m`}</div>
              <div className="text-[8px] text-amber-400/70 uppercase tracking-wider">{dash.timeSaved}</div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 p-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-cyan-500/20">
              <Database className="h-3 w-3 text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-cyan-300">{stats.tmEntries.toLocaleString()}</div>
              <div className="text-[8px] text-cyan-400/70 uppercase tracking-wider">{dash.tmEntries}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



