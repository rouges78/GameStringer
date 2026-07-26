-- APPLICATA sul remoto (gamestringer-community) il 26/07/2026.
--
-- Stessa cura di 20260723120749_harden_trigger_guard_execute.sql, che feedback_guard
-- (creata il giorno dopo) ha mancato: il suo `revoke all ... from anon, authenticated`
-- NON basta, perché l'EXECUTE di default è concesso al ruolo PUBLIC e anon/authenticated
-- lo ereditano. Il trigger scatta comunque, indipendentemente dai grant di EXECUTE.
-- Chiude gli advisor Supabase 0028/0029 su public.feedback_guard.

revoke execute on function public.feedback_guard() from anon, authenticated, public;
