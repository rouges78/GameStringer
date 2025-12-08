/**
 * 🧠 Neural Translator - Professional Game Translation System
 * 
 * Sistema completo per la traduzione professionale di videogiochi.
 * Include: Translation Memory, Quality Gates, Content Classification,
 * Batch Processing, e supporto per tutti i formati di localizzazione.
 */

// Translation Memory
export {
  translationMemory,
  TranslationMemoryManager,
  translateWithMemory,
  translateBatchWithMemory,
  calculateSimilarity,
  type TranslationUnit,
  type TranslationMemory,
  type TMStats,
  type TMSearchResult,
  type TMSearchOptions,
} from '../translation-memory';

// Quality Gates
export {
  runQualityGates,
  quickQualityCheck,
  validateBatch,
  checkLength,
  checkPlaceholders,
  checkFormatting,
  checkGlossaryTerms,
  checkUntranslated,
  checkToneConsistency,
  checkNumbersAndUnits,
  calculateQualityScore,
  type QualityCheck,
  type QualityReport,
  type QualityOptions,
  type LengthValidation,
  type BatchQualityResult,
} from '../quality-gates';

// Content Classification
export {
  classifyContent,
  classifyBatch,
  filterByRoute,
  filterByPriority,
  sortByPriority,
  groupByType,
  type ContentType,
  type ContentPriority,
  type TranslationRoute,
  type ContentClassification,
  type BatchClassificationResult,
} from '../content-classifier';

// Batch Processing
export {
  BatchTranslator,
  translateBatch,
  estimateBatchCost,
  formatTimeRemaining,
  exportBatchResults,
  DEFAULT_BATCH_OPTIONS,
  type BatchTranslationJob,
  type BatchTranslationItem,
  type BatchJobStatus,
  type BatchProgress,
  type BatchOptions,
  type BatchResults,
} from '../batch-translator';

// File Parsers
export {
  parseFile,
  writeFile,
  detectFormat,
  getExtensionForFormat,
  SUPPORTED_FORMATS,
  FORMAT_DESCRIPTIONS,
  // Individual parsers
  parsePO,
  writePO,
  parseXLIFF,
  writeXLIFF,
  parseRESX,
  writeRESX,
  parseStrings,
  writeStrings,
  parseJSON,
  writeJSON,
  parseINI,
  writeINI,
  parseCSV,
  writeCSV,
  parseProperties,
  writeProperties,
  type ParsedString,
  type ParseResult,
  type WriteOptions,
  type FileFormat,
} from '../file-parsers';

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import { parseFile, writeFile, ParseResult, SUPPORTED_FORMATS } from '../file-parsers';
import { BatchTranslator, BatchOptions, BatchProgress, BatchTranslationJob } from '../batch-translator';
import { translationMemory } from '../translation-memory';

/**
 * Traduce un file completo
 */
export async function translateFile(
  content: string,
  filename: string,
  options: {
    sourceLanguage?: string;
    targetLanguage?: string;
    provider?: 'openai' | 'deepl' | 'google';
    gameId?: string;
    gameName?: string;
    onProgress?: (progress: BatchProgress) => void;
  } & Partial<BatchOptions>
): Promise<{
  translatedContent: string;
  job: BatchTranslationJob;
  parseResult: ParseResult;
}> {
  // Parse file
  const parseResult = parseFile(content, filename);
  
  if (parseResult.strings.length === 0) {
    throw new Error('Nessuna stringa trovata nel file');
  }
  
  // Create batch job
  const translator = new BatchTranslator();
  translator.createJob(
    parseResult.strings.map(s => ({
      text: s.value,
      key: s.key,
      filename,
      context: s.context
    })),
    {
      name: `Translate ${filename}`,
      gameId: options.gameId,
      gameName: options.gameName,
      sourceLanguage: options.sourceLanguage || parseResult.metadata.sourceLanguage || 'en',
      targetLanguage: options.targetLanguage || parseResult.metadata.targetLanguage || 'it',
      provider: options.provider || 'openai',
      ...options
    }
  );
  
  if (options.onProgress) {
    translator.onProgress(options.onProgress);
  }
  
  // Execute translation
  const job = await translator.start();
  
  // Build translations map
  const translations = new Map<string, string>();
  for (const item of job.items) {
    if (item.status === 'completed' && item.translatedText) {
      translations.set(item.metadata?.key || item.sourceText, item.translatedText);
    }
  }
  
  // Write translated file
  const translatedContent = writeFile(parseResult, translations, {
    preserveComments: true,
    preserveMetadata: true
  });
  
  return {
    translatedContent,
    job,
    parseResult
  };
}

/**
 * Inizializza il sistema Neural Translator
 */
export async function initializeNeuralTranslator(
  sourceLanguage: string = 'en',
  targetLanguage: string = 'it'
): Promise<void> {
  await translationMemory.initialize(sourceLanguage, targetLanguage);
  console.log('[Neural Translator] Sistema inizializzato');
}

/**
 * Ottieni statistiche del sistema
 */
export function getSystemStats(): {
  translationMemory: {
    totalUnits: number;
    verifiedUnits: number;
    averageConfidence: number;
  } | null;
  supportedFormats: string[];
} {
  const tmStats = translationMemory.getStats();
  
  return {
    translationMemory: tmStats ? {
      totalUnits: tmStats.totalUnits,
      verifiedUnits: tmStats.verifiedUnits,
      averageConfidence: Math.round(tmStats.averageConfidence * 100) / 100
    } : null,
    supportedFormats: SUPPORTED_FORMATS
  };
}
