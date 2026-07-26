# Tre settimane di telemetria e feedback persi in silenzio — 26/07/2026

Partito da un controllo banale: applicare la migration del widget feedback, data
per «proposta, non applicata». Risultava invece **già applicata** — la tabella
`public.feedback` esiste dal 24/07. Con zero righe.

Zero righe in due giorni può essere normale. Ma anche `crash_reports` era a zero,
e `benchmark_reports` pure. E `compat_reports` aveva 5 righe, **tutte e cinque da
utenti autenticati**. Nessun report anonimo, mai, da nessuna delle quattro tabelle.

## La causa

In Postgres il permesso di tabella (`GRANT`) e la policy RLS sono in **AND**: la
policy non concede nulla, filtra soltanto ciò che il grant ha già permesso.

Le quattro tabelle dichiarano `create policy ... for insert to anon`, ma il
`GRANT INSERT ... TO anon` non c'era. L'insert falliva con `permission denied for
table` **prima** che RLS entrasse in gioco.

Perché mancava: c'è un `ALTER DEFAULT PRIVILEGES` che concede ad `anon`, su ogni
nuova tabella creata da `postgres`, i privilegi `rDxtm` — cioè SELECT e poco
altro, **non `a` (INSERT)**. Ogni tabella creata dopo l'hardening RLS del 04/07
nasce quindi muta per gli utenti anonimi. Le tabelle più vecchie
(`translation_packs`, `pack_reports`) il grant ce l'hanno, ed è per questo che
funzionano e non è mai saltato all'occhio.

Perché nessuno se n'è accorto: **tutti e quattro i percorsi sono fail-open per
scelta** — il widget feedback ha il fallback appunti+mailto, la telemetria non
deve mai bloccare l'utente. La scelta è giusta, ma ha nascosto un guasto totale
per tre settimane. Un canale di feedback rotto in silenzio è la stessa lezione dei
64 messaggi mai letti, in un'altra forma.

| Tabella | Righe prima del fix | Da anon |
|---|---|---|
| `feedback` | 0 | 0 |
| `crash_reports` | 0 | 0 |
| `benchmark_reports` | 0 | 0 |
| `compat_reports` | 5 | 0 (tutte autenticate) |

## Il fix

Migration `grant_anon_insert_on_telemetry_tables`, applicata al progetto
`gamestringer-community`:

```sql
grant insert on table public.feedback          to anon;
grant insert on table public.compat_reports    to anon;
grant insert on table public.crash_reports     to anon;
grant insert on table public.benchmark_reports to anon;
```

Non allarga la superficie: la policy insert-only e il trigger anti-abuso restano
l'unico cancello, e nessuna policy di SELECT/UPDATE/DELETE viene aggiunta, quindi
le righe restano illeggibili dai client. Verificato end-to-end con `set role anon`:
l'insert passa, la lettura no, il trigger valorizza `ip_hash`. Le righe di prova
sono state cancellate.

I `GRANT SELECT` preesistenti (inerti sotto RLS) sono stati lasciati intatti di
proposito: le viste aggregate `compat_game_summary` e `benchmark_provider_summary`
ci si appoggiano, e revocarli oggi sarebbe un secondo guasto silenzioso.

`game_glossaries` non è stata toccata: il suo client passa da
`autoSyncGSToSupabase()`, quindi scrive come `authenticated`, che il grant ce l'ha.

## Secondo fix, stesso giro

L'advisor di sicurezza segnalava `public.feedback_guard()` eseguibile via RPC da
`anon`. La sua migration conteneva `revoke all on function ... from anon,
authenticated` — che **non basta**: l'EXECUTE di default è concesso al ruolo
`PUBLIC`, e anon/authenticated lo ereditano. È esattamente la lezione già scritta
in `20260723120749_harden_trigger_guard_execute.sql`, ripetuta il giorno dopo dal
file `feedback.sql`. Applicata la stessa cura (`revoke ... from anon,
authenticated, public`) e verificato che il trigger continui a scattare.

## Regola per le migration future

> Una tabella che deve accettare scritture anonime deve dichiarare
> **esplicitamente** `grant insert on ... to anon` accanto alla policy.
> La policy da sola non basta.
>
> Una trigger-function `SECURITY DEFINER` va revocata **anche da `public`**,
> non solo da `anon, authenticated`.

Da verificare, perché il fail-open può nascondere altro: un controllo periodico
che, per ogni tabella con una policy `for insert to anon`, il grant corrispondente
esista davvero. Sono due righe di SQL e varrebbe la pena metterle accanto agli
advisor nel workflow `security-audit`.
