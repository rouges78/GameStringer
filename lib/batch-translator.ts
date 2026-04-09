/**
 * 🚀 Batch Translation System
 * 
 * Sistema professionale per traduzione batch di file di gioco.
 * Integra Translation Memory, Quality Gates e Content Classification.
 */

import { translationMemory, translateWithMemory, TranslationUnit } from './translation-memory';
import { clientLogger } from '@/lib/client-logger';
import { runQualityGates, quickQualityCheck, QualityReport, validateBatch } from './quality-gates';
import { classifyBatch, classifyContent, ContentClassification, BatchClassificationResult } from './content-classifier';
import { translateSmart } from './ai-translate-direct';
import { buildRelevantGlossaryHint, extractTerms, loadGlossary, loadGlossaryConfig } from './auto-glossary';
import { harvestBatch, type HarvestInput, type BatchHarvestResult } from './context-harvester';
import { composeGenreAndCharacterContext, type GameGenre } from './genre-prompts';
import { runPipeline, type PipelineResult } from './ai-pipeline';
import { suggestBatchImprovements, type PostEditRequest } from './ai-post-edit';

// ============================================================================
// TYPES
// ============================================================================

export interface BatchTranslationJob {
  id: string;
  name: string;
  gameId?: string;
  gameName?: string;
  gameGenre?: string;
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
  retried: number;
  postEdited: number;
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

  // Pipeline options
  usePipeline?: boolean;       // Se true, usa AI Pipeline multi-step per qualità massima
  pipelineAutoFix?: boolean;   // Auto-fix errori QA (default: true)
  pipelineReview?: boolean;    // Review finale AI (default: true)
}

