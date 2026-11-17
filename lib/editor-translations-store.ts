/**
 * Store locale (IndexedDB via storageManager) dei record di traduzione dell'editor —
 * la "Translation Memory" per-stringa. Sostituisce le /api/translations, che nel
 * desktop impacchettato sono stub 501. Lo shape è quello che l'editor già usa
 * (id, gameId, originalText, translatedText, status, sourceLanguage, targetLanguage…).
 */

import { storageManager } from '@/lib/storage-manager';

export interface EditorTranslationFilter {
  gameId?: string; // 'all' o assente = tutti
  status?: string; // 'all' o assente = tutti
}

type Row = Record<string, unknown>;

// Lettura e scrittura strict: ogni scrittura qui riscrive l'intera lista, quindi
// una lettura fallita trattata come [] cancellerebbe tutte le stringhe, e una
// scrittura fallita non deve risultare salvata. Gli errori arrivano al chiamante.
async function readAll(): Promise<Row[]> {
  const data = await storageManager.getTranslationsStrict();
  return Array.isArray(data) ? (data as Row[]) : [];
}

/** Lista i record, filtrati per gioco/stato (client-side). Rigetta se lo store non è leggibile. */
export async function listEditorTranslations(filter: EditorTranslationFilter = {}): Promise<Row[]> {
  let rows = await readAll();
  if (filter.gameId && filter.gameId !== 'all') rows = rows.filter((r) => r.gameId === filter.gameId);
  if (filter.status && filter.status !== 'all') rows = rows.filter((r) => r.status === filter.status);
  return rows;
}

/** Inserisce o aggiorna un record per id. Rigetta se lettura o scrittura falliscono. */
export async function upsertEditorTranslation(rec: Row): Promise<void> {
  await upsertEditorTranslations([rec]);
}

/**
 * Inserisce o aggiorna più record per id con una sola lettura e una sola
 * scrittura (un upsert per record riscriverebbe l'intera lista ogni volta).
 * Rigetta se lettura o scrittura falliscono: in quel caso lo store non cambia.
 */
export async function upsertEditorTranslations(recs: Row[]): Promise<void> {
  if (recs.length === 0) return;
  const rows = await readAll();
  const index = new Map<unknown, number>();
  rows.forEach((r, i) => { if (!index.has(r.id)) index.set(r.id, i); });
  for (const rec of recs) {
    const idx = index.get(rec.id);
    if (idx !== undefined) {
      rows[idx] = { ...rows[idx], ...rec };
    } else {
      index.set(rec.id, rows.length);
      rows.push(rec);
    }
  }
  await storageManager.saveTranslationsStrict(rows);
}

/** Rimuove un record per id. Rigetta se lettura o scrittura falliscono. */
export async function removeEditorTranslation(id: string): Promise<void> {
  const rows = (await readAll()).filter((r) => r.id !== id);
  await storageManager.saveTranslationsStrict(rows);
}

/** Costruisce il contenuto di export client-side (JSON / CSV / PO minimale). */
export function buildTranslationExport(rows: Row[], format: 'json' | 'csv' | 'po'): { content: string; mime: string } {
  if (format === 'csv') {
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const header = 'original,translated,status,targetLanguage';
    const lines = rows.map((r) => [r.originalText, r.translatedText, r.status, r.targetLanguage].map(esc).join(','));
    return { content: [header, ...lines].join('\n'), mime: 'text/csv' };
  }
  if (format === 'po') {
    const po = rows
      .map((r) => `msgid ${JSON.stringify(String(r.originalText ?? ''))}\nmsgstr ${JSON.stringify(String(r.translatedText ?? ''))}\n`)
      .join('\n');
    return { content: po, mime: 'text/plain' };
  }
  return { content: JSON.stringify(rows, null, 2), mime: 'application/json' };
}
