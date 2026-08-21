//! Stub per moduli Windows-only su piattaforme non-Windows.
//! Questi comandi ritornano errori "non disponibile" invece di usare WinAPI.

use serde::{Deserialize, Serialize};

const PLATFORM_ERR: &str = "Questa funzionalità è disponibile solo su Windows";

// ═══════════════════════════════════════════════════════════════════
// AntiCheatState stub (necessario per .manage() in main.rs)
// ═══════════════════════════════════════════════════════════════════

#[derive(Default)]
pub struct AntiCheatState;

// ═══════════════════════════════════════════════════════════════════
// commands::anti_cheat stubs
// ═══════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn detect_anti_cheat_systems(_pid: u32) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn check_injection_gate(_pid: u32) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn get_anti_cheat_compatibility_strategies(_anti_cheat_name: String) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn get_anti_cheat_cache_stats() -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn clear_anti_cheat_cache() -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn test_anti_cheat_detection() -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

// ═══════════════════════════════════════════════════════════════════
// commands::unity_injector stubs
// ═══════════════════════════════════════════════════════════════════

#[derive(Serialize, Deserialize)]
pub struct InjectionResult {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub async fn inject_unity_translator(_process_name: String) -> Result<InjectionResult, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn start_unity_translation_server(_target_language: String) -> Result<String, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn stop_unity_translation_server() -> Result<String, String> {
    Err(PLATFORM_ERR.into())
}

// ═══════════════════════════════════════════════════════════════════
// commands::gs_hook_injector stubs
// ═══════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn inject_gs_hook(_process_name: String) -> Result<InjectionResult, String> {
    Err(PLATFORM_ERR.into())
}

#[derive(Serialize)]
pub struct GsHookStatus {
    pub available: bool,
    pub process_running: bool,
}

#[tauri::command]
pub async fn gs_hook_status(_process_name: Option<String>) -> Result<GsHookStatus, String> {
    // Fuori da Windows la strada a runtime non esiste: non e' un errore da
    // mostrare, e' un fatto che il pianificatore usa per non proporla.
    Ok(GsHookStatus { available: false, process_running: false })
}

// ═══════════════════════════════════════════════════════════════════
// commands::ue_translator stubs
// ═══════════════════════════════════════════════════════════════════

#[derive(Clone, Serialize, Deserialize)]
pub struct UETranslatorState {
    pub is_running: bool,
    pub is_translating: bool,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct UETranslatorResult {
    pub success: bool,
    pub message: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct UETranslatorConfig {
    pub target_language: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub entries: usize,
    pub hits: u64,
    pub misses: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CompatibilityResult {
    pub compatible: bool,
    pub message: String,
}

#[tauri::command]
pub async fn start_ue_translator(_game_path: String, _executable: String, _config: UETranslatorConfig) -> Result<UETranslatorResult, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn is_ue_game_running(_executable: String) -> Result<bool, String> {
    Ok(false)
}

#[tauri::command]
pub async fn stop_ue_translator(_game_path: String) -> Result<UETranslatorResult, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn get_ue_translator_state() -> Result<UETranslatorState, String> {
    Ok(UETranslatorState { is_running: false, is_translating: false })
}

#[tauri::command]
pub async fn toggle_ue_translation() -> Result<UETranslatorState, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn get_ue_cache_stats() -> Result<CacheStats, String> {
    Ok(CacheStats { entries: 0, hits: 0, misses: 0 })
}

#[tauri::command]
pub async fn clear_ue_cache() -> Result<String, String> {
    Ok("Cache non disponibile su Linux".into())
}

#[tauri::command]
pub async fn check_ue_translator_compatibility(_game_path: String) -> Result<CompatibilityResult, String> {
    Ok(CompatibilityResult {
        compatible: false,
        message: "UE AutoTranslator richiede Windows (WinAPI memory injection)".into(),
    })
}

// ═══════════════════════════════════════════════════════════════════
// commands::translation_bridge stubs
// ═══════════════════════════════════════════════════════════════════

pub mod translation_bridge_stubs {
    use serde::Serialize;

    #[derive(Default)]
    pub struct TranslationBridgeState;

    impl TranslationBridgeState {
        pub fn new() -> Self { Self }
    }

    #[derive(Serialize)]
    pub struct BridgeResponse<T: Serialize> {
        pub success: bool,
        pub data: Option<T>,
        pub error: Option<String>,
    }

    impl<T: Serialize> BridgeResponse<T> {
        fn err(msg: &str) -> Self {
            Self { success: false, data: None, error: Some(msg.to_string()) }
        }
    }

    const PLATFORM_ERR: &str = "Translation Bridge è disponibile solo su Windows";

    #[tauri::command]
    pub async fn translation_bridge_start() -> Result<BridgeResponse<String>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_stop() -> Result<BridgeResponse<String>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_status() -> Result<BridgeResponse<bool>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_stats() -> Result<BridgeResponse<serde_json::Value>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_dictionary_stats() -> Result<BridgeResponse<serde_json::Value>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_load_translations(_params: serde_json::Value) -> Result<BridgeResponse<usize>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_load_json(_path: String) -> Result<BridgeResponse<usize>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_set_languages(_source: String, _target: String) -> Result<BridgeResponse<String>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_add_translation(_original: String, _translated: String) -> Result<BridgeResponse<String>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_get_translation(_text: String) -> Result<BridgeResponse<Option<String>>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_export_json(_path: String) -> Result<BridgeResponse<String>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_clear() -> Result<BridgeResponse<String>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_drain_misses(_max: Option<usize>) -> Result<BridgeResponse<Vec<String>>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_save_dir(_dir: String) -> Result<BridgeResponse<usize>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }

    #[tauri::command]
    pub async fn translation_bridge_load_dir(_dir: String) -> Result<BridgeResponse<usize>, String> {
        Ok(BridgeResponse::err(PLATFORM_ERR))
    }
}

// ═══════════════════════════════════════════════════════════════════
// commands::screen_capture stubs
// ═══════════════════════════════════════════════════════════════════

#[derive(Serialize, Deserialize)]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

#[derive(Serialize, Deserialize)]
pub struct CaptureResult {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize)]
pub struct WindowInfo {
    pub title: String,
    pub pid: u32,
}

#[tauri::command]
pub fn check_screen_capture_available() -> bool {
    false
}

#[tauri::command]
pub fn get_monitors() -> Vec<MonitorInfo> {
    vec![]
}

#[tauri::command]
pub fn capture_screen(_x: u32, _y: u32, _width: u32, _height: u32) -> Result<CaptureResult, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub fn get_windows() -> Vec<WindowInfo> {
    vec![]
}

#[tauri::command]
pub fn capture_window(_window_title: String) -> Result<CaptureResult, String> {
    Err(PLATFORM_ERR.into())
}
