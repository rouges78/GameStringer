import {
  BatchTranslator,
  type BatchOptions,
  type BatchProgress,
  type BatchTranslationItem,
  type BatchTranslationJob,
} from '@/lib/batch/batch-translator';
import { writeFile, type ParseResult } from '@/lib/file-parsers';

export interface CancellableTranslateOptions extends Partial<BatchOptions> {
  sourceLanguage: string;
  targetLanguage: string;
  provider: BatchTranslationJob['provider'];
  gameId?: string;
  gameName?: string;
  onProgress?: (progress: BatchProgress) => void;
  onItemComplete?: (item: BatchTranslationItem) => void;
}

/**
 * Same steps as translateFile() in lib/neural-translator, but the BatchTranslator
 * stays reachable so an AbortSignal can stop it. translateFile() builds its
 * translator internally with no way to cancel it, so "Annulla" and "Salva parziali"
 * in Translator Pro only hid the UI while the paid API calls went on to the end.
 *
 * Returns null when the signal aborted: a cancelled job is not a result.
 * Callbacks stop firing as soon as the signal aborts, even for batches already in flight.
 */
export async function translateFileCancellable(
  parseResult: ParseResult,
  filename: string,
  options: CancellableTranslateOptions,
  signal: AbortSignal,
): Promise<{ translatedContent: string; job: BatchTranslationJob } | null> {
  if (signal.aborted) return null;

  const { onProgress, onItemComplete, ...jobOptions } = options;
  const translator = new BatchTranslator();
  translator.createJob(
    parseResult.strings.map(s => ({
      text: s.value,
      key: s.key,
      filename,
      context: s.context,
    })),
    { name: `Translate ${filename}`, ...jobOptions },
  );

  if (onProgress) {
    translator.onProgress(p => { if (!signal.aborted) onProgress(p); });
  }
  if (onItemComplete) {
    translator.onItemComplete(item => { if (!signal.aborted) onItemComplete(item); });
  }

  const stop = () => translator.cancel();
  signal.addEventListener('abort', stop);
  let job: BatchTranslationJob;
  try {
    job = await translator.start();
  } finally {
    signal.removeEventListener('abort', stop);
  }
  if (signal.aborted) return null;

  const translations = new Map<string, string>();
  for (const item of job.items) {
    if (item.status === 'completed' && item.translatedText) {
      translations.set(item.metadata?.key || item.sourceText, item.translatedText);
    }
  }

  return {
    translatedContent: writeFile(parseResult, translations, {
      preserveComments: true,
      preserveMetadata: true,
    }),
    job,
  };
}
