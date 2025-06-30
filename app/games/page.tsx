'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
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
      // Carica in parallelo i giochi da Steam e quelli locali
      const [steamResponse, localResponse] = await Promise.all([
        fetch(`/api/steam/games${forceRefresh ? '?force=true' : ''}`),
        fetch('/api/games')
      ]);

      if (!steamResponse.ok) {
        throw new Error(`Errore API Steam: ${await steamResponse.text()}`);
      }

      const steamGames: SteamGame[] = await steamResponse.json();
      const localGames: LocalGame[] = localResponse.ok ? await localResponse.json() : [];

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
          <h2 className="text-2xl font-bold">Accesso Richiesto</h2>
          <p className="mt-2 text-muted-foreground">Per favore, accedi con il tuo account Steam per continuare.</p>
          <Button onClick={() => window.location.href = '/api/auth/signin/steam'} className="mt-6">
            Accedi con Steam
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-6 bg-destructive/10 border border-destructive/50 rounded-lg">
          <ServerCrash className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-xl font-semibold text-destructive">Oops! Qualcosa è andato storto.</h2>
          <p className="mt-2 text-destructive/80">{error}</p>
          <Button onClick={() => loadGames()} className="mt-6" disabled={status !== 'authenticated'}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Riprova
          </Button>
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