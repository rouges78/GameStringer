/**
 * 🌐 Community Hub Backend — Supabase Integration
 * 
 * Collega il Community Hub a un backend Supabase reale per:
 * - Autenticazione utenti (OAuth, email, anonimo)
 * - Storage pacchetti di traduzione (Supabase Storage / S3-compatible)
 * - Database PostgreSQL per pack metadata, reviews, ratings
 * - Sistema di moderazione con status (draft → pending → published → verified → featured)
 * 
 * Schema DB (da creare in Supabase):
 * - translation_packs: metadata dei pack
 * - pack_files: file associati ai pack
 * - pack_reviews: recensioni utenti
 * - pack_downloads: contatore download
 * - user_profiles: profili utenti con reputation
 * - moderation_queue: coda moderazione
 */

import type { TranslationPack, CommunityAuthor, PackReview, PackSearchFilters, HubStats, PackFile } from './community-hub-service';

// ─── CONFIG ──────────────────────────────────────────────────────

const STORAGE_KEY_SUPABASE = 'gs_supabase_config';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}

function getConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUPABASE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { url: '', anonKey: '', enabled: false };
}

export function saveConfig(config: SupabaseConfig): void {
  localStorage.setItem(STORAGE_KEY_SUPABASE, JSON.stringify(config));
}

export function isBackendEnabled(): boolean {
  const cfg = getConfig();
  return cfg.enabled && !!cfg.url && !!cfg.anonKey;
}

// ─── SUPABASE CLIENT ─────────────────────────────────────────────

let _supabaseClient: any = null;

async function getSupabase() {
  if (_supabaseClient) return _supabaseClient;
  const cfg = getConfig();
  if (!cfg.url || !cfg.anonKey) throw new Error('Supabase non configurato');

  // Dynamic import — richiede `npm install @supabase/supabase-js`
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let createClient: any;
  try {
    // Use eval to prevent webpack from statically resolving this
    const mod = await (eval('import("@supabase/supabase-js")') as Promise<any>);
    createClient = mod.createClient;
  } catch {
    throw new Error('Pacchetto @supabase/supabase-js non installato. Esegui: npm install @supabase/supabase-js');
  }
  _supabaseClient = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _supabaseClient;
}

// ─── AUTH ─────────────────────────────────────────────────────────

export interface HubUser {
  id: string;
  email?: string;
  username: string;
  avatar?: string;
  reputation: number;
  totalContributions: number;
  verifiedTranslator: boolean;
  createdAt: string;
}

