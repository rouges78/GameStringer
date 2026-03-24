-- ═══════════════════════════════════════════════════════════════
-- GameStringer Community Hub — Supabase Migration SQL
-- Copia questo intero file nel SQL Editor di Supabase e clicca Run
-- ═══════════════════════════════════════════════════════════════

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
    IF EXISTS(SELECT 1 FROM user_badge_awards WHERE user_id = target_user_id AND badge_id = badge.id) THEN
      CONTINUE;
    END IF;
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

DROP POLICY IF EXISTS "Public read profiles" ON user_profiles;
CREATE POLICY "Public read profiles" ON user_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Public read published packs" ON translation_packs;
CREATE POLICY "Public read published packs" ON translation_packs FOR SELECT USING (status IN ('published','verified','featured') OR author_id = auth.uid());
DROP POLICY IF EXISTS "Authenticated users create packs" ON translation_packs;
CREATE POLICY "Authenticated users create packs" ON translation_packs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authors update own packs" ON translation_packs;
CREATE POLICY "Authors update own packs" ON translation_packs FOR UPDATE USING (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors delete own packs" ON translation_packs;
CREATE POLICY "Authors delete own packs" ON translation_packs FOR DELETE USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Public read pack files" ON pack_files;
CREATE POLICY "Public read pack files" ON pack_files FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authors manage pack files" ON pack_files;
CREATE POLICY "Authors manage pack files" ON pack_files FOR ALL USING (
  EXISTS (SELECT 1 FROM translation_packs WHERE id = pack_id AND author_id = auth.uid())
);

DROP POLICY IF EXISTS "Public read reviews" ON pack_reviews;
CREATE POLICY "Public read reviews" ON pack_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users create reviews" ON pack_reviews;
CREATE POLICY "Authenticated users create reviews" ON pack_reviews FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authors update own reviews" ON pack_reviews;
CREATE POLICY "Authors update own reviews" ON pack_reviews FOR UPDATE USING (author_id = auth.uid());

-- RLS Policies (new tables)
ALTER TABLE user_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badge_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read followers" ON user_followers;
CREATE POLICY "Public read followers" ON user_followers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own follows" ON user_followers;
CREATE POLICY "Users manage own follows" ON user_followers FOR ALL USING (follower_id = auth.uid());

DROP POLICY IF EXISTS "Public read badges" ON user_badges;
CREATE POLICY "Public read badges" ON user_badges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read badge awards" ON user_badge_awards;
CREATE POLICY "Public read badge awards" ON user_badge_awards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read comments" ON pack_comments;
CREATE POLICY "Public read comments" ON pack_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users create comments" ON pack_comments;
CREATE POLICY "Authenticated users create comments" ON pack_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authors edit own comments" ON pack_comments;
CREATE POLICY "Authors edit own comments" ON pack_comments FOR UPDATE USING (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors delete own comments" ON pack_comments;
CREATE POLICY "Authors delete own comments" ON pack_comments FOR DELETE USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Public read comment likes" ON comment_likes;
CREATE POLICY "Public read comment likes" ON comment_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own likes" ON comment_likes;
CREATE POLICY "Users manage own likes" ON comment_likes FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own notifications" ON user_notifications;
CREATE POLICY "Users read own notifications" ON user_notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own notifications" ON user_notifications;
CREATE POLICY "Users update own notifications" ON user_notifications FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Public read favorites" ON user_favorites;
CREATE POLICY "Public read favorites" ON user_favorites FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own favorites" ON user_favorites;
CREATE POLICY "Users manage own favorites" ON user_favorites FOR ALL USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- CHAT REALTIME
-- ═══════════════════════════════════════════════════════════════

-- Chat Rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general','game','translation_request','feedback','announcement')),
  game_id TEXT,
  game_name TEXT,
  created_by UUID REFERENCES user_profiles(id),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text','system','pack_share','image','translation_request')),
  reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  edited BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Room Members
CREATE TABLE IF NOT EXISTS chat_room_members (
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(room_id, user_id)
);

-- Online Presence
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'online' CHECK (status IN ('online','away','offline')),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_author ON chat_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(type);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_game ON chat_rooms(game_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_msg ON chat_rooms(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_presence_status ON user_presence(status);

-- Chat RLS
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read rooms" ON chat_rooms;
CREATE POLICY "Public read rooms" ON chat_rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated create rooms" ON chat_rooms;
CREATE POLICY "Authenticated create rooms" ON chat_rooms FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Creator manages rooms" ON chat_rooms;
CREATE POLICY "Creator manages rooms" ON chat_rooms FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Public read messages" ON chat_messages;
CREATE POLICY "Public read messages" ON chat_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated send messages" ON chat_messages;
CREATE POLICY "Authenticated send messages" ON chat_messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authors edit own messages" ON chat_messages;
CREATE POLICY "Authors edit own messages" ON chat_messages FOR UPDATE USING (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors delete own messages" ON chat_messages;
CREATE POLICY "Authors delete own messages" ON chat_messages FOR DELETE USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Public read members" ON chat_room_members;
CREATE POLICY "Public read members" ON chat_room_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own membership" ON chat_room_members;
CREATE POLICY "Users manage own membership" ON chat_room_members FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Public read presence" ON user_presence;
CREATE POLICY "Public read presence" ON user_presence FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users update own presence" ON user_presence;
CREATE POLICY "Users update own presence" ON user_presence FOR ALL USING (user_id = auth.uid());

-- Trigger: update room last_message_at on new message
CREATE OR REPLACE FUNCTION on_chat_message_sent()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_rooms SET last_message_at = NOW() WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_chat_message_sent ON chat_messages;
CREATE TRIGGER trigger_chat_message_sent
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION on_chat_message_sent();

-- RPC: Update presence heartbeat
CREATE OR REPLACE FUNCTION update_presence(new_status TEXT DEFAULT 'online')
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_presence (user_id, status, last_seen)
  VALUES (auth.uid(), new_status, NOW())
  ON CONFLICT (user_id) DO UPDATE SET status = new_status, last_seen = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Default chat rooms
INSERT INTO chat_rooms (name, description, type, is_pinned) VALUES
  ('Generale', 'Chat generale della community GameStringer', 'general', true),
  ('Traduzioni', 'Discuti di traduzioni, chiedi aiuto, condividi progressi', 'general', true),
  ('Feedback & Bug', 'Segnala bug e suggerisci miglioramenti per GameStringer', 'feedback', true),
  ('Annunci', 'Novità e aggiornamenti ufficiali di GameStringer', 'announcement', true)
ON CONFLICT DO NOTHING;

-- Enable Supabase Realtime on chat tables (idempotent)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
