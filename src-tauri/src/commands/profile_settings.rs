use crate::profiles::settings_manager::{ProfileSettingsManager, GlobalSettings, SettingsMigrationResult};
use crate::profiles::models::ProfileSettings;
use crate::profiles::errors::ProfileError;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{command, State};
// PathBuf rimosso - non utilizzato

/// Stato globale per il ProfileSettingsManager
pub struct ProfileSettingsManagerState {
    pub manager: Arc<Mutex<ProfileSettingsManager>>,
}

/// Risposta generica per comandi settings
#[derive(Debug, Serialize)]
pub struct SettingsResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> SettingsResponse<T> {
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

/// Converte ProfileError in stringa
fn profile_error_to_string(err: ProfileError) -> String {
    format!("{}", err)
}

/// Comando: Carica settings per un profilo
#[command]
pub async fn load_profile_settings(
    settings_state: State<'_, ProfileSettingsManagerState>,
    profile_id: String,
) -> Result<SettingsResponse<ProfileSettings>, String> {
    let manager = settings_state.manager.lock().await;
    
    match manager.load_profile_settings(&profile_id).await {
        Ok(settings) => Ok(SettingsResponse::success(settings)),
        Err(err) => Ok(SettingsResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Salva settings per un profilo
#[command]
pub async fn save_profile_settings(
    settings_state: State<'_, ProfileSettingsManagerState>,
    profile_id: String,
    settings: ProfileSettings,
) -> Result<SettingsResponse<bool>, String> {
    let manager = settings_state.manager.lock().await;
    
    match manager.save_profile_settings(&profile_id, &settings).await {
        Ok(_) => Ok(SettingsResponse::success(true)),
        Err(err) => Ok(SettingsResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Elimina settings per un profilo
#[command]
pub async fn delete_profile_settings(
    settings_state: State<'_, ProfileSettingsManagerState>,
    profile_id: String,
) -> Result<SettingsResponse<bool>, String> {
    let manager = settings_state.manager.lock().await;
    
    match manager.delete_profile_settings(&profile_id).await {
        Ok(_) => Ok(SettingsResponse::success(true)),
        Err(err) => Ok(SettingsResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Carica settings globali
#[command]
pub async fn load_global_settings(
    settings_state: State<'_, ProfileSettingsManagerState>,
) -> Result<SettingsResponse<GlobalSettings>, String> {
    let manager = settings_state.manager.lock().await;
    
    match manager.load_global_settings().await {
        Ok(settings) => Ok(SettingsResponse::success(settings)),
        Err(err) => Ok(SettingsResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Salva settings globali
#[command]
pub async fn save_global_settings(
    settings_state: State<'_, ProfileSettingsManagerState>,
    settings: GlobalSettings,
) -> Result<SettingsResponse<bool>, String> {
    let manager = settings_state.manager.lock().await;
    
    match manager.save_global_settings(&settings).await {
        Ok(_) => Ok(SettingsResponse::success(true)),
        Err(err) => Ok(SettingsResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Migra settings legacy
#[command]
pub async fn migrate_legacy_settings(
    settings_state: State<'_, ProfileSettingsManagerState>,
    legacy_data: Value,
) -> Result<SettingsResponse<SettingsMigrationResult>, String> {
    let manager = settings_state.manager.lock().await;
    
    match manager.migrate_legacy_settings(legacy_data).await {
        Ok(result) => Ok(SettingsResponse::success(result)),
        Err(err) => Ok(SettingsResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Converte settings profilo in formato legacy
#[command]
pub async fn profile_settings_to_legacy(
    settings_state: State<'_, ProfileSettingsManagerState>,
    settings: ProfileSettings,
) -> Result<SettingsResponse<Value>, String> {
    let manager = settings_state.manager.lock().await;
    
    let legacy_format = manager.profile_settings_to_legacy_format(&settings);
    Ok(SettingsResponse::success(legacy_format))
}

/// Comando: Lista profili con settings
#[command]
pub async fn list_profiles_with_settings(
    settings_state: State<'_, ProfileSettingsManagerState>,
) -> Result<SettingsResponse<Vec<String>>, String> {
    let manager = settings_state.manager.lock().await;
    
    match manager.list_profiles_with_settings().await {
        Ok(profiles) => Ok(SettingsResponse::success(profiles)),
        Err(err) => Ok(SettingsResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ottieni settings per profilo corrente (integrazione con ProfileManager)
#[command]
pub async fn get_current_profile_settings(
    settings_state: State<'_, ProfileSettingsManagerState>,
    profile_manager_state: State<'_, crate::commands::profiles::ProfileManagerState>,
) -> Result<SettingsResponse<Option<ProfileSettings>>, String> {
    // Prima ottieni il profilo corrente
    let profile_manager = profile_manager_state.manager.lock().await;
    let current_profile = profile_manager.current_profile();
    
    if let Some(profile) = current_profile {
        let settings_manager = settings_state.manager.lock().await;
        match settings_manager.load_profile_settings(&profile.id).await {
            Ok(settings) => Ok(SettingsResponse::success(Some(settings))),
            Err(err) => Ok(SettingsResponse::error(profile_error_to_string(err))),
        }
    } else {
        Ok(SettingsResponse::success(None))
    }
}

/// Comando: Salva settings per profilo corrente
#[command]
pub async fn save_current_profile_settings(
    settings_state: State<'_, ProfileSettingsManagerState>,
    profile_manager_state: State<'_, crate::commands::profiles::ProfileManagerState>,
    settings: ProfileSettings,
) -> Result<SettingsResponse<bool>, String> {
    // Prima ottieni il profilo corrente
    let profile_manager = profile_manager_state.manager.lock().await;
    let current_profile = profile_manager.current_profile();
    
    if let Some(profile) = current_profile {
        let settings_manager = settings_state.manager.lock().await;
        match settings_manager.save_profile_settings(&profile.id, &settings).await {
            Ok(_) => Ok(SettingsResponse::success(true)),
            Err(err) => Ok(SettingsResponse::error(profile_error_to_string(err))),
        }
    } else {
        Ok(SettingsResponse::error("No active profile".to_string()))
    }
}

/// Comando: Inizializza sistema settings
#[command]
pub async fn initialize_settings_system(
    settings_state: State<'_, ProfileSettingsManagerState>,
) -> Result<SettingsResponse<bool>, String> {
    let manager = settings_state.manager.lock().await;
    
    match manager.initialize().await {
        Ok(_) => Ok(SettingsResponse::success(true)),
        Err(err) => Ok(SettingsResponse::error(profile_error_to_string(err))),
    }
}