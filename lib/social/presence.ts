/**
 * 🟢 Unified Presence System
 * 
 * Sistema di presenza unificato che combina:
 * - Supabase Realtime Presence (canale condiviso, aggiornamenti istantanei)
 * - DB fallback (tabella user_presence per query storiche)
 * - Heartbeat periodico globale
 * - Auto-cleanup utenti offline
 * 
 * Risolve il problema dei 3 sistemi di presenza separati:
 * - social.ts → user_presence (DB, polling)
 * - community-chat.ts → community_presence (DB, upsert)
 * - community-chat.ts → Realtime channel (istananeo ma non persistente)
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './community-hub-backend';
import { clientLogger } from '@/lib/client-logger';
import { withRetry } from '@/lib/network-resilience';

// ============================================================================
// TYPES
// ============================================================================

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface OnlineUser {
  userId: string;
  username: string;
  avatar: string | null;
  status: PresenceStatus;
  currentActivity: string | null;
  currentGame: string | null;
  onlineAt: string;       // ISO timestamp
  lastHeartbeat: string;  // ISO timestamp
}

export type PresenceListener = (users: OnlineUser[]) => void;

// ============================================================================
// INTERNAL STATE
// ============================================================================

let _channel: RealtimeChannel | null = null;
const _listeners: Set<PresenceListener> = new Set();
let _onlineUsers: OnlineUser[] = [];
let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let _myUserId: string | null = null;
let _myStatus: PresenceStatus = 'online';
let _myActivity: string | null = null;
let _myGame: string | null = null;
let _initialized = false;
let _dbAvailable = true;  // resettable, unlike social.ts permanent cache

// Reset DB availability after some time to allow retry
let _dbFailTime = 0;
const DB_RETRY_MS = 60000; // retry DB after 1 minute

function isDbAvailable(): boolean {
  if (!_dbAvailable && Date.now() - _dbFailTime > DB_RETRY_MS) {
    _dbAvailable = true; // allow retry
  }
  return _dbAvailable;
}

function markDbUnavailable(): void {
  _dbAvailable = false;
  _dbFailTime = Date.now();
}

// ============================================================================
// PRESENCE CHANNEL — Realtime (primary)
// ============================================================================

const CHANNEL_NAME = 'online-users';

async function ensureChannel(): Promise<RealtimeChannel | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await getSupabase();

    // Return existing channel if still valid
    if (_channel) {
      // Check if channel is still subscribed
      const state = _channel.state;
      if (state === 'joined' || state === 'joining') {
        return _channel;
      }
      // Channel is in bad state, clean it up
      try {
        await supabase.removeChannel(_channel);
      } catch { /* ignore */ }
      _channel = null;
    }

    _channel = supabase
      .channel(CHANNEL_NAME, {
        config: { presence: { key: '' } }  // key per-user from track()
      })
      .on('presence', { event: 'sync' }, () => {
        const state = _channel?.presenceState<PresencePayload>();
        if (!state) return;

        const seen = new Set<string>();
        const users: OnlineUser[] = [];

        for (const [, presences] of Object.entries(state)) {
          for (const p of presences) {
            if (p.user_id && !seen.has(p.user_id)) {
              seen.add(p.user_id);
              // Clean up ugly auto-generated usernames
              let displayName = p.username || 'Utente';
              if (displayName.startsWith('user_') || displayName.startsWith('gs_')) {
                displayName = `Utente ${(p.user_id as string).substring(0, 6)}`;
              }
              users.push({
                userId: p.user_id,
                username: displayName,
                avatar: p.avatar || null,
                status: (p.status as PresenceStatus) || 'online',
                currentActivity: p.activity || null,
                currentGame: p.game || null,
                onlineAt: p.online_at || new Date().toISOString(),
                lastHeartbeat: p.online_at || new Date().toISOString(),
              });
            }
          }
        }

        _onlineUsers = users;
        notifyListeners();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        clientLogger.debug(`[Presence] ${key} joined: ${newPresences?.length || 0}`);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        clientLogger.debug(`[Presence] ${key} left: ${leftPresences?.length || 0}`);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          clientLogger.debug('[Presence] Channel subscribed');
          // Track ourselves when channel is ready
          if (_myUserId) {
            await trackPresence();
          }
        } else if (status === 'CHANNEL_ERROR') {
          clientLogger.warn('[Presence] Channel error, will retry');
          _channel = null; // allow re-creation
        }
      });

    return _channel;
  } catch (err) {
    clientLogger.error(`[Presence] Channel error: ${String(err)}`);
    return null;
  }
}