export interface BatchResults {
  totalItems: number;
  translatedItems: number;
  failedItems: number;
  skippedItems: number;
  fromMemoryItems: number;
  postEditedItems: number;
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
      gameGenre?: string;
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
      gameGenre: options.gameGenre,
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
        retried: 0,
        postEdited: 0,
        percentage: 0
      },
      options: mergedOptions,
      results: {
        totalItems: items.length,
        translatedItems: 0,
        failedItems: 0,
        skippedItems: 0,
        fromMemoryItems: 0,
        postEditedItems: 0,
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

      // Step 3.5: Auto-extraction glossario al primo batch di un nuovo gioco
      if (this.job.gameId) {
        await this.maybeExtractGlossary();
      }

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

    } catch (error: unknown) {
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
      gameGenre: this.job.gameGenre
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

  /**
   * Auto-estrae termini glossario al primo batch di un nuovo gioco.
   * Si attiva solo se autoExtractOnFirstBatch è abilitato e il gioco non ha ancora un glossario.
   */
  private async maybeExtractGlossary(): Promise<void> {
    if (!this.job || !this.job.gameId) return;

    try {
      const config = loadGlossaryConfig();
      if (!config.enabled || !config.autoExtractOnFirstBatch) return;

      // Controlla se il gioco ha già un glossario con termini
      const existing = loadGlossary(this.job.gameId);
      if (existing && existing.entries.length > 0) return;

      // Seleziona testi sorgente dal job per l'estrazione
      const sampleTexts = this.job.items
        .filter(i => i.sourceText.length > 5) // Ignora stringhe troppo corte
        .slice(0, 60)
        .map(i => i.sourceText);

      if (sampleTexts.length < 5) return; // Troppo pochi testi per un'estrazione utile

      clientLogger.debug(`[BatchTranslator] Auto-extracting glossary for game "${this.job.gameName}" (${sampleTexts.length} sample texts)`);
      this.job.progress.statusMessage = 'Extracting glossary terms...';
      this.updateProgress();

      const result = await extractTerms(
        this.job.gameId,
        this.job.gameName || 'Unknown Game',
        sampleTexts,
        this.job.sourceLanguage,
        this.job.targetLanguage,
        this.job.gameGenre
      );

      clientLogger.debug(`[BatchTranslator] Glossary extracted: ${result.newTerms.length} new terms (${result.duplicates} duplicates) via ${result.provider} in ${result.timeMs}ms`);
      this.job.progress.statusMessage = undefined;
    } catch (error: unknown) {
      clientLogger.warn('[BatchTranslator] Auto glossary extraction failed:', error);
      this.job.progress.statusMessage = undefined;
    }
  }

  private async translateItems(): Promise<void> {
    if (!this.job) return;

    const pendingItems = this.job.items.filter(i => i.status === 'pending');
    
    // Prima: cerca match nella Translation Memory (exact + fuzzy ≥90%)
    const itemsNeedingApi: BatchTranslationItem[] = [];

    for (const item of pendingItems) {
      if (this.isCancelled) break;

      // Cerca nella TM: exact via hash (O(1)), poi fuzzy se abilitato
      if (this.job.options.useTranslationMemory) {
        // Fast path: exact match via hash
        const exactMatch = translationMemory.findExact(item.sourceText);
        if (exactMatch) {
          item.translatedText = exactMatch.targetText;
          item.fromMemory = true;
          item.status = 'completed';
          this.job.progress.completed++;
          this.job.progress.fromMemory++;
          this.job.results.translatedItems++;
          this.job.results.fromMemoryItems++;
          this.onItemCompleteCallback?.(item);
          continue;
        }

        // Fuzzy path: cerca match ≥90% — solo per stringhe abbastanza lunghe
        // (stringhe corte come "Yes", "No" hanno falsi positivi con Levenshtein)
        if (item.sourceText.length < 10) {
          itemsNeedingApi.push(item);
          continue;
        }
        const fuzzyResults = translationMemory.search(item.sourceText, {
          minSimilarity: 90,
          maxResults: 1,
          preferVerified: true,
          gameIdFilter: this.job.gameId
        });

        if (fuzzyResults.length > 0 && fuzzyResults[0].similarity >= 90) {
          const fuzzyMatch = fuzzyResults[0];
          item.translatedText = fuzzyMatch.unit.targetText;
          item.fromMemory = true;
          item.status = 'completed';
          this.job.progress.completed++;
          this.job.progress.fromMemory++;
          this.job.results.translatedItems++;
          this.job.results.fromMemoryItems++;
          translationMemory.incrementUsage(fuzzyMatch.unit.id).catch(() => {});
          this.onItemCompleteCallback?.(item);
          clientLogger.debug(`[BatchTranslator] Fuzzy TM match (${fuzzyMatch.similarity}%): "${item.sourceText.substring(0, 40)}..."`);
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
    
    clientLogger.debug(`[BatchTranslator] Starting parallel translation: ${totalBatches} batches, ${PARALLEL_BATCHES} in parallel`);
    
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
      clientLogger.debug(`[BatchTranslator] Calling AI API with fallback for batch ${batchNum}/${totalBatches}, ${batchTexts.length} items`);
      
      // Costruisci glossaryHint se c'è un gameId
      const glossaryHint = this.job.gameId
        ? buildRelevantGlossaryHint(this.job.gameId, batchTexts)
        : '';

      // Context Harvester: estrai contesto automatico dai metadata dei file
      let harvestedContext: BatchHarvestResult | undefined;
      try {
        const harvestInputs: HarvestInput[] = batchItems.map((item, idx) => ({
          text: item.sourceText,
          key: item.metadata?.key,
          filename: item.metadata?.filename,
          lineNumber: item.metadata?.lineNumber,
          comment: item.metadata?.context,
          maxLength: item.metadata?.maxLength,
          previousText: idx > 0 ? batchItems[idx - 1].sourceText : undefined,
          nextText: idx < batchItems.length - 1 ? batchItems[idx + 1].sourceText : undefined,
          gameGenre: this.job?.gameGenre,
          gameName: this.job?.gameName,
        }));
        harvestedContext = harvestBatch(harvestInputs);
        clientLogger.debug(`[BatchTranslator] Context harvested: ${harvestedContext.stats.stringsWithConstraints} constrained, ${harvestedContext.stats.stringsWithPlaceholders} with placeholders`);
      } catch (e: unknown) {
        clientLogger.warn('[BatchTranslator] Context harvest failed, continuing without:', e);
      }

      // RAG: inietta traduzioni simili dalla TM come contesto per coerenza terminologica
      let tmContext = '';
      if (this.job.options.useTranslationMemory) {
        tmContext = translationMemory.getRelevantTMContext(batchTexts, {
          maxPerText: 2,
          maxTotal: 10,
          gameIdFilter: this.job.gameId
        });
      }

      // Componi genre + character profile in contesto coerente
      const composedContext = composeGenreAndCharacterContext({
        genre: this.job.gameGenre as GameGenre | undefined,
        targetLanguage: this.job.targetLanguage,
        characterContext: this.job.options.characterContext,
      });

      const fullContext = [this.job.options.gameContext, composedContext, tmContext].filter(Boolean).join('\n');

      const result = await translateSmart({
        texts: batchTexts,
        targetLanguage: this.job.targetLanguage,
        sourceLanguage: this.job.sourceLanguage || 'en',
        context: fullContext || undefined,
        glossaryHint: glossaryHint || undefined,
        harvestedContext,
        gameGenre: this.job.gameGenre as GameGenre | undefined,
      });
      
      if (!result.success) {
        throw new Error('All translation providers failed');
      }
      
      const translations = result.translations;
      clientLogger.debug(`[BatchTranslator] Translated via ${result.provider}`);
      
      
      // Applica traduzioni e controlla qualità inline
      const itemsToRetry: Array<{ item: BatchTranslationItem; issues: string[] }> = [];

      for (let i = 0; i < batchItems.length; i++) {
        const item = batchItems[i];
        const translated = i < translations.length ? translations[i] : null;

        if (translated) {
          item.translatedText = translated;
          item.fromMemory = false;

          // Quality check inline — solo se abilitato e non siamo già in un retry
          if (this.job.options.runQualityChecks && this.job.options.maxRetries > 0) {
            const qc = quickQualityCheck(item.sourceText, translated, item.metadata?.maxLength);
            if (!qc.passed || qc.score < this.job.options.minQualityScore) {
              itemsToRetry.push({ item, issues: qc.criticalIssues });
              continue; // Non contare come completed ancora
            }
          }

          // Traduzione OK — finalizza
          item.status = 'completed';
          this.job.progress.completed++;
          this.job.results.translatedItems++;

          // Salva in TM per uso futuro (async, non blocca)
          if (this.job.options.saveToMemory) {
            translationMemory.add(item.sourceText, translated, {
              context: item.classification?.type,
              gameId: this.job.gameId,
              provider: this.job.provider,
              confidence: 0.85
            }).catch(() => {});
          }

          // Stima costi
          const tokens = Math.ceil(item.sourceText.length / 4) + Math.ceil(translated.length / 4);
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

      // Quality retry loop — ritenta items con qualità insufficiente
      if (itemsToRetry.length > 0) {
        await this.retryFailedQuality(itemsToRetry, batchNum, totalBatches);
      }
      
    } catch (error: unknown) {
      // Fallback: traduci uno alla volta se batch fallisce
      clientLogger.warn(`[BatchTranslator] Batch ${batchNum} failed, falling back to single:`, error);
      
      for (const item of batchItems) {
        // Skip items already processed before the batch error
        if (item.status === 'completed' || item.status === 'failed') continue;

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

  /**
   * Ritenta traduzione per items che non hanno superato il quality check.
   * Passa i problemi rilevati come contesto aggiuntivo al provider AI.
   */
  private async retryFailedQuality(
    failedItems: Array<{ item: BatchTranslationItem; issues: string[] }>,
    batchNum: number,
    totalBatches: number
  ): Promise<void> {
    if (!this.job) return;

    const maxAttempts = Math.min(this.job.options.maxRetries, 2); // Max 2 retry per qualità

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (failedItems.length === 0) break;
      if (this.isCancelled) break;

      clientLogger.debug(`[BatchTranslator] Quality retry attempt ${attempt}/${maxAttempts} for ${failedItems.length} items (batch ${batchNum}/${totalBatches})`);

      this.job.progress.statusMessage = `Quality retry ${attempt}/${maxAttempts} (${failedItems.length} items)`;
      this.updateProgress();

      // Costruisci contesto con feedback qualità per il provider
      const qualityFeedback = failedItems.map(({ item, issues }) => {
        const issueList = issues.length > 0 ? issues.join('; ') : 'Low quality score';
        return `"${item.sourceText}" → previous: "${item.translatedText}" — issues: ${issueList}`;
      }).join('\n');

      const retryContext = [
        this.job.options.gameContext || '',
        `\n[QUALITY RETRY] The following translations had quality issues. Please fix them:\n${qualityFeedback}`,
        `\nRules: preserve all placeholders ({0}, %s, etc.), respect max length limits, do not leave text untranslated.`
      ].filter(Boolean).join('\n');

      const retryTexts = failedItems.map(f => f.item.sourceText);

      const glossaryHint = this.job.gameId
        ? buildRelevantGlossaryHint(this.job.gameId, retryTexts)
        : '';

      try {
        const result = await translateSmart({
          texts: retryTexts,
          targetLanguage: this.job.targetLanguage,
          sourceLanguage: this.job.sourceLanguage || 'en',
          context: retryContext,
          glossaryHint: glossaryHint || undefined,
        });

        if (!result.success) {
          clientLogger.warn(`[BatchTranslator] Quality retry ${attempt} failed — all providers down`);
          break;
        }

        const stillFailing: Array<{ item: BatchTranslationItem; issues: string[] }> = [];

        for (let i = 0; i < failedItems.length; i++) {
          const { item } = failedItems[i];
          const newTranslation = i < result.translations.length ? result.translations[i] : null;

          if (!newTranslation) {
            stillFailing.push(failedItems[i]);
            continue;
          }

          // Re-check qualità
          const qc = quickQualityCheck(item.sourceText, newTranslation, item.metadata?.maxLength);

          // Stima costi del retry
          const tokens = Math.ceil(item.sourceText.length / 4) + Math.ceil(newTranslation.length / 4);
          this.job.results.totalTokensUsed += tokens;
          this.job.results.estimatedCost += tokens * 0.00002;

          if (qc.passed && qc.score >= this.job.options.minQualityScore) {
            // Retry riuscito — accetta nuova traduzione
            item.translatedText = newTranslation;
            item.status = 'completed';
            this.job.progress.completed++;
            this.job.progress.retried++;
            this.job.results.translatedItems++;

            if (this.job.options.saveToMemory) {
              translationMemory.add(item.sourceText, newTranslation, {
                context: item.classification?.type,
                gameId: this.job.gameId,
                provider: this.job.provider,
                confidence: 0.9 // Confidence più alta per retry riuscito
              }).catch(() => {});
            }

            this.onItemCompleteCallback?.(item);
          } else if (qc.score > quickQualityCheck(item.sourceText, item.translatedText!, item.metadata?.maxLength).score) {
            // Retry parziale — la nuova è meglio della vecchia, accettala ma ritenta ancora
            item.translatedText = newTranslation;
            stillFailing.push({ item, issues: qc.criticalIssues });
          } else {
            // Retry non migliorato — mantieni la vecchia e ritenta
            stillFailing.push(failedItems[i]);
          }
        }

        failedItems = stillFailing;

      } catch (error: unknown) {
        clientLogger.warn(`[BatchTranslator] Quality retry ${attempt} error:`, error);
        break;
      }

      // Piccolo delay tra tentativi di retry
      if (failedItems.length > 0 && attempt < maxAttempts) {
        await this.sleep(this.job.options.retryDelay);
      }
    }

    // Items rimasti dopo tutti i retry — accettali con la miglior traduzione disponibile
    for (const { item } of failedItems) {
      if (item.translatedText) {
        item.status = 'completed';
        this.job.progress.completed++;
        this.job.results.translatedItems++;

        if (this.job.options.saveToMemory) {
          translationMemory.add(item.sourceText, item.translatedText, {
            context: item.classification?.type,
            gameId: this.job.gameId,
            provider: this.job.provider,
            confidence: 0.6 // Confidence bassa — non ha superato QA
          }).catch(() => {});
        }

        this.onItemCompleteCallback?.(item);
      } else {
        item.status = 'failed';
        item.error = 'Quality check failed after retries';
        this.job.progress.failed++;
        this.job.results.failedItems++;
      }
    }

    this.job.progress.statusMessage = undefined;
  }

  private async translateItem(item: BatchTranslationItem): Promise<void> {
    if (!this.job) return;

    // Build context con genre + character composition + harvester
    const composedContext = composeGenreAndCharacterContext({
      genre: this.job.gameGenre as GameGenre | undefined,
      targetLanguage: this.job.targetLanguage,
      characterContext: this.job.options.characterContext,
    });

    const contextParts: string[] = [];
    if (this.job.options.gameContext) contextParts.push(this.job.options.gameContext);
    if (composedContext) contextParts.push(composedContext);
    if (item.classification) contextParts.push(`Content type: ${item.classification.type}`);
    if (item.metadata?.context) contextParts.push(item.metadata.context);

    // Context harvester per singolo item
    try {
      const harvest = harvestBatch([{
        text: item.sourceText,
        key: item.metadata?.key,
        filename: item.metadata?.filename,
        lineNumber: item.metadata?.lineNumber,
        comment: item.metadata?.context,
        maxLength: item.metadata?.maxLength,
        gameGenre: this.job.gameGenre,
        gameName: this.job.gameName,
      }]);
      if (harvest.batchPromptHint) contextParts.push(harvest.batchPromptHint);
      const itemCtx = harvest.contexts[0];
      if (itemCtx?.promptHint && itemCtx.screenConfidence >= 0.3) {
        contextParts.push(itemCtx.promptHint);
      }
    } catch {}

    const context = contextParts.join('\n');

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

    // Step 1: Run quality gates su tutti gli items completati
    const failedQaItems: Array<{ item: BatchTranslationItem; issues: string[] }> = [];

    for (const item of completedItems) {
      if (this.isCancelled) break;
      if (!item.translatedText) continue;

      const report = runQualityGates({
        sourceText: item.sourceText,
        translatedText: item.translatedText,
        context: item.classification?.type as unknown,
        maxLength: item.metadata?.maxLength,
        glossaryTerms: this.job.options.glossaryTerms,
        minQualityScore: this.job.options.minQualityScore
      });

      item.qualityReport = report;
      totalScore += report.overallScore;

      if (!report.passed) {
        const issues = report.checks
          .filter(c => !c.passed)
          .map(c => c.message || c.name);

        if (issues.length > 0) {
          failedQaItems.push({ item, issues });
          this.job.results.qualityIssues.push({
            itemId: item.id,
            sourceText: item.sourceText.substring(0, 50),
            issues
          });
        }
      }
    }

    // Step 2: Auto post-edit per items con QA fallito
    if (failedQaItems.length > 0 && !this.isCancelled) {
      await this.autoPostEdit(failedQaItems);

      // Step 3: Ricalcola score medio includendo items post-editati
      totalScore = 0;
      for (const item of completedItems) {
        totalScore += item.qualityReport?.overallScore || 0;
      }
    }

    this.job.results.averageQualityScore = completedItems.length > 0
      ? Math.round(totalScore / completedItems.length)
      : 0;
  }

  /**
   * Auto-applica suggerimenti di post-editing per items con QA fallito.
   * Solo suggerimenti con confidence ≥75 e che migliorano effettivamente lo score.
   */
  private async autoPostEdit(
    failedItems: Array<{ item: BatchTranslationItem; issues: string[] }>
  ): Promise<void> {
    if (!this.job) return;

    const MIN_POST_EDIT_CONFIDENCE = 75;

    if (this.isCancelled) return;

    clientLogger.debug(`[BatchTranslator] Auto post-editing ${failedItems.length} items with QA issues`);
    this.job.progress.statusMessage = `Post-editing ${failedItems.length} items...`;
    this.updateProgress();

    // Prepara le richieste di post-edit
    const postEditRequests: PostEditRequest[] = failedItems.map(({ item, issues }) => ({
      original: item.sourceText,
      translation: item.translatedText!,
      targetLang: this.job!.targetLanguage,
      sourceLang: this.job!.sourceLanguage || 'en',
      genre: this.job!.gameGenre as unknown,
      context: item.metadata?.context,
      qaScore: item.qualityReport?.overallScore,
      qaIssues: issues,
    }));

    try {
      const suggestions = await suggestBatchImprovements(
        postEditRequests,
        (done, total) => {
          this.job!.progress.statusMessage = `Post-editing ${done}/${total}...`;
          this.updateProgress();
        }
      );

      // Applica suggerimenti con confidence sufficiente
      suggestions.forEach((suggestion, idx) => {
        const { item } = failedItems[idx];

        if (suggestion.confidence < MIN_POST_EDIT_CONFIDENCE) {
          clientLogger.debug(`[BatchTranslator] Post-edit skipped (confidence ${suggestion.confidence}): "${item.sourceText.substring(0, 40)}..."`);
          return;
        }

        // Verifica che il post-edit migliori effettivamente lo score QA
        const newReport = runQualityGates({
          sourceText: item.sourceText,
          translatedText: suggestion.improved,
          context: item.classification?.type as unknown,
          maxLength: item.metadata?.maxLength,
          glossaryTerms: this.job!.options.glossaryTerms,
          minQualityScore: this.job!.options.minQualityScore,
        });

        const oldScore = item.qualityReport?.overallScore || 0;

        if (newReport.overallScore > oldScore) {
          // Post-edit accettato — migliora lo score
          item.translatedText = suggestion.improved;
          item.qualityReport = newReport;
          this.job!.progress.postEdited++;
          this.job!.results.postEditedItems++;

          // Traccia costi del post-edit (input originale + output migliorato)
          const peTokens = Math.ceil(item.sourceText.length / 4) + Math.ceil(item.translatedText!.length / 4) + Math.ceil(suggestion.improved.length / 4);
          this.job!.results.totalTokensUsed += peTokens;
          this.job!.results.estimatedCost += peTokens * 0.00002;

          // Aggiorna TM con la versione migliorata
          if (this.job!.options.saveToMemory) {
            translationMemory.add(item.sourceText, suggestion.improved, {
              context: item.classification?.type,
              gameId: this.job!.gameId,
              provider: this.job!.provider,
              confidence: 0.92, // Alta confidence per post-edit verificato
            }).catch(() => {});
          }

          clientLogger.debug(`[BatchTranslator] Post-edit applied (${oldScore}→${newReport.overallScore}): "${item.sourceText.substring(0, 40)}..."`);
        } else {
          clientLogger.debug(`[BatchTranslator] Post-edit rejected (score not improved ${oldScore}→${newReport.overallScore}): "${item.sourceText.substring(0, 40)}..."`);
        }
      });
    } catch (error: unknown) {
      clientLogger.warn('[BatchTranslator] Auto post-edit failed:', error);
    }

    this.job.progress.statusMessage = undefined;
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
