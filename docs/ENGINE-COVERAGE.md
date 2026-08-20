# Matrice copertura engine × stato

> Generata il 2026-06-14 · HEAD `8bd22fb2` · classificazione **solo su evidenza dura** (codice nel repo).

## Metodologia

Lo stato di ogni engine è derivato **esclusivamente** da fatti verificabili nel
codice, non da stime. I tre segnali usati:

1. **Comandi registrati** — numero di `#[tauri::command]` di quel modulo presenti
   nell'`invoke_handler` di `src-tauri/src/main.rs` (= l'engine è raggiungibile
   dall'app).
2. **Test unitari** — numero di `#[test]` / `#[tokio::test]` nel modulo Rust
   (Vitest dove indicato).
3. **Aggancio auto-pipeline** — routing esplicito in `startAutoTranslate()`
   (`components/game-detail-client.tsx`) o pulsante UI dedicato.

### Legenda stato

| Stato | Criterio (evidenza dura) |
|-------|--------------------------|
| ✅ **Testato** | Registrato **e** suite di test Rust sostanziale che esercita parsing/patch su fixture |
| 🟡 **Registrato, non testato** | Raggiungibile dall'app ma **0 test unitari** (tipico dei moduli runtime WinAPI) |
| ⚪ **Non agganciato / WIP** | Modulo presente nel sorgente ma **0 comandi** registrati |

> ⚠️ **Limite della classificazione.** "Testato" significa che il parser/patcher
> è coperto da test su fixture — **non** garantisce il funzionamento end-to-end
> sul gioco reale (font, encoding, varianti di formato, anti-cheat). È la prova
> più forte disponibile in repo, non un collaudo sul campo.

---

## Patcher file-based (parsing/patch su file del gioco)

| Engine | Modulo | Comandi | Test | Stato |
|--------|--------|:------:|:----:|-------|
| Unity (file/asset patcher) | `unity_patcher` | 11 | 122 | ✅ Testato |
| Danganronpa | `danganronpa_patcher` | 25 | 93 (+1 Vitest) | ✅ Testato |
| CRI Middleware (Persona/Yakuza/Tales…) | `cri_patcher` | 5 | 87 | ✅ Testato |
| Visionaire Studio 5 | `visionaire_patcher` | 5 | 83 | ✅ Testato |
| Ren'Py | `renpy_patcher` | 7 | 82 | ✅ Testato |
| GameMaker | `gamemaker_patcher` | 5 | 77 | ✅ Testato |
| Bethesda (BSA/BA2/ESP) | `bethesda_patcher` | 6 | 54 | ✅ Testato |
| Wolf RPG | `wolfrpg_patcher` | 8 | 51 | ✅ Testato |
| TyranoScript | `tyranoscript_patcher` | 5 | 49 | ✅ Testato |
| Godot (PCK) | `godot_patcher` | 5 | 46 | ✅ Testato |
| Unreal (file patcher) | `unreal_patcher` | 9 | 42 | ✅ Testato |
| RPG Maker (MV/MZ file-based) | `rpgmaker_patcher` | 9 | 23 | ✅ Testato |

RPG Maker ha inoltre routing esplicito in `startAutoTranslate()`: i giochi
RPG_RT classici (2000/2003, senza stringhe estraibili) vengono instradati alla
**traduzione live OCR** invece che al patch file-based.

### Universal Injector (auto-detect dispatcher, file-based)

| Funzione | Modulo | Comandi | Test | Stato |
|----------|--------|:------:|:----:|-------|
| Auto-detect engine + setup traduzione | `universal_injector` | 3 | 22 | ✅ Testato |

Tool cross-engine raggiungibile da `/injector` (sidebar gruppo Patcher). Espone
`detect_game_engine`, `inject_translation_hook`, `list_translatable_files`. È
**puro filesystem e cross-platform** (niente WinAPI: rileva l'engine dai file su
disco e prepara cartelle/config di traduzione), quindi non rientra nei moduli
runtime Windows-only né passa dal gate anti-cheat. Coperto da 22 test su fixture
tempdir: rilevazione engine (uno per engine + priorità Unity/Unreal, dir
sconosciuta, path mancante), `list_translatable_files`, e `inject_translation_hook`
(Ren'Py/RPG Maker MV creano cartelle e config, backup, Unity rimanda al patcher
dedicato, engine tool-based restituiscono guida, fallback engine sconosciuto).
`inject_translation_hook` gestisce tutti i 12 engine rilevati: setup file-based
per Unity/RPG Maker MV·MZ/Ren'Py, step guida con tool per gli engine ad archivio
criptato (RGSS, GameMaker, Kirikiri, NScripter, Wolf, Godot, Unreal).

---

## Ecosistema Unity / Unreal aggiuntivo

