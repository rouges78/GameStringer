
'use client';

import { useState, useEffect, useRef } from 'react';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { invoke } from '@/lib/tauri-api';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Gamepad2, Settings, Search, Play, Loader2,
  ArrowLeft, Languages, Sparkles, Image as ImageIcon, Cpu, Globe, Clock, Brain, ChevronDown, Film
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import InlineTranslator from '@/components/inline-translator';
// LanguageFlags import removed — not currently used
import { activityHistory } from '@/lib/activity-history';
import { TranslationRecommendation } from '@/components/translation-recommendation';
import { useTranslation } from '@/lib/i18n';
import { CoverPicker } from '@/components/cover-picker';
import { HltbStats } from '@/components/hltb-stats';
import { toast } from 'sonner';
import { GspackExportDialog, GspackImportDialog } from '@/components/gspack-dialog';

// AudioPatcher import removed — not currently used
import { GameMakerTranslator } from '@/components/gamemaker-translator';
import { clientLogger } from '@/lib/client-logger';
import {
  ScreenshotGallery,
  ScreenshotLightbox,
  AutoTranslateStepper,
  CommunityTranslationsBanner,
  GameUpdateBanner,
  GameToolsPanel,
  UnrealLocalizationPanel,
  UnityAssetsPanel,
} from '@/components/game-detail';

