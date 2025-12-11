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
  Loader2, AlertTriangle, FolderOpen, FileText, ArrowLeft,
  Languages, CheckCircle, Search, ChevronRight, Sparkles,
  Upload, Download, Brain, Shield, Zap, Clock, DollarSign,
  Play, Pause, Square, RotateCcw, FileCode, Database,
  ChevronDown, ChevronUp, Filter, Settings2, Info, Cpu, Wind
} from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import Image from 'next/image';
import { cn } from '@/lib/utils';

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
  
  // Configuration
  const [provider, setProvider] = useState<'openai' | 'gpt5' | 'gemini' | 'claude' | 'deepseek' | 'mistral' | 'openrouter' | 'deepl' | 'google'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [useTranslationMemory, setUseTranslationMemory] = useState(true);
  const [runQualityChecks, setRunQualityChecks] = useState(true);
  
  // Carica API key salvata quando cambia provider
  useEffect(() => {
    const savedKey = localStorage.getItem(`gamestringer_apikey_${provider}`);
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setApiKey('');
    }
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
  
  // Results
  const [translatedFiles, setTranslatedFiles] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  
  // Stats
  const [tmStats, setTmStats] = useState<{ totalUnits: number; verifiedUnits: number } | null>(null);
  
  // === EFFECTS ===
  
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
        
        // Filter for likely localization files (same logic as Wizard)
        const locFiles = scannedFiles.filter(file => {
          const fileName = (file.name || '').toLowerCase();
          const filePath = (file.path || '').toLowerCase();
          const isLocFile = 
            fileName.includes('local') || 
            fileName.includes('lang') || 
            fileName.includes('text') ||
            fileName.includes('string') ||
            fileName.includes('dialog') ||
            fileName.includes('dialogue') ||
            fileName.includes('translation') ||
            fileName.includes('resource') ||
            filePath.includes('example') ||
            filePath.includes('localization');
          const sizeThreshold = file.extension === 'txt' ? 50000 : 5000;
          return isLocFile || file.size > sizeThreshold;
        });
        
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
                
                if (parseResult.strings.length > 0) {
                  newFiles.push({
                    name: file.name,
                    path: file.path,
                    content,
                    format: parseResult.format,
                    parseResult
                  });
                }
              } catch (parseErr) {
                console.warn(`Skipping ${file.name}: not a valid translation file`);
              }
            }
          } catch (err) {
            console.error(`Error reading ${file.name}:`, err);
          }
        }
        
        setSelectedFiles(prev => {
          const existingNames = new Set(prev.map(f => f.name));
          const uniqueNewFiles = newFiles.filter(f => !existingNames.has(f.name));
          return [...prev, ...uniqueNewFiles];
        });
      } else {
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
          }
        });
        
        setCurrentJob(result.job);
        setTranslatedFiles(prev => new Map(prev).set(file.name, result.translatedContent));
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
      alert(`❌ Errore nel salvataggio: ${err}`);
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
  
  // === STEP INDICATOR ===
  
  const steps = [
    { id: 'select-game', label: 'Gioco', icon: Languages },
    { id: 'select-files', label: 'File', icon: FileText },
    { id: 'configure', label: 'Configura', icon: Settings2 },
    { id: 'translate', label: 'Traduci', icon: Sparkles },
    { id: 'results', label: 'Risultati', icon: CheckCircle },
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
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-lg shadow-purple-500/25">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
              Neural Translator Pro
            </h1>
            <p className="text-sm text-muted-foreground">
              Sistema professionale di traduzione con AI
            </p>
          </div>
          
          {/* TM Stats Badge */}
          {tmStats && (
            <Badge variant="secondary" className="ml-auto gap-1.5">
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
                    isActive && "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/25",
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
                placeholder="Cerca tra i tuoi giochi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            
            <div className="text-sm text-muted-foreground px-1">
              {filteredGames.length} giochi trovati
            </div>
            
            <ScrollArea className="h-[450px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredGames.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => handleGameSelect(game)}
                    className={cn(
                      "group flex items-center gap-3 p-3 rounded-xl border transition-all",
                      "hover:border-purple-500/50 hover:bg-purple-500/5 hover:shadow-md",
                      "text-left w-full"
                    )}
                  >
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {game.coverUrl ? (
                        <Image src={game.coverUrl} alt={game.name} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Languages className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate group-hover:text-purple-500">
                        {game.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {game.provider}
                        </Badge>
                        {game.supportedLanguages && (
                          <LanguageFlags supportedLanguages={game.supportedLanguages} maxFlags={5} />
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-500" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Step 2: Select Files */}
        {currentStep === 'select-files' && (
          <div className="space-y-6">
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
              Cambia gioco
            </Button>
            
            {/* Selected Game */}
            {selectedGame && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted">
                  {selectedGame.coverUrl ? (
                    <Image src={selectedGame.coverUrl} alt={selectedGame.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Languages className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">{selectedGame.name}</h2>
                  {selectedGame.supportedLanguages ? (
                    <div className="flex items-center gap-2 mt-1">
                      <LanguageFlags supportedLanguages={selectedGame.supportedLanguages} maxFlags={8} />
                      <span className="text-xs text-muted-foreground">
                        {selectedGame.supportedLanguages.replace(/<[^>]*>?/gm, '').split(',').length} lingue
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Seleziona i file di localizzazione da tradurre
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Search Game Files Button - PROMINENT */}
            <Button
              variant="default"
              size="lg"
              className="w-full h-16 gap-3 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              onClick={handleSearchGameFiles}
              disabled={isLoadingFiles}
            >
              {isLoadingFiles ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Ricerca in corso...
                </>
              ) : (
                <>
                  <Search className="h-6 w-6" />
                  🔍 Cerca file di traduzione del gioco
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
            
            {/* File Upload */}
            <div className="border-2 border-dashed rounded-xl p-6 text-center">
              <input
                type="file"
                multiple
                accept=".json,.po,.pot,.xliff,.xlf,.resx,.strings,.ini,.csv,.properties,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground mb-1">
                  Trascina i file qui o clicca per selezionare
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Formati: {SUPPORTED_FORMATS.join(', ')}
                </p>
              </label>
            </div>
            
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
                      <SelectItem value="openai">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-green-500" />
                          OpenAI GPT-4o Mini
                        </div>
                      </SelectItem>
                      <SelectItem value="gpt5">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-emerald-500" />
                          ChatGPT-5 (GPT-4o)
                        </div>
                      </SelectItem>
                      <SelectItem value="gemini">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-500" />
                          Google Gemini 2.5
                        </div>
                      </SelectItem>
                      <SelectItem value="claude">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-orange-500" />
                          Claude Sonnet 4
                        </div>
                      </SelectItem>
                      <SelectItem value="deepseek">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-cyan-500" />
                          DeepSeek V3
                        </div>
                      </SelectItem>
                      <SelectItem value="mistral">
                        <div className="flex items-center gap-2">
                          <Wind className="h-4 w-4 text-indigo-500" />
                          Mistral Large
                        </div>
                      </SelectItem>
                      <SelectItem value="openrouter">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-purple-500" />
                          OpenRouter (Multi-Model)
                        </div>
                      </SelectItem>
                      <SelectItem value="deepl">DeepL</SelectItem>
                      <SelectItem value="google">Google Translate</SelectItem>
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
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
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
                        : "bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    )} />
                    <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
                      {progress?.isRateLimited ? (
                        <Clock className="h-8 w-8 text-amber-500 animate-pulse" />
                      ) : (
                        <Brain className="h-8 w-8 text-purple-500 animate-pulse" />
                      )}
                    </div>
                  </div>
                  
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
                          Tempo trascorso: {formatTimeRemaining(Math.floor((Date.now() - progress.startTime) / 1000))}
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
                      
                      {/* Cancel button */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="mt-4 border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setIsTranslating(false);
                          setError('Traduzione annullata dall\'utente');
                        }}
                      >
                        <Square className="mr-2 h-3 w-3" />
                        Annulla traduzione
                      </Button>
                    </div>
                  )}
                </>
              ) : error ? (
                <>
                  <AlertTriangle className="h-16 w-16 mx-auto text-destructive mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Errore</h2>
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
                    Vedi risultati
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
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-2xl font-bold text-green-500">{currentJob.results.translatedItems}</p>
                <p className="text-xs text-muted-foreground">Tradotte</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                <p className="text-2xl font-bold text-blue-500">{currentJob.results.fromMemoryItems}</p>
                <p className="text-xs text-muted-foreground">Da memoria</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                <p className="text-2xl font-bold text-purple-500">{currentJob.results.averageQualityScore}%</p>
                <p className="text-xs text-muted-foreground">Qualità</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-2xl font-bold text-amber-500">${currentJob.results.estimatedCost.toFixed(4)}</p>
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
                </div>
              </div>
              
              {Array.from(translatedFiles.entries()).map(([filename, content]) => (
                <div key={filename} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <FileCode className="h-5 w-5 text-green-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{targetLanguage}_{filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {(content.length / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenInEditor(filename)} title="Apri nell'Editor">
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleSaveFile(filename)} title="Salva con backup">
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDownloadFile(filename)} title="Scarica">
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
            <div className="flex justify-between pt-4">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
