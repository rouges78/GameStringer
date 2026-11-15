# Triage — 103 test Rust falliti (notifications + profiles)

> Contesto: `cargo test` non è mai girato in CI finché non è stato aggiunto al job
> check-windows (2026-06-14). La run completa rivela **1025 passed, 103 failed**.
> I fallimenti sono **deterministici** (identici in seriale `--test-threads=1` e su
> runner CI pulito) e **preesistenti** — non causati dalle modifiche gate/OCR.
> Ripartizione: ~91 in `notifications::*`, ~12 in `profiles::*`.

## Stato risoluzione (2026-06-14)

Bugfix reali applicati (sbloccano ~65 test + correggono difetti di produzione):
- rimossa la FK pendente `profile_id → profiles(id)` in `storage.rs` (bloccava gli
  INSERT su DB fresco anche in produzione per i nuovi install);
- corretto `OFFSET` senza `LIMIT` in `load_notifications` (bug SQL di paginazione);
- aggiunto `initialize()` mancante negli helper `system_event_tests` / `event_system_tests`;
- cancellati i `.db` di test stantii con schema vecchio.

I restanti **42 test datati** sono marcati `#[ignore]` con causa + rimando a questo
doc (non un ignore cieco). Suite **in locale**: 1086 passed, 0 failed, 42 ignored.

✅ **RISOLTO (2026-06-14)** — i 2 test di isolamento prima flaky in parallelo sono
stati sistemati e il gate CI è stato **riallargato a `cargo test` completo**:
1. `notifications::profile_isolation_tests::test_unauthorized_access_prevention` —
   gli helper notifications con nome file `.db` **fisso** (`integration_test.rs`,
   `system_event_tests.rs`, `event_system_tests.rs`, `profile_isolation_tests.rs`)
   ora usano `tempfile::tempdir()` per-test (come `manager_tests.rs`);
2. `profiles::integration_tests::test_profile_switching_data_isolation` — NON era
   stato condiviso: `storage.rs::load_profile` lanciava un `tokio::spawn(save_profile)`
   fire-and-forget a ogni auth, che faceva race con i save espliciti successivi e
   sovrascriveva file+indice con la versione caricata (stantia). Rimosso; ora
   `update_last_access()` resta solo in memoria. Era anche un bug di produzione.

Verifica: `cargo test` in parallelo → **1086 passed, 0 failed, 42 #[ignore]**.

✅ **CHIUSO (2026-06-14, sera)** — modernizzati e riattivati TUTTI i 42 `#[ignore]`.
Suite intera: **1128 passed, 0 failed, 0 ignored**. Riepilogo per causa:
- **priority gating** (notifications): le notifiche `Low` sotto il minimo del tipo
  (default Profile/System = Normal) sono soppresse → i test ora abbassano a `Low` la
  soglia del tipo via helper `allow_low_priority_*` prima di emettere gli eventi.
- **try_unwrap helper** (`integration_test.rs`): helper riscritto per restituire gli
  `Arc` condivisi; i test bloccano i Mutex per-statement.
- **validazione `expires_at`** (cleanup): `create_notification` rifiuta scadenze nel
  passato → le notifiche già scadute si inseriscono via
  `NotificationManager::insert_notification_unchecked` (`#[cfg(test)]`).
- **validazione preferenze**: `max_notifications`/`auto_delete_after_days` = 0 ora
  rifiutati → test aggiornato ad asserirlo.
- **auth drift** (profiles): `create_profile` auto-attiva il profilo (→ `logout()` nei
  test wrong-password); rate limiter blocca quando `failed >= max_attempts` (→
  `max_attempts: 4`); le session stats sono per-sessione e `switch_profile` le azzera
  (→ verifica prima dello switch); cross-profilo dà `NotificationNotFound` (isolamento
  a livello storage), non `UnauthorizedProfile`.

Fix di prodotto emersi durante la modernizzazione:
- `system_event_handler::is_important_operation` ora fa match per **sottostringa**
  (i wrapper convenience usano `operation_type` compositi tipo "Backup Full");
- `profiles::manager::is_session_expired` usa `>=` così che timeout 0 = scaduta
  immediatamente (necessario per il logout immediato).

## Sintesi per bucket

