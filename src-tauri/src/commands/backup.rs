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

// ============================================================================
// AUTO-BACKUP SYSTEM
// ============================================================================

/// Configurazione Auto-Backup
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoBackupConfig {
    pub enabled: bool,
    pub interval_minutes: u32,           // Intervallo in minuti (default 15)
    pub backup_translation_memory: bool,
    pub backup_dictionaries: bool,
    pub backup_settings: bool,
    pub max_backups: u32,                // Numero massimo backup da mantenere
    pub last_backup: Option<String>,     // Timestamp ultimo backup
}

impl Default for AutoBackupConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_minutes: 15,
            backup_translation_memory: true,
            backup_dictionaries: true,
            backup_settings: true,
            max_backups: 20,
            last_backup: None,
        }
    }
}

/// Risultato di un auto-backup
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoBackupResult {
    pub success: bool,
    pub timestamp: String,
    pub files_backed_up: Vec<String>,
    pub total_size_bytes: u64,
    pub error: Option<String>,
}

/// Ottiene il percorso del file di configurazione auto-backup
fn get_autobackup_config_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir()
        .ok_or("Impossibile trovare directory dati")?
        .join("GameStringer");
    
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Errore creazione directory: {}", e))?;
    }
    
    Ok(data_dir.join("autobackup_config.json"))
}

/// Carica configurazione Auto-Backup
#[tauri::command]
pub fn load_autobackup_config() -> Result<AutoBackupConfig, String> {
    let config_path = get_autobackup_config_path()?;
    
    if !config_path.exists() {
        return Ok(AutoBackupConfig::default());
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Errore lettura config: {}", e))?;
    
    serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing config: {}", e))
}

/// Salva configurazione Auto-Backup
#[tauri::command]
pub fn save_autobackup_config(config: AutoBackupConfig) -> Result<(), String> {
    let config_path = get_autobackup_config_path()?;
    
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&config_path, json)
        .map_err(|e| format!("Errore scrittura config: {}", e))
}

/// Esegue un auto-backup completo
#[tauri::command]
pub async fn run_auto_backup() -> Result<AutoBackupResult, String> {
    let config = load_autobackup_config()?;
    let backup_dir = get_backup_dir()?;
    let auto_dir = backup_dir.join("auto");
    
    if !auto_dir.exists() {
        fs::create_dir_all(&auto_dir)
            .map_err(|e| format!("Errore creazione directory auto-backup: {}", e))?;
    }
    
    let timestamp = Utc::now();
    let timestamp_str = timestamp.format("%Y%m%d_%H%M%S").to_string();
    let mut files_backed_up = Vec::new();
    let mut total_size = 0u64;
    
    // 1. Backup Translation Memory
    if config.backup_translation_memory {
        let tm_source = dirs::data_dir()
            .ok_or("Directory dati non trovata")?
            .join("GameStringer")
            .join("translation_memory");
        
        if tm_source.exists() {
            let tm_backup = auto_dir.join(format!("tm_{}.json", timestamp_str));
            
            // Combina tutti i file TM in un unico backup
            let mut combined_tm = serde_json::json!({
                "backup_type": "translation_memory",
                "created_at": timestamp.to_rfc3339(),
                "memories": []
            });
            
            if let Ok(entries) = fs::read_dir(&tm_source) {
                let mut memories = Vec::new();
                for entry in entries.flatten() {
                    if entry.path().extension().map_or(false, |e| e == "json") {
                        if let Ok(content) = fs::read_to_string(entry.path()) {
                            if let Ok(tm) = serde_json::from_str::<serde_json::Value>(&content) {
                                memories.push(tm);
                            }
                        }
                    }
                }
                combined_tm["memories"] = serde_json::json!(memories);
            }
            
            let json = serde_json::to_string_pretty(&combined_tm)
                .map_err(|e| format!("Errore serializzazione TM: {}", e))?;
            
            fs::write(&tm_backup, &json)
                .map_err(|e| format!("Errore scrittura backup TM: {}", e))?;
            
            total_size += json.len() as u64;
            files_backed_up.push(tm_backup.to_string_lossy().to_string());
        }
    }
    
    // 2. Backup Dictionaries
    if config.backup_dictionaries {
        let dict_source = dirs::data_dir()
            .ok_or("Directory dati non trovata")?
            .join("GameStringer")
            .join("dictionaries");
        
        if dict_source.exists() {
            let dict_backup = auto_dir.join(format!("dictionaries_{}.json", timestamp_str));
            
            let mut combined_dict = serde_json::json!({
                "backup_type": "dictionaries",
                "created_at": timestamp.to_rfc3339(),
                "dictionaries": []
            });
            
            if let Ok(entries) = fs::read_dir(&dict_source) {
                let mut dicts = Vec::new();
                for entry in entries.flatten() {
                    if entry.path().extension().map_or(false, |e| e == "json") {
                        if let Ok(content) = fs::read_to_string(entry.path()) {
                            if let Ok(dict) = serde_json::from_str::<serde_json::Value>(&content) {
                                dicts.push(dict);
                            }
                        }
                    }
                }
                combined_dict["dictionaries"] = serde_json::json!(dicts);
            }
            
            let json = serde_json::to_string_pretty(&combined_dict)
                .map_err(|e| format!("Errore serializzazione dizionari: {}", e))?;
            
            fs::write(&dict_backup, &json)
                .map_err(|e| format!("Errore scrittura backup dizionari: {}", e))?;
            
            total_size += json.len() as u64;
            files_backed_up.push(dict_backup.to_string_lossy().to_string());
        }
    }
    
    // 3. Backup Settings
    if config.backup_settings {
        let settings_source = dirs::data_dir()
            .ok_or("Directory dati non trovata")?
            .join("GameStringer")
            .join("profiles");
        
        if settings_source.exists() {
            let settings_backup = auto_dir.join(format!("settings_{}.json", timestamp_str));
            
            let mut combined_settings = serde_json::json!({
                "backup_type": "settings",
                "created_at": timestamp.to_rfc3339(),
                "profiles": []
            });
            
            if let Ok(entries) = fs::read_dir(&settings_source) {
                let mut profiles = Vec::new();
                for entry in entries.flatten() {
                    if entry.path().extension().map_or(false, |e| e == "json") {
                        if let Ok(content) = fs::read_to_string(entry.path()) {
                            if let Ok(profile) = serde_json::from_str::<serde_json::Value>(&content) {
                                profiles.push(profile);
                            }
                        }
                    }
                }
                combined_settings["profiles"] = serde_json::json!(profiles);
            }
            
            let json = serde_json::to_string_pretty(&combined_settings)
                .map_err(|e| format!("Errore serializzazione settings: {}", e))?;
            
            fs::write(&settings_backup, &json)
                .map_err(|e| format!("Errore scrittura backup settings: {}", e))?;
            
            total_size += json.len() as u64;
            files_backed_up.push(settings_backup.to_string_lossy().to_string());
        }
    }
    
    // 4. Aggiorna timestamp ultimo backup
    let mut updated_config = config.clone();
    updated_config.last_backup = Some(timestamp.to_rfc3339());
    save_autobackup_config(updated_config)?;
    
    // 5. Pulizia backup vecchi
    cleanup_auto_backups(&auto_dir, config.max_backups as usize)?;
    
    Ok(AutoBackupResult {
        success: true,
        timestamp: timestamp.to_rfc3339(),
        files_backed_up,
        total_size_bytes: total_size,
        error: None,
    })
}

