/**
 * Whitelist relazioni-publisher: giochi per cui tradurre non ha senso o non e' gradito.
 * Logica PURA e testabile (nessuna rete/DOM). Dato in data/publisher-whitelist.json.
 * Vedi docs/PUBLISHER_RELATIONS.md.
 *
 * - reason 'official_localization': esiste gia' la localizzazione ufficiale nelle
 *   `languages` -> avviso NON bloccante quando la lingua target e' tra quelle.
 * - reason 'publisher_request': il publisher ha chiesto di non tradurre -> BLOCCANTE.
 *   `languages` vuoto = tutte le lingue; altrimenti solo quelle elencate.
 */

export type WhitelistReason = 'official_localization' | 'publisher_request';

export interface WhitelistEntry {
  title?: string;
  appId?: number;
  reason: WhitelistReason;
  /** Codici lingua ISO (es. "it"). Vuoto per publisher_request = tutte. */
  languages?: string[];
  note?: string;
  source?: string;
}

export interface PublisherWhitelist {
  version: number;
  updated?: string;
  entries: WhitelistEntry[];
}

export interface WhitelistVerdict {
  /** true = disabilita il flusso di traduzione/publish per questo gioco+lingua. */
  blocked: boolean;
  /** true = mostra un avviso non bloccante (localizzazione ufficiale disponibile). */
  notice: boolean;
  reason: WhitelistReason;
  note?: string;
  source?: string;
}

/** Normalizza un titolo per il confronto: minuscole, via simboli e spazi multipli. */
export function normalizeTitle(title: string | null | undefined): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[™®©]/g, '') // ™ ® ©
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function entryMatchesGame(
  entry: WhitelistEntry,
  game: { appId?: number | null; title?: string | null }
): boolean {
  const gAppId = Number(game.appId) || 0;
  if (gAppId > 0 && Number(entry.appId) > 0 && gAppId === Number(entry.appId)) return true;
  const gTitle = normalizeTitle(game.title);
  const eTitle = normalizeTitle(entry.title);
  return gTitle.length > 0 && gTitle === eTitle;
}

/**
 * Cerca un verdetto per il gioco + lingua target. Ritorna null se il gioco non e'
 * in whitelist (o la voce non riguarda la lingua richiesta). La prima voce
 * bloccante vince sulle voci di solo-avviso.
 */
export function matchWhitelist(
  game: { appId?: number | null; title?: string | null },
  targetLang: string,
  whitelist: PublisherWhitelist | null | undefined
): WhitelistVerdict | null {
  if (!whitelist || !Array.isArray(whitelist.entries)) return null;
  const lang = (targetLang || '').toLowerCase();
  let noticeVerdict: WhitelistVerdict | null = null;

  for (const entry of whitelist.entries) {
    if (!entryMatchesGame(entry, game)) continue;
    const langs = (entry.languages || []).map((l) => l.toLowerCase());

    if (entry.reason === 'publisher_request') {
      // Vuoto = tutte le lingue; altrimenti solo quelle elencate.
      if (langs.length === 0 || langs.includes(lang)) {
        return { blocked: true, notice: false, reason: 'publisher_request', note: entry.note, source: entry.source };
      }
      continue;
    }

    if (entry.reason === 'official_localization') {
      if (langs.includes(lang) && !noticeVerdict) {
        noticeVerdict = { blocked: false, notice: true, reason: 'official_localization', note: entry.note, source: entry.source };
      }
    }
  }

  return noticeVerdict;
}
