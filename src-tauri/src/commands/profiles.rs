use crate::profiles::manager::ProfileManager;
use crate::profiles::models::{CreateProfileRequest, ProfileInfo, ProfileSettings, UserProfile, ProfilesSystemStats, ProfilesHealthCheck, ProfilesSystemConfig, ProfileUsageStats};
use crate::profiles::errors::ProfileError;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{command, State};
// PathBuf rimosso - non utilizzato

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

/// Comando: Elimina profilo
#[command(rename_all = "camelCase")]
pub async fn delete_profile(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
    password: String,
) -> Result<ProfileResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.delete_profile(&profile_id, &password).await {
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
#[command(rename_all = "camelCase")]
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
#[command(rename_all = "camelCase")]
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
} // Added closing bracket here

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

/// API pubblica per accesso informazioni profilo dettagliate
#[allow(dead_code)]
#[command(rename_all = "camelCase")]
pub async fn get_profile_info(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
) -> Result<ProfileResponse<ProfileInfo>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.get_profile_info(&profile_id).await {
        Ok(Some(info)) => Ok(ProfileResponse::success(info)),
        Ok(None) => Ok(ProfileResponse::error("Profilo non trovato".to_string())),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Aggiorna avatar profilo
/// API pubblica per gestione avatar profili
#[allow(dead_code)]
#[command(rename_all = "camelCase")]
pub async fn update_profile_avatar(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
    avatar_path: Option<String>,
) -> Result<ProfileResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.update_profile_avatar(&profile_id, avatar_path).await {
        Ok(_) => Ok(ProfileResponse::success(true)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ottieni avatar profilo (base64)
#[command(rename_all = "camelCase")]
pub async fn get_profile_avatar(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
) -> Result<ProfileResponse<Option<String>>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.get_profile_avatar(&profile_id).await {
        Ok(avatar_data) => Ok(ProfileResponse::success(avatar_data)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Cambia password profilo
/// API pubblica per cambio password profili
#[allow(dead_code)]
#[command(rename_all = "camelCase")]
pub async fn change_profile_password(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
    old_password: String,
    new_password: String,
) -> Result<ProfileResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.change_profile_password(&profile_id, &old_password, &new_password).await {
        Ok(_) => Ok(ProfileResponse::success(true)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ottieni statistiche utilizzo profilo
/// API pubblica per statistiche utilizzo profili
#[allow(dead_code)]
#[command]
pub async fn get_profile_usage_stats(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
) -> Result<ProfileResponse<ProfileUsageStats>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.get_profile_usage_stats(&profile_id).await {
        Ok(stats) => Ok(ProfileResponse::success(stats)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Verifica integrità profilo
/// API pubblica per verifica integrità profili
#[allow(dead_code)]
#[command]
pub async fn verify_profile_integrity(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
) -> Result<ProfileResponse<bool>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.verify_profile_integrity(&profile_id).await {
        Ok(is_valid) => Ok(ProfileResponse::success(is_valid)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ripara profilo corrotto
/// API pubblica per riparazione profili corrotti
#[allow(dead_code)]
#[command]
pub async fn repair_profile(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
    password: String,
) -> Result<ProfileResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.repair_profile(&profile_id, &password).await {
        Ok(_) => Ok(ProfileResponse::success(true)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ottieni lista backup profilo
/// API pubblica per gestione backup profili
#[allow(dead_code)]
#[command]
pub async fn list_profile_backups(
    profile_state: State<'_, ProfileManagerState>,
    _profile_id: String,  // Riservato per future funzionalità
) -> Result<ProfileResponse<Vec<String>>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.list_profile_backups().await {
        Ok(backups) => Ok(ProfileResponse::success(backups)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ripristina profilo da backup
/// API pubblica per ripristino backup profili
#[allow(dead_code)]
#[command]
pub async fn restore_profile_from_backup(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
    backup_path: String,
    password: String,
) -> Result<ProfileResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.restore_profile_from_backup(&profile_id, &backup_path, &password).await {
        Ok(_) => Ok(ProfileResponse::success(true)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Pulisci dati temporanei profilo
/// API pubblica per pulizia dati temporanei profili
#[allow(dead_code)]
#[command]
pub async fn cleanup_profile_temp_data(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
) -> Result<ProfileResponse<u64>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.cleanup_profile_temp_data(&profile_id).await {
        Ok(bytes_cleaned) => Ok(ProfileResponse::success(bytes_cleaned)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ottieni dimensione dati profilo
/// API pubblica per analisi dimensioni profili
#[allow(dead_code)]
#[command]
pub async fn get_profile_data_size(
    profile_state: State<'_, ProfileManagerState>,
    profile_id: String,
) -> Result<ProfileResponse<u64>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.get_profile_data_size(&profile_id).await {
        Ok(size) => Ok(ProfileResponse::success(size)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ottieni statistiche generali sistema profili
/// API pubblica per statistiche sistema profili
#[allow(dead_code)]
#[command]
pub async fn get_profiles_system_stats(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ProfileResponse<ProfilesSystemStats>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.get_system_stats().await {
        Ok(stats) => Ok(ProfileResponse::success(stats)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Verifica salute sistema profili
/// API pubblica per controllo salute sistema profili
#[allow(dead_code)]
#[command]
pub async fn check_profiles_system_health(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ProfileResponse<ProfilesHealthCheck>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.check_system_health().await {
        Ok(health) => Ok(ProfileResponse::success(health)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Ottieni configurazione sistema profili
/// API pubblica per configurazione sistema profili
#[allow(dead_code)]
#[command]
pub async fn get_profiles_system_config(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ProfileResponse<ProfilesSystemConfig>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.get_system_config().await {
        Ok(config) => Ok(ProfileResponse::success(config)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}

/// Comando: Aggiorna configurazione sistema profili
/// API pubblica per aggiornamento configurazione sistema profili
#[allow(dead_code)]
#[command]
pub async fn update_profiles_system_config(
    profile_state: State<'_, ProfileManagerState>,
    config: ProfilesSystemConfig,
) -> Result<ProfileResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    match manager.update_system_config(config).await {
        Ok(_) => Ok(ProfileResponse::success(true)),
        Err(err) => Ok(ProfileResponse::error(profile_error_to_string(err))),
    }
}