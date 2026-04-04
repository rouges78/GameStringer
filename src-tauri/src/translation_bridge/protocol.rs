//! Protocol definitions for GameStringer Translation Bridge
//!
//! Definisce il formato dei messaggi nella shared memory tra il plugin C# (Satellite)
//! e il backend Rust. Layout memoria:
//!
//! ```text
//! [SharedMemoryHeader][TranslationSlot x MAX_SLOTS][Request Data | Response Data]
//! |--- HEADER_SIZE --|--- SLOTS_TOTAL_SIZE ------|--- DATA_BUFFER_SIZE ----------|
//! ```
//!
//! Il plugin C# scrive le stringhe originali nell'area Request Data e imposta lo
//! slot a PendingRequest. Il server Rust legge, cerca nel dizionario, scrive la
//! traduzione nell'area Response Data e imposta PendingResponse.

use serde::{Deserialize, Serialize};

// ─── Costanti del protocollo ──────────────────────────────────────

/// Magic number per identificare il buffer GameStringer ("GSTR")
pub const MAGIC_NUMBER: u32 = 0x47535452;

/// Versione del protocollo
pub const PROTOCOL_VERSION: u8 = 1;

/// Dimensione massima di una singola stringa (64KB)
pub const MAX_STRING_SIZE: usize = 65536;

/// Numero massimo di slot nel ring buffer
pub const MAX_SLOTS: usize = 1024;

/// Dimensione totale del buffer dati (4MB)
pub const DATA_BUFFER_SIZE: usize = 4 * 1024 * 1024;

/// Meta' buffer per richieste (testi originali, scritti da C#)
pub const REQUEST_DATA_SIZE: usize = DATA_BUFFER_SIZE / 2;

/// Meta' buffer per risposte (traduzioni, scritte da Rust)
pub const RESPONSE_DATA_SIZE: usize = DATA_BUFFER_SIZE / 2;

/// Nome della shared memory per il sistema operativo
pub const SHMEM_FLINK: &str = "GameStringer_TranslationBridge_v1";

// ─── Adaptive polling thresholds ──────────────────────────────────

/// Iterazioni di spin loop prima di passare a yield
pub const SPIN_LIMIT: u32 = 100;

/// Iterazioni di yield prima di passare a sleep
pub const YIELD_LIMIT: u32 = 1000;

/// Durata sleep in microsecondi quando idle
pub const IDLE_SLEEP_US: u64 = 50;

// ─── Layout offsets (calcolati a compile-time) ────────────────────

/// Offset dell'header nella shared memory
pub const HEADER_OFFSET: usize = 0;

/// Dimensione dell'header (incluso padding del compilatore)
pub const HEADER_SIZE: usize = std::mem::size_of::<SharedMemoryHeader>();

/// Offset degli slot (allineato a 8 byte dopo l'header)
pub const SLOTS_OFFSET: usize = (HEADER_SIZE + 7) & !7;

/// Dimensione di un singolo slot
pub const SLOT_SIZE: usize = std::mem::size_of::<TranslationSlot>();

/// Dimensione totale dell'area slot
pub const SLOTS_TOTAL_SIZE: usize = SLOT_SIZE * MAX_SLOTS;

/// Offset del buffer dati (allineato a 64 byte per cache-line)
pub const DATA_OFFSET: usize = (SLOTS_OFFSET + SLOTS_TOTAL_SIZE + 63) & !63;

/// Offset dell'area richieste (prima meta' del buffer dati)
pub const REQUEST_DATA_OFFSET: usize = DATA_OFFSET;

/// Offset dell'area risposte (seconda meta' del buffer dati)
pub const RESPONSE_DATA_OFFSET: usize = DATA_OFFSET + REQUEST_DATA_SIZE;

/// Dimensione totale della shared memory
pub const TOTAL_SHMEM_SIZE: usize = DATA_OFFSET + DATA_BUFFER_SIZE;

// ─── Structs ──────────────────────────────────────────────────────

/// Header del buffer condiviso — primi byte della shared memory.
///
/// Contiene metadata del protocollo, indici del ring buffer, e statistiche
/// aggiornate in tempo reale da entrambi i lati (Rust e C#).
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct SharedMemoryHeader {
    /// Magic number per validazione ("GSTR" = 0x47535452)
    pub magic: u32,
    /// Versione del protocollo (deve corrispondere tra Rust e C#)
    pub version: u8,
    /// Flag: 1 = server Rust attivo, 0 = inattivo
    pub server_active: u8,
    /// Padding per allineamento a u32
    pub _padding: [u8; 2],
    /// Indice di scrittura nel ring buffer (C# incrementa dopo aver scritto uno slot)
    pub write_index: u32,
    /// Indice di lettura nel ring buffer (Rust incrementa dopo aver processato uno slot)
    pub read_index: u32,
    /// Numero totale di slot nel ring buffer
    pub slot_count: u32,
    /// Statistiche: richieste totali processate
    pub total_requests: u64,
    /// Statistiche: traduzioni trovate nel dizionario (cache hit)
    pub cache_hits: u64,
    /// Statistiche: traduzioni non trovate (cache miss)
    pub cache_misses: u64,
    /// Write head nell'area richieste (offset relativo a REQUEST_DATA_OFFSET)
    pub request_data_head: u32,
    /// Write head nell'area risposte (offset relativo a RESPONSE_DATA_OFFSET)
    pub response_data_head: u32,
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
            request_data_head: 0,
            response_data_head: 0,
        }
    }

    pub fn is_valid(&self) -> bool {
        self.magic == MAGIC_NUMBER && self.version == PROTOCOL_VERSION
    }
}