export async function signInWithEmail(email: string, password: string): Promise<HubUser> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login fallito: ${error.message}`);
  return fetchUserProfile(data.user.id);
}

export async function signUpWithEmail(email: string, password: string, username: string): Promise<HubUser> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
  if (error) throw new Error(`Registrazione fallita: ${error.message}`);
  
  // Create user profile
  await supabase.from('user_profiles').insert({
    id: data.user!.id,
    username,
    reputation: 0,
    total_contributions: 0,
    verified_translator: false,
  });
  
  return { id: data.user!.id, email, username, reputation: 0, totalContributions: 0, verifiedTranslator: false, createdAt: new Date().toISOString() };
}

export async function signInWithOAuth(provider: 'github' | 'google' | 'discord'): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({ provider });
  if (error) throw new Error(`OAuth fallito: ${error.message}`);
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<HubUser | null> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  try {
    return await fetchUserProfile(data.user.id);
  } catch {
    return null;
  }
}

async function fetchUserProfile(userId: string): Promise<HubUser> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
  if (error || !data) throw new Error('Profilo non trovato');
  return {
    id: data.id,
    email: data.email,
    username: data.username,
    avatar: data.avatar_url,
    reputation: data.reputation || 0,
    totalContributions: data.total_contributions || 0,
    verifiedTranslator: data.verified_translator || false,
    createdAt: data.created_at,
  };
}

// ─── PACKS — CRUD ────────────────────────────────────────────────

export async function fetchPacks(filters: PackSearchFilters = {}): Promise<{ packs: TranslationPack[]; total: number }> {
  const supabase = await getSupabase();
  let query = supabase.from('translation_packs').select('*, author:user_profiles!author_id(*)', { count: 'exact' });

  if (filters.query) query = query.or(`name.ilike.%${filters.query}%,game_name.ilike.%${filters.query}%`);
  if (filters.gameId) query = query.eq('game_id', filters.gameId);
  if (filters.platform) query = query.eq('platform', filters.platform);
  if (filters.sourceLanguage) query = query.eq('source_language', filters.sourceLanguage);
  if (filters.targetLanguage) query = query.eq('target_language', filters.targetLanguage);
  if (filters.minRating) query = query.gte('rating', filters.minRating);
  if (filters.minCompletion) query = query.gte('completion_percentage', filters.minCompletion);
  if (filters.status && filters.status.length > 0) query = query.in('status', filters.status);
  if (filters.patchFormat) query = query.eq('patch_format', filters.patchFormat);

  // Sort
  const sortCol = {
    downloads: 'downloads',
    rating: 'rating',
    updated: 'updated_at',
    completion: 'completion_percentage',
  }[filters.sortBy || 'downloads'] || 'downloads';
  query = query.order(sortCol, { ascending: filters.sortOrder === 'asc' });

  // Pagination
  const page = filters.page || 0;
  const limit = filters.limit || 20;
  query = query.range(page * limit, (page + 1) * limit - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(`Errore ricerca: ${error.message}`);

  const packs: TranslationPack[] = (data || []).map(mapPackRow);
  return { packs, total: count || 0 };
}

export async function fetchPackById(packId: string): Promise<TranslationPack | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('translation_packs')
    .select('*, author:user_profiles!author_id(*), pack_files(*)')
    .eq('id', packId)
    .single();
  if (error || !data) return null;
  return mapPackRow(data);
}

export async function publishPack(pack: Partial<TranslationPack>, files: File[]): Promise<TranslationPack> {
  const supabase = await getSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Devi essere autenticato per pubblicare');

  // 1. Insert pack metadata
  const { data: packData, error: packError } = await supabase.from('translation_packs').insert({
    name: pack.name,
    game_id: pack.gameId,
    game_name: pack.gameName,
    game_app_id: pack.gameAppId,
    platform: pack.platform,
    source_language: pack.sourceLanguage,
    target_language: pack.targetLanguage,
    version: pack.version || '1.0.0',
    author_id: user.id,
    description: pack.description,
    total_strings: pack.totalStrings || 0,
    translated_strings: pack.translatedStrings || 0,
    completion_percentage: pack.completionPercentage || 0,
    tags: pack.tags || [],
    status: 'pending', // Richiede moderazione
    patch_format: pack.patchFormat,
    patch_instructions: pack.patchInstructions,
    compatibility: pack.compatibility || [],
  }).select().single();

  if (packError) throw new Error(`Errore pubblicazione: ${packError.message}`);

  // 2. Upload files to Supabase Storage
  const uploadedFiles: PackFile[] = [];
  for (const file of files) {
    const storagePath = `packs/${packData.id}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from('translation-packs').upload(storagePath, file);
    if (uploadError) {
      console.warn(`Upload fallito per ${file.name}:`, uploadError);
      continue;
    }

    // 3. Insert file record
    const ext = file.name.split('.').pop()?.toLowerCase() || 'json';
    const { data: fileData } = await supabase.from('pack_files').insert({
      pack_id: packData.id,
      name: file.name,
      path: storagePath,
      type: ext,
      size: file.size,
      string_count: 0,
    }).select().single();

    if (fileData) uploadedFiles.push(mapFileRow(fileData));
  }

  // 4. Update user contribution count
  await supabase.rpc('increment_contributions', { user_id: user.id });

  return mapPackRow({ ...packData, pack_files: uploadedFiles, author: user });
}

export async function updatePack(packId: string, updates: Partial<TranslationPack>): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('translation_packs').update({
    name: updates.name,
    description: updates.description,
    version: updates.version,
    total_strings: updates.totalStrings,
    translated_strings: updates.translatedStrings,
    completion_percentage: updates.completionPercentage,
    tags: updates.tags,
    patch_format: updates.patchFormat,
    patch_instructions: updates.patchInstructions,
    updated_at: new Date().toISOString(),
  }).eq('id', packId);
  if (error) throw new Error(`Errore aggiornamento: ${error.message}`);
}

