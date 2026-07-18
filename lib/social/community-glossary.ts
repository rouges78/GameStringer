/**
 * Glossari community condivisi per gioco (roadmap P1 Qualità).
 *
 * Chi traduce un gioco parte dal glossario già validato da altri:
 * - publishGameGlossary: pubblica il glossario locale (auto-glossary) su
 *   Supabase (upsert per game/lingua/autore, max 500 voci).
 * - listCommunityGlossaries: varianti disponibili per gioco/lingua (senza
 *   termini: lista leggera).
 * - importCommunityGlossary: merge NON distruttivo nel glossario locale
 *   (aggiunge solo i termini nuovi; le voci esistenti dell'utente vincono).
 *
 * Fail-open come il resto del Community Hub: senza backend o sessione le
 * funzioni ritornano vuoto/false senza rompere la UI.
 */

import { clientLogger } from '@/lib/client-logger';
import {
  loadGlossary,
  createGlossary,
  addTerm,
  type AutoGlossaryEntry,
  type GlossaryCategory,
} from '@/lib/auto-glossary';

/** Termine compatto nel payload remoto. */
interface RemoteTerm {
  s: string;            // sourceTerm
  t: string;            // targetTerm
  c?: string;           // context
  dnt?: boolean;        // doNotTranslate
  cat?: string;         // category
}

export interface CommunityGlossaryInfo {
  id: string;
  gameId: string;
  gameName: string;
  sourceLanguage: string;
  targetLanguage: string;
  termsCount: number;
  authorId: string;
  authorUsername: string;
  downloads: number;
  updatedAt: string;
}

export interface GlossaryImportResult {
  ok: boolean;
  added: number;        // termini aggiunti al glossario locale
  skipped: number;      // già presenti (le voci dell'utente vincono)
  total: number;        // termini nel glossario remoto
}

const MAX_TERMS = 500;

/**
 * Pubblica (upsert) il glossario locale del gioco sul Community Hub.
 * Richiede sessione attiva (stesso bridge del publish pack).
 * Ritorna false se non c'è glossario locale o backend non disponibile;
 * propaga 'community-hub:online-login-required' se manca la sessione.
 */
export async function publishGameGlossary(gameId: string): Promise<boolean> {
  const glossary = loadGlossary(gameId);
  if (!glossary || glossary.entries.length === 0) return false;

  const backend = await import('./community-hub-backend').catch(() => null);
  if (!backend || !backend.isBackendEnabled()) return false;

  // Bridge profilo-locale → utente Supabase (come publishPack).
  try {
    const { autoSyncGSToSupabase } = await import('./community-chat');
    await autoSyncGSToSupabase();
  } catch { /* senza bridge getCurrentUser resterà null sotto */ }
  const user = await backend.getCurrentUser();
  if (!user) throw new Error('community-hub:online-login-required');

  const terms: RemoteTerm[] = glossary.entries.slice(0, MAX_TERMS).map((e) => {
    const t: RemoteTerm = { s: e.sourceTerm, t: e.targetTerm };
    if (e.context) t.c = e.context;
    if (e.doNotTranslate) t.dnt = true;
    if (e.category) t.cat = e.category;
    return t;
  });

  const supabase = await backend.getSupabase();
  const { error } = await supabase.from('game_glossaries').upsert(
    {
      game_id: glossary.gameId,
      game_name: glossary.gameName || glossary.gameId,
      source_language: glossary.sourceLang || 'en',
      target_language: glossary.targetLang,
      terms,
      terms_count: terms.length,
      author_id: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'game_id,target_language,author_id' }
  );
  if (error) {
    clientLogger.warn(`[CommunityGlossary] publish fallita: ${error.message}`);
    return false;
  }
  clientLogger.info(`[CommunityGlossary] Pubblicato glossario ${glossary.gameId} (${terms.length} termini)`);
  return true;
}

