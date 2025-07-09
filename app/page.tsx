
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Gamepad2, 
  Clock,
  RefreshCw,
  Box,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { ScanButton } from '@/components/scan-button';
import { ForceRefreshButton } from '@/components/ui/force-refresh-button';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { cacheManager } from '@/lib/cache-manager';

// 🔧 FIX: Interfacce TypeScript proper invece di any

interface ActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

interface RecentActivityProps {
  color: string;
  text: string;
  time: string;
}

interface StoreStats {
  connected: boolean;
  games: number;
}

interface DashboardStats {
  totalGames: number;
  installedGames: number;
  translations: number;
  patches: number;
  lastScan: Date | null;
  storeStats: Record<string, StoreStats>;
}

// Componenti UI riutilizzabili

const ActionButton = ({ icon: Icon, label, href }: ActionButtonProps) => (
  <Button variant="ghost" className="w-full justify-start" asChild>
    <Link href={href}>
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Link>
  </Button>
);

const RecentActivityItem = ({ color, text, time }: RecentActivityProps) => (
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
    }
  });
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<RecentActivityProps[]>([]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Aggiorna ogni 30 secondi
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 🚀 Usa cache per migliorare performance
      const games = await cacheManager.cached(
        'dashboard-games',
        () => invoke('get_games') as Promise<any[]>,
        2 * 60 * 1000 // 2 minuti
      );
      
      // Recupera statistiche traduzioni salvate
      const savedTranslations = JSON.parse(localStorage.getItem('gameTranslations') || '[]');
      const savedPatches = JSON.parse(localStorage.getItem('gamePatches') || '[]');
      
      // Test connessioni store per statistiche reali
      const storeTests = await Promise.allSettled([
        invoke('test_steam_connection').then(result => ({ store: 'steam', result, connected: true })).catch(() => ({ store: 'steam', result: '', connected: false })),
        invoke('test_epic_connection').then(result => ({ store: 'epic', result, connected: result.connected || true })).catch(() => ({ store: 'epic', result: '', connected: false })),
        invoke('test_gog_connection').then(result => ({ store: 'gog', result, connected: true })).catch(() => ({ store: 'gog', result: '', connected: false })),
        invoke('test_origin_connection').then(result => ({ store: 'origin', result, connected: true })).catch(() => ({ store: 'origin', result: '', connected: false })),
        invoke('test_ubisoft_connection').then(result => ({ store: 'ubisoft', result, connected: true })).catch(() => ({ store: 'ubisoft', result: '', connected: false })),
        invoke('test_battlenet_connection').then(result => ({ store: 'battlenet', result, connected: true })).catch(() => ({ store: 'battlenet', result: '', connected: false })),
        invoke('test_itchio_connection').then(result => ({ store: 'itchio', result, connected: true })).catch(() => ({ store: 'itchio', result: '', connected: false }))
      ]);
      
      // Processa risultati store
      const storeStats: Record<string, StoreStats> = {};
      storeTests.forEach((test, index) => {
        const stores = ['steam', 'epic', 'gog', 'origin', 'ubisoft', 'battlenet', 'itchio'];
        const storeName = stores[index];
        
        if (test.status === 'fulfilled') {
          const data = test.value;
          let gamesCount = 0;
          let connected = data.connected;
          
          // 🔄 Gestisce sia formato stringa che JSON
          if (typeof data.result === 'string') {
            // Formato vecchio: stringa da parsare
            const gamesMatch = data.result.match(/(\d+) giochi/);
            gamesCount = gamesMatch ? parseInt(gamesMatch[1]) : 0;
          } else if (typeof data.result === 'object' && data.result !== null) {
            // Formato nuovo: oggetto JSON (Epic Games)
            gamesCount = data.result.games_count || 0;
            connected = data.result.connected || false;
          }
          
          storeStats[storeName] = {
            connected: connected,
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


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 p-4 sm:p-6 lg:p-8 space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg blur opacity-25 animate-pulse" />
          <div className="relative bg-slate-900/80 rounded-lg p-4 border border-purple-500/20">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Neural Dashboard
            </h1>
            <p className="text-gray-400 font-medium">Sistema di traduzione avanzato con intelligenza artificiale</p>
          </div>
        </div>
        <div className="flex gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ScanButton />
          </motion.div>
          <ForceRefreshButton onRefreshComplete={(games) => {
            console.log('🔄 Dashboard: Force refresh completed, games updated');
            // Qui potresti aggiornare le statistiche della dashboard se necessario
          }} />
        </div>
      </motion.div>


      { /* Hero Section - Design Futuristico */ }
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="relative overflow-hidden"
      >
        <Card className="bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-cyan-900/20 backdrop-blur-xl border border-purple-500/20 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-cyan-600/10 animate-pulse" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500" />
          
          <CardContent className="relative p-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="text-center lg:text-left">
                <p className="text-lg text-gray-300 mb-4 max-w-2xl leading-relaxed">
                  Sistema di traduzione intelligente con AI per giochi multi-piattaforma
                </p>
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 px-3 py-1">
                    🤖 AI-Powered
                  </Badge>
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 px-3 py-1">
                    🎮 Multi-Platform
                  </Badge>
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30 px-3 py-1">
                    ⚡ Real-Time
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-400/20">
                  <div className="text-2xl font-bold text-purple-400">{stats.totalGames}</div>
                  <div className="text-xs text-gray-400">Giochi Rilevati</div>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-400/20">
                  <div className="text-2xl font-bold text-blue-400">{stats.translations}</div>
                  <div className="text-xs text-gray-400">Traduzioni</div>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 border border-cyan-400/20">
                  <div className="text-2xl font-bold text-cyan-400">{stats.installedGames}</div>
                  <div className="text-xs text-gray-400">Installati</div>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-purple-500/10 border border-emerald-400/20">
                  <div className="text-2xl font-bold text-emerald-400">{stats.patches}</div>
                  <div className="text-xs text-gray-400">Patch</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      { /* Sezione Principale - Design Futuristico */ }
      <div className="grid gap-8 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          className="md:col-span-2"
        >
          <Card className="bg-gradient-to-br from-slate-800/30 via-slate-900/30 to-slate-800/30 backdrop-blur-xl border border-slate-600/30 shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500" />
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl text-white">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                  <Clock className="h-5 w-5 text-cyan-400" />
                </div>
                Neural Activity Stream
                <div className="ml-auto flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-gray-400">Live</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-slate-700 border-t-cyan-500 animate-spin" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                  </div>
                </div>
              ) : activities.length > 0 ? (
                activities.map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="group p-4 rounded-xl bg-gradient-to-r from-slate-800/30 to-slate-700/30 border border-slate-600/20 hover:border-purple-500/30 transition-all duration-300"
                  >
                    <RecentActivityItem {...activity} />
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="mb-4 p-4 rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 mx-auto w-fit">
                    <Clock className="h-8 w-8 text-gray-500" />
                  </div>
                  <p className="text-gray-400 text-lg mb-2">Nessuna attività rilevata</p>
                  <p className="text-sm text-gray-500">Il sistema è in attesa di operazioni...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
          className="md:col-span-1"
        >
          <Card className="bg-gradient-to-br from-slate-800/30 via-slate-900/30 to-slate-800/30 backdrop-blur-xl border border-slate-600/30 shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg text-white">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
                  <Gamepad2 className="h-5 w-5 text-purple-400" />
                </div>
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border border-purple-500/20 text-white transition-all duration-300 text-xs" asChild>
                  <Link href="/library">
                    <Gamepad2 className="mr-2 h-3 w-3 text-purple-400" />
                    Libreria
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border border-blue-500/20 text-white transition-all duration-300 text-xs" asChild>
                  <Link href="/injekt-translator">
                    <Clock className="mr-2 h-3 w-3 text-blue-400" />
                    Translator
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 hover:from-cyan-500/20 hover:to-emerald-500/20 border border-cyan-500/20 text-white transition-all duration-300 text-xs" asChild>
                  <Link href="/patches">
                    <Box className="mr-2 h-3 w-3 text-cyan-400" />
                    Patches
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 bg-gradient-to-r from-emerald-500/10 to-purple-500/10 hover:from-emerald-500/20 hover:to-purple-500/20 border border-emerald-500/20 text-white transition-all duration-300 text-xs" asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-3 w-3 text-emerald-400" />
                    Settings
                  </Link>
                </Button>
              </motion.div>
            </CardContent>
          </Card>

        </motion.div>
      </div>
    </div>
  );
}
