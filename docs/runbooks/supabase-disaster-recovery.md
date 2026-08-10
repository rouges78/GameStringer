# Runbook — Disaster recovery del progetto Supabase community

Progetto: `gamestringer-community` (ref `relbkjoxdnbqizgomzhs`, eu-west-1)
Organizzazione: `rouges78` — **piano Pro**
Ultimo aggiornamento: 09/08/2026

## Cosa c'è da perdere (misurato il 09/08/2026)

| Dato | Righe | Recuperabile senza backup? |
|---|---|---|
| `user_profiles` | 1799 | ❌ no |
| `community_presence` | 898 | ✅ irrilevante (stato volatile) |
| `community_room_members` | 639 | ❌ no |
| `community_messages` | 67 | ❌ no |
| `compat_reports` | 18 | ❌ no (telemetria compatibilità) |
| `forum_threads` / `forum_posts` | 12 / 6 | ❌ no |
| `translation_packs` | 3 | ❌ no |
| `pack_files` + **file nello Storage** | 4 | ❌ **no, ed è il contenuto vero** |
| schema, policy, trigger | — | ✅ sì: `supabase/migrations/` nel repo |

Lo **schema** è versionato nel repo, quindi ricostruibile. I **dati** no.
I file dei pack (le traduzioni vere) stanno nello Storage, non nel DB.

## Difese già attive

1. **Backup automatici Supabase (piano Pro)**: giornalieri, retention 7 giorni.
   Dashboard → Database → Backups.
2. **Keep-alive** (`.github/workflows/supabase-keepalive.yml`): ping ogni 3
   giorni. ⚠️ Il commento nel file parla di «piano Free»: è OBSOLETO, oggi il
   piano è Pro. Il workflow non fa danno ed è utile se un giorno si scende di
   piano, ma il testo va corretto.
3. **Migration versionate**: `supabase/migrations/` (incluse policy Storage e
   trigger `enforce_pack_status`).

## Cosa NON coprono (perché esiste il backup off-site)

- I backup del DB **non includono lo Storage**: perdi i file dei pack.
- **Retention 7 giorni**: un danno scoperto l'ottavo giorno è perso.
- I backup vivono **nello stesso account** che stai proteggendo: sospensione
  per fatturazione o chiusura account = niente dati e niente backup.
- **Nessun ripristino è mai stato provato.**

## Backup off-site (da eseguire)

```bash
cd /g/dev/Gamestringer
export SUPABASE_SERVICE_ROLE_KEY='<service role key dalla dashboard>'
node scripts/supabase-backup.mjs --out "G:/GameStringer-Backup"
```

- Senza la service key il backup è **PARZIALE** (la RLS nasconde i record
  privati) e lo script lo dichiara nel `manifest.json`.
- La service role key si prende da Dashboard → Settings → API. **Non va mai
  committata**: si esporta a mano, o si mette in un Secret del repo.
- Output: `tables/*.json`, `storage/translation-packs/...`, `manifest.json`.

Cadenza consigliata: prima di ogni migration importante e almeno una volta al
mese. Copia su un disco diverso da quello di lavoro.

## Prova di ripristino (⛔ MAI FATTA — è il punto che conta)

Un backup mai ripristinato è una speranza. La prova si fa su un **branch
Supabase** o su un progetto di test, MAI su produzione:

1. `mcp supabase create_branch` (o Dashboard → Branches) — ambiente isolato.
2. Applica le migration del repo: `supabase db push` sul branch.
3. Reimporta i dati dal backup: per ogni `tables/<t>.json`, `POST /rest/v1/<t>`
   con la service key del branch (`Prefer: resolution=merge-duplicates`).
   ⚠️ Ordine: prima `user_profiles` (le FK degli altri puntano lì).
4. Ricarica i file: `POST /storage/v1/object/translation-packs/<percorso>`.
5. **Verifica d'effetto**: apri il Patch Hub puntato al branch e controlla che
   i pack si vedano E si scarichino (non basta contare le righe).
6. Cancella il branch.

Finché il punto 5 non è stato fatto almeno una volta, questo runbook è
**non verificato** e va trattato come tale.

## Incidenti tipici

**«Il progetto è in pausa»** → Dashboard → Restore. Su Pro non dovrebbe
accadere per inattività; se accade, verifica la fatturazione.

**Cancellazione accidentale di righe** → Dashboard → Backups → ripristina al
punto precedente (entro 7 giorni). Se sono passati più giorni: backup off-site.

**Policy/trigger persi** → si riapplicano dalle migration del repo:
`supabase/migrations/20260809_pack_status_enforced.sql` e
`20260809_storage_pack_policies.sql` (entrambe idempotenti).

**Account sospeso** → solo il backup off-site salva. Ricrea un progetto, applica
le migration, reimporta come nella prova di ripristino.
