// RPG Maker Patcher
// Supporto per RPG Maker XP, VX, VX Ace, MV, MZ

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;

// ============================================================================
// STRUTTURE DATI
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RpgMakerVersion {
    XP,      // .rxdata (Ruby Marshal)
    VX,      // .rvdata (Ruby Marshal)
    VXAce,   // .rvdata2 (Ruby Marshal)
    MV,      // .json
    MZ,      // .json
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpgMakerGame {
    pub path: String,
    pub version: RpgMakerVersion,
    pub title: String,
    pub data_files: Vec<RpgMakerDataFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpgMakerDataFile {
    pub path: String,
    pub filename: String,
    pub file_type: RpgMakerFileType,
    pub size: u64,
    pub string_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RpgMakerFileType {
    Actors,
    Armors,
    Classes,
    CommonEvents,
    Enemies,
    Items,
    Map,
    Skills,
    States,
    System,
    Troops,
    Weapons,
    Plugins,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpgMakerString {
    pub id: String,
    pub original: String,
    pub translated: String,
    pub context: String,
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionResult {
    pub success: bool,
    pub message: String,
    pub strings: Vec<RpgMakerString>,
    pub total_count: u32,
}

// ============================================================================
// RILEVAMENTO GIOCO
// ============================================================================

/// Rileva se una cartella contiene un gioco RPG Maker
#[command]
pub fn detect_rpgmaker_game(game_path: String) -> Result<RpgMakerGame, String> {
    let path = Path::new(&game_path);
    
    if !path.exists() {
        return Err("Percorso non esistente".to_string());
    }
    
    // Rileva versione
    let version = detect_rpgmaker_version(&game_path);
    
    if matches!(version, RpgMakerVersion::Unknown) {
        return Err("Non sembra essere un gioco RPG Maker".to_string());
    }
    
    // Trova file dati
    let data_files = find_data_files(&game_path, &version)?;
    
    // Estrai titolo
    let title = extract_game_title(&game_path, &version);
    
    log::info!("🎮 Rilevato RPG Maker {:?}: {} ({} file dati)", version, title, data_files.len());
    
    Ok(RpgMakerGame {
        path: game_path,
        version,
        title,
        data_files,
    })
}

/// Rileva la versione di RPG Maker
fn detect_rpgmaker_version(game_path: &str) -> RpgMakerVersion {
    let path = Path::new(game_path);
    
    // MV/MZ: hanno www/data/ con file .json
    let mv_data = path.join("www").join("data");
    let mz_data = path.join("data");
    
    if mv_data.exists() {
        if mv_data.join("System.json").exists() {
            // Controlla se è MZ (ha effetti particolari)
            let plugins = mv_data.join("..").join("js").join("plugins.js");
            if plugins.exists() {
                if let Ok(content) = fs::read_to_string(&plugins) {
                    if content.contains("VisuMZ") || content.contains("MZ") {
                        return RpgMakerVersion::MZ;
                    }
                }
            }
            return RpgMakerVersion::MV;
        }
    }
    
    if mz_data.exists() && mz_data.join("System.json").exists() {
        return RpgMakerVersion::MZ;
    }
    
    // VX Ace: Data/*.rvdata2
    let data_folder = path.join("Data");
    if data_folder.exists() {
        if data_folder.join("System.rvdata2").exists() {
            return RpgMakerVersion::VXAce;
        }
        if data_folder.join("System.rvdata").exists() {
            return RpgMakerVersion::VX;
        }
        if data_folder.join("System.rxdata").exists() {
            return RpgMakerVersion::XP;
        }
    }
    
    RpgMakerVersion::Unknown
}

/// Trova tutti i file dati del gioco
fn find_data_files(game_path: &str, version: &RpgMakerVersion) -> Result<Vec<RpgMakerDataFile>, String> {
    let path = Path::new(game_path);
    let mut files = Vec::new();
    
    let (data_folder, extension) = match version {
        RpgMakerVersion::MV => (path.join("www").join("data"), "json"),
        RpgMakerVersion::MZ => {
            let mz_path = path.join("data");
            if mz_path.exists() {
                (mz_path, "json")
            } else {
                (path.join("www").join("data"), "json")
            }
        }
        RpgMakerVersion::VXAce => (path.join("Data"), "rvdata2"),
        RpgMakerVersion::VX => (path.join("Data"), "rvdata"),
        RpgMakerVersion::XP => (path.join("Data"), "rxdata"),
        RpgMakerVersion::Unknown => return Err("Versione non supportata".to_string()),
    };
    
    if !data_folder.exists() {
        return Err(format!("Cartella dati non trovata: {:?}", data_folder));
    }
    
    for entry in fs::read_dir(&data_folder).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_path = entry.path();
        
        if file_path.is_file() {
            if let Some(ext) = file_path.extension() {
                if ext.to_string_lossy().to_lowercase() == extension {
                    let filename = file_path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();
                    
                    let file_type = classify_rpgmaker_file(&filename);
                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    
                    files.push(RpgMakerDataFile {
                        path: file_path.to_string_lossy().to_string(),
                        filename,
                        file_type,
                        size,
                        string_count: None,
                    });
                }
            }
        }
    }
    
    files.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(files)
}

/// Classifica il tipo di file RPG Maker
fn classify_rpgmaker_file(filename: &str) -> RpgMakerFileType {
    let name_lower = filename.to_lowercase();
    
    if name_lower.contains("actor") { return RpgMakerFileType::Actors; }
    if name_lower.contains("armor") { return RpgMakerFileType::Armors; }
    if name_lower.contains("class") { return RpgMakerFileType::Classes; }
    if name_lower.contains("commonevent") { return RpgMakerFileType::CommonEvents; }
    if name_lower.contains("enem") { return RpgMakerFileType::Enemies; }
    if name_lower.contains("item") { return RpgMakerFileType::Items; }
    if name_lower.starts_with("map") { return RpgMakerFileType::Map; }
    if name_lower.contains("skill") { return RpgMakerFileType::Skills; }
    if name_lower.contains("state") { return RpgMakerFileType::States; }
    if name_lower.contains("system") { return RpgMakerFileType::System; }
    if name_lower.contains("troop") { return RpgMakerFileType::Troops; }
    if name_lower.contains("weapon") { return RpgMakerFileType::Weapons; }
    if name_lower.contains("plugin") { return RpgMakerFileType::Plugins; }
    
    RpgMakerFileType::Other
}

/// Estrai titolo del gioco
fn extract_game_title(game_path: &str, _version: &RpgMakerVersion) -> String {
    let path = Path::new(game_path);
    
    // Prova a leggere da System.json (MV/MZ)
    let system_paths = [
        path.join("www").join("data").join("System.json"),
        path.join("data").join("System.json"),
    ];
    
    for system_path in &system_paths {
        if system_path.exists() {
            if let Ok(content) = fs::read_to_string(system_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(title) = json.get("gameTitle").and_then(|t| t.as_str()) {
                        return title.to_string();
                    }
                }
            }
        }
    }
    
    // Fallback: nome cartella
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("RPG Maker Game")
        .to_string()
}

// ============================================================================
// ESTRAZIONE STRINGHE (MV/MZ - JSON)
// ============================================================================

/// Estrai stringhe da un file JSON di RPG Maker MV/MZ
#[command]
pub fn extract_rpgmaker_strings(file_path: String) -> Result<ExtractionResult, String> {
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err("File non trovato".to_string());
    }
    
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let mut strings = Vec::new();
    let mut id_counter = 0u32;
    
    // Estrai stringhe ricorsivamente
    extract_strings_recursive(&json, &filename, "", &mut strings, &mut id_counter);
    
    let total_count = strings.len() as u32;
    
    log::info!("📝 Estratte {} stringhe da {}", total_count, filename);
    
    Ok(ExtractionResult {
        success: true,
        message: format!("Estratte {} stringhe", total_count),
        strings,
        total_count,
    })
}

/// Estrai stringhe ricorsivamente da JSON
fn extract_strings_recursive(
    value: &serde_json::Value,
    file: &str,
    path: &str,
    strings: &mut Vec<RpgMakerString>,
    counter: &mut u32,
) {
    match value {
        serde_json::Value::String(s) => {
            // Filtra stringhe vuote e troppo corte
            let trimmed = s.trim();
            if !trimmed.is_empty() && trimmed.len() > 1 {
                // Ignora stringhe che sembrano essere path o codice
                if !trimmed.starts_with("img/") 
                    && !trimmed.starts_with("audio/")
                    && !trimmed.contains(".png")
                    && !trimmed.contains(".ogg")
                    && !trimmed.starts_with("$")
                    && !trimmed.starts_with("\\")
                {
                    *counter += 1;
                    strings.push(RpgMakerString {
                        id: format!("{}_{}", file.replace('.', "_"), counter),
                        original: s.clone(),
                        translated: String::new(),
                        context: path.to_string(),
                        file: file.to_string(),
                    });
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for (i, item) in arr.iter().enumerate() {
                let new_path = format!("{}[{}]", path, i);
                extract_strings_recursive(item, file, &new_path, strings, counter);
            }
        }
        serde_json::Value::Object(obj) => {
            for (key, val) in obj {
                // Focus su campi che contengono testo traducibile
                if is_translatable_field(key) {
                    let new_path = if path.is_empty() {
                        key.clone()
                    } else {
                        format!("{}.{}", path, key)
                    };
                    extract_strings_recursive(val, file, &new_path, strings, counter);
                }
            }
        }
        _ => {}
    }
}

/// Determina se un campo JSON contiene testo traducibile
fn is_translatable_field(field: &str) -> bool {
    let translatable_fields = [
        "name", "nickname", "description", "message1", "message2", 
        "message3", "message4", "note", "profile", "text",
        "title", "terms", "messages", "parameters", "list",
        "pages", "code", "gameTitle", "currencyUnit",
    ];
    
    translatable_fields.iter().any(|f| field.to_lowercase().contains(&f.to_lowercase()))
}

/// Estrai tutte le stringhe da un gioco RPG Maker
#[command]
pub fn extract_all_rpgmaker_strings(game_path: String) -> Result<ExtractionResult, String> {
    let game = detect_rpgmaker_game(game_path)?;
    
    let mut all_strings = Vec::new();
    
    for data_file in &game.data_files {
        // Solo file JSON per MV/MZ
        if data_file.path.ends_with(".json") {
            match extract_rpgmaker_strings(data_file.path.clone()) {
                Ok(result) => {
                    all_strings.extend(result.strings);
                }
                Err(e) => {
                    log::warn!("⚠️ Errore estrazione {}: {}", data_file.filename, e);
                }
            }
        }
    }
    
    let total_count = all_strings.len() as u32;
    
    log::info!("📝 Totale: {} stringhe estratte dal gioco", total_count);
    
    Ok(ExtractionResult {
        success: true,
        message: format!("Estratte {} stringhe totali", total_count),
        strings: all_strings,
        total_count,
    })
}

// ============================================================================
// SALVATAGGIO/CARICAMENTO TRADUZIONI
// ============================================================================

/// Salva le traduzioni in un file JSON
#[command]
pub fn save_rpgmaker_translations(
    output_path: String,
    strings: Vec<RpgMakerString>,
) -> Result<u32, String> {
    let json = serde_json::to_string_pretty(&strings)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&output_path, json)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    let count = strings.len() as u32;
    log::info!("💾 Salvate {} traduzioni in {}", count, output_path);
    
    Ok(count)
}

/// Carica traduzioni da file JSON
#[command]
pub fn load_rpgmaker_translations(input_path: String) -> Result<Vec<RpgMakerString>, String> {
    let content = fs::read_to_string(&input_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let strings: Vec<RpgMakerString> = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    log::info!("📂 Caricate {} traduzioni da {}", strings.len(), input_path);
    
    Ok(strings)
}

/// Applica traduzioni a un file JSON di RPG Maker
#[command]
pub fn apply_rpgmaker_translations(
    file_path: String,
    translations: HashMap<String, String>,
    output_path: String,
) -> Result<u32, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    let mut applied = 0u32;
    apply_translations_recursive(&mut json, &translations, &mut applied);
    
    let output = serde_json::to_string_pretty(&json)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&output_path, output)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    log::info!("✅ Applicate {} traduzioni a {}", applied, output_path);
    
    Ok(applied)
}

/// Applica traduzioni ricorsivamente
fn apply_translations_recursive(
    value: &mut serde_json::Value,
    translations: &HashMap<String, String>,
    applied: &mut u32,
) {
    match value {
        serde_json::Value::String(s) => {
            if let Some(translated) = translations.get(s.as_str()) {
                if !translated.is_empty() {
                    *s = translated.clone();
                    *applied += 1;
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                apply_translations_recursive(item, translations, applied);
            }
        }
        serde_json::Value::Object(obj) => {
            for (_, val) in obj {
                apply_translations_recursive(val, translations, applied);
            }
        }
        _ => {}
    }
}

// ============================================================================
// STATISTICHE
// ============================================================================

/// Ottieni statistiche sulle traduzioni
#[command]
pub fn get_rpgmaker_translation_stats(strings: Vec<RpgMakerString>) -> RpgMakerStats {
    let total = strings.len();
    let translated = strings.iter().filter(|s| !s.translated.is_empty()).count();
    let untranslated = total - translated;
    let percentage = if total > 0 { (translated * 100) / total } else { 0 };
    
    // Conta per file
    let mut by_file: HashMap<String, (usize, usize)> = HashMap::new();
    for s in &strings {
        let entry = by_file.entry(s.file.clone()).or_insert((0, 0));
        entry.0 += 1;
        if !s.translated.is_empty() {
            entry.1 += 1;
        }
    }
    
    RpgMakerStats {
        total,
        translated,
        untranslated,
        percentage,
        by_file: by_file.into_iter()
            .map(|(file, (total, translated))| FileStats { file, total, translated })
            .collect(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpgMakerStats {
    pub total: usize,
    pub translated: usize,
    pub untranslated: usize,
    pub percentage: usize,
    pub by_file: Vec<FileStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStats {
    pub file: String,
    pub total: usize,
    pub translated: usize,
}

// ============================================================================
// INTEGRAZIONE TRANSLATOR++
// ============================================================================

/// Verifica se Translator++ è installato
#[command]
pub fn is_translator_plus_available() -> bool {
    let possible_paths = [
        PathBuf::from(r"C:\Program Files\Translator++\Translator++.exe"),
        PathBuf::from(r"C:\Program Files (x86)\Translator++\Translator++.exe"),
        dirs::data_local_dir()
            .map(|p| p.join("Programs").join("Translator++").join("Translator++.exe"))
            .unwrap_or_default(),
    ];
    
    possible_paths.iter().any(|p| p.exists())
}

/// Info su Translator++
#[command]
pub fn get_translator_plus_info() -> TranslatorPlusInfo {
    TranslatorPlusInfo {
        available: is_translator_plus_available(),
        download_url: "https://dreamsavior.net/translator-plusplus/".to_string(),
        description: "Tool avanzato per tradurre giochi RPG Maker, Wolf RPG, ecc.".to_string(),
        supported_engines: vec![
            "RPG Maker XP".to_string(),
            "RPG Maker VX".to_string(),
            "RPG Maker VX Ace".to_string(),
            "RPG Maker MV".to_string(),
            "RPG Maker MZ".to_string(),
            "Wolf RPG Editor".to_string(),
        ],
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslatorPlusInfo {
    pub available: bool,
    pub download_url: String,
    pub description: String,
    pub supported_engines: Vec<String>,
}
