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
  ArrowDown
} from 'lucide-react';
import Link from 'next/link';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { ScanButton } from '@/components/scan-button';
import { AINetworkBackground } from '@/components/ui/ai-network-background';
import { RssTicker } from '@/components/ui/rss-ticker';
import { activityHistory, Activity, activityColors, activityIcons, ActivityType } from '@/lib/activity-history';
import { useTranslation, translations } from '@/lib/i18n';
import { blogService, BlogPost } from '@/lib/blog';

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
    translationStats: { total: 0, completed: 0, pending: 0, edited: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<RecentActivityProps[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [activityOrder, setActivityOrder] = useState<'newest' | 'oldest'>('newest');

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
      
      try {
        const userGames = await invoke('get_steam_games', {
          apiKey: '',
          steamId: '',
          forceRefresh: false
        }) as any[];
        
        if (userGames && userGames.length > 0) {
          games = userGames;
        }
      } catch (e) {
        try {
          const fallbackGames = await invoke('get_games') as any[];
          if (fallbackGames && fallbackGames.length > 0) {
            games = fallbackGames;
          }
        } catch (fallbackError) {
          console.log('Dashboard: No games loaded');
        }
      }
      
      let savedTranslations = JSON.parse(localStorage.getItem('gameTranslations') || '[]');
      let savedPatches = JSON.parse(localStorage.getItem('gamePatches') || '[]');
      
      if (savedTranslations.length === 0 || savedPatches.length === 0) {
        try {
          const allActivities = await activityHistory.getRecent(100);
          const translationActivities = allActivities.filter((a: Activity) => 
            a.activity_type === 'translation' && a.title?.includes('completata')
          );
          const patchActivities = allActivities.filter((a: Activity) => 
            a.activity_type === 'patch' || a.title?.includes('Applicat')
          );
          
          if (savedTranslations.length === 0 && translationActivities.length > 0) {
            savedTranslations = translationActivities.map((a: Activity) => ({
              id: a.id,
              gameId: a.game_id,
              gameName: a.game_name,
              status: 'completed',
              timestamp: a.timestamp
            }));
            localStorage.setItem('gameTranslations', JSON.stringify(savedTranslations));
          }
          
          if (savedPatches.length === 0 && patchActivities.length > 0) {
            savedPatches = patchActivities.map((a: Activity) => ({
              id: a.id,
              gameId: a.game_id,
              gameName: a.game_name,
              status: 'applied',
              timestamp: a.timestamp
            }));
            localStorage.setItem('gamePatches', JSON.stringify(savedPatches));
          }
        } catch (e) {
          console.log('Dashboard: Activity sync error', e);
        }
      }
      
      const storeStats: Record<string, StoreStats> = {
        steam: { connected: games.length > 0, games: games.length },
        epic: { connected: false, games: 0 },
        gog: { connected: false, games: 0 },
        origin: { connected: false, games: 0 },
        ubisoft: { connected: false, games: 0 },
        battlenet: { connected: false, games: 0 },
        itchio: { connected: false, games: 0 }
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
      
      const translationStats: TranslationStats = {
        total: savedTranslations.length,
        completed: savedTranslations.filter((t: any) => t.status === 'completed').length,
        pending: savedTranslations.filter((t: any) => t.status === 'pending' || !t.status).length,
        edited: savedTranslations.filter((t: any) => t.status === 'edited').length
      };
      
      setStats({
        totalGames: games.length,
        installedGames: games.filter((g: any) => g.is_installed).length,
        translations: savedTranslations.length,
        patches: savedPatches.length,
        lastScan: new Date(localStorage.getItem('lastSteamScan') || Date.now()),
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
              <div className="text-2xl font-bold text-violet-300">{stats.translationStats.completed.toLocaleString()}</div>
              <div className="text-[10px] text-violet-400/70 uppercase tracking-wider">Traduzioni Totali</div>
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
              <div className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Giochi Patchati</div>
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
              <div className="text-2xl font-bold text-amber-300">{Math.round(stats.translationStats.completed * 0.5)}h</div>
              <div className="text-[10px] text-amber-400/70 uppercase tracking-wider">Tempo Risparmiato</div>
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
              <div className="text-2xl font-bold text-cyan-300">{stats.translations.toLocaleString()}</div>
              <div className="text-[10px] text-cyan-400/70 uppercase tracking-wider">Entry TM</div>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 text-cyan-500/10 text-6xl font-bold">💾</div>
        </div>
      </div>
    </div>
  );
}



