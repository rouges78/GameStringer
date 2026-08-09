import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
import { clientLogger } from '@/lib/client-logger';
import { isTauri } from '@/lib/tauri-api';
import { checkThrottle, markThrottledAction, HUB_THROTTLE_MS } from './hub-cache';

// Instrada le fetch di supabase-js attraverso un comando Rust (supabase_proxy_fetch)
// per evitare il blocco CORS del webview Tauri verso Supabase. Fuori da Tauri
// (browser puro / SSR) ricade sul fetch nativo. Pensato per traffico JSON (auth + REST):
// il body è gestito come testo, quindi non adatto a download binari da Storage.
async function tauriProxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!isTauri()) return fetch(input, init);

  const reqObj = input instanceof Request ? input : null;
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  const method = (init?.method ?? reqObj?.method ?? 'GET').toUpperCase();

  const headers: Record<string, string> = {};
  const collect = (h?: HeadersInit) => {
    if (!h) return;
    if (h instanceof Headers) h.forEach((v, k) => { headers[k] = v; });
    else if (Array.isArray(h)) for (const [k, v] of h) headers[k] = v;
    else Object.assign(headers, h as Record<string, string>);
  };
  collect(reqObj?.headers);
  collect(init?.headers);

  let body: string | null = null;
  if (init?.body != null) {
    body = typeof init.body === 'string' ? init.body : await new Response(init.body as BodyInit).text();
  } else if (reqObj && reqObj.body != null) {
    body = await reqObj.clone().text();
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const res = await invoke<{ status: number; status_text: string; headers: Record<string, string>; body: string }>(
      'supabase_proxy_fetch',
      { req: { url, method, headers, body } }
    );
    const nullBody = res.status === 204 || res.status === 205 || res.status === 304;
    return new Response(nullBody ? null : res.body, {
      status: res.status,
      statusText: res.status_text,
      headers: res.headers,
    });
  } catch (e) {
    // Mantieni i token "network"/"fetch" per la classificazione transitoria a valle.
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`network: proxy fetch Supabase fallita: ${msg}`);
  }
}

// ─── CONFIG ──────────────────────────────────────────────────────

const STORAGE_KEY_SUPABASE = 'gs_supabase_config';

// Built-in defaults — la chat funziona subito per tutti senza configurazione
const DEFAULT_SUPABASE_URL = 'https://relbkjoxdnbqizgomzhs.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbGJram94ZG5icWl6Z29temhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDcxMDUsImV4cCI6MjA4OTkyMzEwNX0.TY4pVsZVJ3vS_8AArXXr4RghxUn1ATju4kiVwjzpdyM';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}

function getConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUPABASE);
    if (raw) {
      const cfg = JSON.parse(raw) as SupabaseConfig;
      if (cfg.url && cfg.anonKey) return cfg;
    }
  } catch {}
  // Usa defaults built-in e salva in localStorage per persistenza
  const defaults: SupabaseConfig = {
    url: DEFAULT_SUPABASE_URL,
    anonKey: DEFAULT_SUPABASE_ANON_KEY,
    enabled: true,
  };
  try { localStorage.setItem(STORAGE_KEY_SUPABASE, JSON.stringify(defaults)); } catch {}
  return defaults;
}

export function saveConfig(config: SupabaseConfig): void {
  localStorage.setItem(STORAGE_KEY_SUPABASE, JSON.stringify(config));
}

export function isBackendEnabled(): boolean {
  const cfg = getConfig();
  return cfg.enabled && !!cfg.url && !!cfg.anonKey;
}

// ─── SUPABASE CLIENT ─────────────────────────────────────────────

let _supabaseClient: SupabaseClient | null = null;
let _lastConfigHash = '';

function configHash(cfg: SupabaseConfig): string {
  return `${cfg.url}|${cfg.anonKey}`;
}

export function resetSupabaseClient(): void {
  _supabaseClient = null;
  _lastConfigHash = '';
}

export function isSupabaseConfigured(): boolean {
  const cfg = getConfig();
  return !!(cfg.url && cfg.anonKey);
}

