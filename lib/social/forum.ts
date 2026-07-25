/**
 * GameStringer Forum API
 * Client per il forum integrato nel Community Hub
 */

import { getSupabase, isSupabaseConfigured } from './community-hub-backend';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ForumCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sort_order: number;
  is_locked: boolean;
  thread_count?: number;
  post_count?: number;
  last_activity_at?: string | null; // max(last_reply_at, created_at) dei thread della categoria
  last_thread?: {
    id: string;
    title: string;
    author_name: string;
    created_at: string;
  };
}

export interface ForumThread {
  id: string;
  category_id: string;
  category?: ForumCategory;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  title: string;
  slug: string;
  content: string;
  content_html: string | null;
  is_translation_pack: boolean;
  pack_data: PackData | null;
  view_count: number;
  reply_count: number;
  like_count: number;
  download_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  is_solved: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  last_reply_at: string | null;
  last_reply_by: string | null;
  user_liked?: boolean;
}

export interface PackData {
  game_name: string;
  game_id?: string;
  source_lang: string;
  target_lang: string;
  string_count: number;
  download_url: string;
  version: string;
  engine?: string;
  file_size?: number;
  screenshots?: string[];
}

export interface ForumPost {
  id: string;
  thread_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  content_html: string | null;
  reply_to_id: string | null;
  reply_to?: ForumPost;
  quote_text: string | null;
  like_count: number;
  is_solution: boolean;
  is_hidden: boolean;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  user_liked?: boolean;
}

export interface CreateThreadInput {
  category_slug: string;
  title: string;
  content: string;
  is_translation_pack?: boolean;
  pack_data?: PackData;
}

export interface CreatePostInput {
  thread_id: string;
  content: string;
  reply_to_id?: string;
  quote_text?: string;
}

// Errori transitori di backend irraggiungibile (Cloudflare 5xx/522, timeout, rete):
// attesi quando il server community è giù → log a debug, non warn (niente rumore rosso).
function isBackendUnreachable(error: unknown): boolean {
  const e = error as { code?: string | number; message?: string; status?: number } | null;
  const msg = (e?.message || '').toLowerCase();
  const code = String(e?.code ?? '');
  return (
    ['520', '521', '522', '523', '524'].includes(code) ||
    e?.status === 522 ||
    msg.includes('522') || msg.includes('timed out') || msg.includes('timeout') ||
    msg.includes('failed to fetch') || msg.includes('networkerror') ||
    msg.includes('fetch failed') || msg.includes('network')
  );
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

export async function getCategories(): Promise<ForumCategory[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('forum_categories')
    .select('*')
    .order('sort_order');
  
  if (error) {
    // Tabelle forum non esistono ancora - è normale se il forum non è stato configurato
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.debug('[Forum] Tabelle forum non ancora create');
    } else if (isBackendUnreachable(error)) {
      console.debug('[Forum] Backend community non raggiungibile (categorie):', error.message || error);
    } else {
      console.warn('[Forum] Error fetching categories:', error.message || error);
    }
    return [];
  }
  
  // Aggiungi conteggi thread per categoria
  const categoriesWithCounts = await Promise.all(
    (data || []).map(async (cat: ForumCategory) => {
      const { count } = await supabase
        .from('forum_threads')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', cat.id)
        .eq('is_hidden', false);

      // Ultima attività (nuovo thread o nuova risposta) della categoria
      const { data: latest } = await supabase
        .from('forum_threads')
        .select('last_reply_at, created_at')
        .eq('category_id', cat.id)
        .eq('is_hidden', false)
        .order('last_reply_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const last_activity_at = (latest?.last_reply_at as string | null) || (latest?.created_at as string | null) || null;

      return { ...cat, thread_count: count || 0, last_activity_at };
    })
  );
  
  return categoriesWithCounts;
}

export async function getCategoryBySlug(slug: string): Promise<ForumCategory | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('forum_categories')
    .select('*')
    .eq('slug', slug)
    .single();
  
  if (error) return null;
  return data;
}