export async function deletePack(packId: string): Promise<void> {
  const supabase = await getSupabase();
  // Delete files from storage
  const { data: files } = await supabase.from('pack_files').select('path').eq('pack_id', packId);
  if (files) {
    for (const f of files) {
      await supabase.storage.from('translation-packs').remove([f.path]);
    }
  }
  // Delete pack and related data (cascade)
  await supabase.from('translation_packs').delete().eq('id', packId);
}

// ─── DOWNLOADS ───────────────────────────────────────────────────

export async function downloadPack(packId: string): Promise<Blob> {
  const supabase = await getSupabase();
  
  // Get pack files
  const { data: files } = await supabase.from('pack_files').select('*').eq('pack_id', packId);
  if (!files || files.length === 0) throw new Error('Nessun file nel pack');

  // Download first file (primary)
  const { data, error } = await supabase.storage.from('translation-packs').download(files[0].path);
  if (error) throw new Error(`Download fallito: ${error.message}`);

  // Increment download counter
  await supabase.rpc('increment_downloads', { pack_id: packId });

  return data;
}

export async function getDownloadUrl(packId: string, fileName: string): Promise<string> {
  const supabase = await getSupabase();
  const { data: files } = await supabase.from('pack_files').select('path').eq('pack_id', packId).eq('name', fileName);
  if (!files || files.length === 0) throw new Error('File non trovato');

  const { data } = supabase.storage.from('translation-packs').getPublicUrl(files[0].path);
  return data.publicUrl;
}

// ─── REVIEWS ─────────────────────────────────────────────────────

export async function fetchReviews(packId: string): Promise<PackReview[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('pack_reviews')
    .select('*, author:user_profiles!author_id(*)')
    .eq('pack_id', packId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Errore reviews: ${error.message}`);
  return (data || []).map(mapReviewRow);
}

export async function submitReview(packId: string, rating: number, title: string, content: string): Promise<PackReview> {
  const supabase = await getSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Devi essere autenticato');

  const { data, error } = await supabase.from('pack_reviews').insert({
    pack_id: packId,
    author_id: user.id,
    rating,
    title,
    content,
    helpful: 0,
    not_helpful: 0,
    verified: false,
  }).select('*, author:user_profiles!author_id(*)').single();

  if (error) throw new Error(`Errore review: ${error.message}`);

  // Update pack average rating
  await supabase.rpc('update_pack_rating', { target_pack_id: packId });

  return mapReviewRow(data);
}

export async function voteReview(reviewId: string, helpful: boolean): Promise<void> {
  const supabase = await getSupabase();
  const column = helpful ? 'helpful' : 'not_helpful';
  await supabase.rpc('increment_review_vote', { review_id: reviewId, vote_column: column });
}

// ─── MODERATION ──────────────────────────────────────────────────

export type ModerationAction = 'approve' | 'reject' | 'feature' | 'unflag';

export async function moderatePack(packId: string, action: ModerationAction, reason?: string): Promise<void> {
  const supabase = await getSupabase();
  const statusMap: Record<ModerationAction, string> = {
    approve: 'published',
    reject: 'draft',
    feature: 'featured',
    unflag: 'published',
  };

  const { error } = await supabase.from('translation_packs').update({
    status: statusMap[action],
    moderation_note: reason,
    moderated_at: new Date().toISOString(),
  }).eq('id', packId);

  if (error) throw new Error(`Errore moderazione: ${error.message}`);

  // Log moderation action
  await supabase.from('moderation_log').insert({
    pack_id: packId,
    action,
    reason,
  });
}

export async function getModerationQueue(): Promise<TranslationPack[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('translation_packs')
    .select('*, author:user_profiles!author_id(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Errore coda moderazione: ${error.message}`);
  return (data || []).map(mapPackRow);
}

export async function reportPack(packId: string, reason: string): Promise<void> {
  const supabase = await getSupabase();
  const user = await getCurrentUser();
  await supabase.from('pack_reports').insert({
    pack_id: packId,
    reporter_id: user?.id,
    reason,
  });
}

// ─── STATS ───────────────────────────────────────────────────────

