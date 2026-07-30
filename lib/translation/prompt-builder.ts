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
import { harvestBatch, batchContextToPromptHint, type HarvestInput } from '../context-harvester';
import { buildFewShotBlock } from '@/lib/ai/adaptive-mt';
import { buildGenrePromptBlock } from '@/lib/ai/genre-prompts';
import { buildFidelityPromptBlock } from '@/lib/ai/fidelity-prompt';
import { findVoiceProfileForString, buildVoicePromptInjection } from '@/lib/voice/voice-profiles';
import { clientLogger } from '@/lib/client-logger';
// Import the interface type to avoid circular dependency
// TranslateOptions is defined in ai-translate-direct.ts which imports from this file
import type { TranslateOptions } from '../ai/ai-translate-direct';

/**
 * Rimuove righe-contenuto duplicate esatte da un blocco testuale, preservando
 * ordine e prima occorrenza. Pensato per il glossario manuale (`glossaryHint`),
 * che spesso ripete la stessa voce "term -> translation" per molte stringhe del
 * batch: comprime senza alterare alcun termine (lossless, reversibile).
 */
export function dedupeGlossaryHint(hint: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of hint.split('\n')) {
    const key = line.trim();
    if (key === '') {
      // collassa righe vuote consecutive (mantiene un solo separatore)
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** Formatta indici 1-based ordinati in range compatti: [1,2,3,5,6] -> "1-3, 5-6". */
export function formatIndexRanges(indices: number[]): string {
  const s = [...new Set(indices)].sort((a, b) => a - b);
  if (s.length === 0) return '';
  const parts: string[] = [];
  let start = s[0];
  let prev = s[0];
  for (let i = 1; i < s.length; i++) {
    if (s[i] === prev + 1) {
      prev = s[i];
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = s[i];
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(', ');
}

/**
 * Accorpa gli hint per-stringa identici in un'unica riga con gli indici delle
 * stringhe a cui si applicano (es. "1-30: Menu screen, UI button"), invece di
 * ripetere lo stesso hint per ogni stringa. Preserva tutti gli hint distinti.
 */
export function clusterPerStringHints(pairs: { index: number; hint: string }[]): string[] {
  const byHint = new Map<string, number[]>();
  for (const { index, hint } of pairs) {
    const arr = byHint.get(hint);
    if (arr) arr.push(index);
    else byHint.set(hint, [index]);
  }
  const lines: string[] = [];
  for (const [hint, idxs] of byHint) {
    lines.push(`${formatIndexRanges(idxs)}: ${hint}`);
  }
  return lines;
}

/** Costruisce il prompt di traduzione con RAG/glossario opzionale + Custom Prompt System */
export function buildTranslationPrompt(opts: TranslateOptions): string {
  const srcLang = opts.sourceLanguage || 'en';

  // Genre-aware prompt: inietta istruzioni di stile specifiche per genere
  const genreBlock = opts.gameGenre ? buildGenrePromptBlock(opts.gameGenre, opts.targetLanguage) : '';
  
  // Custom Prompt System: persona e tono specifici
  let customInstructions = '';
  if (opts.persona) {
    customInstructions += `\nPersona: Translate as if you are ${opts.persona}.`;
  }
  if (opts.tone) {
    customInstructions += `\nTone: Use a ${opts.tone} tone and style.`;
  }
  if (opts.customPrompt) {
    customInstructions += `\n${opts.customPrompt}`;
  }
  
  let prompt = genreBlock
    ? `${genreBlock}${customInstructions}\n\nTranslate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.`
    : `Translate the following texts from ${srcLang} to ${opts.targetLanguage}${customInstructions ? ' following these instructions:' + customInstructions : ''}. Return ONLY a JSON array of translated strings, same order.`;

  // Anti-censura (OPT-IN): fedeltà su contenuti maturi già presenti nella sorgente.
  // Iniettato solo se opts.uncensored === true; nessun effetto sui provider MT puri.
  const fidelityBlock = buildFidelityPromptBlock(opts.uncensored);
  if (fidelityBlock) {
    prompt += `\n\n${fidelityBlock}`;
  }

  // RAG Dinamico: Estrae i termini dal glossario e li inietta nel prompt SOLO se rilevanti per questo blocco di testo
  if (opts.gameId) {
    try {
      const rag = new RagGlossary();
      rag.loadFromStorage(opts.gameId);
      const ragPrompt = rag.getRelevantContext(opts.texts);
      if (ragPrompt) {
        prompt += `\n${ragPrompt}`;
      }
    } catch (e: unknown) {
      clientLogger.warn('[RAG] Fallimento estrazione dinamica glossario', e);
    }
  }

  // RAG Translation Memory: traduzioni simili come riferimento stile/terminologia
  if (opts.tmContext) {
    prompt += `\n${opts.tmContext}`;
  }

  // Glossario/Hint manuale passato da fuori (deduplicato: voci ripetute collassate)
  if (opts.glossaryHint) {
    prompt += `\n\n${dedupeGlossaryHint(opts.glossaryHint)}`;
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
    } catch (e: unknown) {
      clientLogger.warn('[ContextHarvester] Auto-harvest fallito:', e);
    }
  }
  if (harvestResult) {
    const contextHint = batchContextToPromptHint(harvestResult);
    if (contextHint) {
      prompt += `\n\n${contextHint}`;
    }
    // Aggiungi hint per-stringa dove significativo, accorpando gli hint identici
    // su più stringhe in un'unica riga con range di indici (riduce i duplicati).
    const hintPairs: { index: number; hint: string }[] = [];
    for (let i = 0; i < Math.min(harvestResult.contexts.length, opts.texts.length); i++) {
      const ctx = harvestResult.contexts[i];
      if (ctx.promptHint && ctx.screenConfidence >= 0.3) {
        hintPairs.push({ index: i + 1, hint: ctx.promptHint });
      }
    }
    if (hintPairs.length > 0) {
      const clustered = clusterPerStringHints(hintPairs);
      prompt += `\n\n[PER-STRING CONTEXT]\n${clustered.join('\n')}`;
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
  } catch (e: unknown) {
    clientLogger.warn('[AdaptiveMT] Few-shot injection failed:', e);
  }

  // Voice Profiles: inietta istruzioni di voce per personaggi identificati
  if (opts.gameId && opts.texts.length > 0) {
    try {
      const voiceHints: string[] = [];
      const seenProfiles = new Set<string>();
      for (const text of opts.texts) {
        const profile = findVoiceProfileForString(opts.gameId, text);
        if (profile && !seenProfiles.has(profile.id)) {
          seenProfiles.add(profile.id);
          const injection = buildVoicePromptInjection(profile, opts.targetLanguage);
          voiceHints.push(`[CHARACTER: ${profile.characterName}] ${injection.customPrompt}`);
        }
      }
      if (voiceHints.length > 0) {
        prompt += `\n\n[CHARACTER VOICE PROFILES]\n${voiceHints.join('\n\n')}`;
      }
    } catch (e: unknown) {
      clientLogger.warn('[VoiceProfiles] Injection failed:', e);
    }
  }

  prompt += `\n\n${opts.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

  return prompt;
}

