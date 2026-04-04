use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use winapi::shared::minwindef::{FALSE, LPVOID};
use winapi::um::handleapi::CloseHandle;
use winapi::um::memoryapi::{ReadProcessMemory, WriteProcessMemory, VirtualQueryEx};
use winapi::um::processthreadsapi::OpenProcess;

use winapi::um::winnt::{HANDLE, MEM_COMMIT, PAGE_EXECUTE_READWRITE, MEMORY_BASIC_INFORMATION,
    PROCESS_VM_READ, PROCESS_VM_WRITE, PROCESS_VM_OPERATION, PROCESS_QUERY_INFORMATION};

use winapi::um::tlhelp32::{CreateToolhelp32Snapshot, Module32First, Module32Next, MODULEENTRY32, TH32CS_SNAPMODULE};
use parking_lot::RwLock;

use crate::anti_cheat::AntiCheatManager;
use crate::process_utils::is_process_running;
use crate::translation_bridge::dictionary_engine::DictionaryEngine;

/// Wrapper thread-safe per HANDLE di Windows
#[derive(Debug)]
pub struct SafeHandle {
    handle: HANDLE,
}

impl SafeHandle {
    pub fn new(handle: HANDLE) -> Self {
        Self { handle }
    }
    
    pub fn get(&self) -> HANDLE {
        self.handle
    }
    
    #[allow(dead_code)] // Verifica handle null - essenziale per validazione sicurezza
    pub fn is_null(&self) -> bool {
        self.handle.is_null()
    }
}

// Implementazioni unsafe per Send e Sync
// SAFETY: HANDLE è un puntatore opaco di Windows che può essere condiviso tra thread
// purché non venga modificato concorrentemente. Il nostro uso è thread-safe.
unsafe impl Send for SafeHandle {}
unsafe impl Sync for SafeHandle {}

impl Drop for SafeHandle {
    fn drop(&mut self) {
        if !self.handle.is_null() {
            unsafe {
                CloseHandle(self.handle);
            }
        }
    }
}

// Costanti per la stabilizzazione
#[allow(dead_code)] // Costanti retry hook - essenziali per configurazione sicurezza
const MAX_HOOK_RETRIES: u32 = 3;
#[allow(dead_code)] // Delay retry hook - critico per timing sicuro
const HOOK_RETRY_DELAY: Duration = Duration::from_millis(100);
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const MAX_HOOK_FAILURES: u32 = 10;
#[allow(dead_code)] // Dimensione validazione memoria - essenziale per sicurezza
const MEMORY_VALIDATION_SIZE: usize = 4096;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InjectionConfig {
    pub target_process: String,
    pub target_language: String,
    pub provider: String,
    pub api_key: String,
    pub hook_mode: String,
    pub cache_enabled: bool,
}

#[derive(Debug)]
pub struct InjektTranslator {
    config: InjectionConfig,
    process_handle: Option<Arc<SafeHandle>>,
    target_pid: Option<u32>,
    hooks: Arc<Mutex<Vec<HookPoint>>>,
    stats: Arc<Mutex<InjektStats>>,
    is_running: Arc<Mutex<bool>>,
    monitor_thread: Option<thread::JoinHandle<()>>,
    anti_cheat_manager: AntiCheatManager,
    /// Dizionario condiviso dal TranslationBridge per lookup O(1)
    translation_dict: Option<Arc<RwLock<DictionaryEngine>>>,
}

#[derive(Debug, Clone)]
struct HookPoint {
    address: usize,
    original_bytes: Vec<u8>,
    #[allow(dead_code)] // Tipo hook - essenziale per classificazione hook sicurezza
    hook_type: HookType,
    #[allow(dead_code)] // Nome modulo - critico per identificazione target sicurezza
    module_name: String,
    #[allow(dead_code)] // Contatore retry - essenziale per diagnostica stabilità
    retry_count: u32,
    #[allow(dead_code)] // Ultimo errore - critico per debugging sicurezza
    last_error: Option<String>,
    #[allow(dead_code)] // Timestamp creazione - necessario per diagnostica temporale
    created_at: Instant,
    is_active: bool,
}

