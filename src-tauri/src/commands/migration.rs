// Comandi Tauri per migrazione credenziali legacy
use crate::commands::profiles::ProfileManagerState;
use crate::commands::profile_settings::ProfileSettingsManagerState;
use crate::profiles::manager::{LegacyMigrationResult, LegacyCredentialInfo, LegacySettingsInfo, LegacySettingsMigrationResult};
use serde::{Deserialize, Serialize};
use tauri::{command, State};

/// Risposta generica per operazioni migrazione
#[derive(Debug, Serialize)]
pub struct MigrationResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> MigrationResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}

/// Verifica se esistono credenziali legacy da migrare
#[command]
pub async fn check_legacy_credentials(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<MigrationResponse<bool>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.has_legacy_credentials().await {
        Ok(has_legacy) => Ok(MigrationResponse::success(has_legacy)),
        Err(err) => Ok(MigrationResponse::error(format!("Errore verifica credenziali legacy: {}", err))),
    }
}

/// Ottiene informazioni sulle credenziali legacy disponibili
#[command]
pub async fn get_legacy_credentials_info(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<MigrationResponse<Vec<LegacyCredentialInfo>>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.get_legacy_credentials_info().await {
        Ok(info) => Ok(MigrationResponse::success(info)),
        Err(err) => Ok(MigrationResponse::error(format!("Errore info credenziali legacy: {}", err))),
    }
}

/// Migra tutte le credenziali legacy al profilo attivo
#[command]
pub async fn migrate_legacy_credentials_wizard(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<MigrationResponse<LegacyMigrationResult>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    // Verifica che ci sia un profilo attivo
    if !manager.is_profile_active() {
        return Ok(MigrationResponse::error("Nessun profilo attivo per la migrazione".to_string()));
    }
    
    match manager.migrate_legacy_credentials().await {
        Ok(result) => {
            println!("[MIGRATION] ✅ Migrazione completata: {} successi, {} fallimenti", 
                     result.total_migrated, result.total_failed);
            Ok(MigrationResponse::success(result))
        },
        Err(err) => {
            println!("[MIGRATION] ❌ Errore migrazione: {}", err);
            Ok(MigrationResponse::error(format!("Errore migrazione: {}", err)))
        }
    }
}

