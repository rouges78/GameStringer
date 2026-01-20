//! Shared Memory IPC for GameStringer Translation Bridge
//! 
//! Implementa un sistema di traduzione in-game con:
//! - Dictionary engine thread-safe per lookup O(1)
//! - Statistiche in tempo reale
//! - Hot-reload senza riavvio

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use parking_lot::RwLock;
use serde::Serialize;
use tracing::info;

use super::dictionary_engine::DictionaryEngine;

/// Translation Bridge - Backend per traduzione in-game
/// 
/// Gestisce i dizionari di traduzione e fornisce lookup ultra-veloci.
pub struct TranslationBridge {
    /// Dictionary engine per le traduzioni (thread-safe)
    dictionary: Arc<RwLock<DictionaryEngine>>,
    /// Flag per indicare se il server è attivo
    running: Arc<AtomicBool>,
    /// Statistiche (thread-safe)
    stats: Arc<RwLock<BridgeStats>>,
    /// Timestamp di avvio
    start_time: Option<Instant>,
}

/// Statistiche del bridge
#[derive(Debug, Clone, Default, Serialize)]
pub struct BridgeStats {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub errors: u64,
    pub avg_response_time_us: f64,
    pub uptime_seconds: u64,
}

impl TranslationBridge {
    /// Crea un nuovo Translation Bridge
    pub fn new() -> Self {
        Self {
            dictionary: Arc::new(RwLock::new(DictionaryEngine::new())),
            running: Arc::new(AtomicBool::new(false)),
            stats: Arc::new(RwLock::new(BridgeStats::default())),
            start_time: None,
        }
    }
    
    /// Avvia il server di traduzione
    pub fn start(&mut self) -> Result<(), String> {
        if self.running.load(Ordering::SeqCst) {
            return Err("Server già in esecuzione".to_string());
        }
        
        self.running.store(true, Ordering::SeqCst);
        self.start_time = Some(Instant::now());
        
        info!("[TranslationBridge] ✅ Server di traduzione avviato");
        Ok(())
    }
    
    /// Ferma il server
    pub fn stop(&mut self) {
        if !self.running.load(Ordering::SeqCst) {
            return;
        }
        
        self.running.store(false, Ordering::SeqCst);
        self.start_time = None;
        
        info!("[TranslationBridge] ✅ Server arrestato");
    }
    
    /// Carica un dizionario di traduzioni
    pub fn load_dictionary(&self, source_lang: &str, target_lang: &str, translations: Vec<(String, String)>) -> usize {
        let mut dict = self.dictionary.write();
        let count = dict.load_translations(source_lang, target_lang, translations);
        info!("[TranslationBridge] 📚 Caricate {} traduzioni ({} -> {})", count, source_lang, target_lang);
        count
    }
    
    /// Carica traduzioni da file JSON
    pub fn load_dictionary_from_json(&self, path: &str) -> Result<usize, String> {
        let mut dict = self.dictionary.write();
        dict.load_from_json(path)
    }
    
    /// Cerca una traduzione
    #[allow(dead_code)]
    pub fn translate(&self, text: &str) -> Option<String> {
        let start = Instant::now();
        let dict = self.dictionary.read();
        
        let hash = super::protocol::TranslationRequest::compute_hash(text);
        let result = dict.get_translation(hash, text);
        
        // Aggiorna statistiche
        let elapsed = start.elapsed().as_micros() as f64;
        {
            let mut stats = self.stats.write();
            stats.total_requests += 1;
            if result.is_some() {
                stats.cache_hits += 1;
            } else {
                stats.cache_misses += 1;
            }
            if stats.total_requests > 0 {
                stats.avg_response_time_us = 
                    (stats.avg_response_time_us * (stats.total_requests - 1) as f64 + elapsed) 
                    / stats.total_requests as f64;
            }
        }
        
        result
    }
    
    /// Ottieni statistiche
    pub fn get_stats(&self) -> BridgeStats {
        let mut stats = self.stats.read().clone();
        if let Some(start) = self.start_time {
            stats.uptime_seconds = start.elapsed().as_secs();
        }
        stats
    }
    
    /// Verifica se il server è in esecuzione
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
    
    /// Ottieni accesso al dictionary engine
    pub fn dictionary(&self) -> &Arc<RwLock<DictionaryEngine>> {
        &self.dictionary
    }
}

// Implementa Send e Sync manualmente poiché tutti i campi sono thread-safe
unsafe impl Send for TranslationBridge {}
unsafe impl Sync for TranslationBridge {}

impl Default for TranslationBridge {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bridge_creation() {
        let bridge = TranslationBridge::new();
        assert!(!bridge.is_running());
    }
    
    #[test]
    fn test_bridge_start_stop() {
        let mut bridge = TranslationBridge::new();
        assert!(bridge.start().is_ok());
        assert!(bridge.is_running());
        bridge.stop();
        assert!(!bridge.is_running());
    }
    
    #[test]
    fn test_dictionary_loading() {
        let bridge = TranslationBridge::new();
        let translations = vec![
            ("Hello".to_string(), "Ciao".to_string()),
            ("World".to_string(), "Mondo".to_string()),
        ];
        let count = bridge.load_dictionary("en", "it", translations);
        assert_eq!(count, 2);
    }
}
