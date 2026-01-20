//! IPC Bridge per comunicazione con la DLL iniettata
//! 
//! Usa Named Pipes per comunicazione bidirezionale veloce.

use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tokio::sync::mpsc;
use serde::{Deserialize, Serialize};

use super::{TranslationRequest, TranslationResponse};

/// Nome del pipe per la comunicazione
pub const PIPE_NAME: &str = r"\\.\pipe\GameStringerUETranslator";

/// Stato del bridge IPC
#[derive(Debug, Clone)]
pub struct IPCBridgeState {
    pub is_running: bool,
    pub connected_games: Vec<String>,
    pub pending_requests: u32,
}

/// Bridge IPC per comunicazione con DLL iniettate
pub struct IPCBridge {
    state: Arc<Mutex<IPCBridgeState>>,
    translation_cache: Arc<Mutex<HashMap<String, String>>>,
    request_tx: Option<mpsc::Sender<TranslationRequest>>,
    response_rx: Option<mpsc::Receiver<TranslationResponse>>,
}

impl IPCBridge {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(IPCBridgeState {
                is_running: false,
                connected_games: Vec::new(),
                pending_requests: 0,
            })),
            translation_cache: Arc::new(Mutex::new(HashMap::new())),
            request_tx: None,
            response_rx: None,
        }
    }
    
    /// Avvia il server IPC
    pub async fn start(&mut self) -> Result<(), String> {
        log::info!("🚀 Avvio IPC Bridge su {}", PIPE_NAME);
        
        {
            let mut state = self.state.lock().unwrap();
            state.is_running = true;
        }
        
        // Il server Named Pipe sarà implementato platform-specific
        #[cfg(target_os = "windows")]
        {
            self.start_windows_pipe_server().await?;
        }
        
        Ok(())
    }
    
    /// Ferma il server IPC
    pub fn stop(&mut self) {
        log::info!("🛑 Arresto IPC Bridge");
        let mut state = self.state.lock().unwrap();
        state.is_running = false;
    }
    
    /// Ottiene lo stato corrente
    pub fn get_state(&self) -> IPCBridgeState {
        self.state.lock().unwrap().clone()
    }
    
    /// Processa una richiesta di traduzione
    pub async fn process_translation(&self, request: TranslationRequest) -> TranslationResponse {
        let original = &request.original_text;
        
        // Controlla cache
        {
            let cache = self.translation_cache.lock().unwrap();
            if let Some(cached) = cache.get(original) {
                log::debug!("📦 Cache hit per: {}", truncate_text(original, 50));
                return TranslationResponse {
                    id: request.id,
                    translated_text: cached.clone(),
                    from_cache: true,
                };
            }
        }
        
        // Traduci usando il servizio di traduzione di GameStringer
        let translated = self.translate_text(original, &request.context).await;
        
        // Salva in cache
        {
            let mut cache = self.translation_cache.lock().unwrap();
            cache.insert(original.clone(), translated.clone());
        }
        
        TranslationResponse {
            id: request.id,
            translated_text: translated,
            from_cache: false,
        }
    }
    
    /// Traduce testo usando il servizio configurato
    async fn translate_text(&self, text: &str, _context: &Option<String>) -> String {
        // Per ora placeholder - verrà collegato al neural translator
        log::info!("🌐 Traduzione richiesta: {}", truncate_text(text, 50));
        
        // TODO: Collegare al NeuralTranslator o Google Translate
        // Per ora ritorna il testo originale con marker
        format!("[IT] {}", text)
    }
    
    /// Avvia server Named Pipe su Windows
    #[cfg(target_os = "windows")]
    async fn start_windows_pipe_server(&mut self) -> Result<(), String> {
        #![allow(unused_imports)]
        use std::ptr::null_mut;
        
        log::info!("📡 Creazione Named Pipe server...");
        
        // Il server sarà implementato in un thread separato
        let state = Arc::clone(&self.state);
        let _cache = Arc::clone(&self.translation_cache);
        
        tokio::spawn(async move {
            loop {
                // Controlla se dobbiamo fermarci
                {
                    let s = state.lock().unwrap();
                    if !s.is_running {
                        break;
                    }
                }
                
                // Simula attesa connessione (implementazione reale userebbe CreateNamedPipe)
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
            
            log::info!("📡 Named Pipe server terminato");
        });
        
        Ok(())
    }
    
    /// Salva la cache su disco
    pub fn save_cache(&self, path: &std::path::Path) -> Result<(), String> {
        let cache = self.translation_cache.lock().unwrap();
        let json = serde_json::to_string_pretty(&*cache)
            .map_err(|e| format!("Errore serializzazione cache: {}", e))?;
        std::fs::write(path, json)
            .map_err(|e| format!("Errore scrittura cache: {}", e))?;
        Ok(())
    }
    
    /// Carica la cache da disco
    pub fn load_cache(&self, path: &std::path::Path) -> Result<(), String> {
        if !path.exists() {
            return Ok(());
        }
        
        let json = std::fs::read_to_string(path)
            .map_err(|e| format!("Errore lettura cache: {}", e))?;
        let loaded: HashMap<String, String> = serde_json::from_str(&json)
            .map_err(|e| format!("Errore parsing cache: {}", e))?;
        
        let mut cache = self.translation_cache.lock().unwrap();
        *cache = loaded;
        
        log::info!("📦 Caricata cache con {} traduzioni", cache.len());
        Ok(())
    }
}

impl Default for IPCBridge {
    fn default() -> Self {
        Self::new()
    }
}

/// Tronca testo per logging
fn truncate_text(text: &str, max_len: usize) -> String {
    if text.len() <= max_len {
        text.to_string()
    } else {
        format!("{}...", &text[..max_len])
    }
}

/// Messaggio IPC generico
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IPCMessage {
    /// Richiesta di traduzione
    TranslateRequest(TranslationRequest),
    /// Risposta traduzione
    TranslateResponse(TranslationResponse),
    /// Ping per verificare connessione
    Ping,
    /// Pong risposta
    Pong,
    /// Notifica stato
    Status { translating: bool, texts_count: u64 },
    /// Comando toggle traduzione
    ToggleTranslation,
    /// Comando shutdown
    Shutdown,
}
