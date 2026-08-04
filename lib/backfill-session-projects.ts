'use client';

/**
 * Backfill dei progetti dai translation_session.json nelle cartelle dei giochi.
 *
 * Perché esiste (04/08/2026): fino a oggi l'apply UE non registrava alcun
 * progetto — la patch nasceva e moriva nella cartella del gioco. I lavori
 * passati (es. Below, Rusted Gods) hanno lasciato però una traccia solida:
 * GameStringer/translation_session.json accanto al gioco, scritto dal flusso
 * di traduzione Unreal con gameName, lingue e tutte le entries. Qui lo
 * rileggiamo e ricostruiamo la scheda in Progetti, senza rifare nulla.
 *
 * In più persistiamo le stringhe in %LOCALAPPDATA% via save_translation_strings,
 * così anche il pulsante Esporta (.gspack) funziona su questi progetti.
 *
 * Idempotente (createOrGetProject dedup per gameId/percorso + contatori che
 * SOLO salgono) e parco: gira una volta per sessione app, legge soltanto i
 * giochi installati e ignora in silenzio chi non ha il file.
 */

import { invoke } from '@/lib/tauri-api';
import { projectService } from '@/lib/services/translation-projects';
import { gamePathKey, cleanGamePath } from '@/lib/game-path';
import { clientLogger } from '@/lib/client-logger';

interface SessionEntry { namespace?: string; key: string; original: string; translated?: string }
interface SessionFile {
  gameName?: string;
  gameId?: string;
  gamePath?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  entries?: SessionEntry[];
}

interface InstalledGame { id: string; title: string; path: string; engine?: string; image?: string }

// Guardia a TEMPO, non una-tantum (corretta 04/08 sera, trovata alla prima
// prova reale): con il flag "una volta per sessione", il progetto di una
// traduzione appena finita non compariva finché non riavviavi l'app.
// 60 secondi tengono la pagina reattiva senza rifare gli scan a ogni click.
let lastRunAt = 0;
const MIN_INTERVAL_MS = 60_000;

async function listInstalledGames(): Promise<InstalledGame[]> {
  const games: InstalledGame[] = [];

  // Steam locale: veloce, nessuna rete.
  try {
    const steam = await invoke<Array<{
      id: string; title: string; install_path: string | null;
      is_installed: boolean; engine: string | null; header_image: string | null;
    }>>('scan_all_steam_games_fast');
    for (const g of steam || []) {
      if (g.is_installed && g.install_path) {
        games.push({ id: g.id, title: g.title, path: g.install_path, engine: g.engine || undefined, image: g.header_image || undefined });
      }
    }
  } catch (e: unknown) {
    clientLogger.debug('[SessionBackfill] scan Steam non disponibile:', String(e));
  }

  // Altri store (Epic, GOG, ...): con timeout, il backfill non deve mai
  // rallentare la pagina Progetti.
  try {
    const others = await Promise.race([
      invoke<Array<{ id: string; title: string; path: string; is_installed: boolean; engine?: string; header_image?: string }>>('scan_games'),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);
    for (const g of others || []) {
      if (g.is_installed && g.path) {
        games.push({ id: g.id, title: g.title, path: g.path, engine: g.engine, image: g.header_image });
      }
    }
  } catch (e: unknown) {
    clientLogger.debug('[SessionBackfill] scan altri store saltato:', String(e));
  }

  return games;
}

export async function backfillSessionProjects(): Promise<number> {
  if (Date.now() - lastRunAt < MIN_INTERVAL_MS) return 0;
  lastRunAt = Date.now();

  const games = await listInstalledGames();
  if (games.length === 0) return 0;

  let created = 0;
  const seenPaths = new Set<string>();

  for (const game of games) {
    const pathKey = gamePathKey(game.path);
    if (seenPaths.has(pathKey)) continue; // stesso gioco da due scan
    seenPaths.add(pathKey);

    let session: SessionFile;
    try {
      const raw = await invoke<string>('read_text_file', {
        path: `${cleanGamePath(game.path)}/GameStringer/translation_session.json`,
      });
      session = JSON.parse(raw);
    } catch {
      continue; // nessuna sessione: il caso normale per quasi tutti i giochi
    }

    const entries = session.entries || [];
    if (entries.length === 0) continue;
    const translated = entries.filter(e => e.translated && e.translated !== e.original).length;
    if (translated === 0) continue;

    const targetLang = session.targetLanguage || 'it';
    const gameId = session.gameId || game.id || pathKey;

    try {
      const proj = await projectService.createOrGetProject({
        gameId,
        gameName: session.gameName || game.title,
        gameImage: game.image,
        engine: game.engine || 'Unreal Engine',
        sourceLanguage: session.sourceLanguage || 'en',
        targetLanguage: targetLang,
        gamePathKey: pathKey,
        files: [{ path: game.path, name: 'translation_session', type: 'unreal', strings: entries.length }],
      });

      // Contatori: SOLO alzare, mai abbassare (stessa regola del backfill
      // Visionaire — il backfill integra, non corregge).
      proj.totalStrings = Math.max(proj.totalStrings || 0, entries.length);
      proj.translatedStrings = Math.max(proj.translatedStrings || 0, translated);
      proj.progress = proj.totalStrings > 0
        ? Math.min(100, Math.round((proj.translatedStrings / proj.totalStrings) * 100))
        : 0;
      if (proj.progress >= 100) proj.status = 'completed';
      await projectService.saveProject(proj);

      // Persisti le stringhe su disco: rende funzionante Esporta (.gspack)
      // anche per i lavori ricostruiti. Best-effort.
      await invoke('save_translation_strings', {
        strings: {
          gameId: proj.gameId,
          sourceLanguage: session.sourceLanguage || 'en',
          targetLanguage: targetLang,
          exportedAt: new Date().toISOString(),
          entries: entries.map(e => ({
            key: e.namespace ? `${e.namespace}::${e.key}` : e.key,
            source: e.original,
            target: e.translated || '',
            filePath: null,
            context: e.namespace || null,
            status: e.translated && e.translated !== e.original ? 'translated' : 'pending',
          })),
        },
      }).catch((e: unknown) => clientLogger.debug('[SessionBackfill] persist stringhe fallita:', String(e)));

      created++;
      clientLogger.debug(`[SessionBackfill] Progetto ricostruito: ${proj.gameName} (${translated}/${entries.length} ${targetLang})`);
    } catch (e: unknown) {
      clientLogger.warn(`[SessionBackfill] fallito per ${game.title}: ${String(e)}`);
    }
  }

  return created;
}
