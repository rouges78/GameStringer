/**
 * 🔗 Community Auth Bridge — ponte fra l'account locale GameStringer e Supabase.
 *
 * Non è un servizio di chat: si occupa SOLO di autenticare l'utente sul backend
 * community (sign-in/sign-up con password derivata dall'ID GS) e di garantire
 * l'esistenza della riga in `user_profiles`. È il prerequisito di TUTTO ciò che
 * scrive sul backend: forum, pack, glossari community, classifiche.
 *
 * Storia: nato dentro `community-chat.ts`. Il 25/07/2026 le chat sono state
 * rimosse dall'app (tre sistemi sovrapposti, di fatto inutilizzati — vedi
 * docs/maintenance/2026-07-25-social-cleanup.md) e questo ponte, che serve al
 * forum, è stato estratto qui.
 *
 * Robustezza: circuit-breaker su backend irraggiungibile, dedupe delle sync in
 * volo, timeout esplicito (senza, una signIn contro un backend giù resta appesa
 * ~90s per via del 522 di Cloudflare).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { clientLogger } from '@/lib/client-logger';
import { getSupabase as getSharedSupabase } from './community-hub-backend';

// ─── SUPABASE CLIENT HELPER ─────────────────────────────────────
// Delegates to the shared client from community-hub-backend to avoid
// "Multiple GoTrueClient instances" warnings.

async function getSupabase(): Promise<SupabaseClient> {
  return getSharedSupabase();
}

// ─── CHAT SERVICE ───────────────────────────────────────────────

export function isCommunityEnabled(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isBackendEnabled } = require('./community-hub-backend');
    return isBackendEnabled();
  } catch {
    return false;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

// ─── GS ↔ SUPABASE AUTH BRIDGE ──────────────────────────────────

interface GSSessionInfo {
  id: string;
  email?: string;
  name?: string;
  image?: string;
}

function getGSSession(): GSSessionInfo | null {
  try {
    // 1. Try gamestringer_current_profile (primary — used by profile system)
    const rawProfile = localStorage.getItem('gamestringer_current_profile');
    if (rawProfile) {
      const p = JSON.parse(rawProfile);
      if (p?.id || p?.name) {
        const id = p.id || p.name;
        const email = p.email || `gs_${id}@gamestringer.local`;
        clientLogger.debug(`[Community Bridge] Sessione GS trovata da gamestringer_current_profile: ${id} ${p.name}`);
        return { id, email, name: p.name || id, image: p.avatar_url || p.avatar_path || undefined };
      }
    }

    // 2. Try gs_session (has .user object)
    const rawSession = localStorage.getItem('gs_session');
    if (rawSession) {
      const session = JSON.parse(rawSession);
      if (session?.user?.id) {
        const u = session.user;
        const email = u.email || `gs_${u.id}@gamestringer.local`;
        clientLogger.debug(`[Community Bridge] Sessione GS trovata da gs_session: ${u.id} ${u.name}`);
        return { id: u.id, email, name: u.name || u.id, image: u.image };
      }
    }

    // 3. Fallback: try gs_user directly
    const rawUser = localStorage.getItem('gs_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.id) {
        const email = u.email || `gs_${u.id}@gamestringer.local`;
        clientLogger.debug(`[Community Bridge] Sessione GS trovata da gs_user: ${u.id} ${u.name}`);
        return { id: u.id, email, name: u.name || u.id, image: u.image };
      }
    }

    // 4. Fallback: try gs_accounts (pick first account)
    const rawAccounts = localStorage.getItem('gs_accounts');
    if (rawAccounts) {
      const accounts = JSON.parse(rawAccounts);
      if (Array.isArray(accounts) && accounts.length > 0) {
        const acc = accounts[0];
        const id = acc.userId || acc.id || 'unknown';
        const email = acc.email || `gs_${id}@gamestringer.local`;
        clientLogger.debug(`[Community Bridge] Sessione GS trovata da gs_accounts: ${id} ${acc.name}`);
        return { id, email, name: acc.name || id, image: acc.image };
      }
    }

    clientLogger.debug('[Community Bridge] Nessuna sessione GS trovata in localStorage');
    return null;
  } catch (e: unknown) {
    clientLogger.error(`[Community Bridge] Errore lettura sessione GS: ${String(e)}`);
    return null;
  }
}

function derivePassword(gsId: string): string {
  // Deterministic password from GS user ID — not meant to be "secure" in the
  // traditional sense since this is a community feature, not a bank.
  return `gs_community_${gsId}_!Str1ng3r`;
}

/**
 * Auto-sync: if the user is logged into GS locally, automatically
 * sign them into Supabase (signup on first use, then signin).
 * Returns the Supabase user ID or null.
 */
// Circuit-breaker: se il backend community è risultato irraggiungibile da poco
// (522/timeout/rete), evita di rimartellarlo ad ogni mount/Fast-Refresh per qualche
// minuto. Persistito in localStorage per sopravvivere ai reload del dev.
const CB_KEY = 'communityBridge:backendDownUntil';
const CB_COOLDOWN_MS = 3 * 60 * 1000; // 3 minuti