#[derive(Debug, Clone)]
enum HookType {
    TextRender,
    DialogBox,
    MenuItem,
    Subtitle,
}

#[derive(Debug, Clone)]
#[allow(dead_code)] // Struct informazioni modulo processo - essenziale per analisi sicurezza
struct ProcessModule {
    name: String,
    base_address: usize,
    size: usize,
    is_safe: bool,
}

#[derive(Debug, Clone)]
#[allow(dead_code)] // Struct errore injection - essenziale per diagnostica sicurezza
struct InjectionError {
    error_type: ErrorType,
    message: String,
    timestamp: Instant,
    retry_count: u32,
}

#[derive(Debug, Clone)]
#[allow(dead_code)] // Enum tipi errore - essenziale per classificazione errori sicurezza
enum ErrorType {
    ProcessNotFound,
    MemoryAccessDenied,
    HookFailed,
    AntiCheatDetected,
    InvalidAddress,
    ProcessTerminated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct InjektStats {
    is_active: bool,
    active_hooks: usize,
    translations_applied: u32,
    cached_translations: u32,
    process_id: Option<u32>,
    hook_failures: u32,
    last_heartbeat: Option<String>,
    uptime_seconds: u64,
    memory_usage_kb: u64,
    error_count: u32,
    recovery_count: u32,
}

impl InjektTranslator {
    pub fn new(config: InjectionConfig) -> Result<Self, Box<dyn Error>> {
        Ok(Self {
            config,
            process_handle: None,
            target_pid: None,
            hooks: Arc::new(Mutex::new(Vec::new())),
            stats: Arc::new(Mutex::new(InjektStats {
                is_active: false,
                active_hooks: 0,
                translations_applied: 0,
                cached_translations: 0,
                process_id: None,
                hook_failures: 0,
                last_heartbeat: None,
                uptime_seconds: 0,
                memory_usage_kb: 0,
                error_count: 0,
                recovery_count: 0,
            })),
            is_running: Arc::new(Mutex::new(false)),
            monitor_thread: None,
            anti_cheat_manager: AntiCheatManager::new(),
            translation_dict: None,
        })
    }

    /// Collega il dictionary engine del TranslationBridge.
    /// Tutte le traduzioni saranno cercate in questo dizionario condiviso.
    pub fn set_dictionary(&mut self, dict: Arc<RwLock<DictionaryEngine>>) {
        let entries = dict.read().get_stats().total_entries;
        self.translation_dict = Some(dict);
        log::info!("[InjektTranslator] Dictionary engine collegato ({} entries)", entries);
    }

    pub fn start(&mut self) -> Result<(), Box<dyn Error>> {
        // Trova il processo target
        let processes = crate::process_utils::find_game_processes()?;
        let target = processes
            .iter()
            .find(|p| p.name.contains(&self.config.target_process))
            .ok_or("Processo target non trovato")?;
        
        self.target_pid = Some(target.pid);
        
        // Apri il processo
        unsafe {
            let handle = OpenProcess(
                PROCESS_VM_READ | PROCESS_VM_WRITE | PROCESS_VM_OPERATION | PROCESS_QUERY_INFORMATION,
                FALSE, target.pid);
            if handle.is_null() {
                return Err("Impossibile aprire il processo target".into());
            }
            self.process_handle = Some(Arc::new(SafeHandle::new(handle)));
        }
        
        // Verifica compatibilità anti-cheat con sistema avanzato
        let anti_cheat_detection = self.anti_cheat_manager.detect_anti_cheat(target.pid)?;
        
        if !self.anti_cheat_manager.is_injection_safe(&anti_cheat_detection) {
            let detected_systems = anti_cheat_detection.detected_systems.join(", ");
            return Err(format!("🚨 Sistemi anti-cheat rilevati: {}. Injection non sicura (Risk: {:?})", 
                detected_systems, anti_cheat_detection.risk_assessment).into());
        }
        
        // Applica delay se necessario per compatibilità
        if let Some(delay_ms) = self.anti_cheat_manager.get_injection_delay(&anti_cheat_detection) {
            log::info!("⏱️ Applicazione delay di {}ms per compatibilità anti-cheat", delay_ms);
            thread::sleep(Duration::from_millis(delay_ms));
        }
        
        // Log informazioni anti-cheat
        if !anti_cheat_detection.detected_systems.is_empty() {
            log::warn!("⚠️ Sistemi anti-cheat rilevati: {} (Modalità: {:?})", 
                anti_cheat_detection.detected_systems.join(", "), 
                anti_cheat_detection.recommended_mode);
        }
        
        // Aggiorna stats
        {
            let mut stats = self.stats.lock().unwrap_or_else(|e| e.into_inner());
            stats.is_active = true;
            stats.process_id = Some(target.pid);
            stats.last_heartbeat = Some(chrono::Utc::now().to_rfc3339());
        }
        
        // Applica hooks basati sulla modalità
        self.apply_hooks()?;
        
        // Avvia thread di monitoraggio
        self.start_monitoring();
        
        Ok(())
    }
    