// ─── THREADS ─────────────────────────────────────────────────────────────────

export interface ThreadsFilter {
  category_slug?: string;
  is_translation_pack?: boolean;
  search?: string;
  sort?: 'newest' | 'popular' | 'most_replies' | 'most_downloads';
  page?: number;
  limit?: number;
}

export async function getThreads(filter: ThreadsFilter = {}): Promise<{ threads: ForumThread[]; total: number }> {
  if (!isSupabaseConfigured()) return { threads: [], total: 0 };
  const supabase = await getSupabase();
  const { category_slug, is_translation_pack, search, sort = 'newest', page = 1, limit = 20 } = filter;
  
  let query = supabase
    .from('forum_threads')
    .select(`
      *,
      category:forum_categories(id, slug, name, icon, color)
    `, { count: 'exact' })
    .eq('is_hidden', false);
  
  // Filtri
  if (category_slug) {
    const cat = await getCategoryBySlug(category_slug);
    if (cat) query = query.eq('category_id', cat.id);
  }
  
  if (is_translation_pack !== undefined) {
    query = query.eq('is_translation_pack', is_translation_pack);
  }
  
  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }
  
  // Ordinamento
  switch (sort) {
    case 'popular':
      query = query.order('view_count', { ascending: false });
      break;
    case 'most_replies':
      query = query.order('reply_count', { ascending: false });
      break;
    case 'most_downloads':
      query = query.order('download_count', { ascending: false });
      break;
    default:
      query = query.order('is_pinned', { ascending: false }).order('last_reply_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  }
  
  // Paginazione
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);
  
  const { data, error, count } = await query;
  
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      // tabelle forum non ancora create
    } else if (isBackendUnreachable(error)) {
      console.debug('[Forum] Backend community non raggiungibile (thread):', error.message || error);
    } else {
      console.warn('[Forum] Error fetching threads:', error.message || error);
    }
    return { threads: [], total: 0 };
  }
  
  return { threads: data || [], total: count || 0 };
}

export async function getThread(id: string, userId?: string): Promise<ForumThread | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('forum_threads')
    .select(`
      *,
      category:forum_categories(id, slug, name, icon, color)
    `)
    .eq('id', id)
    .single();
  
  if (error) return null;
  
  // Incrementa view count
  await supabase.rpc('increment_thread_views', { thread_uuid: id });
  
  // Check se l'utente ha messo like
  if (userId) {
    const { data: reaction } = await supabase
      .from('forum_reactions')
      .select('id')
      .eq('thread_id', id)
      .eq('user_id', userId)
      .eq('reaction_type', 'like')
      .single();
    
    data.user_liked = !!reaction;
  }
  
  return data;
}

export async function getThreadBySlug(categorySlug: string, threadSlug: string): Promise<ForumThread | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getSupabase();
  const cat = await getCategoryBySlug(categorySlug);
  if (!cat) return null;
  
  const { data, error } = await supabase
    .from('forum_threads')
    .select(`
      *,
      category:forum_categories(id, slug, name, icon, color)
    `)
    .eq('category_id', cat.id)
    .eq('slug', threadSlug)
    .single();
  
  if (error) return null;
  
  // Incrementa view count
  await supabase.rpc('increment_thread_views', { thread_uuid: data.id });
  
  return data;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80) + '-' + Date.now().toString(36);
}

/**
 * author_id/user_id da usare per le scritture nel forum. La RLS "Auth insert *"
 * (migration 20260704) pretende <col> = auth.uid() e ruolo `authenticated`, quindi serve
 * l'uid dell'utente Supabase ottenuto dal bridge profilo-locale → Supabase
 * (autoSyncGSToSupabase). Ritorna null se il bridge è giù o non c'è sessione: NON esiste
 * più un fallback RLS "Community insert ..." (rimosso da 20260704), perciò i chiamanti
 * devono evitare l'insert — verrebbe comunque respinta dalla RLS — e segnalare "riprova".
 * import dinamico per evitare cicli.
 */