export async function fetchHubStats(): Promise<HubStats> {
  const supabase = await getSupabase();
  
  const [packsRes, dlRes, usersRes, stringsRes] = await Promise.all([
    supabase.from('translation_packs').select('*', { count: 'exact', head: true }).in('status', ['published', 'verified', 'featured']),
    supabase.rpc('total_downloads'),
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.rpc('total_translated_strings'),
  ]);

  // Top languages
  const { data: langData } = await supabase.from('translation_packs')
    .select('target_language')
    .in('status', ['published', 'verified', 'featured']);
  const langCounts = (langData || []).reduce((acc: Record<string, number>, r: any) => {
    acc[r.target_language] = (acc[r.target_language] || 0) + 1;
    return acc;
  }, {});
  const topLanguages = Object.entries(langCounts)
    .map(([language, packs]) => ({ language, packs: packs as number }))
    .sort((a, b) => b.packs - a.packs)
    .slice(0, 10);

  // Top games
  const { data: gameData } = await supabase.from('translation_packs')
    .select('game_id, game_name')
    .in('status', ['published', 'verified', 'featured']);
  const gameCounts: Record<string, { name: string; count: number }> = (gameData || []).reduce((acc: Record<string, { name: string; count: number }>, r: any) => {
    if (!acc[r.game_id]) acc[r.game_id] = { name: r.game_name, count: 0 };
    acc[r.game_id].count++;
    return acc;
  }, {} as Record<string, { name: string; count: number }>);
  const topGames = Object.entries(gameCounts)
    .map(([gameId, val]) => ({ gameId, gameName: val.name, packs: val.count }))
    .sort((a, b) => b.packs - a.packs)
    .slice(0, 10);

  return {
    totalPacks: packsRes.count || 0,
    totalDownloads: dlRes.data || 0,
    totalContributors: usersRes.count || 0,
    totalStrings: stringsRes.data || 0,
    languagesCovered: Object.keys(langCounts).length,
    gamesCovered: Object.keys(gameCounts).length,
    topLanguages,
    topGames,
    recentActivity: [],
  };
}

// ─── MAPPERS ─────────────────────────────────────────────────────

function mapPackRow(row: any): TranslationPack {
  const author: CommunityAuthor = row.author ? {
    id: row.author.id,
    username: row.author.username,
    avatar: row.author.avatar_url,
    reputation: row.author.reputation || 0,
    totalContributions: row.author.total_contributions || 0,
    verifiedTranslator: row.author.verified_translator || false,
  } : { id: row.author_id, username: 'Unknown', reputation: 0, totalContributions: 0, verifiedTranslator: false };

  return {
    id: row.id,
    name: row.name,
    gameId: row.game_id,
    gameName: row.game_name,
    gameAppId: row.game_app_id,
    coverImage: row.cover_image,
    platform: row.platform,
    sourceLanguage: row.source_language,
    targetLanguage: row.target_language,
    version: row.version,
    author,
    contributors: [],
    description: row.description || '',
    totalStrings: row.total_strings || 0,
    translatedStrings: row.translated_strings || 0,
    completionPercentage: row.completion_percentage || 0,
    rating: row.rating || 0,
    ratingCount: row.rating_count || 0,
    downloads: row.downloads || 0,
    size: row.size || 0,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    changelog: row.changelog || [],
    files: (row.pack_files || []).map(mapFileRow),
    status: row.status || 'draft',
    compatibility: row.compatibility || [],
    patchFormat: row.patch_format,
    patchInstructions: row.patch_instructions,
  };
}

function mapFileRow(row: any): PackFile {
  return {
    name: row.name,
    path: row.path,
    type: row.type,
    size: row.size || 0,
    stringCount: row.string_count || 0,
  };
}

function mapReviewRow(row: any): PackReview {
  return {
    id: row.id,
    packId: row.pack_id,
    author: row.author ? {
      id: row.author.id,
      username: row.author.username,
      avatar: row.author.avatar_url,
      reputation: row.author.reputation || 0,
      totalContributions: row.author.total_contributions || 0,
      verifiedTranslator: row.author.verified_translator || false,
    } : { id: '', username: 'Unknown', reputation: 0, totalContributions: 0, verifiedTranslator: false },
    rating: row.rating,
    title: row.title,
    content: row.content,
    helpful: row.helpful || 0,
    notHelpful: row.not_helpful || 0,
    createdAt: row.created_at,
    verified: row.verified || false,
  };
}

// ─── SQL MIGRATION ───────────────────────────────────────────────

/**
 * SQL da eseguire in Supabase Dashboard → SQL Editor per creare le tabelle.
 * Questo è solo di riferimento — l'utente deve eseguirlo manualmente.
 */
