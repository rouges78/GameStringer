# Tre moduli Rust orfani, e un gate per non ricascarci — 26/07/2026

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

### La valutazione iniziale (e perché era la domanda sbagliata)

Il primo istinto è stato di stimare la fatica di **compilarli per la prima volta**:
`ollama_advanced.rs` usa `lazy_static!`, che non è fra le dipendenze in `Cargo.toml`,
quindi non compilerebbe senza aggiungere la crate o riscrivere con
`std::sync::OnceLock`; gli altri due avevano tutte le dipendenze a posto (`futures`,
`reqwest` con feature `stream`, `super::process_util::no_window_command`).

Domanda sbagliata. Quella giusta era **chi chiama questo codice, e quella funzione
non esiste già?** — e la risposta ha portato a riattivarne uno solo e cancellare gli
altri due. `lazy_static` non è mai servito.

Piano proposto, un modulo per volta, ognuno con il suo `cargo check`:

1. ~~`lip_sync.rs`~~ — **riattivato**, vedi sotto.
2. ~~`ollama_streaming.rs`~~ — **cancellato**, vedi sotto: non era un modulo da compilare, era un abbozzo mai finito.
3. ~~`ollama_advanced.rs`~~ — **cancellato**, vedi sotto: non incompleto, ma già rifatto meglio altrove.

Nessuno dei tre ha richiesto `lazy_static`, alla fine: la decisione `lazy_static` vs
`OnceLock` è diventata irrilevante appena si è guardato **chi chiamava** quel codice.

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
`scripts/.tauri-commands-baseline.json` elenca i rotti noti **con la ragione di
ciascuno** (21 quando è nato, 9 alla fine della giornata), e la CI fallisce solo se
compare qualcosa di nuovo.

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

## Cancellato: `ollama_streaming.rs` (+ due hook)

Qui la domanda «perché non è registrato?» ha avuto una risposta diversa: perché non
c'era niente da registrare. Guardando i chiamanti prima del codice:

- l'unico chiamante dei due comandi era `lib/ai/use-streaming-translation.ts`
  (264 righe) — **importato da nessun componente**;
- esisteva un **secondo** hook omonimo, `hooks/use-streaming-translation.ts`
  (170 righe), anch'esso mai importato, che puntava a `/api/translate/stream` —
  una route che nel desktop risponde `501 not_available_in_desktop`;
- nessuno ascoltava gli eventi `ollama-stream-*` / `ollama-batch-*` emessi dal Rust.

Quindi la traduzione in streaming non era una funzione rotta: erano tre pezzi mai
congiunti, nati nello stesso commit di giugno (`09a202c2`). Lo `stream: true` che si
trova in `ollama-manager.ts` è il download dei modelli, non la traduzione.

Due difetti in più, se lo si fosse registrato senza guardarci dentro:

- **URL Ollama hardcoded** a `http://localhost:11434`, cioè la reintroduzione esatta
  del bug chiuso il giorno prima (`fix(ollama): make the endpoint configurable`, sei
  segnalazioni utente) invece di passare da `ollama_endpoint::ollama_base_url()`.
- **Scavalca le garanzie della pipeline**: prompt di sistema costruito sul posto e
  chiamata diretta a Ollama, quindi senza glossario, senza reflection e senza la
  protezione dei placeholder — che è attiva sempre, per scelta esplicita.

Cancellati modulo e due hook (465 + 170 righe). Stesso criterio applicato ieri a
`lib/tauri-integration.ts`: quando il codice morto è più grande della funzione che
dovrebbe svolgere, si toglie.

**Conoscenza da non perdere con la cancellazione:** se un giorno si vuole lo
streaming in desktop, la strada obbligata *è* un comando Rust. Dal webview Tauri una
fetch verso Ollama è bloccata dal CORS (è il motivo per cui esiste
`lib/ai/ollama-http.ts`), e `/api/translate/stream` è uno stub 501. Il modulo
cancellato aveva l'idea giusta e l'esecuzione a metà. Il commento in `ollama-http.ts`
che rimandava a `ollama_streaming` è stato corretto: mandava il lettore verso un file
che non veniva compilato.

## Cancellato: `ollama_advanced.rs` (+ il suo service)

Il modulo più grosso dei tre (8 comandi) e il più facile da liquidare, una volta
guardato nell'ordine giusto. `lib/ai/ollama-advanced-service.ts` (509 righe), unico
chiamante dei suoi comandi, ha **zero importatori per tutti e otto i suoi export** —
verificati uno per uno. Ma il punto non è nemmeno quello: ogni funzione che il modulo
prometteva **esiste già altrove, viva e in uso**.

| Nel modulo orfano | Equivalente vivo |
|---|---|
| `detect_gpu` / `detectGPU` | `lib/vram-manager.ts`, `vram-settings-card`, `system-overlay`, `ollama-setup-wizard` |
| `PARAMETER_PRESETS` (precise/balanced/creative/fast) | `lib/ai/ollama-options.ts` + pagina `/ollama-manager/advanced`, cablata su 5 call-site il 24/07 |
| `TranslationCache` su SQLite + `get`/`set`/`clear_translation_cache` | translation memory + `lib/offline-cache.ts` |
| `translateWithEnsemble` | `lib/translation/chain-presets.ts` |
| `selectOptimalModel` / `recommendModels` | benchmark-aggregator + Auto-Select data-driven |
| `GAME_GENRE_TEMPLATES` | `lib/ai/prompt-templates.ts` |
| `checkModelUpdates` / `pull_ollama_model` | `lib/ollama-manager.ts` |

Agganciarlo non avrebbe aggiunto una funzione: avrebbe creato **sette doppioni
concorrenti** di funzioni già presenti, più una cache SQLite parallela alla TM.

Cercato cosa valesse la pena travasare prima di cancellare. I template di genere
dell'orfano (`visual_novel`, `action`, `strategy`) sembravano un'aggiunta, ma
`prompt-templates.ts` ha già una `genreMap` che porta `visual_novel` → `jrpg` e
`strategy` → `technical`, e i suoi template hanno glossario, regole, esempi few-shot,
`preservePatterns`, temperatura e associazione al gioco — mentre quelli dell'orfano
sono un `systemPrompt` e un esempio. Non c'è niente da salvare. L'unico genere non
mappato è `action`/`shooter`, e non serve aggiungerlo: `autoSelectTemplate` cade già
sul template `default`, che per UI concisa è la scelta giusta.

Cancellati modulo e service (895 righe).

## Cosa resta (9 in baseline)

Dei moduli orfani non resta niente: uno riattivato, due cancellati. **Tutte e nove
le voci residue sono di tipo "mancante"** — nessun `non-registrato` in baseline. Il
che è il vero risultato della giornata: da qui in avanti un comando che non risponde
è un comando da scrivere, non un modulo da ritrovare.

Le nove voci sono il debito triagiato ieri: la coda batch
(`scan_folder_for_translation_files`, `count_translatable_strings` — che comunque
non traduce niente, la barra è finta con `setTimeout`), `tts_synthesize` (non
esiste alcun motore di sintesi vocale fra i 900 comandi), `extract_godot_pck`,
`extract_renpy_rpa`, e la cache/statistiche dell'injekt (`import_cache`,
`export_cache`, `get_stats`) — più `scan_game_files_with_info`. Gli ultimi due
gruppi il controllo di ieri non li vedeva, perché usano forme di `invoke` che la
sua regex non copriva.
