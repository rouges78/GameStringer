# Il progetto Supabase risponde 522 a quasi tutto, da 24 ore

**Data:** 27/08/2026 · **Stato:** **aperto** — non risolvibile dal codice, serve
azione sulla dashboard · **Progetto:** `gamestringer-community`
(`relbkjoxdnbqizgomzhs`, `eu-west-1`, Postgres 17.6.1)

## Il fatto

Il gateway del progetto restituisce **522** (Cloudflare non riesce ad aprire la
connessione TCP verso l'origin) a praticamente tutto il traffico. Misurato sui
log `edge_logs`, finestra 26/08 08:00 → 27/08 08:00 UTC:

| Esito | Richieste |
|---|---|
| **522** | **~3.470** |
| 504 / 524 | 44 |
| **2xx** | **~50** |

Non è un picco: è ogni singola ora della finestra. L'unica eccezione è la
finestra **05:00–05:59 UTC del 27/08** (07:00–08:00 ora italiana), in cui il
progetto ha funzionato: 17 risposte 2xx, zero 522. Poi è tornato giù alle 06:00
e alle 08:03 UTC, ultima misura, era ancora giù.

Colpite tutte le rotte, non una: `/auth/v1/token` (2.444 richieste, tutte 522),
`/rest/v1/compat_game_summary`, `/rest/v1/forum_threads`,
`/rest/v1/user_profiles`, `/rest/v1/notifications`, `/rest/v1/translation_packs`,
`/rest/v1/community_presence`, l'RPC `update_user_presence`, `/auth/v1/signup`.

Nel frattempo l'API di stato del progetto riporta `ACTIVE_HEALTHY`. **Non lo è.**
Lo stato dichiarato non è una prova di salute e non va usato come tale.

## Cosa NON sono gli errori che si notano per primi

Questa è la parte che fa perdere tempo. I due tipi di errore più visibili nella
dashboard sono entrambi conseguenze, non cause.

**Storage — `ABORTED REQ` su `/tenants/relbkjoxdnbqizgomzhs/health`.** Il
chiamante è `@supabase-infra/mgmt-api`: sono le sonde di salute interne di
Supabase, non traffico dell'app. Non c'è niente da correggere nel nostro codice.

**Postgres — `57014 canceling statement due to statement timeout`,** 93 nelle 24
ore, più 47 `canceling statement due to user request`. Sembrano query lente
dell'app. Non lo sono. Estraendo `parsed.query` dai log, sono **tutte** di
`postgrest`/`authenticator` e sono gli statement di apertura di una connessione
nuova:

```
SET client_encoding = 'UTF8'; SET client_min_messages TO WARNING;
SELECT current_setting('server_version_num')::integer, ...
BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY
<la query di refresh dello schema cache di PostgREST>
```

`SET client_encoding` che va in timeout non è una query lenta: è PostgREST che
apre una connessione, si pianta sul primo statement e riprova. Ritmo costante di
4–11/ora **per 24 ore, notte compresa**, quando nessuno usa l'app. È lo stesso
guasto visto dal lato database.

## Cosa non prova cosa

Tre tentativi di eseguire SQL via management API (MCP) sono finiti in
`Connection terminated due to connection timeout`. **Questo da solo non prova
niente sull'outage:** l'host diretto `db.<ref>.supabase.co` può fallire anche
per ragioni di rete indipendenti (è IPv6-only, il pooler è un'altra cosa). La
prova che conta sono i 522 sull'edge, che è il percorso che usano davvero gli
utenti.

## Cosa fare (dashboard, non codice)

1. Settings → General → **Restart project**.
2. Guardare i grafici **CPU / RAM / Disk IO** nella finestra 26/08 08:00 in poi:
   se l'istanza è satura o ha esaurito i crediti di burst IO, il 522 si spiega.
3. Se dopo il riavvio torna 522: ticket al supporto con ref
   `relbkjoxdnbqizgomzhs`, regione `eu-west-1`, e i numeri di questa pagina.

## Due cose nostre, emerse per strada

**1. `user_profiles.user_id` non esiste.** Nell'unica ora in cui il database ha
risposto sono comparsi 7 errori `42703: column user_profiles.user_id does not
exist`. La query è quella di `lib/social/presence.ts` (`fetchProfilesMap`):
interroga `user_id`, ma la chiave primaria di `user_profiles` è `id`
(`docs/supabase-schema.sql:9`). Peggio: il fallback "riprova per `id`" che sta
poche righe sotto **era codice morto**, perché il ramo `if (error)` fa
`return map` prima di arrivarci. Conseguenza: `fetchProfilesMap` non ha mai
risolto un solo username o avatar da Supabase — la presence mostrava sempre il
ripiego locale, e nessuno se n'era accorto perché l'errore veniva inghiottito.
Corretto il 27/08 interrogando `id`.

### La radice: due `user_profiles` diversi nel repo

Il bug sopra non e' una svista isolata. Nel repo esistono **due definizioni
incompatibili della stessa tabella**, e il codice e' stato scritto ora contro
l'una ora contro l'altra:

| | `docs/supabase-schema.sql:8` | `supabase/forum-schema.sql:156` |
|---|---|---|
| chiave | `id UUID PK REFERENCES auth.users(id)` | `id UUID PK DEFAULT gen_random_uuid()` |
| `user_id` | **non esiste** | `TEXT UNIQUE NOT NULL` |
| `display_name` | **non esiste** | `TEXT` |

Quella **deployata e' la prima** — lo dimostra l'errore 42703 su `user_id`.
`forum-schema.sql` non e' mai stato applicato a questo progetto.

Da qui discendono i due dialetti che convivono nel codice:
`community-hub-backend.ts` filtra con `.eq('id', userId)` (corretto), mentre
`presence.ts` filtrava con `.eq('user_id', ...)` (rotto, ora corretto).

**Sospetto ancora aperto, non corretto:** `lib/social/social.ts:495` e `:523`
selezionano `user:user_profiles!user_id(id, username, display_name, avatar_url)`.
`display_name` non esiste sulla tabella viva, quindi quelle due query dovrebbero
fallire con 42703 — e falliscono in silenzio (`if (error) return []`), lasciando
il feed attivita' vuoto per sempre. Non compare nei log del 27/08 perche' in
quella finestra nessuno ha aperto il feed: **e' un sospetto motivato, non una
misura**. Da verificare quando il database torna raggiungibile, con una query
sola:
`select column_name from information_schema.columns where table_name='user_profiles'`.

**2. Ritempesta di token.** 2.444 richieste a `/auth/v1/token` in 24 ore, tutte
522, in coppie distanziate 20s con pause di ~90s: è il refresh di GoTrue che
ritenta contro un origin morto. Non è la causa dell'outage, ma genera traffico
inutile e brucia la quota dei log. Un backoff va messo — **dopo** aver risolto
il 522, altrimenti non si distingue il fix dal database che torna su.

## Come rifare le misure

Query ClickHouse sui log unificati (MCP Supabase, `query_logs`), finestra max 24h:

```sql
-- Distribuzione esiti per ora
select toStartOfHour(timestamp) as ora,
       countIf(log_attributes['response.status_code']='522') as c522,
       countIf(log_attributes['response.status_code'] like '2%') as ok2xx,
       count(*) as tot
from logs where source='edge_logs' group by ora order by ora;

-- Il testo vero delle query che vanno in timeout
select timestamp, log_attributes['parsed.query'] as q
from logs where source='postgres_logs'
  and log_attributes['parsed.sql_state_code']='57014'
order by timestamp desc;
```