export async function getSupabase(): Promise<SupabaseClient> {
  const cfg = getConfig();
  if (!cfg.url || !cfg.anonKey) throw new Error('Supabase non configurato');

  const hash = configHash(cfg);
  if (_supabaseClient && hash === _lastConfigHash) return _supabaseClient;

  // Config changed or first init — (re)create client
  _supabaseClient = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    global: {
      // In Tauri instradiamo le richieste via comando Rust (no CORS); fuori da Tauri
      // usa il fetch nativo. Vedi tauriProxyFetch sopra.
      fetch: tauriProxyFetch,
    },
  });
  _lastConfigHash = hash;
  clientLogger.debug('[Supabase] Client creato per:', cfg.url);
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
  bio?: string;
  website?: string;
  discord?: string;
  github?: string;
  followersCount?: number;
  followingCount?: number;
  favoriteLanguage?: string;
  country?: string;
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
    bio: data.bio,
    website: data.website,
    discord: data.discord,
    github: data.github,
    followersCount: data.followers_count || 0,
    followingCount: data.following_count || 0,
    favoriteLanguage: data.favorite_language,
    country: data.country,
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
    // NIENTE `status` qui. Lo decide il trigger enforce_pack_status
    // (migration 20260809): 'published' per gli autori verificati, 'pending'
    // per gli altri, e solo un moderatore può cambiarlo dopo. Mandarlo dal
    // client sarebbe teatro — il trigger lo sovrascrive comunque, e prima del
    // trigger chiunque poteva scrivere 'published' e saltare la coda.
    // Lo status VERO si legge dalla riga restituita, qui sotto.
    patch_format: pack.patchFormat,
    patch_instructions: pack.patchInstructions,
    compatibility: pack.compatibility || [],
  }).select().single();

  if (packError) throw new Error(`Errore pubblicazione: ${packError.message}`);

  // 2. Upload files to Supabase Storage (con SHA-256 per l'integrità)
  const { sha256Hex, aggregatePackSha256, sanitizePackFileName } = await import('@/lib/pack-integrity');
  const uploadedFiles: PackFile[] = [];
  const fileHashes: Array<{ name: string; sha256: string }> = [];
  for (const file of files) {
    // Mai fidarsi del nome file: solo basename, niente separatori/traversal.
    const safeName = sanitizePackFileName(file.name);
    if (!safeName) {
      clientLogger.warn(`Nome file non valido, saltato:`, file.name);
      continue;
    }
    const fileSha256 = await sha256Hex(await file.arrayBuffer());
    const storagePath = `packs/${packData.id}/${safeName}`;
    const { error: uploadError } = await supabase.storage.from('translation-packs').upload(storagePath, file);
    if (uploadError) {
      clientLogger.warn(`Upload fallito per ${safeName}:`, String(uploadError));
      continue;
    }

    // 3. Insert file record
    const ext = safeName.split('.').pop()?.toLowerCase() || 'json';
    const { data: fileData } = await supabase.from('pack_files').insert({
      pack_id: packData.id,
      name: safeName,
      path: storagePath,
      type: ext,
      size: file.size,
      string_count: 0,
      sha256: fileSha256,
    }).select().single();

    if (fileData) {
      uploadedFiles.push(mapFileRow(fileData));
      fileHashes.push({ name: safeName, sha256: fileSha256 });
    }
  }

  // 3b. Hash aggregato del pack (badge integrità + verifica al download)
  if (fileHashes.length > 0) {
    const contentSha256 = await aggregatePackSha256(fileHashes);
    await supabase.from('translation_packs')
      .update({ content_sha256: contentSha256 })
      .eq('id', packData.id);
    packData.content_sha256 = contentSha256;
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

export interface DownloadedPackFile {
  name: string;
  path: string;
  content: string;
  sha256?: string | null;
}

/**
 * Scarica TUTTI i file di un pack da Supabase Storage come testo.
 * A differenza di downloadPack() (solo il primo file come Blob), serve a
 * ricostruire l'intero pacchetto per salvarlo localmente (.gspack) e applicarlo.
 * Incrementa il contatore download una sola volta per l'intero pack.
 *
 * INTEGRITÀ: se il pack è stato pubblicato con gli hash (pack_files.sha256),
 * ogni file scaricato viene riverificato con SHA-256 e un mismatch BLOCCA
 * l'intero download (niente install di contenuto manomesso). I pack storici
 * senza hash passano come 'legacy'.
 */
export async function downloadPackFiles(packId: string): Promise<DownloadedPackFile[]> {
  const supabase = await getSupabase();
  const { sha256Hex, sanitizePackFileName } = await import('@/lib/pack-integrity');

  const { data: files, error: filesErr } = await supabase
    .from('pack_files')
    .select('*')
    .eq('pack_id', packId);
  if (filesErr) throw new Error(`Errore lettura file: ${filesErr.message}`);
  if (!files || files.length === 0) throw new Error('Nessun file nel pack');

  const out: DownloadedPackFile[] = [];
  for (const f of files) {
    const safeName = sanitizePackFileName(f.name);
    if (!safeName) {
      clientLogger.warn(`Nome file non valido nel pack, saltato: ${f.name}`);
      continue;
    }
    const { data, error } = await supabase.storage.from('translation-packs').download(f.path);
    if (error || !data) {
      clientLogger.warn(`Download fallito per ${safeName}: ${error?.message || 'no data'}`);
      continue;
    }
    const buffer = await data.arrayBuffer();
    if (f.sha256) {
      const actual = await sha256Hex(buffer);
      if (actual !== f.sha256) {
        // Contenuto diverso da quello pubblicato: NON installare nulla.
        throw new Error(
          `Verifica integrità fallita per "${safeName}": il contenuto non corrisponde a quello pubblicato. Download annullato.`
        );
      }
    }
    out.push({
      name: safeName,
      path: f.path,
      content: new TextDecoder('utf-8').decode(buffer),
      sha256: f.sha256 ?? null,
    });
  }
  if (out.length === 0) throw new Error('Download dei file del pack fallito');

  await supabase.rpc('increment_downloads', { pack_id: packId });
  return out;
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
  // Throttle client-side: assorbe i "report" ravvicinati (min-interval) prima
  // che raggiungano la tabella condivisa. Non-breaking: se l'azione è troppo
  // ravvicinata esce silenziosamente (no-op), senza errori per il chiamante.
  const throttle = checkThrottle('report', HUB_THROTTLE_MS.report);
  if (!throttle.allowed) return;

  const supabase = await getSupabase();
  const user = await getCurrentUser();
  await supabase.from('pack_reports').insert({
    pack_id: packId,
    reporter_id: user?.id,
    reason,
  });
  markThrottledAction('report');
}

// ─── FOLLOWERS ────────────────────────────────────────────────────

export async function followUser(targetId: string): Promise<void> {
  const supabase = await getSupabase();
  await supabase.rpc('follow_user', { target_id: targetId });
}

export async function unfollowUser(targetId: string): Promise<void> {
  const supabase = await getSupabase();
  await supabase.rpc('unfollow_user', { target_id: targetId });
}

export async function isFollowing(targetId: string): Promise<boolean> {
  const supabase = await getSupabase();
  const user = await getCurrentUser();
  if (!user) return false;
  const { data } = await supabase.from('user_followers').select('id').eq('follower_id', user.id).eq('following_id', targetId).maybeSingle();
  return !!data;
}

export async function getFollowers(userId: string): Promise<HubUser[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('user_followers')
    .select('follower:user_profiles!follower_id(*)')
    .eq('following_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Errore followers: ${error.message}`);
  return (data || []).map((r: Record<string, any>) => mapUserRow(r.follower));
}

export async function getFollowing(userId: string): Promise<HubUser[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('user_followers')
    .select('following:user_profiles!following_id(*)')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Errore following: ${error.message}`);
  return (data || []).map((r: Record<string, any>) => mapUserRow(r.following));
}

function mapUserRow(row: Record<string, any>): HubUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    avatar: row.avatar_url,
    reputation: row.reputation || 0,
    totalContributions: row.total_contributions || 0,
    verifiedTranslator: row.verified_translator || false,
    createdAt: row.created_at,
    bio: row.bio,
    website: row.website,
    discord: row.discord,
    github: row.github,
    followersCount: row.followers_count || 0,
    followingCount: row.following_count || 0,
    favoriteLanguage: row.favorite_language,
    country: row.country,
  };
}

// ─── COMMENTS ─────────────────────────────────────────────────────

export interface PackComment {
  id: string;
  packId: string;
  author: { id: string; username: string; avatar?: string; verifiedTranslator: boolean };
  parentId: string | null;
  content: string;
  edited: boolean;
  likes: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  replies?: PackComment[];
}

export async function fetchComments(packId: string): Promise<PackComment[]> {
  const supabase = await getSupabase();
  const user = await getCurrentUser();
  
  const { data, error } = await supabase
    .from('pack_comments')
    .select('*, author:user_profiles!author_id(id, username, avatar_url, verified_translator)')
    .eq('pack_id', packId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Errore commenti: ${error.message}`);

  // Get user's likes
  let myLikes = new Set<string>();
  if (user) {
    const { data: likes } = await supabase.from('comment_likes').select('comment_id').eq('user_id', user.id);
    myLikes = new Set((likes || []).map((l: any) => l.comment_id));
  }

  const comments: PackComment[] = (data || []).map((row: Record<string, any>) => ({
    id: row.id,
    packId: row.pack_id,
    author: {
      id: row.author?.id || '',
      username: row.author?.username || 'Unknown',
      avatar: row.author?.avatar_url,
      verifiedTranslator: row.author?.verified_translator || false,
    },
    parentId: row.parent_id,
    content: row.content,
    edited: row.edited || false,
    likes: row.likes || 0,
    likedByMe: myLikes.has(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  // Build threaded tree
  const rootComments: PackComment[] = [];
  const byId = new Map<string, PackComment>();
  for (const c of comments) { c.replies = []; byId.set(c.id, c); }
  for (const c of comments) {
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId)!.replies!.push(c);
    } else {
      rootComments.push(c);
    }
  }
  return rootComments;
}

export async function postComment(packId: string, content: string, parentId?: string): Promise<PackComment> {
  const supabase = await getSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Devi essere autenticato');

  const { data, error } = await supabase.from('pack_comments').insert({
    pack_id: packId,
    author_id: user.id,
    parent_id: parentId || null,
    content,
  }).select('*, author:user_profiles!author_id(id, username, avatar_url, verified_translator)').single();

  if (error) throw new Error(`Errore commento: ${error.message}`);

  // Notify pack author
  const { data: pack } = await supabase.from('translation_packs').select('author_id, name').eq('id', packId).single();
  if (pack && pack.author_id !== user.id) {
    await supabase.from('user_notifications').insert({
      user_id: pack.author_id,
      type: 'pack_comment',
      title: 'Nuovo commento',
      message: `${user.username} ha commentato su "${pack.name}"`,
      link: `/community-hub?pack=${packId}`,
      data: { pack_id: packId, comment_id: data.id },
    });
  }

  return {
    id: data.id,
    packId: data.pack_id,
    author: { id: data.author?.id, username: data.author?.username, avatar: data.author?.avatar_url, verifiedTranslator: data.author?.verified_translator },
    parentId: data.parent_id,
    content: data.content,
    edited: false,
    likes: 0,
    likedByMe: false,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    replies: [],
  };
}

export async function editComment(commentId: string, content: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('pack_comments').update({ content, edited: true, updated_at: new Date().toISOString() }).eq('id', commentId);
  if (error) throw new Error(`Errore modifica: ${error.message}`);
}

export async function deleteComment(commentId: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('pack_comments').delete().eq('id', commentId);
  if (error) throw new Error(`Errore eliminazione: ${error.message}`);
}

export async function toggleCommentLike(commentId: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { data } = await supabase.rpc('toggle_comment_like', { target_comment_id: commentId });
  return data as boolean;
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────

export interface HubNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  data: Record<string, any>;
  createdAt: string;
}

export async function fetchNotifications(limit = 50): Promise<HubNotification[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Errore notifiche: ${error.message}`);
  return (data || []).map((row: Record<string, any>) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message || '',
    link: row.link,
    read: row.read || false,
    data: row.data || {},
    createdAt: row.created_at,
  }));
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await getSupabase();
  const { count, error } = await supabase
    .from('user_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);
  if (error) return 0;
  return count || 0;
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  const supabase = await getSupabase();
  await supabase.rpc('mark_notifications_read', { notification_ids: ids });
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('user_notifications').update({ read: true }).eq('read', false);
  if (error) throw new Error(`Errore: ${error.message}`);
}

// ─── FAVORITES ────────────────────────────────────────────────────

export async function toggleFavorite(packId: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { data } = await supabase.rpc('toggle_favorite_pack', { target_pack_id: packId });
  return data as boolean;
}

export async function getFavorites(): Promise<TranslationPack[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('user_favorites')
    .select('pack:translation_packs!pack_id(*, author:user_profiles!author_id(*))')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Errore preferiti: ${error.message}`);
  return (data || []).map((r: Record<string, any>) => mapPackRow(r.pack));
}

export async function isFavorite(packId: string): Promise<boolean> {
  const supabase = await getSupabase();
  const user = await getCurrentUser();
  if (!user) return false;
  const { data } = await supabase.from('user_favorites').select('pack_id').eq('user_id', user.id).eq('pack_id', packId).maybeSingle();
  return !!data;
}

// ─── BADGES ───────────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
}

export interface BadgeAward {
  badge: Badge;
  awardedAt: string;
}

export async function getAllBadges(): Promise<Badge[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('user_badges').select('*').order('category');
  if (error) throw new Error(`Errore badges: ${error.message}`);
  return (data || []).map((r: Record<string, any>) => ({
    id: r.id, name: r.name, description: r.description, icon: r.icon, color: r.color, category: r.category,
  }));
}

export async function getUserBadges(userId: string): Promise<BadgeAward[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('user_badge_awards')
    .select('*, badge:user_badges!badge_id(*)')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false });
  if (error) throw new Error(`Errore badge utente: ${error.message}`);
  return (data || []).map((r: Record<string, any>) => ({
    badge: { id: r.badge.id, name: r.badge.name, description: r.badge.description, icon: r.badge.icon, color: r.badge.color, category: r.badge.category },
    awardedAt: r.awarded_at,
  }));
}

