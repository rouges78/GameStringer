# GameStringer — Percorsi critici e bus factor

Questo documento esiste per una ragione sola: **se la persona che oggi tiene in
piedi il progetto sparisse per un mese, un altro sviluppatore deve poter
rilasciare, aggiornare il sito e non perdere le chiavi.**

Non ripete le procedure già documentate altrove: le mappa e le collega, e
riempie i buchi che finora vivevano solo nella testa del manutentore. Ogni
sezione dice *chi/cosa serve*, *dove sta il segreto*, e *cosa si rompe se lo
perdi*.

Ultimo aggiornamento: 22/07/2026.

---

## Mappa rapida

| Percorso critico | Runbook | Rischio se manca il manutentore |
| --- | --- | --- |
| Rilascio nuova versione | [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) | Medio — procedura a un comando, ben documentata |
| Firma / falsi positivi antivirus | [DEFENDER_SUBMISSION.md](./DEFENDER_SUBMISSION.md), [ANTIVIRUS.md](./ANTIVIRUS.md) | Medio — submission manuale per release |
| **Chiave di firma auto-update (minisign)** | §1 qui sotto | **ALTO — se persa, l'auto-update muore per tutti** |
| Deploy del sito | §2 qui sotto | Basso — script SFTP, credenziali a parte |
| Database Supabase | §3 qui sotto | Medio — migrazioni + chiavi |
| Integrità dei pack community | [PACK_INTEGRITY.md](./PACK_INTEGRITY.md) | Basso |

Se hai poco tempo, leggi solo il §1: è l'unico punto da cui non si torna
indietro.

---

## 1. Chiave di firma dell'auto-update (minisign) — il punto più delicato

L'updater di Tauri verifica **ogni** artefatto di release con una firma
minisign. Senza una firma valida con la chiave giusta, i client rifiutano
l'aggiornamento.

**Chiave pubblica** — vive in chiaro nel repo, in `src-tauri/tauri.conf.json`
sotto `app.updater.pubkey` (base64). È quella che ogni copia installata usa per
verificare i nuovi rilasci.

**Chiave privata** — NON è nel repo. Sta come segreto GitHub del repository:

| Segreto GitHub | Contenuto |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | contenuto della chiave privata, **codificato base64** |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | stringa vuota (la chiave non ha password) |

Il workflow `.github/workflows/release.yml` li legge e firma gli artefatti in
CI. Nessuno deve firmare a mano.

### Cosa si rompe se la chiave privata va persa

Questo è lo scenario da capire prima che succeda:

- Le installazioni esistenti conoscono **solo** la vecchia chiave pubblica.
- Se non hai più la chiave privata corrispondente, non puoi più firmare
  release che quelle installazioni accettino.
- Puoi generare una nuova coppia e mettere la nuova pubblica in
  `tauri.conf.json`, ma **le copie già installate non si aggiorneranno più da
  sole**: gli utenti dovranno reinstallare a mano l'app dalla pagina dei
  download.

In pratica: perdere la chiave privata = un ciclo di reinstallazione forzata per
tutta la base utenti. Non è catastrofico, ma è esattamente il genere di danno
silenzioso che il bus factor deve prevenire.

### Regola operativa

