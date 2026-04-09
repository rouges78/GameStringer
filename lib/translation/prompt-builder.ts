/**
 * Translation prompt construction logic.
 * Builds the system prompt for LLM-based translation with:
 * - Genre-aware prompt blocks
 * - RAG glossary injection
 * - Translation Memory context
 * - Context Harvester auto-context
 * - Adaptive MT few-shot examples
 */

import { RagGlossary } from '../rag-glossary';
import { harvestBatch, batchContextToPromptHint, type BatchHarvestResult, type HarvestInput } from '../context-harvester';
import { buildFewShotBlock } from '../adaptive-mt';
import { buildGenrePromptBlock } from '../genre-prompts';
import { clientLogger } from '@/lib/client-logger';
// Import the interface type to avoid circular dependency
// TranslateOptions is defined in ai-translate-direct.ts which imports from this file
import type { TranslateOptions } from '../ai-translate-direct';

/** Costruisce il prompt di traduzione con RAG/glossario opzionale */
export function buildTranslationPrompt(opts: TranslateOptions): string {
  const srcLang = opts.sourceLanguage || 'en';

  // Genre-aware prompt: inietta istruzioni di stile specifiche per genere
  const genreBlock = opts.gameGenre ? buildGenrePromptBlock(opts.gameGenre, opts.targetLanguage) : '';
  let prompt = genreBlock
    ? `${genreBlock}\n\nTranslate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.`
    : `Translate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.`;

  // RAG Dinamico: Estrae i termini dal glossario e li inietta nel prompt SOLO se rilevanti per questo blocco di testo
  if (opts.gameId) {
    try {
      const rag = new RagGlossary();
      rag.loadFromStorage(opts.gameId);
      const ragPrompt = rag.getRelevantContext(opts.texts);
      if (ragPrompt) {
        prompt += `\n${ragPrompt}`;
      }
    } catch (e) {
      clientLogger.warn('[RAG] Fallimento estrazione dinamica glossario', e);
    }
  }

  // RAG Translation Memory: traduzioni simili come riferimento stile/terminologia
  if (opts.tmContext) {
    prompt += `\n${opts.tmContext}`;
  }

  // Glossario/Hint manuale passato da fuori
  if (opts.glossaryHint) {
    prompt += `\n\n${opts.glossaryHint}`;
  }

  if (opts.context) {
    prompt += ` Context: ${opts.context}`;
  }

  // Context Harvester: estrai contesto automatico dalle stringhe
  let harvestResult = opts.harvestedContext;
  if (!harvestResult && opts.texts.length > 0) {
    try {
      const inputs: HarvestInput[] = opts.harvestInputs || opts.texts.map(t => ({
        text: t,
        gameGenre: undefined,
        gameName: undefined,
      }));
      harvestResult = harvestBatch(inputs);
    } catch (e) {
      clientLogger.warn('[ContextHarvester] Auto-harvest fallito:', e);
    }
  }
  if (harvestResult) {
    const contextHint = batchContextToPromptHint(harvestResult);
    if (contextHint) {
      prompt += `\n\n${contextHint}`;
    }
    // Aggiungi hint per-stringa dove significativo
    const perStringHints: string[] = [];
    for (let i = 0; i < Math.min(harvestResult.contexts.length, opts.texts.length); i++) {
      const ctx = harvestResult.contexts[i];
      if (ctx.promptHint && ctx.screenConfidence >= 0.3) {
        perStringHints.push(`${i + 1}. ${ctx.promptHint}`);
      }
    }
    if (perStringHints.length > 0) {
      prompt += `\n\n[PER-STRING CONTEXT]\n${perStringHints.join('\n')}`;
    }
  }

  // Adaptive MT: inietta few-shot examples dalle correzioni umane
  try {
    const fewShot = buildFewShotBlock(
      opts.texts,
      opts.sourceLanguage || 'en',
      opts.targetLanguage,
      { gameId: opts.gameId }
    );
    if (fewShot.prompt && fewShot.exampleCount > 0) {
      prompt += `\n\n${fewShot.prompt}`;
    }
  } catch (e) {
    clientLogger.warn('[AdaptiveMT] Few-shot injection failed:', e);
  }

  prompt += `\n\n${opts.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

  return prompt;
}