/// Pulisce i backup automatici vecchi
fn cleanup_auto_backups(dir: &PathBuf, max_backups: usize) -> Result<(), String> {
    let mut files: Vec<_> = fs::read_dir(dir)
        .map_err(|e| format!("Errore lettura directory: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "json"))
        .collect();
    
    // Conta backup per tipo (tm_, dictionaries_, settings_)
    let prefixes = ["tm_", "dictionaries_", "settings_"];
    
    for prefix in &prefixes {
        let mut type_files: Vec<_> = files.iter()
            .filter(|f| f.file_name().to_string_lossy().starts_with(prefix))
            .collect();
        
        if type_files.len() <= max_backups {
            continue;
        }
        
        // Ordina per data modifica (più vecchi prima)
        type_files.sort_by(|a, b| {
            let a_time = a.metadata().and_then(|m| m.modified()).ok();
            let b_time = b.metadata().and_then(|m| m.modified()).ok();
            a_time.cmp(&b_time)
        });
        
        // Rimuovi i più vecchi
        let to_remove = type_files.len() - max_backups;
        for file in type_files.into_iter().take(to_remove) {
            let _ = fs::remove_file(file.path());
        }
    }
    
    Ok(())
}

/// Verifica se è il momento di fare un auto-backup
#[tauri::command]
pub fn should_run_auto_backup() -> Result<bool, String> {
    let config = load_autobackup_config()?;
    
    if !config.enabled {
        return Ok(false);
    }
    
    match &config.last_backup {
        None => Ok(true), // Mai fatto backup
        Some(last) => {
            let last_time = chrono::DateTime::parse_from_rfc3339(last)
                .map_err(|e| format!("Errore parsing data: {}", e))?;
            
            let now = Utc::now();
            let elapsed = now.signed_duration_since(last_time.with_timezone(&Utc));
            let interval = chrono::Duration::minutes(config.interval_minutes as i64);
            
            Ok(elapsed >= interval)
        }
    }
}

/// Ripristina da un backup automatico
#[tauri::command]
pub async fn restore_from_auto_backup(backup_path: String, restore_type: String) -> Result<u32, String> {
    let content = fs::read_to_string(&backup_path)
        .map_err(|e| format!("Errore lettura backup: {}", e))?;
    
    let backup: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing backup: {}", e))?;
    
    let data_dir = dirs::data_dir()
        .ok_or("Directory dati non trovata")?
        .join("GameStringer");
    
    let mut restored = 0u32;
    
    match restore_type.as_str() {
        "translation_memory" => {
            let tm_dir = data_dir.join("translation_memory");
            if !tm_dir.exists() {
                fs::create_dir_all(&tm_dir)
                    .map_err(|e| format!("Errore creazione directory: {}", e))?;
            }
            
            if let Some(memories) = backup.get("memories").and_then(|m| m.as_array()) {
                for (i, mem) in memories.iter().enumerate() {
                    if let Some(src_lang) = mem.get("sourceLanguage").and_then(|l| l.as_str()) {
                        if let Some(tgt_lang) = mem.get("targetLanguage").and_then(|l| l.as_str()) {
                            let filename = format!("tm_{}_{}.json", src_lang.to_lowercase(), tgt_lang.to_lowercase());
                            let filepath = tm_dir.join(&filename);
                            
                            let json = serde_json::to_string_pretty(mem)
                                .map_err(|e| format!("Errore serializzazione: {}", e))?;
                            
                            fs::write(&filepath, json)
                                .map_err(|e| format!("Errore scrittura: {}", e))?;
                            
                            restored += 1;
                        }
                    }
                }
            }
        }
        "dictionaries" => {
            let dict_dir = data_dir.join("dictionaries");
            if !dict_dir.exists() {
                fs::create_dir_all(&dict_dir)
                    .map_err(|e| format!("Errore creazione directory: {}", e))?;
            }
            
            if let Some(dicts) = backup.get("dictionaries").and_then(|d| d.as_array()) {
                for dict in dicts {
                    if let Some(game_id) = dict.get("gameId").and_then(|g| g.as_str()) {
                        let filename = format!("dict_{}.json", game_id);
                        let filepath = dict_dir.join(&filename);
                        
                        let json = serde_json::to_string_pretty(dict)
                            .map_err(|e| format!("Errore serializzazione: {}", e))?;
                        
                        fs::write(&filepath, json)
                            .map_err(|e| format!("Errore scrittura: {}", e))?;
                        
                        restored += 1;
                    }
                }
            }
        }
        "settings" => {
            let profiles_dir = data_dir.join("profiles");
            if !profiles_dir.exists() {
                fs::create_dir_all(&profiles_dir)
                    .map_err(|e| format!("Errore creazione directory: {}", e))?;
            }
            
            if let Some(profiles) = backup.get("profiles").and_then(|p| p.as_array()) {
                for profile in profiles {
                    if let Some(name) = profile.get("name").and_then(|n| n.as_str()) {
                        let filename = format!("{}.json", name);
                        let filepath = profiles_dir.join(&filename);
                        
                        let json = serde_json::to_string_pretty(profile)
                            .map_err(|e| format!("Errore serializzazione: {}", e))?;
                        
                        fs::write(&filepath, json)
                            .map_err(|e| format!("Errore scrittura: {}", e))?;
                        
                        restored += 1;
                    }
                }
            }
        }
        _ => return Err(format!("Tipo di ripristino non valido: {}", restore_type))
    }
    
    Ok(restored)
}

/// Lista backup automatici disponibili
#[tauri::command]
pub fn list_auto_backups() -> Result<Vec<AutoBackupInfo>, String> {
    let backup_dir = get_backup_dir()?;
    let auto_dir = backup_dir.join("auto");
    
    if !auto_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut backups = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&auto_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "json") {
                let filename = path.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                
                let backup_type = if filename.starts_with("tm_") {
                    "translation_memory"
                } else if filename.starts_with("dictionaries_") {
                    "dictionaries"
                } else if filename.starts_with("settings_") {
                    "settings"
                } else {
                    "unknown"
                };
                
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                let created = entry.metadata()
                    .and_then(|m| m.modified().ok())
                    .map(|t| {
                        let dt: DateTime<Utc> = t.into();
                        dt.to_rfc3339()
                    })
                    .unwrap_or_default();
                
                backups.push(AutoBackupInfo {
                    path: path.to_string_lossy().to_string(),
                    filename,
                    backup_type: backup_type.to_string(),
                    size_bytes: size,
                    created_at: created,
                });
            }
        }
    }
    
    // Ordina per data (più recenti prima)
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    Ok(backups)
}

/// Info su un backup automatico
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoBackupInfo {
    pub path: String,
    pub filename: String,
    pub backup_type: String,
    pub size_bytes: u64,
    pub created_at: String,
}
