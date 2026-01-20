//! Comandi Tauri per gestione Unity Asset Bundle
//! Estrazione automatica stringhe da bundle Unity Localization

use tauri::command;
use std::path::{Path, PathBuf};
use std::fs;
use std::process::Command;
use serde::{Serialize, Deserialize};
#[allow(unused_imports)]
use reqwest::Client;
use zip::ZipArchive;
use std::io::{Cursor, Write};

#[allow(unused_imports)]
use gamestringer::unity_bundle::parser::UnityBundle;

#[allow(dead_code)]
const UABEA_URL: &str = "https://github.com/nesrak1/UABEA/releases/download/v8/uabea-windows.zip";
#[allow(dead_code)]
const UABEA_FOLDER: &str = "tools/uabea";

#[derive(Clone, Serialize, Deserialize)]
pub struct BundleInfo {
    pub bundle_path: String,
    pub filename: String,
    pub size_bytes: u64,
    pub locale: Option<String>,
    pub locale_name: Option<String>,
    pub status: String, // "complete", "partial", "empty"
    pub is_string_table: bool,
}

#[derive(Serialize, Deserialize)]
pub struct AnalyzeFolderResult {
    pub success: bool,
    pub message: String,
    pub bundles: Vec<BundleInfo>,
    pub summary: FolderSummary,
}

#[derive(Serialize, Deserialize)]
pub struct FolderSummary {
    pub total_bundles: usize,
    pub complete_locales: Vec<String>,
    pub partial_locales: Vec<String>,
    pub empty_locales: Vec<String>,
    pub max_size: u64,
}

/// Estrae il codice locale dal nome file
fn extract_locale(filename: &str) -> Option<(String, String)> {
    // Pattern: language(code) es. "english(en)", "italian(it)"
    let locale_map = [
        ("english", "en", "English"),
        ("italian", "it", "Italiano"),
        ("german", "de", "Deutsch"),
        ("french", "fr", "Français"),
        ("spanish", "es", "Español"),
        ("russian", "ru", "Русский"),
        ("japanese", "ja", "日本語"),
        ("korean", "ko", "한국어"),
        ("chinese", "zh", "中文"),
        ("portuguese", "pt", "Português"),
        ("polish", "pl", "Polski"),
        ("turkish", "tr", "Türkçe"),
        ("ukrainian", "uk", "Українська"),
        ("belarusian", "be", "Беларуская"),
        ("dutch", "nl", "Nederlands"),
        ("swedish", "sv", "Svenska"),
        ("arabic", "ar", "العربية"),
    ];
    
    let lower = filename.to_lowercase();
    
    for (lang, code, name) in locale_map {
        if lower.contains(lang) || lower.contains(&format!("({})", code)) {
            return Some((code.to_string(), name.to_string()));
        }
    }
    
    // Prova a estrarre da pattern (xx) o (xx-yy)
    if let Some(start) = filename.find('(') {
        if let Some(end) = filename[start..].find(')') {
            let code = &filename[start + 1..start + end];
            if code.len() >= 2 && code.len() <= 7 {
                return Some((code.to_lowercase(), code.to_uppercase()));
            }
        }
    }
    
    None
}

