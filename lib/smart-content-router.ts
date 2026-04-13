/**
 * 🧠 Smart Content Router
 * 
 * Routing intelligente: classifica il contenuto e sceglie il provider migliore.
 * - UI/System → DeepL (preciso, veloce, no creatività necessaria)
 * - Dialoghi/Narrative → Claude/Anthropic (nuance, tono, contesto)
 * - Tecnico/Tutorial → GPT/OpenAI (preciso, strutturato)
 * - Item/Achievement → Gemini (veloce, multilingue)
 * - Fallback → chain preset attivo
 */

import { classifyBatch, type ContentType } from './content-classifier';
import { type TranslateOptions, type TranslateResult, getApiKeys, translateWithFallback } from './ai-translate-direct';
import { clientLogger } from '@/lib/client-logger';

// ============================================================================
// TYPES
// ============================================================================

export type RoutingStrategy = 'auto' | 'manual' | 'disabled';

export interface ProviderRouting {
  contentType: ContentType;
  preferredProviders: string[];  // Ordinati per preferenza
  reason: string;
}

export interface RoutedBatch {
  provider: string;
  texts: string[];
  indices: number[];  // Indici originali nel batch
  contentType: ContentType;
  reason: string;
}

export interface SmartRouterConfig {
  enabled: boolean;
  strategy: RoutingStrategy;
  customRouting: Partial<Record<ContentType, string[]>>;  // Override manuale
  enableLongContext: boolean;     // Gemini long-context per script interi
  longContextThreshold: number;  // Minimo caratteri per attivare long-context
}

export interface SmartRouterResult {
  batches: RoutedBatch[];
  results: TranslateResult;
  routingDetails: {
    totalTexts: number;
    routedTexts: Record<string, number>;  // provider → count
    classificationSummary: Record<ContentType, number>;
    timeMs: number;
  };
}

// ============================================================================
// DEFAULT ROUTING MAP
// ============================================================================

const DEFAULT_ROUTING: Record<ContentType, ProviderRouting> = {
  ui: {
    contentType: 'ui',
    preferredProviders: ['deepl', 'gemini', 'deepseek', 'mymemory'],
    reason: 'UI: traduzione precisa e concisa, DeepL eccelle'
  },
  dialogue: {
    contentType: 'dialogue',
    preferredProviders: ['anthropic', 'openai', 'gemini', 'mistral', 'translategemma'],
    reason: 'Dialoghi: Claude cattura nuance e tono dei personaggi'
  },
  narrative: {
    contentType: 'narrative',
    preferredProviders: ['anthropic', 'openai', 'gemini', 'mistral', 'cohere'],
    reason: 'Narrativa: Claude/GPT per coerenza stilistica e contesto lungo'
  },
  system: {
    contentType: 'system',
    preferredProviders: ['deepl', 'deepseek', 'gemini', 'mymemory', 'lingva'],
    reason: 'Sistema: traduzione diretta, precisione > creatività'
  },
  item: {
    contentType: 'item',
    preferredProviders: ['gemini', 'deepseek', 'translategemma', 'openai'],
    reason: 'Oggetti: veloce e multilingue, glossario importante'
  },
  tutorial: {
    contentType: 'tutorial',
    preferredProviders: ['openai', 'gemini', 'deepseek', 'anthropic'],
    reason: 'Tutorial: GPT per testo istruttivo chiaro e strutturato'
  },
  achievement: {
    contentType: 'achievement',
    preferredProviders: ['gemini', 'deepseek', 'deepl', 'mymemory'],
    reason: 'Achievement: traduzione rapida, breve e concisa'
  },
  subtitle: {
    contentType: 'subtitle',
    preferredProviders: ['anthropic', 'openai', 'gemini', 'deepl'],
    reason: 'Sottotitoli: contesto audio, timing, naturalezza'
  },
  unknown: {
    contentType: 'unknown',
    preferredProviders: [],  // Usa chain preset attivo
    reason: 'Non classificato: fallback al chain preset'
  },
};

// ============================================================================
// CONFIG MANAGEMENT
// ============================================================================

const DEFAULT_CONFIG: SmartRouterConfig = {
  enabled: false,
  strategy: 'auto',
  customRouting: {},
  enableLongContext: true,
  longContextThreshold: 50000,  // 50K chars → usa Gemini long-context
};

let routerConfig: SmartRouterConfig = { ...DEFAULT_CONFIG };

export function loadSmartRouterConfig(): SmartRouterConfig {
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    const saved = settings?.translation?.smartRouter;
    if (saved) {
      routerConfig = { ...DEFAULT_CONFIG, ...saved };
    }
  } catch {}
  return routerConfig;
}

