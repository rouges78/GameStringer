-- Glossari community condivisi per gioco (roadmap P1 Qualità).
-- Chi traduce un gioco parte dal glossario già validato da altri: pubblicazione
-- dal glossario locale (auto-glossary), lista e import con merge non distruttivo.
--
-- Design:
-- - Un glossario per (game_id, target_language, author_id): l'autore aggiorna
--   il proprio con upsert; lettori scelgono tra le varianti degli autori.
-- - terms JSONB: array di { s: sourceTerm, t: targetTerm, c?: context,
--   dnt?: doNotTranslate, cat?: category } — compatto, max 500 voci e 256KB.
-- - RLS: lettura pubblica; scrittura solo dell'autore autenticato.
-- - downloads incrementato via RPC SECURITY DEFINER (come increment_downloads
--   dei pack), così il contatore non richiede policy UPDATE pubbliche.

CREATE TABLE IF NOT EXISTS game_glossaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  game_name TEXT NOT NULL DEFAULT '',
  source_language TEXT NOT NULL DEFAULT 'en',
  target_language TEXT NOT NULL,
  terms JSONB NOT NULL,
  terms_count INTEGER NOT NULL DEFAULT 0,
  author_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT game_glossaries_terms_is_array CHECK (jsonb_typeof(terms) = 'array'),
  CONSTRAINT game_glossaries_terms_size CHECK (jsonb_array_length(terms) BETWEEN 1 AND 500),
  CONSTRAINT game_glossaries_terms_bytes CHECK (pg_column_size(terms) <= 262144),
  CONSTRAINT game_glossaries_unique UNIQUE (game_id, target_language, author_id)
);

CREATE INDEX IF NOT EXISTS idx_game_glossaries_game
  ON game_glossaries(game_id, target_language);
CREATE INDEX IF NOT EXISTS idx_game_glossaries_author
  ON game_glossaries(author_id);

ALTER TABLE game_glossaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read glossaries" ON game_glossaries;
CREATE POLICY "Public read glossaries" ON game_glossaries
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authors insert own glossaries" ON game_glossaries;
CREATE POLICY "Authors insert own glossaries" ON game_glossaries
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Authors update own glossaries" ON game_glossaries;
CREATE POLICY "Authors update own glossaries" ON game_glossaries
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Authors delete own glossaries" ON game_glossaries;
CREATE POLICY "Authors delete own glossaries" ON game_glossaries
  FOR DELETE TO authenticated USING (author_id = auth.uid());

-- Contatore download senza policy UPDATE pubbliche.
CREATE OR REPLACE FUNCTION increment_glossary_downloads(glossary_id UUID)
RETURNS void AS $$
  UPDATE game_glossaries SET downloads = downloads + 1 WHERE id = glossary_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