/// Analizza tutti i bundle di localizzazione in una cartella
#[command]
pub async fn analyze_localization_bundles(folder_path: String) -> AnalyzeFolderResult {
    let path = Path::new(&folder_path);
    
    println!("[UNITY_BUNDLE] Analisi cartella: {}", folder_path);
    
    if !path.exists() || !path.is_dir() {
        return AnalyzeFolderResult {
            success: false,
            message: format!("Cartella non trovata: {}", folder_path),
            bundles: Vec::new(),
            summary: FolderSummary {
                total_bundles: 0,
                complete_locales: Vec::new(),
                partial_locales: Vec::new(),
                empty_locales: Vec::new(),
                max_size: 0,
            },
        };
    }
    
    let entries = match fs::read_dir(path) {
        Ok(e) => e,
        Err(e) => return AnalyzeFolderResult {
            success: false,
            message: format!("Errore lettura cartella: {}", e),
            bundles: Vec::new(),
            summary: FolderSummary {
                total_bundles: 0,
                complete_locales: Vec::new(),
                partial_locales: Vec::new(),
                empty_locales: Vec::new(),
                max_size: 0,
            },
        },
    };
    
    let mut bundles = Vec::new();
    let mut max_size: u64 = 0;
    
    for entry in entries.filter_map(|e| e.ok()) {
        let file_path = entry.path();
        
        if !file_path.is_file() {
            continue;
        }
        
        let filename = file_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        
        // Filtra solo bundle di string-tables (quelli con le traduzioni)
        let is_string_table = filename.contains("string-table");
        let is_localization = filename.contains("localization") && filename.ends_with(".bundle");
        
        if !is_localization {
            continue;
        }
        
        let size = fs::metadata(&file_path)
            .map(|m| m.len())
            .unwrap_or(0);
        
        if is_string_table && size > max_size {
            max_size = size;
        }
        
        let (locale, locale_name) = extract_locale(&filename)
            .map(|(c, n)| (Some(c), Some(n)))
            .unwrap_or((None, None));
        
        bundles.push(BundleInfo {
            bundle_path: file_path.to_string_lossy().to_string(),
            filename,
            size_bytes: size,
            locale,
            locale_name,
            status: String::new(), // Calcolato dopo
            is_string_table,
        });
    }
    
    // Calcola status basato sulla dimensione relativa (solo per string-tables)
    let threshold_complete = (max_size as f64 * 0.8) as u64;
    let threshold_partial = 10_000; // 10KB minimo per essere parziale
    
    let mut complete = Vec::new();
    let mut partial = Vec::new();
    let mut empty = Vec::new();
    
    for bundle in &mut bundles {
        if bundle.is_string_table {
            bundle.status = if bundle.size_bytes >= threshold_complete {
                "complete".to_string()
            } else if bundle.size_bytes >= threshold_partial {
                "partial".to_string()
            } else {
                "empty".to_string()
            };
            
            if let Some(ref locale) = bundle.locale {
                match bundle.status.as_str() {
                    "complete" => {
                        if !complete.contains(locale) {
                            complete.push(locale.clone());
                        }
                    },
                    "partial" => {
                        if !partial.contains(locale) {
                            partial.push(locale.clone());
                        }
                    },
                    "empty" => {
                        if !empty.contains(locale) {
                            empty.push(locale.clone());
                        }
                    },
                    _ => {}
                }
            }
        }
    }
    
    // Filtra solo string-tables per l'output
    let string_table_bundles: Vec<_> = bundles.into_iter()
        .filter(|b| b.is_string_table)
        .collect();
    
    let bundle_count = string_table_bundles.len();
    
    println!("[UNITY_BUNDLE] Trovati {} string-table bundles", bundle_count);
    println!("[UNITY_BUNDLE] Completi: {:?}", complete);
    println!("[UNITY_BUNDLE] Parziali: {:?}", partial);
    println!("[UNITY_BUNDLE] Vuoti: {:?}", empty);
    
    AnalyzeFolderResult {
        success: true,
        message: format!("Trovati {} bundle string-table", bundle_count),
        bundles: string_table_bundles,
        summary: FolderSummary {
            total_bundles: bundle_count,
            complete_locales: complete,
            partial_locales: partial,
            empty_locales: empty,
            max_size,
        },
    }
}

