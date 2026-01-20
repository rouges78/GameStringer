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
  Zap,
  FolderOpen,
  Layers,
  Globe,
  Wand2
} from 'lucide-react';
import Link from 'next/link';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { ScanButton } from '@/components/scan-button';
import { activityHistory, Activity, activityColors } from '@/lib/activity-history';
import { useTranslation, translations } from '@/lib/i18n';

interface RecentActivityProps {
  color: string;
  text: string;
  time: string;
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

  useEffect(() => {
    fetchDashboardData();
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
        const recentFromBackend = await activityHistory.getRecent(5);
        const recentActivities = recentFromBackend.map((a: Activity) => ({
          color: `bg-${activityColors[a.activity_type]}-500`,
          text: a.title,
          time: activityHistory.formatRelativeTime(a.timestamp)
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
    <div className="p-6 space-y-4 overflow-auto">
      {/* Hero Header con bordo sfumato */}
      <div className="relative overflow-hidden rounded-xl bg-card p-3 border-2 border-transparent" style={{ background: 'linear-gradient(var(--card), var(--card)) padding-box, linear-gradient(135deg, #8b5cf6, #6366f1, #ec4899) border-box' }}>
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                GameStringer
              </h1>
              <p className="text-muted-foreground text-[10px]">
                {dash.translationCenter}
              </p>
            </div>
          </div>
          
          {/* Stats inline */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border">
              <Gamepad2 className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-sm font-bold text-foreground">{stats.totalGames}</span>
              <span className="text-[10px] text-muted-foreground">{dash.games}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border">
              <Languages className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-sm font-bold text-foreground">{stats.translations}</span>
              <span className="text-[10px] text-muted-foreground">{dash.translations}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border">
              <Wand2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-sm font-bold text-foreground">{stats.patches}</span>
              <span className="text-[10px] text-muted-foreground">{dash.patches}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => fetchDashboardData()}
              disabled={loading}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Attività Recenti - In primo piano */}
      <Card className="border-cyan-500/20 bg-cyan-500/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {dash.recentActivity}
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </h3>
            <span className="text-xs text-cyan-300/50">{dash.latestActions}</span>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <RefreshCw className="h-5 w-5 text-cyan-500 animate-spin" />
            </div>
          ) : activities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {activities
                .filter((activity, index, arr) => 
                  index === 0 || activity.text !== arr[index - 1].text
                )
                .slice(0, 15)
                .map((activity, index) => (
                  <div key={index} className="flex items-center gap-2 p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/10">
                    <div className={`h-2 w-2 rounded-full ${activity.color} flex-shrink-0`} />
                    <span className="text-[11px] text-cyan-100 flex-1 truncate">{activity.text}</span>
                    <span className="text-[9px] text-cyan-300/50 whitespace-nowrap">{activity.time}</span>
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

      {/* Azioni Rapide - Full Width */}
      <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-purple-300 mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              {dash.getStarted}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href="/library" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-600/20 hover:from-purple-500/40 hover:to-violet-600/40 transition-all duration-300 border border-purple-500/30 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02]">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-all">
                  <Gamepad2 className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs font-semibold text-purple-200">{dash.library}</span>
                <span className="text-[10px] text-purple-300/60">{stats.totalGames} {dash.games}</span>
              </Link>
              
              <Link href="/ai-translator" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-600/20 hover:from-blue-500/40 hover:to-cyan-600/40 transition-all duration-300 border border-blue-500/30 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02]">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all">
                  <Languages className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs font-semibold text-blue-200">{dash.translate}</span>
                <span className="text-[10px] text-blue-300/60">{dash.aiAssistant}</span>
              </Link>
              
              <Link href="/unity-patcher" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 hover:from-emerald-500/40 hover:to-teal-600/40 transition-all duration-300 border border-emerald-500/30 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02]">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-all">
                  <Wand2 className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs font-semibold text-emerald-200">{dash.patcher}</span>
                <span className="text-[10px] text-emerald-300/60">{stats.patches} {dash.active}</span>
              </Link>
              
              <Link href="/community-hub" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-600/20 hover:from-orange-500/40 hover:to-amber-600/40 transition-all duration-300 border border-orange-500/30 hover:border-orange-400/50 hover:shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02]">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/50 transition-all">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs font-semibold text-orange-200">{dash.community}</span>
                <span className="text-[10px] text-orange-300/60">{dash.packMod}</span>
              </Link>
            </div>

            {/* Strumenti secondari */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-purple-500/20">
              <Link href="/batch-translation">
                <Button variant="outline" size="sm" className="h-8 text-xs border-amber-500/30 hover:bg-amber-500/10 text-amber-400">
                  <Layers className="h-3.5 w-3.5 mr-1" />
                  {dash.batch}
                </Button>
              </Link>
              <Link href="/projects">
                <Button variant="outline" size="sm" className="h-8 text-xs border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400">
                  <FolderOpen className="h-3.5 w-3.5 mr-1" />
                  {dash.projects}
                </Button>
              </Link>
              <Link href="/stats">
                <Button variant="outline" size="sm" className="h-8 text-xs border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-400">
                  <BarChart3 className="h-3.5 w-3.5 mr-1" />
                  {dash.statistics}
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline" size="sm" className="h-8 text-xs border-gray-500/30 hover:bg-gray-500/10 text-gray-400">
                  <Settings className="h-3.5 w-3.5 mr-1" />
                  {dash.settings}
                </Button>
              </Link>
            </div>
          </CardContent>
      </Card>

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
    </div>
  );
}
