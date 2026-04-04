//! Shared Memory IPC for GameStringer Translation Bridge
//!
//! Implementa comunicazione cross-process tramite shared memory reale:
//! - Windows Named File Mapping via crate `shared_memory`
//! - Ring buffer lock-free con 1024 slot per richieste/risposte
//! - Adaptive polling: spin → yield → sleep (sub-microsecondo sotto carico)
//! - Dictionary engine thread-safe per lookup O(1)
//!
//! Il plugin C# (GameStringer.Satellite) apre la stessa shared memory con nome
//! `SHMEM_FLINK` e comunica scrivendo richieste negli slot.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use parking_lot::RwLock;
use serde::Serialize;
use shared_memory::{Shmem, ShmemConf};
use tracing::{debug, info, warn};

use super::dictionary_engine::DictionaryEngine;
use super::protocol::*;

/// Statistiche del bridge — esposte al frontend via Tauri commands
#[derive(Debug, Clone, Default, Serialize)]
pub struct BridgeStats {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub errors: u64,
    pub avg_response_time_us: f64,
    pub uptime_seconds: u64,
    /// true se la shared memory e' attiva e il server thread sta processando
    pub shmem_active: bool,
    /// Dimensione totale della shared memory in bytes
    pub shmem_size: usize,
}

/// Stats interne con accumulo per Welford's algorithm
#[derive(Debug, Clone, Default)]
struct InternalStats {
    total_requests: u64,
    cache_hits: u64,
    cache_misses: u64,
    errors: u64,
    /// Media running con Welford's online algorithm
    avg_response_time_us: f64,
}

/// Translation Bridge — Server IPC per traduzione in-game
///
/// Crea una regione di shared memory nominata accessibile dal plugin C#.
/// Il C# scrive richieste di traduzione negli slot del ring buffer,
/// il server thread Rust le processa cercando nel dictionary engine,
/// e scrive le risposte nell'area response data.
///
/// # Architettura
/// ```text
/// [Plugin C# (Satellite)]                    [TranslationBridge (Rust)]
///    |                                             |
///    |-- scrive testo originale in shmem --------→ |
///    |-- imposta slot = PendingRequest ----------→ |
///    |                                             |-- legge slot
///    |                                             |-- lookup dizionario O(1)
///    |                                             |-- scrive traduzione in shmem
///    |   ←--- imposta slot = PendingResponse ----- |
///    |-- legge traduzione                          |
///    |-- imposta slot = Empty                      |
/// ```
pub struct TranslationBridge {
    /// Dictionary engine per le traduzioni (thread-safe, condiviso con server thread)
    dictionary: Arc<RwLock<DictionaryEngine>>,
    /// Shared memory region (mantiene il mapping vivo)
    shmem: Option<Shmem>,
    /// Server thread che processa le richieste IPC
    server_thread: Option<JoinHandle<()>>,
    /// Flag atomico per controllare il server thread
    running: Arc<AtomicBool>,
    /// Statistiche interne (thread-safe)
    stats: Arc<RwLock<InternalStats>>,
    /// Timestamp di avvio del server
    start_time: Option<Instant>,
    /// Nome della shared memory (configurabile per test isolation)
    shmem_name: String,
    /// Dimensione della shared memory allocata
    shmem_size: usize,
}

// SAFETY: TranslationBridge contiene una Shmem il cui puntatore raw viene passato
// al server thread come usize. La Shmem resta viva (owned da TranslationBridge)
// per tutta la durata del server thread. Il puntatore non viene mai usato dopo
// che stop() rilascia la Shmem.
unsafe impl Send for TranslationBridge {}
unsafe impl Sync for TranslationBridge {}

impl TranslationBridge {
    /// Crea un nuovo Translation Bridge con il nome shared memory di default
    pub fn new() -> Self {
        Self::with_name(SHMEM_FLINK)
    }

    /// Crea un bridge con nome shared memory custom (per test isolation)
    pub fn with_name(name: &str) -> Self {
        Self {
            dictionary: Arc::new(RwLock::new(DictionaryEngine::new())),
            shmem: None,
            server_thread: None,
            running: Arc::new(AtomicBool::new(false)),
            stats: Arc::new(RwLock::new(InternalStats::default())),
            start_time: None,
            shmem_name: name.to_string(),
            shmem_size: 0,
        }
    }