1. Tieni **un backup offline** della chiave privata minisign (non solo dentro
   GitHub Secrets — se perdi l'accesso al repo, perdi anche quello).
2. Custodiscila come custodiresti una password madre: gestore di password
   cifrato o storage offline. Due copie, luoghi diversi.
3. Se un giorno va ruotata, aggiorna `pubkey` in `tauri.conf.json`,
   ri-registra i due segreti GitHub, e **comunica agli utenti che serve una
   reinstallazione** (nota nel changelog + sul sito).

La generazione della coppia e la messa a segreto sono descritte in
[RELEASE_PROCESS.md](./RELEASE_PROCESS.md) (sezione sull'updater/minisign):
`cat priv.key | base64 -w0 | gh secret set TAURI_SIGNING_PRIVATE_KEY`.

> Nota: la firma minisign dell'auto-update è **diversa** dalla firma
> Authenticode del codice (quella che azzera SmartScreen). La seconda è una
> decisione di prodotto ancora aperta — vedi [DEFENDER_SUBMISSION.md](./DEFENDER_SUBMISSION.md).

---

## 2. Deploy del sito (gamestringer.ai)

Il sito statico vive in `docs/sito/` e si pubblica via SFTP con
`scripts/deploy-sito.js` (c'è anche `deploy-sito-watch.js` per il redeploy
automatico a ogni modifica locale).

**Comando:**

```bash
node scripts/deploy-sito.js
```

**Credenziali** — NON sono nel repo. Vanno messe in `.env.local` (git-ignored):

| Variabile | Cos'è |
| --- | --- |
| `FTP_HOST` | host SFTP (default `ftp.gamestringer.ai`) |
| `FTP_USER` | utente SFTP dell'hosting |
| `FTP_PASSWORD` | password SFTP |
| `FTP_PATH` | percorso remoto (default `/`) |

L'hosting è **Ionos**, connessione SFTP sulla porta 22. Lo script carica tutto
il contenuto di `docs/sito/` saltando i README interni. Se il deploy fallisce,
il problema è quasi sempre credenziali scadute o percorso remoto sbagliato: lo
script stampa un riepilogo caricati/falliti.

**Cosa serve custodire:** le credenziali SFTP e l'accesso al pannello Ionos
(dominio + hosting). Senza il pannello non puoi rigenerare le credenziali né
gestire il DNS di `gamestringer.ai`.

---

## 3. Database Supabase

Il progetto usa Supabase (Postgres + RLS). Le migrazioni vivono in
`supabase/migrations/` e vanno applicate al remoto.

**Regola imparata a caro prezzo** (vedi anche le note CI): le migrazioni
applicate al remoto sono registrate con la **versione a timestamp completo**; i
file locali devono chiamarsi esattamente `<version>_<nome>.sql` o il check
"Supabase Preview" va rosso perché confronta le versioni, non i nomi.

**Segreti:**

| Segreto | Dove | Uso |
| --- | --- | --- |
| `SUPABASE_ANON_KEY` | segreto GitHub | build in CI |
| service role / accesso dashboard | account Supabase del manutentore | applicare migrazioni, gestire RLS |

**Cosa serve custodire:** l'accesso all'account Supabase che possiede il
progetto. Senza, non si applicano migrazioni né si legge/ripara il database di
compatibilità, crash report, benchmark e glossari community.

---

## 4. Sincronizzazione delle versioni

Un solo file è la fonte di verità: `version.json`. `scripts/version-manager.js`
lo propaga a `package.json`, `src-tauri/Cargo.toml` e
`src-tauri/tauri.conf.json`. **Non modificare le versioni a mano** in quei file:
usa `npm run version:patch|minor|major` o lascia fare a `npm run ship`.

---

## 5. Inventario dei segreti (per non dimenticarne nessuno)

Riepilogo di tutto ciò che vive fuori dal repo e senza cui il progetto si ferma:

- **GitHub Secrets del repo:** `TAURI_SIGNING_PRIVATE_KEY`,
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `SUPABASE_ANON_KEY`
  (`GITHUB_TOKEN` è automatico).
- **Backup offline:** la chiave privata minisign (vedi §1).
- **`.env.local` (locale, non committato):** credenziali SFTP del sito (§2), più
  le API key di sviluppo elencate in `.env.example`.
- **Account esterni:** GitHub (repo + secrets + Actions), Supabase (database),
  Ionos (dominio + hosting SFTP).

Chi eredita il progetto ha bisogno di accesso a **tutti e tre** gli account
esterni, non solo al repo.

---

## 6. Abbassare il bus factor nel tempo

Oltre a questo documento:

- **Etichetta `good first issue`.** Non esiste ancora nel repo. Crearla e
  applicarla ai task piccoli e isolati (parser di un formato nuovo con fixture,
  aggiunta chiavi i18n, fix UI circoscritti) è il modo più diretto per far
  entrare contributori. Candidati naturali: nuove fixture di engine sul modello
  di quelle Bethesda/CRI, chiavi di traduzione mancanti, piccoli fix di
  rilevamento engine.
- **Tieni questo file aggiornato** quando cambia un percorso critico: è l'unico
  documento pensato per chi non ha il contesto in testa.
