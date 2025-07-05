'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { invoke } from '@tauri-apps/api/core';
import { 
  Search, 
  RefreshCw, 
  ServerCrash, 
  Gamepad2,
  Filter,
  ArrowDownUp,
  DownloadCloud,
  Camera,
  CloudOff,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import GameImage from '@/components/game-image';
import GameCard from '@/components/game-card';
import HowLongToBeatDisplay from '../components/HowLongToBeatDisplay';
import type { SteamGame, LocalGame, HowLongToBeatData } from '@/lib/types';

// Tipo unificato per la visualizzazione nell'interfaccia
interface DisplayGame {
  id: string; // Usiamo appid di steam o id del gioco locale
  title: string;
  imageUrl: string;
  fallbackImageUrl: string | null;
  platform: 'Steam' | 'Local';
  isInstalled: boolean;
  playtime: number;
  lastPlayed: number;
  isVrSupported?: boolean;
  engine?: string;
  howLongToBeat?: HowLongToBeatData;
  genres?: { id: string; description: string }[];
  categories?: { id: number; description: string }[];
  shortDescription?: string;
  isFree?: boolean;
  developers?: string[];
  publishers?: string[];
  releaseDate?: {
    coming_soon: boolean;
    date: string;
  };
  supportedLanguages?: string;
  pcRequirements?: {
    minimum?: string;
    recommended?: string;
  };
}

const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: React.ElementType, color: string }) => (
  <Card className="bg-card/50 backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <Icon className={`h-5 w-5 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </CardContent>
  </Card>
);

