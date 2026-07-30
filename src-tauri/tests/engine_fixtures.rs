//! Harness di regressione dei parser engine — versione Rust del corpus fixture.
//!
//! Consuma le STESSE fixture del corpus condiviso (`__tests__/fixtures/engines/`)
//! usato dai test vitest, ma qui esercita i parser RUST veri (Godot .pck,
//! Unreal .locres v2, Danganronpa STX, RPG Maker MV JSON) tramite le loro API
//! pubbliche: se un parser regredisce, questi test lo dicono al commit, non al
//! primo utente.
//!
//! ⚠️ LEZIONE 30/07/2026 — le fixture .locres erano state generate "replicando
//! ESATTAMENTE il formato letto dal parser". Il parser però leggeva un magic che
//! ci eravamo INVENTATI, quindi le fixture congelavano l'errore anziché il
//! formato e questi test passavano su file che Unreal non caricherebbe mai.
//! Una fixture generata dal codice che deve validare non prova niente.
//! Ora le .locres si rigenerano dalla SPECIFICA con
//! `node scripts/dev/regen-locres-fixtures.js` (che cita la fonte Epic).
//!
//! I parser sono nel crate lib `gamestringer` (src-tauri/Cargo.toml → [lib]).
//! Nessuno di questi usa AppHandle/State, quindi si chiamano direttamente.

use std::path::PathBuf;

/// Radice del corpus fixture condiviso, relativa a src-tauri/.
fn fixtures_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("__tests__")
        .join("fixtures")
        .join("engines")
}

fn fixture(rel: &str) -> String {
    fixtures_root().join(rel).to_string_lossy().to_string()
}

// ── Unreal .locres v2 (formato "Optimized" con string array condivisa) ──
#[tokio::test]
async fn unreal_locres_v2_extracts_entries() {
    use gamestringer::commands::unreal_localization::parse_locres_file;
    let result = parse_locres_file(fixture("unreal/Game_v2.locres"))
        .await
        .expect("parse locres v2");
    assert_eq!(result.entries.len(), 4, "4 entry attese nella fixture v2");
    let values: Vec<&str> = result.entries.iter().map(|e| e.value.as_str()).collect();
    assert!(values.contains(&"Welcome to Eldoria, traveler!"));
    assert!(values.contains(&"You shall not pass!"));
    // La string array deduplica ma tutte le entry devono essere ricostruite.
    assert!(result.entries.iter().any(|e| e.namespace == "Dialog" && e.key == "npc_greeting"));
}

/// La fixture v0 (legacy, senza string array) deve ancora essere letta.
#[tokio::test]
async fn unreal_locres_v0_still_parses() {
    use gamestringer::commands::unreal_localization::parse_locres_file;
    let result = parse_locres_file(fixture("unreal/Game.locres"))
        .await
        .expect("parse locres v0");
    assert!(result.entries.iter().any(|e| e.value == "Welcome to Eldoria, traveler!"));
}

// ── Godot .pck v2 (Godot 4.3, directory in-line) ──
#[tokio::test]
async fn godot_pck_lists_files() {
    use gamestringer::commands::godot_patcher::scan_godot_pck;
    let result = scan_godot_pck(fixture("godot/test.pck"))
        .await
        .expect("scan godot pck");
    let info = result.pck_info.expect("pck_info presente");
    assert_eq!(info.pack_version, 2);
    assert_eq!(info.file_count, 1);
    assert!(info.files.iter().any(|f| f.path.contains("strings.it.translation")));
}

// ── Danganronpa STX (tabella di stringhe UTF-16LE) ──
#[test]
fn danganronpa_stx_extracts_strings() {
    use gamestringer::commands::danganronpa_patcher::parse_stx_file;
    let stx = parse_stx_file(fixture("danganronpa/test.stx")).expect("parse stx");
    assert_eq!(stx.table_count, 1);
    let texts: Vec<&str> = stx.strings.iter().map(|s| s.text.as_str()).collect();
    assert!(texts.contains(&"Class Trial begins now!"));
    assert_eq!(stx.strings.len(), 3);
}

