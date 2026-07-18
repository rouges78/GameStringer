/**
 * GameStringer Social API
 * Sistema amici, presenza online, profili, notifiche
 */

import { getSupabase, isSupabaseConfigured } from './community-hub-backend';
import { setPresenceStatus as unifiedSetStatus, getOnlineUsers as unifiedGetOnline, type PresenceStatus } from './presence';

// Cache per ricordare quali tabelle esistono ed evitare ripetuti 404
const _tableExists: Record<string, boolean> = {};

function isTableAvailable(table: string): boolean {
  return _tableExists[table] !== false;
}

function markTableMissing(table: string): void {
  _tableExists[table] = false;
}

// Helper: esegue query Supabase ritornando null silenziosamente se la tabella non esiste
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeQuery<T>(table: string, queryFn: (supabase: any) => any): Promise<T | null> {
  if (!isSupabaseConfigured() || !isTableAvailable(table)) return null;
  try {
    const supabase = await getSupabase();
    const result = await queryFn(supabase);
    if (result.error) {
      const msg = result.error.message || '';
      const code = result.error.code || '';
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('not found')) {
        markTableMissing(table);
      }
      return null;
    }
    _tableExists[table] = true;
    return result.data as T | null;
  } catch {
    return null;
  }
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  discord_tag: string | null;
  steam_id: string | null;
  favorite_games: string[];
  badges: Badge[];
  stats: UserStats;
  settings: UserSettings;
  is_verified: boolean;
  is_moderator: boolean;
  is_admin: boolean;
  last_seen_at: string;
  created_at: string;
  // Computed
  is_online?: boolean;
  current_activity?: string;
  friendship_status?: 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'blocked';
}

export interface UserStats {
  threads: number;
  posts: number;
  translations: number;
  downloads: number;
  likes_received: number;
}

export interface UserSettings {
  show_online: boolean;
  allow_friend_requests: boolean;
  email_notifications: boolean;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  // Joined
  friend?: UserProfile;
}

export interface UserPresence {
  user_id: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  current_activity: string | null;
  current_game: string | null;
  last_heartbeat: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'friend_request' | 'friend_accepted' | 'thread_reply' | 'mention' | 'like' | 'system';
  title: string;
  message: string | null;
  link: string | null;
  sender_id: string | null;
  sender?: UserProfile;
  is_read: boolean;
  created_at: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  category: string;
  points: number;
  unlocked_at?: string;
}

