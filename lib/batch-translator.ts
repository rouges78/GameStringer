/**
 * 🚀 Batch Translation System
 * 
 * Sistema professionale per traduzione batch di file di gioco.
 * Integra Translation Memory, Quality Gates e Content Classification.
 */

import { translationMemory, translateWithMemory, TranslationUnit } from './translation-memory';
import { runQualityGates, quickQualityCheck, QualityReport, validateBatch } from './quality-gates';
import { classifyBatch, classifyContent, ContentClassification, BatchClassificationResult } from './content-classifier';

// ============================================================================
// TYPES
// ============================================================================

export interface BatchTranslationJob {
  id: string;
  name: string;
  gameId?: string;
  gameName?: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: 'openai' | 'gpt5' | 'gemini' | 'claude' | 'deepseek' | 'mistral' | 'openrouter' | 'deepl' | 'google';
  status: BatchJobStatus;
  items: BatchTranslationItem[];
  progress: BatchProgress;
  options: BatchOptions;
  results: BatchResults;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export type BatchJobStatus = 
  | 'pending'      // In attesa di avvio
  | 'classifying'  // Classificazione contenuto
  | 'translating'  // Traduzione in corso
  | 'validating'   // Validazione qualità
  | 'completed'    // Completato con successo
  | 'failed'       // Fallito
  | 'paused'       // In pausa
  | 'cancelled';   // Cancellato

export interface BatchTranslationItem {
  id: string;
  index: number;
  sourceText: string;
  translatedText?: string;
  status: 'pending' | 'translating' | 'completed' | 'failed' | 'skipped';
  classification?: ContentClassification;
  qualityReport?: QualityReport;
  fromMemory: boolean;
  error?: string;
  metadata?: {
    key?: string;           // Chiave originale (es. "menu.start")
    filename?: string;      // File di origine
    lineNumber?: number;    // Riga nel file
    maxLength?: number;     // Limite caratteri
    context?: string;       // Contesto aggiuntivo
  };
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  fromMemory: number;
  currentItem?: string;
  percentage: number;
  estimatedTimeRemaining?: number;  // secondi
  startTime?: number;
  statusMessage?: string;           // Messaggio di stato per l'utente
  isRateLimited?: boolean;          // Se true, stiamo aspettando per rate limit
}

export interface BatchOptions {
  // Translation options
  useTranslationMemory: boolean;
  saveToMemory: boolean;
  
  // Quality options
  runQualityChecks: boolean;
  minQualityScore: number;
  stopOnQualityFail: boolean;
  
  // Classification options
  classifyContent: boolean;
  skipLowPriority: boolean;
  
  // Processing options
  batchSize: number;           // Items per batch API call
  delayBetweenBatches: number; // ms tra batch
  parallelBatches: number;     // Numero di batch da eseguire in parallelo
  maxRetries: number;
  retryDelay: number;          // ms
  timeoutPerItem: number;      // ms - timeout per singola traduzione
  
  // API options
  apiKey?: string;             // API key per il provider selezionato
  
  // Context options
  glossaryTerms?: Array<{ original: string; translation: string }>;
  gameContext?: string;
  characterContext?: string;
}

export interface BatchResults {
  totalItems: number;
  translatedItems: number;
  failedItems: number;
  skippedItems: number;
  fromMemoryItems: number;
  averageQualityScore: number;
  totalTokensUsed: number;
  estimatedCost: number;
  qualityIssues: Array<{
    itemId: string;
    sourceText: string;
    issues: string[];
  }>;
}

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

export const DEFAULT_BATCH_OPTIONS: BatchOptions = {
  useTranslationMemory: true,
  saveToMemory: true,
  runQualityChecks: true,
  minQualityScore: 70,
  stopOnQualityFail: false,
  classifyContent: true,
  skipLowPriority: false,
  batchSize: 40,           // 40 stringhe per chiamata API batch (massimizzato)
  delayBetweenBatches: 50,  // 50ms tra batch (minimo)
  parallelBatches: 3,       // 3 batch in parallelo
  maxRetries: 3,
  retryDelay: 1000,
  timeoutPerItem: 30000,
};

// ============================================================================
// BATCH TRANSLATOR CLASS
// ============================================================================

export class BatchTranslator {
  private job: BatchTranslationJob | null = null;
  private isPaused = false;
  private isCancelled = false;
  private onProgressCallback?: (progress: BatchProgress) => void;
  private onItemCompleteCallback?: (item: BatchTranslationItem) => void;
  private onStatusChangeCallback?: (status: BatchJobStatus) => void;

