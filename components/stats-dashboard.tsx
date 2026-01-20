'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Clock, 
  FileText, 
  Gamepad2, 
  Languages, 
  TrendingUp,
  RefreshCw,
  Download
} from 'lucide-react';

interface TranslationStats {
  totalWordsTranslated: number;
  totalFilesProcessed: number;
  totalGamesTranslated: number;
  totalTimeSpentMinutes: number;
  averageWordsPerMinute: number;
  mostUsedSourceLang: string;
  mostUsedTargetLang: string;
  lastTranslationDate: string | null;
}

interface DailyStats {
  date: string;
  words: number;
  files: number;
}

export function StatsDashboard() {
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      // Carica statistiche dal localStorage o backend
      const savedStats = localStorage.getItem('translation_stats');
      if (savedStats) {
        setStats(JSON.parse(savedStats));
      } else {
        // Statistiche di default
        setStats({
          totalWordsTranslated: 0,
          totalFilesProcessed: 0,
          totalGamesTranslated: 0,
          totalTimeSpentMinutes: 0,
          averageWordsPerMinute: 0,
          mostUsedSourceLang: 'English',
          mostUsedTargetLang: 'Italian',
          lastTranslationDate: null,
        });
      }

      // Carica statistiche giornaliere
      const savedDaily = localStorage.getItem('daily_translation_stats');
      if (savedDaily) {
        setDailyStats(JSON.parse(savedDaily));
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No statistics available
      </div>
    );
  }

  const statCards = [
    {
      title: 'Words Translated',
      value: formatNumber(stats.totalWordsTranslated),
      icon: Languages,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Files Processed',
      value: formatNumber(stats.totalFilesProcessed),
      icon: FileText,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Games Translated',
      value: stats.totalGamesTranslated.toString(),
      icon: Gamepad2,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Total Time',
      value: formatTime(stats.totalTimeSpentMinutes),
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Average Speed',
      value: `${stats.averageWordsPerMinute}/min`,
      icon: TrendingUp,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Statistiche Traduzione</h2>
        </div>
        <Button variant="outline" size="sm" onClick={loadStats}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Aggiorna
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Language Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lingue più usate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Lingua sorgente:</span>
                <span className="font-medium">{stats.mostUsedSourceLang}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Lingua target:</span>
                <span className="font-medium">{stats.mostUsedTargetLang}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ultima traduzione</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {stats.lastTranslationDate 
                ? new Date(stats.lastTranslationDate).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'No translation done'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Chart Placeholder */}
      {dailyStats.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activity last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-24">
              {dailyStats.slice(-7).map((day, index) => {
                const maxWords = Math.max(...dailyStats.map(d => d.words), 1);
                const height = (day.words / maxWords) * 100;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                      style={{ height: `${height}%`, minHeight: day.words > 0 ? '4px' : '0' }}
                      title={`${day.words} parole`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(day.date).toLocaleDateString('it-IT', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Aggiorna le statistiche dopo una traduzione
 */
export function updateTranslationStats(
  wordsTranslated: number,
  filesProcessed: number,
  timeSpentMinutes: number,
  sourceLang: string,
  targetLang: string,
  gameId?: string
) {
  try {
    // Carica stats esistenti
    const savedStats = localStorage.getItem('translation_stats');
    const stats: TranslationStats = savedStats 
      ? JSON.parse(savedStats)
      : {
          totalWordsTranslated: 0,
          totalFilesProcessed: 0,
          totalGamesTranslated: 0,
          totalTimeSpentMinutes: 0,
          averageWordsPerMinute: 0,
          mostUsedSourceLang: sourceLang,
          mostUsedTargetLang: targetLang,
          lastTranslationDate: null,
        };

    // Aggiorna
    stats.totalWordsTranslated += wordsTranslated;
    stats.totalFilesProcessed += filesProcessed;
    stats.totalTimeSpentMinutes += timeSpentMinutes;
    stats.lastTranslationDate = new Date().toISOString();
    
    if (stats.totalTimeSpentMinutes > 0) {
      stats.averageWordsPerMinute = Math.round(
        stats.totalWordsTranslated / stats.totalTimeSpentMinutes
      );
    }

    // Salva
    localStorage.setItem('translation_stats', JSON.stringify(stats));

    // Aggiorna stats giornaliere
    const today = new Date().toISOString().split('T')[0];
    const savedDaily = localStorage.getItem('daily_translation_stats');
    const dailyStats: DailyStats[] = savedDaily ? JSON.parse(savedDaily) : [];
    
    const todayIndex = dailyStats.findIndex(d => d.date === today);
    if (todayIndex >= 0) {
      dailyStats[todayIndex].words += wordsTranslated;
      dailyStats[todayIndex].files += filesProcessed;
    } else {
      dailyStats.push({ date: today, words: wordsTranslated, files: filesProcessed });
    }

    // Mantieni solo ultimi 30 giorni
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const filtered = dailyStats.filter(d => new Date(d.date) >= thirtyDaysAgo);
    
    localStorage.setItem('daily_translation_stats', JSON.stringify(filtered));

  } catch (error) {
    console.error('error update statistiche:', error);
  }
}



