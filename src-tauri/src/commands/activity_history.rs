//! Tauri Commands for Activity History
//! 
//! Espone le funzionalità dello storico attività al frontend.

use std::sync::Arc;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::activity_history::{Activity, ActivityFilter, ActivityPage, ActivityStorage, ActivityType};

/// Stato globale dell'Activity Storage
pub struct ActivityHistoryState {
    pub storage: Arc<Mutex<ActivityStorage>>,
}

impl ActivityHistoryState {
    pub fn new(storage: ActivityStorage) -> Self {
        Self {
            storage: Arc::new(Mutex::new(storage)),
        }
    }
}

impl Default for ActivityHistoryState {
    fn default() -> Self {
        Self::new(ActivityStorage::default())
    }
}

/// Risposta standard
#[derive(Serialize)]
pub struct ActivityResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ActivityResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(error: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.into()),
        }
    }
}

/// Parametri per aggiungere un'attività
#[derive(Deserialize)]
pub struct AddActivityParams {
    pub activity_type: String,
    pub title: String,
    pub description: Option<String>,
    pub game_name: Option<String>,
    pub game_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// Parametri per filtrare le attività
#[derive(Deserialize, Default)]
pub struct FilterParams {
    pub activity_type: Option<String>,
    pub game_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

fn parse_activity_type(s: &str) -> ActivityType {
    match s.to_lowercase().as_str() {
        "translation" => ActivityType::Translation,
        "patch" => ActivityType::Patch,
        "steam_sync" | "steamsync" => ActivityType::SteamSync,
        "game_added" | "gameadded" => ActivityType::GameAdded,
        "game_launched" | "gamelaunched" => ActivityType::GameLaunched,
        "profile_created" | "profilecreated" => ActivityType::ProfileCreated,
        "settings_changed" | "settingschanged" => ActivityType::SettingsChanged,
        "import_export" | "importexport" => ActivityType::ImportExport,
        "translation_bridge" | "translationbridge" => ActivityType::TranslationBridge,
        _ => ActivityType::Other,
    }
}

/// Aggiungi una nuova attività
#[tauri::command]
pub async fn activity_add(
    state: State<'_, ActivityHistoryState>,
    params: AddActivityParams,
) -> Result<ActivityResponse<Activity>, String> {
    let activity_type = parse_activity_type(&params.activity_type);
    
    let mut activity = Activity::new(activity_type, params.title);
    
    if let Some(desc) = params.description {
        activity = activity.with_description(desc);
    }
    
    if let Some(game_name) = params.game_name {
        activity = activity.with_game(game_name, params.game_id);
    }
    
    if let Some(metadata) = params.metadata {
        activity = activity.with_metadata(metadata);
    }
    
    let storage = state.storage.lock();
    match storage.add(activity.clone()) {
        Ok(_) => Ok(ActivityResponse::ok(activity)),
        Err(e) => Ok(ActivityResponse::err(e)),
    }
}

/// Ottieni attività con filtri e paginazione
#[tauri::command]
pub async fn activity_get(
    state: State<'_, ActivityHistoryState>,
    params: FilterParams,
) -> Result<ActivityResponse<ActivityPage>, String> {
    let filter = ActivityFilter {
        activity_type: params.activity_type.map(|s| parse_activity_type(&s)),
        game_id: params.game_id,
        from_date: None,
        to_date: None,
        limit: params.limit,
        offset: params.offset,
    };
    
    let storage = state.storage.lock();
    let page = storage.get(filter);
    
    Ok(ActivityResponse::ok(page))
}

/// Ottieni le ultime N attività
#[tauri::command]
pub async fn activity_get_recent(
    state: State<'_, ActivityHistoryState>,
    limit: Option<usize>,
) -> Result<ActivityResponse<Vec<Activity>>, String> {
    let storage = state.storage.lock();
    let activities = storage.get_recent(limit.unwrap_or(10));
    
    Ok(ActivityResponse::ok(activities))
}

/// Conta attività per tipo
#[tauri::command]
pub async fn activity_count_by_type(
    state: State<'_, ActivityHistoryState>,
) -> Result<ActivityResponse<std::collections::HashMap<String, usize>>, String> {
    let storage = state.storage.lock();
    let counts = storage.count_by_type();
    
    Ok(ActivityResponse::ok(counts))
}

/// Elimina una singola attività
#[tauri::command]
pub async fn activity_delete(
    state: State<'_, ActivityHistoryState>,
    id: String,
) -> Result<ActivityResponse<bool>, String> {
    let storage = state.storage.lock();
    match storage.delete(&id) {
        Ok(deleted) => Ok(ActivityResponse::ok(deleted)),
        Err(e) => Ok(ActivityResponse::err(e)),
    }
}

/// Cancella tutto lo storico
#[tauri::command]
pub async fn activity_clear(
    state: State<'_, ActivityHistoryState>,
) -> Result<ActivityResponse<String>, String> {
    let storage = state.storage.lock();
    match storage.clear() {
        Ok(_) => Ok(ActivityResponse::ok("Storico cancellato".to_string())),
        Err(e) => Ok(ActivityResponse::err(e)),
    }
}
