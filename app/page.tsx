'use client';

import { useState, useEffect } from 'react';
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
  Play
} from 'lucide-react';
import Link from 'next/link';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { ScanButton } from '@/components/scan-button';
import { AINetworkBackground } from '@/components/ui/ai-network-background';
import { RssTicker } from '@/components/ui/rss-ticker';
import { activityHistory, Activity, activityColors, activityIcons, ActivityType } from '@/lib/activity-history';
import { useTranslation, translations } from '@/lib/i18n';
import { blogService, BlogPost } from '@/lib/blog';
import { storageManager } from '@/lib/storage-manager';
import { get } from 'idb-keyval';

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
  const [activityOrder, setActivityOrder] = useState<'newest' | 'oldest'>('newest');
  const [lastGame, setLastGame] = useState<{ id: string; title: string; image: string | null; platform: string; visitedAt: number; appId: string } | null>(null);

  useEffect(() => {
    fetchDashboardData();
    setBlogPosts(blogService.getRecentPosts(5));
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
    <div className="relative p-4 pt-2 space-y-3 overflow-auto overflow-x-hidden">
      {/* Sfondo AI Network */}
      <AINetworkBackground />
      
      {/* Hero Header con bordo sfumato */}
      <div className="relative overflow-hidden rounded-xl bg-card p-3 border-2 border-transparent" style={{ background: 'linear-gradient(var(--card), var(--card)) padding-box, linear-gradient(135deg, #64748b, #475569, #334155) border-box' }}>
        
        {/* Titolo centrato */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 shadow-lg">
            <Home className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-300 to-slate-400 bg-clip-text text-transparent">
            Dashboard Center
          </h1>
          <Button
            onClick={() => fetchDashboardData()}
            disabled={loading}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground ml-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* RSS Ticker */}
        <div className="pt-1.5 border-t border-border/30">
          <RssTicker />
        </div>
      </div>

      {/* Ultimo Gioco + Store Connessi affiancati */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Ultimo Gioco Aperto - SINISTRA */}
        {lastGame ? (
          <Link href={`/games/${lastGame.id}?name=${encodeURIComponent(lastGame.title)}&platform=${lastGame.platform}${lastGame.appId ? `&appId=${lastGame.appId}` : ''}${lastGame.image ? `&headerImage=${encodeURIComponent(lastGame.image)}` : ''}`}>
            <Card className="border-indigo-500/30 bg-indigo-950/40 backdrop-blur-sm hover:border-indigo-400/50 transition-all cursor-pointer group h-full">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {lastGame.image ? (
                    <img
                      src={lastGame.image}
                      alt={lastGame.title}
                      className="w-28 h-14 rounded-lg object-cover border border-indigo-500/20 group-hover:border-indigo-400/40 transition-colors"
                    />
                  ) : (
                    <div className="w-28 h-14 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <Gamepad2 className="h-6 w-6 text-indigo-400/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Play className="h-3 w-3 text-indigo-400" />
                      <span className="text-[10px] text-indigo-400/70 uppercase tracking-wider font-medium">{language === 'en' ? 'Last opened' : 'Ultimo gioco aperto'}</span>
                    </div>
                    <p className="text-sm font-semibold text-indigo-100 truncate group-hover:text-white transition-colors">{lastGame.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-indigo-300/50">{lastGame.platform}</span>
                      <span className="text-[10px] text-indigo-300/30">•</span>
                      <span className="text-[10px] text-indigo-300/50">
                        {new Date(lastGame.visitedAt).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-indigo-400/30 group-hover:text-indigo-400/60 transition-colors">
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
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
        <Card className="border-slate-500/20 bg-slate-950/40 backdrop-blur-sm h-full">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Gamepad2 className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-300">{language === 'en' ? 'Connected Stores' : 'Store Connessi'}</h3>
              <span className="ml-auto text-xs text-slate-500">
                {Object.values(stats.storeStats).reduce((s, v) => s + v.games, 0)} {language === 'en' ? 'total games' : 'giochi'}
              </span>
            </div>
            {Object.values(stats.storeStats).some(s => s.games > 0) ? (
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'steam',     label: 'Steam',      color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
                  { key: 'gog',       label: 'GOG',        color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
                  { key: 'epic',      label: 'Epic',       color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20' },
                  { key: 'ubisoft',   label: 'Ubisoft',    color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20' },
                  { key: 'origin',    label: 'EA/Origin',  color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
                  { key: 'battlenet', label: 'Battle.net', color: 'text-blue-300',   bg: 'bg-blue-500/10 border-blue-500/20' },
                  { key: 'itchio',    label: 'itch.io',    color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20' },
                ].filter(s => stats.storeStats[s.key]?.games > 0).map(store => (
                  <div key={store.key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs ${store.bg}`}>
                    <span className={`font-semibold ${store.color}`}>{stats.storeStats[store.key].games}</span>
                    <span className="text-slate-400">{store.label}</span>
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

      {/* Grid: News (sinistra) + Attività Recenti (destra) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Mini Blog / News - SINISTRA */}
        <Card className="border-rose-500/30 bg-rose-950/40 backdrop-blur-sm h-fit">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-rose-300 flex items-center gap-2">
                <Newspaper className="h-4 w-4" />
                {dash.newsUpdates}
              </h3>
              <Link href="/blog" className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1">
                {dash.manage} <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            
            <div className="space-y-2">
              {blogPosts.length > 0 ? blogPosts.map((post) => (
                <div key={post.id} className="flex items-start gap-3 p-2 rounded-lg bg-rose-950/30 border border-rose-500/10 hover:border-rose-500/30 transition-colors">
                  <span className="text-[10px] text-rose-400/60 w-12 flex-shrink-0">{post.date}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-rose-100 truncate">{post.title}</p>
                    <p className="text-[10px] text-rose-300/50 truncate">{post.description}</p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">{post.tag}</span>
                </div>
              )) : (
                <p className="text-xs text-rose-300/50 text-center py-4">Nessun post.</p>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-rose-500/20">
              <MessageCircle className="h-3 w-3 text-rose-400/50" />
              <span className="text-[10px] text-rose-300/50">{dash.suggestions}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity - DESTRA */}
        <Card className="border-cyan-500/30 bg-cyan-950/40 backdrop-blur-sm h-fit">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {dash.recentActivity}
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActivityOrder(activityOrder === 'newest' ? 'oldest' : 'newest')}
                  className="flex items-center gap-1 text-xs text-cyan-300/50 hover:text-cyan-300 transition-colors"
                  title={activityOrder === 'newest' ? 'Ordina: più recenti prima' : 'Ordina: più vecchi prima'}
                >
                  {activityOrder === 'newest' ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUp className="h-3 w-3" />
                  )}
                  <span>{activityOrder === 'newest' ? dash.latestActions : (dash.oldestFirst || 'Meno recenti')}</span>
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <RefreshCw className="h-5 w-5 text-cyan-500 animate-spin" />
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-2">
                {(activityOrder === 'oldest' ? [...activities].reverse() : activities)
                  .filter((activity, index, arr) => 
                    index === 0 || activity.text !== arr[index - 1].text
                  )
                  .slice(0, 5)
                  .map((activity, index) => (
                    <div key={index} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/10 hover:border-cyan-500/30 transition-colors">
                      <span className="text-base flex-shrink-0">{activity.icon || '📝'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-cyan-100 truncate font-medium">{activity.text}</p>
                        <p className="text-[9px] text-cyan-300/50">{activity.time}</p>
                      </div>
                      <div className={`h-2 w-2 rounded-full ${activity.color} flex-shrink-0`} />
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4 py-6 text-cyan-300/50">
                <Clock className="h-8 w-8 opacity-30" />
                <div>
                  <span className="text-sm block">{dash.noRecentActivity}</span>
                  <span className="text-xs opacity-70">{dash.actionsWillAppear}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress Card */}
      {stats.translationStats.total > 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  {dash.translationProgress}
                </h3>
                <Link href="/ai-translator" className="text-xs text-emerald-400 hover:text-emerald-300">
                  {dash.newTranslation} →
                </Link>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-emerald-200/70">{dash.completion}</span>
                    <span className="text-emerald-400 font-semibold">
                      {stats.translationStats.total > 0 
                        ? Math.round((stats.translationStats.completed / stats.translationStats.total) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <Progress 
                    value={stats.translationStats.total > 0 
                      ? (stats.translationStats.completed / stats.translationStats.total) * 100 
                      : 0} 
                    className="h-2"
                  />
                </div>
                
                <div className="flex gap-6">
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-400">{stats.translationStats.completed}</div>
                    <div className="text-[10px] text-emerald-200/50">{dash.completed}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-yellow-400">{stats.translationStats.pending}</div>
                    <div className="text-[10px] text-emerald-200/50">{dash.pending}</div>
                  </div>
                </div>
              </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Footer */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/20">
              <Languages className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-violet-300">{(stats.translationStats.completed + stats.tmEntries).toLocaleString()}</div>
              <div className="text-[10px] text-violet-400/70 uppercase tracking-wider">{dash.totalTranslations}</div>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 text-violet-500/10 text-6xl font-bold">📊</div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Gamepad2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-300">{stats.patches}</div>
              <div className="text-[10px] text-emerald-400/70 uppercase tracking-wider">{dash.gamesPatched}</div>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 text-emerald-500/10 text-6xl font-bold">🎮</div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-300">{stats.timeSavedMinutes >= 60 ? `${Math.round(stats.timeSavedMinutes / 60)}h` : `${stats.timeSavedMinutes}m`}</div>
              <div className="text-[10px] text-amber-400/70 uppercase tracking-wider">{dash.timeSaved}</div>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 text-amber-500/10 text-6xl font-bold">⏱️</div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Database className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-cyan-300">{stats.tmEntries.toLocaleString()}</div>
              <div className="text-[10px] text-cyan-400/70 uppercase tracking-wider">{dash.tmEntries}</div>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 text-cyan-500/10 text-6xl font-bold">💾</div>
        </div>
      </div>
    </div>
  );
}