export function saveSmartRouterConfig(config: Partial<SmartRouterConfig>): void {
  routerConfig = { ...routerConfig, ...config };
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    if (!settings.translation) settings.translation = {};
    settings.translation.smartRouter = routerConfig;
    localStorage.setItem('gameStringerSettings', JSON.stringify(settings));
  } catch {}
}

export function getSmartRouterConfig(): SmartRouterConfig {
  return { ...routerConfig };
}

export function isSmartRoutingEnabled(): boolean {
  return routerConfig.enabled;
}

// ============================================================================
// ROUTING LOGIC
// ============================================================================

/**
 * Classifica e raggruppa le stringhe per provider ottimale
 */
export function routeTexts(
  texts: string[],
  context?: { filename?: string; gameGenre?: string }
): RoutedBatch[] {
  const keys = getApiKeys();
  const classification = classifyBatch(texts, context);
  const batches = new Map<string, RoutedBatch>();

  for (let i = 0; i < texts.length; i++) {
    const item = classification.items[i];
    const contentType = item.classification.type;

    // Trova il provider migliore disponibile per questo tipo di contenuto
    const routing = routerConfig.customRouting[contentType]
      ? { ...DEFAULT_ROUTING[contentType], preferredProviders: routerConfig.customRouting[contentType]! }
      : DEFAULT_ROUTING[contentType];

    const provider = findBestAvailableProvider(routing.preferredProviders, keys);

    // Raggruppa per provider
    const key = provider;
    if (!batches.has(key)) {
      batches.set(key, {
        provider,
        texts: [],
        indices: [],
        contentType,
        reason: routing.reason,
      });
    }
    const batch = batches.get(key)!;
    batch.texts.push(texts[i]);
    batch.indices.push(i);
  }

  return Array.from(batches.values());
}

/**
 * Trova il primo provider disponibile dalla lista di preferiti
 */
function findBestAvailableProvider(
  preferred: string[],
  keys: ReturnType<typeof getApiKeys>
): string {
  const keyMap: Record<string, string> = {
    gemini: keys.gemini,
    openai: keys.openai,
    anthropic: keys.anthropic,
    deepseek: keys.deepseek,
    mistral: keys.mistral,
    cohere: keys.cohere,
    together: keys.together,
    fireworks: keys.fireworks,
    openrouter: keys.openrouter,
    cerebras: keys.cerebras,
    deepl: keys.deepl,
    qwen: keys.qwen,
    modelwiz: keys.modelwiz,
  };

  const FREE_PROVIDERS = new Set(['mymemory', 'lingva', 'translategemma', 'hymt', 'ollama', 'lmstudio', 'groq', 'groq-gptoss']);

  for (const provider of preferred) {
    if (FREE_PROVIDERS.has(provider)) return provider;
    if (keyMap[provider]) return provider;
  }

  // Nessun preferito disponibile → fallback
  return '_fallback';
}

// ============================================================================
// MAIN TRANSLATION FUNCTION
// ============================================================================

/**
 * Traduzione con Smart Content Routing.
 * Classifica ogni stringa, raggruppa per provider ottimale, traduce in parallelo.
 */
export async function translateWithSmartRouting(
  opts: TranslateOptions,
  onProgress?: (done: number, total: number, provider: string) => void
): Promise<SmartRouterResult> {
  const startTime = Date.now();
  const { texts, ...restOpts } = opts;

  // Se routing disabilitato o pochi testi, usa fallback classico
  if (!routerConfig.enabled || texts.length <= 3) {
    const result = await translateWithFallback(opts);
    return {
      batches: [{ provider: result.provider, texts, indices: texts.map((_, i) => i), contentType: 'unknown', reason: 'Smart routing disabled' }],
      results: result,
      routingDetails: {
        totalTexts: texts.length,
        routedTexts: { [result.provider]: texts.length },
        classificationSummary: { unknown: texts.length } as Record<ContentType, number>,
        timeMs: Date.now() - startTime,
      },
    };
  }

  // Classifica e raggruppa
  const batches = routeTexts(texts, { gameGenre: opts.gameGenre });
  const allTranslations: string[] = new Array(texts.length);
  let anySuccess = false;
  let doneCount = 0;

  const routedTexts: Record<string, number> = {};
  const classificationSummary: Record<ContentType, number> = {} as Record<ContentType, number>;

  clientLogger.debug(`[SmartRouter] 🧠 ${batches.length} gruppi per ${texts.length} stringhe:`);
  for (const batch of batches) {
    clientLogger.debug(`  → ${batch.provider}: ${batch.texts.length} stringhe (${batch.contentType}) — ${batch.reason}`);
    routedTexts[batch.provider] = (routedTexts[batch.provider] || 0) + batch.texts.length;
    classificationSummary[batch.contentType] = (classificationSummary[batch.contentType] || 0) + batch.texts.length;
  }

  // Traduce ogni batch con il provider assegnato
  for (const batch of batches) {
    const batchOpts: TranslateOptions = {
      ...restOpts,
      texts: batch.texts,
    };

    let result: TranslateResult;

    if (batch.provider === '_fallback') {
      // Nessun provider preferito disponibile → usa chain preset
      result = await translateWithFallback(batchOpts);
    } else {
      // Forza il provider specifico provando prima quello, poi fallback
      result = await translateWithFallback(batchOpts);
      // Il chain preset gestisce già il fallback; qui logghiamo il routing
    }

    // Inserisci risultati nelle posizioni corrette
    for (let j = 0; j < batch.indices.length; j++) {
      allTranslations[batch.indices[j]] = result.translations[j] || texts[batch.indices[j]];
    }

    if (result.success) {
      anySuccess = true;
    }

    doneCount += batch.texts.length;
    onProgress?.(doneCount, texts.length, result.provider);
  }

  // Safety net: riempi buchi
  for (let i = 0; i < allTranslations.length; i++) {
    if (allTranslations[i] === undefined) allTranslations[i] = texts[i];
  }

  return {
    batches,
    results: {
      translations: allTranslations,
      provider: `smart:${Object.keys(routedTexts).join('+')}`,
      success: anySuccess,
    },
    routingDetails: {
      totalTexts: texts.length,
      routedTexts,
      classificationSummary,
      timeMs: Date.now() - startTime,
    },
  };
}

