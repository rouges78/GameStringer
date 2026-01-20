
'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Play, 
  Settings, 
  Download, 
  FileText, 
  Archive,
  Calendar,
  HardDrive,
  Monitor,
  Folder,
  Languages,
  Zap,
  Eye,
  Globe,
  Sparkles,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { mockGames } from '@/lib/mock-data';
import InlineTranslator from '@/components/inline-translator';
import { LanguageFlags } from '@/components/ui/language-flags';
import { activityHistory } from '@/lib/activity-history';
import { TranslationRecommendation } from '@/components/translation-recommendation';

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;
  
  const [game, setGame] = useState<any>(null);
  const [translations, setTranslations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [dlcGames, setDlcGames] = useState<any[]>([]);
  const [showTranslation, setShowTranslation] = useState(false);
  const [steamDetails, setSteamDetails] = useState<any>(null);
  const [imageError, setImageError] = useState(false);

  const [isInstallingPatch, setIsInstallingPatch] = useState(false);
  const [patchStatus, setPatchStatus] = useState<{success: boolean, message: string} | null>(null);
  const [engineInfo, setEngineInfo] = useState<{
    engine: string;
    can_patch: boolean;
    patch_tool: string | null;
    patch_description: string | null;
  } | null>(null);
  const [isDetectingEngine, setIsDetectingEngine] = useState(false);
  
  // Editor traduzioni XUnity
  const [xunityTranslations, setXunityTranslations] = useState<{original: string, translated: string, line_number: number}[]>([]);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(false);
  const [showTranslationEditor, setShowTranslationEditor] = useState(false);
  const [translationSearch, setTranslationSearch] = useState('');
  const [editingEntry, setEditingEntry] = useState<{original: string, translated: string} | null>(null);

  // Lightbox screenshot (indice per navigazione)
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState<number | null>(null);

  // Descrizione tradotta in italiano
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);

  // HowLongToBeat
  const [hltbData, setHltbData] = useState<{found: boolean; main?: number; main_extra?: number; completionist?: number; url?: string} | null>(null);
  const [isLoadingHltb, setIsLoadingHltb] = useState(false);

  // Unreal Engine Patcher
  const [unrealPatchStatus, setUnrealPatchStatus] = useState<{
    installed: boolean;
    version: string;
    target_language: string;
    translations_count: number;
    last_used: string | null;
  } | null>(null);

  // Rileva motore quando il gioco è caricato
  const detectEngine = async () => {
    if (!game) return;
    
    setIsDetectingEngine(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{
        engine: string;
        can_patch: boolean;
        patch_tool: string | null;
        patch_description: string | null;
      }>('detect_engine_for_game', {
        gameName: game.name || game.title,
        installPath: game.installPath || null
      });
      setEngineInfo(result);
      // Aggiorna anche il campo engine nel game state
      setGame((prev: any) => prev ? { ...prev, engine: result.engine } : null);
    } catch (error) {
      console.error('Errore rilevamento motore:', error);
    } finally {
      setIsDetectingEngine(false);
    }
  };

  const handleInstallUnityPatch = async () => {
    if (!game) return;
    
    setIsInstallingPatch(true);
    setPatchStatus(null);
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      // Trova il path di installazione se non presente
      let installPath = game.installPath;
      if (!installPath) {
        try {
          installPath = await invoke('find_game_install_path', { 
            installDir: game.install_dir || game.name || game.title
          });
        } catch (e) {
          console.error('Impossibile trovare cartella gioco:', e);
          setPatchStatus({ success: false, message: 'Cartella del gioco non trovata' });
          setIsInstallingPatch(false);
          return;
        }
      }
      
      // Cerca l'eseguibile principale nella cartella
      let exeName = game.detectedFiles?.find((f: string) => f.endsWith('.exe'));
      console.log('[Patch] detectedFiles exe:', exeName);
      if (!exeName) {
        try {
          const exeList = await invoke<string[]>('find_executables_in_folder', { folderPath: installPath });
          console.log('[Patch] exeList trovati:', exeList);
          if (exeList && exeList.length > 0) {
            exeName = exeList[0];
          }
        } catch (e) {
          console.warn('[Patch] Impossibile trovare eseguibili, uso nome gioco:', e);
        }
      }
      // Fallback al nome del gioco
      if (!exeName) {
        exeName = `${(game.name || game.title || 'Game').replace(/[^a-zA-Z0-9]/g, '')}.exe`;
      }
      
      console.log('[Patch] Installazione con:', { gamePath: installPath, gameExeName: exeName });
      console.log('[Patch] Chiamata install_unity_autotranslator...');
      
      const result: any = await invoke('install_unity_autotranslator', { 
        gamePath: installPath,
        gameExeName: exeName,
        targetLang: 'it',
        translationMode: 'google' // Usa Google Translate per traduzione automatica
      });
      
      console.log('[Patch] Risultato:', result);
      
      setPatchStatus({
        success: result.success,
        message: result.message
      });
      
      if (result.success) {
        console.log('[Patch] Installazione completata con successo!');
        // Traccia attività
        await activityHistory.trackPatch(
          game.name || game.title,
          game.appid?.toString(),
          'Unity AutoTranslator (BepInEx)'
        );
        // Refresh game detected files to see new BepInEx files
        scanGameFiles();
      }
    } catch (error: any) {
      console.error('Errore installazione patch:', error);
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore sconosciuto durante l\'installazione'
      });
    } finally {
      setIsInstallingPatch(false);
    }
  };

  const handleUninstallUnityPatch = async () => {
    if (!game?.installPath) return;
    
    if (!confirm('Sei sicuro di voler rimuovere la patch Unity AutoTranslator?')) return;
    
    setIsInstallingPatch(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{success: boolean, message: string}>('remove_unity_patch', {
        gamePath: game.installPath
      });
      
      setPatchStatus(result);
    } catch (error: any) {
      console.error('Errore rimozione patch Unity:', error);
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore durante la rimozione'
      });
    } finally {
      setIsInstallingPatch(false);
    }
  };

  // === UNREAL ENGINE PATCHER FUNCTIONS ===
  
  const loadUnrealPatchStatus = async () => {
    if (!game?.installPath) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<{
        installed: boolean;
        version: string;
        target_language: string;
        translations_count: number;
        last_used: string | null;
      }>('get_unreal_patch_status', { gamePath: game.installPath });
      setUnrealPatchStatus(status);
    } catch (error) {
      console.error('Errore caricamento stato patch Unreal:', error);
    }
  };

  const handleInstallUnrealPatch = async () => {
    if (!game?.installPath) return;
    
    setIsInstallingPatch(true);
    setPatchStatus(null);
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<string>('install_unreal_patch', {
        gamePath: game.installPath,
        config: {
          target_language: 'it',
          source_language: 'en',
          translation_service: 'google',
          cache_enabled: true,
          auto_translate: true
        }
      });
      
      setPatchStatus({ success: true, message: result });
      // Traccia attività
      await activityHistory.trackPatch(
        game.name || game.title,
        game.appid?.toString(),
        'Unreal Engine Translator'
      );
      await loadUnrealPatchStatus();
    } catch (error: any) {
      console.error('Errore installazione patch Unreal:', error);
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore durante l\'installazione'
      });
    } finally {
      setIsInstallingPatch(false);
    }
  };

  const handleUninstallUnrealPatch = async () => {
    if (!game?.installPath) return;
    
    if (!confirm('Sei sicuro di voler rimuovere la patch di traduzione?')) return;
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<string>('uninstall_unreal_patch', {
        gamePath: game.installPath
      });
      
      setPatchStatus({ success: true, message: result });
      setUnrealPatchStatus(null);
    } catch (error: any) {
      console.error('Errore rimozione patch Unreal:', error);
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore durante la rimozione'
      });
    }
  };

  const handleLaunchWithTranslator = async () => {
    if (!game?.installPath) return;
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      // Trova l'eseguibile
      const gameInfo = await invoke<{ executable: string }>('detect_unreal_game', {
        gamePath: game.installPath
      });
      
      await invoke('launch_with_translator', {
        gamePath: game.installPath,
        executable: gameInfo.executable
      });
      
      // Traccia avvio gioco
      await activityHistory.trackGameLaunch(
        game.name || game.title,
        game.appid?.toString()
      );
      
      setPatchStatus({ success: true, message: 'Gioco avviato con traduttore!' });
    } catch (error: any) {
      console.error('Errore avvio gioco:', error);
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore avvio gioco'
      });
    }
  };

  // Carica traduzioni XUnity
  const loadXunityTranslations = async () => {
    if (!game?.installPath) return;
    
    setIsLoadingTranslations(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const entries = await invoke<{original: string, translated: string, line_number: number}[]>(
        'read_xunity_translations', 
        { gamePath: game.installPath }
      );
      setXunityTranslations(entries);
      setShowTranslationEditor(true);
    } catch (error: any) {
      console.error('Errore caricamento traduzioni:', error);
      alert(typeof error === 'string' ? error : 'Errore caricamento traduzioni');
    } finally {
      setIsLoadingTranslations(false);
    }
  };

  // Salva traduzione modificata
  const saveTranslation = async (original: string, newTranslation: string) => {
    if (!game?.installPath) return;
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_xunity_translation', {
        gamePath: game.installPath,
        original,
        newTranslation
      });
      
      // Aggiorna lista locale
      setXunityTranslations(prev => 
        prev.map(e => e.original === original ? { ...e, translated: newTranslation } : e)
      );
      setEditingEntry(null);
    } catch (error: any) {
      console.error('Errore salvataggio:', error);
      alert('Errore salvataggio traduzione');
    }
  };

  // Filtra traduzioni per ricerca
  const filteredTranslations = xunityTranslations.filter(t => 
    t.original.toLowerCase().includes(translationSearch.toLowerCase()) ||
    t.translated.toLowerCase().includes(translationSearch.toLowerCase())
  );

  useEffect(() => {
    if (gameId) {
      const fetchGameData = async () => {
        setIsLoading(true);
        try {
          // Import invoke per chiamate Tauri
          const { invoke } = await import('@tauri-apps/api/core');
          
          // Leggi parametri dalla URL (passati dalla libreria)
          const urlParams = new URLSearchParams(window.location.search);
          const urlName = urlParams.get('name') ? decodeURIComponent(urlParams.get('name')!) : null;
          const urlInstallDir = urlParams.get('installDir');
          const urlInstalled = urlParams.get('installed') === 'true';
          const urlAppId = urlParams.get('appId');
          
          // Rileva piattaforma dal gameId
          const isEpicGame = gameId.startsWith('epic_');
          const isGogGame = gameId.startsWith('gog_');
          const isOriginGame = gameId.startsWith('origin_');
          const isNonSteamGame = isEpicGame || isGogGame || isOriginGame;
          
          // Leggi parametri aggiuntivi dalla URL
          const urlPlatform = urlParams.get('platform');
          const urlHeaderImage = urlParams.get('headerImage');
          
          // Estrai appId: può essere numerico, "steam_family_XXXX", o passato via URL
          let appId: number | null = null;
          if (!isNonSteamGame) {
            if (urlAppId) {
              appId = parseInt(urlAppId);
            } else if (gameId.startsWith('steam_family_')) {
              appId = parseInt(gameId.replace('steam_family_', ''));
            } else if (gameId.startsWith('steam_')) {
              appId = parseInt(gameId.replace('steam_', ''));
            } else {
              const parsed = parseInt(gameId);
              if (!isNaN(parsed)) appId = parsed;
            }
          }
          
          // Carica dettagli estesi da Steam API tramite Tauri (bypass CORS)
          // Solo per giochi Steam
          let steamApiData = null;
          if (!isNonSteamGame && appId && appId > 0) {
            try {
              steamApiData = await invoke('fetch_steam_game_details', { appId });
              console.log('[GameDetail] Steam API data via Tauri:', steamApiData);
            } catch (error) {
              console.warn('Impossibile caricare dettagli Steam API:', error);
            }
          }
          
          // Determina la piattaforma
          let platform = 'Steam';
          if (isEpicGame) platform = 'Epic Games';
          else if (isGogGame) platform = 'GOG';
          else if (isOriginGame) platform = 'Origin';
          else if (urlPlatform) platform = urlPlatform;
          
          // Usa dati dalla URL o da Steam API
          const data = {
            appid: appId || 0,
            name: urlName || steamApiData?.name || decodeURIComponent(gameId),
            install_dir: urlInstallDir || null,
            is_installed: urlInstalled || false
          };
          
          // Debug: log dei dati
          console.log('[GameDetail] Platform:', platform, 'isNonSteam:', isNonSteamGame);
          console.log('[GameDetail] Steam API data:', steamApiData);
          console.log('[GameDetail] Local data:', data);
          
          // Cerca il path di installazione reale
          let realInstallPath = null;
          if (data.is_installed || urlInstallDir) {
            try {
              // Usa find_game_install_path per trovare il path reale
              realInstallPath = await invoke('find_game_install_path', { 
                installDir: data.install_dir || data.name 
              });
              console.log('[GameDetail] Found install path:', realInstallPath);
            } catch (e) {
              console.warn('[GameDetail] Could not find install path:', e);
            }
          }
          
          // Combina dati base con dettagli Steam API (o dati base per altri store)
          const enhancedGame = {
            ...data,
            ...(steamApiData || {}),
            // Mantieni campi essenziali dal backend
            lastScanned: new Date().toISOString(),
            detectedFiles: [],
            installPath: realInstallPath,
            platform: platform,
            storeId: data.appid || gameId,
            // Preserva engine dal backend (non viene da Steam API)
            engine: null,
            title: steamApiData?.name || data.name,
            description: steamApiData?.short_description?.replace(/<[^>]*>?/gm, '') || 'Nessuna descrizione disponibile.',
            detailedDescription: steamApiData?.detailed_description?.replace(/<[^>]*>?/gm, '') || null,
            aboutGame: steamApiData?.about_the_game?.replace(/<[^>]*>?/gm, '') || null,
            // Cover e header: usa Steam per giochi Steam, URL passato per altri store
            // Solo genera URL Steam se abbiamo un appId valido (> 0)
            coverUrl: isNonSteamGame 
              ? (urlHeaderImage || null)
              : (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/library_600x900.jpg` : null),
            heroUrl: isNonSteamGame 
              ? (urlHeaderImage || null)
              : (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/library_hero.jpg` : null),
            headerUrl: isNonSteamGame 
              ? (urlHeaderImage || null)
              : (steamApiData?.header_image || (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/header.jpg` : null)),
            // Descrizione breve per la trama
            shortDescription: steamApiData?.short_description || null,
            screenshots: steamApiData?.screenshots || [],
            movies: steamApiData?.movies || [],
            metacritic: steamApiData?.metacritic || null,
            achievements: steamApiData?.achievements || null,
            background: steamApiData?.background || null,
            website: steamApiData?.website || null,
            legal_notice: steamApiData?.legal_notice || null,
            recommendations: steamApiData?.recommendations || null,
            // Campi espliciti da Steam API
            developers: steamApiData?.developers || [],
            publishers: steamApiData?.publishers || [],
            release_date: steamApiData?.release_date || null,
            genres: steamApiData?.genres || [],
            categories: steamApiData?.categories || [],
            supported_languages: steamApiData?.supported_languages || null,
            pc_requirements: steamApiData?.pc_requirements || null,
            is_free: steamApiData?.is_free || false,
          };

          console.log('[GameDetail] Screenshots:', steamApiData?.screenshots?.length || 0, steamApiData?.screenshots);
          console.log('[GameDetail] ===== GAME LOADED =====', enhancedGame.title);
          setGame(enhancedGame);
          setSteamDetails(steamApiData);
          // Carica TUTTE le traduzioni da activity history (qualsiasi metodo GameStringer)
          try {
            const allActivities = await activityHistory.getRecent(100);
            const gameTranslations = allActivities
              .filter((a: any) => 
                a.activity_type === 'translation' && 
                (a.game_id === gameId || a.game_name === enhancedGame.title)
              )
              .map((a: any) => ({
                id: a.id,
                gameId: a.game_id,
                filePath: a.description || a.title,
                status: 'completed',
                confidence: 0.95,
                timestamp: a.timestamp
              }));
            setTranslations(gameTranslations);
          } catch (e) {
            console.warn('[GameDetail] Errore caricamento traduzioni:', e);
            setTranslations([]);
          }
          
          // Carica HowLongToBeat
          setIsLoadingHltb(true);
          console.log('[GameDetail] Cercando HLTB per:', enhancedGame.title);
          try {
            const hltbResult = await invoke<{found: boolean; main?: number; main_extra?: number; completionist?: number; url?: string}>('get_howlongtobeat_info', { gameName: enhancedGame.title });
            console.log('[GameDetail] HLTB risultato:', hltbResult);
            if (hltbResult) {
              setHltbData(hltbResult);
            }
          } catch (hltbErr) {
            console.error('[GameDetail] HLTB errore:', hltbErr);
          } finally {
            setIsLoadingHltb(false);
          }
          
          // Traccia visualizzazione gioco
          activityHistory.add({
            activity_type: 'game_launched',
            title: `Visualizzato: ${enhancedGame.title}`,
            game_name: enhancedGame.title,
            game_id: gameId,
          });
          
          // Carica i DLC se presenti
          if (steamApiData?.dlc && steamApiData.dlc.length > 0) {
            const dlcPromises = steamApiData.dlc.slice(0, 5).map(async (dlcId: number) => {
              try {
                const dlcDetails = await invoke('fetch_steam_game_details', { appId: dlcId });
                return dlcDetails;
              } catch (e) {
                console.error(`Errore caricamento DLC ${dlcId}:`, e);
              }
              return null;
            });
            
            const dlcResults = await Promise.all(dlcPromises);
            setDlcGames(dlcResults.filter((dlc: any) => dlc !== null));
          }
        } catch (error) {
          console.error('Errore:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchGameData();
    }
  }, [gameId]);

  // Rileva motore automaticamente quando il gioco è caricato
  useEffect(() => {
    if (game && !engineInfo && !isDetectingEngine) {
      detectEngine();
    }
    // Carica stato patch Unreal se è un gioco Unreal
    if (game?.engine === 'Unreal Engine' && game?.installPath) {
      loadUnrealPatchStatus();
    }
    // Traduci descrizione in italiano
    if (game?.shortDescription && !translatedDescription) {
      translateDescription(game.shortDescription);
    }
  }, [game]);

  // Traduce la descrizione in italiano
  const translateDescription = async (text: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ translated_text: string }>('translate_text_simple', {
        text,
        targetLang: 'it'
      });
      if (result?.translated_text) {
        setTranslatedDescription(result.translated_text);
      }
    } catch (error) {
      console.warn('Traduzione descrizione non disponibile:', error);
      // Fallback: mostra originale
    }
  };

  const scanGameFiles = async () => {
    setIsScanning(true);
    setScanProgress(0);
    
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setScanProgress(i);
    }
    
    setIsScanning(false);
    
    // Simula il discovery di nuovi file
    if (game) {
      const newFiles = [
        'localization/text_en.csv',
        'dialog/main_quest.json',
        'ui/interface_strings.txt',
        'subtitles/cutscenes.srt'
      ];
      setGame({ ...game, detectedFiles: [...game.detectedFiles, ...newFiles] });
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'steam': return 'bg-blue-500/10 text-blue-500';
      case 'epic games': return 'bg-gray-500/10 text-gray-500';
      case 'gog': return 'bg-purple-500/10 text-purple-500';
      case 'ea app': return 'bg-orange-500/10 text-orange-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento dati del gioco...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Link href="/games">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Gioco non trovato</h1>
            <p className="text-muted-foreground">Il gioco richiesto non esiste.</p>
          </div>
        </div>
      </div>
    );
  }

  // Determina colore gradiente in base al genere
  const getGenreGradient = () => {
    const genre = game?.genres?.[0]?.description?.toLowerCase() || '';
    if (genre.includes('horror') || genre.includes('survival')) {
      return {
        border: 'border-red-500/20',
        bg: 'bg-gradient-to-r from-red-950/80 via-rose-950/60 to-orange-950/80',
        blur1: 'bg-red-500/10',
        blur2: 'bg-orange-500/10',
        text: 'from-red-300 via-rose-300 to-orange-300',
        accent: 'text-red-400',
        accent2: 'text-orange-400',
        borderLine: 'border-red-500/20'
      };
    } else if (genre.includes('action') || genre.includes('shooter')) {
      return {
        border: 'border-amber-500/20',
        bg: 'bg-gradient-to-r from-amber-950/80 via-orange-950/60 to-red-950/80',
        blur1: 'bg-amber-500/10',
        blur2: 'bg-red-500/10',
        text: 'from-amber-300 via-orange-300 to-red-300',
        accent: 'text-amber-400',
        accent2: 'text-orange-400',
        borderLine: 'border-amber-500/20'
      };
    } else if (genre.includes('rpg') || genre.includes('role')) {
      return {
        border: 'border-purple-500/20',
        bg: 'bg-gradient-to-r from-purple-950/80 via-violet-950/60 to-indigo-950/80',
        blur1: 'bg-purple-500/10',
        blur2: 'bg-indigo-500/10',
        text: 'from-purple-300 via-violet-300 to-indigo-300',
        accent: 'text-purple-400',
        accent2: 'text-violet-400',
        borderLine: 'border-purple-500/20'
      };
    } else if (genre.includes('strategy') || genre.includes('simulation')) {
      return {
        border: 'border-emerald-500/20',
        bg: 'bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-cyan-950/80',
        blur1: 'bg-emerald-500/10',
        blur2: 'bg-cyan-500/10',
        text: 'from-emerald-300 via-teal-300 to-cyan-300',
        accent: 'text-emerald-400',
        accent2: 'text-teal-400',
        borderLine: 'border-emerald-500/20'
      };
    } else if (genre.includes('adventure') || genre.includes('indie')) {
      return {
        border: 'border-sky-500/20',
        bg: 'bg-gradient-to-r from-sky-950/80 via-blue-950/60 to-indigo-950/80',
        blur1: 'bg-sky-500/10',
        blur2: 'bg-indigo-500/10',
        text: 'from-sky-300 via-blue-300 to-indigo-300',
        accent: 'text-sky-400',
        accent2: 'text-blue-400',
        borderLine: 'border-sky-500/20'
      };
    } else if (genre.includes('sport') || genre.includes('racing')) {
      return {
        border: 'border-green-500/20',
        bg: 'bg-gradient-to-r from-green-950/80 via-lime-950/60 to-emerald-950/80',
        blur1: 'bg-green-500/10',
        blur2: 'bg-lime-500/10',
        text: 'from-green-300 via-lime-300 to-emerald-300',
        accent: 'text-green-400',
        accent2: 'text-lime-400',
        borderLine: 'border-green-500/20'
      };
    }
    // Default: blu neutro
    return {
      border: 'border-slate-500/20',
      bg: 'bg-gradient-to-r from-slate-950/80 via-gray-950/60 to-zinc-950/80',
      blur1: 'bg-slate-500/10',
      blur2: 'bg-zinc-500/10',
      text: 'from-slate-300 via-gray-300 to-zinc-300',
      accent: 'text-slate-400',
      accent2: 'text-gray-400',
      borderLine: 'border-slate-500/20'
    };
  };

  const colors = getGenreGradient();

  return (
    <div className="min-h-screen">
      <div className="relative p-4 space-y-4">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-2xl ${colors.border} ${colors.bg}`}
        >
          {/* Background Image Overlay - Effetto fusione migliorato */}
          {(game.heroUrl || game.headerUrl || game.coverUrl) && (
            <>
              <img 
                src={game.heroUrl || game.headerUrl || game.coverUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[2px]"
              />
              <div className={`absolute inset-0 ${colors.bg} opacity-50`} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
            </>
          )}
          <div className={`absolute top-0 right-0 w-64 h-64 ${colors.blur1} rounded-full blur-3xl`} />
          <div className={`absolute bottom-0 left-0 w-48 h-48 ${colors.blur2} rounded-full blur-3xl`} />
          <div className="absolute inset-0 backdrop-blur-[1px]" />
          
          <div className="relative p-6">
            {/* Top Row: Back button + Title */}
            <div className="flex items-start gap-4">
              <Link href="/library">
                <Button variant="outline" size="icon" className="h-10 w-10 bg-black/30 backdrop-blur-sm border-white/20 hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className={`text-2xl font-bold bg-gradient-to-r ${colors.text} bg-clip-text text-transparent`}>
                    {game.title}
                  </h1>
                  {/* Engine Badge */}
                  {(engineInfo || game.engine) && (
                    <Badge 
                      className={`text-xs px-2 py-0.5 ${
                        (engineInfo?.engine || game.engine) === 'Unity' ? 'bg-blue-600/80 text-white border-blue-400' :
                        (engineInfo?.engine || game.engine) === 'Unreal Engine' ? 'bg-orange-600/80 text-white border-orange-400' :
                        (engineInfo?.engine || game.engine) === 'RPG Maker' ? 'bg-green-600/80 text-white border-green-400' :
                        (engineInfo?.engine || game.engine) === "Ren'Py" ? 'bg-pink-600/80 text-white border-pink-400' :
                        (engineInfo?.engine || game.engine) === 'Godot' ? 'bg-cyan-600/80 text-white border-cyan-400' :
                        (engineInfo?.engine || game.engine) === 'GameMaker' ? 'bg-yellow-600/80 text-white border-yellow-400' :
                        'bg-gray-600/80 text-white border-gray-400'
                      }`}
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      {engineInfo?.engine || game.engine}
                      {engineInfo?.can_patch && (
                        <Sparkles className="h-3 w-3 ml-1 text-yellow-300" />
                      )}
                    </Badge>
                  )}
                  {isDetectingEngine && (
                    <Badge variant="outline" className="animate-pulse text-xs border-indigo-500/30">
                      <Settings className="h-3 w-3 mr-1 animate-spin" />
                      Rilevamento...
                    </Badge>
                  )}
                </div>
                {game.developers && (
                  <p className="text-sm text-white/60 mt-1">
                    di {game.developers.join(', ')}
                  </p>
                )}
                {/* Descrizione/Trama breve - in italiano */}
                {(translatedDescription || game.shortDescription) && (
                  <p className="text-xs text-white/50 mt-2 line-clamp-2 max-w-2xl">
                    {translatedDescription || game.shortDescription}
                  </p>
                )}
              </div>
              
              {/* Metacritic Score */}
              {game.metacritic && (
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg ${
                  game.metacritic.score >= 80 ? 'bg-green-600 shadow-green-500/30' : 
                  game.metacritic.score >= 60 ? 'bg-yellow-600 shadow-yellow-500/30' : 'bg-red-600 shadow-red-500/30'
                }`}>
                  {game.metacritic.score}
                </div>
              )}
            </div>
            
            {/* Stats Row */}
            <div className={`flex flex-wrap gap-6 mt-4 pt-4 border-t ${colors.borderLine}`}>
              {/* Platform */}
              <div className="text-center">
                <div className={`flex items-center justify-center gap-1 ${colors.accent}`}>
                  <Monitor className="h-4 w-4" />
                  <span className="text-sm font-semibold">{game.platform}</span>
                </div>
                <p className="text-xs text-white/50">Piattaforma</p>
              </div>
              
              {/* Install Status */}
              <div className="text-center">
                <div className={`flex items-center justify-center gap-1 ${game.is_installed ? 'text-emerald-400' : 'text-gray-400'}`}>
                  <HardDrive className="h-4 w-4" />
                  <span className="text-sm font-semibold">{game.is_installed ? 'Installato' : 'Non installato'}</span>
                </div>
                <p className="text-xs text-white/50">Stato</p>
              </div>
              
              {/* Release Date */}
              {game.release_date?.date && (
                <div className="text-center">
                  <div className={`flex items-center justify-center gap-1 ${colors.accent2}`}>
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-semibold">{game.release_date.date}</span>
                  </div>
                  <p className="text-xs text-white/50">Uscita</p>
                </div>
              )}
              
              {/* Genres */}
              {game.genres && game.genres.length > 0 && (
                <div className="text-center">
                  <div className={`flex items-center justify-center gap-1 ${colors.accent}`}>
                    <Zap className="h-4 w-4" />
                    <span className="text-sm font-semibold">{game.genres.slice(0, 2).map((g: any) => g.description).join(', ')}</span>
                  </div>
                  <p className="text-xs text-white/50">Genere</p>
                </div>
              )}
              
              {/* Translations Count */}
              {translations.length > 0 && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-amber-400">
                    <Languages className="h-4 w-4" />
                    <span className="text-sm font-semibold">{translations.length}</span>
                  </div>
                  <p className="text-xs text-white/50">Traduzioni</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

      {/* Game Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Cover and Actions */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <Card className="bg-black/20 backdrop-blur-xl border-white/10">
            <CardContent className="p-3">
              {/* Mini Screenshot Gallery */}
              {game.screenshots && game.screenshots.length > 0 ? (
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/50 uppercase tracking-wider">📸 Screenshots</span>
                    <span className="text-[10px] text-white/30">{game.screenshots.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {game.screenshots.slice(0, 4).map((screenshot: any, idx: number) => (
                      <div 
                        key={idx}
                        className="relative aspect-video rounded overflow-hidden cursor-pointer group"
                        onClick={() => setSelectedScreenshotIndex(idx)}
                      >
                        <img 
                          src={screenshot.path_thumbnail || screenshot.path_full}
                          alt={`Screenshot ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        {idx === 3 && game.screenshots.length > 4 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">+{game.screenshots.length - 4}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="relative aspect-video rounded-lg overflow-hidden mb-3 bg-gradient-to-br from-purple-900/30 to-blue-900/30 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-3xl mb-1 block">{game.is_vr ? '🥽' : '🎮'}</span>
                    <span className="text-[10px] text-white/40">No screenshots</span>
                  </div>
                </div>
              )}
              
              {/* Game Info Section */}
              <div className="space-y-3">
                {/* Badges */}
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge className={`text-xs ${getPlatformColor(game.platform)}`}>
                    {game.platform}
                  </Badge>
                  <Badge variant={game.is_installed ? "default" : "secondary"} className="text-xs">
                    {game.is_installed ? '✓ Installato' : '✗ Non installato'}
                  </Badge>
                  {game.is_free && (
                    <Badge className="text-xs bg-green-600">🎁 Free</Badge>
                  )}
                </div>

                {/* Quick Info */}
                <div className="space-y-1.5 text-[11px]">
                  {game.developers && game.developers.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-white/40 min-w-[70px]">Sviluppatore</span>
                      <span className="text-white/80">{game.developers.join(', ')}</span>
                    </div>
                  )}
                  {game.publishers && game.publishers.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-white/40 min-w-[70px]">Publisher</span>
                      <span className="text-white/80">{game.publishers.join(', ')}</span>
                    </div>
                  )}
                  {game.release_date?.date && (
                    <div className="flex items-start gap-2">
                      <span className="text-white/40 min-w-[70px]">Uscita</span>
                      <span className="text-white/80">{game.release_date.date}</span>
                    </div>
                  )}
                  {game.genres && game.genres.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-white/40 min-w-[70px]">Generi</span>
                      <div className="flex flex-wrap gap-1">
                        {game.genres.slice(0, 3).map((g: any, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/70">
                            {g.description || g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Short Description */}
                {(translatedDescription || game.shortDescription) && (
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-[11px] text-white/60 leading-relaxed line-clamp-4">
                      {translatedDescription || game.shortDescription}
                    </p>
                  </div>
                )}
                
                {/* HowLongToBeat */}
                {isLoadingHltb && (
                  <div className="text-xs text-muted-foreground animate-pulse">⏱️ Caricamento tempo...</div>
                )}
                {!hltbData && !isLoadingHltb && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full h-7 text-xs"
                    onClick={async () => {
                      setIsLoadingHltb(true);
                      try {
                        const { invoke } = await import('@tauri-apps/api/core');
                        console.log('[HLTB Test] Chiamata per:', game?.title);
                        const result = await invoke<any>('get_howlongtobeat_info', { gameName: game?.title || '' });
                        console.log('[HLTB Test] Risultato:', result);
                        setHltbData(result);
                      } catch (e) {
                        console.error('[HLTB Test] Errore:', e);
                      } finally {
                        setIsLoadingHltb(false);
                      }
                    }}
                  >
                    ⏱️ Carica tempo di gioco
                  </Button>
                )}
                {hltbData?.found && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 space-y-1">
                    <div className="text-xs font-medium text-amber-400 flex items-center gap-1">
                      ⏱️ HowLongToBeat
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      {hltbData.main && hltbData.main > 0 && (
                        <div className="text-center">
                          <div className="font-bold text-white">{hltbData.main}h</div>
                          <div className="text-muted-foreground">Main</div>
                        </div>
                      )}
                      {hltbData.main_extra && hltbData.main_extra > 0 && (
                        <div className="text-center">
                          <div className="font-bold text-white">{hltbData.main_extra}h</div>
                          <div className="text-muted-foreground">+ Extra</div>
                        </div>
                      )}
                      {hltbData.completionist && hltbData.completionist > 0 && (
                        <div className="text-center">
                          <div className="font-bold text-white">{hltbData.completionist}h</div>
                          <div className="text-muted-foreground">100%</div>
                        </div>
                      )}
                    </div>
                    {hltbData.url && (
                      <a href={hltbData.url} target="_blank" rel="noopener" className="text-[10px] text-amber-400 hover:underline">
                        Vedi su HLTB →
                      </a>
                    )}
                  </div>
                )}
                
                {game.is_installed && (
                  <div className="space-y-1.5">
                    <Button className="w-full h-8 text-xs" onClick={() => setShowTranslation(true)}>
                      <Languages className="h-3 w-3 mr-1" />
                      Traduci
                    </Button>
                    <Button variant="outline" className="w-full h-8 text-xs" onClick={scanGameFiles} disabled={isScanning} title="Cerca file di localizzazione (JSON, TXT, CSV, INI, PO)">
                      <FileText className="h-3 w-3 mr-1" />
                      {isScanning ? '...' : 'Scansiona File'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Raccomandazione Traduzione - mostra anche se installPath non trovato */}
          {(game.is_installed || game.installPath) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <TranslationRecommendation 
                gamePath={game.installPath || ''} 
                gameName={game.title || game.name || ''} 
                onActionClick={async (route) => {
                  console.log('[GameDetail] onActionClick route:', route);
                  if (route === 'action:launch_game') {
                    // Avvia gioco
                    if (game.appid && game.appid > 0) {
                      // Avvia tramite Steam
                      const steamUrl = `steam://rungameid/${game.appid}`;
                      console.log('[GameDetail] Avvio gioco Steam:', steamUrl);
                      
                      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
                        try {
                          const { invoke } = await import('@tauri-apps/api/core');
                          const result = await invoke('launch_steam_game', { appId: game.appid.toString() });
                          console.log('[GameDetail] Risultato avvio:', result);
                        } catch (e) {
                          console.error('[GameDetail] Errore Tauri, uso fallback:', e);
                          window.location.href = steamUrl;
                        }
                      } else {
                        window.location.href = steamUrl;
                      }
                    } else if (game.installPath) {
                      // Avvia direttamente l'eseguibile
                      console.log('[GameDetail] Avvio diretto eseguibile...');
                      try {
                        const { invoke } = await import('@tauri-apps/api/core');
                        const exeList = await invoke<string[]>('find_executables_in_folder', { folderPath: game.installPath });
                        if (exeList && exeList.length > 0) {
                          const exePath = `${game.installPath}\\${exeList[0]}`;
                          console.log('[GameDetail] Avvio:', exePath);
                          await invoke('launch_game_direct', { executablePath: exePath });
                        } else {
                          console.error('[GameDetail] Nessun eseguibile trovato');
                        }
                      } catch (e) {
                        console.error('[GameDetail] Errore avvio diretto:', e);
                      }
                    }
                  } else if (route === '/unity-patcher') {
                    // Installa patch direttamente
                    console.log('[GameDetail] Installazione XUnity patch...');
                    handleInstallUnityPatch();
                  } else {
                    // Naviga alla route
                    router.push(route);
                  }
                }}
              />
            </motion.div>
          )}
        </motion.div>

        {/* Game Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-4 space-y-3"
        >
          {/* Screenshots Gallery - compatti */}
          {game.screenshots && game.screenshots.length > 0 ? (
            <div className="space-y-1.5">
              <h3 className="text-xs font-medium text-gray-400">Screenshot ({game.screenshots.length})</h3>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
                {game.screenshots.slice(0, 12).map((screenshot: any, index: number) => (
                  <div 
                    key={index} 
                    className="relative aspect-video bg-slate-800 rounded overflow-hidden cursor-pointer hover:ring-1 ring-purple-500 transition-all hover:scale-105"
                    onClick={() => setSelectedScreenshotIndex(index)}
                  >
                    <img 
                      src={screenshot.path_thumbnail || screenshot.path_full} 
                      alt={`Screenshot ${index + 1}`} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-gray-500 text-xs">
              Nessuno screenshot disponibile
            </div>
          )}
          
          {/* Info compatte */}
          <Card className="bg-gray-900/60 backdrop-blur border-gray-700/50">
            <CardContent className="p-4 space-y-3">
              {/* Info in una riga */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-400"><Settings className="h-3 w-3 inline mr-1" />{game.engine || 'Engine N/D'}</span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400"><HardDrive className="h-3 w-3 inline mr-1" />{game.detectedFiles.length} file</span>
                {game.release_date && (<><span className="text-gray-600">•</span><span className="text-gray-400"><Calendar className="h-3 w-3 inline mr-1" />{game.release_date.date}</span></>)}
                {game.installPath && (<><span className="text-gray-600">•</span><span className="text-gray-400 truncate max-w-[200px]"><Folder className="h-3 w-3 inline mr-1" />{game.installPath}</span></>)}
                {/* HLTB inline */}
                {hltbData?.found && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className="text-amber-400">⏱️ {hltbData.main}h Main</span>
                    {hltbData.main_extra && hltbData.main_extra > 0 && <span className="text-amber-300">| {hltbData.main_extra}h Extra</span>}
                  </>
                )}
                {!hltbData && !isLoadingHltb && (
                  <>
                    <span className="text-gray-600">•</span>
                    <button 
                      className="text-amber-400 hover:text-amber-300 underline"
                      onClick={async () => {
                        setIsLoadingHltb(true);
                        try {
                          const { invoke } = await import('@tauri-apps/api/core');
                          const result = await invoke<any>('get_howlongtobeat_info', { gameName: game?.title || '' });
                          console.log('[HLTB] Risultato:', result);
                          setHltbData(result);
                        } catch (e) {
                          console.error('[HLTB] Errore:', e);
                        } finally {
                          setIsLoadingHltb(false);
                        }
                      }}
                    >
                      ⏱️ Tempo gioco?
                    </button>
                  </>
                )}
                {isLoadingHltb && <span className="text-amber-400 animate-pulse">⏱️ ...</span>}
              </div>
              
              {/* Lingue */}
              {game.supported_languages && (
                <div className="flex items-center gap-2">
                  <Languages className="h-3 w-3 text-cyan-400" />
                  <LanguageFlags supportedLanguages={game.supported_languages.replace(/<[^>]*>?/gm, '')} maxFlags={10} />
                </div>
              )}
              
              {/* Generi compatti */}
              {game.genres && game.genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {game.genres.slice(0, 5).map((genre: any) => (
                    <Badge key={genre.id} className="text-[10px] px-1.5 py-0 bg-purple-600/30 text-purple-300">
                      {genre.description}
                    </Badge>
                  ))}
                </div>
              )}
              
              {isScanning && (
                <div className="flex items-center gap-2">
                  <Progress value={scanProgress} className="h-1 flex-1" />
                  <span className="text-xs text-purple-400">{scanProgress}%</span>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* DLC compatti */}
          {dlcGames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-gray-500">DLC:</span>
              {dlcGames.slice(0, 5).map((dlc) => (
                <Badge key={dlc.steam_appid} variant="outline" className="text-[10px]">{dlc.name}</Badge>
              ))}
              {dlcGames.length > 5 && <Badge variant="outline" className="text-[10px]">+{dlcGames.length - 5}</Badge>}
            </div>
          )}
        </motion.div>
      </div>

      {/* Tabs Content */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Tabs defaultValue="files" className="space-y-2">
          <TabsList className="h-8 bg-black/20 border-white/10">
            <TabsTrigger value="files" className="text-xs h-7 data-[state=active]:bg-white/20">File</TabsTrigger>
            <TabsTrigger value="translations" className="text-xs h-7 data-[state=active]:bg-white/20">Traduzioni</TabsTrigger>
            <TabsTrigger value="patches" className="text-xs h-7 data-[state=active]:bg-white/20">Patch</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-2">
            <Card className="bg-black/20 border-white/10">
              <CardContent className="p-3">
                {game.detectedFiles.length > 0 ? (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-400">{game.detectedFiles.length} file trovati</span>
                      <Button size="sm" className="h-7 text-xs bg-purple-600" onClick={() => router.push(`/translator?gameId=${gameId}&gameName=${encodeURIComponent(game.title || '')}&installPath=${encodeURIComponent(game.installPath || '')}&gameImage=${encodeURIComponent(game.headerUrl || '')}`)}>
                        <Sparkles className="h-3 w-3 mr-1" />Neural Translator
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {game.detectedFiles.map((file: string, index: number) => (
                        <div key={index} className="flex items-center justify-between p-1.5 bg-muted/30 rounded text-xs hover:bg-muted/50">
                          <span className="truncate flex-1"><FileText className="h-3 w-3 inline mr-1" />{file}</span>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => router.push(`/translator?gameId=${gameId}&file=${encodeURIComponent(file)}`)}>
                            Traduci
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-400 mb-2">Nessun file rilevato</p>
                    <p className="text-[10px] text-gray-500 mb-3">Cerca file di testo traducibili nella cartella del gioco (JSON, TXT, CSV, INI, PO)</p>
                    <Button size="sm" className="h-7 text-xs" onClick={scanGameFiles} disabled={isScanning} title="Cerca file di localizzazione nella cartella del gioco">
                      <FileText className="h-3 w-3 mr-1" />Scansiona
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="translations" className="space-y-2">
            <Card className="bg-black/20 border-white/10">
              <CardContent className="p-3">
                {translations.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {translations.map((translation) => (
                      <div key={translation.id} className="flex items-center justify-between p-1.5 bg-muted/30 rounded text-xs">
                        <span className="truncate flex-1">{translation.filePath}</span>
                        <Badge variant="outline" className="text-[10px] mx-1">{translation.status}</Badge>
                        <span className="text-gray-500">{Math.round((translation.confidence || 0) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-400 mb-2">Nessuna traduzione attiva</p>
                    <Link href={`/translator?gameId=${game.id}&gameName=${encodeURIComponent(game.title || '')}&installPath=${encodeURIComponent(game.installPath || '')}&gameImage=${encodeURIComponent(game.headerUrl || '')}`}>
                      <Button size="sm" className="h-7 text-xs"><Languages className="h-3 w-3 mr-1" />Traduci</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patches" className="space-y-2">
            <Card className="bg-black/20 border-white/10">
              <CardContent className="p-3 space-y-2">
                {/* UNITY */}
                {game.engine === 'Unity' && (
                  <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded">
                    <span className="text-xs text-blue-100"><Zap className="h-3 w-3 inline mr-1" />Unity AutoTranslator</span>
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-[10px] bg-blue-600" onClick={handleInstallUnityPatch} disabled={isInstallingPatch || !game.is_installed}>
                        {isInstallingPatch ? '...' : 'Installa'}
                      </Button>
                      <Button size="sm" variant="destructive" className="h-6 text-[10px]" onClick={handleUninstallUnityPatch} disabled={isInstallingPatch || !game.is_installed}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {/* UNREAL */}
                {game.engine === 'Unreal Engine' && (
                  <div className="flex items-center justify-between p-2 bg-orange-500/10 rounded">
                    <span className="text-xs text-orange-100"><Zap className="h-3 w-3 inline mr-1" />Unreal Translator</span>
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-[10px] bg-orange-600" onClick={handleInstallUnrealPatch} disabled={isInstallingPatch || !game.is_installed}>
                        {isInstallingPatch ? '...' : 'Installa'}
                      </Button>
                      <Button size="sm" variant="destructive" className="h-6 text-[10px]" onClick={handleUninstallUnrealPatch} disabled={isInstallingPatch || !game.is_installed}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {/* RPG MAKER */}
                {game.engine === 'RPG Maker' && (
                  <div className="p-2 bg-green-500/10 rounded text-xs text-green-100">
                    <Zap className="h-3 w-3 inline mr-1" />RPG Maker - Scansiona file JSON in www/data
                  </div>
                )}
                {/* REN'PY */}
                {game.engine === "Ren'Py" && (
                  <div className="p-2 bg-pink-500/10 rounded text-xs text-pink-100">
                    <Zap className="h-3 w-3 inline mr-1" />Ren'Py - Traduzioni in game/tl
                  </div>
                )}
                {/* UNKNOWN */}
                {(!game.engine || game.engine === 'Unknown') && (
                  <div className="p-2 bg-gray-500/10 rounded text-xs text-gray-300">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />Engine non riconosciuto - Scansiona i file
                  </div>
                )}
                {/* Status */}
                {patchStatus && (
                  <div className={`p-2 rounded text-xs ${patchStatus.success ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'}`}>
                    {patchStatus.message}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
      
      {/* Inline Translator Modal */}
      {showTranslation && game && (
        <InlineTranslator
          gameId={game.appid.toString()}
          gameName={game.name}
          gamePath={game.installPath}
          onClose={() => setShowTranslation(false)}
        />
      )}

      {/* Screenshot Lightbox - renderizzato nel body via portal */}
      {selectedScreenshotIndex !== null && game?.screenshots && typeof document !== 'undefined' && createPortal(
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center"
          onClick={() => setSelectedScreenshotIndex(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSelectedScreenshotIndex(null);
            if (e.key === 'ArrowRight' && selectedScreenshotIndex < game.screenshots.length - 1) {
              setSelectedScreenshotIndex(selectedScreenshotIndex + 1);
            }
            if (e.key === 'ArrowLeft' && selectedScreenshotIndex > 0) {
              setSelectedScreenshotIndex(selectedScreenshotIndex - 1);
            }
          }}
          tabIndex={0}
          ref={(el) => el?.focus()}
        >
          {/* Container con immagine e controlli */}
          <motion.div
            key={selectedScreenshotIndex}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Immagine con controlli attaccati */}
            <div className="relative">
              <img
                src={game.screenshots[selectedScreenshotIndex]?.path_full || game.screenshots[selectedScreenshotIndex]?.path_thumbnail}
                alt={`Screenshot ${selectedScreenshotIndex + 1}`}
                className="max-w-[85vw] max-h-[75vh] object-contain rounded-lg shadow-xl"
              />
              
              {/* X chiudi - angolo alto destra della foto */}
              <button 
                className="absolute -top-2 -right-2 w-7 h-7 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-lg"
                onClick={() => setSelectedScreenshotIndex(null)}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Freccia sinistra - bordo sinistro della foto */}
              {selectedScreenshotIndex > 0 && (
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 flex items-center justify-center text-slate-300 hover:text-white transition-all"
                  onClick={(e) => { e.stopPropagation(); setSelectedScreenshotIndex(selectedScreenshotIndex - 1); }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              
              {/* Freccia destra - bordo destro della foto */}
              {selectedScreenshotIndex < game.screenshots.length - 1 && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 flex items-center justify-center text-slate-300 hover:text-white transition-all"
                  onClick={(e) => { e.stopPropagation(); setSelectedScreenshotIndex(selectedScreenshotIndex + 1); }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Thumbnails sotto */}
            <div className="flex items-center gap-1.5 mt-3">
              {game.screenshots.slice(0, 10).map((screenshot: any, index: number) => (
                <button
                  key={index}
                  className={`w-12 h-7 rounded overflow-hidden transition-all border ${
                    index === selectedScreenshotIndex 
                      ? 'border-purple-500 scale-105' 
                      : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                  onClick={(e) => { e.stopPropagation(); setSelectedScreenshotIndex(index); }}
                >
                  <img src={screenshot.path_thumbnail} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <div className="text-slate-500 text-xs mt-1.5">
              {selectedScreenshotIndex + 1} / {game.screenshots.length}
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}
      </div>
    </div>
  );
}