    /// Avvia il server di traduzione IPC
    ///
    /// 1. Crea la shared memory nominata (accessibile dal plugin C#)
    /// 2. Inizializza header e slot nel buffer condiviso
    /// 3. Avvia il server thread che processa richieste dal ring buffer
    pub fn start(&mut self) -> Result<(), String> {
        if self.running.load(Ordering::SeqCst) {
            return Err("Server già in esecuzione".to_string());
        }

        // 1. Crea o apri la shared memory
        let shmem = self.create_shared_memory()?;
        let shmem_ptr = shmem.as_ptr() as usize;
        let shmem_len = shmem.len();

        // 2. Inizializza header e slot
        Self::initialize_shared_memory(shmem.as_ptr(), shmem_len)?;

        // 3. Salva riferimenti
        self.shmem = Some(shmem);
        self.shmem_size = shmem_len;
        self.running.store(true, Ordering::SeqCst);
        self.start_time = Some(Instant::now());

        // 4. Avvia server thread
        let dictionary = Arc::clone(&self.dictionary);
        let running = Arc::clone(&self.running);
        let stats = Arc::clone(&self.stats);

        let server_thread = thread::Builder::new()
            .name("translation-bridge-ipc".to_string())
            .spawn(move || {
                info!("[TranslationBridge] Server IPC thread avviato");
                Self::server_loop(shmem_ptr, dictionary, running, stats);
                info!("[TranslationBridge] Server IPC thread terminato");
            })
            .map_err(|e| format!("Errore avvio server thread: {}", e))?;

        self.server_thread = Some(server_thread);

        info!(
            "[TranslationBridge] Server IPC avviato (shmem: '{}', size: {} bytes, layout: header={}B + slots={}B + data={}B)",
            self.shmem_name, shmem_len, HEADER_SIZE, SLOTS_TOTAL_SIZE, DATA_BUFFER_SIZE
        );

        Ok(())
    }

    /// Ferma il server e rilascia la shared memory
    pub fn stop(&mut self) {
        if !self.running.load(Ordering::SeqCst) {
            return;
        }

        // Segnala al thread di fermarsi
        self.running.store(false, Ordering::SeqCst);

        // Marca server come inattivo nella shared memory (visibile al C#)
        if let Some(ref shmem) = self.shmem {
            unsafe {
                let header = shmem.as_ptr() as *mut SharedMemoryHeader;
                std::ptr::write_volatile(&mut (*header).server_active, 0);
            }
        }

        // Attendi che il thread termini (timeout implicito: il thread esce dal loop)
        if let Some(thread) = self.server_thread.take() {
            if let Err(e) = thread.join() {
                warn!("[TranslationBridge] Server thread join error: {:?}", e);
            }
        }

        // Rilascia shared memory (chiude il mapping Windows)
        self.shmem = None;
        self.shmem_size = 0;
        self.start_time = None;

        info!("[TranslationBridge] Server arrestato, shared memory rilasciata");
    }

    /// Carica un dizionario di traduzioni (thread-safe, puo' essere chiamato a server attivo)
    pub fn load_dictionary(
        &self,
        source_lang: &str,
        target_lang: &str,
        translations: Vec<(String, String)>,
    ) -> usize {
        let mut dict = self.dictionary.write();
        let count = dict.load_translations(source_lang, target_lang, translations);
        info!(
            "[TranslationBridge] Caricate {} traduzioni ({} -> {})",
            count, source_lang, target_lang
        );
        count
    }

    /// Carica traduzioni da file JSON (thread-safe)
    pub fn load_dictionary_from_json(&self, path: &str) -> Result<usize, String> {
        let mut dict = self.dictionary.write();
        dict.load_from_json(path)
    }