export async function checkBadges(): Promise<string[]> {
  const supabase = await getSupabase();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase.rpc('check_and_award_badges', { target_user_id: user.id });
  return (data as string[]) || [];
}

// ─── LEADERBOARD ──────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar?: string;
  reputation: number;
  totalContributions: number;
  verifiedTranslator: boolean;
  followersCount: number;
  country?: string;
  totalDownloads: number;
  publishedPacks: number;
  avgRating: number;
  badgeCount: number;
  score: number;
}

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('leaderboard').select('*').limit(limit);
  if (error) throw new Error(`Errore leaderboard: ${error.message}`);
  return (data || []).map((r: Record<string, any>) => ({
    id: r.id,
    username: r.username,
    avatar: r.avatar_url,
    reputation: r.reputation || 0,
    totalContributions: r.total_contributions || 0,
    verifiedTranslator: r.verified_translator || false,
    followersCount: r.followers_count || 0,
    country: r.country,
    totalDownloads: Number(r.total_downloads) || 0,
    publishedPacks: Number(r.published_packs) || 0,
    avgRating: Number(r.avg_rating) || 0,
    badgeCount: Number(r.badge_count) || 0,
    score: Number(r.score) || 0,
  }));
}

// ─── USER PROFILE (extended) ──────────────────────────────────────

