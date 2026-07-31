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
#[derive(Default)]
pub struct UETranslatorState {
    pub is_injected: bool,
    pub is_translating: bool,
    pub texts_translated: u64,
    pub texts_cached: u64,
    pub last_error: Option<String>,
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
///
/// ⚠️ NESSUNO PRODUCE PIÙ QUESTA DLL — 31/07/2026.
/// `ue_auto_translator.dll` era buildata solo da `ue-translator-dll/`, cartella
/// CANCELLATA il 31/07/2026 perché i suoi hook non si installavano mai
/// (FindUEFunctions() ritornava true senza assegnare gli indirizzi, quindi
/// MH_CreateHook non veniva mai chiamato) e main.cpp stampava comunque
/// "Hook inizializzati con successo".
///
/// Il percorso `resources/ue-translator/` NON è mai stato dichiarato in
/// tauri.conf.json (che bundla solo `resources/gs-hook/x64|x86`), quindi questa
/// funzione ha sempre restituito un path inesistente in ogni build distribuita.
/// Il comportamento a runtime NON cambia: `start_ue_translator` controlla già
/// `dll_path.exists()` e risponde onestamente che la feature è sperimentale e
/// la DLL non è inclusa (chiusura di issue #52).
///
/// Se e quando si ricollega la traduzione UE a runtime, il bersaglio è
/// `gs-hook` (`resources/gs-hook/<arch>/gs-hook.dll`, buildata in CI da
/// `gs-hook/build-all.ps1` e verificata nel workflow di release) iniettata da
/// `commands::gs_hook_injector`, NON questa funzione. Non ricreare la cartella
/// cancellata: si tratterebbe di ricostruire l'implementazione peggiore.
pub fn get_translator_dll_path() -> Result<PathBuf, String> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .parent()
        .ok_or("Failed to get executable folder")?
        .to_path_buf();

    // La DLL sarebbe in resources/ue-translator/ — vedi nota sopra: non esiste
    // e non viene più prodotta da nulla.
    let dll_path = exe_dir
        .join("resources")
        .join("ue-translator")
        .join("ue_auto_translator.dll");

    Ok(dll_path)
}
