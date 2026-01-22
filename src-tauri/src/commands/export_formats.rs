use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::Utc;

/// 📤 Export Multi-Format System
/// 
/// Supporta export in:
/// - CSV (Comma-Separated Values)
/// - XLIFF 1.2/2.0 (XML Localization Interchange File Format)
/// - PO/POT (GNU Gettext Portable Object)
/// - TMX (Translation Memory eXchange) - già esistente

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationEntry {
    pub id: String,
    pub source: String,
    pub target: String,
    pub context: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub format: ExportFormat,
    pub source_lang: String,
    pub target_lang: String,
    pub include_context: bool,
    pub include_notes: bool,
    pub include_empty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Xliff,
    Xliff2,
    Po,
    Tmx,
    Json,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub success: bool,
    pub format: String,
    pub path: String,
    pub entries_count: u32,
    pub file_size: u64,
}

// ============================================================================
// CSV EXPORT
// ============================================================================

/// Esporta in formato CSV
#[tauri::command]
pub fn export_to_csv(
    entries: Vec<TranslationEntry>,
    output_path: String,
    options: ExportOptions,
) -> Result<ExportResult, String> {
    let mut csv_content = String::new();
    
    // Header
    let mut headers = vec!["id", "source", "target"];
    if options.include_context {
        headers.push("context");
    }
    if options.include_notes {
        headers.push("notes");
    }
    csv_content.push_str(&headers.join(","));
    csv_content.push('\n');
    
    // Rows
    let mut count = 0u32;
    for entry in &entries {
        if !options.include_empty && entry.target.trim().is_empty() {
            continue;
        }
        
        let mut row = vec![
            escape_csv(&entry.id),
            escape_csv(&entry.source),
            escape_csv(&entry.target),
        ];
        
        if options.include_context {
            row.push(escape_csv(entry.context.as_deref().unwrap_or("")));
        }
        if options.include_notes {
            row.push(escape_csv(entry.notes.as_deref().unwrap_or("")));
        }
        
        csv_content.push_str(&row.join(","));
        csv_content.push('\n');
        count += 1;
    }
    
    // Write file
    fs::write(&output_path, &csv_content)
        .map_err(|e| format!("Errore scrittura CSV: {}", e))?;
    
    let file_size = csv_content.len() as u64;
    
    Ok(ExportResult {
        success: true,
        format: "CSV".to_string(),
        path: output_path,
        entries_count: count,
        file_size,
    })
}