export interface ActivityItem {
  id: string;
  user_id: string;
  user?: UserProfile;
  activity_type: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── PROFILES ────────────────────────────────────────────────────────────────

// Il record remoto di user_profiles usa `id` come PK (= auth user id) e non
// espone le colonne legacy `user_id`/`display_name`. Normalizziamo qui così i
// consumatori (UserProfileView, chat-panel, …) che leggono quei campi funzionano
// contro lo schema reale senza rompersi.
function normalizeProfile(row: UserProfile | null): UserProfile | null {
  if (!row) return null;
  const anyRow = row as unknown as Record<string, unknown>;
  return {
    ...row,
    user_id: row.user_id ?? (anyRow.id as string),
    display_name: row.display_name ?? row.username ?? null,
  };
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const row = await safeQuery<UserProfile>('user_profiles', (supabase) =>
    supabase.from('user_profiles').select('*').eq('id', userId).single()
  );
  return normalizeProfile(row);
}

export async function getProfileByUsername(username: string): Promise<UserProfile | null> {
  const row = await safeQuery<UserProfile>('user_profiles', (supabase) =>
    supabase.from('user_profiles').select('*').eq('username', username).single()
  );
  return normalizeProfile(row);
}

export async function updateProfile(userId: string, updates: Partial<UserProfile>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await getSupabase();
  
  const { error } = await supabase
    .from('user_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  
  return !error;
}

export async function createProfile(profile: {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getSupabase();
  
  const { data, error } = await supabase
    .from('user_profiles')
    .insert(profile)
    .select()
    .single();
  
  if (error) {
    console.warn('[Social] Error creating profile:', error.message);
    return null;
  }
  return data;
}

// ─── FRIENDS ─────────────────────────────────────────────────────────────────

export async function getFriends(userId: string): Promise<UserProfile[]> {
  const friendships = await safeQuery<{requester_id: string; addressee_id: string}[]>('friendships', (supabase) =>
    supabase.from('friendships').select('requester_id, addressee_id').eq('status', 'accepted').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  );
  if (!friendships?.length) return [];

  const friendIds = friendships.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id);
  const profiles = await safeQuery<UserProfile[]>('user_profiles', (supabase) => {
    const query = supabase.from('user_profiles').select('*');
    if (friendIds.length === 1) {
      return query.eq('user_id', friendIds[0]);
    }
    return query.in('user_id', friendIds);
  });
  return profiles || [];
}

// Get friends with online presence info
export async function getOnlineFriends(userId: string): Promise<(UserProfile & { isOnline?: boolean; lastSeen?: string })[]> {
  const friends = await getFriends(userId);
  if (!friends.length) return [];
  
  // Get online status from unified presence system
  const onlineUsers = unifiedGetOnline();
  const onlineMap = new Map(onlineUsers.map(u => [u.userId, u]));
  
  return friends.map(f => ({
    ...f,
    isOnline: onlineMap.has(f.user_id),
    lastSeen: onlineMap.get(f.user_id)?.lastHeartbeat || undefined
  }));
}

export async function getPendingFriendRequests(userId: string): Promise<Friendship[]> {
  const data = await safeQuery<Friendship[]>('friendships', (supabase) =>
    supabase.from('friendships').select('*').eq('addressee_id', userId).eq('status', 'pending')
  );
  return data || [];
}

export async function sendFriendRequest(fromUserId: string, toUserId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await getSupabase();
  
  const { error } = await supabase
    .from('friendships')
    .insert({
      requester_id: fromUserId,
      addressee_id: toUserId,
      status: 'pending'
    });
  
  if (error) {
    console.warn('[Social] Error sending friend request:', error.message);
    return false;
  }
  
  // Create notification
  await createNotification({
    user_id: toUserId,
    type: 'friend_request',
    title: 'Nuova richiesta di amicizia',
    sender_id: fromUserId
  });
  
  return true;
}

export async function acceptFriendRequest(friendshipId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await getSupabase();
  
  const { data, error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', friendshipId)
    .select()
    .single();
  
  if (error) return false;
  
  // Notify requester
  await createNotification({
    user_id: data.requester_id,
    type: 'friend_accepted',
    title: 'Richiesta di amicizia accettata',
    sender_id: data.addressee_id
  });
  
  return true;
}

export async function rejectFriendRequest(friendshipId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await getSupabase();
  
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);
  
  return !error;
}

export async function removeFriend(userId: string, friendId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await getSupabase();
  
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('status', 'accepted')
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`);
  
  return !error;
}

export async function blockUser(userId: string, blockedUserId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await getSupabase();
  
  // Remove existing friendship if any
  await supabase
    .from('friendships')
    .delete()
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${blockedUserId}),and(requester_id.eq.${blockedUserId},addressee_id.eq.${userId})`);
  
  // Create block
  const { error } = await supabase
    .from('friendships')
    .insert({
      requester_id: userId,
      addressee_id: blockedUserId,
      status: 'blocked'
    });
  
  return !error;
}

// ─── PRESENCE ────────────────────────────────────────────────────────────────

export async function updatePresence(
  userId: string, 
  status: 'online' | 'away' | 'busy' | 'offline' = 'online',
  activity?: string,
  game?: string
): Promise<void> {
  if (!userId) return;
  try {
    // Delegate to unified presence system (Realtime + DB fallback + heartbeat)
    await unifiedSetStatus(status as PresenceStatus, activity, game);
  } catch { /* silenzioso */ }
}

export async function getOnlineUsers(limit = 50): Promise<UserPresence[]> {
  try {
    const online = unifiedGetOnline().slice(0, limit);
    // Convert OnlineUser to UserPresence for backward compatibility
    return online.map(u => ({
      user_id: u.userId,
      status: u.status,
      current_activity: u.currentActivity,
      current_game: u.currentGame,
      last_heartbeat: u.lastHeartbeat,
    }));
  } catch {
    return [];
  }
}

// ...
// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

export async function getNotifications(userId: string, unreadOnly = false): Promise<Notification[]> {
  const data = await safeQuery<Notification[]>('notifications', (supabase) => {
    let query = supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (unreadOnly) query = query.eq('is_read', false);
    return query;
  });
  return data || [];
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (!isTableAvailable('notifications')) return 0;
  if (!isSupabaseConfigured()) return 0;
  try {
    const supabase = await getSupabase();
    const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
    if (error) { if (error.message?.includes('not found') || error.code === '42P01') markTableMissing('notifications'); return 0; }
    return count || 0;
  } catch { return 0; }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await getSupabase();
  
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await getSupabase();
  
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

export async function createNotification(notification: {
  user_id: string;
  type: Notification['type'];
  title: string;
  message?: string;
  link?: string;
  sender_id?: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await getSupabase();
  
  await supabase.from('notifications').insert(notification);
}

// ─── ACHIEVEMENTS ────────────────────────────────────────────────────────────

export async function getUserAchievements(userId: string): Promise<Achievement[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getSupabase();
  
  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      unlocked_at,
      achievement:achievements(*)
    `)
    .eq('user_id', userId);
  
  if (error || !data) return [];
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((ua: any) => ({
    ...(ua.achievement as Achievement),
    unlocked_at: ua.unlocked_at
  }));
}

export async function getAllAchievements(): Promise<Achievement[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getSupabase();
  
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('points');
  
  if (error) return [];
  return data || [];
}

// ─── ACTIVITY FEED ───────────────────────────────────────────────────────────

export async function getActivityFeed(userId?: string, limit = 20): Promise<ActivityItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getSupabase();
  
  let query = supabase
    .from('activity_feed')
    .select(`
      *,
      user:user_profiles!user_id(id, username, display_name, avatar_url)
    `)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

export async function getFriendsActivity(userId: string, limit = 20): Promise<ActivityItem[]> {
  if (!isSupabaseConfigured()) return [];

  const friends = await getFriends(userId);
  if (!friends.length) return [];

  const supabase = await getSupabase();
  const friendIds = friends.map(f => f.user_id);

  const query = supabase
    .from('activity_feed')
    .select(`
      *,
      user:user_profiles!user_id(id, username, display_name, avatar_url)
    `)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (friendIds.length === 1) {
    query.eq('user_id', friendIds[0]);
  } else {
    query.in('user_id', friendIds);
  }

  const { data, error } = await query;

  if (error) return [];
  return data || [];
}

export async function logActivity(activity: {
  user_id: string;
  activity_type: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  is_public?: boolean;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await getSupabase();
  
  await supabase.from('activity_feed').insert({
    ...activity,
    is_public: activity.is_public ?? true
  });
}

// ─── SEARCH ──────────────────────────────────────────────────────────────────

export async function searchUsers(query: string, limit = 20): Promise<UserProfile[]> {
  const data = await safeQuery<UserProfile[]>('user_profiles', (supabase) =>
    supabase.from('user_profiles').select('*').or(`username.ilike.%${query}%,display_name.ilike.%${query}%`).limit(limit)
  );
  return data || [];
}

// ─── CHAT / MESSAGGI PRIVATI ────────────────────────────────────────────────

export interface ChatConversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  last_read_at: string;
  joined_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  content_html: string | null;
  message_type: 'text' | 'image' | 'file' | 'system';
  attachments: Record<string, unknown>[];
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatConversationWithDetails extends ChatConversation {
  participants: ChatParticipant[];
  last_message?: ChatMessage | null;
  unread_count?: number;
}

// Trova o crea una conversazione diretta tra due utenti
export async function getOrCreateDirectConversation(
  userId1: string,
  userId2: string
): Promise<ChatConversation | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await getSupabase();

    // Cerca conversazione esistente tra i due utenti
    const { data: myParticipations } = await supabase
      .from('chat_participants')
      .select('conversation_id')
      .eq('user_id', userId1);

    if (myParticipations && myParticipations.length > 0) {
      const convIds = myParticipations.map(p => p.conversation_id);

      const { data: otherParticipations } = await supabase
        .from('chat_participants')
        .select('conversation_id')
        .eq('user_id', userId2)
        .in('conversation_id', convIds);

      if (otherParticipations && otherParticipations.length > 0) {
        // Trova la conversazione direct
        for (const op of otherParticipations) {
          const { data: conv } = await supabase
            .from('chat_conversations')
            .select('*')
            .eq('id', op.conversation_id)
            .eq('type', 'direct')
            .single();
          if (conv) return conv;
        }
      }
    }

    // Crea nuova conversazione
    const { data: conv, error: convError } = await supabase
      .from('chat_conversations')
      .insert({ type: 'direct', created_by: userId1 })
      .select()
      .single();

    if (convError || !conv) return null;

    // Aggiungi partecipanti
    console.log('[Social] Inserting participants:', { conv_id: conv.id, userId1, userId2 });
    const { data: partData, error: partError, status, statusText } = await supabase.from('chat_participants').insert([
      { conversation_id: conv.id, user_id: userId1, role: 'admin' },
      { conversation_id: conv.id, user_id: userId2, role: 'member' }
    ]).select();

    console.log('[Social] Insert result:', { partData, partError, status, statusText });
    if (partError) {
      console.error('[Social] chat_participants insert error:', JSON.stringify(partError, null, 2));
    }

    return conv;
  } catch {
    return null;
  }
}

// Ottieni tutte le conversazioni di un utente
export async function getConversations(userId: string): Promise<ChatConversationWithDetails[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await getSupabase();

    const { data: participations } = await supabase
      .from('chat_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId);

    if (!participations?.length) return [];

    const convIds = participations.map(p => p.conversation_id);
    const lastReadMap = new Map(participations.map(p => [p.conversation_id, p.last_read_at]));

    const { data: conversations } = await supabase
      .from('chat_conversations')
      .select('*')
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    if (!conversations) return [];

    const results: ChatConversationWithDetails[] = [];
    for (const conv of conversations) {
      // Partecipanti
      const { data: parts } = await supabase
        .from('chat_participants')
        .select('*')
        .eq('conversation_id', conv.id);
      const participants = parts || [];

      // Ultimo messaggio
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1);
      const last_message = msgs?.[0] || null;

      // Unread count
      const lastRead = lastReadMap.get(conv.id) || new Date(0).toISOString();
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .eq('is_deleted', false)
        .gt('created_at', lastRead);

      results.push({
        ...conv,
        participants,
        last_message,
        unread_count: count || 0
      });
    }

    return results;
  } catch {
    return [];
  }
}

// Ottieni messaggi di una conversazione
export async function getMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<ChatMessage[]> {
  const data = await safeQuery<ChatMessage[]>('chat_messages', (supabase: any) => {
    let q = supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) q = q.lt('created_at', before);
    return q;
  });
  // Ritorna in ordine cronologico
  return (data || []).reverse();
}

// Invia un messaggio
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: 'text' | 'image' | 'file' = 'text'
): Promise<ChatMessage | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        message_type: type
      })
      .select()
      .single();

    if (error) return null;

    // Aggiorna updated_at della conversazione
    await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  } catch {
    return null;
  }
}

// Segna messaggi come letti
export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = await getSupabase();
    await supabase
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  } catch { /* silenzioso */ }
}