export const SUPABASE_MIGRATION_SQL = `
-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  avatar_url TEXT,
  reputation INTEGER DEFAULT 0,
  total_contributions INTEGER DEFAULT 0,
  verified_translator BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Translation Packs
CREATE TABLE IF NOT EXISTS translation_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  game_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  game_app_id INTEGER,
  cover_image TEXT,
  platform TEXT,
  source_language TEXT NOT NULL DEFAULT 'en',
  target_language TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  author_id UUID REFERENCES user_profiles(id),
  description TEXT DEFAULT '',
  total_strings INTEGER DEFAULT 0,
  translated_strings INTEGER DEFAULT 0,
  completion_percentage REAL DEFAULT 0,
  rating REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  size BIGINT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending','published','verified','featured')),
  patch_format TEXT,
  patch_instructions TEXT,
  compatibility TEXT[] DEFAULT '{}',
  changelog JSONB DEFAULT '[]',
  moderation_note TEXT,
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pack Files
CREATE TABLE IF NOT EXISTS pack_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES translation_packs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  size BIGINT DEFAULT 0,
  string_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pack Reviews
CREATE TABLE IF NOT EXISTS pack_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES translation_packs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES user_profiles(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  helpful INTEGER DEFAULT 0,
  not_helpful INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pack_id, author_id)
);

-- Pack Reports
CREATE TABLE IF NOT EXISTS pack_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES translation_packs(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES user_profiles(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Moderation Log
CREATE TABLE IF NOT EXISTS moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES translation_packs(id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES user_profiles(id),
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC Functions
CREATE OR REPLACE FUNCTION increment_downloads(pack_id UUID)
RETURNS VOID AS $$
  UPDATE translation_packs SET downloads = downloads + 1 WHERE id = pack_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_contributions(user_id UUID)
RETURNS VOID AS $$
  UPDATE user_profiles SET total_contributions = total_contributions + 1 WHERE id = user_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION update_pack_rating(target_pack_id UUID)
RETURNS VOID AS $$
  UPDATE translation_packs SET 
    rating = (SELECT AVG(rating) FROM pack_reviews WHERE pack_id = target_pack_id),
    rating_count = (SELECT COUNT(*) FROM pack_reviews WHERE pack_id = target_pack_id)
  WHERE id = target_pack_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION total_downloads()
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(downloads), 0) FROM translation_packs;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION total_translated_strings()
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(translated_strings), 0) FROM translation_packs;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_review_vote(review_id UUID, vote_column TEXT)
RETURNS VOID AS $$
BEGIN
  IF vote_column = 'helpful' THEN
    UPDATE pack_reviews SET helpful = helpful + 1 WHERE id = review_id;
  ELSIF vote_column = 'not_helpful' THEN
    UPDATE pack_reviews SET not_helpful = not_helpful + 1 WHERE id = review_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_packs_game_id ON translation_packs(game_id);
CREATE INDEX IF NOT EXISTS idx_packs_target_language ON translation_packs(target_language);
CREATE INDEX IF NOT EXISTS idx_packs_status ON translation_packs(status);
CREATE INDEX IF NOT EXISTS idx_packs_downloads ON translation_packs(downloads DESC);
CREATE INDEX IF NOT EXISTS idx_packs_rating ON translation_packs(rating DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_pack_id ON pack_reviews(pack_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('translation-packs', 'translation-packs', true) ON CONFLICT DO NOTHING;

-- RLS Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public read published packs" ON translation_packs FOR SELECT USING (status IN ('published','verified','featured') OR author_id = auth.uid());
CREATE POLICY "Authenticated users create packs" ON translation_packs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authors update own packs" ON translation_packs FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Authors delete own packs" ON translation_packs FOR DELETE USING (author_id = auth.uid());

CREATE POLICY "Public read pack files" ON pack_files FOR SELECT USING (true);
CREATE POLICY "Authors manage pack files" ON pack_files FOR ALL USING (
  EXISTS (SELECT 1 FROM translation_packs WHERE id = pack_id AND author_id = auth.uid())
);

CREATE POLICY "Public read reviews" ON pack_reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users create reviews" ON pack_reviews FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authors update own reviews" ON pack_reviews FOR UPDATE USING (author_id = auth.uid());
`;
