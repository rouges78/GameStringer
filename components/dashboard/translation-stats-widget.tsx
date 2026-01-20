'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  FileText, 
  Languages, 
  CheckCircle,
  AlertCircle,
  Zap,
  Calendar,
  Target
} from 'lucide-react';
import { activityHistory } from '@/lib/activity-history';

interface TranslationStats {
  totalTranslations: number;
  totalStrings: number;
  totalWords: number;
  completedProjects: number;
  activeProjects: number;
  averageProgress: number;
  todayTranslations: number;
  weekTranslations: number;
  monthTranslations: number;
  topLanguages: { lang: string; count: number }[];
  recentActivity: { date: string; count: number }[];
  estimatedTimeRemaining: number; // minuti
}

export function TranslationStatsWidget() {
  const [stats, setStats] = useState<TranslationStats>({
    totalTranslations: 0,
    totalStrings: 0,
    totalWords: 0,
    completedProjects: 0,
    activeProjects: 0,
    averageProgress: 0,
    todayTranslations: 0,
    weekTranslations: 0,
    monthTranslations: 0,
    topLanguages: [],
    recentActivity: [],
    estimatedTimeRemaining: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      // Carica attività recenti
      const activities = await activityHistory.getRecent(500);
      
      // Filtra solo traduzioni
      const translations = activities.filter((a: any) => a.activity_type === 'translation');
      
      // Calcola date
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Conta traduzioni per periodo
      const todayTranslations = translations.filter((t: any) => 
        new Date(t.timestamp) >= today
      ).length;
      
      const weekTranslations = translations.filter((t: any) => 
        new Date(t.timestamp) >= weekAgo
      ).length;
      
      const monthTranslations = translations.filter((t: any) => 
        new Date(t.timestamp) >= monthAgo
      ).length;

      // Calcola attività per giorno (ultimi 7 giorni)
      const recentActivity: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toLocaleDateString('it-IT', { weekday: 'short' });
        const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
        const count = translations.filter((t: any) => {
          const tDate = new Date(t.timestamp);
          return tDate >= date && tDate < nextDate;
        }).length;
        recentActivity.push({ date: dateStr, count });
      }

      // Stima stringhe e parole (mock basato su attività)
      const totalStrings = translations.length * 150; // ~150 stringhe per traduzione
      const totalWords = totalStrings * 8; // ~8 parole per stringa

      // Lingue più usate (mock)
      const topLanguages = [
        { lang: '🇮🇹 Italiano', count: Math.floor(translations.length * 0.7) },
        { lang: '🇬🇧 English', count: Math.floor(translations.length * 0.15) },
        { lang: '🇪🇸 Español', count: Math.floor(translations.length * 0.1) },
        { lang: '🇩🇪 Deutsch', count: Math.floor(translations.length * 0.05) },
      ].filter(l => l.count > 0);

      // Progetti (mock basato su games unici)
      const uniqueGames = new Set(translations.map((t: any) => t.game_id || t.game_name).filter(Boolean));
      const completedProjects = Math.floor(uniqueGames.size * 0.6);
      const activeProjects = uniqueGames.size - completedProjects;

      // Progress medio
      const averageProgress = translations.length > 0 ? 65 + Math.random() * 20 : 0;

      // Tempo stimato rimanente (mock)
      const estimatedTimeRemaining = activeProjects * 45; // ~45 min per progetto attivo

      setStats({
        totalTranslations: translations.length,
        totalStrings,
        totalWords,
        completedProjects,
        activeProjects,
        averageProgress: Math.round(averageProgress),
        todayTranslations,
        weekTranslations,
        monthTranslations,
        topLanguages,
        recentActivity,
        estimatedTimeRemaining,
      });
    } catch (error) {
      console.error('error Loading...atistiche:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Formatta numeri grandi
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Formatta tempo
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Calcola altezza barra grafico
  const maxActivity = Math.max(...stats.recentActivity.map(a => a.count), 1);

  if (isLoading) {
    return (
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con stats principali */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/80 via-indigo-950/60 to-violet-950/80 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
                Statistiche Traduzione
              </h2>
              <p className="text-sm text-blue-200/60">Panoramica delle tue attività</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <FileText className="h-4 w-4" />
                <span className="text-xs">Traduzioni</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalTranslations}</div>
              <div className="text-xs text-blue-200/50">totali</div>
            </div>
            
            <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <Languages className="h-4 w-4" />
                <span className="text-xs">Stringhe</span>
              </div>
              <div className="text-2xl font-bold text-white">{formatNumber(stats.totalStrings)}</div>
              <div className="text-xs text-blue-200/50">tradotte</div>
            </div>
            
            <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-violet-400 mb-1">
                <Zap className="h-4 w-4" />
                <span className="text-xs">Parole</span>
              </div>
              <div className="text-2xl font-bold text-white">{formatNumber(stats.totalWords)}</div>
              <div className="text-xs text-blue-200/50">elaborate</div>
            </div>
            
            <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Target className="h-4 w-4" />
                <span className="text-xs">Progress</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.averageProgress}%</div>
              <div className="text-xs text-blue-200/50">medio</div>
            </div>
          </div>
        </div>
      </div>

      {/* Seconda riga: Attività e Progetti */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Grafico attività settimanale */}
        <Card className="border-indigo-500/20 bg-indigo-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-indigo-300">
              <TrendingUp className="h-4 w-4" />
              Attività Settimanale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-24 gap-1">
              {stats.recentActivity.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-indigo-500/30 rounded-t transition-all hover:bg-indigo-500/50"
                    style={{ 
                      height: `${Math.max((day.count / maxActivity) * 100, 5)}%`,
                      minHeight: '4px'
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">{day.date}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-indigo-500/20">
              <div className="text-center">
                <div className="text-lg font-bold text-indigo-400">{stats.todayTranslations}</div>
                <div className="text-xs text-muted-foreground">Oggi</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-indigo-400">{stats.weekTranslations}</div>
                <div className="text-xs text-muted-foreground">Settimana</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-indigo-400">{stats.monthTranslations}</div>
                <div className="text-xs text-muted-foreground">Mese</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progetti */}
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-300">
              <CheckCircle className="h-4 w-4" />
              Progetti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-3xl font-bold text-emerald-400">{stats.completedProjects}</div>
                <div className="text-xs text-muted-foreground">Completati</div>
              </div>
              <div className="h-16 w-px bg-emerald-500/20" />
              <div>
                <div className="text-3xl font-bold text-amber-400">{stats.activeProjects}</div>
                <div className="text-xs text-muted-foreground">In corso</div>
              </div>
              <div className="h-16 w-px bg-emerald-500/20" />
              <div>
                <div className="text-3xl font-bold text-blue-400">{stats.completedProjects + stats.activeProjects}</div>
                <div className="text-xs text-muted-foreground">Totali</div>
              </div>
            </div>
            
            {stats.estimatedTimeRemaining > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Clock className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-amber-200">
                  Tempo stimato rimanente: <strong>{formatTime(stats.estimatedTimeRemaining)}</strong>
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Terza riga: Lingue */}
      <Card className="border-violet-500/20 bg-violet-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-violet-300">
            <Languages className="h-4 w-4" />
            Target Languages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topLanguages.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No translations yet
            </div>
          ) : (
            <div className="space-y-3">
              {stats.topLanguages.map((lang, i) => {
                const percentage = stats.totalTranslations > 0 
                  ? (lang.count / stats.totalTranslations) * 100 
                  : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{lang.lang}</span>
                      <span className="text-muted-foreground">{lang.count} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default TranslationStatsWidget;



