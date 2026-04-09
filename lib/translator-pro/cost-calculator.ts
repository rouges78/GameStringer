/**
 * Cost Calculator & Provider Recommendation
 *
 * Pure functions extracted from TranslatorProPage for:
 * - AI provider recommendation based on content analysis
 * - Cost estimation wrapper
 */

import {
  estimateBatchCost,
  type ParseResult,
} from '@/lib/neural-translator';

// ============================================================================
// TYPES
// ============================================================================

export interface ProviderRecommendation {
  provider: string;
  reason: string;
  confidence: number;
}

export type TranslationProvider = 'openai' | 'gpt5' | 'gemini' | 'claude' | 'deepseek' | 'mistral' | 'openrouter' | 'deepl' | 'google';

export interface CostEstimateInput {
  checkedFiles: Array<{
    parseResult: ParseResult;
  }>;
  provider: TranslationProvider;
  useTranslationMemory: boolean;
  tmStats: { totalUnits: number; verifiedUnits: number } | null;
}

// ============================================================================
// PROVIDER RECOMMENDATION
// ============================================================================

/**
 * Recommend an AI provider based on content analysis, target language,
 * and volume of strings.
 */
export function getRecommendedProvider(
  checkedFiles: Array<{ parseResult: ParseResult }>,
  totalStrings: number,
  targetLanguage: string,
): ProviderRecommendation | null {
  if (checkedFiles.length === 0) return null;

  const allText = checkedFiles.flatMap(f =>
    f.parseResult.strings.map(s => s.value)
  ).join(' ').toLowerCase();

  const avgLength = allText.length / Math.max(1, totalStrings);
  const hasVariables = /%[sd@]|{\w+}|\$\w+|\[\w+\]/i.test(allText);

  // Content type analysis
  const isUI = avgLength < 30 && (
    /button|menu|settings|options|save|load|exit|quit|start|continue/i.test(allText)
  );
  const isDialogue = avgLength > 50 && /said|asked|replied|"/i.test(allText);
  const isCreative = /story|tale|legend|hero|adventure|quest/i.test(allText);
  const isTechnical = /error|warning|failed|success|loading|connecting/i.test(allText);

  // Target language categories
  const isAsianTarget = ['zh', 'ja', 'ko', 'cn'].includes(targetLanguage);
  const isEuropeanTarget = ['de', 'fr', 'es', 'it', 'pt', 'pl', 'ru', 'cs', 'hr'].includes(targetLanguage);
  const isRareLanguage = ['ar', 'hi', 'th', 'vi', 'id', 'tr'].includes(targetLanguage);

  // Recommendations based on research
  // Claude: best for long documents, coherence, 78% "good" output (Lokalise 2025)
  // GPT-4: gold standard for consistency, 50+ languages
  // Gemini: great for regional languages (Telugu), fast
  // DeepSeek: excellent for Chinese<->English, technical
  // Mistral: open source, good for privacy, multilingual

  if (isCreative || isDialogue) {
    return {
      provider: 'claude',
      reason: 'Claude eccelle in traduzioni creative e dialoghi lunghi con coerenza stilistica',
      confidence: 0.9,
    };
  }

  if (isAsianTarget || (isTechnical && isAsianTarget)) {
    return {
      provider: 'deepseek',
      reason: 'DeepSeek V3 è ottimizzato per traduzioni Cinese↔Inglese e contenuti tecnici',
      confidence: 0.85,
    };
  }

  if (isUI && hasVariables) {
    return {
      provider: 'gemini',
      reason: 'Gemini gestisce bene variabili e stringhe UI corte, rispetta la Translation Memory',
      confidence: 0.8,
    };
  }

  if (totalStrings > 500) {
    return {
      provider: 'claude',
      reason: 'Claude ha context window enorme, ideale per progetti grandi con terminologia consistente',
      confidence: 0.85,
    };
  }

  if (isEuropeanTarget && isUI) {
    return {
      provider: 'gpt5',
      reason: 'GPT-4o è il gold standard per lingue europee ad alta risorsa',
      confidence: 0.85,
    };
  }

  if (isRareLanguage) {
    return {
      provider: 'openrouter',
      reason: 'OpenRouter permette di scegliere modelli specializzati per lingue meno comuni',
      confidence: 0.7,
    };
  }

  // Default: GPT-4o for quality/cost balance
  return {
    provider: 'gpt5',
    reason: 'GPT-4o offre il miglior bilanciamento qualità/consistenza per la maggior parte dei casi',
    confidence: 0.75,
  };
}

// ============================================================================
// COST ESTIMATION
// ============================================================================

/**
 * Compute a cost estimate for checked files using the neural translator's
 * estimateBatchCost function.
 */
export function computeCostEstimate(input: CostEstimateInput) {
  const { checkedFiles, provider, useTranslationMemory, tmStats } = input;
  if (checkedFiles.length === 0) return null;

  const allStrings = checkedFiles.flatMap(f =>
    f.parseResult.strings.map(s => ({ text: s.value }))
  );

  return estimateBatchCost(allStrings, {
    provider,
    useTranslationMemory,
    tmHitRate: tmStats ? 0.3 : 0,
  });
}
