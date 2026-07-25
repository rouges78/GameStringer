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

## Risolti in questa sessione

| Comando invocato | Sostituito con | Dove |
|---|---|---|
| `select_folder` | selettore di sistema `@tauri-apps/plugin-dialog` | universal-injector |
| `open_folder_in_explorer` | `open_path` | game-tools-panel |
| `open_folder` | `open_path` | translation-wizard |
| `open_directory` | `open_path` | tauri-integration |
| `list_running_processes` | `get_processes` | injekt-ui-enhanced |
| `find_processes` | `get_processes` | injekt-translator |

## Ancora rotti — funzionalità che falliscono al primo click

Ognuno richiede un comando Rust nuovo (o il collegamento a uno esistente).
In ordine di quanto è visibile all'utente:

| Comando | Funzione che non parte | File |
|---|---|---|
| `scan_folder_for_translation_files` | coda di traduzione batch: scansione cartella | components/tools/batch-translation-queue.tsx |
| `count_translatable_strings` | coda batch: conteggio stringhe | components/tools/batch-translation-queue.tsx |
| `tts_synthesize` | doppiaggio: sintesi vocale XTTS | components/audio-patcher.tsx |
| `read_file_base64` | pipeline doppiaggio | lib/voice/dubbing-pipeline.ts |
| `create_directory` | wizard traduzione | app/translation-wizard/page.tsx |
| `write_binary_file` | wizard traduzione | app/translation-wizard/page.tsx |
| `extract_godot_pck` | raccomandazione traduzione (Godot) | components/translation-recommendation.tsx |
| `extract_renpy_rpa` | raccomandazione traduzione (Ren'Py) | components/translation-recommendation.tsx |
| `get_all_games` | estrattore video: elenco giochi | app/video-extractor/page.tsx |
| `get_epic_games` | integrazione Epic | lib/tauri-integration.ts |
| `launch_game` | avvio gioco (via tauri-integration) | lib/tauri-integration.ts |
| `get_system_info` | info di sistema | lib/tauri-integration.ts |
| `import_cache` · `get_stats` | injekt translator | lib/injekt-translator.ts |
| `initialize_notification_system` · `cleanup_notification_system` | avvio/chiusura sistema notifiche | components/notifications/notification-provider.tsx |

Nota su `lib/tauri-integration.ts`: quattro comandi su quattro non esistono, il
che fa sospettare che l'intero modulo sia un residuo di un'API precedente mai
completata. Vale la pena verificare se qualcuno lo usa davvero prima di
implementare i comandi.

## Come evitare che ricapiti

Il difetto è invisibile in compilazione: TypeScript non sa quali comandi esistono
lato Rust, e un `invoke` verso il nulla fallisce solo a runtime. Un controllo
come quello usato qui, eseguito in CI, lo trasformerebbe in un errore di build.
Lo script sta in questa sessione; se lo si vuole permanente va messo in
`scripts/` e agganciato alla pipeline, accanto al gate i18n che già esiste.
