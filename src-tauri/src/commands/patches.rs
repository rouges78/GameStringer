use serde_json;
use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use uuid::Uuid;

/// Directory di storage per le patch
fn get_patches_dir() -> Result<PathBuf, String> {
    let patches_dir = if cfg!(debug_assertions) {
        PathBuf::from("../gamestringer_data/patches")
    } else {
        dirs::data_dir()
            .ok_or("Impossibile trovare directory dati")?
            .join("gamestringer")
            .join("patches")
    };
    
    if !patches_dir.exists() {
        fs::create_dir_all(&patches_dir)
            .map_err(|e| format!("Errore creazione directory patches: {}", e))?;
    }
    Ok(patches_dir)
}

/// Legge una patch da file
fn read_patch_file(path: &Path) -> Result<serde_json::Value, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Errore lettura patch: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing patch JSON: {}", e))
}

/// Salva una patch su file
fn write_patch_file(path: &Path, patch: &serde_json::Value) -> Result<(), String> {
    let json = serde_json::to_string_pretty(patch)
        .map_err(|e| format!("Errore serializzazione patch: {}", e))?;
    fs::write(path, json)
        .map_err(|e| format!("Errore scrittura patch: {}", e))
}

#[tauri::command]
pub async fn get_patches(patch_id: Option<String>) -> Result<serde_json::Value, String> {
    log::info!("📦 Recupero patch{}", 
        if let Some(ref id) = patch_id { format!(" con ID: {}", id) } else { " (tutte)".to_string() });
    
    let patches_dir = get_patches_dir()?;
    
    if let Some(id) = patch_id {
        // Recupera patch specifica
        let patch_file = patches_dir.join(format!("{}.json", id));
        if !patch_file.exists() {
            return Err(format!("Patch non trovata: {}", id));
        }
        let patch = read_patch_file(&patch_file)?;
        log::info!("✅ Patch '{}' recuperata", id);
        Ok(patch)
    } else {
        // Recupera tutte le patch
        let mut patches = Vec::new();
        if let Ok(entries) = fs::read_dir(&patches_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("json") {
                    match read_patch_file(&path) {
                        Ok(patch) => patches.push(patch),
                        Err(e) => log::warn!("⚠️ Errore lettura patch {:?}: {}", path, e),
                    }
                }
            }
        }
        // Ordina per created_at decrescente
        patches.sort_by(|a, b| {
            let a_date = a.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
            let b_date = b.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
            b_date.cmp(a_date)
        });
        log::info!("✅ Recuperate {} patch", patches.len());
        Ok(serde_json::json!(patches))
    }
}

#[tauri::command]
pub async fn create_patch(options: serde_json::Value, translations: serde_json::Value) -> Result<serde_json::Value, String> {
    let count = translations.as_array().map(|arr| arr.len()).unwrap_or(0);
    log::info!("🔨 Creazione nuova patch ({} traduzioni)", count);
    
    let patches_dir = get_patches_dir()?;
    let patch_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    let name = options.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Patch senza nome")
        .to_string();
    
    let patch = serde_json::json!({
        "id": patch_id,
        "name": name,
        "created_at": now,
        "updated_at": now,
        "status": "created",
        "translation_count": count,
        "options": options,
        "translations": translations
    });
    
    let patch_file = patches_dir.join(format!("{}.json", patch_id));
    write_patch_file(&patch_file, &patch)?;
    
    log::info!("✅ Patch '{}' creata: {} ({} traduzioni)", patch_id, name, count);
    Ok(patch)
}

#[tauri::command]
pub async fn update_patch(patch_id: String, options: serde_json::Value, translations: serde_json::Value) -> Result<serde_json::Value, String> {
    log::info!("✏️ Aggiornamento patch: {}", patch_id);
    
    let patches_dir = get_patches_dir()?;
    let patch_file = patches_dir.join(format!("{}.json", patch_id));
    
    if !patch_file.exists() {
        return Err(format!("Patch non trovata: {}", patch_id));
    }
    
    // Leggi patch esistente per preservare created_at
    let existing = read_patch_file(&patch_file)?;
    let created_at = existing.get("created_at")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    
    let count = translations.as_array().map(|arr| arr.len()).unwrap_or(0);
    let name = options.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(
            existing.get("name").and_then(|v| v.as_str()).unwrap_or("Patch senza nome")
        )
        .to_string();
    
    let updated_patch = serde_json::json!({
        "id": patch_id,
        "name": name,
        "created_at": created_at,
        "updated_at": chrono::Utc::now().to_rfc3339(),
        "status": "updated",
        "translation_count": count,
        "options": options,
        "translations": translations
    });
    
    write_patch_file(&patch_file, &updated_patch)?;
    
    log::info!("✅ Patch '{}' aggiornata ({} traduzioni)", patch_id, count);
    Ok(updated_patch)
}

