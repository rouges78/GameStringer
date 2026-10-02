'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
// Badge import removed — not currently used
import { 
  BarChart3, 
  TrendingUp, 
  FileText, 
  Languages, 
  CheckCircle
} from 'lucide-react';
import { activityHistory, type Activity } from '@/lib/activity-history';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';
import { TARGET_LANGUAGES } from '@/lib/translation/target-languages';

// Solo numeri che lo storico attività registra davvero. Stringhe, parole,
// avanzamento medio, progetti completati e tempo rimanente NON sono nello
// storico: prima venivano inventati (n*150, Math.random, 60%, 45 min).
export interface TranslationStats {
  totalTranslations: number;
  totalProjects: number; // giochi distinti con almeno una traduzione registrata
  todayTranslations: number;
  weekTranslations: number;
  monthTranslations: number;
  topLanguages: { lang: string; count: number }[];
  recentActivity: { date: string; count: number }[];
}

export function computeTranslationStats(activities: Activity[], now: Date = new Date()): TranslationStats {
  // Filtra solo traduzioni
  const translations = activities.filter((a) => a.activity_type === 'translation');

  // Calcola date
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Conta traduzioni per periodo
  const todayTranslations = translations.filter((t) =>
    new Date(t.timestamp) >= today
  ).length;

  const weekTranslations = translations.filter((t) =>
    new Date(t.timestamp) >= weekAgo
  ).length;

  const monthTranslations = translations.filter((t) =>
    new Date(t.timestamp) >= monthAgo
  ).length;

  // Calcola attività per giorno (ultimi 7 giorni)
  const recentActivity: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toLocaleDateString('it-IT', { weekday: 'short' });
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const count = translations.filter((t) => {
      const tDate = new Date(t.timestamp);
      return tDate >= date && tDate < nextDate;
    }).length;
    recentActivity.push({ date: dateStr, count });
  }

  // Lingue di destinazione: solo quelle registrate nei metadata dell'attività
  const languageCounts = new Map<string, number>();
  for (const tr of translations) {
    const code = tr.metadata?.target_language;
    if (typeof code !== 'string' || !code.trim()) continue;
    const key = code.trim().toLowerCase();
    languageCounts.set(key, (languageCounts.get(key) ?? 0) + 1);
  }
  const topLanguages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({
      lang: TARGET_LANGUAGES.find((l) => l.code === code)?.name ?? code,
      count,
    }));

  // Progetti: giochi distinti che compaiono nelle traduzioni
  const uniqueGames = new Set(translations.map((t) => t.game_id || t.game_name).filter(Boolean));

  return {
    totalTranslations: translations.length,
    totalProjects: uniqueGames.size,
    todayTranslations,
    weekTranslations,
    monthTranslations,
    topLanguages,
    recentActivity,
  };
}

export function TranslationStatsWidget() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<TranslationStats>({
    totalTranslations: 0,
    totalProjects: 0,
    todayTranslations: 0,
    weekTranslations: 0,
    monthTranslations: 0,
    topLanguages: [],
    recentActivity: [],
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
      setStats(computeTranslationStats(activities));
    } catch (error: unknown) {
      clientLogger.error('error Loading...atistiche:', error);
    } finally {
      setIsLoading(false);
    }
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
                {t('translationStatsWidgetComp.title')}
              </h2>
              <p className="text-sm text-blue-200/60">{t('translationStatsWidgetComp.activityOverview')}</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <FileText className="h-4 w-4" />
                <span className="text-xs">{t('translationStatsWidgetComp.traduzioni')}</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalTranslations}</div>
              <div className="text-xs text-blue-200/50">{t('translationStatsWidgetComp.totali')}</div>
            </div>
            
            <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs">{t('common.projects')}</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalProjects}</div>
              <div className="text-xs text-blue-200/50">{t('translationStatsWidgetComp.totali')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Seconda riga: Attività */}
      <div className="grid grid-cols-1 gap-4">
        {/* Grafico attività settimanale */}
        <Card className="border-indigo-500/20 bg-indigo-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-indigo-300">
              <TrendingUp className="h-4 w-4" />
              {t('translationStatsWidgetComp.weeklyActivity')}
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
                  <span className="text-2xs text-muted-foreground">{day.date}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-indigo-500/20">
              <div className="text-center">
                <div className="text-lg font-bold text-indigo-400">{stats.todayTranslations}</div>
                <div className="text-xs text-muted-foreground">{t('translationStatsWidgetComp.oggi')}</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-indigo-400">{stats.weekTranslations}</div>
                <div className="text-xs text-muted-foreground">{t('translationStatsWidgetComp.settimana')}</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-indigo-400">{stats.monthTranslations}</div>
                <div className="text-xs text-muted-foreground">{t('translationStatsWidgetComp.mese')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Terza riga: Lingue */}
      <Card className="border-violet-500/20 bg-violet-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-violet-300">
            <Languages className="h-4 w-4" />
            {t('translationStatsWidgetComp.targetLanguages')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topLanguages.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              {stats.totalTranslations === 0
                ? t('translationStatsWidgetComp.noTranslationsYet')
                : t('translationStatsWidgetComp.noLanguageData')}
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




