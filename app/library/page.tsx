'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { invoke } from '@/lib/tauri-api';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LanguageFlags, languageToCountryCode, getFlagEmoji, getCountryCode } from '@/components/ui/language-flags';
import { ForceRefreshButton } from '@/components/ui/force-refresh-button';
import { ensureArray, validateArray } from '@/lib/array-utils';
import { toast } from 'sonner';
import * as CountryFlags from 'country-flag-icons/react/3x2';

// Definiamo l'interfaccia per un singolo gioco, assicurandoci che corrisponda al backend
interface Game {
  id: string;
  app_id: string;
  title: string;
  platform: string;
  header_image: string | null;
  supported_languages?: string[]; // Lingue supportate dal gioco
  is_vr?: boolean; // Se il gioco supporta VR
  engine?: string | null; // Engine utilizzato dal gioco
  is_installed?: boolean; // Se il gioco è installato localmente
  genres?: string[]; // Generi del gioco
  last_played?: number; // Timestamp ultimo accesso
  isShared?: boolean; // Se il gioco è condiviso tramite Family Sharing
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
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Safe setter per games con validazione
  const setGamesWithValidation = (value: unknown) => {
    const validGames = ensureArray<Game>(value);
    
    if (!validateArray(value, 'LibraryPage.setGames')) {
      console.error('[LibraryPage] Tentativo di impostare games con valore non-array:', typeof value, value);
    }
    
    setGames(validGames);
  };
  const [sortBy, setSortBy] = useState<'alphabetical' | 'lastPlayed' | 'recentlyAdded'>('alphabetical');
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [showVROnly, setShowVROnly] = useState(false);
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [showSharedOnly, setShowSharedOnly] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false); // Filtri nascosti stile Rai Pal
  const [showUnplayedOnly, setShowUnplayedOnly] = useState(false); // Nuovo filtro Backlog

  // Anti-loop protection
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [lastCredentialsCheck, setLastCredentialsCheck] = useState<number>(0);
  const CREDENTIALS_DEBOUNCE_MS = 2000; // 2 secondi di debounce

  // 🚀 SCAN COMPLETO - Combina API Steam + File Locali
  const testFamilySharing = async () => {
    console.log('[LIBRARY DEBUG] 🚀 SCAN COMPLETO Steam...');
    setIsLoading(true);
    
    try {
      // 1️⃣ Prima ottieni i giochi dall'API (hanno i nomi corretti)
      const credentials = await invoke('load_steam_credentials') as { steam_id: string; api_key_encrypted: string } | null;
      let apiGames: Map<string, Game> = new Map();
      
      if (credentials) {
        try {
          const apiResult = await invoke('get_steam_games', {
            apiKey: credentials.api_key_encrypted,
            steamId: credentials.steam_id,
            forceRefresh: true
          }) as any[];
          
          console.log(`[LIBRARY DEBUG] 📊 API Steam: ${apiResult.length} giochi con nomi`);
          
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
          console.warn('[LIBRARY DEBUG] ⚠️ API Steam fallita, uso solo file locali');
        }
      }
      
      // 2️⃣ Poi scan locale per trovare TUTTI i giochi (inclusi Family Sharing)
      const localGames = await invoke('scan_all_steam_games_fast') as Array<{
        id: string;
        title: string;
        platform: string;
        install_path: string | null;
        header_image: string | null;
        is_installed: boolean;
        steam_app_id: number | null;
        is_shared: boolean;
      }>;
      
      console.log(`[LIBRARY DEBUG] 📂 File locali: ${localGames.length} giochi trovati`);
      
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
          is_installed: local.is_installed
        });
      }
      
      // Ordina per titolo
      finalGames.sort((a, b) => a.title.localeCompare(b.title));
      
      setGames(finalGames);
      
      // Mostra notifica con risultati
      const gamesWithName = finalGames.filter(g => !g.title.startsWith('Game ') && !g.title.startsWith('Shared Game ')).length;
      toast.success('🎮 Scansione Family Sharing completata!', {
        description: `Trovati ${finalGames.length} giochi totali (${gamesWithName} con nome)`,
        duration: 5000,
      });
      
      console.log(`[LIBRARY] ✅ TOTALE: ${finalGames.length} giochi (${gamesWithName} con nome)`);
      
    } catch (error) {
      console.error('[LIBRARY] ❌ Errore scan:', error);
      toast.error('Errore durante la scansione', {
        description: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchGames = async () => {
      try {
        // Anti-loop protection: controlla se stiamo già caricando o se è troppo presto
        const now = Date.now();
        if (isLoadingCredentials || (now - lastCredentialsCheck) < CREDENTIALS_DEBOUNCE_MS) {
          console.log('🛡️ Anti-loop: Skip caricamento credenziali (debounce attivo)');
          return;
        }

        setIsLoadingCredentials(true);
        setLastCredentialsCheck(now);

        // 🚀 PRIMA: Prova a caricare dalla cache locale (veloce!)
        console.log('📂 Tentativo caricamento dalla cache...');
        try {
          const cachedGames = await invoke('load_steam_games_cache') as any[];
          if (cachedGames && cachedGames.length > 0) {
            console.log(`✅ Cache trovata: ${cachedGames.length} giochi`);
            const convertedGames: Game[] = cachedGames.map((g: any) => ({
              id: g.id,
              app_id: g.steam_app_id ? String(g.steam_app_id) : g.id.replace('steam_', ''),
              title: g.title,
              platform: g.platform || 'Steam',
              header_image: g.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${g.steam_app_id}/header.jpg`,
              isShared: g.is_shared,
              is_vr: g.is_vr || false,
              is_installed: g.is_installed
            }));
            setGames(convertedGames);
            setIsLoading(false);
            setIsLoadingCredentials(false);
            return; // Usa la cache, non serve altro
          }
        } catch (cacheError) {
          console.log('📂 Cache non disponibile, caricamento normale...');
        }

        // 🔑 Fallback: carica le credenziali Steam
        console.log('🔑 Caricamento credenziali Steam...');
        let credentials;
        try {
          credentials = await invoke('load_steam_credentials');
        } catch (credError) {
          console.error('❌ Errore nel caricamento credenziali Steam:', credError);
          console.log('🔄 Procedendo senza credenziali...');
          credentials = null;
        }
        
        if (!credentials || typeof credentials !== 'object' || !('api_key_encrypted' in credentials) || !('steam_id' in credentials)) {
          console.log('⚠️ Credenziali Steam non disponibili, uso metodo alternativo');
          // Fallback a scan_games normale
          try {
            const result = await invoke('scan_games');
            console.log('✅ Giochi caricati con scan_games:', result);
            
            // Aggiungi platform: 'Steam' a tutti i giochi se mancante
            const safeResult = ensureArray<Game>(result);
            const gamesWithPlatform = safeResult.map(game => ({
              ...game,
              platform: game.platform || 'Steam'
            }));
            
            setGamesWithValidation(gamesWithPlatform);
          } catch (scanError) {
            console.error('❌ Errore anche con scan_games iniziale:', scanError);
            console.log('⚠️ Impostazione games a array vuoto');
            setGamesWithValidation([]);
            setError('Impossibile caricare i giochi. Verifica la connessione a Steam.');
          }
          return;
        }
        
        // 🚀 Prova con la funzione Family Sharing usando le credenziali
        console.log('🚀 Tentativo caricamento con Family Sharing...');
        try {
          const result = await invoke('get_steam_games_with_family_sharing', {
            apiKey: credentials.api_key_encrypted,
            steamId: credentials.steam_id,
            forceRefresh: true
          });
          console.log('✅ Giochi caricati con Family Sharing da Tauri:', result);
          const safeResult = ensureArray<Game>(result);
          console.log('📊 Debug primi 3 giochi:', safeResult.slice(0, 3));
          console.log('🥽 Giochi con VR:', safeResult.filter(g => g.is_vr));
          console.log('🎯 Giochi con engine:', safeResult.filter(g => g.engine));
          console.log('💾 Giochi installati:', safeResult.filter(g => g.is_installed));
          console.log('🔗 Giochi condivisi:', safeResult.filter(g => g.isShared));
          console.log('📋 Totale giochi per piattaforma:', safeResult.reduce((acc, g) => { acc[g.platform] = (acc[g.platform] || 0) + 1; return acc; }, {} as Record<string, number>));
          
          // Aggiungi platform: 'Steam' a tutti i giochi se mancante
          const gamesWithPlatform = safeResult.map(game => ({
            ...game,
            platform: game.platform || 'Steam'
          }));
          
          setGamesWithValidation(gamesWithPlatform);
        } catch (familySharingError) {
          const errorMsg = familySharingError instanceof Error ? familySharingError.message : String(familySharingError);
          console.error('❌ Errore nel caricamento con Family Sharing:', {
            error: errorMsg,
            type: typeof familySharingError,
            stack: familySharingError instanceof Error ? familySharingError.stack : undefined
          });
          console.log('🔄 Fallback alla funzione veloce normale...');
          try {
            const result = await invoke('get_games_fast');
            console.log('✅ Giochi caricati con funzione veloce:', result);
            
            // Aggiungi platform: 'Steam' a tutti i giochi se mancante
            const safeResult = ensureArray<Game>(result);
            const gamesWithPlatform = safeResult.map(game => ({
              ...game,
              platform: game.platform || 'Steam'
            }));
            
            setGamesWithValidation(gamesWithPlatform);
          } catch (fallbackError) {
            const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
            console.error('❌ Errore anche con fallback get_games_fast:', {
              error: fallbackMsg,
              type: typeof fallbackError
            });
            // Fallback finale a scan_games
            try {
              const result = await invoke('scan_games');
              console.log('✅ Giochi caricati con scan_games (fallback finale):', result);
              
              // Aggiungi platform: 'Steam' a tutti i giochi se mancante
              const safeResult = ensureArray<Game>(result);
              const gamesWithPlatform = safeResult.map(game => ({
                ...game,
                platform: game.platform || 'Steam'
              }));
              
              setGamesWithValidation(gamesWithPlatform);
            } catch (scanFinalError) {
              const scanMsg = scanFinalError instanceof Error ? scanFinalError.message : String(scanFinalError);
              console.error('❌ Errore anche con scan_games finale:', scanMsg);
              console.log('⚠️ Impostazione games a array vuoto dopo tutti i fallback');
              setGamesWithValidation([]);
              setError(`Impossibile caricare i giochi dopo tutti i tentativi. Ultimo errore: ${scanMsg}`);
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('❌ Errore nel caricamento credenziali:', {
          error: errorMsg,
          type: typeof error,
          stack: error instanceof Error ? error.stack : undefined
        });
        console.log('🔄 Fallback diretto a scan_games...');
        try {
          const result = await invoke('scan_games');
          console.log('✅ Giochi caricati con scan_games (fallback):', result);
          
          // Aggiungi platform: 'Steam' a tutti i giochi se mancante
          const safeResult = ensureArray<Game>(result);
          const gamesWithPlatform = safeResult.map(game => ({
            ...game,
            platform: game.platform || 'Steam'
          }));
          
          setGamesWithValidation(gamesWithPlatform);
        } catch (scanError) {
          const scanMsg = scanError instanceof Error ? scanError.message : String(scanError);
          console.error('❌ Errore anche con scan_games:', {
            error: scanMsg,
            type: typeof scanError
          });
          
          // Fallback: usa l'API Next.js se Tauri non è disponibile
          try {
            console.log('🔄 Tentativo fallback con API Next.js...');
            const response = await fetch('/api/library/games');
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              throw new Error('Response non è JSON');
            }
            
            const data = await response.json();
            console.log('🎮 Giochi caricati da API fallback:', data);
            
            // Trasforma i dati dell'API nel formato atteso
            const safeGames = ensureArray(data.games);
            const transformedGames: Game[] = safeGames.map((game: any) => ({
              id: game.id,
              app_id: game.id.replace('steam_', ''),
              title: game.name,
              platform: game.provider,
              header_image: game.imageUrl,
              supported_languages: game.supported_languages || ['Inglese'], // Usa dati reali dal backend
              is_vr: game.is_vr || false,
              engine: game.engine || null,
              is_installed: game.is_installed || false,
              genres: game.genres || ['Game']
            }));
            
            setGamesWithValidation(transformedGames);
          } catch (fallbackError) {
            const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
            console.error('❌ Errore anche con API fallback:', {
              error: fallbackMsg,
              type: typeof fallbackError,
              stack: fallbackError instanceof Error ? fallbackError.stack : undefined
            });
            console.log('⚠️ Impostazione games a array vuoto dopo tutti i fallback API');
            setGamesWithValidation([]);
            setError(`Impossibile caricare i giochi. Errore: ${fallbackMsg}`);
          }
        }
      } finally {
        setIsLoadingCredentials(false);
        setIsLoading(false);
      }
    };

    fetchGames();
  }, [isLoadingCredentials, lastCredentialsCheck]);

  const handleForceRefresh = (freshGames: Game[]) => {
    console.log('🔄 Force refresh completed, updating games list:', freshGames);
    
    // Aggiungi platform: 'Steam' a tutti i giochi se mancante
    const safeFreshGames = ensureArray<Game>(freshGames);
    const gamesWithPlatform = safeFreshGames.map(game => ({
      ...game,
      platform: game.platform || 'Steam'
    }));
    
    setGamesWithValidation(gamesWithPlatform);
  };

  // Estrai le piattaforme, engine, lingue e generi unici dai giochi caricati
  const safeGames = ensureArray<Game>(games);
  const platforms = ['All', ...new Set(safeGames.map(game => game.platform))];
  const engines = ['All', ...new Set(safeGames.filter(game => game.engine).map(game => game.engine!))];
  const allLanguages = safeGames.flatMap(game => game.supported_languages || []);
  const normalizedLanguages = allLanguages.map(lang => normalizeLanguage(lang));
  const languages = ['All', ...new Set(normalizedLanguages)].sort();
  const allGenres = safeGames.flatMap(game => game.genres || []).filter(genre => typeof genre === 'string');
  const genres = ['All', ...new Set(allGenres)];

  // Filtriamo e ordiniamo i giochi in base alla ricerca, piattaforma, VR, installazione, lingue, engine e generi
  const filteredGames = safeGames
    .filter((game) => {
      // 🚫 Nascondi giochi senza nome valido (mostrano "Game XXXXX")
      const hasValidName = game.title && !game.title.match(/^(Game|Shared Game) \d+$/);
      if (!hasValidName) return false;
      
      const matchesPlatform = selectedPlatform === 'All' || game.platform === selectedPlatform;
      const matchesSearch = (game.title ?? '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesVR = !showVROnly || game.is_vr;
      const matchesInstalled = !showInstalledOnly || game.is_installed;
      const matchesShared = !showSharedOnly || game.isShared;
      const matchesUnplayed = !showUnplayedOnly || (!game.last_played || game.last_played === 0);
      const matchesLanguage = selectedLanguage === 'All' || (game.supported_languages && game.supported_languages.some(lang => normalizeLanguage(lang) === selectedLanguage));
      const matchesEngine = selectedEngine === 'All' || game.engine === selectedEngine;
      const matchesGenre = selectedGenre === 'All' || (game.genres && game.genres.includes(selectedGenre));
      
      return matchesPlatform && matchesSearch && matchesVR && matchesInstalled && matchesShared && matchesUnplayed && matchesLanguage && matchesEngine && matchesGenre;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recentlyAdded':
          // Ordina per ID Steam (numeri più alti = giochi più recenti)
          const aId = parseInt(a.app_id) || 0;
          const bId = parseInt(b.app_id) || 0;
          return bId - aId;
        case 'lastPlayed':
          // Ordina per ultimo accesso (se disponibile)
          return (b.last_played || 0) - (a.last_played || 0);
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
            <h3 className="text-lg font-semibold mb-2">🎮 Caricamento Libreria Giochi</h3>
            <p className="text-muted-foreground">Connessione a Tauri e recupero metadati...</p>
            <p className="text-xs text-muted-foreground mt-1">Se il caricamento è lento, premi F5 per forzare l'aggiornamento</p>
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
      // Messaggio per quando non ci sono risultati
      return (
        <div className="text-center py-10">
          <p className="text-gray-400 mb-2">
            {searchTerm
              ? `Nessun gioco trovato per "${searchTerm}".`
              : "La tua libreria è vuota."}
          </p>
          {!searchTerm && (
            <p className="text-sm text-gray-500">
              Usa il pulsante 'Scansiona Giochi' per aggiungere giochi alla tua libreria.
            </p>
          )}
        </div>
      );
    }

    // Vista griglia o lista
    if (viewMode === 'list') {
      return (
        <div className="space-y-2">
          {filteredGames.map((game, index) => (
            <Link key={game.id || `list-game-${index}`} href={`/games/${game.app_id}`}>
              <div className="group flex items-center bg-gray-900 rounded-lg p-4 border border-transparent hover:border-purple-500 transition-all duration-300 shadow-lg hover:shadow-purple-500/20 cursor-pointer">
              {/* Thumbnail piccola */}
              <div className="w-20 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-800 mr-4">
                {game.header_image ? (
                  <Image
                    src={game.header_image}
                    alt={`Thumbnail di ${game.title}`}
                    width={80}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-600">
                    {game.title ? game.title.charAt(0).toUpperCase() : '?'}
                  </div>
                )}
              </div>
              
              {/* Informazioni gioco */}
              <div className="flex-grow min-w-0">
                <h3 className="text-lg font-semibold text-white truncate">{game.title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-sm text-gray-400">{game.platform}</span>
                  {game.engine && game.engine !== 'Unknown' && <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">{game.engine}</span>}
                  {game.genres && game.genres.filter(genre => genre !== 'Unknown').map((genre, index) => (
                    <span key={`${game.id}-genre-${index}`} className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">{genre}</span>
                  ))}
                </div>
              </div>
              
              {/* Badge e azioni */}
              <div className="flex items-center gap-2 ml-4">
                {game.supported_languages && game.supported_languages.length > 0 && (
                  <LanguageFlags supportedLanguages={game.supported_languages} maxFlags={3} />
                )}
                {game.is_installed && <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">✓ Installato</span>}
                {game.is_vr && <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">🥽 VR</span>}
                {game.isShared && <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded-full">🔗 Condiviso</span>}
                
              </div>
              </div>
            </Link>
          ))}
        </div>
      );
    }

    // Vista griglia (default)
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {filteredGames.map((game, index) => (
          <Link key={game.id || `game-${index}`} href={`/games/${game.app_id}`}>
            <Card className="group overflow-hidden rounded-lg bg-gray-900 border border-transparent hover:border-purple-500 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-purple-500/20 cursor-pointer">
            <CardContent className="p-0 relative aspect-[16/9]">
              {game.header_image && !game.title.startsWith('Game ') ? (
                <Image
                  src={game.header_image}
                  alt={game.title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                  className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback se l'immagine non carica
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-blue-900/50">
                  <span className="text-4xl font-bold text-purple-400/60">
                    {game.title ? game.title.replace('Game ', '').charAt(0).toUpperCase() : '?'}
                  </span>
                </div>
              )}
              
              {/* Bandiere delle lingue supportate */}
              {game.supported_languages && game.supported_languages.length > 0 && (
                <div className="absolute top-2 right-2 bg-black bg-opacity-70 rounded-md p-1.5 backdrop-blur-sm">
                  <LanguageFlags supportedLanguages={game.supported_languages} maxFlags={5} />
                </div>
              )}
              
              {/* Badge VR, Engine e Installato */}
              <div className="absolute bottom-2 left-2 flex flex-col gap-1">
                {game.is_installed && (
                  <div className="bg-green-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded-full font-semibold backdrop-blur-sm">
                    ✓ Installato
                  </div>
                )}
                {game.is_vr && (
                  <div className="bg-purple-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded-full font-semibold backdrop-blur-sm">
                    🥽 VR
                  </div>
                )}
                {game.engine && game.engine !== 'Unknown' && (
                  <div className="bg-blue-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded-full font-semibold backdrop-blur-sm">
                    {game.engine}
                  </div>
                )}
                {game.isShared && (
                  <div className="bg-orange-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded-full font-semibold backdrop-blur-sm">
                    🔗 Condiviso
                  </div>
                )}
              </div>
              
            </CardContent>
            <CardFooter className="p-3 bg-black bg-opacity-60 backdrop-blur-sm absolute bottom-0 w-full transition-opacity duration-300 opacity-0 group-hover:opacity-100">
              <p className="text-sm font-semibold truncate text-white" title={game.title ?? 'Gioco senza nome'}>
                {game.title ?? 'Gioco senza nome'}
              </p>
            </CardFooter>
          </Card>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Sezione di ricerca e titolo */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Libreria Giochi</h1>
        <p className="text-gray-400">
          {games.length > 0
            ? `${filteredGames.length} di ${games.length} giochi trovati.`
            : 'Nessun gioco nella libreria.'}
        </p>
      </div>

      {/* Barra compatta con ricerca e toggle filtri */}
      <div className="flex items-center gap-3 mb-4">
        {/* Ricerca */}
        <input
          type="text"
          placeholder="Cerca per nome..."
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
          <option value="alphabetical">A-Z (Alfabetico)</option>
          <option value="recentlyAdded">🆕 Aggiunti di recente</option>
          <option value="lastPlayed">🎮 Giocati di recente</option>
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
          🎛️ Filtri {showFilters ? '▲' : '▼'}
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

      {/* Pannello Filtri Collassabile */}
      {showFilters && (
        <div className="mb-4 p-3 bg-gray-800/30 border border-gray-700 rounded-lg space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Piattaforme + Quick Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {platforms.map(platform => (
              <button
                key={platform}
                onClick={() => setSelectedPlatform(platform)}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                  selectedPlatform === platform
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
                }`}>
                {platform}
              </button>
            ))}
            <span className="text-gray-600 mx-1">|</span>
            <button
              onClick={() => setShowVROnly(!showVROnly)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                showVROnly ? 'bg-purple-600 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
              }`}>
              🥽 VR
            </button>
            <button
              onClick={() => setShowInstalledOnly(!showInstalledOnly)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                showInstalledOnly ? 'bg-green-600 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
              }`}>
              ✓ Installati
            </button>
            <button
              onClick={() => setShowSharedOnly(!showSharedOnly)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                showSharedOnly ? 'bg-orange-600 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
              }`}>
              🔗 Condivisi
            </button>
            <button
              onClick={() => setShowUnplayedOnly(!showUnplayedOnly)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                showUnplayedOnly ? 'bg-pink-600 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
              }`}>
              📦 Backlog
            </button>
          </div>
          
          {/* Lingue */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-gray-500 w-12">Lingue:</span>
            {languages.slice(0, 12).map(language => {
              const countryCode = getCountryCode(language);
              const FlagComponent = countryCode ? (CountryFlags as any)[countryCode] : null;
              const isSelected = selectedLanguage === language;
              
              return (
                <button
                  key={language}
                  onClick={() => setSelectedLanguage(language)}
                  title={language === 'All' ? 'Tutte le lingue' : language}
                  className={`relative group flex items-center justify-center w-8 h-6 rounded border transition-all ${
                    isSelected
                      ? 'bg-green-600/20 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-500 hover:bg-gray-700'
                  }`}
                >
                  {language === 'All' ? (
                    <span className="text-xs">🌐</span>
                  ) : FlagComponent ? (
                    <div className={`w-5 h-3.5 shadow-sm rounded-[1px] overflow-hidden ${isSelected ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                      <FlagComponent className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <span className="text-[10px] uppercase font-bold text-gray-400">
                      {language.substring(0, 2)}
                    </span>
                  )}
                  
                  {/* Tooltip on hover */}
                  <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 border border-gray-700">
                    {language === 'All' ? 'Tutte' : language}
                  </span>
                </button>
              );
            })}
          </div>
          
          {/* Engine */}
          {engines.length > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-gray-500 w-12">Engine:</span>
              {engines.slice(0, 6).map(engine => (
                <button
                  key={engine}
                  onClick={() => setSelectedEngine(engine)}
                  className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                    selectedEngine === engine
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
                  }`}>
                  {engine}
                </button>
              ))}
            </div>
          )}
          
          {/* Generi */}
          {genres.length > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-gray-500 w-12">Generi:</span>
              {genres.slice(0, 8).map(genre => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                    selectedGenre === genre
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
                  }`}>
                  {genre}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pulsante Force Refresh compatto */}
      <div className="flex items-center justify-between bg-gray-800/30 border border-gray-700 rounded-lg p-2 mb-4">
        <span className="text-xs text-gray-400">🎯 Gioco non visibile?</span>
        <div className="flex gap-2">
          <ForceRefreshButton onRefreshComplete={handleForceRefresh} />
          <Button variant="outline" size="sm" onClick={testFamilySharing} className="text-xs h-7">
            🔗 Family Sharing
          </Button>
        </div>
      </div>


      {/* Contenuto principale (griglia, caricamento, errori) */}
      {renderContent()}
    </div>
  );
}