  /**
   * Crea un nuovo job di traduzione batch
   */
  createJob(
    items: Array<{
      text: string;
      key?: string;
      filename?: string;
      maxLength?: number;
      context?: string;
    }>,
    options: Partial<BatchOptions> & {
      name: string;
      gameId?: string;
      gameName?: string;
      sourceLanguage?: string;
      targetLanguage?: string;
      provider?: 'openai' | 'gpt5' | 'gemini' | 'claude' | 'deepseek' | 'mistral' | 'openrouter' | 'deepl' | 'google';
    }
  ): BatchTranslationJob {
    const mergedOptions = { ...DEFAULT_BATCH_OPTIONS, ...options };
    
    const job: BatchTranslationJob = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: options.name,
      gameId: options.gameId,
      gameName: options.gameName,
      sourceLanguage: options.sourceLanguage || 'en',
      targetLanguage: options.targetLanguage || 'it',
      provider: options.provider || 'openai',
      status: 'pending',
      items: items.map((item, index) => ({
        id: `item_${index}_${Math.random().toString(36).substr(2, 6)}`,
        index,
        sourceText: item.text,
        status: 'pending',
        fromMemory: false,
        metadata: {
          key: item.key,
          filename: item.filename,
          maxLength: item.maxLength,
          context: item.context,
        }
      })),
      progress: {
        total: items.length,
        completed: 0,
        failed: 0,
        skipped: 0,
        fromMemory: 0,
        percentage: 0
      },
      options: mergedOptions,
      results: {
        totalItems: items.length,
        translatedItems: 0,
        failedItems: 0,
        skippedItems: 0,
        fromMemoryItems: 0,
        averageQualityScore: 0,
        totalTokensUsed: 0,
        estimatedCost: 0,
        qualityIssues: []
      },
      createdAt: new Date().toISOString()
    };

    this.job = job;
    return job;
  }

  /**
   * Avvia l'esecuzione del job
   */
  async start(): Promise<BatchTranslationJob> {
    if (!this.job) {
      throw new Error('Nessun job creato. Usa createJob() prima.');
    }

    this.isPaused = false;
    this.isCancelled = false;
    this.job.status = 'classifying';
    this.job.startedAt = new Date().toISOString();
    this.job.progress.startTime = Date.now();
    
    this.emitStatusChange('classifying');

    try {
      // Step 1: Classificazione contenuto
      if (this.job.options.classifyContent) {
        await this.classifyItems();
      }

      // Step 2: Inizializza Translation Memory
      if (this.job.options.useTranslationMemory) {
        await translationMemory.initialize(
          this.job.sourceLanguage,
          this.job.targetLanguage
        );
      }

      // Step 3: Traduzione
      this.job.status = 'translating';
      this.emitStatusChange('translating');
      await this.translateItems();

      // Step 4: Validazione qualità
      if (this.job.options.runQualityChecks) {
        this.job.status = 'validating';
        this.emitStatusChange('validating');
        await this.validateItems();
      }

      // Completato
      this.job.status = 'completed';
      this.job.completedAt = new Date().toISOString();
      this.emitStatusChange('completed');

    } catch (error) {
      this.job.status = 'failed';
      this.job.error = error instanceof Error ? error.message : String(error);
      this.emitStatusChange('failed');
    }

    return this.job;
  }

  /**
   * Mette in pausa il job
   */
  pause(): void {
    this.isPaused = true;
    if (this.job) {
      this.job.status = 'paused';
      this.emitStatusChange('paused');
    }
  }

