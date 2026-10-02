/**
 * # Neural Translator Pro Page
 * 
 * Pagina principale per la traduzione avanzata con AI:
 * - **Sezione 1**: Imports e Types (righe 1-85)
 * - **Sezione 2**: Component & States (righe 85-250)
 * - **Sezione 3**: Effects & Callbacks (righe 250-600)
 * - **Sezione 4**: Render Helpers (righe 600-1200)
 * - **Sezione 5**: Main Render (righe 1200-2102)
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { get, set } from 'idb-keyval';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FolderOpen, FileText, ArrowLeft,
  Languages, CheckCircle, Sparkles,
  Brain, Shield, Zap, Clock, DollarSign,
  Database,
  Settings2, Info, Cpu, Wind
} from 'lucide-react';
import { toast } from 'sonner';
// import { api } from '@/lib/api-client';
import { invoke } from '@/lib/tauri-api';
import { cn } from '@/lib/utils';
import { activityHistory } from '@/lib/activity-history';
import { useTranslation } from '@/lib/i18n';

// Neural Translator imports
import {
  initializeNeuralTranslator,
  getSystemStats,
  parseFile,
  formatTimeRemaining,
  SUPPORTED_FORMATS,
  type BatchProgress,
  type BatchTranslationJob,
  type ParseResult,
  type FileFormat,
} from '@/lib/neural-translator';
import { translationMemory } from '@/lib/translation-memory';
import { getFlagEmoji } from '@/components/ui/language-flags';
import dynamic from 'next/dynamic';

// Lazy-loaded step components — only one step visible at a time
const BatchInsightsSummary = dynamic(
  () => import('@/components/translator/translation-insights').then(m => ({ default: m.BatchInsightsSummary })),
  { ssr: false }
);
const GameSelector = dynamic(
  () => import('@/components/translator-pro/game-selector').then(m => ({ default: m.GameSelector })),
  { ssr: false }
);
const FileSelector = dynamic(
  () => import('@/components/translator-pro/file-selector').then(m => ({ default: m.FileSelector })),
  { ssr: false }
);
const TranslationProgress = dynamic(
  () => import('@/components/translator-pro/translation-progress').then(m => ({ default: m.TranslationProgress })),
  { ssr: false }
);
const ReviewStep = dynamic(
  () => import('@/components/translator-pro/review-step').then(m => ({ default: m.ReviewStep })),
  { ssr: false }
);
import { getRecommendedProvider, computeCostEstimate } from '@/lib/translator-pro/cost-calculator';
import { projectService } from '@/lib/services/translation-projects';
import { exportPatchZip } from '@/lib/patch-exporter';
import { downloadBlob } from '@/lib/patch-generator';
import { getApiKeys } from '@/lib/ai/ai-translate-direct';
import { translateFileCancellable } from '@/components/translator-pro/translate-file-cancellable';
import {
  type ApplyOutcome,
  localizationTargetFilename,
  isAbsolutePath,
  buildXUnityDictionary,
} from '@/components/translator-pro/apply-to-game';

// ============================================================================
// TYPES
// ============================================================================

interface Game {
  id: string;
  name: string;
  provider: string;
  coverUrl?: string;
  installPath?: string;
  supportedLanguages?: string;
}

interface SelectedFile {
  name: string;
  path?: string;
  content: string;
  format: FileFormat;
  parseResult: ParseResult;
  checked?: boolean; // Per la selezione multipla
}

type Step = 'select-game' | 'select-files' | 'configure' | 'translate' | 'results';

// ============================================================================
// COMPONENT
// ============================================================================

import { storageManager } from '@/lib/storage-manager';
import { clientLogger } from '@/lib/client-logger';
import { setSecureKey, getSecureKey } from '@/lib/secure-key-store';
import { isTauri } from '@/lib/tauri-api';
import { useDefaultTargetLang } from '@/lib/translation/use-default-target-lang';

// Provider → chiave per-provider scritta dalle Impostazioni (letta con getApiKeys()).
const SETTINGS_KEY_BY_PROVIDER: Record<string, keyof ReturnType<typeof getApiKeys>> = {
  'openai': 'openai',
  'gpt5': 'openai',
  'gemini': 'gemini',
  'claude': 'anthropic',
  'deepseek': 'deepseek',
  'mistral': 'mistral',
  'openrouter': 'openrouter',
  'deepl': 'deepl',
};

// Provider → nome della chiave nello store cifrato (set_secure_key / get_secure_key).
const SECURE_KEY_BY_PROVIDER: Record<string, string> = {
  'openai': 'OPENAI_API_KEY',
  'gpt5': 'OPENAI_API_KEY',
  'gemini': 'GEMINI_API_KEY',
  'claude': 'ANTHROPIC_API_KEY',
  'deepseek': 'DEEPSEEK_API_KEY',
  'mistral': 'MISTRAL_API_KEY',
  'openrouter': 'OPENROUTER_API_KEY',
  'deepl': 'DEEPL_API_KEY',
  'google': 'GOOGLE_API_KEY',
};

export default function TranslatorProPage() {
  const { t } = useTranslation();
  
  // === URL PARAMS (from Translation Wizard) ===
  const searchParams = useSearchParams();
  const wizardGameId = searchParams.get('gameId');
  const wizardGameName = searchParams.get('gameName');
  const wizardInstallPath = searchParams.get('installPath');
  const wizardMethod = searchParams.get('method');
  const wizardTargetLang = searchParams.get('targetLang');
  
  // === STATES ===
  
  // Navigation
  const [currentStep, setCurrentStep] = useState<Step>('select-game');
  
  // Game selection
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [wizardApplied, setWizardApplied] = useState(false);
  
  // File selection
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [previewFile, setPreviewFile] = useState<SelectedFile | null>(null);
  const [filesWarning, setFilesWarning] = useState<{
    type: 'config' | 'empty' | 'xunity_suggested' | null;
    message: string;
    configFiles: string[];
  } | null>(null);
  
  // Configuration
  const [provider, setProvider] = useState<'openai' | 'gpt5' | 'gemini' | 'claude' | 'deepseek' | 'mistral' | 'openrouter' | 'deepl' | 'google'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('en');
  useDefaultTargetLang(setTargetLanguage);
  const [useTranslationMemory, setUseTranslationMemory] = useState(true);
  const [runQualityChecks, setRunQualityChecks] = useState(true);
  const [showAllFiles, setShowAllFiles] = useState(false); // Bypass filtro file
  
  // Carica impostazioni globali all'avvio
  useEffect(() => {
    const globalSettings = localStorage.getItem('gameStringerSettings');
    if (globalSettings) {
      try {
        const parsed = JSON.parse(globalSettings);
        if (parsed.translation?.provider) {
          setProvider(parsed.translation.provider);
        }
        // translation.apiKey è la chiave Gemini: la chiave giusta per il provider
        // scelto la carica l'effetto su [provider] qui sotto.
        if (parsed.translation?.defaultTargetLang) {
          setTargetLanguage(parsed.translation.defaultTargetLang);
        }
      } catch (e: unknown) {
        clientLogger.warn(`[TranslatorPro] Error loading global settings: ${String(e)}`);
      }
    }
  }, []);

  // Ultima chiave caricata o salvata per il provider corrente: il blur salva solo se cambia.
  const savedApiKeyRef = useRef('');

  // Carica la chiave del provider: prima quella delle Impostazioni, poi lo store cifrato.
  useEffect(() => {
    let stale = false;
    const loadKey = async () => {
      const settingsName = SETTINGS_KEY_BY_PROVIDER[provider];
      const secureName = SECURE_KEY_BY_PROVIDER[provider];
      let key = settingsName ? getApiKeys()[settingsName] : '';
      let stored: string | null = null;
      if (secureName) {
        try {
          stored = await getSecureKey(secureName);
          if (stored === '__configured__') stored = null; // segnaposto web, non è la chiave
        } catch (e: unknown) {
          clientLogger.warn(`[TranslatorPro] Lettura ${secureName} fallita: ${String(e)}`);
        }
      }
      // Le versioni precedenti di questa pagina salvavano la chiave in chiaro in
      // localStorage: in desktop la spostiamo nello store cifrato e togliamo la copia.
      const legacyName = `gamestringer_apikey_${provider}`;
      let legacy: string | null = null;
      try { legacy = localStorage.getItem(legacyName); } catch { /* storage non disponibile */ }
      if (legacy && secureName && isTauri()) {
        try {
          if (!stored) {
            await setSecureKey(secureName, legacy);
            stored = legacy;
          }
          localStorage.removeItem(legacyName);
        } catch (e: unknown) {
          clientLogger.warn(`[TranslatorPro] Migrazione ${legacyName} fallita: ${String(e)}`);
        }
      }
      key = key || stored || legacy || '';
      if (stale) return;
      savedApiKeyRef.current = key;
      setApiKey(key);
    };
    loadKey();
    return () => { stale = true; };
  }, [provider]);
  
  // Salva nello store cifrato all'uscita dal campo, non a ogni tasto.
  const handleApiKeyBlur = async () => {
    const value = apiKey.trim();
    const secureName = SECURE_KEY_BY_PROVIDER[provider];
    if (!value || !secureName || value === savedApiKeyRef.current) return;
    try {
      // In Tauri passa dal comando Rust (AES-256), non da fetch('/api/secrets').
      await setSecureKey(secureName, value);
      savedApiKeyRef.current = value;
    } catch (err: unknown) {
      clientLogger.error(`[TranslatorPro] Salvataggio ${secureName} fallito: ${String(err)}`);
      toast.error(t('common.error'), { description: String(err) });
    }
  };
  
  // Translation
  const [isTranslating, setIsTranslating] = useState(false);
  const [_isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [currentJob, setCurrentJob] = useState<BatchTranslationJob | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // Timer in secondi
  const [translatedItems, setTranslatedItems] = useState<Array<{
    id: string;
    sourceText: string;
    translatedText: string;
    fromMemory: boolean;
    metadata?: Record<string, unknown>;
  }>>([]); // Accumula results durante la traduzione
  // Ciclo di traduzione in corso: Annulla / Salva parziali lo fermano davvero.
  const translationAbortRef = useRef<AbortController | null>(null);
  
  // Results
  const [translatedFiles, setTranslatedFiles] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  
  // Apply to game
  const [isApplying, setIsApplying] = useState(false);
  const [applyStatus, setApplyStatus] = useState<'idle' | 'finding' | 'checking' | 'installing' | 'applying' | 'done' | 'error'>('idle');
  
  // Export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);
  
  // Engine detection
  const [engineInfo, setEngineInfo] = useState<{
    is_unity: boolean;
    is_unreal: boolean;
    engine_name: string;
    engine_version?: string;
    can_patch: boolean;
    message: string;
    alternative_tools: Array<{ name: string; url: string; description: string; compatible: boolean }>;
    has_bepinex: boolean;
    has_xunity: boolean;
  } | null>(null);
  const [isCheckingEngine, setIsCheckingEngine] = useState(false);
  
  // Localization files detection
  const [localizationInfo, setLocalizationInfo] = useState<{
    has_localization: boolean;
    localization_folder?: string;
    source_file?: { path: string; filename: string; language_code: string; language_name: string; size_bytes: number; format: string };
    available_languages: Array<{ path: string; filename: string; language_code: string; language_name: string; size_bytes: number; format: string }>;
    missing_italian: boolean;
    can_add_language: boolean;
    format: string;
    message: string;
  } | null>(null);
  const [gamePath, setGamePath] = useState<string>('');
  
  // Stats
  const [tmStats, setTmStats] = useState<{ totalUnits: number; verifiedUnits: number } | null>(null);
  
  // === EFFECTS ===
  
  // Timer per tempo trascorso
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTranslating && progress?.startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - progress.startTime!) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTranslating, progress?.startTime]);
  
  // Load games
  useEffect(() => {
    const loadGames = async () => {
      try {
        const cachedGames = await invoke('load_steam_games_cache');
        if (Array.isArray(cachedGames)) {
          interface CachedGame {
            is_installed?: boolean;
            title?: string;
            steam_app_id?: string | number;
            id?: string | number;
            platform?: string;
            header_image?: string;
            image_url?: string;
            install_path?: string;
            supported_languages?: string;
          }
          const installedGames = (cachedGames as CachedGame[])
            .filter((g) => g.is_installed && g.title?.trim())
            .map((g) => ({
              id: String(g.steam_app_id || g.id),
              name: g.title!,
              provider: g.platform || 'steam',
              coverUrl: g.header_image || g.image_url,
              installPath: g.install_path,
              supportedLanguages: g.supported_languages || '',
            }));
          
          const uniqueGames = Array.from(
            new Map(installedGames.map(g => [g.name, g])).values()
          ).sort((a, b) => a.name.localeCompare(b.name));
          
          setGames(uniqueGames);
        }
      } catch (err: unknown) {
        clientLogger.error(`[TranslatorPro] Error loading games: ${String(err)}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadGames();
  }, []);
  
  // Apply Translation Wizard parameters when games are loaded
  useEffect(() => {
    if (wizardApplied || loading || games.length === 0) return;
    
    if (wizardGameId && wizardGameName) {
      clientLogger.debug('[TranslatorPro] Applying Wizard params:', undefined, { wizardGameId: wizardGameId ?? '', wizardGameName: wizardGameName ?? '', wizardInstallPath: wizardInstallPath ?? '' });
      
      // Find the game in the list or create a temporary one
      let game = games.find(g => g.id === wizardGameId || g.name === wizardGameName);
      
      if (!game && wizardGameName) {
        // Create a temporary game entry from wizard data
        game = {
          id: wizardGameId,
          name: wizardGameName,
          provider: 'steam',
          installPath: wizardInstallPath || undefined,
        };
      }
      
      if (game) {
        setSelectedGame(game);
        setCurrentStep('select-files');
        
        // Apply target language if provided
        if (wizardTargetLang) {
          setTargetLanguage(wizardTargetLang);
        }
        
        clientLogger.debug('[TranslatorPro] Game pre-selected from Wizard:', game.name);
      }
      
      setWizardApplied(true);
    }
  }, [games, loading, wizardApplied, wizardGameId, wizardGameName, wizardInstallPath, wizardTargetLang]);
  
  // Initialize Neural Translator
  useEffect(() => {
    const init = async () => {
      await initializeNeuralTranslator(sourceLanguage, targetLanguage);
      const stats = getSystemStats();
      setTmStats(stats.translationMemory);
    };
    init();
  }, [sourceLanguage, targetLanguage]);
  
  // Uscendo dalla pagina il ciclo di traduzione si ferma: non deve continuare a chiamare l'API.
  useEffect(() => () => translationAbortRef.current?.abort(), []);
  
  // === COMPUTED ===
  
  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return games;
    const q = searchQuery.toLowerCase();
    return games.filter(g => g.name.toLowerCase().includes(q));
  }, [games, searchQuery]);
  
  // File selezionati per la traduzione (checked !== false)
  const checkedFiles = useMemo(() => {
    return selectedFiles.filter(f => f.checked !== false);
  }, [selectedFiles]);
  
  const totalStrings = useMemo(() => {
    return checkedFiles.reduce((sum, f) => sum + f.parseResult.strings.length, 0);
  }, [checkedFiles]);
  
  // Sistema di raccomandazione provider basato sul contenuto
  const recommendedProvider = useMemo(() => {
    return getRecommendedProvider(checkedFiles, totalStrings, targetLanguage);
  }, [checkedFiles, totalStrings, targetLanguage]);
  
  const costEstimate = useMemo(() => {
    return computeCostEstimate({ checkedFiles, provider, useTranslationMemory, tmStats });
  }, [selectedFiles, provider, useTranslationMemory, tmStats]);
  
  // === HANDLERS ===
  
  const handleGameSelect = async (game: Game) => {
    setSelectedGame(game);
    setSelectedFiles([]);
    setEngineInfo(null);
    setFilesWarning(null); // Reset warning quando si cambia game
    setCurrentStep('select-files');
    
    // Fetch dettagli Steam per ottenere le lingue supportate
    if (game.id && !game.supportedLanguages) {
      try {
        const appId = parseInt(game.id.replace('steam_', ''));
        if (!isNaN(appId)) {
          const details = await invoke('fetch_steam_game_details', { appId });
          if (details && typeof details === 'object' && 'supported_languages' in details) {
            const langs = (details as Record<string, unknown>).supported_languages as string | undefined;
            if (langs) {
              setSelectedGame(prev => prev ? { ...prev, supportedLanguages: langs } : prev);
            }
          }
        }
      } catch (err: unknown) {
        clientLogger.debug(`[TranslatorPro] Could not fetch game details: ${String(err)}`);
      }
    }
    
    // Rileva engine del game automaticamente
    setIsCheckingEngine(true);
    setLocalizationInfo(null);
    try {
      let foundPath = '';
      // Try a trovare il percorso
      try {
        foundPath = await invoke<string>('find_game_install_path', { installDir: game.name });
      } catch { /* non trovato */ }
      
      if (!foundPath && game.id) {
        const appId = parseInt(game.id.replace('steam_', ''));
        if (!isNaN(appId)) {
          try {
            foundPath = await invoke<string | null>('find_game_path_by_appid', { appId }) || '';
          } catch { /* non trovato */ }
        }
      }
      
      if (foundPath) {
        setGamePath(foundPath);
        
        // Rileva engine
        const engineCheck = await invoke<typeof engineInfo>('check_game_engine', { gamePath: foundPath });
        setEngineInfo(engineCheck);
        
        // Rileva file di localizzazione
        try {
          const locInfo = await invoke<typeof localizationInfo>('detect_localization_files', { gamePath: foundPath });
          setLocalizationInfo(locInfo);
        } catch (e: unknown) {
          clientLogger.debug(`[TranslatorPro] Could not detect localization files: ${String(e)}`);
        }
      }
    } catch (err: unknown) {
      clientLogger.debug(`[TranslatorPro] Could not detect engine: ${String(err)}`);
    } finally {
      setIsCheckingEngine(false);
    }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    setIsLoadingFiles(true);
    const newFiles: SelectedFile[] = [];
    
    for (const file of Array.from(files)) {
      try {
        const content = await file.text();
        const parseResult = parseFile(content, file.name);
        
        if (parseResult.strings.length > 0) {
          newFiles.push({
            name: file.name,
            content,
            format: parseResult.format,
            parseResult
          });
        }
      } catch (err: unknown) {
        clientLogger.error(`Error parsing ${file.name}: ${String(err)}`);
      }
    }

    setSelectedFiles(prev => {
          const existingNames = new Set(prev.map(f => f.name));
          const uniqueNewFiles = newFiles.filter(f => !existingNames.has(f.name));
          return [...prev, ...uniqueNewFiles];
        });
    setIsLoadingFiles(false);
  };
  
  const handleRemoveFile = (filename: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== filename));
  };
  
  const handleSearchGameFiles = async () => {
    if (!selectedGame?.installPath) {
      // Se non c'è un percorso di installazione, apri il file picker
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.json,.po,.pot,.xliff,.xlf,.resx,.strings,.ini,.csv,.properties,.txt';
      input.webkitdirectory = true;
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files) return;
        
        setIsLoadingFiles(true);
        const newFiles: SelectedFile[] = [];
        
        for (const file of Array.from(files)) {
          // Filtra solo i file di traduzione
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (!ext || !SUPPORTED_FORMATS.includes(ext as FileFormat)) continue;
          
          try {
            const content = await file.text();
            const parseResult = parseFile(content, file.name);
            
            if (parseResult.strings.length > 0) {
              newFiles.push({
                name: file.name,
                path: file.webkitRelativePath || file.name,
                content,
                format: parseResult.format,
                parseResult
              });
            }
          } catch (err: unknown) {
            clientLogger.error(`Error parsing ${file.name}: ${String(err)}`);
          }
        }

        setSelectedFiles(prev => {
          const existingNames = new Set(prev.map(f => f.name));
          const uniqueNewFiles = newFiles.filter(f => !existingNames.has(f.name));
          return [...prev, ...uniqueNewFiles];
        });
        setIsLoadingFiles(false);
      };
      input.click();
      return;
    }
    
    // Se c'è un percorso, cerca i file tramite Tauri commands
    setIsLoadingFiles(true);
    try {
      const fullPath = await invoke<string>('find_game_install_path', { installDir: selectedGame.installPath });
      clientLogger.debug('[TranslatorPro] Scanning path:', fullPath);
      
      // Use same scan command as Translation Wizard
      const extensions = ['json', 'csv', 'xml', 'txt', 'po', 'lang', 'loc', 'strings', 'ini'];
      const scannedFiles = await invoke<unknown[]>('scan_localization_files', {
        path: fullPath,
        extensions,
        maxDepth: 10
      });
      
      clientLogger.debug(`[TranslatorPro] Found files: ${scannedFiles?.length || 0}`);
      
      if (Array.isArray(scannedFiles) && scannedFiles.length > 0) {
        const newFiles: SelectedFile[] = [];
        
        // Filter for likely localization files (o mostra tutti se showAllFiles è attivo)
        interface ScannedFile { name: string; path: string; extension?: string; size: number; }
        const locFiles = (scannedFiles as ScannedFile[]).filter((file) => {
          const fileName = (file.name || '').toLowerCase();
          const filePath = (file.path || '').toLowerCase();
          
          // Se showAllFiles è attivo, includi tutti i file testuali
          if (showAllFiles) {
            // Escludi solo file binari e cartelle di backup
            const isBinaryOrBackup = 
              filePath.includes('gamestringer_backups') ||
              fileName.endsWith('.dll') ||
              fileName.endsWith('.exe') ||
              fileName.endsWith('.pdb');
            return !isBinaryOrBackup;
          }
          
          // ESCLUDI file di sistema e modding
          const isExcluded = 
            filePath.includes('bepinex') ||
            filePath.includes('monobleedingedge') ||
            filePath.includes('mono\\etc') ||
            filePath.includes('gamestringer_backups') ||
            fileName === 'browscap.ini' ||
            // Unity system files
            fileName.startsWith('lib_burst') ||
            fileName === 'catalog.json' ||
            fileName === 'link.xml' ||
            fileName === 'settings.json' ||
            fileName.includes('addressables') ||
            filePath.includes('\\plugins\\') ||
            filePath.includes('/plugins/') ||
            fileName.endsWith('.xml') && (fileName.includes('harmony') || fileName.includes('monomod') || fileName.includes('preloader'));
          
          if (isExcluded) return false;
          
          // Pattern per file di localizzazione
          const isLocFile = 
            fileName.includes('local') || 
            fileName.includes('lang') || 
            fileName.includes('text') ||
            fileName.includes('string') ||
            fileName.includes('dialog') ||
            fileName.includes('dialogue') ||
            fileName.includes('translation') ||
            fileName.includes('resource') ||
            fileName.includes('i18n') ||
            fileName.includes('messages') ||
            fileName.includes('ui_') ||
            fileName.includes('menu') ||
            fileName.includes('item') ||
            fileName.includes('quest') ||
            fileName.includes('npc') ||
            fileName.includes('story') ||
            fileName.includes('data') ||
            filePath.includes('example') ||
            filePath.includes('localization') ||
            filePath.includes('streamingassets') ||
            filePath.includes('resources');
          
          // Soglie più basse per includere più file
          const sizeThreshold = file.extension === 'txt' ? 500 : 1000;
          
          // Includi anche file JSON/CSV/TXT che potrebbero contenere testo
          const isTextFormat = ['json', 'csv', 'txt', 'ini', 'xml', 'yaml', 'yml'].includes(file.extension?.toLowerCase() || '');
          
          return isLocFile || (isTextFormat && file.size > sizeThreshold);
        });
        
        clientLogger.debug(`[TranslatorPro] Filtered: ${scannedFiles.length} -> ${locFiles.length} files (excluded ${scannedFiles.length - locFiles.length} system files)`);
        
        // Read and parse each file
        for (const file of locFiles.slice(0, 20)) { // Limit to 20 files
          try {
            const content = await invoke<string>('read_text_file', { 
              path: file.path, 
              maxBytes: 500000 
            });
            
            if (content) {
              try {
                const parseResult = parseFile(content, file.name);
                clientLogger.debug(`[TranslatorPro] Parsed ${file.name}: ${parseResult.strings.length} strings, format: ${parseResult.format}`);
                
                if (parseResult.strings.length > 0) {
                  newFiles.push({
                    name: file.name,
                    path: file.path,
                    content,
                    format: parseResult.format,
                    parseResult
                  });
                } else {
                  clientLogger.warn(`[TranslatorPro] ${file.name}: 0 strings found, skipping`);
                }
              } catch (parseErr: unknown) {
                clientLogger.warn(`Skipping ${file.name}: not a valid translation file - ${String(parseErr)}`);
              }
            }
          } catch (err: unknown) {
            clientLogger.error(`Error reading ${file.name}: ${String(err)}`);
          }
        }

        // 🔍 Analizza se i file sono config/sistema invece di localizzazione reale
        const CONFIG_FILE_PATTERNS = [
          'doorstop_config', 'runtimeinitialize', 'scriptingassemblies',
          'eos_steam_config', 'epiconlineservices', 'log_level_config',
          'boot_config', 'globalgamemanagers', 'unity_builtin',
          'assembly-csharp', 'mono.cecil', 'harmony', 'bepinex',
          'manifest.json', 'package.json', 'tsconfig', 'webpack'
        ];
        
        const configFiles = newFiles.filter(f => {
          const name = f.name.toLowerCase();
          return CONFIG_FILE_PATTERNS.some(pattern => name.includes(pattern));
        });
        
        const realLocFiles = newFiles.filter(f => {
          const name = f.name.toLowerCase();
          return !CONFIG_FILE_PATTERNS.some(pattern => name.includes(pattern));
        });
        
        // Se TUTTI i file sono config, mostra warning
        if (newFiles.length > 0 && realLocFiles.length === 0) {
          setFilesWarning({
            type: engineInfo?.is_unity ? 'xunity_suggested' : 'config',
            message: engineInfo?.is_unity 
              ? '⚠️ I file trovati sono di configurazione, non di localizzazione. Per tradurre questo game Unity, usa XUnity AutoTranslator.'
              : '⚠️ I file trovati sono di configurazione tecnica, non contengono testo traducibile per il giocatore.',
            configFiles: configFiles.map(f => f.name)
          });
        } else if (configFiles.length > 0) {
          // Alcuni file sono config - avvisa ma permetti di continuare
          setFilesWarning({
            type: 'config',
            message: `⚠️ ${configFiles.length} file sono di configurazione e verranno esclusi. ${realLocFiles.length} file di localizzazione trovati.`,
            configFiles: configFiles.map(f => f.name)
          });
        } else {
          setFilesWarning(null);
        }
        
        // Aggiungi solo i file di localizzazione reali (escludi config)
        setSelectedFiles(prev => {
          const existingNames = new Set(prev.map(f => f.name));
          const uniqueNewFiles = realLocFiles.filter(f => !existingNames.has(f.name));
          return [...prev, ...uniqueNewFiles];
        });
      } else {
        // Nessun file trovato - suggerisci XUnity per Unity
        if (engineInfo?.is_unity) {
          setFilesWarning({
            type: 'xunity_suggested',
            message: '📁 Nessun file di localizzazione trovato. Questo game Unity potrebbe non avere file di testo esterni. Usa XUnity AutoTranslator per tradurre il testo in-game.',
            configFiles: []
          });
        } else {
          setFilesWarning({
            type: 'empty',
            message: '📁 Nessun file di localizzazione trovato. Prova a caricare manualmente i file o usa un metodo alternativo.',
            configFiles: []
          });
        }
        clientLogger.warn('[TranslatorPro] No files found, opening file picker');
        // Fallback to file picker if no files found
        openFilePicker();
      }
    } catch (err: unknown) {
      clientLogger.error(`Error searching game files: ${String(err)}`);
      // Fallback: apri il file picker
      openFilePicker();
    }
    setIsLoadingFiles(false);
    return;
  };
  
  const openFilePicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.json,.po,.pot,.xliff,.xlf,.resx,.strings,.ini,.csv,.properties,.txt';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      
      setIsLoadingFiles(true);
      const newFiles: SelectedFile[] = [];
      for (const file of Array.from(files)) {
        try {
          const content = await file.text();
          const parseResult = parseFile(content, file.name);
          
          if (parseResult.strings.length > 0) {
            newFiles.push({
              name: file.name,
              content,
              format: parseResult.format,
              parseResult
            });
          }
        } catch (err: unknown) {
          clientLogger.error(`Error parsing ${file.name}: ${String(err)}`);
        }
      }

      setSelectedFiles(prev => {
        const existingNames = new Set(prev.map(f => f.name));
        const uniqueNewFiles = newFiles.filter(f => !existingNames.has(f.name));
        return [...prev, ...uniqueNewFiles];
      });
      setIsLoadingFiles(false);
    };
    input.click();
  };
  
  const handleStartTranslation = async () => {
    const filesToTranslate = selectedFiles.filter(f => f.checked !== false);
    if (filesToTranslate.length === 0) return;
    
    // Un ciclo ancora vivo (es. dopo Riprova) va fermato prima di avviarne un altro.
    translationAbortRef.current?.abort();
    const controller = new AbortController();
    translationAbortRef.current = controller;
    const { signal } = controller;
    // Stringhe di QUESTA corsa: lo stato translatedItems letto qui sotto sarebbe quello del render precedente.
    const runItems: typeof translatedItems = [];

    setIsTranslating(true);
    setIsPaused(false);
    setError(null);
    setProgress(null);
    setTranslatedFiles(new Map());
    setTranslatedItems([]); // Reset results accumulati
    
    // 🎯 Crea/recupera progetto automaticamente
    let currentProject = null;
    if (selectedGame?.id) {
      try {
        currentProject = await projectService.createOrGetProject({
          gameId: selectedGame.id,
          gameName: selectedGame.name || 'Unknown Game',
          gameImage: selectedGame.coverUrl,
          sourceLanguage,
          targetLanguage,
          files: filesToTranslate.map(f => ({
            path: f.name,
            name: f.name,
            type: f.parseResult?.format || 'unknown',
            strings: f.parseResult?.strings?.length || 0
          }))
        });
        clientLogger.debug(`[Neural Translator] Progetto: ${currentProject.id}`);
      } catch (e) {
        clientLogger.warn('[Neural Translator] Impossibile creare progetto:', e);
      }
    }
    
    clientLogger.debug(`[Neural Translator] Starting translation with provider: ${provider}`);
    clientLogger.debug(`[Neural Translator] Files to translate: ${filesToTranslate.length}`);
    clientLogger.debug(`[Neural Translator] API Key present: ${!!apiKey}`);
    
    try {
      for (const file of filesToTranslate) {
        if (signal.aborted) return;
        clientLogger.debug('[Neural Translator] Translating file:', file.name);
        const result = await translateFileCancellable(file.parseResult, file.name, {
          sourceLanguage,
          targetLanguage,
          provider,
          gameId: selectedGame?.id,
          gameName: selectedGame?.name,
          useTranslationMemory,
          runQualityChecks,
          apiKey, // Passa l'API key inserita dall'utente
          onProgress: (p) => {
            clientLogger.debug(`[Neural Translator] Progress: ${p.completed}/${p.total}`);
            setProgress(p);
          },
          onItemComplete: (item) => {
            // Accumula results tradotti per salvataggio parziale
            if (item.status === 'completed' && item.translatedText) {
              const entry = {
                id: item.id,
                sourceText: item.sourceText,
                translatedText: item.translatedText,
                fromMemory: item.fromMemory,
                metadata: item.metadata,
              };
              runItems.push(entry);
              setTranslatedItems(prev => [...prev, entry]);
            }
          }
        }, signal);
        if (!result) return; // annullata: niente risultati, niente step 'results'
        
        setCurrentJob(result.job);
        setTranslatedFiles(prev => new Map(prev).set(file.name, result.translatedContent));
      }
      if (signal.aborted) return;
      
      // Traccia attività completata
      await activityHistory.add({
        activity_type: 'translation',
        title: `Traduzione ${selectedGame?.name || 'file'} completata`,
        description: `${filesToTranslate.length} file tradotti (${sourceLanguage} → ${targetLanguage})`,
        game_name: selectedGame?.name,
        game_id: selectedGame?.id,
        metadata: {
          files_count: filesToTranslate.length,
          source_language: sourceLanguage,
          target_language: targetLanguage,
          provider: provider
        }
      });
      
      // Salva statistica traduzione per dashboard (su IndexedDB).
      // Lettura e scrittura strict: con la variante tollerante una lettura fallita
      // diventa [] e la scrittura cancellerebbe tutte le stringhe dell'Editor.
      try {
        const savedTranslations = await storageManager.getTranslationsStrict();
        savedTranslations.push({
          id: `trans_${Date.now()}`,
          gameId: selectedGame?.id,
          gameName: selectedGame?.name,
          title: `Traduzione completata: ${selectedGame?.name || 'File locale'}`,
          description: `Tradotti ${runItems.length} testi in ${targetLanguage}`,
          activity_type: 'translation',
          status: 'completed',
          timestamp: new Date().toISOString()
        });
        await storageManager.saveTranslationsStrict(savedTranslations);
      } catch (e) {
        clientLogger.warn(`[TranslatorPro] Statistica traduzione non salvata: ${String(e)}`);
      }
      
      // 🧠 Salva automaticamente in Translation Memory
      if (runItems.length > 0) {
        const tmBatch = runItems
          .filter(item => item.translatedText && item.sourceText && item.sourceText.length > 2)
          .map(item => ({
            source: item.sourceText,
            target: item.translatedText,
            gameId: selectedGame?.id,
            context: selectedGame?.name,
          }));
        
        if (tmBatch.length > 0) {
          await translationMemory.addBatch(tmBatch);
          clientLogger.debug(`[Neural Translator] ✅ saved ${tmBatch.length} traduzioni in TM`);
        }
      }
      
      if (signal.aborted) return;
      setCurrentStep('results');
    } catch (err: unknown) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : String(err));
    } finally {
      // Solo se è ancora la corsa corrente: una corsa vecchia non deve spegnere quella nuova.
      if (translationAbortRef.current === controller) setIsTranslating(false);
    }
  };
  
  const handleDownloadFile = (filename: string) => {
    const content = translatedFiles.get(filename);
    if (!content) return;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${targetLanguage}_${filename}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleSaveFile = async (filename: string) => {
    const content = translatedFiles.get(filename);
    const originalFile = selectedFiles.find(f => f.name === filename);
    if (!content || !originalFile?.path) return;
    
    try {
      const result = await invoke<{ success: boolean; backup_path?: string; message: string }>('save_file_with_backup', {
        filePath: originalFile.path,
        content,
        createBackup: true,
      });
      
      if (result.success) {
        alert(`✅ File salvato!\n${result.backup_path ? `Backup creato: ${result.backup_path}` : ''}`);
      }
    } catch (err: unknown) {
      clientLogger.error(`Error saving file: ${String(err)}`);
      alert(`❌ error nel salvataggio: ${err}`);
    }
  };
  
  const handleSaveAllFiles = async () => {
    for (const [filename] of translatedFiles.entries()) {
      await handleSaveFile(filename);
    }
  };
  
  const handleOpenInEditor = (filename: string) => {
    const content = translatedFiles.get(filename);
    const originalFile = selectedFiles.find(f => f.name === filename);
    if (!content) return;
    
    // Salva i dati in sessionStorage per l'Editor
    const editorData = {
      filename: `${targetLanguage}_${filename}`,
      originalFilename: filename,
      content,
      originalContent: originalFile?.content || '',
      format: originalFile?.format || 'json',
      gameId: selectedGame?.id,
      gameName: selectedGame?.name,
      filePath: originalFile?.path,
      sourceLanguage,
      targetLanguage,
    };
    
    sessionStorage.setItem('editorFile', JSON.stringify(editorData));
    
    // Naviga all'Editor
    window.location.href = '/editor';
  };
  
  const handleDownloadAll = () => {
    translatedFiles.forEach((content, filename) => {
      handleDownloadFile(filename);
    });
  };
  
  // === EXPORT PATCH ZIP ===
  const handleExportPatch = async () => {
    clientLogger.debug(`[ExportPatch] Clicked! selectedGame: ${selectedGame?.name}, translatedFiles: ${translatedFiles.size}`);
    
    if (!selectedGame || translatedFiles.size === 0) {
      toast.error('Nessun file da esportare', {
        description: `Completa prima una traduzione. (Game: ${selectedGame?.name || 'none'}, Files: ${translatedFiles.size})`,
      });
      return;
    }

    try {
      toast.info('Creazione patch...', {
        description: 'Generazione del pacchetto ZIP in corso.',
      });
      
      // Prepara i file per l'esportazione
      const files = Array.from(translatedFiles.entries()).map(([filename, content]) => {
        const sourceFile = selectedFiles.find(f => f.name === filename.replace(`${targetLanguage}_`, ''));
        return {
          originalPath: sourceFile?.path || filename,
          relativePath: filename,
          content,
          originalContent: sourceFile?.content || undefined,
          format: filename.split('.').pop() || 'txt',
          stringCount: sourceFile?.parseResult.strings.length || 0
        };
      });
      
      // Metadata
      const metadata = {
        gameName: selectedGame.name,
        gameId: selectedGame.id,
        sourceLanguage,
        targetLanguage,
        translatedBy: 'GameStringer User',
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        totalStrings: totalStrings,
        totalFiles: files.length,
        provider,
        notes: `Traduzione automatica da ${sourceLanguage.toUpperCase()} a ${targetLanguage.toUpperCase()}`
      };
      
      // ZIP generato nel client: /api/export/patch è solo uno stub 501 (export statico).
      clientLogger.debug(`[ExportPatch] Building ZIP with ${files.length} files`);
      clientLogger.debug(`[ExportPatch] Metadata: ${JSON.stringify(metadata)}`);
      
      const blob = await exportPatchZip(files, metadata, {
        includeBackup: true,
        includeReadme: true,
        includeMetadata: true,
        xunityFormat: true
      });
      clientLogger.debug(`[ExportPatch] Blob size: ${blob.size}`);
      
      const filename = `${selectedGame.name.replace(/[^a-zA-Z0-9]/g, '_')}_${targetLanguage}_patch.zip`;
      
      // Desktop: salva sul Desktop come app/auto-translate (get_desktop_path + save_binary_file).
      // Un errore qui va al catch esterno: niente fallback silenzioso né toast di successo.
      if (isTauri()) {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Converti in base64
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);
        
        // Salva sul Desktop usando Tauri
        const desktopPath = await invoke<string>('get_desktop_path');
        const fullPath = `${desktopPath}\\${filename}`;
        
        await invoke('save_binary_file', {
          filePath: fullPath,
          base64Content: base64
        });
        
        clientLogger.debug('[ExportPatch] File saved to:', fullPath);
        
        // Mostra dialog di conferma
        setExportedFilePath(fullPath);
        setExportDialogOpen(true);
        return;
      }
        
      // Browser: download diretto
      downloadBlob(blob, filename);
      clientLogger.debug('[ExportPatch] Download completed!');
      
      toast.success('✅ Patch esportata!', {
        description: 'Il pacchetto ZIP include file tradotti, backup e formato XUnity.AutoTranslator.',
      });

    } catch (error: unknown) {
      clientLogger.error(`[ExportPatch] Error: ${String(error)}`);
      toast.error('error esportazione', {
        description: error instanceof Error ? error.message : 'error sconosciuto',
      });
    }
  };
  
  // === APPLY TO GAME (ONE-CLICK MAGIC) ===
  const handleApplyToGame = async () => {
    clientLogger.debug(`[ApplyToGame] Inizio - selectedGame: ${selectedGame?.name}, translatedFiles: ${translatedFiles.size}`);
    if (!selectedGame || translatedFiles.size === 0) {
      clientLogger.debug('[ApplyToGame] Uscita anticipata - No game o file');
      return;
    }
    
    setIsApplying(true);
    setApplyStatus('finding');
    
    try {
      // Usa gamePath già rilevato o trova nuovo
      let currentGamePath = gamePath;
      
      if (!currentGamePath) {
        try {
          currentGamePath = await invoke<string>('find_game_install_path', { installDir: selectedGame.name });
        } catch { /* non trovato */ }
        
        if (!currentGamePath && selectedGame.id) {
          const appId = parseInt(selectedGame.id.replace('steam_', ''));
          if (!isNaN(appId)) {
            try {
              currentGamePath = await invoke<string | null>('find_game_path_by_appid', { appId }) || '';
            } catch { /* non trovato */ }
          }
        }
      }
      
      if (!currentGamePath) {
        toast.error('game non trovato', {
          description: 'Non riesco a trovare la cartella del game. Usa "Scarica tutti" e copia manualmente.',
        });
        setApplyStatus('error');
        setIsApplying(false);
        return;
      }
      
      setApplyStatus('applying');
      clientLogger.debug('[ApplyToGame] gamePath:', currentGamePath);
      clientLogger.debug(`[ApplyToGame] localizationInfo: ${JSON.stringify(localizationInfo)}`);
      clientLogger.debug(`[ApplyToGame] engineInfo: ${JSON.stringify(engineInfo)}`);
      
      // Esito per ogni file: il riepilogo finale dice cosa è stato scritto davvero.
      const outcomes: ApplyOutcome[] = [];
      const failedDetail = (e: unknown) =>
        t('translatorProPage.applyResult.failed').replace('{error}', e instanceof Error ? e.message : String(e));
      let method: 'direct' | 'xunity' | 'fallback';
      let successHint = '';

      // METODO 1: File di localizzazione diretti (preferito se disponibili)
      if (localizationInfo?.has_localization && localizationInfo.can_add_language) {
        clientLogger.debug('[ApplyToGame] Usando METODO 1 - File localizzazione diretti');
        method = 'direct';
        // Diventa la nuova lingua solo il file tradotto che corrisponde al file lingua
        // del gioco; per gli altri questo metodo non ha una destinazione.
        const sourceLoc = localizationInfo.source_file;
        const folder = localizationInfo.localization_folder;
        for (const [filename, content] of translatedFiles.entries()) {
          const original = selectedFiles.find(f => f.name === filename);
          if (!folder || !sourceLoc || (filename !== sourceLoc.filename && original?.path !== sourceLoc.path)) {
            outcomes.push({ file: filename, status: 'skipped', detail: t('translatorProPage.applyResult.notLanguageFile') });
            continue;
          }
          // Stesso percorso di apply_translation_file, ma con backup se il file esiste già.
          const targetName = localizationTargetFilename(sourceLoc.filename, localizationInfo.format, targetLanguage || 'it');
          try {
            const result = await invoke<{ success: boolean; backup_path?: string; message: string }>('save_file_with_backup', {
              filePath: `${folder}/${targetName}`,
              content,
              createBackup: true,
            });
            if (!result.success) throw new Error(result.message);
            outcomes.push({ file: `${filename} → ${targetName}`, status: 'written', detail: t('translatorProPage.applyResult.written') });
            successHint = t('translatorProPage.applyResult.languageHint');
          } catch (e: unknown) {
            clientLogger.warn(`[ApplyToGame] error salvataggio file: ${filename} - ${String(e)}`);
            outcomes.push({ file: filename, status: 'failed', detail: failedDetail(e) });
          }
        }
      }
      // METODO 2: XUnity AutoTranslator (per Unity senza file loc diretti)
      else if (engineInfo?.is_unity || engineInfo?.can_patch) {
        clientLogger.debug('[ApplyToGame] Usando METODO 2 - XUnity AutoTranslator');
        method = 'xunity';
        setApplyStatus('checking');
        const hasPatcher = engineInfo?.has_bepinex && engineInfo?.has_xunity;
        
        // Installa patcher se manca: senza patcher il dizionario non verrebbe mai letto.
        if (!hasPatcher) {
          setApplyStatus('installing');
          toast.info('Installazione patcher...', { description: 'BepInEx + XUnity AutoTranslator' });
          
          try {
            const exeName = selectedGame.name.replace(/[^a-zA-Z0-9]/g, '') + '.exe';
            const status = await invoke<{ success: boolean; message: string }>('install_unity_autotranslator', {
              gamePath: currentGamePath, 
              gameExeName: exeName,
              targetLang: targetLanguage 
            });
            if (status && status.success === false) throw new Error(status.message);
          } catch (e: unknown) {
            clientLogger.warn(`Installazione patcher fallita: ${String(e)}`);
            throw new Error(t('translatorProPage.applyResult.patcherFailed').replace('{error}', e instanceof Error ? e.message : String(e)));
          }
        }
        
        setApplyStatus('applying');
        
        // Dizionario XUnity dalle stringhe tradotte (non dalle righe con '=' dei file)
        const dictionaryLines = buildXUnityDictionary(translatedItems);
        const dictionaryFile = '_GameStringer.txt';
        const xunityPath = `${currentGamePath}/BepInEx/Translation/${targetLanguage}/Text`;
        if (dictionaryLines.length === 0) {
          outcomes.push({ file: dictionaryFile, status: 'skipped', detail: t('translatorProPage.applyResult.noEntries') });
        } else {
          try {
            // File generato da GameStringer, non un file del gioco: niente copia di backup
            // dentro Text/, dove XUnity la caricherebbe come un secondo dizionario.
            await invoke('ensure_directory', { path: xunityPath });
            await invoke('write_text_file', {
              path: `${xunityPath}/${dictionaryFile}`,
              content: dictionaryLines.join('\n')
            });
            outcomes.push({ file: dictionaryFile, status: 'written', detail: t('translatorProPage.applyResult.written') });
            successHint = t('translatorProPage.applyResult.xunityHint').replace('{n}', String(dictionaryLines.length));
          } catch (e: unknown) {
            clientLogger.warn(`[ApplyToGame] Dizionario XUnity non scritto: ${String(e)}`);
            outcomes.push({ file: dictionaryFile, status: 'failed', detail: failedDetail(e) });
          }
        }
      }
      // METODO 3: Nessun metodo disponibile - fallback a salvataggio diretto
      else {
        clientLogger.debug('[ApplyToGame] METODO 3 - Fallback salvataggio diretto');
        method = 'fallback';
        // Sovrascrive il file originale del gioco (con backup). Senza percorso reale il
        // file finirebbe nella radice del gioco col solo nome: lo si salta.
        for (const [filename, content] of translatedFiles.entries()) {
          const originalPath = selectedFiles.find(f => f.name === filename)?.path;
          if (!originalPath || !isAbsolutePath(originalPath)) {
            outcomes.push({ file: filename, status: 'skipped', detail: t('translatorProPage.applyResult.unknownLocation') });
            continue;
          }
          try {
            clientLogger.debug('[ApplyToGame] Salvando:', originalPath);
            const result = await invoke<{ success: boolean; backup_path?: string; message: string }>('save_file_with_backup', {
              filePath: originalPath,
              content,
              createBackup: true,
            });
            if (!result.success) throw new Error(result.message);
            outcomes.push({ file: filename, status: 'written', detail: t('translatorProPage.applyResult.written') });
          } catch (e: unknown) {
            clientLogger.warn(`[ApplyToGame] error salvataggio file: ${filename} - ${String(e)}`);
            outcomes.push({ file: filename, status: 'failed', detail: failedDetail(e) });
          }
        }
      }
        
      const writtenCount = outcomes.filter(o => o.status === 'written').length;
      const allWritten = writtenCount > 0 && writtenCount === outcomes.length;
      setApplyStatus(allWritten ? 'done' : 'error');
      (allWritten ? toast.success : toast.error)(t(allWritten
          ? 'translatorProPage.applyResult.allTitle'
          : writtenCount > 0
            ? 'translatorProPage.applyResult.partialTitle'
            : 'translatorProPage.applyResult.noneTitle'), {
        description: (
          <div className="space-y-1">
            <ul className="max-h-40 overflow-y-auto text-xs space-y-0.5">
              {outcomes.map(o => (
                <li key={o.file}>{o.status === 'written' ? '✓' : '✗'} {o.file}: {o.detail}</li>
              ))}
            </ul>
            {writtenCount > 0 && successHint && <p className="text-xs">{successHint}</p>}
            {!allWritten && <p className="text-xs">{t('translatorProPage.applyResult.manualHint')}</p>}
          </div>
        ),
      });
      
      // Salva in Translation Memory (batch per evitare loop di salvataggi)
      const tmBatch = translatedItems
        .filter(item => item.translatedText && item.sourceText)
        .map(item => ({
          source: item.sourceText,
          target: item.translatedText,
          gameId: selectedGame.id,
          context: selectedGame.name,
        }));
      
      if (tmBatch.length > 0) {
        // I file sono già scritti: un errore della TM non deve far risultare fallita l'applicazione.
        try {
          await translationMemory.addBatch(tmBatch);
          clientLogger.debug(`[ApplyToGame] saved ${tmBatch.length} traduzioni in TM`);
        } catch (e: unknown) {
          clientLogger.warn(`[ApplyToGame] Salvataggio TM fallito: ${String(e)}`);
        }
      }

      // Patch registrata solo se almeno un file è stato scritto davvero
      if (writtenCount > 0) {
        // Salva statistica patch per dashboard in IndexedDB
        try {
          const savedPatches = await get<unknown[]>('gamePatches') || [];
          savedPatches.push({
            id: `patch_${Date.now()}`,
            gameId: selectedGame.id,
            gameName: selectedGame.name,
            gamePath: currentGamePath,
            method,
            translationsCount: tmBatch.length,
            status: allWritten ? 'applied' : 'partial',
            timestamp: new Date().toISOString()
          });
          await set('gamePatches', savedPatches);
        } catch (e: unknown) {
          clientLogger.warn(`Errore salvataggio patch in IndexedDB: ${String(e)}`);
        }

        // Traccia attività patch per sincronizzazione
        await activityHistory.add({
          activity_type: 'patch',
          title: `Patch applicata: ${selectedGame.name}`,
          description: `${tmBatch.length} traduzioni applicate al game`,
          game_name: selectedGame.name,
          game_id: selectedGame.id,
          metadata: {
            method,
            translations_count: tmBatch.length
          }
        });
      }
      
    } catch (e: unknown) {
      clientLogger.error(`error applicazione: ${String(e)}`);
      setApplyStatus('error');
      toast.error('error', {
        description: `${e}. Usa "Scarica tutti" e copia manualmente.`,
      });
    } finally {
      setIsApplying(false);
    }
  };
  
  // === STEP INDICATOR ===
  
  const steps = [
    { id: 'select-game', label: 'game', icon: Languages },
    { id: 'select-files', label: 'File', icon: FileText },
    { id: 'configure', label: 'Configura', icon: Settings2 },
    { id: 'translate', label: 'Traduci', icon: Sparkles },
    { id: 'results', label: 'results', icon: CheckCircle },
  ];
  
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  
  // === RENDER ===
  
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-muted-foreground">{t('translatorProPage.loading')}</p>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl border bg-card p-3 mb-4">
        {/* Immagine game fusa nello sfondo */}
        {selectedGame?.coverUrl && (
          <>
            <div className="absolute inset-0">
              <img
                src={selectedGame.coverUrl}
                alt={selectedGame.name || 'Game'}
                className="w-full h-full object-cover opacity-15"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/60" />
          </>
        )}
        
        <div className="relative flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary text-primary-foreground">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">
              {selectedGame ? `Neural Translator Pro • ${selectedGame.name}` : 'Neural Translator Pro'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t('translatorProPage.subtitle')}</p>
          </div>
          
          {/* Actions */}
          <div className="ml-auto flex items-center gap-2">
            <a href="/translator/mtpe">
              <Badge variant="outline" className="gap-1.5 cursor-pointer transition-colors hover:bg-accent">
                <Sparkles className="h-3 w-3" />
                MTPE
              </Badge>
            </a>
            {tmStats && (
              <Badge variant="outline" className="gap-1.5">
                <Database className="h-3 w-3" />
                {tmStats.totalUnits} TM
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      {/* Step Indicator - Compact */}
      <div className="mb-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "bg-green-700 text-white",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}>
                    {isCompleted ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={cn(
                    "text-2xs mt-1 font-medium",
                    isActive && "text-primary",
                    isCompleted && "text-green-800 dark:text-green-400",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "w-8 h-0.5 mx-1 transition-colors",
                    index < currentStepIndex ? "bg-green-700" : "bg-muted"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto">
        
        {/* Step 1: Select Game */}
        {currentStep === 'select-game' && (
          <GameSelector
            games={filteredGames}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onGameSelect={handleGameSelect}
          />
        )}
        
        {/* Step 2: Select Files */}
        {currentStep === 'select-files' && (
          <FileSelector
            selectedGame={selectedGame}
            selectedFiles={selectedFiles}
            previewFile={previewFile}
            isLoadingFiles={isLoadingFiles}
            isCheckingEngine={isCheckingEngine}
            engineInfo={engineInfo}
            localizationInfo={localizationInfo}
            filesWarning={filesWarning}
            totalStrings={totalStrings}
            checkedFilesCount={checkedFiles.length}
            wizardGameId={wizardGameId}
            wizardMethod={wizardMethod}
            wizardTargetLang={wizardTargetLang}
            onGoBack={() => setCurrentStep('select-game')}
            onSearchGameFiles={handleSearchGameFiles}
            onFileUpload={handleFileUpload}
            onRemoveFile={handleRemoveFile}
            onPreviewFile={setPreviewFile}
            onToggleFileChecked={(filename, checked) => {
              setSelectedFiles(prev => prev.map(f =>
                f.name === filename ? { ...f, checked } : f
              ));
            }}
            onSelectAll={() => {
              setSelectedFiles(prev => prev.map(f => ({ ...f, checked: true })));
            }}
            onSelectNone={() => {
              setSelectedFiles(prev => prev.map(f => ({ ...f, checked: false })));
            }}
            onRemoveUnselected={() => {
              const checked = selectedFiles.filter(f => f.checked !== false);
              setSelectedFiles(checked.length > 0 ? checked : []);
              setPreviewFile(null);
            }}
            onContinue={() => setCurrentStep('configure')}
            onLoadSourceFile={async () => {
              if (!localizationInfo?.source_file) return;
              setIsLoadingFiles(true);
              try {
                const content = await invoke<string>('read_file_content', { filePath: localizationInfo.source_file.path });
                const parseResult = parseFile(content, localizationInfo.source_file.filename);
                if (parseResult.strings.length > 0) {
                  setSelectedFiles([{ name: localizationInfo.source_file.filename, path: localizationInfo.source_file.path, content, format: parseResult.format, parseResult }]);
                  toast.success('✓ Caricato!', { description: `${parseResult.strings.length} stringhe` });
                }
              } catch (e: unknown) {
                toast.error('error', { description: `${e}` });
              } finally {
                setIsLoadingFiles(false);
              }
            }}
            onGoToUnityPatcher={() => {
              window.location.href = `/unity-patcher?gameId=${selectedGame?.id}&gameName=${encodeURIComponent(selectedGame?.name || '')}`;
            }}
          />
        )}
        
        {/* Step 3: Configure */}
        {currentStep === 'configure' && (
          <div className="space-y-6">
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep('select-files')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('translatorProPage.editFile')}</Button>
            
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-muted/50 border text-center">
                <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold">{checkedFiles.length}</p>
                <p className="text-xs text-muted-foreground">{t('translatorProPage.file')}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border text-center">
                <Languages className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold">{totalStrings}</p>
                <p className="text-xs text-muted-foreground">{t('translatorProPage.stringhe')}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border text-center">
                <Database className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold">{tmStats?.totalUnits || 0}</p>
                <p className="text-xs text-muted-foreground">{t('translatorProPage.fromMemory')}</p>
              </div>
            </div>
            
            {/* AI Recommendation */}
            {recommendedProvider && (
              <div className={cn(
                "p-4 rounded-xl border transition-colors",
                provider === recommendedProvider.provider 
                  ? "border-green-600/40 bg-green-600/5" 
                  : "border-yellow-600/40 bg-yellow-600/5"
              )}>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{t('translatorProPage.aiRecommendation')}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(recommendedProvider.confidence * 100)}% {t('translatorProPage.confidence')}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {recommendedProvider.reason}
                    </p>
                    {provider !== recommendedProvider.provider && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setProvider(recommendedProvider.provider as typeof provider)}
                        className="gap-2"
                      >
                        <CheckCircle className="h-3 w-3" />
                        {t('translatorProPage.use')}{recommendedProvider.provider === 'gpt5' ? 'GPT-4o' : 
                             recommendedProvider.provider === 'claude' ? 'Claude' :
                             recommendedProvider.provider === 'gemini' ? 'Gemini' :
                             recommendedProvider.provider === 'deepseek' ? 'DeepSeek' :
                             recommendedProvider.provider}
                      </Button>
                    )}
                    {provider === recommendedProvider.provider && (
                      <p className="text-sm text-green-800 dark:text-green-400 font-medium flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        {t('translatorProPage.recommendedSelected')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Configuration */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('translatorProPage.providerAi')}</Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* 🏆 BEST VALUE - Economici e veloci */}
                      <SelectItem value="deepseek">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          <span>{t('translatorProPage.deepseekV3')}</span>
                          <Badge variant="outline" className="text-micro ml-1 text-green-800 dark:text-green-400 border-green-600/30">CHEAPEST</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="gemini">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                          <span>{t('translatorProPage.gemini20Flash')}</span>
                          <Badge variant="outline" className="text-micro ml-1 text-muted-foreground">FAST</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="openai">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          <span>{t('translatorProPage.gpt4oMini')}</span>
                          <Badge variant="outline" className="text-micro ml-1 text-muted-foreground">$0.15/1M</Badge>
                        </div>
                      </SelectItem>
                      
                      {/* 🎯 BEST QUALITY - Alta qualità per games */}
                      <SelectItem value="claude">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-muted-foreground" />
                          <span>{t('translatorProPage.claude35Sonnet')}</span>
                          <Badge variant="outline" className="text-micro ml-1 text-muted-foreground">BEST</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="gpt5">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          <span>{t('translatorProPage.gpt4o')}</span>
                          <Badge variant="outline" className="text-micro ml-1 text-muted-foreground">RELIABLE</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="mistral">
                        <div className="flex items-center gap-2">
                          <Wind className="h-4 w-4 text-muted-foreground" />
                          <span>{t('translatorProPage.mistralSmall4')}</span>
                          <Badge variant="outline" className="text-micro ml-1 text-muted-foreground">EU</Badge>
                        </div>
                      </SelectItem>
                      
                      {/* Altri */}
                      <SelectItem value="openrouter">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-muted-foreground" />
                          <span>OpenRouter</span>
                          <Badge variant="outline" className="text-micro ml-1 text-muted-foreground">MULTI</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="deepl">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-muted-foreground" />
                          <span>{t('translatorProPage.deeplPro')}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="google">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-muted-foreground" />
                          <span>{t('translatorProPage.googleTranslate')}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
                  <Label>{t('translatorProPage.apiKey')}</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onBlur={handleApiKeyBlur}
                    placeholder={t('translatorProPage.apiKeyPh')}
                    autoComplete="off"
                  />
                </form>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t('common.sourceLanguage') || 'Source language'}</Label>
                    <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('common.selectLanguage')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en"><span className="flex items-center gap-2">{getFlagEmoji('GB')} {t('languages.en')}</span></SelectItem>
                        <SelectItem value="de"><span className="flex items-center gap-2">{getFlagEmoji('DE')} {t('languages.de')}</span></SelectItem>
                        <SelectItem value="fr"><span className="flex items-center gap-2">{getFlagEmoji('FR')} {t('languages.fr')}</span></SelectItem>
                        <SelectItem value="es"><span className="flex items-center gap-2">{getFlagEmoji('ES')} {t('languages.es')}</span></SelectItem>
                        <SelectItem value="ja"><span className="flex items-center gap-2">{getFlagEmoji('JP')} 日本語</span></SelectItem>
                        <SelectItem value="zh"><span className="flex items-center gap-2">{getFlagEmoji('CN')} 中文</span></SelectItem>
                        <SelectItem value="ko"><span className="flex items-center gap-2">{getFlagEmoji('KR')} 한국어</span></SelectItem>
                        <SelectItem value="ru"><span className="flex items-center gap-2">{getFlagEmoji('RU')} Русский</span></SelectItem>
                        <SelectItem value="pt"><span className="flex items-center gap-2">{getFlagEmoji('BR')} {t('languages.pt')}</span></SelectItem>
                        <SelectItem value="pl"><span className="flex items-center gap-2">{getFlagEmoji('PL')} {t('languages.pl')}</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('common.targetLanguage') || 'Target language'}</Label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('common.selectLanguage')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it"><span className="flex items-center gap-2">{getFlagEmoji('IT')} {t('languages.it')}</span></SelectItem>
                        <SelectItem value="en"><span className="flex items-center gap-2">{getFlagEmoji('GB')} {t('languages.en')}</span></SelectItem>
                        <SelectItem value="de"><span className="flex items-center gap-2">{getFlagEmoji('DE')} {t('languages.de')}</span></SelectItem>
                        <SelectItem value="fr"><span className="flex items-center gap-2">{getFlagEmoji('FR')} {t('languages.fr')}</span></SelectItem>
                        <SelectItem value="es"><span className="flex items-center gap-2">{getFlagEmoji('ES')} {t('languages.es')}</span></SelectItem>
                        <SelectItem value="ja"><span className="flex items-center gap-2">{getFlagEmoji('JP')} 日本語</span></SelectItem>
                        <SelectItem value="zh"><span className="flex items-center gap-2">{getFlagEmoji('CN')} 中文</span></SelectItem>
                        <SelectItem value="ko"><span className="flex items-center gap-2">{getFlagEmoji('KR')} 한국어</span></SelectItem>
                        <SelectItem value="ru"><span className="flex items-center gap-2">{getFlagEmoji('RU')} Русский</span></SelectItem>
                        <SelectItem value="pt"><span className="flex items-center gap-2">{getFlagEmoji('BR')} {t('languages.pt')}</span></SelectItem>
                        <SelectItem value="pl"><span className="flex items-center gap-2">{getFlagEmoji('PL')} {t('languages.pl')}</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              {/* Right Column - Options */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl border space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    {t('translatorProPage.advancedOptions')}</h3>
                  
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('translatorProPage.usaTranslationMemory')}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={useTranslationMemory}
                      onChange={(e) => setUseTranslationMemory(e.target.checked)}
                      className="rounded"
                    />
                  </label>
                  
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('translatorProPage.qualityChecks')}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={runQualityChecks}
                      onChange={(e) => setRunQualityChecks(e.target.checked)}
                      className="rounded"
                    />
                  </label>
                  
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('translatorProPage.showAllFiles')}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showAllFiles}
                      onChange={(e) => setShowAllFiles(e.target.checked)}
                      className="rounded"
                    />
                  </label>
                  {showAllFiles && (
                    <p className="text-xs text-yellow-900 dark:text-yellow-500">
                      ⚠️ {t('translatorProPage.bypassWarning')}</p>
                  )}
                </div>
                
                {/* Cost Estimate */}
                {costEstimate && (
                  <div className="p-4 rounded-xl bg-muted/50 border">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      {t('translatorProPage.estimate')}</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>~{formatTimeRemaining(costEstimate.estimatedTime)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>~${costEstimate.estimatedCost.toFixed(4)}</span>
                      </div>
                      <div className="col-span-2 text-xs text-muted-foreground">
                        {costEstimate.breakdown.estimatedTmHits}  {t('translatorProPage.fromMemory')} {costEstimate.breakdown.estimatedApiCalls}  {t('translatorProPage.fromApi')}</div>
                    </div>
                  </div>
                )}
                
                {/* Content Analysis - Auto-routing preview */}
                {checkedFiles.length > 0 && (
                  <BatchInsightsSummary 
                    items={checkedFiles.flatMap(f => 
                      f.parseResult.strings.map(s => ({ source: s.value }))
                    ).slice(0, 100)}
                    targetLanguage={targetLanguage}
                  />
                )}
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <Button
                onClick={() => { setCurrentStep('translate'); handleStartTranslation(); }}
                disabled={!apiKey}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {t('translatorProPage.startTranslation')}</Button>
            </div>
          </div>
        )}
        
        {/* Step 4: Translate */}
        {currentStep === 'translate' && (
          <TranslationProgress
            isTranslating={isTranslating}
            progress={progress}
            error={error}
            elapsedTime={elapsedTime}
            translatedItems={translatedItems}
            selectedGame={selectedGame}
            targetLanguage={targetLanguage}
            onSavePartialResults={() => {
              translationAbortRef.current?.abort();
              setIsTranslating(false);

              // Save partial results to IndexedDB for persistence
              let saved: Promise<void> | null = null;
              if (translatedItems.length > 0 && selectedFiles.length > 0 && progress) {
                const partialResults = {
                  timestamp: Date.now(),
                  gameId: selectedGame?.id,
                  gameName: selectedGame?.name,
                  // La coppia di lingue reale: senza, l'Editor ricadeva su en → lingua predefinita.
                  sourceLanguage,
                  targetLanguage,
                  completed: progress.completed,
                  total: progress.total,
                  items: translatedItems,
                };

                saved = set('gamestringer_partial_translations', partialResults);
                clientLogger.debug(`[Neural Translator] Salvati ${partialResults.items.length} results parziali in IndexedDB`);

                // Generate translated files from partial results
                const newTranslatedFiles = new Map<string, string>();
                for (const file of selectedFiles) {
                  const fileItems = translatedItems.filter(item =>
                    item.metadata?.filename === file.name ||
                    item.metadata?.filePath === file.path
                  );

                  if (fileItems.length > 0) {
                    let translatedContent = file.content;
                    for (const item of fileItems) {
                      if (item.translatedText && item.sourceText) {
                        translatedContent = translatedContent.replace(
                          item.sourceText,
                          item.translatedText
                        );
                      }
                    }
                    newTranslatedFiles.set(file.name, translatedContent);
                  } else {
                    newTranslatedFiles.set(file.name, file.content);
                  }
                }
                setTranslatedFiles(newTranslatedFiles);

                // Create partial job for results view
                const fromMemory = translatedItems.filter(i => i.fromMemory).length;
                const partialJob: BatchTranslationJob = {
                  id: `partial_${Date.now()}`,
                  name: `Traduzione parziale - ${selectedGame?.name || 'Sconosciuto'}`,
                  gameId: selectedGame?.id,
                  gameName: selectedGame?.name,
                  sourceLanguage,
                  targetLanguage,
                  provider,
                  status: 'completed',
                  items: [],
                  progress: {
                    total: progress.total,
                    completed: progress.completed,
                    failed: 0,
                    skipped: 0,
                    fromMemory,
                    retried: 0,
                    postEdited: 0,
                    percentage: (progress.completed / progress.total) * 100,
                  },
                  options: {
                    useTranslationMemory: true,
                    saveToMemory: true,
                    runQualityChecks: false,
                    minQualityScore: 70,
                    stopOnQualityFail: false,
                    classifyContent: false,
                    skipLowPriority: false,
                    batchSize: 10,
                    delayBetweenBatches: 500,
                    parallelBatches: 3,
                    maxRetries: 3,
                    retryDelay: 1000,
                    timeoutPerItem: 30000,
                  },
                  results: {
                    totalItems: progress.total,
                    translatedItems: progress.completed,
                    failedItems: 0,
                    skippedItems: progress.total - progress.completed,
                    fromMemoryItems: fromMemory,
                    postEditedItems: 0,
                    averageQualityScore: 85,
                    totalTokensUsed: 0,
                    estimatedCost: 0,
                    qualityIssues: [],
                  },
                  createdAt: new Date().toISOString(),
                  startedAt: new Date().toISOString(),
                  completedAt: new Date().toISOString(),
                };
                setCurrentJob(partialJob);
              } else {
                clientLogger.warn(`[Neural Translator] No results da salvare: ${translatedItems.length}`);
              }

              setCurrentStep('results');
              // "Salvati" solo dopo che la scrittura in IndexedDB è riuscita (e solo se c'era qualcosa da scrivere).
              saved?.then(
                () => toast.info('results parziali salvati', {
                  description: `${progress?.completed || 0} stringhe tradotte su ${progress?.total || 0}. Puoi riprendere più tardi.`,
                }),
                (e: unknown) => {
                  clientLogger.warn(`Errore IndexedDB: ${String(e)}`);
                  toast.error(t('common.error'), { description: String(e) });
                },
              );
            }}
            onCancelTranslation={() => {
              translationAbortRef.current?.abort();
              setIsTranslating(false);
              setError(t('common.traduzioneAnnullata'));
            }}
            onRetry={() => setCurrentStep('configure')}
            onViewResults={() => setCurrentStep('results')}
          />
        )}
        
        {/* Step 5: Results */}
        {currentStep === 'results' && currentJob && (
          <ReviewStep
            currentJob={currentJob}
            selectedGame={selectedGame}
            targetLanguage={targetLanguage}
            translatedFiles={translatedFiles}
            translatedItems={translatedItems}
            isApplying={isApplying}
            applyStatus={applyStatus}
            onSaveAllFiles={handleSaveAllFiles}
            onDownloadAll={handleDownloadAll}
            onExportPatch={handleExportPatch}
            onOpenInEditor={handleOpenInEditor}
            onSaveFile={handleSaveFile}
            onDownloadFile={handleDownloadFile}
            onNewTranslation={() => {
              setCurrentStep('select-game');
              setSelectedGame(null);
              setSelectedFiles([]);
              setTranslatedFiles(new Map());
              setCurrentJob(null);
            }}
            onApplyToGame={handleApplyToGame}
          />
        )}
      </div>
      
      {/* Export Success Dialog */}
      <AlertDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-green-800 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="h-6 w-6" />
              {t('translatorProPage.patchExported')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground space-y-3">
                <p>{t('translatorProPage.patchSavedTo')}</p>
                <code className="block bg-muted p-3 rounded text-primary text-sm break-all">
                  {exportedFilePath}
                </code>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p className="font-semibold mb-2">{t('translatorProPage.ilPacchettoContiene')}</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{t('translatorProPage.translatedFiles')}</li>
                    <li>{t('translatorProPage.backupOriginal')}</li>
                    <li>{t('translatorProPage.formatoXunityautotranslator')}</li>
                    <li>{t('translatorProPage.readmeConIstruzioni')}</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>
              {t('translatorProPage.close')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}




