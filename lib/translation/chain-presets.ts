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
import type { GameGenre } from '../ai/genre-prompts';

/** Preset di chain selezionabili per costo/qualita */
export type ChainPreset = 'free' | 'privacy' | 'economy' | 'balanced' | 'quality' | 'max_quality' | 'creative' | 'long_context' | 'voice' | 'auto';

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
    providers: ['hymt', 'translategemma', 'ollama', 'lmstudio', 'groq-gptoss', 'groq', 'cerebras', 'openrouter', 'nllb', 'mymemory', 'lingva', 'libretranslate'],
  },
  {
    id: 'privacy',
    name: '🔒 Privacy',
    description: 'LibreTranslate self-hosted, Ollama locale, NLLB — nessun dato lascia il tuo PC',
    cost: '$0',
    quality: '⭐⭐⭐',
    speed: '⚡ Locale',
    providers: ['libretranslate', 'ollama', 'lmstudio', 'hymt', 'translategemma', 'nllb'],
  },
  {
    id: 'economy',
    name: '💰 Economica',
    description: 'HY-MT/TranslateGemma locali + Gemini 3.1 Flash-Lite (low-cost long-context) + DeepSeek + fallback',
    cost: '~$0.10',
    quality: '⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['hymt', 'translategemma', 'gemini-3.1', 'gemini', 'groq', 'cerebras', 'deepseek', 'mistral', 'openrouter', 'nllb', 'mymemory', 'lingva'],
  },
  {
    id: 'balanced',
    name: '⚖️ Bilanciata',
    description: 'Miglior rapporto qualità/prezzo — HY-MT locale + tutti i provider cloud',
    cost: '~$0.25',
    quality: '⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['hymt', 'translategemma', 'gemini-3.1', 'gemini', 'deepseek', 'deepl', 'modelwiz', 'qwen', 'mistral', 'groq-gptoss', 'groq', 'cerebras', 'together', 'fireworks', 'cohere', 'openrouter', 'openai', 'nllb', 'mymemory', 'lingva'],
  },
  {
    id: 'quality',
    name: '✨ Qualità',
    description: 'AI premium — Claude 3.5/4 (creative), OpenAI, Mistral come priorità',
    cost: '~$0.50',
    quality: '⭐⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['deepl', 'modelwiz', 'anthropic-claude4', 'anthropic', 'openai', 'qwen', 'mistral', 'gemini-3.1', 'gemini', 'cohere', 'together', 'deepseek', 'fireworks', 'mymemory'],
  },
  {
    id: 'max_quality',
    name: '👑 Massima Qualità',
    description: 'Tutti i provider inclusi Claude Opus 4.8 (premium) e Voice API — mai senza traduzione',
    cost: '~$1.00+',
    quality: '⭐⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['anthropic-premium', 'deepl', 'deepl-voice', 'modelwiz', 'anthropic-claude4', 'anthropic', 'openai', 'qwen', 'translategemma', 'ollama', 'lmstudio', 'mistral', 'gemini-3.1', 'gemini', 'cohere', 'together', 'deepseek', 'fireworks', 'groq-gptoss', 'groq', 'cerebras', 'openrouter', 'hymt', 'nllb', 'mymemory', 'lingva'],
  },
  {
    id: 'creative',
    name: '🎭 Creative/Narrative',
    description: 'Claude Opus 4.8 (premium) + Sonnet 4.6 + Gemini 3.5 Flash per traduzioni creative, narrative, sfumature emotive',
    cost: '~$0.60',
    quality: '⭐⭐⭐⭐⭐',
    speed: '🚀 Adattiva',
    providers: ['anthropic-premium', 'anthropic-claude4', 'anthropic', 'openai', 'gemini-3.1', 'gemini', 'deepl', 'modelwiz'],
  },
  {
    id: 'long_context',
    name: '📚 Long Context',
    description: 'Gemini 3.1 Flash-Lite (low-cost) + Gemini 3.5 Flash (65k output) per documenti lunghi, script interi, multi-file',
    cost: '~$0.30',
    quality: '⭐⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['gemini-3.1', 'gemini', 'anthropic-claude4', 'openai', 'deepseek', 'qwen'],
  },
  {
    id: 'voice',
    name: '🎤 Voice Translation',
    description: 'DeepL Voice API per traduzione vocale real-time con TTS',
    cost: '~$0.40',
    quality: '⭐⭐⭐⭐⭐',
    speed: '⚡ Real-time',
    providers: ['deepl-voice', 'deepl', 'gemini-3.1', 'anthropic-claude4', 'openai'],
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

/**
 * Preset attivo — default `balanced`, che si descrive da sé come «miglior
 * rapporto qualità/prezzo».
 *
 * ⛔ 18/08/2026: fino a oggi questa era SOLO una variabile di modulo. Chi
 * riusciva a cambiarla (unico punto vivo: /binary-patcher, pagina che non sta
 * in nessun menu) la ritrovava a `balanced` al primo reload — la scelta più
 * costosa che l'app permette di fare era anche l'unica che non si ricordava.
 * Ora è persistita, con lo stesso schema per-chiave di lib/translation-backend.ts:
 * localStorage, letture difensive, valore ignoto = default.
 */
/**
 * ⭐ 18/08 (secondo giro): la scelta NON vive in una chiave localStorage sua,
 * ma dentro `gameStringerSettings.translation.chainPreset`. La differenza non è
 * estetica: quel blob è l'unico stato che SettingsBootGate idrata da
 * settings.json su disco e riscrive al flush, quindi il preset eredita
 * gratis la persistenza vera e sopravvive al cambio di porta in dev — che è
 * esattamente il difetto di [storage-per-origine]. Una chiave a sé sarebbe
 * rimasta legata all'origine del webview: salvata, e invisibile al riavvio
 * successivo su un'altra porta.
 */
const SETTINGS_KEY = 'gameStringerSettings';

/** Solo un id noto è valido: qualunque altra cosa torna al default. */
function parsePreset(raw: unknown): ChainPreset | null {
  if (typeof raw !== 'string' || !raw) return null;
  return CHAIN_PRESETS.some((p) => p.id === raw) ? (raw as ChainPreset) : null;
}

let activeChainPreset: ChainPreset = 'balanced';
let hydrated = false;

/** Legge dalle impostazioni la prima volta che serve (il modulo gira anche server-side). */
function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    if (typeof localStorage === 'undefined') return;
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const saved = parsePreset(s?.translation?.chainPreset);
    if (saved) activeChainPreset = saved;
  } catch {
    /* impostazioni illeggibili: si resta sul default */
  }
}

export function setChainPreset(preset: ChainPreset) {
  hydrate();
  activeChainPreset = preset;
  try {
    if (typeof localStorage !== 'undefined') {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      s.translation = { ...(s.translation || {}), chainPreset: preset };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }
  } catch {
    /* la scelta vale almeno per questa sessione */
  }
  // Reset blocks quando si cambia chain
  resetProviderBlocks();
  clientLogger.debug(`[Chain] Preset impostato: ${preset}`);
}

export function getChainPreset(): ChainPreset {
  hydrate();
  return activeChainPreset;
}

/** Internal getter for the active preset - used by the main module */
export function getActiveChainPreset(): ChainPreset {
  hydrate();
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

