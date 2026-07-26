# Tre moduli Rust orfani e un gate per non ricascarci — 26/07/2026

Seguito di [2026-07-25-comandi-tauri-mancanti.md](2026-07-25-comandi-tauri-mancanti.md).
Il controllo di ieri confrontava i comandi invocati dal frontend con quelli
**definiti** lato Rust. Sbagliato il termine di paragone: quello che conta è se
il comando è **registrato** nel `generate_handler!` di `src-tauri/src/main.rs`.
Un comando definito e non registrato è rotto esattamente quanto uno che non esiste
— il frontend riceve `command not found` in entrambi i casi.

Rifatto il confronto con il criterio giusto:

- comandi **registrati**: 808
- comandi **definiti**: 901 (93 definiti e non registrati)
- comandi invocati dal frontend: 415
- **invocati e non risolvibili: 21** (contro i 7 di ieri)

## La scoperta

Undici dei quattordici nuovi non erano nomi sbagliati: erano **tre moduli interi
mai agganciati all'albero di compilazione**.

| File | Committato | Comandi | Dichiarato in `commands/mod.rs` |
|---|---|---|---|
| `commands/ollama_advanced.rs` | 17/06 (`09a202c2`) | 8 | **no** |
| `commands/ollama_streaming.rs` | 17/06 (`09a202c2`) | 2 | **no** |
| `commands/lip_sync.rs` | 27/04 (`3262508c`) | 3 | **no** |

Senza `pub mod x;` il file **non viene nemmeno compilato**: `cargo` lo ignora, non
un warning, niente. Il codice è nel repo, il frontend lo chiama, il commit dice
«feat: implement 8 advanced Ollama features» — e nulla di tutto ciò gira.

Cosa non funziona, in pratica:

- **`ollama_translate_advanced`** — il comando di traduzione avanzata di Ollama.
  Da tenere presente accanto alla seconda lamentela utente più frequente
  («Ollama non rilevato», 6 segnalazioni).
- **`detect_gpu`**, e la cache traduzioni (`get`/`set`/`clear_translation_cache`,
  `check_ollama_model_updates`).
- **`translate_with_streaming` / `translate_batch_streaming`** — la traduzione in
  streaming non parte mai.
- **`generate_lip_sync` / `check_rhubarb_available`** — l'integrazione Rhubarb.

### Perché non sono stati agganciati oggi

Riattivarli non è aggiungere tre righe: è **compilare per la prima volta** codice
scritto mesi fa e mai passato dal compilatore. `ollama_advanced.rs` usa
`lazy_static!`, e **`lazy_static` non è fra le dipendenze in `Cargo.toml`** — quindi
oggi non compilerebbe (o si aggiunge la crate, o si riscrive con
`std::sync::OnceLock`, che è nella std da Rust 1.70). Gli altri due sembrano a
posto (`futures`, `reqwest` con feature `stream` e `super::process_util::no_window_command`
esistono tutti), ma «sembrano» non basta: serve un `cargo check`, che l'ambiente
di questa sessione non ha.

Piano proposto, un modulo per volta, ognuno con il suo `cargo check`:

1. ~~`lip_sync.rs`~~ — **fatto**, vedi sotto.
2. `ollama_streaming.rs` — 2 comandi, dipendenze già presenti.
3. `ollama_advanced.rs` — prima decidere `lazy_static` vs `OnceLock`, poi agganciare.

## Riattivato: `lip_sync.rs`

`pub mod lip_sync;` in `commands/mod.rs` accanto ad `audio_patcher`, e i tre comandi
(`check_rhubarb_available`, `generate_lip_sync`, `export_lip_sync_file`) nel
`generate_handler!`. Nessun `State` da registrare, nessuna dipendenza da aggiungere:
`serde_json` e `super::process_util::no_window_command` erano già a posto.

Verificate le convenzioni prima di dichiararlo, perché un comando registrato ma
chiamato male fallisce ugualmente:

- **Argomenti.** Il frontend passa `audioPath`/`dialogText`; i parametri Rust sono
  `audio_path`/`dialog_text` senza `rename_all`. È corretto: la documentazione di
  Tauri v2 stabilisce che gli argomenti si passano in camelCase e vengono mappati
  sui parametri snake_case — `rename_all = "snake_case"` serve al caso opposto.
  (Ne segue che i 34 comandi del repo con `rename_all = "camelCase"` sono
  ridondanti: chiedono il default. Innocui, non toccati.)