// ── CRI Middleware .cpk (tabelle @UTF big-endian: header + TOC) ──
#[test]
fn cri_cpk_lists_contents() {
    use gamestringer::commands::cri_patcher::list_cpk_contents;
    let entries = list_cpk_contents(fixture("cri/test.cpk")).expect("list cpk");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].path, "msg/dialogue.msg");
    assert!(!entries[0].compressed, "FileSize == ExtractSize → non compresso");
    assert_eq!(entries[0].id, 1);
}

#[test]
fn cri_cpk_extracts_and_parses_msg_text() {
    use gamestringer::commands::cri_patcher::{extract_text_files_from_cpk, parse_cri_text_file};
    let files = extract_text_files_from_cpk(fixture("cri/test.cpk"), vec!["*.msg".to_string()])
        .expect("extract text files");
    assert_eq!(files.len(), 1, "il pattern *.msg deve matchare dialogue.msg");
    let payload = String::from_utf8_lossy(&files[0].data);
    assert!(payload.contains("Velvet Room"), "payload estratto senza corruzione");

    // Pipeline completa: il formato MSG estrae le battute separate da null.
    let entries = parse_cri_text_file(files[0].data.clone(), "msg".to_string())
        .expect("parse msg format");
    let texts: Vec<&str> = entries.iter().map(|e| e.value.as_str()).collect();
    assert!(texts.iter().any(|t| t.contains("Velvet Room")));
    assert!(texts.iter().any(|t| t.contains("Igor")));
}

// ── Bethesda: string table STRINGS (zstring) e DLSTRINGS (size-prefixed) ──
#[test]
fn bethesda_strings_table_parses() {
    use gamestringer::commands::bethesda_patcher::extract_strings_file;
    let entries = extract_strings_file(fixture("bethesda/Skyrim_English.STRINGS"))
        .expect("parse .STRINGS");
    assert_eq!(entries.len(), 3);
    assert!(entries.iter().any(|e| e.id == 3 && e.value == "Welcome to Whiterun, traveler."));
    assert!(entries.iter().any(|e| e.id == 1 && e.value == "Iron Sword"));
}

#[test]
fn bethesda_dlstrings_table_parses() {
    use gamestringer::commands::bethesda_patcher::extract_strings_file;
    let entries = extract_strings_file(fixture("bethesda/Skyrim_English.DLSTRINGS"))
        .expect("parse .DLSTRINGS");
    assert_eq!(entries.len(), 2);
    assert!(entries.iter().any(|e| e.id == 10 && e.value.contains("Dragon War")));
}

// ── Bethesda BSA v104 (Skyrim SE: folder record + bzstring + name block) ──
#[test]
fn bethesda_bsa_lists_contents() {
    use gamestringer::commands::bethesda_patcher::list_bsa_contents;
    let entries = list_bsa_contents(fixture("bethesda/test.bsa")).expect("parse bsa");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].path, "strings\\skyrim_english.strings");
    assert_eq!(entries[0].size, 64);
    assert!(!entries[0].compressed);
}

// ── RPG Maker MV (JSON — fixture di testo condivisa col corpus JS) ──
#[test]
fn rpgmaker_mv_extracts_map_dialogue() {
    use gamestringer::commands::rpgmaker_patcher::extract_rpgmaker_strings;
    let result = extract_rpgmaker_strings(fixture("rpgmaker-mv/www/data/Map001.json"))
        .expect("extract rpgmaker mv");
    assert!(result.success);
    let originals: Vec<&str> = result.strings.iter().map(|s| s.original.as_str()).collect();
    assert!(
        originals.iter().any(|s| s.contains("Welcome to Eldoria")),
        "il dialogo dell'evento deve essere estratto, trovati: {:?}",
        originals
    );
}