/** Varianti community disponibili per un gioco (opzionale: filtra per lingua). */
export async function listCommunityGlossaries(
  gameId: string,
  targetLanguage?: string
): Promise<CommunityGlossaryInfo[]> {
  const backend = await import('./community-hub-backend').catch(() => null);
  if (!backend || !backend.isBackendEnabled()) return [];
  try {
    const supabase = await backend.getSupabase();
    let query = supabase
      .from('game_glossaries')
      .select('id, game_id, game_name, source_language, target_language, terms_count, author_id, downloads, updated_at, author:user_profiles!author_id(username)')
      .eq('game_id', gameId)
      .order('downloads', { ascending: false });
    if (targetLanguage) query = query.eq('target_language', targetLanguage);
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      gameId: String(r.game_id),
      gameName: String(r.game_name || r.game_id),
      sourceLanguage: String(r.source_language || 'en'),
      targetLanguage: String(r.target_language),
      termsCount: Number(r.terms_count) || 0,
      authorId: String(r.author_id),
      authorUsername: String((r.author as { username?: string } | null)?.username || '—'),
      downloads: Number(r.downloads) || 0,
      updatedAt: String(r.updated_at || ''),
    }));
  } catch (e) {
    clientLogger.warn(`[CommunityGlossary] list fallita: ${String(e)}`);
    return [];
  }
}

/**
 * Importa un glossario community nel glossario locale del gioco.
 * Merge NON distruttivo: aggiunge solo i termini il cui sourceTerm non esiste
 * già (case-insensitive) — le scelte dell'utente non vengono mai sovrascritte.
 * I termini importati arrivano come tier 'flexible' e autoExtracted=true, così
 * restano riconoscibili e modificabili.
 */
export async function importCommunityGlossary(
  glossaryId: string,
  localGameId: string
): Promise<GlossaryImportResult> {
  const empty: GlossaryImportResult = { ok: false, added: 0, skipped: 0, total: 0 };
  const backend = await import('./community-hub-backend').catch(() => null);
  if (!backend || !backend.isBackendEnabled()) return empty;

  try {
    const supabase = await backend.getSupabase();
    const { data, error } = await supabase
      .from('game_glossaries')
      .select('*')
      .eq('id', glossaryId)
      .single();
    if (error || !data) return empty;

    const remoteTerms: RemoteTerm[] = Array.isArray(data.terms) ? (data.terms as RemoteTerm[]) : [];
    if (remoteTerms.length === 0) return { ok: true, added: 0, skipped: 0, total: 0 };

    // Glossario locale: se non esiste lo creiamo con i metadati remoti.
    let glossary = loadGlossary(localGameId);
    if (!glossary) {
      glossary = createGlossary(
        localGameId,
        String(data.game_name || localGameId),
        String(data.source_language || 'en'),
        String(data.target_language || 'it')
      );
    }

    let added = 0;
    let skipped = 0;
    for (const rt of remoteTerms) {
      if (!rt || typeof rt.s !== 'string' || !rt.s.trim() || typeof rt.t !== 'string') {
        skipped++;
        continue;
      }
      const entry: Omit<AutoGlossaryEntry, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'> = {
        sourceTerm: rt.s,
        targetTerm: rt.t,
        tier: 'flexible',
        category: (rt.cat as GlossaryCategory) || 'other',
        context: rt.c,
        doNotTranslate: !!rt.dnt,
        caseSensitive: false,
        confidence: 70,
        autoExtracted: true,
      };
      // addTerm ritorna null sui duplicati (case-insensitive) → le voci locali vincono.
      if (addTerm(localGameId, entry)) added++;
      else skipped++;
    }

    // Contatore download (best-effort, RPC SECURITY DEFINER).
    try { await supabase.rpc('increment_glossary_downloads', { glossary_id: glossaryId }); } catch { /* non critico */ }

    clientLogger.info(`[CommunityGlossary] Import ${glossaryId}: +${added}, ${skipped} saltati`);
    return { ok: true, added, skipped, total: remoteTerms.length };
  } catch (e) {
    clientLogger.warn(`[CommunityGlossary] import fallita: ${String(e)}`);
    return empty;
  }
}
