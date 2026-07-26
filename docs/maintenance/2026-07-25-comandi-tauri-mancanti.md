# Comandi Tauri invocati ma inesistenti — 25/07/2026

Partito dalla segnalazione utente «"обзор" в универсальном инжекторе не работает»
(il pulsante Sfoglia dell'iniettore universale non funziona, 21/07). La causa era
un `invoke('select_folder')` verso un comando **che non esiste**: l'errore finiva
in un `catch` che si limitava a scrivere nel log, quindi il pulsante sembrava
morto senza dire nulla.

Verificata l'ipotesi che ce ne fossero altri: **sì**.

## Metodo

Confronto fra i comandi `invoke(...)` nel frontend e le funzioni annotate
`#[tauri::command]` **o** `#[command]` (forma breve — cercare solo la prima dà
~190 falsi positivi) nel backend. Esclusi test ed e2e.

- comandi definiti: 897
- comandi invocati dal frontend: 398
- **invocati ma inesistenti: 20** (dopo aver scartato 5 falsi positivi: funzioni
  `fn` non `pub fn`, che esistono e funzionano)

## Risolti — primo giro

| Comando invocato | Sostituito con | Dove |
|---|---|---|
| `select_folder` | selettore di sistema `@tauri-apps/plugin-dialog` | universal-injector |
| `open_folder_in_explorer` | `open_path` | game-tools-panel |
| `open_folder` | `open_path` | translation-wizard |
| `open_directory` | `open_path` | tauri-integration |
| `list_running_processes` | `get_processes` | injekt-ui-enhanced |
| `find_processes` | `get_processes` | injekt-translator |

## Risolti — secondo giro

| Comando invocato | Sostituito con | Dove |
|---|---|---|
| `read_file_base64` | `read_binary_file_base64` | lib/voice/dubbing-pipeline.ts |
| `create_directory` | `ensure_directory` (crea anche i parent) | translation-wizard |
| `write_binary_file` | `save_binary_file` (+ codifica base64 a blocchi) | translation-wizard |
| `get_all_games` | `get_games` | app/video-extractor |
| `get_epic_games` · `launch_game` · `get_system_info` | — | modulo cancellato |
| `initialize_notification_system` · `cleanup_notification_system` | — | blocco rimosso |

Tre note su questo giro:

- **`lib/tauri-integration.ts` era codice morto**: nessun file lo importava
  (verificato su tutto l'albero `.ts`/`.tsx`). Cancellato, e con lui tre comandi
  inesistenti.
- **Le due chiamate del sistema notifiche non erano nemmeno rotte: erano
  irraggiungibili.** Giravano su `window.__TAURI__.tauri.invoke`, che è l'API
  globale di Tauri **v1** (in v2 è `__TAURI__.core`, e solo con
  `withGlobalTauri`): la guardia `if (invokeCmd)` era sempre falsa. Rimossi
  entrambi i blocchi.
- **`get_games` non restituisce la stessa forma** che il selettore
  dell'estrattore video si aspettava: `GameInfo` ha `install_path` (percorso
  completo) e `steam_app_id`, non `install_dir`/`app_id`. Adattata l'interfaccia
  e tolto il passaggio intermedio `find_game_install_path`, che ora è superfluo.
  Ricablare il nome senza guardare la forma avrebbe lasciato la lista vuota
  esattamente come prima.

## Ancora rotti

Questi richiedono codice Rust nuovo, non un ricablaggio.

| Comando | Funzione che non parte | File |
|---|---|---|
| `tts_synthesize` | doppiaggio: sintesi vocale | components/audio-patcher.tsx |
| `extract_godot_pck` | raccomandazione traduzione (Godot) | components/translation-recommendation.tsx |
| `extract_renpy_rpa` | raccomandazione traduzione (Ren'Py) | components/translation-recommendation.tsx |
| `import_cache` · `get_stats` | injekt translator: cache e statistiche live | lib/injekt-translator.ts |
| `scan_folder_for_translation_files` · `count_translatable_strings` | coda di traduzione batch | components/tools/batch-translation-queue.tsx |

Dettaglio, perché non sono tutti uguali:

- **`tts_synthesize`**: non esiste **nessun** comando di sintesi vocale nel
  backend (nessun match su tts/xtts/voice/speak fra i 901 comandi). Non è un
  nome sbagliato: il motore di doppiaggio non c'è. Va deciso quale usare
  (XTTS, Piper) e come distribuirlo, prima di scrivere il comando.
- **`extract_godot_pck`**: esistono `scan_godot_pck` (elenca) e
  `extract_godot_file` (estrae **un** file, e restituisce una `String`, quindi
  solo testo). Manca l'estrazione dell'intero PCK su disco.
- **`extract_renpy_rpa`**: nessun lettore di archivi `.rpa` lato Rust. Il
  patcher Ren'Py lavora solo su `.rpy` già estratti.
- **`import_cache` / `get_stats`**: il pannello statistiche dell'injekt mostra
  zeri e la cache non viene mai passata al backend, in silenzio.
- **Coda batch**: qui il comando mancante è il problema minore. Il componente
  **non traduce niente**: `startProcessing` conta le stringhe (o usa 100 di
  default), poi fa avanzare una barra con `setTimeout(100)` e segna il lavoro
  come `completed` — nessuna chiamata di traduzione, nessun file scritto. Il
  commento nel codice lo dice: *"Simulate progressive translation"*. Sistemare
  la scansione senza sistemare il resto renderebbe la finzione più credibile,
  quindi è stata lasciata intatta in attesa di una decisione: implementare la
  coda per davvero (riusando `translateSmart`) o togliere la pagina
  `/batch-translation`, che oggi non è raggiungibile dal menu.

## Come evitare che ricapiti

Il difetto è invisibile in compilazione: TypeScript non sa quali comandi esistono
lato Rust, e un `invoke` verso il nulla fallisce solo a runtime. Un controllo
come quello usato qui, eseguito in CI, lo trasformerebbe in un errore di build.
Lo script sta in questa sessione; se lo si vuole permanente va messo in
`scripts/` e agganciato alla pipeline, accanto al gate i18n che già esiste.

Controllo rapido, da rilanciare dopo ogni giro:

```bash
# comandi definiti lato Rust
grep -rhA3 -E '#\[(tauri::)?command' src-tauri/src --include=*.rs \
  | grep -oE '\bfn [a-z_0-9]+' | sed 's/fn //' | sort -u > /tmp/cmds.txt
# comandi invocati dal frontend
grep -rhoE "invoke(<[^>]*>)?\(\s*'[a-z_0-9]+'" --include=*.ts --include=*.tsx \
  app components lib hooks src | grep -oE "'[a-z_0-9]+'" | tr -d "'" | sort -u > /tmp/inv.txt
comm -23 /tmp/inv.txt /tmp/cmds.txt
```

Attenzione ai limiti di questa versione: prende solo `invoke('nome')` con
apici singoli e nome letterale, quindi **sottostima**. La versione da mettere in
CI deve coprire anche template literal, doppi apici e i wrapper (`safeInvoke`,
`invokeCmd`), e distinguere i comandi registrati in `main.rs` da quelli
solamente definiti.
