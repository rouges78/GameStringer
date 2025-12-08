
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Gamepad2, 
  Clock,
  RefreshCw,
  Box,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { safeInvoke as invoke, isTauriEnvironment } from '@/lib/tauri-wrapper';
import { ScanButton } from '@/components/scan-button';
import { cacheManager } from '@/lib/cache-manager';


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
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    fetchDashboardData();
    
    // Aggiornamento automatico ogni 15 secondi
    const interval = setInterval(fetchDashboardData, 15000);
    
    // Aggiorna quando l'utente torna alla pagina/finestra
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Dashboard: Page visible, refreshing data');
        fetchDashboardData();
      }
    };
    
    const handleFocus = () => {
      console.log('🔄 Dashboard: Window focused, refreshing data');
      fetchDashboardData();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Listener per storage events (quando i giochi cambiano in altre pagine)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gameTranslations' || e.key === 'gamePatches' || e.key === 'lastSteamScan') {
        console.log('🔄 Dashboard: Storage changed, refreshing data');
        fetchDashboardData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Dashboard: Refreshing data...');
      
      let games: any[] = [];
      
      // 🚀 PRIMA: Prova a caricare dalla cache locale (veloce!)
      console.log('📂 Dashboard: Tentativo caricamento dalla cache...');
      try {
        const cachedGames = await invoke('load_steam_games_cache') as any[];
        if (cachedGames && cachedGames.length > 0) {
          console.log(`✅ Dashboard: Cache trovata con ${cachedGames.length} giochi!`);
          games = cachedGames;
        }
      } catch (cacheError) {
        console.log('📂 Dashboard: Cache non disponibile, caricamento normale...');
      }
      
      // Se la cache è vuota, usa i metodi tradizionali
      if (games.length === 0) {
        console.log('🔍 Dashboard: Debug sistema caricamento giochi...');
        
        try {
          // Prima debug del metodo normale get_games
          console.log('🧪 Test 1: Metodo get_games normale');
        const normalGames = await invoke('get_games') as any[];
        console.log('📊 get_games normale:', normalGames.length, 'giochi trovati');
        
        // Poi test del metodo veloce
        console.log('🧪 Test 2: Metodo Rai Pal (get_steam_games_fast)');
        const fastGames = await invoke('get_steam_games_fast') as any[];
        console.log('📊 Metodo Rai Pal:', fastGames.length, 'giochi trovati');
        
        // Test connessione Steam diretta  
        console.log('🧪 Test 3: Test connessione Steam API');
        const steamTest = await invoke('test_steam_connection') as string;
        console.log('📊 Steam connection test:', steamTest);
        
        // Test 4: CRITICO - Verifica credenziali Steam per API
        console.log('🧪 Test 4: Verifica credenziali Steam API');
        try {
          const credentials = await invoke('load_steam_credentials') as any;
          if (credentials) {
            console.log('✅ Credenziali Steam trovate!');
            console.log('🔑 Steam ID:', credentials.steam_id);
            console.log('🔑 API Key salvata:', credentials.api_key_encrypted ? 'Sì (criptata)' : 'No');
            
            // Test 5: Prova chiamata diretta API Steam con credenziali
            console.log('🧪 Test 5: Chiamata diretta API Steam');
            try {
              const apiGames = await invoke('get_steam_games', {
                apiKey: '', // Rust userà credenziali salvate se vuote
                steamId: '',
                forceRefresh: true
              }) as any[];
              console.log('📊 API Steam diretta:', apiGames.length, 'giochi trovati');
              if (apiGames.length > 0) {
                games = apiGames;
                console.log('🎯 SUCCESSO! Usando API Steam diretta');
              }
            } catch (apiError) {
              console.error('❌ Errore API Steam diretta:', apiError);
            }
          } else {
            console.error('❌ PROBLEMA: Nessuna credenziale Steam trovata!');
            console.log('💡 SOLUZIONE: Vai in Settings per configurare API Steam');
          }
        } catch (credError) {
          console.error('❌ Errore verifica credenziali:', credError);
          console.log('💡 AZIONE: Configura credenziali Steam in Settings');
        }
        
        // Usa il metodo che ha più giochi (includendo force refresh se testato)
        if (!games || games.length === 0) {
          if (fastGames.length > normalGames.length) {
            console.log('🎯 Usando metodo Rai Pal (più giochi)');
            games = fastGames;
          } else if (normalGames.length > 0) {
            console.log('🎯 Usando metodo normale');
            games = normalGames;
          } else {
            console.log('⚠️ Tutti i metodi falliti, ultimo tentativo con cache');
            games = await cacheManager.cached(
              'dashboard-games',
              () => invoke('get_games') as Promise<any[]>,
              2 * 60 * 1000 // 2 minuti
            );
          }
        }
        
        console.log('📈 RISULTATO FINALE:', games.length, 'giochi per la dashboard');
        
      } catch (error) {
        console.error('❌ Errore completo debug giochi:', error);
        // Fallback finale
        games = [];
      }
      } // Fine if (games.length === 0)
      
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
      setLastUpdate(new Date());
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
    <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 p-4 overflow-hidden">
      {/* Header compatto */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Dashboard
          </h1>
          {lastUpdate && (
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {lastUpdate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <ScanButton />
          <Button
            onClick={() => fetchDashboardData()}
            disabled={loading}
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Grid - compatto */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
          <div className="text-lg font-bold text-purple-400">{stats.totalGames}</div>
          <div className="text-[10px] text-gray-500">Giochi</div>
        </div>
        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
          <div className="text-lg font-bold text-blue-400">{stats.installedGames}</div>
          <div className="text-[10px] text-gray-500">Installati</div>
        </div>
        <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
          <div className="text-lg font-bold text-cyan-400">{stats.translations}</div>
          <div className="text-[10px] text-gray-500">Traduzioni</div>
        </div>
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
          <div className="text-lg font-bold text-emerald-400">{stats.patches}</div>
          <div className="text-[10px] text-gray-500">Patch</div>
        </div>
      </div>

      {/* Main content - due colonne */}
      <div className="grid grid-cols-3 gap-3" style={{ height: 'calc(100% - 120px)' }}>
        {/* Activity */}
        <div className="col-span-2 rounded-lg bg-slate-800/30 border border-slate-700/50 p-3 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-medium text-gray-300">Attività Recenti</span>
            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <RefreshCw className="h-5 w-5 text-cyan-500 animate-spin" />
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-2">
              {activities.slice(0, 4).map((activity, index) => (
                <div key={index} className="flex items-center gap-2 p-2 rounded bg-slate-700/30 text-xs">
                  <div className={`h-1.5 w-1.5 rounded-full ${activity.color}`} />
                  <span className="text-gray-300 flex-1 truncate">{activity.text}</span>
                  <span className="text-gray-500 text-[10px]">{activity.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-20 text-gray-500">
              <Clock className="h-5 w-5 mb-1 opacity-50" />
              <span className="text-xs">Nessuna attività</span>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="rounded-lg bg-slate-800/30 border border-slate-700/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-xs font-medium text-gray-300">Azioni Rapide</span>
          </div>
          
          <div className="space-y-1.5">
            <Link href="/library" className="flex items-center gap-2 p-2 rounded bg-purple-500/10 hover:bg-purple-500/20 transition-colors text-xs text-gray-300">
              <Gamepad2 className="h-3 w-3 text-purple-400" />
              Libreria
            </Link>
            <Link href="/translator/pro" className="flex items-center gap-2 p-2 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-colors text-xs text-gray-300">
              <Clock className="h-3 w-3 text-blue-400" />
              Translator
            </Link>
            <Link href="/editor" className="flex items-center gap-2 p-2 rounded bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors text-xs text-gray-300">
              <Box className="h-3 w-3 text-cyan-400" />
              Editor
            </Link>
            <Link href="/settings" className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors text-xs text-gray-300">
              <Settings className="h-3 w-3 text-emerald-400" />
              Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
