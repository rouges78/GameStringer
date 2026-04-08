// Ren'Py Patcher
// Supporto per giochi visual novel Ren'Py

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
    
    let raw_bytes = fs::read(&file_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    let (content, _enc) = encoding_utils::auto_decode(&raw_bytes);

    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let mut strings = Vec::new();
    let mut id_counter = 0u32;

    // ── AST-lite state-machine parser ──────────────────────────────────
    #[derive(Debug, Clone, Copy, PartialEq)]
    #[allow(dead_code)]
    enum BlockKind { Normal, Python, Screen, Menu, Translate }

    /// Track block context by indentation level
    struct BlockCtx {
        indent: usize,
        kind: BlockKind,
    }

    let mut block_stack: Vec<BlockCtx> = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    let mut line_idx = 0;

    // Screen-text keywords whose first quoted argument is user-visible text
    let screen_text_kw: &[&str] = &["text ", "textbutton ", "label ", "vbox:", "hbox:"];

    while line_idx < lines.len() {
        let line = lines[line_idx];
        let trimmed = line.trim();

        // Measure indentation (spaces; treat tab as 4 spaces)
        let indent: usize = line.chars().take_while(|c| c.is_whitespace())
            .map(|c| if c == '\t' { 4 } else { 1 }).sum();

        // Pop blocks that we have un-indented out of
        while let Some(top) = block_stack.last() {
            if indent <= top.indent { block_stack.pop(); } else { break; }
        }

        let in_python = block_stack.iter().any(|b| b.kind == BlockKind::Python);

        // Skip comments and blank lines
        if trimmed.starts_with('#') || trimmed.is_empty() {
            line_idx += 1;
            continue;
        }

        // Skip if we are inside a python block
        if in_python {
            line_idx += 1;
            continue;
        }

        // ── Detect new blocks ──────────────────────────────────────────
        if trimmed.starts_with("python:") || trimmed.starts_with("init python:") || trimmed.starts_with("init ") && trimmed.contains("python:") {
            block_stack.push(BlockCtx { indent, kind: BlockKind::Python });
            line_idx += 1;
            continue;
        }
        if trimmed.starts_with("screen ") {
            block_stack.push(BlockCtx { indent, kind: BlockKind::Screen });
            line_idx += 1;
            continue;
        }
        if trimmed == "menu:" || trimmed.starts_with("menu ") {
            block_stack.push(BlockCtx { indent, kind: BlockKind::Menu });
            line_idx += 1;
            continue;
        }
        if trimmed.starts_with("translate ") {
            block_stack.push(BlockCtx { indent, kind: BlockKind::Translate });
            line_idx += 1;
            continue;
        }

        // ── Skip keywords that are not extractable ─────────────────────
        let skip_keywords: &[&str] = &[
            "define ", "init ", "$", "if ", "elif ", "else:", "label ",
            "jump ", "call ", "return", "show ", "hide ", "scene ",
            "play ", "stop ", "with ", "transform ", "style ",
            "image ", "default ", "pause", "window ", "pass",
        ];
        let is_skip_keyword = skip_keywords.iter().any(|kw| trimmed.starts_with(kw));
        // Don't skip if we are inside a screen/translate block and the
        // line contains a quoted string we should extract
        let in_screen = block_stack.iter().any(|b| b.kind == BlockKind::Screen);
        let in_translate = block_stack.iter().any(|b| b.kind == BlockKind::Translate);

        if is_skip_keyword && !in_screen && !in_translate {
            line_idx += 1;
            continue;
        }

        // ── Screen text: text "...", textbutton "...", action Notify("...") ─
        if in_screen {
            // Extract all quoted strings from screen-text keywords
            let is_screen_text = screen_text_kw.iter().any(|kw| trimmed.starts_with(kw));
            let has_notify = trimmed.contains("Notify(\"") || trimmed.contains("Notify('");

            if is_screen_text || has_notify {
                for extracted in extract_quoted_strings(trimmed) {
                    if extracted.len() > 1 {
                        id_counter += 1;
                        strings.push(RenpyString {
                            id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                            original: extracted,
                            translated: String::new(),
                            file: filename.clone(),
                            line_number: (line_idx + 1) as u32,
                            string_type: RenpyStringType::String,
                            character: None,
                        });
                    }
                }
                line_idx += 1;
                continue;
            }
            // Other screen lines (action, style, etc.) -- skip
            line_idx += 1;
            continue;
        }

        // ── Triple-quoted strings """...""" ─────────────────────────────
        if trimmed.contains("\"\"\"") {
            let (text, consumed) = parse_triple_quoted(trimmed, &lines, line_idx);
            if let Some(text) = text {
                if text.len() > 1 {
                    // Detect character prefix before the triple quote
                    let before_quote = trimmed.split("\"\"\"").next().unwrap_or("").trim();
                    let character = if !before_quote.is_empty() && before_quote.chars().all(|c| c.is_alphanumeric() || c == '_') {
                        Some(before_quote.to_string())
                    } else {
                        None
                    };

                    id_counter += 1;
                    let string_type = if character.is_some() {
                        RenpyStringType::Dialogue
                    } else {
                        RenpyStringType::Narration
                    };
                    strings.push(RenpyString {
                        id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                        original: text,
                        translated: String::new(),
                        file: filename.clone(),
                        line_number: (line_idx + 1) as u32,
                        string_type,
                        character,
                    });
                }
            }
            line_idx += consumed;
            continue;
        }

        // ── Menu choices: "text": ──────────────────────────────────────
        if trimmed.ends_with("\":") || trimmed.ends_with("\": ") {
            if let Some(text) = extract_first_quoted(trimmed) {
                if text.len() > 1 {
                    id_counter += 1;
                    strings.push(RenpyString {
                        id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                        original: text,
                        translated: String::new(),
                        file: filename.clone(),
                        line_number: (line_idx + 1) as u32,
                        string_type: RenpyStringType::Menu,
                        character: None,
                    });
                }
            }
            line_idx += 1;
            continue;
        }

        // ── Dialogue / Narration / Translate text ──────────────────────
        if let Some(first_q) = trimmed.find('"') {
            // Everything before the first quote is the potential character name
            let before = trimmed[..first_q].trim();
            // Extract the quoted string (handling escaped quotes)
            if let Some(text) = extract_first_quoted(trimmed) {
                if text.len() > 1 {
                    let character = if !before.is_empty()
                        && before.chars().all(|c| c.is_alphanumeric() || c == '_')
                        && !is_skip_keyword
                    {
                        Some(before.to_string())
                    } else {
                        None
                    };

                    let string_type = if in_translate {
                        RenpyStringType::Narration
                    } else if character.is_some() {
                        RenpyStringType::Dialogue
                    } else {
                        RenpyStringType::Narration
                    };

                    id_counter += 1;
                    strings.push(RenpyString {
                        id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                        original: text,
                        translated: String::new(),
                        file: filename.clone(),
                        line_number: (line_idx + 1) as u32,
                        string_type,
                        character,
                    });
                }
            }
        }

        line_idx += 1;
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

/// Extract the first double-quoted string from a line, handling escaped quotes.
fn extract_first_quoted(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let mut i = 0;
    // Find opening quote
    while i < bytes.len() {
        if bytes[i] == b'"' { break; }
        i += 1;
    }
    if i >= bytes.len() { return None; }
    i += 1; // skip opening quote
    let mut result = String::new();
    while i < bytes.len() {
        if bytes[i] == b'\\' && i + 1 < bytes.len() {
            // Keep escape sequences as-is in the extracted string
            result.push('\\');
            result.push(bytes[i + 1] as char);
            i += 2;
        } else if bytes[i] == b'"' {
            return if result.is_empty() { None } else { Some(result) };
        } else {
            result.push(bytes[i] as char);
            i += 1;
        }
    }
    None // unterminated string
}

/// Extract all double-quoted strings from a line.
fn extract_quoted_strings(s: &str) -> Vec<String> {
    let mut results = Vec::new();
    let mut remaining = s;
    while let Some(pos) = remaining.find('"') {
        if let Some(text) = extract_first_quoted(&remaining[pos..]) {
            results.push(text.clone());
            // Advance past the closing quote
            let skip = text.len() + 2; // opening quote + content + closing quote (approximate)
            if pos + 1 + skip <= remaining.len() {
                remaining = &remaining[pos + 1 + skip..];
            } else {
                break;
            }
        } else {
            break;
        }
    }
    results
}

/// Parse a triple-quoted string ("""..."""), potentially spanning multiple lines.
/// Returns (Some(text), lines_consumed) or (None, 1) on failure.
fn parse_triple_quoted(first_trimmed: &str, lines: &[&str], start_idx: usize) -> (Option<String>, usize) {
    // Find the opening """
    let open_pos = match first_trimmed.find("\"\"\"") {
        Some(p) => p,
        None => return (None, 1),
    };
    let after_open = &first_trimmed[open_pos + 3..];

    // Check if closing """ is on the same line
    if let Some(close_pos) = after_open.find("\"\"\"") {
        let text = after_open[..close_pos].to_string();
        return (Some(text), 1);
    }

    // Multi-line: collect until we find closing """
    let mut parts = vec![after_open.to_string()];
    let mut idx = start_idx + 1;
    while idx < lines.len() {
        let line = lines[idx];
        if let Some(close_pos) = line.find("\"\"\"") {
            let before_close = line[..close_pos].to_string();
            // Trim the indentation from intermediate lines but keep the text
            parts.push(before_close.trim().to_string());
            let text = parts.join("\n");
            return (Some(text.trim().to_string()), idx - start_idx + 1);
        }
        parts.push(line.trim().to_string());
        idx += 1;
    }
    (None, 1) // unterminated
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

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // ── extract_string_value ────────────────────────────────────────────

    #[test]
    fn test_extract_string_value_basic() {
        let line = r#"define config.name = "My Game""#;
        assert_eq!(extract_string_value(line), Some("My Game".to_string()));
    }

    #[test]
    fn test_extract_string_value_with_spaces() {
        let line = r#"define config.version = "1.2.3""#;
        assert_eq!(extract_string_value(line), Some("1.2.3".to_string()));
    }

    #[test]
    fn test_extract_string_value_no_quotes() {
        let line = "define config.name = MyGame";
        assert_eq!(extract_string_value(line), None);
    }

    #[test]
    fn test_extract_string_value_single_quote_only() {
        let line = "define config.name = 'MyGame'";
        assert_eq!(extract_string_value(line), None);
    }

    #[test]
    fn test_extract_string_value_empty_string() {
        let line = r#"define config.name = """#;
        assert_eq!(extract_string_value(line), Some("".to_string()));
    }

    #[test]
    fn test_extract_string_value_empty_input() {
        assert_eq!(extract_string_value(""), None);
    }

    #[test]
    fn test_extract_string_value_one_quote_only() {
        let line = r#"broken "unterminated"#;
        assert_eq!(extract_string_value(line), None);
    }

    // ── escape_renpy_string ─────────────────────────────────────────────

    #[test]
    fn test_escape_renpy_string_no_special_chars() {
        assert_eq!(escape_renpy_string("Hello world"), "Hello world");
    }

    #[test]
    fn test_escape_renpy_string_backslash() {
        assert_eq!(escape_renpy_string(r"path\to\file"), r"path\\to\\file");
    }

    #[test]
    fn test_escape_renpy_string_double_quote() {
        assert_eq!(escape_renpy_string(r#"She said "hi""#), r#"She said \"hi\""#);
    }

    #[test]
    fn test_escape_renpy_string_newline() {
        assert_eq!(escape_renpy_string("line1\nline2"), r"line1\nline2");
    }

    #[test]
    fn test_escape_renpy_string_all_special() {
        assert_eq!(
            escape_renpy_string("a\\b\"c\nd"),
            r#"a\\b\"c\nd"#
        );
    }

    #[test]
    fn test_escape_renpy_string_empty() {
        assert_eq!(escape_renpy_string(""), "");
    }

    // ── get_renpy_translation_stats ─────────────────────────────────────

    fn make_string(original: &str, translated: &str, stype: RenpyStringType) -> RenpyString {
        RenpyString {
            id: "test_1".to_string(),
            original: original.to_string(),
            translated: translated.to_string(),
            file: "test.rpy".to_string(),
            line_number: 1,
            string_type: stype,
            character: None,
        }
    }

    #[test]
    fn test_stats_empty() {
        let stats = get_renpy_translation_stats(Vec::new());
        assert_eq!(stats.total, 0);
        assert_eq!(stats.translated, 0);
        assert_eq!(stats.untranslated, 0);
        assert_eq!(stats.percentage, 0);
        assert!(stats.by_type.is_empty());
    }

    #[test]
    fn test_stats_all_translated() {
        let strings = vec![
            make_string("Hello", "Ciao", RenpyStringType::Dialogue),
            make_string("World", "Mondo", RenpyStringType::Narration),
        ];
        let stats = get_renpy_translation_stats(strings);
        assert_eq!(stats.total, 2);
        assert_eq!(stats.translated, 2);
        assert_eq!(stats.untranslated, 0);
        assert_eq!(stats.percentage, 100);
    }

    #[test]
    fn test_stats_none_translated() {
        let strings = vec![
            make_string("Hello", "", RenpyStringType::Dialogue),
            make_string("World", "", RenpyStringType::Menu),
        ];
        let stats = get_renpy_translation_stats(strings);
        assert_eq!(stats.total, 2);
        assert_eq!(stats.translated, 0);
        assert_eq!(stats.untranslated, 2);
        assert_eq!(stats.percentage, 0);
    }

    #[test]
    fn test_stats_partial_translated() {
        let strings = vec![
            make_string("Hello", "Ciao", RenpyStringType::Dialogue),
            make_string("World", "", RenpyStringType::Narration),
            make_string("Yes", "Si", RenpyStringType::Menu),
        ];
        let stats = get_renpy_translation_stats(strings);
        assert_eq!(stats.total, 3);
        assert_eq!(stats.translated, 2);
        assert_eq!(stats.untranslated, 1);
        assert_eq!(stats.percentage, 66); // integer division: 2*100/3 = 66
    }

    #[test]
    fn test_stats_by_type_counts() {
        let strings = vec![
            make_string("a", "", RenpyStringType::Dialogue),
            make_string("b", "", RenpyStringType::Dialogue),
            make_string("c", "", RenpyStringType::Menu),
            make_string("d", "", RenpyStringType::Narration),
            make_string("e", "", RenpyStringType::String),
            make_string("f", "", RenpyStringType::Label),
        ];
        let stats = get_renpy_translation_stats(strings);
        assert_eq!(stats.by_type.get("Dialoghi"), Some(&2));
        assert_eq!(stats.by_type.get("Menu"), Some(&1));
        assert_eq!(stats.by_type.get("Narrazione"), Some(&1));
        assert_eq!(stats.by_type.get("Stringhe"), Some(&1));
        assert_eq!(stats.by_type.get("Label"), Some(&1));
    }

    // ── extract_renpy_strings (file-based) ──────────────────────────────

    fn write_rpy_and_extract(content: &str) -> RenpyExtractionResult {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("test.rpy");
        fs::write(&file_path, content).unwrap();
        extract_renpy_strings(file_path.to_string_lossy().to_string()).unwrap()
    }

    #[test]
    fn test_extract_dialogue_with_character() {
        let result = write_rpy_and_extract(r#"    e "Hello, world!""#);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Hello, world!");
        assert_eq!(result.strings[0].character, Some("e".to_string()));
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Dialogue));
    }

    #[test]
    fn test_extract_narration() {
        let result = write_rpy_and_extract(r#"    "This is narration.""#);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "This is narration.");
        assert_eq!(result.strings[0].character, None);
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Narration));
    }

    #[test]
    fn test_extract_menu_choice() {
        let result = write_rpy_and_extract(r#"        "Go to the park":"#);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Go to the park");
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Menu));
    }

    #[test]
    fn test_extract_skips_comments() {
        let result = write_rpy_and_extract("# This is a comment\n    e \"Hello\"");
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Hello");
    }

    #[test]
    fn test_extract_skips_empty_lines() {
        let result = write_rpy_and_extract("\n\n    e \"Hello\"\n\n");
        assert_eq!(result.total_count, 1);
    }

    #[test]
    fn test_extract_skips_define() {
        let result = write_rpy_and_extract("define e = Character(\"Eileen\")");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_label() {
        let result = write_rpy_and_extract("label start:");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_jump() {
        let result = write_rpy_and_extract("jump chapter2");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_call() {
        let result = write_rpy_and_extract("call some_function");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_show_hide_scene() {
        let content = "show eileen happy\nhide eileen\nscene bg room";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_play_stop() {
        let content = "play music \"track.ogg\"\nstop music";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_control_flow() {
        let content = "if flag:\n    e \"Hello\"\nelif other:\n    e \"World\"\nelse:\n    e \"Bye\"";
        let result = write_rpy_and_extract(content);
        // "if ", "elif ", "else:" lines are skipped; the dialogue lines under them are extracted
        assert_eq!(result.total_count, 3);
    }

    #[test]
    fn test_extract_skips_python_and_dollar() {
        let content = "python:\n$ some_var = 1";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_init_with_return() {
        let content = "init python:\nreturn";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_with() {
        let result = write_rpy_and_extract("with dissolve");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_short_strings() {
        // Strings of length 1 are ignored
        let result = write_rpy_and_extract(r#"    e "X""#);
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_keeps_strings_with_backslash() {
        // Strings with escape sequences should NOT be filtered out
        let result = write_rpy_and_extract(r#"    e "Hello\nWorld""#);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, r"Hello\nWorld");
    }

    #[test]
    fn test_extract_empty_file() {
        let result = write_rpy_and_extract("");
        assert_eq!(result.total_count, 0);
        assert!(result.strings.is_empty());
        assert!(result.success);
    }

    #[test]
    fn test_extract_multiple_dialogues() {
        let content = r#"    e "Hello!"
    e "How are you?"
    "This is narration."
    "Choose yes":
    "#;
        let result = write_rpy_and_extract(content);
        // 2 dialogues + 1 narration + 1 menu = 4
        assert_eq!(result.total_count, 4);
    }

    #[test]
    fn test_extract_line_numbers_are_1_based() {
        let content = "# comment\n\n    e \"Hello\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.strings[0].line_number, 3);
    }

    #[test]
    fn test_extract_ids_are_unique() {
        let content = "    e \"Hello\"\n    e \"World\"";
        let result = write_rpy_and_extract(content);
        assert_ne!(result.strings[0].id, result.strings[1].id);
    }

    #[test]
    fn test_extract_ids_use_filename() {
        let result = write_rpy_and_extract(r#"    e "Hello!""#);
        assert!(result.strings[0].id.starts_with("test_rpy_"));
    }

    #[test]
    fn test_extract_nonexistent_file() {
        let result = extract_renpy_strings("/nonexistent/path/to/file.rpy".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_success_flag() {
        let result = write_rpy_and_extract(r#"    e "Hi there""#);
        assert!(result.success);
    }

    #[test]
    fn test_extract_message_contains_count() {
        let result = write_rpy_and_extract(r#"    e "Hi there""#);
        assert!(result.message.contains("1"));
    }

    // ── detect_renpy_game ───────────────────────────────────────────────

    #[test]
    fn test_detect_nonexistent_path() {
        let result = detect_renpy_game("/nonexistent/path".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("non esistente"));
    }

    #[test]
    fn test_detect_no_game_folder() {
        let dir = TempDir::new().unwrap();
        let result = detect_renpy_game(dir.path().to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Ren'Py"));
    }

    #[test]
    fn test_detect_game_folder_but_no_rpy() {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("game")).unwrap();
        let result = detect_renpy_game(dir.path().to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains(".rpy"));
    }

    #[test]
    fn test_detect_valid_game() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();
        fs::write(game_dir.join("script.rpy"), r#"    e "Hello""#).unwrap();

        let result = detect_renpy_game(dir.path().to_string_lossy().to_string());
        assert!(result.is_ok());
        let game = result.unwrap();
        assert_eq!(game.script_files.len(), 1);
        assert_eq!(game.script_files[0].filename, "script.rpy");
        assert!(!game.has_translations);
        assert!(game.available_languages.is_empty());
    }

    #[test]
    fn test_detect_game_with_options() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();
        fs::write(game_dir.join("script.rpy"), r#"    e "Hello""#).unwrap();
        fs::write(
            game_dir.join("options.rpy"),
            "define config.name = \"Test Game\"\ndefine config.version = \"2.0\"",
        ).unwrap();

        let game = detect_renpy_game(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(game.title, "Test Game");
        assert_eq!(game.version, Some("2.0".to_string()));
    }

    #[test]
    fn test_detect_game_with_translations() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        let tl_dir = game_dir.join("tl");
        fs::create_dir_all(tl_dir.join("italian")).unwrap();
        fs::create_dir_all(tl_dir.join("french")).unwrap();
        fs::create_dir_all(tl_dir.join("None")).unwrap(); // should be ignored
        fs::create_dir_all(tl_dir.join("common")).unwrap(); // should be ignored
        fs::write(game_dir.join("script.rpy"), r#"    e "Hello""#).unwrap();

        let game = detect_renpy_game(dir.path().to_string_lossy().to_string()).unwrap();
        assert!(game.has_translations);
        assert_eq!(game.available_languages.len(), 2);
        assert!(game.available_languages.contains(&"italian".to_string()));
        assert!(game.available_languages.contains(&"french".to_string()));
    }

    #[test]
    fn test_detect_game_ignores_tl_rpy_files() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        let tl_dir = game_dir.join("tl").join("italian");
        fs::create_dir_all(&tl_dir).unwrap();
        fs::write(game_dir.join("script.rpy"), r#"    e "Hello""#).unwrap();
        fs::write(tl_dir.join("script_italian.rpy"), r#"old "Hello""#).unwrap();

        let game = detect_renpy_game(dir.path().to_string_lossy().to_string()).unwrap();
        // Only the main script, not the translation file
        assert_eq!(game.script_files.len(), 1);
        assert_eq!(game.script_files[0].filename, "script.rpy");
    }

    #[test]
    fn test_detect_game_with_renpy_folder() {
        // Some games have a "renpy" folder instead/alongside "game"
        let dir = TempDir::new().unwrap();
        let renpy_dir = dir.path().join("renpy");
        fs::create_dir_all(&renpy_dir).unwrap();
        // No game folder, but renpy folder exists - detection should pass the folder check
        // but fail on no .rpy files since find_rpy_files falls back to root
        // Actually it searches in root when no game folder
        fs::write(dir.path().join("script.rpy"), r#"    e "Hello""#).unwrap();

        let game = detect_renpy_game(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(game.script_files.len(), 1);
    }

    // ── find_rpy_files ──────────────────────────────────────────────────

    #[test]
    fn test_find_rpy_files_sorted() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();
        fs::write(game_dir.join("z_script.rpy"), "").unwrap();
        fs::write(game_dir.join("a_script.rpy"), "").unwrap();
        fs::write(game_dir.join("m_script.rpy"), "").unwrap();

        let files = find_rpy_files(&dir.path().to_string_lossy()).unwrap();
        let names: Vec<&str> = files.iter().map(|f| f.filename.as_str()).collect();
        assert_eq!(names, vec!["a_script.rpy", "m_script.rpy", "z_script.rpy"]);
    }

    #[test]
    fn test_find_rpy_files_ignores_non_rpy() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();
        fs::write(game_dir.join("script.rpy"), "").unwrap();
        fs::write(game_dir.join("script.rpyc"), "").unwrap();
        fs::write(game_dir.join("readme.txt"), "").unwrap();

        let files = find_rpy_files(&dir.path().to_string_lossy()).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].filename, "script.rpy");
    }

    // ── save/load round-trip ────────────────────────────────────────────

    #[test]
    fn test_save_and_load_round_trip() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("translations.json");

        let strings = vec![
            make_string("Hello", "Ciao", RenpyStringType::Dialogue),
            make_string("World", "Mondo", RenpyStringType::Narration),
        ];

        let count = save_renpy_translations(
            file_path.to_string_lossy().to_string(),
            strings.clone(),
        ).unwrap();
        assert_eq!(count, 2);

        let loaded = load_renpy_translations(file_path.to_string_lossy().to_string()).unwrap();
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].original, "Hello");
        assert_eq!(loaded[0].translated, "Ciao");
        assert_eq!(loaded[1].original, "World");
        assert_eq!(loaded[1].translated, "Mondo");
    }

    #[test]
    fn test_save_empty_translations() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("empty.json");

        let count = save_renpy_translations(
            file_path.to_string_lossy().to_string(),
            Vec::new(),
        ).unwrap();
        assert_eq!(count, 0);

        let loaded = load_renpy_translations(file_path.to_string_lossy().to_string()).unwrap();
        assert!(loaded.is_empty());
    }

    #[test]
    fn test_load_nonexistent_file() {
        let result = load_renpy_translations("/nonexistent/file.json".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_load_invalid_json() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("bad.json");
        fs::write(&file_path, "not json at all").unwrap();

        let result = load_renpy_translations(file_path.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("parsing JSON"));
    }

    // ── generate_renpy_translation ──────────────────────────────────────

    #[test]
    fn test_generate_translation_creates_files() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();

        let strings = vec![RenpyString {
            id: "test_1".to_string(),
            original: "Hello".to_string(),
            translated: "Ciao".to_string(),
            file: "script.rpy".to_string(),
            line_number: 5,
            string_type: RenpyStringType::Dialogue,
            character: Some("e".to_string()),
        }];

        let result = generate_renpy_translation(
            dir.path().to_string_lossy().to_string(),
            "italian".to_string(),
            strings,
        ).unwrap();

        assert!(result.contains("italian"));

        let tl_file = game_dir.join("tl").join("italian").join("script_italian.rpy");
        assert!(tl_file.exists());

        let content = fs::read_to_string(&tl_file).unwrap();
        assert!(content.contains("old \"Hello\""));
        assert!(content.contains("new \"Ciao\""));
        assert!(content.contains("translate italian strings"));
    }

    #[test]
    fn test_generate_translation_skips_untranslated() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();

        let strings = vec![RenpyString {
            id: "test_1".to_string(),
            original: "Hello".to_string(),
            translated: "".to_string(), // not translated
            file: "script.rpy".to_string(),
            line_number: 5,
            string_type: RenpyStringType::Dialogue,
            character: None,
        }];

        generate_renpy_translation(
            dir.path().to_string_lossy().to_string(),
            "italian".to_string(),
            strings,
        ).unwrap();

        let tl_file = game_dir.join("tl").join("italian").join("script_italian.rpy");
        let content = fs::read_to_string(&tl_file).unwrap();
        // Should NOT contain old/new for untranslated strings
        assert!(!content.contains("old \"Hello\""));
    }

    #[test]
    fn test_generate_translation_escapes_special_chars() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();

        let strings = vec![RenpyString {
            id: "test_1".to_string(),
            original: "She said \"hello\"".to_string(),
            translated: "Lei disse \"ciao\"".to_string(),
            file: "script.rpy".to_string(),
            line_number: 1,
            string_type: RenpyStringType::Dialogue,
            character: None,
        }];

        generate_renpy_translation(
            dir.path().to_string_lossy().to_string(),
            "italian".to_string(),
            strings,
        ).unwrap();

        let tl_file = game_dir.join("tl").join("italian").join("script_italian.rpy");
        let content = fs::read_to_string(&tl_file).unwrap();
        assert!(content.contains(r#"old "She said \"hello\"""#));
        assert!(content.contains(r#"new "Lei disse \"ciao\"""#));
    }

    // ── extract_game_info (via detect) ──────────────────────────────────

    #[test]
    fn test_extract_game_info_no_options_file() {
        let dir = TempDir::new().unwrap();
        let (title, version) = extract_game_info(&dir.path().to_string_lossy());
        // Falls back to folder name
        assert!(!title.is_empty());
        assert!(version.is_none());
    }

    // ── Serialization round-trip for RenpyStringType ────────────────────

    #[test]
    fn test_string_type_serialization() {
        let s = make_string("hi", "ciao", RenpyStringType::Dialogue);
        let json = serde_json::to_string(&s).unwrap();
        let deserialized: RenpyString = serde_json::from_str(&json).unwrap();
        assert!(matches!(deserialized.string_type, RenpyStringType::Dialogue));
    }

    #[test]
    fn test_all_string_types_serialize() {
        let types = vec![
            RenpyStringType::Dialogue,
            RenpyStringType::Menu,
            RenpyStringType::Narration,
            RenpyStringType::String,
            RenpyStringType::Label,
        ];
        for t in types {
            let s = make_string("x", "y", t);
            let json = serde_json::to_string(&s).unwrap();
            let _: RenpyString = serde_json::from_str(&json).unwrap();
        }
    }

    // ── AST-lite parser: new capability tests ──────────────────────────

    #[test]
    fn test_extract_triple_quoted_single_line() {
        let result = write_rpy_and_extract(r#"    e """Hello triple world!""""#);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Hello triple world!");
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Dialogue));
        assert_eq!(result.strings[0].character, Some("e".to_string()));
    }

    #[test]
    fn test_extract_triple_quoted_multiline() {
        let content = "    \"\"\"\n    This is line one.\n    This is line two.\n    \"\"\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains("This is line one."));
        assert!(result.strings[0].original.contains("This is line two."));
    }

    #[test]
    fn test_extract_triple_quoted_narration() {
        let result = write_rpy_and_extract(r#"    """Narration triple text""""#);
        assert_eq!(result.total_count, 1);
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Narration));
        assert_eq!(result.strings[0].character, None);
    }

    #[test]
    fn test_extract_screen_text() {
        let content = "screen settings():\n    text \"Settings\"\n    textbutton \"Save Game\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 2);
        assert_eq!(result.strings[0].original, "Settings");
        assert_eq!(result.strings[1].original, "Save Game");
        assert!(matches!(result.strings[0].string_type, RenpyStringType::String));
    }

    #[test]
    fn test_extract_screen_notify() {
        let content = "screen prefs():\n    textbutton \"Click\" action Notify(\"Saved!\")";
        let result = write_rpy_and_extract(content);
        // Should extract both "Click" and "Saved!"
        assert!(result.total_count >= 2);
        let texts: Vec<&str> = result.strings.iter().map(|s| s.original.as_str()).collect();
        assert!(texts.contains(&"Click"));
        assert!(texts.contains(&"Saved!"));
    }

    #[test]
    fn test_extract_menu_choice_with_colon() {
        let content = "menu:\n        \"Go to the park\":\n        \"Stay home\":";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 2);
        assert_eq!(result.strings[0].original, "Go to the park");
        assert_eq!(result.strings[1].original, "Stay home");
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Menu));
        assert!(matches!(result.strings[1].string_type, RenpyStringType::Menu));
    }

    #[test]
    fn test_extract_escape_sequences_preserved() {
        // Escaped quotes inside dialogue
        let result = write_rpy_and_extract(r#"    e "She said \"hello\" to me""#);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains("\\\"hello\\\""));
    }

    #[test]
    fn test_extract_interpolation_preserved() {
        let result = write_rpy_and_extract(r#"    e "Hello [player_name], welcome!""#);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains("[player_name]"));
    }

    #[test]
    fn test_extract_renpy_tags_preserved() {
        let result = write_rpy_and_extract(r#"    e "{b}Bold{/b} and {i}italic{/i} text""#);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains("{b}"));
        assert!(result.strings[0].original.contains("{/b}"));
        assert!(result.strings[0].original.contains("{i}"));
    }

    #[test]
    fn test_extract_color_tags_preserved() {
        let result = write_rpy_and_extract(r#"    e "{color=#ff0000}Red text{/color}""#);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains("{color=#ff0000}"));
    }

    #[test]
    fn test_extract_translate_block() {
        let content = "translate spanish start_abc:\n    \"Translated narration text here\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Translated narration text here");
    }

    #[test]
    fn test_extract_skips_python_block() {
        let content = "python:\n    x = \"not extractable\"\n    y = 42\n\n    e \"After python\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "After python");
    }

    #[test]
    fn test_extract_skips_init_python_block() {
        let content = "init python:\n    config.foo = \"bar\"\n\n    e \"After init python\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "After init python");
    }

    #[test]
    fn test_extract_skips_transform_keyword() {
        let result = write_rpy_and_extract("transform my_transform:");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_style_keyword() {
        let result = write_rpy_and_extract("style my_style:");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_indentation_tracking() {
        // Label keyword itself is skipped, but dialogue inside is extracted
        let content = "label start:\n    e \"Inside label\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Inside label");
    }

    #[test]
    fn test_extract_screen_label_text() {
        let content = "screen info():\n    label \"Important Notice\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Important Notice");
    }

    #[test]
    fn test_extract_newline_escape_in_dialogue() {
        let result = write_rpy_and_extract(r#"    e "Line one\nLine two""#);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains(r"\n"));
    }

    #[test]
    fn test_extract_triple_quoted_with_character() {
        let content = "    narrator \"\"\"A long speech\nthat spans lines.\"\"\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].character, Some("narrator".to_string()));
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Dialogue));
    }
}
