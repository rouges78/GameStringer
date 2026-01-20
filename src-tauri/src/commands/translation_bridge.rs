//! Tauri Commands for Translation Bridge
//! 
//! Espone le funzionalità del Translation Bridge al frontend TypeScript

use std::sync::Arc;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::translation_bridge::TranslationBridge;
use crate::translation_bridge::shared_memory_ipc::BridgeStats;
use crate::translation_bridge::dictionary_engine::DictionaryStats;

/// Stato globale del Translation Bridge
pub struct TranslationBridgeState {
    pub bridge: Arc<Mutex<TranslationBridge>>,
}

impl TranslationBridgeState {
    pub fn new() -> Self {
        Self {
            bridge: Arc::new(Mutex::new(TranslationBridge::new())),
        }
    }
}

impl Default for TranslationBridgeState {
    fn default() -> Self {
        Self::new()
    }
}

/// Risposta generica per i comandi
#[derive(Debug, Serialize)]
pub struct BridgeResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> BridgeResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    pub fn err(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

/// Avvia il server Translation Bridge
#[tauri::command]
pub async fn translation_bridge_start(
    state: State<'_, TranslationBridgeState>,
) -> Result<BridgeResponse<String>, String> {
    let mut bridge = state.bridge.lock();
    
    match bridge.start() {
        Ok(_) => Ok(BridgeResponse::ok("Translation Bridge avviato".to_string())),
        Err(e) => Ok(BridgeResponse::err(e)),
    }
}

/// Ferma il server Translation Bridge
#[tauri::command]
pub async fn translation_bridge_stop(
    state: State<'_, TranslationBridgeState>,
) -> Result<BridgeResponse<String>, String> {
    let mut bridge = state.bridge.lock();
    bridge.stop();
    Ok(BridgeResponse::ok("Translation Bridge fermato".to_string()))
}

/// Verifica se il bridge è in esecuzione
#[tauri::command]
pub async fn translation_bridge_status(
    state: State<'_, TranslationBridgeState>,
) -> Result<BridgeResponse<bool>, String> {
    let bridge = state.bridge.lock();
    Ok(BridgeResponse::ok(bridge.is_running()))
}

/// Ottieni statistiche del bridge
#[tauri::command]
pub async fn translation_bridge_stats(
    state: State<'_, TranslationBridgeState>,
) -> Result<BridgeResponse<BridgeStats>, String> {
    let bridge = state.bridge.lock();
    Ok(BridgeResponse::ok(bridge.get_stats()))
}

/// Ottieni statistiche del dizionario
#[tauri::command]
pub async fn translation_bridge_dictionary_stats(
    state: State<'_, TranslationBridgeState>,
) -> Result<BridgeResponse<DictionaryStats>, String> {
    let bridge = state.bridge.lock();
    let dict = bridge.dictionary().read();
    Ok(BridgeResponse::ok(dict.get_stats()))
}

/// Parametri per caricare traduzioni
#[derive(Debug, Deserialize)]
pub struct LoadTranslationsParams {
    pub source_lang: String,
    pub target_lang: String,
    pub translations: Vec<TranslationPair>,
}

#[derive(Debug, Deserialize)]
pub struct TranslationPair {
    pub original: String,
    pub translated: String,
}

/// Carica traduzioni nel dizionario
#[tauri::command]
pub async fn translation_bridge_load_translations(
    state: State<'_, TranslationBridgeState>,
    params: LoadTranslationsParams,
) -> Result<BridgeResponse<usize>, String> {
    let bridge = state.bridge.lock();
    
    let translations: Vec<(String, String)> = params.translations
        .into_iter()
        .map(|p| (p.original, p.translated))
        .collect();
    
    let count = bridge.load_dictionary(&params.source_lang, &params.target_lang, translations);
    Ok(BridgeResponse::ok(count))
}

/// Carica traduzioni da file JSON
#[tauri::command]
pub async fn translation_bridge_load_json(
    state: State<'_, TranslationBridgeState>,
    path: String,
) -> Result<BridgeResponse<usize>, String> {
    let bridge = state.bridge.lock();
    
    match bridge.load_dictionary_from_json(&path) {
        Ok(count) => Ok(BridgeResponse::ok(count)),
        Err(e) => Ok(BridgeResponse::err(e)),
    }
}

/// Imposta le lingue attive
#[tauri::command]
pub async fn translation_bridge_set_languages(
    state: State<'_, TranslationBridgeState>,
    source: String,
    target: String,
) -> Result<BridgeResponse<String>, String> {
    let bridge = state.bridge.lock();
    let mut dict = bridge.dictionary().write();
    dict.set_active_languages(&source, &target);
    Ok(BridgeResponse::ok(format!("Lingue attive: {} -> {}", source, target)))
}

/// Aggiungi una singola traduzione
#[tauri::command]
pub async fn translation_bridge_add_translation(
    state: State<'_, TranslationBridgeState>,
    original: String,
    translated: String,
) -> Result<BridgeResponse<String>, String> {
    let bridge = state.bridge.lock();
    let mut dict = bridge.dictionary().write();
    dict.add_translation(original.clone(), translated);
    Ok(BridgeResponse::ok(format!("Aggiunta traduzione: {}", original)))
}

/// Cerca una traduzione
#[tauri::command]
pub async fn translation_bridge_get_translation(
    state: State<'_, TranslationBridgeState>,
    text: String,
) -> Result<BridgeResponse<Option<String>>, String> {
    let bridge = state.bridge.lock();
    let dict = bridge.dictionary().read();
    
    let hash = crate::translation_bridge::protocol::TranslationRequest::compute_hash(&text);
    let result = dict.get_translation(hash, &text);
    
    Ok(BridgeResponse::ok(result))
}

/// Esporta traduzioni in JSON
#[tauri::command]
pub async fn translation_bridge_export_json(
    state: State<'_, TranslationBridgeState>,
    path: String,
) -> Result<BridgeResponse<String>, String> {
    let bridge = state.bridge.lock();
    let dict = bridge.dictionary().read();
    
    match dict.export_to_json(&path) {
        Ok(_) => Ok(BridgeResponse::ok(format!("Esportato in {}", path))),
        Err(e) => Ok(BridgeResponse::err(e)),
    }
}

/// Pulisci tutti i dizionari
#[tauri::command]
pub async fn translation_bridge_clear(
    state: State<'_, TranslationBridgeState>,
) -> Result<BridgeResponse<String>, String> {
    let bridge = state.bridge.lock();
    let mut dict = bridge.dictionary().write();
    dict.clear_all();
    Ok(BridgeResponse::ok("Dizionari puliti".to_string()))
}
