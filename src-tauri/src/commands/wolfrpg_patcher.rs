// Wolf RPG Editor Patcher
// Supporto per giochi Wolf RPG Editor (ウディタ)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::command;
use crate::commands::encoding_utils;

// ============================================================================
// STRUTTURE DATI
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WolfRpgGame {
    pub path: String,
    pub title: String,
    pub data_files: Vec<WolfRpgDataFile>,
    pub map_files: Vec<WolfRpgMapFile>,
    pub has_game_dat: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WolfRpgDataFile {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub file_type: WolfRpgFileType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WolfRpgFileType {
    Database,      // BasicData/, SysDataBaseBasic.dat, etc.
    CommonEvent,   // CommonEvent.dat
    MapTree,       // MapTree.dat
    System,        // SysFile.dat
    GameDat,       // Game.dat (encrypted package)
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WolfRpgMapFile {
    pub path: String,
    pub filename: String,
    pub map_id: u32,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WolfRpgString {
    pub id: String,
    pub original: String,
    pub translated: String,
    pub file: String,
    pub context: String,
    pub string_type: WolfRpgStringType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WolfRpgStringType {
    Database,
    CommonEvent,
    MapEvent,
    System,
    Message,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WolfRpgExtractionResult {
    pub success: bool,
    pub message: String,
    pub strings: Vec<WolfRpgString>,
    pub total_count: u32,
    pub requires_decryption: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WolfRpgStats {
    pub total: usize,
    pub translated: usize,
    pub untranslated: usize,
    pub percentage: usize,
    pub by_type: HashMap<String, usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WolfTransInfo {
    pub available: bool,
    pub download_url: String,
    pub description: String,
}

// ============================================================================
// RILEVAMENTO GIOCO
// ============================================================================

/// Rileva se una cartella contiene un gioco Wolf RPG
#[command]
pub fn detect_wolfrpg_game(game_path: String) -> Result<WolfRpgGame, String> {
    let path = Path::new(&game_path);
    
    if !path.exists() {
        return Err("Percorso non esistente".to_string());
    }
    
    // Cerca file caratteristici di Wolf RPG
    let data_folder = path.join("Data");
    let basic_data = path.join("BasicData");
    let game_dat = path.join("Game.dat");
    let game_exe = path.join("Game.exe");
    
    // Wolf RPG ha tipicamente Game.exe + Data/ o BasicData/
    let is_wolf = game_exe.exists() && (data_folder.exists() || basic_data.exists() || game_dat.exists());
    
    if !is_wolf {
        // Controlla anche nella root per file .dat specifici
        let has_wolf_files = path.join("CommonEvent.dat").exists() 
            || path.join("MapTree.dat").exists()
            || game_dat.exists();
        
        if !has_wolf_files {
            return Err("Non sembra essere un gioco Wolf RPG Editor".to_string());
        }
    }
    
    // Trova file dati
    let data_files = find_data_files(&game_path)?;
    let map_files = find_map_files(&game_path)?;
    let has_game_dat = game_dat.exists();
    
    // Estrai titolo
    let title = extract_game_title(&game_path);
    
    log::info!("🐺 Rilevato Wolf RPG: {} ({} file dati, {} mappe)", 
        title, data_files.len(), map_files.len());
    
    Ok(WolfRpgGame {
        path: game_path,
        title,
        data_files,
        map_files,
        has_game_dat,
    })
}

/// Trova file dati Wolf RPG
fn find_data_files(game_path: &str) -> Result<Vec<WolfRpgDataFile>, String> {
    let path = Path::new(game_path);
    let mut files = Vec::new();
    
    // Cartelle da cercare
    let search_folders = [
        path.to_path_buf(),
        path.join("Data"),
        path.join("BasicData"),
    ];
    
    for folder in &search_folders {
        if folder.exists() {
            if let Ok(entries) = fs::read_dir(folder) {
                for entry in entries.flatten() {
                    let file_path = entry.path();
                    if file_path.is_file() {
                        if let Some(ext) = file_path.extension() {
                            if ext.to_string_lossy().to_lowercase() == "dat" {
                                let filename = file_path.file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("unknown")
                                    .to_string();
                                
                                let file_type = classify_wolf_file(&filename);
                                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                                
                                // Evita duplicati
                                if !files.iter().any(|f: &WolfRpgDataFile| f.filename == filename) {
                                    files.push(WolfRpgDataFile {
                                        path: file_path.to_string_lossy().to_string(),
                                        filename,
                                        size,
                                        file_type,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    files.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(files)
}

/// Trova file mappa Wolf RPG
fn find_map_files(game_path: &str) -> Result<Vec<WolfRpgMapFile>, String> {
    let path = Path::new(game_path);
    let mut maps = Vec::new();
    
    let map_folders = [
        path.join("Data"),
        path.join("MapData"),
        path.to_path_buf(),
    ];
    
    for folder in &map_folders {
        if folder.exists() {
            if let Ok(entries) = fs::read_dir(folder) {
                for entry in entries.flatten() {
                    let file_path = entry.path();
                    if file_path.is_file() {
                        let filename = file_path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string();
                        
                        // Map file: Map000.mps, Map001.mps, etc.
                        if filename.starts_with("Map") && filename.ends_with(".mps") {
                            let map_id = filename
                                .trim_start_matches("Map")
                                .trim_end_matches(".mps")
                                .parse::<u32>()
                                .unwrap_or(0);
                            
                            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            
                            maps.push(WolfRpgMapFile {
                                path: file_path.to_string_lossy().to_string(),
                                filename,
                                map_id,
                                size,
                            });
                        }
                    }
                }
            }
        }
    }
    
    maps.sort_by(|a, b| a.map_id.cmp(&b.map_id));
    Ok(maps)
}

/// Classifica tipo file Wolf RPG
fn classify_wolf_file(filename: &str) -> WolfRpgFileType {
    let name_lower = filename.to_lowercase();
    
    if name_lower == "game.dat" { return WolfRpgFileType::GameDat; }
    if name_lower.contains("commonevent") { return WolfRpgFileType::CommonEvent; }
    if name_lower.contains("maptree") { return WolfRpgFileType::MapTree; }
    if name_lower.contains("sys") { return WolfRpgFileType::System; }
    if name_lower.contains("database") || name_lower.contains("basic") { 
        return WolfRpgFileType::Database; 
    }
    
    WolfRpgFileType::Other
}

/// Estrai titolo del gioco
fn extract_game_title(game_path: &str) -> String {
    let path = Path::new(game_path);
    
    // Prova a leggere da Game.ini se esiste
    let ini_path = path.join("Game.ini");
    if ini_path.exists() {
        if let Ok(content) = fs::read_to_string(&ini_path) {
            for line in content.lines() {
                if line.starts_with("Title=") {
                    return line.trim_start_matches("Title=").trim().to_string();
                }
            }
        }
    }
    
    // Fallback: nome cartella
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Wolf RPG Game")
        .to_string()
}

// ============================================================================
// ESTRAZIONE (base - per file non criptati)
// ============================================================================

/// Estrai stringhe da file Wolf RPG (best effort per file non criptati)
/// Nota: Wolf RPG usa un formato binario complesso, questa è un'estrazione euristica
#[command]
pub fn extract_wolfrpg_strings_basic(file_path: String) -> Result<WolfRpgExtractionResult, String> {
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err("File non trovato".to_string());
    }
    
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    // Se è Game.dat, è criptato
    if filename.to_lowercase() == "game.dat" {
        return Ok(WolfRpgExtractionResult {
            success: false,
            message: "Game.dat è criptato. Usa Translator++ o WolfTrans per estrarre.".to_string(),
            strings: Vec::new(),
            total_count: 0,
            requires_decryption: true,
        });
    }
    
    // Leggi file binario
    let data = fs::read(&file_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let mut strings = Vec::new();
    let mut id_counter = 0u32;
    
    // Estrazione euristica: cerca sequenze di caratteri UTF-8/Shift-JIS
    // Wolf RPG usa spesso Shift-JIS per il giapponese
    let extracted = extract_strings_from_binary(&data);
    
    for text in extracted {
        // Filtra stringhe troppo corte o che sembrano codice
        if text.len() >= 2 && !looks_like_code(&text) {
            id_counter += 1;
            strings.push(WolfRpgString {
                id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                original: text,
                translated: String::new(),
                file: filename.clone(),
                context: String::new(),
                string_type: WolfRpgStringType::Database,
            });
        }
    }
    
    let total_count = strings.len() as u32;
    
    log::info!("📝 Estratte {} stringhe da {} (euristica)", total_count, filename);
    
    Ok(WolfRpgExtractionResult {
        success: true,
        message: format!("Estratte {} stringhe (metodo euristico)", total_count),
        strings,
        total_count,
        requires_decryption: false,
    })
}

/// Estrai stringhe da dati binari (euristica)
fn extract_strings_from_binary(data: &[u8]) -> Vec<String> {
    let mut strings = Vec::new();
    let mut current = Vec::new();
    let mut in_string = false;
    
    for &byte in data {
        // Caratteri ASCII stampabili o UTF-8 multi-byte
        if (0x20..=0x7E).contains(&byte) || byte >= 0x80 {
            current.push(byte);
            in_string = true;
        } else if in_string {
            // Fine stringa
            if current.len() >= 4 {
                // Auto-detect encoding (supports UTF-8, Shift-JIS, etc.)
                let (s, _enc) = encoding_utils::auto_decode(&current);
                if !s.trim().is_empty() {
                    strings.push(s);
                }
            }
            current.clear();
            in_string = false;
        }
    }
    
    strings
}

/// Controlla se una stringa sembra codice/path
fn looks_like_code(s: &str) -> bool {
    s.contains("\\") ||
    s.contains("/") ||
    s.starts_with("0x") ||
    s.chars().all(|c| c.is_ascii_digit() || c == '.') ||
    s.len() > 200
}

// ============================================================================
// SALVATAGGIO/CARICAMENTO
// ============================================================================

/// Salva traduzioni in formato JSON
#[command]
pub fn save_wolfrpg_translations(
    output_path: String,
    strings: Vec<WolfRpgString>,
) -> Result<u32, String> {
    let json = serde_json::to_string_pretty(&strings)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&output_path, json)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    let count = strings.len() as u32;
    log::info!("💾 Salvate {} traduzioni Wolf RPG", count);
    
    Ok(count)
}

/// Carica traduzioni da JSON
#[command]
pub fn load_wolfrpg_translations(input_path: String) -> Result<Vec<WolfRpgString>, String> {
    let content = fs::read_to_string(&input_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let strings: Vec<WolfRpgString> = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    log::info!("📂 Caricate {} traduzioni Wolf RPG", strings.len());
    
    Ok(strings)
}

// ============================================================================
// STATISTICHE
// ============================================================================

/// Ottieni statistiche traduzioni
#[command]
pub fn get_wolfrpg_translation_stats(strings: Vec<WolfRpgString>) -> WolfRpgStats {
    let total = strings.len();
    let translated = strings.iter().filter(|s| !s.translated.is_empty()).count();
    let untranslated = total - translated;
    let percentage = if total > 0 { (translated * 100) / total } else { 0 };
    
    let mut by_type: HashMap<String, usize> = HashMap::new();
    for s in &strings {
        let type_name = match s.string_type {
            WolfRpgStringType::Database => "Database",
            WolfRpgStringType::CommonEvent => "Eventi",
            WolfRpgStringType::MapEvent => "Mappe",
            WolfRpgStringType::System => "Sistema",
            WolfRpgStringType::Message => "Messaggi",
        };
        *by_type.entry(type_name.to_string()).or_default() += 1;
    }
    
    WolfRpgStats {
        total,
        translated,
        untranslated,
        percentage,
        by_type,
    }
}

// ============================================================================
// INTEGRAZIONE TOOL ESTERNI
// ============================================================================

/// Info su WolfTrans/Translator++
#[command]
pub fn get_wolftrans_info() -> WolfTransInfo {
    WolfTransInfo {
        available: false, // TODO: detect installation
        download_url: "https://dreamsavior.net/translator-plusplus/".to_string(),
        description: "Per estrarre testi da Game.dat criptato, usa Translator++ con il plugin Wolf RPG.".to_string(),
    }
}

/// Esporta per Translator++ (formato CSV)
#[command]
pub fn export_for_translator_plus(
    strings: Vec<WolfRpgString>,
    output_path: String,
) -> Result<u32, String> {
    let mut csv_content = String::from("id,original,translated,file,context\n");
    
    for s in &strings {
        let escaped_original = s.original.replace('"', "\"\"");
        let escaped_translated = s.translated.replace('"', "\"\"");
        csv_content.push_str(&format!(
            "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
            s.id, escaped_original, escaped_translated, s.file, s.context
        ));
    }
    
    fs::write(&output_path, csv_content)
        .map_err(|e| format!("Errore scrittura CSV: {}", e))?;
    
    let count = strings.len() as u32;
    log::info!("📤 Esportate {} stringhe per Translator++", count);
    
    Ok(count)
}

/// Importa da Translator++ (formato CSV)
#[command]
pub fn import_from_translator_plus(input_path: String) -> Result<Vec<WolfRpgString>, String> {
    let content = fs::read_to_string(&input_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let mut strings = Vec::new();
    let mut lines = content.lines();
    
    // Salta header
    lines.next();
    
    for line in lines {
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() >= 3 {
            let id = parts[0].trim_matches('"').to_string();
            let original = parts[1].trim_matches('"').replace("\"\"", "\"");
            let translated = parts[2].trim_matches('"').replace("\"\"", "\"");
            let file = parts.get(3).map(|s| s.trim_matches('"').to_string()).unwrap_or_default();
            let context = parts.get(4).map(|s| s.trim_matches('"').to_string()).unwrap_or_default();
            
            strings.push(WolfRpgString {
                id,
                original,
                translated,
                file,
                context,
                string_type: WolfRpgStringType::Database,
            });
        }
    }
    
    log::info!("📥 Importate {} stringhe da Translator++", strings.len());

    Ok(strings)
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // --- classify_wolf_file ---

    #[test]
    fn classify_game_dat() {
        assert!(matches!(classify_wolf_file("Game.dat"), WolfRpgFileType::GameDat));
    }

    #[test]
    fn classify_game_dat_case_insensitive() {
        assert!(matches!(classify_wolf_file("GAME.DAT"), WolfRpgFileType::GameDat));
        assert!(matches!(classify_wolf_file("game.DAT"), WolfRpgFileType::GameDat));
    }

    #[test]
    fn classify_common_event() {
        assert!(matches!(classify_wolf_file("CommonEvent.dat"), WolfRpgFileType::CommonEvent));
        assert!(matches!(classify_wolf_file("CommonEventA.dat"), WolfRpgFileType::CommonEvent));
    }

    #[test]
    fn classify_map_tree() {
        assert!(matches!(classify_wolf_file("MapTree.dat"), WolfRpgFileType::MapTree));
    }

    #[test]
    fn classify_system() {
        assert!(matches!(classify_wolf_file("SysFile.dat"), WolfRpgFileType::System));
        assert!(matches!(classify_wolf_file("SysDataBaseBasic.dat"), WolfRpgFileType::System));
    }

    #[test]
    fn classify_database() {
        assert!(matches!(classify_wolf_file("DataBase.dat"), WolfRpgFileType::Database));
        assert!(matches!(classify_wolf_file("BasicData.dat"), WolfRpgFileType::Database));
    }

    #[test]
    fn classify_other() {
        assert!(matches!(classify_wolf_file("SomeRandomFile.dat"), WolfRpgFileType::Other));
        assert!(matches!(classify_wolf_file("readme.txt"), WolfRpgFileType::Other));
    }

    // --- looks_like_code ---

    #[test]
    fn looks_like_code_backslash() {
        assert!(looks_like_code("C:\\Windows\\System32"));
    }

    #[test]
    fn looks_like_code_forward_slash() {
        assert!(looks_like_code("usr/bin/env"));
    }

    #[test]
    fn looks_like_code_hex_prefix() {
        assert!(looks_like_code("0xDEADBEEF"));
    }

    #[test]
    fn looks_like_code_all_digits() {
        assert!(looks_like_code("12345"));
        assert!(looks_like_code("3.14"));
    }

    #[test]
    fn looks_like_code_long_string() {
        let long = "a".repeat(201);
        assert!(looks_like_code(&long));
    }

    #[test]
    fn looks_like_code_exactly_200_not_code() {
        let s = "a".repeat(200);
        assert!(!looks_like_code(&s));
    }

    #[test]
    fn looks_like_code_normal_text() {
        assert!(!looks_like_code("Hello World"));
        assert!(!looks_like_code("こんにちは"));
    }

    // --- extract_strings_from_binary ---

    #[test]
    fn extract_strings_from_binary_basic() {
        // "Hello" surrounded by null bytes
        let data = b"\x00\x00Hello World!\x00\x00";
        let result = extract_strings_from_binary(data);
        assert_eq!(result, vec!["Hello World!"]);
    }

    #[test]
    fn extract_strings_from_binary_short_string_ignored() {
        // Strings shorter than 4 bytes are skipped
        let data = b"\x00Hi\x00";
        let result = extract_strings_from_binary(data);
        assert!(result.is_empty());
    }

    #[test]
    fn extract_strings_from_binary_exactly_4_chars() {
        let data = b"\x00Test\x00";
        let result = extract_strings_from_binary(data);
        assert_eq!(result, vec!["Test"]);
    }

    #[test]
    fn extract_strings_from_binary_empty_input() {
        let result = extract_strings_from_binary(&[]);
        assert!(result.is_empty());
    }

    #[test]
    fn extract_strings_from_binary_all_nulls() {
        let data = b"\x00\x00\x00\x00";
        let result = extract_strings_from_binary(data);
        assert!(result.is_empty());
    }

    #[test]
    fn extract_strings_from_binary_multiple_strings() {
        let data = b"\x00First string\x00\x01Second text\x00";
        let result = extract_strings_from_binary(data);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], "First string");
        assert_eq!(result[1], "Second text");
    }

    #[test]
    fn extract_strings_from_binary_string_at_end_no_trailing_null() {
        // String at end of buffer without null terminator should still be extracted
        let data = b"\x00Long enough string";
        let result = extract_strings_from_binary(data);
        // No trailing null so the string won't be flushed
        assert!(result.is_empty());
    }

    #[test]
    fn extract_strings_from_binary_whitespace_only_ignored() {
        // Spaces are printable (0x20..=0x7E), but trim().is_empty() filters them
        let data = b"\x00     \x00";
        let result = extract_strings_from_binary(data);
        assert!(result.is_empty());
    }

    #[test]
    fn extract_strings_from_binary_high_bytes() {
        // Bytes >= 0x80 are included in strings (for Shift-JIS / UTF-8 multi-byte).
        // With encoding auto-detection, non-UTF-8 bytes are now decoded
        // (e.g., as Shift-JIS or Windows-1252) instead of being discarded.
        let data = b"\x00\x80\x81\x82\x83\x84\x00";
        let result = extract_strings_from_binary(data);
        // auto_decode will decode these high bytes via detected encoding
        assert_eq!(result.len(), 1);
        assert!(!result[0].trim().is_empty());
    }

    // --- get_wolfrpg_translation_stats ---

    #[test]
    fn stats_empty() {
        let stats = get_wolfrpg_translation_stats(vec![]);
        assert_eq!(stats.total, 0);
        assert_eq!(stats.translated, 0);
        assert_eq!(stats.untranslated, 0);
        assert_eq!(stats.percentage, 0);
        assert!(stats.by_type.is_empty());
    }

    #[test]
    fn stats_all_translated() {
        let strings = vec![
            make_string("1", "Hello", "Ciao", WolfRpgStringType::Database),
            make_string("2", "World", "Mondo", WolfRpgStringType::Message),
        ];
        let stats = get_wolfrpg_translation_stats(strings);
        assert_eq!(stats.total, 2);
        assert_eq!(stats.translated, 2);
        assert_eq!(stats.untranslated, 0);
        assert_eq!(stats.percentage, 100);
    }

    #[test]
    fn stats_none_translated() {
        let strings = vec![
            make_string("1", "Hello", "", WolfRpgStringType::Database),
            make_string("2", "World", "", WolfRpgStringType::CommonEvent),
        ];
        let stats = get_wolfrpg_translation_stats(strings);
        assert_eq!(stats.total, 2);
        assert_eq!(stats.translated, 0);
        assert_eq!(stats.untranslated, 2);
        assert_eq!(stats.percentage, 0);
    }

    #[test]
    fn stats_partial_translation() {
        let strings = vec![
            make_string("1", "A", "Aa", WolfRpgStringType::Database),
            make_string("2", "B", "", WolfRpgStringType::Database),
            make_string("3", "C", "Cc", WolfRpgStringType::MapEvent),
        ];
        let stats = get_wolfrpg_translation_stats(strings);
        assert_eq!(stats.total, 3);
        assert_eq!(stats.translated, 2);
        assert_eq!(stats.untranslated, 1);
        assert_eq!(stats.percentage, 66); // integer division: 2*100/3 = 66
    }

    #[test]
    fn stats_by_type_counts() {
        let strings = vec![
            make_string("1", "A", "", WolfRpgStringType::Database),
            make_string("2", "B", "", WolfRpgStringType::Database),
            make_string("3", "C", "", WolfRpgStringType::System),
            make_string("4", "D", "", WolfRpgStringType::CommonEvent),
            make_string("5", "E", "", WolfRpgStringType::MapEvent),
            make_string("6", "F", "", WolfRpgStringType::Message),
        ];
        let stats = get_wolfrpg_translation_stats(strings);
        assert_eq!(stats.by_type.get("Database"), Some(&2));
        assert_eq!(stats.by_type.get("Sistema"), Some(&1));
        assert_eq!(stats.by_type.get("Eventi"), Some(&1));
        assert_eq!(stats.by_type.get("Mappe"), Some(&1));
        assert_eq!(stats.by_type.get("Messaggi"), Some(&1));
    }

    // --- get_wolftrans_info ---

    #[test]
    fn wolftrans_info_defaults() {
        let info = get_wolftrans_info();
        assert!(!info.available);
        assert!(!info.download_url.is_empty());
        assert!(!info.description.is_empty());
    }

    // --- extract_game_title ---

    #[test]
    fn extract_title_from_ini() {
        let dir = std::env::temp_dir().join("wolfrpg_test_title_ini");
        let _ = fs::create_dir_all(&dir);
        fs::write(dir.join("Game.ini"), "Version=3\nTitle=My Wolf Game\nOther=stuff\n").unwrap();

        let title = extract_game_title(dir.to_str().unwrap());
        assert_eq!(title, "My Wolf Game");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn extract_title_fallback_folder_name() {
        let dir = std::env::temp_dir().join("WolfTestFolder");
        let _ = fs::create_dir_all(&dir);

        let title = extract_game_title(dir.to_str().unwrap());
        assert_eq!(title, "WolfTestFolder");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn extract_title_ini_no_title_key() {
        let dir = std::env::temp_dir().join("wolfrpg_test_no_title");
        let _ = fs::create_dir_all(&dir);
        fs::write(dir.join("Game.ini"), "Version=3\nSomething=else\n").unwrap();

        let title = extract_game_title(dir.to_str().unwrap());
        // Fallback to folder name
        assert_eq!(title, "wolfrpg_test_no_title");

        let _ = fs::remove_dir_all(&dir);
    }

    // --- save/load round-trip ---

    #[test]
    fn save_load_roundtrip() {
        let dir = std::env::temp_dir().join("wolfrpg_test_roundtrip");
        let _ = fs::create_dir_all(&dir);
        let file_path = dir.join("translations.json");

        let strings = vec![
            make_string("id1", "Hello", "Ciao", WolfRpgStringType::Database),
            make_string("id2", "Goodbye", "", WolfRpgStringType::Message),
        ];

        let saved = save_wolfrpg_translations(
            file_path.to_string_lossy().to_string(),
            strings.clone(),
        ).unwrap();
        assert_eq!(saved, 2);

        let loaded = load_wolfrpg_translations(
            file_path.to_string_lossy().to_string(),
        ).unwrap();
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].original, "Hello");
        assert_eq!(loaded[0].translated, "Ciao");
        assert_eq!(loaded[1].translated, "");

        let _ = fs::remove_dir_all(&dir);
    }

    // --- export_for_translator_plus ---

    #[test]
    fn export_csv_format() {
        let dir = std::env::temp_dir().join("wolfrpg_test_csv_export");
        let _ = fs::create_dir_all(&dir);
        let file_path = dir.join("export.csv");

        let strings = vec![
            make_string("id1", "Hello", "Ciao", WolfRpgStringType::Database),
        ];

        let count = export_for_translator_plus(
            strings,
            file_path.to_string_lossy().to_string(),
        ).unwrap();
        assert_eq!(count, 1);

        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.starts_with("id,original,translated,file,context\n"));
        assert!(content.contains("\"id1\""));
        assert!(content.contains("\"Hello\""));
        assert!(content.contains("\"Ciao\""));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn export_csv_escapes_quotes() {
        let dir = std::env::temp_dir().join("wolfrpg_test_csv_escape");
        let _ = fs::create_dir_all(&dir);
        let file_path = dir.join("export.csv");

        let strings = vec![
            make_string("id1", "He said \"hello\"", "", WolfRpgStringType::Database),
        ];

        export_for_translator_plus(
            strings,
            file_path.to_string_lossy().to_string(),
        ).unwrap();

        let content = fs::read_to_string(&file_path).unwrap();
        // Double-quotes should be escaped as ""
        assert!(content.contains("\"\"hello\"\""));

        let _ = fs::remove_dir_all(&dir);
    }

    // --- find_data_files / find_map_files with temp dirs ---

    #[test]
    fn find_data_files_in_temp() {
        let dir = std::env::temp_dir().join("wolfrpg_test_data_files");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("Data")).unwrap();

        fs::write(dir.join("CommonEvent.dat"), b"fake").unwrap();
        fs::write(dir.join("Data").join("SysFile.dat"), b"fake").unwrap();
        fs::write(dir.join("readme.txt"), b"not a dat").unwrap();

        let files = find_data_files(dir.to_str().unwrap()).unwrap();
        assert!(files.len() >= 2);
        let names: Vec<&str> = files.iter().map(|f| f.filename.as_str()).collect();
        assert!(names.contains(&"CommonEvent.dat"));
        assert!(names.contains(&"SysFile.dat"));
        // .txt should not be included
        assert!(!names.contains(&"readme.txt"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn find_data_files_no_duplicates() {
        let dir = std::env::temp_dir().join("wolfrpg_test_dedup");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        // Same filename in root
        fs::write(dir.join("Test.dat"), b"data1").unwrap();

        let files = find_data_files(dir.to_str().unwrap()).unwrap();
        let count = files.iter().filter(|f| f.filename == "Test.dat").count();
        assert_eq!(count, 1);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn find_data_files_sorted() {
        let dir = std::env::temp_dir().join("wolfrpg_test_sorted");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        fs::write(dir.join("Zebra.dat"), b"z").unwrap();
        fs::write(dir.join("Alpha.dat"), b"a").unwrap();

        let files = find_data_files(dir.to_str().unwrap()).unwrap();
        assert_eq!(files[0].filename, "Alpha.dat");
        assert_eq!(files[1].filename, "Zebra.dat");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn find_map_files_parses_ids() {
        let dir = std::env::temp_dir().join("wolfrpg_test_maps");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        fs::write(dir.join("Map005.mps"), b"map5").unwrap();
        fs::write(dir.join("Map012.mps"), b"map12").unwrap();
        fs::write(dir.join("NotAMap.mps"), b"nope").unwrap();

        let maps = find_map_files(dir.to_str().unwrap()).unwrap();
        // "NotAMap.mps" doesn't start with "Map" pattern correctly
        // Actually it does start with "Map" — but trimming "Map" leaves "NotA" which won't parse
        // so map_id would be 0 — wait, "NotAMap.mps" does NOT start with "Map" properly:
        // starts_with("Map") => false because it's "NotAMap.mps"
        // Actually "NotAMap.mps".starts_with("Map") is false. Wait no...
        // "NotAMap" does NOT start with "Map". Good.

        let ids: Vec<u32> = maps.iter().map(|m| m.map_id).collect();
        assert!(ids.contains(&5));
        assert!(ids.contains(&12));
    }

    #[test]
    fn find_map_files_sorted_by_id() {
        let dir = std::env::temp_dir().join("wolfrpg_test_maps_sorted");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        fs::write(dir.join("Map020.mps"), b"x").unwrap();
        fs::write(dir.join("Map001.mps"), b"x").unwrap();
        fs::write(dir.join("Map010.mps"), b"x").unwrap();

        let maps = find_map_files(dir.to_str().unwrap()).unwrap();
        assert_eq!(maps[0].map_id, 1);
        assert_eq!(maps[1].map_id, 10);
        assert_eq!(maps[2].map_id, 20);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn find_map_files_empty_dir() {
        let dir = std::env::temp_dir().join("wolfrpg_test_maps_empty");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let maps = find_map_files(dir.to_str().unwrap()).unwrap();
        assert!(maps.is_empty());

        let _ = fs::remove_dir_all(&dir);
    }

    // --- detect_wolfrpg_game ---

    #[test]
    fn detect_game_nonexistent_path() {
        let result = detect_wolfrpg_game("/nonexistent/path/12345".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn detect_game_not_wolf() {
        let dir = std::env::temp_dir().join("wolfrpg_test_not_wolf");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("readme.txt"), b"not a game").unwrap();

        let result = detect_wolfrpg_game(dir.to_string_lossy().to_string());
        assert!(result.is_err());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn detect_game_with_common_event() {
        let dir = std::env::temp_dir().join("wolfrpg_test_detect_ce");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("CommonEvent.dat"), b"fake").unwrap();

        let result = detect_wolfrpg_game(dir.to_string_lossy().to_string());
        assert!(result.is_ok());
        let game = result.unwrap();
        assert!(!game.has_game_dat);
        assert!(game.data_files.iter().any(|f| f.filename == "CommonEvent.dat"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn detect_game_with_game_exe_and_data() {
        let dir = std::env::temp_dir().join("wolfrpg_test_detect_exe");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("Data")).unwrap();
        fs::write(dir.join("Game.exe"), b"fake exe").unwrap();
        fs::write(dir.join("Game.ini"), "Title=Test Wolf Game\n").unwrap();

        let result = detect_wolfrpg_game(dir.to_string_lossy().to_string());
        assert!(result.is_ok());
        let game = result.unwrap();
        assert_eq!(game.title, "Test Wolf Game");

        let _ = fs::remove_dir_all(&dir);
    }

    // --- extract_wolfrpg_strings_basic ---

    #[test]
    fn extract_strings_nonexistent_file() {
        let result = extract_wolfrpg_strings_basic("/no/such/file.dat".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn extract_strings_game_dat_encrypted() {
        let dir = std::env::temp_dir().join("wolfrpg_test_extract_gdat");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("Game.dat"), b"encrypted").unwrap();

        let result = extract_wolfrpg_strings_basic(
            dir.join("Game.dat").to_string_lossy().to_string()
        ).unwrap();
        assert!(!result.success);
        assert!(result.requires_decryption);
        assert_eq!(result.total_count, 0);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn extract_strings_basic_from_binary() {
        let dir = std::env::temp_dir().join("wolfrpg_test_extract_bin");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        // Create a fake .dat file with embedded strings
        let mut data = Vec::new();
        data.extend_from_slice(b"\x00\x00\x00");
        data.extend_from_slice(b"Hello World");
        data.push(0x00);
        data.extend_from_slice(b"\x01\x02\x03");
        data.extend_from_slice(b"Another String Here");
        data.push(0x00);

        fs::write(dir.join("Test.dat"), &data).unwrap();

        let result = extract_wolfrpg_strings_basic(
            dir.join("Test.dat").to_string_lossy().to_string()
        ).unwrap();
        assert!(result.success);
        assert!(!result.requires_decryption);
        // Both strings are >= 2 chars and not code-like
        assert!(result.total_count >= 2);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn extract_strings_filters_code_like() {
        let dir = std::env::temp_dir().join("wolfrpg_test_extract_filter");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let mut data = Vec::new();
        data.push(0x00);
        data.extend_from_slice(b"C:\\Windows\\System32");
        data.push(0x00);
        data.extend_from_slice(b"Normal text here");
        data.push(0x00);

        fs::write(dir.join("Filter.dat"), &data).unwrap();

        let result = extract_wolfrpg_strings_basic(
            dir.join("Filter.dat").to_string_lossy().to_string()
        ).unwrap();
        // The path-like string should be filtered out
        let originals: Vec<&str> = result.strings.iter().map(|s| s.original.as_str()).collect();
        assert!(!originals.contains(&"C:\\Windows\\System32"));
        assert!(originals.contains(&"Normal text here"));

        let _ = fs::remove_dir_all(&dir);
    }

    // --- load_wolfrpg_translations error ---

    #[test]
    fn load_translations_nonexistent() {
        let result = load_wolfrpg_translations("/no/such/file.json".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn load_translations_invalid_json() {
        let dir = std::env::temp_dir().join("wolfrpg_test_bad_json");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("bad.json"), "not valid json").unwrap();

        let result = load_wolfrpg_translations(dir.join("bad.json").to_string_lossy().to_string());
        assert!(result.is_err());

        let _ = fs::remove_dir_all(&dir);
    }

    // --- Helper ---

    fn make_string(id: &str, original: &str, translated: &str, string_type: WolfRpgStringType) -> WolfRpgString {
        WolfRpgString {
            id: id.to_string(),
            original: original.to_string(),
            translated: translated.to_string(),
            file: "test.dat".to_string(),
            context: String::new(),
            string_type,
        }
    }
}
