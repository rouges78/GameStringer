
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Gamepad2, 
  Languages, 
  Search,
  Download,
  Box,
  Clock,
  RefreshCw,
  Store
} from 'lucide-react';
import Link from 'next/link';
import { ScanButton } from '@/components/scan-button';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';

// Componenti UI riutilizzabili
const StatCard = ({ icon: Icon, title, value, change, progress, color }: any) => (
  <Card className="bg-card/50 backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className={`h-5 w-5 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {change && <p className="text-xs text-muted-foreground">{change}</p>}
      {progress !== undefined && <Progress value={progress} className="mt-2 h-2" />}
    </CardContent>
  </Card>
);

const ActionButton = ({ icon: Icon, label, href }: any) => (
  <Button variant="ghost" className="w-full justify-start" asChild>
    <Link href={href}>
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Link>
  </Button>
);

const RecentActivityItem = ({ color, text, time }: any) => (
  <div className="flex items-start">
    <div className={`mt-1.5 h-2 w-2 rounded-full ${color} mr-3 flex-shrink-0`}></div>
    <div className="flex-grow">
      <p className="text-sm">{text}</p>
      <p className="text-xs text-muted-foreground">{time}</p>
    </div>
  </div>
);

// Pagina Dashboard
export default function Dashboard() {
  const [stats, setStats] = useState({
    totalGames: 0,
    installedGames: 0,
    translations: 0,
    patches: 0,
    lastScan: null as Date | null,
    storeStats: {
      steam: { connected: false, games: 0 },
      epic: { connected: false, games: 0 },
      gog: { connected: false, games: 0 },
      origin: { connected: false, games: 0 },
      ubisoft: { connected: false, games: 0 },
      battlenet: { connected: false, games: 0 },
      itchio: { connected: false, games: 0 }
    }
  });
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Aggiorna ogni 30 secondi
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Recupera giochi da tutti gli store usando comando Tauri aggiornato
      const games = await invoke('get_games') as any[];
      
      // Recupera statistiche traduzioni salvate
      const savedTranslations = JSON.parse(localStorage.getItem('gameTranslations') || '[]');
      const savedPatches = JSON.parse(localStorage.getItem('gamePatches') || '[]');
      
      // Test connessioni store per statistiche reali
      const storeTests = await Promise.allSettled([
        invoke('test_steam_connection').then(result => ({ store: 'steam', result, connected: true })).catch(() => ({ store: 'steam', result: '', connected: false })),
        invoke('test_epic_connection').then(result => ({ store: 'epic', result, connected: true })).catch(() => ({ store: 'epic', result: '', connected: false })),
        invoke('test_gog_connection').then(result => ({ store: 'gog', result, connected: true })).catch(() => ({ store: 'gog', result: '', connected: false })),
        invoke('test_origin_connection').then(result => ({ store: 'origin', result, connected: true })).catch(() => ({ store: 'origin', result: '', connected: false })),
        invoke('test_ubisoft_connection').then(result => ({ store: 'ubisoft', result, connected: true })).catch(() => ({ store: 'ubisoft', result: '', connected: false })),
        invoke('test_battlenet_connection').then(result => ({ store: 'battlenet', result, connected: true })).catch(() => ({ store: 'battlenet', result: '', connected: false })),
        invoke('test_itchio_connection').then(result => ({ store: 'itchio', result, connected: true })).catch(() => ({ store: 'itchio', result: '', connected: false }))
      ]);
      
      // Processa risultati store
      const storeStats: any = {};
      storeTests.forEach((test, index) => {
        const stores = ['steam', 'epic', 'gog', 'origin', 'ubisoft', 'battlenet', 'itchio'];
        const storeName = stores[index];
        
        if (test.status === 'fulfilled') {
          const data = test.value;
          const gamesMatch = data.result.match(/(\d+) giochi/);
          const gamesCount = gamesMatch ? parseInt(gamesMatch[1]) : 0;
          
          storeStats[storeName] = {
            connected: data.connected,
            games: gamesCount
          };
        } else {
          storeStats[storeName] = { connected: false, games: 0 };
        }
      });
      
      setStats({
        totalGames: games.length,
        installedGames: games.filter((g: any) => g.is_installed).length,
        translations: savedTranslations.length,
        patches: savedPatches.length,
        lastScan: new Date(localStorage.getItem('lastSteamScan') || Date.now()),
        storeStats
      });

      // Genera attività recenti basate sui dati reali
      const recentActivities = [];
      
      if (savedTranslations.length > 0) {
        const lastTranslation = savedTranslations[savedTranslations.length - 1];
        recentActivities.push({
          color: 'bg-purple-500',
          text: `${lastTranslation.gameName}: Traduzione completata`,
          time: getRelativeTime(new Date(lastTranslation.date))
        });
      }
      
      if (savedPatches.length > 0) {
        const lastPatch = savedPatches[savedPatches.length - 1];
        recentActivities.push({
          color: 'bg-orange-500',
          text: `${lastPatch.gameName}: Patch creata`,
          time: getRelativeTime(new Date(lastPatch.date))
        });
      }
      
      if (stats.lastScan) {
        recentActivities.push({
          color: 'bg-green-500',
          text: 'Steam: Sincronizzazione completata',
          time: getRelativeTime(stats.lastScan)
        });
      }
      
      setActivities(recentActivities);
      setLoading(false);
    } catch (error) {
      console.error('Errore caricamento dashboard:', error);
      setLoading(false);
    }
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 60) return `${minutes} min fa`;
    if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;
    return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;
  };

  const installedProgress = stats.totalGames > 0 ? (stats.installedGames / stats.totalGames) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Panoramica del sistema di traduzione giochi</p>
        </div>
        <ScanButton />
      </div>

      { /* Sezione Statistiche */ }
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatCard 
            icon={Gamepad2} 
            title="Giochi Totali" 
            value={loading ? '...' : stats.totalGames} 
            change={stats.totalGames > 0 ? 'Da Steam' : 'Nessun gioco trovato'} 
            color="text-primary" 
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatCard 
            icon={Download} 
            title="Giochi Installati" 
            value={loading ? '...' : stats.installedGames} 
            progress={installedProgress} 
            color="text-sky-400" 
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatCard 
            icon={Languages} 
            title="Traduzioni" 
            value={loading ? '...' : stats.translations} 
            change={stats.translations > 0 ? 'Salvate localmente' : 'Nessuna traduzione'} 
            color="text-emerald-400" 
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <StatCard 
            icon={Box} 
            title="Patch Create" 
            value={loading ? '...' : stats.patches} 
            change={stats.patches > 0 ? 'Pronte all\'uso' : 'Nessuna patch'} 
            color="text-amber-400" 
          />
        </motion.div>
      </div>

      { /* Sezione Store Statistics - Design Migliorato */ }
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 rounded-lg bg-primary/10">
                <Store className="h-5 w-5 text-primary" />
              </div>
              Stato Store
              <Badge variant="outline" className="ml-auto">
                {Object.values(stats.storeStats).filter((store: any) => store.connected).length} / {Object.keys(stats.storeStats).length} connessi
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Object.entries(stats.storeStats).map(([storeName, storeData]: [string, any]) => {
                const storeIcons: { [key: string]: any } = {
                  steam: '🎮',
                  epic: '🎯', 
                  gog: '🏆',
                  origin: '🎲',
                  ubisoft: '⚡',
                  battlenet: '⚔️',
                  itchio: '🎨'
                };
                
                return (
                  <motion.div 
                    key={storeName}
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 rounded-xl border transition-all duration-200 ${
                      storeData.connected 
                        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                        : 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{storeIcons[storeName] || '🎮'}</span>
                        <span className="font-semibold capitalize text-sm">{storeName}</span>
                      </div>
                      <div className={`h-2 w-2 rounded-full ${
                        storeData.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`} />
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-foreground">{storeData.games}</div>
                      <div className="text-xs text-muted-foreground">giochi</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            
            { /* Statistiche Aggregate */ }
            <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {Object.values(stats.storeStats).reduce((total: number, store: any) => total + store.games, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Totale Giochi</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-500">
                    {Object.values(stats.storeStats).filter((store: any) => store.connected).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Store Attivi</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      { /* Sezione Principale */ }
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Attività Recenti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length > 0 ? (
              activities.map((activity, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <RecentActivityItem {...activity} />
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nessuna attività recente</p>
                <p className="text-sm mt-2">Inizia traducendo un gioco!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Azioni Rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <ActionButton icon={Gamepad2} label="Gestisci Giochi" href="/games" />
              <ActionButton icon={Clock} label="Injekt-Translator" href="/realtime" />
              <ActionButton icon={Box} label="Crea Patch" href="/patches" />
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Stato Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">AI Engine</span>
                <Badge variant="outline" className="border-green-500/50 text-green-400">Online</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Steam API</span>
                <Badge variant="outline" className="border-green-500/50 text-green-400">Connesso</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Giochi Rilevati</span>
                <span className="font-medium">{stats.totalGames}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Ultima Scansione</span>
                <span className="text-muted-foreground">
                  {stats.lastScan ? getRelativeTime(stats.lastScan) : 'Mai'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