export async function updateProfile(updates: {
  username?: string;
  bio?: string;
  website?: string;
  discord?: string;
  github?: string;
  favoriteLanguage?: string;
  country?: string;
}): Promise<void> {
  const supabase = await getSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Non autenticato');
  const { error } = await supabase.from('user_profiles').update({
    username: updates.username,
    bio: updates.bio,
    website: updates.website,
    discord: updates.discord,
    github: updates.github,
    favorite_language: updates.favoriteLanguage,
    country: updates.country,
  }).eq('id', user.id);
  if (error) throw new Error(`Errore aggiornamento profilo: ${error.message}`);
}

export async function getFullProfile(userId: string): Promise<HubUser & { badges: BadgeAward[]; packs: TranslationPack[]; favorites: number }> {
  const supabase = await getSupabase();
  
  const [profileRes, badgesRes, packsRes, favsRes] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', userId).single(),
    getUserBadges(userId),
    supabase.from('translation_packs').select('*, author:user_profiles!author_id(*)').eq('author_id', userId).in('status', ['published', 'verified', 'featured']).order('downloads', { ascending: false }),
    supabase.from('user_favorites').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  if (profileRes.error || !profileRes.data) throw new Error('Profilo non trovato');

  return {
    ...mapUserRow(profileRes.data),
    badges: badgesRes,
    packs: (packsRes.data || []).map(mapPackRow),
    favorites: favsRes.count || 0,
  };
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

function mapPackRow(row: Record<string, any>): TranslationPack {
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
    contentSha256: row.content_sha256 || undefined,
  };
}

