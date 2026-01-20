/**
 * Global Hotkeys Module
 * 
 * Gestisce le hotkey globali per OCR e altre funzionalità.
 * Nota: GlobalHotKeyManager deve essere creato e usato sul main thread.
 */

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use once_cell::sync::Lazy;
use tauri::AppHandle;

// Solo le hotkey registrate (thread-safe)
static REGISTERED_HOTKEYS: Lazy<Mutex<Vec<(u32, String)>>> = Lazy::new(|| Mutex::new(Vec::new()));
static HOTKEYS_INITIALIZED: AtomicBool = AtomicBool::new(false);

#[derive(serde::Serialize, Clone)]
pub struct HotkeyEvent {
    pub action: String,
    pub timestamp: i64,
}

/// Inizializza il sistema di hotkey globali
/// Nota: Per ora restituisce solo true, le hotkey verranno gestite lato frontend
#[tauri::command]
pub async fn init_global_hotkeys(_app: AppHandle) -> Result<bool, String> {
    HOTKEYS_INITIALIZED.store(true, Ordering::SeqCst);
    println!("[HOTKEY] Sistema inizializzato (frontend-based)");
    Ok(true)
}

/// Registra una hotkey globale (salva solo la configurazione)
#[tauri::command]
pub async fn register_global_hotkey(
    modifiers: Vec<String>,
    key: String,
    action: String,
) -> Result<u32, String> {
    // Genera un ID univoco basato su modifiers+key
    let id = {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        use std::hash::{Hash, Hasher};
        modifiers.hash(&mut hasher);
        key.hash(&mut hasher);
        hasher.finish() as u32
    };
    
    // Salva associazione
    let mut hotkeys = REGISTERED_HOTKEYS.lock().unwrap();
    
    // Rimuovi se già esiste
    hotkeys.retain(|(hid, _)| *hid != id);
    hotkeys.push((id, action.clone()));
    
    println!("[HOTKEY] Registrata: {:?}+{} -> {}", modifiers, key, action);
    Ok(id)
}

/// Rimuove una hotkey registrata
#[tauri::command]
pub async fn unregister_global_hotkey(id: u32) -> Result<bool, String> {
    let mut hotkeys = REGISTERED_HOTKEYS.lock().unwrap();
    if let Some(pos) = hotkeys.iter().position(|(hid, _)| *hid == id) {
        hotkeys.remove(pos);
        println!("[HOTKEY] Rimossa: {}", id);
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Lista hotkey registrate
#[tauri::command]
pub async fn list_global_hotkeys() -> Result<Vec<(u32, String)>, String> {
    let hotkeys = REGISTERED_HOTKEYS.lock().unwrap();
    Ok(hotkeys.clone())
}

/// Rimuove tutte le hotkey
#[tauri::command]
pub async fn clear_global_hotkeys() -> Result<bool, String> {
    let mut hotkeys = REGISTERED_HOTKEYS.lock().unwrap();
    hotkeys.clear();
    println!("[HOTKEY] Tutte le hotkey rimosse");
    Ok(true)
}
