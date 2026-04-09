-- ============================================================================
-- GameStringer Hub — Supabase Schema
-- Execute this in your Supabase SQL Editor to create all marketplace tables.
-- ============================================================================

-- ── User Profiles ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  discord TEXT,
  github TEXT,
  country TEXT,
  favorite_language TEXT,
  reputation INTEGER DEFAULT 0,
  total_contributions INTEGER DEFAULT 0,
  verified_translator BOOLEAN DEFAULT false,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Translation Packs ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS translation_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  game_id TEXT,
  game_name TEXT NOT NULL,
  game_app_id INTEGER,
  platform TEXT DEFAULT 'pc',
  source_language TEXT NOT NULL DEFAULT 'en',
  target_language TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  author_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  description TEXT,
  total_strings INTEGER DEFAULT 0,
  translated_strings INTEGER DEFAULT 0,
  completion_percentage REAL DEFAULT 0,
  rating REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'published', 'verified', 'featured', 'rejected')),
  patch_format TEXT,
  patch_instructions TEXT,
  compatibility TEXT[] DEFAULT '{}',
  moderation_note TEXT,
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_packs_game ON translation_packs(game_name);
CREATE INDEX idx_packs_language ON translation_packs(target_language);
CREATE INDEX idx_packs_status ON translation_packs(status);
CREATE INDEX idx_packs_rating ON translation_packs(rating DESC);
CREATE INDEX idx_packs_downloads ON translation_packs(downloads DESC);
CREATE INDEX idx_packs_author ON translation_packs(author_id);

-- ── Pack Files (Storage references) ────────────────────────

CREATE TABLE IF NOT EXISTS pack_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES translation_packs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT DEFAULT 'json',
  size BIGINT DEFAULT 0,
  string_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pack_files_pack ON pack_files(pack_id);

-- ── Reviews ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pack_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES translation_packs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  helpful INTEGER DEFAULT 0,
  not_helpful INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pack_id, author_id)
);

CREATE INDEX idx_reviews_pack ON pack_reviews(pack_id);

-- ── Comments ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pack_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES translation_packs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES pack_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  edited BOOLEAN DEFAULT false,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_pack ON pack_comments(pack_id);

-- ── Comment Likes ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES pack_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- ── User Followers ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- ── Pack Reports (Moderation) ──────────────────────────────

CREATE TABLE IF NOT EXISTS pack_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES translation_packs(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Moderation Log ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES translation_packs(id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── RPC Functions ──────────────────────────────────────────

-- Increment download counter
CREATE OR REPLACE FUNCTION increment_downloads(pack_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE translation_packs SET downloads = downloads + 1 WHERE id = pack_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment user contribution counter
CREATE OR REPLACE FUNCTION increment_contributions(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles SET total_contributions = total_contributions + 1 WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update pack average rating
CREATE OR REPLACE FUNCTION update_pack_rating(target_pack_id UUID)
RETURNS void AS $$
DECLARE
  avg_rating REAL;
  count_rating INTEGER;
BEGIN
  SELECT AVG(rating), COUNT(*) INTO avg_rating, count_rating
  FROM pack_reviews WHERE pack_id = target_pack_id;

  UPDATE translation_packs
  SET rating = COALESCE(avg_rating, 0), rating_count = count_rating
  WHERE id = target_pack_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment review vote
CREATE OR REPLACE FUNCTION increment_review_vote(review_id UUID, vote_column TEXT)
RETURNS void AS $$
BEGIN
  IF vote_column = 'helpful' THEN
    UPDATE pack_reviews SET helpful = helpful + 1 WHERE id = review_id;
  ELSIF vote_column = 'not_helpful' THEN
    UPDATE pack_reviews SET not_helpful = not_helpful + 1 WHERE id = review_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Follow user
CREATE OR REPLACE FUNCTION follow_user(target_id UUID)
RETURNS void AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF current_user_id = target_id THEN RAISE EXCEPTION 'Cannot follow yourself'; END IF;

  INSERT INTO user_followers (follower_id, following_id) VALUES (current_user_id, target_id)
  ON CONFLICT DO NOTHING;

  UPDATE user_profiles SET followers_count = followers_count + 1 WHERE id = target_id;
  UPDATE user_profiles SET following_count = following_count + 1 WHERE id = current_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unfollow user
CREATE OR REPLACE FUNCTION unfollow_user(target_id UUID)
RETURNS void AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  DELETE FROM user_followers WHERE follower_id = current_user_id AND following_id = target_id;

  UPDATE user_profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = target_id;
  UPDATE user_profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = current_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Row Level Security ─────────────────────────────────────

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_reports ENABLE ROW LEVEL SECURITY;

-- Public read access for published packs and profiles
CREATE POLICY "Public read profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Public read published packs" ON translation_packs FOR SELECT USING (status IN ('published', 'verified', 'featured'));
CREATE POLICY "Authors read own packs" ON translation_packs FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "Public read pack files" ON pack_files FOR SELECT USING (true);
CREATE POLICY "Public read reviews" ON pack_reviews FOR SELECT USING (true);
CREATE POLICY "Public read comments" ON pack_comments FOR SELECT USING (true);
CREATE POLICY "Public read followers" ON user_followers FOR SELECT USING (true);

-- Authenticated write access
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users create packs" ON translation_packs FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users update own packs" ON translation_packs FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Users delete own packs" ON translation_packs FOR DELETE USING (author_id = auth.uid());
CREATE POLICY "Users upload pack files" ON pack_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Users submit reviews" ON pack_reviews FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users post comments" ON pack_comments FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users edit own comments" ON pack_comments FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Users like comments" ON comment_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users follow" ON user_followers FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Users unfollow" ON user_followers FOR DELETE USING (follower_id = auth.uid());
CREATE POLICY "Users report packs" ON pack_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- ── Storage Bucket ─────────────────────────────────────────
-- Run this separately in Supabase Dashboard > Storage:
-- CREATE BUCKET "translation-packs" (public: true, file size limit: 50MB)
