use serde_json;
use std::fs;
use std::path::Path;
use std::collections::HashMap;

#[tauri::command]
pub async fn get_patches(patch_id: Option<String>) -> Result<serde_json::Value, String> {
    log::info!("📦 Recupero patch{}", 
        if let Some(ref id) = patch_id { format!(" con ID: {}", id) } else { "".to_string() });
    
    // TODO: Implementare patch manager con database/file system
    if let Some(_id) = patch_id {
        // Recupera patch specifica
        log::warn!("⚠️ Recupero patch specifica non ancora implementato");
        Err("Patch non trovata".to_string())
    } else {
        // Recupera tutte le patch
        let patches = serde_json::json!([]);
        log::info!("✅ Recuperate {} patch", 0);
        Ok(patches)
    }
}

#[tauri::command]
pub async fn create_patch(options: serde_json::Value, translations: serde_json::Value) -> Result<serde_json::Value, String> {
    log::info!("🔨 Creazione nuova patch");
    log::info!("📝 Opzioni: {}", options);
    log::info!("🌐 Traduzioni: {} elementi", 
        translations.as_array().map(|arr| arr.len()).unwrap_or(0));
    
    // TODO: Implementare creazione patch con patch manager
    let patch = serde_json::json!({
        "id": "patch_placeholder",
        "name": "Patch Placeholder",
        "created_at": chrono::Utc::now().to_rfc3339(),
        "status": "created",
        "options": options,
        "translations": translations
    });
    
    log::warn!("⚠️ Creazione patch non ancora implementata - restituito placeholder");
    Ok(patch)
}

#[tauri::command]
pub async fn update_patch(patch_id: String, options: serde_json::Value, translations: serde_json::Value) -> Result<serde_json::Value, String> {
    log::info!("✏️ Aggiornamento patch: {}", patch_id);
    
    // TODO: Implementare aggiornamento patch
    let updated_patch = serde_json::json!({
        "id": patch_id,
        "updated_at": chrono::Utc::now().to_rfc3339(),
        "status": "updated",
        "options": options,
        "translations": translations
    });
    
    log::warn!("⚠️ Aggiornamento patch non ancora implementato");
    Ok(updated_patch)
}

#[tauri::command]
pub async fn export_patch(patch_id: String, format: String) -> Result<serde_json::Value, String> {
    log::info!("📤 Export patch {} in formato: {}", patch_id, format);
    
    // TODO: Implementare export patch in vari formati
    let export_result = serde_json::json!({
        "patch_id": patch_id,
        "format": format,
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "file_path": format!("./exports/patch_{}.{}", patch_id, format),
        "status": "exported"
    });
    
    log::warn!("⚠️ Export patch non ancora implementato");
    Ok(export_result)
}

#[tauri::command]
#[allow(dead_code)] // Comando traduzione testo - essenziale per sistema injection/traduzione
pub async fn translate_text(text: String, provider: String, _api_key: String, target_lang: String) -> Result<serde_json::Value, String> {
    log::info!("🌐 Traduzione testo con {}: '{}' -> {}", provider, 
        if text.len() > 50 { format!("{}...", &text[..50]) } else { text.clone() }, 
        target_lang);
    
    // TODO: Implementare integrazione con servizi di traduzione
    match provider.as_str() {
        "openai" => {
            log::info!("🤖 Usando OpenAI per traduzione");
            // TODO: Implementare chiamata OpenAI API
        }
        "deepl" => {
            log::info!("🔵 Usando DeepL per traduzione");
            // TODO: Implementare chiamata DeepL API
        }
        "google" => {
            log::info!("🔍 Usando Google Translate per traduzione");
            // TODO: Implementare chiamata Google Translate API
        }
        _ => {
            return Err(format!("Provider di traduzione non supportato: {}", provider));
        }
    }
    
    // Placeholder per ora
    let translation_result = serde_json::json!({
        "original_text": text,
        "translated_text": format!("[{}] {}", target_lang.to_uppercase(), text),
        "provider": provider,
        "target_language": target_lang,
        "confidence": 0.95,
        "translated_at": chrono::Utc::now().to_rfc3339()
    });
    
    log::warn!("⚠️ Traduzione non ancora implementata - restituito placeholder");
    Ok(translation_result)
}

#[tauri::command]
pub async fn get_translation_suggestions(text: String, context: Option<String>) -> Result<serde_json::Value, String> {
    log::info!("💡 Recupero suggerimenti traduzione per: '{}'", 
        if text.len() > 50 { format!("{}...", &text[..50]) } else { text.clone() });
    
    // TODO: Implementare sistema suggerimenti basato su database/AI
    let suggestions = serde_json::json!({
        "original_text": text,
        "context": context,
        "suggestions": [
            {
                "text": format!("Suggerimento 1 per: {}", text),
                "confidence": 0.9,
                "source": "database"
            },
            {
                "text": format!("Suggerimento 2 per: {}", text),
                "confidence": 0.8,
                "source": "ai"
            }
        ],
        "generated_at": chrono::Utc::now().to_rfc3339()
    });
    
    log::warn!("⚠️ Suggerimenti traduzione non ancora implementati");
    Ok(suggestions)
}

