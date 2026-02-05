// Ren'Py Patcher
// Supporto per giochi visual novel Ren'Py

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::command;
use regex::Regex;

// ============================================================================
// STRUTTURE DATI
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenpyGame {
    pub path: String,
    pub title: String,
    pub version: Option<String>,
    pub script_files: Vec<RenpyScriptFile>,
    pub has_translations: bool,
    pub available_languages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenpyScriptFile {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub string_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenpyString {
    pub id: String,
    pub original: String,
    pub translated: String,
    pub file: String,
    pub line_number: u32,
    pub string_type: RenpyStringType,
    pub character: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RenpyStringType {
    Dialogue,
    Menu,
    Narration,
    String,
    Label,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenpyExtractionResult {
    pub success: bool,
    pub message: String,
    pub strings: Vec<RenpyString>,
    pub total_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenpyStats {
    pub total: usize,
    pub translated: usize,
    pub untranslated: usize,
    pub percentage: usize,
    pub by_type: HashMap<String, usize>,
}

// ============================================================================
// RILEVAMENTO GIOCO
// ============================================================================

/// Rileva se una cartella contiene un gioco Ren'Py
#[command]
pub fn detect_renpy_game(game_path: String) -> Result<RenpyGame, String> {
    let path = Path::new(&game_path);
    
    if !path.exists() {
        return Err("Percorso non esistente".to_string());
    }
    
    // Cerca file caratteristici di Ren'Py
    let game_folder = path.join("game");
    let renpy_folder = path.join("renpy");
    
    if !game_folder.exists() && !renpy_folder.exists() {
        return Err("Non sembra essere un gioco Ren'Py (manca cartella 'game')".to_string());
    }
    
    // Trova script .rpy
    let script_files = find_rpy_files(&game_path)?;
    
    if script_files.is_empty() {
        return Err("Nessun file .rpy trovato".to_string());
    }
    
    // Estrai titolo e versione
    let (title, version) = extract_game_info(&game_path);
    
    // Controlla traduzioni esistenti
    let tl_folder = game_folder.join("tl");
    let has_translations = tl_folder.exists();
    let available_languages = if has_translations {
        get_available_languages(&tl_folder)
    } else {
        Vec::new()
    };
    
    log::info!("🎮 Rilevato Ren'Py: {} ({} script, {} lingue)", 
        title, script_files.len(), available_languages.len());
    
    Ok(RenpyGame {
        path: game_path,
        title,
        version,
        script_files,
        has_translations,
        available_languages,
    })
}

/// Trova tutti i file .rpy nel gioco
fn find_rpy_files(game_path: &str) -> Result<Vec<RenpyScriptFile>, String> {
    let path = Path::new(game_path);
    let game_folder = path.join("game");
    
    let search_folder = if game_folder.exists() {
        game_folder
    } else {
        path.to_path_buf()
    };
    
    let mut files = Vec::new();
    
    for entry in walkdir::WalkDir::new(&search_folder)
        .max_depth(5)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension() {
                if ext.to_string_lossy().to_lowercase() == "rpy" {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    
                    // Ignora file nella cartella tl (traduzioni esistenti)
                    let path_str = entry.path().to_string_lossy().to_string();
                    if !path_str.contains("\\tl\\") && !path_str.contains("/tl/") {
                        files.push(RenpyScriptFile {
                            path: path_str,
                            filename,
                            size,
                            string_count: None,
                        });
                    }
                }
            }
        }
    }
    
    files.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(files)
}

/// Estrai info del gioco da options.rpy
fn extract_game_info(game_path: &str) -> (String, Option<String>) {
    let path = Path::new(game_path);
    let options_path = path.join("game").join("options.rpy");
    
    let mut title = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Ren'Py Game")
        .to_string();
    let mut version = None;
    
    if options_path.exists() {
        if let Ok(content) = fs::read_to_string(&options_path) {
            // Cerca config.name
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("define config.name") {
                    if let Some(name) = extract_string_value(trimmed) {
                        title = name;
                    }
                }
                if trimmed.starts_with("define config.version") {
                    if let Some(ver) = extract_string_value(trimmed) {
                        version = Some(ver);
                    }
                }
            }
        }
    }
    
    (title, version)
}

/// Estrai valore stringa da linea Ren'Py
fn extract_string_value(line: &str) -> Option<String> {
    // Cerca tra virgolette
    if let Some(start) = line.find('"') {
        if let Some(end) = line[start+1..].find('"') {
            return Some(line[start+1..start+1+end].to_string());
        }
    }
    None
}

/// Ottieni lingue disponibili dalla cartella tl
fn get_available_languages(tl_folder: &Path) -> Vec<String> {
    let mut languages = Vec::new();
    
    if let Ok(entries) = fs::read_dir(tl_folder) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                if let Some(name) = entry.file_name().to_str() {
                    // Ignora cartelle speciali
                    if name != "None" && name != "common" {
                        languages.push(name.to_string());
                    }
                }
            }
        }
    }
    
    languages.sort();
    languages
}

