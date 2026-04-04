'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Wand2, FolderOpen, Languages, Rocket, CheckCircle2, 
  AlertCircle, Loader2, FileText, ArrowRight, RefreshCw,
  Download, Upload, Search, Cpu, Zap, Shield, BarChart3,
  Play, Pause, RotateCcw, Eye, ChevronDown, ChevronUp,
  Package, Table, Filter, ArrowUpDown, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

// ── Types ──────────────────────────────────────────────────
interface ExtractResult {
  totalFiles: number;
  totalBlobs: number;
  totalCarets: number;
  uniqueStrings: number;
  extractedPath: string;
}

interface TranslateProgress {
  total: number;
  done: number;
  errors: number;
  currentText: string;
  currentCharacter?: string;
  rate: number;
  eta: number;
  status: 'idle' | 'running' | 'paused' | 'done' | 'error';
}

interface CharacterProfileSimple {
  id: string;
  name: string;
  archetype: string;
  traits: string[];
  mood: string;
  formality: string;
  vocabulary: string;
  catchphrases: string[];
  preferredWords: Record<string, string>;
  avoidWords: string[];
  exampleDialogues: Array<{ original: string; translated: string }>;
}

interface InjectResult {
  filesProcessed: number;
  totalFiles: number;
  storiesModified: number;
  totalReplacements: number;
  status: 'idle' | 'running' | 'done' | 'error';
  error?: string;
}

interface TranslationPair {
  english: string;
  italian: string;
  translated: boolean;
}

interface PreviewStats {
  totalStrings: number;
  translatedCount: number;
  untranslatedCount: number;
  coverage: number;
  shortCount: number;
  mediumCount: number;
  longCount: number;
}

interface SteamGame {
  name: string;
  dataPath: string;
  appId: string;
  inkBlobs: number;
  assetsFiles: number;
  size: string;
}

type Step = 'select' | 'extract' | 'translate' | 'inject' | 'done';

