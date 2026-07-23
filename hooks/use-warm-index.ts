/**
 * Hook condiviso per la pre-indicizzazione semantica ("Indicizza ora").
 *
 * Prima la logica viveva solo dentro app/settings/page.tsx, quindi per scaldare
 * l'indice di un gioco bisognava andare in Impostazioni e ripescarlo da una
 * tendina. Estratta qui per poterla richiamare anche dove il contesto gioco e'
 * gia' attivo (schermata del gioco), senza duplicare il flusso TM + glossario +
 * lore.
 *
 * Tutto fail-open: se Ollama o il modello embedding non ci sono, `run` non
 * lancia e restituisce semplicemente `ok: false`.
 */
import { useCallback, useState } from 'react';

export interface WarmIndexProgress {
  done: number;
  total: number;
}

export interface WarmIndexOutcome {
  ok: boolean;
  /** true se non c'era nulla da indicizzare (TM vuota, nessun glossario, nessun lore) */
  empty: boolean;
  tmIndexed: number;
  tmTotal: number;
  glIndexed: number;
  glTotal: number;
  loreIndexed: number;
  loreTotal: number;
}

const EMPTY: WarmIndexOutcome = {
  ok: false, empty: true,
  tmIndexed: 0, tmTotal: 0, glIndexed: 0, glTotal: 0, loreIndexed: 0, loreTotal: 0,
};

export function useWarmIndex() {
  const [indexing, setIndexing] = useState(false);
  const [progress, setProgress] = useState<WarmIndexProgress | null>(null);

  const run = useCallback(async (params: {
    sourceLang: string;
    targetLang: string;
    /** Se presente, indicizza anche il glossario di questo gioco. */
    gameId?: string;
    /** Il lore e' un indice globale sui dialoghi: si puo' saltare. */
    includeLore?: boolean;
  }): Promise<WarmIndexOutcome> => {
    const { sourceLang, targetLang, gameId, includeLore = true } = params;
    setIndexing(true);
    setProgress({ done: 0, total: 0 });
    try {
      const { warmSemanticIndex } = await import('@/lib/ai/semantic-retriever');
      const res = await warmSemanticIndex(
        { sourceLang, targetLang, gameId: gameId || undefined },
        (done, total) => setProgress({ done, total })
      );

      let loreIndexed = 0;
      let loreTotal = 0;
      if (includeLore) {
        try {
          const { loreAssistant } = await import('@/lib/lore-assistant');
          const lore = await loreAssistant?.warmLoreIndex();
          if (lore?.ok) {
            loreIndexed = lore.indexed;
            loreTotal = lore.total;
          }
        } catch { /* lore assistant non disponibile: ignora */ }
      }

      if (!res.ok) return EMPTY;

      return {
        ok: true,
        empty: res.tmTotal === 0 && res.glTotal === 0 && loreTotal === 0 && loreIndexed === 0,
        tmIndexed: res.tmIndexed,
        tmTotal: res.tmTotal,
        glIndexed: res.glIndexed,
        glTotal: res.glTotal,
        loreIndexed,
        loreTotal,
      };
    } catch {
      return EMPTY;
    } finally {
      setIndexing(false);
      setProgress(null);
    }
  }, []);

  return { run, indexing, progress };
}