// ============================================================================
// ESTRAZIONE STRINGHE
// ============================================================================

/// Estrai stringhe da un file .rpy
#[command]
pub fn extract_renpy_strings(file_path: String) -> Result<RenpyExtractionResult, String> {
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err("File non trovato".to_string());
    }
    
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let mut strings = Vec::new();
    let mut id_counter = 0u32;
    
    // Pattern per dialoghi: character "text" o "text" (narrazione)
    let dialogue_regex = Regex::new(r#"^\s*(\w+)?\s*"([^"]+)"#).unwrap();
    // Pattern per menu
    let menu_regex = Regex::new(r#"^\s*"([^"]+)":\s*$"#).unwrap();
    
    for (line_num, line) in content.lines().enumerate() {
        let trimmed = line.trim();
        
        // Salta commenti e linee vuote
        if trimmed.starts_with('#') || trimmed.is_empty() {
            continue;
        }
        
        // Salta definizioni e codice
        if trimmed.starts_with("define ") || 
           trimmed.starts_with("init ") ||
           trimmed.starts_with("python:") ||
           trimmed.starts_with("$") ||
           trimmed.starts_with("if ") ||
           trimmed.starts_with("elif ") ||
           trimmed.starts_with("else:") ||
           trimmed.starts_with("label ") ||
           trimmed.starts_with("jump ") ||
           trimmed.starts_with("call ") ||
           trimmed.starts_with("return") ||
           trimmed.starts_with("show ") ||
           trimmed.starts_with("hide ") ||
           trimmed.starts_with("scene ") ||
           trimmed.starts_with("play ") ||
           trimmed.starts_with("stop ") ||
           trimmed.starts_with("with ") {
            continue;
        }
        
        // Controlla menu
        if let Some(caps) = menu_regex.captures(trimmed) {
            if let Some(text) = caps.get(1) {
                id_counter += 1;
                strings.push(RenpyString {
                    id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                    original: text.as_str().to_string(),
                    translated: String::new(),
                    file: filename.clone(),
                    line_number: (line_num + 1) as u32,
                    string_type: RenpyStringType::Menu,
                    character: None,
                });
            }
            continue;
        }
        
        // Controlla dialoghi
        if let Some(caps) = dialogue_regex.captures(trimmed) {
            let character = caps.get(1).map(|m| m.as_str().to_string());
            if let Some(text) = caps.get(2) {
                let text_str = text.as_str().to_string();
                
                // Ignora stringhe troppo corte o che sembrano codice
                if text_str.len() > 1 && !text_str.contains("\\") {
                    id_counter += 1;
                    let string_type = if character.is_some() {
                        RenpyStringType::Dialogue
                    } else {
                        RenpyStringType::Narration
                    };
                    
                    strings.push(RenpyString {
                        id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                        original: text_str,
                        translated: String::new(),
                        file: filename.clone(),
                        line_number: (line_num + 1) as u32,
                        string_type,
                        character,
                    });
                }
            }
        }
    }
    
    let total_count = strings.len() as u32;
    
    log::info!("📝 Estratte {} stringhe da {}", total_count, filename);
    
    Ok(RenpyExtractionResult {
        success: true,
        message: format!("Estratte {} stringhe", total_count),
        strings,
        total_count,
    })
}

/// Estrai tutte le stringhe da un gioco Ren'Py
#[command]
pub fn extract_all_renpy_strings(game_path: String) -> Result<RenpyExtractionResult, String> {
    let game = detect_renpy_game(game_path)?;
    
    let mut all_strings = Vec::new();
    
    for script_file in &game.script_files {
        match extract_renpy_strings(script_file.path.clone()) {
            Ok(result) => {
                all_strings.extend(result.strings);
            }
            Err(e) => {
                log::warn!("⚠️ Errore estrazione {}: {}", script_file.filename, e);
            }
        }
    }
    
    let total_count = all_strings.len() as u32;
    
    log::info!("📝 Totale: {} stringhe estratte dal gioco Ren'Py", total_count);
    
    Ok(RenpyExtractionResult {
        success: true,
        message: format!("Estratte {} stringhe totali", total_count),
        strings: all_strings,
        total_count,
    })
}

// ============================================================================
// GENERAZIONE FILE TRADUZIONE
// ============================================================================

/// Genera file di traduzione Ren'Py (.rpy nella cartella tl/)
#[command]
pub fn generate_renpy_translation(
    game_path: String,
    language: String,
    strings: Vec<RenpyString>,
) -> Result<String, String> {
    let path = Path::new(&game_path);
    let tl_folder = path.join("game").join("tl").join(&language);
    
    // Crea cartella traduzione
    fs::create_dir_all(&tl_folder)
        .map_err(|e| format!("Errore creazione cartella: {}", e))?;
    
    // Raggruppa stringhe per file
    let mut by_file: HashMap<String, Vec<&RenpyString>> = HashMap::new();
    for s in &strings {
        by_file.entry(s.file.clone()).or_default().push(s);
    }
    
    let mut generated_files = Vec::new();
    
    for (file, file_strings) in by_file {
        let output_filename = file.replace(".rpy", &format!("_{}.rpy", language));
        let output_path = tl_folder.join(&output_filename);
        
        let mut content = format!("# Translation file for {}\n\n", file);
        content.push_str(&format!("translate {} strings:\n\n", language));
        
        for s in file_strings {
            if !s.translated.is_empty() {
                // Formato Ren'Py translation
                content.push_str(&format!("    # {}:{}\n", s.file, s.line_number));
                content.push_str(&format!("    old \"{}\"\n", escape_renpy_string(&s.original)));
                content.push_str(&format!("    new \"{}\"\n\n", escape_renpy_string(&s.translated)));
            }
        }
        
        fs::write(&output_path, content)
            .map_err(|e| format!("Errore scrittura {}: {}", output_filename, e))?;
        
        generated_files.push(output_filename);
    }
    
    let count = generated_files.len();
    log::info!("✅ Generati {} file di traduzione in game/tl/{}/", count, language);
    
    Ok(format!("Generati {} file in game/tl/{}/", count, language))
}

/// Escape caratteri speciali per stringhe Ren'Py
fn escape_renpy_string(s: &str) -> String {
    s.replace('\\', "\\\\")
     .replace('"', "\\\"")
     .replace('\n', "\\n")
}

// ============================================================================
// SALVATAGGIO/CARICAMENTO
// ============================================================================

/// Salva traduzioni in formato JSON
#[command]
pub fn save_renpy_translations(
    output_path: String,
    strings: Vec<RenpyString>,
) -> Result<u32, String> {
    let json = serde_json::to_string_pretty(&strings)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&output_path, json)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    let count = strings.len() as u32;
    log::info!("💾 Salvate {} traduzioni Ren'Py", count);
    
    Ok(count)
}