async function resolveAuthorId(_localId: string): Promise<string | null> {
  try {
    const { autoSyncGSToSupabase } = await import('./auth-bridge');
    return await autoSyncGSToSupabase();
  } catch {
    return null; // bridge non disponibile → il chiamante fa bail-out
  }
}

export async function createThread(input: CreateThreadInput, author: { id: string; name: string; avatar?: string }): Promise<ForumThread | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getSupabase();
  const cat = await getCategoryBySlug(input.category_slug);
  if (!cat) {
    console.error('[Forum] Category not found:', input.category_slug);
    return null;
  }

  const authorId = await resolveAuthorId(author.id);
  if (!authorId) {
    console.warn('[Forum] Bridge auth non disponibile: creazione thread rimandata (riprova tra poco)');
    return null;
  }
  const { data, error } = await supabase
    .from('forum_threads')
    .insert({
      category_id: cat.id,
      author_id: authorId,
      author_name: author.name,
      author_avatar: author.avatar || null,
      title: input.title,
      slug: generateSlug(input.title),
      content: input.content,
      is_translation_pack: input.is_translation_pack || false,
      pack_data: input.pack_data || null,
    })
    .select()
    .single();
  
  if (error) {
    console.warn('[Forum] Error creating thread:', error.message || error);
    return null;
  }
  
  return data;
}

export async function updateThread(id: string, updates: Partial<Pick<ForumThread, 'title' | 'content' | 'pack_data'>>): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('forum_threads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  
  return !error;
}

export async function deleteThread(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('forum_threads')
    .update({ is_hidden: true })
    .eq('id', id);
  
  return !error;
}

// ─── POSTS ───────────────────────────────────────────────────────────────────

export async function getPosts(threadId: string, userId?: string): Promise<ForumPost[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('forum_posts')
    .select('*')
    .eq('thread_id', threadId)
    .eq('is_hidden', false)
    .order('created_at');
  
  if (error) {
    if (error.code !== '42P01' && !error.message?.includes('does not exist')) {
      console.warn('[Forum] Error fetching posts:', error.message || error);
    }
    return [];
  }
  
  // Check likes utente
  if (userId && data) {
    const { data: reactions } = await supabase
      .from('forum_reactions')
      .select('post_id')
      .eq('user_id', userId)
      .eq('reaction_type', 'like')
      .in('post_id', data.map((p: ForumPost) => p.id));
    
    const likedIds = new Set((reactions || []).map((r: { post_id: string }) => r.post_id));
    data.forEach((post: ForumPost) => {
      post.user_liked = likedIds.has(post.id);
    });
  }
  
  return data || [];
}

export async function createPost(input: CreatePostInput, author: { id: string; name: string; avatar?: string }): Promise<ForumPost | null> {
  const supabase = await getSupabase();
  const authorId = await resolveAuthorId(author.id);
  if (!authorId) {
    console.warn('[Forum] Bridge auth non disponibile: risposta rimandata (riprova tra poco)');
    return null;
  }
  const { data, error } = await supabase
    .from('forum_posts')
    .insert({
      thread_id: input.thread_id,
      author_id: authorId,
      author_name: author.name,
      author_avatar: author.avatar || null,
      content: input.content,
      reply_to_id: input.reply_to_id || null,
      quote_text: input.quote_text || null,
    })
    .select()
    .single();
  
  if (error) {
    console.warn('[Forum] Error creating post:', error.message || error);
    return null;
  }
  
  return data;
}

