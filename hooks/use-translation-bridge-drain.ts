'use client';

/**
 * Aggancia il drain loop del Translation Bridge al ciclo di vita di React.
 *
 * Vedi `lib/translation-bridge-drain.ts` per il perché: quando la DLL iniettata
 * chiede una stringa sconosciuta, il server la accoda come cache miss; questo
 * loop la traduce con lo stack AI dell'app e la rimette nel dizionario, così
 * dal secondo avvistamento è un hit.
 */

import { useEffect, useRef, useState } from 'react';
import { appDataDir, join } from '@tauri-apps/api/path';

import { clientLogger } from '@/lib/client-logger';
import { translationBridge } from '@/lib/translation-bridge';
import { translateWithFallback } from '@/lib/ai/ai-translate-direct';
import {
  TranslationBridgeDrain,
  type DrainOptions,
  type DrainStats,
} from '@/lib/translation-bridge-drain';

/** Sottocartella dei dizionari appresi, dentro la app data dir di Tauri. */
const DICT_SUBDIR = 'bridge-dictionaries';

export interface UseTranslationBridgeDrainOptions extends DrainOptions {
  /** Il loop parte solo quando è true (es. traduzione in tempo reale attiva). */
  enabled: boolean;
  targetLanguage?: string;
  sourceLanguage?: string;
}

/**
 * @returns le statistiche correnti del loop, per mostrarle nella UI.
 */
export function useTranslationBridgeDrain({
  enabled,
  targetLanguage = 'it',
  sourceLanguage = 'auto',
  ...drainOptions
}: UseTranslationBridgeDrainOptions): DrainStats | null {
  const [stats, setStats] = useState<DrainStats | null>(null);
  const loopRef = useRef<TranslationBridgeDrain | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let dictDir: string | null = null;

    const run = async () => {
      // Ricarica quello che le sessioni precedenti hanno imparato: è ciò che
      // rende il tetto di spesa sostenibile nel tempo.
      try {
        dictDir = await join(await appDataDir(), DICT_SUBDIR);
        const loaded = await translationBridge.loadFromDir(dictDir);
        if (loaded > 0) {
          clientLogger.info(`[BridgeDrain] Ricaricate ${loaded} traduzioni apprese`);
        }
      } catch (error: unknown) {
        clientLogger.warn(`[BridgeDrain] Dizionari appresi non ricaricati: ${String(error)}`);
      }
      if (cancelled) return;

      const loop = new TranslationBridgeDrain(
        {
          drainMisses: (max) => translationBridge.drainMisses(max),
          translate: async (texts) => {
            const res = await translateWithFallback(
              { texts, targetLanguage, sourceLanguage },
              true, // preferWebApis: provider gratuiti senza chiave, come l'overlay
            );
            return { translations: res.translations, success: res.success };
          },
          addTranslation: (original, translated) =>
            translationBridge.addTranslation(original, translated),
          save: dictDir
            ? async () => {
                await translationBridge.saveToDir(dictDir as string);
              }
            : undefined,
        },
        drainOptions,
        (s) => setStats({ ...s }),
      );

      loopRef.current = loop;
      loop.start();
    };

    void run();

    return () => {
      cancelled = true;
      loopRef.current?.stop();
      // Ultimo salvataggio: quello imparato dopo l'ultima soglia andrebbe perso.
      if (dictDir && (loopRef.current?.stats.learned ?? 0) > 0) {
        void translationBridge.saveToDir(dictDir);
      }
      loopRef.current = null;
    };
    // drainOptions è uno spread di primitivi: si stabilizza sui suoi campi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    targetLanguage,
    sourceLanguage,
    drainOptions.intervalMs,
    drainOptions.batchSize,
    drainOptions.maxTranslationsPerSession,
    drainOptions.saveEvery,
  ]);

  return stats;
}