// ── Main Component ─────────────────────────────────────────
export function UnityInkTranslator() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('select');
  const [gameDir, setGameDir] = useState('');
  const [gameName, setGameName] = useState('');
  const [targetLang, setTargetLang] = useState('it');
  const [ollamaModel, setOllamaModel] = useState('huihui_ai/hy-mt1.5-abliterated:7b');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [extracting, setExtracting] = useState(false);
  
  const [translateProgress, setTranslateProgress] = useState<TranslateProgress>({
    total: 0, done: 0, errors: 0, currentText: '', rate: 0, eta: 0, status: 'idle'
  });
  
  const [injectResult, setInjectResult] = useState<InjectResult>({
    filesProcessed: 0, totalFiles: 0, storiesModified: 0, totalReplacements: 0, status: 'idle'
  });

  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  
  const [steamGames, setSteamGames] = useState<SteamGame[]>([]);
  const [scanningGames, setScanningGames] = useState(false);
  const [scannedPaths, setScannedPaths] = useState<string[]>([]);
  
  const [showPreview, setShowPreview] = useState(false);
  const [previewPairs, setPreviewPairs] = useState<TranslationPair[]>([]);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewPage, setPreviewPage] = useState(0);
  const [previewTotalPages, setPreviewTotalPages] = useState(0);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'translated' | 'untranslated'>('all');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [useCharacterVoices, setUseCharacterVoices] = useState(true);
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfileSimple[]>([
    { id: 'narrator', name: 'Narratore', archetype: 'narrator', traits: ['onnisciente', 'eloquente'], mood: 'calm', formality: 'formal', vocabulary: 'sophisticated', catchphrases: [], preferredWords: {}, avoidWords: [], exampleDialogues: [] },
    { id: 'hero', name: 'Eroe', archetype: 'hero', traits: ['coraggioso', 'determinato'], mood: 'serious', formality: 'neutral', vocabulary: 'standard', catchphrases: [], preferredWords: {}, avoidWords: [], exampleDialogues: [] },
    { id: 'villain', name: 'Cattivo', archetype: 'villain', traits: ['astuto', 'crudele'], mood: 'mysterious', formality: 'formal', vocabulary: 'sophisticated', catchphrases: [], preferredWords: {}, avoidWords: [], exampleDialogues: [] },
    { id: 'wizard', name: 'Mago', archetype: 'wizard', traits: ['saggio', 'misterioso'], mood: 'mysterious', formality: 'formal', vocabulary: 'archaic', catchphrases: [], preferredWords: {}, avoidWords: [], exampleDialogues: [] },
    { id: 'merchant', name: 'Mercante', archetype: 'merchant', traits: ['affabile', 'astuto'], mood: 'cheerful', formality: 'informal', vocabulary: 'standard', catchphrases: [], preferredWords: {}, avoidWords: [], exampleDialogues: [] },
  ]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-200), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Check Ollama status and scan Steam on mount
  useEffect(() => {
    checkOllama();
    scanSteamGames();
  }, []);

  async function scanSteamGames() {
    setScanningGames(true);
    try {
      const resp = await fetch('/api/unity-ink/steam-scan');
      const data = await resp.json();
      if (data.games) {
        setSteamGames(data.games);
        setScannedPaths(data.scannedPaths || []);
        addLog(`Steam scan: ${data.games.length} giochi Unity+Ink trovati in ${(data.scannedPaths || []).length} cartelle`);
      }
    } catch {
      addLog('Scansione Steam non disponibile');
    }
    setScanningGames(false);
  }

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  async function checkOllama() {
    setOllamaStatus('checking');
    try {
      const resp = await fetch('/api/unity-ink/ollama-status');
      const data = await resp.json();
      if (data.online) {
        setOllamaStatus('online');
        setOllamaModels(data.models || []);
        if (data.models?.length > 0 && !ollamaModel) {
          setOllamaModel(data.models[0]);
        }
        addLog(`Ollama online — ${data.models?.length || 0} modelli disponibili`);
      } else {
        setOllamaStatus('offline');
        addLog('Ollama non raggiungibile');
      }
    } catch {
      setOllamaStatus('offline');
      addLog('Errore verifica Ollama');
    }
  }

  // ── STEP 1: Select Game ──────────────────────────────────
  async function handleSelectGame() {
    if (!gameDir.trim()) return;
    addLog(`Cartella gioco: ${gameDir}`);
    
    try {
      const resp = await fetch('/api/unity-ink/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameDir })
      });
      const data = await resp.json();
      
      if (data.error) {
        addLog(`Errore: ${data.error}`);
        return;
      }
      
      setGameName(data.gameName || 'Unknown Game');
      addLog(`Gioco rilevato: ${data.gameName} — ${data.assetsCount} file assets, ${data.inkBlobCount} blob Ink`);
      toast({ title: `${data.gameName} rilevato`, description: `${data.inkBlobCount} blob Ink in ${data.assetsCount} file` });
      setStep('extract');
    } catch (e: unknown) {
      addLog(`Errore connessione: ${e.message}`);
    }
  }

  // ── STEP 2: Extract Strings ──────────────────────────────
  async function handleExtract() {
    setExtracting(true);
    addLog('Estrazione stringhe Ink in corso...');
    
    try {
      const resp = await fetch('/api/unity-ink/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameDir })
      });
      const data = await resp.json();
      
      if (data.error) {
        addLog(`Errore estrazione: ${data.error}`);
        setExtracting(false);
        return;
      }
      
      setExtractResult(data);
      addLog(`Estratte ${data.uniqueStrings} stringhe uniche da ${data.totalBlobs} blob in ${data.totalFiles} file`);
      toast({ title: 'Estrazione completata', description: `${data.uniqueStrings.toLocaleString()} stringhe uniche trovate` });
      setStep('translate');
    } catch (e: unknown) {
      addLog(`Errore: ${e.message}`);
    }
    setExtracting(false);
  }

  // ── STEP 3: Translate ────────────────────────────────────
  async function handleTranslate() {
    addLog(`Avvio traduzione con ${ollamaModel}${useCharacterVoices ? ` + Character Voice (${characterProfiles.length} profili)` : ''}...`);
    setTranslateProgress(prev => ({ ...prev, status: 'running' }));
    
    try {
      const resp = await fetch('/api/unity-ink/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gameDir, 
          targetLang, 
          model: ollamaModel,
          characterProfiles: useCharacterVoices ? characterProfiles : []
        })
      });
      const data = await resp.json();
      
      if (data.error) {
        addLog(`Errore: ${data.error}`);
        setTranslateProgress(prev => ({ ...prev, status: 'error' }));
        return;
      }
      
      addLog(`Traduzione avviata — ${data.total} stringhe da tradurre`);
      setTranslateProgress(prev => ({ ...prev, total: data.total }));
      
      // Start polling for progress
      startProgressPolling();
    } catch (e: unknown) {
      addLog(`Errore: ${e.message}`);
      setTranslateProgress(prev => ({ ...prev, status: 'error' }));
    }
  }

  function startProgressPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    
    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`/api/unity-ink/translate-progress?gameDir=${encodeURIComponent(gameDir)}`);
        const data = await resp.json();
        
        setTranslateProgress(prev => ({
          ...prev,
          done: data.done || 0,
          errors: data.errors || 0,
          currentText: data.currentText || '',
          currentCharacter: data.currentCharacter || '',
          rate: data.rate || 0,
          eta: data.eta || 0,
          status: data.status || prev.status,
        }));
        
        if (data.status === 'done' || data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          
          if (data.status === 'done') {
            addLog(`Traduzione completata: ${data.done} stringhe tradotte`);
            toast({ title: 'Traduzione completata!', description: `${data.done} stringhe tradotte con successo` });
            setStep('inject');
          } else {
            addLog(`Traduzione terminata con errori: ${data.errors}`);
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
  }

  // ── STEP 4: Inject ──────────────────────────────────────
  async function handleInject() {
    setInjectResult(prev => ({ ...prev, status: 'running' }));
    addLog('Iniezione traduzioni nei file di gioco...');
    
    try {
      const resp = await fetch('/api/unity-ink/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameDir })
      });
      const data = await resp.json();
      
      if (data.error) {
        addLog(`Errore iniezione: ${data.error}`);
        setInjectResult(prev => ({ ...prev, status: 'error', error: data.error }));
        return;
      }
      
      setInjectResult({
        filesProcessed: data.filesProcessed,
        totalFiles: data.totalFiles,
        storiesModified: data.storiesModified,
        totalReplacements: data.totalReplacements,
        status: 'done'
      });
      addLog(`Iniezione completata: ${data.totalReplacements} sostituzioni in ${data.filesProcessed} file`);
      toast({ title: 'Iniezione completata!', description: `${data.totalReplacements.toLocaleString()} sostituzioni — avvia il gioco!` });
      setStep('done');
    } catch (e: unknown) {
      addLog(`Errore: ${e.message}`);
      setInjectResult(prev => ({ ...prev, status: 'error', error: e.message }));
    }
  }

  // ── STEP 5: Restore backup ──────────────────────────────
  async function handleRestore() {
    addLog('Ripristino file originali dai backup...');
    try {
      const resp = await fetch('/api/unity-ink/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameDir })
      });
      const data = await resp.json();
      addLog(data.message || 'Ripristino completato');
    } catch (e: unknown) {
      addLog(`Errore ripristino: ${e.message}`);
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Preview & Stats ────────────────────────────────────
  async function loadPreview(page = 0, search = '') {
    if (!gameDir) return;
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams({
        gameDir,
        page: String(page),
        search,
      });
      const resp = await fetch(`/api/unity-ink/preview?${params}`);
      const data = await resp.json();
      if (data.pairs) {
        let pairs = data.pairs as TranslationPair[];
        if (previewFilter === 'translated') pairs = pairs.filter(p => p.translated);
        if (previewFilter === 'untranslated') pairs = pairs.filter(p => !p.translated);
        setPreviewPairs(pairs);
        setPreviewStats(data.stats);
        setPreviewPage(data.pagination?.page || 0);
        setPreviewTotalPages(data.pagination?.totalPages || 0);
      }
    } catch { /* ignore */ }
    setLoadingPreview(false);
  }

  async function handleExportPack() {
    addLog('Esportazione pack traduzioni...');
    try {
      const resp = await fetch('/api/unity-ink/preview?gameDir=' + encodeURIComponent(gameDir));
      const data = await resp.json();
      if (!data.stats) { addLog('Nessun dato da esportare'); return; }
      
      const packData = {
        gameName,
        gameDir,
        targetLanguage: targetLang,
        model: ollamaModel,
        stats: data.stats,
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
      };
      
      const blob = new Blob([JSON.stringify(packData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${gameName.replace(/\s+/g, '_').toLowerCase()}_translation_pack.json`;
      a.click();
      URL.revokeObjectURL(url);
      addLog('Pack esportato!');
    } catch (e: unknown) {
      addLog(`Errore export: ${e.message}`);
    }
  }

  const steps: { key: Step; label: string; icon: typeof Wand2 }[] = [
    { key: 'select', label: 'Seleziona Gioco', icon: FolderOpen },
    { key: 'extract', label: 'Estrai Stringhe', icon: Search },
    { key: 'translate', label: 'Traduci', icon: Languages },
    { key: 'inject', label: 'Inietta', icon: Rocket },
    { key: 'done', label: 'Completato', icon: CheckCircle2 },
  ];

  const stepOrder: Step[] = ['select', 'extract', 'translate', 'inject', 'done'];
  const currentStepIdx = stepOrder.indexOf(step);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-700 via-purple-600 to-fuchsia-700 p-4">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg border border-white/10">
              <Wand2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Unity Ink Translator</h1>
              <p className="text-white/70 text-xs">Traduci giochi Unity con storie Ink — estrai, traduci, inietta</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <Badge variant="outline" className={cn(
              "border-white/20 text-white/80 text-2xs",
              ollamaStatus === 'online' && "border-green-400/40 text-green-300",
              ollamaStatus === 'offline' && "border-red-400/40 text-red-300"
            )}>
              <Cpu className="h-3 w-3 mr-1" />
              Ollama: {ollamaStatus === 'checking' ? '...' : ollamaStatus === 'online' ? 'Online' : 'Offline'}
            </Badge>
            {gameName && (
              <Badge variant="outline" className="border-white/20 text-white/80 text-2xs">
                🎮 {gameName}
              </Badge>
            )}
          </div>
        </div>

        {/* Step Progress */}
        <div className="relative mt-4 flex items-center gap-1">
          {steps.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = step === s.key;
            const isDone = currentStepIdx > i;
            
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-2xs font-medium transition-all",
                  isActive && "bg-white/20 text-white shadow-lg",
                  isDone && "bg-white/10 text-white/60",
                  !isActive && !isDone && "text-white/30"
                )}>
                  {isDone ? (
                    <CheckCircle2 className="h-3 w-3 text-green-300" />
                  ) : (
                    <StepIcon className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className={cn("h-3 w-3 mx-1 flex-shrink-0", isDone ? "text-white/40" : "text-white/15")} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Panel */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* STEP 1: Select Game */}
          {step === 'select' && (
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-violet-400" />
                  Seleziona cartella del gioco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Auto-detected Steam games */}
                {(steamGames.length > 0 || scanningGames) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-amber-400" />
                        Giochi Unity+Ink rilevati
                      </h3>
                      {scanningGames && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
                      {!scanningGames && (
                        <Button onClick={scanSteamGames} variant="ghost" size="xs" className="px-2 text-2xs text-slate-500">
                          <RefreshCw className="h-2.5 w-2.5 mr-1" />Riscan
                        </Button>
                      )}
                    </div>
                    
                    {steamGames.length > 0 ? (
                      <div className="grid gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {steamGames.map((game) => (
                          <button
                            key={game.dataPath}
                            onClick={() => { setGameDir(game.dataPath); setGameName(game.name); }}
                            className={cn(
                              "w-full text-left rounded-lg border p-2.5 transition-all hover:scale-[1.01]",
                              gameDir === game.dataPath
                                ? "bg-violet-500/15 border-violet-500/40 shadow-lg shadow-violet-500/10"
                                : "bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50 hover:border-slate-600/50"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn(
                                  "w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0",
                                  gameDir === game.dataPath ? "bg-violet-500/30 text-violet-300" : "bg-slate-700/50 text-slate-400"
                                )}>
                                  {game.inkBlobs}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-slate-200 truncate">{game.name}</div>
                                  <div className="text-2xs text-slate-500 truncate">{game.dataPath}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <Badge variant="outline" className="text-micro border-slate-600/50 text-slate-400">
                                  {game.assetsFiles} file
                                </Badge>
                                <Badge variant="outline" className="text-micro border-slate-600/50 text-slate-400">
                                  {game.size}
                                </Badge>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : scanningGames ? (
                      <div className="text-xs text-slate-500 text-center py-3">
                        Scansione cartelle Steam in corso...
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Manual path + divider */}
                {steamGames.length > 0 && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700/50" />
                    </div>
                    <div className="relative flex justify-center text-2xs">
                      <span className="bg-slate-900 px-2 text-slate-500">oppure inserisci percorso manualmente</span>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={gameDir}
                    onChange={(e) => setGameDir(e.target.value)}
                    placeholder="D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
                    className="flex-1 bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50"
                  />
                  <Button 
                    onClick={handleSelectGame}
                    disabled={!gameDir.trim()}
                    className="bg-violet-600 hover:bg-violet-500"
                  >
                    <Search className="h-4 w-4 mr-1" />
                    Rileva
                  </Button>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">Lingua target</label>
                    <select 
                      value={targetLang} 
                      onChange={e => setTargetLang(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="it">Italiano</option>
                      <option value="es">Espanol</option>
                      <option value="de">Deutsch</option>
                      <option value="fr">Francais</option>
                      <option value="pt">Portugues</option>
                      <option value="ja">Japanese</option>
                      <option value="ko">Korean</option>
                      <option value="zh">Chinese</option>
                      <option value="ru">Russian</option>
                      <option value="pl">Polski</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">Modello Ollama</label>
                    <select 
                      value={ollamaModel} 
                      onChange={e => setOllamaModel(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200"
                    >
                      {ollamaModels.length > 0 ? (
                        ollamaModels.map(m => <option key={m} value={m}>{m}</option>)
                      ) : (
                        <option value={ollamaModel}>{ollamaModel}</option>
                      )}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 2: Extract */}
          {step === 'extract' && (
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-400" />
                  Estrai stringhe Ink
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-400">
                  Scansione di <span className="text-blue-300 font-medium">{gameName}</span> per estrarre 
                  tutte le stringhe di dialogo dai blob Ink JSON.
                </p>
                
                {extractResult ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="File" value={extractResult.totalFiles} icon={FileText} color="blue" />
                    <StatCard label="Blob Ink" value={extractResult.totalBlobs} icon={Search} color="purple" />
                    <StatCard label="Stringhe" value={extractResult.totalCarets} icon={Languages} color="green" />
                    <StatCard label="Uniche" value={extractResult.uniqueStrings} icon={BarChart3} color="amber" />
                  </div>
                ) : (
                  <Button 
                    onClick={handleExtract}
                    disabled={extracting}
                    className="bg-blue-600 hover:bg-blue-500 w-full"
                    size="lg"
                  >
                    {extracting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Estrazione in corso...</>
                    ) : (
                      <><Search className="h-4 w-4 mr-2" />Avvia Estrazione</>
                    )}
                  </Button>
                )}
                
                {extractResult && (
                  <Button 
                    onClick={() => setStep('translate')} 
                    className="bg-violet-600 hover:bg-violet-500 w-full"
                  >
                    Procedi alla Traduzione <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 3: Translate */}
          {step === 'translate' && (
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Languages className="h-4 w-4 text-green-400" />
                  Traduzione in corso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {translateProgress.status === 'idle' && (
                  <>
                    <p className="text-sm text-slate-400">
                      Traduzione di <span className="text-green-300 font-medium">{extractResult?.uniqueStrings || '?'}</span> stringhe 
                      con <span className="text-green-300 font-medium">{ollamaModel}</span>
                    </p>

                    {/* Character Voice Profiles Toggle */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wand2 className="h-4 w-4 text-purple-400" />
                          <span className="text-sm font-medium text-slate-200">Character Voice AI</span>
                        </div>
                        <button
                          onClick={() => setUseCharacterVoices(!useCharacterVoices)}
                          className={cn(
                            "relative w-10 h-5 rounded-full transition-colors",
                            useCharacterVoices ? "bg-purple-500" : "bg-slate-600"
                          )}
                        >
                          <span className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                            useCharacterVoices ? "translate-x-5" : "translate-x-0.5"
                          )} />
                        </button>
                      </div>
                      
                      {useCharacterVoices && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">
                            Traduce usando profili psicologici dei personaggi — dialoghi, narrazione e azioni vengono rilevati automaticamente.
                            Usa la Chat API di Ollama per prompt più ricchi.
                          </p>
                          
                          {/* Quick-add preset profiles */}
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { name: 'Narratore', archetype: 'narrator', traits: ['onnisciente', 'eloquente'], mood: 'calm', formality: 'formal', vocabulary: 'sophisticated' },
                              { name: 'Eroe', archetype: 'hero', traits: ['coraggioso', 'determinato'], mood: 'serious', formality: 'neutral', vocabulary: 'standard' },
                              { name: 'Cattivo', archetype: 'villain', traits: ['astuto', 'crudele'], mood: 'mysterious', formality: 'formal', vocabulary: 'sophisticated' },
                              { name: 'Mago', archetype: 'wizard', traits: ['saggio', 'misterioso'], mood: 'mysterious', formality: 'formal', vocabulary: 'archaic' },
                              { name: 'Guerriero', archetype: 'warrior', traits: ['onorabile', 'diretto'], mood: 'serious', formality: 'neutral', vocabulary: 'standard' },
                              { name: 'Mercante', archetype: 'merchant', traits: ['affabile', 'astuto'], mood: 'cheerful', formality: 'informal', vocabulary: 'standard' },
                            ].map(preset => {
                              const isActive = characterProfiles.some(p => p.archetype === preset.archetype);
                              return (
                                <button
                                  key={preset.archetype}
                                  onClick={() => {
                                    if (isActive) {
                                      setCharacterProfiles(prev => prev.filter(p => p.archetype !== preset.archetype));
                                    } else {
                                      setCharacterProfiles(prev => [...prev, {
                                        id: preset.archetype,
                                        name: preset.name,
                                        archetype: preset.archetype,
                                        traits: preset.traits,
                                        mood: preset.mood,
                                        formality: preset.formality,
                                        vocabulary: preset.vocabulary,
                                        catchphrases: [],
                                        preferredWords: {},
                                        avoidWords: [],
                                        exampleDialogues: [],
                                      }]);
                                    }
                                  }}
                                  className={cn(
                                    "px-2 py-1 rounded-md text-[11px] font-medium border transition-all",
                                    isActive
                                      ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                                      : "bg-slate-700/30 border-slate-600/30 text-slate-400 hover:border-slate-500/50"
                                  )}
                                >
                                  {preset.name}
                                </button>
                              );
                            })}
                          </div>
                          
                          {characterProfiles.length > 0 && (
                            <div className="text-2xs text-purple-400/70">
                              {characterProfiles.length} profil{characterProfiles.length === 1 ? 'o' : 'i'} attiv{characterProfiles.length === 1 ? 'o' : 'i'}: {characterProfiles.map(p => p.name).join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <Button 
                      onClick={handleTranslate}
                      className={cn(
                        "w-full",
                        useCharacterVoices ? "bg-purple-600 hover:bg-purple-500" : "bg-green-600 hover:bg-green-500"
                      )}
                      size="lg"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {useCharacterVoices ? 'Avvia Traduzione con Character Voice' : 'Avvia Traduzione'}
                    </Button>
                  </>
                )}

                {(translateProgress.status === 'running' || translateProgress.status === 'done') && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">
                        {translateProgress.done} / {translateProgress.total} stringhe
                      </span>
                      <span className="text-slate-500">
                        {translateProgress.rate.toFixed(1)}/s — ETA: {Math.ceil(translateProgress.eta)}min
                      </span>
                    </div>
                    
                    <Progress 
                      value={translateProgress.total > 0 ? (translateProgress.done / translateProgress.total) * 100 : 0} 
                      className="h-3 bg-slate-800" 
                    />
                    
                    {translateProgress.currentText && (
                      <div className="bg-slate-800/50 rounded-lg p-2 text-xs text-slate-400 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Attuale:</span>
                          {translateProgress.currentCharacter && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-2xs font-medium">
                              {translateProgress.currentCharacter}
                            </span>
                          )}
                        </div>
                        <div className="truncate">{translateProgress.currentText}</div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <StatCard label="Tradotte" value={translateProgress.done} icon={CheckCircle2} color="green" small />
                      <StatCard label="Errori" value={translateProgress.errors} icon={AlertCircle} color="red" small />
                      <StatCard label="Velocità" value={`${translateProgress.rate.toFixed(1)}/s`} icon={Zap} color="amber" small />
                    </div>
                  </div>
                )}

                {translateProgress.status === 'done' && (
                  <Button 
                    onClick={() => setStep('inject')} 
                    className="bg-violet-600 hover:bg-violet-500 w-full"
                  >
                    Procedi all&apos;Iniezione <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}

                {translateProgress.status === 'error' && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    Errore durante la traduzione. Controlla che Ollama sia attivo.
                    <Button onClick={handleTranslate} variant="outline" size="sm" className="ml-2">
                      <RefreshCw className="h-3 w-3 mr-1" />Riprova
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 4: Inject */}
          {step === 'inject' && (
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-orange-400" />
                  Inietta traduzioni nel gioco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-200">
                  <Shield className="h-4 w-4 inline mr-1" />
                  I file originali verranno salvati automaticamente come backup (.backup)
                </div>

                {injectResult.status === 'idle' && (
                  <Button 
                    onClick={handleInject}
                    className="bg-orange-600 hover:bg-orange-500 w-full"
                    size="lg"
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    Avvia Iniezione
                  </Button>
                )}

                {injectResult.status === 'running' && (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Iniezione in corso... questo potrebbe richiedere qualche minuto.
                  </div>
                )}

                {injectResult.status === 'done' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatCard label="File" value={`${injectResult.filesProcessed}/${injectResult.totalFiles}`} icon={FileText} color="green" />
                      <StatCard label="Storie" value={injectResult.storiesModified} icon={Search} color="purple" />
                      <StatCard label="Sostituzioni" value={injectResult.totalReplacements} icon={Languages} color="blue" />
                      <StatCard label="Stato" value="OK" icon={CheckCircle2} color="green" />
                    </div>
                    
                    <Button 
                      onClick={() => setStep('done')} 
                      className="bg-green-600 hover:bg-green-500 w-full"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Completato!
                    </Button>
                  </div>
                )}

                {injectResult.status === 'error' && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    {injectResult.error || 'Errore durante l\'iniezione'}
                    <div className="mt-2 flex gap-2">
                      <Button onClick={handleInject} variant="outline" size="sm">
                        <RefreshCw className="h-3 w-3 mr-1" />Riprova
                      </Button>
                      <Button onClick={handleRestore} variant="outline" size="sm" className="text-amber-300 border-amber-500/30">
                        <RotateCcw className="h-3 w-3 mr-1" />Ripristina Originali
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 5: Done */}
          {step === 'done' && (
            <Card className="bg-slate-900/50 border-green-500/30">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-green-300">Traduzione Completata!</h2>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  <span className="text-green-300 font-bold">{injectResult.totalReplacements.toLocaleString()}</span> stringhe tradotte e iniettate in 
                  <span className="text-green-300 font-bold"> {injectResult.filesProcessed}</span> file.
                  Avvia il gioco per verificare!
                </p>
                
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                  <StatCard label="File" value={injectResult.filesProcessed} icon={FileText} color="green" small />
                  <StatCard label="Storie" value={injectResult.storiesModified} icon={Search} color="purple" small />
                  <StatCard label="Stringhe" value={injectResult.totalReplacements} icon={Languages} color="blue" small />
                </div>

                <div className="flex gap-2 justify-center pt-2">
                  <Button onClick={handleRestore} variant="outline" size="sm" className="text-amber-300 border-amber-500/30">
                    <RotateCcw className="h-3 w-3 mr-1" />Ripristina Originali
                  </Button>
                  <Button onClick={handleExportPack} variant="outline" size="sm" className="text-violet-300 border-violet-500/30">
                    <Package className="h-3 w-3 mr-1" />Esporta Pack
                  </Button>
                  <Button 
                    onClick={() => { setStep('select'); setExtractResult(null); setInjectResult({ filesProcessed: 0, totalFiles: 0, storiesModified: 0, totalReplacements: 0, status: 'idle' }); }}
                    variant="outline" 
                    size="sm"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />Nuovo Gioco
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Translation Preview Panel — shown after extract or later */}
          {currentStepIdx >= 2 && (
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle 
                    className="text-sm flex items-center gap-2 cursor-pointer"
                    onClick={() => { 
                      setShowPreview(!showPreview); 
                      if (!showPreview && previewPairs.length === 0) loadPreview(); 
                    }}
                  >
                    <Table className="h-4 w-4 text-violet-400" />
                    Preview Traduzioni
                    {previewStats && (
                      <Badge variant="outline" className="text-2xs border-violet-500/30 text-violet-300 ml-1">
                        {previewStats.coverage}% copertura
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {showPreview && (
                      <>
                        <Button onClick={handleExportPack} variant="ghost" size="xs" className="px-2 text-2xs text-violet-400">
                          <Package className="h-3 w-3 mr-1" />Export
                        </Button>
                        <Button onClick={() => loadPreview(previewPage, previewSearch)} variant="ghost" size="xs" className="px-2 text-2xs text-slate-400">
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {showPreview ? <ChevronUp className="h-3 w-3 text-slate-500 cursor-pointer" onClick={() => setShowPreview(false)} /> : <ChevronDown className="h-3 w-3 text-slate-500 cursor-pointer" onClick={() => { setShowPreview(true); if (previewPairs.length === 0) loadPreview(); }} />}
                  </div>
                </div>
              </CardHeader>
              
              {showPreview && (
                <CardContent className="pt-0 px-4 pb-4 space-y-3">
                  {/* Coverage Stats Bar */}
                  {previewStats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-green-400">{previewStats.coverage}%</div>
                        <div className="text-micro text-green-400/70">Copertura</div>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-blue-400">{previewStats.translatedCount.toLocaleString()}</div>
                        <div className="text-micro text-blue-400/70">Tradotte</div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-amber-400">{previewStats.untranslatedCount.toLocaleString()}</div>
                        <div className="text-micro text-amber-400/70">Mancanti</div>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-purple-400">{previewStats.totalStrings.toLocaleString()}</div>
                        <div className="text-micro text-purple-400/70">Totale</div>
                      </div>
                    </div>
                  )}

                  {/* Coverage Visual Bar */}
                  {previewStats && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-2xs text-slate-500">
                        <span>Copertura traduzione</span>
                        <span>{previewStats.translatedCount}/{previewStats.totalStrings}</span>
                      </div>
                      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${previewStats.coverage}%` }}
                        />
                      </div>
                      <div className="flex gap-3 text-micro text-slate-500">
                        <span>Corte (&lt;20): <span className="text-slate-400">{previewStats.shortCount}</span></span>
                        <span>Medie (20-80): <span className="text-slate-400">{previewStats.mediumCount}</span></span>
                        <span>Lunghe (80+): <span className="text-slate-400">{previewStats.longCount}</span></span>
                      </div>
                    </div>
                  )}

                  {/* Search & Filter */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
                      <input
                        type="text"
                        value={previewSearch}
                        onChange={(e) => setPreviewSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadPreview(0, previewSearch)}
                        aria-label="Cerca" placeholder="Cerca nelle traduzioni..."
                        className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                      />
                    </div>
                    <select
                      value={previewFilter}
                      onChange={(e) => { setPreviewFilter(e.target.value as string); loadPreview(0, previewSearch); }}
                      className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-2 py-1.5 text-xs text-slate-300"
                    >
                      <option value="all">Tutte</option>
                      <option value="translated">Tradotte</option>
                      <option value="untranslated">Mancanti</option>
                    </select>
                  </div>

                  {/* Table */}
                  <div className="bg-slate-950/50 rounded-lg border border-slate-800/50 overflow-hidden">
                    <div className="grid grid-cols-[1fr_1fr] text-2xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/50">
                      <div className="px-3 py-2">English</div>
                      <div className="px-3 py-2">Italiano</div>
                    </div>
                    
                    {loadingPreview ? (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                        Caricamento...
                      </div>
                    ) : previewPairs.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        Nessun risultato
                      </div>
                    ) : (
                      previewPairs.map((pair, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "grid grid-cols-[1fr_1fr] text-[11px] border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors",
                            !pair.translated && "bg-amber-500/5"
                          )}
                        >
                          <div className="px-3 py-1.5 text-slate-300 break-words border-r border-slate-800/30">
                            {pair.english.length > 100 ? pair.english.substring(0, 100) + '...' : pair.english}
                          </div>
                          <div className={cn("px-3 py-1.5 break-words", pair.translated ? "text-green-300/80" : "text-slate-600 italic")}>
                            {pair.translated ? (pair.italian.length > 100 ? pair.italian.substring(0, 100) + '...' : pair.italian) : '— non tradotta —'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pagination */}
                  {previewTotalPages > 1 && (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <Button 
                        onClick={() => loadPreview(Math.max(0, previewPage - 1), previewSearch)} 
                        disabled={previewPage === 0}
                        variant="ghost" size="xs" className="text-2xs"
                      >
                        Precedente
                      </Button>
                      <span>Pagina {previewPage + 1} di {previewTotalPages}</span>
                      <Button 
                        onClick={() => loadPreview(Math.min(previewTotalPages - 1, previewPage + 1), previewSearch)} 
                        disabled={previewPage >= previewTotalPages - 1}
                        variant="ghost" size="xs" className="text-2xs"
                      >
                        Successiva
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar: Log Panel */}
        <div className="space-y-4">
          {/* Quick Info */}
          {gameName && (
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Gioco:</span>
                  <span className="text-slate-200 font-medium">{gameName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Lingua:</span>
                  <span className="text-slate-200">{targetLang.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Modello:</span>
                  <span className="text-slate-200 text-xs truncate">{ollamaModel}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Ollama:</span>
                  <Badge variant="outline" className={cn(
                    "text-2xs",
                    ollamaStatus === 'online' ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"
                  )}>
                    {ollamaStatus === 'online' ? '● Online' : '● Offline'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Log Console */}
          <Card className="bg-slate-950/80 border-slate-700/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowLogs(!showLogs)}
              >
                <CardTitle className="text-xs flex items-center gap-1 text-slate-400">
                  <Eye className="h-3 w-3" />
                  Console Log
                </CardTitle>
                {showLogs ? <ChevronUp className="h-3 w-3 text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-500" />}
              </div>
            </CardHeader>
            {showLogs && (
              <CardContent className="pt-0 px-3 pb-3">
                <div className="bg-black/50 rounded-lg p-2 max-h-64 overflow-y-auto font-mono text-2xs text-slate-400 space-y-0.5">
                  {logs.length === 0 ? (
                    <div className="text-slate-600">In attesa...</div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className={cn(
                        log.includes('Errore') ? 'text-red-400' : 
                        log.includes('completat') ? 'text-green-400' : 
                        'text-slate-400'
                      )}>
                        {log}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </CardContent>
            )}
          </Card>

          {/* How it works */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Come funziona</h3>
              <div className="space-y-2 text-[11px] text-slate-500">
                <div className="flex gap-2">
                  <span className="text-violet-400 font-bold">1.</span>
                  <span>Seleziona la cartella <code className="text-violet-300">_Data</code> del gioco Unity</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-blue-400 font-bold">2.</span>
                  <span>Estrai le stringhe Ink (dialoghi) dai file assets</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-green-400 font-bold">3.</span>
                  <span>Traduci con Ollama locale (hy-mt1.5, qwen, ecc.)</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-orange-400 font-bold">4.</span>
                  <span>Inietta le traduzioni con AssetsTools.NET</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Stat Card Component ────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, small }: {
  label: string;
  value: number | string;
  icon: typeof Wand2;
  color: 'blue' | 'purple' | 'green' | 'amber' | 'red';
  small?: boolean;
}) {
  const colors = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  return (
    <div className={cn("rounded-lg border p-2 text-center", colors[color])}>
      <Icon className={cn("mx-auto mb-1", small ? "h-3 w-3" : "h-4 w-4")} />
      <div className={cn("font-bold", small ? "text-sm" : "text-lg")}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className={cn("opacity-70", small ? "text-micro" : "text-2xs")}>{label}</div>
    </div>
  );
}
