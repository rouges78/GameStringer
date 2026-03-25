/**
 * 🗨️ Community Chat Service — Supabase Realtime
 * 
 * Chat realtime tra utenti autenticati GameStringer.
 * Supporta:
 * - Stanze generali (Generale, Traduzioni, Feedback, Annunci)
 * - Stanze per gioco specifico
 * - Messaggi testo, condivisione pack, richieste traduzione
 * - Presenza online/away/offline
 * - Reply a messaggi
 * - Realtime subscription via Supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase as getSharedSupabase } from './community-hub-backend';

// ─── TYPES ──────────────────────────────────────────────────────

export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  type: 'general' | 'game' | 'translation_request' | 'feedback' | 'announcement';
  gameId?: string;
  gameName?: string;
  createdBy?: string;
  isPinned: boolean;
  isArchived: boolean;
  lastMessageAt: string;
  memberCount: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  content: string;
  type: 'text' | 'system' | 'pack_share' | 'image' | 'translation_request';
  replyTo?: string;
  replyPreview?: string;
  metadata?: Record<string, any>;
  edited: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPresence {
  userId: string;
  username?: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: string;
}

// ─── SUPABASE CLIENT HELPER ─────────────────────────────────────
// Delegates to the shared client from community-hub-backend to avoid
// "Multiple GoTrueClient instances" warnings.

async function getSupabase(): Promise<SupabaseClient> {
  return getSharedSupabase();
}

// ─── CHAT SERVICE ───────────────────────────────────────────────

export function isChatEnabled(): boolean {
  try {
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
        console.log('[Chat Bridge] Sessione GS trovata da gamestringer_current_profile:', id, p.name);
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
        console.log('[Chat Bridge] Sessione GS trovata da gs_session:', u.id, u.name);
        return { id: u.id, email, name: u.name || u.id, image: u.image };
      }
    }

    // 3. Fallback: try gs_user directly
    const rawUser = localStorage.getItem('gs_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.id) {
        const email = u.email || `gs_${u.id}@gamestringer.local`;
        console.log('[Chat Bridge] Sessione GS trovata da gs_user:', u.id, u.name);
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
        console.log('[Chat Bridge] Sessione GS trovata da gs_accounts:', id, acc.name);
        return { id, email, name: acc.name || id, image: acc.image };
      }
    }

    console.log('[Chat Bridge] Nessuna sessione GS trovata in localStorage');
    return null;
  } catch (e) {
    console.error('[Chat Bridge] Errore lettura sessione GS:', e);
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
export async function autoSyncGSToSupabase(): Promise<string | null> {
  const gs = getGSSession();
  if (!gs) return null;

  const supabase = await getSupabase();
  const password = derivePassword(gs.id);

  let authenticatedUserId: string | null = null;

  // 1. Check if already signed in
  const { data: current } = await supabase.auth.getUser();
  if (current?.user?.id) {
    console.log('[Chat Bridge] Già autenticato su Supabase:', current.user.id);
    authenticatedUserId = current.user.id;
  }

  // 2. Try sign in first (existing user)
  if (!authenticatedUserId) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: gs.email!,
      password,
    });

    if (signInData?.user?.id) {
      console.log('[Chat Bridge] Sign-in Supabase riuscito:', signInData.user.id);
      authenticatedUserId = signInData.user.id;
    } else if (signInError) {
      // 3. If sign-in fails, try sign up (new user)
      console.log('[Chat Bridge] Sign-in fallito, provo sign-up...', signInError.message);
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: gs.email!,
        password,
        options: {
          data: {
            username: gs.name || gs.id,
            avatar_url: gs.image || '',
            gs_id: gs.id,
          },
          emailRedirectTo: undefined,
        },
      });

      if (signUpError) {
        console.error('[Chat Bridge] Sign-up fallito:', signUpError.message);
        return null;
      }

      if (signUpData?.user?.id) {
        console.log('[Chat Bridge] Sign-up Supabase riuscito:', signUpData.user.id);
        authenticatedUserId = signUpData.user.id;
      }
    }
  }

  // 4. Ensure user_profiles row exists (prevents FK errors on presence/membership)
  if (authenticatedUserId) {
    try {
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', authenticatedUserId)
        .maybeSingle();

      if (!existingProfile) {
        const username = gs.name || `gs_${gs.id.substring(0, 8)}`;
        console.log('[Chat Bridge] Profilo mancante, creo via RPC per:', authenticatedUserId, username);

        // Try RPC first (SECURITY DEFINER, bypasses RLS)
        const { error: rpcErr } = await supabase.rpc('ensure_user_profile', {
          p_user_id: authenticatedUserId,
          p_username: username,
          p_email: gs.email || null,
          p_avatar_url: gs.image || '',
        });

        if (rpcErr) {
          console.warn('[Chat Bridge] RPC ensure_user_profile fallita:', rpcErr.message, '- provo INSERT diretto');
          // Fallback: direct insert
          const { error: insertErr } = await supabase.from('user_profiles').insert({
            id: authenticatedUserId,
            username,
            email: gs.email,
            avatar_url: gs.image || '',
          });
          if (insertErr) {
            console.error('[Chat Bridge] INSERT user_profiles fallita:', insertErr.message, insertErr.code);
          } else {
            console.log('[Chat Bridge] Profilo creato via INSERT diretto');
          }
        } else {
          console.log('[Chat Bridge] Profilo creato via RPC');
        }
      } else {
        console.log('[Chat Bridge] Profilo già esistente per:', authenticatedUserId);
      }
    } catch (e) {
      console.error('[Chat Bridge] Errore verifica/creazione profilo:', e);
    }
  }

  return authenticatedUserId;
}

// ─── ROOMS ──────────────────────────────────────────────────────

export async function fetchRooms(): Promise<ChatRoom[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('is_archived', false)
    .order('is_pinned', { ascending: false })
    .order('last_message_at', { ascending: false });

  if (error) throw new Error(`Errore caricamento stanze: ${error.message}`);
  return (data || []).map(mapRoom);
}

export async function createRoom(name: string, description: string, type: ChatRoom['type'], gameId?: string, gameName?: string): Promise<ChatRoom> {
  const supabase = await getSupabase();
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from('chat_rooms').insert({
    name,
    description,
    type,
    game_id: gameId || null,
    game_name: gameName || null,
    created_by: userId,
  }).select().single();

  if (error) throw new Error(`Errore creazione stanza: ${error.message}`);
  return mapRoom(data);
}

// ─── MESSAGES ───────────────────────────────────────────────────

export async function fetchMessages(roomId: string, limit = 50, before?: string): Promise<ChatMessage[]> {
  const supabase = await getSupabase();
  let query = supabase
    .from('chat_messages')
    .select('*, author:user_profiles!author_id(username, avatar_url)')
    .eq('room_id', roomId)
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Errore caricamento messaggi: ${error.message}`);

  return (data || []).map(mapMessage).reverse();
}

export async function sendMessage(
  roomId: string,
  content: string,
  type: ChatMessage['type'] = 'text',
  replyTo?: string,
  metadata?: Record<string, any>
): Promise<ChatMessage> {
  const supabase = await getSupabase();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Devi essere autenticato per inviare messaggi');

  const { data, error } = await supabase.from('chat_messages').insert({
    room_id: roomId,
    author_id: userId,
    content,
    type,
    reply_to: replyTo || null,
    metadata: metadata || {},
  }).select('*, author:user_profiles!author_id(username, avatar_url)').single();

  if (error) throw new Error(`Errore invio messaggio: ${error.message}`);
  return mapMessage(data);
}

export async function editMessage(messageId: string, newContent: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('chat_messages').update({
    content: newContent,
    edited: true,
    updated_at: new Date().toISOString(),
  }).eq('id', messageId);
  if (error) throw new Error(`Errore modifica: ${error.message}`);
}

export async function deleteMessage(messageId: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('chat_messages').update({
    deleted: true,
    content: '[messaggio eliminato]',
  }).eq('id', messageId);
  if (error) throw new Error(`Errore eliminazione: ${error.message}`);
}

// ─── REALTIME SUBSCRIPTIONS ─────────────────────────────────────

export type MessageCallback = (message: ChatMessage) => void;
export type PresenceCallback = (presence: UserPresence[]) => void;

let _messageSubscription: any = null;
let _presenceSubscription: any = null;

export async function subscribeToRoom(roomId: string, onMessage: MessageCallback): Promise<() => void> {
  const supabase = await getSupabase();

  // Unsubscribe previous if exists
  if (_messageSubscription) {
    supabase.removeChannel(_messageSubscription);
    _messageSubscription = null;
  }

  const channel = supabase
    .channel(`room-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      },
      async (payload: any) => {
        // Fetch full message with author info
        try {
          const { data } = await supabase
            .from('chat_messages')
            .select('*, author:user_profiles!author_id(username, avatar_url)')
            .eq('id', payload.new.id)
            .single();
          if (data) onMessage(mapMessage(data));
        } catch {
          // Fallback: use payload directly
          onMessage(mapMessage(payload.new));
        }
      }
    )
    .subscribe();

  _messageSubscription = channel;

  return () => {
    supabase.removeChannel(channel);
    _messageSubscription = null;
  };
}

export async function subscribeToPresence(onPresence: PresenceCallback): Promise<() => void> {
  const supabase = await getSupabase();

  if (_presenceSubscription) {
    supabase.removeChannel(_presenceSubscription);
    _presenceSubscription = null;
  }

  const channel = supabase
    .channel('online-users')
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: UserPresence[] = [];
      for (const key of Object.keys(state)) {
        const presences = state[key] as any[];
        for (const p of presences) {
          users.push({
            userId: p.user_id,
            username: p.username,
            avatar: p.avatar,
            status: 'online',
            lastSeen: new Date().toISOString(),
          });
        }
      }
      onPresence(users);
    })
    .subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        const userId = await getCurrentUserId();
        if (userId) {
          // Get user profile for presence
          try {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('username, avatar_url')
              .eq('id', userId)
              .maybeSingle();
            channel.track({
              user_id: userId,
              username: profile?.username || 'Utente',
              avatar: profile?.avatar_url || '',
              online_at: new Date().toISOString(),
            });
          } catch {
            channel.track({
              user_id: userId,
              username: 'Utente',
              online_at: new Date().toISOString(),
            });
          }
        }
      }
    });

  _presenceSubscription = channel;

  return () => {
    supabase.removeChannel(channel);
    _presenceSubscription = null;
  };
}

// ─── PRESENCE ───────────────────────────────────────────────────

export async function updatePresence(status: 'online' | 'away' | 'offline'): Promise<void> {
  try {
    const supabase = await getSupabase();
    await supabase.rpc('update_presence', { new_status: status });
  } catch {
    // Silent fail — presence is best-effort
  }
}

export async function getOnlineUsers(): Promise<UserPresence[]> {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('user_presence')
    .select('*, profile:user_profiles!user_id(username, avatar_url)')
    .eq('status', 'online')
    .order('last_seen', { ascending: false });

  return (data || []).map((row: any) => ({
    userId: row.user_id,
    username: row.profile?.username || 'Utente',
    avatar: row.profile?.avatar_url,
    status: row.status,
    lastSeen: row.last_seen,
  }));
}

// ─── ROOM MEMBERSHIP ────────────────────────────────────────────

export async function joinRoom(roomId: string): Promise<void> {
  const supabase = await getSupabase();
  const userId = await getCurrentUserId();
  if (!userId) return;
  try {
    await supabase.from('chat_room_members').upsert(
      { room_id: roomId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: 'room_id,user_id' }
    );
  } catch {
    // Silent fail — membership is best-effort
  }
}

export async function markRoomRead(roomId: string): Promise<void> {
  const supabase = await getSupabase();
  const userId = await getCurrentUserId();
  if (!userId) return;
  try {
    await supabase.from('chat_room_members').upsert(
      { room_id: roomId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: 'room_id,user_id' }
    );
  } catch {
    // Silent fail
  }
}

// ─── MAPPERS ────────────────────────────────────────────────────

function mapRoom(row: any): ChatRoom {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    type: row.type,
    gameId: row.game_id,
    gameName: row.game_name,
    createdBy: row.created_by,
    isPinned: row.is_pinned || false,
    isArchived: row.is_archived || false,
    lastMessageAt: row.last_message_at,
    memberCount: row.member_count || 0,
    createdAt: row.created_at,
  };
}

function mapMessage(row: any): ChatMessage {
  return {
    id: row.id,
    roomId: row.room_id,
    authorId: row.author_id,
    authorName: row.author?.username || 'Utente',
    authorAvatar: row.author?.avatar_url,
    content: row.content,
    type: row.type || 'text',
    replyTo: row.reply_to,
    metadata: row.metadata || {},
    edited: row.edited || false,
    deleted: row.deleted || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
