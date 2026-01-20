'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Trophy, 
  Target, 
  TrendingUp, 
  Calendar, 
  Gamepad2, 
  Star, 
  BarChart3,
  PieChart,
  Activity,
  Award,
  Zap,
  Timer
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GameStatistics {
  gameId: string;
  gameName: string;
  store: string;
  totalPlaytime: number; // in minutes
  sessionsCount: number;
  averageSessionLength: number;
  lastPlayed: Date;
  firstPlayed: Date;
  achievements: {
    total: number;
    unlocked: number;
    percentage: number;
    recent: Achievement[];
  };
  progress: {
    storyCompletion: number;
    collectibles: number;
    sidequests: number;
    overall: number;
  };
  rating?: number;
  genre?: string;
  isCompleted: boolean;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon?: string;
  unlockedAt: Date;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

interface GlobalStatistics {
  totalGames: number;
  totalPlaytime: number;
  averageRating: number;
  completedGames: number;
  totalAchievements: number;
  favoriteGenre: string;
  favoriteStore: string;
  longestSession: number;
  currentStreak: number;
  totalSessions: number;
}

interface DetailedStatisticsProps {
  gameStats: GameStatistics[];
  className?: string;
}

const DetailedStatistics: React.FC<DetailedStatisticsProps> = ({
  gameStats,
  className
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [selectedGame, setSelectedGame] = useState<string>('all');

  // Calcola statistiche globali
  const globalStats = useMemo((): GlobalStatistics => {
    const totalGames = gameStats.length;
    const totalPlaytime = gameStats.reduce((sum, game) => sum + game.totalPlaytime, 0);
    const completedGames = gameStats.filter(game => game.isCompleted).length;
    const totalAchievements = gameStats.reduce((sum, game) => sum + game.achievements.unlocked, 0);
    const totalSessions = gameStats.reduce((sum, game) => sum + game.sessionsCount, 0);
    
    // Calcola rating medio
    const gamesWithRating = gameStats.filter(game => game.rating);
    const averageRating = gamesWithRating.length > 0 
      ? gamesWithRating.reduce((sum, game) => sum + (game.rating || 0), 0) / gamesWithRating.length
      : 0;

    // Trova genere preferito
    const genreCounts = gameStats.reduce((acc, game) => {
      if (game.genre) {
        acc[game.genre] = (acc[game.genre] || 0) + game.totalPlaytime;
      }
      return acc;
    }, {} as Record<string, number>);
    const favoriteGenre = Object.entries(genreCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';

    // Trova store preferito
    const storeCounts = gameStats.reduce((acc, game) => {
      acc[game.store] = (acc[game.store] || 0) + game.totalPlaytime;
      return acc;
    }, {} as Record<string, number>);
    const favoriteStore = Object.entries(storeCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';

    // Sessione più lunga
    const longestSession = Math.max(...gameStats.map(game => game.averageSessionLength), 0);

    // Streak corrente (giorni consecutivi di gioco)
    const currentStreak = calculateCurrentStreak(gameStats);

    return {
      totalGames,
      totalPlaytime,
      averageRating,
      completedGames,
      totalAchievements,
      favoriteGenre,
      favoriteStore,
      longestSession,
      currentStreak,
      totalSessions
    };
  }, [gameStats]);

  // Calcola streak corrente
  const calculateCurrentStreak = (stats: GameStatistics[]): number => {
    const today = new Date();
    let streak = 0;
    let currentDate = new Date(today);
    
    for (let i = 0; i < 365; i++) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      const playedToday = stats.some(game => 
        game.lastPlayed >= dayStart && game.lastPlayed <= dayEnd
      );
      
      if (playedToday) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  };

  // Filtra statistiche per periodo
  const filteredStats = useMemo(() => {
    const now = new Date();
    let cutoffDate: Date;
    
    switch (selectedPeriod) {
      case 'week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return gameStats;
    }
    
    return gameStats.filter(game => game.lastPlayed >= cutoffDate);
  }, [gameStats, selectedPeriod]);

  // Formatta tempo
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  // Formatta percentuale
  const formatPercentage = (value: number): string => {
    return `${Math.round(value)}%`;
  };

  // Top giochi per tempo di gioco
  const topGamesByPlaytime = useMemo(() => {
    return [...filteredStats]
      .sort((a, b) => b.totalPlaytime - a.totalPlaytime)
      .slice(0, 10);
  }, [filteredStats]);

  // Achievement recenti
  const recentAchievements = useMemo(() => {
    return filteredStats
      .flatMap(game => game.achievements.recent.map(ach => ({ ...ach, gameName: game.gameName })))
      .sort((a, b) => b.unlockedAt.getTime() - a.unlockedAt.getTime())
      .slice(0, 10);
  }, [filteredStats]);

  // Statistiche per genere
  const genreStats = useMemo(() => {
    const stats = filteredStats.reduce((acc, game) => {
      if (game.genre) {
        if (!acc[game.genre]) {
          acc[game.genre] = { playtime: 0, games: 0, achievements: 0 };
        }
        acc[game.genre].playtime += game.totalPlaytime;
        acc[game.genre].games += 1;
        acc[game.genre].achievements += game.achievements.unlocked;
      }
      return acc;
    }, {} as Record<string, { playtime: number; games: number; achievements: number }>);

    return Object.entries(stats)
      .map(([genre, data]) => ({ genre, ...data }))
      .sort((a, b) => b.playtime - a.playtime);
  }, [filteredStats]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Controlli */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Detailed Statistics</h2>
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="games">Games</TabsTrigger>
          <TabsTrigger value="achievements">Achievement</TabsTrigger>
          <TabsTrigger value="genres">Genres</TabsTrigger>
        </TabsList>

        {/* Panoramica */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatTime(globalStats.totalPlaytime)}</div>
                <p className="text-xs text-muted-foreground">
                  Average: {formatTime(Math.round(globalStats.totalPlaytime / globalStats.totalGames))} per game
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Games Completed</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{globalStats.completedGames}</div>
                <p className="text-xs text-muted-foreground">
                  {formatPercentage((globalStats.completedGames / globalStats.totalGames) * 100)} of total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Achievement</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{globalStats.totalAchievements}</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(globalStats.totalAchievements / globalStats.totalGames)} per game
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{globalStats.currentStreak}</div>
                <p className="text-xs text-muted-foreground">
                  consecutive days
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Statistiche aggiuntive */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Favorite Genre</span>
                  <Badge variant="secondary">{globalStats.favoriteGenre}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Favorite Store</span>
                  <Badge variant="secondary">{globalStats.favoriteStore}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Rating</span>
                  <Badge variant="secondary">{globalStats.averageRating.toFixed(1)}/10</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Longest Session</span>
                  <Badge variant="secondary">{formatTime(globalStats.longestSession)}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Sessions</span>
                  <Badge variant="outline">{globalStats.totalSessions}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Sessions per Game</span>
                  <Badge variant="outline">{Math.round(globalStats.totalSessions / globalStats.totalGames)}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Session Duration</span>
                  <Badge variant="outline">
                    {formatTime(Math.round(globalStats.totalPlaytime / globalStats.totalSessions))}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Giochi */}
        <TabsContent value="games" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Games by Playtime</CardTitle>
              <CardDescription>The games you've spent the most time on</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topGamesByPlaytime.map((game, index) => (
                  <div key={game.gameId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <div>
                        <div className="font-medium">{game.gameName}</div>
                        <div className="text-sm text-muted-foreground">
                          {game.store} • {game.genre}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatTime(game.totalPlaytime)}</div>
                      <div className="text-sm text-muted-foreground">
                        {game.sessionsCount} sessions
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievement */}
        <TabsContent value="achievements" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Achievement Recenti</CardTitle>
              <CardDescription>I tuoi ultimi traguardi sbloccati</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentAchievements.map((achievement, index) => (
                  <div key={achievement.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      <div>
                        <div className="font-medium">{achievement.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {achievement.description}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {achievement.gameName}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={
                          achievement.rarity === 'legendary' ? 'default' :
                          achievement.rarity === 'epic' ? 'secondary' :
                          'outline'
                        }
                      >
                        {achievement.rarity}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {achievement.unlockedAt.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generi */}
        <TabsContent value="genres" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Statistics by Genre</CardTitle>
              <CardDescription>Analysis of your playtime by genre</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {genreStats.map((genre, index) => (
                  <div key={genre.genre} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{genre.genre}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatTime(genre.playtime)}
                      </span>
                    </div>
                    <Progress 
                      value={(genre.playtime / globalStats.totalPlaytime) * 100} 
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{genre.games} giochi</span>
                      <span>{genre.achievements} achievement</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DetailedStatistics;
