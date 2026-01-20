//! Protocol definitions for GameStringer Translation Bridge
//! 
//! Definisce il formato dei messaggi scambiati tra il plugin C# (Satellite)
//! e il backend Rust attraverso la shared memory.

use serde::{Deserialize, Serialize};

/// Magic number per identificare il buffer GameStringer
pub const MAGIC_NUMBER: u32 = 0x47535452; // "GSTR"

/// Versione del protocollo
pub const PROTOCOL_VERSION: u8 = 1;

/// Dimensione massima di una stringa (64KB)
#[allow(dead_code)]
pub const MAX_STRING_SIZE: usize = 65536;

/// Dimensione del ring buffer (4MB)
#[allow(dead_code)]
pub const RING_BUFFER_SIZE: usize = 4 * 1024 * 1024;

/// Numero massimo di slot nel ring buffer
pub const MAX_SLOTS: usize = 1024;

/// Header del buffer condiviso
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct SharedMemoryHeader {
    /// Magic number per validazione
    pub magic: u32,
    /// Versione del protocollo
    pub version: u8,
    /// Flag: 1 = server attivo
    pub server_active: u8,
    /// Padding per allineamento
    pub _padding: [u8; 2],
    /// Indice di scrittura (C# scrive qui)
    pub write_index: u32,
    /// Indice di lettura (Rust legge qui)
    pub read_index: u32,
    /// Numero di slot attivi
    pub slot_count: u32,
    /// Statistiche: richieste totali
    pub total_requests: u64,
    /// Statistiche: traduzioni trovate (cache hit)
    pub cache_hits: u64,
    /// Statistiche: traduzioni mancanti (cache miss)
    pub cache_misses: u64,
}

impl SharedMemoryHeader {
    pub fn new() -> Self {
        Self {
            magic: MAGIC_NUMBER,
            version: PROTOCOL_VERSION,
            server_active: 0,
            _padding: [0; 2],
            write_index: 0,
            read_index: 0,
            slot_count: MAX_SLOTS as u32,
            total_requests: 0,
            cache_hits: 0,
            cache_misses: 0,
        }
    }
    
    #[allow(dead_code)]
    pub fn is_valid(&self) -> bool {
        self.magic == MAGIC_NUMBER && self.version == PROTOCOL_VERSION
    }
}

impl Default for SharedMemoryHeader {
    fn default() -> Self {
        Self::new()
    }
}

/// Stato di uno slot nel ring buffer
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SlotState {
    /// Slot libero
    Empty = 0,
    /// C# ha scritto una richiesta, in attesa di Rust
    PendingRequest = 1,
    /// Rust sta processando
    Processing = 2,
    /// Rust ha scritto la risposta, in attesa di C#
    PendingResponse = 3,
    /// Errore durante la traduzione
    Error = 4,
}

impl From<u8> for SlotState {
    fn from(value: u8) -> Self {
        match value {
            0 => SlotState::Empty,
            1 => SlotState::PendingRequest,
            2 => SlotState::Processing,
            3 => SlotState::PendingResponse,
            4 => SlotState::Error,
            _ => SlotState::Empty,
        }
    }
}

/// Slot nel ring buffer per una singola richiesta/risposta
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct TranslationSlot {
    /// Stato dello slot
    pub state: u8,
    /// Padding
    pub _padding: [u8; 3],
    /// Hash della stringa originale (per lookup veloce)
    pub original_hash: u64,
    /// Lunghezza della stringa originale
    pub original_len: u32,
    /// Lunghezza della stringa tradotta
    pub translated_len: u32,
    /// Offset nel buffer dati per la stringa originale
    pub original_offset: u32,
    /// Offset nel buffer dati per la stringa tradotta
    pub translated_offset: u32,
    /// Timestamp della richiesta (per timeout)
    pub timestamp: u64,
}

impl TranslationSlot {
    pub fn new() -> Self {
        Self {
            state: SlotState::Empty as u8,
            _padding: [0; 3],
            original_hash: 0,
            original_len: 0,
            translated_len: 0,
            original_offset: 0,
            translated_offset: 0,
            timestamp: 0,
        }
    }
    
    #[allow(dead_code)]
    pub fn get_state(&self) -> SlotState {
        SlotState::from(self.state)
    }
    
    #[allow(dead_code)]
    pub fn set_state(&mut self, state: SlotState) {
        self.state = state as u8;
    }
}

impl Default for TranslationSlot {
    fn default() -> Self {
        Self::new()
    }
}

/// Richiesta di traduzione (usata internamente in Rust)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationRequest {
    /// Testo originale da tradurre
    pub original_text: String,
    /// Hash pre-calcolato (per performance)
    pub hash: u64,
    /// Contesto opzionale (es. nome del GameObject)
    pub context: Option<String>,
    /// Lingua sorgente (es. "en", "ja")
    pub source_lang: Option<String>,
}

impl TranslationRequest {
    #[allow(dead_code)]
    pub fn new(text: String) -> Self {
        let hash = Self::compute_hash(&text);
        Self {
            original_text: text,
            hash,
            context: None,
            source_lang: None,
        }
    }
    
    #[allow(dead_code)]
    pub fn with_context(mut self, context: String) -> Self {
        self.context = Some(context);
        self
    }
    
    /// FNV-1a hash per performance
    pub fn compute_hash(text: &str) -> u64 {
        const FNV_OFFSET: u64 = 14695981039346656037;
        const FNV_PRIME: u64 = 1099511628211;
        
        let mut hash = FNV_OFFSET;
        for byte in text.bytes() {
            hash ^= byte as u64;
            hash = hash.wrapping_mul(FNV_PRIME);
        }
        hash
    }
}

/// Risposta di traduzione
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationResponse {
    /// Testo tradotto
    pub translated_text: String,
    /// Se la traduzione è stata trovata in cache
    pub from_cache: bool,
    /// Tempo di elaborazione in microsecondi
    pub processing_time_us: u64,
}

impl TranslationResponse {
    #[allow(dead_code)]
    pub fn new(translated_text: String, from_cache: bool) -> Self {
        Self {
            translated_text,
            from_cache,
            processing_time_us: 0,
        }
    }
    
    #[allow(dead_code)]
    pub fn not_found() -> Self {
        Self {
            translated_text: String::new(),
            from_cache: false,
            processing_time_us: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_header_validation() {
        let header = SharedMemoryHeader::new();
        assert!(header.is_valid());
    }
    
    #[test]
    fn test_hash_consistency() {
        let text = "Hello, World!";
        let hash1 = TranslationRequest::compute_hash(text);
        let hash2 = TranslationRequest::compute_hash(text);
        assert_eq!(hash1, hash2);
    }
    
    #[test]
    fn test_hash_different() {
        let hash1 = TranslationRequest::compute_hash("Hello");
        let hash2 = TranslationRequest::compute_hash("World");
        assert_ne!(hash1, hash2);
    }
}
