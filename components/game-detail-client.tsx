
'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Gamepad2, Settings, Download, Search, CheckCircle, AlertTriangle, Play, Loader2,
  FolderOpen, Settings2, Trash2, ArrowLeft, Languages, Info, Folder, Sparkles, Monitor, Edit3, Image as ImageIcon, HardDrive, HardDriveDownload, FileText, Cpu, Map, Zap, Globe
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { mockGames } from '@/lib/mock-data';
import InlineTranslator from '@/components/inline-translator';
import { LanguageFlags } from '@/components/ui/language-flags';
import { activityHistory } from '@/lib/activity-history';
import { TranslationRecommendation } from '@/components/translation-recommendation';
import { useTranslation } from '@/lib/i18n';
import { CoverPicker } from '@/components/cover-picker';
import { HltbStats } from '@/components/hltb-stats';

import AudioPatcher from '@/components/audio-patcher';

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, language } = useTranslation();
  
  // Read gameId from path params (dev) or query params (Tauri static export)
  const [gameId, setGameId] = useState<string>(() => {
    const pathId = params.id as string;
    if (pathId) return pathId;
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('id') || '';
    }
    return '';
  });
  
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
    source?: string | null;
    tips?: string[] | null;
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
  
  // SteamGridDB fallback image
  const [fallbackImage, setFallbackImage] = useState<string | null>(null);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  
  // Ref guards per StrictMode
  const gameDataLoadedRef = useRef(false);
  const sideEffectsRunRef = useRef<string | null>(null);

  // Unreal Engine Patcher
  const [unrealPatchStatus, setUnrealPatchStatus] = useState<{
    installed: boolean;
    version: string;
    target_language: string;
    translations_count: number;
    last_used: string | null;
  } | null>(null);

  // Client-side engine detection fallback (nome gioco → engine)
  const detectEngineByName = (name: string): string | null => {
    const n = name.toLowerCase();
    const db: [string[], string][] = [
      // FromSoftware (prima per evitare falsi positivi)
      [['elden ring','dark souls','sekiro','bloodborne','armored core vi','armored core 6',"demon's souls"], 'FromSoftware Engine'],
      [['nier automata','nier replicant','bayonetta','metal gear rising','astral chain','vanquish'], 'Platinum Engine'],
      [['grand theft auto','gta v','gta iv','red dead redemption','max payne 3'], 'RAGE Engine'],
      [['call of duty','warzone','modern warfare','black ops','vanguard'], 'IW Engine'],
      [['hitman','world of assassination'], 'Glacier Engine'],
      [['dying light','dead island','call of juarez'], 'C-Engine (Techland)'],
      [['final fantasy xv','forspoken'], 'Luminous Engine'],
      [['dishonored 2','deathloop'], 'Void Engine'],
      [['resident evil village','resident evil 4 remake','resident evil 2 remake','devil may cry 5','monster hunter rise','monster hunter wilds','street fighter 6'], 'RE Engine'],
      [['resident evil 5','resident evil 6',"dragon's dogma",'monster hunter world','devil may cry 4'], 'MT Framework'],
      [["assassin's creed",'watch dogs','for honor','prince of persia'], 'Anvil Engine'],
      [['horizon zero dawn','horizon forbidden west','death stranding'], 'Decima'],
      [['metal gear solid v','pro evolution soccer'], 'FOX Engine'],
      [['the division','mario + rabbids','star wars outlaws'], 'Snowdrop'],
      // Grandi engine
      [['hollow knight','cuphead','subnautica','valheim','among us','fall guys','phasmophobia','lethal company','rimworld','slay the spire','cult of the lamb','vampire survivors','beat saber','escape from tarkov','cities skylines','kerbal space program','ori and','7 days to die','outer wilds','inscryption','balatro','ultrakill','ghostrunner','dredge','dave the diver','tarkov','genshin impact','dead cells','enter the gungeon','risk of rain','spiritfarer','tunic','unpacking'], 'Unity'],
      [['fortnite','borderlands','bioshock','rocket league','dead by daylight','ark survival','pubg','deep rock galactic','hogwarts legacy','black myth wukong','lies of p','satisfactory','stray','sifu','valorant','ready or not','the finals','palworld','tekken','guilty gear strive','final fantasy vii remake','tales of arise','kingdom hearts 3','outlast','sons of the forest'], 'Unreal Engine'],
      [['half-life: alyx','dota 2','counter-strike 2','deadlock'], 'Source 2'],
      [['half-life 2','counter-strike','portal','team fortress 2','left 4 dead',"garry's mod",'the stanley parable','apex legends'], 'Source Engine'],
      [['fallout 4','fallout 76','skyrim','starfield'], 'Creation Engine'],
      [['battlefield','need for speed','fifa','ea sports fc','star wars battlefront','dead space remake','dragon age'], 'Frostbite'],
      [['crysis','hunt showdown','kingdom come deliverance','star citizen'], 'CryEngine'],
      [['cyberpunk 2077','witcher 3'], 'REDengine'],
      [['doom','quake','wolfenstein','evil within'], 'id Tech'],
      [['celeste','stardew valley','terraria','hades','bastion','transistor','fez'], 'MonoGame/FNA'],
      [['undertale','deltarune','hyper light drifter','hotline miami','katana zero','decarnation'], 'GameMaker'],
      [['omori','to the moon','oneshot','corpse party','yume nikki','lisa the painful'], 'RPG Maker'],
      [['doki doki literature club','ddlc','va-11 hall-a','katawa shoujo'], "Ren'Py"],
      [['cassette beasts','brotato','dome keeper'], 'Godot'],
      [['metro exodus','metro last light','metro 2033'], '4A Engine'],
    ];
    for (const [names, engine] of db) {
      if (names.some(g => n.includes(g))) return engine;
    }
    return null;
  };

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
      setGame((prev: any) => prev ? { ...prev, engine: result.engine } : null);
    } catch (error) {
      // Fallback client-side: detection per nome
      const gameName = game.name || game.title;
      const fallbackEngine = detectEngineByName(gameName);
      if (fallbackEngine) {
        setEngineInfo({
          engine: fallbackEngine,
          can_patch: false,
          patch_tool: null,
          patch_description: null,
        });
        setGame((prev: any) => prev ? { ...prev, engine: fallbackEngine } : null);
      }
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
      if (gameDataLoadedRef.current) return;
      gameDataLoadedRef.current = true;
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
          
          // Estrai appId: può essere numerico, "steam_family_XXXX", "steam_shared_XXXX", o passato via URL
          let appId: number | null = null;
          if (!isNonSteamGame) {
            if (urlAppId && !isNaN(parseInt(urlAppId))) {
              appId = parseInt(urlAppId);
              console.log('[GameDetail] AppId from URL param:', appId);
            } else if (gameId.startsWith('steam_shared_')) {
              appId = parseInt(gameId.replace('steam_shared_', ''));
              console.log('[GameDetail] AppId from steam_shared_:', appId);
            } else if (gameId.startsWith('steam_family_')) {
              appId = parseInt(gameId.replace('steam_family_', ''));
              console.log('[GameDetail] AppId from steam_family_:', appId);
            } else if (gameId.startsWith('steam_')) {
              appId = parseInt(gameId.replace('steam_', ''));
              console.log('[GameDetail] AppId from steam_:', appId);
            } else {
              const parsed = parseInt(gameId);
              if (!isNaN(parsed)) {
                appId = parsed;
                console.log('[GameDetail] AppId from direct parse:', appId);
              }
            }
            
            // Fallback: cerca appId dal path del gioco usando il manifest Steam
            if (!appId && urlInstallDir) {
              try {
                const foundAppId = await invoke<number | null>('get_appid_from_install_path', { 
                  installPath: urlInstallDir 
                });
                if (foundAppId && foundAppId > 0) {
                  appId = foundAppId;
                  console.log('[GameDetail] AppId from install path manifest:', appId);
                }
              } catch (e) {
                console.warn('[GameDetail] Could not get appId from manifest:', e);
              }
            }
          }
          console.log('[GameDetail] Final appId:', appId, 'gameId:', gameId);
          
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
          let realInstallPath: string | null = null;
          
          // Metodo 1: Cerca tramite install_dir passato dalla URL
          if (data.is_installed || urlInstallDir) {
            try {
              realInstallPath = await invoke('find_game_install_path', { 
                installDir: data.install_dir || data.name 
              });
              console.log('[GameDetail] Found install path via installDir:', realInstallPath);
            } catch (e) {
              // Silenzioso - fallback a appId
            }
          }
          
          // Metodo 2: Se non trovato, cerca tramite appId (per giochi Steam)
          if (!realInstallPath && appId && appId > 0) {
            try {
              realInstallPath = await invoke('find_game_path_by_appid', { appId });
              console.log('[GameDetail] Found install path via appId:', realInstallPath);
            } catch (e) {
              console.warn('[GameDetail] Could not find install path via appId:', e);
            }
          }
          
          // Rileva engine automaticamente se il gioco è installato
          let detectedEngine: string | null = null;
          if (realInstallPath) {
            try {
              const engineResult = await invoke('detect_engine_for_game', { 
                gameName: data.name || 'Unknown',
                installPath: realInstallPath 
              });
              if (engineResult && typeof engineResult === 'object') {
                detectedEngine = (engineResult as any).engine || null;
                console.log('[GameDetail] Engine rilevato:', detectedEngine);
              }
            } catch (e) {
              console.warn('[GameDetail] Engine detection failed:', e);
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
            // Usa engine rilevato automaticamente
            engine: detectedEngine,
            title: steamApiData?.name || data.name,
            description: steamApiData?.short_description?.replace(/<[^>]*>?/gm, '') || (isNonSteamGame ? null : 'Nessuna descrizione disponibile.'),
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
          
          // Salva ultimo gioco visitato su GameStringer (per dashboard)
          try {
            localStorage.setItem('gs_last_visited_game', JSON.stringify({
              id: gameId,
              title: enhancedGame.title || enhancedGame.name,
              image: enhancedGame.headerUrl || enhancedGame.coverUrl || null,
              platform: enhancedGame.platform || 'Steam',
              appId: String(enhancedGame.appid || ''),
              installPath: enhancedGame.installPath || null,
              visitedAt: Date.now(),
            }));
          } catch {}

          
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
    if (!game) return;
    // Guard per side effects pesanti (fetch API) - esegui solo una volta per game ID
    const gameKey = game.id || (game.appid ? String(game.appid) : null) || gameId;
    const isFirstRun = sideEffectsRunRef.current !== gameKey;
    
    if (isFirstRun) {
      sideEffectsRunRef.current = gameKey;
      
      if (!engineInfo && !isDetectingEngine) {
        detectEngine();
      }
      if (game.engine === 'Unreal Engine' && game.installPath) {
        loadUnrealPatchStatus();
      }
      // Cerca descrizione da Steam API se mancante
      if (!game.shortDescription && !game.description && game.appid && game.appid > 0) {
        fetchDescriptionFromSteam();
      }
      // Cerca descrizione da GOG API se mancante e gioco è GOG
      if (!game.shortDescription && !game.description && (game.platform === 'GOG' || game.source === 'GOG' || game.storeId?.toString().startsWith('gog_') || gameId.startsWith('gog_'))) {
        fetchDescriptionFromGog();
      }
      // Cerca immagine su SteamGridDB se non c'è header
      if (!game.headerUrl && !fallbackImage) {
        fetchFallbackImage();
      }
    }
    // Traduci descrizione nella lingua utente (ritraduce quando cambia lingua)
    if (game.shortDescription) {
      setTranslatedDescription(null);
      translateDescription(game.shortDescription);
    }
  }, [game, language]);

  // Cerca descrizione da Steam Store API
  const fetchDescriptionFromSteam = async () => {
    if (!game?.appid) return;
    try {
      const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.appid}&l=italian`);
      const data = await response.json();
      if (data[game.appid]?.success && data[game.appid]?.data?.short_description) {
        const desc = data[game.appid].data.short_description.replace(/<[^>]*>?/gm, '');
        setGame((prev: any) => prev ? { ...prev, shortDescription: desc, description: desc } : null);
        setTranslatedDescription(desc);
      }
    } catch (e) {
      console.warn('[GameDetail] Steam description fetch failed:', e);
    }
  };

  // Cerca descrizione da GOG API
  const fetchDescriptionFromGog = async () => {
    if (!game) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Estrai ID numerico GOG dal gameId URL (es: "gog_1803553877" -> "1803553877")
      // NON usare game.appid perché è 0 per giochi GOG
      const gogId = gameId.startsWith('gog_') ? gameId.replace('gog_', '') 
        : (game.storeId?.toString().replace('gog_', '') || game.id?.replace('gog_', '') || '');
      console.log(`[GameDetail] GOG fetch: gameId=${gameId}, gogId=${gogId}, title=${game.title || game.name}`);
      if (!gogId || gogId === '0') return;
      
      const details = await invoke<any>('get_gog_game_details', { gameId: gogId, gameName: game.title || game.name || null });
      console.log(`[GameDetail] GOG details response:`, details);
      if (details?.description) {
        const desc = details.description.replace(/<[^>]*>?/gm, '');
        setGame((prev: any) => prev ? { ...prev, shortDescription: desc, description: desc } : null);
        translateDescription(desc);
        console.log(`[GameDetail] ✅ GOG description loaded for ${game.title || game.name}`);
      } else {
        console.warn(`[GameDetail] GOG details found but no description field:`, Object.keys(details || {}));
      }
    } catch (e) {
      console.warn('[GameDetail] GOG description fetch failed:', e);
    }
  };

  // Cerca immagine alternativa su SteamGridDB
  const fetchFallbackImage = async () => {
    if (!game) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Leggi API key da localStorage (salvata dalle impostazioni)
      const savedSettings = localStorage.getItem('gameStringerSettings');
      let apiKey: string | null = null;
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          apiKey = settings?.integrations?.steamGridDbApiKey || null;
        } catch (e) {
          console.warn('[GameDetail] Errore parsing impostazioni:', e);
        }
      }
      
      const result = await invoke<string | null>('fetch_steamgriddb_image', {
        appId: game.appid || 0,
        gameName: game.title || game.name || '',
        apiKey: apiKey
      });
      let coverFound = false;
      if (result) {
        setFallbackImage(result);
        coverFound = true;
        console.log('[GameDetail] SteamGridDB fallback:', result);
        // Salva in cache per la libreria
        const cacheId = game.appid ? String(game.appid) : (game.id || game.title);
        await invoke('save_cover_cache', { gameId: cacheId, imageUrl: result });
        console.log('[GameDetail] Cover salvata in cache:', cacheId);
      } else if (game.appid && game.appid > 0) {
        // Fallback: scraping pagina Steam Store per og:image
        try {
          const storeImage = await invoke<string | null>('fetch_steam_store_image', { appId: game.appid });
          if (storeImage) {
            setFallbackImage(storeImage);
            coverFound = true;
            console.log('[GameDetail] Steam Store scraping fallback:', storeImage);
            const cacheId = String(game.appid);
            await invoke('save_cover_cache', { gameId: cacheId, imageUrl: storeImage });
          }
        } catch (e2) {
          console.warn('[GameDetail] Steam Store scraping failed:', e2);
        }
      }
      // Fallback GOG: usa API pubblica GOG per copertina
      if (!coverFound && (game.platform === 'GOG' || gameId.startsWith('gog_'))) {
        try {
          const gogId = gameId.replace('gog_', '') || game.storeId?.toString().replace('gog_', '') || '';
          if (gogId) {
            const gogCover = await invoke<string | null>('get_gog_game_cover', { gameId: gogId, gameName: game.title || game.name || null });
            if (gogCover) {
              setFallbackImage(gogCover);
              console.log('[GameDetail] ✅ GOG API cover:', gogCover);
              const cacheId = game.id || gameId;
              await invoke('save_cover_cache', { gameId: cacheId, imageUrl: gogCover });
            }
          }
        } catch (e3) {
          console.warn('[GameDetail] GOG API cover failed:', e3);
        }
      }
    } catch (e) {
      console.warn('[GameDetail] SteamGridDB fallback failed:', e);
    }
  };

  // Traduce la descrizione nella lingua dell'utente
  const translateDescription = async (text: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ translated_text: string }>('translate_text_simple', {
        text,
        targetLang: language
      });
      // Ignora risposte di errore da MyMemory (limite raggiunto)
      if (result?.translated_text && !result.translated_text.includes('MYMEMORY WARNING')) {
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
        {/* Header con Back + Titolo */}
        <div className="flex items-center gap-3">
          <Link href="/library">
            <Button variant="outline" size="icon" className="h-9 w-9 bg-black/30 border-white/10 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-white">{game.title}</h1>
          {isDetectingEngine && (
            <Badge className="text-xs px-2 py-0.5 bg-slate-700/80 text-slate-300 animate-pulse">
              <Settings className="h-3 w-3 mr-1 animate-spin" />
              Analisi engine...
            </Badge>
          )}
          {!isDetectingEngine && (() => {
            const eng = engineInfo?.engine || game.engine;
            if (!eng || eng === 'Unknown' || eng === 'Sconosciuto') return null;
            const engineColors: Record<string, string> = {
              'Unity': 'bg-blue-600/80',
              'Unreal Engine': 'bg-orange-600/80',
              'RPG Maker': 'bg-green-600/80',
              "Ren'Py": 'bg-pink-600/80',
              'Spike Chunsoft Engine': 'bg-purple-600/80',
              'Godot': 'bg-cyan-600/80',
              'GameMaker': 'bg-yellow-600/80',
              'Source Engine': 'bg-amber-700/80',
              'Source 2': 'bg-amber-600/80',
              'CryEngine': 'bg-red-600/80',
              'Frostbite': 'bg-sky-600/80',
              'REDengine': 'bg-red-700/80',
              'Creation Engine': 'bg-emerald-700/80',
              'id Tech': 'bg-red-800/80',
              'RE Engine': 'bg-rose-600/80',
              'MT Framework': 'bg-rose-700/80',
              'RAGE Engine': 'bg-yellow-700/80',
              'FromSoftware Engine': 'bg-stone-600/80',
              'Platinum Engine': 'bg-indigo-600/80',
              'Glacier Engine': 'bg-teal-700/80',
              'FOX Engine': 'bg-orange-700/80',
              'Anvil Engine': 'bg-slate-600/80',
              'Decima': 'bg-blue-700/80',
              'Snowdrop': 'bg-violet-600/80',
              'IW Engine': 'bg-zinc-600/80',
              'MonoGame/FNA': 'bg-fuchsia-600/80',
              'Void Engine': 'bg-gray-700/80',
              'Clausewitz': 'bg-amber-800/80',
              'Luminous Engine': 'bg-yellow-500/80',
              'Haxe/OpenFL': 'bg-lime-600/80',
              'Telltale Tool': 'bg-teal-600/80',
              'LÖVE': 'bg-pink-500/80',
              'Construct': 'bg-emerald-600/80',
              'Kirikiri': 'bg-fuchsia-700/80',
              'Defold': 'bg-orange-500/80',
              'Cocos2d': 'bg-blue-500/80',
            };
            const key = Object.keys(engineColors).find(k => eng.startsWith(k)) || '';
            const bgColor = engineColors[key] || 'bg-gray-600/80';
            return (
              <Badge className={`text-xs px-2 py-0.5 text-white ${bgColor}`}>
                <Settings className="h-3 w-3 mr-1" />
                {eng}
              </Badge>
            );
          })()}
          {game.metacritic && (
            <div className={`ml-auto w-9 h-9 rounded flex items-center justify-center font-bold text-sm ${
              game.metacritic.score >= 80 ? 'bg-green-600' : 
              game.metacritic.score >= 60 ? 'bg-yellow-600' : 'bg-red-600'
            }`}>
              {game.metacritic.score}
            </div>
          )}
        </div>

        {/* Steam-style Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#1b2838] via-[#1b2838] to-[#2a475e] border border-white/10"
        >
          <div className="flex flex-col md:flex-row">
            {/* Header Image */}
            <div className="relative w-full md:w-[350px] flex-shrink-0 overflow-hidden group" style={{ minHeight: '165px', maxHeight: '165px' }}>
              {(game.headerUrl || game.heroUrl || game.coverUrl || fallbackImage) ? (
                <img 
                  src={game.headerUrl || game.heroUrl || fallbackImage || game.coverUrl}
                  alt={game.title}
                  className="w-full h-full object-cover object-center md:rounded-l-xl"
                  style={{ aspectRatio: '460/215' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              {/* Fallback gradiente con titolo (solo se non c'è immagine) */}
              {!(game.headerUrl || game.heroUrl || game.coverUrl || fallbackImage) && (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/80 via-indigo-900/80 to-slate-900/80 flex items-center justify-center md:rounded-l-xl">
                  <span className="text-2xl font-bold text-white/30 text-center px-4">{game.title}</span>
                </div>
              )}
              {/* Badge "In Libreria" */}
              {game.is_installed && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#4c6b22] px-2.5 py-1 rounded text-xs font-medium text-white shadow-lg z-10">
                  <HardDrive className="h-3 w-3" />
                  NELLA LIBRERIA
                </div>
              )}
              {/* Bottone Cambia Cover */}
              <button
                onClick={() => setIsCoverPickerOpen(true)}
                className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 hover:bg-black/90 px-2 py-1 rounded text-[10px] font-medium text-white/80 hover:text-white transition-all z-10 opacity-0 group-hover:opacity-100"
                title="Cambia cover da SteamGridDB"
              >
                <ImageIcon className="h-3 w-3" />
                Cambia
              </button>
            </div>
            
            {/* Info Content */}
            <div className="flex-1 p-4 flex flex-col justify-between">
              {/* Description */}
              <p className="text-[12px] text-[#c6d4df] leading-relaxed">
                {translatedDescription || game.shortDescription || game.detailedDescription || game.aboutGame || game.description || 'Nessuna descrizione disponibile.'}
              </p>
              
              {/* Tags */}
              {game.genres && game.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {game.genres.slice(0, 5).map((genre: any, index: number) => (
                    <span 
                      key={index}
                      className="px-2.5 py-1 bg-[#3d6c8e]/40 hover:bg-[#67c1f5]/30 rounded text-[11px] text-[#67c1f5] cursor-default transition-colors"
                    >
                      {genre.description}
                    </span>
                  ))}
                  {game.categories?.slice(0, 3).map((cat: any, index: number) => (
                    <span 
                      key={`cat-${index}`}
                      className="px-2.5 py-1 bg-[#3d6c8e]/40 hover:bg-[#67c1f5]/30 rounded text-[11px] text-[#67c1f5] cursor-default transition-colors"
                    >
                      {cat.description}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Release Date + Platform */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/10">
                {game.release_date?.date && (
                  <span className="text-xs text-[#8f98a0] uppercase tracking-wide">
                    {game.release_date.date}
                  </span>
                )}
                {/* Platform Icon */}
                <div className="flex items-center gap-1.5">
                  {(game.platform === 'Steam' || !game.platform) && (
                    <svg className="h-4 w-4 text-[#8f98a0]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 0 1 10 10c0 4.42-2.87 8.17-6.84 9.5l-4.24-1.77a2.5 2.5 0 0 1-1.42-1.42L7.73 13.5 2 11.73V12a10 10 0 0 1 10-10m0 2a8 8 0 0 0-8 8l4.24 1.73a2.5 2.5 0 0 1 2.5-1.23l2.15-3.5A3.5 3.5 0 0 1 12 6a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5 3.5 3.5 0 0 1-.69-.07l-2.3 3.77a2.5 2.5 0 0 1-.01 2.8l2.84 1.18A8 8 0 0 0 20 12a8 8 0 0 0-8-8m0 4a1.5 1.5 0 0 0-1.5 1.5A1.5 1.5 0 0 0 12 11a1.5 1.5 0 0 0 1.5-1.5A1.5 1.5 0 0 0 12 8Z"/>
                    </svg>
                  )}
                  {game.platform === 'Epic Games' && (
                    <span className="text-xs text-[#8f98a0]">Epic</span>
                  )}
                  {game.platform === 'GOG' && (
                    <span className="text-xs text-[#8f98a0]">GOG</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* One-Click Translate & Patch - CTA principale */}
        <Button 
          className="w-full h-12 text-base font-semibold bg-gradient-to-r from-rose-500 via-fuchsia-500 to-purple-500 hover:from-rose-600 hover:via-fuchsia-600 hover:to-purple-600 shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/40 transition-all"
          onClick={() => router.push(`/auto-translate?gameId=${gameId}&gameName=${encodeURIComponent(game.title || '')}&installPath=${encodeURIComponent(game.installPath || '')}&gameImage=${encodeURIComponent(game.headerUrl || '')}&platform=${encodeURIComponent(game.platform || '')}`)}
        >
          <Zap className="h-5 w-5 mr-2" />
          One-Click Translate &amp; Patch
        </Button>

        {/* HowLongToBeat Stats - Stile Steam Deck */}
        <HltbStats gameName={game.title || game.name || ''} className="mt-4" />

        {/* Screenshot Gallery - Solo se ci sono screenshot */}
        {game.screenshots?.length > 0 && (
          <Card className="bg-black/30 backdrop-blur-xl border-white/10">
            <CardContent className="p-3">
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {game.screenshots.slice(0, 6).map((screenshot: any, index: number) => (
                  <div 
                    key={index} 
                    className="relative aspect-video bg-slate-800 rounded overflow-hidden cursor-pointer hover:ring-2 ring-purple-500 transition-all"
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
            </CardContent>
          </Card>
        )}

        {/* Info rapida - nascosta se non c'è path */}
        {game.installPath && (
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
            <span><Folder className="h-3 w-3 inline mr-1" />{game.installPath}</span>
            {dlcGames.length > 0 && <span className="text-cyan-400">{dlcGames.length} DLC</span>}
          </div>
        )}

        {isScanning && (
          <div className="flex items-center gap-2">
            <Progress value={scanProgress} className="h-2 flex-1" />
            <span className="text-sm text-purple-400">{scanProgress}%</span>
          </div>
        )}

      {/* Layout 3:1 - Tabs + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Colonna Principale - Tabs */}
        <div className="lg:col-span-3 space-y-2">

          {/* Raccomandazione Traduzione - Sopra tabs */}
          {(game.is_installed || game.installPath) && (
            <TranslationRecommendation 
              gamePath={game.installPath || ''} 
              gameName={game.title || game.name || ''} 
              onActionClick={async (route) => {
                if (route === 'action:launch_game') {
                  if (game.appid && game.appid > 0) {
                    const steamUrl = `steam://rungameid/${game.appid}`;
                    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
                      try {
                        const { invoke } = await import('@tauri-apps/api/core');
                        await invoke('launch_steam_game', { appId: game.appid.toString() });
                      } catch (e) {
                        window.location.href = steamUrl;
                      }
                    } else {
                      window.location.href = steamUrl;
                    }
                  } else if (game.installPath) {
                    try {
                      const { invoke } = await import('@tauri-apps/api/core');
                      const exeList = await invoke<string[]>('find_executables_in_folder', { folderPath: game.installPath });
                      if (exeList?.length > 0) {
                        await invoke('launch_game_direct', { executablePath: `${game.installPath}\\${exeList[0]}` });
                      }
                    } catch (e) {
                      console.error('[GameDetail] Errore avvio:', e);
                    }
                  }
                } else if (route === '/unity-patcher') {
                  handleInstallUnityPatch();
                } else {
                  router.push(route);
                }
              }}
            />
          )}

          {/* Tabs File/Traduzioni/Patch/Info/Audio */}
          <Tabs defaultValue="files" className="space-y-3">
            <TabsList className="h-8 bg-black/30 border-white/10 flex flex-wrap max-w-full">
              <TabsTrigger value="files" className="text-xs data-[state=active]:bg-purple-600">📁 {t('gameDetails.tabFiles')}</TabsTrigger>
              <TabsTrigger value="translations" className="text-xs data-[state=active]:bg-purple-600">🌍 {t('gameDetails.tabTranslations')}</TabsTrigger>
              <TabsTrigger value="patches" className="text-xs data-[state=active]:bg-purple-600">⚡ {t('gameDetails.tabPatch')}</TabsTrigger>
              <TabsTrigger value="audio" className="text-xs data-[state=active]:bg-purple-600">🎤 Audio Patcher</TabsTrigger>
              <TabsTrigger value="info" className="text-xs data-[state=active]:bg-purple-600">🖥️ Info</TabsTrigger>
            </TabsList>

          <TabsContent value="files" className="space-y-2">
            <Card className="bg-black/20 border-white/10">
              <CardContent className="p-3">
                {game.detectedFiles.length > 0 ? (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-400">{game.detectedFiles.length} {t('gameDetails.filesFound')}</span>
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 text-xs bg-purple-600" onClick={() => router.push(`/translator?gameId=${gameId}&gameName=${encodeURIComponent(game.title || '')}&installPath=${encodeURIComponent(game.installPath || '')}&gameImage=${encodeURIComponent(game.headerUrl || '')}`)}>
                          <Sparkles className="h-3 w-3 mr-1" />Neural Translator
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {game.detectedFiles.map((file: string, index: number) => (
                        <div key={index} className="flex items-center justify-between p-1.5 bg-muted/30 rounded text-xs hover:bg-muted/50">
                          <span className="truncate flex-1"><FileText className="h-3 w-3 inline mr-1" />{file}</span>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => router.push(`/translator?gameId=${gameId}&file=${encodeURIComponent(file)}`)}>
                            {t('gameDetails.translate')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-400 mb-2">{t('gameDetails.noFilesDetected')}</p>
                    <p className="text-[10px] text-gray-500 mb-3">{t('gameDetails.searchTranslatableFiles')}</p>
                    <Button size="sm" className="h-7 text-xs" onClick={scanGameFiles} disabled={isScanning} title="Cerca file di localizzazione nella cartella del gioco">
                      <FileText className="h-3 w-3 mr-1" />{t('gameDetails.scan')}
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
                    <p className="text-xs text-gray-400 mb-2">{t('gameDetails.noActiveTranslations')}</p>
                    <Link href={`/translator?gameId=${game.id}&gameName=${encodeURIComponent(game.title || '')}&installPath=${encodeURIComponent(game.installPath || '')}&gameImage=${encodeURIComponent(game.headerUrl || '')}`}>
                      <Button size="sm" className="h-7 text-xs"><Languages className="h-3 w-3 mr-1" />{t('gameDetails.translate')}</Button>
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
                
                {/* Auto-Patch (Nuovo sistema) */}
                {engineInfo?.can_patch && !game.engine?.match(/Unity|Unreal|RPG Maker|Ren'Py/i) && (
                  <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded">
                    <div>
                      <span className="text-xs text-purple-100 font-medium block"><Sparkles className="h-3 w-3 inline mr-1" />{engineInfo.patch_tool || 'Auto-Patcher'}</span>
                      <span className="text-[10px] text-purple-200/70 block mt-0.5">{engineInfo.patch_description}</span>
                    </div>
                    <Button 
                      size="sm" 
                      className="h-7 text-xs bg-purple-600 ml-2" 
                      onClick={() => {
                        if (engineInfo.engine.includes('Unity')) handleInstallUnityPatch();
                        else if (engineInfo.engine.includes('Unreal')) handleInstallUnrealPatch();
                        else {
                          import('sonner').then(({ toast }) => {
                            toast.info("In sviluppo", { description: `Il patcher per ${engineInfo.engine} sarà disponibile presto.`});
                          });
                        }
                      }} 
                      disabled={isInstallingPatch || !game.is_installed}
                    >
                      {isInstallingPatch ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Installa Patch'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audio" className="space-y-2">
            <AudioPatcher gamePath={game?.installPath || ''} />
          </TabsContent>

          <TabsContent value="info" className="space-y-2">
            <Card className="bg-black/20 border-white/10">
              <CardContent className="p-3 space-y-2">
                {/* Requisiti di sistema */}
                {game.pc_requirements ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                      <Monitor className="h-3.5 w-3.5" /> Requisiti di Sistema
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {game.pc_requirements.minimum && (
                        <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                          <div className="text-[10px] font-semibold text-amber-400 mb-1.5 uppercase tracking-wide">Minimi</div>
                          <p className="text-[10px] text-white/60 leading-relaxed whitespace-pre-wrap">
                            {game.pc_requirements.minimum.replace(/<[^>]*>?/gm, '').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim()}
                          </p>
                        </div>
                      )}
                      {game.pc_requirements.recommended && (
                        <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                          <div className="text-[10px] font-semibold text-green-400 mb-1.5 uppercase tracking-wide">Raccomandati</div>
                          <p className="text-[10px] text-white/60 leading-relaxed whitespace-pre-wrap">
                            {game.pc_requirements.recommended.replace(/<[^>]*>?/gm, '').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-white/30">
                    <Monitor className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Requisiti di sistema non disponibili</p>
                    {!game.appid || game.appid === 0 ? (
                      <p className="text-[10px] mt-1 opacity-60">Disponibili solo per giochi Steam</p>
                    ) : null}
                  </div>
                )}

                {/* Metacritic */}
                {game.metacritic?.score && (
                  <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                    <div className={`flex items-center justify-center w-10 h-10 rounded font-bold text-sm ${
                      game.metacritic.score >= 75 ? 'bg-green-600 text-white' :
                      game.metacritic.score >= 50 ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'
                    }`}>
                      {game.metacritic.score}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white/80">Metacritic</div>
                      {game.metacritic.url && (
                        <a href={game.metacritic.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300">
                          Leggi recensioni →
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Recensioni Steam */}
                {game.recommendations?.total > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <span className="text-lg">👍</span>
                    <div>
                      <div className="text-xs text-white/80">{game.recommendations.total.toLocaleString()} recensioni Steam</div>
                    </div>
                  </div>
                )}

                {/* Website */}
                {game.website && (
                  <div className="pt-2 border-t border-white/10">
                    <a href={game.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
                      <Globe className="h-3 w-3" /> Sito ufficiale
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          </Tabs>
        </div>

        {/* Sidebar Destra - Info e Azioni */}
        <div className="space-y-4">
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

      {/* Cover Picker (Supporta giochi Steam e non-Steam) */}
      {isCoverPickerOpen && game && (
        <CoverPicker
          isOpen={isCoverPickerOpen}
          onClose={() => setIsCoverPickerOpen(false)}
          appId={game.appid || 0}
          gameName={game.title || game.name}
          onCoverSelected={(url) => {
            // Salva la nuova cover
            import('@tauri-apps/api/core').then(({ invoke }) => {
              const gameIdentifier = game.appid ? game.appid.toString() : (game.id || game.title || 'unknown');
              invoke('save_cover_cache', { gameId: gameIdentifier, imageUrl: url })
                .then(() => {
                  setGame({ ...game, headerUrl: url, heroUrl: url, coverUrl: url });
                  setFallbackImage(url);
                  setIsCoverPickerOpen(false);
                  import('sonner').then(({ toast }) => {
                    toast.success('Copertina aggiornata con successo');
                  });
                })
                .catch(err => console.error('Errore salvataggio cover:', err));
            });
          }}
        />
      )}
    </div>
    </div>
    </div>
    </div>
  );
}
