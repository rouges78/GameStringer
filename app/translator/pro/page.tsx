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

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Loader2, AlertTriangle, FolderOpen, FileText, ArrowLeft,
  Languages, CheckCircle, Search, ChevronRight, Sparkles,
  Upload, Download, Brain, Shield, Zap, Clock, DollarSign,
  Play, Pause, Square, RotateCcw, FileCode, Database,
  ChevronDown, ChevronUp, Filter, Settings2, Info, Cpu, Wind, Save,
  Gamepad2, Rocket, Package, Share2
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { notifications } from '@/lib/notifications';
import { api } from '@/lib/api-client';
import { offlineCache } from '@/lib/offline-cache';
import { invoke } from '@/lib/tauri-api';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { activityHistory } from '@/lib/activity-history';
import { useTranslation } from '@/lib/i18n';

// Neural Translator imports
import {
  translateFile,
  initializeNeuralTranslator,
  getSystemStats,
  parseFile,
  estimateBatchCost,
  formatTimeRemaining,
  SUPPORTED_FORMATS,
  FORMAT_DESCRIPTIONS,
  type BatchProgress,
  type BatchTranslationJob,
  type ParseResult,
  type FileFormat,
} from '@/lib/neural-translator';
import { translationMemory } from '@/lib/translation-memory';
import { getFlagEmoji, LanguageFlags } from '@/components/ui/language-flags';

// Mappa codici lingua a codici paese per bandierine
const langToCountry: Record<string, string> = {
  'en': 'GB', 'it': 'IT', 'de': 'DE', 'fr': 'FR', 'es': 'ES',
  'ja': 'JP', 'zh': 'CN', 'ko': 'KR', 'pt': 'BR', 'ru': 'RU',
  'pl': 'PL', 'nl': 'NL', 'tr': 'TR', 'ar': 'SA', 'th': 'TH'
};

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