    /// Cerca una traduzione direttamente (path in-process, senza IPC)
    ///
    /// Utile per i Tauri commands quando il frontend vuole testare una traduzione.
    /// Non passa attraverso la shared memory — lookup diretto nel dizionario.
    pub fn translate(&self, text: &str) -> Option<String> {
        let start = Instant::now();
        let dict = self.dictionary.read();

        let hash = TranslationRequest::compute_hash(text);
        let result = dict.get_translation(hash, text);

        // Aggiorna statistiche (anche per lookup diretti)
        let elapsed = start.elapsed().as_micros() as f64;
        {
            let mut stats = self.stats.write();
            stats.total_requests += 1;
            if result.is_some() {
                stats.cache_hits += 1;
            } else {
                stats.cache_misses += 1;
            }
            // Welford's online algorithm per media stabile
            let n = stats.total_requests as f64;
            stats.avg_response_time_us += (elapsed - stats.avg_response_time_us) / n;
        }

        result
    }

    /// Ottieni statistiche del bridge
    pub fn get_stats(&self) -> BridgeStats {
        let internal = self.stats.read();
        BridgeStats {
            total_requests: internal.total_requests,
            cache_hits: internal.cache_hits,
            cache_misses: internal.cache_misses,
            errors: internal.errors,
            avg_response_time_us: internal.avg_response_time_us,
            uptime_seconds: self
                .start_time
                .map(|t| t.elapsed().as_secs())
                .unwrap_or(0),
            shmem_active: self.shmem.is_some() && self.running.load(Ordering::Relaxed),
            shmem_size: self.shmem_size,
        }
    }

    /// Verifica se il server e' in esecuzione
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Ottieni accesso al dictionary engine (per Tauri commands)
    pub fn dictionary(&self) -> &Arc<RwLock<DictionaryEngine>> {
        &self.dictionary
    }

    // ─── Internals ────────────────────────────────────────────────

    /// Crea la shared memory nominata via OS
    fn create_shared_memory(&self) -> Result<Shmem, String> {
        // Prova a creare una nuova regione
        match ShmemConf::new()
            .size(TOTAL_SHMEM_SIZE)
            .os_id(&self.shmem_name)
            .create()
        {
            Ok(shmem) => {
                info!(
                    "[TranslationBridge] Shared memory creata: '{}' ({} bytes)",
                    self.shmem_name,
                    shmem.len()
                );
                Ok(shmem)
            }
            Err(shared_memory::ShmemError::LinkExists) => {
                // Shared memory esiste (crash precedente o altra istanza)
                warn!(
                    "[TranslationBridge] Shared memory '{}' gia' esistente, riutilizzo...",
                    self.shmem_name
                );
                ShmemConf::new()
                    .os_id(&self.shmem_name)
                    .open()
                    .map_err(|e| format!("Errore apertura shared memory esistente: {}", e))
            }
            Err(e) => Err(format!("Errore creazione shared memory: {}", e)),
        }
    }

    /// Inizializza header e tutti gli slot nella shared memory
    fn initialize_shared_memory(ptr: *mut u8, size: usize) -> Result<(), String> {
        if size < TOTAL_SHMEM_SIZE {
            return Err(format!(
                "Shared memory troppo piccola: {} < {} bytes richiesti",
                size, TOTAL_SHMEM_SIZE
            ));
        }

        unsafe {
            // Azzera tutta la memoria
            std::ptr::write_bytes(ptr, 0, size);

            // Scrivi header con magic number e metadata
            let header = ptr as *mut SharedMemoryHeader;
            std::ptr::write(header, SharedMemoryHeader::new());
            // Marca il server come attivo (volatile per visibilita' cross-process)
            std::ptr::write_volatile(&mut (*header).server_active, 1);

            // Inizializza tutti gli slot a Empty
            let slots_base = ptr.add(SLOTS_OFFSET) as *mut TranslationSlot;
            for i in 0..MAX_SLOTS {
                std::ptr::write(slots_base.add(i), TranslationSlot::new());
            }
        }

        info!(
            "[TranslationBridge] Shared memory inizializzata: header@0, slots@{}, data@{}",
            SLOTS_OFFSET, DATA_OFFSET
        );

        Ok(())
    }

