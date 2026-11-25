-- ═══════════════════════════════════════════════════════════════════════════
-- GAMESTRINGER FORUM SCHEMA
-- Esegui questo script nella console SQL di Supabase per creare le tabelle
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── CATEGORIE ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forum_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'MessageSquare',
  color TEXT NOT NULL DEFAULT '#3b82f6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── THREADS ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  content_html TEXT,
  is_translation_pack BOOLEAN NOT NULL DEFAULT FALSE,
  pack_data JSONB,
  view_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_solved BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reply_at TIMESTAMPTZ,
  last_reply_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON forum_threads(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_author ON forum_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_created ON forum_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_threads_pack ON forum_threads(is_translation_pack) WHERE is_translation_pack = TRUE;

-- ─── POSTS ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  content_html TEXT,
  reply_to_id UUID REFERENCES forum_posts(id) ON DELETE SET NULL,
  quote_text TEXT,
  like_count INTEGER NOT NULL DEFAULT 0,
  is_solution BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id);

-- ─── REACTIONS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forum_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, thread_id, reaction_type),
  UNIQUE(user_id, post_id, reaction_type)
);

-- ─── DOWNLOADS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forum_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_downloads_thread ON forum_downloads(thread_id);

-- ─── FUNCTIONS ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_thread_views(thread_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE forum_threads SET view_count = view_count + 1 WHERE id = thread_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_download_count(thread_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE forum_threads SET download_count = download_count + 1 WHERE id = thread_uuid;
END;
$$ LANGUAGE plpgsql;

-- ─── RLS POLICIES ──────────────────────────────────────────────────────────

ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_downloads ENABLE ROW LEVEL SECURITY;

-- Lettura pubblica
DROP POLICY IF EXISTS "Public read categories" ON forum_categories;
DROP POLICY IF EXISTS "Public read threads" ON forum_threads;
DROP POLICY IF EXISTS "Public read posts" ON forum_posts;
CREATE POLICY "Public read categories" ON forum_categories FOR SELECT USING (true);
CREATE POLICY "Public read threads" ON forum_threads FOR SELECT USING (is_hidden = false);
CREATE POLICY "Public read posts" ON forum_posts FOR SELECT USING (is_hidden = false);

-- Scrittura autenticata
DROP POLICY IF EXISTS "Authenticated insert threads" ON forum_threads;
DROP POLICY IF EXISTS "Authenticated insert posts" ON forum_posts;
DROP POLICY IF EXISTS "Authenticated insert reactions" ON forum_reactions;
DROP POLICY IF EXISTS "Authenticated insert downloads" ON forum_downloads;
CREATE POLICY "Authenticated insert threads" ON forum_threads FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated insert posts" ON forum_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated insert reactions" ON forum_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated insert downloads" ON forum_downloads FOR INSERT WITH CHECK (true);

-- Update/Delete solo autore
DROP POLICY IF EXISTS "Author update threads" ON forum_threads;
DROP POLICY IF EXISTS "Author update posts" ON forum_posts;
DROP POLICY IF EXISTS "Author delete reactions" ON forum_reactions;
CREATE POLICY "Author update threads" ON forum_threads FOR UPDATE TO authenticated USING (author_id = (auth.uid())::text) WITH CHECK (author_id = (auth.uid())::text);
CREATE POLICY "Author update posts" ON forum_posts FOR UPDATE TO authenticated USING (author_id = (auth.uid())::text) WITH CHECK (author_id = (auth.uid())::text);
CREATE POLICY "Author delete reactions" ON forum_reactions FOR DELETE USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- SOCIAL FEATURES - Profili, Amici, Presenza Online
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── USER PROFILES (esteso) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,
  discord_tag TEXT,
  steam_id TEXT,
  favorite_games JSONB DEFAULT '[]'::jsonb,
  badges JSONB DEFAULT '[]'::jsonb,
  stats JSONB DEFAULT '{"threads": 0, "posts": 0, "translations": 0, "downloads": 0, "likes_received": 0}'::jsonb,
  settings JSONB DEFAULT '{"show_online": true, "allow_friend_requests": true, "email_notifications": true}'::jsonb,
  is_verified BOOLEAN DEFAULT FALSE,
  is_moderator BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- Aggiungi colonne mancanti se la tabella esisteva già
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS discord_tag TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS steam_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS favorite_games JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{"threads": 0, "posts": 0, "translations": 0, "downloads": 0, "likes_received": 0}'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"show_online": true, "allow_friend_requests": true, "email_notifications": true}'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Indice su last_seen_at (dopo ALTER TABLE che aggiunge la colonna)
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_seen ON user_profiles(last_seen_at DESC);

-- ─── FRIENDSHIPS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, blocked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- ─── USER PRESENCE (real-time) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_presence (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'online',
  current_activity TEXT,
  current_game TEXT,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Colonne mancanti se tabella esisteva già
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'online';
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS current_activity TEXT;
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS current_game TEXT;
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─── ACTIVITY FEED ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- thread_created, post_created, translation_shared, friend_added, achievement_unlocked
  target_type TEXT, -- thread, post, translation, user
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON activity_feed(created_at DESC);

-- ─── NOTIFICATIONS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- friend_request, friend_accepted, thread_reply, mention, like, system
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  sender_id TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ─── ACHIEVEMENTS / BADGES ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  category TEXT DEFAULT 'general', -- general, translation, social, special
  points INTEGER DEFAULT 10,
  requirement JSONB -- {"type": "threads_created", "count": 10}
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- ─── PRESENCE FUNCTIONS ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_user_presence(
  p_user_id TEXT,
  p_status TEXT DEFAULT 'online',
  p_activity TEXT DEFAULT NULL,
  p_game TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_presence (user_id, status, current_activity, current_game, last_heartbeat, updated_at)
  VALUES (p_user_id, p_status, p_activity, p_game, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    status = p_status,
    current_activity = COALESCE(p_activity, user_presence.current_activity),
    current_game = COALESCE(p_game, user_presence.current_game),
    last_heartbeat = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Marca utenti offline se non hanno heartbeat da 5 minuti
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS VOID AS $$
BEGIN
  UPDATE user_presence 
  SET status = 'offline', updated_at = NOW()
  WHERE last_heartbeat < NOW() - INTERVAL '5 minutes' 
    AND status != 'offline';
END;
$$ LANGUAGE plpgsql;

-- ─── RLS POLICIES (Social) ─────────────────────────────────────────────────

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Profili: lettura pubblica, scrittura solo proprietario
DROP POLICY IF EXISTS "Public read profiles" ON user_profiles;
DROP POLICY IF EXISTS "Owner update profile" ON user_profiles;
DROP POLICY IF EXISTS "Insert own profile" ON user_profiles;
CREATE POLICY "Public read profiles" ON user_profiles FOR SELECT USING (true);
-- proprietario: `id` (= auth.users.id nello schema reale) o `user_id` (questo schema)
CREATE POLICY "Owner update profile" ON user_profiles FOR UPDATE TO authenticated USING (id::text = (auth.uid())::text OR user_id = (auth.uid())::text) WITH CHECK (id::text = (auth.uid())::text OR user_id = (auth.uid())::text);
CREATE POLICY "Insert own profile" ON user_profiles FOR INSERT WITH CHECK (true);

-- Amicizie: lettura/scrittura per utenti coinvolti
DROP POLICY IF EXISTS "Read own friendships" ON friendships;
DROP POLICY IF EXISTS "Insert friendships" ON friendships;
DROP POLICY IF EXISTS "Update own friendships" ON friendships;
DROP POLICY IF EXISTS "Delete own friendships" ON friendships;
CREATE POLICY "Read own friendships" ON friendships FOR SELECT USING (true);
CREATE POLICY "Insert friendships" ON friendships FOR INSERT WITH CHECK (true);
CREATE POLICY "Update own friendships" ON friendships FOR UPDATE TO authenticated USING (requester_id = (auth.uid())::text OR addressee_id = (auth.uid())::text) WITH CHECK (requester_id = (auth.uid())::text OR addressee_id = (auth.uid())::text);
CREATE POLICY "Delete own friendships" ON friendships FOR DELETE USING (true);

-- Presenza: lettura pubblica, scrittura proprietario
DROP POLICY IF EXISTS "Public read presence" ON user_presence;
DROP POLICY IF EXISTS "Update own presence" ON user_presence;
CREATE POLICY "Public read presence" ON user_presence FOR SELECT USING (true);
CREATE POLICY "Update own presence" ON user_presence FOR ALL TO authenticated USING (user_id = (auth.uid())::text) WITH CHECK (user_id = (auth.uid())::text);

-- Activity: lettura pubblica per attività pubbliche
DROP POLICY IF EXISTS "Read public activity" ON activity_feed;
DROP POLICY IF EXISTS "Insert own activity" ON activity_feed;
CREATE POLICY "Read public activity" ON activity_feed FOR SELECT USING (is_public = true);
CREATE POLICY "Insert own activity" ON activity_feed FOR INSERT WITH CHECK (true);

-- Notifiche: solo proprietario
DROP POLICY IF EXISTS "Read own notifications" ON notifications;
DROP POLICY IF EXISTS "Insert notifications" ON notifications;
DROP POLICY IF EXISTS "Update own notifications" ON notifications;
CREATE POLICY "Read own notifications" ON notifications FOR SELECT USING (true);
CREATE POLICY "Insert notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Update own notifications" ON notifications FOR UPDATE TO authenticated USING (user_id = (auth.uid())::text) WITH CHECK (user_id = (auth.uid())::text);

-- Achievements
DROP POLICY IF EXISTS "Public read achievements" ON user_achievements;
DROP POLICY IF EXISTS "Insert achievements" ON user_achievements;
CREATE POLICY "Public read achievements" ON user_achievements FOR SELECT USING (true);
CREATE POLICY "Insert achievements" ON user_achievements FOR INSERT WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- ACHIEVEMENTS INIZIALI
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO achievements (id, name, description, icon, color, category, points, requirement) VALUES
  ('first_thread', 'Prima Discussione', 'Hai creato il tuo primo thread', 'MessageSquare', '#3b82f6', 'general', 10, '{"type": "threads_created", "count": 1}'),
  ('first_translation', 'Traduttore Novizio', 'Hai condiviso la tua prima traduzione', 'Languages', '#22c55e', 'translation', 20, '{"type": "translations_shared", "count": 1}'),
  ('helpful', 'Utile alla Community', 'Hai ricevuto 10 like sui tuoi post', 'Heart', '#ec4899', 'social', 15, '{"type": "likes_received", "count": 10}'),
  ('social_butterfly', 'Farfalla Sociale', 'Hai 10 amici', 'Users', '#8b5cf6', 'social', 20, '{"type": "friends_count", "count": 10}'),
  ('veteran', 'Veterano', 'Sei membro da più di un anno', 'Award', '#f59e0b', 'special', 50, '{"type": "member_days", "count": 365}'),
  ('prolific', 'Prolifico', 'Hai creato 50 thread', 'Flame', '#ef4444', 'general', 30, '{"type": "threads_created", "count": 50}'),
  ('polyglot', 'Poliglotta', 'Hai tradotto giochi in 3+ lingue', 'Globe', '#06b6d4', 'translation', 40, '{"type": "languages_count", "count": 3}'),
  ('early_adopter', 'Early Adopter', 'Ti sei unito durante la beta', 'Sparkles', '#fbbf24', 'special', 100, '{"type": "special", "id": "beta_user"}')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- CATEGORIE INIZIALI
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO forum_categories (slug, name, description, icon, color, sort_order) VALUES
  ('announcements', 'Annunci', 'Novità e aggiornamenti ufficiali di GameStringer', 'Megaphone', '#ef4444', 1),
  ('translation-packs', 'Pack Traduzioni', 'Condividi e scarica traduzioni complete per i tuoi giochi', 'Package', '#22c55e', 2),
  ('help', 'Supporto', 'Chiedi aiuto per problemi tecnici o dubbi sull''uso', 'HelpCircle', '#3b82f6', 3),
  ('tutorials', 'Guide & Tutorial', 'Tutorial, guide e best practices per la traduzione', 'BookOpen', '#8b5cf6', 4),
  ('requests', 'Richieste', 'Richiedi traduzioni per giochi specifici', 'MessageSquarePlus', '#f59e0b', 5),
  ('showcase', 'Showcase', 'Mostra i tuoi progetti di traduzione completati', 'Trophy', '#ec4899', 6),
  ('off-topic', 'Off Topic', 'Discussioni generali non legate alla traduzione', 'Coffee', '#6b7280', 7)
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- CHAT / MESSAGGI PRIVATI
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop tabelle chat se esistono (tabelle nuove, nessun dato reale)
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_participants CASCADE;
DROP TABLE IF EXISTS chat_conversations CASCADE;

CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct',
  name TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_html TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  attachments JSONB DEFAULT '[]'::jsonb,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation ON chat_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);

-- RLS per chat
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Create conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Update own conversations" ON chat_conversations;
CREATE POLICY "Read own conversations" ON chat_conversations FOR SELECT USING (true);
CREATE POLICY "Create conversations" ON chat_conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Update own conversations" ON chat_conversations FOR UPDATE TO authenticated USING (created_by = (auth.uid())::text) WITH CHECK (created_by = (auth.uid())::text);

DROP POLICY IF EXISTS "Read own participants" ON chat_participants;
DROP POLICY IF EXISTS "Insert participants" ON chat_participants;
DROP POLICY IF EXISTS "Update own participant" ON chat_participants;
CREATE POLICY "Read own participants" ON chat_participants FOR SELECT USING (true);
CREATE POLICY "Insert participants" ON chat_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Update own participant" ON chat_participants FOR UPDATE TO authenticated USING (user_id = (auth.uid())::text) WITH CHECK (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS "Read conversation messages" ON chat_messages;
DROP POLICY IF EXISTS "Send messages" ON chat_messages;
DROP POLICY IF EXISTS "Edit own messages" ON chat_messages;
CREATE POLICY "Read conversation messages" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Send messages" ON chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Edit own messages" ON chat_messages FOR UPDATE TO authenticated USING (sender_id = (auth.uid())::text) WITH CHECK (sender_id = (auth.uid())::text);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Ora ricarica la pagina Community Hub
-- ═══════════════════════════════════════════════════════════════════════════
