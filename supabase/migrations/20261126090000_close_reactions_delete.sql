-- ════════════════════════════════════════════════════════════════════════════
-- forum_reactions: niente più DELETE aperta a chiunque — 2026-11-26
-- ════════════════════════════════════════════════════════════════════════════
-- 20260627 aveva aggiunto "Community delete reactions" (USING user_id IS NOT NULL,
-- ruolo public) per far togliere il like agli utenti community anonimi. Effetto:
-- con la anon key chiunque poteva cancellare QUALSIASI reazione, quindi azzerare
-- i like altrui.
--
-- Non serve più: l'INSERT richiede già il login con user_id = auth.uid()
-- ("Authenticated insert reactions"), quindi un anonimo non può mettere un like,
-- e "Author delete reactions" (user_id = auth.uid()) copre il "togli like"
-- dell'app (lib/social/forum.ts, toggleLike: cancella la riga trovata per uid).
-- Idempotente.

DROP POLICY IF EXISTS "Community delete reactions" ON public.forum_reactions;