/// Rileva automaticamente la cartella dei bundle di localizzazione di un gioco Unity
#[command]
pub async fn detect_localization_folder(game_path: String) -> Result<Option<String>, String> {
    let game_dir = Path::new(&game_path);
    
    if !game_dir.exists() {
        return Err("Percorso gioco non valido".to_string());
    }
    
    // Cerca cartella _Data
    let data_folder = fs::read_dir(game_dir)
        .map_err(|e| format!("Errore lettura cartella: {}", e))?
        .filter_map(|e| e.ok())
        .find(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.ends_with("_Data") && e.path().is_dir()
        });
    
    let data_folder = match data_folder {
        Some(f) => f.path(),
        None => return Ok(None),
    };
    
    // Percorsi comuni per bundle di localizzazione
    let possible_paths = [
        data_folder.join("StreamingAssets/aa/StandaloneWindows64"),
        data_folder.join("StreamingAssets/aa/StandaloneWindows"),
        data_folder.join("StreamingAssets/Localization"),
        data_folder.join("StreamingAssets/Bundles"),
    ];
    
    for path in &possible_paths {
        if path.exists() && path.is_dir() {
            let has_localization = fs::read_dir(path)
                .ok()
                .map(|entries| {
                    entries.filter_map(|e| e.ok()).any(|e| {
                        let name = e.file_name().to_string_lossy().to_string();
                        name.contains("localization") || name.contains("string-table")
                    })
                })
                .unwrap_or(false);
            
            if has_localization {
                return Ok(Some(path.to_string_lossy().to_string()));
            }
        }
    }
    
    Ok(None)
}

// ==================== INTEGRAZIONE UABEA ====================

#[derive(Serialize, Deserialize)]
pub struct UabeaStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ExtractResult {
    pub success: bool,
    pub message: String,
    pub output_file: Option<String>,
    pub entry_count: usize,
}

#[derive(Serialize, Deserialize)]
pub struct ImportResult {
    pub success: bool,
    pub message: String,
    pub output_bundle: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct StringEntry {
    pub key: String,
    pub value: String,
    pub translated: Option<String>,
}

/// Ottiene il percorso della cartella tools
#[allow(dead_code)]
fn get_tools_dir() -> std::path::PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    
    // In dev, usa la cartella del progetto
    if cfg!(debug_assertions) {
        PathBuf::from("../gamestringer_data/tools")
    } else {
        exe_dir.join("tools")
    }
}

/// Verifica se UABEA è installato
#[allow(dead_code)]
#[command]
pub async fn check_uabea_status() -> UabeaStatus {
    let tools_dir = get_tools_dir();
    let uabea_exe = tools_dir.join("uabea").join("UABEAvalonia.exe");
    
    if uabea_exe.exists() {
        UabeaStatus {
            installed: true,
            path: Some(uabea_exe.to_string_lossy().to_string()),
            version: Some("8.0".to_string()),
        }
    } else {
        UabeaStatus {
            installed: false,
            path: None,
            version: None,
        }
    }
}

/// Scarica e installa UABEA
#[allow(dead_code)]
#[command]
pub async fn install_uabea() -> Result<UabeaStatus, String> {
    let tools_dir = get_tools_dir();
    let uabea_dir = tools_dir.join("uabea");
    
    println!("[UABEA] Download da: {}", UABEA_URL);
    
    // Crea directory
    fs::create_dir_all(&uabea_dir)
        .map_err(|e| format!("Errore creazione cartella: {}", e))?;
    
    // Scarica ZIP
    let client = Client::new();
    let response = client.get(UABEA_URL)
        .send()
        .await
        .map_err(|e| format!("Errore download: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Download fallito: {}", response.status()));
    }
    
    let bytes = response.bytes()
        .await
        .map_err(|e| format!("Errore lettura dati: {}", e))?;
    
    println!("[UABEA] Scaricati {} bytes, estrazione...", bytes.len());
    
    // Estrai ZIP
    let cursor = Cursor::new(bytes.to_vec());
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| format!("Errore apertura ZIP: {}", e))?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Errore lettura ZIP: {}", e))?;
        
        let outpath = uabea_dir.join(file.name());
        
        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).ok();
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).ok();
            }
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| format!("Errore creazione file: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Errore estrazione: {}", e))?;
        }
    }
    
    println!("[UABEA] Installazione completata");
    
    Ok(UabeaStatus {
        installed: true,
        path: Some(uabea_dir.join("UABEAvalonia.exe").to_string_lossy().to_string()),
        version: Some("8.0".to_string()),
    })
}