function mapFileRow(row: Record<string, any>): PackFile {
  return {
    name: row.name,
    path: row.path,
    type: row.type,
    size: row.size || 0,
    stringCount: row.string_count || 0,
  };
}

function mapReviewRow(row: Record<string, any>): PackReview {
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

-- User Followers
CREATE TABLE IF NOT EXISTS user_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

-- User Badges
CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '',
  color TEXT DEFAULT '#a855f7',
  category TEXT DEFAULT 'general' CHECK (category IN ('general','contribution','quality','community','special')),
  requirement_type TEXT CHECK (requirement_type IN ('packs_published','downloads_total','reviews_given','reputation','verified_packs','followers','manual')),
  requirement_value INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Badge Awards
CREATE TABLE IF NOT EXISTS user_badge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES user_badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  awarded_by UUID REFERENCES user_profiles(id),
  UNIQUE(user_id, badge_id)
);

-- Pack Comments (threaded)
CREATE TABLE IF NOT EXISTS pack_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES translation_packs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES pack_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  edited BOOLEAN DEFAULT FALSE,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment Likes (prevent duplicate likes)
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES pack_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(user_id, comment_id)
);

-- User Notifications
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_follower','pack_review','pack_comment','pack_downloaded','badge_earned','pack_featured','pack_verified','system')),
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Favorites (bookmarked packs)
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES translation_packs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(user_id, pack_id)
);

