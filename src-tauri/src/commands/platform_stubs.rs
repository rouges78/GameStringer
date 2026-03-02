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
// commands::injekt stubs
// ═══════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn start_injection(_process_id: u32, _process_name: String, _config: serde_json::Value) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn stop_injection(_process_id: u32) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn get_injection_stats(_process_id: Option<u32>) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn test_injection() -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn get_processes() -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn get_process_info(_process_id: u32) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn inject_translation(_process_id: u32, _original_text: String, _translated_text: String, _position: Option<serde_json::Value>) -> Result<(), String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn scan_process_memory(_process_id: u32, _pattern: String) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn start_multi_process_injection(
    _game_name: String,
    _primary_process: String,
    _secondary_processes: Vec<String>,
    _config: serde_json::Value,
) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn stop_multi_process_injection(_game_name: String) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn get_multi_process_stats(_game_name: String) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn get_multi_process_active_processes(_game_name: String) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn force_inject_process(_game_name: String, _process_id: u32) -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

#[tauri::command]
pub async fn list_multi_process_games() -> Result<serde_json::Value, String> {
    Err(PLATFORM_ERR.into())
}

// ═══════════════════════════════════════════════════════════════════
// commands::anti_cheat stubs
// ═══════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn detect_anti_cheat_systems(_pid: u32) -> Result<serde_json::Value, String> {
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
