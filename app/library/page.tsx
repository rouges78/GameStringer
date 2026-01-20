'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { invoke } from '@/lib/tauri-api';
import { activityHistory } from '@/lib/activity-history';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LanguageFlags, languageToCountryCode, getFlagEmoji, getCountryCode } from '@/components/ui/language-flags';
import { ForceRefreshButton } from '@/components/ui/force-refresh-button';
import { ensureArray, validateArray } from '@/lib/array-utils';
import { toast } from 'sonner';
import * as CountryFlags from 'country-flag-icons/react/3x2';
import { VirtuosoGrid } from 'react-virtuoso';
import { loadLibraryFilters, saveLibraryFilters, fuzzyMatch, useDebouncedValue } from '@/lib/library-filters';
import { Gamepad2 } from 'lucide-react';
import { useTranslation, translations } from '@/lib/i18n';

// Define l'interfaccia per un singolo game, assicurandoci che corrisponda al backend
interface Game {
  id: string;
  app_id: string;
  title: string;
  platform: string;
  header_image: string | null;
  supported_languages?: string[]; // Lingue supportate dal game
  is_vr?: boolean; // Se il game supporta VR
  engine?: string | null; // Engine utilizzato dal game
  is_installed?: boolean; // Se il game è installato localmente
  install_dir?: string; // Directory di installazione
  genres?: string[]; // Generi del game
  last_played?: number; // Timestamp ultimo accesso
  isShared?: boolean; // Se il game è condiviso tramite Family Sharing
  added_date?: number; // Data di aggiunta alla library (timestamp)
}

// Helper per generare URL pagina dettaglio game
const getGameDetailUrl = (game: Game): string => {
  const params = new URLSearchParams();
  params.set('name', game.title || '');
  if (game.install_dir) params.set('installDir', game.install_dir);
  params.set('installed', String(game.is_installed || false));
  params.set('platform', game.platform || 'Steam');
  if (game.header_image) params.set('headerImage', game.header_image);
  // Passa sempre l'appId numerico se disponibile
  const numericAppId = game.app_id || (game.id?.match(/\d+/)?.[0]);
  if (numericAppId) params.set('appId', String(numericAppId));
  
  return `/games/${game.id || game.app_id}?${params.toString()}`;
}