| Engine/Funzione | Modulo | Comandi | Test | Stato |
|-----------------|--------|:------:|:----:|-------|
| Unreal localization | `unreal_localization` | 12 | 35 | ✅ Testato |
| Unity bundle | `unity_bundle` | 8 | 19 | ✅ Testato |
| Unity localization | `unity_localization` | 6 | 24 | ✅ Testato |
| Unity .assets manager | `unity_assets` | 6 | 8 | ✅ Testato |
| Unity asset injector (Python) | `unity_asset_injector` | 3 | 10 | ✅ Logica Rust testata; script Python no |
| Unity injector (runtime) | `unity_injector` | 3 | 6 | 🟡 Logica IPC/guardia testata; injection WinAPI no |
| Unreal IoStore | `unreal_iostore` | 5 | 31 | ✅ Testato |
| Unity CSV | `unity_csv` | 1 | 11 | ✅ Testato |

`unreal_localization` è coperto da 35 test deterministici (no file di gioco
reali): round-trip dei writer/parser `.locres` v0 e v2 (con dedup string array),
selezione versione, rifiuto versioni future, helper binari (`FString` UTF-8/vuota,
i32, EOF), e un **round-trip PAK completo** `create_pak_v4` → `find_pak_footer` →
`parse_pak_index` → `extract_file_from_pak` → `parse_locres`. Coperti anche gli
helper FS (`find_project_name`, `find_paks_dir`, `find_loose_locres`) e i comandi
async (`parse_locres_file`, `get_unreal_localization_status`,
`extract_unreal_localization` su `.locres` libero, con regressione sul messaggio
"Estratte 0 stringhe").

`unity_localization` è coperto da 24 test: tokenizer Smart String (literal/variable/
formatter/plural/nested, escape), classificazione token, `extract_brace_tokens`,
detection locale (paren/underscore/path, passthrough sconosciuti), helper binari
Unity (`unity_string` con alignment, null-terminated, `align4`), scansione
(`find_all_occurrences`, `is_reasonable_utf8`), comandi async (`parse_smart_string`,
`validate_smart_string_translation` su match/missing/braces sbilanciate,
`parse_addressables_catalog` su catalog.json). Include un **bundle UnityFS
sintetico** non compresso usato per il round-trip `parse_unityfs_header` →
`parse_block_info` → `decompress_blocks` → `extract_string_table` e per
`build_patched_bundle` (sostituzione stringa + ri-estrazione).

`unity_bundle` è coperto da 19 test: `extract_locale` (nome lingua + codice paren),
`is_valid_game_string` (accetta testo, scarta path/numeri/controllo), estrazione raw
length-prefixed (con dedup e ordinamento), parsing dump UABEA (`parse_dump_content`,
`parse_exported_dumps`), e comandi async (`analyze_localization_bundles` con
classificazione complete/empty, `detect_localization_folder`, round-trip
`save`/`read` JSON, `extract_strings_auto`, `import_uabea_export`,
`create_translated_bundle`). I test hanno scoperto e fatto correggere un
**off-by-one in `find_string_in_bundle`** (una stringa length-prefixed in coda al
buffer non veniva trovata, con conseguente mancata sostituzione in
`create_translated_bundle`).

`unity_assets` è coperto da 8 test: euristiche di testo (`is_likely_text` accetta
ASCII/scarta binario e UTF-8 invalido, `looks_like_game_text` filtra simboli e
stringhe senza spazi), `find_unity_assets_files` (rileva `.assets` solo in cartelle
`_Data`), `scan_assets_for_text` (estrazione length-prefixed di testo di gioco,
errore su file mancante), `check_uabea_installed` (coerenza installed/path),
`prepare_assets_for_translation` (conteggio file rilevanti).

`unity_injector` (runtime, Windows-only) ha 6 test sulla parte non-WinAPI:
`extract_text_from_request` (parser JSON IPC), `get_unity_translator_dll` (suffisso
path), `stop_unity_translation_server` (reset flag), e la guardia di
`inject_unity_translator` che fallisce su processo inesistente **prima** di
qualsiasi chiamata di injection. La DLL injection vera (`CreateRemoteThread` +
`LoadLibrary`, dietro il gate `assert_injection_allowed`) e il server named-pipe non
sono riproducibili in CI.

`unity_asset_injector` (orchestra lo script Python `unity_inject.py`) ha 10 test
sulla logica Rust: `csv_escape` (quoting), export CSV traduzioni (raggruppamento per
tabella, skip righe vuote, nome tabella di default) e Ink, `contains_bytes`,
`extract_caret_strings` (estrazione `"^testo"` dai blob Ink con filtri ed
unescape `\n`), e i comandi `restore_unity_assets` (ripristino backup) e
`scan_unity_ink_strings` (scan sharedassets, errore su dir mancante). L'injection
vera (resize asset) è delegata allo script Python, non coperto dalla CI Rust.

`unity_csv` è coperto da 11 test: `parse_csv_line` (quote/virgole), `parse_csv_block`
(estrazione entry, scarto id vuoti e blocchi troppo corti), `find_csv_in_binary`
(localizza il blocco `ID,ENGLISH` tra byte null), `find_data_dir`,
`detect_unity_version` (regex su globalgamemanagers), e il comando
`scan_unity_csv_tables`. I test hanno fatto emergere e correggere una collisione in
`identify_table_name`: `"spell_"` contiene `"ll_"` e veniva classificato come
"popups" invece di "spelltexts" (riordinati i prefissi specifici prima di
`ll_`/`vl_`).

