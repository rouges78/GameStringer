-- ════════════════════════════════════════════════════════════════════════════
-- FIX 2026-07-26 — le tabelle "insert-only anon" non erano scrivibili da anon
-- APPLICATA sul remoto (gamestringer-community) il 26/07/2026.
-- Analisi completa: docs/maintenance/2026-07-26-telemetria-anon-mai-scritta.md
-- ════════════════════════════════════════════════════════════════════════════
-- Sintomo: feedback, crash_reports e benchmark_reports a ZERO righe; compat_reports
-- con sole 5 righe, TUTTE da utenti autenticati. Nessun report anonimo dal 04/07.
--
-- Causa: in Postgres il permesso di tabella (GRANT) e la policy RLS sono in AND.
-- Le quattro tabelle dichiarano `create policy ... for insert to anon`, ma il GRANT
-- INSERT ad anon non c'è mai stato: ALTER DEFAULT PRIVILEGES concede ad anon solo
-- rDxtm (SELECT/TRUNCATE/...), NON 'a' (INSERT). Ogni tabella creata da postgres dopo
-- l'hardening del 04/07 nasce quindi senza INSERT per anon. Le tabelle più vecchie
-- (translation_packs, pack_reports) l'avevano già e infatti funzionano.
-- L'insert falliva con "permission denied for table" PRIMA che RLS entrasse in gioco;
-- essendo tutti i percorsi fail-open (per non bloccare l'utente), nessuno se n'è accorto.
--
-- Questo NON allarga la superficie: la policy insert-only + il trigger anti-abuso
-- restano l'unico cancello. Nessuna policy di SELECT/UPDATE/DELETE viene aggiunta,
-- quindi le righe restano illeggibili da client. I GRANT SELECT preesistenti sono
-- lasciati intatti di proposito (inerti sotto RLS, e le viste aggregate ci si appoggiano).
--
-- NOTA PER LE MIGRATION FUTURE: una tabella che deve accettare scritture anonime
-- deve dichiarare ESPLICITAMENTE `grant insert on ... to anon` accanto alla policy.
-- La policy da sola non basta.

grant insert on table public.feedback           to anon;
grant insert on table public.compat_reports     to anon;
grant insert on table public.crash_reports      to anon;
grant insert on table public.benchmark_reports  to anon;