export default function TranslatorProPage() {
  const { toast } = useToast();
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
  const [targetLanguage, setTargetLanguage] = useState('it');
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
        if (parsed.translation?.apiKey) {
          setApiKey(parsed.translation.apiKey);
        }
        if (parsed.translation?.defaultTargetLang) {
          setTargetLanguage(parsed.translation.defaultTargetLang);
        }
      } catch (e) {
        console.warn('[TranslatorPro] Error loading global settings:', e);
      }
    }
  }, []);
  
  // Carica API key salvata quando cambia provider (fallback per provider specifico)
  useEffect(() => {
    // First controlla se c'è una key specifica per questo provider
    const savedKey = localStorage.getItem(`gamestringer_apikey_${provider}`);
    if (savedKey) {
      setApiKey(savedKey);
      return;
    }
    // Altrimenti usa la key globale se il provider corrisponde
    const globalSettings = localStorage.getItem('gameStringerSettings');
    if (globalSettings) {
      try {
        const parsed = JSON.parse(globalSettings);
        if (parsed.translation?.provider === provider && parsed.translation?.apiKey) {
          setApiKey(parsed.translation.apiKey);
          return;
        }
      } catch (e) {}
    }
    setApiKey('');
  }, [provider]);
  
  // Salva API key quando viene modificata
  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    if (newKey) {
      localStorage.setItem(`gamestringer_apikey_${provider}`, newKey);
    } else {
      localStorage.removeItem(`gamestringer_apikey_${provider}`);
    }
  };
  
  // Translation
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [currentJob, setCurrentJob] = useState<BatchTranslationJob | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // Timer in secondi
  const [translatedItems, setTranslatedItems] = useState<Array<{
    id: string;
    sourceText: string;
    translatedText: string;
    fromMemory: boolean;
    metadata?: any;
  }>>([]); // Accumula results durante la traduzione
  
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
          const installedGames = (cachedGames as any[])
            .filter((g: any) => g.is_installed && g.title?.trim())
            .map((g: any) => ({
              id: String(g.steam_app_id || g.id),
              name: g.title,
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
      } catch (err) {
        console.error('[TranslatorPro] Error loading games:', err);
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
      console.log('[TranslatorPro] Applying Wizard params:', { wizardGameId, wizardGameName, wizardInstallPath });
      
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
        
        console.log('[TranslatorPro] Game pre-selected from Wizard:', game.name);
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
  
  // Save API key to secretsManager when it changes
  useEffect(() => {
    if (!apiKey) return;
    
    // Map provider to API key name
    const keyMap: Record<string, string> = {
      'openai': 'OPENAI_API_KEY',
      'gpt5': 'OPENAI_API_KEY',
      'gemini': 'GEMINI_API_KEY',
      'claude': 'ANTHROPIC_API_KEY',
      'deepseek': 'DEEPSEEK_API_KEY',
      'mistral': 'MISTRAL_API_KEY',
      'openrouter': 'OPENROUTER_API_KEY',
    };
    
    const keyName = keyMap[provider];
    if (keyName) {
      // Save API key via API route
      fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyName, value: apiKey })
      }).catch(err => console.error('Failed to save API key:', err));
    }
  }, [apiKey, provider]);
  
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
    if (checkedFiles.length === 0) return null;
    
    const allText = checkedFiles.flatMap(f => 
      f.parseResult.strings.map(s => s.value)
    ).join(' ').toLowerCase();
    
    const avgLength = allText.length / Math.max(1, totalStrings);
    const hasVariables = /%[sd@]|{\w+}|\$\w+|\[\w+\]/i.test(allText);
    const hasHtml = /<[^>]+>/i.test(allText);
    const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(allText);
    
    // Analisi tipo contenuto
    const isUI = avgLength < 30 && (
      /button|menu|settings|options|save|load|exit|quit|start|continue/i.test(allText)
    );
    const isDialogue = avgLength > 50 && /said|asked|replied|"/i.test(allText);
    const isCreative = /story|tale|legend|hero|adventure|quest/i.test(allText);
    const isTechnical = /error|warning|failed|success|loading|connecting/i.test(allText);
    
    // Lingue target speciali
    const isAsianTarget = ['zh', 'ja', 'ko', 'cn'].includes(targetLanguage);
    const isEuropeanTarget = ['de', 'fr', 'es', 'it', 'pt', 'pl', 'ru', 'cs', 'hr'].includes(targetLanguage);
    const isRareLanguage = ['ar', 'hi', 'th', 'vi', 'id', 'tr'].includes(targetLanguage);
    
    // Raccomandazioni basate su ricerca
    // Claude: migliore per documenti lunghi, coerenza, 78% output "good" (Lokalise 2025)
    // GPT-4: gold standard per consistenza, 50+ lingue
    // Gemini: ottimo per lingue regionali (Telugu), veloce
    // DeepSeek: eccellente per Cinese↔Inglese, tecnico
    // Mistral: open source, buono per privacy, multilingua
    
    if (isCreative || isDialogue) {
      return {
        provider: 'claude',
        reason: 'Claude eccelle in traduzioni creative e dialoghi lunghi con coerenza stilistica',
        confidence: 0.9
      };
    }
    
    if (isAsianTarget || (isTechnical && isAsianTarget)) {
      return {
        provider: 'deepseek',
        reason: 'DeepSeek V3 è ottimizzato per traduzioni Cinese↔Inglese e contenuti tecnici',
        confidence: 0.85
      };
    }
    
    if (isUI && hasVariables) {
      return {
        provider: 'gemini',
        reason: 'Gemini gestisce bene variabili e stringhe UI corte, rispetta la Translation Memory',
        confidence: 0.8
      };
    }
    
    if (totalStrings > 500) {
      return {
        provider: 'claude',
        reason: 'Claude ha context window enorme, ideale per progetti grandi con terminologia consistente',
        confidence: 0.85
      };
    }
    
    if (isEuropeanTarget && isUI) {
      return {
        provider: 'gpt5',
        reason: 'GPT-4o è il gold standard per lingue europee ad alta risorsa',
        confidence: 0.85
      };
    }
    
    if (isRareLanguage) {
      return {
        provider: 'openrouter',
        reason: 'OpenRouter permette di scegliere modelli specializzati per lingue meno comuni',
        confidence: 0.7
      };
    }
    
    // Default: GPT-4o per bilanciamento qualità/costo
    return {
      provider: 'gpt5',
      reason: 'GPT-4o offre il miglior bilanciamento qualità/consistenza per la maggior parte dei casi',
      confidence: 0.75
    };
  }, [checkedFiles, totalStrings, targetLanguage]);
  
  const costEstimate = useMemo(() => {
    if (checkedFiles.length === 0) return null;
    const allStrings = checkedFiles.flatMap(f => 
      f.parseResult.strings.map(s => ({ text: s.value }))
    );
    return estimateBatchCost(allStrings, {
      provider,
      useTranslationMemory,
      tmHitRate: tmStats ? 0.3 : 0
    });
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
            const langs = (details as any).supported_languages;
            if (langs) {
              setSelectedGame(prev => prev ? { ...prev, supportedLanguages: langs } : prev);
            }
          }
        }
      } catch (err) {
        console.log('[TranslatorPro] Could not fetch game details:', err);
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
        } catch (e) {
          console.log('[TranslatorPro] Could not detect localization files:', e);
        }
      }
    } catch (err) {
      console.log('[TranslatorPro] Could not detect engine:', err);
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
      } catch (err) {
        console.error(`Error parsing ${file.name}:`, err);
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
          if (!ext || !SUPPORTED_FORMATS.includes(ext as any)) continue;
          
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
          } catch (err) {
            console.error(`Error parsing ${file.name}:`, err);
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
      console.log('[TranslatorPro] Scanning path:', fullPath);
      
      // Use same scan command as Translation Wizard
      const extensions = ['json', 'csv', 'xml', 'txt', 'po', 'lang', 'loc', 'strings', 'ini'];
      const scannedFiles = await invoke<any[]>('scan_localization_files', {
        path: fullPath,
        extensions,
        maxDepth: 10
      });
      
      console.log('[TranslatorPro] Found files:', scannedFiles?.length || 0);
      
      if (Array.isArray(scannedFiles) && scannedFiles.length > 0) {
        const newFiles: SelectedFile[] = [];
        
        // Filter for likely localization files (o mostra tutti se showAllFiles è attivo)
        const locFiles = scannedFiles.filter(file => {
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
        
        console.log(`[TranslatorPro] Filtered: ${scannedFiles.length} -> ${locFiles.length} files (excluded ${scannedFiles.length - locFiles.length} system files)`);
        
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
                console.log(`[TranslatorPro] Parsed ${file.name}: ${parseResult.strings.length} strings, format: ${parseResult.format}`);
                
                if (parseResult.strings.length > 0) {
                  newFiles.push({
                    name: file.name,
                    path: file.path,
                    content,
                    format: parseResult.format,
                    parseResult
                  });
                } else {
                  console.warn(`[TranslatorPro] ${file.name}: 0 strings found, skipping`);
                }
              } catch (parseErr) {
                console.warn(`Skipping ${file.name}: not a valid translation file`, parseErr);
              }
            }
          } catch (err) {
            console.error(`Error reading ${file.name}:`, err);
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
        console.warn('[TranslatorPro] No files found, opening file picker');
        // Fallback to file picker if no files found
        openFilePicker();
      }
    } catch (err) {
      console.error('Error searching game files:', err);
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
        } catch (err) {
          console.error(`Error parsing ${file.name}:`, err);
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
    
    setIsTranslating(true);
    setIsPaused(false);
    setError(null);
    setProgress(null);
    setTranslatedFiles(new Map());
    setTranslatedItems([]); // Reset results accumulati
    
    console.log('[Neural Translator] Starting translation with provider:', provider);
    console.log('[Neural Translator] Files to translate:', filesToTranslate.length);
    console.log('[Neural Translator] API Key present:', !!apiKey);
    
    try {
      for (const file of filesToTranslate) {
        console.log('[Neural Translator] Translating file:', file.name);
        const result = await translateFile(file.content, file.name, {
          sourceLanguage,
          targetLanguage,
          provider,
          gameId: selectedGame?.id,
          gameName: selectedGame?.name,
          useTranslationMemory,
          runQualityChecks,
          apiKey, // Passa l'API key inserita dall'utente
          onProgress: (p) => {
            console.log('[Neural Translator] Progress:', p.completed, '/', p.total);
            setProgress(p);
          },
          onItemComplete: (item) => {
            // Accumula results tradotti per salvataggio parziale
            if (item.status === 'completed' && item.translatedText) {
              setTranslatedItems(prev => [...prev, {
                id: item.id,
                sourceText: item.sourceText,
                translatedText: item.translatedText!,
                fromMemory: item.fromMemory,
                metadata: item.metadata,
              }]);
            }
          }
        });
        
        setCurrentJob(result.job);
        setTranslatedFiles(prev => new Map(prev).set(file.name, result.translatedContent));
      }
      
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
      
      // Salva statistica traduzione per dashboard
      const savedTranslations = JSON.parse(localStorage.getItem('gameTranslations') || '[]');
      savedTranslations.push({
        id: `trans_${Date.now()}`,
        gameId: selectedGame?.id,
        gameName: selectedGame?.name,
        filesCount: filesToTranslate.length,
        sourceLang: sourceLanguage,
        targetLang: targetLanguage,
        provider: provider,
        status: 'completed',
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('gameTranslations', JSON.stringify(savedTranslations));
      
      // 🧠 Salva automaticamente in Translation Memory
      if (translatedItems.length > 0) {
        const tmBatch = translatedItems
          .filter(item => item.translatedText && item.sourceText && item.sourceText.length > 2)
          .map(item => ({
            source: item.sourceText,
            target: item.translatedText,
            gameId: selectedGame?.id,
            context: selectedGame?.name,
          }));
        
        if (tmBatch.length > 0) {
          await translationMemory.addBatch(tmBatch);
          console.log(`[Neural Translator] ✅ saved ${tmBatch.length} traduzioni in TM`);
        }
      }
      
      setCurrentStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsTranslating(false);
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
    } catch (err) {
      console.error('Error saving file:', err);
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
    console.log('[ExportPatch] Clicked! selectedGame:', selectedGame?.name, 'translatedFiles:', translatedFiles.size);
    
    if (!selectedGame || translatedFiles.size === 0) {
      toast({
        title: 'Nessun file da esportare',
        description: `Completa prima una traduzione. (Game: ${selectedGame?.name || 'none'}, Files: ${translatedFiles.size})`,
        variant: 'destructive',
      });
      return;
    }
    
    try {
      toast({
        title: 'Creazione patch...',
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
      
      // Chiama API per generare ZIP
      console.log('[ExportPatch] Calling API with', files.length, 'files');
      console.log('[ExportPatch] Metadata:', metadata);
      
      const response = await fetch('/api/export/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          metadata,
          format: 'zip',
          options: {
            includeBackup: true,
            includeReadme: true,
            includeMetadata: true,
            xunityFormat: true
          }
        })
      });
      
      console.log('[ExportPatch] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ExportPatch] API Error:', errorText);
        throw new Error(`error nella generazione del pacchetto: ${response.status}`);
      }
      
      // Scarica il file ZIP usando Tauri save dialog
      console.log('[ExportPatch] Creating blob...');
      const blob = await response.blob();
      console.log('[ExportPatch] Blob size:', blob.size);
      
      const filename = `${selectedGame.name.replace(/[^a-zA-Z0-9]/g, '_')}_${targetLanguage}_patch.zip`;
      
      // Salva il file ZIP sul Desktop
      try {
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
        
        console.log('[ExportPatch] File saved to:', fullPath);
        
        // Mostra dialog di conferma
        setExportedFilePath(fullPath);
        setExportDialogOpen(true);
        return;
        
      } catch (tauriError) {
        // Fallback per browser normale
        console.log('[ExportPatch] Tauri not available, using browser download:', tauriError);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      console.log('[ExportPatch] Download completed!');
      
      toast({
        title: '✅ Patch esportata!',
        description: 'Il pacchetto ZIP include file tradotti, backup e formato XUnity.AutoTranslator.',
      });
      
    } catch (error) {
      console.error('[ExportPatch] Error:', error);
      toast({
        title: 'error esportazione',
        description: error instanceof Error ? error.message : 'error sconosciuto',
        variant: 'destructive',
      });
    }
  };
  
  // === APPLY TO GAME (ONE-CLICK MAGIC) ===
  const handleApplyToGame = async () => {
    console.log('[ApplyToGame] Inizio - selectedGame:', selectedGame?.name, 'translatedFiles:', translatedFiles.size);
    if (!selectedGame || translatedFiles.size === 0) {
      console.log('[ApplyToGame] Uscita anticipata - No game o file');
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
        toast({
          title: 'game non trovato',
          description: 'Non riesco a trovare la cartella del game. Usa "Scarica tutti" e copia manualmente.',
          variant: 'destructive',
        });
        setApplyStatus('error');
        setIsApplying(false);
        return;
      }
      
      setApplyStatus('applying');
      console.log('[ApplyToGame] gamePath:', currentGamePath);
      console.log('[ApplyToGame] localizationInfo:', localizationInfo);
      console.log('[ApplyToGame] engineInfo:', engineInfo);
      
      // METODO 1: File di localizzazione diretti (preferito se disponibili)
      if (localizationInfo?.has_localization && localizationInfo.can_add_language) {
        console.log('[ApplyToGame] Usando METODO 1 - File localizzazione diretti');
        // Prendi il primo file tradotto
        const [filename, translatedContent] = Array.from(translatedFiles.entries())[0];
        
        try {
          const savedPath = await invoke<string>('apply_translation_file', {
            gamePath: currentGamePath,
            sourceContent: translatedContent,
            targetLanguage: 'it-IT',
          });
          
          setApplyStatus('done');
          toast({
            title: '✅ Traduzione applicata!',
            description: `File salvato in: ${savedPath.split(/[/\\]/).pop()}. Seleziona Italiano nelle opzioni del game!`,
          });
        } catch (e) {
          throw new Error(`error salvataggio file: ${e}`);
        }
      }
      // METODO 2: XUnity AutoTranslator (per Unity senza file loc diretti)
      else if (engineInfo?.is_unity || engineInfo?.can_patch) {
        console.log('[ApplyToGame] Usando METODO 2 - XUnity AutoTranslator');
        setApplyStatus('checking');
        let hasPatcher = engineInfo?.has_bepinex && engineInfo?.has_xunity;
        
        // Installa patcher se manca
        if (!hasPatcher) {
          setApplyStatus('installing');
          toast({ title: 'Installazione patcher...', description: 'BepInEx + XUnity AutoTranslator' });
          
          try {
            const exeName = selectedGame.name.replace(/[^a-zA-Z0-9]/g, '') + '.exe';
            await invoke('install_unity_autotranslator', { 
              gamePath: currentGamePath, 
              gameExeName: exeName,
              targetLang: targetLanguage 
            });
          } catch (e) {
            console.warn('Installazione patcher fallita:', e);
          }
        }
        
        setApplyStatus('applying');
        
        // Crea dizionario XUnity
        const dictionaryLines: string[] = [];
        for (const [, content] of translatedFiles.entries()) {
          const lines = content.split('\n');
          for (const line of lines) {
            if (line.includes('=')) dictionaryLines.push(line);
          }
        }
        
        const xunityPath = `${currentGamePath}/BepInEx/Translation/${targetLanguage}/Text`;
        try {
          await invoke('ensure_directory', { path: xunityPath });
          await invoke('write_text_file', { 
            path: `${xunityPath}/_GameStringer.txt`, 
            content: dictionaryLines.join('\n') 
          });
        } catch (e) {
          console.warn('Fallback a Translation Memory:', e);
        }
        
        setApplyStatus('done');
        toast({
          title: '✅ Applicato al game!',
          description: `${dictionaryLines.length} traduzioni XUnity. Avvia il game!`,
        });
      }
      // METODO 3: Nessun metodo disponibile - fallback a salvataggio diretto
      else {
        console.log('[ApplyToGame] METODO 3 - Fallback salvataggio diretto');
        // Salva i file tradotti direttamente nella cartella del game
        let savedCount = 0;
        for (const [filename, content] of translatedFiles.entries()) {
          try {
            const targetPath = `${currentGamePath}/${filename}`;
            console.log('[ApplyToGame] Salvando:', targetPath);
            await invoke('write_text_file', { path: targetPath, content });
            savedCount++;
          } catch (e) {
            console.warn('[ApplyToGame] error salvataggio file:', filename, e);
          }
        }
        
        if (savedCount > 0) {
          setApplyStatus('done');
          toast({
            title: '✅ File salvati!',
            description: `${savedCount} file tradotti salvati nella cartella del game.`,
          });
        } else {
          toast({
            title: '⚠️ Applicazione fallita',
            description: 'Non sono riuscito a salvare i file. Usa "Scarica tutti" e copia manualmente.',
            variant: 'destructive',
          });
          setApplyStatus('error');
        }
      }
      
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
        await translationMemory.addBatch(tmBatch);
        console.log(`[ApplyToGame] saved ${tmBatch.length} traduzioni in TM`);
      }
      
      // Salva statistica patch per dashboard
      const savedPatches = JSON.parse(localStorage.getItem('gamePatches') || '[]');
      savedPatches.push({
        id: `patch_${Date.now()}`,
        gameId: selectedGame.id,
        gameName: selectedGame.name,
        gamePath: currentGamePath,
        method: localizationInfo?.has_localization ? 'direct' : (engineInfo?.is_unity ? 'xunity' : 'fallback'),
        translationsCount: tmBatch.length,
        status: 'applied',
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('gamePatches', JSON.stringify(savedPatches));
      
      // Traccia attività patch per sincronizzazione
      await activityHistory.add({
        activity_type: 'patch',
        title: `Patch applicata: ${selectedGame.name}`,
        description: `${tmBatch.length} traduzioni applicate al game`,
        game_name: selectedGame.name,
        game_id: selectedGame.id,
        metadata: {
          method: localizationInfo?.has_localization ? 'direct' : (engineInfo?.is_unity ? 'xunity' : 'fallback'),
          translations_count: tmBatch.length
        }
      });
      
    } catch (e) {
      console.error('error applicazione:', e);
      setApplyStatus('error');
      toast({
        title: 'error',
        description: `${e}. Usa "Scarica tutti" e copia manualmente.`,
        variant: 'destructive',
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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Hero Header con immagine game fusa */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 p-4 mb-6">
        {/* Immagine game fusa nello sfondo */}
        {selectedGame?.coverUrl && (
          <>
            <div className="absolute inset-0">
              <img
                src={selectedGame.coverUrl}
                alt={selectedGame.name || 'Game'}
                className="w-full h-full object-cover opacity-25"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-sky-600/85 via-blue-600/80 to-cyan-600/85" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-600/40 to-transparent" />
          </>
        )}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              {selectedGame ? `Neural Translator Pro • ${selectedGame.name}` : 'Neural Translator Pro'}
            </h1>
            <p className="text-sm text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
              Sistema professionale di traduzione con AI
            </p>
          </div>
          
          {/* TM Stats Badge */}
          {tmStats && (
            <Badge variant="secondary" className="ml-auto gap-1.5 bg-white/20 text-white border-white/30">
              <Database className="h-3 w-3" />
              {tmStats.totalUnits} traduzioni in memoria
            </Badge>
          )}
        </div>
      </div>
      
      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                    isActive && "bg-gradient-to-br from-sky-500 to-blue-500 text-white shadow-lg shadow-blue-500/25",
                    isCompleted && "bg-green-500 text-white",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}>
                    {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={cn(
                    "text-xs mt-1.5 font-medium",
                    isActive && "text-purple-500",
                    isCompleted && "text-green-500",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "w-12 h-0.5 mx-2 transition-colors duration-300",
                    index < currentStepIndex ? "bg-green-500" : "bg-muted"
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
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca tra i tuoi games..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            
            <div className="text-sm text-muted-foreground px-1">
              {filteredGames.length} games trovati
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {filteredGames.slice(0, 20).map((game) => (
                <button
                  key={game.id}
                  onClick={() => handleGameSelect(game)}
                  className={cn(
                    "group flex items-center gap-2 p-2 rounded-lg border transition-all",
                    "hover:border-purple-500/50 hover:bg-purple-500/5",
                    "text-left w-full"
                  )}
                >
                  <div className="relative w-8 h-8 rounded overflow-hidden bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex-shrink-0">
                    {game.coverUrl ? (
                      <Image 
                        src={game.coverUrl} 
                        alt={game.name} 
                        fill 
                        className="object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div className="absolute inset-0 flex items-center justify-center -z-10">
                      <span className="text-xs font-bold text-white/50">{game.name?.charAt(0)?.toUpperCase() || '?'}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-xs truncate group-hover:text-purple-400">
                      {game.name}
                    </h3>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
            {filteredGames.length > 20 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Usa la ricerca per trovare altri {filteredGames.length - 20} games
              </p>
            )}
          </div>
        )}
        
        {/* Step 2: Select Files */}
        {currentStep === 'select-files' && (
          <div className="space-y-3">
            {/* Wizard Banner */}
            {wizardGameId && wizardMethod && (
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-300">
                    Arrivi dal Translation Wizard
                  </p>
                  <p className="text-xs text-purple-400/70">
                    Metodo consigliato: {wizardMethod === 'file' ? '📁 Modifica File' : wizardMethod === 'bridge' ? '🔌 Translation Bridge' : '🔧 Manuale'}
                    {wizardTargetLang && ` • Lingua: ${wizardTargetLang.toUpperCase()}`}
                  </p>
                </div>
              </div>
            )}
            
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep('select-game')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Cambia game
            </Button>
            
            {/* Selected Game - Compact */}
            {selectedGame && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border">
                <div className="relative w-10 h-10 rounded overflow-hidden bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex-shrink-0">
                  {selectedGame.coverUrl ? (
                    <Image 
                      src={selectedGame.coverUrl} 
                      alt={selectedGame.name} 
                      fill 
                      className="object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center -z-10">
                    <span className="text-sm font-bold text-white/50">{selectedGame.name?.charAt(0)?.toUpperCase() || '?'}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold truncate">{selectedGame.name}</h2>
                  {selectedGame.supportedLanguages && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <LanguageFlags supportedLanguages={selectedGame.supportedLanguages} maxFlags={20} />
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Engine + Localization Info - COMPACT */}
            {(isCheckingEngine || engineInfo || localizationInfo?.has_localization) && (
              <div className="p-2 rounded-lg border text-xs bg-muted/30 space-y-1.5">
                {isCheckingEngine ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analisi game...
                  </div>
                ) : (
                  <>
                    {/* Engine row */}
                    {engineInfo && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{engineInfo.engine_name}</span>
                          {engineInfo.has_bepinex && <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-green-500/20">BepInEx</Badge>}
                          {engineInfo.has_xunity && <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-blue-500/20">XUnity</Badge>}
                        </div>
                        <span className={cn("text-[10px]", engineInfo.can_patch ? "text-green-500" : "text-amber-500")}>
                          {engineInfo.can_patch ? "✓ Compatibile" : "⚠ Tool esterni"}
                        </span>
                      </div>
                    )}
                    
                    {/* Localization row */}
                    {localizationInfo?.has_localization && (
                      <>
                        <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span>{localizationInfo.available_languages.length} lingue</span>
                            <Badge variant="outline" className="text-[8px] h-3.5 px-1">{localizationInfo.format.toUpperCase()}</Badge>
                          </div>
                          <span className={cn("text-[10px]", localizationInfo.missing_italian ? "text-amber-500" : "text-green-500")}>
                            {localizationInfo.missing_italian ? "⚠ IT mancante" : "✓ IT presente"}
                          </span>
                        </div>
                        
                        {/* Quick load button */}
                        {localizationInfo.source_file && localizationInfo.missing_italian && (
                          <Button
                            size="sm"
                            className="w-full h-7 gap-1.5 text-xs bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                            onClick={async () => {
                              if (!localizationInfo.source_file) return;
                              setIsLoadingFiles(true);
                              try {
                                const content = await invoke<string>('read_file_content', { filePath: localizationInfo.source_file.path });
                                const parseResult = parseFile(content, localizationInfo.source_file.filename);
                                if (parseResult.strings.length > 0) {
                                  setSelectedFiles([{ name: localizationInfo.source_file.filename, path: localizationInfo.source_file.path, content, format: parseResult.format, parseResult }]);
                                  toast({ title: '✓ Caricato!', description: `${parseResult.strings.length} stringhe` });
                                }
                              } catch (e) {
                                toast({ title: 'error', description: `${e}`, variant: 'destructive' });
                              } finally {
                                setIsLoadingFiles(false);
                              }
                            }}
                            disabled={isLoadingFiles}
                          >
                            <Rocket className="h-3 w-3" />
                            Carica EN → Traduci IT
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            
            {/* Search Game Files Button - Compact */}
            <Button
              variant="default"
              size="default"
              className="w-full h-10 gap-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              onClick={handleSearchGameFiles}
              disabled={isLoadingFiles}
            >
              {isLoadingFiles ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ricerca...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Cerca file di traduzione
                </>
              )}
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">oppure carica manualmente</span>
              </div>
            </div>
            
            {/* File Upload - Compact */}
            <div className="border border-dashed rounded-lg p-3 text-center">
              <input
                type="file"
                multiple
                accept=".json,.po,.pot,.xliff,.xlf,.resx,.strings,.ini,.csv,.properties,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex items-center justify-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground">Trascina o clicca • {SUPPORTED_FORMATS.join(', ')}</span>
              </label>
            </div>
            
            {/* ⚠️ Warning per file config o mancanti */}
            {filesWarning && (
              <div className={cn(
                "p-4 rounded-lg border",
                filesWarning.type === 'xunity_suggested' 
                  ? "bg-purple-500/10 border-purple-500/30" 
                  : filesWarning.type === 'config'
                    ? "bg-yellow-500/10 border-yellow-500/30"
                    : "bg-blue-500/10 border-blue-500/30"
              )}>
                <p className="text-sm font-medium mb-2">{filesWarning.message}</p>
                {filesWarning.type === 'xunity_suggested' && engineInfo?.is_unity && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      XUnity AutoTranslator intercetta il testo del game in tempo reale e permette di tradurlo.
                    </p>
                    <Button 
                      size="sm" 
                      className="bg-purple-600 hover:bg-purple-700"
                      onClick={() => {
                        // Naviga a Unity Patcher
                        window.location.href = `/unity-patcher?gameId=${selectedGame?.id}&gameName=${encodeURIComponent(selectedGame?.name || '')}`;
                      }}
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Vai a Unity Patcher
                    </Button>
                  </div>
                )}
                {filesWarning.configFiles.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">
                      File esclusi ({filesWarning.configFiles.length})
                    </summary>
                    <ul className="text-xs text-muted-foreground mt-1 ml-4 list-disc">
                      {filesWarning.configFiles.slice(0, 5).map(f => <li key={f}>{f}</li>)}
                      {filesWarning.configFiles.length > 5 && <li>...e altri {filesWarning.configFiles.length - 5}</li>}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    File da tradurre ({selectedFiles.filter(f => f.checked !== false).length}/{selectedFiles.length})
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFiles(prev => prev.map(f => ({ ...f, checked: true })));
                      }}
                      className="h-7 text-xs"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Tutti
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFiles(prev => prev.map(f => ({ ...f, checked: false })));
                      }}
                      className="h-7 text-xs"
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Nessuno
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Elimina i file NON selezionati (checked = false)
                        const checkedFiles = selectedFiles.filter(f => f.checked !== false);
                        if (checkedFiles.length > 0) {
                          setSelectedFiles(checkedFiles);
                        } else {
                          setSelectedFiles([]);
                        }
                        setPreviewFile(null);
                      }}
                      className="h-7 text-xs text-destructive hover:text-destructive"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Rimuovi non selezionati
                    </Button>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* File List */}
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div 
                        key={file.path || `${file.name}-${index}`} 
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer transition-all",
                          file.checked === false ? "opacity-50 border-dashed" : "",
                          previewFile?.name === file.name ? "border-purple-500 bg-purple-500/5" : "hover:border-purple-500/50"
                        )}
                        onClick={() => setPreviewFile(file)}
                      >
                        <input
                          type="checkbox"
                          checked={file.checked !== false}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedFiles(prev => prev.map(f => 
                              f.name === file.name ? { ...f, checked: e.target.checked } : f
                            ));
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <FileCode className="h-5 w-5 text-purple-500" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {FORMAT_DESCRIPTIONS[file.format]} • {file.parseResult.strings.length} stringhe
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleRemoveFile(file.name); }}
                          className="text-destructive hover:text-destructive"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  {/* File Preview */}
                  <div className="border rounded-xl p-4 bg-muted/30">
                    {previewFile ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{previewFile.name}</h4>
                          <Badge variant="secondary">{previewFile.format.toUpperCase()}</Badge>
                        </div>
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2">
                            {previewFile.parseResult.strings.slice(0, 50).map((str, i) => (
                              <div key={i} className="p-2 rounded bg-background border text-xs">
                                <p className="font-mono text-muted-foreground truncate">{str.key}</p>
                                <p className="mt-1">{str.value}</p>
                              </div>
                            ))}
                            {previewFile.parseResult.strings.length > 50 && (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                ... e altre {previewFile.parseResult.strings.length - 50} stringhe
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <FileText className="h-10 w-10 mb-3 opacity-50" />
                        <p className="text-sm">Clicca su un file per vedere l'anteprima</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    Totale: <strong>{totalStrings}</strong> stringhe da tradurre
                  </p>
                  <Button onClick={() => setCurrentStep('configure')} disabled={checkedFiles.length === 0}>
                    Continua
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Step 3: Configure */}
        {currentStep === 'configure' && (
          <div className="space-y-6">
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep('select-files')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Modifica file
            </Button>
            
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-muted/50 border text-center">
                <FileText className="h-6 w-6 mx-auto text-purple-500 mb-2" />
                <p className="text-2xl font-bold">{checkedFiles.length}</p>
                <p className="text-xs text-muted-foreground">File</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border text-center">
                <Languages className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold">{totalStrings}</p>
                <p className="text-xs text-muted-foreground">Stringhe</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border text-center">
                <Database className="h-6 w-6 mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold">{tmStats?.totalUnits || 0}</p>
                <p className="text-xs text-muted-foreground">In memoria</p>
              </div>
            </div>
            
            {/* AI Recommendation */}
            {recommendedProvider && (
              <div className={cn(
                "p-4 rounded-xl border-2 transition-all",
                provider === recommendedProvider.provider 
                  ? "border-green-500 bg-green-500/10" 
                  : "border-yellow-500 bg-yellow-500/10"
              )}>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">🤖 Raccomandazione AI</h4>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(recommendedProvider.confidence * 100)}% confidenza
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {recommendedProvider.reason}
                    </p>
                    {provider !== recommendedProvider.provider && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setProvider(recommendedProvider.provider as any)}
                        className="gap-2"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Usa {recommendedProvider.provider === 'gpt5' ? 'GPT-4o' : 
                             recommendedProvider.provider === 'claude' ? 'Claude' :
                             recommendedProvider.provider === 'gemini' ? 'Gemini' :
                             recommendedProvider.provider === 'deepseek' ? 'DeepSeek' :
                             recommendedProvider.provider}
                      </Button>
                    )}
                    {provider === recommendedProvider.provider && (
                      <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Provider consigliato selezionato
                      </p>
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
                  <Label>Provider AI</Label>
                  <Select value={provider} onValueChange={(v: any) => setProvider(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* 🏆 BEST VALUE - Economici e veloci */}
                      <SelectItem value="deepseek">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-cyan-500" />
                          <span>DeepSeek V3</span>
                          <Badge variant="outline" className="text-[9px] ml-1 text-green-400 border-green-500/30">CHEAPEST</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="gemini">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-500" />
                          <span>Gemini 2.0 Flash</span>
                          <Badge variant="outline" className="text-[9px] ml-1 text-blue-400 border-blue-500/30">FAST</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="openai">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-green-500" />
                          <span>GPT-4o Mini</span>
                          <Badge variant="outline" className="text-[9px] ml-1 text-gray-400 border-gray-500/30">$0.15/1M</Badge>
                        </div>
                      </SelectItem>
                      
                      {/* 🎯 BEST QUALITY - Alta qualità per games */}
                      <SelectItem value="claude">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-orange-500" />
                          <span>Claude 3.5 Sonnet</span>
                          <Badge variant="outline" className="text-[9px] ml-1 text-orange-400 border-orange-500/30">BEST</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="gpt5">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-emerald-500" />
                          <span>GPT-4o</span>
                          <Badge variant="outline" className="text-[9px] ml-1 text-emerald-400 border-emerald-500/30">RELIABLE</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="mistral">
                        <div className="flex items-center gap-2">
                          <Wind className="h-4 w-4 text-indigo-500" />
                          <span>Mistral Large 2</span>
                          <Badge variant="outline" className="text-[9px] ml-1 text-indigo-400 border-indigo-500/30">EU</Badge>
                        </div>
                      </SelectItem>
                      
                      {/* Altri */}
                      <SelectItem value="openrouter">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-purple-500" />
                          <span>OpenRouter</span>
                          <Badge variant="outline" className="text-[9px] ml-1 text-purple-400 border-purple-500/30">MULTI</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="deepl">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-sky-500" />
                          <span>DeepL Pro</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="google">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-red-500" />
                          <span>Google Translate</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="Inserisci la tua API key (salvata automaticamente)"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Lingua origine</Label>
                    <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona lingua" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en"><span className="flex items-center gap-2">{getFlagEmoji('GB')} English</span></SelectItem>
                        <SelectItem value="de"><span className="flex items-center gap-2">{getFlagEmoji('DE')} Deutsch</span></SelectItem>
                        <SelectItem value="fr"><span className="flex items-center gap-2">{getFlagEmoji('FR')} Français</span></SelectItem>
                        <SelectItem value="es"><span className="flex items-center gap-2">{getFlagEmoji('ES')} Español</span></SelectItem>
                        <SelectItem value="ja"><span className="flex items-center gap-2">{getFlagEmoji('JP')} 日本語</span></SelectItem>
                        <SelectItem value="zh"><span className="flex items-center gap-2">{getFlagEmoji('CN')} 中文</span></SelectItem>
                        <SelectItem value="ko"><span className="flex items-center gap-2">{getFlagEmoji('KR')} 한국어</span></SelectItem>
                        <SelectItem value="ru"><span className="flex items-center gap-2">{getFlagEmoji('RU')} Русский</span></SelectItem>
                        <SelectItem value="pt"><span className="flex items-center gap-2">{getFlagEmoji('BR')} Português</span></SelectItem>
                        <SelectItem value="pl"><span className="flex items-center gap-2">{getFlagEmoji('PL')} Polski</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lingua destinazione</Label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona lingua" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it"><span className="flex items-center gap-2">{getFlagEmoji('IT')} Italiano</span></SelectItem>
                        <SelectItem value="en"><span className="flex items-center gap-2">{getFlagEmoji('GB')} English</span></SelectItem>
                        <SelectItem value="de"><span className="flex items-center gap-2">{getFlagEmoji('DE')} Deutsch</span></SelectItem>
                        <SelectItem value="fr"><span className="flex items-center gap-2">{getFlagEmoji('FR')} Français</span></SelectItem>
                        <SelectItem value="es"><span className="flex items-center gap-2">{getFlagEmoji('ES')} Español</span></SelectItem>
                        <SelectItem value="ja"><span className="flex items-center gap-2">{getFlagEmoji('JP')} 日本語</span></SelectItem>
                        <SelectItem value="zh"><span className="flex items-center gap-2">{getFlagEmoji('CN')} 中文</span></SelectItem>
                        <SelectItem value="ko"><span className="flex items-center gap-2">{getFlagEmoji('KR')} 한국어</span></SelectItem>
                        <SelectItem value="ru"><span className="flex items-center gap-2">{getFlagEmoji('RU')} Русский</span></SelectItem>
                        <SelectItem value="pt"><span className="flex items-center gap-2">{getFlagEmoji('BR')} Português</span></SelectItem>
                        <SelectItem value="pl"><span className="flex items-center gap-2">{getFlagEmoji('PL')} Polski</span></SelectItem>
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
                    Opzioni avanzate
                  </h3>
                  
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Usa Translation Memory</span>
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
                      <Shield className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Quality Checks</span>
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
                      <FolderOpen className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">Mostra tutti i file</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showAllFiles}
                      onChange={(e) => setShowAllFiles(e.target.checked)}
                      className="rounded"
                    />
                  </label>
                  {showAllFiles && (
                    <p className="text-xs text-yellow-400/70">
                      ⚠️ Bypassa il filtro intelligente. Riseleziona il game dopo aver attivato.
                    </p>
                  )}
                </div>
                
                {/* Cost Estimate */}
                {costEstimate && (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Stima
                    </h3>
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
                        {costEstimate.breakdown.estimatedTmHits} da memoria, {costEstimate.breakdown.estimatedApiCalls} da API
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <Button
                onClick={() => { setCurrentStep('translate'); handleStartTranslation(); }}
                disabled={!apiKey}
                className="bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Avvia Traduzione
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 4: Translate */}
        {currentStep === 'translate' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              {isTranslating ? (
                <>
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    <div className={cn(
                      "absolute inset-0 rounded-full animate-pulse transition-colors duration-500",
                      progress?.isRateLimited 
                        ? "bg-amber-500" 
                        : "bg-gradient-to-r from-sky-500 to-blue-500"
                    )} />
                    <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
                      {progress?.isRateLimited ? (
                        <Clock className="h-8 w-8 text-amber-500 animate-pulse" />
                      ) : (
                        <Brain className="h-8 w-8 text-purple-500 animate-pulse" />
                      )}
                    </div>
                  </div>
                  
                  {/* Nome del game */}
                  {selectedGame && (
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div className="relative w-8 h-8 rounded overflow-hidden bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex-shrink-0">
                        {selectedGame.coverUrl && (
                          <img 
                            src={selectedGame.coverUrl} 
                            alt={selectedGame.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center -z-10">
                          <span className="text-xs font-bold text-white/50">{selectedGame.name?.charAt(0)?.toUpperCase() || '?'}</span>
                        </div>
                      </div>
                      <span className="text-lg font-medium text-purple-400">
                        {selectedGame.name}
                      </span>
                    </div>
                  )}
                  
                  <h2 className="text-xl font-semibold mb-2">
                    {progress?.isRateLimited ? 'In attesa API...' : 'Traduzione in corso...'}
                  </h2>
                  
                  {progress?.statusMessage && (
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4",
                      progress.isRateLimited 
                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {progress.isRateLimited && <AlertTriangle className="h-3 w-3" />}
                      {progress.statusMessage}
                    </div>
                  )}

                  {progress && (
                    <div className="max-w-md mx-auto space-y-3">
                      <Progress 
                        value={progress.percentage} 
                        className={cn(
                          "h-2 transition-all",
                          progress.isRateLimited ? "[&>div]:bg-amber-500" : ""
                        )} 
                      />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{progress.completed}/{progress.total} stringhe</span>
                        <span>{progress.fromMemory} da memoria</span>
                      </div>
                      {progress.startTime && (
                        <p className="text-xs text-muted-foreground">
                          Tempo trascorso: {formatTimeRemaining(elapsedTime)}
                        </p>
                      )}
                      {progress.estimatedTimeRemaining && (
                        <p className="text-sm text-muted-foreground">
                          Tempo rimanente: ~{formatTimeRemaining(progress.estimatedTimeRemaining)}
                        </p>
                      )}
                      {progress.currentItem && !progress.isRateLimited && (
                        <p className="text-xs text-muted-foreground truncate">
                          "{progress.currentItem}..."
                        </p>
                      )}
                      
                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 mt-4">
                        {/* Save partial results button - show when rate limited or has progress */}
                        {progress.completed > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                            onClick={() => {
                              setIsTranslating(false);
                              
                              // Salva i results parziali in localStorage per persistenza
                              if (translatedItems.length > 0 && selectedFiles.length > 0) {
                                const partialResults = {
                                  timestamp: Date.now(),
                                  gameId: selectedGame?.id,
                                  gameName: selectedGame?.name,
                                  sourceLanguage,
                                  targetLanguage,
                                  provider,
                                  completed: progress.completed,
                                  total: progress.total,
                                  files: selectedFiles.map(f => ({
                                    name: f.name,
                                    path: f.path,
                                    format: f.format,
                                    originalContent: f.content,
                                  })),
                                  items: translatedItems,
                                };
                                
                                localStorage.setItem('gamestringer_partial_translations', JSON.stringify(partialResults));
                                console.log('[Neural Translator] Salvati', partialResults.items.length, 'results parziali in localStorage');
                                
                                // Genera i file tradotti dai results parziali
                                const newTranslatedFiles = new Map<string, string>();
                                for (const file of selectedFiles) {
                                  // Trova le traduzioni per questo file
                                  const fileItems = translatedItems.filter(item => 
                                    item.metadata?.filename === file.name || 
                                    item.metadata?.filePath === file.path
                                  );
                                  
                                  if (fileItems.length > 0) {
                                    // Ricostruisci il contenuto tradotto
                                    let translatedContent = file.content;
                                    for (const item of fileItems) {
                                      if (item.translatedText && item.sourceText) {
                                        // Sostituisci il testo originale con la traduzione
                                        translatedContent = translatedContent.replace(
                                          item.sourceText,
                                          item.translatedText
                                        );
                                      }
                                    }
                                    newTranslatedFiles.set(file.name, translatedContent);
                                  } else {
                                    // Se non ci sono traduzioni specifiche, usa il contenuto originale
                                    newTranslatedFiles.set(file.name, file.content);
                                  }
                                }
                                setTranslatedFiles(newTranslatedFiles);
                                
                                // Crea un job parziale per mostrare i results
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
                                console.warn('[Neural Translator] No results da salvare:', translatedItems.length);
                              }
                              
                              setCurrentStep('results');
                              toast({
                                title: 'results parziali salvati',
                                description: `${progress.completed} stringhe tradotte su ${progress.total}. Puoi riprendere più tardi.`,
                              });
                            }}
                          >
                            <Save className="mr-2 h-3 w-3" />
                            Salva results parziali ({progress.completed}/{progress.total})
                          </Button>
                        )}
                        
                        {/* Cancel button */}
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-destructive/50 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setIsTranslating(false);
                            setError('Traduzione annullata dall\'utente');
                          }}
                        >
                          <Square className="mr-2 h-3 w-3" />
                          Annulla traduzione
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : error ? (
                <>
                  <AlertTriangle className="h-16 w-16 mx-auto text-destructive mb-4" />
                  <h2 className="text-xl font-semibold mb-2">error</h2>
                  <p className="text-muted-foreground mb-4">{error}</p>
                  <Button onClick={() => setCurrentStep('configure')}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Riprova
                  </Button>
                </>
              ) : (
                <>
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Completato!</h2>
                  <Button onClick={() => setCurrentStep('results')}>
                    Vedi results
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Step 5: Results */}
        {currentStep === 'results' && currentJob && (
          <div className="space-y-6">
            {/* Game Info Header */}
            {selectedGame && (
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/50 to-blue-900/50 shadow-lg flex-shrink-0">
                  {selectedGame.coverUrl && (
                    <img 
                      src={selectedGame.coverUrl} 
                      alt={selectedGame.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center -z-10">
                    <span className="text-sm font-bold text-white/50">{selectedGame.name?.charAt(0)?.toUpperCase() || '?'}</span>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-purple-400">{selectedGame.name}</h3>
                  <p className="text-xs text-muted-foreground">Traduzione completata</p>
                </div>
              </div>
            )}
            
            {/* Stats with glow effects */}
            <div className="grid grid-cols-4 gap-4">
              <div className="group p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center transition-all duration-300 hover:bg-green-500/15 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:scale-[1.02]">
                <p className="text-2xl font-bold text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">{currentJob.results.translatedItems}</p>
                <p className="text-xs text-muted-foreground">Tradotte</p>
              </div>
              <div className="group p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center transition-all duration-300 hover:bg-blue-500/15 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-[1.02]">
                <p className="text-2xl font-bold text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">{currentJob.results.fromMemoryItems}</p>
                <p className="text-xs text-muted-foreground">Da memoria</p>
              </div>
              <div className="group p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center transition-all duration-300 hover:bg-purple-500/15 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:scale-[1.02]">
                <p className="text-2xl font-bold text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">{currentJob.results.averageQualityScore}%</p>
                <p className="text-xs text-muted-foreground">Qualità</p>
              </div>
              <div className="group p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center transition-all duration-300 hover:bg-amber-500/15 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-[1.02]">
                <p className="text-2xl font-bold text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">${currentJob.results.estimatedCost.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">Costo</p>
              </div>
            </div>
            
            {/* Files */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">File tradotti</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSaveAllFiles}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Salva tutti (con backup)
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                    <Download className="mr-2 h-4 w-4" />
                    Scarica tutti
                  </Button>
                  <Button variant="default" size="sm" onClick={handleExportPatch} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    <Package className="mr-2 h-4 w-4" />
                    Esporta Patch
                  </Button>
                </div>
              </div>
              
              {Array.from(translatedFiles.entries()).map(([filename, content]) => (
                <div key={filename} className="group flex items-center gap-3 p-3 rounded-lg border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-card hover:border-green-500/30 hover:shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                  <div className="p-2 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                    <FileCode className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm group-hover:text-green-400 transition-colors">{targetLanguage}_{filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {(content.length / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenInEditor(filename)} title="Apri nell'Editor" className="hover:bg-blue-500/20 hover:text-blue-400">
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleSaveFile(filename)} title="Salva con backup" className="hover:bg-green-500/20 hover:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDownloadFile(filename)} title="Scarica" className="hover:bg-purple-500/20 hover:text-purple-400">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Quality Issues */}
            {currentJob.results.qualityIssues.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <h3 className="font-medium flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Problemi di qualità ({currentJob.results.qualityIssues.length})
                </h3>
                <ScrollArea className="h-32">
                  {currentJob.results.qualityIssues.slice(0, 10).map((issue, i) => (
                    <div key={i} className="text-sm mb-2">
                      <p className="font-mono text-xs truncate">"{issue.sourceText}"</p>
                      <p className="text-amber-600 text-xs">{issue.issues.join(', ')}</p>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex justify-between items-center pt-4">
              <Button variant="outline" onClick={() => {
                setCurrentStep('select-game');
                setSelectedGame(null);
                setSelectedFiles([]);
                setTranslatedFiles(new Map());
                setCurrentJob(null);
              }}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Nuova traduzione
              </Button>
              
              {/* ONE-CLICK APPLY - The Magic Button */}
              <Button 
                size="lg"
                className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-green-500/25 transition-all"
                onClick={handleApplyToGame}
                disabled={isApplying || translatedFiles.size === 0}
              >
                {isApplying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {applyStatus === 'finding' && 'Cerco game...'}
                    {applyStatus === 'checking' && 'Verifico...'}
                    {applyStatus === 'installing' && 'Installo patcher...'}
                    {applyStatus === 'applying' && 'Applico...'}
                  </>
                ) : applyStatus === 'done' ? (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Applicato!
                  </>
                ) : (
                  <>
                    <Rocket className="h-5 w-5" />
                    Applica al game
                  </>
                )}
              </Button>
              
              {/* PLAY BUTTON - Sempre visibile se c'è un game Steam */}
              {selectedGame?.id?.startsWith('steam_') && (
                <a 
                  href={`steam://rungameid/${selectedGame.id.replace('steam_', '')}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-medium rounded-md bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-blue-500/25 transition-all text-white"
                >
                  <Play className="h-5 w-5" />
                  Gioca
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Export Success Dialog */}
      <AlertDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-green-400 flex items-center gap-2">
              <CheckCircle className="h-6 w-6" />
              Patch Esportata con Successo!
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-slate-300 space-y-3">
                <p>Il pacchetto di traduzione è stato salvato sul tuo Desktop:</p>
                <code className="block bg-slate-900 p-3 rounded text-blue-300 text-sm break-all">
                  {exportedFilePath}
                </code>
                <div className="mt-4 text-sm text-slate-400">
                  <p className="font-semibold mb-2">Il pacchetto contiene:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>File tradotti pronti per l'uso</li>
                    <li>Backup dei file originali</li>
                    <li>Formato XUnity.AutoTranslator</li>
                    <li>README con istruzioni</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-green-600 hover:bg-green-700">
              Chiudi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



