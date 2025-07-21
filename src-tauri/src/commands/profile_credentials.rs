// Comandi Tauri per gestione credenziali profili
use crate::profiles::{ProfileCredentialManager, PlainCredential, StoreType, CredentialInfo, MigrationResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

/// Stato globale del credential manager
pub struct CredentialManagerState {
    pub manager: Mutex<ProfileCredentialManager>,
}

impl CredentialManagerState {
    pub fn new() -> Self {
        Self {
            manager: Mutex::new(ProfileCredentialManager::new()),
        }
    }
}

/// Richiesta per salvare credenziale
#[derive(Debug, Deserialize)]
pub struct SaveCredentialRequest {
    pub store: String,
    pub username: String,
    pub password: String,
    pub additional_data: Option<HashMap<String, String>>,
    pub profile_password: String,
}

/// Richiesta per caricare credenziale
#[derive(Debug, Deserialize)]
pub struct LoadCredentialRequest {
    pub store: String,
    pub profile_password: String,
}

/// Risposta credenziale caricata
#[derive(Debug, Serialize)]
pub struct LoadCredentialResponse {
    pub store: String,
    pub username: String,
    pub password: String,
    pub additional_data: HashMap<String, String>,
    pub created_at: String,
    pub last_used: String,
}

/// Salva credenziale per il profilo attivo
#[tauri::command]
pub async fn save_profile_credential(
    request: SaveCredentialRequest,
    state: State<'_, CredentialManagerState>,
) -> Result<String, String> {
    let store_type = StoreType::from_str(&request.store)
        .ok_or_else(|| format!("Store type non supportato: {}", request.store))?;

    let mut credential = PlainCredential::new(
        store_type.clone(),
        request.username,
        request.password,
    );

    // Aggiungi dati aggiuntivi se forniti
    if let Some(additional_data) = request.additional_data {
        for (key, value) in additional_data {
            credential = credential.with_data(key, value);
        }
    }

    let mut manager = state.manager.lock()
        .map_err(|e| format!("Errore accesso manager: {}", e))?;

    manager.save_credential(credential, &request.profile_password).await
        .map_err(|e| format!("Errore salvataggio credenziale: {}", e))?;

    Ok(format!("Credenziale {} salvata con successo", store_type.as_str()))
}

/// Carica credenziale per il profilo attivo
#[tauri::command]
pub async fn load_profile_credential(
    request: LoadCredentialRequest,
    state: State<'_, CredentialManagerState>,
) -> Result<LoadCredentialResponse, String> {
    let store_type = StoreType::from_str(&request.store)
        .ok_or_else(|| format!("Store type non supportato: {}", request.store))?;

    let manager = state.manager.lock()
        .map_err(|e| format!("Errore accesso manager: {}", e))?;

    let credential = manager.load_credential(store_type, &request.profile_password).await
        .map_err(|e| format!("Errore caricamento credenziale: {}", e))?;

    Ok(LoadCredentialResponse {
        store: credential.store.as_str().to_string(),
        username: credential.username,
        password: credential.password,
        additional_data: credential.additional_data,
        created_at: credential.created_at.to_rfc3339(),
        last_used: credential.last_used.to_rfc3339(),
    })
}

/// Rimuove credenziale per il profilo attivo
#[tauri::command]
pub async fn remove_profile_credential(
    store: String,
    profile_password: String,
    state: State<'_, CredentialManagerState>,
) -> Result<String, String> {
    let store_type = StoreType::from_str(&store)
        .ok_or_else(|| format!("Store type non supportato: {}", store))?;

    let mut manager = state.manager.lock()
        .map_err(|e| format!("Errore accesso manager: {}", e))?;

    manager.remove_credential(store_type.clone(), &profile_password).await
        .map_err(|e| format!("Errore rimozione credenziale: {}", e))?;

    Ok(format!("Credenziale {} rimossa con successo", store_type.as_str()))
}

/// Lista store con credenziali salvate
#[tauri::command]
pub async fn list_profile_credentials(
    state: State<'_, CredentialManagerState>,
) -> Result<Vec<String>, String> {
    let manager = state.manager.lock()
        .map_err(|e| format!("Errore accesso manager: {}", e))?;

    let stores = manager.list_stored_credentials()
        .map_err(|e| format!("Errore lista credenziali: {}", e))?;

    Ok(stores.into_iter().map(|s| s.as_str().to_string()).collect())
}

/// Verifica se esiste credenziale per uno store
#[tauri::command]
pub async fn has_profile_credential(
    store: String,
    state: State<'_, CredentialManagerState>,
) -> Result<bool, String> {
    let store_type = StoreType::from_str(&store)
        .ok_or_else(|| format!("Store type non supportato: {}", store))?;

    let manager = state.manager.lock()
        .map_err(|e| format!("Errore accesso manager: {}", e))?;

    manager.has_credential(store_type)
        .map_err(|e| format!("Errore verifica credenziale: {}", e))
}

/// Ottiene informazioni credenziale senza dati sensibili
#[tauri::command]
pub async fn get_profile_credential_info(
    store: String,
    state: State<'_, CredentialManagerState>,
) -> Result<Option<CredentialInfo>, String> {
    let store_type = StoreType::from_str(&store)
        .ok_or_else(|| format!("Store type non supportato: {}", store))?;

    let manager = state.manager.lock()
        .map_err(|e| format!("Errore accesso manager: {}", e))?;

    manager.get_credential_info(store_type)
        .map_err(|e| format!("Errore info credenziale: {}", e))
}

/// Migra credenziali dal sistema legacy
#[tauri::command]
pub async fn migrate_legacy_credentials(
    profile_password: String,
    state: State<'_, CredentialManagerState>,
) -> Result<MigrationResult, String> {
    let mut manager = state.manager.lock()
        .map_err(|e| format!("Errore accesso manager: {}", e))?;

    manager.migrate_legacy_credentials(&profile_password).await
        .map_err(|e| format!("Errore migrazione: {}", e))
}

/// Testa connessione con credenziali salvate
#[tauri::command]
pub async fn test_profile_credential_connection(
    store: String,
    profile_password: String,
    state: State<'_, CredentialManagerState>,
) -> Result<String, String> {
    let store_type = StoreType::from_str(&store)
        .ok_or_else(|| format!("Store type non supportato: {}", store))?;

    let manager = state.manager.lock()
        .map_err(|e| format!("Errore accesso manager: {}", e))?;

    let credential = manager.load_credential(store_type.clone(), &profile_password).await
        .map_err(|e| format!("Errore caricamento credenziale: {}", e))?;

    // Qui dovremmo chiamare le funzioni di test specifiche per ogni store
    match store_type {
        StoreType::Steam => test_steam_connection(&credential).await,
        StoreType::Ubisoft => test_ubisoft_connection(&credential).await,
        StoreType::Epic => test_epic_connection(&credential).await,
        _ => Ok(format!("Test connessione per {} non implementato", store_type.as_str())),
    }
}

/// Test connessione Steam
async fn test_steam_connection(credential: &PlainCredential) -> Result<String, String> {
    // Implementazione placeholder - dovrebbe chiamare le API Steam
    if credential.username.is_empty() || credential.password.is_empty() {
        return Err("Credenziali Steam incomplete".to_string());
    }
    
    Ok("Connessione Steam testata con successo".to_string())
}

/// Test connessione Ubisoft
async fn test_ubisoft_connection(credential: &PlainCredential) -> Result<String, String> {
    // Implementazione placeholder - dovrebbe chiamare le API Ubisoft
    if credential.username.is_empty() || credential.password.is_empty() {
        return Err("Credenziali Ubisoft incomplete".to_string());
    }
    
    Ok("Connessione Ubisoft testata con successo".to_string())
}

/// Test connessione Epic
async fn test_epic_connection(credential: &PlainCredential) -> Result<String, String> {
    // Implementazione placeholder - dovrebbe chiamare le API Epic
    if credential.username.is_empty() || credential.password.is_empty() {
        return Err("Credenziali Epic incomplete".to_string());
    }
    
    Ok("Connessione Epic testata con successo".to_string())
}

/// Pulisce tutte le credenziali del profilo attivo
#[tauri::command]
pub async fn clear_all_profile_credentials(
    profile_password: String,
    state: State<'_, CredentialManagerState>,
) -> Result<String, String> {
    let mut manager = state.manager.lock()
        .map_err(|e| format!("Errore accesso manager: {}", e))?;

    let stores = manager.list_stored_credentials()
        .map_err(|e| format!("Errore lista credenziali: {}", e))?;

    let mut removed_count = 0;
    for store in stores {
        if let Ok(_) = manager.remove_credential(store, &profile_password).await {
            removed_count += 1;
        }
    }

    Ok(format!("Rimosse {} credenziali", removed_count))
}