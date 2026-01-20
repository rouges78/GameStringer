use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CaptureResult {
    pub image_data: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowInfo {
    pub title: String,
    pub id: u32,
}

#[command]
pub fn check_screen_capture_available() -> bool {
    // Screen capture richiede implementazione nativa Windows
    // Per ora restituisce false, il frontend userà getDisplayMedia
    false
}

#[command]
pub fn get_monitors() -> Vec<MonitorInfo> {
    // Restituisce monitor di default
    // L'implementazione completa richiede windows-rs crate
    vec![MonitorInfo {
        id: 0,
        name: "Primary Monitor".to_string(),
        width: 1920,
        height: 1080,
        is_primary: true,
    }]
}

#[command]
pub fn capture_screen(
    _x: u32,
    _y: u32,
    _width: u32,
    _height: u32,
    _monitor: u32,
) -> Result<CaptureResult, String> {
    // L'implementazione completa richiede windows-rs crate con feature "Win32_Graphics_Gdi"
    // Per ora il frontend usa getDisplayMedia come fallback
    Err("Native screen capture not available. Using browser fallback.".to_string())
}

#[command]
pub fn get_windows() -> Vec<WindowInfo> {
    // L'implementazione completa richiede windows-rs crate
    vec![]
}

#[command]
pub fn capture_window(_window_title: String) -> Result<CaptureResult, String> {
    Err("Window capture not available".to_string())
}