impl Default for SharedMemoryHeader {
    fn default() -> Self {
        Self::new()
    }
}

/// Stato di uno slot nel ring buffer.
///
/// Transizioni:
/// ```text
/// Empty → PendingRequest (C# scrive richiesta)
///   → Processing (Rust prende in carico)
///     → PendingResponse (Rust ha scritto la traduzione)
///       → Empty (C# ha letto la risposta)
///     → Error (errore durante traduzione)
///       → Empty (C# ha gestito l'errore)
/// ```
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SlotState {
    /// Slot libero, disponibile per nuove richieste
    Empty = 0,
    /// C# ha scritto una richiesta, in attesa che Rust la processi
    PendingRequest = 1,
    /// Rust sta processando la richiesta
    Processing = 2,
    /// Rust ha scritto la risposta, in attesa che C# la legga
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

/// Slot nel ring buffer per una singola richiesta/risposta di traduzione.
///
/// Ogni slot contiene i metadati per una traduzione in corso. Le stringhe
/// effettive (originale e tradotta) risiedono nel buffer dati, referenziate
/// tramite offset e lunghezza.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct TranslationSlot {
    /// Stato corrente dello slot (vedi SlotState)
    pub state: u8,
    /// Padding per allineamento a u64
    pub _padding: [u8; 3],
    /// Hash FNV-1a della stringa originale (per lookup veloce nel dizionario)
    pub original_hash: u64,
    /// Lunghezza in bytes della stringa originale (UTF-8)
    pub original_len: u32,
    /// Lunghezza in bytes della stringa tradotta (UTF-8), 0 se non trovata
    pub translated_len: u32,
    /// Offset della stringa originale nell'area richieste (relativo a REQUEST_DATA_OFFSET)
    pub original_offset: u32,
    /// Offset della stringa tradotta nell'area risposte (relativo a RESPONSE_DATA_OFFSET)
    pub translated_offset: u32,
    /// Timestamp della richiesta (millisecondi dall'avvio del server, per timeout)
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

    pub fn get_state(&self) -> SlotState {
        SlotState::from(self.state)
    }

    pub fn set_state(&mut self, state: SlotState) {
        self.state = state as u8;
    }
}

impl Default for TranslationSlot {
    fn default() -> Self {
        Self::new()
    }
}

/// Richiesta di traduzione (usata internamente in Rust per lookup diretto)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationRequest {
    /// Testo originale da tradurre
    pub original_text: String,
    /// Hash FNV-1a pre-calcolato
    pub hash: u64,
    /// Contesto opzionale (es. nome del GameObject, scene)
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

    /// FNV-1a hash a 64 bit — veloce, buona distribuzione, deterministico.
    /// Usato sia lato Rust che lato C# per lookup O(1) nel dizionario.
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

/// Risposta di traduzione (usata internamente in Rust)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationResponse {
    /// Testo tradotto (vuoto se non trovato)
    pub translated_text: String,
    /// Se la traduzione e' stata trovata nel dizionario
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
    fn test_header_invalid_magic() {
        let mut header = SharedMemoryHeader::new();
        header.magic = 0;
        assert!(!header.is_valid());
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

    #[test]
    fn test_slot_state_roundtrip() {
        for state in [
            SlotState::Empty,
            SlotState::PendingRequest,
            SlotState::Processing,
            SlotState::PendingResponse,
            SlotState::Error,
        ] {
            let byte = state as u8;
            let recovered = SlotState::from(byte);
            assert_eq!(state, recovered);
        }
    }

    #[test]
    fn test_layout_alignment() {
        // Slots offset deve essere allineato a 8 byte
        assert_eq!(SLOTS_OFFSET % 8, 0);
        // Data offset deve essere allineato a 64 byte (cache line)
        assert_eq!(DATA_OFFSET % 64, 0);
        // Response data deve essere dopo request data
        assert_eq!(RESPONSE_DATA_OFFSET, REQUEST_DATA_OFFSET + REQUEST_DATA_SIZE);
        // Dimensione totale deve essere coerente
        assert_eq!(TOTAL_SHMEM_SIZE, DATA_OFFSET + DATA_BUFFER_SIZE);
    }

    #[test]
    fn test_layout_sizes() {
        // Verifica che le dimensioni siano ragionevoli
        assert!(HEADER_SIZE < 256, "Header troppo grande: {}", HEADER_SIZE);
        assert!(SLOT_SIZE < 128, "Slot troppo grande: {}", SLOT_SIZE);
        assert!(TOTAL_SHMEM_SIZE > DATA_BUFFER_SIZE, "Shmem deve essere > data buffer");
        // ~4.1MB totale
        assert!(TOTAL_SHMEM_SIZE < 5 * 1024 * 1024, "Shmem troppo grande: {}", TOTAL_SHMEM_SIZE);
    }
}
