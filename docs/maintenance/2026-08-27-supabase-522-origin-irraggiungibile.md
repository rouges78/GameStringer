# Il backend community è irraggiungibile: prima 522, poi il database che non risponde

**Data:** 27/08/2026, ultimo aggiornamento 13:49 UTC · **Stato:** **ANCORA
APERTO** dopo ~30 ore — causa identificata, è un incidente Supabase in corso,
non il nostro progetto · **Progetto:** `gamestringer-community`
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

*Nota del senno di poi:* con l'incidente pgBouncer alla mano quei timeout
tornano coerenti col resto, ma restavano comunque non-prove nel momento in cui
li ho osservati. Una coincidenza spiegata a posteriori non retrodata la propria
forza probatoria.

## La causa: un incidente Supabase, non il nostro progetto

Letta su `status.supabase.com` il 27/08/2026 verso le 08:20 UTC:

> **pgBouncer issues on some older projects** — 26-27 agosto 2026, **non
> risolto**. Corretto in `eu-central-2` e `ap-south-1`, in rollout sulle altre
> regioni.

`eu-west-1` non e' ancora coperta. La finestra dell'incidente combacia con i
nostri log: i 522 iniziano il 26/08 alle 08:00 UTC. Un connection pooler rotto
produce esattamente questo — Cloudflare non riesce ad aprire la connessione
verso l'origin — e spiega anche perche' lo stato del progetto resta
`ACTIVE_HEALTHY`: **il database sta su, e' il davanti che non risponde.**

Sulla stessa pagina, gli altri due pezzi del quadro:

- **Storage: Partial Outage** → sono gli `ABORTED REQ` sulle sonde `/health`.
- **API Gateway: Degraded Performance**.

Cioe' tutti e tre i sintomi che si vedono in dashboard hanno la stessa origine,
e nessuno dei tre e' nostro.

### L'ipotesi sbagliata, registrata apposta

La prima stesura di questa pagina diceva di riavviare il progetto e di guardare
i grafici CPU/RAM/Disk IO per cercare un'istanza satura. **Era la pista
sbagliata**, ed e' quella che viene istintiva quando un progetto e' giu: cercare
la colpa nella propria infrastruttura. Riavviare non sistema un pgBouncer rotto
a monte, e i grafici di saturazione non avrebbero mostrato niente, facendo
perdere tempo e lasciando il sospetto che il problema fosse nascosto altrove.

Lezione: **prima di misurare la propria macchina, leggere la status page del
fornitore.** Costa trenta secondi ed e' l'unico controllo che puo' chiudere il
caso invece di aprirne altri.

## Cosa fare

1. Aspettare il rollout del fix su `eu-west-1`, seguendo l'incidente su
   `status.supabase.com`.
2. Se resta giu': ticket al supporto citando **quell'incidente**, il ref
   `relbkjoxdnbqizgomzhs` e la regione, per chiedere che `eu-west-1` venga
   prioritizzata. Non aprire un ticket generico "il mio progetto e' giu'": si
   finisce nella coda sbagliata.
3. **Non** riavviare il progetto e **non** metterlo in pausa sperando che si
   sblocchi: non tocca il componente guasto e la pausa e' l'unica di queste
   mosse che puo' peggiorare le cose.
4. Quando torna su, rifare le misure con le query in fondo e verificare lo
   schema di `user_profiles` (vedi sotto).

## Aggiornamento 13:49 UTC — il sintomo cambia, il guasto no

Alle **13:00:31 UTC** i log mostrano ancora `522`. Dalle **13:02** in poi il
progetto risponde `401` in due decimi di secondo. Sembra tornato. Non lo è.

La misura che lo dimostra sono due sonde sullo stesso host, nello stesso istante:

| Sonda | Esito |
|---|---|
| `GET /rest/v1/` **senza chiave** | **401 in 0,19 s** |
| `GET /rest/v1/user_profiles?select=id&limit=1` **con chiave** | **appesa, timeout a 30 s** |

La prima la rifiuta il gateway senza mai arrivare a Postgres. La seconda deve
passare per PostgREST → pooler → Postgres, e resta appesa finché qualcosa non
scade. Il guasto non è finito: si è spostato di un passo. Prima Cloudflare non
riusciva ad aprire la connessione verso l'origin (522); ora l'origin accetta ma
non ottiene una connessione al database. Da fuori sembra un miglioramento, per
l'app non cambia niente.

**Regola che ne esce:** un `401` per chiave mancante prova che il gateway
risponde, nient'altro. Qualunque sonda di salute su questo progetto deve usare
il percorso autenticato, che è l'unico che tocca il database. La sonda comoda —
niente chiave, nessun segreto da gestire — è anche quella che mente.

Alle 13:49, otto tentativi dopo, il percorso col database non ha ancora
risposto una volta.

### La sonda che ha dichiarato vittoria a database morto

La prima versione dello script di attesa ha annunciato il ritorno con il
database ancora giù. Vale la pena scriverlo, perché l'errore è riproducibile
altrove:

```bash
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 ... || echo 000)
case "$code" in
  000|5*) ancora_giu ;;
  *)      e_tornato ;;     # ← ci finisce tutto il resto
esac
```

`curl` stampa già `000` quando fallisce, ed esce con 28: scattava anche
l'`|| echo 000`, e i due si concatenavano in **`000000`**. Quel codice non
corrispondeva a nessun ramo dell'elenco, quindi cadeva in `*)`, cioè nel
successo.

Il bug della concatenazione è banale. Quello che conta è l'errore di progetto
sotto: **elencare i casi di fallimento e trattare il resto come successo**. Una
sonda fatta così dichiara vittoria su ogni sorpresa che non aveva previsto.
Invertita — elenco esplicito dei codici che valgono vivo (`200 400 401 403 404
406`, le risposte definitive di PostgREST), tutto il resto è giù — fallisce
verso l'attesa invece che verso il falso allarme. Al massimo avvisa in ritardo,
mai a vuoto.

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