| # | Bucket | File | ~Test | Root cause | Confidenza | Effort |
|---|--------|------|:----:|------------|:---------:|:------:|
| A | try_unwrap con clone vivi | `notifications/integration_test.rs` | 5 | bug di logica nel test | **Alta (confermata)** | Basso |
| B | storage ops falliscono | `notifications/{manager,storage,cleanup,system_event,validation,profile_integration,profile_isolation,event_system}_tests.rs`, `tests.rs`, `cleanup.rs` | ~80 | **FK `profile_id`→`profiles(id)` con `foreign_keys=ON` e tabella `profiles` inesistente** | **Alta (confermata)** | Basso (1 fix) |
| C | auth/credenziali profili | `profiles/{integration_tests,tests,end_to_end_tests}.rs` | ~11 | API drift autenticazione | Media | Medio |
| D | testo messaggio validazione | `profiles/validation.rs` | 1 | stringa attesa cambiata | Alta | Triviale |

## Bucket A — `Arc::try_unwrap` con clone ancora vivi (5 test) — CONFERMATO

Tutti i 5 test di `integration_test.rs` falliscono nello stesso helper
`create_test_system()` (riga 29):

```rust
let manager_arc = Arc::new(Mutex::new(manager));
let integration = ProfileNotificationIntegration::new(Arc::clone(&manager_arc));
let event_handler = ProfileEventHandler::new(Arc::clone(&manager_arc), ...); // clone vivi
let manager = Arc::try_unwrap(manager_arc).unwrap_or_else(|_| panic!("Failed to unwrap manager_arc")).into_inner();
```

`try_unwrap` fallisce **sempre** perché `integration` e `event_handler` tengono
ancora dei clone dell'`Arc`. È un bug del test, non del prodotto.

**Fix**: riscrivere l'helper per restituire/usare gli `Arc` invece di provare a
estrarne il contenuto. Una sola modifica → 5 test verdi. Quick win.

## Bucket B — INSERT bloccati da FK verso `profiles` inesistente (~80 test) — CONFERMATO

`create_tables` (in `storage.rs`) crea **solo** `notifications` e
`notification_preferences`, entrambe con:

```sql
FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
```

e `initialize()` esegue `PRAGMA foreign_keys = ON`. Ma **nessuna tabella `profiles`**
viene creata in questo DB (i profili sono file-based, in `ProfileStorage`). Quindi
ogni `INSERT` di notifica/preferenza viola il vincolo FK verso una tabella
inesistente → `Err`. `initialize()` passa (nessun insert); `save_notification` e
tutte le operazioni che scrivono falliscono, in modo deterministico, ovunque.
Confermato: `test_storage_initialization` (nessun insert) è verde, `test_save_and_load_notification` rosso al primo `save`.

**Esclusi** prima: parallelismo (fallisce seriale), isolamento (usano `tempdir`),
wiring connessione (corretto).

### Fix (una modifica → ~80 test)

Due opzioni:

- **(consigliata) Rimuovere le due clausole FK** (righe ~85 e ~104 di `storage.rs`).
  Allinea lo schema alla realtà: i profili NON vivono in questo SQLite, quindi la FK
  è architetturalmente errata. Sblocca tutti gli insert.
- *(alternativa)* creare anche la tabella `profiles` in `create_tables` e far seedare
  ai test helper una riga profilo prima di scrivere. Più invasiva e innaturale.

### ⚠️ Implicazione di produzione (da verificare)

Se l'app gira con `foreign_keys = ON` su un `notifications.db` fresco, **anche le
notifiche reali falliscono all'insert** per lo stesso motivo. Verificare se nell'app
le notifiche vengono effettivamente salvate/mostrate; se non lo sono, la rimozione
della FK è anche un bugfix di produzione, non solo dei test.

## Bucket C — auth/credenziali profili (~11 test) — API DRIFT

Errori concreti osservati:
- `Failed to re-authenticate … InvalidCredentials` (end_to_end)
- `File profilo corrotto: hash non corrispondente` (crud)
- `matches!(result, Err(ProfileError::Unauthorized))` non soddisfatto
- `!manager.is_profile_active()` falso dopo password errata

