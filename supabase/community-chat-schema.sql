-- ═══════════════════════════════════════════════════════════════════════════
-- COMMUNITY CHAT SCHEMA — GameStringer
-- ═══════════════════════════════════════════════════════════════════════════
-- Schema separato per chat community (rooms stile Discord/IRC)
-- NON sovrappone al sistema DM (chat_conversations/chat_messages) del forum.
--
-- Tabelle:
--   - community_rooms         : stanze chat (generale, gioco, feedback, etc.)
--   - community_messages      : messaggi nelle stanze
--   - community_room_members  : membership / last_read per stanza
--   - community_presence      : stato online utenti
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── ROOMS ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'general', -- general | game | translation_request | feedback | announcement
  game_id TEXT,
  game_name TEXT,
  created_by TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_rooms_type ON community_rooms(type);
CREATE INDEX IF NOT EXISTS idx_community_rooms_archived ON community_rooms(is_archived);
CREATE INDEX IF NOT EXISTS idx_community_rooms_pinned ON community_rooms(is_pinned DESC, last_message_at DESC);

-- ─── MESSAGES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES community_rooms(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text', -- text | system | pack_share | image | translation_request
  reply_to UUID REFERENCES community_messages(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  edited BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_messages_room ON community_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_messages_author ON community_messages(author_id);

-- ─── ROOM MEMBERS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES community_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_room_members_user ON community_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_room_members_room ON community_room_members(room_id);

-- ─── PRESENCE ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_presence (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'offline', -- online | away | offline
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_presence_status ON community_presence(status);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────────────────

ALTER TABLE community_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_presence ENABLE ROW LEVEL SECURITY;

-- Rooms: tutti possono leggere/creare, solo il creatore può modificare/archiviare
-- (UPDATE/ALL legate al proprietario: vedi migrations/20261125120000_tighten_update_policies.sql)
DROP POLICY IF EXISTS "Read rooms" ON community_rooms;
DROP POLICY IF EXISTS "Create rooms" ON community_rooms;
DROP POLICY IF EXISTS "Update rooms" ON community_rooms;
CREATE POLICY "Read rooms" ON community_rooms FOR SELECT USING (true);
CREATE POLICY "Create rooms" ON community_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Update rooms" ON community_rooms FOR UPDATE TO authenticated USING (created_by = (auth.uid())::text) WITH CHECK (created_by = (auth.uid())::text);

-- Messages: tutti possono leggere/inviare, solo autore può modificare
DROP POLICY IF EXISTS "Read messages" ON community_messages;
DROP POLICY IF EXISTS "Send messages" ON community_messages;
DROP POLICY IF EXISTS "Edit own messages" ON community_messages;
CREATE POLICY "Read messages" ON community_messages FOR SELECT USING (true);
CREATE POLICY "Send messages" ON community_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Edit own messages" ON community_messages FOR UPDATE TO authenticated USING (author_id = (auth.uid())::text) WITH CHECK (author_id = (auth.uid())::text);

-- Members: pubblico
DROP POLICY IF EXISTS "Read members" ON community_room_members;
DROP POLICY IF EXISTS "Join room" ON community_room_members;
DROP POLICY IF EXISTS "Update membership" ON community_room_members;
CREATE POLICY "Read members" ON community_room_members FOR SELECT USING (true);
CREATE POLICY "Join room" ON community_room_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Update membership" ON community_room_members FOR UPDATE TO authenticated USING (user_id = (auth.uid())::text) WITH CHECK (user_id = (auth.uid())::text);

-- Presence: pubblico in lettura, scrittura solo sulla propria riga (come 20260704)
DROP POLICY IF EXISTS "Read presence" ON community_presence;
DROP POLICY IF EXISTS "Upsert presence" ON community_presence;
DROP POLICY IF EXISTS "cpres_write_own" ON community_presence;
CREATE POLICY "Read presence" ON community_presence FOR SELECT USING (true);
CREATE POLICY "cpres_write_own" ON community_presence FOR ALL TO authenticated USING (user_id = (auth.uid())::text) WITH CHECK (user_id = (auth.uid())::text);

-- ─── REALTIME ──────────────────────────────────────────────────────────────
-- Abilita Realtime per le nuove tabelle (opzionale, fatto via dashboard Supabase)
ALTER PUBLICATION supabase_realtime ADD TABLE community_messages;

-- ─── SEED DATA ─────────────────────────────────────────────────────────────
-- Crea alcune stanze default se non esistono
INSERT INTO community_rooms (name, description, type, is_pinned)
VALUES 
  ('Generale', 'Chat generale per tutti', 'general', true),
  ('Traduzioni', 'Discussioni su traduzioni in corso', 'general', true),
  ('Feedback', 'Segnala bug o suggerimenti', 'feedback', false),
  ('Annunci', 'Novità e annunci ufficiali', 'announcement', true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- FINE — Applica in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
