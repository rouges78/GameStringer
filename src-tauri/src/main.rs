#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

mod injekt;
mod process_utils;

use injekt::InjektTranslator;
use process_utils::{find_game_processes, ProcessInfo};

// Stato globale dell'applicazione
struct AppState {
    injekt: Mutex<Option<InjektTranslator>>,
    translations_cache: Mutex<HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct InjectionConfig {
    target_process: String,
    target_language: String,
    provider: String,
    api_key: String,
    hook_mode: String,
    cache_enabled: bool,
}

// Comando per trovare processi di gioco
#[tauri::command]
async fn find_processes() -> Result<Vec<ProcessInfo>, String> {
    match find_game_processes() {
        Ok(processes) => Ok(processes),
        Err(e) => Err(format!("Errore nella ricerca processi: {}", e)),
    }
}

// Comando per avviare l'injection
#[tauri::command]
async fn start_injection(
    config: InjectionConfig,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let mut injekt_guard = state.injekt.lock().unwrap();
    
    // Crea nuova istanza di InjektTranslator
    let injekt = match InjektTranslator::new(config) {
        Ok(inj) => inj,
        Err(e) => return Err(format!("Errore creazione InjektTranslator: {}", e)),
    };
    
    // Avvia l'injection
    match injekt.start() {
        Ok(_) => {
            *injekt_guard = Some(injekt);
            Ok(true)
        }
        Err(e) => Err(format!("Errore avvio injection: {}", e)),
    }
}

// Comando per fermare l'injection
#[tauri::command]
async fn stop_injection(state: State<'_, AppState>) -> Result<bool, String> {
    let mut injekt_guard = state.injekt.lock().unwrap();
    
    if let Some(mut injekt) = injekt_guard.take() {
        match injekt.stop() {
            Ok(_) => Ok(true),
            Err(e) => Err(format!("Errore stop injection: {}", e)),
        }
    } else {
        Ok(false)
    }
}

// Comando per ottenere statistiche
#[tauri::command]
async fn get_stats(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let injekt_guard = state.injekt.lock().unwrap();
    
    if let Some(injekt) = injekt_guard.as_ref() {
        Ok(injekt.get_stats())
    } else {
        Ok(serde_json::json!({
            "isActive": false,
            "activeHooks": 0,
            "translationsApplied": 0,
            "cachedTranslations": 0
        }))
    }
}

// Comando per pulire la cache
#[tauri::command]
async fn clear_cache(state: State<'_, AppState>) -> Result<(), String> {
    let mut cache_guard = state.translations_cache.lock().unwrap();
    cache_guard.clear();
    Ok(())
}

// Comando per esportare la cache
#[tauri::command]
async fn export_cache(state: State<'_, AppState>) -> Result<HashMap<String, String>, String> {
    let cache_guard = state.translations_cache.lock().unwrap();
    Ok(cache_guard.clone())
}

// Comando per importare la cache
#[tauri::command]
async fn import_cache(
    cache_data: HashMap<String, String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut cache_guard = state.translations_cache.lock().unwrap();
    *cache_guard = cache_data;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            injekt: Mutex::new(None),
            translations_cache: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            find_processes,
            start_injection,
            stop_injection,
            get_stats,
            clear_cache,
            export_cache,
            import_cache
        ])
        .run(tauri::generate_context!())
        .expect("Errore durante l'esecuzione di Tauri");
}