fn escape_csv(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') || s.contains('\r') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

// ============================================================================
// XLIFF EXPORT (1.2 and 2.0)
// ============================================================================

/// Esporta in formato XLIFF 1.2
#[tauri::command]
pub fn export_to_xliff(
    entries: Vec<TranslationEntry>,
    output_path: String,
    options: ExportOptions,
) -> Result<ExportResult, String> {
    let now = Utc::now().to_rfc3339();
    let is_xliff2 = options.format == ExportFormat::Xliff2;
    
    let mut xliff = if is_xliff2 {
        // XLIFF 2.0
        format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0"
       srcLang="{}" trgLang="{}">
  <file id="f1" original="GameStringer Export">
"#, options.source_lang, options.target_lang)
    } else {
        // XLIFF 1.2
        format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="GameStringer Export" source-language="{}" target-language="{}" datatype="plaintext">
    <header>
      <tool tool-id="GameStringer" tool-name="GameStringer Translation Tool" tool-version="1.0"/>
    </header>
    <body>
"#, options.source_lang, options.target_lang)
    };
    
    let mut count = 0u32;
    
    for entry in &entries {
        if !options.include_empty && entry.target.trim().is_empty() {
            continue;
        }
        
        if is_xliff2 {
            // XLIFF 2.0 format
            xliff.push_str(&format!(r#"    <unit id="{}">
      <segment>
        <source>{}</source>
        <target>{}</target>
      </segment>
"#, 
                escape_xml(&entry.id),
                escape_xml(&entry.source),
                escape_xml(&entry.target)
            ));
            
            if options.include_notes && entry.notes.is_some() {
                xliff.push_str(&format!("      <notes>\n        <note>{}</note>\n      </notes>\n",
                    escape_xml(entry.notes.as_ref().unwrap())
                ));
            }
            
            xliff.push_str("    </unit>\n");
        } else {
            // XLIFF 1.2 format
            xliff.push_str(&format!(r#"      <trans-unit id="{}">
        <source>{}</source>
        <target>{}</target>
"#,
                escape_xml(&entry.id),
                escape_xml(&entry.source),
                escape_xml(&entry.target)
            ));
            
            if options.include_context && entry.context.is_some() {
                xliff.push_str(&format!("        <context-group><context context-type=\"x-context\">{}</context></context-group>\n",
                    escape_xml(entry.context.as_ref().unwrap())
                ));
            }
            
            if options.include_notes && entry.notes.is_some() {
                xliff.push_str(&format!("        <note>{}</note>\n",
                    escape_xml(entry.notes.as_ref().unwrap())
                ));
            }
            
            xliff.push_str("      </trans-unit>\n");
        }
        
        count += 1;
    }
    
    // Close tags
    if is_xliff2 {
        xliff.push_str("  </file>\n</xliff>\n");
    } else {
        xliff.push_str("    </body>\n  </file>\n</xliff>\n");
    }
    
    // Write file
    fs::write(&output_path, &xliff)
        .map_err(|e| format!("Errore scrittura XLIFF: {}", e))?;
    
    let file_size = xliff.len() as u64;
    
    Ok(ExportResult {
        success: true,
        format: if is_xliff2 { "XLIFF 2.0".to_string() } else { "XLIFF 1.2".to_string() },
        path: output_path,
        entries_count: count,
        file_size,
    })
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
     .replace('\'', "&apos;")
}

// ============================================================================
// PO/POT EXPORT (GNU Gettext)
// ============================================================================

/// Esporta in formato PO (GNU Gettext)
#[tauri::command]
pub fn export_to_po(
    entries: Vec<TranslationEntry>,
    output_path: String,
    options: ExportOptions,
) -> Result<ExportResult, String> {
    let now = Utc::now().format("%Y-%m-%d %H:%M%z").to_string();
    let is_pot = output_path.ends_with(".pot");
    
    // PO Header
    let mut po = format!(r#"# Translation file exported by GameStringer
# Copyright (C) 2026 GameStringer
# This file is distributed under the same license as the game.
#
msgid ""
msgstr ""
"Project-Id-Version: GameStringer Export\n"
"Report-Msgid-Bugs-To: \n"
"POT-Creation-Date: {}\n"
"PO-Revision-Date: {}\n"
"Last-Translator: GameStringer User\n"
"Language-Team: {}\n"
"Language: {}\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"

"#, now, now, options.target_lang, options.target_lang);
    
    let mut count = 0u32;
    
    for entry in &entries {
        if !options.include_empty && entry.target.trim().is_empty() && !is_pot {
            continue;
        }
        
        // Context (msgctxt)
        if options.include_context && entry.context.is_some() {
            po.push_str(&format!("#. Context: {}\n", entry.context.as_ref().unwrap()));
        }
        
        // Notes as translator comments
        if options.include_notes && entry.notes.is_some() {
            po.push_str(&format!("#. {}\n", entry.notes.as_ref().unwrap()));
        }
        
        // Reference (using ID)
        po.push_str(&format!("#: {}\n", entry.id));
        
        // msgid (source)
        po.push_str(&format_po_string("msgid", &entry.source));
        
        // msgstr (target) - empty for POT files
        if is_pot {
            po.push_str("msgstr \"\"\n");
        } else {
            po.push_str(&format_po_string("msgstr", &entry.target));
        }
        
        po.push('\n');
        count += 1;
    }
    
    // Write file
    fs::write(&output_path, &po)
        .map_err(|e| format!("Errore scrittura PO: {}", e))?;
    
    let file_size = po.len() as u64;
    
    Ok(ExportResult {
        success: true,
        format: if is_pot { "POT".to_string() } else { "PO".to_string() },
        path: output_path,
        entries_count: count,
        file_size,
    })
}

fn format_po_string(key: &str, value: &str) -> String {
    let escaped = value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\t', "\\t");
    
    // Split long strings
    if escaped.len() > 70 || escaped.contains("\\n") {
        let mut result = format!("{} \"\"\n", key);
        for line in escaped.split("\\n") {
            if !line.is_empty() {
                result.push_str(&format!("\"{}\\n\"\n", line));
            }
        }
        // Remove trailing \n from last line if original didn't have it
        if !value.ends_with('\n') && result.ends_with("\\n\"\n") {
            result = result[..result.len()-5].to_string() + "\"\n";
        }
        result
    } else {
        format!("{} \"{}\"\n", key, escaped)
    }
}

// ============================================================================
// JSON EXPORT
// ============================================================================

/// Esporta in formato JSON
#[tauri::command]
pub fn export_to_json(
    entries: Vec<TranslationEntry>,
    output_path: String,
    options: ExportOptions,
) -> Result<ExportResult, String> {
    let mut json_entries: Vec<serde_json::Value> = Vec::new();
    let mut count = 0u32;
    
    for entry in &entries {
        if !options.include_empty && entry.target.trim().is_empty() {
            continue;
        }
        
        let mut obj = serde_json::json!({
            "id": entry.id,
            "source": entry.source,
            "target": entry.target,
        });
        
        if options.include_context && entry.context.is_some() {
            obj["context"] = serde_json::json!(entry.context);
        }
        if options.include_notes && entry.notes.is_some() {
            obj["notes"] = serde_json::json!(entry.notes);
        }
        
        json_entries.push(obj);
        count += 1;
    }
    
    let export_data = serde_json::json!({
        "metadata": {
            "exportedAt": Utc::now().to_rfc3339(),
            "sourceLanguage": options.source_lang,
            "targetLanguage": options.target_lang,
            "entriesCount": count,
            "tool": "GameStringer"
        },
        "translations": json_entries
    });
    
    let json = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Errore serializzazione JSON: {}", e))?;
    
    fs::write(&output_path, &json)
        .map_err(|e| format!("Errore scrittura JSON: {}", e))?;
    
    let file_size = json.len() as u64;
    
    Ok(ExportResult {
        success: true,
        format: "JSON".to_string(),
        path: output_path,
        entries_count: count,
        file_size,
    })
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

/// Importa da CSV
#[tauri::command]
pub fn import_from_csv(file_path: String) -> Result<Vec<TranslationEntry>, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Errore lettura CSV: {}", e))?;
    
    let mut entries = Vec::new();
    let mut lines = content.lines();
    
    // Skip header
    let header = lines.next().ok_or("CSV vuoto")?;
    let headers: Vec<&str> = header.split(',').collect();
    
    let id_idx = headers.iter().position(|&h| h.trim().to_lowercase() == "id").unwrap_or(0);
    let source_idx = headers.iter().position(|&h| h.trim().to_lowercase() == "source").unwrap_or(1);
    let target_idx = headers.iter().position(|&h| h.trim().to_lowercase() == "target").unwrap_or(2);
    let context_idx = headers.iter().position(|&h| h.trim().to_lowercase() == "context");
    let notes_idx = headers.iter().position(|&h| h.trim().to_lowercase() == "notes");
    
    for (line_num, line) in lines.enumerate() {
        let fields = parse_csv_line(line);
        
        if fields.len() < 3 {
            continue;
        }
        
        entries.push(TranslationEntry {
            id: fields.get(id_idx).map(|s| s.to_string()).unwrap_or_else(|| format!("row_{}", line_num)),
            source: fields.get(source_idx).map(|s| s.to_string()).unwrap_or_default(),
            target: fields.get(target_idx).map(|s| s.to_string()).unwrap_or_default(),
            context: context_idx.and_then(|i| fields.get(i).map(|s| s.to_string())),
            notes: notes_idx.and_then(|i| fields.get(i).map(|s| s.to_string())),
        });
    }
    
    Ok(entries)
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();
    
    while let Some(c) = chars.next() {
        match c {
            '"' if in_quotes => {
                if chars.peek() == Some(&'"') {
                    chars.next();
                    current.push('"');
                } else {
                    in_quotes = false;
                }
            }
            '"' if !in_quotes => {
                in_quotes = true;
            }
            ',' if !in_quotes => {
                fields.push(current.clone());
                current.clear();
            }
            _ => {
                current.push(c);
            }
        }
    }
    fields.push(current);
    
    fields
}

/// Importa da PO
#[tauri::command]
pub fn import_from_po(file_path: String) -> Result<Vec<TranslationEntry>, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Errore lettura PO: {}", e))?;
    
    let mut entries = Vec::new();
    let mut current_id = String::new();
    let mut current_msgid = String::new();
    let mut current_msgstr = String::new();
    let mut current_context = Option::<String>::None;
    let mut in_msgid = false;
    let mut in_msgstr = false;
    let mut entry_count = 0;
    
    for line in content.lines() {
        let line = line.trim();
        
        if line.starts_with("#:") {
            current_id = line[2..].trim().to_string();
        } else if line.starts_with("#.") {
            current_context = Some(line[2..].trim().to_string());
        } else if line.starts_with("msgid ") {
            in_msgid = true;
            in_msgstr = false;
            current_msgid = extract_po_string(&line[6..]);
        } else if line.starts_with("msgstr ") {
            in_msgid = false;
            in_msgstr = true;
            current_msgstr = extract_po_string(&line[7..]);
        } else if line.starts_with('"') && line.ends_with('"') {
            let content = extract_po_string(line);
            if in_msgid {
                current_msgid.push_str(&content);
            } else if in_msgstr {
                current_msgstr.push_str(&content);
            }
        } else if line.is_empty() && !current_msgid.is_empty() {
            // End of entry
            if !current_msgid.is_empty() {
                entry_count += 1;
                entries.push(TranslationEntry {
                    id: if current_id.is_empty() { format!("po_{}", entry_count) } else { current_id.clone() },
                    source: current_msgid.clone(),
                    target: current_msgstr.clone(),
                    context: current_context.clone(),
                    notes: None,
                });
            }
            current_id.clear();
            current_msgid.clear();
            current_msgstr.clear();
            current_context = None;
            in_msgid = false;
            in_msgstr = false;
        }
    }
    
    // Don't forget last entry
    if !current_msgid.is_empty() {
        entry_count += 1;
        entries.push(TranslationEntry {
            id: if current_id.is_empty() { format!("po_{}", entry_count) } else { current_id },
            source: current_msgid,
            target: current_msgstr,
            context: current_context,
            notes: None,
        });
    }
    
    Ok(entries)
}

fn extract_po_string(s: &str) -> String {
    let s = s.trim();
    if s.starts_with('"') && s.ends_with('"') && s.len() >= 2 {
        s[1..s.len()-1]
            .replace("\\n", "\n")
            .replace("\\t", "\t")
            .replace("\\\"", "\"")
            .replace("\\\\", "\\")
    } else {
        s.to_string()
    }
}

/// Lista formati supportati
#[tauri::command]
pub fn get_supported_formats() -> Vec<FormatInfo> {
    vec![
        FormatInfo {
            id: "csv".to_string(),
            name: "CSV".to_string(),
            extension: ".csv".to_string(),
            description: "Comma-Separated Values - compatibile con Excel".to_string(),
            supports_import: true,
            supports_export: true,
        },
        FormatInfo {
            id: "xliff".to_string(),
            name: "XLIFF 1.2".to_string(),
            extension: ".xlf".to_string(),
            description: "XML Localization Interchange File Format - standard industria".to_string(),
            supports_import: false,
            supports_export: true,
        },
        FormatInfo {
            id: "xliff2".to_string(),
            name: "XLIFF 2.0".to_string(),
            extension: ".xlf".to_string(),
            description: "XLIFF versione 2.0 - più moderno".to_string(),
            supports_import: false,
            supports_export: true,
        },
        FormatInfo {
            id: "po".to_string(),
            name: "PO (Gettext)".to_string(),
            extension: ".po".to_string(),
            description: "GNU Gettext Portable Object - usato in open source".to_string(),
            supports_import: true,
            supports_export: true,
        },
        FormatInfo {
            id: "pot".to_string(),
            name: "POT (Template)".to_string(),
            extension: ".pot".to_string(),
            description: "Template PO senza traduzioni".to_string(),
            supports_import: false,
            supports_export: true,
        },
        FormatInfo {
            id: "json".to_string(),
            name: "JSON".to_string(),
            extension: ".json".to_string(),
            description: "JavaScript Object Notation - per sviluppatori".to_string(),
            supports_import: false,
            supports_export: true,
        },
        FormatInfo {
            id: "tmx".to_string(),
            name: "TMX".to_string(),
            extension: ".tmx".to_string(),
            description: "Translation Memory eXchange - per CAT tools".to_string(),
            supports_import: true,
            supports_export: true,
        },
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatInfo {
    pub id: String,
    pub name: String,
    pub extension: String,
    pub description: String,
    pub supports_import: bool,
    pub supports_export: bool,
}