/// Apre la cartella UABEA in Explorer (UABEA ha bug quando lanciato da altre app)
#[allow(dead_code)]
#[command]
pub async fn open_uabea_with_bundle(bundle_path: String) -> Result<String, String> {
    let tools_dir = get_tools_dir();
    let uabea_dir = tools_dir.join("uabea");
    
    let uabea_abs = fs::canonicalize(&uabea_dir)
        .map_err(|_| "UABEA non installato".to_string())?;
    
    println!("[UABEA] Aprendo cartella: {:?}", uabea_abs);
    println!("[UABEA] Bundle da aprire: {}", bundle_path);
    
    // Apri Explorer nella cartella UABEA
    #[cfg(windows)]
    Command::new("explorer")
        .arg(&uabea_abs)
        .spawn()
        .map_err(|e| format!("Errore apertura cartella: {}", e))?;
    
    Ok(format!("Cartella UABEA aperta.\n\n1. Lancia UABEAvalonia.exe\n2. File → Open → Seleziona:\n{}\n3. Export Dump sulla StringTable", bundle_path))
}

/// Importa stringhe da file JSON esportato manualmente da UABEA
#[allow(dead_code)]
#[command]
pub async fn import_uabea_export(export_path: String) -> ExtractResult {
    let path = Path::new(&export_path);
    
    if !path.exists() {
        return ExtractResult {
            success: false,
            message: "File non trovato".to_string(),
            output_file: None,
            entry_count: 0,
        };
    }
    
    // Se è una cartella, cerca tutti i .txt
    let entries = if path.is_dir() {
        parse_exported_dumps(&export_path)
    } else {
        // Se è un singolo file
        match fs::read_to_string(path) {
            Ok(content) => parse_dump_content(&content),
            Err(e) => return ExtractResult {
                success: false,
                message: format!("Errore lettura: {}", e),
                output_file: None,
                entry_count: 0,
            }
        }
    };
    
    let entry_count = entries.len();
    
    // Salva come JSON
    let output_file = if path.is_dir() {
        path.join("strings_export.json")
    } else {
        path.with_extension("json")
    };
    
    let json = serde_json::to_string_pretty(&entries)
        .unwrap_or_else(|_| "[]".to_string());
    
    if let Err(e) = fs::write(&output_file, &json) {
        return ExtractResult {
            success: false,
            message: format!("Errore scrittura: {}", e),
            output_file: None,
            entry_count: 0,
        };
    }
    
    ExtractResult {
        success: true,
        message: format!("Importate {} stringhe", entry_count),
        output_file: Some(output_file.to_string_lossy().to_string()),
        entry_count,
    }
}

#[allow(dead_code)]
fn parse_dump_content(content: &str) -> Vec<StringEntry> {
    let mut entries = Vec::new();
    let mut current_key = String::new();
    
    for line in content.lines() {
        let trimmed = line.trim();
        
        // Cerca pattern: "N string m_Key = "valore""
        // oppure "N string m_Value = "valore""  
        // oppure "N string m_Data = "valore""
        if trimmed.contains("string") && trimmed.contains(" = ") {
            if let Some(eq_pos) = trimmed.find(" = ") {
                let value_part = &trimmed[eq_pos + 3..];
                let clean_value = value_part.trim().trim_matches('"').to_string();
                
                // Estrai il nome del campo
                let field_part = &trimmed[..eq_pos];
                
                if field_part.contains("m_Key") || field_part.contains("m_Id") {
                    current_key = clean_value;
                } else if (field_part.contains("m_Value") || field_part.contains("m_Data") || 
                          field_part.contains("m_Text") || field_part.contains("m_String")) 
                          && !clean_value.is_empty() {
                    // Questa è una stringa traducibile
                    let key = if current_key.is_empty() {
                        format!("string_{}", entries.len())
                    } else {
                        current_key.clone()
                    };
                    
                    entries.push(StringEntry {
                        key,
                        value: clean_value,
                        translated: None,
                    });
                    current_key.clear();
                }
            }
        }
    }
    
    entries
}

