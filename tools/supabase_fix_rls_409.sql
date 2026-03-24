-- ═══════════════════════════════════════════════════════════════
-- FIX: 409 Conflict su chat_room_members e user_presence
-- FIX: 406 su user_profiles query
-- Esegui questo nel SQL Editor di Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════

-- 1. Fix user_presence: permettere INSERT e UPDATE separatamente
DROP POLICY IF EXISTS "Users update own presence" ON user_presence;
CREATE POLICY "Users update own presence" ON user_presence
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Aggiungere INSERT policy esplicita per presence
DROP POLICY IF EXISTS "Users insert own presence" ON user_presence;
CREATE POLICY "Users insert own presence" ON user_presence
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 2. Fix chat_room_members: INSERT separato da ALL
DROP POLICY IF EXISTS "Users manage own membership" ON chat_room_members;
CREATE POLICY "Users manage own membership" ON chat_room_members
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Aggiungere INSERT policy esplicita per membership
DROP POLICY IF EXISTS "Users insert own membership" ON chat_room_members;
CREATE POLICY "Users insert own membership" ON chat_room_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 3. Fix user_profiles: assicurarsi che INSERT policy esista
DROP POLICY IF EXISTS "Users insert own profile" ON user_profiles;
CREATE POLICY "Users insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Verificare che il profilo dell'utente esista
-- (Il trigger handle_new_user dovrebbe averlo creato, ma verifichiamo)
-- Questo inserisce il profilo se manca (per utenti creati prima del trigger)
INSERT INTO user_profiles (id, username, email, avatar_url)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'username', 'user_' || LEFT(au.id::text, 8)),
  au.email,
  COALESCE(au.raw_user_meta_data->>'avatar_url', '')
FROM auth.users au
LEFT JOIN user_profiles up ON up.id = au.id
WHERE up.id IS NULL
ON CONFLICT (id) DO NOTHING;