/// Crea backup delle credenziali legacy prima della migrazione
#[command]
pub async fn backup_legacy_credentials(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<MigrationResponse<String>, String> {
    let manager = profile_state.manager.lock().await;
    
    // Verifica se esistono credenziali legacy
    match manager.has_legacy_credentials().await {
        Ok(false) => {
            return Ok(MigrationResponse::error("Nessuna credenziale legacy trovata".to_string()));
        }
        Ok(true) => {
            // Crea backup
            match create_legacy_backup().await {
                Ok(backup_path) => {
                    Ok(MigrationResponse::success(format!("Backup creato: {}", backup_path)))
                }
                Err(err) => {
                    Ok(MigrationResponse::error(format!("Errore creazione backup: {}", err)))
                }
            }
        }
        Err(err) => {
            Ok(MigrationResponse::error(format!("Errore verifica credenziali: {}", err)))
        }
    }
}

/// Crea backup delle credenziali legacy
async fn create_legacy_backup() -> Result<String, String> {
    let app_data = std::env::var("APPDATA")
        .map_err(|_| "APPDATA environment variable not found".to_string())?;
    
    let app_dir = std::path::Path::new(&app_data).join("GameStringer");
    let credentials_path = app_dir.join("steam_credentials.json");
    
    if !credentials_path.exists() {
        return Err("File credenziali Steam non trovato".to_string());
    }
    
    // Crea nome backup con timestamp
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let backup_filename = format!("steam_credentials_backup_{}.json", timestamp);
    let backup_path = app_dir.join("backups").join(backup_filename);
    
    // Crea directory backup se non esiste
    if let Some(backup_dir) = backup_path.parent() {
        tokio::fs::create_dir_all(backup_dir).await
            .map_err(|e| format!("Errore creazione directory backup: {}", e))?;
    }
    
    // Copia file
    tokio::fs::copy(&credentials_path, &backup_path).await
        .map_err(|e| format!("Errore copia file backup: {}", e))?;
    
    Ok(backup_path.to_string_lossy().to_string())
}

/// Ripristina credenziali legacy da backup
#[command]
pub async fn restore_legacy_credentials(
    backup_path: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<MigrationResponse<bool>, String> {
    let _manager = profile_state.manager.lock().await;
    
    let backup_file = std::path::Path::new(&backup_path);
    
    if !backup_file.exists() {
        return Ok(MigrationResponse::error("File backup non trovato".to_string()));
    }
    
    let app_data = std::env::var("APPDATA")
        .map_err(|_| "APPDATA environment variable not found".to_string())?;
    
    let app_dir = std::path::Path::new(&app_data).join("GameStringer");
    let credentials_path = app_dir.join("steam_credentials.json");
    
    // Ripristina file
    match tokio::fs::copy(&backup_file, &credentials_path).await {
        Ok(_) => {
            println!("[MIGRATION] ✅ Credenziali legacy ripristinate da: {}", backup_path);
            Ok(MigrationResponse::success(true))
        }
        Err(err) => {
            println!("[MIGRATION] ❌ Errore ripristino: {}", err);
            Ok(MigrationResponse::error(format!("Errore ripristino: {}", err)))
        }
    }
}

/// Pulisce credenziali legacy dopo migrazione riuscita
#[command]
pub async fn cleanup_legacy_credentials(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<MigrationResponse<u32>, String> {
    let manager = profile_state.manager.lock().await;
    
    let app_data = std::env::var("APPDATA")
        .map_err(|_| "APPDATA environment variable not found".to_string())?;
    
    let app_dir = std::path::Path::new(&app_data).join("GameStringer");
    let credentials_path = app_dir.join("steam_credentials.json");
    
    let mut cleaned_count = 0;
    
    // Elimina file credenziali Steam legacy
    if credentials_path.exists() {
        match tokio::fs::remove_file(&credentials_path).await {
            Ok(_) => {
                cleaned_count += 1;
                println!("[MIGRATION] ✅ File credenziali Steam legacy eliminato");
            }
            Err(err) => {
                println!("[MIGRATION] ⚠️ Errore eliminazione credenziali Steam: {}", err);
            }
        }
    }
    
    // Qui si possono aggiungere pulizie per altri store
    
    Ok(MigrationResponse::success(cleaned_count))
}

/// Verifica se esistono impostazioni legacy da migrare
#[command]
pub async fn check_legacy_settings(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<MigrationResponse<bool>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.has_legacy_settings().await {
        Ok(has_legacy) => Ok(MigrationResponse::success(has_legacy)),
        Err(err) => Ok(MigrationResponse::error(format!("Errore verifica impostazioni legacy: {}", err))),
    }
}

/// Ottiene informazioni sulle impostazioni legacy disponibili
#[command]
pub async fn get_legacy_settings_info(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<MigrationResponse<Vec<LegacySettingsInfo>>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.get_legacy_settings_info().await {
        Ok(info) => Ok(MigrationResponse::success(info)),
        Err(err) => Ok(MigrationResponse::error(format!("Errore info impostazioni legacy: {}", err))),
    }
}

/// Migra tutte le impostazioni legacy al profilo attivo
#[command]
pub async fn migrate_legacy_settings_to_profile(
    profile_state: State<'_, ProfileManagerState>,
    settings_state: State<'_, ProfileSettingsManagerState>,
) -> Result<MigrationResponse<LegacySettingsMigrationResult>, String> {
    let mut manager = profile_state.manager.lock().await;
    let mut settings_manager = settings_state.manager.lock().await;
    
    // Verifica che ci sia un profilo attivo
    if !manager.is_profile_active() {
        return Ok(MigrationResponse::error("Nessun profilo attivo per la migrazione".to_string()));
    }
    
    match manager.migrate_legacy_settings(&mut settings_manager).await {
        Ok(result) => {
            println!("[MIGRATION] ✅ Migrazione impostazioni completata: {} successi, {} fallimenti", 
                     result.total_migrated, result.total_failed);
            Ok(MigrationResponse::success(result))
        },
        Err(err) => {
            println!("[MIGRATION] ❌ Errore migrazione impostazioni: {}", err);
            Ok(MigrationResponse::error(format!("Errore migrazione impostazioni: {}", err)))
        }
    }
}

/// Crea backup delle impostazioni legacy prima della migrazione
#[command]
pub async fn backup_legacy_settings(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<MigrationResponse<Vec<String>>, String> {
    let manager = profile_state.manager.lock().await;
    
    // Verifica se esistono impostazioni legacy
    match manager.has_legacy_settings().await {
        Ok(false) => {
            return Ok(MigrationResponse::error("Nessuna impostazione legacy trovata".to_string()));
        }
        Ok(true) => {
            // Crea backup
            match create_legacy_settings_backup().await {
                Ok(backup_paths) => {
                    Ok(MigrationResponse::success(backup_paths))
                }
                Err(err) => {
                    Ok(MigrationResponse::error(format!("Errore creazione backup impostazioni: {}", err)))
                }
            }
        }
        Err(err) => {
            Ok(MigrationResponse::error(format!("Errore verifica impostazioni: {}", err)))
        }
    }
}

/// Crea backup delle impostazioni legacy
async fn create_legacy_settings_backup() -> Result<Vec<String>, String> {
    let app_data = std::env::var("APPDATA")
        .map_err(|_| "APPDATA environment variable not found".to_string())?;
    
    let app_dir = std::path::Path::new(&app_data).join("GameStringer");
    let backup_dir = app_dir.join("backups");
    
    // Crea directory backup se non esiste
    tokio::fs::create_dir_all(&backup_dir).await
        .map_err(|e| format!("Errore creazione directory backup: {}", e))?;
    
    let mut backup_paths = Vec::new();
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    
    // File di impostazioni da backuppare
    let legacy_files = vec![
        ("preferences.json", "preferences"),
        ("settings.json", "settings"),
        ("config.json", "config"),
        ("user_preferences.json", "user_preferences"),
    ];

    for (filename, backup_name) in legacy_files {
        let source_path = app_dir.join(filename);
        if source_path.exists() {
            let backup_filename = format!("{}_backup_{}.json", backup_name, timestamp);
            let backup_path = backup_dir.join(backup_filename);
            
            tokio::fs::copy(&source_path, &backup_path).await
                .map_err(|e| format!("Errore copia file backup {}: {}", filename, e))?;
            
            backup_paths.push(backup_path.to_string_lossy().to_string());
        }
    }
    
    if backup_paths.is_empty() {
        return Err("Nessun file di impostazioni legacy trovato per il backup".to_string());
    }
    
    Ok(backup_paths)
}

/// Pulisce impostazioni legacy dopo migrazione riuscita
#[command]
pub async fn cleanup_legacy_settings(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<MigrationResponse<u32>, String> {
    let manager = profile_state.manager.lock().await;
    
    let app_data = std::env::var("APPDATA")
        .map_err(|_| "APPDATA environment variable not found".to_string())?;
    
    let app_dir = std::path::Path::new(&app_data).join("GameStringer");
    
    let mut cleaned_count = 0;
    
    // File di impostazioni legacy da eliminare
    let legacy_files = vec![
        "preferences.json",
        "settings.json",
        "config.json",
        "user_preferences.json",
    ];

    for filename in legacy_files {
        let file_path = app_dir.join(filename);
        if file_path.exists() {
            match tokio::fs::remove_file(&file_path).await {
                Ok(_) => {
                    cleaned_count += 1;
                    println!("[MIGRATION] ✅ File impostazioni legacy eliminato: {}", filename);
                }
                Err(err) => {
                    println!("[MIGRATION] ⚠️ Errore eliminazione {}: {}", filename, err);
                }
            }
        }
    }
    
    Ok(MigrationResponse::success(cleaned_count))
}

/// Wizard di migrazione completo
#[command]
pub async fn migration_wizard(
    create_backup: bool,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<MigrationResponse<MigrationWizardResult>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    // Verifica che ci sia un profilo attivo
    if !manager.is_profile_active() {
        return Ok(MigrationResponse::error("Nessun profilo attivo per la migrazione".to_string()));
    }
    
    let mut result = MigrationWizardResult::new();
    
    // Step 1: Verifica credenziali legacy
    match manager.has_legacy_credentials().await {
        Ok(false) => {
            result.steps.push("Nessuna credenziale legacy trovata".to_string());
            return Ok(MigrationResponse::success(result));
        }
        Ok(true) => {
            result.steps.push("Credenziali legacy trovate".to_string());
        }
        Err(err) => {
            result.errors.push(format!("Errore verifica credenziali: {}", err));
            return Ok(MigrationResponse::error("Errore verifica credenziali legacy".to_string()));
        }
    }
    
    // Step 2: Crea backup se richiesto
    if create_backup {
        match create_legacy_backup().await {
            Ok(backup_path) => {
                result.steps.push(format!("Backup creato: {}", backup_path));
                result.backup_path = Some(backup_path);
            }
            Err(err) => {
                result.errors.push(format!("Errore backup: {}", err));
                // Continua comunque con la migrazione
            }
        }
    }
    
    // Step 3: Migra credenziali
    match manager.migrate_legacy_credentials().await {
        Ok(migration_result) => {
            result.steps.push(format!("Credenziali migrate: {} successi, {} fallimenti", 
                                    migration_result.total_migrated, migration_result.total_failed));
            result.migration_result = Some(migration_result);
        }
        Err(err) => {
            result.errors.push(format!("Errore migrazione credenziali: {}", err));
            // Continua con la migrazione delle impostazioni anche se le credenziali falliscono
        }
    }

    // Step 4: Migra impostazioni (se disponibili)
    drop(manager); // Rilascia il lock per permettere l'accesso al settings_state
    
    // Nota: Questo è un placeholder - nel wizard completo dovremmo passare anche settings_state
    // Per ora logghiamo solo che la migrazione delle impostazioni è disponibile
    result.steps.push("Migrazione impostazioni disponibile tramite comando separato".to_string());
    
    // Step 4: Pulizia opzionale (solo se migrazione riuscita)
    if result.migration_result.as_ref().map_or(false, |r| r.total_migrated > 0) {
        result.steps.push("Migrazione completata con successo".to_string());
    }
    
    Ok(MigrationResponse::success(result))
}

/// Risultato wizard migrazione
#[derive(Debug, Serialize)]
pub struct MigrationWizardResult {
    pub steps: Vec<String>,
    pub errors: Vec<String>,
    pub backup_path: Option<String>,
    pub migration_result: Option<LegacyMigrationResult>,
    pub completed_at: chrono::DateTime<chrono::Utc>,
}

impl MigrationWizardResult {
    pub fn new() -> Self {
        Self {
            steps: Vec::new(),
            errors: Vec::new(),
            backup_path: None,
            migration_result: None,
            completed_at: chrono::Utc::now(),
        }
    }
}