/// Parsa i file dump esportati da UABEA
#[allow(dead_code)]
fn parse_exported_dumps(output_dir: &str) -> Vec<StringEntry> {
    let mut entries = Vec::new();
    let dir = Path::new(output_dir);
    
    if let Ok(files) = fs::read_dir(dir) {
        for entry in files.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map(|e| e == "txt").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    // Parsa formato UABEA dump (chiave = valore)
                    for line in content.lines() {
                        if let Some((key, value)) = line.split_once(" = ") {
                            entries.push(StringEntry {
                                key: key.trim().to_string(),
                                value: value.trim_matches('"').to_string(),
                                translated: None,
                            });
                        }
                    }
                }
            }
        }
    }
    
    entries
}

/// Reimporta le stringhe tradotte in un bundle
#[allow(dead_code)]
#[command]
pub async fn import_translated_strings(
    source_bundle: String,
    translations_json: String,
    output_bundle: String,
) -> ImportResult {
    let tools_dir = get_tools_dir();
    let uabea_exe = tools_dir.join("uabea").join("UABEAvalonia.exe");
    
    if !uabea_exe.exists() {
        return ImportResult {
            success: false,
            message: "UABEA non installato".to_string(),
            output_bundle: None,
        };
    }
    
    // Leggi traduzioni
    let translations: Vec<StringEntry> = match fs::read_to_string(&translations_json) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(e) => return ImportResult {
            success: false,
            message: format!("Errore lettura traduzioni: {}", e),
            output_bundle: None,
        }
    };
    
    if translations.is_empty() {
        return ImportResult {
            success: false,
            message: "Nessuna traduzione trovata nel file".to_string(),
            output_bundle: None,
        };
    }
    
    println!("[UABEA] Importazione {} stringhe in: {}", translations.len(), output_bundle);
    
    // Copia bundle sorgente come base
    if let Err(e) = fs::copy(&source_bundle, &output_bundle) {
        return ImportResult {
            success: false,
            message: format!("Errore copia bundle: {}", e),
            output_bundle: None,
        };
    }
    
    // Crea file di import per UABEA
    let temp_dir = std::env::temp_dir().join("gamestringer_import");
    fs::create_dir_all(&temp_dir).ok();
    
    let import_file = temp_dir.join("translations.txt");
    let mut file = match fs::File::create(&import_file) {
        Ok(f) => f,
        Err(e) => return ImportResult {
            success: false,
            message: format!("Errore creazione file import: {}", e),
            output_bundle: None,
        }
    };
    
    // Scrivi nel formato UABEA
    for entry in &translations {
        if let Some(ref translated) = entry.translated {
            writeln!(file, "{} = \"{}\"", entry.key, translated).ok();
        }
    }
    
    // Esegui UABEA batchimport
    let result = Command::new(&uabea_exe)
        .args(&["batchimportdump", &output_bundle, temp_dir.to_str().unwrap_or(".")])
        .output();
    
    match result {
        Ok(output) => {
            if output.status.success() {
                ImportResult {
                    success: true,
                    message: format!("Importate {} stringhe", translations.len()),
                    output_bundle: Some(output_bundle),
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                ImportResult {
                    success: false,
                    message: format!("UABEA errore: {}", stderr),
                    output_bundle: None,
                }
            }
        }
        Err(e) => ImportResult {
            success: false,
            message: format!("Errore esecuzione UABEA: {}", e),
            output_bundle: None,
        }
    }
}

/// Legge le stringhe estratte da un file JSON
#[command]
pub async fn read_extracted_strings(json_path: String) -> Result<Vec<StringEntry>, String> {
    let content = fs::read_to_string(&json_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))
}

/// Salva le stringhe tradotte in un file JSON
#[command]
pub async fn save_translated_strings(json_path: String, entries: Vec<StringEntry>) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&entries)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&json_path, json)
        .map_err(|e| format!("Errore scrittura: {}", e))
}

