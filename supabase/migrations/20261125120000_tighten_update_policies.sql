-- ════════════════════════════════════════════════════════════════════════════
-- Policy UPDATE/ALL legate al proprietario — 2026-11-25
-- ════════════════════════════════════════════════════════════════════════════
-- Contesto: gli schemi "base" (supabase/forum-schema.sql, supabase/community-chat-schema.sql),
-- applicati a mano dal SQL Editor, creavano policy UPDATE/ALL con `USING (true)`: chiunque
-- avesse la anon key (pubblica, nel binario) poteva modificare righe altrui. Le policy
-- permissive sono in OR: basta che ne resti UNA aperta perché l'hardening di 20260704
-- non serva a nulla. Questa migration:
--   1. droppa le policy aperte che 20260704 ha già sostituito con una versione legata
--      ad auth.uid() (che resta in vigore);
--   2. droppa e ricrea, legate al proprietario, quelle che nessuna migration copriva;
--   3. ri-asserisce "Author update threads/posts" (già chiuse da 20260415) nel caso lo
--      schema base sia stato rieseguito a mano dopo.
--
-- Robusta allo schema reale: salta le tabelle che non esistono, confronta in ::text
-- (alcune colonne sono uuid, altre TEXT a seconda dello schema storico) e, se la
-- colonna proprietario non esiste, NON crea alcuna policy UPDATE → la tabella resta
-- modificabile solo dal service role (che bypassa la RLS).
--
-- Idempotente (DROP POLICY IF EXISTS + CREATE): rieseguibile e replay-safe su preview.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r       record;
  v_expr  text;
BEGIN
  -- ── 1. Aperte, già sostituite da 20260704 (upres_write_own, notif_update_own,
  --       fr_update_involved, msg_update_own, cpres_write_own): solo DROP. ──────────
  FOR r IN
    SELECT * FROM (VALUES
      ('user_presence',      'Update own presence'),       -- FOR ALL USING (true)
      ('community_presence', 'Upsert presence'),           -- FOR ALL USING (true) WITH CHECK (true)
      ('notifications',      'Update own notifications'),
      ('friendships',        'Update own friendships'),
      ('chat_messages',      'Edit own messages')
    ) AS v(tbl, pol)
  LOOP
    IF to_regclass(format('public.%I', r.tbl)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    END IF;
  END LOOP;

  -- ── 2-3. Drop + ricrea legate al proprietario (USING e WITH CHECK). ─────────
  FOR r IN
    SELECT * FROM (VALUES
      -- tabella                  policy                      colonne proprietario (OR)
      ('community_rooms',         'Update rooms',             ARRAY['created_by']),
      ('community_messages',      'Edit own messages',        ARRAY['author_id']),
      ('community_room_members',  'Update membership',        ARRAY['user_id']),
      ('chat_conversations',      'Update own conversations', ARRAY['created_by']),
      ('chat_participants',       'Update own participant',   ARRAY['user_id']),
      -- user_profiles: nello schema reale `id` = auth.users.id; nello schema base
      -- forum-schema.sql `id` è casuale e il proprietario è `user_id` (TEXT).
      ('user_profiles',           'Owner update profile',     ARRAY['id', 'user_id']),
      ('forum_threads',           'Author update threads',    ARRAY['author_id']),
      ('forum_posts',             'Author update posts',      ARRAY['author_id'])
    ) AS v(tbl, pol, owner_cols)
  LOOP
    IF to_regclass(format('public.%I', r.tbl)) IS NULL THEN
      RAISE NOTICE 'tighten_update_policies: tabella % assente, salto', r.tbl;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);

    SELECT string_agg(format('%I::text = (auth.uid())::text', c.column_name), ' OR ')
      INTO v_expr
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = r.tbl
       AND c.column_name = ANY (r.owner_cols);

    IF v_expr IS NULL THEN
      RAISE NOTICE 'tighten_update_policies: % senza colonna proprietario (%), UPDATE solo service role',
        r.tbl, array_to_string(r.owner_cols, ', ');
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      r.pol, r.tbl, v_expr, v_expr
    );
  END LOOP;
END $$;

-- ── Fine migration ──
