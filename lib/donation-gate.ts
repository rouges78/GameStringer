/**
 * Soft paywall / donation gate
 * Gratis fino a FREE_TRANSLATION_LIMIT stringhe, poi chiede donazione.
 * L'utente può sbloccare con "Ho donato" (honor system) o codice supporter.
 */

const FREE_TRANSLATION_LIMIT = 500;
const STORAGE_KEY = 'gameStringer_translationCount';
const SUPPORTER_KEY = 'gameStringer_supporter';

/** Ottieni il conteggio totale di stringhe tradotte */
export function getTranslationCount(): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

/** Incrementa il conteggio di stringhe tradotte */
export function addTranslationCount(count: number): number {
  const current = getTranslationCount();
  const newCount = current + count;
  try {
    localStorage.setItem(STORAGE_KEY, String(newCount));
  } catch {}
  return newCount;
}

/** Controlla se l'utente è supporter (ha sbloccato) */
export function isSupporter(): boolean {
  try {
    return localStorage.getItem(SUPPORTER_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Sblocca come supporter */
export function unlockSupporter(): void {
  try {
    localStorage.setItem(SUPPORTER_KEY, 'true');
  } catch {}
}

/** Reset supporter status (per debug) */
export function resetSupporter(): void {
  try {
    localStorage.removeItem(SUPPORTER_KEY);
  } catch {}
}

/** Controlla se può tradurre (sotto il limite o supporter) */
export function canTranslate(): { allowed: boolean; count: number; limit: number; remaining: number } {
  const count = getTranslationCount();
  const supporter = isSupporter();
  const remaining = Math.max(0, FREE_TRANSLATION_LIMIT - count);
  
  return {
    allowed: supporter || count < FREE_TRANSLATION_LIMIT,
    count,
    limit: FREE_TRANSLATION_LIMIT,
    remaining: supporter ? Infinity : remaining,
  };
}

/** Limite gratuito */
export const FREE_LIMIT = FREE_TRANSLATION_LIMIT;

/* ────────────────────────────────────────────────────────────────────────────
 * RINGRAZIAMENTO DOPO UN SUCCESSO VERO (10/08/2026)
 *
 * PERCHÉ ESISTE — fino a stasera `canTranslate` e `addTranslationCount` erano
 * invocati da UN SOLO componente, `translation-recommendation.tsx`: la seconda
 * pipeline, quella che simulava la barra 0→100 e annunciava traduzioni mai
 * fatte. Quindi il contatore contava stringhe FINTE, e chi usava «String it!»
 * — l'unico percorso che traduce davvero — non è mai stato contato e non ha
 * mai visto una richiesta di supporto. Rimossa quella pipeline, il contatore
 * è diventato irraggiungibile del tutto e sarebbe restato a zero per sempre.
 *
 * Ora il conteggio si aggancia all'unico punto che ha un verdetto onesto:
 * `effectVerdict(...).verifiedOk`, cioè il verde che «si merita, non si
 * concede» — scrittura reale nel gioco più controprova su disco.
 *
 * ⚠️ NESSUN BLOCCO. `canTranslate()` resta esportata ma non è invocata da
 * nessun flusso: il conteggio serve a dire un numero vero («hai tradotto N
 * stringhe»), non a sbarrare la strada. Se un giorno si vorrà il soft paywall,
 * la decisione è di prodotto e va presa apposta — non deve riaccendersi da
 * sola perché qualcuno ricabla un contatore.
 * ──────────────────────────────────────────────────────────────────────────── */

const SUPPORT_ASKED_KEY = 'gameStringer_supportAskedAt';

/** Distanza minima fra due richieste. Chiedere a ogni traduzione è molestia. */
const GIORNI_FRA_RICHIESTE = 30;

/**
 * Si può chiedere un contributo adesso?
 *
 * Falso per i supporter (hanno già dato: richiederglielo è sgarbato) e falso
 * se abbiamo già chiesto da meno di 30 giorni. In caso di dubbio — storage
 * illeggibile, data incomprensibile — si risponde NO: il costo di una
 * richiesta di troppo è un utente infastidito, quello di una in meno è zero.
 */
export function shouldAskForSupport(): boolean {
  if (isSupporter()) return false;
  try {
    const raw = localStorage.getItem(SUPPORT_ASKED_KEY);
    // ⚠️ `=== null` e NON `!raw`: la stringa vuota è falsy, quindi con `!raw`
    // una chiave presente ma VUOTA — cioè una scrittura andata storta —
    // sarebbe stata letta come «non abbiamo mai chiesto», autorizzando una
    // richiesta a ogni singola patch. Assente e corrotto sono due stati
    // diversi: il primo è un permesso, il secondo un dubbio. Stessa forma del
    // difetto di "Unknown", che essendo una stringa truthy si travestiva da
    // risposta valida. Trovato da un test prima di spedirlo, non dopo.
    if (raw === null) return true;
    const last = Number(raw);
    if (!Number.isFinite(last) || last <= 0) return false;
    const giorni = (Date.now() - last) / 86_400_000;
    // Data nel futuro (orologio spostato): non è un invito a insistere.
    if (giorni < 0) return false;
    return giorni >= GIORNI_FRA_RICHIESTE;
  } catch {
    return false;
  }
}

/** Segna che abbiamo appena chiesto, così non si ripete alla prossima patch. */
export function markSupportAsked(): void {
  try {
    localStorage.setItem(SUPPORT_ASKED_KEY, String(Date.now()));
  } catch {}
}

