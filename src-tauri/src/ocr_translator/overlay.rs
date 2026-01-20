// Overlay Module - Gestione finestra overlay trasparente

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayConfig {
    pub enabled: bool,
    pub opacity: f32,          // 0.0 - 1.0
    pub font_size: u32,
    pub background_color: String, // "#000000"
    pub text_color: String,       // "#FFFFFF"
    pub position: OverlayPosition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OverlayPosition {
    FollowText,    // Segue posizione testo originale
    BottomCenter,  // Sottotitoli in basso
    TopRight,      // Angolo alto destra
    Custom { x: i32, y: i32 },
}

impl Default for OverlayConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            opacity: 0.9,
            font_size: 18,
            background_color: "#1a1a1a".to_string(),
            text_color: "#ffffff".to_string(),
            position: OverlayPosition::FollowText,
        }
    }
}

/// Crea una finestra overlay trasparente
/// L'overlay sarà gestito dal frontend Tauri con una finestra separata
#[allow(dead_code)]
pub fn create_overlay_window() -> Result<(), String> {
    log::info!("🪟 Creazione finestra overlay");
    // L'overlay viene creato dal frontend Tauri
    // Questa funzione serve solo per configurazione
    Ok(())
}

/// Aggiorna il contenuto dell'overlay
#[allow(dead_code)]
pub fn update_overlay_content(texts: &[super::DetectedText]) -> Result<(), String> {
    if texts.is_empty() {
        return Ok(());
    }
    
    log::debug!("📝 Aggiornamento overlay con {} testi", texts.len());
    // Il frontend riceverà i testi via get_detected_texts() e li mostrerà
    Ok(())
}