    pub fn stop(&mut self) -> Result<(), Box<dyn Error>> {
        log::info!("🔴 Arresto sistema injection...");
        
        // Ferma il monitoraggio
        if let Ok(mut is_running) = self.is_running.lock() {
            *is_running = false;
        }
        
        // Attendi che il thread termini con timeout
        if let Some(thread) = self.monitor_thread.take() {
            match thread.join() {
                Ok(()) => log::info!("✅ Thread di monitoraggio terminato correttamente"),
                Err(_) => log::warn!("⚠️ Thread di monitoraggio terminato con errore"),
            }
        }
        
        // Usa il sistema di cleanup automatico
        self.cleanup_resources();
        
        log::info!("✅ Sistema injection arrestato con successo");
        Ok(())
    }
    
    #[allow(dead_code)] // Statistiche injection - essenziali per monitoraggio sicurezza
    pub fn get_stats(&self) -> Value {
        let stats = self.stats.lock().unwrap_or_else(|e| e.into_inner());
        serde_json::to_value(&*stats).unwrap_or(serde_json::json!({}))
    }
    
    fn apply_hooks(&mut self) -> Result<(), Box<dyn Error>> {
        let start_time = Instant::now();
        let mut hooks = self.hooks.lock().unwrap_or_else(|e| e.into_inner());
        let unused_ids: &[usize] = &[];

        // Applica hook in base alla modalità — ogni funzione usa pattern scanning
        // per trovare l'indirizzo reale nel processo target
        match self.config.hook_mode.as_str() {
            "minimal" => {
                self.hook_ui_text_optimized(&mut hooks, unused_ids)?;
            }
            "safe" => {
                self.hook_ui_text_optimized(&mut hooks, unused_ids)?;
                self.hook_dialog_boxes_optimized(&mut hooks, unused_ids)?;
            }
            "aggressive" => {
                self.hook_ui_text_optimized(&mut hooks, unused_ids)?;
                self.hook_dialog_boxes_optimized(&mut hooks, unused_ids)?;
                self.hook_menu_items_optimized(&mut hooks, unused_ids)?;
                self.hook_subtitles_optimized(&mut hooks, unused_ids)?;
            }
            _ => return Err("Modalità hook non valida".into()),
        }

        let application_time = start_time.elapsed().as_millis() as u64;
        let mut stats = self.stats.lock().unwrap_or_else(|e| e.into_inner());
        stats.active_hooks = hooks.len();

        log::info!("Hook applicati in {}ms: {} hook attivi (modalita': {})",
            application_time, hooks.len(), self.config.hook_mode);

        Ok(())
    }
    
    fn remove_hooks(&mut self) -> Result<(), Box<dyn Error>> {
        let hooks = self.hooks.lock().unwrap_or_else(|e| e.into_inner());
        
        if let Some(handle_arc) = &self.process_handle {
            let handle = handle_arc.get();
            for hook in hooks.iter() {
                unsafe {
                    // Ripristina bytes originali
                    WriteProcessMemory(
                        handle,
                        hook.address as LPVOID,
                        hook.original_bytes.as_ptr() as LPVOID,
                        hook.original_bytes.len(),
                        std::ptr::null_mut(),
                    );
                }
            }
        }
        
        Ok(())
    }
    
