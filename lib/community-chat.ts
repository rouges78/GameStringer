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

async function getSupabase() {
  const STORAGE_KEY = 'gs_supabase_config';
  let config: any = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) config = JSON.parse(raw);
  } catch {}

  if (!config.url || !config.anonKey || !config.enabled) {
    throw new Error('Supabase non configurato. Vai in Impostazioni → Community Hub Backend.');
  }

  // Reuse global client if exists
  const g = globalThis as any;
  if (g.__gsSupabaseChat) return g.__gsSupabaseChat;

  let createClient: any;
  try {
    const mod = await (eval('import("@supabase/supabase-js")') as Promise<any>);
    createClient = mod.createClient;
  } catch {
    throw new Error('Pacchetto @supabase/supabase-js non installato.');
  }

  g.__gsSupabaseChat = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return g.__gsSupabaseChat;
}

// ─── CHAT SERVICE ───────────────────────────────────────────────

export function isChatEnabled(): boolean {
  try {
    const raw = localStorage.getItem('gs_supabase_config');
    if (!raw) return false;
    const cfg = JSON.parse(raw);
    return cfg.enabled && !!cfg.url && !!cfg.anonKey;
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
              .single();
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
  await supabase.from('chat_room_members').upsert({
    room_id: roomId,
    user_id: userId,
    last_read_at: new Date().toISOString(),
  });
}

export async function markRoomRead(roomId: string): Promise<void> {
  const supabase = await getSupabase();
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('chat_room_members').upsert({
    room_id: roomId,
    user_id: userId,
    last_read_at: new Date().toISOString(),
  });
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
