'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Gamepad2, ImageIcon, Search, LayoutGrid, List, SlidersHorizontal, ArrowUpDown, ChevronDown, ChevronUp, RefreshCw, Download } from 'lucide-react';
import { useTranslation, translations } from '@/lib/i18n';
import { CoverPicker } from '@/components/cover-picker';

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

// Module-level dedup per evitare doppi fetch SteamGridDB (sopravvive a StrictMode remount)
const _fetchedCovers = new Set<string>();
const _pendingCoverSaves: Record<string, string> = {};
let _coverSaveTimer: ReturnType<typeof setTimeout> | null = null;

const flushCoverSaves = async () => {
  const toSave = { ..._pendingCoverSaves };
  // Svuota il buffer
  for (const key of Object.keys(_pendingCoverSaves)) delete _pendingCoverSaves[key];
  if (Object.keys(toSave).length === 0) return;
  try {
    await invoke('save_batch_cover_cache', { covers: toSave });
    console.log(`[Library] 💾 Batch cover cache salvata: ${Object.keys(toSave).length} cover`);
  } catch (e) {
    console.warn('[Library] Batch cover save failed:', e);
    // Fallback: riprova singolarmente
    for (const [gameId, imageUrl] of Object.entries(toSave)) {
      try { await invoke('save_cover_cache', { gameId, imageUrl }); } catch {}
    }
  }
};

const queueCoverSave = (gameId: string, imageUrl: string) => {
  _pendingCoverSaves[gameId] = imageUrl;
  if (_coverSaveTimer) clearTimeout(_coverSaveTimer);
  _coverSaveTimer = setTimeout(flushCoverSaves, 2000);
};