  /**
   * Riprende il job
   */
  resume(): void {
    this.isPaused = false;
    if (this.job && this.job.status === 'paused') {
      this.job.status = 'translating';
      this.emitStatusChange('translating');
    }
  }

  /**
   * Cancella il job
   */
  cancel(): void {
    this.isCancelled = true;
    if (this.job) {
      this.job.status = 'cancelled';
      this.emitStatusChange('cancelled');
    }
  }

  /**
   * Registra callback per progress updates
   */
  onProgress(callback: (progress: BatchProgress) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Registra callback per item completati
   */
  onItemComplete(callback: (item: BatchTranslationItem) => void): void {
    this.onItemCompleteCallback = callback;
  }

  /**
   * Registra callback per cambio status
   */
  onStatusChange(callback: (status: BatchJobStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }

  /**
   * Ottieni il job corrente
   */
  getJob(): BatchTranslationJob | null {
    return this.job;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async classifyItems(): Promise<void> {
    if (!this.job) return;

    const texts = this.job.items.map(i => i.sourceText);
    const classification = classifyBatch(texts, {
      filename: this.job.items[0]?.metadata?.filename,
      gameGenre: undefined // TODO: get from game info
    });

    // Applica classificazione agli items
    for (let i = 0; i < this.job.items.length; i++) {
      this.job.items[i].classification = classification.items[i].classification;
      
      // Skip low priority se richiesto
      if (this.job.options.skipLowPriority && 
          classification.items[i].classification.priority === 'low') {
        this.job.items[i].status = 'skipped';
        this.job.progress.skipped++;
      }
    }

    this.updateProgress();
  }

  private async translateItems(): Promise<void> {
    if (!this.job) return;

    const pendingItems = this.job.items.filter(i => i.status === 'pending');
    
    // Prima: cerca match nella Translation Memory per tutti gli items
    const itemsNeedingApi: BatchTranslationItem[] = [];
    
    for (const item of pendingItems) {
      if (this.isCancelled) break;
      
      // Cerca nella TM
      if (this.job.options.useTranslationMemory) {
        const tmMatch = translationMemory.findExact(item.sourceText);
        if (tmMatch) {
          item.translatedText = tmMatch.targetText;
          item.fromMemory = true;
          item.status = 'completed';
          this.job.progress.completed++;
          this.job.progress.fromMemory++;
          this.job.results.translatedItems++;
          this.job.results.fromMemoryItems++;
          this.onItemCompleteCallback?.(item);
          continue;
        }
      }
      
      itemsNeedingApi.push(item);
    }
    
    this.updateProgress();
    
    // Poi: traduci in batch quelli che non sono in TM
    const BATCH_SIZE = this.job.options.batchSize || 40;
    const PARALLEL_BATCHES = this.job.options.parallelBatches || 3;
    const totalBatches = Math.ceil(itemsNeedingApi.length / BATCH_SIZE);
    
    console.log(`[BatchTranslator] Starting parallel translation: ${totalBatches} batches, ${PARALLEL_BATCHES} in parallel`);
    
    // Processa batch in parallelo
    for (let batchGroup = 0; batchGroup < itemsNeedingApi.length; batchGroup += BATCH_SIZE * PARALLEL_BATCHES) {
      // Check pause/cancel
      while (this.isPaused) {
        await this.sleep(100);
      }
      if (this.isCancelled) break;
      
      // Prepara batch paralleli
      const parallelPromises: Promise<void>[] = [];
      
      for (let p = 0; p < PARALLEL_BATCHES; p++) {
        const batchStart = batchGroup + (p * BATCH_SIZE);
        if (batchStart >= itemsNeedingApi.length) break;
        
        const batchItems = itemsNeedingApi.slice(batchStart, batchStart + BATCH_SIZE);
        const batchTexts = batchItems.map(item => item.sourceText);
        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
        
        // Aggiorna stato
        for (const item of batchItems) {
          item.status = 'translating';
        }
        
        // Crea promise per questo batch
        const batchPromise = this.processBatch(batchItems, batchTexts, batchNum, totalBatches);
        parallelPromises.push(batchPromise);
      }
      
      this.job.progress.currentItem = `Batch ${Math.floor(batchGroup / BATCH_SIZE) + 1}-${Math.min(Math.floor(batchGroup / BATCH_SIZE) + PARALLEL_BATCHES, totalBatches)}/${totalBatches}`;
      this.updateProgress();
      
      // Esegui batch in parallelo
      await Promise.all(parallelPromises);
      
      this.updateProgress();
      
      // Delay minimo tra gruppi di batch
      if (batchGroup + BATCH_SIZE * PARALLEL_BATCHES < itemsNeedingApi.length) {
        await this.sleep(this.job.options.delayBetweenBatches);
      }
    }
  }

  private async processBatch(
    batchItems: BatchTranslationItem[],
    batchTexts: string[],
    batchNum: number,
    totalBatches: number
  ): Promise<void> {
    if (!this.job) return;
    
    try {
      console.log(`[BatchTranslator] Calling API for batch ${batchNum}/${totalBatches}, ${batchTexts.length} items`);
      const response = await fetch('/api/translate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: batchTexts,
          targetLanguage: this.job.targetLanguage,
          sourceLanguage: this.job.sourceLanguage,
          provider: this.job.provider,
          context: this.job.options.gameContext,
          apiKey: this.job.options.apiKey
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BatchTranslator] API error ${response.status}:`, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Applica traduzioni
      for (let i = 0; i < batchItems.length; i++) {
        const item = batchItems[i];
        const translation = data.translations?.[i];
        
        if (translation && translation.translated) {
          item.translatedText = translation.translated;
          item.status = 'completed';
          item.fromMemory = false;
          this.job.progress.completed++;
          this.job.results.translatedItems++;
          
          // Salva in TM per uso futuro (async, non blocca)
          if (this.job.options.saveToMemory) {
            translationMemory.add(item.sourceText, translation.translated, {
              context: item.classification?.type,
              gameId: this.job.gameId,
              provider: this.job.provider,
              confidence: translation.confidence || 0.85
            }).catch(() => {});
          }
          
          // Stima costi
          const tokens = Math.ceil(item.sourceText.length / 4) + Math.ceil(translation.translated.length / 4);
          this.job.results.totalTokensUsed += tokens;
          this.job.results.estimatedCost += tokens * 0.00002;
          
          this.onItemCompleteCallback?.(item);
        } else {
          item.status = 'failed';
          item.error = 'No translation received';
          this.job.progress.failed++;
          this.job.results.failedItems++;
        }
      }
      
    } catch (error) {
      // Fallback: traduci uno alla volta se batch fallisce
      console.warn(`[BatchTranslator] Batch ${batchNum} failed, falling back to single:`, error);
      
      for (const item of batchItems) {
        try {
          await this.translateItem(item);
          item.status = 'completed';
          this.job.progress.completed++;
          this.job.results.translatedItems++;
          this.onItemCompleteCallback?.(item);
        } catch (itemError) {
          item.status = 'failed';
          item.error = itemError instanceof Error ? itemError.message : String(itemError);
          this.job.progress.failed++;
          this.job.results.failedItems++;
        }
        await this.sleep(200); // Delay ridotto nel fallback
      }
    }
  }

  private async translateItem(item: BatchTranslationItem): Promise<void> {
    if (!this.job) return;

    // Build context
    let context = '';
    if (this.job.options.gameContext) {
      context += this.job.options.gameContext + '\n';
    }
    if (this.job.options.characterContext) {
      context += this.job.options.characterContext + '\n';
    }
    if (item.classification) {
      context += `Content type: ${item.classification.type}\n`;
    }
    if (item.metadata?.context) {
      context += item.metadata.context;
    }

    // Translate with memory support (con timeout)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: traduzione troppo lenta')), this.job!.options.timeoutPerItem);
    });
    
    const translatePromise = translateWithMemory(item.sourceText, {
      sourceLang: this.job.sourceLanguage,
      targetLang: this.job.targetLanguage,
      context: context || undefined,
      gameId: this.job.gameId,
      provider: this.job.provider,
      apiKey: this.job.options.apiKey,
      forceApi: !this.job.options.useTranslationMemory
    });
    
    const result = await Promise.race([translatePromise, timeoutPromise]);

    item.translatedText = result.translation;
    item.fromMemory = result.source === 'memory';

    // Estimate tokens/cost
    if (!item.fromMemory) {
      const tokens = Math.ceil(item.sourceText.length / 4) + Math.ceil(result.translation.length / 4);
      this.job.results.totalTokensUsed += tokens;
      this.job.results.estimatedCost += tokens * 0.00002; // ~$20/1M tokens
    }
  }

  private async validateItems(): Promise<void> {
    if (!this.job) return;

    const completedItems = this.job.items.filter(i => i.status === 'completed');
    let totalScore = 0;

    for (const item of completedItems) {
      if (!item.translatedText) continue;

      const report = runQualityGates({
        sourceText: item.sourceText,
        translatedText: item.translatedText,
        context: item.classification?.type as any,
        maxLength: item.metadata?.maxLength,
        glossaryTerms: this.job.options.glossaryTerms,
        minQualityScore: this.job.options.minQualityScore
      });

      item.qualityReport = report;
      totalScore += report.overallScore;

      // Collect quality issues
      if (!report.passed) {
        const issues = report.checks
          .filter(c => !c.passed)
          .map(c => c.message || c.name);
        
        if (issues.length > 0) {
          this.job.results.qualityIssues.push({
            itemId: item.id,
            sourceText: item.sourceText.substring(0, 50),
            issues
          });
        }
      }
    }

    this.job.results.averageQualityScore = completedItems.length > 0 
      ? Math.round(totalScore / completedItems.length) 
      : 0;
  }

  private updateProgress(): void {
    if (!this.job) return;

    const { total, completed, failed, skipped } = this.job.progress;
    this.job.progress.percentage = Math.round(((completed + failed + skipped) / total) * 100);

    // Estimate time remaining
    if (this.job.progress.startTime && completed > 0) {
      const elapsed = Date.now() - this.job.progress.startTime;
      const avgTimePerItem = elapsed / completed;
      const remaining = total - completed - failed - skipped;
      this.job.progress.estimatedTimeRemaining = Math.round((remaining * avgTimePerItem) / 1000);
    }

    this.onProgressCallback?.(this.job.progress);
  }

  private emitStatusChange(status: BatchJobStatus): void {
    this.onStatusChangeCallback?.(status);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Crea e avvia un job di traduzione batch
 */
export async function translateBatch(
  items: Array<{
    text: string;
    key?: string;
    filename?: string;
    maxLength?: number;
  }>,
  options: {
    name: string;
    gameId?: string;
    gameName?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
    provider?: 'openai' | 'gpt5' | 'gemini' | 'claude' | 'deepseek' | 'mistral' | 'openrouter' | 'deepl' | 'google';
    onProgress?: (progress: BatchProgress) => void;
    onItemComplete?: (item: BatchTranslationItem) => void;
  } & Partial<BatchOptions>
): Promise<BatchTranslationJob> {
  const translator = new BatchTranslator();
  
  translator.createJob(items, options);
  
  if (options.onProgress) {
    translator.onProgress(options.onProgress);
  }
  if (options.onItemComplete) {
    translator.onItemComplete(options.onItemComplete);
  }

  return translator.start();
}

/**
 * Stima costo e tempo per un batch
 */
export function estimateBatchCost(
  items: Array<{ text: string }>,
  options: {
    provider?: 'openai' | 'gpt5' | 'gemini' | 'claude' | 'deepseek' | 'mistral' | 'openrouter' | 'deepl' | 'google';
    useTranslationMemory?: boolean;
    tmHitRate?: number;  // Stima % hit rate TM (default 30%)
  } = {}
): {
  estimatedTokens: number;
  estimatedCost: number;
  estimatedTime: number;  // secondi
  breakdown: {
    totalItems: number;
    estimatedTmHits: number;
    estimatedApiCalls: number;
  };
} {
  const { provider = 'openai', useTranslationMemory = true, tmHitRate = 0.3 } = options;
  
  const totalItems = items.length;
  const totalChars = items.reduce((sum, i) => sum + i.text.length, 0);
  const estimatedTokens = Math.ceil(totalChars / 4) * 2; // input + output
  
  const estimatedTmHits = useTranslationMemory ? Math.floor(totalItems * tmHitRate) : 0;
  const estimatedApiCalls = totalItems - estimatedTmHits;
  
  // Cost per provider (per 1K tokens) - Aggiornato 2025
  const costPer1K: Record<string, number> = {
    openai: 0.00015,   // GPT-4o-mini ($0.15/1M input)
    gpt5: 0.0025,      // GPT-4o ($2.50/1M input)
    gemini: 0.000125,  // Gemini 2.0 Flash ($0.10/1M input) - BEST VALUE
    claude: 0.003,     // Claude 3.5 Sonnet ($3/1M input) - BEST QUALITY
    deepseek: 0.00014, // DeepSeek V3 ($0.14/1M input) - CHEAPEST
    mistral: 0.002,    // Mistral Large ($2/1M input)
    openrouter: 0.001, // Varia per modello
    deepl: 0.02,       // DeepL Pro ($20/1M chars)
    google: 0.00002,   // Google Translate ($20/1M chars)
  };
  
  const estimatedCost = (estimatedTokens / 1000) * (costPer1K[provider] || 0.002) * (estimatedApiCalls / totalItems);
  
  // Time estimate: ~1 sec per API call + 0.5 sec delay
  const estimatedTime = estimatedApiCalls * 1.5;
  
  return {
    estimatedTokens,
    estimatedCost: Math.round(estimatedCost * 10000) / 10000,
    estimatedTime: Math.round(estimatedTime),
    breakdown: {
      totalItems,
      estimatedTmHits,
      estimatedApiCalls
    }
  };
}

/**
 * Formatta il tempo rimanente
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

/**
 * Esporta risultati batch in vari formati
 */
export function exportBatchResults(
  job: BatchTranslationJob,
  format: 'json' | 'csv' | 'tsv'
): string {
  const completedItems = job.items.filter(i => i.status === 'completed' && i.translatedText);
  
  switch (format) {
    case 'json':
      return JSON.stringify({
        job: {
          id: job.id,
          name: job.name,
          sourceLanguage: job.sourceLanguage,
          targetLanguage: job.targetLanguage,
          completedAt: job.completedAt
        },
        translations: completedItems.map(i => ({
          key: i.metadata?.key,
          source: i.sourceText,
          target: i.translatedText,
          quality: i.qualityReport?.overallScore
        })),
        stats: job.results
      }, null, 2);
      
    case 'csv':
      const csvHeader = 'key,source,target,quality';
      const csvRows = completedItems.map(i => 
        `"${i.metadata?.key || ''}","${escapeCSV(i.sourceText)}","${escapeCSV(i.translatedText || '')}",${i.qualityReport?.overallScore || ''}`
      );
      return [csvHeader, ...csvRows].join('\n');
      
    case 'tsv':
      const tsvHeader = 'key\tsource\ttarget\tquality';
      const tsvRows = completedItems.map(i => 
        `${i.metadata?.key || ''}\t${escapeTSV(i.sourceText)}\t${escapeTSV(i.translatedText || '')}\t${i.qualityReport?.overallScore || ''}`
      );
      return [tsvHeader, ...tsvRows].join('\n');
      
    default:
      return '';
  }
}

function escapeCSV(str: string): string {
  return str.replace(/"/g, '""').replace(/\n/g, '\\n');
}

function escapeTSV(str: string): string {
  return str.replace(/\t/g, '\\t').replace(/\n/g, '\\n');
}
