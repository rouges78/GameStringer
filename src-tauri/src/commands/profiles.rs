use crate::profiles::manager::ProfileManager;
use crate::profiles::models::{CreateProfileRequest, ProfileInfo, ProfileSettings, UserProfile};
use crate::profiles::errors::ProfileError;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{command, State};
use std::path::PathBuf;

/// Stato globale per il ProfileManager
pub struct ProfileManagerState {
    pub manager: Arc<Mutex<ProfileManager>>,
}

/// Risposta generica per comandi profili
#[derive(Debug, Serialize)]
pub struct ProfileResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

/// Implementazione risposta generica
impl<T> ProfileResponse<T> {
    /// Crea risposta di successo
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    /// Crea risposta di errore
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

/// Comando: Lista profili disponibili
#[command]
pub async fn list_profiles(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ProfileResponse<Vec<ProfileInfo>>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.list_profiles().await {
        Ok(profiles) => Ok(ProfileResponse::success(profiles)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Crea nuovo profilo
#[command]
pub async fn create_profile(
    profile_state: State<'_, ProfileManagerState>,
    request: CreateProfileRequest,
) -> Result<ProfileResponse<UserProfile>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.create_profile(request).await {
        Ok(profile) => Ok(ProfileResponse::success(profile)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Autentica profilo
#[command]
pub async fn authenticate_profile(
    profile_state: State<'_, ProfileManagerState>,
    name: String,
    password: String,
) -> Result<ProfileResponse<UserProfile>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.authenticate_profile(&name, &password).await {
        Ok(profile) => Ok(ProfileResponse::success(profile)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Cambia profilo
#[command]
pub async fn switch_profile(
    profile_state: State<'_, ProfileManagerState>,
    name: String,
    password: String,
) -> Result<ProfileResponse<UserProfile>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.switch_profile(&name, &password).await {
        Ok(profile) => Ok(ProfileResponse::success(profile)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ottieni profilo corrente
#[command]
pub async fn get_current_profile(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ProfileResponse<Option<UserProfile>>, String> {
    let manager = profile_state.manager.lock().await;
    
    let profile = manager.current_profile().cloned();
    Ok(ProfileResponse::success(profile))
}

/// Comando: Logout profilo
#[command]
pub async fn logout(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ProfileResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.logout() {
        Ok(_) => Ok(ProfileResponse::success(true)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Aggiorna impostazioni profilo
#[command]
pub async fn update_settings(
    profile_state: State<'_, ProfileManagerState>,
    settings: ProfileSettings,
    password: String,
) -> Result<ProfileResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.update_settings(settings, &password).await {
        Ok(_) => Ok(ProfileResponse::success(true)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Esporta profilo in file
#[command]
pub async fn export_profile(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
    password: String,
    export_path: String,
    export_password: Option<String>,
) -> Result<ProfileResponse<String>, String> {
    let manager = profile_state.manager.lock().await;
    let export_pwd = export_password.as_deref();
    
    match manager.export_profile_to_file(&profile_id, &password, &export_path, export_pwd).await {
        Ok(_) => Ok(ProfileResponse::success(export_path)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Importa profilo da file
#[command]
pub async fn import_profile(
    profile_state: State<'_, ProfileManagerState>,
    file_path: String,
    import_password: String,
    new_name: Option<String>,
) -> Result<ProfileResponse<UserProfile>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.import_profile_from_file(&file_path, &import_password, new_name).await {
        Ok(profile) => Ok(ProfileResponse::success(profile)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Valida file export
#[command]
pub async fn validate_export_file(
    profile_state: State<'_, ProfileManagerState>,
    file_path: String,
) -> Result<ProfileResponse<crate::profiles::manager::ExportMetadata>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.validate_export_file(&file_path).await {
        Ok(metadata) => Ok(ProfileResponse::success(metadata)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Crea backup profilo
#[command]
pub async fn create_profile_backup(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
    password: String,
) -> Result<ProfileResponse<String>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.create_profile_backup(&profile_id, &password).await {
        Ok(backup_path) => Ok(ProfileResponse::success(backup_path)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ottieni statistiche autenticazione
#[command]
pub async fn get_auth_stats(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ProfileResponse<crate::profiles::manager::AuthStats>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.get_auth_stats().await {
        Ok(stats) => Ok(ProfileResponse::success(stats)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Verifica se sessione è scaduta
#[command]
pub async fn is_session_expired(
    profile_state: State<'_, ProfileManagerState>,
    timeout_seconds: u64,
) -> Result<ProfileResponse<bool>, String> {
    let manager = profile_state.manager.lock().await;
    let expired = manager.is_session_expired(timeout_seconds);
    Ok(ProfileResponse::success(expired))
}

/// Comando: Rinnova sessione
#[command]
pub async fn renew_session(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ProfileResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.renew_session() {
        Ok(_) => Ok(ProfileResponse::success(true)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ottieni tempo rimanente sessione
#[command]
pub async fn get_session_time_remaining(
    profile_state: State<'_, ProfileManagerState>,
    timeout_seconds: u64,
) -> Result<ProfileResponse<Option<u64>>, String> {
    let manager = profile_state.manager.lock().await;
    let remaining = manager.get_session_time_remaining(timeout_seconds);
    Ok(ProfileResponse::success(remaining))
}

/// Comando: Verifica se profilo può essere autenticato
#[command]
pub async fn can_authenticate(
    profile_state: State<'_, ProfileManagerState>,
    name: String,
) -> Result<ProfileResponse<bool>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.can_authenticate(&name).await {
        Ok(can_auth) => Ok(ProfileResponse::success(can_auth)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Sblocca profilo
#[command]
pub async fn unlock_profile(
    profile_state: State<'_, ProfileManagerState>,
    name: String,
) -> Result<ProfileResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.unlock_profile(&name).await {
        Ok(_) => Ok(ProfileResponse::success(true)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ottieni tentativi falliti
#[command]
pub async fn get_failed_attempts(
    profile_state: State<'_, ProfileManagerState>,
    name: String,
) -> Result<ProfileResponse<u32>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.get_failed_attempts(&name).await {
        Ok(attempts) => Ok(ProfileResponse::success(attempts)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}