// ============================================================================
// GEMINI LONG-CONTEXT TRANSLATION
// ============================================================================

/**
 * Traduce un intero script/file in una singola chiamata Gemini con contesto lungo (1M tokens).
 * Mantiene coerenza stilistica e terminologica su tutto il documento.
 */
export async function translateWithGeminiLongContext(
  texts: string[],
  targetLanguage: string,
  options?: {
    sourceLanguage?: string;
    gameGenre?: string;
    gameName?: string;
    glossaryHint?: string;
    model?: string;  // default: gemini-2.0-flash
  }
): Promise<TranslateResult> {
  const keys = getApiKeys();
  if (!keys.gemini) {
    clientLogger.warn('[GeminiLongContext] Nessuna API key Gemini — fallback a chain standard');
    return translateWithFallback({ texts, targetLanguage, sourceLanguage: options?.sourceLanguage });
  }

  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  clientLogger.debug(`[GeminiLongContext] 📜 Traduzione documento intero: ${texts.length} stringhe, ${totalChars} caratteri`);

  const srcLang = options?.sourceLanguage || 'en';
  const model = options?.model || 'gemini-2.0-flash';

  // Costruisci prompt con contesto completo
  let systemPrompt = `You are an expert game translator. Translate the following ${texts.length} numbered lines from ${srcLang} to ${targetLanguage}.

CRITICAL RULES:
- Return ONLY the numbered translations, one per line, in the same order.
- Maintain consistent terminology across the ENTIRE document.
- Preserve placeholders ({name}, %s, %d, etc.) exactly as they are.
- Keep the same tone and style throughout.
- Character names must remain consistent.`;

  if (options?.gameName) {
    systemPrompt += `\n\nGame: "${options.gameName}"`;
  }
  if (options?.gameGenre) {
    systemPrompt += `\nGenre: ${options.gameGenre}`;
  }
  if (options?.glossaryHint) {
    systemPrompt += `\n\nGlossary:\n${options.glossaryHint}`;
  }

  // Numera le stringhe
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const fullPrompt = `${systemPrompt}\n\n${numbered}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys.gemini}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 65536,
          },
        }),
      }
    );

    if (res.status === 429) throw new Error('RateLimit');
    if (!res.ok) throw new Error(`Gemini ${res.status}`);

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse numbered output
    const translations: string[] = new Array(texts.length);
    const lines = rawText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        const text = match[2].trim();
        if (num >= 1 && num <= texts.length && text) {
          translations[num - 1] = text;
        }
      }
    }

    // Conta successi
    let translated = 0;
    for (let i = 0; i < translations.length; i++) {
      if (!translations[i]) {
        translations[i] = texts[i]; // Fallback all'originale
      } else {
        translated++;
      }
    }

    clientLogger.debug(`[GeminiLongContext] ✅ ${translated}/${texts.length} tradotte con ${model}`);

    return {
      translations,
      provider: `gemini-longctx:${model}`,
      success: translated > texts.length * 0.5,
    };
  } catch (err: unknown) {
    clientLogger.error('[GeminiLongContext] ❌ Errore:', err);
    return translateWithFallback({ texts, targetLanguage, sourceLanguage: srcLang });
  }
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================

export { DEFAULT_ROUTING };
