/**
 * 🔗 AI Translation Pipeline — Multi-Agent Quality Enhancement
 * 
 * Pipeline ispirata a Crowdin AI Pipeline:
 * Ogni step è un prompt separato, evitando "prompt overloading" e allucinazioni.
 * 
 * 🤖 MULTI-AGENT: Ogni step può usare un modello Ollama diverso:
 *   - Translate Agent: modello grande/preciso (es. Qwen3.5:35b, hy-mt1.5:7b)
 *   - QA/Fix Agent: modello veloce (es. Phi-4-mini, GLM-4.7-Flash)
 *   - Review Agent: modello diverso dal traduttore ("seconda opinione")
 * 
 * Step 1: Context Harvester (deterministico)
 * Step 2: Traduzione iniziale (Agent: Translate)
 * Step 3: QA automatico deterministico
 * Step 4: Auto-fix AI (Agent: Fix)
 * Step 5: Review finale AI (Agent: Review)
 * Step 6: Scoring finale e report
 */

import { translateSmart, type TranslateOptions, type TranslateResult } from './ai-translate-direct';
import { runQualityGates, type QualityReport } from './quality-gates';
import { harvestBatch, type HarvestInput, type BatchHarvestResult } from './context-harvester';
import { buildRelevantGlossaryHint } from './auto-glossary';
import { clientLogger } from '@/lib/client-logger';

// ============================================================================
// TYPES
// ============================================================================

export type PipelineStepId = 
  | 'harvest'       // Context Harvester
  | 'translate'     // Traduzione iniziale
  | 'qa_check'      // QA deterministico
  | 'auto_fix'      // Auto-correzione AI
  | 'review'        // Review finale AI
  | 'score';        // Scoring finale

export type PipelineStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineStep {
  id: PipelineStepId;
  name: string;
  status: PipelineStepStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  result?: unknown;
  error?: string;
}

/** Configurazione modello per un singolo agente della pipeline */
export interface AgentModelConfig {
  /** Nome del modello Ollama (es. 'qwen3.5:35b-a3b', 'phi4-mini', ecc.) */
  model: string;
  /** Label per UI */
  label?: string;
  /** Usa 'ollama' forzato oppure lascia il provider chain di default */
  forceOllama?: boolean;
}

/** Assegnazione modelli ai diversi step della pipeline (Multi-Agent) */
export interface MultiAgentConfig {
  /** Modello per la traduzione iniziale */
  translate?: AgentModelConfig;
  /** Modello per l'auto-fix delle stringhe con errori QA */
  autoFix?: AgentModelConfig;
  /** Modello per la review finale ("seconda opinione") */
  review?: AgentModelConfig;
}

export interface PipelineOptions {
  /** Testi sorgente */
  texts: string[];
  sourceLanguage: string;
  targetLanguage: string;
  /** ID del gioco per glossario e TM */
  gameId?: string;
  gameName?: string;
  gameGenre?: string;
  /** Input per Context Harvester (key, filename, ecc.) */
  harvestInputs?: HarvestInput[];
  /** Step da abilitare/disabilitare */
  enableHarvest?: boolean;   // default: true
  enableAutoFix?: boolean;   // default: true
  enableReview?: boolean;    // default: true
  /** Soglia QA minima — sotto questa si attiva l'auto-fix */
  qaThreshold?: number;      // default: 70
  /** Max tentativi auto-fix */
  maxFixAttempts?: number;   // default: 2
  /** Provider specifico per review (opzionale, usa translateSmart altrimenti) */
  reviewProvider?: string;
  /** 🤖 Multi-Agent: assegna modelli diversi ai diversi step */
  agents?: MultiAgentConfig;
  /** Contesto aggiuntivo manuale */
  context?: string;
  /** Callback per progress */
  onStepChange?: (step: PipelineStep, allSteps: PipelineStep[]) => void;
}

