'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { invoke } from '@/lib/tauri-api';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LanguageFlags } from '@/components/ui/language-flags';
import { ForceRefreshButton } from '@/components/ui/force-refresh-button';

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

  // Anti-loop protection
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [lastCredentialsCheck, setLastCredentialsCheck] = useState<number>(0);
  const CREDENTIALS_DEBOUNCE_MS = 2000; // 2 secondi di debounce

  // Funzione per testare Family Sharing con dati mock
  const testFamilySharing = async () => {
    console.log('[LIBRARY DEBUG] 🧪 Test Family Sharing button clicked!');
    
    // Giochi mock condivisi
    const mockSharedGames: Game[] = [
      {
        id: 'mock-570',
        app_id: '570',
        title: 'Dota 2 (Family Sharing)',
        platform: 'Steam',
        header_image: 'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
        isShared: true,
        is_vr: false,
        is_installed: false
      },
      {
        id: 'mock-730',
        app_id: '730',
        title: 'Counter-Strike 2 (Family Sharing)',
        platform: 'Steam',
        header_image: 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
        isShared: true,
        is_vr: false,
        is_installed: false
      },
      {
        id: 'mock-271590',
        app_id: '271590',
        title: 'Grand Theft Auto V (Family Sharing)',
        platform: 'Steam',
        header_image: 'https://cdn.akamai.steamstatic.com/steam/apps/271590/header.jpg',
        isShared: true,
        is_vr: false,
        is_installed: false
      }
    ];

    // Aggiungi i giochi mock alla lista esistente
    setGames(prevGames => {
      const existingIds = new Set(prevGames.map(g => g.id));
      const newGames = mockSharedGames.filter(g => !existingIds.has(g.id));
      console.log(`[LIBRARY DEBUG] ✅ Aggiunti ${newGames.length} giochi mock condivisi`);
      return [...prevGames, ...newGames];
    });
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

        // 🔑 Prima carica le credenziali Steam
        console.log('🔑 Caricamento credenziali Steam...');
        const credentials = await invoke('load_steam_credentials');
        
        if (!credentials || typeof credentials !== 'object' || !('api_key_encrypted' in credentials) || !('steam_id' in credentials)) {
          console.log('⚠️ Credenziali Steam non disponibili, uso metodo alternativo');
          // Fallback a scan_games normale
          const result = await invoke('scan_games');
          console.log('✅ Giochi caricati con scan_games:', result);
          
          // Aggiungi platform: 'Steam' a tutti i giochi se mancante
          const gamesWithPlatform = (result as Game[]).map(game => ({
            ...game,
            platform: game.platform || 'Steam'
          }));
          
          setGames(gamesWithPlatform);
          return;
        }
        
        // 🚀 Prova con la funzione Family Sharing usando le credenziali
        console.log('🚀 Tentativo caricamento con Family Sharing...');
        try {
          const result = await invoke('get_steam_games_with_family_sharing', {
            apiKey: credentials.api_key_encrypted,
            steamId: credentials.steam_id,
            forceRefresh: false
          });
          console.log('✅ Giochi caricati con Family Sharing da Tauri:', result);
          console.log('📊 Debug primi 3 giochi:', (result as Game[]).slice(0, 3));
          console.log('🥽 Giochi con VR:', (result as Game[]).filter(g => g.is_vr));
          console.log('🎯 Giochi con engine:', (result as Game[]).filter(g => g.engine));
          console.log('💾 Giochi installati:', (result as Game[]).filter(g => g.is_installed));
          console.log('🔗 Giochi condivisi:', (result as Game[]).filter(g => g.isShared));
          console.log('📋 Totale giochi per piattaforma:', (result as Game[]).reduce((acc, g) => { acc[g.platform] = (acc[g.platform] || 0) + 1; return acc; }, {} as Record<string, number>));
          
          // Aggiungi platform: 'Steam' a tutti i giochi se mancante
          const gamesWithPlatform = (result as Game[]).map(game => ({
            ...game,
            platform: game.platform || 'Steam'
          }));
          
          setGames(gamesWithPlatform);
        } catch (familySharingError) {
          console.error('❌ Errore nel caricamento con Family Sharing:', familySharingError);
          console.log('🔄 Fallback alla funzione veloce normale...');
          try {
            const result = await invoke('get_games_fast');
            console.log('✅ Giochi caricati con funzione veloce:', result);
            
            // Aggiungi platform: 'Steam' a tutti i giochi se mancante
            const gamesWithPlatform = (result as Game[]).map(game => ({
              ...game,
              platform: game.platform || 'Steam'
            }));
            
            setGames(gamesWithPlatform);
          } catch (fallbackError) {
            console.error('❌ Errore anche con fallback:', fallbackError);
            // Fallback finale a scan_games
            const result = await invoke('scan_games');
            console.log('✅ Giochi caricati con scan_games (fallback finale):', result);
            
            // Aggiungi platform: 'Steam' a tutti i giochi se mancante
            const gamesWithPlatform = (result as Game[]).map(game => ({
              ...game,
              platform: game.platform || 'Steam'
            }));
            
            setGames(gamesWithPlatform);
          }
        }
      } catch (error) {
        console.error('❌ Errore nel caricamento credenziali:', error);
        console.log('🔄 Fallback diretto a scan_games...');
        try {
          const result = await invoke('scan_games');
          console.log('✅ Giochi caricati con scan_games (fallback):', result);
          
          // Aggiungi platform: 'Steam' a tutti i giochi se mancante
          const gamesWithPlatform = (result as Game[]).map(game => ({
            ...game,
            platform: game.platform || 'Steam'
          }));
          
          setGames(gamesWithPlatform);
        } catch (scanError) {
          console.error('❌ Errore anche con scan_games:', scanError);
          
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
            const transformedGames: Game[] = data.games.map((game: any) => ({
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
            
            setGames(transformedGames);
          } catch (fallbackError) {
            console.error('❌ Errore anche con API fallback:', fallbackError);
            const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
            setError(`Impossibile caricare i giochi. Errore: ${errorMessage}`);
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
    const gamesWithPlatform = freshGames.map(game => ({
      ...game,
      platform: game.platform || 'Steam'
    }));
    
    setGames(gamesWithPlatform);
  };

  // Estrai le piattaforme, engine, lingue e generi unici dai giochi caricati
  const platforms = ['All', ...new Set(games.map(game => game.platform))];
  const engines = ['All', ...new Set(games.filter(game => game.engine).map(game => game.engine!))];
  const allLanguages = games.flatMap(game => game.supported_languages || []);
  const normalizedLanguages = allLanguages.map(lang => normalizeLanguage(lang));
  const languages = ['All', ...new Set(normalizedLanguages)].sort();
  const allGenres = games.flatMap(game => game.genres || []).filter(genre => typeof genre === 'string');
  const genres = ['All', ...new Set(allGenres)];

  // Filtriamo e ordiniamo i giochi in base alla ricerca, piattaforma, VR, installazione, lingue, engine e generi
  const filteredGames = games
    .filter((game) => {
      const matchesPlatform = selectedPlatform === 'All' || game.platform === selectedPlatform;
      const matchesSearch = (game.title ?? '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesVR = !showVROnly || game.is_vr;
      const matchesInstalled = !showInstalledOnly || game.is_installed;
      const matchesShared = !showSharedOnly || game.isShared;
      const matchesLanguage = selectedLanguage === 'All' || (game.supported_languages && game.supported_languages.some(lang => normalizeLanguage(lang) === selectedLanguage));
      const matchesEngine = selectedEngine === 'All' || game.engine === selectedEngine;
      const matchesGenre = selectedGenre === 'All' || (game.genres && game.genres.includes(selectedGenre));
      
      return matchesPlatform && matchesSearch && matchesVR && matchesInstalled && matchesShared && matchesLanguage && matchesEngine && matchesGenre;
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
          {filteredGames.map((game) => (
            <Link key={game.id} href={`/games/${game.app_id}`}>
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
        {filteredGames.map((game) => (
          <Link key={game.id} href={`/games/${game.app_id}`}>
            <Card className="group overflow-hidden rounded-lg bg-gray-900 border border-transparent hover:border-purple-500 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-purple-500/20 cursor-pointer">
            <CardContent className="p-0 relative aspect-[16/9]">
              {game.header_image ? (
                <Image
                  src={game.header_image}
                  alt={`Copertina di ${game.title}`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                  className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-600 bg-gray-800">
                  {game.title ? game.title.charAt(0).toUpperCase() : '?'}
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {platforms.map(platform => (
          <button
            key={platform}
            onClick={() => setSelectedPlatform(platform)}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 ${
              selectedPlatform === platform
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}>
            {platform}
          </button>
        ))}
        
        {/* Toggle per filtro VR */}
        <button
          onClick={() => setShowVROnly(!showVROnly)}
          className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 ${
            showVROnly
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}>
          🥽 Solo VR
        </button>
        
        {/* Toggle per filtro Installato */}
        <button
          onClick={() => setShowInstalledOnly(!showInstalledOnly)}
          className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 ${
            showInstalledOnly
              ? 'bg-green-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}>
          ✓ Solo Installati
        </button>
        
        {/* Toggle per filtro Condivisi */}
        <button
          onClick={() => setShowSharedOnly(!showSharedOnly)}
          className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 ${
            showSharedOnly
              ? 'bg-orange-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}>
          🔗 Solo Condivisi
        </button>
      </div>

      {/* Filtri avanzati: Lingue, Engine e Generi */}
      <div className="mb-4 space-y-3">
        {/* Filtro Lingue */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-400">🌍 Lingue:</span>
          {languages.map(language => (
            <button
              key={language}
              onClick={() => setSelectedLanguage(language)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
                selectedLanguage === language
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}>
              {language === 'All' ? 'Tutte' : language}
            </button>
          ))}
        </div>
        
        {/* Filtro Engine */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-400">🎮 Engine:</span>
          {engines.map(engine => (
            <button
              key={engine}
              onClick={() => setSelectedEngine(engine)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
                selectedEngine === engine
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}>
              {engine}
            </button>
          ))}
        </div>
        
        {/* Filtro Generi */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-400">🎯 Generi:</span>
          {genres.map(genre => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
                selectedGenre === genre
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}>
              {genre}
            </button>
          ))}
        </div>
        
        {/* Vista Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-400">📋 Vista:</span>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
              viewMode === 'grid'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}>
            🔲 Griglia
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
              viewMode === 'list'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}>
            📝 Lista
          </button>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <input
          type="text"
          placeholder="Cerca per nome..."
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        {/* Controlli di ordinamento */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-300">Ordina per:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="alphabetical">A-Z (Alfabetico)</option>
              <option value="recentlyAdded">🆕 Aggiunti di recente</option>
              <option value="lastPlayed">🎮 Giocati di recente</option>
            </select>
          </div>
        </div>

        {/* Pulsante Force Refresh per nuovi acquisti */}
        <div className="flex items-center justify-between bg-gradient-to-r from-orange-900/20 to-red-900/20 border border-orange-500/30 rounded-lg p-3">
          <div className="text-sm text-gray-300">
            <span className="font-semibold text-orange-400">🎯 Gioco appena acquistato non visibile?</span>
            <br />
            <span className="text-xs text-gray-400">Force Refresh bypassa tutta la cache per mostrare gli acquisti più recenti</span>
          </div>
          <div className="flex gap-2">
            <ForceRefreshButton onRefreshComplete={handleForceRefresh} />
            <Button variant="outline" size="sm" onClick={testFamilySharing} title="Test Family Sharing con dati mock">
              🔗 Test Family Sharing
            </Button>
          </div>
        </div>
      </div>


      {/* Contenuto principale (griglia, caricamento, errori) */}
      {renderContent()}
    </div>
  );
}
