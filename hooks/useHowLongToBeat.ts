'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface HltbData {
  found: boolean;
  main?: number;
  main_extra?: number;
  completionist?: number;
  game_name?: string;
  url?: string;
}

// Cache globale per evitare richieste ripetute
const hltbCache = new Map<string, HltbData>();

export function useHowLongToBeat(gameName: string | undefined, enabled = true) {
  const [data, setData] = useState<HltbData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameName || !enabled) return;

    // Controlla cache
    const cached = hltbCache.get(gameName);
    if (cached) {
      setData(cached);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await invoke<HltbData>('get_howlongtobeat_info', { gameName });
        hltbCache.set(gameName, result);
        setData(result);
      } catch (err) {
        console.error('HLTB error:', err);
        const notFound = { found: false };
        hltbCache.set(gameName, notFound);
        setData(notFound);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gameName, enabled]);

  return { data, loading };
}

// Funzione per precaricare HLTB per una lista di giochi
export async function prefetchHltb(gameNames: string[]) {
  const uncached = gameNames.filter(name => !hltbCache.has(name));
  
  // Carica max 5 alla volta per non sovraccaricare
  for (let i = 0; i < uncached.length; i += 5) {
    const batch = uncached.slice(i, i + 5);
    await Promise.all(
      batch.map(async (name) => {
        try {
          const result = await invoke<HltbData>('get_howlongtobeat_info', { gameName: name });
          hltbCache.set(name, result);
        } catch {
          hltbCache.set(name, { found: false });
        }
      })
    );
    // Pausa tra batch per evitare rate limiting
    if (i + 5 < uncached.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// Funzione per ottenere dati dalla cache senza fetch
export function getHltbFromCache(gameName: string): HltbData | undefined {
  return hltbCache.get(gameName);
}