#[tauri::command]
pub async fn export_patch(patch_id: String, format: String) -> Result<serde_json::Value, String> {
    log::info!("📤 Export patch {} in formato: {}", patch_id, format);
    
    let patches_dir = get_patches_dir()?;
    let patch_file = patches_dir.join(format!("{}.json", patch_id));
    
    if !patch_file.exists() {
        return Err(format!("Patch non trovata: {}", patch_id));
    }
    
    let patch = read_patch_file(&patch_file)?;
    let translations = patch.get("translations")
        .cloned()
        .unwrap_or(serde_json::json!([]));
    let translations_vec: Vec<serde_json::Value> = translations
        .as_array()
        .cloned()
        .unwrap_or_default();
    
    let source_lang = patch.get("options")
        .and_then(|o| o.get("source_language"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let target_lang = patch.get("options")
        .and_then(|o| o.get("target_language"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    // Esporta nella directory exports accanto alle patch
    let exports_dir = patches_dir.parent()
        .unwrap_or(Path::new("."))
        .join("exports");
    fs::create_dir_all(&exports_dir)
        .map_err(|e| format!("Errore creazione directory exports: {}", e))?;
    
    let patch_name = patch.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(&patch_id);
    let safe_name: String = patch_name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let export_file = exports_dir.join(format!("{}_{}.{}", safe_name, &patch_id[..8], format));
    let export_path = export_file.to_string_lossy().to_string();
    
    // Delega all'export_translations esistente
    export_translations(export_path.clone(), format.clone(), translations_vec, source_lang, target_lang).await
}

#[tauri::command]
#[allow(dead_code)]
pub async fn translate_text(text: String, provider: String, api_key: String, target_lang: String) -> Result<serde_json::Value, String> {
    log::info!("🌐 Traduzione testo con {}: '{}' -> {}", provider, 
        if text.len() > 50 { format!("{}...", &text[..50]) } else { text.clone() }, 
        target_lang);
    
    // Chiama l'API frontend Next.js che gestisce già 14+ provider con fallback chain
    let client = reqwest::Client::new();
    let mut body = serde_json::json!({
        "text": text,
        "targetLanguage": target_lang,
        "provider": provider
    });
    
    // Passa API key se fornita
    if !api_key.is_empty() {
        body["apiKey"] = serde_json::Value::String(api_key);
    }
    
    let response = client
        .post("http://127.0.0.1:3199/api/translate")
        .json(&body)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Errore connessione API traduzione: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API traduzione errore {}: {}", status, error_text));
    }
    
    let api_result: serde_json::Value = response.json().await
        .map_err(|e| format!("Errore parsing risposta traduzione: {}", e))?;
    
    let translated_text = api_result.get("translatedText")
        .and_then(|v| v.as_str())
        .unwrap_or(&text)
        .to_string();
    
    let confidence = api_result.get("confidence")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.8);
    
    let used_provider = api_result.get("provider")
        .and_then(|v| v.as_str())
        .unwrap_or(&provider)
        .to_string();
    
    log::info!("✅ Traduzione completata via {} (confidence: {:.0}%)", used_provider, confidence * 100.0);
    
    Ok(serde_json::json!({
        "original_text": text,
        "translated_text": translated_text,
        "provider": used_provider,
        "target_language": target_lang,
        "confidence": confidence,
        "suggestions": api_result.get("suggestions").cloned().unwrap_or(serde_json::json!([])),
        "translated_at": chrono::Utc::now().to_rfc3339()
    }))
}

#[tauri::command]
pub async fn get_translation_suggestions(text: String, context: Option<String>, target_language: Option<String>) -> Result<serde_json::Value, String> {
    log::info!("💡 Recupero suggerimenti traduzione per: '{}'", 
        if text.len() > 50 { format!("{}...", &text[..50]) } else { text.clone() });
    
    let target = target_language.unwrap_or_else(|| "it".to_string());
    let client = reqwest::Client::new();
    
    // Chiedi suggerimenti a più provider in parallelo
    let providers = vec!["libre", "mock"];
    let mut suggestions = Vec::new();
    
    for prov in &providers {
        let mut body = serde_json::json!({
            "text": text,
            "targetLanguage": target,
            "provider": prov
        });
        if let Some(ref ctx) = context {
            body["context"] = serde_json::Value::String(ctx.clone());
        }
        
        match client
            .post("http://127.0.0.1:3199/api/translate")
            .json(&body)
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(data) = resp.json::<serde_json::Value>().await {
                    let translated = data.get("translatedText")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let confidence = data.get("confidence")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.5);
                    
                    if !translated.is_empty() && translated != text {
                        suggestions.push(serde_json::json!({
                            "text": translated,
                            "confidence": confidence,
                            "source": prov
                        }));
                    }
                    
                    // Aggiungi anche le suggestions interne del provider
                    if let Some(sug_arr) = data.get("suggestions").and_then(|v| v.as_array()) {
                        for s in sug_arr.iter().take(2) {
                            if let Some(s_text) = s.as_str() {
                                if !s_text.is_empty() && !s_text.starts_with('⚠') && !s_text.starts_with('💡') && !s_text.starts_with('🔧') {
                                    suggestions.push(serde_json::json!({
                                        "text": s_text,
                                        "confidence": confidence * 0.9,
                                        "source": format!("{}_alt", prov)
                                    }));
                                }
                            }
                        }
                    }
                }
            }
            Ok(resp) => {
                log::warn!("⚠️ Provider {} errore: {}", prov, resp.status());
            }
            Err(e) => {
                log::warn!("⚠️ Provider {} timeout/errore: {}", prov, e);
            }
        }
    }
    
    // Ordina per confidence decrescente
    suggestions.sort_by(|a, b| {
        let ca = a.get("confidence").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let cb = b.get("confidence").and_then(|v| v.as_f64()).unwrap_or(0.0);
        cb.partial_cmp(&ca).unwrap_or(std::cmp::Ordering::Equal)
    });
    
    log::info!("✅ {} suggerimenti generati per: '{}'", suggestions.len(),
        if text.len() > 30 { format!("{}...", &text[..30]) } else { text.clone() });
    
    Ok(serde_json::json!({
        "original_text": text,
        "context": context,
        "target_language": target,
        "suggestions": suggestions,
        "generated_at": chrono::Utc::now().to_rfc3339()
    }))
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
