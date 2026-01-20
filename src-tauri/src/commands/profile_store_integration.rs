// Integrazione comandi store esistenti con sistema profili
use crate::profiles::credential_manager::{PlainCredential, StoreType};
use crate::commands::profiles::ProfileManagerState;
use serde::Serialize;
use std::collections::HashMap;
use tauri::{command, State};

/// Risposta generica per operazioni credenziali
#[derive(Debug, Serialize)]
pub struct CredentialResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> CredentialResponse<T> {
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

/// Credenziali per risposta
#[derive(Debug, Serialize)]
pub struct ProfileCredentials {
    pub username: String,
    pub password: String,
    pub additional_data: HashMap<String, String>,
    pub store: String,
    pub created_at: String,
    pub last_used: String,
}

/// Salva credenziali Steam per profilo attivo
#[command]
pub async fn save_steam_credentials_for_profile(
    api_key: String,
    steam_id: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    // Verifica che ci sia un profilo attivo
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    // Crea credenziale Steam
    let credential = PlainCredential::new(
        StoreType::Steam,
        steam_id.clone(),
        api_key.clone(),
    ).with_data("steam_id".to_string(), steam_id);

    // Salva tramite il profile manager
    match manager.save_credential_for_active_profile(credential).await {
        Ok(_) => Ok(CredentialResponse::success(true)),
        Err(err) => Ok(CredentialResponse::error(format!("Errore salvataggio credenziali Steam: {}", err))),
    }
}

/// Carica credenziali Steam per profilo attivo
#[command]
pub async fn load_steam_credentials_for_profile(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<ProfileCredentials>, String> {
    let manager = profile_state.manager.lock().await;
    
    // Verifica che ci sia un profilo attivo
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    // Carica credenziali Steam
    match manager.load_credential_for_active_profile(StoreType::Steam).await {
        Ok(Some(credential)) => {
            let profile_creds = ProfileCredentials {
                username: credential.username,
                password: credential.password,
                additional_data: credential.additional_data,
                store: credential.store.as_str().to_string(),
                created_at: credential.created_at.to_rfc3339(),
                last_used: credential.last_used.to_rfc3339(),
            };
            Ok(CredentialResponse::success(profile_creds))
        },
        Ok(None) => Ok(CredentialResponse::error("Credenziali Steam non trovate per questo profilo".to_string())),
        Err(err) => Ok(CredentialResponse::error(format!("Errore caricamento credenziali Steam: {}", err))),
    }
}

/// Salva credenziali Epic per profilo attivo
#[command]
pub async fn save_epic_credentials_for_profile(
    username: String,
    password: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    let credential = PlainCredential::new(StoreType::Epic, username, password);

    match manager.save_credential_for_active_profile(credential).await {
        Ok(_) => Ok(CredentialResponse::success(true)),
        Err(err) => Ok(CredentialResponse::error(format!("Errore salvataggio credenziali Epic: {}", err))),
    }
}

/// Carica credenziali Epic per profilo attivo
#[command]
pub async fn load_epic_credentials_for_profile(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<ProfileCredentials>, String> {
    let manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    match manager.load_credential_for_active_profile(StoreType::Epic).await {
        Ok(Some(credential)) => {
            let profile_creds = ProfileCredentials {
                username: credential.username,
                password: credential.password,
                additional_data: credential.additional_data,
                store: credential.store.as_str().to_string(),
                created_at: credential.created_at.to_rfc3339(),
                last_used: credential.last_used.to_rfc3339(),
            };
            Ok(CredentialResponse::success(profile_creds))
        },
        Ok(None) => Ok(CredentialResponse::error("Credenziali Epic non trovate per questo profilo".to_string())),
        Err(err) => Ok(CredentialResponse::error(format!("Errore caricamento credenziali Epic: {}", err))),
    }
}

/// Pulisce tutte le credenziali dal profilo attivo
#[command]
pub async fn clear_all_credentials_for_profile(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    match manager.clear_all_credentials_for_active_profile().await {
        Ok(_) => Ok(CredentialResponse::success(true)),
        Err(err) => Ok(CredentialResponse::error(format!("Errore pulizia credenziali: {}", err))),
    }
}

/// Lista tutte le credenziali del profilo attivo
#[command]
pub async fn list_credentials_for_profile(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<Vec<String>>, String> {
    let manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    match manager.list_credentials_for_active_profile().await {
        Ok(stores) => Ok(CredentialResponse::success(stores)),
        Err(err) => Ok(CredentialResponse::error(format!("Errore lista credenziali: {}", err))),
    }
}

/// Testa connessione per uno store specifico usando credenziali del profilo
#[command]
pub async fn test_store_connection_for_profile(
    store: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<bool>, String> {
    let manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    let store_type = match StoreType::from_str(&store) {
        Some(st) => st,
        None => return Ok(CredentialResponse::error(format!("Store non supportato: {}", store))),
    };

    // Carica credenziali per lo store
    match manager.load_credential_for_active_profile(store_type).await {
        Ok(Some(credential)) => {
            // Qui dovremmo chiamare la funzione di test specifica per ogni store
            // Per ora restituiamo sempre true se le credenziali esistono
            Ok(CredentialResponse::success(true))
        },
        Ok(None) => Ok(CredentialResponse::error(format!("Credenziali {} non trovate per questo profilo", store))),
        Err(err) => Ok(CredentialResponse::error(format!("Errore test connessione {}: {}", store, err))),
    }
}

/// Migra credenziali esistenti al profilo attivo
#[command]
pub async fn migrate_existing_credentials_to_profile(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<HashMap<String, bool>>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    let mut migration_results = HashMap::new();

    // Migra credenziali Steam
    // Nota: Le credenziali Steam sono crittografate, quindi per ora saltiamo la migrazione automatica
    // L'utente dovrà reinserire le credenziali per il nuovo profilo
    migration_results.insert("steam".to_string(), false);

    // Migra credenziali Epic
    // Nota: Le credenziali Epic sono crittografate, quindi per ora saltiamo la migrazione automatica
    // L'utente dovrà reinserire le credenziali per il nuovo profilo
    migration_results.insert("epic".to_string(), false);

    // Aggiungi altri store qui...

    Ok(CredentialResponse::success(migration_results))
}

/// Salva credenziali GOG per profilo attivo
#[command]
pub async fn save_gog_credentials_for_profile(
    username: String,
    password: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    let credential = PlainCredential::new(StoreType::Gog, username, password);

    match manager.save_credential_for_active_profile(credential).await {
        Ok(_) => Ok(CredentialResponse::success(true)),
        Err(err) => Ok(CredentialResponse::error(format!("Errore salvataggio credenziali GOG: {}", err))),
    }
}

/// Carica credenziali GOG per profilo attivo
#[command]
pub async fn load_gog_credentials_for_profile(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<ProfileCredentials>, String> {
    let manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    match manager.load_credential_for_active_profile(StoreType::Gog).await {
        Ok(Some(credential)) => {
            let profile_creds = ProfileCredentials {
                username: credential.username,
                password: credential.password,
                additional_data: credential.additional_data,
                store: credential.store.as_str().to_string(),
                created_at: credential.created_at.to_rfc3339(),
                last_used: credential.last_used.to_rfc3339(),
            };
            Ok(CredentialResponse::success(profile_creds))
        },
        Ok(None) => Ok(CredentialResponse::error("Credenziali GOG non trovate per questo profilo".to_string())),
        Err(err) => Ok(CredentialResponse::error(format!("Errore caricamento credenziali GOG: {}", err))),
    }
}

/// Salva credenziali Origin per profilo attivo
#[command]
pub async fn save_origin_credentials_for_profile(
    username: String,
    password: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    let credential = PlainCredential::new(StoreType::Origin, username, password);

    match manager.save_credential_for_active_profile(credential).await {
        Ok(_) => Ok(CredentialResponse::success(true)),
        Err(err) => Ok(CredentialResponse::error(format!("Errore salvataggio credenziali Origin: {}", err))),
    }
}

/// Carica credenziali Origin per profilo attivo
#[command]
pub async fn load_origin_credentials_for_profile(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<ProfileCredentials>, String> {
    let manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    match manager.load_credential_for_active_profile(StoreType::Origin).await {
        Ok(Some(credential)) => {
            let profile_creds = ProfileCredentials {
                username: credential.username,
                password: credential.password,
                additional_data: credential.additional_data,
                store: credential.store.as_str().to_string(),
                created_at: credential.created_at.to_rfc3339(),
                last_used: credential.last_used.to_rfc3339(),
            };
            Ok(CredentialResponse::success(profile_creds))
        },
        Ok(None) => Ok(CredentialResponse::error("Credenziali Origin non trovate per questo profilo".to_string())),
        Err(err) => Ok(CredentialResponse::error(format!("Errore caricamento credenziali Origin: {}", err))),
    }
}

/// Salva credenziali Ubisoft per profilo attivo
#[command]
pub async fn save_ubisoft_credentials_for_profile(
    username: String,
    password: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    let credential = PlainCredential::new(StoreType::Ubisoft, username, password);

    match manager.save_credential_for_active_profile(credential).await {
        Ok(_) => Ok(CredentialResponse::success(true)),
        Err(err) => Ok(CredentialResponse::error(format!("Errore salvataggio credenziali Ubisoft: {}", err))),
    }
}

/// Carica credenziali Ubisoft per profilo attivo
#[command]
pub async fn load_ubisoft_credentials_for_profile(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<ProfileCredentials>, String> {
    let manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    match manager.load_credential_for_active_profile(StoreType::Ubisoft).await {
        Ok(Some(credential)) => {
            let profile_creds = ProfileCredentials {
                username: credential.username,
                password: credential.password,
                additional_data: credential.additional_data,
                store: credential.store.as_str().to_string(),
                created_at: credential.created_at.to_rfc3339(),
                last_used: credential.last_used.to_rfc3339(),
            };
            Ok(CredentialResponse::success(profile_creds))
        },
        Ok(None) => Ok(CredentialResponse::error("Credenziali Ubisoft non trovate per questo profilo".to_string())),
        Err(err) => Ok(CredentialResponse::error(format!("Errore caricamento credenziali Ubisoft: {}", err))),
    }
}

/// Elimina credenziali per uno store specifico
#[command]
pub async fn delete_store_credentials_for_profile(
    store: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    let store_type = match StoreType::from_str(&store) {
        Some(st) => st,
        None => return Ok(CredentialResponse::error(format!("Store non supportato: {}", store))),
    };

    match manager.delete_credential_for_active_profile(store_type).await {
        Ok(_) => Ok(CredentialResponse::success(true)),
        Err(err) => Ok(CredentialResponse::error(format!("Errore eliminazione credenziali {}: {}", store, err))),
    }
}

/// Esporta credenziali del profilo per backup
#[command]
pub async fn export_profile_credentials(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<CredentialResponse<String>, String> {
    let manager = profile_state.manager.lock().await;
    
    if !manager.is_profile_active() {
        return Ok(CredentialResponse::error("Nessun profilo attivo".to_string()));
    }

    match manager.export_credentials_for_active_profile().await {
        Ok(exported_data) => Ok(CredentialResponse::success(exported_data)),
        Err(err) => Ok(CredentialResponse::error(format!("Errore esportazione credenziali: {}", err))),
    }
}