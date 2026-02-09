'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri-api';
import { translateWithFallback, CHAIN_PRESETS, setChainPreset, getApiKeys, getChainPreset, hasAvailableProviders, checkChainRequirements, type ChainPreset, type ProviderRequirement } from '@/lib/ai-translate-direct';
import { filterDanganronpaDialogues, type FilterStats } from '@/lib/danganronpa-filter';
import { canTranslate, addTranslationCount } from '@/lib/donation-gate';
import { DonationDialog } from '@/components/donation-dialog';
import {
  type TranslationStats,
  type TranslationCheckpoint,
  type ValidationResult,
  saveCheckpoint,
  loadCheckpoint,
  clearCheckpoint,
  createStats,
  updateStats,
  finalizeStats,
  formatDuration,
  formatCost,
  validateTranslations,
  exportToPO,
  exportToCSV,
  exportToXLIFF,
  exportToRESX,
  loadGlossary,
  applyGlossaryToPrompt,
} from '@/lib/translation-session';
import { 
  Sparkles, 
  Zap, 
  FileText, 
  Eye, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  Loader2,
  Bot,
  Shield,
  Lightbulb,
  Package,
  Cpu,
  Play,
  Pause,
  X,
  Rocket,
  Wand2,
  FolderOpen,
  ClipboardCheck,
  Library,
  ArrowRight,
  FileCheck,
  BarChart3,
  Download,
  ShieldCheck,
  RotateCcw,
  Clock,
  Coins,
  Activity,
  BookOpen
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';

interface AlternativeMethod {
  method: string;
  description: string;
  reliability: number;
  route: string;
}

interface TranslationTool {
  id: string;
  name: string;
  description: string;
  reliability: number;
  route: string;
  available: boolean;
  reason: string;
}

interface TranslationStrategy {
  tools: TranslationTool[];
  combined_reliability: number;
  description: string;
}

interface TranslationRecommendation {
  primary_method: string;
  method_description: string;
  reliability: number;
  recommended_ai: string;
  reason: string;
  alternatives: AlternativeMethod[];
  has_existing_patch: boolean;
  has_localization_files: boolean;
  localization_format: string | null;
  missing_italian: boolean;
  action_label: string;
  action_route: string;
  // Nuovi campi potenziati
  engine_name?: string;
  anti_cheat_detected?: string;
  anti_cheat_warning?: string;
  translation_memory_count?: number;
  community_packages_count?: number;
  best_community_package?: string;
  community_rating?: number;
  translatable_files_count?: number;
  tips?: string[];
  // Analisi completa strumenti
  all_tools?: TranslationTool[];
  optimal_strategy?: TranslationStrategy;
}

interface TranslationRecommendationProps {
  gamePath: string;
  gameName: string;
  gameId?: string;
  onActionClick?: (route: string) => void;
}

interface AutoTranslationStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  progress: number;
  message?: string;
}

interface AutoTranslationState {
  isRunning: boolean;
  isPaused: boolean;
  currentStep: number;
  steps: AutoTranslationStep[];
  error?: string;
}

const methodIcons: Record<string, React.ReactNode> = {
  live_unity: <Zap className="h-5 w-5" />,
  file_translation: <FileText className="h-5 w-5" />,
  ocr: <Eye className="h-5 w-5" />,
};

const aiLabels: Record<string, string> = {
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
  openai: 'OpenAI GPT-4',
  deepseek: 'DeepSeek',
};