function backendInCooldown(): boolean {
  try {
    const until = Number(localStorage.getItem(CB_KEY) || 0);
    return until > Date.now();
  } catch { return false; }
}
function tripBreaker(): void {
  try { localStorage.setItem(CB_KEY, String(Date.now() + CB_COOLDOWN_MS)); } catch {}
}
function resetBreaker(): void {
  try { localStorage.removeItem(CB_KEY); } catch {}
}

// Caps una promise a `ms`: senza questo, una signInWithPassword contro un backend
// giù resta appesa ~90s (il 522 di Cloudflare arriva dopo un lungo connect-timeout).
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  // Se vince il timeout, `p` resta pendente e potrebbe rifiutare DOPO (es. fetch
  // CORS-bloccata): senza questo handler esplicito la sua rejection diventa "orfana"
  // e l'overlay dev di Next la segnala. La marchiamo come gestita (la logica resta
  // governata dal timeout sotto, classificato come transitorio dal chiamante).
  p.catch(() => {});
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Dedupe: l'auto-sync è invocato da più punti (più punti dell'app) e in
// dev il double-invoke di StrictMode raddoppia tutto → senza guardia partono 4 richieste
// in parallelo PRIMA che il breaker scatti. Condividiamo un'unica sync in volo.
let _syncInFlight: Promise<string | null> | null = null;

export function autoSyncGSToSupabase(opts?: { force?: boolean }): Promise<string | null> {
  // Azione utente esplicita (pulsante "Accedi"): azzera il circuit-breaker così il
  // click ritenta SEMPRE una connessione reale, anche durante il cooldown post-outage.
  if (opts?.force) resetBreaker();
  if (_syncInFlight) return _syncInFlight;
  _syncInFlight = _runAutoSync().finally(() => { _syncInFlight = null; });
  return _syncInFlight;
}