export interface PipelineResult {
  /** Traduzioni finali */
  translations: string[];
  /** Provider usato per la traduzione iniziale */
  provider: string;
  /** Step eseguiti con dettagli */
  steps: PipelineStep[];
  /** QA report per ogni stringa */
  qaReports: (QualityReport | null)[];
  /** Punteggio qualità medio finale */
  averageScore: number;
  /** Se tutte le stringhe hanno superato il QA */
  allPassed: boolean;
  /** Numero di stringhe auto-fixate */
  fixedCount: number;
  /** Tempo totale pipeline */
  totalDurationMs: number;
  /** Contesto harvested (se abilitato) */
  harvestedContext?: BatchHarvestResult;
  /** Statistiche */
  stats: {
    totalStrings: number;
    passedFirstTime: number;
    fixedByAutoFix: number;
    improvedByReview: number;
    failedQA: number;
  };
}

// ============================================================================
// PIPELINE ENGINE
// ============================================================================

/**
 * 🤖 Traduce usando un agente specifico (modello Ollama diretto) oppure il provider chain di default.
 * Se `agent` è configurato e `forceOllama` è true (default), chiama Ollama direttamente col modello specificato.
 * Altrimenti usa `translateSmart` (provider chain).
 */
async function translateWithAgent(
  opts: TranslateOptions,
  agent?: AgentModelConfig
): Promise<TranslateResult> {
  if (!agent || !agent.model) {
    return translateSmart(opts);
  }

  const ollamaUrl = 'http://localhost:11434';
  const model = agent.model;
  const srcLang = opts.sourceLanguage || 'en';
  const tgtLang = opts.targetLanguage || 'it';

  clientLogger.debug(`[Multi-Agent] Using agent model: ${model} (${agent.label || 'custom'})`);

  try {
    // Verifica che il modello sia disponibile
    const tagsRes = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!tagsRes.ok) throw new Error('Ollama non raggiungibile');
    const tagsData = await tagsRes.json();
    const available = (tagsData.models || []).map((m: { name: string }) => m.name) as string[];
    
    if (!available.some(m => m.startsWith(model) || m === model)) {
      clientLogger.warn(`[Multi-Agent] Model ${model} not found in Ollama, falling back to translateSmart`);
      return translateSmart(opts);
    }

    const systemPrompt = `You are an expert video game localizer. Translate from ${srcLang} to ${tgtLang}.
Rules:
- Output ONLY the translation. No explanations, no notes, no markdown blocks.
- Maintain the original tone and context.
- Keep UI terms concise.
- PRESERVE ALL placeholders like {0}, %s, %d, {{name}} EXACTLY. Do not translate them.
${opts.glossaryHint ? `\nGlossary/Lore:\n${opts.glossaryHint}` : ''}
${opts.context ? `\nContext: ${opts.context}` : ''}`;

    const results: string[] = [];
    const BATCH_SIZE = 3;

    for (let i = 0; i < opts.texts.length; i += BATCH_SIZE) {
      const batch = opts.texts.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (text) => {
        if (!text.trim() || text.length <= 1) return text;
        try {
          const res = await fetch(`${ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
              ],
              stream: false,
              options: { temperature: 0.1, num_predict: Math.max(256, text.length * 3) },
            }),
            signal: AbortSignal.timeout(60000),
          });
          if (!res.ok) throw new Error(`Ollama ${res.status}`);
          const data = await res.json();
          let translated = data?.message?.content?.trim() || text;
          translated = translated.replace(/^(Translation|Traduzione|Output)\s*:\s*/i, '').replace(/^["']|["']$/g, '');
          return translated;
        } catch (err: unknown) {
          clientLogger.warn(`[Multi-Agent] ${model} error:`, err);
          return text;
        }
      });
      results.push(...await Promise.all(batchPromises));
    }

    return { translations: results, provider: `ollama:${model}`, success: true };
  } catch (err: unknown) {
    clientLogger.warn(`[Multi-Agent] Agent ${model} failed, falling back to translateSmart:`, err);
    return translateSmart(opts);
  }
}

/** Salva config multi-agent in localStorage */
export function saveMultiAgentConfig(config: MultiAgentConfig): void {
  try {
    localStorage.setItem('gs_pipeline_agents', JSON.stringify(config));
  } catch {}
}

/** Carica config multi-agent da localStorage */
export function loadMultiAgentConfig(): MultiAgentConfig {
  try {
    const saved = localStorage.getItem('gs_pipeline_agents');
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

// ============================================================================
// MULTI-AGENT PRESETS
// ============================================================================

export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: MultiAgentConfig;
}

/**
 * Preset predefiniti per il Multi-Agent.
 * I modelli usano nomi generici — verranno matchati con i modelli installati.
 */
export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Usa il provider chain standard per tutti gli step',
    icon: '⚙️',
    config: {},
  },
  {
    id: 'speed',
    name: 'Speed',
    description: 'Modelli piccoli e veloci per ogni step — traduzione rapida',
    icon: '⚡',
    config: {
      translate: { model: 'gemma3:4b', label: 'Gemma3 4B' },
      autoFix: { model: 'phi4-mini', label: 'Phi-4 Mini' },
      review: { model: 'qwen3:4b', label: 'Qwen3 4B' },
    },
  },
  {
    id: 'quality',
    name: 'Max Quality',
    description: 'Modelli grandi e precisi — qualità massima, più lento',
    icon: '🏆',
    config: {
      translate: { model: 'qwen3.5:35b-a3b', label: 'Qwen3.5 35B' },
      autoFix: { model: 'gemma3:12b', label: 'Gemma3 12B' },
      review: { model: 'deepseek-r1:14b', label: 'DeepSeek R1 14B' },
    },
  },
  {
    id: 'diversified',
    name: 'Diversified',
    description: 'Modelli diversi per ogni step — "seconda opinione" garantita',
    icon: '🎯',
    config: {
      translate: { model: 'huihui_ai/hy-mt1.5-abliterated:7b', label: 'HY-MT 7B' },
      autoFix: { model: 'phi4-mini', label: 'Phi-4 Mini' },
      review: { model: 'gemma3:4b', label: 'Gemma3 4B' },
    },
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    description: 'Top open-weight 2026 — eccellente per traduzioni tecniche e precise',
    icon: '🧠',
    config: {
      translate: { model: 'deepseek-v3', label: 'DeepSeek V3' },
      autoFix: { model: 'deepseek-v3', label: 'DeepSeek V3' },
      review: { model: 'deepseek-r1:14b', label: 'DeepSeek R1 14B' },
    },
  },
  {
    id: 'llama4-scout',
    name: 'Llama 4 Scout',
    description: 'Contesto lungo — ideale per dialoghi, visual novel, file enormi',
    icon: '🦙',
    config: {
      translate: { model: 'llama4-scout', label: 'Llama 4 Scout' },
      autoFix: { model: 'llama3.3:70b', label: 'LLaMA 3.3 70B' },
      review: { model: 'llama4-scout', label: 'Llama 4 Scout' },
    },
  },
  {
    id: 'best-2026',
    name: '2026 Best',
    description: 'Strategia ibrida — modelli top 2026 per ogni ruolo',
    icon: '🚀',
    config: {
      translate: { model: 'deepseek-v3', label: 'DeepSeek V3' },
      autoFix: { model: 'qwen3:14b', label: 'Qwen3 14B' },
      review: { model: 'llama4-scout', label: 'Llama 4 Scout' },
    },
  },
  {
    id: 'gaming-pro',
    name: 'Gaming Pro',
    description: 'Ottimizzato per giochi — traduzione specializzata + review con reasoning',
    icon: '🎮',
    config: {
      translate: { model: 'huihui_ai/hy-mt1.5-abliterated:7b', label: 'HY-MT 7B' },
      autoFix: { model: 'deepseek-v3', label: 'DeepSeek V3' },
      review: { model: 'deepseek-r1:14b', label: 'DeepSeek R1 14B' },
    },
  },
];

/** Risolve un preset: sostituisce i modelli con quelli effettivamente installati */
export function resolvePreset(preset: AgentPreset, installedModels: string[]): MultiAgentConfig {
  const resolve = (agent?: AgentModelConfig): AgentModelConfig | undefined => {
    if (!agent) return undefined;
    const found = installedModels.find(m => m.startsWith(agent.model) || m === agent.model);
    if (found) return { ...agent, model: found };
    // Fallback: cerca un modello simile (stesso prefisso)
    const prefix = agent.model.split(':')[0].split('/').pop() || '';
    const similar = installedModels.find(m => m.includes(prefix));
    if (similar) return { ...agent, model: similar, label: `${agent.label} → ${similar}` };
    return undefined; // Modello non disponibile
  };

  return {
    translate: resolve(preset.config.translate),
    autoFix: resolve(preset.config.autoFix),
    review: resolve(preset.config.review),
  };
}

// ============================================================================
// BENCHMARK
// ============================================================================

export interface BenchmarkEntry {
  timestamp: number;
  presetId: string;
  presetName: string;
  agents: MultiAgentConfig;
  sourceLanguage: string;
  targetLanguage: string;
  totalStrings: number;
  averageScore: number;
  passedFirstTime: number;
  fixedByAutoFix: number;
  improvedByReview: number;
  totalDurationMs: number;
  msPerString: number;
}

/** Salva un risultato benchmark */
export function saveBenchmarkEntry(entry: BenchmarkEntry): void {
  try {
    const saved = localStorage.getItem('gs_pipeline_benchmarks');
    const entries: BenchmarkEntry[] = saved ? JSON.parse(saved) : [];
    entries.push(entry);
    // Mantieni max 50 entries
    if (entries.length > 50) entries.splice(0, entries.length - 50);
    localStorage.setItem('gs_pipeline_benchmarks', JSON.stringify(entries));
  } catch {}
}

/** Carica lo storico benchmark */
export function loadBenchmarkHistory(): BenchmarkEntry[] {
  try {
    const saved = localStorage.getItem('gs_pipeline_benchmarks');
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

/** Costruisci un BenchmarkEntry dal risultato di una pipeline */
export function buildBenchmarkEntry(
  result: PipelineResult,
  agents: MultiAgentConfig,
  presetId: string,
  presetName: string,
  sourceLanguage: string,
  targetLanguage: string,
): BenchmarkEntry {
  return {
    timestamp: Date.now(),
    presetId,
    presetName,
    agents,
    sourceLanguage,
    targetLanguage,
    totalStrings: result.stats.totalStrings,
    averageScore: result.averageScore,
    passedFirstTime: result.stats.passedFirstTime,
    fixedByAutoFix: result.stats.fixedByAutoFix,
    improvedByReview: result.stats.improvedByReview,
    totalDurationMs: result.totalDurationMs,
    msPerString: result.stats.totalStrings > 0
      ? Math.round(result.totalDurationMs / result.stats.totalStrings)
      : 0,
  };
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const {
    texts,
    sourceLanguage,
    targetLanguage,
    gameId,
    gameName,
    gameGenre,
    harvestInputs,
    enableHarvest = true,
    enableAutoFix = true,
    enableReview = true,
    qaThreshold = 70,
    maxFixAttempts = 2,
    agents,
    context,
    onStepChange,
  } = options;

  const pipelineStart = Date.now();
  const agentConfig = agents || loadMultiAgentConfig();

  // Inizializza step (con nome agente se configurato)
  const agentLabel = (a?: AgentModelConfig) => a?.model ? ` [${a.label || a.model}]` : '';
  const steps: PipelineStep[] = [
    { id: 'harvest', name: 'Context Harvester', status: enableHarvest ? 'pending' : 'skipped' },
    { id: 'translate', name: `Traduzione AI${agentLabel(agentConfig.translate)}`, status: 'pending' },
    { id: 'qa_check', name: 'QA Automatico', status: 'pending' },
    { id: 'auto_fix', name: `Auto-Correzione${agentLabel(agentConfig.autoFix)}`, status: enableAutoFix ? 'pending' : 'skipped' },
    { id: 'review', name: `Review Finale${agentLabel(agentConfig.review)}`, status: enableReview ? 'pending' : 'skipped' },
    { id: 'score', name: 'Scoring Finale', status: 'pending' },
  ];

  let translations: string[] = [];
  let provider = 'unknown';
  let harvestedContext: BatchHarvestResult | undefined;
  let qaReports: (QualityReport | null)[] = [];
  let fixedCount = 0;
  let passedFirstTime = 0;
  let improvedByReview = 0;

  const updateStep = (id: PipelineStepId, update: Partial<PipelineStep>) => {
    const step = steps.find(s => s.id === id);
    if (step) {
      Object.assign(step, update);
      if (update.status === 'running') step.startedAt = Date.now();
      if (update.status === 'completed' || update.status === 'failed') {
        step.completedAt = Date.now();
        step.durationMs = step.startedAt ? step.completedAt - step.startedAt : 0;
      }
      onStepChange?.(step, steps);
    }
  };

  // ──────────────────────────────────────────────
  // STEP 1: Context Harvester
  // ──────────────────────────────────────────────
  if (enableHarvest) {
    updateStep('harvest', { status: 'running' });
    try {
      const inputs: HarvestInput[] = harvestInputs || texts.map(t => ({
        text: t,
        gameGenre,
        gameName,
      }));
      harvestedContext = harvestBatch(inputs);
      updateStep('harvest', {
        status: 'completed',
        result: {
          screens: Object.keys(harvestedContext.stats.screens).length,
          speakers: Object.keys(harvestedContext.stats.speakers).length,
          placeholders: harvestedContext.stats.stringsWithPlaceholders,
        }
      });
    } catch (e: unknown) {
      updateStep('harvest', { status: 'failed', error: String(e) });
      // Non blocca la pipeline
    }
  }

  // ──────────────────────────────────────────────
  // STEP 2: Traduzione iniziale
  // ──────────────────────────────────────────────
  updateStep('translate', { status: 'running' });
  try {
    const glossaryHint = gameId ? buildRelevantGlossaryHint(gameId, texts) : '';
    
    const translateOpts: TranslateOptions = {
      texts,
      sourceLanguage,
      targetLanguage,
      context,
      glossaryHint: glossaryHint || undefined,
      gameId,
      harvestedContext,
    };

    const result: TranslateResult = await translateWithAgent(translateOpts, agentConfig.translate);
    
    if (!result.success || result.translations.length === 0) {
      throw new Error('Translation failed: all providers returned empty results');
    }
    
    translations = result.translations;
    provider = result.provider;
    
    updateStep('translate', {
      status: 'completed',
      result: { provider, count: translations.length }
    });
  } catch (e: unknown) {
    updateStep('translate', { status: 'failed', error: String(e) });
    // Pipeline fallisce se la traduzione fallisce
    return buildResult(texts, translations, provider, steps, qaReports, harvestedContext, fixedCount, passedFirstTime, improvedByReview, pipelineStart);
  }

  // ──────────────────────────────────────────────
  // STEP 3: QA deterministico
  // ──────────────────────────────────────────────
  updateStep('qa_check', { status: 'running' });
  try {
    qaReports = [];
    const failedIndices: number[] = [];

    for (let i = 0; i < texts.length; i++) {
      const translated = translations[i] || '';
      if (!translated) {
        qaReports.push(null);
        continue;
      }

      const report = runQualityGates({
        sourceText: texts[i],
        translatedText: translated,
        sourceLanguage,
        targetLanguage,
        minQualityScore: qaThreshold,
      });
      qaReports.push(report);

      if (report.passed) {
        passedFirstTime++;
      } else {
        failedIndices.push(i);
      }
    }

    updateStep('qa_check', {
      status: 'completed',
      result: {
        passed: passedFirstTime,
        failed: failedIndices.length,
        total: texts.length,
      }
    });

    // ──────────────────────────────────────────────
    // STEP 4: Auto-fix (solo per stringhe che hanno fallito il QA)
    // ──────────────────────────────────────────────
    if (enableAutoFix && failedIndices.length > 0) {
      updateStep('auto_fix', { status: 'running' });
      try {
        let totalFixed = 0;

        for (let attempt = 0; attempt < maxFixAttempts && failedIndices.length > 0; attempt++) {
          // Costruisci prompt di fix specifico per gli errori trovati
          const textsToFix: string[] = [];
          const fixInstructions: string[] = [];
          const fixIndices: number[] = [];

          for (const idx of failedIndices) {
            const report = qaReports[idx];
            if (!report) continue;

            const errors = report.checks
              .filter(c => !c.passed)
              .map(c => c.message)
              .filter(Boolean);

            if (errors.length > 0) {
              textsToFix.push(texts[idx]);
              fixInstructions.push(
                `String ${idx + 1}: "${translations[idx]}"\nIssues: ${errors.join('; ')}`
              );
              fixIndices.push(idx);
            }
          }

          if (textsToFix.length === 0) break;

          // Prompt di fix focalizzato
          const fixContext = `Fix the following translation issues. Return ONLY a JSON array of corrected translations, same order.

Source language: ${sourceLanguage}
Target language: ${targetLanguage}

ERRORS TO FIX:
${fixInstructions.join('\n\n')}

Original texts:
${textsToFix.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Current (broken) translations:
${fixIndices.map((idx, i) => `${i + 1}. ${translations[idx]}`).join('\n')}

Return ONLY the corrected translations as a JSON array.`;

          try {
            const fixResult = await translateWithAgent({
              texts: textsToFix,
              sourceLanguage,
              targetLanguage,
              context: fixContext,
            }, agentConfig.autoFix);

            if (fixResult.success && fixResult.translations.length > 0) {
              // Applica fix
              for (let i = 0; i < fixIndices.length && i < fixResult.translations.length; i++) {
                const idx = fixIndices[i];
                const newTranslation = fixResult.translations[i];
                if (newTranslation && newTranslation.trim()) {
                  translations[idx] = newTranslation;

                  // Re-run QA per verificare il fix
                  const newReport = runQualityGates({
                    sourceText: texts[idx],
                    translatedText: newTranslation,
                    sourceLanguage,
                    targetLanguage,
                    minQualityScore: qaThreshold,
                  });
                  qaReports[idx] = newReport;

                  if (newReport.passed) {
                    totalFixed++;
                    // Rimuovi dall'elenco dei falliti
                    const failIdx = failedIndices.indexOf(idx);
                    if (failIdx !== -1) failedIndices.splice(failIdx, 1);
                  }
                }
              }
            }
          } catch {
            // Un tentativo di fix fallito non blocca la pipeline
            clientLogger.warn(`[Pipeline] Auto-fix attempt ${attempt + 1} failed`);
          }
        }

        fixedCount = totalFixed;
        updateStep('auto_fix', {
          status: 'completed',
          result: { fixed: totalFixed, remaining: failedIndices.length }
        });
      } catch (e: unknown) {
        updateStep('auto_fix', { status: 'failed', error: String(e) });
      }
    }
  } catch (e: unknown) {
    updateStep('qa_check', { status: 'failed', error: String(e) });
  }

  // ──────────────────────────────────────────────
  // STEP 5: Review finale AI (fluenza, tono, allucinazioni)
  // ──────────────────────────────────────────────
  if (enableReview && translations.length > 0) {
    updateStep('review', { status: 'running' });
    try {
      // Review solo le stringhe lunghe/complesse (>30 chars) per efficienza
      const reviewIndices: number[] = [];
      for (let i = 0; i < translations.length; i++) {
        if (texts[i].length > 30 && translations[i]) {
          reviewIndices.push(i);
        }
      }

      if (reviewIndices.length > 0) {
        // Prompt di review focalizzato — NON traduce, solo valuta e suggerisce micro-fix
        const reviewTexts = reviewIndices.map(i => texts[i]);
        const reviewTranslations = reviewIndices.map(i => translations[i]);

        const reviewPrompt = `You are a game localization proofreader. Review these translations from ${sourceLanguage} to ${targetLanguage}.
For each translation, if it sounds natural and accurate, keep it exactly as-is.
If you find a small issue (awkward phrasing, hallucination, wrong tone), fix ONLY that issue.

Return ONLY a JSON array of the final translations (same order, same count).

${reviewTexts.map((src, i) => `${i + 1}. SOURCE: "${src}"\n   TRANSLATION: "${reviewTranslations[i]}"`).join('\n')}`;

        try {
          const reviewResult = await translateWithAgent({
            texts: reviewTexts,
            sourceLanguage,
            targetLanguage,
            context: reviewPrompt,
          }, agentConfig.review);

          if (reviewResult.success && reviewResult.translations.length > 0) {
            for (let i = 0; i < reviewIndices.length && i < reviewResult.translations.length; i++) {
              const idx = reviewIndices[i];
              const reviewed = reviewResult.translations[i];
              if (reviewed && reviewed.trim() && reviewed !== translations[idx]) {
                // Verifica che il review non abbia peggiorato le cose
                const oldReport = qaReports[idx];
                const newReport = runQualityGates({
                  sourceText: texts[idx],
                  translatedText: reviewed,
                  sourceLanguage,
                  targetLanguage,
                  minQualityScore: qaThreshold,
                });

                const oldScore = oldReport?.overallScore ?? 0;
                const newScore = newReport.overallScore;

                if (newScore >= oldScore) {
                  translations[idx] = reviewed;
                  qaReports[idx] = newReport;
                  if (newScore > oldScore) improvedByReview++;
                }
              }
            }
          }
        } catch {
          clientLogger.warn('[Pipeline] Review step failed, keeping current translations');
        }
      }

      updateStep('review', {
        status: 'completed',
        result: { reviewed: reviewIndices.length, improved: improvedByReview }
      });
    } catch (e: unknown) {
      updateStep('review', { status: 'failed', error: String(e) });
    }
  }

  // ──────────────────────────────────────────────
  // STEP 6: Scoring finale
  // ──────────────────────────────────────────────
  updateStep('score', { status: 'running' });

  // Re-run QA finale su tutto
  for (let i = 0; i < translations.length; i++) {
    if (translations[i]) {
      qaReports[i] = runQualityGates({
        sourceText: texts[i],
        translatedText: translations[i],
        sourceLanguage,
        targetLanguage,
        minQualityScore: qaThreshold,
      });
    }
  }

  updateStep('score', { status: 'completed' });

  return buildResult(texts, translations, provider, steps, qaReports, harvestedContext, fixedCount, passedFirstTime, improvedByReview, pipelineStart);
}

// ============================================================================
// HELPERS
// ============================================================================

function buildResult(
  texts: string[],
  translations: string[],
  provider: string,
  steps: PipelineStep[],
  qaReports: (QualityReport | null)[],
  harvestedContext: BatchHarvestResult | undefined,
  fixedCount: number,
  passedFirstTime: number,
  improvedByReview: number,
  pipelineStart: number,
): PipelineResult {
  const validReports = qaReports.filter(Boolean) as QualityReport[];
  const averageScore = validReports.length > 0
    ? Math.round(validReports.reduce((sum, r) => sum + r.overallScore, 0) / validReports.length)
    : 0;
  const allPassed = validReports.every(r => r.passed);
  const failedQA = validReports.filter(r => !r.passed).length;

  return {
    translations,
    provider,
    steps,
    qaReports,
    averageScore,
    allPassed,
    fixedCount,
    totalDurationMs: Date.now() - pipelineStart,
    harvestedContext,
    stats: {
      totalStrings: texts.length,
      passedFirstTime,
      fixedByAutoFix: fixedCount,
      improvedByReview,
      failedQA,
    },
  };
}

// ============================================================================
// QUICK PIPELINE (lightweight — solo translate + QA, no fix/review)
// ============================================================================

export async function runQuickPipeline(
  texts: string[],
  sourceLanguage: string,
  targetLanguage: string,
  gameId?: string,
): Promise<PipelineResult> {
  return runPipeline({
    texts,
    sourceLanguage,
    targetLanguage,
    gameId,
    enableAutoFix: false,
    enableReview: false,
  });
}

// ============================================================================
// MAX QUALITY PIPELINE (tutti gli step abilitati)
// ============================================================================

export async function runMaxQualityPipeline(
  texts: string[],
  sourceLanguage: string,
  targetLanguage: string,
  options?: Partial<PipelineOptions>,
): Promise<PipelineResult> {
  return runPipeline({
    texts,
    sourceLanguage,
    targetLanguage,
    enableHarvest: true,
    enableAutoFix: true,
    enableReview: true,
    qaThreshold: 75,
    maxFixAttempts: 3,
    ...options,
  });
}
