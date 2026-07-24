# Rate-limiting & Caching — endpoint condivisi (Compatibilità + Patch Hub)

Questo documento descrive le protezioni contro carico/abuso sugli endpoint
Supabase **condivisi** (quelli scritti/letti da tutti gli utenti): la telemetria
di compatibilità (`compat_reports`) e il Patch Hub (publish / download / ricerca).

Non riguarda le route Next locali (`/api/*`), già coperte dal rate-limiter
in-memory per-processo in `lib/rate-limiter.ts` + `middleware.ts`. Quelle girano
sulla macchina dell'utente e non toccano il backend condiviso.

## Livelli di difesa

| Livello | Dove | Copre | Stato |
|---|---|---|---|
| Rate-limit route locali | `middleware.ts`, `lib/rate-limiter.ts` | `/api/*` (processo locale) | Attivo (preesistente) |
| Anti-abuso compat | trigger `compat_reports_guard` | insert su `compat_reports` | Attivo (preesistente) |
| **Cache read Patch Hub** | `lib/social/hub-cache.ts` + `community-hub-service.ts` | `searchPacks` / stats / leaderboard | **Attivo subito (client)** |
| **Throttle write Patch Hub** | `lib/social/hub-cache.ts` + service/backend | `publishPack` / `reportPack` | **Attivo subito (client)** |
| **Rate-limit publish server** | migration `*_patch_hub_rate_limit.sql` | insert su `translation_packs` | **Richiede apply (Davide)** |
| **Download idempotente** | migration `*_patch_hub_rate_limit.sql` | RPC `increment_downloads` | **Richiede apply (Davide)** |

## Attivo subito (client-side, nessun deploy)

### 1. Caching dei READ (`lib/social/hub-cache.ts`)
Cache in-memory con TTL **60s** (`HUB_CACHE_TTL_MS`) applicata ai read del Patch
Hub serviti dal backend Supabase:
- `searchPacks(filters)` — chiave derivata dai filtri;
- `getHubStats()`;
- `getLeaderboard(limit)`.

Caratteristiche:
- **Fail-open**: se il loader (Supabase) fallisce o va in timeout, la cache **non
  memorizza nulla e rilancia** → il chiamante mantiene il suo fallback locale
  identico a prima.
- **Invalidazione**: `invalidateHubCache()` (bump di generazione, O(1)) viene
  chiamata dopo `publishPack` andato a buon fine e dopo un download dal backend,
  così un pack nuovo/aggiornato compare senza aspettare il TTL.
- Cap a 128 entry con sfratto della più vecchia (evita crescita illimitata).

### 2. Throttle delle WRITE (`lib/social/hub-cache.ts`)
Min-interval per azione, persistito in `localStorage` (fallback in memoria):
- `publish` → **15s** (`HUB_THROTTLE_MS.publish`);
- `report` → **10s** (`HUB_THROTTLE_MS.report`).

Comportamento:
- La finestra si "consuma" **solo dopo** una scrittura riuscita
  (`markThrottledAction`) — un errore di rete non penalizza l'utente.
- `publishPack`: se troppo ravvicinato lancia la sentinella
  `community-hub:publish-throttled` (mappabile dalla UI, come le sentinelle già
  esistenti tipo `community-hub:online-login-required`). Il pack resta bozza
  locale, nessun lavoro perso.
- `reportPack`: se troppo ravvicinato esce silenziosamente (no-op) — un report è
  fire-and-forget, non serve disturbare l'utente.
- **Fail-open**: qualsiasi problema interno del throttle → azione consentita.

Nota: il throttle client è la **prima linea** ma è aggirabile (localStorage
resettabile, chiamate dirette all'API). Il vero enforcement è lato server.

## Richiede apply della migration (azione di Davide)

File: `supabase/migrations/20260724_patch_hub_rate_limit.sql` — **proposto, NON
applicato**. Applicare da Supabase Dashboard → SQL Editor oppure `supabase db push`
dopo revisione. Segue lo stile delle guard esistenti (SECURITY DEFINER,
`search_path = public`, IP salvato solo come `md5` in tabelle-evento private senza
SELECT policy).

### 1. Publish rate-limit (`translation_packs_publish_guard`)
Trigger `BEFORE INSERT` su `translation_packs`:
- max **5** nuovi pack/ora **per autore**;
- max **10** nuovi pack/ora **per IP**.

Oltre soglia l'INSERT fallisce con `errcode 53400`. A differenza delle guard
"silenziose" di `compat_reports`, qui l'errore è **visibile** perché il client
attende la riga di ritorno (`publishPack` fa `.select().single()`); fallire in
modo onesto lascia il pack come bozza locale.

### 2. Download idempotente (`increment_downloads`)
La RPC mantiene **firma e nome argomento invariati** (`pack_id`), quindi il client
non cambia. Ora registra un evento `(pack_id, ip_hash)` e conta il download **una
sola volta per IP per pack ogni 24h**, fermando il gonfiaggio del contatore da
download ripetuti/script. Senza IP disponibile resta un incremento best-effort.

Entrambe le tabelle-evento (`pack_publish_events`, `pack_download_events`)
memorizzano solo l'hash dell'IP e non hanno SELECT policy: non sono leggibili da
anon/authenticated. Prune opzionale documentato in coda alla migration.

## Perché questi numeri
- TTL 60s: le liste del Patch Hub cambiano lentamente; 60s taglia la maggior parte
  dei round-trip da navigazione tra tab senza far percepire dati "vecchi".
- publish 5/ora/autore, 10/ora/IP: un traduttore reale pubblica pochi pack al
  giorno; queste soglie fermano gli script senza intralciare l'uso legittimo.
- download 1/IP/pack/24h: allineato a come un utente reale scarica un pack (una
  volta), coerente con la finestra 24h già usata dall'inflation cap di compat.