#[tauri::command]
pub async fn export_translations(
    file_path: String,
    format: String,
    translations: Vec<serde_json::Value>,
    source_lang: Option<String>,
    target_lang: Option<String>,
) -> Result<serde_json::Value, String> {
    log::info!("📋 Export {} traduzioni in formato: {} -> {}", translations.len(), format, file_path);
    
    let source = source_lang.unwrap_or_else(|| "en".to_string());
    let target = target_lang.unwrap_or_else(|| "it".to_string());
    
    // Crea directory se non esiste
    if let Some(parent) = Path::new(&file_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Errore creazione directory: {}", e))?;
    }
    
    let count = translations.len();
    
    match format.to_lowercase().as_str() {
        "json" => {
            // Formato JSON semplice: { "original": "translated", ... }
            let mut map: HashMap<String, String> = HashMap::new();
            for t in &translations {
                if let (Some(orig), Some(trans)) = (
                    t.get("original").and_then(|v| v.as_str()),
                    t.get("translated").and_then(|v| v.as_str())
                ) {
                    map.insert(orig.to_string(), trans.to_string());
                }
            }
            
            let json = serde_json::to_string_pretty(&map)
                .map_err(|e| format!("Errore serializzazione JSON: {}", e))?;
            fs::write(&file_path, json)
                .map_err(|e| format!("Errore scrittura file: {}", e))?;
        }
        "json_full" => {
            // Formato JSON completo con metadata
            let export_data = serde_json::json!({
                "source_language": source,
                "target_language": target,
                "exported_at": chrono::Utc::now().to_rfc3339(),
                "count": count,
                "translations": translations
            });
            
            let json = serde_json::to_string_pretty(&export_data)
                .map_err(|e| format!("Errore serializzazione JSON: {}", e))?;
            fs::write(&file_path, json)
                .map_err(|e| format!("Errore scrittura file: {}", e))?;
        }
        "csv" => {
            // Formato CSV: original,translated
            let mut csv_content = String::from("original,translated\n");
            for t in &translations {
                if let (Some(orig), Some(trans)) = (
                    t.get("original").and_then(|v| v.as_str()),
                    t.get("translated").and_then(|v| v.as_str())
                ) {
                    // Escape virgole e newline
                    let orig_escaped = escape_csv_field(orig);
                    let trans_escaped = escape_csv_field(trans);
                    csv_content.push_str(&format!("{},{}\n", orig_escaped, trans_escaped));
                }
            }
            fs::write(&file_path, csv_content)
                .map_err(|e| format!("Errore scrittura file: {}", e))?;
        }
        "tsv" => {
            // Formato TSV (Tab-Separated Values)
            let mut tsv_content = String::from("original\ttranslated\n");
            for t in &translations {
                if let (Some(orig), Some(trans)) = (
                    t.get("original").and_then(|v| v.as_str()),
                    t.get("translated").and_then(|v| v.as_str())
                ) {
                    // Escape tab e newline
                    let orig_escaped = orig.replace('\t', "    ").replace('\n', "\\n");
                    let trans_escaped = trans.replace('\t', "    ").replace('\n', "\\n");
                    tsv_content.push_str(&format!("{}\t{}\n", orig_escaped, trans_escaped));
                }
            }
            fs::write(&file_path, tsv_content)
                .map_err(|e| format!("Errore scrittura file: {}", e))?;
        }
        "po" => {
            // Formato PO (Gettext)
            let mut po_content = format!(
                "# Translation file exported by GameStringer\n\
                # Source: {}\n\
                # Target: {}\n\
                # Date: {}\n\n",
                source, target, chrono::Utc::now().to_rfc3339()
            );
            
            for t in &translations {
                if let (Some(orig), Some(trans)) = (
                    t.get("original").and_then(|v| v.as_str()),
                    t.get("translated").and_then(|v| v.as_str())
                ) {
                    po_content.push_str(&format!(
                        "msgid \"{}\"\nmsgstr \"{}\"\n\n",
                        escape_po_string(orig),
                        escape_po_string(trans)
                    ));
                }
            }
            fs::write(&file_path, po_content)
                .map_err(|e| format!("Errore scrittura file: {}", e))?;
        }
        _ => {
            return Err(format!("Formato non supportato: {}. Usa: json, json_full, csv, tsv, po", format));
        }
    }
    
    log::info!("✅ Esportate {} traduzioni in {}", count, file_path);
    
    Ok(serde_json::json!({
        "format": format,
        "file_path": file_path,
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "count": count,
        "source_language": source,
        "target_language": target,
        "status": "exported"
    }))
}

/// Escape campo CSV
fn escape_csv_field(field: &str) -> String {
    if field.contains(',') || field.contains('"') || field.contains('\n') {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}

/// Escape stringa PO
fn escape_po_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\t', "\\t")
}