async function _runAutoSync(): Promise<string | null> {
  // Community disabilitata (flag backend) → niente richieste affatto. È l'interruttore da usare
  // finché il backend Supabase è giù: zero 522/CORS in console (quelli li stampa il browser
  // e NON sono sopprimibili da JS finché la fetch parte).
  if (!isCommunityEnabled()) return null;

  const gs = getGSSession();
  if (!gs) return null;

  // Backend giù di recente → salta in silenzio (niente retry-storm né rosso in console).
  if (backendInCooldown()) {
    clientLogger.debug('[Community Bridge] Backend community non raggiungibile di recente → salto auto-sync (circuit breaker).');
    return null;
  }

  const supabase = await getSupabase();
  const password = derivePassword(gs.id);

  let authenticatedUserId: string | null = null;

  // Alcuni errori del backend community sono TRANSITORI (cold-start del DB,
  // 5xx tipo "Database error finding user", timeout, rete). In quei casi non ha
  // senso arrendersi e mostrare il login manuale: ritentiamo con backoff breve.
  const isTransient = (msg?: string): boolean =>
    !!msg && /database error|timeout|timed ?out|network|fetch|connection|terminated|unavailable|rate limit|50[0234]|52[0-9]/i.test(msg);

  // Un singolo tentativo completo: già-autenticato → sign-in → sign-up.
  // Ritorna l'uid (solo se c'è una SESSIONE valida) e se l'errore è transitorio.
  const tryAuthOnce = async (): Promise<{ uid: string | null; transient: boolean }> => {
    // a) Sessione Supabase già presente (persistita tra i riavvii)?
    const { data: current } = await supabase.auth.getUser();
    if (current?.user?.id) return { uid: current.user.id, transient: false };

    // b) Sign-in (utente esistente)
    const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email: gs.email!, password });
    if (si?.user?.id && si.session) {
      clientLogger.debug(`[Community Bridge] Sign-in riuscito: ${si.user.id}`);
      return { uid: si.user.id, transient: false };
    }
    if (siErr && isTransient(siErr.message)) return { uid: null, transient: true };

    // c) Sign-up (primo accesso)
    const { data: su, error: suErr } = await supabase.auth.signUp({
      email: gs.email!,
      password,
      options: { data: { username: gs.name || gs.id, avatar_url: gs.image || '', gs_id: gs.id }, emailRedirectTo: undefined },
    });
    if (suErr) {
      const suStatus = (suErr as { status?: number }).status;
      // L'utente ESISTE già → retry immediato del sign-in (password deterministica), PRIMA
      // del check "transitorio". Il 422 "User already registered" e il 500 transitorio
      // "Database error saving new user" indicano entrambi un account esistente: il secondo
      // capita quando il check-duplicati di GoTrue va in timeout sotto carico e l'INSERT
      // colpisce comunque l'indice unique email (users_email_partial_key). In entrambi i casi
      // ha senso il signin subito, non aspettare il cooldown del circuit-breaker.
      if (/already registered|already exists|user already|database error saving new user/i.test(suErr.message) || suStatus === 422) {
        const { data: si2, error: si2Err } = await supabase.auth.signInWithPassword({ email: gs.email!, password });
        if (si2?.user?.id && si2.session) return { uid: si2.user.id, transient: false };
        return { uid: null, transient: isTransient(si2Err?.message) };
      }
      // Altri 5xx/timeout/rete → transitorio, ritenta più tardi (circuit-breaker).
      if (isTransient(suErr.message)) return { uid: null, transient: true };
      // Fallimento non riconosciuto: condizione gestita (il client resta resiliente) →
      // warning, non errore rosso. NB: il DB e il trigger di creazione utente sono SANI
      // (verificato 2026-06-17: 817/817 profili, password bcrypt allineate alla derivazione);
      // i 500 residui sono timeout DB transitori, NON un trigger rotto.
      clientLogger.warn(`[Community Bridge] Sign-up Supabase fallito (condizione gestita): ${suErr.message || 'errore senza messaggio'}${suStatus ? ` [status ${suStatus}]` : ''}`);
      return { uid: null, transient: false };
    }
    if (su?.user?.id && su.session) {
      clientLogger.debug(`[Community Bridge] Sign-up riuscito: ${su.user.id}`);
      return { uid: su.user.id, transient: false };
    }
    // Utente creato ma senza sessione (es. conferma email attiva) → prova sign-in.
    if (su?.user?.id) {
      const { data: si3 } = await supabase.auth.signInWithPassword({ email: gs.email!, password });
      if (si3?.user?.id && si3.session) return { uid: si3.user.id, transient: false };
      return { uid: null, transient: true };
    }
    return { uid: null, transient: false };
  };

  // UN SOLO tentativo per mount: contro un backend giù ogni richiesta stampa 2 righe
  // (CORS + ERR_FAILED) non sopprimibili → niente retry interni. La "ripetizione" è
  // governata dal circuit-breaker (riprova solo dopo il cooldown).
  let lastWasTransient = false;
  try {
    const { uid, transient } = await withTimeout(tryAuthOnce(), 8000);
    if (uid) authenticatedUserId = uid;
    else lastWasTransient = transient;
  } catch (e: unknown) {
    // timeout/eccezione di rete → transitoria
    lastWasTransient = true;
    clientLogger.debug(`[Community Bridge] Tentativo fallito (rete/timeout): ${String(e)}`);
  }

  if (!authenticatedUserId) {
    // Fallimento per rete/timeout → arma il circuit-breaker così i prossimi mount
    // (e il double-invoke di StrictMode) non rimartellano un backend irraggiungibile.
    if (lastWasTransient) tripBreaker();
    return null;
  }
  resetBreaker(); // backend di nuovo raggiungibile

  // 4. Ensure user_profiles row exists (prevents FK errors on presence/membership)
  if (authenticatedUserId) {
    try {
      // Lo schema reale di `user_profiles` (vedi docs/supabase-schema.sql) ha
      // `id UUID PRIMARY KEY REFERENCES auth.users(id)`: la chiave è proprio
      // l'ID di Supabase Auth. Usiamo `id` come chiave di lookup e di insert.
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', authenticatedUserId)
        .maybeSingle();

      if (!existingProfile) {
        const username = gs.name || `gs_${gs.id.substring(0, 8)}`;
        clientLogger.debug(`[Community Bridge] Profilo mancante, creo via RPC per: ${authenticatedUserId} ${username}`);

        // Try RPC first (SECURITY DEFINER, bypasses RLS)
        const { error: rpcErr } = await supabase.rpc('ensure_user_profile', {
          p_user_id: authenticatedUserId,
          p_username: username,
          p_email: gs.email || null,
          p_avatar_url: gs.image || '',
        });

        if (rpcErr) {
          clientLogger.warn(`[Community Bridge] RPC ensure_user_profile fallita: ${rpcErr.message} - provo INSERT diretto`);
          // Fallback: direct insert. `id` deve combaciare con l'auth user id
          // (è una FK verso auth.users), e lo schema include `email`.
          const { error: insertErr } = await supabase.from('user_profiles').insert({
            id: authenticatedUserId,
            username,
            email: gs.email,
            avatar_url: gs.image || '',
          });
          if (insertErr) {
            clientLogger.error(`[Community Bridge] INSERT user_profiles fallita: ${insertErr.message} ${insertErr.code}`);
          } else {
            clientLogger.debug('[Community Bridge] Profilo creato via INSERT diretto');
          }
        } else {
          clientLogger.debug('[Community Bridge] Profilo creato via RPC');
        }
      } else {
        clientLogger.debug(`[Community Bridge] Profilo già esistente per: ${authenticatedUserId}`);
      }
    } catch (e: unknown) {
      clientLogger.error(`[Community Bridge] Errore verifica/creazione profilo: ${String(e)}`);
    }
  }

  return authenticatedUserId;
}
