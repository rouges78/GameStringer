/**
 * 🔗 AI Translation Pipeline — Multi-Step Quality Enhancement
 * 
 * Pipeline ispirata a Crowdin AI Pipeline:
 * Ogni step è un prompt separato, evitando "prompt overloading" e allucinazioni.
 * 
 * Step 1: Traduzione iniziale (con Context Harvester + Glossario)
 * Step 2: QA automatico deterministico (placeholder, numeri, lunghezza, formato)
 * Step 3: Auto-fix AI (corregge solo gli errori trovati allo Step 2)
 * Step 4: Review finale AI (fluenza, tono, allucinazioni)
 * Step 5: Scoring finale e report
 * 
 * Ogni step usa un prompt focalizzato e breve → meno allucinazioni, più precisione.
 */

import { translateSmart, type TranslateOptions, type TranslateResult } from './ai-translate-direct';
import { runQualityGates, type QualityReport, type QualityCheck } from './quality-gates';
import { harvestBatch, type HarvestInput, type BatchHarvestResult } from './context-harvester';
import { buildRelevantGlossaryHint } from './auto-glossary';

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
  result?: any;
  error?: string;
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
    context,
    onStepChange,
  } = options;

  const pipelineStart = Date.now();

  // Inizializza step
  const steps: PipelineStep[] = [
    { id: 'harvest', name: 'Context Harvester', status: enableHarvest ? 'pending' : 'skipped' },
    { id: 'translate', name: 'Traduzione AI', status: 'pending' },
    { id: 'qa_check', name: 'QA Automatico', status: 'pending' },
    { id: 'auto_fix', name: 'Auto-Correzione', status: enableAutoFix ? 'pending' : 'skipped' },
    { id: 'review', name: 'Review Finale AI', status: enableReview ? 'pending' : 'skipped' },
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
    } catch (e) {
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

    const result: TranslateResult = await translateSmart(translateOpts);
    
    if (!result.success || result.translations.length === 0) {
      throw new Error('Translation failed: all providers returned empty results');
    }
    
    translations = result.translations;
    provider = result.provider;
    
    updateStep('translate', {
      status: 'completed',
      result: { provider, count: translations.length }
    });
  } catch (e) {
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
            const fixResult = await translateSmart({
              texts: textsToFix,
              sourceLanguage,
              targetLanguage,
              context: fixContext,
            });

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
            console.warn(`[Pipeline] Auto-fix attempt ${attempt + 1} failed`);
          }
        }

        fixedCount = totalFixed;
        updateStep('auto_fix', {
          status: 'completed',
          result: { fixed: totalFixed, remaining: failedIndices.length }
        });
      } catch (e) {
        updateStep('auto_fix', { status: 'failed', error: String(e) });
      }
    }
  } catch (e) {
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
          const reviewResult = await translateSmart({
            texts: reviewTexts,
            sourceLanguage,
            targetLanguage,
            context: reviewPrompt,
          });

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
          console.warn('[Pipeline] Review step failed, keeping current translations');
        }
      }

      updateStep('review', {
        status: 'completed',
        result: { reviewed: reviewIndices.length, improved: improvedByReview }
      });
    } catch (e) {
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