- **Risultato.** `LipSyncResult` ha `#[serde(rename_all = "camelCase")]`, quindi
  produce `{soundFile, duration, mouthCues}`, che è esattamente l'interfaccia
  TypeScript. Combacia.

### Un bug che la registrazione ha reso vivo

Il pannello offriva due recognizer: `phonetic` e **`dataBased`**. Quel secondo
valore **Rhubarb non lo conosce**: il CLI accetta solo `pocketSphinx` (solo
inglese, più preciso, ed è il suo default) e `phonetic` (indipendente dalla
lingua). Chi avesse scelto "più accurato" avrebbe fatto uscire Rhubarb con
errore. Non se n'era accorto nessuno perché il comando non era registrato e
quindi non partiva mai: il modulo orfano nascondeva un secondo difetto dentro di sé.

Corretto in `lib/voice/rhubarb-lipsync.ts` e `components/tools/lip-sync-panel.tsx`;
la chiave i18n `lipSyncPanel.dataBased` è diventata `lipSyncPanel.pocketSphinx` in
tutti i 12 locale. Riscritte anche le due etichette, perché "veloce vs preciso"
non era la scelta vera che l'utente sta facendo: ora dicono "tutte le lingue" e
"solo inglese, più preciso", che è il criterio con cui decidere.

La pagina `/lip-sync` è nel menu e il pannello gestisce già il caso "Rhubarb non
installato" con link alla release e istruzioni per il PATH — finora mostrava
sempre quello stato, perché `checkRhubarbAvailable` catturava il
`command not found` e restituiva `false`. Ora la risposta è vera.

## Chiusi oggi

Due comandi in moduli **già compilati**, a cui mancava solo la riga nel
`generate_handler!`. Fix a rischio nullo: gli State che richiedono
(`ProfileManagerState`, `NotificationManagerState`) sono già `.manage()`d e altri
comandi degli stessi moduli erano già registrati.

| Comando | Modulo | Cosa non partiva |
|---|---|---|
| `get_profile_info` | `commands/profiles.rs` | preload delle info profilo (`lib/auth/profile-preloader.ts`) |
| `notify_background_operation_completed` | `commands/notifications.rs` | la notifica di fine traduzione in background (`app/auto-translate`, `lib/batch/background-translation.ts`) |

Nota: `get_profile_info` portava un `#[allow(dead_code)]` — il compilatore
segnalava da mesi che nessuno la chiamava, e l'attributo zittiva l'avviso invece
di far notare la registrazione mancante.

## Il gate

`scripts/check-tauri-commands.js`, agganciato alla CI (`npm run tauri:check-cmds`)
accanto al gate i18n. Funziona a ratchet come quello: la baseline versionata
`scripts/.tauri-commands-baseline.json` elenca i 19 rotti noti **con la ragione di
ciascuno**, e la CI fallisce solo se compare qualcosa di nuovo.

Rispetto al `comm -23` di ieri copre: apici singoli, doppi e backtick; i generics
(`invoke<string[]>('x')`); i wrapper `safeInvoke` e `invokeCmd`; ed esclude test
ed e2e. Conta a parte gli `invoke` con nome dinamico (template literal con `${}`),
che nessuna analisi statica può risolvere. Soprattutto: distingue **mancante**
(va scritto) da **non-registrato** (una riga in `main.rs`), che sono due lavori
di dimensione molto diversa.

```bash
npm run tauri:check-cmds           # verifica (esce 1 se c'è del nuovo)
npm run tauri:check-cmds:report    # elenco completo con i call-site
npm run tauri:check-cmds:update    # accetta il nuovo stato come baseline
```

Il gate fallisce anche quando una voce di baseline viene **risolta** senza
aggiornare il file: senza questo, la baseline marcisce e smette di dire il vero.

## Cosa resta (19 in baseline)

Undici sono i tre moduli orfani qui sopra. Gli altri otto sono quelli già
triagiati ieri — coda batch (che comunque non traduce niente: barra finta con
`setTimeout`), `tts_synthesize` (non esiste alcun motore di sintesi vocale fra i
901 comandi), `extract_godot_pck`, `extract_renpy_rpa`, la cache/statistiche
dell'injekt — più `export_cache` e `scan_game_files_with_info`, che il controllo
di ieri non vedeva perché usano forme di `invoke` che la sua regex non copriva.