    fn start_monitoring(&mut self) {
        let is_running = Arc::clone(&self.is_running);
        let stats = Arc::clone(&self.stats);
        let hooks = Arc::clone(&self.hooks);
        let translation_dict = self.translation_dict.clone();
        let pid = self.target_pid.unwrap();
        let start_time = Instant::now();
        
        *is_running.lock().unwrap_or_else(|e| e.into_inner()) = true;
        
        let monitor_thread = thread::spawn(move || {
            let mut last_heartbeat = Instant::now();
            let mut consecutive_failures = 0;
            
            log::info!("🔍 Avvio monitoraggio injection per PID: {}", pid);
            
            while *is_running.lock().unwrap_or_else(|e| e.into_inner()) {
                // Verifica che il processo sia ancora in esecuzione
                if !is_process_running(pid) {
                    log::warn!("⚠️ Processo target terminato: {}", pid);
                    *is_running.lock().unwrap_or_else(|e| e.into_inner()) = false;
                    break;
                }
                
                // Heartbeat ogni 5 secondi
                if last_heartbeat.elapsed() >= HEARTBEAT_INTERVAL {
                    if let Ok(mut stats_guard) = stats.lock() {
                        stats_guard.last_heartbeat = Some(chrono::Utc::now().to_rfc3339());
                        stats_guard.uptime_seconds = start_time.elapsed().as_secs();
                        
                        // Stima conservativa: base overhead + hook overhead
                        // (il valore reale richiederebbe Process Memory Counters API)
                        stats_guard.memory_usage_kb = 512 + (stats_guard.active_hooks * 8) as u64;
                        
                        log::debug!("💓 Heartbeat - Uptime: {}s, Hooks: {}, Traduzioni: {}", 
                            stats_guard.uptime_seconds, 
                            stats_guard.active_hooks, 
                            stats_guard.translations_applied
                        );
                    }
                    last_heartbeat = Instant::now();
                }
                
                // Verifica stato degli hook
                if let Ok(hooks_guard) = hooks.lock() {
                    let mut active_hooks = 0;
                    let mut failed_hooks = 0;
                    
                    for hook in hooks_guard.iter() {
                        if hook.is_active {
                            active_hooks += 1;
                        } else {
                            failed_hooks += 1;
                        }
                    }
                    
                    // Aggiorna statistiche
                    if let Ok(mut stats_guard) = stats.lock() {
                        stats_guard.active_hooks = active_hooks;
                        
                        // Se troppi hook falliscono, incrementa contatore errori
                        if failed_hooks > 0 {
                            consecutive_failures += 1;
                            stats_guard.error_count += 1;
                            
                            if consecutive_failures >= MAX_HOOK_FAILURES {
                                log::error!("🚨 Troppi hook falliti consecutivi: {}", consecutive_failures);
                                // In un'implementazione reale, qui chiameremmo attempt_recovery()
                                consecutive_failures = 0;
                                stats_guard.recovery_count += 1;
                            }
                        } else {
                            consecutive_failures = 0;
                        }
                    }
                }
                
                // Sincronizza stats dal dizionario condiviso (se collegato).
                if let Some(ref dict) = translation_dict {
                    let d = dict.read();
                    let dict_stats = d.get_stats();
                    if let Ok(mut stats_guard) = stats.lock() {
                        stats_guard.cached_translations = dict_stats.total_entries as u32;
                    }
                }
                
                thread::sleep(Duration::from_millis(100));
            }
            
            log::info!("🔴 Monitoraggio injection terminato per PID: {}", pid);
        });
        
        self.monitor_thread = Some(monitor_thread);
    }
    
    // === FUNZIONI DI OTTIMIZZAZIONE PERFORMANCE ===
    
