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
  batchSize: 10,
  delayBetweenBatches: 500,
  maxRetries: 3,
  retryDelay: 1000,
  timeoutPerItem: 30000, // 30 secondi timeout per singola traduzione
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
    
    for (let i = 0; i < pendingItems.length; i++) {
      // Check pause/cancel
      while (this.isPaused) {
        await this.sleep(100);
      }
      if (this.isCancelled) break;

      const item = pendingItems[i];
      item.status = 'translating';
      this.job.progress.currentItem = item.sourceText.substring(0, 50);
      this.updateProgress();

      try {
        await this.translateItem(item);
        item.status = 'completed';
        this.job.progress.completed++;
        this.job.results.translatedItems++;
        
        if (item.fromMemory) {
          this.job.progress.fromMemory++;
          this.job.results.fromMemoryItems++;
        }

        this.onItemCompleteCallback?.(item);

      } catch (error) {
        item.status = 'failed';
        item.error = error instanceof Error ? error.message : String(error);
        this.job.progress.failed++;
        this.job.results.failedItems++;

        // Retry logic with Exponential Backoff
        if (this.job.options.maxRetries > 0) {
          let currentRetryDelay = this.job.options.retryDelay;

          for (let retry = 0; retry < this.job.options.maxRetries; retry++) {
            const isRateLimit = item.error?.includes('429') || item.error?.includes('Too Many Requests');
            
            // Se è un rate limit, aumenta aggressivamente il delay
            if (isRateLimit) {
              currentRetryDelay = Math.max(currentRetryDelay * 2, 5000 * (retry + 1)); // Min 5s, poi 10s, 15s...
              console.warn(`[BatchTranslator] ⚠️ Rate limit 429 rilevato. Attesa ${currentRetryDelay}ms prima del retry ${retry + 1}/${this.job.options.maxRetries}`);
              
              // Rallenta anche il delay tra batch futuri per evitare di colpire subito il muro di nuovo
              this.job.options.delayBetweenBatches = Math.max(this.job.options.delayBetweenBatches * 1.5, 2000);

              // Aggiorna stato per UI
              this.job.progress.isRateLimited = true;
              this.job.progress.statusMessage = `⚠️ Rate limit API rilevato. In pausa per ${(currentRetryDelay/1000).toFixed(0)}s...`;
              this.updateProgress();
            }

            await this.sleep(currentRetryDelay);
            
            // Reset stato rate limit dopo attesa
            if (isRateLimit) {
              this.job.progress.isRateLimited = false;
              this.job.progress.statusMessage = undefined;
              this.updateProgress();
            }
            
            try {
              await this.translateItem(item);
              // Success!
              item.status = 'completed';
              item.error = undefined;
              this.job.progress.failed--;
              this.job.progress.completed++;
              this.job.results.failedItems--;
              this.job.results.translatedItems++;
              
              if (item.fromMemory) {
                this.job.progress.fromMemory++;
                this.job.results.fromMemoryItems++;
              }

              this.onItemCompleteCallback?.(item);
              break;
            } catch (retryError) {
              item.error = retryError instanceof Error ? retryError.message : String(retryError);
              // Aumenta delay per il prossimo tentativo (Exponential Backoff)
              currentRetryDelay *= 2;
            }
          }
        }
      }

      this.updateProgress();

      // Delay between items
      if (i < pendingItems.length - 1 && !item.fromMemory) {
        await this.sleep(this.job.options.delayBetweenBatches);
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
  
  // Cost per provider (per 1K tokens)
  const costPer1K: Record<string, number> = {
    openai: 0.002,    // GPT-4o-mini
    deepl: 0.001,     // DeepL API
    google: 0.0005,   // Google Translate
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