    /// Loop principale del server thread
    ///
    /// Polling adattivo sul ring buffer:
    /// - Sotto carico: spin loop (~0 latency)
    /// - Carico medio: thread yield
    /// - Idle: sleep 50µs (CPU ~0%)
    fn server_loop(
        shmem_ptr: usize,
        dictionary: Arc<RwLock<DictionaryEngine>>,
        running: Arc<AtomicBool>,
        stats: Arc<RwLock<InternalStats>>,
    ) {
        let base_ptr = shmem_ptr as *mut u8;
        let mut idle_count: u32 = 0;
        let start_time = Instant::now();

        while running.load(Ordering::Relaxed) {
            let processed = unsafe {
                Self::process_pending_slots(base_ptr, &dictionary, &stats)
            };

            if processed > 0 {
                idle_count = 0;
            } else {
                idle_count = idle_count.saturating_add(1);

                // Adaptive polling: spin → yield → sleep
                if idle_count < SPIN_LIMIT {
                    std::hint::spin_loop();
                } else if idle_count < YIELD_LIMIT {
                    thread::yield_now();
                } else {
                    thread::sleep(Duration::from_micros(IDLE_SLEEP_US));

                    // Aggiorna uptime periodicamente quando idle
                    if idle_count % 20000 == 0 {
                        debug!(
                            "[TranslationBridge] Server idle, uptime: {}s",
                            start_time.elapsed().as_secs()
                        );
                    }
                }
            }
        }

        // Marca server come inattivo nella shared memory
        unsafe {
            let header = base_ptr as *mut SharedMemoryHeader;
            std::ptr::write_volatile(&mut (*header).server_active, 0);
        }
    }