// Game interface based on mock data structure
interface Game {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  platform: string;
  storeId?: string | number;
  engine?: string;
  installPath?: string;
  executablePath?: string;
  isInstalled?: boolean;
  is_installed?: boolean; // Alternative naming
  detectedFiles?: string[];
  lastScanned?: Date | string;
  createdAt?: Date;
  updatedAt?: Date;
  appid?: number;
  name?: string;
  shortDescription?: string;
  headerImage?: string;
  headerUrl?: string; // Alternative naming
  heroUrl?: string;
  coverImage?: string; // Alternative naming
  screenshots?: { id?: number; path_thumbnail: string; path_full: string }[];
  movies?: string[];
  metacritic?: { score: number; url?: string } | null;
  achievements?: { total: number; highlighted?: { name: string; path: string }[] } | null;
  background?: string;
  website?: string;
  legalNotice?: string;
  legal_notice?: string; // Alternative naming
  recommendations?: number | { total: number } | null;
  developers?: string[];
  publishers?: string[];
  releaseDate?: string | { coming_soon: boolean; date: string };
  release_date?: string | { coming_soon: boolean; date: string } | null; // Alternative naming
  genres?: (string | {id?: string; description: string})[];
  categories?: string[];
  supportedLanguages?: string;
  supported_languages?: string; // Alternative naming
  pcRequirements?: { minimum?: string; recommended?: string } | null;
  pc_requirements?: { minimum?: string; recommended?: string } | null; // Alternative naming
  isFree?: boolean;
  is_free?: boolean; // Alternative naming
  dlc?: number[] | null;
  executableName?: string;
  install_dir?: string; // Alternative naming
  source?: string;
  detailedDescription?: string;
  aboutGame?: string;
  playtime_forever?: number;
}

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Sync gameId when searchParams change (client-side navigation)
  useEffect(() => {
    const newId = searchParams.get('id') || (params.id as string) || '';
    if (newId && newId !== gameId) {
      setGameId(newId);
      setGame(null);
      setIsLoading(true);
      gameDataLoadedRef.current = null; // allow re-fetch
    }
  }, [searchParams, params.id]);
  
  const [game, setGame] = useState<Game | null>(null);
  const [_translations, setTranslations] = useState<{id: string; gameId: string; filePath: string; status: string; confidence: number; timestamp: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [dlcGames, setDlcGames] = useState<Record<string, unknown>[]>([]);
  const [showTranslation, setShowTranslation] = useState(false);
  const [_steamDetails, setSteamDetails] = useState<unknown>(null);
  const [_imageError, setImageError] = useState(false);

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
  const [_isLoadingTranslations, setIsLoadingTranslations] = useState(false);
  const [_showTranslationEditor, setShowTranslationEditor] = useState(false);
  const [_translationSearch, _setTranslationSearch] = useState('');
  const [_editingEntry, setEditingEntry] = useState<{original: string, translated: string} | null>(null);

  // Lightbox screenshot (indice per navigazione)
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState<number | null>(null);

  // GsPack export/import dialogs
  const [showGspackExport, setShowGspackExport] = useState(false);
  const [showGspackImport, setShowGspackImport] = useState(false);

  // Descrizione tradotta in italiano
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);

  // HowLongToBeat
  const [_hltbData, setHltbData] = useState<{found: boolean; main?: number; main_extra?: number; completionist?: number; url?: string} | null>(null);
  const [_isLoadingHltb, setIsLoadingHltb] = useState(false);
  
  // SteamGridDB fallback image
  const [fallbackImage, setFallbackImage] = useState<string | null>(null);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);

  // ═══ TARGET LANGUAGE (lingua traduzione, indipendente dalla lingua UI) ═══
  const TARGET_LANGUAGES = [
    { code: 'it', label: 'Italiano', flag: 'IT' },
    { code: 'en', label: 'English', flag: 'GB' },
    { code: 'de', label: 'Deutsch', flag: 'DE' },
    { code: 'fr', label: 'Français', flag: 'FR' },
    { code: 'es', label: 'Español', flag: 'ES' },
    { code: 'pt', label: 'Português', flag: 'BR' },
    { code: 'ru', label: 'Русский', flag: 'RU' },
    { code: 'ja', label: '日本語', flag: 'JP' },
    { code: 'ko', label: '한국어', flag: 'KR' },
    { code: 'zh', label: '中文', flag: 'CN' },
    { code: 'pl', label: 'Polski', flag: 'PL' },
    { code: 'tr', label: 'Türkçe', flag: 'TR' },
    { code: 'uk', label: 'Українська', flag: 'UA' },
    { code: 'nl', label: 'Nederlands', flag: 'NL' },
    { code: 'sv', label: 'Svenska', flag: 'SE' },
    { code: 'cs', label: 'Čeština', flag: 'CZ' },
    { code: 'hu', label: 'Magyar', flag: 'HU' },
    { code: 'ro', label: 'Română', flag: 'RO' },
    { code: 'da', label: 'Dansk', flag: 'DK' },
    { code: 'no', label: 'Norsk', flag: 'NO' },
    { code: 'fi', label: 'Suomi', flag: 'FI' },
    { code: 'ar', label: 'العربية', flag: 'SA' },
    { code: 'th', label: 'ไทย', flag: 'TH' },
    { code: 'vi', label: 'Tiếng Việt', flag: 'VN' },
    { code: 'el', label: 'Ελληνικά', flag: 'GR' },
    { code: 'bg', label: 'Български', flag: 'BG' },
    { code: 'hi', label: 'हिन्दी', flag: 'IN' },
  ];
  const [targetLang, setTargetLang] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gs_target_lang') || language || 'it';
    }
    return language || 'it';
  });
  const [showLangPicker, setShowLangPicker] = useState(false);
  const langPickerRef = useRef<HTMLDivElement>(null);
  const currentFlag = TARGET_LANGUAGES.find(l => l.code === targetLang) || TARGET_LANGUAGES[0];

  // Persist targetLang
  useEffect(() => {
    localStorage.setItem('gs_target_lang', targetLang);
  }, [targetLang]);

  // Close lang picker on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target as Node)) {
        setShowLangPicker(false);
      }
    };
    if (showLangPicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLangPicker]);

  // Auto-Translate one-click flow
  const [autoTranslateActive, setAutoTranslateActive] = useState(false);
  const [_autoTranslateStep, setAutoTranslateStep] = useState(0);
  const [autoTranslateSteps, setAutoTranslateSteps] = useState<{label: string, status: 'pending' | 'running' | 'done' | 'error', detail?: string}[]>([]);
  const [autoTranslateError, setAutoTranslateError] = useState<string | null>(null);
  const [autoTranslateResult, setAutoTranslateResult] = useState<{
    successRate: number;
    duration: number;
    deliverables: number;
    errors: number;
    engine: string;
    targetLang: string;
    stringsTranslated: number;
    stringsTotal: number;
  } | null>(null);

  // Pre-computed translation strategy (populated on page load)
  const [translationStrategy, setTranslationStrategy] = useState<{
    engine: string;
    method: 'unity' | 'unreal' | 'gamemaker' | 'visionaire' | 'tyranoscript' | 'rpgmaker' | 'wolfrpg' | 'renpy' | 'godot' | 'generic';
    detail: string;
    fileCount: number;
    stringCount: number;
    ready: boolean;
  } | null>(null);
  const strategyComputedRef = useRef<string | null>(null);

  // Migliora con AI — traduce le stringhe catturate da XUnity con Ollama
  const [isAiUpgrading, setIsAiUpgrading] = useState(false);
  const [aiUpgradeProgress, setAiUpgradeProgress] = useState<{current: number, total: number} | null>(null);

  // UABEA — Unity Assets panel
  const [uabeaStatus, setUabeaStatus] = useState<{installed: boolean; path?: string} | null>(null);
  const [assetsFiles, setAssetsFiles] = useState<{file_name: string; path: string; size_bytes: number}[]>([]);
  const [isDownloadingUabea, setIsDownloadingUabea] = useState(false);
  const [showAssetsPanel, setShowAssetsPanel] = useState(false);

  // Game Update Tracker
  const [updateStatus, setUpdateStatus] = useState<{
    current_build_id: string;
    known_build_id: string;
    update_detected: boolean;
    patch_intact: boolean;
    patch_type: string;
    patch_details: string[];
    message: string;
  } | null>(null);
  const [isDismissingUpdate, setIsDismissingUpdate] = useState(false);
  const [isUntrackingGame, setIsUntrackingGame] = useState(false);
  
  // Ref guards per StrictMode — traccia quale gameId è stato caricato
  const gameDataLoadedRef = useRef<string | null>(null);
  const sideEffectsRunRef = useRef<string | null>(null);

  // Unreal Engine Patcher
  const [_unrealPatchStatus, setUnrealPatchStatus] = useState<{
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
      setGame(prev => prev ? { ...prev, engine: result.engine } : null);
    } catch {
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
        setGame(prev => prev ? { ...prev, engine: fallbackEngine } : null);
      }
    } finally {
      setIsDetectingEngine(false);
    }
  };

  // Pre-compute translation strategy on page load (engine + files + method)
  const computeTranslationStrategy = async () => {
    if (!game?.installPath) return;
    const gameKey = game.id || game.appid?.toString() || gameId;
    if (strategyComputedRef.current === gameKey) return;
    strategyComputedRef.current = gameKey;

    const detectedEngine = game.engine || engineInfo?.engine || detectEngineByName(game.name || game.title || '') || '';
    const eng = detectedEngine.toLowerCase();

    try {
      if (eng.includes('gamemaker') || eng.includes('game maker')) {
        // GameMaker: check for .jn files or data.win
        try {
          const gmInfo = await invoke<{has_language_files?: boolean; language_file_count?: number; translatable_strings?: number; is_yyc?: boolean}>('gm_scan_data_win', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine || 'GameMaker',
            method: 'gamemaker',
            detail: gmInfo?.has_language_files
              ? `${gmInfo.language_file_count} file .jn — ${gmInfo.translatable_strings} stringhe`
              : gmInfo?.is_yyc
                ? `YYC EXE — ${gmInfo.translatable_strings} stringhe`
                : `data.win — ${gmInfo.translatable_strings} stringhe`,
            fileCount: gmInfo?.language_file_count || 1,
            stringCount: gmInfo?.translatable_strings || 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'GameMaker', method: 'gamemaker', detail: 'GameMaker rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('unity')) {
        setTranslationStrategy({ engine: detectedEngine, method: 'unity', detail: 'BepInEx + XUnity AutoTranslator', fileCount: 0, stringCount: 0, ready: true });
      } else if (eng.includes('unreal')) {
        try {
          const locStatus = await invoke<{has_gs_pak?: boolean; translated_entries?: number; has_locres?: boolean; locres_count?: number; total_entries?: number}>('get_unreal_localization_status', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine,
            method: 'unreal',
            detail: locStatus?.has_gs_pak ? `Patch attiva — ${locStatus.translated_entries} stringhe` : locStatus?.has_locres ? `.locres trovati — traduzione AI disponibile` : 'Unreal Engine rilevato',
            fileCount: locStatus?.locres_count || 0,
            stringCount: locStatus?.total_entries || 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine, method: 'unreal', detail: 'Unreal Engine rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('visionaire')) {
        try {
          const visInfo = await invoke<{total_strings?: number; version?: string; file_count?: number}>('scan_vis_strings', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine || 'Visionaire Studio',
            method: 'visionaire',
            detail: (visInfo?.total_strings ?? 0) > 0
              ? `${visInfo?.version} — ${visInfo?.total_strings} stringhe in game.veb`
              : `${visInfo?.version || 'VIS5'} — scansione al click`,
            fileCount: visInfo?.file_count || 0,
            stringCount: visInfo?.total_strings || 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'Visionaire Studio', method: 'visionaire', detail: 'Visionaire rilevato — scansione al click', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('tyrano') || eng.includes('nw.js') || eng.includes('electron')) {
        // TyranoScript / NW.js / Electron: detect app.asar or app/ folder
        try {
          const tyranoInfo = await invoke<{ total_strings?: number; script_files?: string[]; engine_variant?: string }>('detect_tyrano_game', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine || 'TyranoScript',
            method: 'tyranoscript',
            detail: (tyranoInfo?.total_strings ?? 0) > 0
              ? `${tyranoInfo.script_files?.length || 0} file .ks — ${tyranoInfo.total_strings} stringhe`
              : `${tyranoInfo?.engine_variant || 'TyranoScript'} — ${tyranoInfo?.script_files?.length || 0} file .ks`,
            fileCount: tyranoInfo?.script_files?.length || 0,
            stringCount: tyranoInfo?.total_strings || 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'TyranoScript', method: 'tyranoscript', detail: 'TyranoScript/NW.js rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('rpg maker') || eng.includes('rpgmaker')) {
        // RPG Maker MV/MZ: JSON-based data files
        try {
          const rpgInfo = await invoke<{ version?: string; data_files?: string[] }>('detect_rpgmaker_game', { gamePath: game.installPath });
          const extraction = await invoke<{ total_count?: number }>('extract_all_rpgmaker_strings', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine || `RPG Maker ${rpgInfo?.version || ''}`.trim(),
            method: 'rpgmaker',
            detail: `${rpgInfo?.version || 'MV/MZ'} — ${rpgInfo?.data_files?.length || 0} file, ${extraction?.total_count || 0} stringhe`,
            fileCount: rpgInfo?.data_files?.length || 0,
            stringCount: extraction?.total_count || 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'RPG Maker', method: 'rpgmaker', detail: 'RPG Maker rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('wolf') && eng.includes('rpg')) {
        // Wolf RPG Editor
        try {
          const wolfInfo = await invoke<{ encrypted?: boolean; data_files?: string[] }>('detect_wolfrpg_game', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine || 'Wolf RPG',
            method: 'wolfrpg',
            detail: wolfInfo?.encrypted
              ? `Wolf RPG — criptato (${wolfInfo?.data_files?.length || 0} file)`
              : `Wolf RPG — ${wolfInfo?.data_files?.length || 0} file dati`,
            fileCount: wolfInfo?.data_files?.length || 0,
            stringCount: 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'Wolf RPG', method: 'wolfrpg', detail: 'Wolf RPG rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('ren\'py') || eng.includes('renpy')) {
        // Ren'Py: .rpy script files
        try {
          const scannedFiles = await invoke<string[]>('scan_game_files', { gamePath: game.installPath });
          const rpyFiles = (scannedFiles || []).filter(f => f.toLowerCase().endsWith('.rpy'));
          setTranslationStrategy({
            engine: detectedEngine || "Ren'Py",
            method: 'renpy',
            detail: rpyFiles.length > 0 ? `${rpyFiles.length} file .rpy traducibili` : "Ren'Py rilevato",
            fileCount: rpyFiles.length,
            stringCount: 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || "Ren'Py", method: 'renpy', detail: "Ren'Py rilevato", fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('godot')) {
        // Godot: .tres/.tscn/.translation files
        try {
          const scannedFiles = await invoke<string[]>('scan_game_files', { gamePath: game.installPath });
          const godotFiles = (scannedFiles || []).filter(f => {
            const l = f.toLowerCase();
            return l.endsWith('.tres') || l.endsWith('.tscn') || l.endsWith('.translation') || l.endsWith('.csv');
          });
          setTranslationStrategy({
            engine: detectedEngine || 'Godot',
            method: 'godot',
            detail: godotFiles.length > 0 ? `${godotFiles.length} file traducibili` : 'Godot rilevato',
            fileCount: godotFiles.length,
            stringCount: 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'Godot', method: 'godot', detail: 'Godot rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else {
        // Generic: scan for text files
        try {
          const scannedFiles = await invoke<string[]>('scan_game_files', { gamePath: game.installPath });
          const textExts = ['.json', '.csv', '.txt', '.xml', '.po', '.yaml', '.yml', '.ini', '.cfg', '.lang', '.loc', '.strings', '.jn'];
          const textFiles = (scannedFiles || []).filter(f => textExts.some(ext => f.toLowerCase().endsWith(ext)));
          setTranslationStrategy({
            engine: detectedEngine || 'Sconosciuto',
            method: 'generic',
            detail: textFiles.length > 0 ? `${textFiles.length} file di testo traducibili` : 'Scansione file al click',
            fileCount: textFiles.length,
            stringCount: 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'Sconosciuto', method: 'generic', detail: 'Traduzione diretta AI', fileCount: 0, stringCount: 0, ready: true });
        }
      }
    } catch {
      setTranslationStrategy({ engine: detectedEngine || 'Sconosciuto', method: 'generic', detail: 'Pronto per traduzione', fileCount: 0, stringCount: 0, ready: true });
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
          installPath = await invoke<string>('find_game_install_path', {
            installDir: game.install_dir || game.name || game.title
          });
        } catch (e: unknown) {
          clientLogger.error('Impossibile trovare cartella gioco:', String(e));
          setPatchStatus({ success: false, message: 'Cartella del gioco non trovata' });
          setIsInstallingPatch(false);
          return;
        }
      }
      
      // Cerca l'eseguibile principale nella cartella
      let exeName = game.detectedFiles?.find((f: string) => f.endsWith('.exe'));
      clientLogger.debug('[Patch] detectedFiles exe:', String(exeName));
      if (!exeName) {
        try {
          const exeList = await invoke<string[]>('find_executables_in_folder', { folderPath: installPath });
          clientLogger.debug('[Patch] exeList trovati:', String(exeList));
          if (exeList && exeList.length > 0) {
            exeName = exeList[0];
          }
        } catch (e: unknown) {
          clientLogger.warn('[Patch] Impossibile trovare eseguibili, uso nome gioco:', String(e));
        }
      }
      // Fallback al nome del gioco
      if (!exeName) {
        exeName = `${(game.name || game.title || 'Game').replace(/[^a-zA-Z0-9]/g, '')}.exe`;
      }
      
      clientLogger.debug('[Patch] Installazione con:', `gamePath=${installPath}, gameExeName=${exeName}`);
      clientLogger.debug('[Patch] Chiamata install_unity_autotranslator...');
      
      const result = await invoke<{success: boolean; message: string}>('install_unity_autotranslator', {
        gamePath: installPath,
        gameExeName: exeName,
        targetLang: 'it',
        translationMode: 'google' // Usa Google Translate per traduzione automatica
      });

      clientLogger.debug('[Patch] Risultato:', String(result));

      setPatchStatus({
        success: result.success,
        message: result.message
      });

      if (result.success) {
        clientLogger.debug('[Patch] Installazione completata con successo!');
        // Traccia attività
        await activityHistory.trackPatch(
          game.name || game.title,
          game.appid?.toString(),
          'Unity AutoTranslator (BepInEx)'
        );
        // Refresh game detected files to see new BepInEx files
        scanGameFiles();
      }
    } catch (error: unknown) {
      clientLogger.error('Errore installazione patch:', String(error));
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore sconosciuto durante l\'installazione'
      });
    } finally {
      setIsInstallingPatch(false);
    }
  };

  const _handleUninstallUnityPatch = async () => {
    if (!game?.installPath) return;

    if (!confirm('Sei sicuro di voler rimuovere la patch Unity AutoTranslator?')) return;
    
    setIsInstallingPatch(true);
    try {
      const result = await invoke<{success: boolean, message: string}>('remove_unity_patch', {
        gamePath: game.installPath
      });
      
      setPatchStatus(result);
    } catch (error: unknown) {
      clientLogger.error('Errore rimozione patch Unity:', String(error));
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore durante la rimozione'
      });
    } finally {
      setIsInstallingPatch(false);
    }
  };

  // === COMMUNITY TRANSLATIONS (gamestranslator.it) ===
  const [communityTranslations, setCommunityTranslations] = useState<Array<{
    id: string; title: string; author: string; state: string; revision: string;
    version: string; steam_app_id: string | null; page_url: string; download_url: string; updated_at: string;
  }>>([]);
  const [communitySearchDone, setCommunitySearchDone] = useState(false);
  const [isInstallingCommunityZip, setIsInstallingCommunityZip] = useState(false);

  const searchCommunityTranslations = async () => {
    if (!game?.title || communitySearchDone) return;
    setCommunitySearchDone(true);
    try {
      const results = await invoke<Array<{
        id: string; title: string; author: string; state: string; revision: string;
        version: string; steam_app_id: string | null; page_url: string; download_url: string; updated_at: string;
      }>>('search_gamestranslator', {
        gameName: game.title,
        steamAppId: game.appid && game.appid > 0 ? String(game.appid) : null,
      });
      if (results?.length) setCommunityTranslations(results);
    } catch (e: unknown) { clientLogger.warn('[GT.it]', String(e)); }
  };

  const installCommunityZip = async () => {
    setIsInstallingCommunityZip(true);
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({
        title: 'Seleziona il file ZIP della traduzione',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
        multiple: false,
      }) as string | null;
      if (!selected) return;

      const engine = game?.engine?.toLowerCase().includes('unreal') ? 'unreal'
        : game?.engine?.toLowerCase().includes('unity') ? 'unity' : 'auto';

      const result = await invoke<{message: string; installed?: string[]}>('install_translation_from_zip', {
        zipPath: selected,
        gamePath: game?.installPath || '',
        engine,
      });
      toast.success(`${result.message} (${result.installed?.length || 0} file)`);
      // Ricarica stato patch dopo installazione
      await loadUpdateStatus();
    } catch (e: unknown) {
      toast.error(typeof e === 'string' ? e : 'Installazione fallita');
    } finally { setIsInstallingCommunityZip(false); }
  };

  // === GAME UPDATE TRACKER ===
  const loadUpdateStatus = async () => {
    if (!game?.installPath || !game?.appid || game.appid <= 0) return;
    try {
      const result = await invoke<{
        current_build_id: string; known_build_id: string; update_detected: boolean;
        patch_intact: boolean; patch_type: string; patch_details: string[]; message: string;
      }>('check_game_update', {
        appId: String(game.appid),
        gamePath: game.installPath,
      });
      setUpdateStatus(result);
      // Prima visita: salva subito il buildid senza mostrare alert
      if (result && !result.known_build_id && result.current_build_id !== 'unknown') {
        await invoke('acknowledge_game_update', {
          appId: String(game.appid),
          buildId: result.current_build_id,
          patchIntact: result.patch_intact,
        });
        setUpdateStatus(prev => prev ? { ...prev, update_detected: false } : prev);
      }
    } catch (e: unknown) { clientLogger.warn('[UpdateTracker]', String(e)); }
  };

  const dismissUpdate = async () => {
    if (!game?.appid || !updateStatus) return;
    setIsDismissingUpdate(true);
    try {
      await invoke('acknowledge_game_update', {
        appId: String(game.appid),
        buildId: updateStatus.current_build_id,
        patchIntact: updateStatus.patch_intact,
      });
      setUpdateStatus(prev => prev ? { ...prev, update_detected: false, known_build_id: prev.current_build_id } : prev);
    } catch (e: unknown) { clientLogger.warn('[UpdateTracker] dismiss:', String(e)); }
    finally { setIsDismissingUpdate(false); }
  };

  const untrackGame = async () => {
    if (!game?.appid) return;
    setIsUntrackingGame(true);
    try {
      await invoke<boolean>('remove_tracked_game', { appId: String(game.appid) });
      setUpdateStatus(null);
      toast.success('Monitoraggio disattivato per questo gioco');
    } catch (e: unknown) {
      clientLogger.warn('[UpdateTracker] untrack:', String(e));
      toast.error('Impossibile disattivare il monitoraggio');
    } finally {
      setIsUntrackingGame(false);
    }
  };

  // === UNREAL ENGINE LOCALIZATION STATE ===
  const [ueLocStatus, setUeLocStatus] = useState<{
    has_locres: boolean;
    has_gs_pak: boolean;
    gs_pak_path?: string;
    translated_entries: number;
    paks_dir?: string;
    message: string;
  } | null>(null);
  const [isUeAiUpgrading, setIsUeAiUpgrading] = useState(false);
  const [ueAiProgress, setUeAiProgress] = useState<{current: number; total: number} | null>(null);
  const [showUeLocPanel, setShowUeLocPanel] = useState(false);

  const loadUeLocStatus = async () => {
    if (!game?.installPath) return;
    try {
      const s = await invoke<{
        has_locres: boolean; has_gs_pak: boolean; gs_pak_path?: string;
        translated_entries: number; paks_dir?: string; message: string;
      }>('get_unreal_localization_status', { gamePath: game.installPath });
      setUeLocStatus(s);
    } catch (e: unknown) { clientLogger.warn('[UE] localization status:', String(e)); }
  };

  // Migliora con AI per giochi Unreal: extract → Ollama batch → _P.pak
  const upgradeUEWithAI = async () => {
    if (!game?.installPath || isUeAiUpgrading) return;
    setIsUeAiUpgrading(true);
    setUeAiProgress(null);

    try {
      const lang = language || 'it';
      const _gameName = game.title || game.name || 'Game';

      // 1. Estrai stringhe di localizzazione dal gioco
      toast.info('Estrazione stringhe di localizzazione Unreal...');
      interface UeEntry { namespace: string; key: string; source_hash: string; value: string; }
      const extracted = await invoke<{entries?: UeEntry[]}>('extract_unreal_localization', { gamePath: game.installPath });

      if (!extracted?.entries?.length) {
        toast.error('Nessuna stringa di localizzazione trovata. Verifica che il gioco abbia file .locres o .pak.');
        return;
      }

      const entries = extracted.entries;
      const toTranslate = entries.filter(e => e.value && e.value.trim().length > 0);
      const total = toTranslate.length;
      setUeAiProgress({ current: 0, total });

      toast.info(`Trovate ${total} stringhe — traduzione AI in corso...`);

      // 2. Traduci in batch da 15
      const BATCH = 15;
      const translated: {namespace: string; key: string; source_hash: string; original: string; translated: string}[] = [];

      for (let i = 0; i < toTranslate.length; i += BATCH) {
        const batch = toTranslate.slice(i, i + BATCH);
        const combined = batch.map(e => e.value).join('\n||||\n');

        try {
          const result = await invoke<string>('translate_text_simple', { text: combined, targetLang: lang });
          const parts = result ? result.split('\n||||\n') : [];
          batch.forEach((e, idx) => {
            translated.push({
              namespace: e.namespace,
              key: e.key,
              source_hash: e.source_hash,
              original: e.value,
              translated: parts[idx]?.trim() || e.value,
            });
          });
        } catch {
          batch.forEach(e => translated.push({ namespace: e.namespace, key: e.key, source_hash: e.source_hash, original: e.value, translated: e.value }));
        }
        setUeAiProgress({ current: Math.min(i + BATCH, total), total });
      }

      // 3. Crea _P.pak con traduzioni
      const result = await invoke<{message?: string}>('auto_translate_unreal', {
        gamePath: game.installPath,
        translations: translated,
        targetLanguage: lang,
      });

      await loadUeLocStatus();
      toast.success(`✅ ${result?.message || `PAK creato con ${translated.filter(e => e.translated !== e.original).length} stringhe`}`);

    } catch (e: unknown) {
      clientLogger.error('[UE AI]', String(e));
      toast.error(`Errore traduzione UE: ${String(e) || 'sconosciuto'}`);
    } finally {
      setIsUeAiUpgrading(false);
      setUeAiProgress(null);
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
    } catch (error: unknown) {
      clientLogger.error('Errore caricamento stato patch Unreal:', String(error));
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
    } catch (error: unknown) {
      clientLogger.error('Errore installazione patch Unreal:', String(error));
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore durante l\'installazione'
      });
    } finally {
      setIsInstallingPatch(false);
    }
  };

  const _handleUninstallUnrealPatch = async () => {
    if (!game?.installPath) return;
    
    if (!confirm('Sei sicuro di voler rimuovere la patch di traduzione?')) return;
    
    try {
      const result = await invoke<string>('uninstall_unreal_patch', {
        gamePath: game.installPath
      });
      
      setPatchStatus({ success: true, message: result });
      setUnrealPatchStatus(null);
    } catch (error: unknown) {
      clientLogger.error('Errore rimozione patch Unreal:', String(error));
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore durante la rimozione'
      });
    }
  };

  const _handleLaunchWithTranslator = async () => {
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
    } catch (error: unknown) {
      clientLogger.error('Errore avvio gioco:', String(error));
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore avvio gioco'
      });
    }
  };

  // Carica traduzioni XUnity
  const _loadXunityTranslations = async () => {
    if (!game?.installPath) return;
    
    setIsLoadingTranslations(true);
    try {
      const entries = await invoke<{original: string, translated: string, line_number: number}[]>(
        'read_xunity_translations', 
        { gamePath: game.installPath }
      );
      setXunityTranslations(entries);
      setShowTranslationEditor(true);
    } catch (error: unknown) {
      clientLogger.error('Errore caricamento traduzioni:', String(error));
      alert(typeof error === 'string' ? error : 'Errore caricamento traduzioni');
    } finally {
      setIsLoadingTranslations(false);
    }
  };

  // Salva traduzione modificata
  const _saveTranslation = async (original: string, newTranslation: string) => {
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
    } catch (error: unknown) {
      clientLogger.error('Errore salvataggio:', String(error));
      alert('Errore salvataggio traduzione');
    }
  };

  // Filtra traduzioni per ricerca
  const _filteredTranslations = xunityTranslations.filter(t =>
    t.original.toLowerCase().includes(_translationSearch.toLowerCase()) ||
    t.translated.toLowerCase().includes(_translationSearch.toLowerCase())
  );

  useEffect(() => {
    clientLogger.debug(`[GameDetail] useEffect triggered — gameId: ${gameId}, ref: ${gameDataLoadedRef.current}, url: ${window.location.search}`);
    if (!gameId) {
      clientLogger.warn('[GameDetail] gameId è vuoto — stop loading');
      setIsLoading(false);
      return;
    }
    if (gameDataLoadedRef.current === gameId) {
      clientLogger.debug('[GameDetail] Skipping fetch — already loaded for gameId:', gameId);
      return;
    }
    gameDataLoadedRef.current = gameId;

    // Safety timeout: se dopo 25s isLoading è ancora true, forza false
    const safetyTimer = setTimeout(() => {
      clientLogger.warn('[GameDetail] Safety timeout raggiunto — forzo isLoading=false');
      setIsLoading(false);
    }, 25000);

    {
      // Timeout wrapper: evita che una singola invoke blocchi tutto
      const safeInvoke = async <T = unknown>(cmd: string, args?: Record<string, unknown>, timeoutMs = 8000): Promise<T | null> => {
        try {
          return await Promise.race([
            invoke<T>(cmd, args),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout ${cmd} (${timeoutMs}ms)`)), timeoutMs))
          ]);
        } catch (e: unknown) {
          clientLogger.warn(`[GameDetail] ${cmd}: ${String(e)}`);
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
          clientLogger.debug(`[GameDetail] appId: ${appId}, gameId: ${gameId}`);
          
          // === FASE 1: Carica Steam API + install path IN PARALLELO (max 8s) ===
          interface SteamApiData {
            name?: string;
            short_description?: string;
            detailed_description?: string;
            about_the_game?: string;
            header_image?: string;
            screenshots?: {id: number; path_thumbnail: string; path_full: string}[];
            movies?: string[];
            metacritic?: {score: number; url?: string} | null;
            achievements?: {total: number; highlighted?: {name: string; path: string}[]} | null;
            background?: string;
            website?: string;
            legal_notice?: string;
            recommendations?: {total: number} | null;
            developers?: string[];
            publishers?: string[];
            release_date?: {coming_soon: boolean; date: string} | null;
            genres?: {id: string; description: string}[];
            categories?: string[];
            supported_languages?: string;
            pc_requirements?: {minimum?: string; recommended?: string} | null;
            is_free?: boolean;
            dlc?: number[];
          }
          const [steamApiData, installPathResult] = await Promise.all([
            // Steam API details
            (!isNonSteamGame && appId && appId > 0)
              ? safeInvoke<SteamApiData>('fetch_steam_game_details', { appId }, 8000)
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
            id: gameId,
            appid: appId || 0,
            name: urlName || steamApiData?.name || decodeURIComponent(gameId),
            install_dir: urlInstallDir || undefined,
            is_installed: urlInstalled || false
          };

          // Engine detection (non-bloccante, con timeout breve)
          let detectedEngine: string | null = null;
          if (realInstallPath) {
            const engineResult = await safeInvoke<{engine?: string}>('detect_engine_for_game', {
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
            installPath: realInstallPath || undefined,
            platform: platform,
            storeId: data.appid || gameId,
            engine: detectedEngine || undefined,
            title: steamApiData?.name || data.name,
            description: steamApiData?.short_description?.replace(/<[^>]*>?/gm, '') || (isNonSteamGame ? null : 'Nessuna descrizione disponibile.'),
            detailedDescription: steamApiData?.detailed_description?.replace(/<[^>]*>?/gm, '') || null,
            aboutGame: steamApiData?.about_the_game?.replace(/<[^>]*>?/gm, '') || null,
            coverUrl: isNonSteamGame 
              ? (urlHeaderImage || undefined)
              : (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/library_600x900.jpg` : undefined),
            heroUrl: isNonSteamGame 
              ? (urlHeaderImage || undefined)
              : (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/library_hero.jpg` : undefined),
            headerUrl: isNonSteamGame 
              ? (urlHeaderImage || undefined)
              : (steamApiData?.header_image || (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/header.jpg` : undefined)),
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

          clientLogger.debug('[GameDetail] ===== GAME LOADED =====', enhancedGame.title);
          setGame(enhancedGame as Game);
          setSteamDetails(steamApiData);
          setIsLoading(false); // UI visibile SUBITO

          // === FASE 2: Dati secondari in background (non bloccano la UI) ===
          // Activity history
          activityHistory.getRecent(100).then(allActivities => {
            const gameTranslations = (allActivities as Array<{activity_type: string; game_id: string; game_name: string; id: string; description?: string; title: string; timestamp: string}>)
              .filter(a => a.activity_type === 'translation' && (a.game_id === gameId || a.game_name === enhancedGame.title))
              .map(a => ({ id: a.id, gameId: a.game_id, filePath: a.description || a.title, status: 'completed', confidence: 0.95, timestamp: a.timestamp }));
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
              safeInvoke<Record<string, unknown>>('fetch_steam_game_details', { appId: dlcId }, 8000)
            )).then(results => setDlcGames(results.filter((r): r is Record<string, unknown> => r != null)));
          }
          return; // isLoading già settato a false sopra
        } catch (error: unknown) {
          clientLogger.error('Errore:', String(error));
        } finally {
          clearTimeout(safetyTimer);
          setIsLoading(false);
        }
      };
      
      fetchGameData();
    }

    return () => clearTimeout(safetyTimer);
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
      // Pre-compute translation strategy
      computeTranslationStrategy();
      if (game.engine === 'Unreal Engine' && game.installPath) {
        loadUnrealPatchStatus();
        loadUeLocStatus();
      }
      // Update tracker: controlla buildid per tutti i giochi Steam installati
      if (game.installPath && game.appid && game.appid > 0 && game.platform !== 'GOG') {
        loadUpdateStatus();
      }
      // Cerca traduzioni comunitarie su gamestranslator.it
      if (game.title) {
        searchCommunityTranslations();
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
        setGame(prev => prev ? { ...prev, shortDescription: desc, description: desc } : null);
        setTranslatedDescription(desc);
      }
    } catch (e: unknown) {
      clientLogger.warn('[GameDetail] Steam description fetch failed:', String(e));
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
      clientLogger.debug(`[GameDetail] GOG fetch: gameId=${gameId}, gogId=${gogId}, title=${game.title || game.name}`);
      if (!gogId || gogId === '0') return;
      
      const details = await invoke<{description?: string}>('get_gog_game_details', { gameId: gogId, gameName: game.title || game.name || null });
      clientLogger.debug(`[GameDetail] GOG details response: ${JSON.stringify(details)}`);
      if (details?.description) {
        const desc = details.description.replace(/<[^>]*>?/gm, '');
        setGame(prev => prev ? { ...prev, shortDescription: desc, description: desc } : null);
        translateDescription(desc);
        clientLogger.debug(`[GameDetail] GOG description loaded for ${game.title || game.name}`);
      } else {
        clientLogger.warn(`[GameDetail] GOG details found but no description field: ${Object.keys(details || {}).join(',')}`);
      }
    } catch (e: unknown) {
      clientLogger.warn('[GameDetail] GOG description fetch failed:', String(e));
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
        } catch (e: unknown) {
          clientLogger.warn('[GameDetail] Errore parsing impostazioni:', String(e));
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
        clientLogger.debug('[GameDetail] SteamGridDB fallback:', result);
        // Salva in cache per la libreria
        const cacheId = game.appid ? String(game.appid) : (game.id || game.title);
        await invoke('save_cover_cache', { gameId: cacheId, imageUrl: result });
        clientLogger.debug('[GameDetail] Cover salvata in cache:', cacheId);
      } else if (game.appid && game.appid > 0) {
        // Fallback: scraping pagina Steam Store per og:image
        try {
          const storeImage = await invoke<string | null>('fetch_steam_store_image', { appId: game.appid });
          if (storeImage) {
            setFallbackImage(storeImage);
            coverFound = true;
            clientLogger.debug('[GameDetail] Steam Store scraping fallback:', storeImage);
            const cacheId = String(game.appid);
            await invoke('save_cover_cache', { gameId: cacheId, imageUrl: storeImage });
          }
        } catch (e2) {
          clientLogger.warn('[GameDetail] Steam Store scraping failed:', String(e2));
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
              clientLogger.debug('[GameDetail] ✅ GOG API cover:', gogCover);
              const cacheId = game.id || gameId;
              await invoke('save_cover_cache', { gameId: cacheId, imageUrl: gogCover });
            }
          }
        } catch (e3) {
          clientLogger.warn('[GameDetail] GOG API cover failed:', String(e3));
        }
      }
    } catch (e: unknown) {
      clientLogger.warn('[GameDetail] SteamGridDB fallback failed:', String(e));
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
    } catch (error: unknown) {
      clientLogger.warn('Traduzione descrizione non disponibile:', String(error));
      // Fallback: mostra originale
    }
  };

  const scanGameFiles = async () => {
    if (!game?.installPath) {
      toast.error('Percorso di installazione non disponibile');
      return;
    }
    setIsScanning(true);
    setScanProgress(0);
    
    // Animate progress while waiting for real scan
    const progressInterval = setInterval(() => {
      setScanProgress(prev => Math.min(prev + 5, 90));
    }, 300);
    
    try {
      const files = await invoke<string[]>('scan_game_files', { gamePath: game.installPath });
      clearInterval(progressInterval);
      setScanProgress(100);
      
      if (files && files.length > 0) {
        setGame({ ...game, detectedFiles: files });
        toast.success(`Trovati ${files.length} file traducibili`);
      } else {
        toast.info('Nessun file traducibile trovato');
      }
    } catch (error: unknown) {
      clearInterval(progressInterval);
      clientLogger.error('[GameDetail] Errore scansione:', String(error));
      toast.error(`Errore scansione: ${error}`);
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setScanProgress(0);
      }, 500);
    }
  };

  // ═══ STRING IT! — smart entry point con gate P.T. ═══
  // Se il gioco non è stato ancora analizzato da P.T. (o la cache è scaduta),
  // chiediamo all'utente se vuole eseguire prima l'analisi. Altrimenti parte diretto.
  const handleStringIt = async () => {
    if (!game?.installPath) {
      toast.error('Percorso di installazione non disponibile');
      return;
    }
    if (autoTranslateRunningRef.current || autoTranslateActive) return;

    try {
      const info = await invoke<{ cached: boolean; expired: boolean; age_minutes: number; difficulty_score: number | null }>(
        'has_cached_prediction',
        { installPath: game.installPath, gameTitle: game.title || game.name || '' }
      );

      if (info.cached && !info.expired) {
        // Già analizzato di recente → parti diretto
        startAutoTranslate();
        return;
      }

      // Nessuna cache valida → chiedi conferma
      const ptUrl = `/prediction-tool?name=${encodeURIComponent(game.title || game.name || '')}&installDir=${encodeURIComponent(game.installPath)}&engine=${encodeURIComponent(engineInfo?.engine || '')}&headerImage=${encodeURIComponent(game.headerImage || game.coverImage || '')}`;
      toast('Gioco non ancora analizzato con P.T.', {
        description: info.expired
          ? `Analisi precedente scaduta (${Math.floor(info.age_minutes / 60)}h fa). Rianalizzare migliora tempi e qualità stimate.`
          : 'Eseguire prima P.T. permette di scegliere la chain LLM migliore e stimare tempi/costi.',
        duration: 12000,
        action: {
          label: 'Esegui P.T. prima',
          onClick: () => router.push(ptUrl),
        },
        cancel: {
          label: 'String it! comunque',
          onClick: () => startAutoTranslate(),
        },
      });
    } catch (e: unknown) {
      clientLogger.warn('[StringIt] cache check failed:', String(e));
      // Fallback: parti diretto se il check fallisce
      startAutoTranslate();
    }
  };

  // ═══ AUTO-TRANSLATE ONE-CLICK FLOW ═══
  const autoTranslateRunningRef = useRef(false);
  const startAutoTranslate = async () => {
    if (!game?.installPath) {
      toast.error('Percorso di installazione non disponibile');
      return;
    }
    if (autoTranslateRunningRef.current) return;
    autoTranslateRunningRef.current = true;

    setAutoTranslateActive(true);
    setAutoTranslateError(null);
    setAutoTranslateStep(0);

    // Use the new complete workflow system
    const workflowSteps = [
      { label: '🔍 Analisi completa del gioco', status: 'pending' as const },
      { label: '🛠️ Selezione tool ottimali', status: 'pending' as const },
      { label: '🤖 Configurazione LLM chains', status: 'pending' as const },
      { label: '🎵 Analisi file multimediali', status: 'pending' as const },
      { label: '💾 Creazione backup intelligente', status: 'pending' as const },
      { label: '⚡ Orchestrazione workflow', status: 'pending' as const },
      { label: '🚀 Esecuzione traduzione completa', status: 'pending' as const },
      { label: '✅ Test e validazione finale', status: 'pending' as const },
    ];
    setAutoTranslateSteps([...workflowSteps]);

    const updateStep = (idx: number, status: 'running' | 'done' | 'error', detail?: string) => {
      setAutoTranslateStep(idx);
      setAutoTranslateSteps(prev => prev.map((s, i) => i === idx ? { ...s, status, detail } : i < idx ? { ...s, status: 'done' } : s));
    };

    let unlistenWorkflow: (() => void) | null = null;

    try {
      // ── STEP 1: Complete Analysis ──
      updateStep(0, 'running', 'Analisi predittiva avanzata...');
      
      interface PredictionResult {
        engine?: string;
        selectedTools?: {primary_text_tool?: {name?: string}};
        llmChains?: unknown[];
        multimediaAnalysis?: {audioStats?: {totalAudioFiles?: number}; graphicsStats?: {totalGraphicsFiles?: number}};
        backupStrategy?: {estimatedBackupSizeMb?: number; recommendedBackupType?: string};
        workflowPlan?: {recommendedApproach?: string; workflowStages?: unknown[]};
      }
      const predictionResult = await invoke<PredictionResult>('analyze_game_translation', {
        installPath: game.installPath,
        gameTitle: game.title || game.name || 'Unknown Game',
        engine: game.engine || undefined,
        sourceLang: 'en',
        targetLang: targetLang || 'it',
      });
      
      updateStep(0, 'done', `Analisi completata: ${predictionResult?.engine || 'Engine rilevato'}`);
      await new Promise(r => setTimeout(r, 800));

      // ── STEP 2: Tool Selection ──
      updateStep(1, 'running', 'Selezione tool ottimali...');
      await new Promise(r => setTimeout(r, 600));
      updateStep(1, 'done', `${predictionResult?.selectedTools?.primary_text_tool?.name || 'Tool automatici'} selezionati`);
      await new Promise(r => setTimeout(r, 400));

      // ── STEP 3: LLM Chains ──
      updateStep(2, 'running', 'Configurazione LLM chains...');
      await new Promise(r => setTimeout(r, 600));
      updateStep(2, 'done', `${predictionResult?.llmChains?.length || 0} LLM chains configurate`);
      await new Promise(r => setTimeout(r, 400));

      // ── STEP 4: Multimedia Analysis ──
      updateStep(3, 'running', 'Analisi file multimediali...');
      await new Promise(r => setTimeout(r, 600));
      const multimediaData = predictionResult?.multimediaAnalysis;
      const audioFiles = multimediaData?.audioStats?.totalAudioFiles || 0;
      const graphicsFiles = multimediaData?.graphicsStats?.totalGraphicsFiles || 0;
      updateStep(3, 'done', `${audioFiles} audio, ${graphicsFiles} grafiche analizzate`);
      await new Promise(r => setTimeout(r, 400));

      // ── STEP 5: Backup Strategy ──
      updateStep(4, 'running', 'Creazione backup intelligente...');
      await new Promise(r => setTimeout(r, 600));
      const backupData = predictionResult?.backupStrategy;
      const backupSize = backupData?.estimatedBackupSizeMb || 0;
      updateStep(4, 'done', `Backup ${backupData?.recommendedBackupType || 'Smart'}: ${backupSize.toFixed(1)}MB`);
      await new Promise(r => setTimeout(r, 400));

      // ── STEP 6: Workflow Planning ──
      updateStep(5, 'running', 'Orchestrazione workflow...');
      await new Promise(r => setTimeout(r, 600));
      const workflowData = predictionResult?.workflowPlan;
      const approach = workflowData?.recommendedApproach || 'SemiAutomated';
      const stages = workflowData?.workflowStages?.length || 0;
      updateStep(5, 'done', `Workflow ${approach}: ${stages} stadi`);
      await new Promise(r => setTimeout(r, 400));

      // ── STEP 7: Complete Execution with real-time progress ──
      updateStep(6, 'running', 'Esecuzione traduzione completa...');
      
      // Listen for real-time progress events from backend
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlistenWorkflow = await listen<{stage: string, step: number, message: string, progress: number}>('workflow-progress', (event) => {
          const { message, progress } = event.payload;
          updateStep(6, 'running', `${message} (${progress}%)`);
        });
      } catch { /* non-Tauri env */ }

      const executionResult = await invoke<{
        successRate?: number; totalDurationMinutes?: number; finalStatus?: string;
        deliverables?: unknown[]; errors?: unknown[];
        translatedStrings?: number; totalStrings?: number;
      }>('execute_complete_workflow', {
        installPath: game.installPath,
        gameTitle: game.title || game.name || 'Unknown Game',
        engine: game.engine || undefined,
        sourceLang: 'en',
        targetLang: targetLang || 'it',
      });

      // Cleanup listener
      if (unlistenWorkflow) unlistenWorkflow();

      const success = executionResult?.successRate || 0;
      const duration = executionResult?.totalDurationMinutes || 0;
      const _finalStatus = executionResult?.finalStatus;
      
      if (success >= 0.8) {
        updateStep(6, 'done', `Traduzione completata: ${(success * 100).toFixed(0)}% successo in ${duration.toFixed(1)}min`);
      } else {
        updateStep(6, 'error', `Parzialmente completata: ${(success * 100).toFixed(0)}% successo`);
      }
      await new Promise(r => setTimeout(r, 800));

      // ── STEP 8: Final Validation ──
      updateStep(7, 'running', 'Test e validazione finale...');
      await new Promise(r => setTimeout(r, 600));
      
      const deliverables = executionResult?.deliverables || [];
      const errors = executionResult?.errors || [];
      
      if (errors.length === 0) {
        updateStep(7, 'done', `✅ ${deliverables.length} deliverables creati, 0 errori`);
      } else {
        updateStep(7, 'done', `⚠️ ${deliverables.length} deliverables creati, ${errors.length} errori`);
      }

      // Save result for completion wizard
      setAutoTranslateResult({
        successRate: success,
        duration,
        deliverables: deliverables.length,
        errors: errors.length,
        engine: game.engine || 'Unknown',
        targetLang: targetLang || 'it',
        stringsTranslated: executionResult?.translatedStrings || executionResult?.totalStrings || 0,
        stringsTotal: executionResult?.totalStrings || 0,
      });

    } catch (error: unknown) {
      clientLogger.error('[AutoTranslate] Workflow execution failed:', String(error));
      setAutoTranslateError(String(error) || 'Errore durante l\'esecuzione del workflow');
      toast.error('❌ Errore durante la traduzione automatica');
      // Cleanup workflow listener on error too
      if (unlistenWorkflow) unlistenWorkflow();
    } finally {
      autoTranslateRunningRef.current = false;
    }
  };

  // ═══ MIGLIORA CON AI ═══
  const upgradeWithAI = async () => {
    if (!game?.installPath || isAiUpgrading) return;
    setIsAiUpgrading(true);
    setAiUpgradeProgress(null);

    try {
      const gameName = game.title || game.name || 'Game';
      const lang = language || 'it';

      // 1. Leggi stringhe catturate
      interface CapturedEntry { original: string; translated: string; line_number: number; }
      const captured = await invoke<CapturedEntry[]>('read_captured_translations', {
        gamePath: game.installPath,
        lang,
      });

      if (!captured || captured.length === 0) {
        toast.error('Nessuna stringa catturata. Avvia il gioco almeno una volta con BepInEx installato.');
        return;
      }

      // 2. Filtra stringhe non ancora tradotte (tradotto = originale, oppure vuoto)
      const toTranslate = captured.filter(e => !e.translated || e.translated === e.original);
      const alreadyTranslated = captured.filter(e => e.translated && e.translated !== e.original);
      const total = toTranslate.length;
      setAiUpgradeProgress({ current: 0, total });

      toast.info(`Traduco ${total} stringhe con AI (${alreadyTranslated.length} già tradotte)...`);

      // 3. Traduci in batch da 15 stringhe alla volta
      const BATCH = 15;
      const translated: CapturedEntry[] = [...alreadyTranslated];

      for (let i = 0; i < toTranslate.length; i += BATCH) {
        const batch = toTranslate.slice(i, i + BATCH);
        const combined = batch.map(e => e.original).join('\n||||\n');

        try {
          const result = await invoke<string>('translate_text_simple', {
            text: combined,
            targetLang: lang,
          });

          const parts = result ? result.split('\n||||\n') : [];
          batch.forEach((e, idx) => {
            translated.push({
              original: e.original,
              translated: parts[idx]?.trim() || e.original,
              line_number: e.line_number,
            });
          });
        } catch {
          // batch fallito → mantieni originale
          batch.forEach(e => translated.push({ ...e }));
        }

        setAiUpgradeProgress({ current: Math.min(i + BATCH, total), total });
      }

      // 4. Scrivi file di traduzione statica
      const resultPath = await invoke<string>('write_translation_file', {
        gamePath: game.installPath,
        lang,
        gameName,
        entries: translated,
      });

      toast.success(`✅ Traduzione AI completata! ${translated.filter(e => e.translated !== e.original).length} stringhe scritte.`);
      clientLogger.debug('[AiUpgrade] File scritto:', resultPath);

    } catch (e: unknown) {
      clientLogger.error('[AiUpgrade] Errore:', String(e));
      toast.error(`Errore traduzione AI: ${String(e) || 'sconosciuto'}`);
    } finally {
      setIsAiUpgrading(false);
      setAiUpgradeProgress(null);
    }
  };

  const _getPlatformColor = (platform: string) => {
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
        {/* Header skeleton */}
        <div className="h-14 border-b border-slate-800/40 bg-slate-950/90 backdrop-blur-2xl flex items-center gap-3 px-5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-slate-800/40 animate-pulse" />
          <div className="h-px w-px bg-slate-800/60" />
          <div className="w-7 h-7 rounded-lg bg-slate-800/40 animate-pulse" />
          <div className="w-40 h-4 rounded-md bg-slate-800/40 animate-pulse" />
          <div className="ml-auto w-9 h-9 rounded-xl bg-slate-800/30 animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[1400px] mx-auto space-y-4">
            {/* Hero card skeleton */}
            <div className="rounded-2xl border border-slate-800/20 bg-slate-900/20 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-800/5 to-transparent animate-[shimmer_2s_infinite] pointer-events-none" style={{backgroundSize: '200% 100%'}} />
              <div className="flex flex-col lg:flex-row">
                <div className="lg:w-[250px] shrink-0 p-5">
                  <div className="aspect-[2/3] w-full rounded-xl bg-slate-800/30 animate-pulse" />
                </div>
                <div className="flex-1 p-6 space-y-4">
                  <div className="w-3/4 h-8 rounded-lg bg-slate-800/30 animate-pulse" />
                  <div className="w-1/3 h-3 rounded bg-slate-800/20 animate-pulse" />
                  <div className="space-y-2 mt-4">
                    <div className="w-full h-3.5 rounded bg-slate-800/20 animate-pulse" />
                    <div className="w-5/6 h-3.5 rounded bg-slate-800/20 animate-pulse" />
                    <div className="w-2/3 h-3.5 rounded bg-slate-800/20 animate-pulse" />
                  </div>
                  <div className="flex gap-2 mt-5">
                    {[1,2,3,4].map(i => <div key={i} className="w-20 h-7 rounded-lg bg-slate-800/20 animate-pulse" />)}
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800/20">
                    {[1,2,3].map(i => <div key={i} className="w-24 h-8 rounded-lg bg-slate-800/20 animate-pulse" />)}
                  </div>
                </div>
              </div>
            </div>
            {/* CTA skeleton */}
            <div className="w-full h-14 rounded-xl bg-indigo-500/5 border border-indigo-500/10 animate-pulse" />
            {/* Screenshot skeleton */}
            <div className="rounded-2xl border border-slate-800/20 bg-slate-900/15 p-4 space-y-2">
              <div className="w-full aspect-video rounded-xl bg-slate-800/20 animate-pulse" />
              <div className="grid grid-cols-5 gap-1.5">
                {[1,2,3,4,5].map(i => <div key={i} className="aspect-video rounded-lg bg-slate-800/15 animate-pulse" />)}
              </div>
            </div>
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
    const firstGenre = game?.genres?.[0];
    const genre = (typeof firstGenre === 'string' ? firstGenre : firstGenre?.description)?.toLowerCase() || '';
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

  const heroImg = game.heroUrl || game.headerUrl || fallbackImage || '';
  const engineLabel = engineInfo?.engine || game.engine;
  const showEngine = engineLabel && engineLabel !== 'Unknown' && engineLabel !== 'Sconosciuto';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#0a0e14] overflow-hidden">

      {/* ═══ IMMERSIVE HERO — fullwidth ═══ */}
      <div className="relative shrink-0 overflow-hidden" style={{ minHeight: 340 }}>
        {/* BG image */}
        {heroImg && (
          <div className="absolute inset-0">
            <img src={heroImg} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e14] via-[#0a0e14]/70 to-[#0a0e14]/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0e14]/90 via-transparent to-[#0a0e14]/60" />
          </div>
        )}
        {!heroImg && <div className={`absolute inset-0 ${theme.bg}`} />}
        <div className={`absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-[120px] ${theme.blur1} opacity-20 pointer-events-none`} />

        {/* Back button (floating) */}
        <Link href="/library" className="absolute top-4 left-4 z-20">
          <button className="h-9 w-9 rounded-xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>

        {/* Metacritic score (floating top-right) — cliccabile se URL disponibile */}
        {game?.metacritic && game.metacritic.score > 0 && (
          <a
            href={game.metacritic.url || `https://www.metacritic.com/search/${encodeURIComponent(game.title || '')}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-6 z-20 flex flex-col items-center gap-1 group cursor-pointer"
            title="Apri su Metacritic"
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white shadow-lg transition-transform group-hover:scale-110 ${
              game.metacritic.score >= 75 ? 'bg-[#66cc33]' : game.metacritic.score >= 50 ? 'bg-[#ffcc33]' : 'bg-[#ff0000]'
            }`}>
              {game.metacritic.score}
            </div>
            <span className="text-2xs font-bold uppercase tracking-widest text-white/50 group-hover:text-white/80 transition-colors">Metacritic</span>
          </a>
        )}

        {/* Hero content overlay */}
        <div className="relative z-10 flex items-end gap-6 px-6 pb-6 pt-16 max-w-[1400px] mx-auto">
          {/* Cover */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="shrink-0 hidden lg:block"
          >
            <div className="relative w-[180px] aspect-[2/3] rounded-xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/10 group">
              {game.coverUrl || heroImg ? (
                <img src={game.coverUrl || heroImg} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" onError={() => setImageError(true)} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center"><Gamepad2 className="h-10 w-10 text-slate-700" /></div>
              )}
              <button className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-all text-2xs font-bold uppercase tracking-wider flex items-center gap-1" onClick={() => setIsCoverPickerOpen(true)}>
                <ImageIcon className="h-2.5 w-2.5" /> Cover
              </button>
            </div>
          </motion.div>

          {/* Title + meta */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="flex-1 min-w-0 space-y-3"
          >
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-2xs font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                game.platform === 'Steam' ? 'text-blue-300 bg-blue-500/15 border-blue-500/25' :
                game.platform === 'GOG' ? 'text-violet-300 bg-violet-500/15 border-violet-500/25' :
                'text-slate-300 bg-white/10 border-white/15'
              }`}>{game.platform || 'Steam'}</span>
              {showEngine && (
                <span className="text-2xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-md text-sky-300 bg-sky-500/15 border border-sky-500/25 flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> {engineLabel}
                </span>
              )}
              {game.isInstalled && (
                <span className="text-2xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-md text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" /> Installato
                </span>
              )}
              {isDetectingEngine && <Settings className="h-3.5 w-3.5 text-slate-500 animate-spin" />}
            </div>

            {/* Title */}
            <h1 className={`text-2xl lg:text-4xl font-black tracking-tight bg-gradient-to-r ${theme.text} bg-clip-text text-transparent leading-[1.05] drop-shadow-lg`}>
              {game.title || game.name}
            </h1>

            {/* Developer + release */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {game.developers?.[0] && <span className="font-semibold text-slate-300">{game.developers[0]}</span>}
              {game.developers?.[0] && game.publishers?.[0] && game.developers[0] !== game.publishers[0] && <><span className="text-slate-600">|</span><span>{game.publishers[0]}</span></>}
              {((typeof game.release_date === 'object' && game.release_date?.date) || game.releaseDate) && <><span className="text-slate-600">|</span><span>{(typeof game.release_date === 'object' ? game.release_date?.date : game.release_date) || (typeof game.releaseDate === 'string' ? game.releaseDate : game.releaseDate ? new Date(Number(game.releaseDate) * 1000).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { year: 'numeric', month: 'short' }) : '')}</span></>}
            </div>

            {/* Genre pills + scores inline */}
            <div className="flex items-center gap-2 flex-wrap">
              {game.genres?.filter(g => typeof g === 'object' && g?.description).slice(0, 4).map((genre, i) => (
                <span key={i} className="text-2xs font-semibold px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/[0.08] text-slate-300">{typeof genre === 'object' ? genre.description : genre}</span>
              ))}
              {typeof game.recommendations === 'object' && game.recommendations != null && (game.recommendations.total ?? 0) > 0 && (
                <span className="text-2xs font-bold px-2.5 py-1 rounded-md text-sky-300 bg-sky-500/10 border border-sky-500/15">👍 {(game.recommendations.total ?? 0).toLocaleString()}</span>
              ) || typeof game.recommendations === 'number' && game.recommendations > 0 && (
                <span className="text-2xs font-bold px-2.5 py-1 rounded-md text-sky-300 bg-sky-500/10 border border-sky-500/15">👍 {game.recommendations.toLocaleString()}</span>
              )}
              {(game.playtime_forever ?? 0) > 0 && (
                <span className="text-2xs font-bold px-2.5 py-1 rounded-md text-violet-300 bg-violet-500/10 border border-violet-500/15 flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.round((game.playtime_forever ?? 0) / 60)}h</span>
              )}
            </div>
          </motion.div>

          {/* Action buttons (right side — desktop) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="shrink-0 hidden lg:flex flex-col gap-2 items-stretch w-[200px]"
          >
            {game.isInstalled && (
              <button className="h-12 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all border border-emerald-400/20 group"
                onClick={async () => { if ((game.appid ?? 0) > 0) { const u = `steam://rungameid/${game.appid}`; try { const { open: shellOpen } = await import('@tauri-apps/plugin-shell'); await shellOpen(u); } catch { window.location.href = u; } } }}
              >
                <Play className="h-4 w-4 fill-current group-hover:scale-110 transition-transform" /> Gioca
              </button>
            )}
            <div className="flex flex-col items-stretch">
              <div className="flex items-stretch gap-0">
                {/* ── Bottone STRING IT! (HERO — azione principale) ── */}
                <button className="h-12 flex-1 flex items-center justify-center gap-2 rounded-l-xl bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white font-extrabold text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/40 hover:shadow-indigo-500/60 transition-all border border-indigo-400/30 border-r-0 relative overflow-hidden group"
                  onClick={handleStringIt}
                  disabled={autoTranslateActive}
                  title="Avvia la traduzione completa del gioco"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-[200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                  {autoTranslateActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" fill="currentColor" />} {autoTranslateActive ? t('gameDetails.translating') || 'Translating...' : 'String it!'}
                </button>
                {/* ── Bandierina lingua target ── */}
                <div className="relative" ref={langPickerRef}>
                  <button
                    className="h-12 px-2.5 flex items-center gap-1 rounded-r-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white text-2xs font-bold uppercase tracking-wider shadow-xl shadow-purple-500/30 transition-all border border-purple-400/30 border-l-0"
                    onClick={() => setShowLangPicker(!showLangPicker)}
                    title={`Lingua: ${currentFlag.label}`}
                  >
                    <span className="text-base leading-none">{(() => { const emojis: Record<string, string> = { IT:'🇮🇹', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', ES:'🇪🇸', BR:'🇧🇷', RU:'🇷🇺', JP:'🇯🇵', KR:'🇰🇷', CN:'🇨🇳', PL:'🇵🇱', TR:'🇹🇷', UA:'🇺🇦', NL:'🇳🇱', SE:'🇸🇪', CZ:'🇨🇿', HU:'🇭🇺', RO:'🇷🇴', DK:'🇩🇰', NO:'🇳🇴', FI:'🇫🇮', SA:'🇸🇦', TH:'🇹🇭', VN:'🇻🇳', GR:'🇬🇷', BG:'🇧🇬', IN:'🇮🇳' }; return emojis[currentFlag.flag] || '🌐'; })()}</span>
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </button>
                  {showLangPicker && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[#0f1318] border border-white/10 rounded-xl shadow-2xl shadow-black/60 py-1.5 w-48 max-h-72 overflow-y-auto custom-scrollbar">
                      {TARGET_LANGUAGES.map(lang => {
                        const emojis: Record<string, string> = { IT:'🇮🇹', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', ES:'🇪🇸', BR:'🇧🇷', RU:'🇷🇺', JP:'🇯🇵', KR:'🇰🇷', CN:'🇨🇳', PL:'🇵🇱', TR:'🇹🇷', UA:'🇺🇦', NL:'🇳🇱', SE:'🇸🇪', CZ:'🇨🇿', HU:'🇭🇺', RO:'🇷🇴', DK:'🇩🇰', NO:'🇳🇴', FI:'🇫🇮', SA:'🇸🇦', TH:'🇹🇭', VN:'🇻🇳', GR:'🇬🇷', BG:'🇧🇬', IN:'🇮🇳' };
                        return (
                          <button
                            key={lang.code}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11px] transition-colors ${targetLang === lang.code ? 'bg-indigo-600/30 text-indigo-300 font-bold' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                            onClick={() => { setTargetLang(lang.code); setShowLangPicker(false); }}
                          >
                            <span className="text-sm">{emojis[lang.flag] || '🌐'}</span>
                            <span>{lang.label}</span>
                            <span className="ml-auto text-micro text-slate-500 uppercase">{lang.code}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              {translationStrategy?.ready && (
                <div className="text-2xs text-center mt-1 text-slate-500 tracking-wide">
                  {translationStrategy.engine} · {translationStrategy.detail}
                </div>
              )}
            </div>
            {game.platform === 'Steam' && (game.appid ?? 0) > 0 && (
              <button className="h-8 flex items-center justify-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-micro font-bold uppercase tracking-wider transition-all"
                onClick={() => window.open(`steam://nav/games/details/${game.appid}`)}
              >
                <Globe className="h-3 w-3" /> Steam Store
              </button>
            )}
            {game.isInstalled && game.installPath && (
              <Link href={`/prediction-tool?name=${encodeURIComponent(game.title || game.name || '')}&installDir=${encodeURIComponent(game.installPath)}&engine=${encodeURIComponent(engineInfo?.engine || '')}&headerImage=${encodeURIComponent(game.headerImage || game.coverImage || '')}`}
                className="h-8 flex items-center justify-center gap-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 hover:text-purple-300 text-micro font-bold uppercase tracking-wider transition-all no-underline"
              >
                <Brain className="h-3 w-3" /> P.T.
              </Link>
            )}
            {game.isInstalled && game.installPath && (
              <Link href={`/video-extractor?gamePath=${encodeURIComponent(game.installPath)}&gameName=${encodeURIComponent(game.title || game.name || '')}&gameId=${encodeURIComponent(game.appid?.toString() || game.id || '')}`}
                className="h-8 flex items-center justify-center gap-1.5 rounded-lg bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 text-fuchsia-400 hover:text-fuchsia-300 text-micro font-bold uppercase tracking-wider transition-all no-underline"
              >
                <Film className="h-3 w-3" /> Video
              </Link>
            )}
          </motion.div>
        </div>
      </div>

      {/* ═══ MOBILE ACTION BAR (visible only on small screens) ═══ */}
      <div className="flex lg:hidden gap-2 px-4 py-2.5 bg-[#0a0e14]/95 border-t border-white/[0.04] shrink-0">
        {game.isInstalled && (
          <button className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600/90 text-white font-bold text-2xs uppercase tracking-wider"
            onClick={async () => { if ((game.appid ?? 0) > 0) { const u = `steam://rungameid/${game.appid}`; try { const { open: shellOpen } = await import('@tauri-apps/plugin-shell'); await shellOpen(u); } catch { window.location.href = u; } } }}
          >
            <Play className="h-3.5 w-3.5 fill-current" /> Gioca
          </button>
        )}
        <button className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-l-lg bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-bold text-2xs uppercase tracking-wider shadow-lg shadow-indigo-500/30"
          onClick={handleStringIt}
          disabled={autoTranslateActive}
        >
          {autoTranslateActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" fill="currentColor" />} {autoTranslateActive ? '...' : 'String it!'}
        </button>
        <button className="h-9 px-2 flex items-center gap-0.5 rounded-r-lg bg-violet-600/90 text-white text-xs font-bold"
          onClick={() => setShowLangPicker(!showLangPicker)}
        >
          {(() => { const emojis: Record<string, string> = { IT:'🇮🇹', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', ES:'🇪🇸', BR:'🇧🇷', RU:'🇷🇺', JP:'🇯🇵', KR:'🇰🇷', CN:'🇨🇳', PL:'🇵🇱', TR:'🇹🇷', UA:'🇺🇦', NL:'🇳🇱', SE:'🇸🇪', CZ:'🇨🇿', HU:'🇭🇺', RO:'🇷🇴', DK:'🇩🇰', NO:'🇳🇴', FI:'🇫🇮', SA:'🇸🇦', TH:'🇹🇭', VN:'🇻🇳', GR:'🇬🇷', BG:'🇧🇬', IN:'🇮🇳' }; return emojis[currentFlag.flag] || '🌐'; })()}
          <ChevronDown className="h-2.5 w-2.5 opacity-70" />
        </button>
        <button className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-400"
          onClick={scanGameFiles}
        >
          <Search className="h-3.5 w-3.5" />
        </button>
        {game.isInstalled && game.installPath && (
          <Link href={`/prediction-tool?name=${encodeURIComponent(game.title || game.name || '')}&installDir=${encodeURIComponent(game.installPath)}&engine=${encodeURIComponent(engineInfo?.engine || '')}&headerImage=${encodeURIComponent(game.headerImage || game.coverImage || '')}`}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 hover:text-purple-300 transition-all no-underline"
          >
            <Brain className="h-3.5 w-3.5" />
          </Link>
        )}
        {game.isInstalled && game.installPath && (
          <Link href={`/video-extractor?gamePath=${encodeURIComponent(game.installPath)}&gameName=${encodeURIComponent(game.title || game.name || '')}&gameId=${encodeURIComponent(game.appid?.toString() || game.id || '')}`}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 text-fuchsia-400 hover:text-fuchsia-300 transition-all no-underline"
          >
            <Film className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-5 space-y-5">

          {/* ═══ AUTO-TRANSLATE STEPPER PANEL ═══ */}
          {autoTranslateActive && (
            <AutoTranslateStepper
              steps={autoTranslateSteps}
              error={autoTranslateError}
              result={autoTranslateResult}
              currentFlagLabel={currentFlag.label}
              onClose={() => setAutoTranslateActive(false)}
              onClearResult={() => setAutoTranslateResult(null)}
              game={{ title: game.title, name: game.name, installPath: game.installPath, appid: game.appid }}
            />
          )}

          {/* Descrizione */}
          {(translatedDescription || game.shortDescription || game.description) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
              <p className="text-[13px] text-slate-300/90 leading-relaxed line-clamp-3">{translatedDescription || game.shortDescription || game.detailedDescription || game.aboutGame || game.description}</p>
              {game.description && !translatedDescription && language !== 'en' && (
                <button className="text-2xs text-indigo-400 hover:text-indigo-300 mt-1.5 flex items-center gap-1 font-semibold" onClick={() => translateDescription(game.description)}>
                  <Languages className="h-3 w-3" /> Traduci in {language.toUpperCase()}
                </button>
              )}
            </motion.div>
          )}

          {/* HowLongToBeat Stats */}
          <HltbStats gameName={game.title || game.name || ''} />

          {/* ═══ SCREENSHOT GALLERY — horizontal scroll ═══ */}
          <ScreenshotGallery
            screenshots={game.screenshots || []}
            onScreenshotClick={setSelectedScreenshotIndex}
          />

          {/* Scan progress */}
          {isScanning && (
            <div className="flex items-center gap-3 bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
              <Progress value={scanProgress} className="h-2 flex-1 bg-slate-800" />
              <span className="text-xs font-bold text-indigo-400 tabular-nums">{scanProgress}%</span>
            </div>
          )}

          {/* ═══ TRANSLATION RECOMMENDATION — compact banner ═══ */}
          {(game.is_installed || game.installPath) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <TranslationRecommendation
                gamePath={game.installPath || ''}
                gameName={game.title || game.name || ''}
                onActionClick={async (route) => {
                  if (route === 'action:launch_game') {
                    if (game.appid && game.appid > 0) {
                      const steamUrl = `steam://rungameid/${game.appid}`;
                      try {
                        const { open: shellOpen } = await import('@tauri-apps/plugin-shell');
                        await shellOpen(steamUrl);
                      } catch { window.location.href = steamUrl; }
                    } else if (game.installPath) {
                      try {
                        const exeList = await invoke<string[]>('find_executables_in_folder', { folderPath: game.installPath });
                        if (exeList?.length > 0) await invoke('launch_game_direct', { executablePath: `${game.installPath}\\${exeList[0]}` });
                      } catch (e: unknown) { clientLogger.error('[GameDetail] Errore avvio:', String(e)); }
                    }
                  } else if (route === '/unity-patcher') { handleInstallUnityPatch(); }
                  else { router.push(route); }
                }}
              />
            </motion.div>
          )}

          {/* ═══ BANNER TRADUZIONE COMUNITARIA (gamestranslator.it) ═══ */}
          <CommunityTranslationsBanner
            translations={communityTranslations}
            installPath={game.installPath}
            isInstallingZip={isInstallingCommunityZip}
            onInstallZip={installCommunityZip}
          />

          {/* ═══ BANNER AGGIORNAMENTO GIOCO ═══ */}
          {updateStatus && (updateStatus.update_detected || (!updateStatus.patch_intact && updateStatus.patch_type !== 'none')) && (
            <GameUpdateBanner
              updateStatus={updateStatus}
              installPath={game.installPath}
              targetLang={targetLang}
              isDismissing={isDismissingUpdate}
              isUntracking={isUntrackingGame}
              isUeAiUpgrading={isUeAiUpgrading}
              onDismiss={dismissUpdate}
              onUntrack={untrackGame}
              onUpgradeUEWithAI={upgradeUEWithAI}
            />
          )}

          {/* ═══ DETTAGLI & STRUMENTI ═══ */}
          <GameToolsPanel
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            game={game as any}
            gameId={gameId}
            engineInfo={engineInfo}
            patchStatus={patchStatus}
            isScanning={isScanning}
            isInstallingPatch={isInstallingPatch}
            isAiUpgrading={isAiUpgrading}
            isUeAiUpgrading={isUeAiUpgrading}
            aiUpgradeProgress={aiUpgradeProgress}
            ueAiProgress={ueAiProgress}
            dlcGames={dlcGames}
            onScan={scanGameFiles}
            onInstallUnityPatch={handleInstallUnityPatch}
            onInstallUnrealPatch={handleInstallUnrealPatch}
            onUpgradeWithAI={upgradeWithAI}
            onUpgradeUEWithAI={upgradeUEWithAI}
            onOpenCoverPicker={() => setIsCoverPickerOpen(true)}
            onOpenGspackExport={() => setShowGspackExport(true)}
            onOpenGspackImport={() => setShowGspackImport(true)}
          />

          {/* ── Unreal Localization Panel ── */}
          {(game.engine === 'Unreal Engine' || engineInfo?.engine?.toLowerCase().includes('unreal')) && game.installPath && (
            <UnrealLocalizationPanel
              installPath={game.installPath}
              ueLocStatus={ueLocStatus}
              showPanel={showUeLocPanel}
              isUeAiUpgrading={isUeAiUpgrading}
              ueAiProgress={ueAiProgress}
              onTogglePanel={() => setShowUeLocPanel(v => !v)}
              onLoadStatus={loadUeLocStatus}
              onUpgradeUEWithAI={upgradeUEWithAI}
            />
          )}

          {/* ── Unity Assets Panel ── */}
          {(game.engine === 'Unity' || engineInfo?.engine?.toLowerCase().includes('unity')) && game.installPath && (
            <UnityAssetsPanel
              installPath={game.installPath}
              uabeaStatus={uabeaStatus}
              assetsFiles={assetsFiles}
              showPanel={showAssetsPanel}
              isDownloadingUabea={isDownloadingUabea}
              onTogglePanel={() => setShowAssetsPanel(v => !v)}
              onStatusLoaded={setUabeaStatus}
              onAssetsLoaded={setAssetsFiles}
              onDownloadingChange={setIsDownloadingUabea}
            />
          )}

          {/* ── GameMaker Translator ── */}
          {(game.engine?.toLowerCase().includes('gamemaker') || game.engine?.toLowerCase().includes('game maker') || engineInfo?.engine?.toLowerCase().includes('gamemaker')) && game.installPath && (
            <div className="rounded-xl bg-[#1b2838]/60 border border-amber-500/20 p-3.5">
              <GameMakerTranslator gamePath={game.installPath} gameName={game.title || game.name || ''} />
            </div>
          )}
        </div>
      </div>

      {/* ═══ MODALS & DIALOGS (outside scroll container) ═══ */}
      {showTranslation && game && (
        <InlineTranslator gameId={(game.appid ?? 0).toString()} gameName={game.name || game.title} gamePath={game.installPath} onClose={() => setShowTranslation(false)} />
      )}

      {game && (
        <>
          <GspackExportDialog open={showGspackExport} onOpenChange={setShowGspackExport} gameName={game.title || game.name || ''} gameAppId={game.appid} platform={game.platform || 'Steam'} engine={engineInfo?.engine || game.engine} />
          <GspackImportDialog open={showGspackImport} onOpenChange={setShowGspackImport} />
        </>
      )}

      {/* Screenshot Lightbox */}
      {selectedScreenshotIndex !== null && game?.screenshots && (
        <ScreenshotLightbox
          screenshots={game.screenshots}
          selectedIndex={selectedScreenshotIndex}
          onClose={() => setSelectedScreenshotIndex(null)}
          onNavigate={setSelectedScreenshotIndex}
        />
      )}

      {/* Cover Picker (Supporta giochi Steam e non-Steam) */}
      {isCoverPickerOpen && game && (
        <CoverPicker
          isOpen={isCoverPickerOpen}
          onClose={() => setIsCoverPickerOpen(false)}
          appId={game.appid || 0}
          gameName={game.title || game.name || ''}
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
                .catch(err => clientLogger.error('Errore salvataggio cover:', err));
            });
          }}
        />
      )}
    </div>
  );
}
