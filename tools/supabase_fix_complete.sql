-- ═══════════════════════════════════════════════════════════════
-- FIX COMPLETO: Risolve 409 su presence e chat_room_members
-- Esegui nel SQL Editor di Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════

-- 1. INSERT policy su user_profiles (NECESSARIA per creare il profilo via client)
DROP POLICY IF EXISTS "Users insert own profile" ON user_profiles;
CREATE POLICY "Users insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Fix FOR ALL policies aggiungendo WITH CHECK
DROP POLICY IF EXISTS "Users update own presence" ON user_presence;
CREATE POLICY "Users update own presence" ON user_presence
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own membership" ON chat_room_members;
CREATE POLICY "Users manage own membership" ON chat_room_members
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. RPC per creare profilo utente (SECURITY DEFINER bypassa RLS)
CREATE OR REPLACE FUNCTION ensure_user_profile(
  p_user_id UUID,
  p_username TEXT,
  p_email TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT ''
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_profiles (id, username, email, avatar_url)
  VALUES (p_user_id, p_username, p_email, p_avatar_url)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN unique_violation THEN
  -- Username già usato, aggiungi suffisso
  INSERT INTO user_profiles (id, username, email, avatar_url)
  VALUES (p_user_id, p_username || '_' || floor(random() * 9999)::text, p_email, p_avatar_url)
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crea profili mancanti per tutti gli utenti auth esistenti
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

-- 5. Ricrea trigger handle_new_user robusto
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  INSERT INTO public.user_profiles (id, username, email, avatar_url)
  VALUES (
    NEW.id,
    'user_' || LEFT(NEW.id::text, 8) || '_' || floor(random() * 1000)::text,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