`unreal_iostore` è coperto da 31 test: helper binari (`read_u8/u32/i32/u64` con EOF,
`read_fstring`/`try_read_fstring_at` UTF-8 + casi limite), euristiche di pulizia
(`is_translatable_text`, `split_on_id_boundaries`, `clean_datatable_string`),
scanner `scan_ftext_entries` (FText Base ns/key/source) e `scan_uasset_strings`
(DataTable), e parser su fixture sintetiche: **UTOC header v3** (`parse_utoc_header`,
campi + rifiuto magic errato) e **directory index** (`parse_directory_index`,
ricostruzione path file → toc entry). Non testati la decompressione Oodle (DLL
esterna) e la lettura UCAS con seek (richiedono container reali).

---

## Runtime injection / overlay (Windows-only)

Per natura questi moduli agiscono sul processo in esecuzione (WinAPI), quindi non
sono coperti da test unitari su fixture. Su Linux esistono solo come stub
(vedi `platform_stubs.rs` e `scripts/check-linux-stubs.py`).

| Funzione | Modulo | Comandi | Test | Stato |
|----------|--------|:------:|:----:|-------|
| OCR runtime / overlay | `ocr_translator` | 24 | 12 | 🟡 Preprocessing testato; capture/overlay no |
| Memory injection | `injekt` | 14 | 0 | 🟡 Registrato, non testato |
| Anti-cheat gate | `anti_cheat` | 6 | 14 | 🟡 Logica gate testata; scan WinAPI no |
| Screen capture | `screen_capture` | 5 | 0 | 🟡 Registrato, non testato |
| Context injection | `context_injection` | 5 | 0 | 🟡 Registrato, non testato |
| UE translator (hook DLL) | `ue_translator` | 7 | 0 | 🟡 Registrato, non testato |
| Auto-hook scanner | `auto_hook` | 1 | 0 | 🟡 Registrato, non testato |
| GS-Hook injector (spike GDI) | `gs_hook_injector` | 1 | 0 | 🟡 Registrato, non testato |

L'infrastruttura OCR (start_ocr_translator / overlay) è completa e già agganciata
per RPG Maker classico. La **pipeline di preprocessing** (upscale nearest-neighbor,
contrasto, threshold, invert, dithering, denoise, sharpen, auto-detect palette) è
ora coperta da 12 test deterministici su fixture in-memory in
`src-tauri/src/ocr_translator/retro_preprocessor.rs` (valori esatti, non solo
dimensioni). Restano non testati la cattura schermo e l'overlay (WinAPI) e il
binding Tesseract, non riproducibili in CI.

**Gate anti-cheat** — la logica safety-critical (matching firme note, aggregazione
rischio, fail-closed, policy di compatibilità) è ora estratta in funzioni pure e
coperta da 14 test in `src-tauri/src/anti_cheat.rs`. Resta non testato lo scan
WinAPI vero (`get_running_processes` / `get_process_modules`), non riproducibile
in CI. Il job **check-windows** esegue ora l'**intera suite Rust** con
`cargo test --verbose` (non più solo `cargo check` né un sottoinsieme): dopo la
bonifica dei test flaky (2026-06-14) la suite è pulita e gira completa nel gate,
quindi anche i test dei patcher (incluso `universal_injector`) sono coperti dalla
CI. Vedi `.github/workflows/ci.yml` e `docs/RUST-TEST-TRIAGE.md`.

---

## Moduli ausiliari (supporto, non engine)

| Funzione | Modulo | Comandi | Test | Stato |
|----------|--------|:------:|:----:|-------|
| Video extractor (VMD/BIK/USM…) | `video_extractor` | 10 | 18 | ✅ Testato |
| Audio patcher | `audio_patcher` | 3 | 19 | ✅ Testato |
| Export PO/POT universale | `po_export` | 4 | 5 | ✅ Testato (leggero) |

---

## Gap noti (engine senza modulo dedicato)

Per onestà comparativa, engine diffusi **non** ancora coperti da un modulo
dedicato in `src-tauri/src/commands`: KiriKiri/KAG, Naninovel, NScripter,
Live Maker, SRPG Studio. (Alcuni titoli potrebbero comunque ricadere sotto OCR
runtime o injection generica, ma senza un patcher file-based specifico.)

---

## Come rigenerare

I conteggi provengono da:

- Comandi: `generate_handler![...]` in `src-tauri/src/main.rs`
- Test: `grep -c '#\[test\]\|#\[tokio::test\]'` sui moduli in `src-tauri/src/commands`
- Auto-pipeline: `startAutoTranslate()` in `components/game-detail-client.tsx`

Aggiornare questa matrice quando si aggiunge un engine (ricordando la regola di
progetto: agganciare sempre in `startAutoTranslate()`).