Coerente con l'evoluzione del sistema di autenticazione profili (cfr. regole di
progetto: `isAuthenticated = !!currentProfile`, niente `save_profile()` dentro
`authenticate_profile()`). I test precedono il refactor e usano flussi/hash non più
validi. **Fix per-test**, aggiornando le aspettative al nuovo flusso. Effort medio,
non un'unica patch.

## Bucket D — testo messaggio di validazione (1 test) — TRIVIALE

`profiles/validation.rs:399` si aspetta un errore contenente `"caratteri"`; il
messaggio è cambiato. Allineare la stringa attesa. Banale.

## Raccomandazione

1. **Adesso**: tenere i 103 fuori dal gate CI (già fatto: lo step `cargo test` è
   limitato a `anti_cheat` + `retro_preprocessor`). `main` torna verde.
2. **Quick win** (~1 ora): bucket A (helper unico, 5 test) + bucket D (1 test).
3. **Leva maggiore**: eseguire il diagnostico del bucket B. Se è una causa comune,
   ~80 test rientrano con poco. Decидere l'effort dopo aver visto l'errore.
4. **Lavoro reale**: bucket C, aggiornare ~11 test al nuovo flusso di auth.
5. Solo dopo aver portato la suite a verde, allargare il gate CI da
   `cargo test anti_cheat/retro_preprocessor` a `cargo test` completo.

Finché non bonificati, i test possono essere marcati `#[ignore = "tracking: <issue>"]`
così la suite locale è verde e il debito è esplicito.

## Il binario dei test muore su Windows in CI (15/11/2026)

**Il fatto.** Dal 13/11/2026 il passo `Cargo test` di `check-windows` finisce con
`exit code: 0xc0000005, STATUS_ACCESS_VIOLATION` pochi millisecondi dopo
`running N tests`. Nessun test fallisce: muore il processo.

**La causa: il compilatore, non il codice.** Il job usava
`dtolnay/rust-toolchain@stable`, quindi ha preso da solo la versione nuova.

| Ramo (zero modifiche Rust rispetto a `main` `49731a56`) | Data | rustc | Esito |
|---|---|---|---|
| `fix/sidebar-toggle-focus` | 05/11 | 1.99.1 (58cf8f9c3) | verde |
| `fix/npm-audit` | 13/11 | 1.100.0 (0ef1bc386, uscito il 09/11) | access violation |
| `main` `4eb567a5` | 15/11 | 1.100.0 | access violation |

In locale c'è ancora la 1.99.1 e cinque corse complete di `cargo test --lib`
sono verdi. Su Linux la 1.100.0 passa.

**Come si legge la versione.** Nel log del job: il passo `Install Rust` stampa
`stable-x86_64-pc-windows-msvc updated - rustc 1.100.0 (...) (from rustc 1.99.1)`.
Nel binario: il percorso `/rustc/<commit>/` nei dati di sola lettura dà il commit
del compilatore (`58cf8f9c…` nel binario locale = 1.99.1).

**Rimedio applicato.** `check-windows` fissato a `dtolnay/rust-toolchain@1.99.1`.
Linux resta su `@stable`.

**Cosa NON è provato.**

- Che cosa, con la 1.100.0, fa cadere il processo: un difetto del compilatore o
  un comportamento indefinito nel nostro codice `unsafe` che prima passava per
  caso. Non c'è ancora una riproduzione locale con la 1.100.0.
- Che il rimedio basti: va visto verde in CI.
- **`release.yml` usa ancora `@stable` in tre punti**: una release Windows fatta
  oggi sarebbe compilata con la 1.100.0. Se la caduta non riguarda solo il
  binario dei test, riguarda anche l'app distribuita.

**Strade da non rifare.**

1. Dare la colpa all'immagine del runner. È cambiata negli stessi giorni
   (Provisioner `20261021.618` → `20261103.629`), ma è una coincidenza: la riga
   che conta è quella della versione di rustc.
2. `-- --test-threads=1` per trovare «il test colpevole». Dà un nome, ma è
   quello del test che stava girando: con un thread solo è caduto durante un
   test che in parallelo era passato, e che riempie solo una `HashMap`.
3. Cercare una DLL esterna: il binario dei test importa solo DLL di sistema.
4. Analizzare l'intero binario di debug (39 MB) con Ghidra: non finisce entro
   330 secondi. Per l'identità del compilatore basta leggere i dati del binario.
