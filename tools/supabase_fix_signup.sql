-- ═══════════════════════════════════════════════════════════════
-- FIX: "Database error saving new user" durante sign-up
-- Esegui questo nel SQL Editor di Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════

-- 1. Aggiungi INSERT policy su user_profiles (mancava!)
DROP POLICY IF EXISTS "Users insert own profile" ON user_profiles;
CREATE POLICY "Users insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Rimuovi eventuali trigger problematici su auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Crea un trigger robusto che crea il profilo automaticamente al sign-up
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
  -- Se username duplicato, usa un suffisso random
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