-- Extend user_profiles with bio, social links, follower counts
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS discord TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS github TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS favorite_language TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT '';

-- Default badges
INSERT INTO user_badges (id, name, description, icon, color, category, requirement_type, requirement_value) VALUES
  ('first_pack',      'Prima Traduzione',    'Hai pubblicato il tuo primo pack',             '🎉', '#22c55e', 'contribution', 'packs_published', 1),
  ('prolific',        'Traduttore Prolifico','10 pack pubblicati',                            '📚', '#3b82f6', 'contribution', 'packs_published', 10),
  ('master',          'Maestro Traduttore',  '50 pack pubblicati',                            '👑', '#f59e0b', 'contribution', 'packs_published', 50),
  ('popular',         'Popolare',            '100 download totali sui tuoi pack',              '🔥', '#ef4444', 'quality',      'downloads_total', 100),
  ('viral',           'Virale',              '1000 download totali sui tuoi pack',             '🚀', '#a855f7', 'quality',      'downloads_total', 1000),
  ('reviewer',        'Critico',             'Hai scritto 10 recensioni',                      '✍️', '#06b6d4', 'community',    'reviews_given', 10),
  ('trusted',         'Verificato',          'Hai almeno 5 pack verificati',                   '✅', '#10b981', 'quality',      'verified_packs', 5),
  ('influencer',      'Influencer',          '50 follower',                                    '⭐', '#f97316', 'community',    'followers', 50),
  ('early_adopter',   'Early Adopter',       'Tra i primi 100 utenti registrati',              '🏅', '#8b5cf6', 'special',      'manual', 0),
  ('community_hero',  'Eroe della Community','Contributo eccezionale alla community',          '🦸', '#ec4899', 'special',      'manual', 0)
ON CONFLICT (id) DO NOTHING;