/// Estrae stringhe automaticamente da un bundle Unity (lettura diretta)
#[command]
pub async fn extract_strings_auto(bundle_path: String) -> ExtractResult {
    println!("[UNITY] Estrazione automatica da: {}", bundle_path);
    
    let path = Path::new(&bundle_path);
    if !path.exists() {
        return ExtractResult {
            success: false,
            message: format!("Bundle non trovato: {}", bundle_path),
            output_file: None,
            entry_count: 0,
        };
    }
    
    // Leggi file raw e cerca stringhe direttamente
    let data = match fs::read(&path) {
        Ok(d) => d,
        Err(e) => return ExtractResult {
            success: false,
            message: format!("Errore lettura file: {}", e),
            output_file: None,
            entry_count: 0,
        }
    };
    
    println!("[UNITY] File size: {} bytes", data.len());
    
    // Estrai stringhe cercando pattern length-prefixed
    let entries = extract_strings_from_raw(&data);
    let count = entries.len();
    
    println!("[UNITY] Estratte {} stringhe", count);
    
    if count == 0 {
        return ExtractResult {
            success: false,
            message: "Nessuna stringa trovata nel bundle".to_string(),
            output_file: None,
            entry_count: 0,
        };
    }
    
    // Salva JSON
    let output_path = path.with_extension("strings.json");
    let json = serde_json::to_string_pretty(&entries)
        .unwrap_or_else(|_| "[]".to_string());
    
    if let Err(e) = fs::write(&output_path, &json) {
        return ExtractResult {
            success: false,
            message: format!("Errore salvataggio: {}", e),
            output_file: None,
            entry_count: 0,
        };
    }
    
    ExtractResult {
        success: true,
        message: format!("Estratte {} stringhe", count),
        output_file: Some(output_path.to_string_lossy().to_string()),
        entry_count: count,
    }
}

/// Salva file dump per UABEA
#[command]
pub async fn save_uabea_dump(path: String, content: String) -> Result<String, String> {
    fs::write(&path, &content)
        .map_err(|e| format!("Errore salvataggio: {}", e))?;
    Ok(format!("File salvato: {}", path))
}

/// Apre UABEA
#[command]
pub async fn open_uabea() -> Result<String, String> {
    // Usa path assoluto - current_dir() non funziona in Tauri
    let uabea_path = PathBuf::from(r"C:\dev\GameStringer\tools\UABEA\UABEAvalonia.exe");
    
    println!("[UABEA] Tentativo apertura: {:?}", uabea_path);
    
    if !uabea_path.exists() {
        return Err(format!("UABEA non trovato in: {:?}", uabea_path));
    }
    
    std::process::Command::new(&uabea_path)
        .spawn()
        .map_err(|e| format!("Errore apertura UABEA: {}", e))?;
    
    Ok("UABEA aperto".to_string())
}

