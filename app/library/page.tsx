'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const GameDetailClient = dynamic(() => import('@/components/game-detail-client'), { ssr: false });
import { invoke } from '@/lib/tauri-api';
import { get, set } from 'idb-keyval';
import { activityHistory } from '@/lib/activity-history';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LanguageFlags, languageToCountryCode, getFlagEmoji, getCountryCode } from '@/components/ui/language-flags';
import { ForceRefreshButton } from '@/components/ui/force-refresh-button';
import { ensureArray, validateArray } from '@/lib/array-utils';
import { toast } from 'sonner';
import * as CountryFlags from 'country-flag-icons/react/3x2';
import { VirtuosoGrid, Virtuoso } from 'react-virtuoso';
import { loadLibraryFilters, saveLibraryFilters, fuzzyMatch, useDebouncedValue } from '@/lib/library-filters';
import { enrichGameTitle } from '@/lib/game-names-db';
import { Gamepad2, ImageIcon, Search, LayoutGrid, List, SlidersHorizontal, ArrowUpDown, ChevronDown, ChevronUp, RefreshCw, Download, Languages, Sparkles, FolderOpen, Monitor, Wrench, Brain } from 'lucide-react';
import { useTranslation, translations } from '@/lib/i18n';
import { CoverPicker } from '@/components/cover-picker';

// Guard globale: sopravvive a HMR/Fast Refresh e doppio mount React 18
const _g = globalThis as any;
if (!_g.__gsLibCache) {
  _g.__gsLibCache = {
    fetchStarted: false,
    cachesLoadStarted: false,
    cover: { loaded: false, data: {} as Record<string, string> },
    dates: { loaded: false, data: {} as Record<string, number> },
    lang: { loaded: false, data: {} as Record<string, string[]> },
    games: { loaded: false, data: [] as any[] },
  };
}
const _libCache = _g.__gsLibCache;
// Assicura campi aggiunti in HMR successivi
if (_libCache.cachesLoadStarted === undefined) _libCache.cachesLoadStarted = false;
if (!_libCache.games) _libCache.games = { loaded: false, data: [] };

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
// Uses /library/?id=XXX query param format for Tauri static export compatibility
const getGameDetailUrl = (game: Game): string => {
  const params = new URLSearchParams();
  params.set('id', game.id || game.app_id || '');
  params.set('name', game.title || '');
  if (game.install_dir) params.set('installDir', game.install_dir);
  params.set('installed', String(game.is_installed || false));
  params.set('platform', game.platform || 'Steam');
  if (game.header_image) params.set('headerImage', game.header_image);
  // Passa sempre l'appId numerico se disponibile
  const numericAppId = game.app_id || (game.id?.match(/\d+/)?.[0]);
  if (numericAppId) params.set('appId', String(numericAppId));
  
  return `/library/?${params.toString()}`;
}

// Dedup globale per fetch SteamGridDB (globalThis sopravvive a HMR)
if (!_g.__gsFetchedCovers) _g.__gsFetchedCovers = new Set<string>();
if (!_g.__gsPendingCoverSaves) _g.__gsPendingCoverSaves = {} as Record<string, string>;
const _fetchedCovers: Set<string> = _g.__gsFetchedCovers;
const _pendingCoverSaves: Record<string, string> = _g.__gsPendingCoverSaves;
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
      'from-violet-900/80 to-indigo-900/80',
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
    // Dedup globale: se già fetchato in questa sessione, skip (per app_id E titolo)
    const dedupKey = game.app_id || game.id;
    const titleKey = `title:${game.title.toLowerCase()}`;
    if (_fetchedCovers.has(dedupKey) || _fetchedCovers.has(titleKey)) return;
    _fetchedCovers.add(dedupKey);
    _fetchedCovers.add(titleKey);
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
        } catch (e) {
          console.warn('[Library] Cache localStorage corrotta, ripulizia:', e);
          localStorage.removeItem('gamestringer_utility_prefs');
        }
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
              const gogCover = await invoke<string | null>('get_gog_game_cover', { gameId: gogId, gameName: game.title || null });
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

function LibraryPageInner() {
  const searchParams = useSearchParams();
  const detailId = searchParams.get('id');

  // Se c'è un ?id=XXX, mostra il dettaglio gioco
  if (detailId) {
    return <GameDetailClient />;
  }

  return <LibraryListView />;
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full py-24">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    }>
      <LibraryPageInner />
    </Suspense>
  );
}

