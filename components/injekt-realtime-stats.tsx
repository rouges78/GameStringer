'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  Clock, 
  Zap, 
  Database,
  Globe,
  Activity,
  BarChart3,
  Timer,
  Hash,
  FileText,
  Cpu,
  HardDrive
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RealtimeStats {
  processId: number;
  processName: string;
  gameName: string;
  totalTranslations: number;
  translationsPerMinute: number;
  memoryUsage: number;
  cpuUsage: number;
  activeTime: number;
  lastTranslation: {
    original: string;
    translated: string;
    timestamp: Date;
  } | null;
  translationHistory: Array<{
    time: string;
    count: number;
  }>;
  languageDistribution: Array<{
    language: string;
    count: number;
    percentage: number;
  }>;
  performanceMetrics: {
    avgTranslationTime: number;
    cacheHitRate: number;
    memoryEfficiency: number;
  };
}

interface InjektRealtimeStatsProps {
  processId: number | null;
  isActive: boolean;
}

export function InjektRealtimeStats({ processId, isActive }: InjektRealtimeStatsProps) {
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [updateInterval, setUpdateInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (processId && isActive) {
      fetchStats();
      const interval = setInterval(fetchStats, 1000); // Aggiorna ogni secondo
      setUpdateInterval(interval);
      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (updateInterval) {
        clearInterval(updateInterval);
        setUpdateInterval(null);
      }
      setStats(null);
    }
  }, [processId, isActive]);

  const fetchStats = async () => {
    if (!processId) return;
    
    try {
      const response = await fetch(`/api/injekt/stats/${processId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('error Loading...atistiche:', error);
    }
  };

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            {isActive ? 'Loading...atistiche...' : 'Nessuna sessione attiva'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Traduzioni Totali
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTranslations}</div>
            <p className="text-xs text-muted-foreground">
              {stats.translationsPerMinute} al minuto
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Timer className="w-4 h-4" />
              Tempo Attivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(stats.activeTime)}</div>
            <p className="text-xs text-muted-foreground">
              Sessione corrente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              CPU
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cpuUsage.toFixed(1)}%</div>
            <Progress value={stats.cpuUsage} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Memoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats.memoryUsage / 1024 / 1024).toFixed(0)} MB</div>
            <Progress value={Math.min(stats.memoryUsage / (1024 * 1024 * 100), 100)} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Grafici e Dettagli */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="languages">Lingue</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="recent">Recenti</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Traduzioni nel Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={stats.translationHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="languages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Distribuzione Lingue</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.languageDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ language, percentage }) => `${language} ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {stats.languageDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Tempo Medio Traduzione
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.performanceMetrics.avgTranslationTime.toFixed(0)} ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Per traduzione
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Cache Hit Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(stats.performanceMetrics.cacheHitRate * 100).toFixed(1)}%
                </div>
                <Progress 
                  value={stats.performanceMetrics.cacheHitRate * 100} 
                  className="mt-2 h-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Efficienza Memoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(stats.performanceMetrics.memoryEfficiency * 100).toFixed(1)}%
                </div>
                <Progress 
                  value={stats.performanceMetrics.memoryEfficiency * 100} 
                  className="mt-2 h-2"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Ultime Traduzioni</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {stats.lastTranslation && (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="secondary">Più recente</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(stats.lastTranslation.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{stats.lastTranslation.original}</p>
                        <p className="text-sm text-muted-foreground">→ {stats.lastTranslation.translated}</p>
                      </div>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}



