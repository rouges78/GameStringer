'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  ChevronDown, ChevronUp, Filter, Settings2, Info
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

// ============================================================================
// TYPES
// ============================================================================

interface Game {
  id: string;
  name: string;
  provider: string;
  coverUrl?: string;
  installPath?: string;
}

interface SelectedFile {
  name: string;
  path?: string;
  content: string;
  format: FileFormat;
  parseResult: ParseResult;
}

type Step = 'select-game' | 'select-files' | 'configure' | 'translate' | 'results';

// ============================================================================
// COMPONENT
// ============================================================================

export default function TranslatorProPage() {
  // === STATES ===
  
  // Navigation
  const [currentStep, setCurrentStep] = useState<Step>('select-game');
  
  // Game selection
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // File selection
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  
  // Configuration
  const [provider, setProvider] = useState<'openai' | 'deepl' | 'google'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [useTranslationMemory, setUseTranslationMemory] = useState(true);
  const [runQualityChecks, setRunQualityChecks] = useState(true);
  
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
  
  // Initialize Neural Translator
  useEffect(() => {
    const init = async () => {
      await initializeNeuralTranslator(sourceLanguage, targetLanguage);
      const stats = getSystemStats();
      setTmStats(stats.translationMemory);
    };
    init();
  }, [sourceLanguage, targetLanguage]);
  
  // === COMPUTED ===
  
  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return games;
    const q = searchQuery.toLowerCase();
    return games.filter(g => g.name.toLowerCase().includes(q));
  }, [games, searchQuery]);
  
  const totalStrings = useMemo(() => {
    return selectedFiles.reduce((sum, f) => sum + f.parseResult.strings.length, 0);
  }, [selectedFiles]);
  
  const costEstimate = useMemo(() => {
    if (selectedFiles.length === 0) return null;
    const allStrings = selectedFiles.flatMap(f => 
      f.parseResult.strings.map(s => ({ text: s.value }))
    );
    return estimateBatchCost(allStrings, {
      provider,
      useTranslationMemory,
      tmHitRate: tmStats ? 0.3 : 0
    });
  }, [selectedFiles, provider, useTranslationMemory, tmStats]);
  
  // === HANDLERS ===
  
  const handleGameSelect = (game: Game) => {
    setSelectedGame(game);
    setSelectedFiles([]);
    setCurrentStep('select-files');
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
    
    setSelectedFiles(prev => [...prev, ...newFiles]);
    setIsLoadingFiles(false);
  };
  
  const handleRemoveFile = (filename: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== filename));
  };
  
  const handleStartTranslation = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsTranslating(true);
    setIsPaused(false);
    setError(null);
    setProgress(null);
    setTranslatedFiles(new Map());
    
    try {
      for (const file of selectedFiles) {
        const result = await translateFile(file.content, file.name, {
          sourceLanguage,
          targetLanguage,
          provider,
          gameId: selectedGame?.id,
          gameName: selectedGame?.name,
          useTranslationMemory,
          runQualityChecks,
          onProgress: (p) => setProgress(p)
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
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        {game.provider}
                      </Badge>
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
                <div>
                  <h2 className="text-lg font-semibold">{selectedGame.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Seleziona i file di localizzazione da tradurre
                  </p>
                </div>
              </div>
            )}
            
            {/* File Upload */}
            <div className="border-2 border-dashed rounded-xl p-8 text-center">
              <input
                type="file"
                multiple
                accept=".json,.po,.pot,.xliff,.xlf,.resx,.strings,.ini,.csv,.properties,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-1">
                  Trascina i file qui o clicca per selezionare
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Formati supportati: {SUPPORTED_FORMATS.join(', ')}
                </p>
              </label>
            </div>
            
            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">File selezionati ({selectedFiles.length})</h3>
                {selectedFiles.map((file) => (
                  <div key={file.name} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
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
                      onClick={() => handleRemoveFile(file.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                
                <div className="flex justify-between items-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    Totale: <strong>{totalStrings}</strong> stringhe da tradurre
                  </p>
                  <Button onClick={() => setCurrentStep('configure')} disabled={selectedFiles.length === 0}>
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
                <p className="text-2xl font-bold">{selectedFiles.length}</p>
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
                          <Zap className="h-4 w-4" />
                          OpenAI GPT-4o
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
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Inserisci la tua API key"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Lingua origine</Label>
                    <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="ja">日本語</SelectItem>
                        <SelectItem value="zh">中文</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lingua destinazione</Label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">Italiano</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
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
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-pulse" />
                    <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
                      <Brain className="h-8 w-8 text-purple-500 animate-pulse" />
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Traduzione in corso...</h2>
                  {progress && (
                    <div className="max-w-md mx-auto space-y-3">
                      <Progress value={progress.percentage} className="h-2" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{progress.completed}/{progress.total} stringhe</span>
                        <span>{progress.fromMemory} da memoria</span>
                      </div>
                      {progress.estimatedTimeRemaining && (
                        <p className="text-sm text-muted-foreground">
                          Tempo rimanente: ~{formatTimeRemaining(progress.estimatedTimeRemaining)}
                        </p>
                      )}
                      {progress.currentItem && (
                        <p className="text-xs text-muted-foreground truncate">
                          "{progress.currentItem}..."
                        </p>
                      )}
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
                <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                  <Download className="mr-2 h-4 w-4" />
                  Scarica tutti
                </Button>
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
                  <Button variant="ghost" size="sm" onClick={() => handleDownloadFile(filename)}>
                    <Download className="h-4 w-4" />
                  </Button>
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
