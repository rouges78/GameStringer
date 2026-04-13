/**
 * Chain preset system for translation provider chains.
 * Defines cost/quality presets (free, economy, balanced, quality, max_quality, auto)
 * and the auto-select logic for building optimal provider chains.
 */

import { clientLogger } from '@/lib/client-logger';
import {
  LANG_PROVIDER_AFFINITY,
  GENRE_PROVIDER_BOOST,
  normalizeLangCode,
} from './language-mappings';
import { resetProviderBlocks } from './provider-blocking';
import type { GameGenre } from '../genre-prompts';

/** Preset di chain selezionabili per costo/qualita */
export type ChainPreset = 'free' | 'economy' | 'balanced' | 'quality' | 'max_quality' | 'auto';

export interface ChainPresetInfo {
  id: ChainPreset;
  name: string;
  description: string;
  cost: string;
  quality: string;
  speed: string;
  providers: string[];
}

export const CHAIN_PRESETS: ChainPresetInfo[] = [
  {
    id: 'free',
    name: '🆓 Gratis',
    description: 'Solo provider gratuiti — HY-MT + TranslateGemma locali, Groq, Cerebras, OpenRouter free',
    cost: '$0',
    quality: '⭐⭐⭐⭐',
    speed: '🏎 Media',
    providers: ['hymt', 'translategemma', 'ollama', 'lmstudio', 'groq-gptoss', 'groq', 'cerebras', 'openrouter', 'nllb', 'mymemory', 'lingva'],
  },
  {
    id: 'economy',
    name: '💰 Economica',
    description: 'HY-MT/TranslateGemma locali + Gemini free + DeepSeek economico + fallback',
    cost: '~$0.10',
    quality: '⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['hymt', 'translategemma', 'gemini', 'groq', 'cerebras', 'deepseek', 'mistral', 'openrouter', 'nllb', 'mymemory', 'lingva'],
  },
  {
    id: 'balanced',
    name: '⚖️ Bilanciata',
    description: 'Miglior rapporto qualità/prezzo — HY-MT locale + tutti i provider cloud',
    cost: '~$0.25',
    quality: '⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['hymt', 'translategemma', 'gemini', 'deepseek', 'deepl', 'modelwiz', 'qwen', 'mistral', 'groq-gptoss', 'groq', 'cerebras', 'together', 'fireworks', 'cohere', 'openrouter', 'openai', 'nllb', 'mymemory', 'lingva'],
  },
  {
    id: 'quality',
    name: '✨ Qualità',
    description: 'AI premium — Anthropic, OpenAI, Mistral come priorità',
    cost: '~$0.50',
    quality: '⭐⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['deepl', 'modelwiz', 'anthropic', 'openai', 'qwen', 'mistral', 'gemini', 'cohere', 'together', 'deepseek', 'fireworks', 'mymemory'],
  },
  {
    id: 'max_quality',
    name: '👑 Massima Qualità',
    description: 'Tutti i 16 provider — mai senza traduzione',
    cost: '~$1.00+',
    quality: '⭐⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['deepl', 'modelwiz', 'anthropic', 'openai', 'qwen', 'translategemma', 'ollama', 'lmstudio', 'mistral', 'gemini', 'cohere', 'together', 'deepseek', 'fireworks', 'groq-gptoss', 'groq', 'cerebras', 'openrouter', 'hymt', 'nllb', 'mymemory', 'lingva'],
  },
  {
    id: 'auto',
    name: '🧠 Auto-Select',
    description: 'Seleziona automaticamente i migliori provider per lingua target e genere gioco',
    cost: 'Variabile',
    quality: '⭐⭐⭐⭐⭐',
    speed: '🚀 Adattiva',
    providers: [], // Calcolato dinamicamente da getAutoProviderChain()
  },
];

// Chain preset attivo (default: balanced)
let activeChainPreset: ChainPreset = 'balanced';

export function setChainPreset(preset: ChainPreset) {
  activeChainPreset = preset;
  // Reset blocks quando si cambia chain
  resetProviderBlocks();
  clientLogger.debug(`[Chain] Preset impostato: ${preset}`);
}

export function getChainPreset(): ChainPreset {
  return activeChainPreset;
}

/** Internal getter for the active preset - used by the main module */
export function getActiveChainPreset(): ChainPreset {
  return activeChainPreset;
}

/**
 * Costruisce la chain di provider ottimale per lingua e genere.
 * Prende tutti i provider disponibili (con API key) e li riordina
 * in base all'affinita lingua + boost genere + fallback gratuiti.
 *
 * NOTE: This function requires PROVIDER_MAP which lives in ai-translate-direct.ts.
 * It accepts it as a parameter to avoid circular dependencies.
 */
export function getAutoProviderChain(
  targetLanguage: string,
  gameGenre?: GameGenre,
  providerMap?: Record<string, { getKey: (keys: Record<string, string>) => string; isBlocked: () => boolean; needsKey: boolean }>,
  keys?: Record<string, string>,
): string[] {
  const lang = normalizeLangCode(targetLanguage);

  // 1) Ottieni ranking base per lingua (o fallback generico balanced)
  const langRanking = LANG_PROVIDER_AFFINITY[lang] ||
    ['deepl', 'anthropic', 'openai', 'modelwiz', 'gemini', 'deepseek', 'mistral', 'qwen'];

  // 2) Applica boost genere: i provider nel boost salgono di 2 posizioni
  const ranked = [...langRanking];
  if (gameGenre) {
    const genreKey = typeof gameGenre === 'string' ? gameGenre.toLowerCase().replace(/\s+/g, '_') : '';
    const boostProviders = GENRE_PROVIDER_BOOST[genreKey] || [];
    for (const bp of boostProviders) {
      const idx = ranked.indexOf(bp);
      if (idx > 0) {
        // Sposta in su di 2 posizioni (ma non oltre la prima)
        const newIdx = Math.max(0, idx - 2);
        ranked.splice(idx, 1);
        ranked.splice(newIdx, 0, bp);
      }
    }
  }

  // 3) Filtra solo provider disponibili (API key presente o free)
  const available = providerMap && keys ? ranked.filter(name => {
    const info = providerMap[name];
    if (!info) return false;
    if (info.isBlocked()) return false;
    if (info.needsKey) {
      const key = info.getKey(keys);
      if (!key) return false;
    }
    return true;
  }) : [...ranked];

  // 4) Aggiungi provider locali e gratuiti come fallback
  const fallbacks = ['hymt', 'translategemma', 'groq-gptoss', 'groq', 'cerebras', 'cohere',
                     'together', 'fireworks', 'openrouter', 'ollama', 'lmstudio', 'nllb', 'mymemory', 'lingva'];
  if (providerMap && keys) {
    for (const fb of fallbacks) {
      if (!available.includes(fb)) {
        const info = providerMap[fb];
        if (info && !info.isBlocked()) {
          if (!info.needsKey || info.getKey(keys)) {
            available.push(fb);
          }
        }
      }
    }
  }

  clientLogger.debug(`[Auto-Select] Lingua: ${lang}, Genere: ${gameGenre || 'n/a'} -> Chain: [${available.join(', ')}]`);
  return available;
}