export async function updatePost(id: string, content: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('forum_posts')
    .update({ content, is_edited: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  
  return !error;
}

export async function deletePost(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('forum_posts')
    .update({ is_hidden: true })
    .eq('id', id);
  
  return !error;
}

export async function markAsSolution(postId: string, threadId: string): Promise<boolean> {
  const supabase = await getSupabase();
  // Rimuovi solution da altri post
  await supabase
    .from('forum_posts')
    .update({ is_solution: false })
    .eq('thread_id', threadId);
  
  // Segna questo come solution
  const { error: postError } = await supabase
    .from('forum_posts')
    .update({ is_solution: true })
    .eq('id', postId);
  
  // Segna thread come risolto
  const { error: threadError } = await supabase
    .from('forum_threads')
    .update({ is_solved: true })
    .eq('id', threadId);
  
  return !postError && !threadError;
}

// ─── REACTIONS ───────────────────────────────────────────────────────────────

export async function toggleLike(userId: string, threadId?: string, postId?: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!threadId && !postId) return false;

  // Serve una sessione Supabase reale: la RLS "Auth insert reactions" (20260704)
  // pretende user_id = auth.uid() e ruolo authenticated. Bridge giù → niente like.
  const uid = await resolveAuthorId(userId);
  if (!uid) {
    console.warn('[Forum] Bridge auth non disponibile: like rimandato (riprova tra poco)');
    return false;
  }
  
  // Check se esiste già
  let query = supabase
    .from('forum_reactions')
    .select('id')
    .eq('user_id', uid)
    .eq('reaction_type', 'like');
  
  if (threadId) query = query.eq('thread_id', threadId);
  if (postId) query = query.eq('post_id', postId);
  
  const { data: existing } = await query.single();
  
  if (existing) {
    // Rimuovi like
    const { error } = await supabase
      .from('forum_reactions')
      .delete()
      .eq('id', existing.id);
    return !error;
  } else {
    // Aggiungi like
    const { error } = await supabase
      .from('forum_reactions')
      .insert({
        user_id: uid,
        thread_id: threadId || null,
        post_id: postId || null,
        reaction_type: 'like',
      });
    return !error;
  }
}

// ─── DOWNLOADS ───────────────────────────────────────────────────────────────

export async function trackDownload(threadId: string, userId?: string): Promise<void> {
  const supabase = await getSupabase();
  await supabase.from('forum_downloads').insert({
    thread_id: threadId,
    user_id: userId || null,
  });
  
  // Incrementa download_count direttamente
  await supabase.rpc('increment_download_count', { thread_uuid: threadId });
}

// ─── STATS ───────────────────────────────────────────────────────────────────

export interface ForumStats {
  total_threads: number;
  total_posts: number;
  total_packs: number;
  total_downloads: number;
  active_users: number;
}

export async function getForumStats(): Promise<ForumStats> {
  if (!isSupabaseConfigured()) return { total_threads: 0, total_posts: 0, total_packs: 0, total_downloads: 0, active_users: 0 };
  const supabase = await getSupabase();
  const [threads, posts, packs, downloads] = await Promise.all([
    supabase.from('forum_threads').select('*', { count: 'exact', head: true }).eq('is_hidden', false),
    supabase.from('forum_posts').select('*', { count: 'exact', head: true }).eq('is_hidden', false),
    supabase.from('forum_threads').select('*', { count: 'exact', head: true }).eq('is_translation_pack', true).eq('is_hidden', false),
    supabase.from('forum_downloads').select('*', { count: 'exact', head: true }),
  ]);
  
  return {
    total_threads: threads.count || 0,
    total_posts: posts.count || 0,
    total_packs: packs.count || 0,
    total_downloads: downloads.count || 0,
    active_users: 0, // TODO: calcolare utenti attivi ultimi 7 giorni
  };
}

// ─── SEARCH ──────────────────────────────────────────────────────────────────

export async function searchForum(query: string, limit = 20): Promise<ForumThread[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('forum_threads')
    .select(`
      *,
      category:forum_categories(id, slug, name, icon, color)
    `)
    .eq('is_hidden', false)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

