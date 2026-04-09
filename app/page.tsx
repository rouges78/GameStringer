'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Gamepad2, 
  Clock,
  RefreshCw,
  Sparkles,
  Zap,
  Layers,
  Globe,
  Newspaper,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Play,
  Filter,
  Rss,
  Settings2,
  Cpu,
  Workflow,
  ArrowUpCircle
} from 'lucide-react';
import { decode } from 'html-entities';
import Link from 'next/link';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { activityHistory, Activity, activityColors, activityIcons, ActivityType } from '@/lib/activity-history';
import { useTranslation, translations } from '@/lib/i18n';
import { blogService, BlogPost } from '@/lib/blog';
import { storageManager } from '@/lib/storage-manager';
import { get } from 'idb-keyval';
import { newsFeedService, type NewsFeedItem, FEED_CATEGORIES } from '@/lib/news-feeds';
import { loadBenchmarkHistory, type BenchmarkEntry } from '@/lib/ai-pipeline';
import { clientLogger } from '@/lib/client-logger';

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
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<RecentActivityProps[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [activityOrder, setActivityOrder] = useState<'newest' | 'oldest'>('newest');
  const [lastGame, setLastGame] = useState<{ id: string; title: string; image: string | null; platform: string; visitedAt: number; appId: string } | null>(null);
  const [activeTranslation, setActiveTranslation] = useState<{ percent: number; translated: number; total: number; lang: string } | null>(null);
  const [newsFilter, setNewsFilter] = useState<string>('all');
  const [rssNews, setRssNews] = useState<NewsFeedItem[]>([]);
  const [newsSource, setNewsSource] = useState<'rss' | 'blog'>('rss');
  const [rssLoading, setRssLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ running: boolean; models: number; bestModel: string } | null>(null);
  const [lastBenchmark, setLastBenchmark] = useState<BenchmarkEntry | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [ollamaStarting, setOllamaStarting] = useState(false);
  const newsFeedRef = useRef<HTMLDivElement>(null);

  const handleNewsScroll = useCallback(() => {
    if (newsFeedRef.current) {
      setShowScrollTop(newsFeedRef.current.scrollTop > 400);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    newsFeedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const startOllama = useCallback(async () => {
    if (ollamaStarting || ollamaStatus?.running) return;
    setOllamaStarting(true);
    try {
      const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
      // Avvia Ollama via backend Tauri (bypassa CORS)
      await tauriInvoke('start_ollama').catch(() => {});
      // Retry con backoff: Ollama può impiegare fino a 15s ad avviarsi
      const checkIntervals = [2000, 4000, 6000, 10000];
      let found = false;
      for (const delay of checkIntervals) {
        await new Promise(r => setTimeout(r, delay));
        try {
          const status = await tauriInvoke<{ installed: boolean; running: boolean; models: string[] }>('check_ollama_status');
          if (status.running) {
            setOllamaStatus({
              running: true,
              models: status.models?.length || 0,
              bestModel: status.models?.[0] || '',
            });
            found = true;
            break;
          }
        } catch {}
      }
      if (!found) {
        // Ultimo tentativo diretto
        try {
          const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
          if (r.ok) {
            const data = await r.json();
            const models = data.models as unknown[];
            setOllamaStatus({ running: true, models: models.length, bestModel: (models[0] as { name?: string })?.name || '' });
            found = true;
          }
        } catch {}
        if (!found) {
          setOllamaStatus({ running: false, models: 0, bestModel: '' });
        }
      }
      setOllamaStarting(false);
    } catch {
      setOllamaStarting(false);
    }
  }, [ollamaStarting, ollamaStatus]);

  useEffect(() => {
    fetchDashboardData();
    setBlogPosts(blogService.getRecentPosts(5));
    // Carica news RSS
    const cachedNews = newsFeedService.getCachedNews();
    if (cachedNews.length > 0) {
      setRssNews(cachedNews);
    }
    setRssLoading(true);
    newsFeedService.fetchNews().then(items => {
      setRssNews(items);
      setRssLoading(false);
    }).catch(() => setRssLoading(false));
    // Ollama status — use Tauri backend to avoid CORS issues with direct fetch
    (async () => {
      try {
        const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
        const status = await tauriInvoke<{ installed: boolean; running: boolean; models: string[] }>('check_ollama_status');
        setOllamaStatus({
          running: status.running,
          models: status.models?.length || 0,
          bestModel: status.models?.[0] || '',
        });
      } catch {
        // Fallback: try direct fetch (works if OLLAMA_ORIGINS is set)
        try {
          const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
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
      }
    })();
    // Ultimo benchmark
    const history = loadBenchmarkHistory();
    if (history.length > 0) setLastBenchmark(history[history.length - 1]);
    const interval = setInterval(fetchDashboardData, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      let games: unknown[] = [];
      
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
      } catch (e: unknown) {
        // Fallback: IndexedDB
        savedTranslations = await storageManager.getTranslations();
        savedPatches = await storageManager.getPatches();
      }
      
      // --- Dati reali: Translation Memory (backend Rust) ---
      let tmEntries = 0;
      try {
        const tmList = await invoke('list_translation_memories') as unknown[];
        if (tmList && Array.isArray(tmList)) {
          tmEntries = tmList.reduce((sum: number, tm: unknown) => sum + (tm.unit_count || tm.unitCount || 0), 0);
        }
      } catch (e: unknown) {
        clientLogger.debug('Dashboard: TM not available', e);
      }
      
      // Tempo risparmiato: ~2 min per entry TM (traduzione manuale) salvati con AI
      const timeSavedMinutes = tmEntries * 2 + savedTranslations.length * 15;
      
      // Conta giochi per piattaforma/store dai dati reali
      const platformCount: Record<string, number> = {};
      games.forEach((g: unknown) => {
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
      games.forEach((g: unknown) => {
        const engine = g.engine || 'Unknown';
        engineStats[engine] = (engineStats[engine] || 0) + 1;
      });
      
      const platformStats: Record<string, number> = {};
      games.forEach((g: unknown) => {
        const platform = g.platform || 'Unknown';
        platformStats[platform] = (platformStats[platform] || 0) + 1;
      });
      
      const completedTranslations = savedTranslations.filter((t: unknown) => 
        t.status === 'completed' || t.title?.includes('completata')
      ).length || savedTranslations.length;
      
      // Risparmio stimato vs localizzazione professionale
      // ~$0.10/parola, ~8 parole/entry TM, ~$150 per file tradotto
      const estimatedSavings = Math.round((tmEntries * 8 * 0.10) + (completedTranslations * 150));
      
      const translationStats: TranslationStats = {
        total: savedTranslations.length,
        completed: completedTranslations,
        pending: savedTranslations.length - completedTranslations,
        edited: savedTranslations.filter((t: unknown) => t.status === 'edited').length
      };
      
      let lastScan = new Date(Date.now());
      try {
        const savedLastScan = await get<string>('lastSteamScan');
        if (savedLastScan) {
          lastScan = new Date(savedLastScan);
        }
      } catch (e: unknown) {
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
        installedGames: games.filter((g: unknown) => g.is_installed).length,
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
      } catch (e: unknown) {
        setActivities([]);
      }
      setLastUpdate(new Date());
      setLoading(false);
    } catch (error: unknown) {
      clientLogger.error('Dashboard loading error:', error);
      setLoading(false);
    }
  };

  const filteredPosts = blogPosts.filter(post => 
    newsFilter === 'all' || post.gameName === newsFilter || post.tag === newsFilter
  );

  const filteredRss = rssNews.filter(item =>
    newsFilter === 'all' || item.category === newsFilter || item.sourceId === newsFilter
  );

  const uniqueGameNames = [...new Set(blogPosts.map(p => p.gameName).filter(Boolean))] as string[];
  const uniqueTags = [...new Set(blogPosts.map(p => p.tag).filter(Boolean))];
  const uniqueRssCategories = [...new Set(rssNews.map(n => n.category))];

  const totalGames = Object.values(stats.storeStats).reduce((s, v) => s + v.games, 0);
  const totalTranslated = stats.translationStats.completed;

  return (
    <div className="relative overflow-hidden h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #141c27 0%, #0f1923 60%, #0a1018 100%)' }}>
      
      {/* ═══ HERO STATS BAR ═══ */}
      <div className="shrink-0 relative overflow-hidden border-b border-[#2a475e]/50" style={{ background: 'linear-gradient(135deg, #1b2838 0%, #1e3a52 50%, #1b2838 100%)' }}>
        <div className="relative px-5 py-2.5 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Link href="/library" className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#1a9fff]/20 to-[#1a9fff]/5 hover:from-[#1a9fff]/30 hover:to-[#1a9fff]/15 border border-[#1a9fff]/25 hover:border-[#1a9fff]/50 transition-all hover:shadow-[0_0_20px_rgba(26,159,255,0.15)] hover:-translate-y-0.5">
              <Sparkles className="h-4 w-4 text-[#67c1f5] group-hover:text-[#1a9fff]" />
              <span className="text-xs font-semibold text-[#c6d4df] group-hover:text-white transition-colors">{language === 'it' ? 'Traduci un gioco' : 'Translate a game'}</span>
            </Link>
            <Link href="/community-hub" className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a475e]/20 hover:bg-[#2a475e]/40 border border-[#2a475e]/30 hover:border-[#67c1f5]/30 transition-all hover:-translate-y-0.5">
              <Globe className="h-3.5 w-3.5 text-[#8f98a0] group-hover:text-[#67c1f5]" />
              <span className="text-[11px] font-medium text-[#8f98a0] group-hover:text-[#c6d4df]">Community</span>
            </Link>
            <Link href="/editor" className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a475e]/20 hover:bg-[#2a475e]/40 border border-[#2a475e]/30 hover:border-[#67c1f5]/30 transition-all hover:-translate-y-0.5">
              <Layers className="h-3.5 w-3.5 text-[#8f98a0] group-hover:text-[#67c1f5]" />
              <span className="text-[11px] font-medium text-[#8f98a0] group-hover:text-[#c6d4df]">{language === 'it' ? 'Progetti' : 'Projects'}</span>
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0e1419]/60 border border-[#2a475e]/30 transition-opacity duration-300 ${totalGames > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Gamepad2 className="h-3.5 w-3.5 text-[#67c1f5]" />
              <span className="text-sm font-bold text-[#67c1f5]">{totalGames}</span>
              <span className="text-micro text-[#8f98a0] uppercase tracking-wider">{language === 'it' ? 'giochi' : 'games'}</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0e1419]/60 border border-emerald-500/20 transition-opacity duration-300 ${(totalTranslated > 0 || stats.tmEntries > 0) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">{(totalTranslated + stats.tmEntries).toLocaleString()}</span>
              <span className="text-micro text-[#8f98a0] uppercase tracking-wider">{language === 'it' ? 'stringhe tradotte' : 'translated strings'}</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0e1419]/60 border border-purple-500/20 transition-opacity duration-300 ${(stats.tmEntries > 0 && totalTranslated > 0) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Zap className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-sm font-bold text-purple-400">{stats.tmEntries.toLocaleString()}</span>
              <span className="text-micro text-[#8f98a0] uppercase tracking-wider">TM</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex min-h-0">
        
        {/* ── COLONNA SINISTRA — News Feed ── */}
        <div className="flex-[3] flex flex-col min-h-0 border-r border-[#2a475e]/40">
          {/* Tab bar */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#2a475e]/40 bg-[#0d1520]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setNewsSource('rss'); setNewsFilter('all'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${
                  newsSource === 'rss' 
                    ? 'bg-[#1a9fff]/15 text-[#67c1f5] shadow-[0_0_8px_rgba(26,159,255,0.1)]' 
                    : 'text-[#8f98a0] hover:text-[#c6d4df] hover:bg-[#2a475e]/20'
                }`}
              >
                <Rss className="h-3.5 w-3.5" /> Feed
                {rssNews.length > 0 && <span className={`text-micro ml-0.5 px-1.5 py-0.5 rounded-full ${newsSource === 'rss' ? 'bg-[#1a9fff]/20 text-[#67c1f5]' : 'bg-[#2a475e]/30 text-[#8f98a0]'}`}>{rssNews.length}</span>}
                {rssLoading && <RefreshCw className="h-2.5 w-2.5 animate-spin opacity-50" />}
              </button>
              <button
                onClick={() => { setNewsSource('blog'); setNewsFilter('all'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${
                  newsSource === 'blog' 
                    ? 'bg-[#1a9fff]/15 text-[#67c1f5] shadow-[0_0_8px_rgba(26,159,255,0.1)]' 
                    : 'text-[#8f98a0] hover:text-[#c6d4df] hover:bg-[#2a475e]/20'
                }`}
              >
                <Newspaper className="h-3.5 w-3.5" /> {language === 'it' ? 'Mie Notizie' : 'My News'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={newsFilter}
                onChange={(e) => setNewsFilter(e.target.value)}
                className="text-2xs bg-[#0d1520] border border-[#2a475e]/60 rounded-md px-2.5 py-1.5 text-[#c6d4df] hover:border-[#67c1f5]/50 focus:border-[#67c1f5] focus:outline-none focus:ring-1 focus:ring-[#67c1f5]/20 transition-all cursor-pointer"
              >
                {newsSource === 'rss' ? (
                  <>
                    <option value="all">{language === 'it' ? 'Tutte le categorie' : 'All categories'}</option>
                    {uniqueRssCategories.map(cat => {
                      const info = FEED_CATEGORIES.find(c => c.id === cat);
                      return info ? <option key={cat} value={cat}>{info.icon} {info.labels?.[language] || info.labels?.['en'] || info.id}</option> : null;
                    })}
                  </>
                ) : (
                  <>
                    <option value="all">{language === 'it' ? 'Tutte le notizie' : 'All news'}</option>
                    {uniqueGameNames.map(g => <option key={g} value={g}>{g}</option>)}
                    {uniqueTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                  </>
                )}
              </select>
              <Link href={newsSource === 'rss' ? '/news-feeds' : '/blog'} className="text-[#1a9fff]/60 hover:text-[#67c1f5] transition-colors">
                <Settings2 className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* News Feed scrollabile — altezza fissa adattata alla viewport */}
          <div ref={newsFeedRef} onScroll={handleNewsScroll} className="relative flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-4 space-y-1">
            {newsSource === 'rss' ? (
              filteredRss.length > 0 ? filteredRss.slice(0, 50).map((item, idx) => (
                <a href={item.link} target="_blank" rel="noopener noreferrer" key={item.id}>
                  <div className="group animate-fade-in" style={{ animationDelay: `${Math.min(idx * 25, 250)}ms` }}>
                    {(idx === 0 || filteredRss[idx - 1]?.pubDate !== item.pubDate) && (
                      <div className="flex items-center gap-3 py-2.5 mt-1 first:mt-0">
                        <div className="h-px flex-1 bg-gradient-to-r from-[#2a475e] to-transparent" />
                        <span className="text-2xs font-bold text-[#8f98a0] uppercase tracking-[0.2em]">{item.pubDate}</span>
                        <div className="h-px flex-1 bg-gradient-to-l from-[#2a475e] to-transparent" />
                      </div>
                    )}
                    
                    <div className="relative flex gap-3.5 p-3 rounded-lg bg-[#1b2838] hover:bg-[#1e2d3d] border border-[#2a475e]/40 hover:border-[#3d6a8e] transition-all cursor-pointer mb-1.5 overflow-hidden group-hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                      
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="relative w-[180px] h-[100px] rounded-md object-cover flex-shrink-0 border border-black/20 shadow-lg group-hover:shadow-xl transition-shadow" />
                      ) : (
                        <div className="relative w-[80px] h-[80px] mt-1 rounded-md flex-shrink-0 border border-[#2a475e]/60 flex flex-col items-center justify-center bg-gradient-to-br from-[#243447] to-[#1b2838] shadow-sm">
                          <span className="text-3xl opacity-80 drop-shadow-md">{item.sourceIcon}</span>
                        </div>
                      )}

                      <div className="relative flex-1 min-w-0 flex flex-col py-0.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-micro font-bold text-[#67c1f5] uppercase tracking-widest">{item.sourceName}</span>
                          {(() => { const ci = FEED_CATEGORIES.find(c => c.id === item.category); return ci ? <span className="text-2xs px-1.5 py-0.5 rounded-md font-semibold" style={{ color: ci.color, backgroundColor: ci.color + '22', border: `1px solid ${ci.color}44` }}>{ci.icon} {ci.labels?.[language] || ci.labels?.['en'] || ci.id}</span> : null; })()}
                        </div>
                        <h3 className="text-[13px] font-bold text-[#e5e9ed] group-hover:text-white leading-snug transition-colors line-clamp-2">
                          {decode(item.title)}
                        </h3>
                        <p className={`text-[11px] text-[#8f98a0] leading-relaxed mt-1.5 ${item.image ? 'line-clamp-2' : 'line-clamp-3'}`}>
                          {decode(item.description)}
                        </p>
                        <div className="flex items-center gap-2 mt-auto pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="h-3 w-3 text-[#1a9fff]/60" />
                          <span className="text-micro text-[#1a9fff]/60">{language === 'it' ? 'Leggi articolo' : 'Read article'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </a>
              )) : (
                <div className="flex flex-col items-center justify-center h-full text-[#8f98a0]/40 gap-4 py-16">
                  {rssLoading ? (
                    <>
                      <div className="relative">
                        <RefreshCw className="h-8 w-8 opacity-30 animate-spin" />
                        <div className="absolute inset-0 blur-lg bg-[#1a9fff]/10 rounded-full animate-pulse" />
                      </div>
                      <p className="text-xs text-[#8f98a0]/60">{language === 'it' ? 'Caricamento feed...' : 'Loading feeds...'}</p>
                      <div className="w-full max-w-lg space-y-3 mt-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="flex gap-3.5 p-3 rounded-lg bg-[#16202d]/60 animate-pulse">
                            <div className="w-[200px] h-[100px] rounded-md bg-[#2a475e]/20 flex-shrink-0" />
                            <div className="flex-1 space-y-3 py-1">
                              <div className="h-2 bg-[#2a475e]/20 rounded-full w-1/4" />
                              <div className="h-3.5 bg-[#2a475e]/25 rounded w-3/4" />
                              <div className="h-2.5 bg-[#2a475e]/15 rounded w-full" />
                              <div className="h-2.5 bg-[#2a475e]/15 rounded w-2/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <Rss className="h-12 w-12 opacity-20" />
                        <div className="absolute inset-0 blur-xl bg-[#1a9fff]/5 rounded-full" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-[#8f98a0]/50">{language === 'it' ? 'Nessun feed attivo' : 'No active feeds'}</p>
                        <Link href="/news-feeds" className="text-xs text-[#1a9fff] hover:text-[#67c1f5] mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1a9fff]/10 hover:bg-[#1a9fff]/20 border border-[#1a9fff]/20 transition-all">
                          <Settings2 className="h-3.5 w-3.5" />
                          {language === 'it' ? 'Configura i feed' : 'Configure feeds'}
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )
            ) : (
              filteredPosts.length > 0 ? filteredPosts.map((post, idx) => (
                <Link href="/blog" key={post.id}>
                  <div className="group animate-fade-in" style={{ animationDelay: `${Math.min(idx * 25, 250)}ms` }}>
                    {(idx === 0 || filteredPosts[idx - 1]?.date !== post.date) && (
                      <div className="flex items-center gap-3 py-2.5 mt-1 first:mt-0">
                        <div className="h-px flex-1 bg-gradient-to-r from-[#2a475e] to-transparent" />
                        <span className="text-2xs font-bold text-[#8f98a0] uppercase tracking-[0.2em]">{post.date}</span>
                        <div className="h-px flex-1 bg-gradient-to-l from-[#2a475e] to-transparent" />
                      </div>
                    )}
                    
                    <div className="relative flex gap-3.5 p-3 rounded-lg bg-[#1b2838] hover:bg-[#1e2d3d] border border-[#2a475e]/40 hover:border-[#3d6a8e] transition-all cursor-pointer mb-1.5 overflow-hidden group-hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                      {post.image ? (
                        <img src={post.image} alt={post.title} className="w-[200px] h-[110px] rounded-md object-cover flex-shrink-0 border border-black/20 shadow-lg" />
                      ) : (
                        <div className="w-[200px] h-[110px] rounded-md flex-shrink-0 border border-[#2a475e]/30 flex items-center justify-center"
                          style={{ background: 'linear-gradient(145deg, #1b2838 0%, #243447 50%, #1b2838 100%)' }}>
                          {post.gameName ? (
                            <span className="text-[11px] font-bold text-[#67c1f5]/50 text-center px-3">{post.gameName}</span>
                          ) : (
                            <Newspaper className="h-8 w-8 text-[#67c1f5]/15" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <span className="text-micro font-bold text-[#8f98a0] uppercase tracking-widest">{post.tag || (language === 'it' ? 'NOTIZIE' : 'NEWS')}</span>
                          <h3 className="text-[13px] font-bold text-[#e5e9ed] group-hover:text-white leading-snug transition-colors line-clamp-2 mt-1">
                            {post.title}
                          </h3>
                        </div>
                        <p className="text-[11px] text-[#8f98a0] line-clamp-2 leading-relaxed mt-1.5">
                          {post.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="flex flex-col items-center justify-center h-full text-[#8f98a0]/40 gap-4 py-16">
                  <Newspaper className="h-12 w-12 opacity-15" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#8f98a0]/50">{language === 'it' ? 'Nessuna notizia' : 'No news yet'}</p>
                    <Link href="/blog" className="text-xs text-[#1a9fff] hover:text-[#67c1f5] mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1a9fff]/10 hover:bg-[#1a9fff]/20 border border-[#1a9fff]/20 transition-all">
                      {language === 'it' ? 'Scrivi la prima notizia' : 'Write the first news'}
                    </Link>
                  </div>
                </div>
              )
            )}
            </div>

            {/* Bottone Torna in cima */}
            {showScrollTop && (
              <button
                onClick={scrollToTop}
                title={language === 'it' ? 'Torna in cima' : 'Back to top'}
                className="sticky bottom-4 ml-auto mr-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a9fff]/90 hover:bg-[#1a9fff] text-white text-2xs font-bold shadow-lg shadow-[#1a9fff]/20 hover:shadow-[#1a9fff]/40 transition-all hover:-translate-y-0.5 backdrop-blur-sm z-10"
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
                {language === 'it' ? 'Torna in cima' : 'Back to top'}
              </button>
            )}
          </div>
        </div>

        {/* ── COLONNA DESTRA — Sidebar ── */}
        <div className="w-[340px] shrink-0 flex flex-col min-h-0 overflow-y-auto custom-scrollbar border-l border-[#2a475e]/40 bg-[#111a24]">
          <div className="p-4 space-y-4">
          
            {/* Ultimo gioco aperto */}
            {lastGame && (
              <Link href={`/library/?id=${lastGame.id}&name=${encodeURIComponent(lastGame.title)}&platform=${lastGame.platform}${lastGame.appId ? `&appId=${lastGame.appId}` : ''}${lastGame.image ? `&headerImage=${encodeURIComponent(lastGame.image)}` : ''}`}>
                <div className="group relative rounded-xl overflow-hidden border border-[#2a475e]/40 hover:border-[#67c1f5]/50 transition-all cursor-pointer hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:-translate-y-0.5">
                  {lastGame.image ? (
                    <div className="relative h-36">
                      <img src={lastGame.image} alt={lastGame.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0e1419] via-[#0e1419]/60 to-transparent opacity-90" />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0e1419]/80 via-transparent to-transparent opacity-80" />
                      <div className="absolute bottom-0 left-0 right-0 p-3.5">
                        <div className="flex items-center gap-1.5 mb-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <Play className="h-3 w-3 text-[#67c1f5]" fill="currentColor" />
                          <span className="text-micro text-[#8f98a0] uppercase tracking-[0.2em] font-bold">{language === 'it' ? 'Ultimo gioco' : 'Last opened'}</span>
                        </div>
                        <p className="text-[15px] font-bold text-white truncate drop-shadow-md">{lastGame.title}</p>
                      </div>
                      {activeTranslation && (
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-[#0e1419]/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-[#1a9fff]/30 shadow-lg">
                          <span className="text-[11px] font-bold text-[#67c1f5]">{activeTranslation.percent}%</span>
                          <span className="text-2xs text-[#8f98a0] uppercase font-bold">{activeTranslation.lang}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-[#16202d]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-12 h-12 rounded-md bg-[#2a475e]/30 flex items-center justify-center">
                          <Gamepad2 className="h-5 w-5 text-[#67c1f5]/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Play className="h-2.5 w-2.5 text-[#67c1f5]" fill="currentColor" />
                            <span className="text-2xs text-[#8f98a0] uppercase tracking-[0.15em] font-bold">{language === 'it' ? 'Ultimo gioco' : 'Last opened'}</span>
                          </div>
                          <p className="text-xs font-bold text-[#c6d4df] truncate group-hover:text-white transition-colors">{lastGame.title}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTranslation && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/auto-translate?gameId=${lastGame.id}&gameName=${encodeURIComponent(lastGame.title)}&installPath=&platform=${lastGame.platform}`; }}
                      className="w-full py-2 bg-gradient-to-r from-[#1a9fff]/15 to-[#1a9fff]/5 hover:from-[#1a9fff]/25 hover:to-[#1a9fff]/15 border-t border-[#2a475e]/30 text-2xs font-bold text-[#67c1f5] flex items-center justify-center gap-1.5 transition-all uppercase tracking-wider">
                      <Zap className="h-3 w-3" fill="currentColor" /> {language === 'it' ? 'Continua Traduzione' : 'Continue Translation'}
                    </button>
                  )}
                </div>
              </Link>
            )}

            {/* Attività Recenti */}
            <div className="rounded-lg bg-[#1b2838] border border-[#2a475e]/50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-[#15202e] border-b border-[#2a475e]/50">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Clock className="h-3.5 w-3.5 text-[#67c1f5]" />
                    {activities.length > 0 && <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#1a9fff] animate-pulse" />}
                  </div>
                  <h3 className="text-[11px] font-bold text-[#e5e9ed] uppercase tracking-wider">{dash.recentActivity}</h3>
                </div>
                <button
                  onClick={() => setActivityOrder(activityOrder === 'newest' ? 'oldest' : 'newest')}
                  className="flex items-center text-[#8f98a0]/60 hover:text-[#67c1f5] p-1 rounded transition-colors"
                >
                  {activityOrder === 'newest' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                </button>
              </div>
              
              <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-4 w-4 text-[#67c1f5] animate-spin" />
                  </div>
                ) : activities.length > 0 ? (
                  <div className="p-1.5 space-y-0.5">
                    {(activityOrder === 'oldest' ? [...activities].reverse() : activities)
                      .filter((activity, index, arr) => 
                        index === 0 || activity.text !== arr[index - 1].text
                      )
                      .slice(0, 10)
                      .map((activity, index) => (
                        <div key={index} className="group flex items-start gap-2.5 px-2.5 py-2 rounded-md hover:bg-[#2a475e]/15 transition-colors">
                          <span className="text-[13px] flex-shrink-0 mt-0.5">{activity.icon || '📝'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-[#e5e9ed] leading-snug group-hover:text-white transition-colors line-clamp-2">{activity.text}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-micro text-[#8f98a0]">{activity.time}</span>
                              <span className="text-2xs text-[#8f98a0]/60 uppercase tracking-wider">{activity.type}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-[#8f98a0]/30 gap-2">
                    <Clock className="h-6 w-6 opacity-20" />
                    <span className="text-2xs">{dash.noRecentActivity}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-[#1b2838] border border-[#2a475e]/50 p-2.5 text-center hover:border-[#67c1f5]/40 transition-colors">
                <div className="text-base font-bold text-[#67c1f5]">{totalTranslated.toLocaleString()}</div>
                <div className="text-2xs text-[#8f98a0] uppercase tracking-wider mt-0.5 font-medium">{dash.totalTranslations}</div>
              </div>
              <div className="rounded-lg bg-[#1b2838] border border-[#2a475e]/50 p-2.5 text-center hover:border-[#67c1f5]/40 transition-colors">
                <div className="text-base font-bold text-[#67c1f5]">{stats.patches}</div>
                <div className="text-2xs text-[#8f98a0] uppercase tracking-wider mt-0.5 font-medium">{dash.gamesPatched}</div>
              </div>
              <div className="rounded-lg bg-[#1b2838] border border-[#2a475e]/50 p-2.5 text-center hover:border-[#67c1f5]/40 transition-colors">
                <div className="text-base font-bold text-[#67c1f5]">{stats.timeSavedMinutes >= 60 ? `${Math.round(stats.timeSavedMinutes / 60)}h` : `${stats.timeSavedMinutes}m`}</div>
                <div className="text-2xs text-[#8f98a0] uppercase tracking-wider mt-0.5 font-medium">{dash.timeSaved}</div>
              </div>
            </div>

            {/* Ollama + Pipeline Status */}
            <div className="rounded-lg bg-[#1b2838] border border-[#2a475e]/50 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#15202e] border-b border-[#2a475e]/50">
                <Cpu className="h-3.5 w-3.5 text-[#67c1f5]" />
                <h3 className="text-[11px] font-bold text-[#e5e9ed] uppercase tracking-wider">{t('settings.ollamaSettings') || 'AI Engine'}</h3>
                {ollamaStatus && (
                  <button
                    onClick={!ollamaStatus.running ? startOllama : undefined}
                    title={ollamaStatus.running ? `Ollama — ${ollamaStatus.models} ${t('settings.availableModels') || 'models'}` : t('settings.startOllama') || 'Start Ollama'}
                    className={`ml-auto h-2 w-2 rounded-full transition-all ${ollamaStatus.running ? 'bg-emerald-400' : ollamaStarting ? 'bg-yellow-400 animate-pulse' : 'bg-red-400 hover:bg-red-300 cursor-pointer hover:scale-125'}`}
                  />
                )}
              </div>
              <div className="p-3 space-y-2">
                {ollamaStatus ? (
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-[#8f98a0]">Ollama</span>
                    {ollamaStarting ? (
                      <span className="text-2xs font-bold text-yellow-400 flex items-center gap-1">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" /> {t('common.loading') || 'Starting...'}
                      </span>
                    ) : ollamaStatus.running ? (
                      <span className="text-2xs font-bold text-emerald-400">{ollamaStatus.models} {t('settings.availableModels') || 'models'}</span>
                    ) : (
                      <button
                        onClick={startOllama}
                        title={t('settings.startOllama') || 'Start Ollama'}
                        className="text-2xs font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                      >
                        Offline — {t('settings.startOllama') || 'Start'} ↗
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-[#8f98a0]">Ollama</span>
                    <RefreshCw className="h-2.5 w-2.5 text-[#8f98a0] animate-spin" />
                  </div>
                )}
                {lastBenchmark && (
                  <>
                    <div className="h-px bg-[#2a475e]/30" />
                    <Link href="/ai-pipeline" className="block group">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Workflow className="h-2.5 w-2.5 text-violet-400" />
                        <span className="text-micro text-[#8f98a0] uppercase tracking-wider font-bold">{language === 'it' ? 'Ultimo Pipeline' : 'Last Pipeline'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xs text-[#c6d4df] group-hover:text-white transition-colors">{lastBenchmark.presetName}</span>
                        <span className={`text-xs font-bold ${lastBenchmark.averageScore >= 80 ? 'text-emerald-400' : lastBenchmark.averageScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {lastBenchmark.averageScore}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-micro text-[#8f98a0]">
                        <span>{lastBenchmark.totalStrings} str</span>
                        <span>{(lastBenchmark.totalDurationMs / 1000).toFixed(1)}s</span>
                        <span>{lastBenchmark.msPerString}ms/str</span>
                      </div>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Support banner */}
            <a href="https://ko-fi.com/gamestringer" target="_blank" rel="noopener noreferrer"
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/15 transition-all cursor-pointer">
              <span className="text-base">❤️</span>
              <div className="flex-1 min-w-0">
                <p className="text-2xs font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">
                  {language === 'it' ? 'Supporta GameStringer' : 'Support GameStringer'}
                </p>
                <p className="text-2xs text-[#8f98a0]/70">
                  {language === 'it' ? 'Aiutaci a mantenere le API e lo sviluppo' : 'Help us maintain APIs and development'}
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