function LibraryListView() {
  const { t, language } = useTranslation();
  const lib = translations[language]?.library || translations.it.library;
  const [games, setGames] = useState<Game[]>(_libCache.games.loaded ? _libCache.games.data : []);
  const [isLoading, setIsLoading] = useState(!_libCache.games.loaded);
  const [coverCache, setCoverCache] = useState<Record<string, string>>({});
  const libraryLoadedRef = React.useRef(false);
  
  // Safe setter per games con validazione + salvataggio in cache globale
  const setGamesWithValidation = (value: unknown) => {
    const validGames = ensureArray<Game>(value);
    
    if (!validateArray(value, 'LibraryPage.setGames')) {
      console.error('[LibraryPage] Attempt to set games with non-array value:', typeof value, value);
    }
    
    setGames(validGames);
    // Salva nella cache globale per ripristino istantaneo al re-mount
    if (validGames.length > 0) {
      _libCache.games.data = validGames;
      _libCache.games.loaded = true;
    }
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

  useEffect(() => {
    if (_libCache.cachesLoadStarted) {
      // Secondo mount StrictMode: ripristina solo i dati già caricati
      if (_libCache.cover.loaded && Object.keys(_libCache.cover.data).length > 0) setCoverCache(_libCache.cover.data);
      if (_libCache.dates.loaded && Object.keys(_libCache.dates.data).length > 0) setAddedDatesCache(_libCache.dates.data);
      if (_libCache.lang.loaded && Object.keys(_libCache.lang.data).length > 0) setLanguagesCache(_libCache.lang.data);
      return;
    }
    _libCache.cachesLoadStarted = true;

    const loadCaches = async () => {
      try {
        // Cover cache
        if (_libCache.cover.loaded) {
          if (Object.keys(_libCache.cover.data).length > 0) setCoverCache(_libCache.cover.data);
        } else {
          const coverCacheData = await invoke<Record<string, string>>('get_all_cover_cache');
          if (coverCacheData && Object.keys(coverCacheData).length > 0) {
            _libCache.cover.data = coverCacheData;
            _libCache.cover.loaded = true;
            setCoverCache(coverCacheData);
            console.log('[Library] 📷 Cover cache caricata:', Object.keys(coverCacheData).length, 'immagini');
          }
        }

        // Added dates cache
        if (_libCache.dates.loaded) {
          if (Object.keys(_libCache.dates.data).length > 0) setAddedDatesCache(_libCache.dates.data);
        } else {
          const addedDates = await invoke<Record<string, number>>('get_all_added_dates');
          if (addedDates && Object.keys(addedDates).length > 0) {
            _libCache.dates.data = addedDates;
            _libCache.dates.loaded = true;
            setAddedDatesCache(addedDates);
            console.log('[Library] 📅 Date aggiunta caricate:', Object.keys(addedDates).length, 'giochi');
          }
        }

        // Languages cache
        if (_libCache.lang.loaded) {
          if (Object.keys(_libCache.lang.data).length > 0) setLanguagesCache(_libCache.lang.data);
        } else {
          const langCache = await invoke<Record<string, string[]>>('get_languages_cache');
          if (langCache && Object.keys(langCache).length > 0) {
            _libCache.lang.data = langCache;
            _libCache.lang.loaded = true;
            setLanguagesCache(langCache);
            console.log('[Library] 🌍 Cache lingue caricata:', Object.keys(langCache).length, 'giochi');
          }
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
            forceRefresh: false
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
    if (_libCache.fetchStarted) return;
    _libCache.fetchStarted = true;
    libraryLoadedRef.current = true;
    
    const CACHE_FRESH_TTL_MS = 15 * 60 * 1000; // 15 min: cache fresca, niente revalidate
    const CACHE_STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24h: cache stale ma usabile

    // Stale-While-Revalidate: mostra cache SUBITO, aggiorna in background
    const checkCacheAndFetch = async () => {
      try {
        const cachedGames = await get<Game[]>('gs_library_games');
        const lastScan = await get<string>('lastSteamScan');
        const cacheAge = lastScan ? Date.now() - new Date(lastScan).getTime() : Infinity;
        console.log(`[Cache] games=${cachedGames?.length ?? 0}, lastScan=${lastScan}, age=${Math.round(cacheAge/1000)}s`);
        
        if (cachedGames && Array.isArray(cachedGames) && cachedGames.length > 0 && cacheAge < CACHE_STALE_TTL_MS) {
          // Cache trovata! Mostra subito i giochi (UI istantanea)
          const epicCount = cachedGames.filter(g => g.platform === 'Epic Games').length;
          const gogCount = cachedGames.filter(g => g.platform === 'GOG').length;
          console.log(`⚡ Libreria da cache IndexedDB: ${cachedGames.length} giochi (Epic: ${epicCount}, GOG: ${gogCount}, age: ${Math.round(cacheAge/1000)}s)`);
          setGamesWithValidation(cachedGames);
          setIsLoading(false);
          
          // Se la cache manca di giochi non-Steam, forza revalidate (cache incompleta)
          const hasNonSteamGames = cachedGames.some(g => g.platform !== 'Steam');
          if (!hasNonSteamGames || epicCount <= 1) {
            console.log(`⚠️ Cache incompleta (Epic: ${epicCount}, nonSteam: ${hasNonSteamGames}), forzo revalidate...`);
            fetchGames();
            return;
          }
          
          if (cacheAge < CACHE_FRESH_TTL_MS) {
            // Cache fresca (<15min): nessun aggiornamento necessario
            console.log(`✅ Cache fresca (${Math.round(cacheAge/1000)}s), skip revalidate`);
            return;
          }
          
          // Cache stale (>15min): aggiorna in background senza bloccare UI
          console.log(`🔄 Cache stale (${Math.round(cacheAge/1000)}s), revalidate in background...`);
          fetchGames(); // Aggiorna in background, UI già visibile
          return;
        }
      } catch (e) {
        console.warn('Errore lettura cache IndexedDB libreria:', e);
      }
      
      // Nessuna cache: fetch completo (primo avvio)
      fetchGames();
    };

    const fetchGames = async () => {
      try {
        // Non mostrare loading spinner se ci sono già giochi visibili (revalidate in background)
        if (!games || games.length === 0) {
          setIsLoading(true);
        }
        const t0 = performance.now();
        console.log('🚀 FAST LIBRARY LOADING (parallel)...');

        // Blacklist software (condivisa)
        const softwareBlacklist = [
          'twinmotion', 'steamvr', 'unreal editor', 'unity',
          'blender', 'godot', 'sdk', 'dedicated server', 'tool',
          'ea desktop', 'ea app', 'origin', 'launcher', 'social club',
          'rockstar games launcher', 'ubisoft connect', 'uplay',
          'epic games launcher', 'gog galaxy', 'battle.net',
          'unity hub', 'unity editor'
        ];
        const isSoftware = (name: string) => {
          const lower = (name || '').toLowerCase();
          return softwareBlacklist.some(sw => lower.includes(sw));
        };

        // ═══════════════════════════════════════════════════════════
        // FASE 1: Lancia TUTTE le chiamate in parallelo
        // ═══════════════════════════════════════════════════════════
        const localScanPromise = invoke('scan_all_steam_games_fast').catch(e => {
          console.warn('⚠️ Local scan failed:', e);
          return [] as any[];
        }) as Promise<Array<{
          id: string; title: string; platform: string; install_path: string | null;
          header_image: string | null; is_installed: boolean; steam_app_id: number | null;
          is_shared: boolean; engine?: string | null; supported_languages?: string | null;
          last_played?: number | null; added_date?: number | null;
        }>>;

        const credsPromise = invoke('load_steam_credentials').catch(() => null) as Promise<{ api_key_encrypted?: string; steam_id?: string } | null>;

        // Altri store (Epic, GOG, Origin, Ubisoft, etc.) — con timeout 15s
        const otherStoresPromise = Promise.race([
          invoke('scan_games'),
          new Promise<any[]>((_, reject) => setTimeout(() => reject('timeout'), 15000))
        ]).catch(e => {
          console.warn('⚠️ Other stores scan failed:', e);
          return [] as any[];
        }) as Promise<Array<{
          id: string; title: string; platform: string; path: string;
          app_id?: string; header_image?: string; is_installed: boolean;
          is_vr?: boolean; engine?: string; supported_languages?: string[];
          genres?: string[]; last_played?: number;
        }>>;

        // Lancia anche API Steam (lenta, ~30-40s) in parallelo — NON attendiamo
        const steamApiPromise = credsPromise.then(async (credentials) => {
          const creds = credentials as { api_key_encrypted?: string; steam_id?: string } | null;
          if (!creds?.api_key_encrypted || !creds?.steam_id) return null;
          try {
            console.log('🔑 Calling Steam API (background)...');
            return await invoke('get_steam_games', {
              apiKey: creds.api_key_encrypted,
              steamId: creds.steam_id,
              forceRefresh: false
            }) as any[];
          } catch (e) {
            console.warn('⚠️ Steam API failed:', e);
            return null;
          }
        });

        // ═══════════════════════════════════════════════════════════
        // FASE 2: Attendi SOLO scan locale + altri store (veloci, <2s)
        //         NON aspettiamo Steam API (lenta, 30-40s)
        // ═══════════════════════════════════════════════════════════
        const [scanResult, otherStoreGames] = await Promise.all([localScanPromise, otherStoresPromise]);

        const localScanData: Map<string, { is_installed: boolean; is_shared: boolean; title: string; engine?: string | null; last_played?: number | null; added_date?: number | null; install_path?: string | null }> = new Map();
        const relevantGames = (scanResult || []).filter(g => g.is_installed || g.is_shared);
        console.log(`📂 Local scan: ${relevantGames.length} relevant games (of ${(scanResult || []).length} total)`);

        for (const g of relevantGames) {
          const appId = g.steam_app_id ? String(g.steam_app_id) : g.id.replace('steam_', '').replace('steam_shared_', '');
          localScanData.set(appId, {
            is_installed: g.is_installed,
            is_shared: g.is_shared,
            title: g.title,
            engine: g.engine || null,
            last_played: g.last_played || null,
            added_date: g.added_date || null,
            install_path: g.install_path || null,
          });
        }

        // Costruisci lista iniziale: giochi locali Steam + altri store
        const finalGamesMap: Map<string, Game> = new Map();

        // Aggiungi giochi locali Steam (installati/shared)
        for (const [appId, localData] of localScanData) {
          if (isSoftware(localData.title)) continue;
          finalGamesMap.set(appId, {
            id: localData.is_shared ? `steam_shared_${appId}` : `steam_${appId}`,
            app_id: appId,
            title: localData.title,
            platform: 'Steam',
            header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
            is_installed: localData.is_installed,
            isShared: localData.is_shared,
            is_vr: false,
            engine: localData.engine || null,
            supported_languages: [],
            last_played: localData.last_played || undefined,
            added_date: localData.added_date || undefined,
            install_dir: localData.install_path || undefined,
          });
        }

        // Aggiungi altri store (Epic, GOG, Xbox, etc.)
        const nonSteamGames = (otherStoreGames || []).filter(g => {
          if (g.platform === 'Steam' || g.id?.startsWith('steam_')) return false;
          return !isSoftware(g.title);
        });
        if (nonSteamGames.length > 0) {
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
        }

        // ═══════════════════════════════════════════════════════════
        // FASE 3: UI SBLOCCATA! Mostra giochi locali + altri store
        // ═══════════════════════════════════════════════════════════
        const quickGames = Array.from(finalGamesMap.values());
        console.log(`⚡ Quick render in ${Math.round(performance.now() - t0)}ms: ${quickGames.length} giochi (locali + altri store)`);
        setGamesWithValidation(quickGames);
        setIsLoading(false); // UI sbloccata!

        // ═══════════════════════════════════════════════════════════
        // FASE 4: Steam API arricchisce in background (30-40s)
        //         Aggiunge giochi owned non installati + nomi corretti
        // ═══════════════════════════════════════════════════════════
        steamApiPromise.then(apiResult => {
          if (!apiResult || apiResult.length === 0) return;

          console.log(`📊 Steam API arrived: ${apiResult.length} owned games`);
          let added = 0;
          let enriched = 0;

          for (const g of apiResult) {
            const appId = String(g.appid);
            if (isSoftware(g.name)) continue;
            const localData = localScanData.get(appId);
            const existing = finalGamesMap.get(appId);

            if (existing) {
              // Arricchisci: aggiorna nome (API ha nomi migliori) e dati
              existing.title = g.name || existing.title;
              existing.isShared = false; // Se è nell'API owned, non è shared
              existing.id = `steam_${appId}`;
              existing.is_vr = g.is_vr || existing.is_vr || false;
              existing.last_played = g.rtime_last_played || g.last_played || existing.last_played;
              if (typeof g.supported_languages === 'string') {
                existing.supported_languages = g.supported_languages.split(',').map((l: string) => l.trim());
              } else if (g.supported_languages?.length) {
                existing.supported_languages = g.supported_languages;
              }
              enriched++;
            } else {
              // Nuovo gioco owned ma non installato
              finalGamesMap.set(appId, {
                id: `steam_${appId}`,
                app_id: appId,
                title: g.name,
                platform: 'Steam',
                header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
                is_installed: false,
                isShared: false,
                is_vr: g.is_vr || false,
                engine: localData?.engine || g.engine || null,
                supported_languages: typeof g.supported_languages === 'string'
                  ? g.supported_languages.split(',').map((l: string) => l.trim())
                  : (g.supported_languages || []),
                last_played: g.rtime_last_played || g.last_played || undefined,
                added_date: localData?.added_date || undefined,
              });
              added++;
            }
          }

          // Aggiorna UI con la lista completa
          const fullGames = Array.from(finalGamesMap.values());
          console.log(`✅ Steam API enrichment: +${added} new, ${enriched} enriched → ${fullGames.length} total (${Math.round(performance.now() - t0)}ms)`);
          setGamesWithValidation(fullGames);

          // Salva la lista completa in IndexedDB
          set('gs_library_games', fullGames).catch(() => {});
          set('lastSteamScan', new Date().toISOString()).catch(() => {});
        }).catch(e => console.warn('⚠️ Steam API enrichment failed:', e));

        // ═══════════════════════════════════════════════════════════
        // FASE 5: Operazioni deferred (non bloccano il rendering)
        // ═══════════════════════════════════════════════════════════
        const initialGames = Array.from(finalGamesMap.values());
        const steamCount = initialGames.filter(g => g.platform === 'Steam').length;
        const epicCount = initialGames.filter(g => g.platform === 'Epic Games').length;
        const otherCount = initialGames.filter(g => g.platform !== 'Steam' && g.platform !== 'Epic Games').length;
        const installedCount = initialGames.filter(g => g.is_installed).length;
        console.log(`📋 Initial: ${initialGames.length} games (Steam: ${steamCount}, Epic: ${epicCount}, Other: ${otherCount}, Installed: ${installedCount})`);

        // Deferred: salva cache e date in background
        const deferWork = async () => {
          // Salva in IndexedDB solo se non esiste già una cache più grande (evita sovrascrivere 786 con 147)
          const existing = await get<Game[]>('gs_library_games').catch(() => null);
          if (!existing || existing.length <= initialGames.length) {
            set('gs_library_games', initialGames).catch(() => {});
            set('lastSteamScan', new Date().toISOString()).catch(() => {});
          }

          // Salva date di aggiunta
          const gameIds = initialGames.map(g => g.app_id || g.id);
          invoke<Record<string, number>>('save_batch_added_dates', { gameIds }).then(updatedDates => {
            if (updatedDates) {
              setAddedDatesCache(updatedDates);
              console.log('[Library] 📅 Date aggiunta aggiornate:', Object.keys(updatedDates).length, 'giochi');
            }
          }).catch(() => {});

          // Track activity
          activityHistory.trackSteamSync(initialGames.length).catch(() => {});

          // ── Check aggiornamenti giochi tracciati ──
          try {
            const tracked = await invoke<Record<string, any>>('get_all_tracked_games');
            if (tracked && Object.keys(tracked).length > 0) {
              const updatedGames: string[] = [];
              const brokenPatches: string[] = [];

              const installedSteam = initialGames.filter(
                g => g.platform === 'Steam' && g.is_installed && g.install_dir && g.app_id
              );

              // Controlla solo i giochi che hanno tracking attivo
              const toCheck = installedSteam.filter(g => {
                const key = `steam_${g.app_id}`;
                return tracked[key];
              });

              // Check in parallelo (max 10 alla volta per non sovraccaricare)
              const BATCH = 10;
              for (let i = 0; i < toCheck.length; i += BATCH) {
                const batch = toCheck.slice(i, i + BATCH);
                const results = await Promise.all(
                  batch.map(g =>
                    invoke<any>('check_game_update', {
                      appId: g.app_id,
                      gamePath: g.install_dir,
                    }).catch(() => null)
                  )
                );
                results.forEach((r, idx) => {
                  if (!r) return;
                  const game = batch[idx];
                  if (r.update_detected) updatedGames.push(game.title);
                  if (!r.patch_intact && r.patch_type !== 'none') brokenPatches.push(game.title);
                });
              }

              if (updatedGames.length > 0 || brokenPatches.length > 0) {
                const parts: string[] = [];
                if (updatedGames.length > 0) {
                  parts.push(`🔄 ${updatedGames.length} ${updatedGames.length === 1 ? 'gioco aggiornato' : 'giochi aggiornati'}: ${updatedGames.slice(0, 3).join(', ')}${updatedGames.length > 3 ? ` (+${updatedGames.length - 3})` : ''}`);
                }
                if (brokenPatches.length > 0) {
                  parts.push(`⚠️ ${brokenPatches.length} patch ${brokenPatches.length === 1 ? 'danneggiata' : 'danneggiate'}: ${brokenPatches.slice(0, 3).join(', ')}${brokenPatches.length > 3 ? ` (+${brokenPatches.length - 3})` : ''}`);
                }

                toast.warning('Aggiornamenti rilevati', {
                  description: parts.join('\n'),
                  duration: 12000,
                });
                console.log(`[Library] 🔔 Update alert: ${updatedGames.length} updated, ${brokenPatches.length} broken patches`);
              }
            }
          } catch (e) {
            console.warn('[Library] Update check failed:', e);
          }
        };

        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(deferWork, { timeout: 3000 });
        } else {
          setTimeout(deferWork, 500);
        }

        // Lingue in background (molto bassa priorità, dopo che Steam API è arrivata)
        setTimeout(() => {
          const loadLanguagesInBackground = async () => {
            try {
              const existingCache = _libCache.lang.loaded
                ? _libCache.lang.data
                : await invoke<Record<string, string[]>>('get_languages_cache');
              const allCurrentGames = Array.from(finalGamesMap.values());
              const steamOnly = allCurrentGames.filter(g => g.platform === 'Steam' && g.app_id);
              const gamesToFetch = steamOnly.filter(g => !existingCache[g.app_id!]);

              if (gamesToFetch.length === 0) return;

              console.log(`[Library] 🌍 Caricamento lingue per ${gamesToFetch.length} giochi in background...`);
              const newCache = { ...existingCache };
              let fetched = 0;
              let consecutiveErrors = 0;

              for (let i = 0; i < Math.min(gamesToFetch.length, 20); i++) {
                const game = gamesToFetch[i];
                try {
                  const languages = await invoke<string[]>('fetch_game_languages', { appId: game.app_id });
                  if (languages && languages.length > 0) {
                    newCache[game.app_id!] = languages;
                    fetched++;
                    consecutiveErrors = 0;
                  }
                  await new Promise(r => setTimeout(r, 1000));
                } catch (e: any) {
                  consecutiveErrors++;
                  if (consecutiveErrors >= 3) break;
                  const isRateLimit = e?.message?.includes('429') || e?.message?.includes('403');
                  if (isRateLimit) await new Promise(r => setTimeout(r, 5000));
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
          loadLanguagesInBackground();
        }, 8000); // Aspetta 8s — dà tempo a Steam API di arrivare prima

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('❌ Library loading error:', errorMsg);
        setGamesWithValidation([]);
        setError(`Unable to load games: ${errorMsg}`);
        setIsLoading(false);
      }
    };

    checkCacheAndFetch();
  }, []); // Carica solo una volta all'avvio

  const handleForceRefresh = (freshGames: Game[]) => {
    console.log('🔄 Force refresh completed, updating games list:', freshGames);
    
    // Aggiungi platform: 'Steam' a tutti i games se mancante
    const safeFreshGames = ensureArray<Game>(freshGames);
    const gamesWithPlatform = safeFreshGames.map(game => ({
      ...game,
      platform: game.platform || 'Steam',
      title: enrichGameTitle(game.app_id || game.id, game.title, game.platform),
      install_dir: (game as any).install_path || game.install_dir || undefined,
    }));
    
    // Debug: conta giochi con nomi validi vs invalidi
    const validNames = gamesWithPlatform.filter(g => g.title && !g.title.match(/^(Game|Shared Game) \d+$/));
    const invalidNames = gamesWithPlatform.filter(g => !g.title || g.title.match(/^(Game|Shared Game) \d+$/));
    console.log(`📊 Giochi con nome valido: ${validNames.length}, senza nome: ${invalidNames.length}`);
    
    setGamesWithValidation(gamesWithPlatform);
  };

  // Estrai le piattaforme, engine, lingue e generi unici dai games caricati
  const safeGames = useMemo(() => ensureArray<Game>(games), [games]);
  const platforms = useMemo(() => ['All', ...new Set(safeGames.map(game => game.platform))], [safeGames]);
  const engines = useMemo(() => ['All', ...new Set(safeGames.filter(game => game.engine && game.engine.toLowerCase() !== 'unknown').map(game => game.engine!))], [safeGames]);
  const languages = useMemo(() => {
    const allLanguages = safeGames.flatMap(game => game.supported_languages || []);
    const normalizedLanguages = allLanguages.map(lang => normalizeLanguage(lang));
    return ['All', ...new Set(normalizedLanguages)].sort();
  }, [safeGames]);
  const genres = useMemo(() => {
    const allGenres = safeGames.flatMap(game => game.genres || []).filter(genre => typeof genre === 'string');
    return ['All', ...new Set(allGenres)];
  }, [safeGames]);

  // Filtriamo e ordiniamo i games (multiselezione)
  const filteredGames = useMemo(() => {
    return safeGames
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
  }, [safeGames, debouncedSearchTerm, selectedPlatforms, selectedEngines, selectedLanguages, selectedGenres, selectedStatus, selectedTags, sortBy, addedDatesCache]);

  const renderGameCardMemoized = useCallback((index: number) => {
    const game = filteredGames[index];
    if (!game) return null;
    
    return (
      <Link key={game.id || `game-${index}`} href={getGameDetailUrl(game)}>
        <div className="group relative overflow-hidden rounded-xl border border-slate-800/60 hover:border-indigo-500/50 bg-slate-900/40 hover:bg-slate-900/80 transition-all duration-500 shadow-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] cursor-pointer h-full flex flex-col">
          {/* Effetto bagliore interno hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-purple-500/5 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0" />
          
          {/* Immagine */}
          <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-slate-800/50 z-10">
            <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors duration-500 z-10 pointer-events-none" />
            <GameImageWithFallback 
              key={`img-${game.id}-${game.app_id}`}
              game={game} 
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              coverCache={coverCache}
            />
            
            {/* Badge piattaforma in alto a destra */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-20">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded shadow-md backdrop-blur-md ${
                game.platform === 'Steam' ? 'bg-[#171a21]/90 text-white border border-[#66c0f4]/30' :
                game.platform === 'Epic Games' ? 'bg-[#2a2a2a]/90 text-white border border-white/20' :
                game.platform === 'GOG' ? 'bg-[#5c2f82]/90 text-white border border-purple-400/30' :
                game.platform === 'Xbox Game Pass' ? 'bg-[#107c10]/90 text-white border border-[#52b043]/30' :
                game.platform === 'Amazon Games' ? 'bg-[#ff9900]/90 text-black border border-[#ffb347]/30' :
                'bg-slate-800/90 text-slate-300 border border-slate-600/50'
              }`}>
                {game.platform || 'Unknown'}
              </span>
              {game.isShared && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded shadow-md backdrop-blur-md bg-orange-500/90 text-white border border-orange-400/30">
                  Shared
                </span>
              )}
            </div>

            {/* Badge Engine/VR/Installed in alto a sinistra */}
            <div className="absolute top-2 left-2 flex flex-wrap gap-1 z-20">
              {game.is_installed && (
                <span className="bg-emerald-500/90 text-emerald-50 text-[10px] w-5 h-5 flex items-center justify-center rounded shadow-md backdrop-blur-md border border-emerald-400/30 font-bold" title="Installato">✓</span>
              )}
              {game.engine && game.engine !== 'Unknown' && (
                <span className="bg-sky-600/90 text-sky-50 text-[9px] px-1.5 py-0.5 flex items-center rounded shadow-md backdrop-blur-md border border-sky-400/30 font-semibold truncate max-w-[80px]" title={game.engine}>{game.engine}</span>
              )}
              {game.is_vr && (
                <span className="bg-violet-600/90 text-violet-50 text-[9px] px-1.5 py-0.5 flex items-center rounded shadow-md backdrop-blur-md border border-violet-400/30 font-bold" title="VR Support">VR</span>
              )}
            </div>

            {/* Quick Actions Overlay su hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 flex items-end justify-center pb-3 gap-1.5 flex-wrap backdrop-blur-[2px]">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); sessionStorage.setItem('wizardAutoGame', JSON.stringify({ id: game.app_id || game.id, title: game.title, install_path: game.install_dir, steam_app_id: game.app_id, header_image: game.header_image })); window.location.href = '/translation-wizard'; }}
                className="bg-indigo-600/90 hover:bg-indigo-500 p-2 rounded-lg text-white transition-all shadow-lg hover:shadow-indigo-500/50 hover:scale-110 border border-indigo-400/30"
                title="Traduci"
              >
                <Sparkles className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/batch?game=${encodeURIComponent(game.title)}&appId=${game.app_id}`; }}
                className="bg-sky-600/90 hover:bg-sky-500 p-2 rounded-lg text-white transition-all shadow-lg hover:shadow-sky-500/50 hover:scale-110 border border-sky-400/30"
                title="Batch"
              >
                <FolderOpen className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/community-hub?query=${encodeURIComponent(game.title)}`; }}
                className="bg-violet-600/90 hover:bg-violet-500 p-2 rounded-lg text-white transition-all shadow-lg hover:shadow-violet-500/50 hover:scale-110 border border-violet-400/30"
                title="Community"
              >
                <Languages className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); const dir = game.install_dir || (game as any).install_path || ''; window.location.href = `/prediction-tool?name=${encodeURIComponent(game.title)}&installDir=${encodeURIComponent(dir)}&engine=${encodeURIComponent(game.engine || '')}&headerImage=${encodeURIComponent(game.header_image || '')}`; }}
                className="bg-purple-600/90 hover:bg-purple-500 p-2 rounded-lg text-white transition-all shadow-lg hover:shadow-purple-500/50 hover:scale-110 border border-purple-400/30"
                title="P.T. Prediction Tool"
              >
                <Brain className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCoverPickerGame(game); }}
                className="bg-slate-700/90 hover:bg-slate-600 p-2 rounded-lg text-white transition-all shadow-lg hover:shadow-slate-500/50 hover:scale-110 border border-slate-500/30"
                title="Cambia cover"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Info sotto l'immagine */}
          <div className="p-2.5 flex-1 flex flex-col z-10">
            <p className="text-[13px] font-bold truncate text-slate-200 group-hover:text-indigo-300 transition-colors drop-shadow-sm mb-1" title={game.title ?? 'Unnamed game'}>
              {game.title ?? 'Unnamed game'}
            </p>
            {(() => {
              // Usa lingue dalla cache se disponibili, altrimenti fallback ai dati del gioco
              const gameKey = game.app_id || game.id;
              const cachedLangs = languagesCache[gameKey];
              const languages = cachedLangs && cachedLangs.length > 0 ? cachedLangs : game.supported_languages;
              return (
                <div className="mt-auto pt-1 h-4 flex items-center">
                  {languages && languages.length > 1 ? (
                    <LanguageFlags supportedLanguages={languages} maxFlags={8} />
                  ) : (
                    <span className="text-[10px] text-slate-600 font-medium">{t('libraryPage.nessunaLinguaRilevata')}</span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </Link>
    );
  }, [filteredGames, coverCache, getGameDetailUrl, languagesCache]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] space-y-6">
          {/* Icona gamepad animata con glow */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
            <div className="relative p-5 rounded-2xl bg-gradient-to-br from-blue-600/20 via-indigo-600/20 to-purple-600/20 border border-white/10 backdrop-blur-sm">
              <Gamepad2 className="h-10 w-10 text-blue-400 animate-bounce" style={{ animationDuration: '2s' }} />
            </div>
          </div>

          {/* Testo */}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {lib.loadingTitle}
            </h3>
            <p className="text-sm text-muted-foreground">{lib.loadingSubtitle}</p>
            <p className="text-xs text-muted-foreground/60">{lib.loadingSlow}</p>
          </div>

          {/* Barra progresso animata */}
          <div className="w-64 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
              style={{ 
                animation: 'loading-bar 2s ease-in-out infinite',
                width: '40%',
              }}
            />
          </div>

          {/* Skeleton cards con wave staggered */}
          <div className="w-full mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4">
              {Array.from({ length: 15 }).map((_, index) => (
                <div 
                  key={index} 
                  className="relative rounded-lg aspect-[16/9] overflow-hidden bg-gray-800/40 border border-white/5"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"
                    style={{
                      animation: 'shimmer 2s ease-in-out infinite',
                      animationDelay: `${index * 80}ms`,
                    }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white/[0.02] to-transparent" />
                </div>
              ))}
            </div>
          </div>

          <style jsx>{`
            @keyframes loading-bar {
              0% { transform: translateX(-100%); }
              50% { transform: translateX(150%); }
              100% { transform: translateX(-100%); }
            }
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
          `}</style>
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
              ? `No games found for "${searchTerm}".`
              : "Your library is empty."}
          </p>
          {searchTerm && hasActiveFilters && (
            <p className="text-sm text-yellow-500 mb-2">
              ⚠️ You have active filters that may be hiding some games.
            </p>
          )}
          {searchTerm && safeGames.length > 0 && (
            <p className="text-sm text-gray-500">
              {safeGames.length} games in library. Try removing filters or refining your search.
            </p>
          )}
          {!searchTerm && (
            <p className="text-sm text-gray-500">
              Use the Refresh button to add games to your library.
            </p>
          )}
        </div>
      );
    }

    // Vista griglia o lista
    if (viewMode === 'list') {
      return (
        <Virtuoso
          className="custom-scrollbar"
          style={{ height: 'calc(100vh - 280px)', paddingRight: '4px' }}
          totalCount={filteredGames.length}
          overscan={20}
          itemContent={(index) => {
            const game = filteredGames[index];
            if (!game) return null;
            return (
              <div className="pb-2">
                <Link key={game.id || `list-game-${index}`} href={getGameDetailUrl(game)}>
                  <div className="group flex items-center bg-slate-900/40 hover:bg-slate-800/60 rounded-xl p-2 border border-slate-800/60 hover:border-indigo-500/40 hover:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all duration-300 cursor-pointer">
                    <div className="w-[100px] h-[56px] flex-shrink-0 rounded-lg overflow-hidden bg-slate-900 mr-4 relative border border-slate-800">
                      <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors z-10 pointer-events-none" />
                      <GameImageWithFallback key={`img-${game.id}-${game.app_id}`} game={game} sizes="100px" coverCache={coverCache} />
                    </div>
                    <div className="flex-grow min-w-0 mr-4">
                      <h3 className="text-sm font-bold text-slate-200 truncate group-hover:text-indigo-300 transition-colors drop-shadow-sm">{game.title}</h3>
                      <div className="flex items-center gap-2.5 mt-1">
                        <span className="text-[10px] font-semibold text-slate-500 tracking-wide uppercase">{game.platform}</span>
                        {game.engine && game.engine.toLowerCase() !== 'unknown' && (
                          <span className="text-[9px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded">{game.engine}</span>
                        )}
                      </div>
                    </div>
                    <div className="hidden lg:flex items-center gap-1.5 mr-4">
                      {game.genres && game.genres.filter(g => g && g.toLowerCase() !== 'unknown').slice(0, 3).map((genre, idx) => (
                        <span key={`${game.id}-genre-${idx}`} className="text-[9px] font-medium bg-slate-800/80 text-slate-400 px-2 py-1 rounded-md border border-slate-700">{genre}</span>
                      ))}
                    </div>
                    {(() => {
                      const gameKey = game.app_id || game.id;
                      const cachedLangs = languagesCache[gameKey];
                      const langs = cachedLangs && cachedLangs.length > 0 ? cachedLangs : game.supported_languages;
                      return langs && langs.length > 1 ? (
                        <div className="hidden md:flex items-center mr-4">
                          <LanguageFlags supportedLanguages={langs} maxFlags={6} />
                        </div>
                      ) : null;
                    })()}
                    <div className="flex items-center gap-3 mr-4">
                      {game.is_installed && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                          Installed
                        </span>
                      )}
                      {game.is_vr && (
                        <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-1 rounded-md border border-violet-500/20">VR</span>
                      )}
                      {game.isShared && (
                        <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20">{t('libraryPage.shared')}</span>
                      )}
                    </div>
                    {/* Quick actions lista */}
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300 pr-2">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); sessionStorage.setItem('wizardAutoGame', JSON.stringify({ id: game.app_id || game.id, title: game.title, install_path: game.install_dir, steam_app_id: game.app_id, header_image: game.header_image })); window.location.href = '/translation-wizard'; }}
                        className="flex items-center gap-1 bg-indigo-600/90 hover:bg-indigo-500 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all shadow-md hover:shadow-indigo-500/30"
                        title="Translation Wizard"
                      >
                        <Sparkles className="h-3 w-3" />
                        Traduci
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/batch?game=${encodeURIComponent(game.title)}&appId=${game.app_id}`; }}
                        className="flex items-center gap-1 bg-sky-600/90 hover:bg-sky-500 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all shadow-md hover:shadow-sky-500/30"
                        title="Batch translate"
                      >
                        <FolderOpen className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </Link>
              </div>
            );
          }}
        />
      );
    }

    return (
      <VirtuosoGrid
        className="custom-scrollbar"
        style={{ height: 'calc(100vh - 280px)' }}
        totalCount={filteredGames.length}
        overscan={40}
        listClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4 pr-2 pb-8"
        itemClassName="min-h-[180px]"
        itemContent={renderGameCardMemoized}
      />
    );
  };

  // Stats computate
  const statsInstalled = useMemo(() => safeGames.filter(g => g.is_installed).length, [safeGames]);
  const statsPlatforms = useMemo(() => new Set(safeGames.map(g => g.platform)).size, [safeGames]);
  const statsEngines = useMemo(() => new Set(safeGames.filter(g => g.engine && g.engine !== 'Unknown').map(g => g.engine)).size, [safeGames]);
  const statsShared = useMemo(() => safeGames.filter(g => g.isShared).length, [safeGames]);

  return (
    <div className="w-full px-4 py-4 relative z-10">
      {/* Hero Header Premium */}
      <div className="relative overflow-hidden rounded-xl bg-slate-950/60 border border-slate-800/50 p-4 mb-4 shadow-xl backdrop-blur-md group/header transition-all duration-500 hover:border-indigo-500/30 hover:bg-slate-950/80">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent opacity-50" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        
        <div className="relative flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900/80 rounded-xl shadow-inner border border-slate-700/50 group-hover/header:border-indigo-500/40 group-hover/header:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all duration-300">
              <Gamepad2 className="h-7 w-7 text-indigo-400 group-hover/header:text-indigo-300 transition-colors" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-3">
                <h1 className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">{lib.title}</h1>
                {games.length > 0 && (
                  <span className="text-[11px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                    {filteredGames.length === games.length ? games.length : `${filteredGames.length} / ${games.length}`}
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs font-medium mt-0.5">
                {games.length > 0 
                  ? filteredGames.length === games.length
                    ? `${games.length} ${lib.gamesAvailable || 'giochi disponibili'}`
                    : `${filteredGames.length} ${lib.gamesOf} ${games.length} ${lib.gamesAvailable || 'disponibili'}`
                  : lib.noGames}
              </p>
            </div>
          </div>

          {/* Stats rapide */}
          {games.length > 0 && (
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 shadow-sm transition-all hover:bg-slate-800/80">
                <Monitor className="h-4 w-4 text-emerald-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200 leading-none">{statsInstalled}</span>
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{lib.installed}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 shadow-sm transition-all hover:bg-slate-800/80">
                <FolderOpen className="h-4 w-4 text-sky-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200 leading-none">{statsPlatforms}</span>
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{lib.provider}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 shadow-sm transition-all hover:bg-slate-800/80">
                <Wrench className="h-4 w-4 text-amber-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200 leading-none">{statsEngines}</span>
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{lib.engine}</span>
                </div>
              </div>
              {statsShared > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 shadow-sm transition-all hover:bg-slate-800/80">
                  <Languages className="h-4 w-4 text-violet-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200 leading-none">{statsShared}</span>
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{lib.shared}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Azioni rapide */}
          <div className="flex items-center gap-2">
            <ForceRefreshButton onRefreshComplete={handleForceRefresh} />
            <button 
              onClick={testFamilySharing} 
              className="group flex items-center gap-2 px-3 py-2 bg-slate-900/80 text-slate-300 hover:text-indigo-300 hover:bg-slate-800/80 rounded-xl transition-all border border-slate-700/50 hover:border-indigo-500/30"
              title="Riscansiona tutti i giochi installati + Family Sharing"
            >
              <RefreshCw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-[11px] font-semibold tracking-wide">Scan</span>
            </button>
            <button
              onClick={() => { window.location.href = '/prediction-tool/ranking'; }}
              className="group flex items-center gap-2 px-3 py-2 bg-purple-900/60 text-purple-300 hover:text-white hover:bg-purple-600/30 rounded-xl transition-all border border-purple-700/40 hover:border-purple-500/50"
              title="Classifica P.T. — Scansiona tutti i giochi installati per difficoltà di traduzione"
            >
              <Brain className="h-4 w-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
              <span className="text-[11px] font-semibold tracking-wide">P.T. Rank</span>
            </button>
            <button 
              onClick={async () => {
                toast.info(lib.downloadingNames);
                try {
                  const result = await invoke('update_remote_game_database');
                  const updatedGames = Object.values(result as any) as Game[];
                  setGames(updatedGames);
                  toast.success(`${lib.databaseUpdated} ${updatedGames.length} ${lib.games}`);
                } catch (e) {
                  toast.error(lib.updateError + ': ' + e);
                }
              }} 
              className="group flex items-center gap-2 px-3 py-2 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-indigo-600/20 rounded-xl transition-all border border-slate-700/50 hover:border-indigo-500/40"
              title="Scarica nomi corretti dei giochi dal Database remoto"
            >
              <Download className="h-4 w-4 text-slate-400 group-hover:text-indigo-300 transition-colors" />
              <span className="text-[11px] font-semibold tracking-wide">Nomi DB</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barra ricerca + controlli */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
        {/* Ricerca con icona */}
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          <input
            type="text"
            placeholder={lib.searchPlaceholder}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all shadow-inner backdrop-blur-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-slate-800">
              <span className="text-xs font-bold">✕</span>
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Ordinamento */}
          <div className="relative group">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-hover:text-slate-300 transition-colors pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none bg-slate-900/60 border border-slate-700/50 rounded-xl pl-9 pr-9 py-2.5 text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 hover:bg-slate-800/80 cursor-pointer shadow-sm transition-all"
            >
              <option value="alphabetical">{lib.alphabetical}</option>
              <option value="recentlyAdded">{lib.recent}</option>
              <option value="lastPlayed">{lib.lastPlayed}</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          </div>
          
          {/* Toggle Filtri con badge contatore */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all border shadow-sm ${
              showFilters 
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                : 'bg-slate-900/60 text-slate-300 border-slate-700/50 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {lib.filters}
            {(() => {
              const activeCount = selectedStatus.length + selectedEngines.length + selectedTags.length + selectedPlatforms.length;
              return activeCount > 0 ? (
                <span className="ml-1 bg-indigo-500 text-white text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center">
                  {activeCount}
                </span>
              ) : (
                showFilters ? <ChevronUp className="h-4 w-4 ml-1 opacity-70" /> : <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
              );
            })()}
          </button>
          
          {/* Vista Toggle */}
          <div className="flex bg-slate-900/60 rounded-xl border border-slate-700/50 p-1 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Pannello Filtri Elegante */}
      {showFilters && (
        <div className="mb-5 p-4 bg-slate-900/80 border border-indigo-500/20 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-md animate-in slide-in-from-top-2 duration-300 relative overflow-hidden">
          {/* Sfondo sottile per il pannello */}
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
          
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Status */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Monitor className="h-3 w-3" /> {lib.status}
              </span>
              <div className="flex flex-wrap gap-2">
                {[{id: 'Installed', label: `Installati`}, {id: 'NotInstalled', label: `Non Installati`}].map(s => (
                  <button key={s.id} onClick={() => toggleFilter(selectedStatus, setSelectedStatus, s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      selectedStatus.includes(s.id) 
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.15)]' 
                      : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700 hover:text-slate-200'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Engine */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Wrench className="h-3 w-3" /> {lib.engine}
              </span>
              <div className="flex flex-wrap gap-2">
                {['Unity', 'Unreal', 'Godot', 'RPG Maker', 'Unknown'].map(eng => (
                  <button key={eng} onClick={() => toggleFilter(selectedEngines, setSelectedEngines, eng)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      selectedEngines.includes(eng) 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]' 
                      : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700 hover:text-slate-200'
                    }`}>
                    {eng}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Tags */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Gamepad2 className="h-3 w-3" /> {lib.tag}
              </span>
              <div className="flex flex-wrap gap-2">
                {[{id: 'VR', label: `🥽 VR`}, {id: 'Shared', label: `🔗 Condivisi`}, {id: 'Backlog', label: `📦 Backlog`}].map(t => (
                  <button key={t.id} onClick={() => toggleFilter(selectedTags, setSelectedTags, t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      selectedTags.includes(t.id) 
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-[0_0_10px_rgba(139,92,246,0.15)]' 
                      : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700 hover:text-slate-200'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Provider */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <FolderOpen className="h-3 w-3" /> {lib.provider}
              </span>
              <div className="flex flex-wrap gap-2">
                {platforms.filter(p => p !== 'All').map(plat => (
                  <button key={plat} onClick={() => toggleFilter(selectedPlatforms, setSelectedPlatforms, plat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      selectedPlatforms.includes(plat) 
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-[0_0_10px_rgba(14,165,233,0.15)]' 
                      : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700 hover:text-slate-200'
                    }`}>
                    {plat}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Clear all filters */}
          {(selectedStatus.length + selectedEngines.length + selectedTags.length + selectedPlatforms.length) > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-end">
              <button 
                onClick={() => { setSelectedStatus([]); setSelectedEngines([]); setSelectedTags([]); setSelectedPlatforms([]); }}
                className="text-xs font-semibold text-slate-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
              >
                ✕ Azzera tutti i filtri
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