    /// Processa tutti gli slot con richieste pendenti (singola iterazione)
    ///
    /// Scansiona il ring buffer da read_index a write_index, processando
    /// ogni slot in stato PendingRequest. Ritorna il numero di slot processati.
    ///
    /// # Safety
    /// `base_ptr` deve puntare a una regione di shared memory valida di almeno
    /// `TOTAL_SHMEM_SIZE` bytes, inizializzata da `initialize_shared_memory`.
    unsafe fn process_pending_slots(
        base_ptr: *mut u8,
        dictionary: &Arc<RwLock<DictionaryEngine>>,
        stats: &Arc<RwLock<InternalStats>>,
    ) -> u32 {
        let header = base_ptr as *mut SharedMemoryHeader;
        let slots_base = base_ptr.add(SLOTS_OFFSET) as *mut TranslationSlot;
        let request_data = base_ptr.add(REQUEST_DATA_OFFSET);
        let response_data = base_ptr.add(RESPONSE_DATA_OFFSET);

        // Leggi indici con volatile (il C# potrebbe aver scritto)
        let read_idx = std::ptr::read_volatile(&(*header).read_index);
        let write_idx = std::ptr::read_volatile(&(*header).write_index);

        // Nessuna richiesta pendente
        if read_idx == write_idx {
            return 0;
        }

        let slot_count = (*header).slot_count as usize;
        let mut current_idx = read_idx;
        let mut processed = 0u32;

        // Accumulatori locali per batch update delle stats
        let mut local_hits = 0u64;
        let mut local_misses = 0u64;
        let mut local_errors = 0u64;
        let mut response_times: Vec<f64> = Vec::new();

        while current_idx != write_idx {
            let slot_idx = (current_idx as usize) % slot_count;
            let slot = slots_base.add(slot_idx);

            let state = SlotState::from(std::ptr::read_volatile(&(*slot).state));

            if state == SlotState::PendingRequest {
                let request_start = Instant::now();

                // Marca come in elaborazione (visibile al C#)
                std::ptr::write_volatile(&mut (*slot).state, SlotState::Processing as u8);

                // Leggi parametri della richiesta
                let orig_offset = (*slot).original_offset as usize;
                let orig_len = (*slot).original_len as usize;
                let orig_hash = (*slot).original_hash;

                // Validazione bounds
                if orig_len == 0
                    || orig_len > MAX_STRING_SIZE
                    || orig_offset + orig_len > REQUEST_DATA_SIZE
                {
                    std::ptr::write_volatile(&mut (*slot).state, SlotState::Error as u8);
                    local_errors += 1;
                    current_idx = current_idx.wrapping_add(1);
                    continue;
                }

                // Leggi testo originale dalla shared memory
                let orig_slice =
                    std::slice::from_raw_parts(request_data.add(orig_offset), orig_len);

                let original_text = match std::str::from_utf8(orig_slice) {
                    Ok(s) => s,
                    Err(_) => {
                        // UTF-8 invalido
                        std::ptr::write_volatile(&mut (*slot).state, SlotState::Error as u8);
                        local_errors += 1;
                        current_idx = current_idx.wrapping_add(1);
                        continue;
                    }
                };

                // Lookup nel dizionario (acquisisce read lock, molto veloce)
                let dict = dictionary.read();
                let translation = dict.get_translation(orig_hash, original_text);
                drop(dict);

                match translation {
                    Some(translated) => {
                        let translated_bytes = translated.as_bytes();
                        let translated_len = translated_bytes.len();

                        if translated_len > MAX_STRING_SIZE {
                            std::ptr::write_volatile(
                                &mut (*slot).state,
                                SlotState::Error as u8,
                            );
                            local_errors += 1;
                        } else {
                            // Alloca spazio nell'area risposte con wrap-around
                            let resp_head =
                                std::ptr::read_volatile(&(*header).response_data_head) as usize;

                            let write_offset = if resp_head + translated_len <= RESPONSE_DATA_SIZE {
                                resp_head
                            } else {
                                0 // Wrap around all'inizio del buffer
                            };

                            // Copia la traduzione nell'area risposte
                            std::ptr::copy_nonoverlapping(
                                translated_bytes.as_ptr(),
                                response_data.add(write_offset),
                                translated_len,
                            );

                            // Aggiorna metadata dello slot
                            (*slot).translated_offset = write_offset as u32;
                            (*slot).translated_len = translated_len as u32;

                            // Aggiorna write head
                            let new_head = (write_offset + translated_len) % RESPONSE_DATA_SIZE;
                            std::ptr::write_volatile(
                                &mut (*header).response_data_head,
                                new_head as u32,
                            );

                            // Aggiorna stats nella shared memory (visibili al C#)
                            let hits = std::ptr::read_volatile(&(*header).cache_hits);
                            std::ptr::write_volatile(&mut (*header).cache_hits, hits + 1);

                            // Marca come completato
                            std::ptr::write_volatile(
                                &mut (*slot).state,
                                SlotState::PendingResponse as u8,
                            );

                            local_hits += 1;
                        }
                    }
                    None => {
                        // Traduzione non trovata — slot marcato come PendingResponse con len=0
                        (*slot).translated_len = 0;
                        (*slot).translated_offset = 0;

                        let misses = std::ptr::read_volatile(&(*header).cache_misses);
                        std::ptr::write_volatile(&mut (*header).cache_misses, misses + 1);

                        std::ptr::write_volatile(
                            &mut (*slot).state,
                            SlotState::PendingResponse as u8,
                        );

                        local_misses += 1;
                    }
                }

                // Aggiorna contatore richieste nella shared memory
                let total = std::ptr::read_volatile(&(*header).total_requests);
                std::ptr::write_volatile(&mut (*header).total_requests, total + 1);

                response_times.push(request_start.elapsed().as_micros() as f64);
                processed += 1;
            }

            current_idx = current_idx.wrapping_add(1);
        }

        // Aggiorna read_index nella shared memory
        if processed > 0 {
            std::ptr::write_volatile(&mut (*header).read_index, current_idx);

            // Batch update delle stats Rust (singola acquisizione del lock)
            let mut s = stats.write();
            s.cache_hits += local_hits;
            s.cache_misses += local_misses;
            s.errors += local_errors;

            // Welford's algorithm per ogni tempo di risposta del batch
            for &elapsed_us in &response_times {
                s.total_requests += 1;
                let n = s.total_requests as f64;
                s.avg_response_time_us += (elapsed_us - s.avg_response_time_us) / n;
            }
        }

        processed
    }
}

impl Drop for TranslationBridge {
    fn drop(&mut self) {
        self.stop();
    }
}

impl Default for TranslationBridge {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicU32;

    // Contatore atomico per generare nomi shared memory unici nei test
    static TEST_COUNTER: AtomicU32 = AtomicU32::new(0);

    fn unique_shmem_name() -> String {
        let id = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        format!("GameStringer_Test_{}", id)
    }

