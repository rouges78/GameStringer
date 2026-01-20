use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc};

/// Dati esportabili del profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileExport {
    pub version: String,
    pub exported_at: String,
    pub profile_name: String,
    pub settings: serde_json::Value,
    pub translation_memory: Option<Vec<TranslationMemoryEntry>>,
    pub game_dictionaries: Option<Vec<GameDictionary>>,
    pub api_keys: Option<ApiKeysExport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationMemoryEntry {
    pub source: String,
    pub target: String,
    pub source_lang: String,
    pub target_lang: String,
    pub context: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameDictionary {
    pub game_id: String,
    pub game_name: String,
    pub entries: Vec<DictionaryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictionaryEntry {
    pub term: String,
    pub translation: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeysExport {
    pub has_openai: bool,
    pub has_anthropic: bool,
    pub has_steam: bool,
}

/// Statistiche del backup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupStats {
    pub total_backups: u32,
    pub total_size_mb: f64,
    pub oldest_backup: Option<String>,
    pub newest_backup: Option<String>,
}

/// Ottiene la directory dei backup
fn get_backup_dir() -> Result<PathBuf, String> {
    let backup_dir = if cfg!(debug_assertions) {
        PathBuf::from("../gamestringer_data/backups")
    } else {
        dirs::data_dir()
            .ok_or("Impossibile trovare directory dati")?
            .join("GameStringer")
            .join("backups")
    };
    
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Errore creazione directory backup: {}", e))?;
    }
    
    Ok(backup_dir)
}

/// Esporta le impostazioni del profilo in un file JSON
#[tauri::command]
pub async fn export_profile_settings(
    profile_name: String,
    include_tm: bool,
    include_dictionaries: bool,
    include_api_status: bool,
) -> Result<String, String> {
    let backup_dir = get_backup_dir()?;
    
    // Crea nome file con timestamp
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let filename = format!("{}_{}.json", profile_name, timestamp);
    let filepath = backup_dir.join(&filename);
    
    // Costruisci export
    let export = ProfileExport {
        version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: Utc::now().to_rfc3339(),
        profile_name: profile_name.clone(),
        settings: serde_json::json!({
            "exported": true,
            "profile": profile_name,
        }),
        translation_memory: if include_tm { Some(vec![]) } else { None },
        game_dictionaries: if include_dictionaries { Some(vec![]) } else { None },
        api_keys: if include_api_status {
            Some(ApiKeysExport {
                has_openai: false,
                has_anthropic: false,
                has_steam: false,
            })
        } else {
            None
        },
    };
    
    // Serializza e salva
    let json = serde_json::to_string_pretty(&export)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&filepath, &json)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    Ok(filepath.to_string_lossy().to_string())
}

/// Importa impostazioni profilo da file JSON
#[tauri::command]
pub async fn import_profile_settings(filepath: String) -> Result<ProfileExport, String> {
    let content = fs::read_to_string(&filepath)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let export: ProfileExport = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    Ok(export)
}

/// Crea backup automatico della Translation Memory
#[tauri::command]
pub async fn backup_translation_memory() -> Result<String, String> {
    let backup_dir = get_backup_dir()?;
    let tm_backup_dir = backup_dir.join("translation_memory");
    
    if !tm_backup_dir.exists() {
        fs::create_dir_all(&tm_backup_dir)
            .map_err(|e| format!("Errore creazione directory TM backup: {}", e))?;
    }
    
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let filename = format!("tm_backup_{}.json", timestamp);
    let filepath = tm_backup_dir.join(&filename);
    
    // Per ora creiamo un backup vuoto - sarà popolato dal sistema TM
    let backup_data = serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "created_at": Utc::now().to_rfc3339(),
        "entries": []
    });
    
    let json = serde_json::to_string_pretty(&backup_data)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&filepath, &json)
        .map_err(|e| format!("Errore scrittura backup: {}", e))?;
    
    // Pulisci backup vecchi (mantieni ultimi 10)
    cleanup_old_backups(&tm_backup_dir, 10)?;
    
    Ok(filepath.to_string_lossy().to_string())
}

/// Pulisce backup vecchi mantenendo solo gli ultimi N
fn cleanup_old_backups(dir: &PathBuf, keep: usize) -> Result<(), String> {
    let mut files: Vec<_> = fs::read_dir(dir)
        .map_err(|e| format!("Errore lettura directory: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "json"))
        .collect();
    
    if files.len() <= keep {
        return Ok(());
    }
    
    // Ordina per data modifica (più vecchi prima)
    files.sort_by(|a, b| {
        let a_time = a.metadata().and_then(|m| m.modified()).ok();
        let b_time = b.metadata().and_then(|m| m.modified()).ok();
        a_time.cmp(&b_time)
    });
    
    // Rimuovi i più vecchi
    let to_remove = files.len() - keep;
    for file in files.into_iter().take(to_remove) {
        let _ = fs::remove_file(file.path());
    }
    
    Ok(())
}

/// Ottiene statistiche sui backup
#[tauri::command]
pub fn get_backup_stats() -> Result<BackupStats, String> {
    let backup_dir = get_backup_dir()?;
    
    let mut total_backups = 0u32;
    let mut total_size = 0u64;
    let mut oldest: Option<std::time::SystemTime> = None;
    let mut newest: Option<std::time::SystemTime> = None;
    
    fn scan_dir(dir: &PathBuf, total: &mut u32, size: &mut u64, oldest: &mut Option<std::time::SystemTime>, newest: &mut Option<std::time::SystemTime>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    scan_dir(&path, total, size, oldest, newest);
                } else if path.extension().map_or(false, |e| e == "json") {
                    if let Ok(metadata) = entry.metadata() {
                        *total += 1;
                        *size += metadata.len();
                        
                        if let Ok(modified) = metadata.modified() {
                            match oldest {
                                None => *oldest = Some(modified),
                                Some(ref o) if modified < *o => *oldest = Some(modified),
                                _ => {}
                            }
                            match newest {
                                None => *newest = Some(modified),
                                Some(ref n) if modified > *n => *newest = Some(modified),
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
    }
    
    scan_dir(&backup_dir, &mut total_backups, &mut total_size, &mut oldest, &mut newest);
    
    let format_time = |t: std::time::SystemTime| -> String {
        let datetime: DateTime<Utc> = t.into();
        datetime.format("%Y-%m-%d %H:%M").to_string()
    };
    
    Ok(BackupStats {
        total_backups,
        total_size_mb: total_size as f64 / 1_048_576.0,
        oldest_backup: oldest.map(format_time),
        newest_backup: newest.map(format_time),
    })
}

/// Lista tutti i backup disponibili
#[tauri::command]
pub fn list_backups() -> Result<Vec<String>, String> {
    let backup_dir = get_backup_dir()?;
    let mut backups = Vec::new();
    
    fn collect_files(dir: &PathBuf, files: &mut Vec<String>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    collect_files(&path, files);
                } else if path.extension().map_or(false, |e| e == "json") {
                    files.push(path.to_string_lossy().to_string());
                }
            }
        }
    }
    
    collect_files(&backup_dir, &mut backups);
    backups.sort_by(|a, b| b.cmp(a)); // Più recenti prima
    
    Ok(backups)
}

/// Elimina un backup specifico
#[tauri::command]
pub fn delete_backup(filepath: String) -> Result<(), String> {
    fs::remove_file(&filepath)
        .map_err(|e| format!("Errore eliminazione backup: {}", e))
}