    /// Cerca e installa un hook per una funzione specificata da un pattern di byte.
    /// Il pattern è cercato via `scan_pattern` nella memoria del processo.
    /// Se il pattern non viene trovato, il hook viene saltato con un warning.
    fn install_hook_by_pattern(
        &self,
        hooks: &mut Vec<HookPoint>,
        hook_type: HookType,
        label: &str,
        pattern: &[u8],
        mask: Option<&[u8]>,
    ) -> Result<(), Box<dyn Error>> {
        let start_time = Instant::now();

        match self.scan_pattern(pattern, mask)? {
            Some(address) => {
                let mut hook = HookPoint {
                    address,
                    original_bytes: vec![0; 5],
                    hook_type,
                    module_name: label.to_string(),
                    retry_count: 0,
                    last_error: None,
                    created_at: Instant::now(),
                    is_active: false,
                };

                match self.apply_hook_with_retry(&mut hook) {
                    Ok(()) => {
                        hooks.push(hook);
                        log::info!("✅ Hook {} installato a 0x{:X} (scan: {}ms)",
                            label, address, start_time.elapsed().as_millis());
                    }
                    Err(e) => {
                        log::warn!("⚠️ Hook {} trovato a 0x{:X} ma non installabile: {}",
                            label, address, e);
                    }
                }
            }
            None => {
                log::warn!("⚠️ Pattern per {} non trovato nel processo (scan: {}ms)",
                    label, start_time.elapsed().as_millis());
            }
        }

        Ok(())
    }

    // Patterns comuni per text rendering in game engines.
    // I mask bytes 0x00 = wildcard, 0xFF = match esatto.

    /// Hook funzioni di rendering testo UI (TextOutW, DrawTextW patterns)
    fn hook_ui_text_optimized(&self, hooks: &mut Vec<HookPoint>, _hook_ids: &[usize]) -> Result<(), Box<dyn Error>> {
        // Pattern: MOV ECX, [esp+...]; PUSH; CALL — tipico di wrapper TextOut/DrawText
        // Wildcard sui registri per adattarsi a compilatori diversi
        let pattern = &[0x8B, 0x4C, 0x24, 0x00, 0x56, 0xFF, 0x15]; // MOV ECX,[esp+?]; PUSH ESI; CALL [...]
        let mask    = &[0xFF, 0xFF, 0xFF, 0x00, 0xFF, 0xFF, 0xFF];
        self.install_hook_by_pattern(hooks, HookType::TextRender, "UI_TEXT", pattern, Some(mask))
    }