export default function GamesPage() {
  const { data: session, status } = useSession();
  const [games, setGames] = useState<DisplayGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [installationFilter, setInstallationFilter] = useState('all'); // 'all', 'installed', 'uninstalled'
  const [showVrOnly, setShowVrOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState('title-asc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadGames = async (forceRefresh = false) => {
    console.log(`[FRONTEND DEBUG] loadGames called. forceRefresh = ${forceRefresh}`);
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      console.log('[FRONTEND DEBUG] Session status:', status);
      console.log('[FRONTEND DEBUG] Session data:', session);
      
      // Recupera credenziali Steam dalla sessione next-auth
      let steamId = 'demo_id';
      let apiKey = 'demo_key';
      
      if (session?.user) {
        // Se l'utente è autenticato, prova a estrarre il SteamID
        const userEmail = session.user.email;
        console.log('[FRONTEND DEBUG] Email utente dalla sessione:', userEmail);
        
        if (userEmail && userEmail.includes('@steam.local')) {
          // Estrai SteamID dall'email (formato: steamid@steam.local)
          steamId = userEmail.replace('@steam.local', '');
          console.log('[FRONTEND DEBUG] ✅ SteamID estratto dalla sessione:', steamId);
        } else {
          console.log('[FRONTEND DEBUG] ❌ Email non contiene @steam.local, uso demo_id');
        }
        
        // Usa API key dal localStorage come fallback
        apiKey = localStorage.getItem('steamApiKey') || 'demo_key';
        console.log('[FRONTEND DEBUG] API Key usata:', apiKey);
      } else {
        console.log('[FRONTEND DEBUG] ❌ Nessuna sessione attiva, uso credenziali demo');
      }
      
      // TEST: Verifica comunicazione Tauri
      console.log('[FRONTEND DEBUG] 🧪 Test comunicazione Tauri...');
      try {
        const testResult = await invoke('test_steam_connection');
        console.log('[FRONTEND DEBUG] ✅ Test Tauri riuscito:', testResult);
      } catch (error) {
        console.log('[FRONTEND DEBUG] ❌ Test Tauri fallito:', error);
        setError('Errore di comunicazione con il backend Tauri');
        setLoading(false);
        return;
      }
      
      // Carica in parallelo i giochi da Steam (via Tauri) e quelli locali
      console.log('[FRONTEND DEBUG] 🚀 Chiamata Tauri get_steam_games con:', { apiKey, steamId, forceRefresh });
      console.log('[FRONTEND DEBUG] 🚀 Chiamata Tauri get_library_games...');
      
      // Timeout per evitare blocchi indefiniti
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Chiamate Tauri troppo lente')), 10000)
      );
      
      const [steamGames, localData] = await Promise.race([
        Promise.all([
          invoke('get_steam_games', {
            apiKey,
            steamId,
            forceRefresh
          }) as Promise<SteamGame[]>,
          invoke('get_library_games') as Promise<{ games: LocalGame[] }>
        ]),
        timeoutPromise
      ]) as [SteamGame[], { games: LocalGame[] }];
      
      console.log('[FRONTEND DEBUG] ✅ Risposta get_steam_games:', steamGames?.length || 0, 'giochi');
      console.log('[FRONTEND DEBUG] ✅ Risposta get_library_games:', localData?.games?.length || 0, 'giochi');

      const localGames: LocalGame[] = localData.games || [];

      // --- DEBUGGING: Log the first game object to check for enriched data ---
      if (steamGames && steamGames.length > 0) {
        console.log('--- DEBUG: First game data received from API ---');
        console.log(JSON.stringify(steamGames[0], null, 2));
        console.log('-------------------------------------------------');
      }
      // --- END DEBUGGING ---

      const localGameMap = new Map(
        localGames
          .filter(g => g.steamAppId !== null)
          .map(g => [g.steamAppId!, g])
      );

      // Definiamo un tipo per i giochi che verranno visualizzati, combinando le fonti
      const displayGames: DisplayGame[] = steamGames.map(steamGame => {
        const localGame = localGameMap.get(steamGame.appid);
        
        return {
          id: steamGame.appid.toString(),
          title: steamGame.name,
          imageUrl: steamGame.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${steamGame.appid}/header.jpg`,
          fallbackImageUrl: localGame?.imageUrl || null,
          platform: 'Steam',
          isInstalled: steamGame.is_installed,
          playtime: steamGame.playtime_forever,
          lastPlayed: steamGame.last_played,
          isVrSupported: steamGame.isVr,
          engine: steamGame.engine,
          howLongToBeat: steamGame.howLongToBeat,
          genres: steamGame.genres,
          categories: steamGame.categories,
          shortDescription: steamGame.short_description,
          isFree: steamGame.is_free,
          developers: steamGame.developers,
          publishers: steamGame.publishers,
          releaseDate: steamGame.release_date,
          supportedLanguages: steamGame.supported_languages,
          pcRequirements: steamGame.pc_requirements,
        };
      });

      setGames(displayGames);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto.');
      setGames([]);
    } finally {
      if (forceRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      loadGames();
    } else if (status === 'unauthenticated') {
      setIsLoading(false);
      setError('Devi aver effettuato l\'accesso con Steam per vedere i tuoi giochi.');
    }
    // Non fare nulla mentre lo stato è 'loading'
  }, [status]);

  const filteredAndSortedGames = useMemo(() => {
    const lowercasedSearchTerm = searchTerm.toLowerCase();

    return games
      .filter(game => {
        const searchMatch = game.title.toLowerCase().includes(lowercasedSearchTerm);
        const installMatch = installationFilter === 'all' || (installationFilter === 'installed' ? game.isInstalled : !game.isInstalled);
        const vrMatch = !showVrOnly || game.isVrSupported;
        return searchMatch && installMatch && vrMatch;
      })
      .sort((a, b) => {
        // Logica di priorità per la ricerca
        if (lowercasedSearchTerm) {
          const aTitle = a.title.toLowerCase();
          const bTitle = b.title.toLowerCase();
          const aStartsWith = aTitle.startsWith(lowercasedSearchTerm);
          const bStartsWith = bTitle.startsWith(lowercasedSearchTerm);

          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
        }

        // Logica di ordinamento standard
        switch (sortOrder) {
          case 'title-desc':
            return b.title.localeCompare(a.title);
          case 'playtime-desc':
            return (b.playtime || 0) - (a.playtime || 0);
          case 'title-asc':
          default:
            return a.title.localeCompare(b.title);
        }
      });
  }, [games, searchTerm, installationFilter, showVrOnly, sortOrder]);

  const vrGamesCount = useMemo(() => games.filter(g => g.isVrSupported).length, [games]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="mx-auto h-12 w-12 animate-spin text-blue-500" />
          <p className="mt-4 text-lg text-muted-foreground">Caricamento in corso...</p>
          {status === 'loading' && <p className="text-sm text-muted-foreground/50">Verifica autenticazione...</p>}
          {isLoading && status === 'authenticated' && <p className="text-sm text-muted-foreground/50">Recupero la tua libreria Steam...</p>}
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-8 bg-card/50 backdrop-blur-sm rounded-lg border">
          <h2 className="text-2xl font-bold">Connessione Store Richiesta</h2>
          <p className="mt-2 text-muted-foreground">Per favore, collega i tuoi store per visualizzare la libreria giochi.</p>
          <Button onClick={() => window.location.href = '/stores'} className="mt-6">
            Collega Store
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-8 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/20 rounded-2xl backdrop-blur-xl">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-6">
            <ServerCrash className="h-8 w-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-3">🎮 Nessun Gioco Trovato</h2>
          <p className="text-white/70 mb-2 leading-relaxed">Per iniziare a vedere i tuoi giochi, collega prima uno store:</p>
          <p className="text-blue-400 font-medium mb-6">Steam • Epic Games • GOG • Ubisoft • itch.io</p>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button 
              onClick={() => window.location.href = '/stores'} 
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200"
            >
              ✨ Collega Store
            </Button>
            <Button 
              onClick={() => loadGames()} 
              variant="outline" 
              className="border-white/20 text-white hover:bg-white/10 px-6 py-3 rounded-xl" 
              disabled={status !== 'authenticated'}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Riprova
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libreria Giochi</h1>
        <p className="text-muted-foreground">{filteredAndSortedGames.length} giochi mostrati su {games.length} totali.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Giochi Totali" value={games.length} icon={Gamepad2} color="text-blue-400" />
        <StatCard title="Installati" value={games.filter(g => g.isInstalled).length} icon={DownloadCloud} color="text-green-400" />
        <StatCard title="Giochi VR" value={vrGamesCount} icon={Camera} color="text-purple-400" />
        <StatCard title="Non Installati" value={games.length - games.filter(g => g.isInstalled).length} icon={CloudOff} color="text-orange-400" />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cerca giochi..."
              className="pl-10 w-full bg-background/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
             <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full md:w-[180px] bg-background/50">
                <ArrowDownUp className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title-asc">Nome (A-Z)</SelectItem>
                <SelectItem value="title-desc">Nome (Z-A)</SelectItem>
                <SelectItem value="playtime-desc">Più giocati</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => { console.log('[FRONTEND DEBUG] Refresh button clicked!'); loadGames(true); }} disabled={isRefreshing || isLoading} title="Forza aggiornamento">
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
                <Button variant={installationFilter === 'all' ? 'secondary' : 'outline'} size="sm" onClick={() => setInstallationFilter('all')}>Tutti</Button>
                <Button variant={installationFilter === 'installed' ? 'secondary' : 'outline'} size="sm" onClick={() => setInstallationFilter('installed')}>Installati</Button>
                <Button variant={installationFilter === 'uninstalled' ? 'secondary' : 'outline'} size="sm" onClick={() => setInstallationFilter('uninstalled')}>Non Installati</Button>
            </div>
            <div className="flex items-center space-x-2">
                <Switch id="vr-only" checked={showVrOnly} onCheckedChange={setShowVrOnly} />
                <Label htmlFor="vr-only">Solo VR</Label>
            </div>
        </div>
      </div>

      {filteredAndSortedGames.length > 0 ? (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {filteredAndSortedGames.map((game, index) => (
            <GameCard key={game.id} game={game} index={index} />
          ))}
        </motion.div>
      ) : (
         <div className="text-center p-16 bg-background/30 rounded-lg">
            <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">Nessun gioco trovato</h3>
            <p className="text-muted-foreground mt-2">
              {searchTerm || installationFilter !== 'all' || showVrOnly
                ? 'Prova a modificare i filtri per trovare quello che cerchi.'
                : 'La tua libreria è vuota o i giochi sono ancora in fase di caricamento.'}
            </p>
          </div>
      )}
    </div>
  );
}