// Componente per immagine game con fallback
const GameImageWithFallback = ({ game, sizes }: { game: Game; sizes: string }) => {
  const [hasError, setHasError] = React.useState(false);
  
  // Placeholder colorato basato sul nome
  const getGradient = (name: string) => {
    const gradients = [
      'from-purple-900/80 to-blue-900/80',
      'from-red-900/80 to-orange-900/80',
      'from-green-900/80 to-teal-900/80',
      'from-pink-900/80 to-purple-900/80',
      'from-yellow-900/80 to-red-900/80',
      'from-cyan-900/80 to-blue-900/80',
    ];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
  };

  if (hasError || !game.header_image || game.title.startsWith('Game ')) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getGradient(game.title)}`}>
        <span className="text-4xl font-bold text-white/60">
          {game.title ? game.title.replace('Game ', '').charAt(0).toUpperCase() : '?'}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={game.header_image}
      alt={game.title}
      fill
      sizes={sizes}
      className="object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

// Funzione per normalizzare i nomi delle lingue
const normalizeLanguage = (language: string): string => {
  const languageMap: { [key: string]: string } = {
    // Inglese
    'english': 'English',
    'English': 'English',
    'en': 'English',
    'EN': 'English',
    
    // Italiano
    'italian': 'Italian',
    'Italian': 'Italian',
    'italiano': 'Italian',
    'Italiano': 'Italian',
    'it': 'Italian',
    'IT': 'Italian',
    
    // Francese
    'french': 'French',
    'French': 'French',
    'français': 'French',
    'Français': 'French',
    'fr': 'French',
    'FR': 'French',
    
    // Tedesco
    'german': 'German',
    'German': 'German',
    'deutsch': 'German',
    'Deutsch': 'German',
    'de': 'German',
    'DE': 'German',
    
    // Spagnolo
    'spanish': 'Spanish',
    'Spanish': 'Spanish',
    'español': 'Spanish',
    'Español': 'Spanish',
    'es': 'Spanish',
    'ES': 'Spanish',
    
    // Giapponese
    'japanese': 'Japanese',
    'Japanese': 'Japanese',
    '日本語': 'Japanese',
    'ja': 'Japanese',
    'JA': 'Japanese',
    
    // Russo
    'russian': 'Russian',
    'Russian': 'Russian',
    'русский': 'Russian',
    'Русский': 'Russian',
    'ru': 'Russian',
    'RU': 'Russian',
    
    // Portoghese
    'portuguese': 'Portuguese',
    'Portuguese': 'Portuguese',
    'português': 'Portuguese',
    'Português': 'Portuguese',
    'pt': 'Portuguese',
    'PT': 'Portuguese',
    
    // Cinese
    'chinese': 'Chinese',
    'Chinese': 'Chinese',
    'simplified chinese': 'Chinese',
    'traditional chinese': 'Chinese',
    '中文': 'Chinese',
    'zh': 'Chinese',
    'ZH': 'Chinese',
    
    // Coreano
    'korean': 'Korean',
    'Korean': 'Korean',
    '한국어': 'Korean',
    'ko': 'Korean',
    'KO': 'Korean',
    
    // Polacco
    'polish': 'Polish',
    'Polish': 'Polish',
    'polski': 'Polish',
    'Polski': 'Polish',
    'pl': 'Polish',
    'PL': 'Polish',
    
    // Olandese
    'dutch': 'Dutch',
    'Dutch': 'Dutch',
    'nederlands': 'Dutch',
    'Nederlands': 'Dutch',
    'nl': 'Dutch',
    'NL': 'Dutch',
    
    // Arabo
    'arabic': 'Arabic',
    'Arabic': 'Arabic',
    'العربية': 'Arabic',
    'ar': 'Arabic',
    'AR': 'Arabic',
  };
  
  return languageMap[language] || language;
};

export default function LibraryPage() {
  const { language } = useTranslation();
  const lib = translations[language]?.library || translations.it.library;
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Safe setter per games con validazione
  const setGamesWithValidation = (value: unknown) => {
    const validGames = ensureArray<Game>(value);
    
    if (!validateArray(value, 'LibraryPage.setGames')) {
      console.error('[LibraryPage] Attempt to set games with non-array value:', typeof value, value);
    }
    
    setGames(validGames);
  };
  // Carica filtri salvati all'avvio
  const savedFilters = useMemo(() => loadLibraryFilters(), []);
  
  const [sortBy, setSortBy] = useState<'alphabetical' | 'lastPlayed' | 'recentlyAdded' | 'playtime'>(savedFilters.sortBy);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(savedFilters.selectedPlatforms);
  const [selectedTags, setSelectedTags] = useState<string[]>(savedFilters.selectedTags);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(savedFilters.selectedStatus);
  const [selectedEngines, setSelectedEngines] = useState<string[]>(savedFilters.selectedEngines);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(savedFilters.selectedGenres);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(savedFilters.selectedLanguages);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(savedFilters.viewMode);
  const [showFilters, setShowFilters] = useState(false);
  
  // Debounce della ricerca per performance
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  
  // Salva filtri quando cambiano
  useEffect(() => {
    saveLibraryFilters({
      sortBy,
      viewMode,
      selectedPlatforms,
      selectedEngines,
      selectedLanguages,
      selectedGenres,
      selectedStatus,
      selectedTags,
      searchTerm: debouncedSearchTerm,
    });
  }, [sortBy, viewMode, selectedPlatforms, selectedEngines, selectedLanguages, selectedGenres, selectedStatus, selectedTags, debouncedSearchTerm]);
  
  // Helper per toggle multiselezione
  const toggleFilter = (arr: string[], setArr: (v: string[]) => void, value: string) => {
    setArr(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  };


  // 🚀 SCAN COMPLETO - Combina API Steam + File Locali
  const testFamilySharing = async () => {
    console.log('[LIBRARY DEBUG] 🚀 SCAN COMPLETO Steam...');
    setIsLoading(true);
    
    try {
      // 1️⃣ Prima ottieni i games dall'API (hanno i nomi corretti)
      const credentials = await invoke('load_steam_credentials') as { steam_id: string; api_key_encrypted: string } | null;
      let apiGames: Map<string, Game> = new Map();
      
      if (credentials) {
        try {
          const apiResult = await invoke('get_steam_games', {
            apiKey: credentials.api_key_encrypted,
            steamId: credentials.steam_id,
            forceRefresh: true
          }) as any[];
          
          console.log(`[LIBRARY DEBUG] 📊 Steam API: ${apiResult.length} games with names`);
          
          apiResult.forEach((g: any) => {
            apiGames.set(String(g.appid), {
              id: `steam_${g.appid}`,
              app_id: String(g.appid),
              title: g.name,
              platform: 'Steam',
              header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
              isShared: false,
              is_vr: false,
              is_installed: false
            });
          });
        } catch (e) {
          console.warn('[LIBRARY DEBUG] ⚠️ Steam API failed, using local files only');
        }
      }
      
      // 2️⃣ Poi scan locale per trovare TUTTI i games (inclusi Family Sharing)
      const localGames = await invoke('scan_all_steam_games_fast') as Array<{
        id: string;
        title: string;
        platform: string;
        install_path: string | null;
        header_image: string | null;
        is_installed: boolean;
        steam_app_id: number | null;
        is_shared: boolean;
        last_played: number | null;
        engine: string | null;
        added_date: number | null;
      }>;
      
      console.log(`[LIBRARY DEBUG] 📂 Local files: ${localGames.length} games found`);
      
      // 3️⃣ Combina: usa nomi API dove disponibili, altrimenti usa dati locali
      const finalGames: Game[] = [];
      const seenIds = new Set<string>();
      
      for (const local of localGames) {
        const appId = local.steam_app_id ? String(local.steam_app_id) : local.id.replace('steam_', '').replace('steam_shared_', '');
        
        if (seenIds.has(appId)) continue;
        seenIds.add(appId);
        
        // Usa dati API se disponibili (hanno nomi corretti)
        const apiGame = apiGames.get(appId);
        
        finalGames.push({
          id: local.id,
          app_id: appId,
          title: apiGame?.title || local.title,
          platform: 'Steam',
          header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
          isShared: local.is_shared,
          is_vr: false,
          is_installed: local.is_installed,
          last_played: local.last_played || undefined,
          engine: local.engine || undefined,
          install_dir: local.install_path || undefined,
          added_date: local.added_date || undefined,
        });
      }
      
      // Sort per titolo
      finalGames.sort((a, b) => a.title.localeCompare(b.title));
      
      setGames(finalGames);
      
      // Mostra notifica con results
      const gamesWithName = finalGames.filter(g => !g.title.startsWith('Game ') && !g.title.startsWith('Shared Game ')).length;
      toast.success('🎮 Family Sharing scan completed!', {
        description: `Found ${finalGames.length} total games (${gamesWithName} with name)`,
        duration: 5000,
      });
      
      console.log(`[LIBRARY] ✅ TOTAL: ${finalGames.length} games (${gamesWithName} with name)`);
      
    } catch (error) {
      console.error('[LIBRARY] ❌ error scan:', error);
      toast.error('Error during scan', {
        description: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setIsLoading(true);
        console.log('🚀 FULL LIBRARY LOADING (Owned + Family Sharing)...');

        // 1️⃣ SCAN LOCALE - Trova games INSTALLATI e SHARED (per arricchire dati API)
        let localScanData: Map<string, { is_installed: boolean; is_shared: boolean; title: string; engine?: string | null }> = new Map();
        try {
          const scanResult = await invoke('scan_all_steam_games_fast') as Array<{
            id: string;
            title: string;
            platform: string;
            install_path: string | null;
            header_image: string | null;
            is_installed: boolean;
            steam_app_id: number | null;
            is_shared: boolean;
            engine?: string | null;
            supported_languages?: string | null;
          }>;
          
          // Filtra solo games installati o shared (non tutti gli app ID)
          const relevantGames = scanResult.filter(g => g.is_installed || g.is_shared);
          console.log(`📂 Local scan: ${relevantGames.length} relevant games (of ${scanResult.length} total)`);
          
          for (const g of relevantGames) {
            const appId = g.steam_app_id ? String(g.steam_app_id) : g.id.replace('steam_', '').replace('steam_shared_', '');
            localScanData.set(appId, {
              is_installed: g.is_installed,
              is_shared: g.is_shared,
              title: g.title,
              engine: g.engine || null,
            });
          }
        } catch (scanError) {
          console.warn('⚠️ Local scan failed:', scanError);
        }
        
        // Mappa finale dei games
        let finalGamesMap: Map<string, Game> = new Map();

        // 2️⃣ API STEAM - Arricchisce con nomi corretti e dettagli
        let credentials;
        try {
          console.log('🔑 Loading Steam credentials...');
          credentials = await invoke('load_steam_credentials');
          console.log('🔑 Credentials loaded:', credentials ? 'OK' : 'NULL', credentials);
        } catch (credError) {
          console.warn('⚠️ Credentials loading error:', credError);
          credentials = null;
        }
        
        // 2️⃣ API STEAM - Fonte principale per i games OWNED
        const creds = credentials as { api_key_encrypted?: string; steam_id?: string };
        if (creds && creds.api_key_encrypted && creds.steam_id) {
          try {
            // Passa le Credentials loaded dal profilo
            const apiResult = await invoke('get_steam_games', {
              apiKey: creds.api_key_encrypted,  // API key dal profilo
              steamId: creds.steam_id,          // Steam ID dal profilo
              forceRefresh: true
            }) as any[];
            
            console.log(`📊 Steam API: ${apiResult.length} owned games`);
            
            // Aggiungi tutti i games dall'API (questi sono i games OWNED confermati)
            for (const g of apiResult) {
              const appId = String(g.appid);
              const localData = localScanData.get(appId);
              
              finalGamesMap.set(appId, {
                id: `steam_${appId}`,
                app_id: appId,
                title: g.name,
                platform: 'Steam',
                header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
                is_installed: localData?.is_installed || false,
                isShared: false, // Owned, non shared
                is_vr: g.is_vr || false,
                engine: localData?.engine || g.engine || null,
                supported_languages: typeof g.supported_languages === 'string' 
                  ? g.supported_languages.split(',').map((l: string) => l.trim()) 
                  : (g.supported_languages || []),
              });
            }
          } catch (apiError) {
            console.warn('⚠️ Steam API failed, using local data only:', apiError);
          }
        }
        
        // 3️⃣ Aggiungi games SHARED dallo scan locale (non presenti nell'API owned)
        // Un game è SHARED se: (a) marcato is_shared, oppure (b) installato ma non nell'API owned
        for (const [appId, localData] of localScanData) {
          if (!finalGamesMap.has(appId)) {
            // Se non è nell'API owned, è probabilmente shared (specialmente se installato)
            const isLikelyShared = localData.is_shared || localData.is_installed;
            if (isLikelyShared) {
              finalGamesMap.set(appId, {
                id: `steam_shared_${appId}`,
                app_id: appId,
                title: localData.title,
                platform: 'Steam',
                header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
                is_installed: localData.is_installed,
                isShared: true,
                is_vr: false,
                engine: localData.engine || null,
                supported_languages: [],
              });
            }
          }
        }

        // 4️⃣ ALTRI STORE - Epic Games, GOG, Origin, etc.
        try {
          console.log('🎮 Scanning other stores (Epic, GOG, Origin, etc.)...');
          const otherStoreGames = await invoke('scan_games') as Array<{
            id: string;
            title: string;
            platform: string;
            path: string;
            app_id?: string;
            header_image?: string;
            is_installed: boolean;
            is_vr?: boolean;
            engine?: string;
            supported_languages?: string[];
            genres?: string[];
            last_played?: number;
          }>;
          
          // Filtra solo games NON-Steam (Steam già caricato sopra)
          const nonSteamGames = otherStoreGames.filter(g => 
            g.platform !== 'Steam' && !g.id.startsWith('steam_')
          );
          
          console.log(`🎮 Other stores: ${nonSteamGames.length} games found`);
          
          for (const g of nonSteamGames) {
            const gameId = g.id || `${g.platform}_${g.app_id || g.title}`;
            if (!finalGamesMap.has(gameId)) {
              finalGamesMap.set(gameId, {
                id: gameId,
                app_id: g.app_id || gameId,
                title: g.title,
                platform: g.platform,
                header_image: g.header_image || null,
                is_installed: g.is_installed,
                isShared: false,
                is_vr: g.is_vr || false,
                engine: g.engine || null,
                supported_languages: g.supported_languages || [],
                genres: g.genres || [],
                last_played: g.last_played,
                install_dir: (g as any).install_path || (g as any).path || undefined,
              });
            }
          }
        } catch (otherStoreError) {
          console.warn('⚠️ Other stores scan error:', otherStoreError);
        }

        // 5️⃣ result FINALE
        const finalGames = Array.from(finalGamesMap.values());
        const steamCount = finalGames.filter(g => g.platform === 'Steam').length;
        const epicCount = finalGames.filter(g => g.platform === 'Epic Games').length;
        const otherCount = finalGames.filter(g => g.platform !== 'Steam' && g.platform !== 'Epic Games').length;
        const installedCount = finalGames.filter(g => g.is_installed).length;
        
        console.log(`✅ TOTAL: ${finalGames.length} games (Steam: ${steamCount}, Epic: ${epicCount}, Other: ${otherCount}, Installed: ${installedCount})`);
        
        await activityHistory.trackSteamSync(finalGames.length);
        setGamesWithValidation(finalGames);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('❌ Library loading error:', errorMsg);
        setGamesWithValidation([]);
        setError(`Unable to load games: ${errorMsg}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGames();
  }, []); // Carica solo una volta all'avvio

  const handleForceRefresh = (freshGames: Game[]) => {
    console.log('🔄 Force refresh completed, updating games list:', freshGames);
    
    // Aggiungi platform: 'Steam' a tutti i games se mancante
    const safeFreshGames = ensureArray<Game>(freshGames);
    const gamesWithPlatform = safeFreshGames.map(game => ({
      ...game,
      platform: game.platform || 'Steam'
    }));
    
    setGamesWithValidation(gamesWithPlatform);
  };

  // Estrai le piattaforme, engine, lingue e generi unici dai games caricati
  const safeGames = ensureArray<Game>(games);
  const platforms = ['All', ...new Set(safeGames.map(game => game.platform))];
  const engines = ['All', ...new Set(safeGames.filter(game => game.engine && game.engine.toLowerCase() !== 'unknown').map(game => game.engine!))];
  const allLanguages = safeGames.flatMap(game => game.supported_languages || []);
  const normalizedLanguages = allLanguages.map(lang => normalizeLanguage(lang));
  const languages = ['All', ...new Set(normalizedLanguages)].sort();
  const allGenres = safeGames.flatMap(game => game.genres || []).filter(genre => typeof genre === 'string');
  const genres = ['All', ...new Set(allGenres)];

  // Filtriamo e ordiniamo i games (multiselezione)
  const filteredGames = safeGames
    .filter((game) => {
      // 🚫 Nascondi games senza nome valido
      const hasValidName = game.title && !game.title.match(/^(Game|Shared Game) \d+$/);
      if (!hasValidName) return false;
      
      const matchesSearch = fuzzyMatch(game.title ?? '', debouncedSearchTerm);
      const matchesPlatform = selectedPlatforms.length === 0 || selectedPlatforms.includes(game.platform);
      const matchesEngine = selectedEngines.length === 0 || selectedEngines.some(eng => 
        (game.engine || 'Unknown').toLowerCase().includes(eng.toLowerCase()) || 
        eng.toLowerCase().includes((game.engine || '').toLowerCase())
      );
      const matchesLanguage = selectedLanguages.length === 0 || (game.supported_languages && game.supported_languages.some(lang => selectedLanguages.includes(normalizeLanguage(lang))));
      const matchesGenre = selectedGenres.length === 0 || (game.genres && game.genres.some(g => selectedGenres.includes(g)));
      
      // Status filter
      const matchesStatus = selectedStatus.length === 0 || 
        (selectedStatus.includes('Installed') && game.is_installed) ||
        (selectedStatus.includes('NotInstalled') && !game.is_installed);
      
      // Tags filter  
      const matchesTags = selectedTags.length === 0 || (
        (selectedTags.includes('VR') ? game.is_vr : true) &&
        (selectedTags.includes('Shared') ? game.isShared === true : true) &&
        (selectedTags.includes('Backlog') ? (!game.last_played || game.last_played === 0) : true)
      );
      
      return matchesSearch && matchesPlatform && matchesEngine && matchesLanguage && matchesGenre && matchesStatus && matchesTags;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recentlyAdded':
          // Sort per data di aggiunta (dal più recente)
          // I games senza added_date vanno in fondo
          const aAdded = a.added_date || 0;
          const bAdded = b.added_date || 0;
          if (aAdded === 0 && bAdded === 0) {
            // Se entrambi non hanno data, ordina alfabeticamente
            return (a.title || '').localeCompare(b.title || '');
          }
          return bAdded - aAdded;
        case 'lastPlayed':
          // Sort per ultimo accesso (se disponibile)
          return (b.last_played || 0) - (a.last_played || 0);
        case 'playtime':
          // Sort per tempo di game (se disponibile)
          return ((b as any).playtime_forever || 0) - ((a as any).playtime_forever || 0);
        default:
          // Sortmento alfabetico
          return (a.title || '').localeCompare(b.title || '');
      }
    });

  const renderContent = () => {
    if (isLoading) {
      // Loader migliorato con progress
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">🎮 Loading Game Library</h3>
            <p className="text-muted-foreground">Connecting to Tauri and retrieving metadata...</p>
            <p className="text-xs text-muted-foreground mt-1">If loading is slow, press F5 to force refresh</p>
          </div>
          
          {/* Scheletro griglia sotto il loader */}
          <div className="w-full mt-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="bg-gray-800/50 rounded-lg aspect-[3/4] animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return <div className="text-red-500 text-center mt-10">Error: {error}</div>;
    }

    if (filteredGames.length === 0) {
      // Messaggio per quando non ci sono results
      return (
        <div className="text-center py-10">
          <p className="text-gray-400 mb-2">
            {searchTerm
              ? `No games found for "${searchTerm}".`
              : "Your library is empty."}
          </p>
          {!searchTerm && (
            <p className="text-sm text-gray-500">
              Use the 'Scan Games' button to add games to your library.
            </p>
          )}
        </div>
      );
    }

    // Vista griglia o lista
    if (viewMode === 'list') {
      return (
        <div className="space-y-1">
          {filteredGames.map((game, index) => (
            <Link key={game.id || `list-game-${index}`} href={getGameDetailUrl(game)}>
              <div className="group flex items-center bg-gray-900/60 hover:bg-gray-800/80 rounded-lg px-3 py-2 border border-gray-800/50 hover:border-purple-500/50 transition-all duration-200 cursor-pointer">
                {/* Thumbnail compatta */}
                <div className="w-16 h-9 flex-shrink-0 rounded overflow-hidden bg-gray-800 mr-3 relative">
                  <GameImageWithFallback game={game} sizes="64px" />
                </div>
                
                {/* Titolo e piattaforma */}
                <div className="flex-grow min-w-0 mr-3">
                  <h3 className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">{game.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-500">{game.platform}</span>
                    {game.engine && game.engine.toLowerCase() !== 'unknown' && (
                      <span className="text-[9px] bg-blue-600/80 text-blue-100 px-1.5 py-0.5 rounded">{game.engine}</span>
                    )}
                  </div>
                </div>
                
                {/* Generi (max 2) */}
                <div className="hidden md:flex items-center gap-1 mr-3">
                  {game.genres && game.genres.filter(g => g && g.toLowerCase() !== 'unknown').slice(0, 2).map((genre, idx) => (
                    <span key={`${game.id}-genre-${idx}`} className="text-[9px] bg-gray-700/80 text-gray-300 px-1.5 py-0.5 rounded">{genre}</span>
                  ))}
                </div>
                
                {/* Badge status */}
                <div className="flex items-center gap-1.5 mr-3">
                  {game.is_installed && (
                    <span className="w-2 h-2 bg-green-500 rounded-full" title="Installato"></span>
                  )}
                  {game.is_vr && (
                    <span className="text-[10px]" title="VR">🥽</span>
                  )}
                  {game.isShared && (
                    <span className="text-[10px]" title="Family Sharing">🔗</span>
                  )}
                </div>
                
                {/* Lingue - mostra solo se ci sono più di 1 lingua */}
                <div className="flex-shrink-0">
                  {game.supported_languages && game.supported_languages.length > 1 && (
                    <LanguageFlags supportedLanguages={game.supported_languages} maxFlags={5} />
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      );
    }

    // Vista griglia (default) - VIRTUALIZZATA per ottimizzazione memoria
    const renderGameCard = (index: number) => {
      const game = filteredGames[index];
      if (!game) return null;
      
      return (
        <Link key={game.id || `game-${index}`} href={getGameDetailUrl(game)}>
          <div className="group overflow-hidden rounded-lg border border-transparent hover:border-purple-500 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-purple-500/20 cursor-pointer bg-gray-900">
            {/* Immagine */}
            <div className="relative aspect-[16/9]">
              <GameImageWithFallback 
                game={game} 
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              />
              
              {/* Badge Engine/VR/Installed */}
              <div className="absolute top-1 left-1 flex flex-wrap gap-0.5">
                {game.is_installed && (
                  <span className="bg-green-600/90 text-white text-[9px] px-1 py-0.5 rounded font-medium">✓</span>
                )}
                {game.engine && game.engine !== 'Unknown' && (
                  <span className="bg-blue-600/90 text-white text-[9px] px-1 py-0.5 rounded font-medium">{game.engine}</span>
                )}
                {game.is_vr && (
                  <span className="bg-purple-600/90 text-white text-[9px] px-1 py-0.5 rounded font-medium">VR</span>
                )}
                {game.isShared && (
                  <span className="bg-orange-600/90 text-white text-[9px] px-1 py-0.5 rounded font-medium">🔗</span>
                )}
              </div>
            </div>
            
            {/* Info sotto l'immagine */}
            <div className="p-1.5">
              <p className="text-xs font-medium truncate text-white" title={game.title ?? 'Unnamed game'}>
                {game.title ?? 'Unnamed game'}
              </p>
              {game.supported_languages && game.supported_languages.length > 0 && (
                <div className="mt-1">
                  <LanguageFlags supportedLanguages={game.supported_languages} maxFlags={12} />
                </div>
              )}
            </div>
          </div>
        </Link>
      );
    };

    // Per pochi games, usa rendering normale
    if (filteredGames.length <= 30) {
      return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-1.5">
          {filteredGames.map((_, index) => renderGameCard(index))}
        </div>
      );
    }

    // Per molti games, usa virtualizzazione
    return (
      <VirtuosoGrid
        style={{ height: 'calc(100vh - 280px)' }}
        totalCount={filteredGames.length}
        overscan={200}
        listClassName="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-1.5"
        itemClassName="min-h-[120px]"
        itemContent={renderGameCard}
      />
    );
  };

  return (
    <div className="w-full px-4 py-4">
      {/* Header minimalista */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/20">
            <Gamepad2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{lib.title}</h1>
            <p className="text-[11px] text-slate-400">
              {games.length > 0 ? `${filteredGames.length} ${lib.gamesOf} ${games.length}` : lib.noGames}
            </p>
          </div>
        </div>
      </div>

      {/* Barra compatta con ricerca e toggle filtri */}
      <div className="flex items-center gap-3 mb-4">
        {/* Ricerca */}
        <input
          type="text"
          placeholder={lib.searchPlaceholder}
          className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        {/* Ordinamento */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-2 text-white text-xs focus:outline-none"
        >
          <option value="alphabetical">{lib.alphabetical}</option>
          <option value="recentlyAdded">🕐 {lib.recent}</option>
          <option value="lastPlayed">🎮 {lib.lastPlayed}</option>
        </select>
        
        {/* Toggle Filtri */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
            showFilters 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🎛️ {lib.filters} {showFilters ? '▲' : '▼'}
        </button>
        
        {/* Vista Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-600">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-2 py-2 text-xs ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            ▦
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2 py-2 text-xs ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Pannello Filtri Compatto - Stile Raipal con Multiselezione */}
      {showFilters && (
        <div className="mb-4 p-3 bg-gray-900/50 border border-gray-700 rounded-lg animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap gap-6">
            
            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase">Status</span>
              {[{id: 'Installed', label: '✓ Installed'}, {id: 'NotInstalled', label: '✗ Not inst.'}].map(s => (
                <label key={s.id} className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[11px] transition-all ${selectedStatus.includes(s.id) ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' : 'bg-gray-800/50 text-gray-400 border border-transparent hover:bg-gray-700/50'}`}>
                  <input type="checkbox" checked={selectedStatus.includes(s.id)} onChange={() => toggleFilter(selectedStatus, setSelectedStatus, s.id)} className="hidden" />
                  {selectedStatus.includes(s.id) && <span className="text-purple-400">✓</span>}
                  {s.label}
                </label>
              ))}
              {selectedStatus.length > 0 && <button onClick={() => setSelectedStatus([])} className="text-[9px] text-gray-500 hover:text-gray-300">↺</button>}
            </div>
            
            {/* Engine */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase">Engine</span>
              {['Unity', 'Unreal', 'Godot', 'RPG Maker', 'Unknown'].map(eng => (
                <label key={eng} className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[11px] transition-all ${selectedEngines.includes(eng) ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' : 'bg-gray-800/50 text-gray-400 border border-transparent hover:bg-gray-700/50'}`}>
                  <input type="checkbox" checked={selectedEngines.includes(eng)} onChange={() => toggleFilter(selectedEngines, setSelectedEngines, eng)} className="hidden" />
                  {selectedEngines.includes(eng) && <span className="text-purple-400">✓</span>}
                  {eng}
                </label>
              ))}
              {selectedEngines.length > 0 && <button onClick={() => setSelectedEngines([])} className="text-[9px] text-gray-500 hover:text-gray-300">↺</button>}
            </div>
            
            {/* Tags */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase">Tag</span>
              {[{id: 'VR', label: '🥽 VR'}, {id: 'Shared', label: '🔗 Shared'}, {id: 'Backlog', label: '📦 Backlog'}].map(t => (
                <label key={t.id} className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[11px] transition-all ${selectedTags.includes(t.id) ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' : 'bg-gray-800/50 text-gray-400 border border-transparent hover:bg-gray-700/50'}`}>
                  <input type="checkbox" checked={selectedTags.includes(t.id)} onChange={() => toggleFilter(selectedTags, setSelectedTags, t.id)} className="hidden" />
                  {selectedTags.includes(t.id) && <span className="text-purple-400">✓</span>}
                  {t.label}
                </label>
              ))}
              {selectedTags.length > 0 && <button onClick={() => setSelectedTags([])} className="text-[9px] text-gray-500 hover:text-gray-300">↺</button>}
            </div>
            
            {/* Provider */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase">Provider</span>
              {platforms.filter(p => p !== 'All').map(plat => (
                <label key={plat} className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[11px] transition-all ${selectedPlatforms.includes(plat) ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' : 'bg-gray-800/50 text-gray-400 border border-transparent hover:bg-gray-700/50'}`}>
                  <input type="checkbox" checked={selectedPlatforms.includes(plat)} onChange={() => toggleFilter(selectedPlatforms, setSelectedPlatforms, plat)} className="hidden" />
                  {selectedPlatforms.includes(plat) && <span className="text-purple-400">✓</span>}
                  {plat}
                </label>
              ))}
              {selectedPlatforms.length > 0 && <button onClick={() => setSelectedPlatforms([])} className="text-[9px] text-gray-500 hover:text-gray-300">↺</button>}
            </div>
          </div>
        </div>
      )}

      {/* Pulsante Force Refresh compatto */}
      <div className="flex items-center justify-between bg-gray-800/30 border border-gray-700 rounded-lg px-3 py-1.5 mb-4">
        <span className="text-[10px] text-gray-500">🎯 Game not visible?</span>
        <div className="flex gap-1.5">
          <ForceRefreshButton onRefreshComplete={handleForceRefresh} />
          <button 
            onClick={testFamilySharing} 
            className="text-[10px] px-2 py-1 bg-gray-700/50 text-gray-400 hover:bg-gray-600 rounded transition-colors"
          >
            🔗 Shared
          </button>
          <button 
            onClick={async () => {
              toast.info('Downloading names from Steam API...');
              try {
                const result = await invoke('update_remote_game_database');
                const games = Object.values(result as any) as Game[];
                setGames(games);
                toast.success(`✅ Database updated! ${games.length} games`);
              } catch (e) {
                toast.error('Update error: ' + e);
              }
            }} 
            className="text-[10px] px-2 py-1 bg-blue-700/50 text-blue-300 hover:bg-blue-600 rounded transition-colors"
          >
            ⬇️ Update DB
          </button>
        </div>
      </div>


      {/* Contenuto principale (griglia, Loading...rrori) */}
      {renderContent()}
    </div>
  );
}



