-- Hardening: revoca EXECUTE dalle trigger-function SECURITY DEFINER.
--
-- Queste funzioni sono usate SOLO come trigger (BEFORE/AFTER INSERT…): i trigger
-- scattano indipendentemente dai grant di EXECUTE, quindi togliere l'accesso RPC
-- diretto è sicuro e non cambia il comportamento. Chiude gli advisor Supabase
-- "public/authenticated can execute SECURITY DEFINER function"
-- (lint 0028/0029) per questi oggetti.
--
-- Nota: si revoca anche da `public`. Un semplice `REVOKE … FROM anon` non basta,
-- perché l'EXECUTE di default è concesso al ruolo PUBLIC e anon/authenticated lo
-- ereditano — è il motivo per cui forum_reactions_like_count risultava ancora
-- eseguibile nonostante un revoke `FROM anon` precedente.
--
-- Stesso trattamento già applicato a benchmark_reports_guard
-- (20260716001524). NON toccate qui le funzioni pensate come RPC legittime
-- (follow_user, toggle_comment_like, mark_notifications_read, update_presence,
-- increment_glossary_downloads, …) né is_conversation_participant, che serve
-- alle policy RLS di chat e deve restare eseguibile da authenticated.

revoke execute on function public.compat_reports_guard()        from anon, authenticated, public;
revoke execute on function public.crash_reports_guard()         from anon, authenticated, public;
revoke execute on function public.pack_reports_autoflag()       from anon, authenticated, public;
revoke execute on function public.forum_reactions_like_count()  from anon, authenticated, public;