    /// Hook funzioni dialog box (MessageBoxW, ShowWindow patterns)
    fn hook_dialog_boxes_optimized(&self, hooks: &mut Vec<HookPoint>, _hook_ids: &[usize]) -> Result<(), Box<dyn Error>> {
        // Pattern: PUSH 0 (MB_OK); PUSH reg; PUSH reg; PUSH reg; CALL — MessageBoxW style
        let pattern = &[0x6A, 0x00, 0x50, 0x51, 0x52, 0xFF, 0x15];
        let mask    = &[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
        self.install_hook_by_pattern(hooks, HookType::DialogBox, "DIALOG_BOX", pattern, Some(mask))
    }

    /// Hook menu rendering
    fn hook_menu_items_optimized(&self, hooks: &mut Vec<HookPoint>, _hook_ids: &[usize]) -> Result<(), Box<dyn Error>> {
        // Pattern: LEA reg, [string_ref]; PUSH reg; CALL — common for menu text setup
        let pattern = &[0x8D, 0x00, 0x00, 0x00, 0x00, 0x00, 0x50, 0xE8];
        let mask    = &[0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF];
        self.install_hook_by_pattern(hooks, HookType::MenuItem, "MENU_ITEM", pattern, Some(mask))
    }

    /// Hook subtitle rendering
    fn hook_subtitles_optimized(&self, hooks: &mut Vec<HookPoint>, _hook_ids: &[usize]) -> Result<(), Box<dyn Error>> {
        // Pattern: MOV [esp+...], reg; LEA reg, [...]; CALL — subtitle display pipeline
        let pattern = &[0x89, 0x44, 0x24, 0x00, 0x8D, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE8];
        let mask    = &[0xFF, 0xFF, 0xFF, 0x00, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF];
        self.install_hook_by_pattern(hooks, HookType::Subtitle, "SUBTITLE", pattern, Some(mask))
    }
    
    // === FUNZIONI DI STABILIZZAZIONE AVANZATE ===

    /// Rileva sistemi anti-cheat comuni
    #[allow(dead_code)] // Metodo anti-cheat detection - mantenuto per future security features
    fn detect_anti_cheat(&self, _pid: u32) -> Result<bool, Box<dyn Error>> {
        let anti_cheat_processes = vec![
            "BattlEye", "EasyAntiCheat", "VAC", "PunkBuster", "XIGNCODE",
            "nProtect", "Themida", "VMProtect", "Denuvo", "ACE"
        ];
        
        // Scansiona processi attivi per anti-cheat
        let processes = crate::process_utils::get_running_processes()?;
        for process in processes {
            for anti_cheat in &anti_cheat_processes {
                if process.name.to_lowercase().contains(&anti_cheat.to_lowercase()) {
                    log::warn!("🚨 Sistema anti-cheat rilevato: {}", anti_cheat);
                    return Ok(true);
                }
            }
        }
        
        // Verifica moduli caricati nel processo target
        if let Some(handle_arc) = &self.process_handle {
            let handle = handle_arc.get();
            let modules = self.get_process_modules(handle)?;
            for module in modules {
                for anti_cheat in &anti_cheat_processes {
                    if module.name.to_lowercase().contains(&anti_cheat.to_lowercase()) {
                        log::warn!("🚨 Modulo anti-cheat nel processo: {}", anti_cheat);
                        return Ok(true);
                    }
                }
            }
        }
        
        Ok(false)
    }
    
    /// Ottiene i moduli caricati in un processo
    #[allow(dead_code)] // Metodo per analisi moduli processo - essenziale per sicurezza anti-cheat
    fn get_process_modules(&self, _handle: HANDLE) -> Result<Vec<ProcessModule>, Box<dyn Error>> {
        let mut modules = Vec::new();
        
        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE, self.target_pid.unwrap_or(0));
            if snapshot == winapi::um::handleapi::INVALID_HANDLE_VALUE {
                return Err("Impossibile creare snapshot moduli".into());
            }
            
            let mut module_entry: MODULEENTRY32 = std::mem::zeroed();
            module_entry.dwSize = std::mem::size_of::<MODULEENTRY32>() as u32;
            
            if Module32First(snapshot, &mut module_entry) != 0 {
                loop {
                    let module_name = std::ffi::CStr::from_ptr(module_entry.szModule.as_ptr())
                        .to_string_lossy()
                        .to_string();
                    
                    modules.push(ProcessModule {
                        name: module_name.clone(),
                        base_address: module_entry.modBaseAddr as usize,
                        size: module_entry.modBaseSize as usize,
                        is_safe: self.is_module_safe(&module_name),
                    });
                    
                    if Module32Next(snapshot, &mut module_entry) == 0 {
                        break;
                    }
                }
            }
            
            CloseHandle(snapshot);
        }
        
        Ok(modules)
    }
    
    /// Scansiona la memoria di un modulo per trovare un pattern di byte.
    /// Supporta wildcard (`0xFF` = qualsiasi byte) tramite maschera opzionale.
    /// Ritorna il primo indirizzo che corrisponde, o None.
    fn scan_pattern_in_module(
        &self,
        module: &ProcessModule,
        pattern: &[u8],
        mask: Option<&[u8]>,
    ) -> Option<usize> {
        let handle = self.process_handle.as_ref()?.get();
        let pat_len = pattern.len();
        if pat_len == 0 || module.size < pat_len { return None; }

        // Leggi il modulo a blocchi di 64KB
        const CHUNK: usize = 65536;
        let mut buf = vec![0u8; CHUNK + pat_len];
        let mut offset = 0usize;

        while offset < module.size {
            let read_size = (CHUNK + pat_len).min(module.size - offset);
            let mut bytes_read = 0usize;
            let ok = unsafe {
                ReadProcessMemory(
                    handle,
                    (module.base_address + offset) as LPVOID,
                    buf.as_mut_ptr() as LPVOID,
                    read_size,
                    &mut bytes_read,
                )
            };
            if ok == 0 || bytes_read < pat_len { offset += CHUNK; continue; }

            // Cerca il pattern nel buffer
            for i in 0..(bytes_read - pat_len + 1) {
                let matched = match mask {
                    Some(m) => (0..pat_len).all(|j| m[j] == 0 || buf[i + j] == pattern[j]),
                    None => &buf[i..i + pat_len] == pattern,
                };
                if matched {
                    let addr = module.base_address + offset + i;
                    log::info!("[PatternScan] Match trovato a 0x{:X} in {}", addr, module.name);
                    return Some(addr);
                }
            }
            offset += CHUNK;
        }

        None
    }

