# Nota sicurezza — viste aggregate pubbliche (benchmark & compat)

**Data:** 23/07/2026 · **Stato:** rischio accettato, deliberato

## Contesto

Due viste sono servite pubblicamente al ruolo `anon` (chiave anon hardcoded nel
sito statico `docs/sito/`):

- `public.benchmark_provider_summary` — leaderboard qualità provider.
- `public.compat_game_summary` — compatibilità giochi.

Entrambe aggregano una tabella base **insert-only** (`benchmark_reports`,
`compat_reports`) con RLS attiva e **nessuna policy SELECT** per `anon`: le righe
grezze (con `ip_hash`, `contributor_id`, contesto per-run) restano private.

## L'advisor Supabase

`get_advisors(type: security)` segnala entrambe con livello **ERROR**
`security_definer_view` (lint 0010):

> View is defined with the SECURITY DEFINER property … enforces permissions of
> the view creator, rather than the querying user.

## Perché è INTENZIONALE (e non va "corretto")

È esattamente il pattern che ci serve: **esporre solo l'aggregato** (conteggi,
media, stddev per provider/coppia-lingua/genere) **tenendo private le righe
grezze**. La vista gira con i privilegi del proprietario, che bypassa la RLS
della tabella base; a `anon` è concesso `SELECT` **solo sulla vista**, mai sulla
tabella.

Convertire la vista a `security_invoker = true` (la "correzione" suggerita dal
lint) la farebbe girare con i privilegi di `anon` — che **non ha SELECT** su
`benchmark_reports`/`compat_reports` → la vista tornerebbe vuota e **la pagina
pubblica si romperebbe**. Non è quindi un bug da sistemare, ma un trade-off
scelto: privacy delle righe grezze + esposizione del solo aggregato.

## Mitigazioni già in essere

- Nessun dato personale nell'aggregato: solo statistiche numeriche + `provider`,
  `source_lang`, `target_lang`, `genre`, `last_report_at`.
- `ip_hash` e `contributor_id` non compaiono nella vista (solo un conteggio
  `known_contributors`).
- Tabella base protetta da guard trigger (dedup + rate-limit 300/h per IP),
  `EXECUTE` sul guard revocato (migration `..._guard_revoke_execute`).

## Azione

**Nessuna.** Le due voci `security_definer_view` sull'aggregato benchmark/compat
sono **accettate**. Se un audit futuro le rivede, questo documento è la
motivazione. Da NON convertire a `security_invoker`.

_(Gli altri avvisi dell'advisor — es. `anon_security_definer_function_executable`
sui guard trigger, `auth_leaked_password_protection`, `rls_enabled_no_policy` su
`moderation_log` — sono voci separate, fuori dallo scopo di questa nota.)_