/// Crea bundle tradotto sostituendo stringhe EN con IT
#[command]
pub async fn create_translated_bundle(
    source_bundle: String,
    translations_json: String,
    output_path: String
) -> Result<String, String> {
    println!("[UNITY] Creazione bundle tradotto");
    println!("[UNITY] Sorgente: {}", source_bundle);
    println!("[UNITY] Traduzioni: {}", translations_json);
    println!("[UNITY] Output: {}", output_path);
    
    // Leggi traduzioni
    let translations_content = fs::read_to_string(&translations_json)
        .map_err(|e| format!("Errore lettura traduzioni: {}", e))?;
    
    let translations: Vec<StringEntry> = serde_json::from_str(&translations_content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    // Leggi bundle sorgente
    let mut data = fs::read(&source_bundle)
        .map_err(|e| format!("Errore lettura bundle: {}", e))?;
    
    let mut replaced = 0;
    
    // Per ogni traduzione, cerca e sostituisci nel bundle
    // Le traduzioni sono già della lunghezza corretta (Length-Constrained AI Translation)
    for entry in &translations {
        if let Some(translated) = &entry.translated {
            if translated != &entry.value && !translated.is_empty() {
                let translated_bytes = translated.as_bytes();
                
                if let Some(pos) = find_string_in_bundle(&data, &entry.value) {
                    // Verifica lunghezza e sostituisci
                    let original_len = entry.value.as_bytes().len();
                    if translated_bytes.len() == original_len {
                        data[pos..pos + translated_bytes.len()].copy_from_slice(translated_bytes);
                        replaced += 1;
                    } else {
                        println!("[UNITY] Skip {}: len {} != {}", entry.key, translated_bytes.len(), original_len);
                    }
                }
            }
        }
    }
    
    // Salva bundle modificato
    fs::write(&output_path, &data)
        .map_err(|e| format!("Errore salvataggio: {}", e))?;
    
    Ok(format!("Bundle creato con {} stringhe sostituite.\nSalvato in: {}", replaced, output_path))
}

/// Trova una stringa nel bundle (cerca il pattern length + string)
fn find_string_in_bundle(data: &[u8], search: &str) -> Option<usize> {
    let search_bytes = search.as_bytes();
    let len = search_bytes.len();
    let len_bytes = (len as u32).to_le_bytes();
    
    // Cerca pattern: length (4 bytes) + string
    for i in 0..data.len().saturating_sub(4 + len) {
        if data[i..i+4] == len_bytes && data[i+4..i+4+len] == *search_bytes {
            return Some(i + 4); // Ritorna posizione della stringa (dopo il length)
        }
    }
    None
}

/// Estrae stringhe da dati raw cercando pattern comuni Unity
fn extract_strings_from_raw(data: &[u8]) -> Vec<StringEntry> {
    let mut entries = Vec::new();
    let mut seen = std::collections::HashSet::new();
    
    // Pattern 1: Cerca stringhe length-prefixed (4 bytes LE)
    let mut i = 0;
    while i + 4 < data.len() {
        let len = u32::from_le_bytes([data[i], data[i+1], data[i+2], data[i+3]]) as usize;
        
        if len >= 2 && len <= 2000 && i + 4 + len <= data.len() {
            let str_data = &data[i + 4..i + 4 + len];
            
            if let Ok(s) = std::str::from_utf8(str_data) {
                if is_valid_game_string(s) && !seen.contains(s) {
                    seen.insert(s.to_string());
                    entries.push(StringEntry {
                        key: format!("str_{:06x}", i),
                        value: s.to_string(),
                        translated: None,
                    });
                }
            }
            i += 4 + len;
            let padding = (4 - (len % 4)) % 4;
            i += padding;
        } else {
            i += 1;
        }
    }
    
    // Pattern 2: Cerca stringhe null-terminated (comune in Unity)
    let mut start = 0;
    for i in 0..data.len() {
        if data[i] == 0 {
            if i > start && i - start >= 5 && i - start <= 2000 {
                if let Ok(s) = std::str::from_utf8(&data[start..i]) {
                    if is_valid_game_string(s) && !seen.contains(s) {
                        seen.insert(s.to_string());
                        entries.push(StringEntry {
                            key: format!("nul_{:06x}", start),
                            value: s.to_string(),
                            translated: None,
                        });
                    }
                }
            }
            start = i + 1;
        }
    }
    
    println!("[UNITY] Estratte {} stringhe uniche", entries.len());
    
    // Ordina per lunghezza
    entries.sort_by(|a, b| b.value.len().cmp(&a.value.len()));
    entries
}

/// Verifica se una stringa è testo di gioco valido
fn is_valid_game_string(s: &str) -> bool {
    // Deve avere lettere
    if !s.chars().any(|c| c.is_alphabetic()) {
        return false;
    }
    
    // No caratteri di controllo
    if s.chars().any(|c| c.is_control() && c != '\n' && c != '\r' && c != '\t') {
        return false;
    }
    
    // Escludi path e metadata Unity
    let excludes = [
        "Assets/", "CAB-", ".asset", ".bundle", "UnityFS", 
        "m_Script", "m_Name", "m_GameObject", "PPtr<",
        "guid:", "fileID:", "type:", "Assembly-CSharp"
    ];
    if excludes.iter().any(|e| s.contains(e)) {
        return false;
    }
    
    // Escludi se troppi caratteri speciali (probabilmente dati binari)
    let printable = s.chars().filter(|c| 
        c.is_alphanumeric() || c.is_whitespace() || 
        ".,!?'-:;\"()[]{}…".contains(*c)
    ).count();
    
    printable > s.len() * 2 / 3
}