/// Carica traduzioni da JSON
#[command]
pub fn load_renpy_translations(input_path: String) -> Result<Vec<RenpyString>, String> {
    let content = fs::read_to_string(&input_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let strings: Vec<RenpyString> = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    log::info!("📂 Caricate {} traduzioni Ren'Py", strings.len());
    
    Ok(strings)
}

// ============================================================================
// STATISTICHE
// ============================================================================

/// Ottieni statistiche traduzioni
#[command]
pub fn get_renpy_translation_stats(strings: Vec<RenpyString>) -> RenpyStats {
    let total = strings.len();
    let translated = strings.iter().filter(|s| !s.translated.is_empty()).count();
    let untranslated = total - translated;
    let percentage = if total > 0 { (translated * 100) / total } else { 0 };
    
    // Conta per tipo
    let mut by_type: HashMap<String, usize> = HashMap::new();
    for s in &strings {
        let type_name = match s.string_type {
            RenpyStringType::Dialogue => "Dialoghi",
            RenpyStringType::Menu => "Menu",
            RenpyStringType::Narration => "Narrazione",
            RenpyStringType::String => "Stringhe",
            RenpyStringType::Label => "Label",
        };
        *by_type.entry(type_name.to_string()).or_default() += 1;
    }
    
    RenpyStats {
        total,
        translated,
        untranslated,
        percentage,
        by_type,
    }
}