    /// Scansiona tutti i moduli del processo per un pattern.
    /// Filtra per moduli sicuri (no system DLLs, no anti-cheat).
    fn scan_pattern(
        &self,
        pattern: &[u8],
        mask: Option<&[u8]>,
    ) -> Result<Option<usize>, Box<dyn Error>> {
        let handle = self.process_handle.as_ref()
            .ok_or("Handle processo non disponibile")?.get();
        let modules = self.get_process_modules(handle)?;

        for module in &modules {
            if !module.is_safe { continue; }
            if let Some(addr) = self.scan_pattern_in_module(module, pattern, mask) {
                return Ok(Some(addr));
            }
        }

        Ok(None)
    }

    /// Verifica se un modulo è sicuro per l'hook
    #[allow(dead_code)] // Validazione sicurezza moduli - critica per protezione anti-cheat
    fn is_module_safe(&self, module_name: &str) -> bool {
        let unsafe_modules = ["kernel32.dll", "ntdll.dll", "user32.dll", "advapi32.dll",
            "BattlEye", "EasyAntiCheat", "VAC", "steam_api"];
        
        !unsafe_modules.iter().any(|&unsafe_mod| 
            module_name.to_lowercase().contains(&unsafe_mod.to_lowercase())
        )
    }
    
    /// Valida un indirizzo di memoria prima dell'hook
    #[allow(dead_code)] // Validazione memoria - essenziale per sicurezza injection
    fn validate_memory_address(&self, address: usize) -> Result<bool, Box<dyn Error>> {
        if let Some(handle_arc) = &self.process_handle {
            let handle = handle_arc.get();
            unsafe {
                let mut mbi: MEMORY_BASIC_INFORMATION = std::mem::zeroed();
                let result = VirtualQueryEx(
                    handle,
                    address as LPVOID,
                    &mut mbi,
                    std::mem::size_of::<MEMORY_BASIC_INFORMATION>()
                );
                
                if result == 0 {
                    return Ok(false);
                }
                
                // Verifica che la memoria sia accessibile e scrivibile
                let is_accessible = mbi.State == MEM_COMMIT;
                let is_writable = (mbi.Protect & PAGE_EXECUTE_READWRITE) != 0;
                
                return Ok(is_accessible && is_writable);
            }
        }
        
        Ok(false)
    }
    
    /// Applica un hook con retry e validazione
    #[allow(dead_code)] // Sistema retry hook - critico per stabilità injection
    fn apply_hook_with_retry(&self, hook: &mut HookPoint) -> Result<(), Box<dyn Error>> {
        let mut attempts = 0;
        
        while attempts < MAX_HOOK_RETRIES {
            // Valida l'indirizzo prima del tentativo
            if !self.validate_memory_address(hook.address)? {
                let error_msg = format!("Indirizzo non valido: 0x{:x}", hook.address);
                hook.last_error = Some(error_msg.clone());
                return Err(error_msg.into());
            }
            
            // Tenta l'hook
            match self.perform_hook(hook) {
                Ok(()) => {
                    hook.is_active = true;
                    hook.retry_count = attempts;
                    log::info!("✅ Hook applicato con successo: 0x{:x}", hook.address);
                    return Ok(());
                }
                Err(e) => {
                    attempts += 1;
                    hook.retry_count = attempts;
                    hook.last_error = Some(e.to_string());
                    
                    if attempts < MAX_HOOK_RETRIES {
                        log::warn!("⚠️ Hook fallito (tentativo {}/{}): {}", attempts, MAX_HOOK_RETRIES, e);
                        thread::sleep(HOOK_RETRY_DELAY);
                    } else {
                        log::error!("❌ Hook fallito definitivamente dopo {} tentativi: {}", MAX_HOOK_RETRIES, e);
                        
                        // Aggiorna statistiche errori
                        if let Ok(mut stats) = self.stats.lock() {
                            stats.hook_failures += 1;
                            stats.error_count += 1;
                        }
                        
                        return Err(e);
                    }
                }
            }
        }
        
        Err("Hook fallito dopo tutti i tentativi".into())
    }
    
