//! Comandi per scan e traduzione CSV SimpleLocalization da giochi Unity

use tauri::command;
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::Path;

#[derive(Clone, Serialize, Deserialize)]
pub struct CsvTableEntry {
    pub id: String,
    pub english: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CsvTableInfo {
    pub name: String,
    pub offset: usize,
    pub length: usize,
    pub source: String,
    pub header: Vec<String>,
    pub entries: Vec<CsvTableEntry>,
}

#[derive(Serialize, Deserialize)]
pub struct ScanCsvResult {
    pub tables: Vec<CsvTableInfo>,
    pub unity_version: String,
    pub error: Option<String>,
}

/// Scansiona una cartella gioco Unity per tabelle CSV SimpleLocalization
#[command]
pub async fn scan_unity_csv_tables(game_path: String) -> ScanCsvResult {
    let base = Path::new(&game_path);
    
    // Trova cartella _Data
    let data_dir = match find_data_dir(base) {
        Some(d) => d,
        None => return ScanCsvResult {
            tables: vec![], unity_version: String::new(),
            error: Some("Cartella _Data non trovata".into()),
        },
    };

    // Rileva versione Unity
    let unity_version = detect_unity_version(&data_dir);

    // Scansiona file asset
    let mut all_tables = Vec::new();
    if let Ok(entries) = fs::read_dir(&data_dir) {
        for entry in entries.flatten() {
            let fname = entry.file_name().to_string_lossy().to_string();
            let is_asset = fname.ends_with(".assets") 
                || fname.starts_with("level") 
                || fname == "globalgamemanagers";
            if !is_asset || fname.ends_with(".resS") { continue; }

            if let Ok(data) = fs::read(entry.path()) {
                let tables = find_csv_in_binary(&data, &fname);
                if !tables.is_empty() {
                    println!("[CSV] {} tabelle in {}", tables.len(), fname);
                    all_tables.extend(tables);
                }
            }
        }
    }

    ScanCsvResult { tables: all_tables, unity_version, error: None }
}

fn find_data_dir(base: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(base) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with("_Data") && entry.path().is_dir() {
                return Some(entry.path().to_string_lossy().to_string());
            }
        }
    }
    None
}

fn detect_unity_version(data_dir: &str) -> String {
    let ggm = Path::new(data_dir).join("globalgamemanagers");
    if let Ok(data) = fs::read(&ggm) {
        let text = String::from_utf8_lossy(&data[..data.len().min(500)]);
        if let Some(m) = regex::Regex::new(r"\d{4}\.\d+\.\d+\w+")
            .ok().and_then(|r| r.find(&text)) {
            return m.as_str().to_string();
        }
    }
    "Unknown".into()
}

fn find_csv_in_binary(data: &[u8], filename: &str) -> Vec<CsvTableInfo> {
    let pattern = b"ID,ENGLISH";
    let mut tables = Vec::new();
    let mut pos = 0;

    while pos + pattern.len() < data.len() {
        if let Some(idx) = data[pos..].windows(pattern.len())
            .position(|w| w == pattern) 
        {
            let start = pos + idx;
            let mut end = start;
            while end < data.len() && data[end] != 0 { end += 1; }

            if let Ok(text) = std::str::from_utf8(&data[start..end]) {
                if text.len() > 20 {
                    if let Some(table) = parse_csv_block(text, start, end - start, filename) {
                        tables.push(table);
                    }
                }
            }
            pos = end + 1;
        } else {
            break;
        }
    }
    tables
}

fn parse_csv_block(text: &str, offset: usize, length: usize, source: &str) -> Option<CsvTableInfo> {
    let lines: Vec<&str> = text.lines().collect();
    if lines.len() < 2 { return None; }

    let header: Vec<String> = lines[0].split(',').map(|s| s.trim().to_string()).collect();
    let mut entries = Vec::new();

    for line in &lines[1..] {
        let parts = parse_csv_line(line);
        let id = parts.first().map(|s| s.trim().to_string()).unwrap_or_default();
        if id.is_empty() { continue; }
        let english = parts.get(1).map(|s| s.trim().to_string()).unwrap_or_default();
        entries.push(CsvTableEntry { id, english });
    }

    if entries.is_empty() { return None; }

    let name = identify_table_name(&entries);
    Some(CsvTableInfo { name, offset, length, source: source.to_string(), header, entries })
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    for ch in line.chars() {
        match ch {
            '"' => in_quotes = !in_quotes,
            ',' if !in_quotes => { result.push(current.clone()); current.clear(); }
            _ => current.push(ch),
        }
    }
    result.push(current);
    result
}

fn identify_table_name(entries: &[CsvTableEntry]) -> String {
    let ids: String = entries.iter().take(5).map(|e| e.id.to_lowercase()).collect::<Vec<_>>().join(" ");
    if ids.contains("ui_") || ids.contains("death_") { return "uielements".into(); }
    if ids.contains("ll_") || ids.contains("vl_") { return "popups".into(); }
    if ids.contains("spell_") { return "spelltexts".into(); }
    if ids.contains("item_") { return "itemtexts".into(); }
    if ids.contains("journal_") { return "journaltexts".into(); }
    if ids.contains("quest_") { return "questpoints".into(); }
    if ids.contains("feat_") { return "feats".into(); }
    if ids.contains("bg_") { return "backgrounds".into(); }
    format!("table_{}", entries.len())
}