    #[test]
    fn test_bridge_creation() {
        let bridge = TranslationBridge::new();
        assert!(!bridge.is_running());
        let stats = bridge.get_stats();
        assert!(!stats.shmem_active);
        assert_eq!(stats.total_requests, 0);
    }

    #[test]
    fn test_bridge_start_stop() {
        let name = unique_shmem_name();
        let mut bridge = TranslationBridge::with_name(&name);

        assert!(bridge.start().is_ok());
        assert!(bridge.is_running());

        let stats = bridge.get_stats();
        assert!(stats.shmem_active);
        assert!(stats.shmem_size >= TOTAL_SHMEM_SIZE);

        bridge.stop();
        assert!(!bridge.is_running());

        let stats = bridge.get_stats();
        assert!(!stats.shmem_active);
    }

    #[test]
    fn test_bridge_double_start() {
        let name = unique_shmem_name();
        let mut bridge = TranslationBridge::with_name(&name);

        assert!(bridge.start().is_ok());
        assert!(bridge.start().is_err()); // Seconda start deve fallire

        bridge.stop();
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

    #[test]
    fn test_direct_translate() {
        let bridge = TranslationBridge::new();
        bridge.load_dictionary(
            "en",
            "it",
            vec![("Hello".to_string(), "Ciao".to_string())],
        );

        // Il dizionario di default e' en->it
        assert_eq!(bridge.translate("Hello"), Some("Ciao".to_string()));
        assert_eq!(bridge.translate("Unknown"), None);
    }

    #[test]
    fn test_shared_memory_header_initialization() {
        let name = unique_shmem_name();
        let mut bridge = TranslationBridge::with_name(&name);

        bridge.start().unwrap();

        // Verifica che la shared memory sia stata inizializzata correttamente
        if let Some(ref shmem) = bridge.shmem {
            unsafe {
                let header = shmem.as_ptr() as *const SharedMemoryHeader;
                assert_eq!((*header).magic, MAGIC_NUMBER);
                assert_eq!((*header).version, PROTOCOL_VERSION);
                assert_eq!((*header).server_active, 1);
                assert_eq!((*header).slot_count, MAX_SLOTS as u32);
                assert_eq!((*header).write_index, 0);
                assert_eq!((*header).read_index, 0);
            }
        } else {
            panic!("Shared memory non allocata");
        }

        bridge.stop();
    }

    #[test]
    fn test_ipc_translation_roundtrip() {
        let name = unique_shmem_name();
        let mut bridge = TranslationBridge::with_name(&name);

        // Carica dizionario
        bridge.load_dictionary(
            "en",
            "it",
            vec![
                ("Hello".to_string(), "Ciao".to_string()),
                ("World".to_string(), "Mondo".to_string()),
            ],
        );

        bridge.start().unwrap();

        // Simula una richiesta C# scrivendo direttamente nella shared memory
        let shmem_ptr = bridge.shmem.as_ref().unwrap().as_ptr();
        let original_text = "Hello";
        let original_bytes = original_text.as_bytes();
        let original_hash = TranslationRequest::compute_hash(original_text);

        unsafe {
            let header = shmem_ptr as *mut SharedMemoryHeader;
            let slots_base = shmem_ptr.add(SLOTS_OFFSET) as *mut TranslationSlot;
            let request_data = shmem_ptr.add(REQUEST_DATA_OFFSET);

            // Scrivi testo originale nell'area richieste
            std::ptr::copy_nonoverlapping(
                original_bytes.as_ptr(),
                request_data,
                original_bytes.len(),
            );

            // Configura slot 0
            let slot = slots_base;
            (*slot).original_offset = 0;
            (*slot).original_len = original_bytes.len() as u32;
            (*slot).original_hash = original_hash;
            (*slot).translated_offset = 0;
            (*slot).translated_len = 0;
            (*slot).timestamp = 0;

            // Imposta stato a PendingRequest (questo trigghera il server)
            std::ptr::write_volatile(&mut (*slot).state, SlotState::PendingRequest as u8);

            // Incrementa write_index (segnala al server che c'e' lavoro)
            std::ptr::write_volatile(&mut (*header).write_index, 1);
        }

        // Attendi che il server processi la richiesta
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            unsafe {
                let slot = shmem_ptr.add(SLOTS_OFFSET) as *const TranslationSlot;
                let state = SlotState::from(std::ptr::read_volatile(&(*slot).state));

                if state == SlotState::PendingResponse || state == SlotState::Error {
                    break;
                }
            }

            if Instant::now() > deadline {
                bridge.stop();
                panic!("Timeout: il server non ha processato la richiesta in 2s");
            }

            thread::sleep(Duration::from_millis(1));
        }

        // Leggi la risposta
        unsafe {
            let slot = shmem_ptr.add(SLOTS_OFFSET) as *const TranslationSlot;
            let state = SlotState::from((*slot).state);

            assert_eq!(state, SlotState::PendingResponse, "Atteso PendingResponse");
            assert!((*slot).translated_len > 0, "Traduzione deve avere lunghezza > 0");

            let response_data = shmem_ptr.add(RESPONSE_DATA_OFFSET);
            let translated_slice = std::slice::from_raw_parts(
                response_data.add((*slot).translated_offset as usize),
                (*slot).translated_len as usize,
            );
            let translated = std::str::from_utf8(translated_slice).unwrap();

            assert_eq!(translated, "Ciao", "Traduzione attesa: 'Ciao', ricevuta: '{}'", translated);
        }

        // Verifica stats
        let stats = bridge.get_stats();
        assert_eq!(stats.total_requests, 1);
        assert_eq!(stats.cache_hits, 1);

        bridge.stop();
    }