// Componente per immagine game con fallback e cache SteamGridDB
const GameImageWithFallback = ({ game, sizes, coverCache }: { game: Game; sizes: string; coverCache?: Record<string, string> }) => {
  const [hasError, setHasError] = React.useState(false);
  const [steamGridDbImage, setSteamGridDbImage] = React.useState<string | null>(null);
  const [triedSteamGridDb, setTriedSteamGridDb] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Reset stato quando cambia il gioco
  React.useEffect(() => {
    setHasError(false);
    setSteamGridDbImage(null);
    setTriedSteamGridDb(false);
    setIsLoading(false);
  }, [game.id, game.app_id]);
  
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

  // Cerca immagine in cache SteamGridDB (memoizzato per reagire ai cambiamenti)
  const cachedImage = React.useMemo(() => {
    if (!coverCache) return null;
    // Prova con app_id, poi con id, poi con titolo
    return coverCache[game.app_id] || coverCache[game.id] || coverCache[game.title] || null;
  }, [coverCache, game.app_id, game.id, game.title]);

  // Cerca su SteamGridDB quando non c'è immagine
  const fetchSteamGridDbImage = React.useCallback(async () => {
    if (triedSteamGridDb || !game.app_id || !game.title) return;
    // Dedup globale: se già fetchato in questa sessione, skip
    const dedupKey = game.app_id || game.id;
    if (_fetchedCovers.has(dedupKey)) return;
    _fetchedCovers.add(dedupKey);
    setTriedSteamGridDb(true);
    setIsLoading(true);
    
    console.log(`[Library] 🔍 Fetching SteamGridDB for: ${game.title} (id: ${game.id}, app_id: ${game.app_id})`);
    
    try {
      // Cerca API key in gamestringer_utility_prefs (dove viene salvata dalla pagina stores)
      let apiKey = null;
      const utilityPrefs = localStorage.getItem('gamestringer_utility_prefs');
      if (utilityPrefs) {
        try {
          const prefs = JSON.parse(utilityPrefs);
          apiKey = prefs?.steamgriddb?.apiKey || null;
        } catch (e) {}
      }
      
      const appIdNum = parseInt(game.app_id.replace('steam_', '').replace('epic_', '').replace('rockstar_', '')) || 0;
      const result = await invoke<string | null>('fetch_steamgriddb_image', {
        appId: appIdNum,
        gameName: game.title,
        apiKey: apiKey
      });
      
      if (result) {
        setSteamGridDbImage(result);
        queueCoverSave(game.app_id, result);
        console.log(`[Library] ✅ SteamGridDB cover found for ${game.title}`);
      } else {
        // Fallback 1: usa Steam API appdetails per ottenere header_image
        let found = false;
        try {
          const steamAppId = parseInt(game.app_id.replace('steam_', '')) || 0;
          if (steamAppId > 0) {
            const details = await invoke<any>('fetch_steam_game_details', { appId: steamAppId });
            if (details?.header_image) {
              setSteamGridDbImage(details.header_image);
              queueCoverSave(game.app_id, details.header_image);
              console.log(`[Library] ✅ Steam API header fallback for ${game.title}: ${details.header_image}`);
              found = true;
            }
          }
        } catch (e2) {
          console.warn(`[Library] Steam API fallback failed for ${game.title}:`, e2);
        }
        // Fallback 2: scraping pagina Steam Store per og:image
        if (!found) {
          try {
            const steamAppId = parseInt(game.app_id.replace('steam_', '')) || 0;
            if (steamAppId > 0) {
              const storeImage = await invoke<string | null>('fetch_steam_store_image', { appId: steamAppId });
              if (storeImage) {
                setSteamGridDbImage(storeImage);
                queueCoverSave(game.app_id, storeImage);
                console.log(`[Library] ✅ Steam Store scraping fallback for ${game.title}: ${storeImage}`);
                found = true;
              }
            }
          } catch (e3) {
            console.warn(`[Library] Steam Store scraping failed for ${game.title}:`, e3);
          }
        }
        // Fallback 3: GOG API per giochi GOG
        if (!found && (game.platform === 'GOG' || game.id?.startsWith('gog_'))) {
          try {
            const gogId = game.app_id?.replace('gog_', '') || game.id?.replace('gog_', '') || '';
            if (gogId) {
              const gogCover = await invoke<string | null>('get_gog_game_cover', { gameId: gogId });
              if (gogCover) {
                setSteamGridDbImage(gogCover);
                queueCoverSave(game.app_id, gogCover);
                console.log(`[Library] ✅ GOG API cover for ${game.title}: ${gogCover}`);
                found = true;
              }
            }
          } catch (e4) {
            console.warn(`[Library] GOG API cover failed for ${game.title}:`, e4);
          }
        }
      }
    } catch (e) {
      console.warn(`[Library] SteamGridDB failed for ${game.title}:`, e);
    } finally {
      setIsLoading(false);
    }
  }, [game.app_id, game.title, triedSteamGridDb]);

  // La cache ha priorità perché contiene la cover scelta dall'utente
  const imageUrl = cachedImage || steamGridDbImage || game.header_image;

  // Auto-fetch da SteamGridDB se non c'è immagine
  React.useEffect(() => {
    if (!imageUrl && !triedSteamGridDb && game.app_id && game.title) {
      fetchSteamGridDbImage();
    }
  }, [imageUrl, triedSteamGridDb, game.app_id, game.title, fetchSteamGridDbImage]);

  // Loading spinner mentre cerca su SteamGridDB
  if (isLoading) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getGradient(game.title)}`}>
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (hasError || !imageUrl || game.title.startsWith('Game ')) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getGradient(game.title)}`}>
        <span className="text-4xl font-bold text-white/60">
          {game.title ? game.title.replace('Game ', '').charAt(0).toUpperCase() : '?'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt=""
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
      onError={() => {
        // Se l'immagine fallisce, prova SteamGridDB
        if (!triedSteamGridDb) {
          fetchSteamGridDbImage();
        } else {
          setHasError(true);
        }
      }}
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
  const [coverCache, setCoverCache] = useState<Record<string, string>>({});
  const libraryLoadedRef = React.useRef(false);
  
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
  const [coverPickerGame, setCoverPickerGame] = useState<Game | null>(null);
  
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

  // 📷 Carica cache cover SteamGridDB all'avvio
  const [addedDatesCache, setAddedDatesCache] = useState<Record<string, number>>({});
  const [languagesCache, setLanguagesCache] = useState<Record<string, string[]>>({});
  const cachesLoadedRef = React.useRef(false);
  
  useEffect(() => {
    if (cachesLoadedRef.current) return;
    cachesLoadedRef.current = true;
    const loadCaches = async () => {
      try {
        // Cover cache
        const coverCacheData = await invoke<Record<string, string>>('get_all_cover_cache');
        if (coverCacheData && Object.keys(coverCacheData).length > 0) {
          setCoverCache(coverCacheData);
          console.log('[Library] 📷 Cover cache caricata:', Object.keys(coverCacheData).length, 'immagini');
        }
        
        // Added dates cache
        const addedDates = await invoke<Record<string, number>>('get_all_added_dates');
        if (addedDates && Object.keys(addedDates).length > 0) {
          setAddedDatesCache(addedDates);
          console.log('[Library] 📅 Date aggiunta caricate:', Object.keys(addedDates).length, 'giochi');
        }
        
        // Languages cache
        const langCache = await invoke<Record<string, string[]>>('get_languages_cache');
        if (langCache && Object.keys(langCache).length > 0) {
          setLanguagesCache(langCache);
          console.log('[Library] 🌍 Cache lingue caricata:', Object.keys(langCache).length, 'giochi');
        }
      } catch (e) {
        console.warn('[Library] Cache non disponibile');
      }
    };
    loadCaches();
  }, []);

  // 🚀 SCAN COMPLETO - Combina API Steam + File Locali
  const testFamilySharing = async () => {
    console.log('[LIBRARY DEBUG] 🚀 SCAN COMPLETO Steam...');
    setIsLoading(true);
    
    try {
      // 1️⃣ Prima ottieni i games dall'API (hanno i nomi corretti)
      const credentials = await invoke('load_steam_credentials') as { steam_id: string; api_key_encrypted: string } | null;
      const apiGames: Map<string, Game> = new Map();
      
      if (!credentials) {
        console.warn('[LIBRARY] ⚠️ Credenziali Steam non configurate - mostro solo giochi installati');
        toast.warning('Credenziali Steam non configurate', {
          description: 'Vai in Impostazioni → Stores per vedere tutti i tuoi giochi',
          duration: 8000,
        });
      }
      
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
      
      // 3️⃣ Aggiungi anche i giochi dall'API che NON sono installati localmente
      // (giochi posseduti ma non scaricati)
      for (const [appId, apiGame] of apiGames.entries()) {
        if (!seenIds.has(appId)) {
          seenIds.add(appId);
          finalGames.push({
            ...apiGame,
            is_installed: false,
            isShared: false,
          });
        }
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
    if (libraryLoadedRef.current) return;
    libraryLoadedRef.current = true;
    const fetchGames = async () => {
      try {
        setIsLoading(true);
        console.log('🚀 FULL LIBRARY LOADING (Owned + Family Sharing)...');

        // 1️⃣ SCAN LOCALE - Trova games INSTALLATI e SHARED (per arricchire dati API)
        const localScanData: Map<string, { is_installed: boolean; is_shared: boolean; title: string; engine?: string | null; last_played?: number | null; added_date?: number | null }> = new Map();
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
              last_played: (g as any).last_played || null,
              added_date: (g as any).added_date || null,
            });
          }
        } catch (scanError) {
          console.warn('⚠️ Local scan failed:', scanError);
        }
        
        // Mappa finale dei games
        const finalGamesMap: Map<string, Game> = new Map();

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
        console.log('🔍 DEBUG creds object:', JSON.stringify(creds, null, 2));
        console.log('🔍 api_key_encrypted:', creds?.api_key_encrypted ? `${creds.api_key_encrypted.length} chars` : 'VUOTO');
        console.log('🔍 steam_id:', creds?.steam_id || 'VUOTO');
        
        if (!creds || !creds.api_key_encrypted || !creds.steam_id) {
          console.warn('⚠️ Credenziali Steam non configurate - mostro solo giochi installati');
        }
        if (creds && creds.api_key_encrypted && creds.steam_id) {
          try {
            console.log('🔑 Calling Steam API with credentials...');
            console.log('🔑 Steam ID:', creds.steam_id);
            console.log('🔑 API Key length:', creds.api_key_encrypted?.length || 0);
            
            // Passa le Credentials loaded dal profilo
            const apiResult = await invoke('get_steam_games', {
              apiKey: creds.api_key_encrypted,  // API key dal profilo
              steamId: creds.steam_id,          // Steam ID dal profilo
              forceRefresh: true
            }) as any[];
            
            console.log(`📊 Steam API: ${apiResult.length} owned games`);
            console.log('📊 First 5 games:', apiResult.slice(0, 5).map((g: any) => g.name));
            console.log('📊 Sample game with last_played:', apiResult.find((g: any) => g.last_played > 0));
            
            // Blacklist software Steam (non sono giochi)
            const steamSoftwareBlacklist = [
              'twinmotion', 'steamvr', 'unreal editor', 'unity',
              'blender', 'godot', 'sdk', 'dedicated server', 'tool'
            ];
            
            // Aggiungi tutti i games dall'API (questi sono i games OWNED confermati)
            for (const g of apiResult) {
              const appId = String(g.appid);
              const localData = localScanData.get(appId);
              
              // Salta software/tool
              const nameLower = (g.name || '').toLowerCase();
              if (steamSoftwareBlacklist.some(sw => nameLower.includes(sw))) continue;
              
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
                last_played: g.rtime_last_played || g.last_played || localData?.last_played || undefined,
                added_date: localData?.added_date || undefined,
              });
            }
          } catch (apiError) {
            console.warn('⚠️ Steam API failed, using local data only:', apiError);
          }
        }
        
        // 3️⃣ Aggiungi games SHARED dallo scan locale (non presenti nell'API owned)
        // Un game è SHARED se: (a) marcato is_shared, oppure (b) installato ma non nell'API owned
        const sharedSoftwareBlacklist = [
          'twinmotion', 'steamvr', 'unreal editor', 'unity',
          'blender', 'godot', 'sdk', 'dedicated server', 'tool'
        ];
        
        for (const [appId, localData] of localScanData) {
          if (!finalGamesMap.has(appId)) {
            // Salta software/tool
            const titleLower = (localData.title || '').toLowerCase();
            if (sharedSoftwareBlacklist.some(sw => titleLower.includes(sw))) continue;
            
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
          
          // Blacklist software/launcher (non sono giochi)
          const softwareBlacklist = [
            'ea desktop', 'ea app', 'origin', 'launcher', 'social club',
            'rockstar games launcher', 'ubisoft connect', 'uplay',
            'epic games launcher', 'gog galaxy', 'battle.net',
            'steam', 'steamvr', 'twinmotion', 'unreal editor',
            'unity hub', 'unity editor', 'blender', 'godot'
          ];
          
          // Filtra solo games NON-Steam e NON-software
          const nonSteamGames = otherStoreGames.filter(g => {
            if (g.platform === 'Steam' || g.id.startsWith('steam_')) return false;
            const titleLower = (g.title || '').toLowerCase();
            return !softwareBlacklist.some(sw => titleLower.includes(sw));
          });
          
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
        
        // 📅 Salva date di aggiunta per i nuovi giochi
        try {
          const gameIds = finalGames.map(g => g.app_id || g.id);
          const updatedDates = await invoke<Record<string, number>>('save_batch_added_dates', { gameIds });
          if (updatedDates) {
            setAddedDatesCache(updatedDates);
            console.log('[Library] 📅 Date aggiunta aggiornate:', Object.keys(updatedDates).length, 'giochi');
          }
        } catch (e) {
          console.warn('[Library] Errore salvataggio date aggiunta:', e);
        }
        
        await activityHistory.trackSteamSync(finalGames.length);
        setGamesWithValidation(finalGames);
        
        // 🌍 Carica lingue in background per i giochi Steam senza lingue in cache
        const loadLanguagesInBackground = async () => {
          try {
            const existingCache = await invoke<Record<string, string[]>>('get_languages_cache');
            const steamGames = finalGames.filter(g => g.platform === 'Steam' && g.app_id);
            const gamesToFetch = steamGames.filter(g => !existingCache[g.app_id!]);
            
            if (gamesToFetch.length === 0) {
              console.log('[Library] 🌍 Tutte le lingue già in cache');
              return;
            }
            
            console.log(`[Library] 🌍 Caricamento lingue per ${gamesToFetch.length} giochi in background...`);
            const newCache = { ...existingCache };
            let fetched = 0;
            
            // Fetch con delay lungo per evitare rate limiting Steam
            let consecutiveErrors = 0;
            for (let i = 0; i < Math.min(gamesToFetch.length, 30); i++) {
              const game = gamesToFetch[i];
              try {
                const languages = await invoke<string[]>('fetch_game_languages', { appId: game.app_id });
                if (languages && languages.length > 0) {
                  newCache[game.app_id!] = languages;
                  fetched++;
                  consecutiveErrors = 0;
                }
                // Delay 800ms tra richieste per evitare 429
                await new Promise(r => setTimeout(r, 800));
              } catch (e: any) {
                consecutiveErrors++;
                // Se errore 429/403, pausa lunga o ferma
                const isRateLimit = e?.message?.includes('429') || e?.message?.includes('403');
                if (isRateLimit || consecutiveErrors >= 3) {
                  if (consecutiveErrors >= 3) break; // Steam sta bloccando, ferma silenziosamente
                  await new Promise(r => setTimeout(r, 3000));
                }
              }
            }
            
            if (fetched > 0) {
              await invoke('save_languages_cache', { languages: newCache });
              setLanguagesCache(newCache);
              console.log(`[Library] 🌍 Salvate ${fetched} nuove lingue in cache`);
            }
          } catch (e) {
            console.warn('[Library] Errore caricamento lingue:', e);
          }
        };
        
        // Avvia in background senza bloccare
        loadLanguagesInBackground();
        
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
    
    // Debug: conta giochi con nomi validi vs invalidi
    const validNames = gamesWithPlatform.filter(g => g.title && !g.title.match(/^(Game|Shared Game) \d+$/));
    const invalidNames = gamesWithPlatform.filter(g => !g.title || g.title.match(/^(Game|Shared Game) \d+$/));
    console.log(`📊 Giochi con nome valido: ${validNames.length}, senza nome: ${invalidNames.length}`);
    
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
          // Sort per data di aggiunta alla libreria (dal più recente)
          // Usa la cache delle date di aggiunta tracciata da GameStringer
          const aKey = a.app_id || a.id;
          const bKey = b.app_id || b.id;
          const aAdded = addedDatesCache[aKey] || a.added_date || 0;
          const bAdded = addedDatesCache[bKey] || b.added_date || 0;
          if (aAdded !== bAdded) {
            return bAdded - aAdded;
          }
          // Se uguali, ordina alfabeticamente
          return (a.title || '').localeCompare(b.title || '');
        case 'lastPlayed':
          // Sort per ultimo accesso (se disponibile)
          const aPlayed = a.last_played || 0;
          const bPlayed = b.last_played || 0;
          if (aPlayed !== bPlayed) {
            return bPlayed - aPlayed;
          }
          return (a.title || '').localeCompare(b.title || '');
        case 'playtime':
          // Sort per tempo di gioco (se disponibile)
          const aTime = (a as any).playtime_forever || 0;
          const bTime = (b as any).playtime_forever || 0;
          if (aTime !== bTime) {
            return bTime - aTime;
          }
          return (a.title || '').localeCompare(b.title || '');
        default:
          // Ordinamento alfabetico
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
            <h3 className="text-lg font-semibold mb-2">{lib.loadingTitle}</h3>
            <p className="text-muted-foreground">{lib.loadingSubtitle}</p>
            <p className="text-xs text-muted-foreground mt-1">{lib.loadingSlow}</p>
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
      const hasActiveFilters = selectedPlatforms.length > 0 || selectedEngines.length > 0 || 
        selectedLanguages.length > 0 || selectedGenres.length > 0 || 
        selectedStatus.length > 0 || selectedTags.length > 0;
      
      return (
        <div className="text-center py-10">
          <p className="text-gray-400 mb-2">
            {searchTerm
              ? `Nessun gioco trovato per "${searchTerm}".`
              : "La tua libreria è vuota."}
          </p>
          {searchTerm && hasActiveFilters && (
            <p className="text-sm text-yellow-500 mb-2">
              ⚠️ Hai filtri attivi che potrebbero nascondere alcuni giochi.
            </p>
          )}
          {searchTerm && safeGames.length > 0 && (
            <p className="text-sm text-gray-500">
              {safeGames.length} giochi in libreria. Prova a rimuovere i filtri o verificare la ricerca.
            </p>
          )}
          {!searchTerm && (
            <p className="text-sm text-gray-500">
              Usa il pulsante 'Refresh' per aggiungere giochi alla libreria.
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
                  <GameImageWithFallback key={`img-${game.id}-${game.app_id}`} game={game} sizes="64px" coverCache={coverCache} />
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
                  {(() => {
                    const gameKey = game.app_id || game.id;
                    const cachedLangs = languagesCache[gameKey];
                    const languages = cachedLangs && cachedLangs.length > 0 ? cachedLangs : game.supported_languages;
                    return languages && languages.length > 1 ? (
                      <LanguageFlags supportedLanguages={languages} maxFlags={5} />
                    ) : null;
                  })()}
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
                key={`img-${game.id}-${game.app_id}`}
                game={game} 
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                coverCache={coverCache}
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
              {/* Bottone Cambia Cover */}
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCoverPickerGame(game); }}
                className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/70 hover:bg-blue-600 px-1.5 py-0.5 rounded text-[9px] font-medium text-white/80 hover:text-white transition-all z-10 opacity-0 group-hover:opacity-100"
                title="Cambia cover"
              >
                <ImageIcon className="h-3 w-3" />
              </button>
            </div>
            
            {/* Info sotto l'immagine */}
            <div className="p-1.5">
              <p className="text-xs font-medium truncate text-white" title={game.title ?? 'Unnamed game'}>
                {game.title ?? 'Unnamed game'}
              </p>
              {(() => {
                // Usa lingue dalla cache se disponibili, altrimenti fallback ai dati del gioco
                const gameKey = game.app_id || game.id;
                const cachedLangs = languagesCache[gameKey];
                const languages = cachedLangs && cachedLangs.length > 0 ? cachedLangs : game.supported_languages;
                return languages && languages.length > 1 ? (
                  <div className="mt-1">
                    <LanguageFlags supportedLanguages={languages} maxFlags={12} />
                  </div>
                ) : null;
              })()}
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
    // Key basata sui filtri + coverCache per forzare re-render quando cambiano
    const coverCacheKey = Object.keys(coverCache).length;
    const gridKey = `${sortBy}-${selectedPlatforms.join(',')}-${selectedEngines.join(',')}-${selectedStatus.join(',')}-${selectedTags.join(',')}-${debouncedSearchTerm}-covers${coverCacheKey}`;
    
    return (
      <VirtuosoGrid
        key={gridKey}
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
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 shadow-lg shadow-purple-600/25">
            <Gamepad2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white">{lib.title}</h1>
              {games.length > 0 && (
                <span className="text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                  {filteredGames.length}/{games.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {games.length > 0 
                ? `${filteredGames.length} ${lib.gamesOf} ${games.length}`
                : lib.noGames}
            </p>
          </div>
        </div>
        {/* Azioni rapide header */}
        <div className="flex items-center gap-1.5">
          <ForceRefreshButton onRefreshComplete={handleForceRefresh} />
          <button 
            onClick={testFamilySharing} 
            className="text-[10px] px-2.5 py-1.5 bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200 rounded-lg transition-all border border-gray-700/50"
            title="Scan Family Sharing"
          >
            <RefreshCw className="h-3 w-3 inline mr-1" />
            {lib.shared}
          </button>
          <button 
            onClick={async () => {
              toast.info(lib.downloadingNames);
              try {
                const result = await invoke('update_remote_game_database');
                const games = Object.values(result as any) as Game[];
                setGames(games);
                toast.success(`${lib.databaseUpdated} ${games.length} ${lib.games}`);
              } catch (e) {
                toast.error(lib.updateError + ': ' + e);
              }
            }} 
            className="text-[10px] px-2.5 py-1.5 bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200 rounded-lg transition-all border border-gray-700/50"
            title="Aggiorna DB nomi"
          >
            <Download className="h-3 w-3 inline mr-1" />
            {lib.updateDb}
          </button>
        </div>
      </div>

      {/* Barra ricerca + controlli */}
      <div className="flex items-center gap-2 mb-3">
        {/* Ricerca con icona */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <input
            type="text"
            placeholder={lib.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 bg-gray-800/60 border border-gray-700/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs">
              ✕
            </button>
          )}
        </div>
        
        {/* Ordinamento */}
        <div className="relative">
          <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="appearance-none bg-gray-800/60 border border-gray-700/60 rounded-xl pl-7 pr-7 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
          >
            <option value="alphabetical">{lib.alphabetical}</option>
            <option value="recentlyAdded">{lib.recent}</option>
            <option value="lastPlayed">{lib.lastPlayed}</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
        </div>
        
        {/* Toggle Filtri con badge contatore */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-all border ${
            showFilters 
              ? 'bg-purple-600/90 text-white border-purple-500 shadow-lg shadow-purple-600/20' 
              : 'bg-gray-800/60 text-gray-300 border-gray-700/60 hover:bg-gray-700/80 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {lib.filters}
          {(() => {
            const activeCount = selectedStatus.length + selectedEngines.length + selectedTags.length + selectedPlatforms.length;
            return activeCount > 0 ? (
              <span className="ml-0.5 bg-purple-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeCount}
              </span>
            ) : (
              showFilters ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />
            );
          })()}
        </button>
        
        {/* Vista Toggle */}
        <div className="flex rounded-xl overflow-hidden border border-gray-700/60">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 transition-all ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'}`}
            title="Vista griglia"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-all ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'}`}
            title="Vista lista"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Pannello Filtri */}
      {showFilters && (
        <div className="mb-3 p-3 bg-gray-900/60 border border-gray-700/50 rounded-xl backdrop-blur-sm animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap gap-x-8 gap-y-2.5">
            
            {/* Status */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mr-1">{lib.status}</span>
              {[{id: 'Installed', label: `✓ ${lib.installed}`}, {id: 'NotInstalled', label: `✗ ${lib.notInstalled}`}].map(s => (
                <button key={s.id} onClick={() => toggleFilter(selectedStatus, setSelectedStatus, s.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${selectedStatus.includes(s.id) ? 'bg-purple-500/25 text-purple-300 ring-1 ring-purple-500/40' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300'}`}>
                  {s.label}
                </button>
              ))}
            </div>
            
            {/* Engine */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mr-1">{lib.engine}</span>
              {['Unity', 'Unreal', 'Godot', 'RPG Maker', 'Unknown'].map(eng => (
                <button key={eng} onClick={() => toggleFilter(selectedEngines, setSelectedEngines, eng)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${selectedEngines.includes(eng) ? 'bg-purple-500/25 text-purple-300 ring-1 ring-purple-500/40' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300'}`}>
                  {eng}
                </button>
              ))}
            </div>
            
            {/* Tags */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mr-1">{lib.tag}</span>
              {[{id: 'VR', label: `🥽 ${lib.vr}`}, {id: 'Shared', label: `🔗 ${lib.shared}`}, {id: 'Backlog', label: `📦 ${lib.backlog}`}].map(t => (
                <button key={t.id} onClick={() => toggleFilter(selectedTags, setSelectedTags, t.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${selectedTags.includes(t.id) ? 'bg-purple-500/25 text-purple-300 ring-1 ring-purple-500/40' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            
            {/* Provider */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mr-1">{lib.provider}</span>
              {platforms.filter(p => p !== 'All').map(plat => (
                <button key={plat} onClick={() => toggleFilter(selectedPlatforms, setSelectedPlatforms, plat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${selectedPlatforms.includes(plat) ? 'bg-purple-500/25 text-purple-300 ring-1 ring-purple-500/40' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300'}`}>
                  {plat}
                </button>
              ))}
            </div>
          </div>
          
          {/* Clear all filters */}
          {(selectedStatus.length + selectedEngines.length + selectedTags.length + selectedPlatforms.length) > 0 && (
            <div className="mt-2.5 pt-2 border-t border-gray-700/40">
              <button 
                onClick={() => { setSelectedStatus([]); setSelectedEngines([]); setSelectedTags([]); setSelectedPlatforms([]); }}
                className="text-[10px] text-gray-500 hover:text-purple-300 transition-colors"
              >
                ✕ Rimuovi tutti i filtri
              </button>
            </div>
          )}
        </div>
      )}


      {/* Contenuto principale (griglia, Loading...rrori) */}
      {renderContent()}

      {/* Cover Picker Modal */}
      {coverPickerGame && (
        <CoverPicker
          isOpen={!!coverPickerGame}
          onClose={() => setCoverPickerGame(null)}
          appId={parseInt(coverPickerGame.app_id?.replace('steam_', '').replace('epic_', '') || '0')}
          gameName={coverPickerGame.title || ''}
          onCoverSelected={(url) => {
            // Aggiorna cover cache locale
            setCoverCache(prev => ({
              ...prev,
              [coverPickerGame.app_id]: url,
              [coverPickerGame.id]: url
            }));
            // Aggiorna anche il gioco nella lista
            setGames(prev => prev.map(g => 
              g.id === coverPickerGame.id ? { ...g, header_image: url } : g
            ));
          }}
        />
      )}
    </div>
  );
}



