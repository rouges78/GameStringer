// Wolf RPG Editor Patcher
// Supporto per giochi Wolf RPG Editor (ウディタ)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::command;

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
        if (byte >= 0x20 && byte <= 0x7E) || byte >= 0x80 {
            current.push(byte);
            in_string = true;
        } else if in_string {
            // Fine stringa
            if current.len() >= 4 {
                // Prova UTF-8
                if let Ok(s) = String::from_utf8(current.clone()) {
                    if !s.trim().is_empty() {
                        strings.push(s);
                    }
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