    #[test]
    fn test_ipc_cache_miss() {
        let name = unique_shmem_name();
        let mut bridge = TranslationBridge::with_name(&name);

        // Dizionario vuoto — nessuna traduzione
        bridge.start().unwrap();

        let shmem_ptr = bridge.shmem.as_ref().unwrap().as_ptr();
        let original_text = "NotInDictionary";
        let original_bytes = original_text.as_bytes();

        unsafe {
            let header = shmem_ptr as *mut SharedMemoryHeader;
            let slots_base = shmem_ptr.add(SLOTS_OFFSET) as *mut TranslationSlot;
            let request_data = shmem_ptr.add(REQUEST_DATA_OFFSET);

            std::ptr::copy_nonoverlapping(
                original_bytes.as_ptr(),
                request_data,
                original_bytes.len(),
            );

            let slot = slots_base;
            (*slot).original_offset = 0;
            (*slot).original_len = original_bytes.len() as u32;
            (*slot).original_hash = TranslationRequest::compute_hash(original_text);
            std::ptr::write_volatile(&mut (*slot).state, SlotState::PendingRequest as u8);
            std::ptr::write_volatile(&mut (*header).write_index, 1);
        }

        // Attendi risposta
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            unsafe {
                let slot = shmem_ptr.add(SLOTS_OFFSET) as *const TranslationSlot;
                let state = SlotState::from(std::ptr::read_volatile(&(*slot).state));
                if state != SlotState::PendingRequest && state != SlotState::Processing {
                    break;
                }
            }
            if Instant::now() > deadline {
                bridge.stop();
                panic!("Timeout");
            }
            thread::sleep(Duration::from_millis(1));
        }

        // Cache miss: translated_len deve essere 0
        unsafe {
            let slot = shmem_ptr.add(SLOTS_OFFSET) as *const TranslationSlot;
            assert_eq!(SlotState::from((*slot).state), SlotState::PendingResponse);
            assert_eq!((*slot).translated_len, 0, "Cache miss: translated_len deve essere 0");
        }

        let stats = bridge.get_stats();
        assert_eq!(stats.cache_misses, 1);

        bridge.stop();
    }

    #[test]
    fn test_drop_stops_server() {
        let name = unique_shmem_name();
        let running;
        {
            let mut bridge = TranslationBridge::with_name(&name);
            bridge.start().unwrap();
            running = Arc::clone(&bridge.running);
            assert!(running.load(Ordering::SeqCst));
            // bridge viene droppato qui
        }
        // Il drop deve aver fermato il server
        assert!(!running.load(Ordering::SeqCst));
    }
}
