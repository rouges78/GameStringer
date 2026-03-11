
'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import { invoke } from '@/lib/tauri-api';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Gamepad2, Settings, Download, Search, CheckCircle, AlertTriangle, Play, Loader2,
  FolderOpen, Settings2, Trash2, ArrowLeft, Languages, Info, Folder, Sparkles, Monitor, Edit3, Image as ImageIcon, HardDrive, HardDriveDownload, FileText, Cpu, Map, Zap, Globe, Wrench, Clock
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
import { toast } from 'sonner';

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
  
  // Ref guards per StrictMode — traccia quale gameId è stato caricato
  const gameDataLoadedRef = useRef<string | null>(null);
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
      if (gameDataLoadedRef.current === gameId) return;
      gameDataLoadedRef.current = gameId;
      // Timeout wrapper: evita che una singola invoke blocchi tutto
      const safeInvoke = async <T = any>(cmd: string, args?: any, timeoutMs = 8000): Promise<T | null> => {
        try {
          return await Promise.race([
            invoke<T>(cmd, args),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout ${cmd} (${timeoutMs}ms)`)), timeoutMs))
          ]);
        } catch (e) {
          console.warn(`[GameDetail] ${cmd}:`, e);
          return null;
        }
      };

      const fetchGameData = async () => {
        setIsLoading(true);
        try {
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
          
          // Estrai appId
          let appId: number | null = null;
          if (!isNonSteamGame) {
            if (urlAppId && !isNaN(parseInt(urlAppId))) {
              appId = parseInt(urlAppId);
            } else if (gameId.startsWith('steam_shared_')) {
              appId = parseInt(gameId.replace('steam_shared_', ''));
            } else if (gameId.startsWith('steam_family_')) {
              appId = parseInt(gameId.replace('steam_family_', ''));
            } else if (gameId.startsWith('steam_')) {
              appId = parseInt(gameId.replace('steam_', ''));
            } else {
              const parsed = parseInt(gameId);
              if (!isNaN(parsed)) appId = parsed;
            }
            
            // Fallback: cerca appId dal manifest Steam
            if (!appId && urlInstallDir) {
              const foundAppId = await safeInvoke<number | null>('get_appid_from_install_path', { installPath: urlInstallDir }, 3000);
              if (foundAppId && foundAppId > 0) appId = foundAppId;
            }
          }
          console.log('[GameDetail] appId:', appId, 'gameId:', gameId);
          
          // === FASE 1: Carica Steam API + install path IN PARALLELO (max 8s) ===
          const [steamApiData, installPathResult] = await Promise.all([
            // Steam API details
            (!isNonSteamGame && appId && appId > 0) 
              ? safeInvoke('fetch_steam_game_details', { appId }, 8000) 
              : Promise.resolve(null),
            // Install path (prova installDir, poi appId)
            (async () => {
              if (urlInstallDir || urlInstalled) {
                const path = await safeInvoke<string>('find_game_install_path', { installDir: urlInstallDir || urlName || '' }, 5000);
                if (path) return path;
              }
              if (appId && appId > 0) {
                return await safeInvoke<string>('find_game_path_by_appid', { appId }, 5000);
              }
              return null;
            })(),
          ]);
          
          const realInstallPath = installPathResult;
          
          // Determina la piattaforma
          let platform = 'Steam';
          if (isEpicGame) platform = 'Epic Games';
          else if (isGogGame) platform = 'GOG';
          else if (isOriginGame) platform = 'Origin';
          else if (urlPlatform) platform = urlPlatform;
          
          const data = {
            appid: appId || 0,
            name: urlName || steamApiData?.name || decodeURIComponent(gameId),
            install_dir: urlInstallDir || null,
            is_installed: urlInstalled || false
          };

          // Engine detection (non-bloccante, con timeout breve)
          let detectedEngine: string | null = null;
          if (realInstallPath) {
            const engineResult = await safeInvoke<any>('detect_engine_for_game', { 
              gameName: data.name || 'Unknown', installPath: realInstallPath 
            }, 5000);
            if (engineResult?.engine) detectedEngine = engineResult.engine;
          }
          // Fallback client-side se non rilevato via Tauri
          if (!detectedEngine) detectedEngine = detectEngineByName(data.name);
          
          // Combina dati base con dettagli Steam API
          const enhancedGame = {
            ...data,
            ...(steamApiData || {}),
            lastScanned: new Date().toISOString(),
            detectedFiles: [],
            installPath: realInstallPath,
            platform: platform,
            storeId: data.appid || gameId,
            engine: detectedEngine,
            title: steamApiData?.name || data.name,
            description: steamApiData?.short_description?.replace(/<[^>]*>?/gm, '') || (isNonSteamGame ? null : 'Nessuna descrizione disponibile.'),
            detailedDescription: steamApiData?.detailed_description?.replace(/<[^>]*>?/gm, '') || null,
            aboutGame: steamApiData?.about_the_game?.replace(/<[^>]*>?/gm, '') || null,
            coverUrl: isNonSteamGame 
              ? (urlHeaderImage || null)
              : (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/library_600x900.jpg` : null),
            heroUrl: isNonSteamGame 
              ? (urlHeaderImage || null)
              : (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/library_hero.jpg` : null),
            headerUrl: isNonSteamGame 
              ? (urlHeaderImage || null)
              : (steamApiData?.header_image || (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/header.jpg` : null)),
            shortDescription: steamApiData?.short_description || null,
            screenshots: steamApiData?.screenshots || [],
            movies: steamApiData?.movies || [],
            metacritic: steamApiData?.metacritic || null,
            achievements: steamApiData?.achievements || null,
            background: steamApiData?.background || null,
            website: steamApiData?.website || null,
            legal_notice: steamApiData?.legal_notice || null,
            recommendations: steamApiData?.recommendations || null,
            developers: steamApiData?.developers || [],
            publishers: steamApiData?.publishers || [],
            release_date: steamApiData?.release_date || null,
            genres: steamApiData?.genres || [],
            categories: steamApiData?.categories || [],
            supported_languages: steamApiData?.supported_languages || null,
            pc_requirements: steamApiData?.pc_requirements || null,
            is_free: steamApiData?.is_free || false,
          };

          console.log('[GameDetail] ===== GAME LOADED =====', enhancedGame.title);
          setGame(enhancedGame);
          setSteamDetails(steamApiData);
          setIsLoading(false); // UI visibile SUBITO

          // === FASE 2: Dati secondari in background (non bloccano la UI) ===
          // Activity history
          activityHistory.getRecent(100).then(allActivities => {
            const gameTranslations = allActivities
              .filter((a: any) => a.activity_type === 'translation' && (a.game_id === gameId || a.game_name === enhancedGame.title))
              .map((a: any) => ({ id: a.id, gameId: a.game_id, filePath: a.description || a.title, status: 'completed', confidence: 0.95, timestamp: a.timestamp }));
            setTranslations(gameTranslations);
          }).catch(() => setTranslations([]));
          
          // HLTB (in background)
          setIsLoadingHltb(true);
          safeInvoke<{found: boolean; main?: number; main_extra?: number; completionist?: number; url?: string}>('get_howlongtobeat_info', { gameName: enhancedGame.title }, 10000)
            .then(r => { if (r) setHltbData(r); })
            .finally(() => setIsLoadingHltb(false));
          
          // Traccia visualizzazione
          activityHistory.add({ activity_type: 'game_launched', title: `Visualizzato: ${enhancedGame.title}`, game_name: enhancedGame.title, game_id: gameId });
          
          // Salva ultimo gioco visitato
          try {
            localStorage.setItem('gs_last_visited_game', JSON.stringify({
              id: gameId, title: enhancedGame.title || enhancedGame.name,
              image: enhancedGame.headerUrl || enhancedGame.coverUrl || null,
              platform: enhancedGame.platform || 'Steam', appId: String(enhancedGame.appid || ''),
              installPath: enhancedGame.installPath || null, visitedAt: Date.now(),
            }));
          } catch {}

          // DLC in background
          if (steamApiData?.dlc && steamApiData.dlc.length > 0) {
            Promise.all(steamApiData.dlc.slice(0, 5).map((dlcId: number) =>
              safeInvoke('fetch_steam_game_details', { appId: dlcId }, 8000)
            )).then(results => setDlcGames(results.filter(Boolean)));
          }
          return; // isLoading già settato a false sopra
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
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-transparent overflow-hidden">
        <div className="h-14 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl flex items-center px-4 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-slate-800/50 animate-pulse" />
          <div className="ml-3 w-48 h-4 rounded-md bg-slate-800/50 animate-pulse" />
        </div>
        <div className="flex-1 p-4">
          <div className="max-w-[1400px] mx-auto space-y-4">
            <div className="rounded-2xl border border-slate-800/30 bg-slate-900/30 overflow-hidden">
              <div className="flex flex-col lg:flex-row">
                <div className="lg:w-[380px] shrink-0 p-5">
                  <div className="aspect-[3/4] w-full rounded-xl bg-slate-800/40 animate-pulse" />
                </div>
                <div className="flex-1 p-6 space-y-4">
                  <div className="w-3/4 h-6 rounded-md bg-slate-800/40 animate-pulse" />
                  <div className="w-full h-3 rounded bg-slate-800/30 animate-pulse" />
                  <div className="w-5/6 h-3 rounded bg-slate-800/30 animate-pulse" />
                  <div className="flex gap-2 mt-4">
                    {[1,2,3].map(i => <div key={i} className="w-16 h-5 rounded-full bg-slate-800/30 animate-pulse" />)}
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full h-14 rounded-xl bg-slate-800/30 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center bg-transparent">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-slate-900/60 border border-slate-800/50 flex items-center justify-center">
            <Gamepad2 className="h-8 w-8 text-slate-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-300">Gioco non trovato</h1>
          <p className="text-sm text-slate-500 max-w-sm">Il gioco richiesto non esiste nella tua libreria.</p>
          <Link href="/library">
            <Button variant="outline" className="mt-2 h-10 px-5 bg-slate-900/50 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-2" /> Torna alla Libreria
            </Button>
          </Link>
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
    // Default scuro elegante
    return {
      border: 'border-slate-500/20',
      bg: 'bg-gradient-to-br from-slate-900/80 via-slate-950/40 to-slate-900/80',
      blur1: 'bg-slate-500/5',
      blur2: 'bg-gray-500/5',
      text: 'from-slate-300 via-gray-300 to-slate-400',
      accent: 'text-slate-400',
      accent2: 'text-gray-400',
      borderLine: 'border-slate-500/20',
      button: 'from-slate-700 to-slate-600 shadow-slate-500/20'
    };
  };

  const theme = getGenreGradient();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-transparent overflow-hidden">
      
      {/* Header Sticky Premium */}
      <div className="h-14 border-b border-slate-800/40 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-between px-5 sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/library">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl transition-all duration-200 border border-transparent hover:border-indigo-500/20">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          
          <div className="h-6 w-px bg-slate-800/60" />
          
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mini cover nell'header */}
            {(game.headerUrl || fallbackImage) && (
              <div className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-white/10 shrink-0">
                <img src={game.headerUrl || fallbackImage || ''} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <h1 className="text-sm font-bold text-slate-100 tracking-wide truncate max-w-[280px]">{game.title || game.name}</h1>
            
            {isDetectingEngine && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/30 animate-pulse">
                <Settings className="h-3 w-3 text-slate-500 animate-spin" />
                <span className="text-[9px] font-medium text-slate-500">Analisi...</span>
              </div>
            )}
            {!isDetectingEngine && (() => {
              const eng = engineInfo?.engine || game.engine;
              if (!eng || eng === 'Unknown' || eng === 'Sconosciuto') return null;
              return (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20">
                  <Cpu className="h-3 w-3 text-sky-400" />
                  <span className="text-[9px] font-bold text-sky-300 uppercase tracking-widest">{eng}</span>
                </div>
              );
            })()}
            {game.is_vr && (
              <div className="px-2 py-0.5 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20">
                <span className="text-[9px] font-bold text-fuchsia-400 uppercase tracking-widest">VR</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {game.metacritic && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Metacritic</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-lg ${
                game.metacritic.score >= 80 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30' : 
                game.metacritic.score >= 60 ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/30' : 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/30'
              }`}>
                {game.metacritic.score}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 relative z-10">
        <div className="max-w-[1400px] mx-auto space-y-4">
          
          {/* Main Hero Card - Premium Design */}
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className={`relative overflow-hidden rounded-2xl border ${theme.border} shadow-2xl`}
          >
            {/* Background Hero Image (blurred) */}
            {(game.heroUrl || game.headerUrl || fallbackImage) && (
              <div className="absolute inset-0 z-0">
                <img 
                  src={game.heroUrl || game.headerUrl || fallbackImage || ''} 
                  alt="" 
                  className="w-full h-full object-cover scale-110 blur-2xl opacity-20"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/80" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60" />
              </div>
            )}
            {!game.heroUrl && !game.headerUrl && !fallbackImage && (
              <div className={`absolute inset-0 ${theme.bg}`} />
            )}
            
            {/* Effetti luce */}
            <div className={`absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 ${theme.blur1} pointer-events-none opacity-30`} />
            <div className={`absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 ${theme.blur2} pointer-events-none opacity-30`} />
            
            <div className="flex flex-col lg:flex-row relative z-10">
              {/* Cover Portrait */}
              <div className="lg:w-[280px] shrink-0 p-5 flex flex-col items-center justify-center">
                <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 group">
                  {game.coverUrl || game.headerUrl || fallbackImage ? (
                    <img 
                      src={game.coverUrl || game.headerUrl || fallbackImage || ''} 
                      alt="Cover" 
                      className="object-cover w-full h-full transform transition-transform duration-700 group-hover:scale-105"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                      <Gamepad2 className="h-12 w-12 text-slate-700" />
                    </div>
                  )}
                  
                  {/* Gradient overlay bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                  
                  {/* Status badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
                    {game.isInstalled ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                    )}
                    <span className="text-[9px] font-bold text-white/90 uppercase tracking-widest">
                      {game.isInstalled ? 'Installato' : 'Libreria'}
                    </span>
                  </div>
                  
                  {/* Cambia cover */}
                  <button 
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200"
                    onClick={() => setIsCoverPickerOpen(true)}
                  >
                    <ImageIcon className="h-3 w-3" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Cambia</span>
                  </button>
                </div>
              </div>
              
              {/* Info Panel */}
              <div className="flex-1 p-6 flex flex-col justify-between min-w-0">
                <div>
                  {/* Titolo Grande */}
                  <h2 className={`text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-r ${theme.text} bg-clip-text text-transparent mb-1 leading-tight`}>
                    {game.title || game.name}
                  </h2>
                  
                  {/* Developer / Publisher sotto il titolo */}
                  <div className="flex items-center gap-3 mb-4">
                    {game.developers?.[0] && (
                      <span className="text-xs font-semibold text-slate-400">{game.developers[0]}</span>
                    )}
                    {game.developers?.[0] && game.publishers?.[0] && game.developers[0] !== game.publishers[0] && (
                      <>
                        <span className="text-slate-700">•</span>
                        <span className="text-xs text-slate-500">{game.publishers[0]}</span>
                      </>
                    )}
                    {!game.developers?.[0] && game.publishers?.[0] && (
                      <span className="text-xs text-slate-500">{game.publishers[0]}</span>
                    )}
                  </div>
                  
                  {/* Descrizione */}
                  <div className="relative mb-5">
                    <p className="text-[13px] text-slate-300/90 leading-relaxed line-clamp-4">
                      {translatedDescription || game.shortDescription || game.detailedDescription || game.aboutGame || game.description || 'Nessuna descrizione disponibile.'}
                    </p>
                    {game.description && !translatedDescription && language !== 'en' && (
                      <Button variant="link" size="sm" className="h-5 px-0 mt-1 text-[10px] text-indigo-400 hover:text-indigo-300" onClick={() => translateDescription(game.description)}>
                        <Languages className="h-3 w-3 mr-1" /> Traduci in {language.toUpperCase()}
                      </Button>
                    )}
                  </div>
                  
                  {/* Genre Pills */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {game.genres?.filter((g: any) => g && g.description).slice(0, 5).map((genre: any, i: number) => (
                      <span key={i} className={`text-[10px] font-semibold px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] ${theme.accent} hover:bg-white/[0.08] hover:border-white/10 transition-colors cursor-default`}>
                        {genre.description}
                      </span>
                    ))}
                    {game.categories?.slice(0, 3).map((cat: any, index: number) => (
                      <span key={`cat-${index}`} className="text-[10px] font-medium px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05] text-slate-500 cursor-default">
                        {cat.description}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Footer Info Bar */}
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                  {/* Platform */}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                    game.platform === 'Steam' ? 'bg-blue-500/10 border border-blue-500/15' :
                    game.platform === 'Epic Games' ? 'bg-slate-500/10 border border-slate-500/15' :
                    game.platform === 'GOG' ? 'bg-violet-500/10 border border-violet-500/15' :
                    'bg-slate-500/10 border border-slate-500/15'
                  }`}>
                    {(game.platform === 'Steam' || !game.platform) && (
                      <svg className="h-3.5 w-3.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a10 10 0 0 1 10 10c0 4.42-2.87 8.17-6.84 9.5l-4.24-1.77a2.5 2.5 0 0 1-1.42-1.42L7.73 13.5 2 11.73V12a10 10 0 0 1 10-10m0 2a8 8 0 0 0-8 8l4.24 1.73a2.5 2.5 0 0 1 2.5-1.23l2.15-3.5A3.5 3.5 0 0 1 12 6a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5 3.5 3.5 0 0 1-.69-.07l-2.3 3.77a2.5 2.5 0 0 1-.01 2.8l2.84 1.18A8 8 0 0 0 20 12a8 8 0 0 0-8-8m0 4a1.5 1.5 0 0 0-1.5 1.5A1.5 1.5 0 0 0 12 11a1.5 1.5 0 0 0 1.5-1.5A1.5 1.5 0 0 0 12 8Z"/>
                      </svg>
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${
                      game.platform === 'Steam' ? 'text-blue-400' :
                      game.platform === 'Epic Games' ? 'text-slate-400' :
                      game.platform === 'GOG' ? 'text-violet-400' : 'text-slate-400'
                    }`}>
                      {game.platform || 'Steam'}
                    </span>
                  </div>

                  {/* Release Date */}
                  {(game.release_date?.date || game.releaseDate) && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span className="text-[10px] font-semibold text-slate-400">
                        {game.release_date?.date || new Date(game.releaseDate * 1000).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  
                  {/* Recommendations */}
                  {game.recommendations?.total > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                      <span className="text-xs">👍</span>
                      <span className="text-[10px] font-semibold text-emerald-400">{game.recommendations.total.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* Website */}
                  {game.website && (
                    <a href={game.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/10 transition-colors">
                      <Globe className="h-3 w-3 text-slate-500" />
                      <span className="text-[10px] font-semibold text-slate-400">Sito web</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* One-Click Translate - Premium CTA */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Button 
              className="w-full h-14 text-sm font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 hover:from-indigo-500 hover:via-indigo-400 hover:to-violet-400 text-white shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-300 rounded-xl relative overflow-hidden group border border-indigo-400/20"
              onClick={() => router.push(`/auto-translate?gameId=${gameId}&gameName=${encodeURIComponent(game.title || '')}&installPath=${encodeURIComponent(game.installPath || '')}&gameImage=${encodeURIComponent(game.headerUrl || '')}&platform=${encodeURIComponent(game.platform || '')}`)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-[200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.12),transparent_60%)]" />
              <Zap className="h-5 w-5 mr-2.5 drop-shadow-sm" fill="currentColor" />
              <span className="relative tracking-wide">ONE-CLICK TRANSLATE & PATCH</span>
            </Button>
          </motion.div>

          {/* HowLongToBeat Stats */}
          <HltbStats gameName={game.title || game.name || ''} className="mt-4" />

          {/* Screenshot Gallery */}
          {game.screenshots?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="rounded-2xl bg-slate-900/30 backdrop-blur-md border border-slate-800/30 overflow-hidden mt-4"
            >
              <div className="p-3">
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {game.screenshots.slice(0, 6).map((screenshot: any, index: number) => (
                    <div 
                      key={index} 
                      className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden cursor-pointer ring-1 ring-white/[0.06] hover:ring-2 hover:ring-indigo-500/40 transition-all duration-300 group"
                      onClick={() => setSelectedScreenshotIndex(index)}
                    >
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300 z-10 pointer-events-none" />
                      <img 
                        src={screenshot.path_thumbnail || screenshot.path_full} 
                        alt={`Screenshot ${index + 1}`} 
                        className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                      />
                      {/* Play icon on hover */}
                      <div className="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Search className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Install Path + DLC info */}
          {game.installPath && (
            <div className="flex flex-wrap items-center gap-2 mt-2 px-1">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-800/30 max-w-full truncate">
                <Folder className="h-3 w-3 shrink-0 text-slate-600" />
                <span className="truncate">{game.installPath}</span>
              </span>
              {dlcGames.length > 0 && (
                <span className="flex items-center gap-1.5 text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 px-3 py-1.5 rounded-lg">
                  <Sparkles className="h-3 w-3" />
                  {dlcGames.length} DLC
                </span>
              )}
            </div>
          )}

          {isScanning && (
            <div className="flex items-center gap-3 mt-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/30">
              <Progress value={scanProgress} className="h-2 flex-1 bg-slate-800" />
              <span className="text-xs font-bold text-indigo-400 tabular-nums">{scanProgress}%</span>
            </div>
          )}

        {/* Layout 3:1 - Tabs + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mt-6">
          {/* Colonna Principale - Tabs */}
          <div className="lg:col-span-3 space-y-4">

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
                                            await invoke('launch_steam_game', { appId: game.appid.toString() });
                        } catch (e) {
                          window.location.href = steamUrl;
                        }
                      } else {
                        window.location.href = steamUrl;
                      }
                    } else if (game.installPath) {
                      try {
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
            <Tabs defaultValue="files" className="space-y-4">
              <TabsList className="h-auto bg-slate-900/40 backdrop-blur-xl border border-white/[0.06] flex flex-wrap max-w-full rounded-xl p-1.5 gap-1 shadow-inner">
                <TabsTrigger value="files" className="text-xs font-semibold data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm data-[state=active]:shadow-indigo-500/10 data-[state=active]:border-indigo-500/20 border border-transparent rounded-lg px-4 py-2 transition-all duration-200">
                  <FileText className="h-3.5 w-3.5 mr-1.5" /> {t('gameDetails.tabFiles')}
                </TabsTrigger>
                <TabsTrigger value="translations" className="text-xs font-semibold data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm data-[state=active]:shadow-indigo-500/10 data-[state=active]:border-indigo-500/20 border border-transparent rounded-lg px-4 py-2 transition-all duration-200">
                  <Languages className="h-3.5 w-3.5 mr-1.5" /> {t('gameDetails.tabTranslations')}
                </TabsTrigger>
                <TabsTrigger value="patches" className="text-xs font-semibold data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm data-[state=active]:shadow-indigo-500/10 data-[state=active]:border-indigo-500/20 border border-transparent rounded-lg px-4 py-2 transition-all duration-200">
                  <Zap className="h-3.5 w-3.5 mr-1.5" /> {t('gameDetails.tabPatch')}
                </TabsTrigger>
                <TabsTrigger value="audio" className="text-xs font-semibold data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm data-[state=active]:shadow-indigo-500/10 data-[state=active]:border-indigo-500/20 border border-transparent rounded-lg px-4 py-2 transition-all duration-200">
                  <Monitor className="h-3.5 w-3.5 mr-1.5" /> Audio
                </TabsTrigger>
                <TabsTrigger value="info" className="text-xs font-semibold data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm data-[state=active]:shadow-indigo-500/10 data-[state=active]:border-indigo-500/20 border border-transparent rounded-lg px-4 py-2 transition-all duration-200">
                  <Info className="h-3.5 w-3.5 mr-1.5" /> Info
                </TabsTrigger>
              </TabsList>

            <TabsContent value="files" className="space-y-2">
              <Card className="bg-slate-900/30 backdrop-blur-xl border-white/[0.06] shadow-lg rounded-2xl">
                <CardContent className="p-5">
                  {game.detectedFiles.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <FileText className="h-3.5 w-3.5 text-indigo-400" />
                          </div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{game.detectedFiles.length} {t('gameDetails.filesFound')}</span>
                        </div>
                        <Button size="sm" className="h-8 text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-lg shadow-sm shadow-indigo-500/10 border border-indigo-500/20" onClick={() => router.push(`/translator?gameId=${gameId}&gameName=${encodeURIComponent(game.title || '')}&installPath=${encodeURIComponent(game.installPath || '')}&gameImage=${encodeURIComponent(game.headerUrl || '')}`)}>
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" />Neural Translator
                        </Button>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto space-y-1.5 custom-scrollbar pr-2">
                        {game.detectedFiles.map((file: string, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl text-xs hover:bg-white/[0.05] hover:border-white/[0.08] transition-all duration-200 group">
                            <span className="truncate flex-1 font-medium text-slate-300 flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-slate-600 shrink-0" />{file}
                            </span>
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold uppercase tracking-wider px-3 text-slate-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 rounded-lg ml-2" onClick={() => router.push(`/translator?gameId=${gameId}&file=${encodeURIComponent(file)}`)}>
                              {t('gameDetails.translate')}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-800/40 border border-slate-700/30 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-slate-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-300 mb-1.5">{t('gameDetails.noFilesDetected')}</p>
                      <p className="text-[11px] text-slate-500 mb-6 max-w-sm mx-auto leading-relaxed">{t('gameDetails.searchTranslatableFiles')}</p>
                      <Button size="sm" className="h-10 px-5 text-xs font-bold bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700/50" onClick={scanGameFiles} disabled={isScanning}>
                        <Search className="h-4 w-4 mr-2 text-slate-400" />{t('gameDetails.scan')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="translations" className="space-y-2">
              <Card className="bg-slate-900/30 backdrop-blur-xl border-white/[0.06] shadow-lg rounded-2xl">
                <CardContent className="p-5">
                  {translations.length > 0 ? (
                    <div className="max-h-[300px] overflow-y-auto space-y-1.5 custom-scrollbar pr-2">
                      {translations.map((translation) => (
                        <div key={translation.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl text-xs hover:bg-white/[0.05] hover:border-white/[0.08] transition-all duration-200">
                          <span className="truncate flex-1 font-medium text-slate-300">{translation.filePath}</span>
                          <Badge variant="outline" className="text-[9px] mx-2 bg-white/[0.03] text-slate-400 border-white/[0.06]">{translation.status}</Badge>
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/15">{Math.round((translation.confidence || 0) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-800/40 border border-slate-700/30 flex items-center justify-center">
                        <Languages className="h-6 w-6 text-slate-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-300 mb-1.5">{t('gameDetails.noActiveTranslations')}</p>
                      <Link href={`/translator?gameId=${game.id}&gameName=${encodeURIComponent(game.title || '')}&installPath=${encodeURIComponent(game.installPath || '')}&gameImage=${encodeURIComponent(game.headerUrl || '')}`}>
                        <Button size="sm" className="h-10 px-5 text-xs font-bold bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-xl mt-4 shadow-sm shadow-indigo-500/10 border border-indigo-500/20">
                          <Languages className="h-4 w-4 mr-2" />{t('gameDetails.translate')}
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="patches" className="space-y-2">
              <Card className="bg-slate-900/30 backdrop-blur-xl border-white/[0.06] shadow-lg rounded-2xl">
                <CardContent className="p-5 space-y-3">
                  {/* UNITY */}
                  {game.engine === 'Unity' && (
                    <div className="flex items-center justify-between p-4 bg-sky-500/[0.06] border border-sky-500/15 rounded-xl group hover:bg-sky-500/[0.1] transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/15">
                          <Zap className="h-5 w-5 text-sky-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-sky-300">Unity AutoTranslator</span>
                          <span className="text-[10px] text-sky-500/70 mt-0.5">Traduzione real-time in-game via BepInEx</span>
                        </div>
                      </div>
                      <Button size="sm" className="h-8 text-[10px] font-bold bg-sky-600/80 hover:bg-sky-500 text-white rounded-lg border border-sky-500/30" onClick={handleInstallUnityPatch} disabled={isInstallingPatch}>
                        {isInstallingPatch ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                        Installa
                      </Button>
                    </div>
                  )}

                  {/* UNREAL */}
                  {game.engine === 'Unreal Engine' && (
                    <div className="flex items-center justify-between p-4 bg-violet-500/[0.06] border border-violet-500/15 rounded-xl group hover:bg-violet-500/[0.1] transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/15">
                          <Cpu className="h-5 w-5 text-violet-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-violet-300">Unreal Engine Translator</span>
                          <span className="text-[10px] text-violet-500/70 mt-0.5">Traduzione automatica per UE4/UE5</span>
                        </div>
                      </div>
                      <Button size="sm" className="h-8 text-[10px] font-bold bg-violet-600/80 hover:bg-violet-500 text-white rounded-lg border border-violet-500/30" onClick={handleInstallUnrealPatch} disabled={isInstallingPatch}>
                        {isInstallingPatch ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                        Installa
                      </Button>
                    </div>
                  )}

                  {/* Nessun engine compatibile */}
                  {game.engine !== 'Unity' && game.engine !== 'Unreal Engine' && (
                    <div className="text-center py-10">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-800/40 border border-slate-700/30 flex items-center justify-center">
                        <Wrench className="h-6 w-6 text-slate-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-300 mb-1.5">Nessuna patch automatica</p>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                        {game.engine ? `Engine "${game.engine}" non supporta ancora patch automatiche.` : 'Engine non rilevato. Usa il pulsante "One-Click Translate" per tradurre manualmente.'}
                      </p>
                    </div>
                  )}

                  {/* Patch Status */}
                  {patchStatus && (
                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${patchStatus.success ? 'bg-emerald-500/[0.06] border-emerald-500/15' : 'bg-red-500/[0.06] border-red-500/15'}`}>
                      {patchStatus.success ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />}
                      <span className={`text-xs font-medium ${patchStatus.success ? 'text-emerald-300' : 'text-red-300'}`}>{patchStatus.message}</span>
                    </div>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          </Tabs>
        </div>

        {/* Sidebar Destra - Azioni & Quick Links */}
        <div className="space-y-4">
          {/* Gestione Card */}
          <Card className="bg-slate-900/30 backdrop-blur-xl border-white/[0.06] shadow-lg rounded-2xl">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5" /> Gestione
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {game.platform === 'Steam' && game.appid > 0 && (
                <button 
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-slate-300 hover:bg-blue-500/[0.06] hover:border-blue-500/15 hover:text-blue-300 transition-all duration-200 group"
                  onClick={() => window.open(`steam://nav/games/details/${game.appid}`)}
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/15 transition-colors">
                    <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 0 1 10 10c0 4.42-2.87 8.17-6.84 9.5l-4.24-1.77a2.5 2.5 0 0 1-1.42-1.42L7.73 13.5 2 11.73V12a10 10 0 0 1 10-10"/>
                    </svg>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-semibold">Apri in Steam</span>
                    <span className="text-[9px] text-slate-500">Visualizza nella libreria Steam</span>
                  </div>
                </button>
              )}
              {game.installPath && (
                <button 
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-slate-300 hover:bg-amber-500/[0.06] hover:border-amber-500/15 hover:text-amber-300 transition-all duration-200 group"
                  onClick={async () => {
                    try {
                      await invoke('open_folder_in_explorer', { folderPath: game.installPath });
                    } catch (e) {
                      toast.error('Impossibile aprire la cartella');
                    }
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/15 transition-colors">
                    <FolderOpen className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-semibold">Sfoglia File</span>
                    <span className="text-[9px] text-slate-500">Apri cartella gioco</span>
                  </div>
                </button>
              )}
              <button 
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-slate-400 hover:bg-red-500/[0.06] hover:border-red-500/15 hover:text-red-400 transition-all duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/5 flex items-center justify-center group-hover:bg-red-500/10 transition-colors">
                  <Trash2 className="h-4 w-4 text-red-400/60 group-hover:text-red-400" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-xs font-semibold">Nascondi</span>
                  <span className="text-[9px] text-slate-500">Rimuovi dalla libreria</span>
                </div>
              </button>
            </CardContent>
          </Card>
          
          {/* Quick Actions Card */}
          <Card className="bg-slate-900/30 backdrop-blur-xl border-white/[0.06] shadow-lg rounded-2xl">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Azioni Rapide
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <Button 
                size="sm" 
                className="w-full h-9 text-xs font-semibold justify-start bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-300 border border-indigo-500/15 rounded-xl"
                onClick={() => router.push(`/translator?gameId=${gameId}&gameName=${encodeURIComponent(game.title || '')}&installPath=${encodeURIComponent(game.installPath || '')}&gameImage=${encodeURIComponent(game.headerUrl || '')}`)}
              >
                <Languages className="h-3.5 w-3.5 mr-2" /> Traduci File
              </Button>
              <Button 
                size="sm" 
                className="w-full h-9 text-xs font-semibold justify-start bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300 border border-emerald-500/15 rounded-xl"
                onClick={scanGameFiles}
                disabled={isScanning}
              >
                <Search className="h-3.5 w-3.5 mr-2" /> Scansiona File
              </Button>
              <Button 
                size="sm" 
                className="w-full h-9 text-xs font-semibold justify-start bg-slate-500/10 hover:bg-slate-500/15 text-slate-300 border border-slate-500/15 rounded-xl"
                onClick={() => setIsCoverPickerOpen(true)}
              >
                <ImageIcon className="h-3.5 w-3.5 mr-2" /> Cambia Cover
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      
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
  );
}
