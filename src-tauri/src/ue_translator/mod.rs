#![allow(dead_code)]
//! UEAutoTranslator - Sistema di traduzione runtime per Unreal Engine
//! 
//! Questo modulo implementa un sistema simile a XUnity.AutoTranslator ma per Unreal Engine.
//! 
//! Architettura:
//! 1. DLL che si inietta nel processo UE
//! 2. Hook delle funzioni FText/UTextBlock
//! 3. Comunicazione IPC con GameStringer
//! 4. Cache delle traduzioni

pub mod injector;
pub mod ipc_bridge;
pub mod translation_cache;

use std::path::PathBuf;
use serde::{Deserialize, Serialize};

/// Configurazione del translator UE
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UETranslatorConfig {
    pub target_language: String,
    pub source_language: String,
    pub auto_translate: bool,
    pub cache_enabled: bool,
    pub hotkey_toggle: String,
    pub show_original_on_hover: bool,
}

impl Default for UETranslatorConfig {
    fn default() -> Self {
        Self {
            target_language: "it".to_string(),
            source_language: "en".to_string(),
            auto_translate: true,
            cache_enabled: true,
            hotkey_toggle: "ALT+T".to_string(),
            show_original_on_hover: true,
        }
    }
}

/// Stato del translator per un gioco
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UETranslatorState {
    pub is_injected: bool,
    pub is_translating: bool,
    pub texts_translated: u64,
    pub texts_cached: u64,
    pub last_error: Option<String>,
}

impl Default for UETranslatorState {
    fn default() -> Self {
        Self {
            is_injected: false,
            is_translating: false,
            texts_translated: 0,
            texts_cached: 0,
            last_error: None,
        }
    }
}

/// Richiesta di traduzione dal gioco
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationRequest {
    pub id: u64,
    pub original_text: String,
    pub context: Option<String>,
    pub widget_type: String,
}

/// Risposta di traduzione al gioco
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationResponse {
    pub id: u64,
    pub translated_text: String,
    pub from_cache: bool,
}

/// Ottiene il percorso della DLL del translator
pub fn get_translator_dll_path() -> Result<PathBuf, String> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Errore ottenimento path exe: {}", e))?
        .parent()
        .ok_or("Impossibile ottenere cartella exe")?
        .to_path_buf();
    
    // La DLL sarà in resources/ue-translator/
    let dll_path = exe_dir
        .join("resources")
        .join("ue-translator")
        .join("ue_auto_translator.dll");
    
    Ok(dll_path)
}