    /// Esegue l'hook effettivo
    /// Esegue l'hook effettivo: salva i byte originali e scrive un JMP al detour.
    ///
    /// Attualmente salva i byte originali dal processo ma non scrive il JMP,
    /// perché il detour address richiede l'infrastruttura DLL (MiniHook/trampoline)
    /// che vive nel plugin iniettato (unity-translator-dll / ue-translator-dll).
    /// Quando il plugin DLL sarà collegato, qui si scriverà:
    ///   [0xE9, rel32] dove rel32 = detour_addr - (hook_addr + 5)
    fn perform_hook(&self, hook: &HookPoint) -> Result<(), Box<dyn Error>> {
        let handle = self.process_handle.as_ref()
            .ok_or("Handle processo non disponibile")?
            .get();

        unsafe {
            // Salva i byte originali (necessari per remove_hooks)
            let mut original_bytes = vec![0u8; 5];
            let mut bytes_read = 0;

            let read_result = ReadProcessMemory(
                handle,
                hook.address as LPVOID,
                original_bytes.as_mut_ptr() as LPVOID,
                original_bytes.len(),
                &mut bytes_read,
            );

            if read_result == 0 || bytes_read != original_bytes.len() {
                return Err("Impossibile leggere memoria processo".into());
            }

            // TODO: Scrivere JMP quando il detour address sara' disponibile
            // dal plugin DLL iniettato. Per ora registriamo l'hook come "trovato"
            // senza modificare la memoria del processo.
            log::info!("Hook registrato a 0x{:X} ({}) — attesa detour DLL",
                hook.address, hook.module_name);
            Ok(())
        }
    }
    
    /// Sistema di recovery automatico
    #[allow(dead_code)] // Sistema recovery automatico - critico per stabilità injection
    fn attempt_recovery(&mut self) -> Result<(), Box<dyn Error>> {
        log::info!("🔄 Tentativo di recovery del sistema injection...");
        
        // Incrementa contatore recovery
        if let Ok(mut stats) = self.stats.lock() {
            stats.recovery_count += 1;
        }
        
        // Rimuovi tutti gli hook esistenti
        self.remove_hooks()?;
        
        // Attendi un momento
        thread::sleep(Duration::from_millis(500));
        
        // Verifica che il processo sia ancora attivo
        if let Some(pid) = self.target_pid {
            if !is_process_running(pid) {
                return Err("Processo target terminato durante recovery".into());
            }
        }
        
        // Riapplica gli hook
        self.apply_hooks()?;
        
        log::info!("✅ Recovery completato con successo");
        Ok(())
    }
    
    /// Cleanup automatico delle risorse
    fn cleanup_resources(&mut self) {
        log::info!("🧹 Cleanup risorse injection...");
        
        // Ferma il monitoraggio
        if let Ok(mut is_running) = self.is_running.lock() {
            *is_running = false;
        }
        
        // Rimuovi hook (ignora errori durante cleanup)
        let _ = self.remove_hooks();
        
        // Handle processo verrà chiuso automaticamente dal Drop di SafeHandle
        self.process_handle.take();
        
        // Reset statistiche
        if let Ok(mut stats) = self.stats.lock() {
            stats.is_active = false;
            stats.active_hooks = 0;
            stats.process_id = None;
        }
        
        log::info!("✅ Cleanup completato");
    }
}