interface PresencePayload {
  user_id: string;
  username: string;
  avatar: string;
  status: string;
  activity: string;
  game: string;
  online_at: string;
}

async function trackPresence(): Promise<void> {
  if (!_channel || !_myUserId) return;

  const payload: PresencePayload = {
    user_id: _myUserId,
    username: await getUsername(_myUserId),
    avatar: await getAvatar(_myUserId),
    status: _myStatus,
    activity: _myActivity || '',
    game: _myGame || '',
    online_at: new Date().toISOString(),
  };

  try {
    await _channel.track(payload);
  } catch (err) {
    clientLogger.warn(`[Presence] Track error: ${String(err)}`);
  }
}

// ============================================================================
// DB FALLBACK — user_presence table
// ============================================================================

async function updateDbPresence(): Promise<void> {
  if (!isDbAvailable() || !isSupabaseConfigured() || !_myUserId) return;

  try {
    const supabase = await getSupabase();

    // Check we have a real session (not just anon)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Try RPC first with retry (forum-schema.sql defines update_user_presence)
    await withRetry(async () => {
      const { error } = await supabase.rpc('update_user_presence', {
        p_user_id: _myUserId,
        p_status: _myStatus,
        p_activity: _myActivity || null,
        p_game: _myGame || null,
      });

      if (error) {
        // Fallback: direct upsert on community_presence
        const { error: upsertErr } = await supabase.from('community_presence').upsert(
          {
            user_id: _myUserId,
            status: _myStatus,
            last_seen: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        if (upsertErr) {
          markDbUnavailable();
          throw upsertErr; // trigger retry
        }
      }
    }, { maxRetries: 2, baseDelayMs: 2000 });
  } catch {
    markDbUnavailable();
  }
}

async function getDbOnlineUsers(limit = 50): Promise<OnlineUser[]> {
  if (!isDbAvailable() || !isSupabaseConfigured()) return [];

  try {
    const supabase = await getSupabase();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Try user_presence first
    const { data, error } = await supabase
      .from('user_presence')
      .select('*')
      .gt('last_heartbeat', fiveMinAgo)
      .limit(limit);

    if (error) {
      // Fallback: try community_presence
      const { data: cpData, error: cpErr } = await supabase
        .from('community_presence')
        .select('*')
        .eq('status', 'online')
        .limit(limit);

      if (cpErr || !cpData) {
        markDbUnavailable();
        return [];
      }

      // Fetch profiles for names
      const userIds = [...new Set((cpData as Record<string, unknown>[]).map(r => r.user_id as string).filter(Boolean))];
      const profilesMap = await fetchProfilesMap(userIds);

      return (cpData as Record<string, unknown>[]).map(row => {
        const rawUsername = profilesMap.get(row.user_id as string)?.username || 'Utente';
        const displayName = (rawUsername.startsWith('user_') || rawUsername.startsWith('gs_'))
          ? `Utente ${(row.user_id as string).substring(0, 6)}`
          : rawUsername;
        return {
          userId: row.user_id as string,
          username: displayName,
          avatar: profilesMap.get(row.user_id as string)?.avatar_url || null,
          status: (row.status as PresenceStatus) || 'online',
          currentActivity: null,
          currentGame: null,
          onlineAt: row.last_seen as string || new Date().toISOString(),
          lastHeartbeat: row.last_seen as string || new Date().toISOString(),
        };
      });
    }

    if (!data) return [];

    const userIds = [...new Set((data as Record<string, unknown>[]).map(r => r.user_id as string).filter(Boolean))];
    const profilesMap = await fetchProfilesMap(userIds);

    return (data as Record<string, unknown>[]).map(row => {
      const rawUsername = profilesMap.get(row.user_id as string)?.username || 'Utente';
      const displayName = (rawUsername.startsWith('user_') || rawUsername.startsWith('gs_'))
        ? `Utente ${(row.user_id as string).substring(0, 6)}`
        : rawUsername;
      return {
        userId: row.user_id as string,
        username: displayName,
        avatar: profilesMap.get(row.user_id as string)?.avatar_url || null,
        status: (row.status as PresenceStatus) || 'online',
        currentActivity: (row.current_activity as string) || null,
        currentGame: (row.current_game as string) || null,
        onlineAt: row.last_heartbeat as string || new Date().toISOString(),
        lastHeartbeat: row.last_heartbeat as string || new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

// ============================================================================
// PROFILE HELPERS
// ============================================================================

// Cache to avoid repeated failed queries
let _profileQueryFailed = false;
let _profileQueryFailedAt = 0;
const PROFILE_QUERY_RETRY_MS = 60000; // Retry after 1 minute

async function fetchProfilesMap(userIds: string[]): Promise<Map<string, { username: string; avatar_url: string | null }>> {
  const map = new Map<string, { username: string; avatar_url: string | null }>();
  if (userIds.length === 0) return map;

  // Skip if recent query failed (avoid spamming 400 errors)
  if (_profileQueryFailed && Date.now() - _profileQueryFailedAt < PROFILE_QUERY_RETRY_MS) {
    return map;
  }

  try {
    const supabase = await getSupabase();

    // Skip query if no valid session (avoids 400/401 errors)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return map;

    // La PK di `user_profiles` e' `id` (docs/supabase-schema.sql:9). Fino al
    // 27/08/2026 qui si interrogava `user_id`, colonna che non esiste: ogni
    // chiamata finiva in 42703 e il ripiego per `id` che stava sotto non veniva
    // mai raggiunto, perche' il ramo d'errore ritorna prima. Risultato: questa
    // funzione non ha mai risolto un username o un avatar da Supabase.
    const query = supabase
      .from('user_profiles')
      .select('id, username, avatar_url');

    if (userIds.length === 1) {
      query.eq('id', userIds[0]);
    } else {
      query.in('id', userIds);
    }

    const { data, error } = await query;

    if (error) {
      // Mark as failed to avoid repeated queries
      _profileQueryFailed = true;
      _profileQueryFailedAt = Date.now();
      return map;
    }

    // Reset failure flag on success
    _profileQueryFailed = false;

    if (data) {
      for (const p of data) {
        if (p.id) map.set(p.id as string, { username: p.username as string || 'Utente', avatar_url: p.avatar_url as string | null });
      }
    }
  } catch { /* silent */ }

  return map;
}

async function getUsername(userId: string): Promise<string> {
  // 1. Try local GS profile first (most reliable)
  if (typeof window !== 'undefined') {
    try {
      const rawProfile = localStorage.getItem('gamestringer_current_profile');
      if (rawProfile) {
        const p = JSON.parse(rawProfile);
        if (p?.name && p.name.length > 0 && !p.name.startsWith('user_')) {
          return p.name;
        }
      }
    } catch {}
  }
  
  // 2. Try Supabase user_profiles
  const map = await fetchProfilesMap([userId]);
  const dbUsername = map.get(userId)?.username;
  if (dbUsername && !dbUsername.startsWith('user_')) {
    return dbUsername;
  }
  
  // 3. Fallback: generate friendly name from userId
  return `Utente ${userId.substring(0, 6)}`;
}

async function getAvatar(userId: string): Promise<string> {
  const map = await fetchProfilesMap([userId]);
  return map.get(userId)?.avatar_url || '';
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Inizializza il sistema presenza: autentica, entra nel canale, avvia heartbeat
 */
export async function initPresence(userId: string): Promise<void> {
  if (_initialized && _myUserId === userId) {
    clientLogger.debug(`[Presence] Già inizializzato per: ${userId}`);
    return;
  }
  _myUserId = userId;
  _myStatus = 'online';
  _initialized = true;

  clientLogger.debug(`[Presence] Init per utente: ${userId}`);

  // 1. Join Realtime channel (trackPresence is called in subscribe callback)
  await ensureChannel();

  // 2. Update DB
  await updateDbPresence();

  // 3. Start heartbeat (every 30s)
  if (_heartbeatInterval) clearInterval(_heartbeatInterval);
  _heartbeatInterval = setInterval(async () => {
    await trackPresence();
    await updateDbPresence();
  }, 30000);

  // 4. Load initial DB users (for cases where Realtime hasn't synced yet)
  const dbUsers = await getDbOnlineUsers(50);
  if (dbUsers.length > 0 && _onlineUsers.length === 0) {
    _onlineUsers = dbUsers;
    notifyListeners();
  }
}

/**
 * Aggiorna lo stato dell'utente corrente
 */
export async function setPresenceStatus(
  status: PresenceStatus,
  activity?: string,
  game?: string
): Promise<void> {
  _myStatus = status;
  if (activity !== undefined) _myActivity = activity;
  if (game !== undefined) _myGame = game;

  await trackPresence();
  await updateDbPresence();
}

/**
 * Segna l'utente come offline e pulisce
 */
export async function goOffline(): Promise<void> {
  _myStatus = 'offline';

  // Untrack from Realtime
  if (_channel) {
    try { await _channel.untrack(); } catch { /* ignore */ }
  }

  // Update DB
  await updateDbPresence();

  // Stop heartbeat
  if (_heartbeatInterval) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
}

/**
 * Ottieni la lista degli utenti online (Realtime + DB fallback)
 */
export function getOnlineUsers(): OnlineUser[] {
  return _onlineUsers;
}

/**
 * Ottieni il conteggio degli utenti online
 */
export function getOnlineCount(): number {
  return _onlineUsers.length;
}

/**
 * Iscriviti agli aggiornamenti di presenza
 */
export function onPresenceUpdate(listener: PresenceListener): () => void {
  _listeners.add(listener);
  // Send current state immediately
  if (_onlineUsers.length > 0) {
    listener(_onlineUsers);
  }
  return () => { _listeners.delete(listener); };
}

/**
 * Cleanup completo (logout, chiusura app)
 */
export async function destroyPresence(): Promise<void> {
  await goOffline();

  if (_channel) {
    try {
      const supabase = await getSupabase();
      supabase.removeChannel(_channel);
    } catch { /* ignore */ }
    _channel = null;
  }

  _listeners.clear();
  _onlineUsers = [];
  _myUserId = null;
  _initialized = false;
}

/**
 * Forza refresh degli utenti online dal DB
 * Utile quando il Realtime non è ancora sincronizzato
 */
export async function refreshOnlineUsers(): Promise<OnlineUser[]> {
  const dbUsers = await getDbOnlineUsers(50);

  // Merge: Realtime users take priority, add DB users not in Realtime
  const realtimeIds = new Set(_onlineUsers.map(u => u.userId));
  const merged = [..._onlineUsers];

  for (const dbUser of dbUsers) {
    if (!realtimeIds.has(dbUser.userId)) {
      merged.push(dbUser);
    }
  }

  _onlineUsers = merged;
  notifyListeners();
  return merged;
}

// ============================================================================
// INTERNAL
// ============================================================================

function notifyListeners(): void {
  const users = _onlineUsers;
  for (const listener of _listeners) {
    try { listener(users); } catch { /* ignore */ }
  }

  // Also dispatch window event for cross-component reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gs-presence-update', { detail: users }));
  }
}

// ============================================================================
// WINDOW FOCUS/AWAY DETECTION
// ============================================================================

if (typeof window !== 'undefined') {
  // Detect away when window loses focus for > 60s
  let _lastFocusTime = Date.now();
  let _awayDetector: ReturnType<typeof setInterval> | null = null;

  window.addEventListener('focus', () => {
    _lastFocusTime = Date.now();
    if (_myStatus === 'away' && _myUserId) {
      setPresenceStatus('online');
    }
  });

  window.addEventListener('blur', () => {
    _lastFocusTime = Date.now();
  });

  // Check every 60s if user is away
  if (!_awayDetector) {
    _awayDetector = setInterval(() => {
      if (!_myUserId || _myStatus === 'offline' || _myStatus === 'busy') return;
      const elapsed = Date.now() - _lastFocusTime;
      if (elapsed > 120000 && _myStatus === 'online') {
        // Window not focused for 2+ minutes → away
        setPresenceStatus('away');
      }
    }, 60000);
  }

  // Beforeunload → go offline
  window.addEventListener('beforeunload', () => {
    if (_myUserId) {
      // Synchronous beacon-style update
      _myStatus = 'offline';
      if (_channel) {
        try { _channel.untrack(); } catch { /* ignore */ }
      }
    }
  });
}