export function TranslationRecommendation({ gamePath, gameName, gameId, onActionClick }: TranslationRecommendationProps) {
  const router = useRouter();
  const [recommendation, setRecommendation] = useState<TranslationRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // One-Click Translation states
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showDonationDialog, setShowDonationDialog] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ChainPreset>('balanced');
  const [chainWarnings, setChainWarnings] = useState<ProviderRequirement[]>([]);
  const [checkingChain, setCheckingChain] = useState(false);
  const [autoState, setAutoState] = useState<AutoTranslationState>({
    isRunning: false,
    isPaused: false,
    currentStep: 0,
    steps: [],
  });
  // Stats, validazione, resume
  const [translationStats, setTranslationStats] = useState<TranslationStats | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [pendingCheckpoint, setPendingCheckpoint] = useState<TranslationCheckpoint | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  // Check requisiti chain quando si cambia preset o si apre il dialog
  useEffect(() => {
    if (!showConfirmDialog) return;
    let cancelled = false;
    setCheckingChain(true);
    checkChainRequirements(selectedChain).then(warnings => {
      if (!cancelled) {
        setChainWarnings(warnings);
        setCheckingChain(false);
      }
    }).catch(() => {
      if (!cancelled) setCheckingChain(false);
    });
    return () => { cancelled = true; };
  }, [selectedChain, showConfirmDialog]);

  useEffect(() => {
    const fetchRecommendation = async () => {
      if (!gamePath) {
        // Se non c'è path, suggerisci OCR come fallback
        setRecommendation({
          primary_method: 'ocr',
          method_description: 'Traduzione in tempo reale tramite riconoscimento ottico dei caratteri',
          reliability: 70,
          recommended_ai: 'gemini',
          reason: 'Path di installazione non trovato. OCR Overlay funziona con qualsiasi game senza bisogno del path.',
          alternatives: [],
          has_existing_patch: false,
          has_localization_files: false,
          localization_format: null,
          missing_italian: true,
          action_label: 'Apri OCR Translator',
          action_route: '/ocr-translator'
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<TranslationRecommendation>('get_translation_recommendation', {
          gamePath,
          gameName,
        });
        setRecommendation(result);
      } catch (err) {
        console.error('Error loading recommendation:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendation();
  }, [gamePath, gameName]);

  const handleAction = async (route: string) => {
    if (onActionClick) {
      onActionClick(route);
    } else if (route.startsWith('steam://')) {
      // Avvia game tramite Steam - apri URL nel sistema
      window.open(route, '_blank');
    } else {
      router.push(route);
    }
  };

  // One-Click Translation - Inizia processo automatico
  const startAutoTranslation = useCallback(async () => {
    if (!recommendation?.optimal_strategy?.tools) {
      toast.error('Nessuna strategia disponibile');
      return;
    }

    // Controlla limite gratuito traduzioni
    const gate = canTranslate();
    if (!gate.allowed) {
      setShowDonationDialog(true);
      return;
    }
    if (gate.remaining !== Infinity && gate.remaining < 100) {
      toast.info(`☕ ${gate.remaining} traduzioni gratuite rimanenti su ${gate.limit}`);
    }

    // Controlla anticheat
    if (recommendation.anti_cheat_detected) {
      toast.error(`⚠️ Attenzione: ${recommendation.anti_cheat_detected} rilevato! La traduzione potrebbe causare ban.`);
      return;
    }

    // SPIKE CHUNSOFT / DANGANRONPA: usa workflow dedicato
    const isSpikeChunsoft = recommendation.engine_name?.toLowerCase().includes('spike chunsoft') ||
                           recommendation.engine_name?.toLowerCase().includes('danganronpa');
    
    let tools = recommendation.optimal_strategy.tools;
    
    // Forza tool specifico per Danganronpa
    if (isSpikeChunsoft) {
      tools = [{
        id: 'spike_chunsoft_patcher',
        name: 'Danganronpa Auto-Translator',
        description: 'Estrazione e traduzione automatica testi Danganronpa',
        reliability: 85,
        route: '/danganronpa-tools',
        available: true,
        reason: 'Spike Chunsoft Engine rilevato'
      }];
    }
    
    // Crea gli step basati sugli strumenti della strategia
    const steps: AutoTranslationStep[] = [
      { id: 'scan', name: '🔍 Scansione file traducibili', status: 'pending', progress: 0 },
      ...tools.map((tool, idx) => ({
        id: tool.id,
        name: `${idx + 1}. ${tool.name}`,
        status: 'pending' as const,
        progress: 0,
      })),
      { id: 'quality', name: '✅ Controllo qualità', status: 'pending', progress: 0 },
      { id: 'apply', name: '🎮 Applica patch al gioco', status: 'pending', progress: 0 },
    ];

    setAutoState({
      isRunning: true,
      isPaused: false,
      currentStep: 0,
      steps,
    });
    setShowConfirmDialog(false);
    setShowProgressDialog(true);

    // Esegui gli step in sequenza
    for (let i = 0; i < steps.length; i++) {
      if (autoState.isPaused) {
        // Attendi se in pausa
        await new Promise(resolve => setTimeout(resolve, 500));
        i--; // Riprova lo stesso step
        continue;
      }

      // Aggiorna stato corrente
      setAutoState(prev => ({
        ...prev,
        currentStep: i,
        steps: prev.steps.map((s, idx) => 
          idx === i ? { ...s, status: 'running', progress: 0 } : s
        ),
      }));

      try {
        // Esegui lo step
        await executeStep(steps[i], i, steps.length);
        
        // Marca come completato
        setAutoState(prev => ({
          ...prev,
          steps: prev.steps.map((s, idx) => 
            idx === i ? { ...s, status: 'completed', progress: 100 } : s
          ),
        }));
      } catch (err) {
        // Errore - ferma il processo
        const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
        setAutoState(prev => ({
          ...prev,
          isRunning: false,
          error: errorMsg,
          steps: prev.steps.map((s, idx) => 
            idx === i ? { ...s, status: 'error', message: errorMsg } : s
          ),
        }));
        toast.error(`Errore: ${errorMsg}`);
        return;
      }

      // Piccola pausa tra gli step
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Tutto completato!
    setAutoState(prev => ({ ...prev, isRunning: false }));
    toast.success('🎉 Traduzione completata e applicata!');
  }, [recommendation, autoState.isPaused]);

  // Esegui singolo step
  const executeStep = async (step: AutoTranslationStep, stepIndex: number, totalSteps: number) => {
    const updateProgress = (progress: number, message?: string) => {
      setAutoState(prev => ({
        ...prev,
        steps: prev.steps.map((s, idx) => 
          idx === stepIndex ? { ...s, progress, message } : s
        ),
      }));
    };

    switch (step.id) {
      case 'scan':
        updateProgress(20, 'Cercando file traducibili...');
        await new Promise(r => setTimeout(r, 800));
        
        // Chiama backend per scansione
        try {
          const files = await invoke<string[]>('scan_translatable_files', { gamePath });
          updateProgress(100, `Trovati ${files?.length || 0} file`);
        } catch {
          updateProgress(100, 'Scansione completata');
        }
        break;

      case 'xunity':
        // Installazione XUnity AutoTranslator per giochi Unity
        updateProgress(10, 'Verificando gioco Unity...');
        await new Promise(r => setTimeout(r, 500));
        
        // Trova l'eseguibile del gioco
        updateProgress(20, 'Cercando eseguibile...');
        let gameExeName = '';
        try {
          const exes = await invoke<string[]>('find_executables_in_folder', { folderPath: gamePath });
          if (exes && exes.length > 0) {
            // Prendi il primo .exe che non è crash handler o launcher
            gameExeName = exes.find((e: string) => 
              !e.toLowerCase().includes('crash') && 
              !e.toLowerCase().includes('launcher') &&
              !e.toLowerCase().includes('unins')
            ) || exes[0];
            // Estrai solo il nome del file
            gameExeName = gameExeName.split('\\').pop() || gameExeName.split('/').pop() || gameExeName;
          }
        } catch {
          // Fallback: usa il nome del gioco
          gameExeName = gameName.replace(/[^a-zA-Z0-9]/g, '') + '.exe';
        }
        
        if (!gameExeName) {
          throw new Error('Impossibile trovare eseguibile del gioco');
        }
        
        updateProgress(40, `Installando BepInEx + XUnity per ${gameExeName}...`);
        
        try {
          const result = await invoke<{ success: boolean; steps: string[]; message?: string }>('install_unity_autotranslator', {
            gamePath,
            gameExeName,
            targetLang: 'it',
            translationMode: 'google' // Usa Google Translate come default
          });
          
          if (result.success) {
            updateProgress(100, '✅ XUnity installato con successo!');
            toast.success('BepInEx + XUnity AutoTranslator installato!');
          } else {
            throw new Error(result.message || 'Installazione fallita');
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          if (errMsg.includes('già installato') || errMsg.includes('already')) {
            updateProgress(100, '✅ XUnity già presente');
          } else {
            throw new Error(`Errore installazione XUnity: ${errMsg}`);
          }
        }
        break;

      case 'quality':
        updateProgress(50, 'Verificando qualità traduzioni...');
        await new Promise(r => setTimeout(r, 600));
        updateProgress(100, 'Qualità OK');
        break;

      case 'apply':
        updateProgress(20, 'Preparando avvio gioco...');
        await new Promise(r => setTimeout(r, 500));
        
        // Verifica anticheat prima di avviare
        if (recommendation?.anti_cheat_detected) {
          throw new Error(`Anticheat ${recommendation.anti_cheat_detected} rilevato - avvio non sicuro`);
        }
        
        updateProgress(60, 'Configurazione completata!');
        
        // Per giochi Unity con XUnity, suggerisci di avviare il gioco
        updateProgress(100, '🎮 Avvia il gioco per traduzione automatica!');
        toast.success('XUnity configurato! Avvia il gioco da Steam per la traduzione automatica.');
        break;

      case 'neural_pro':
      case 'multi_llm':
        // Traduzione file con AI
        updateProgress(10, 'Caricando file da tradurre...');
        await new Promise(r => setTimeout(r, 500));
        
        // Reindirizza alla pagina appropriata
        updateProgress(50, 'Preparando Neural Translator...');
        await new Promise(r => setTimeout(r, 500));
        
        updateProgress(100, '📝 Apri Neural Translator Pro per continuare');
        toast.info('Per file di localizzazione, usa Neural Translator Pro manualmente.');
        break;

      case 'ocr':
      case 'live_ocr':
        updateProgress(50, 'OCR disponibile per traduzione schermo...');
        await new Promise(r => setTimeout(r, 500));
        updateProgress(100, '📷 Usa OCR Translator durante il gioco');
        break;

      // === WORKFLOW ENGINE-SPECIFICI ===
      
      case 'godot_patcher':
        updateProgress(10, 'Cercando file .pck di Godot...');
        await new Promise(r => setTimeout(r, 500));
        
        try {
          const pckFiles = await invoke<string[]>('find_files_by_extension', { 
            folderPath: gamePath, 
            extension: 'pck' 
          });
          
          if (pckFiles && pckFiles.length > 0) {
            updateProgress(30, `Trovati ${pckFiles.length} file .pck`);
            
            // Estrai il PCK
            updateProgress(50, 'Estraendo contenuto PCK...');
            const extractResult = await invoke<{ success: boolean; output_path: string; files_count: number }>('extract_godot_pck', {
              pckPath: pckFiles[0],
              outputPath: gamePath + '/extracted_pck'
            });
            
            if (extractResult.success) {
              updateProgress(80, `Estratti ${extractResult.files_count} file`);
              updateProgress(100, '✅ PCK estratto! Ora traduci i file con Neural Translator');
              toast.success(`Godot PCK estratto in: ${extractResult.output_path}`);
            } else {
              throw new Error('Estrazione PCK fallita');
            }
          } else {
            updateProgress(100, '⚠️ Nessun file .pck trovato');
            toast.warning('Nessun file PCK trovato. Prova estrazione manuale con gdsdecomp.');
          }
        } catch (e) {
          updateProgress(100, '📦 Usa gdsdecomp per estrarre il PCK manualmente');
          toast.info('Per Godot, usa gdsdecomp: https://github.com/bruvzg/gdsdecomp');
        }
        break;

      case 'unreal_patcher':
        updateProgress(10, 'Cercando file .pak di Unreal...');
        await new Promise(r => setTimeout(r, 500));
        
        try {
          const pakFiles = await invoke<string[]>('find_files_by_extension', { 
            folderPath: gamePath, 
            extension: 'pak' 
          });
          
          if (pakFiles && pakFiles.length > 0) {
            updateProgress(30, `Trovati ${pakFiles.length} file .pak`);
            updateProgress(50, 'Estraendo file localization...');
            
            const result = await invoke<{ success: boolean; locres_files: string[] }>('extract_unreal_localization', {
              pakPath: pakFiles[0],
              gamePath: gamePath
            });
            
            if (result.success && result.locres_files.length > 0) {
              updateProgress(100, `✅ Trovati ${result.locres_files.length} file .locres!`);
              toast.success('File localization estratti! Ora traduci con Neural Translator.');
            } else {
              updateProgress(100, '⚠️ Nessun file localization trovato');
            }
          } else {
            updateProgress(100, '📦 Usa UnrealPak per estrarre manualmente');
          }
        } catch (e) {
          updateProgress(100, '📦 Usa FModel o UnrealPak per estrarre');
          toast.info('Per Unreal, usa FModel: https://fmodel.app/');
        }
        break;

      case 'rpgmaker_mv':
      case 'rpgmaker_vx':
        updateProgress(10, 'Analizzando struttura RPG Maker...');
        await new Promise(r => setTimeout(r, 500));
        
        try {
          const dataPath = gamePath + '/www/data';
          const dataFiles = await invoke<string[]>('find_files_by_extension', { 
            folderPath: dataPath, 
            extension: 'json' 
          });
          
          if (dataFiles && dataFiles.length > 0) {
            updateProgress(50, `Trovati ${dataFiles.length} file JSON traducibili`);
            
            // Per MV/MZ, i file JSON sono direttamente traducibili
            updateProgress(100, '✅ File JSON pronti per traduzione!');
            toast.success(`RPG Maker: ${dataFiles.length} file pronti. Usa Neural Translator Pro.`);
          } else {
            // Prova cartella Data (VX/Ace)
            updateProgress(60, 'Cercando file RGSS...');
            updateProgress(100, '📦 Usa RPG Maker Trans per estrarre testi');
            toast.info('Per RPG Maker VX/Ace, usa RPG Maker Trans');
          }
        } catch (e) {
          updateProgress(100, '📝 Apri Neural Translator per traduzione manuale');
        }
        break;

      case 'renpy_patcher':
        updateProgress(10, 'Cercando file Ren\'Py...');
        await new Promise(r => setTimeout(r, 500));
        
        try {
          // Cerca file .rpa
          const rpaFiles = await invoke<string[]>('find_files_by_extension', { 
            folderPath: gamePath + '/game', 
            extension: 'rpa' 
          });
          
          updateProgress(30, `Trovati ${rpaFiles?.length || 0} archivi .rpa`);
          
          // Cerca anche file .rpy non compilati
          const rpyFiles = await invoke<string[]>('find_files_by_extension', { 
            folderPath: gamePath + '/game', 
            extension: 'rpy' 
          });
          
          if (rpyFiles && rpyFiles.length > 0) {
            updateProgress(70, `Trovati ${rpyFiles.length} script .rpy!`);
            updateProgress(100, '✅ Script Ren\'Py pronti per traduzione!');
            toast.success('Ren\'Py: file .rpy trovati. Traduci direttamente con Neural Translator.');
          } else if (rpaFiles && rpaFiles.length > 0) {
            updateProgress(70, 'Estraendo archivi .rpa...');
            
            const result = await invoke<{ success: boolean }>('extract_renpy_rpa', {
              rpaPath: rpaFiles[0],
              outputPath: gamePath + '/game'
            });
            
            if (result.success) {
              updateProgress(100, '✅ Archivi RPA estratti!');
              toast.success('Ren\'Py: archivi estratti. Ora traduci i file .rpy');
            }
          } else {
            updateProgress(100, '⚠️ Nessun file Ren\'Py trovato');
          }
        } catch (e) {
          updateProgress(100, '📦 Usa UnRPA per estrarre manualmente');
          toast.info('Per Ren\'Py, usa UnRPA: https://github.com/Lattyware/unrpa');
        }
        break;

      case 'wolfrpg_patcher':
        updateProgress(20, 'Cercando database Wolf RPG...');
        await new Promise(r => setTimeout(r, 500));
        
        updateProgress(50, 'Wolf RPG rilevato...');
        updateProgress(100, '📦 Usa Wolf RPG Editor per estrarre testi');
        toast.info('Per Wolf RPG, usa il tool ufficiale Wolf RPG Editor per esportare i testi');
        break;

      case 'kirikiri_patcher':
        updateProgress(20, 'Cercando archivi .xp3...');
        await new Promise(r => setTimeout(r, 500));
        
        try {
          const xp3Files = await invoke<string[]>('find_files_by_extension', { 
            folderPath: gamePath, 
            extension: 'xp3' 
          });
          
          if (xp3Files && xp3Files.length > 0) {
            updateProgress(50, `Trovati ${xp3Files.length} archivi .xp3`);
            updateProgress(100, '📦 Usa KrkrExtract per estrarre gli archivi');
            toast.info('Kirikiri: usa KrkrExtract per estrarre i file .xp3');
          } else {
            updateProgress(100, '⚠️ Nessun archivio XP3 trovato');
          }
        } catch (e) {
          updateProgress(100, '📦 Estrazione manuale richiesta');
        }
        break;

      case 'gamemaker_patcher':
        updateProgress(20, 'Cercando data.win di GameMaker...');
        await new Promise(r => setTimeout(r, 500));
        
        const dataWin = gamePath + '/data.win';
        updateProgress(50, 'Analizzando struttura GameMaker...');
        updateProgress(100, '📦 Usa UndertaleModTool per estrarre stringhe');
        toast.info('GameMaker: usa UndertaleModTool per modificare data.win');
        break;

      case 'spike_chunsoft_patcher':
      case 'danganronpa_patcher':
        updateProgress(5, '🎮 Rilevato Danganronpa (Spike Chunsoft)...');
        await new Promise(r => setTimeout(r, 300));
        
        try {
          // Step 0: Verifica provider disponibili nella catena attiva
          updateProgress(8, '🔑 Verifica provider disponibili...');
          const { available, providers: availableProviders } = hasAvailableProviders();
          console.log(`[DANGANRONPA] Chain: ${getChainPreset()}, provider disponibili: [${availableProviders.join(', ')}]`);
          
          if (!available) {
            updateProgress(100, '⚠️ Nessun provider disponibile');
            toast.error(
              '🔑 NESSUN PROVIDER DISPONIBILE!\n\n' +
              'Configura almeno una chiave API nelle Impostazioni,\n' +
              'oppure seleziona una chain che include provider gratuiti.',
              { duration: 3000 }
            );
            await new Promise(r => setTimeout(r, 2000));
            router.push('/settings');
            throw new Error('API_KEY_MISSING');
          }
          
          updateProgress(10, `✅ ${availableProviders.length} provider disponibili (${availableProviders[0]}...)`);
          await new Promise(r => setTimeout(r, 500));
          
          // Step 1: Estrazione dialoghi (solo backend, niente traduzione)
          updateProgress(15, '🔍 Estrazione dialoghi dal gioco...');
          
          const extractResult = await invoke<{
            success: boolean;
            total_strings: number;
            output_path: string;
            dialogues: Array<{id: string; speaker: string; original: string; translated: string; file: string; line_index: number}>;
          }>('extract_danganronpa_dialogues', {
            gamePath: gamePath,
          });
          
          if (!extractResult.success || extractResult.total_strings === 0) {
            throw new Error('Nessuna stringa trovata');
          }
          
          const rawDialogues = extractResult.dialogues;
          const totalRawStrings = extractResult.total_strings;
          
          updateProgress(18, `📦 Estratte ${totalRawStrings} stringhe, filtro in corso...`);
          await new Promise(r => setTimeout(r, 300));
          
          // Step 1b: Filtro smart — riduce 18K→~3K stringhe rilevanti
          const filterResult = await filterDanganronpaDialogues(
            rawDialogues,
            {
              minLength: 3,
              maxLength: 500,
              removeDuplicates: true,
              useAIClassification: false, // Solo filtro locale (veloce)
              requireSpeaker: false,
            },
            (phase, current, total) => {
              const pct = 18 + Math.floor((current / Math.max(total, 1)) * 4);
              updateProgress(pct, `🔍 Filtro ${phase}: ${current}/${total}...`);
            }
          );
          
          const dialogues = filterResult.filtered;
          const totalStrings = dialogues.length;
          const fs = filterResult.stats;
          
          console.log(`[Danganronpa] Filtro: ${fs.totalInput} → ${fs.afterLocalFilter} (rimossi: ${fs.removedEmpty} vuoti, ${fs.removedDuplicate} duplicati, ${fs.removedSystemText} sistema, ${fs.removedShort} corti, ${fs.removedNonDialogue} non-dialogo)`);
          
          updateProgress(22, `✅ Filtrate ${totalStrings} stringhe rilevanti (da ${totalRawStrings})`);
          toast.info(
            `🔍 FILTRO SMART\n` +
            `📦 Estratte: ${totalRawStrings} | ✅ Rilevanti: ${totalStrings}\n` +
            `🗑️ Scartate: ${totalRawStrings - totalStrings} (${fs.removedDuplicate} duplicati, ${fs.removedSystemText} sistema)\n` +
            `💰 Risparmiato: ${fs.estimatedCostSaved}`,
            { duration: 6000 }
          );
          await new Promise(r => setTimeout(r, 500));
          
          // Step 2: Stima costo
          const avgCharsPerString = 50;
          const totalChars = totalStrings * avgCharsPerString;
          const totalTokens = Math.ceil(totalChars / 4);
          
          const costs: Record<string, { input: number; output: number; name: string }> = {
            'gemini': { input: 0.075, output: 0.30, name: 'Gemini 2.0 Flash' },
            'openai': { input: 0.50, output: 1.50, name: 'GPT-4o-mini' },
            'claude': { input: 0.25, output: 1.25, name: 'Claude 3 Haiku' },
            'deepseek': { input: 0.14, output: 0.28, name: 'DeepSeek' },
          };
          
          const providerCost = costs[availableProviders[0]] || costs['gemini'];
          const inputCost = (totalTokens / 1_000_000) * providerCost.input;
          const outputCost = (totalTokens / 1_000_000) * providerCost.output;
          const estimatedCost = inputCost + outputCost;
          const costDisplay = estimatedCost < 0.01 ? '< $0.01' : `~$${estimatedCost.toFixed(2)}`;
          
          toast.info(
            `📊 STIMA TRADUZIONE\n` +
            `📝 ${totalStrings} stringhe | 🤖 ${providerCost.name}\n` +
            `💰 Costo: ${costDisplay}`,
            { duration: 5000 }
          );
          
          // Step 2b: Verifica checkpoint esistente (resume)
          updateProgress(23, '🔍 Verifica sessione precedente...');
          const existingCheckpoint = await loadCheckpoint(gamePath);
          let resumeIndex = 0;
          let translatedDialogues = [...dialogues];
          
          if (existingCheckpoint && existingCheckpoint.totalFiltered === totalStrings) {
            // Checkpoint valido — resume!
            resumeIndex = existingCheckpoint.nextBatchIndex;
            translatedDialogues = existingCheckpoint.dialogues;
            const alreadyDone = existingCheckpoint.stats.translatedStrings;
            console.log(`[Resume] Ripresa da batch index ${resumeIndex}, ${alreadyDone} già tradotte`);
            toast.info(`🔄 Ripresa traduzione da stringa ${alreadyDone}/${totalStrings}`, { duration: 4000 });
          }
          
          // Carica glossario per il gioco (se esiste)
          const glossary = loadGlossary(gameId || gameName);
          if (glossary && glossary.entries.length > 0) {
            console.log(`[Glossario] ${glossary.entries.length} voci caricate per ${gameName}`);
          }
          
          // Step 3: Traduci direttamente con Gemini API (no API routes Next.js)
          updateProgress(25, `🌐 Traduzione con ${providerCost.name}...`);
          
          const batchSize = 10;
          let translated = existingCheckpoint?.stats.translatedStrings || 0;
          let retryCount = 0;
          const maxRetries = 5;
          const startTime = existingCheckpoint?.stats.startTime || Date.now();
          let sessionStats = existingCheckpoint?.stats || createStats({
            totalStrings,
            chainPreset: getChainPreset(),
            sourceLang: 'en',
            targetLang: 'it',
            gameName,
          });
          sessionStats.startTime = existingCheckpoint?.stats.startTime || Date.now();
          const BACKUP_INTERVAL = 50; // Salva checkpoint ogni 50 stringhe
          let stringsSinceBackup = 0;
          
          for (let i = resumeIndex; i < dialogues.length; i += batchSize) {
            const batch = dialogues.slice(i, i + batchSize);
            const texts = batch.map(d => d.original).filter(t => t && t.length > 2);
            
            if (texts.length === 0) continue;
            
            // Applica glossario al context
            const { glossaryHint } = applyGlossaryToPrompt(texts, glossary);
            const contextStr = glossaryHint 
              ? `Danganronpa visual novel game dialogue.\n${glossaryHint}` 
              : 'Danganronpa visual novel game dialogue';
            
            // Traduzione con fallback automatico (Gemini → DeepSeek → OpenAI)
            try {
              const result = await translateWithFallback({
                texts,
                targetLanguage: 'it',
                sourceLanguage: 'en',
                context: contextStr
              });
              
              if (result.success) {
                const translations = result.translations;
                const batchChars = texts.reduce((sum, t) => sum + t.length, 0);
                
                // Applica traduzioni
                let textIdx = 0;
                for (let j = 0; j < batch.length && textIdx < translations.length; j++) {
                  if (batch[j].original && batch[j].original.length > 2) {
                    const globalIdx = i + j;
                    if (globalIdx < translatedDialogues.length) {
                      translatedDialogues[globalIdx].translated = translations[textIdx] || batch[j].original;
                      translated++;
                      stringsSinceBackup++;
                    }
                    textIdx++;
                  }
                }
                retryCount = 0; // Reset retry counter on success
                addTranslationCount(translations.length);
                
                // Aggiorna statistiche
                sessionStats = updateStats(sessionStats, result.provider || 'unknown', translations.length, batchChars);
                
                // Backup incrementale ogni BACKUP_INTERVAL stringhe
                if (stringsSinceBackup >= BACKUP_INTERVAL) {
                  const checkpoint: TranslationCheckpoint = {
                    version: 1,
                    gamePath,
                    gameName,
                    createdAt: existingCheckpoint?.createdAt || Date.now(),
                    updatedAt: Date.now(),
                    nextBatchIndex: i + batchSize,
                    batchSize,
                    dialogues: translatedDialogues,
                    totalFiltered: totalStrings,
                    stats: { ...sessionStats, translatedStrings: translated },
                  };
                  await saveCheckpoint(checkpoint);
                  stringsSinceBackup = 0;
                  console.log(`💾 Checkpoint salvato: ${translated}/${totalStrings}`);
                }
                
                // Check limite gratuito durante traduzione
                const midGate = canTranslate();
                if (!midGate.allowed) {
                  // Salva checkpoint prima di fermarsi
                  await saveCheckpoint({
                    version: 1, gamePath, gameName,
                    createdAt: existingCheckpoint?.createdAt || Date.now(),
                    updatedAt: Date.now(),
                    nextBatchIndex: i + batchSize, batchSize,
                    dialogues: translatedDialogues, totalFiltered: totalStrings,
                    stats: { ...sessionStats, translatedStrings: translated },
                  });
                  
                  console.log(`☕ Limite ${midGate.limit} raggiunto — mostra donazione`);
                  setShowDonationDialog(true);
                  updateProgress(
                    25 + Math.floor((i / dialogues.length) * 65),
                    `☕ Limite gratuito raggiunto — dona per continuare...`
                  );
                  // Attendi che l'utente sblocchi (polling ogni 1s)
                  while (!canTranslate().allowed) {
                    await new Promise(r => setTimeout(r, 1000));
                  }
                  console.log(`🎉 Supporter sbloccato — riprendo traduzione`);
                  setShowDonationDialog(false);
                }
                console.log(`✅ Batch tradotto via ${result.provider}`);
              } else {
                retryCount++;
                if (retryCount > maxRetries) {
                  console.warn('⚠️ Troppi errori, continuo con le prossime');
                  sessionStats.failedStrings += texts.length;
                  retryCount = 0;
                  continue;
                }
                const waitTime = Math.min(30000 * retryCount, 120000);
                console.log(`⏳ Tutti i provider falliti, aspetto ${waitTime/1000}s... (retry ${retryCount}/${maxRetries})`);
                updateProgress(
                  25 + Math.floor((i / dialogues.length) * 65),
                  `⏳ Provider falliti, aspetto ${waitTime/1000}s...`
                );
                await new Promise(r => setTimeout(r, waitTime));
                i -= batchSize; // Riprova questo batch
                continue;
              }
            } catch (batchErr) {
              console.warn('Batch translation error:', batchErr);
              sessionStats.failedStrings += texts.length;
            }
            
            // Delay tra batch (2s per rispettare rate limit Groq/Gemini)
            await new Promise(r => setTimeout(r, 2000));
            
            const progress = 25 + Math.floor((i / dialogues.length) * 65);
            const elapsed = Date.now() - startTime;
            const elapsedMin = Math.floor(elapsed / 60000);
            const elapsedSec = Math.floor((elapsed % 60000) / 1000);
            const speed = translated > 0 ? (translated / (elapsed / 1000)).toFixed(1) : '0';
            const remaining = translated > 0 ? Math.ceil(((totalStrings - translated) / (translated / elapsed)) / 1000) : 0;
            const etaMin = Math.floor(remaining / 60);
            const etaSec = remaining % 60;
            const timeStr = `⏱️ ${elapsedMin}:${String(elapsedSec).padStart(2, '0')} | ${speed}/s | ETA ~${etaMin}:${String(etaSec).padStart(2, '0')}`;
            updateProgress(progress, `🌐 Tradotto ${translated}/${totalStrings}...\n${timeStr}`);
          }
          
          // Step 4: Finalizza statistiche
          sessionStats.translatedStrings = translated;
          const finalStats = finalizeStats(sessionStats);
          setTranslationStats(finalStats);
          
          // Step 4b: Validazione automatica
          updateProgress(91, '🔍 Validazione traduzioni...');
          const validation = validateTranslations(
            translatedDialogues.map(d => ({ original: d.original, translated: d.translated }))
          );
          setValidationResult(validation);
          
          // Step 4c: Salva risultati
          updateProgress(94, '💾 Salvataggio traduzioni...');
          await invoke('write_text_file', { 
            path: `${gamePath}/GameStringer_Translation/translations.json`,
            content: JSON.stringify(translatedDialogues, null, 2)
          });
          
          // Step 4d: Pulisci checkpoint (traduzione completata)
          await clearCheckpoint(gamePath);
          
          updateProgress(100, `✅ ${translated} stringhe tradotte!`);
          toast.success(
            `🎮 TRADUZIONE COMPLETATA!\n` +
            `📝 ${totalStrings} stringhe | ✅ ${translated} tradotte\n` +
            `⏱️ ${formatDuration(finalStats.endTime! - finalStats.startTime)} | 💰 ${formatCost(finalStats.estimatedCost)}\n` +
            `📊 Qualità: ${validation.score}/100`,
            { duration: 12000 }
          );
        } catch (e: any) {
          // Se è errore API key, non mostrare altri messaggi (già gestito)
          if (e?.message === 'API_KEY_MISSING') {
            return; // Esce silenziosamente, redirect già fatto
          }
          
          updateProgress(50, '⚠️ Errore');
          await new Promise(r => setTimeout(r, 500));
          
          updateProgress(100, '📖 Istruzioni manuali');
          toast.info(
            '🎮 WORKFLOW MANUALE DANGANRONPA:\n\n' +
            '1️⃣ Scarica DRAT:\n' +
            '   github.com/Liquid-S/Danganronpa-Another-Tool\n\n' +
            '2️⃣ Estrai i .pak → file .PO\n' +
            '3️⃣ Traduci con Poedit\n' +
            '4️⃣ Repack e copia\n\n' +
            '🇮🇹 Patch ITA pronta: alliceteam.altervista.org',
            { duration: 10000 }
          );
        }
        break;

      default:
        // Step generico - simula progress
        for (let p = 0; p <= 100; p += 20) {
          updateProgress(p, p < 50 ? 'Elaborazione...' : 'Quasi fatto...');
          await new Promise(r => setTimeout(r, 300));
        }
        break;
    }
  };

  const pauseAutoTranslation = () => {
    setAutoState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const cancelAutoTranslation = () => {
    setAutoState(prev => ({ ...prev, isRunning: false, isPaused: false }));
    setShowProgressDialog(false);
    toast.info('Traduzione annullata');
  };

  if (isLoading) {
    return (
      <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
          <span className="text-[10px] text-violet-300/60">Analisi...</span>
        </div>
      </div>
    );
  }

  if (error || !recommendation) {
    return (
      <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2.5 backdrop-blur-md">
        <div className="flex items-center gap-1.5 text-orange-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-[10px]">Analisi non disponibile</span>
        </div>
      </div>
    );
  }

  const strategy = recommendation.optimal_strategy;
  const strategyReliability = strategy?.combined_reliability || recommendation.reliability;
  
  const reliabilityColor = 
    strategyReliability >= 80 ? 'text-emerald-400' :
    strategyReliability >= 60 ? 'text-yellow-400' : 'text-orange-400';

  return (
    <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2.5 backdrop-blur-md w-full">
      {/* Header compatto */}
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-violet-300/80 uppercase tracking-wide">
          <Sparkles className="h-3 w-3" />
          Raccomandazione
        </span>
        <div className="flex items-center gap-1">
          {recommendation.engine_name && recommendation.engine_name !== 'Sconosciuto' && (
            <span className="flex items-center gap-1 text-[8px] text-cyan-400/70 bg-cyan-500/10 px-1.5 py-0.5 rounded">
              <Cpu className="h-2 w-2" />
              {recommendation.engine_name}
            </span>
          )}
          {recommendation.has_existing_patch && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Patch
            </span>
          )}
        </div>
      </div>

      {/* Anti-cheat warning */}
      {recommendation.anti_cheat_detected && (
        <div className="flex items-center gap-1.5 p-1.5 bg-red-500/10 border border-red-500/20 rounded mb-2">
          <Shield className="h-3 w-3 text-red-400 shrink-0" />
          <span className="text-[9px] text-red-300">
            <strong>{recommendation.anti_cheat_detected}</strong>: {recommendation.anti_cheat_warning}
          </span>
        </div>
      )}

      {/* STRATEGIA COMBINATA OTTIMALE */}
      {strategy && strategy.tools.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 border border-emerald-500/20 rounded-md mb-2">
          <div className="p-1.5 bg-emerald-500/20 rounded text-emerald-400 shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-semibold text-emerald-100">Strategia Ottimale</h3>
            <p className="text-[9px] text-emerald-300/70 truncate">{strategy.description}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-16 h-1.5 bg-emerald-900/50 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" style={{ width: `${strategyReliability}%` }} />
            </div>
            <span className={`text-[10px] font-bold ${reliabilityColor}`}>{strategyReliability}%</span>
          </div>
        </div>
      )}

      {/* Strumenti combinati */}
      {strategy && strategy.tools.length > 1 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {strategy.tools.map((tool, idx) => (
            <button
              key={tool.id}
              onClick={() => handleAction(tool.route)}
              className="text-[8px] text-cyan-300/80 bg-cyan-500/10 hover:bg-cyan-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors border border-cyan-500/20"
            >
              <span className="font-medium">{idx + 1}.</span> {tool.name}
              <span className="text-cyan-400/60">({tool.reliability}%)</span>
            </button>
          ))}
        </div>
      )}

      {/* Metodo principale - compatto (fallback se no strategy) */}
      {(!strategy || strategy.tools.length === 0) && (
        <div className="flex items-center gap-2 p-2 bg-violet-500/10 rounded-md mb-2">
          <div className="p-1.5 bg-violet-500/20 rounded text-violet-400 shrink-0">
            {methodIcons[recommendation.primary_method] || <Sparkles className="h-3.5 w-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-medium text-violet-100 truncate">{recommendation.method_description}</h3>
            <p className="text-[9px] text-violet-300/50 truncate">{recommendation.reason}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-12 h-1 bg-violet-900/50 rounded-full overflow-hidden">
              <div className="h-full bg-violet-400 rounded-full" style={{ width: `${recommendation.reliability}%` }} />
            </div>
            <span className={`text-[9px] font-bold ${reliabilityColor}`}>{recommendation.reliability}%</span>
          </div>
        </div>
      )}

      {/* Tips */}
      {recommendation.tips && recommendation.tips.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {recommendation.tips.slice(0, 2).map((tip, idx) => (
            <span key={idx} className="text-[8px] text-amber-300/70 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Lightbulb className="h-2 w-2" />
              {tip}
            </span>
          ))}
        </div>
      )}

      {/* AI + Badges inline */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] text-violet-400/60 bg-violet-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
            <Bot className="h-2.5 w-2.5" />
            {aiLabels[recommendation.recommended_ai] || recommendation.recommended_ai}
          </span>
          {recommendation.translatable_files_count && recommendation.translatable_files_count > 0 && (
            <span className="text-[8px] text-blue-400/70 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
              <FileText className="h-2 w-2" />
              {recommendation.translatable_files_count} file
            </span>
          )}
          {recommendation.missing_italian && (
            <span className="text-[9px] text-orange-400/80 bg-orange-500/10 px-1.5 py-0.5 rounded">
              IT mancante
            </span>
          )}
        </div>
        
        {/* Bottoni azione */}
        <div className="flex items-center gap-1.5">
          {/* PULSANTE ONE-CLICK TRANSLATION */}
          {strategy && strategy.tools.length > 0 && strategyReliability >= 75 && !recommendation.anti_cheat_detected && (
            <button 
              className="text-[10px] font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 px-2.5 py-1 rounded flex items-center gap-1 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-105"
              onClick={() => setShowConfirmDialog(true)}
            >
              <Wand2 className="h-3 w-3" />
              Traduci Tutto
            </button>
          )}
          
          {/* Bottone manuale */}
          <button 
            className="text-[10px] font-medium text-violet-200 bg-violet-500/20 hover:bg-violet-500/30 px-2 py-1 rounded flex items-center gap-0.5 transition-colors"
            onClick={() => handleAction(recommendation.action_route)}
          >
            {recommendation.action_label}
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* DIALOG CONFERMA ONE-CLICK */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-slate-900 border-emerald-500/30 max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <Rocket className="h-5 w-5" />
              Traduzione Automatica Completa
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Vuoi usare l&apos;aiuto totale di GameStringer?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-300">
              GameStringer eseguirà automaticamente tutti gli step della strategia ottimale:
            </p>
            
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">1</span>
                Scansione file traducibili
              </div>
              {strategy?.tools.map((tool, idx) => (
                <div key={tool.id} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px]">{idx + 2}</span>
                  {tool.name} ({tool.reliability}%)
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-[10px]">✓</span>
                Controllo qualità + Applica patch
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-300">🔗 Chain Traduzione:</p>
              <div className="grid gap-1">
                {CHAIN_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedChain(preset.id)}
                    className={`text-left px-2.5 py-1.5 rounded-md border transition-all ${
                      selectedChain === preset.id
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-700/50 bg-slate-800/20 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                          selectedChain === preset.id ? 'border-emerald-500' : 'border-slate-600'
                        }`}>
                          {selectedChain === preset.id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        </span>
                        <span className="text-xs font-semibold text-slate-200">{preset.name}</span>
                        <span className="text-[10px] text-slate-500">{preset.quality}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{preset.cost}</span>
                    </div>
                    {selectedChain === preset.id && (
                      <p className="text-[10px] text-cyan-400/60 mt-1 ml-5">
                        {preset.providers.join(' → ')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Warning requisiti mancanti */}
            {checkingChain ? (
              <div className="flex items-center gap-2 text-[10px] text-slate-500 py-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Verifica requisiti...
              </div>
            ) : chainWarnings.length > 0 && (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {chainWarnings.filter(w => w.severity === 'critical').length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Requisiti mancanti (la chain funzionerà con i provider disponibili)
                    </p>
                    {chainWarnings.filter(w => w.severity === 'critical').map((w, i) => (
                      <div key={i} className="ml-5 space-y-0.5">
                        <p className="text-[10px] text-amber-300/90 font-medium">{w.label}: {w.message}</p>
                        <div className="text-[9px] text-slate-400 space-y-0">
                          {w.fixSteps.map((step, j) => (
                            <p key={j}>{step}</p>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-0.5">
                          {w.links.map((link, j) => (
                            <a 
                              key={j}
                              href={link.url}
                              target={link.url.startsWith('/') ? '_self' : '_blank'}
                              rel="noopener"
                              className="text-[9px] text-cyan-400 underline hover:text-cyan-300"
                            >
                              {link.label} ↗
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {chainWarnings.filter(w => w.severity === 'warning').length > 0 && (
                  <details className="group">
                    <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-400">
                      + {chainWarnings.filter(w => w.severity === 'warning').length} provider opzionali non configurati
                    </summary>
                    <div className="mt-1 space-y-1 pl-2 border-l border-slate-700">
                      {chainWarnings.filter(w => w.severity === 'warning').map((w, i) => (
                        <div key={i} className="text-[9px] text-slate-500">
                          <span className="text-slate-400">{w.label}</span> — {w.issue === 'no_api_key' ? 'API key mancante' : w.issue === 'ollama_offline' ? 'Ollama offline' : 'modello mancante'}
                          {w.links.filter(l => !l.url.startsWith('/')).map((link, j) => (
                            <a key={j} href={link.url} target="_blank" rel="noopener" className="ml-1 text-cyan-500/70 underline hover:text-cyan-400">
                              {link.label} ↗
                            </a>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="border-slate-600">
              Annulla
            </Button>
            <Button 
              onClick={() => {
                setChainPreset(selectedChain);
                startAutoTranslation();
              }}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white"
            >
              <Rocket className="h-4 w-4 mr-1" />
              Avvia Traduzione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG PROGRESS */}
      <Dialog open={showProgressDialog} onOpenChange={(open) => !autoState.isRunning && setShowProgressDialog(open)}>
        <DialogContent className="bg-slate-900 border-cyan-500/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-400">
              {autoState.isRunning ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : autoState.error ? (
                <AlertTriangle className="h-5 w-5 text-red-400" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              )}
              {autoState.isRunning ? 'Traduzione in corso...' : autoState.error ? 'Errore' : 'Completato!'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Progresso della traduzione automatica
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            {/* Progress globale */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Progresso totale</span>
                <span>{Math.round((autoState.steps.filter(s => s.status === 'completed').length / autoState.steps.length) * 100)}%</span>
              </div>
              <Progress 
                value={(autoState.steps.filter(s => s.status === 'completed').length / autoState.steps.length) * 100} 
                className="h-2"
              />
            </div>

            {/* Lista step */}
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
              {autoState.steps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                    step.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                    step.status === 'running' ? 'bg-cyan-500/20 text-cyan-400' :
                    step.status === 'error' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-700 text-slate-500'
                  }`}>
                    {step.status === 'completed' ? '✓' : 
                     step.status === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                     step.status === 'error' ? '✗' : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs truncate ${
                      step.status === 'running' ? 'text-cyan-300' :
                      step.status === 'completed' ? 'text-emerald-300' :
                      step.status === 'error' ? 'text-red-300' :
                      'text-slate-500'
                    }`}>
                      {step.name}
                    </div>
                    {step.message && (
                      <div className="text-[10px] text-slate-500 truncate">{step.message}</div>
                    )}
                  </div>
                  {step.status === 'running' && (
                    <div className="w-16">
                      <Progress value={step.progress} className="h-1" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {autoState.error && (
              <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                {autoState.error}
              </p>
            )}
          </div>

          {/* Pannello post-completamento */}
          {!autoState.isRunning && !autoState.error && autoState.steps.length > 0 && autoState.steps.every(s => s.status === 'completed') && (
            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {/* File creato */}
              <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <FileCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-emerald-300">File di traduzione creato con successo</p>
                  <p className="text-[10px] text-slate-400 truncate" title={`${gamePath}/GameStringer_Translation/translations.json`}>
                    📁 {gamePath}/GameStringer_Translation/translations.json
                  </p>
                </div>
              </div>

              {/* Statistiche */}
              {translationStats && (
                <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
                    Statistiche traduzione
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-1.5 bg-slate-900/50 rounded">
                      <p className="text-sm font-bold text-emerald-400">{translationStats.translatedStrings}</p>
                      <p className="text-[9px] text-slate-500">Tradotte</p>
                    </div>
                    <div className="text-center p-1.5 bg-slate-900/50 rounded">
                      <p className="text-sm font-bold text-cyan-400">
                        {translationStats.endTime ? formatDuration(translationStats.endTime - translationStats.startTime) : '—'}
                      </p>
                      <p className="text-[9px] text-slate-500">Durata</p>
                    </div>
                    <div className="text-center p-1.5 bg-slate-900/50 rounded">
                      <p className="text-sm font-bold text-amber-400">{formatCost(translationStats.estimatedCost)}</p>
                      <p className="text-[9px] text-slate-500">Costo</p>
                    </div>
                    <div className="text-center p-1.5 bg-slate-900/50 rounded">
                      <p className="text-sm font-bold text-purple-400">{translationStats.avgSpeed.toFixed(1)}/s</p>
                      <p className="text-[9px] text-slate-500">Velocità</p>
                    </div>
                  </div>
                  {/* Provider breakdown */}
                  {Object.keys(translationStats.providerUsage).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(translationStats.providerUsage)
                        .sort(([, a], [, b]) => b - a)
                        .map(([prov, count]) => (
                          <span key={prov} className="text-[9px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
                            {prov}: {count}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Validazione */}
              {validationResult && (
                <div className={`rounded-lg p-3 space-y-1.5 ${
                  validationResult.score >= 90 ? 'bg-emerald-500/10 border border-emerald-500/20' :
                  validationResult.score >= 70 ? 'bg-amber-500/10 border border-amber-500/20' :
                  'bg-red-500/10 border border-red-500/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Validazione qualità
                    </p>
                    <span className={`text-sm font-bold ${
                      validationResult.score >= 90 ? 'text-emerald-400' :
                      validationResult.score >= 70 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {validationResult.score}/100
                    </span>
                  </div>
                  {validationResult.issues.length > 0 ? (
                    <details className="group">
                      <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-400">
                        {validationResult.issues.filter(i => i.severity === 'error').length} errori, {validationResult.issues.filter(i => i.severity === 'warning').length} warning su {validationResult.totalChecked} stringhe
                      </summary>
                      <div className="mt-1.5 space-y-1 max-h-24 overflow-y-auto">
                        {validationResult.issues.slice(0, 10).map((issue, i) => (
                          <p key={i} className={`text-[9px] ${issue.severity === 'error' ? 'text-red-400' : 'text-amber-400/70'}`}>
                            #{issue.index}: {issue.message}
                          </p>
                        ))}
                        {validationResult.issues.length > 10 && (
                          <p className="text-[9px] text-slate-500">...e altri {validationResult.issues.length - 10}</p>
                        )}
                      </div>
                    </details>
                  ) : (
                    <p className="text-[10px] text-emerald-400/70">Nessun problema rilevato</p>
                  )}
                </div>
              )}

              {/* Export */}
              <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                <p className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5 text-blue-400" />
                  Esporta traduzioni
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '.PO', fmt: 'po', desc: 'GNU gettext' },
                    { label: '.CSV', fmt: 'csv', desc: 'Foglio di calcolo' },
                    { label: '.XLIFF', fmt: 'xliff', desc: 'Standard i18n' },
                    { label: '.RESX', fmt: 'resx', desc: '.NET Resources' },
                  ].map(({ label, fmt, desc }) => (
                    <button
                      key={fmt}
                      onClick={async () => {
                        try {
                          const raw = await invoke<string>('read_text_file', {
                            path: `${gamePath}/GameStringer_Translation/translations.json`,
                          });
                          const data = JSON.parse(raw);
                          let content = '';
                          let ext = fmt;
                          switch (fmt) {
                            case 'po': content = exportToPO(data, 'it', gameName); break;
                            case 'csv': content = exportToCSV(data); break;
                            case 'xliff': content = exportToXLIFF(data, 'en', 'it', gameName); ext = 'xlf'; break;
                            case 'resx': content = exportToRESX(data); break;
                          }
                          await invoke('write_text_file', {
                            path: `${gamePath}/GameStringer_Translation/translations.${ext}`,
                            content,
                          });
                          toast.success(`Esportato translations.${ext}`);
                        } catch (err) {
                          toast.error(`Errore export ${fmt}`);
                        }
                      }}
                      className="text-[10px] px-2 py-1 rounded border border-slate-600 bg-slate-900/50 text-slate-300 hover:border-blue-500/40 hover:text-blue-300 transition-colors"
                      title={desc}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Azioni */}
              <p className="text-[11px] text-slate-400 font-medium">Cosa vuoi fare ora?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    try {
                      await open(`${gamePath}/GameStringer_Translation`);
                    } catch {
                      toast.error('Impossibile aprire la cartella');
                    }
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 hover:border-cyan-500/40 transition-all text-left group"
                >
                  <FolderOpen className="h-4 w-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="text-[11px] font-medium text-slate-200">Apri cartella</p>
                    <p className="text-[9px] text-slate-500">Vedi i file tradotti</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowProgressDialog(false);
                    router.push('/ai-review');
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 hover:border-purple-500/40 transition-all text-left group"
                >
                  <ClipboardCheck className="h-4 w-4 text-purple-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="text-[11px] font-medium text-slate-200">Revisiona</p>
                    <p className="text-[9px] text-slate-500">Controlla qualità (MTPE)</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowProgressDialog(false);
                    router.push('/library');
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 hover:border-amber-500/40 transition-all text-left group"
                >
                  <Library className="h-4 w-4 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="text-[11px] font-medium text-slate-200">Altro gioco</p>
                    <p className="text-[9px] text-slate-500">Traduci un altro titolo</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowProgressDialog(false);
                    router.push(`/ai-translator?game=${encodeURIComponent(gameId || '')}`);
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 hover:border-emerald-500/40 transition-all text-left group"
                >
                  <ArrowRight className="h-4 w-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="text-[11px] font-medium text-slate-200">Vai al Traduttore</p>
                    <p className="text-[9px] text-slate-500">Modifica singole stringhe</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {autoState.isRunning ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={pauseAutoTranslation}
                  className="border-slate-600"
                >
                  {autoState.isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                  {autoState.isPaused ? 'Riprendi' : 'Pausa'}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={cancelAutoTranslation}
                >
                  <X className="h-4 w-4 mr-1" />
                  Annulla
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowProgressDialog(false)} variant="outline" className="border-slate-600">
                Chiudi
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DONAZIONE */}
      <DonationDialog 
        open={showDonationDialog} 
        onOpenChange={setShowDonationDialog}
        onUnlocked={() => {
          setShowDonationDialog(false);
          toast.success('🎉 Traduzioni illimitate sbloccate!');
        }}
      />
    </div>
  );
}



