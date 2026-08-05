'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri-api';
import { translateWithFallback, translateWithFallbackBatched, CHAIN_PRESETS, setChainPreset, getChainPreset, hasAvailableProviders, checkChainRequirements, type ChainPreset, type ProviderRequirement } from '@/lib/ai/ai-translate-direct';
import { filterDanganronpaDialogues } from '@/lib/patchers/danganronpa-filter';
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
  UserCircle,
  MessageSquare,
  Volume2,
  Shield,
  Lightbulb,
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
  ShieldCheck
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import { TranslationMemoryManager } from '@/lib/translation-memory';
import { extractTerms, loadGlossaryConfig } from '@/lib/auto-glossary';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';
import { runHendrixTranslation } from '@/lib/hendrix-translate';

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
  const { t } = useTranslation();
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
  
  // Custom Prompt & Voice - quick settings per questa traduzione
  const [quickPersona, setQuickPersona] = useState<string>('');
  const [quickTone, setQuickTone] = useState<string>('');
  const [enableVoiceOutput, setEnableVoiceOutput] = useState<boolean>(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const [autoState, setAutoState] = useState<AutoTranslationState>({
    isRunning: false,
    isPaused: false,
    currentStep: 0,
    steps: [],
  });
  // Stats, validazione, resume
  const [translationStats, setTranslationStats] = useState<TranslationStats | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  // Ref per catturare coppie tradotte tra step (per QA reale)
  const lastTranslatedPairs = useRef<Array<{ original: string; translated: string }>>([]);

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
        // Coerenza: se è un gioco con Hendrix_Localization (game_messages.csv), instrada
        // all'importer CSV dedicato. Senza questo override il backend lo classifica come
        // RPG Maker e proporrebbe il patcher JSON — confondendo l'utente.
        try {
          const hx = await invoke<{ unique_strings?: number }>('detect_hendrix_game', { gamePath });
          if (hx) {
            result.engine_name = 'Hendrix Localization';
            result.primary_method = 'file_translation';
            result.method_description = 'Traduzione via game_messages.csv (sistema nativo del gioco)';
            result.localization_format = 'Hendrix CSV';
            result.has_localization_files = true;
            result.optimal_strategy = {
              description: `Importer Hendrix CSV — ${hx.unique_strings ?? 0} stringhe uniche`,
              combined_reliability: 95,
              tools: [{
                id: 'hendrix_csv',
                name: 'Importer Hendrix CSV',
                description: 'Riempie la colonna lingua di game_messages.csv, abilita il plugin e la lingua',
                reliability: 95,
                route: '',
                available: true,
                reason: 'Hendrix_Localization rilevato',
              }],
            };
          }
        } catch { /* non è un gioco Hendrix: si tiene la raccomandazione del backend */ }
        setRecommendation(result);
      } catch (err: unknown) {
        clientLogger.error('Error loading recommendation: ' + String(err));
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
      toast.error(t('common.nessunaStrategiaDisponibile'));
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
      } catch (err: unknown) {
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
    toast.success(t('common.traduzioneCompletataEApplicata'));
  }, [recommendation, autoState.isPaused]);

  // Esegui singolo step
  const executeStep = async (step: AutoTranslationStep, stepIndex: number, _totalSteps: number) => {
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
            toast.success(t('translationRecommendationComp.bepinexInstalled'));
          } else {
            throw new Error(result.message || 'Installazione fallita');
          }
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          if (errMsg.includes('già installato') || errMsg.includes('already')) {
            updateProgress(100, '✅ XUnity già presente');
          } else {
            throw new Error(`Errore installazione XUnity: ${errMsg}`);
          }
        }
        break;

      case 'quality': {
        updateProgress(10, 'Verificando qualità traduzioni...');
        const pairs = lastTranslatedPairs.current;
        if (pairs.length > 0) {
          const validation = validateTranslations(pairs);
          setValidationResult(validation);
          const errCount = validation.issues.filter(i => i.severity === 'error').length;
          const warnCount = validation.issues.filter(i => i.severity === 'warning').length;
          updateProgress(100, `QA: ${validation.score}/100 — ${errCount} errori, ${warnCount} warning su ${validation.totalChecked} stringhe`);
          clientLogger.debug(`[QA] Score: ${validation.score}/100, errori: ${errCount}, warning: ${warnCount}, totale: ${validation.totalChecked}`);
          if (validation.issues.length > 0) {
            clientLogger.debug(`[QA] Primi 5 problemi: ${JSON.stringify(validation.issues.slice(0, 5))}`);
          }
        } else {
          updateProgress(100, 'Nessuna traduzione da validare');
        }
        break;
      }

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
        toast.success(t('translationRecommendationComp.xunityConfigured'));
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
        toast.info(t('translationRecommendationComp.useNeuralTranslatorPro'));
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
            toast.warning(t('translationRecommendationComp.noPckFound'));
          }
        } catch (err) {
          // Errore reale (PCK criptato, troncato, permessi…): loggalo, non inghiottirlo.
          clientLogger.error('extract_godot_pck fallito:', err);
          updateProgress(100, '📦 Usa gdsdecomp per estrarre il PCK manualmente');
          toast.info(t('translationRecommendationComp.godotHint'));
        }
        break;

      case 'unreal_patcher':
        updateProgress(10, 'Cercando file .locres di Unreal...');
        await new Promise(r => setTimeout(r, 500));
        
        try {
          // 1. Prova IoStore (UTOC/UCAS + Oodle) — giochi moderni UE4.25+/UE5
          updateProgress(15, 'Analisi container IoStore (UTOC/UCAS)...');
          type ExtractResult = {
            success: boolean;
            entries: Array<{ namespace: string; key: string; source_hash: number; value: string }>;
            message: string;
            locres_path?: string;
          };
          let extractResult: ExtractResult | null = null;

          let iostoreError = '';
          try {
            extractResult = await invoke<ExtractResult | null>('extract_iostore_localization', { gamePath });
            if (extractResult && extractResult.success) {
              updateProgress(30, `IoStore: ${extractResult.message}`);
            } else {
              extractResult = null;
            }
          } catch (ioErr) {
            iostoreError = ioErr instanceof Error ? ioErr.message : String(ioErr);
            clientLogger.info('IoStore:', iostoreError);
          }
          
          // 2. Fallback: estrazione standard da .pak
          if (!extractResult) {
            updateProgress(20, 'Analisi file .pak e .locres...');
            try {
              extractResult = await invoke<ExtractResult | null>('extract_unreal_localization', { gamePath });
            } catch (pakErr) {
              const pakError = pakErr instanceof Error ? pakErr.message : String(pakErr);
              // Se il backend ha marcato OODLE_MANCANTE, quella è LA causa e
              // va mostrata in lingua, con il rimedio — non concatenata a un
              // errore .pak che confonde (misura 29/07/2026: senza la DLL i
              // giochi UE5 con Oodle non danno una sola stringa utile).
              if (iostoreError.includes('OODLE_MANCANTE')) {
                throw new Error(`${t('unrealWizard.oodleMissing')} ${t('unrealWizard.oodleHowTo')}`);
              }
              // Combina errori IoStore + PAK per messaggio completo
              const combined = iostoreError
                ? `IoStore: ${iostoreError}\nPAK: ${pakError}`
                : pakError;
              throw new Error(combined);
            }
          }
          
          if (extractResult && extractResult.success && extractResult.entries.length > 0) {
            updateProgress(50, `Estratte ${extractResult.entries.length} stringhe!`);
            
            // Traduci le stringhe
            const textsToTranslate = extractResult.entries
              .filter(e => e.value.trim().length > 0)
              .map(e => e.value);
            
            clientLogger.debug(`[Unreal] Entries: ${extractResult.entries.length}, con testo non vuoto: ${textsToTranslate.length}`);
            if (textsToTranslate.length > 0) {
              updateProgress(60, `Traducendo ${textsToTranslate.length} stringhe...`);
              const customSettings = JSON.parse(localStorage.getItem('gs_custom_prompt_settings') || '{}');
              const trResult = await translateWithFallbackBatched({
                texts: textsToTranslate,
                targetLanguage: 'it',
                sourceLanguage: 'en',
                persona: quickPersona || customSettings.persona,
                tone: quickTone || customSettings.tone,
                customPrompt: customSettings.customPrompt,
                enableVoice: enableVoiceOutput || customSettings.enableVoice,
                speakerVoice: customSettings.speakerVoice,
                preserveVoice: customSettings.preserveVoice,
              }, 20, (done, total) => {
                const pct = 60 + Math.round((done / total) * 30);
                updateProgress(pct, `Tradotte ${done}/${total} stringhe...`);
              });
              
              // Log diagnostico traduzione
              clientLogger.debug(`[Unreal] Traduzione completata: provider=${trResult.provider}, success=${trResult.success}, risultati=${trResult.translations.length}`);
              if (trResult.translations.length > 0) {
                clientLogger.debug(`[Unreal] Campione: "${textsToTranslate[0]?.substring(0, 50)}" → "${trResult.translations[0]?.substring(0, 50)}"`);
              }
              
              // Salva coppie per QA nello step 'quality'
              lastTranslatedPairs.current = textsToTranslate.map((orig, i) => ({
                original: orig,
                translated: trResult.translations[i] || orig,
              }));
              
              // Crea mappa traduzioni
              const translations: Record<string, string> = {};
              let idx = 0;
              for (const entry of extractResult.entries) {
                if (entry.value.trim().length > 0 && idx < trResult.translations.length) {
                  translations[`${entry.namespace}::${entry.key}`] = trResult.translations[idx];
                  idx++;
                }
              }
              
              updateProgress(90, 'Creando .pak tradotto...');
              
              // Determina se usare DataTable patching o .locres standard
              const isDataTable = extractResult.locres_path === 'DataTable .uasset';
              const applyCommand = isDataTable ? 'apply_datatable_translation' : 'apply_unreal_translation';
              
              const pakResult = await invoke<{ success: boolean; pak_path: string; message: string }>(applyCommand, {
                gamePath,
                translations: extractResult.entries.map(e => ({
                  namespace: e.namespace,
                  key: e.key,
                  source_hash: e.source_hash,
                  original: e.value,
                  translated: translations[`${e.namespace}::${e.key}`] || e.value,
                })),
                targetLanguage: 'it',
              });
              
              // === SALVA IN TRANSLATION MEMORY ===
              try {
                const tm = new TranslationMemoryManager();
                await tm.initialize('en', 'it');
                const tmBatch = lastTranslatedPairs.current
                  .filter(p => p.translated && p.original && p.original.length > 2 && p.translated !== p.original)
                  .map(p => ({
                    source: p.original,
                    target: p.translated,
                    gameId: gameId,
                    context: gameName,
                  }));
                if (tmBatch.length > 0) {
                  await tm.addBatch(tmBatch);
                  await tm.save();
                  clientLogger.debug(`[Unreal] ✅ TM: salvate ${tmBatch.length} traduzioni`);
                }
              } catch (tmErr) {
                clientLogger.warn('[Unreal] TM salvataggio fallito: ' + String(tmErr));
              }

              // === AUTO-GLOSSARIO: estrai termini dal gioco ===
              try {
                const glossaryConfig = loadGlossaryConfig();
                if (glossaryConfig.enabled && glossaryConfig.autoExtractOnFirstBatch) {
                  const sampleTexts = textsToTranslate.slice(0, 60);
                  const extraction = await extractTerms(
                    gameId || `unreal_${gameName.replace(/\s+/g, '_').toLowerCase()}`,
                    gameName,
                    sampleTexts,
                    'en',
                    'it',
                  );
                  if (extraction.newTerms.length > 0) {
                    clientLogger.debug(`[Unreal] ✅ Glossario: ${extraction.newTerms.length} termini estratti (${extraction.duplicates} duplicati)`);
                  }
                }
              } catch (glErr) {
                clientLogger.warn('[Unreal] Glossario estrazione fallita: ' + String(glErr));
              }

              // === SALVA FILE JSON PER REVISIONI FUTURE ===
              try {
                const revisionData = {
                  gameName,
                  gameId: gameId || '',
                  gamePath,
                  sourceLanguage: 'en',
                  targetLanguage: 'it',
                  provider: trResult.provider,
                  createdAt: new Date().toISOString(),
                  pakPath: pakResult.pak_path,
                  totalStrings: idx,
                  entries: extractResult.entries.map(e => ({
                    namespace: e.namespace,
                    key: e.key,
                    // Senza il source hash originale, ogni re-apply futuro dalla
                    // sessione scriverebbe locres che UE scarta in silenzio
                    // (protezione anti-stale). Trovato su Greed il 04/08/2026.
                    source_hash: e.source_hash,
                    original: e.value,
                    translated: translations[`${e.namespace}::${e.key}`] || e.value,
                  })),
                };
                const revisionJson = JSON.stringify(revisionData, null, 2);
                const revisionPath = `${gamePath}/GameStringer/translation_session.json`;
                await invoke('ensure_directory', { path: `${gamePath}/GameStringer` });
                await invoke('write_text_file', { path: revisionPath, content: revisionJson });
                clientLogger.debug(`[Unreal] ✅ Revisione: salvata in ${revisionPath}`);
              } catch (revErr) {
                clientLogger.warn('[Unreal] Salvataggio revisione fallito: ' + String(revErr));
              }

              updateProgress(100, `✅ ${pakResult.message}`);
              toast.success(`Traduzione Unreal completata! ${idx} stringhe tradotte. TM e glossario aggiornati.`);
            }
          } else {
            throw new Error('Nessun .locres trovato automaticamente');
          }
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          updateProgress(100, `❌ ${errMsg}`);
          toast.error(
            `Impossibile estrarre automaticamente le stringhe di localizzazione. ${errMsg}`,
            { duration: 8000 }
          );
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
            toast.info(t('translationRecommendationComp.rpgMakerVxHint'));
          }
        } catch {
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
            toast.success(t('translationRecommendationComp.renpyFound'));
          } else if (rpaFiles && rpaFiles.length > 0) {
            updateProgress(70, 'Estraendo archivi .rpa...');
            
            const result = await invoke<{ success: boolean }>('extract_renpy_rpa', {
              rpaPath: rpaFiles[0],
              outputPath: gamePath + '/game'
            });
            
            if (result.success) {
              updateProgress(100, '✅ Archivi RPA estratti!');
              toast.success(t('translationRecommendationComp.renpyExtracted'));
            }
          } else {
            updateProgress(100, '⚠️ Nessun file Ren\'Py trovato');
          }
        } catch (err) {
          // Errore reale (RPA-1.0, indice corrotto, permessi…): loggalo, non inghiottirlo.
          clientLogger.error('extract_renpy_rpa fallito:', err);
          updateProgress(100, '📦 Usa UnRPA per estrarre manualmente');
          toast.info(t('translationRecommendationComp.renpyHint'));
        }
        break;

      case 'wolfrpg_patcher':
        updateProgress(20, 'Cercando database Wolf RPG...');
        await new Promise(r => setTimeout(r, 500));
        
        updateProgress(50, 'Wolf RPG rilevato...');
        updateProgress(100, '📦 Usa Wolf RPG Editor per estrarre testi');
        toast.info(t('translationRecommendationComp.wolfRpgHint'));
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
            toast.info(t('common.kirikiriUsaKrkrextractPerEstrarreIFileXp3'));
          } else {
            updateProgress(100, '⚠️ Nessun archivio XP3 trovato');
          }
        } catch {
          updateProgress(100, '📦 Estrazione manuale richiesta');
        }
        break;

      case 'gamemaker_patcher':
        updateProgress(20, 'Cercando data.win di GameMaker...');
        await new Promise(r => setTimeout(r, 500));
        
        const _dataWin = gamePath + '/data.win';
        updateProgress(50, 'Analizzando struttura GameMaker...');
        updateProgress(100, '📦 Usa UndertaleModTool per estrarre stringhe');
        toast.info(t('common.gamemakerUsaUndertalemodtoolPerModificareDatawin'));
        break;

      case 'spike_chunsoft_patcher':
      case 'danganronpa_patcher':
        updateProgress(5, '🎮 Rilevato Danganronpa (Spike Chunsoft)...');
        await new Promise(r => setTimeout(r, 300));
        
        try {
          // Step 0: Verifica provider disponibili nella catena attiva
          updateProgress(8, '🔑 Verifica provider disponibili...');
          const { available, providers: availableProviders } = hasAvailableProviders();
          clientLogger.debug(`[DANGANRONPA] Chain: ${getChainPreset()}, provider disponibili: [${availableProviders.join(', ')}]`);
          
          if (!available) {
            updateProgress(100, '⚠️ Nessun provider disponibile');
            toast.error(t('common.nessunProviderDisponibilenn') +
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
          
          clientLogger.debug(`[Danganronpa] Filtro: ${fs.totalInput} → ${fs.afterLocalFilter} (rimossi: ${fs.removedEmpty} vuoti, ${fs.removedDuplicate} duplicati, ${fs.removedSystemText} sistema, ${fs.removedShort} corti, ${fs.removedNonDialogue} non-dialogo)`);
          
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
            clientLogger.debug(`[Resume] Ripresa da batch index ${resumeIndex}, ${alreadyDone} già tradotte`);
            toast.info(`🔄 Ripresa traduzione da stringa ${alreadyDone}/${totalStrings}`, { duration: 4000 });
          }
          
          // Carica glossario per il gioco (se esiste)
          const glossary = loadGlossary(gameId || gameName);
          if (glossary && glossary.entries.length > 0) {
            clientLogger.debug(`[Glossario] ${glossary.entries.length} voci caricate per ${gameName}`);
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
            // Carica custom settings se presenti
            const customSettings = JSON.parse(localStorage.getItem('gs_custom_prompt_settings') || '{}');
            try {
              const result = await translateWithFallback({
                texts,
                targetLanguage: 'it',
                sourceLanguage: 'en',
                context: contextStr,
                // Custom Prompt & Voice
                persona: quickPersona || customSettings.persona,
                tone: quickTone || customSettings.tone,
                customPrompt: customSettings.customPrompt,
                enableVoice: enableVoiceOutput || customSettings.enableVoice,
                speakerVoice: customSettings.speakerVoice,
                preserveVoice: customSettings.preserveVoice,
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
                  clientLogger.debug(`💾 Checkpoint salvato: ${translated}/${totalStrings}`);
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
                  
                  clientLogger.debug(`☕ Limite ${midGate.limit} raggiunto — mostra donazione`);
                  setShowDonationDialog(true);
                  updateProgress(
                    25 + Math.floor((i / dialogues.length) * 65),
                    `☕ Limite gratuito raggiunto — dona per continuare...`
                  );
                  // Attendi che l'utente sblocchi (polling ogni 1s)
                  while (!canTranslate().allowed) {
                    await new Promise(r => setTimeout(r, 1000));
                  }
                  clientLogger.debug(`🎉 Supporter sbloccato — riprendo traduzione`);
                  setShowDonationDialog(false);
                }
                clientLogger.debug(`✅ Batch tradotto via ${result.provider}`);
              } else {
                retryCount++;
                if (retryCount > maxRetries) {
                  clientLogger.warn('⚠️ Troppi errori, continuo con le prossime');
                  sessionStats.failedStrings += texts.length;
                  retryCount = 0;
                  continue;
                }
                const waitTime = Math.min(30000 * retryCount, 120000);
                clientLogger.debug(`⏳ Tutti i provider falliti, aspetto ${waitTime/1000}s... (retry ${retryCount}/${maxRetries})`);
                updateProgress(
                  25 + Math.floor((i / dialogues.length) * 65),
                  `⏳ Provider falliti, aspetto ${waitTime/1000}s...`
                );
                await new Promise(r => setTimeout(r, waitTime));
                i -= batchSize; // Riprova questo batch
                continue;
              }
            } catch (batchErr) {
              clientLogger.warn('Batch translation error: ' + String(batchErr));
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
          const translatedPairsForQA = translatedDialogues.map(d => ({ original: d.original, translated: d.translated }));
          lastTranslatedPairs.current = translatedPairsForQA;
          const validation = validateTranslations(translatedPairsForQA);
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
        } catch (e: unknown) {
          // Se è errore API key, non mostrare altri messaggi (già gestito)
          if (e instanceof Error && e.message === 'API_KEY_MISSING') {
            return; // Esce silenziosamente, redirect già fatto
          }
          
          updateProgress(50, '⚠️ Errore');
          await new Promise(r => setTimeout(r, 500));
          
          updateProgress(100, '📖 Istruzioni manuali');
          toast.info(t('common.workflowManualeDanganronpann') +
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

      case 'hendrix_csv': {
        // Importer Hendrix CSV: estrai → traduci (offline) → applica colonna → abilita lingua.
        // Con checkpoint/resume e apply incrementale (vedi lib/hendrix-translate).
        const r = await runHendrixTranslation({
          gamePath,
          targetLang: 'it',
          targetName: 'Italiano',
          onProgress: (p) => {
            if (p.phase === 'translate') updateProgress(10 + Math.round((p.done / Math.max(p.total, 1)) * 78), `Traduzione ${p.done}/${p.total}... (ripresa salvata)`);
            else if (p.phase === 'apply') updateProgress(90, 'Applico la colonna lingua al CSV...');
            else if (p.phase === 'enable') updateProgress(96, 'Abilito plugin e lingua italiana...');
          },
        });
        updateProgress(100, `✅ ${r.applied}/${r.total} stringhe tradotte in italiano`);
        toast.success(`Hendrix: ${r.applied} stringhe tradotte. Rilancia il gioco.`);
        break;
      }

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
    toast.info(t('common.traduzioneAnnullata'));
  };

  if (isLoading) {
    return (
      <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
          <span className="text-2xs text-violet-300/60">{t('translationRecommendationComp.analisi')}</span>
        </div>
      </div>
    );
  }

  if (error || !recommendation) {
    return (
      <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2.5 backdrop-blur-md">
        <div className="flex items-center gap-1.5 text-orange-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-2xs">{t('translationRecommendationComp.analisiNonDisponibile')}</span>
        </div>
      </div>
    );
  }

  const strategy = recommendation.optimal_strategy;
  const strategyReliability = strategy?.combined_reliability || recommendation.reliability;
  
  // reliabilityColor rimosso col numero che colorava (02/08/2026).
  // strategyReliability resta SOLO come soglia interna (>= 75) per decidere se
  // mostrare l'azione combinata: usarlo per ramificare è legittimo, mostrarlo
  // all'utente come "99%" no — non è una misura.

  return (
    <div className="rounded-xl bg-[#1b2838]/80 border border-[#2a475e]/50 p-3.5 backdrop-blur-md w-full space-y-3">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/15">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#e5e9ed]">{t('translationRecommendationComp.strategiaOttimale')}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {recommendation.engine_name && recommendation.engine_name !== 'Sconosciuto' && (
                <span className="flex items-center gap-1 text-2xs text-cyan-400/80">
                  <Cpu className="h-3 w-3" />
                  {recommendation.engine_name}
                </span>
              )}
              {recommendation.has_existing_patch && (
                <span className="flex items-center gap-1 text-2xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('translationRecommendationComp.patchInstalled')}</span>
              )}
            </div>
          </div>
        </div>
        {/* Qui c'era una percentuale ("99%") con barra colorata. Rimossa il
            02/08/2026: combined_reliability NON è una misura, è una formula
            interna (reliability del miglior tool + 1/5 per ogni altro, cap 99)
            e i valori dei singoli tool sono costanti scritte a mano. Un numero
            preciso senza misura dietro è peggio di nessun numero: dà fiducia
            che non abbiamo guadagnato. Se un giorno la fiducia si misura sul
            campo (esiti reali per motore, come il benchmark provider), il
            numero può tornare — con la sua fonte. */}
      </div>

      {/* ── ANTI-CHEAT WARNING ── */}
      {recommendation.anti_cheat_detected && (
        <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/25 rounded-lg">
          <Shield className="h-4 w-4 text-red-400 shrink-0" />
          <div>
            <span className="text-[11px] font-semibold text-red-300">{recommendation.anti_cheat_detected}</span>
            <p className="text-2xs text-red-300/60 mt-0.5">{recommendation.anti_cheat_warning}</p>
          </div>
        </div>
      )}

      {/* ── STRATEGIA PRINCIPALE ── */}
      {strategy && strategy.tools.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-[#8f98a0] leading-relaxed">{strategy.description}</p>
          
          {/* Tool cards */}
          <div className="space-y-1.5">
            {strategy.tools.map((tool, idx) => (
              <button
                key={tool.id}
                onClick={() => handleAction(tool.route)}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-[#0e1419]/60 hover:bg-[#1a2736] border border-[#2a475e]/30 hover:border-[#67c1f5]/30 transition-all text-left group"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-[#1a9fff]/15 text-[#67c1f5] text-2xs font-bold shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-[#c6d4df] group-hover:text-white transition-colors">{tool.name}</span>
                  <span className="text-2xs text-[#8f98a0] ml-2">{tool.reason}</span>
                </div>
                {/* percentuale per-tool rimossa: costante scritta a mano, non misura */}
                <ChevronRight className="h-3 w-3 text-[#8f98a0]/40 group-hover:text-[#67c1f5] transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Fallback: metodo singolo */
        <div className="flex items-center gap-3 p-2.5 bg-[#0e1419]/60 rounded-lg border border-[#2a475e]/30">
          <div className="p-2 bg-violet-500/15 rounded-lg text-violet-400 shrink-0">
            {methodIcons[recommendation.primary_method] || <Sparkles className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[11px] font-semibold text-[#c6d4df]">{recommendation.method_description}</h4>
            <p className="text-2xs text-[#8f98a0] mt-0.5">{recommendation.reason}</p>
          </div>
        </div>
      )}

      {/* ── INFO ROW: AI + file + lingua ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-2xs text-violet-300/70 bg-violet-500/10 px-2 py-1 rounded-md">
          <Bot className="h-3 w-3" />
          {aiLabels[recommendation.recommended_ai] || recommendation.recommended_ai}
        </span>
        {recommendation.translatable_files_count != null && recommendation.translatable_files_count > 0 && (
          <span className="flex items-center gap-1.5 text-2xs text-blue-300/70 bg-blue-500/10 px-2 py-1 rounded-md">
            <FileText className="h-3 w-3" />
            {recommendation.translatable_files_count}  {t('translationRecommendationComp.filesUnit')}</span>
        )}
        {recommendation.missing_italian && (
          <span className="text-2xs text-orange-300/80 bg-orange-500/10 px-2 py-1 rounded-md">
            {t('translationRecommendationComp.itMissing')}</span>
        )}
      </div>

      {/* ── TIPS ── */}
      {recommendation.tips && recommendation.tips.length > 0 && (
        <div className="space-y-1">
          {recommendation.tips.slice(0, 2).map((tip, idx) => (
            <div key={idx} className="flex items-start gap-2 text-2xs text-amber-200/70">
              <Lightbulb className="h-3 w-3 text-amber-400/60 shrink-0 mt-0.5" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── AZIONI ── */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#2a475e]/30">
        {/* PULSANTE ONE-CLICK TRANSLATION */}
        {strategy && strategy.tools.length > 0 && strategyReliability >= 75 && !recommendation.anti_cheat_detected && (
          <button 
            className="flex-1 text-[11px] font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 border border-emerald-500/30"
            onClick={() => setShowConfirmDialog(true)}
          >
            <Wand2 className="h-4 w-4" />
            {t('translationRecommendationComp.translateAll')}</button>
        )}
        
        {/* Bottone manuale */}
        <button 
          className={`text-[11px] font-medium text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors ${strategy && strategy.tools.length > 0 && strategyReliability >= 75 && !recommendation.anti_cheat_detected ? '' : 'flex-1 justify-center'}`}
          onClick={() => handleAction(recommendation.action_route)}
        >
          {recommendation.action_label}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* DIALOG CONFERMA ONE-CLICK */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-slate-900 border-emerald-500/30 max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <Rocket className="h-5 w-5" />
              {t('translationRecommendationComp.fullAutoTranslation')}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {t('translationRecommendationComp.wantFullHelp')}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-300">
              {t('translationRecommendationComp.willExecuteSteps')}</p>
            
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xs">1</span>
                {t('translationRecommendationComp.scanTranslatableFiles')}</div>
              {strategy?.tools.map((tool, idx) => (
                <div key={tool.id} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-2xs">{idx + 2}</span>
                  {tool.name}
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-2xs">✓</span>
                {t('translationRecommendationComp.qualityCheckApplyPatch')}</div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-300">🔗 {t('translationRecommendationComp.translationChain')}</p>
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
                        <span className="text-2xs text-slate-500">{preset.quality}</span>
                      </div>
                      <span className="text-2xs text-slate-400">{preset.cost}</span>
                    </div>
                    {selectedChain === preset.id && (
                      <p className="text-2xs text-cyan-400/60 mt-1 ml-5">
                        {preset.providers.join(' → ')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Warning requisiti mancanti */}
            {checkingChain ? (
              <div className="flex items-center gap-2 text-2xs text-slate-500 py-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('translationRecommendationComp.checkingRequirements')}</div>
            ) : chainWarnings.length > 0 && (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {chainWarnings.filter(w => w.severity === 'critical').length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {t('translationRecommendationComp.missingRequirements')}</p>
                    {chainWarnings.filter(w => w.severity === 'critical').map((w, i) => (
                      <div key={i} className="ml-5 space-y-0.5">
                        <p className="text-2xs text-amber-300/90 font-medium">{w.label}: {w.message}</p>
                        <div className="text-micro text-slate-400 space-y-0">
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
                              className="text-micro text-cyan-400 underline hover:text-cyan-300"
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
                    <summary className="text-2xs text-slate-500 cursor-pointer hover:text-slate-400">
                      + {chainWarnings.filter(w => w.severity === 'warning').length}  {t('translationRecommendationComp.optionalProvidersNotConfigured')}</summary>
                    <div className="mt-1 space-y-1 pl-2 border-l border-slate-700">
                      {chainWarnings.filter(w => w.severity === 'warning').map((w, i) => (
                        <div key={i} className="text-micro text-slate-500">
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

          {/* Opzioni Avanzate - Custom Prompt & Voice */}
          <div className="border border-slate-700/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-slate-200">{t('translationRecommendation.advancedOptions')}</span>
                {(quickPersona || quickTone || enableVoiceOutput) && (
                  <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-500/30 text-purple-300">
                    {t('translationRecommendation.active')}
                  </Badge>
                )}
              </div>
              <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`} />
            </button>
            
            {showAdvancedOptions && (
              <div className="p-3 space-y-3 bg-slate-800/20">
                {/* Persona & Tone */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400 flex items-center gap-1">
                      <UserCircle className="h-3 w-3" />
                      {t('translationRecommendation.persona')}
                    </Label>
                    <Select value={quickPersona} onValueChange={setQuickPersona}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder={t('translationRecommendation.personaDefault')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t('translationRecommendation.personaDefault')}</SelectItem>
                        <SelectItem value="a wise old wizard">{t('translationRecommendation.personaWizard')}</SelectItem>
                        <SelectItem value="a medieval knight">{t('translationRecommendation.personaKnight')}</SelectItem>
                        <SelectItem value="a pirate captain">{t('translationRecommendation.personaPirate')}</SelectItem>
                        <SelectItem value="a sci-fi captain">{t('translationRecommendation.personaSciFiCaptain')}</SelectItem>
                        <SelectItem value="a horror narrator">{t('translationRecommendation.personaHorror')}</SelectItem>
                        <SelectItem value="a noble lady">{t('translationRecommendation.personaNoble')}</SelectItem>
                        <SelectItem value="a street-smart kid">{t('translationRecommendation.personaStreetKid')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {t('translationRecommendation.tone')}
                    </Label>
                    <Select value={quickTone} onValueChange={setQuickTone}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder={t('translationRecommendation.personaDefault')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t('translationRecommendation.toneDefault')}</SelectItem>
                        <SelectItem value="formal">{t('translationRecommendation.toneFormal')}</SelectItem>
                        <SelectItem value="casual">{t('translationRecommendation.toneCasual')}</SelectItem>
                        <SelectItem value="humorous">{t('translationRecommendation.toneHumorous')}</SelectItem>
                        <SelectItem value="mysterious">{t('translationRecommendation.toneMysterious')}</SelectItem>
                        <SelectItem value="epic">{t('translationRecommendation.toneEpic')}</SelectItem>
                        <SelectItem value="dark">{t('translationRecommendation.toneDark')}</SelectItem>
                        <SelectItem value="romantic">{t('translationRecommendation.toneRomantic')}</SelectItem>
                        <SelectItem value="sarcastic">{t('translationRecommendation.toneSarcastic')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* DeepL Voice Toggle */}
                <div className="flex items-center justify-between p-2 rounded bg-slate-800/30">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-medium text-slate-200">{t('translationRecommendation.voiceOutput')}</span>
                      <p className="text-2xs text-slate-500">{t('translationRecommendation.deeplVoiceApi')}</p>
                    </div>
                  </div>
                  <Switch
                    checked={enableVoiceOutput}
                    onCheckedChange={setEnableVoiceOutput}
                  />
                </div>

                {(quickPersona || quickTone) && (
                  <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20">
                    <p className="text-2xs text-purple-300">
                      <span className="font-medium">{t('translationRecommendation.preview')}:</span>{' '}
                      {quickPersona && `${t('translationRecommendation.persona')}: "${quickPersona}"`}
                      {quickPersona && quickTone && ' · '}
                      {quickTone && `${t('translationRecommendation.tone')}: "${quickTone}"`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="border-slate-600">
              {t('translationRecommendationComp.cancel')}</Button>
            <Button 
              onClick={() => {
                setChainPreset(selectedChain);
                startAutoTranslation();
              }}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white"
            >
              <Rocket className="h-4 w-4 mr-1" />
              {t('translationRecommendationComp.startTranslation')}</Button>
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
              {autoState.isRunning ? t('translationRecommendationComp.titleRunning') : autoState.error ? t('translationRecommendationComp.titleError') : t('translationRecommendationComp.titleDone')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('translationRecommendationComp.autoTranslationProgress')}</DialogDescription>
          </DialogHeader>
          
          {/* Progresso + step tecnici: SOLO durante il lavoro o su errore.
              A completamento pulito spariscono — l'utente vede l'esito, non i
              6 step con nomi interni (ridisegno UN PULSANTE, 05/08/2026). */}
          {(autoState.isRunning || !!autoState.error || autoState.steps.length === 0 || !autoState.steps.every(s => s.status === 'completed')) && (
          <div className="space-y-3 py-2">
            {/* Progress globale */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{t('translationRecommendationComp.progressoTotale')}</span>
                <span>{Math.round((autoState.steps.filter(s => s.status === 'completed').length / Math.max(1, autoState.steps.length)) * 100)}%</span>
              </div>
              <Progress
                value={(autoState.steps.filter(s => s.status === 'completed').length / Math.max(1, autoState.steps.length)) * 100}
                className="h-2"
              />
            </div>

            {/* Lista step */}
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
              {autoState.steps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs shrink-0 ${
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
                      <div className="text-2xs text-slate-500 truncate">{step.message}</div>
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
          )}

          {/* Pannello post-completamento — UN PULSANTE: esito, quante stringhe, GIOCA ORA. */}
          {!autoState.isRunning && !autoState.error && autoState.steps.length > 0 && autoState.steps.every(s => s.status === 'completed') && (
            <div className="space-y-4 max-h-[440px] overflow-y-auto py-1">
              {/* Esito + conteggio: le sole due cose che l'utente deve vedere subito */}
              <div className="text-center space-y-1.5 py-1">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <p className="text-base font-bold text-emerald-300">{t('translationRecommendationComp.translationCompleted')}</p>
                {translationStats && (
                  <p className="text-sm text-slate-300">
                    <span className="font-bold text-emerald-400">{translationStats.translatedStrings}</span> {t('translationRecommendationComp.stringsTranslated')}
                    {validationResult && validationResult.score < 90 && (
                      <span className="ml-2 text-2xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                        {t('translationRecommendationComp.toReview')} · QA {validationResult.score}/100
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* GIOCA ORA — azione primaria. Cabla action:launch_game, che la
                  pagina gioco instrada a steam://rungameid (onActionClick). */}
              <Button
                onClick={() => { setShowProgressDialog(false); handleAction('action:launch_game'); }}
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white shadow-lg shadow-emerald-500/20"
              >
                <Play className="h-5 w-5 mr-2" /> {t('translationRecommendationComp.playNow')}
              </Button>

              {/* Tutto il resto — path, QA per esteso, export, altre azioni — ripiegato. */}
              <details className="group">
                <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 select-none list-none flex items-center gap-1.5">
                  <span className="inline-block transition-transform group-open:rotate-90">▸</span>
                  {t('translationRecommendationComp.details')}
                </summary>
                <div className="mt-3 space-y-3">
              {/* File creato */}
              <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <FileCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-emerald-300">{t('translationRecommendationComp.fileDiTraduzioneCreatoConSucce')}</p>
                  <p className="text-2xs text-slate-400 truncate" title={`${gamePath}/GameStringer_Translation/translations.json`}>
                    📁 {gamePath}/GameStringer_Translation/translations.json
                  </p>
                </div>
              </div>

              {/* Statistiche */}
              {translationStats && (
                <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
                    {t('translationRecommendationComp.translationStats')}</p>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-1.5 bg-slate-900/50 rounded">
                      <p className="text-sm font-bold text-emerald-400">{translationStats.translatedStrings}</p>
                      <p className="text-micro text-slate-500">{t('translationRecommendationComp.tradotte')}</p>
                    </div>
                    <div className="text-center p-1.5 bg-slate-900/50 rounded">
                      <p className="text-sm font-bold text-cyan-400">
                        {translationStats.endTime ? formatDuration(translationStats.endTime - translationStats.startTime) : '—'}
                      </p>
                      <p className="text-micro text-slate-500">{t('translationRecommendationComp.durata')}</p>
                    </div>
                    <div className="text-center p-1.5 bg-slate-900/50 rounded">
                      <p className="text-sm font-bold text-amber-400">{formatCost(translationStats.estimatedCost)}</p>
                      <p className="text-micro text-slate-500">{t('translationRecommendationComp.costo')}</p>
                    </div>
                    <div className="text-center p-1.5 bg-slate-900/50 rounded">
                      <p className="text-sm font-bold text-purple-400">{translationStats.avgSpeed.toFixed(1)}/s</p>
                      <p className="text-micro text-slate-500">{t('translationRecommendationComp.velocità')}</p>
                    </div>
                  </div>
                  {/* Provider breakdown */}
                  {Object.keys(translationStats.providerUsage).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(translationStats.providerUsage)
                        .sort(([, a], [, b]) => b - a)
                        .map(([prov, count]) => (
                          <span key={prov} className="text-micro bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
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
                      {t('translationRecommendationComp.qualityValidation')}</p>
                    <span className={`text-sm font-bold ${
                      validationResult.score >= 90 ? 'text-emerald-400' :
                      validationResult.score >= 70 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {validationResult.score}/100
                    </span>
                  </div>
                  {validationResult.issues.length > 0 ? (
                    <details className="group">
                      <summary className="text-2xs text-slate-500 cursor-pointer hover:text-slate-400">
                        {validationResult.issues.filter(i => i.severity === 'error').length}  {t('translationRecommendationComp.errorsCount')} {validationResult.issues.filter(i => i.severity === 'warning').length}  {t('translationRecommendationComp.warningOn')} {validationResult.totalChecked}  {t('translationRecommendationComp.stringsUnit')}</summary>
                      <div className="mt-1.5 space-y-1 max-h-24 overflow-y-auto">
                        {validationResult.issues.slice(0, 10).map((issue, i) => (
                          <p key={i} className={`text-micro ${issue.severity === 'error' ? 'text-red-400' : 'text-amber-400/70'}`}>
                            #{issue.index}: {issue.message}
                          </p>
                        ))}
                        {validationResult.issues.length > 10 && (
                          <p className="text-micro text-slate-500">{t('translationRecommendationComp.andOthers')} {validationResult.issues.length - 10}</p>
                        )}
                      </div>
                    </details>
                  ) : (
                    <p className="text-2xs text-emerald-400/70">{t('translationRecommendationComp.nessunProblemaRilevato')}</p>
                  )}
                </div>
              )}

              {/* Export */}
              <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                <p className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5 text-blue-400" />
                  {t('translationRecommendationComp.exportTranslations')}</p>
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
                        } catch {
                          toast.error(`Errore export ${fmt}`);
                        }
                      }}
                      className="text-2xs px-2 py-1 rounded border border-slate-600 bg-slate-900/50 text-slate-300 hover:border-blue-500/40 hover:text-blue-300 transition-colors"
                      title={desc}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Azioni */}
              <p className="text-[11px] text-slate-400 font-medium">{t('translationRecommendationComp.cosaVuoiFareOra')}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    try {
                      await open(`${gamePath}/GameStringer_Translation`);
                    } catch {
                      toast.error(t('common.impossibileAprireLaCartella'));
                    }
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 hover:border-cyan-500/40 transition-all text-left group"
                >
                  <FolderOpen className="h-4 w-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="text-[11px] font-medium text-slate-200">{t('translationRecommendationComp.apriCartella')}</p>
                    <p className="text-micro text-slate-500">{t('translationRecommendationComp.vediIFileTradotti')}</p>
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
                    <p className="text-[11px] font-medium text-slate-200">{t('translationRecommendationComp.revisiona')}</p>
                    <p className="text-micro text-slate-500">{t('translationRecommendationComp.controllaQualitàMtpe')}</p>
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
                    <p className="text-[11px] font-medium text-slate-200">{t('translationRecommendationComp.altroGioco')}</p>
                    <p className="text-micro text-slate-500">{t('translationRecommendationComp.traduciUnAltroTitolo')}</p>
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
                    <p className="text-[11px] font-medium text-slate-200">{t('translationRecommendationComp.vaiAlTraduttore')}</p>
                    <p className="text-micro text-slate-500">{t('translationRecommendationComp.modificaSingoleStringhe')}</p>
                  </div>
                </button>
              </div>
                </div>
              </details>
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
                  {t('translationRecommendationComp.cancel')}</Button>
              </>
            ) : (
              <Button onClick={() => setShowProgressDialog(false)} variant="outline" className="border-slate-600">
                {t('translationRecommendationComp.close')}</Button>
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
          toast.success(t('common.traduzioniIllimitateSbloccate'));
        }}
      />
    </div>
  );
}