#[tauri::command]
pub async fn import_translations(
    file_path: String,
    format: Option<String>,
) -> Result<serde_json::Value, String> {
    log::info!("📥 Import traduzioni da: {}", file_path);
    
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File non trovato: {}", file_path));
    }
    
    // Auto-detect formato dall'estensione se non specificato
    let format = format.unwrap_or_else(|| {
        path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("json")
            .to_lowercase()
    });
    
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let mut translations: Vec<serde_json::Value> = Vec::new();
    let mut source_lang = "en".to_string();
    let mut target_lang = "it".to_string();
    let mut skipped = 0;
    
    match format.as_str() {
        "json" => {
            // Prova formato semplice { "original": "translated" }
            if let Ok(map) = serde_json::from_str::<HashMap<String, String>>(&content) {
                for (orig, trans) in map {
                    translations.push(serde_json::json!({
                        "original": orig,
                        "translated": trans
                    }));
                }
            }
            // Prova formato con metadata
            else if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(src) = data.get("source_language").and_then(|v| v.as_str()) {
                    source_lang = src.to_string();
                }
                if let Some(tgt) = data.get("target_language").and_then(|v| v.as_str()) {
                    target_lang = tgt.to_string();
                }
                
                // Array di traduzioni
                if let Some(arr) = data.get("translations").and_then(|v| v.as_array()) {
                    translations = arr.clone();
                }
                // Mappa traduzioni
                else if let Some(obj) = data.get("translations").and_then(|v| v.as_object()) {
                    for (orig, trans) in obj {
                        if let Some(trans_str) = trans.as_str() {
                            translations.push(serde_json::json!({
                                "original": orig,
                                "translated": trans_str
                            }));
                        }
                    }
                }
            } else {
                return Err("Formato JSON non valido".to_string());
            }
        }
        "csv" => {
            for (line_num, line) in content.lines().enumerate() {
                // Salta header
                if line_num == 0 {
                    continue;
                }
                
                let parts = parse_csv_line(line);
                if parts.len() >= 2 {
                    let orig = parts[0].trim();
                    let trans = parts[1].trim();
                    if !orig.is_empty() && !trans.is_empty() {
                        translations.push(serde_json::json!({
                            "original": orig,
                            "translated": trans
                        }));
                    } else {
                        skipped += 1;
                    }
                } else {
                    skipped += 1;
                }
            }
        }
        "tsv" => {
            for (line_num, line) in content.lines().enumerate() {
                // Salta header
                if line_num == 0 {
                    continue;
                }
                
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 2 {
                    let orig = parts[0].trim().replace("\\n", "\n");
                    let trans = parts[1].trim().replace("\\n", "\n");
                    if !orig.is_empty() && !trans.is_empty() {
                        translations.push(serde_json::json!({
                            "original": orig,
                            "translated": trans
                        }));
                    } else {
                        skipped += 1;
                    }
                } else {
                    skipped += 1;
                }
            }
        }
        "po" => {
            let mut current_msgid: Option<String> = None;
            
            for line in content.lines() {
                let line = line.trim();
                
                if line.starts_with("msgid \"") && line.ends_with('"') {
                    let msgid = &line[7..line.len()-1];
                    current_msgid = Some(unescape_po_string(msgid));
                }
                else if line.starts_with("msgstr \"") && line.ends_with('"') {
                    if let Some(ref msgid) = current_msgid {
                        let msgstr = &line[8..line.len()-1];
                        let translated = unescape_po_string(msgstr);
                        
                        if !msgid.is_empty() && !translated.is_empty() {
                            translations.push(serde_json::json!({
                                "original": msgid,
                                "translated": translated
                            }));
                        }
                    }
                    current_msgid = None;
                }
            }
        }
        _ => {
            return Err(format!("Formato non supportato: {}. Usa: json, csv, tsv, po", format));
        }
    }
    
    log::info!("✅ Importate {} traduzioni ({} saltate) da {}", translations.len(), skipped, file_path);
    
    Ok(serde_json::json!({
        "file_path": file_path,
        "format": format,
        "imported_at": chrono::Utc::now().to_rfc3339(),
        "imported_count": translations.len(),
        "skipped_count": skipped,
        "source_language": source_lang,
        "target_language": target_lang,
        "translations": translations,
        "status": "imported"
    }))
}

/// Parse CSV line handling quoted fields
fn parse_csv_line(line: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();
    
    while let Some(c) = chars.next() {
        match c {
            '"' if !in_quotes => {
                in_quotes = true;
            }
            '"' if in_quotes => {
                if chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            }
            ',' if !in_quotes => {
                result.push(current.clone());
                current.clear();
            }
            _ => {
                current.push(c);
            }
        }
    }
    result.push(current);
    result
}

/// Unescape stringa PO
fn unescape_po_string(s: &str) -> String {
    s.replace("\\n", "\n")
        .replace("\\t", "\t")
        .replace("\\\"", "\"")
        .replace("\\\\", "\\")
}