-- RPC: Follow/Unfollow
CREATE OR REPLACE FUNCTION follow_user(target_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_followers (follower_id, following_id) VALUES (auth.uid(), target_id) ON CONFLICT DO NOTHING;
  UPDATE user_profiles SET followers_count = followers_count + 1 WHERE id = target_id;
  UPDATE user_profiles SET following_count = following_count + 1 WHERE id = auth.uid();
  -- Notification
  INSERT INTO user_notifications (user_id, type, title, message, data)
  VALUES (target_id, 'new_follower', 'Nuovo follower!',
    (SELECT username FROM user_profiles WHERE id = auth.uid()) || ' ha iniziato a seguirti',
    jsonb_build_object('follower_id', auth.uid()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unfollow_user(target_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM user_followers WHERE follower_id = auth.uid() AND following_id = target_id;
  UPDATE user_profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = target_id;
  UPDATE user_profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Toggle comment like
CREATE OR REPLACE FUNCTION toggle_comment_like(target_comment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  already_liked BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM comment_likes WHERE user_id = auth.uid() AND comment_id = target_comment_id) INTO already_liked;
  IF already_liked THEN
    DELETE FROM comment_likes WHERE user_id = auth.uid() AND comment_id = target_comment_id;
    UPDATE pack_comments SET likes = GREATEST(likes - 1, 0) WHERE id = target_comment_id;
    RETURN FALSE;
  ELSE
    INSERT INTO comment_likes (user_id, comment_id) VALUES (auth.uid(), target_comment_id);
    UPDATE pack_comments SET likes = likes + 1 WHERE id = target_comment_id;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Toggle favorite pack
CREATE OR REPLACE FUNCTION toggle_favorite_pack(target_pack_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  already_fav BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM user_favorites WHERE user_id = auth.uid() AND pack_id = target_pack_id) INTO already_fav;
  IF already_fav THEN
    DELETE FROM user_favorites WHERE user_id = auth.uid() AND pack_id = target_pack_id;
    RETURN FALSE;
  ELSE
    INSERT INTO user_favorites (user_id, pack_id) VALUES (auth.uid(), target_pack_id);
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(notification_ids UUID[])
RETURNS VOID AS $$
  UPDATE user_notifications SET read = TRUE WHERE id = ANY(notification_ids) AND user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- RPC: Check and award badges automatically
CREATE OR REPLACE FUNCTION check_and_award_badges(target_user_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  badge RECORD;
  awarded TEXT[] := '{}';
  val INTEGER;
BEGIN
  FOR badge IN SELECT * FROM user_badges WHERE requirement_type != 'manual' LOOP
    -- Skip if already awarded
    IF EXISTS(SELECT 1 FROM user_badge_awards WHERE user_id = target_user_id AND badge_id = badge.id) THEN
      CONTINUE;
    END IF;

    -- Calculate value based on requirement type
    CASE badge.requirement_type
      WHEN 'packs_published' THEN
        SELECT COUNT(*) INTO val FROM translation_packs WHERE author_id = target_user_id AND status IN ('published','verified','featured');
      WHEN 'downloads_total' THEN
        SELECT COALESCE(SUM(downloads), 0) INTO val FROM translation_packs WHERE author_id = target_user_id;
      WHEN 'reviews_given' THEN
        SELECT COUNT(*) INTO val FROM pack_reviews WHERE author_id = target_user_id;
      WHEN 'reputation' THEN
        SELECT reputation INTO val FROM user_profiles WHERE id = target_user_id;
      WHEN 'verified_packs' THEN
        SELECT COUNT(*) INTO val FROM translation_packs WHERE author_id = target_user_id AND status = 'verified';
      WHEN 'followers' THEN
        SELECT followers_count INTO val FROM user_profiles WHERE id = target_user_id;
      ELSE
        CONTINUE;
    END CASE;

    IF val >= badge.requirement_value THEN
      INSERT INTO user_badge_awards (user_id, badge_id) VALUES (target_user_id, badge.id) ON CONFLICT DO NOTHING;
      awarded := awarded || badge.id;
      -- Notification
      INSERT INTO user_notifications (user_id, type, title, message, data)
      VALUES (target_user_id, 'badge_earned', 'Badge sbloccato!',
        badge.icon || ' ' || badge.name || ' — ' || badge.description,
        jsonb_build_object('badge_id', badge.id));
    END IF;
  END LOOP;
  RETURN awarded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Leaderboard View
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  up.id,
  up.username,
  up.avatar_url,
  up.reputation,
  up.total_contributions,
  up.verified_translator,
  up.followers_count,
  up.country,
  COALESCE(SUM(tp.downloads), 0) AS total_downloads,
  COUNT(DISTINCT tp.id) FILTER (WHERE tp.status IN ('published','verified','featured')) AS published_packs,
  COALESCE(AVG(tp.rating) FILTER (WHERE tp.rating > 0), 0) AS avg_rating,
  (SELECT COUNT(*) FROM user_badge_awards uba WHERE uba.user_id = up.id) AS badge_count,
  -- Score: reputation + downloads/10 + packs*50 + followers*5
  (up.reputation + COALESCE(SUM(tp.downloads), 0) / 10 + COUNT(DISTINCT tp.id) FILTER (WHERE tp.status IN ('published','verified','featured')) * 50 + up.followers_count * 5) AS score
FROM user_profiles up
LEFT JOIN translation_packs tp ON tp.author_id = up.id
GROUP BY up.id, up.username, up.avatar_url, up.reputation, up.total_contributions, up.verified_translator, up.followers_count, up.country
ORDER BY score DESC;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_packs_game_id ON translation_packs(game_id);
CREATE INDEX IF NOT EXISTS idx_packs_target_language ON translation_packs(target_language);
CREATE INDEX IF NOT EXISTS idx_packs_status ON translation_packs(status);
CREATE INDEX IF NOT EXISTS idx_packs_downloads ON translation_packs(downloads DESC);
CREATE INDEX IF NOT EXISTS idx_packs_rating ON translation_packs(rating DESC);
CREATE INDEX IF NOT EXISTS idx_packs_author ON translation_packs(author_id);
CREATE INDEX IF NOT EXISTS idx_reviews_pack_id ON pack_reviews(pack_id);
CREATE INDEX IF NOT EXISTS idx_comments_pack_id ON pack_comments(pack_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON pack_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_followers_follower ON user_followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following ON user_followers(following_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_badge_awards_user ON user_badge_awards(user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('translation-packs', 'translation-packs', true) ON CONFLICT DO NOTHING;

-- RLS Policies (existing tables)
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

-- RLS Policies (new tables)
ALTER TABLE user_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badge_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read followers" ON user_followers FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON user_followers FOR ALL USING (follower_id = auth.uid());

CREATE POLICY "Public read badges" ON user_badges FOR SELECT USING (true);
CREATE POLICY "Public read badge awards" ON user_badge_awards FOR SELECT USING (true);

CREATE POLICY "Public read comments" ON pack_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users create comments" ON pack_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authors edit own comments" ON pack_comments FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Authors delete own comments" ON pack_comments FOR DELETE USING (author_id = auth.uid());

CREATE POLICY "Public read comment likes" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own likes" ON comment_likes FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users read own notifications" ON user_notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON user_notifications FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Public read favorites" ON user_favorites FOR SELECT USING (true);
CREATE POLICY "Users manage own favorites" ON user_favorites FOR ALL USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- PRESENZA ONLINE
-- ═══════════════════════════════════════════════════════════════
-- NB: le chat (stanze, messaggi, DM) sono state rimosse dall'app il
-- 25/07/2026 — erano tre sistemi sovrapposti di fatto inutilizzati.
-- Resta la sola presenza, che alimenta l'indicatore "utenti online"
-- del Community Hub. Vedi docs/maintenance/2026-07-25-social-cleanup.md.

-- Presenza scritta dal client (heartbeat + stato)
CREATE TABLE IF NOT EXISTS community_presence (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online','away','offline')),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Presenza estesa (attività/gioco corrente), legata all'utente autenticato
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online','away','offline')),
  current_activity TEXT,
  current_game TEXT,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_presence_status ON community_presence(status, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status, last_heartbeat DESC);

ALTER TABLE community_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read community presence" ON community_presence FOR SELECT USING (true);
CREATE POLICY "Users manage own community presence" ON community_presence FOR ALL USING (user_id = auth.uid()::text);

CREATE POLICY "Public read presence" ON user_presence FOR SELECT USING (true);
CREATE POLICY "Users update own presence" ON user_presence FOR ALL USING (user_id = auth.uid());

-- RPC: heartbeat di presenza
CREATE OR REPLACE FUNCTION update_presence(new_status TEXT DEFAULT 'online')
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_presence (user_id, status, last_heartbeat, updated_at)
  VALUES (auth.uid(), new_status, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET status = new_status, last_heartbeat = NOW(), updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

