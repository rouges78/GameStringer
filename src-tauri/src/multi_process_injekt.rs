// Multi-Process Injection System
// Gestisce l'injection in giochi con architetture multi-processo

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use crate::injekt::{InjektTranslator, InjectionConfig};
use crate::process_utils::is_process_running;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiProcessConfig {
    pub game_name: String,
    pub primary_process: String,
    pub secondary_processes: Vec<String>,
    pub injection_strategy: InjectionStrategy,
    pub sync_translations: bool,
    pub max_processes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InjectionStrategy {
    /// Inietta solo nel processo principale
    PrimaryOnly,
    /// Inietta in tutti i processi rilevati
    AllProcesses,
    /// Inietta in processi specifici basati su pattern
    Selective(Vec<String>),
    /// Inietta in cascata (prima primario, poi secondari)
    Cascade,
}

#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub is_primary: bool,
    pub injection_active: bool,
    pub last_seen: Instant,
    pub injector: Option<Arc<Mutex<InjektTranslator>>>,
}

#[derive(Debug)]
pub struct MultiProcessInjekt {
    config: MultiProcessConfig,
    base_injection_config: InjectionConfig,
    active_processes: Arc<Mutex<HashMap<u32, ProcessInfo>>>,
    is_running: Arc<Mutex<bool>>,
    monitor_thread: Option<thread::JoinHandle<()>>,
    translation_cache: Arc<Mutex<HashMap<String, String>>>,
    stats: Arc<Mutex<MultiProcessStats>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiProcessStats {
    pub total_processes: u32,
    pub active_injections: u32,
    pub primary_process_active: bool,
    pub secondary_processes_active: u32,
    pub total_translations: u32,
    pub synchronized_translations: u32,
    pub last_process_scan: Option<String>,
    pub uptime_seconds: u64,
}

impl MultiProcessInjekt {
    pub fn new(config: MultiProcessConfig, base_config: InjectionConfig) -> Result<Self, Box<dyn Error>> {
        Ok(Self {
            config,
            base_injection_config: base_config,
            active_processes: Arc::new(Mutex::new(HashMap::new())),
            is_running: Arc::new(Mutex::new(false)),
            monitor_thread: None,
            translation_cache: Arc::new(Mutex::new(HashMap::new())),
            stats: Arc::new(Mutex::new(MultiProcessStats {
                total_processes: 0,
                active_injections: 0,
                primary_process_active: false,
                secondary_processes_active: 0,
                total_translations: 0,
                synchronized_translations: 0,
                last_process_scan: None,
                uptime_seconds: 0,
            })),
        })
    }

    pub fn start(&mut self) -> Result<(), Box<dyn Error>> {
        log::info!("🚀 Avvio sistema multi-processo per: {}", self.config.game_name);
        
        // Avvia il monitoraggio dei processi
        self.start_process_monitoring()?;
        
        // Scansiona processi esistenti
        self.scan_and_inject_processes()?;
        
        *self.is_running.lock().unwrap() = true;
        
        log::info!("✅ Sistema multi-processo avviato con successo");
        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), Box<dyn Error>> {
        log::info!("🔴 Arresto sistema multi-processo...");
        
        // Ferma il monitoraggio
        *self.is_running.lock().unwrap() = false;
        
        // Attendi che il thread termini
        if let Some(thread) = self.monitor_thread.take() {
            thread.join().ok();
        }
        
        // Ferma tutte le injection attive
        self.stop_all_injections()?;
        
        log::info!("✅ Sistema multi-processo arrestato");
        Ok(())
    }

    fn start_process_monitoring(&mut self) -> Result<(), Box<dyn Error>> {
        let is_running = Arc::clone(&self.is_running);
        let active_processes = Arc::clone(&self.active_processes);
        let stats = Arc::clone(&self.stats);
        let translation_cache = Arc::clone(&self.translation_cache);
        let config = self.config.clone();
        let base_config = self.base_injection_config.clone();
        let start_time = Instant::now();
        
        let monitor_thread = thread::spawn(move || {
            log::info!("🔍 Avvio monitoraggio processi multi-processo");
            
            while *is_running.lock().unwrap() {
                // Scansiona processi attivi
                match Self::scan_game_processes(&config.game_name, &config.primary_process, &config.secondary_processes) {
                    Ok(discovered_processes) => {
                        let mut processes = active_processes.lock().unwrap();
                        let mut current_pids: Vec<u32> = Vec::new();
                        
                        // Aggiorna processi esistenti e aggiungi nuovi
                        for (pid, name, is_primary) in discovered_processes {
                            current_pids.push(pid);
                            
                            if let Some(process_info) = processes.get_mut(&pid) {
                                // Aggiorna processo esistente
                                process_info.last_seen = Instant::now();
                            } else {
                                // Nuovo processo rilevato
                                log::info!("🆕 Nuovo processo rilevato: {} (PID: {}, Primary: {})", name, pid, is_primary);
                                
                                let should_inject = match &config.injection_strategy {
                                    InjectionStrategy::PrimaryOnly => is_primary,
                                    InjectionStrategy::AllProcesses => true,
                                    InjectionStrategy::Selective(patterns) => {
                                        patterns.iter().any(|pattern| name.contains(pattern))
                                    }
                                    InjectionStrategy::Cascade => {
                                        // Per cascade, inietta prima nel primario, poi nei secondari
                                        if is_primary {
                                            true
                                        } else {
                                            // Inietta nei secondari solo se il primario è già attivo
                                            processes.values().any(|p| p.is_primary && p.injection_active)
                                        }
                                    }
                                };
                                
                                let mut process_info = ProcessInfo {
                                    pid,
                                    name: name.clone(),
                                    is_primary,
                                    injection_active: false,
                                    last_seen: Instant::now(),
                                    injector: None,
                                };
                                
                                // Avvia injection se necessario
                                if should_inject {
                                    match Self::start_injection_for_process(&mut process_info, &base_config, &translation_cache) {
                                        Ok(()) => {
                                            log::info!("✅ Injection avviata per processo: {} (PID: {})", name, pid);
                                        }
                                        Err(e) => {
                                            log::error!("❌ Errore avvio injection per {}: {}", name, e);
                                        }
                                    }
                                }
                                
                                processes.insert(pid, process_info);
                            }
                        }
                        
                        // Rimuovi processi terminati
                        let mut terminated_pids = Vec::new();
                        for (pid, process_info) in processes.iter() {
                            if !current_pids.contains(pid) || !is_process_running(*pid) {
                                terminated_pids.push(*pid);
                                log::info!("🔴 Processo terminato: {} (PID: {})", process_info.name, pid);
                            }
                        }
                        
                        for pid in terminated_pids {
                            if let Some(mut process_info) = processes.remove(&pid) {
                                // Ferma injection se attiva
                                if process_info.injection_active {
                                    if let Some(injector) = process_info.injector.take() {
                                        if let Ok(mut injector_guard) = injector.lock() {
                                            let _ = injector_guard.stop();
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Aggiorna statistiche
                        if let Ok(mut stats_guard) = stats.lock() {
                            stats_guard.total_processes = processes.len() as u32;
                            stats_guard.active_injections = processes.values()
                                .filter(|p| p.injection_active)
                                .count() as u32;
                            stats_guard.primary_process_active = processes.values()
                                .any(|p| p.is_primary && p.injection_active);
                            stats_guard.secondary_processes_active = processes.values()
                                .filter(|p| !p.is_primary && p.injection_active)
                                .count() as u32;
                            stats_guard.last_process_scan = Some(chrono::Utc::now().to_rfc3339());
                            stats_guard.uptime_seconds = start_time.elapsed().as_secs();
                        }
                    }
                    Err(e) => {
                        log::error!("❌ Errore scansione processi: {}", e);
                    }
                }
                
                // Sincronizza traduzioni tra processi se abilitato
                if config.sync_translations {
                    Self::synchronize_translations(&active_processes, &translation_cache);
                }
                
                thread::sleep(Duration::from_secs(2));
            }
            
            log::info!("🔴 Monitoraggio processi multi-processo terminato");
        });
        
        self.monitor_thread = Some(monitor_thread);
        Ok(())
    }

    fn scan_game_processes(game_name: &str, primary_process: &str, secondary_processes: &[String]) -> Result<Vec<(u32, String, bool)>, Box<dyn Error>> {
        let mut discovered = Vec::new();
        
        // Usa il sistema di process_utils per ottenere i processi
        let processes = crate::process_utils::get_running_processes()?;
        
        for process in processes {
            let process_name = process.name.to_lowercase();
            let is_primary = process_name.contains(&primary_process.to_lowercase());
            let is_secondary = secondary_processes.iter()
                .any(|sec| process_name.contains(&sec.to_lowercase()));
            
            if is_primary || is_secondary {
                discovered.push((process.pid, process.name, is_primary));
            }
        }
        
        Ok(discovered)
    }

    fn start_injection_for_process(
        process_info: &mut ProcessInfo,
        base_config: &InjectionConfig,
        translation_cache: &Arc<Mutex<HashMap<String, String>>>
    ) -> Result<(), Box<dyn Error>> {
        // Crea configurazione specifica per questo processo
        let mut process_config = base_config.clone();
        process_config.target_process = process_info.name.clone();
        
        // Crea injector per questo processo
        let injector = InjektTranslator::new(process_config)?;
        let injector_arc = Arc::new(Mutex::new(injector));
        
        // Avvia injection
        {
            let mut injector_guard = injector_arc.lock().unwrap();
            injector_guard.start()?;
        }
        
        process_info.injector = Some(injector_arc);
        process_info.injection_active = true;
        
        Ok(())
    }

    fn synchronize_translations(
        active_processes: &Arc<Mutex<HashMap<u32, ProcessInfo>>>,
        translation_cache: &Arc<Mutex<HashMap<String, String>>>
    ) {
        // Implementazione di sincronizzazione traduzioni tra processi
        // In un'implementazione reale, qui raccoglieremmo le traduzioni
        // da tutti i processi attivi e le sincronizzeremmo
        
        if let Ok(processes) = active_processes.lock() {
            let active_count = processes.values()
                .filter(|p| p.injection_active)
                .count();
            
            if active_count > 1 {
                log::debug!("🔄 Sincronizzazione traduzioni tra {} processi", active_count);
                
                // Simula sincronizzazione
                if let Ok(mut cache) = translation_cache.lock() {
                    // Aggiungi traduzioni comuni
                    cache.insert("Continue".to_string(), "Continua".to_string());
                    cache.insert("New Game".to_string(), "Nuovo Gioco".to_string());
                    cache.insert("Options".to_string(), "Opzioni".to_string());
                }
            }
        }
    }

    fn scan_and_inject_processes(&mut self) -> Result<(), Box<dyn Error>> {
        log::info!("🔍 Scansione iniziale processi per: {}", self.config.game_name);
        
        // La scansione iniziale è gestita dal thread di monitoraggio
        // Qui possiamo fare una scansione immediata se necessario
        
        Ok(())
    }

    fn stop_all_injections(&mut self) -> Result<(), Box<dyn Error>> {
        log::info!("🛑 Arresto di tutte le injection attive...");
        
        if let Ok(mut processes) = self.active_processes.lock() {
            for (pid, process_info) in processes.iter_mut() {
                if process_info.injection_active {
                    if let Some(injector) = process_info.injector.take() {
                        if let Ok(mut injector_guard) = injector.lock() {
                            match injector_guard.stop() {
                                Ok(()) => {
                                    log::info!("✅ Injection arrestata per processo: {} (PID: {})", process_info.name, pid);
                                }
                                Err(e) => {
                                    log::error!("❌ Errore arresto injection per {}: {}", process_info.name, e);
                                }
                            }
                        }
                    }
                    process_info.injection_active = false;
                }
            }
            processes.clear();
        }
        
        Ok(())
    }

    pub fn get_stats(&self) -> serde_json::Value {
        if let Ok(stats) = self.stats.lock() {
            serde_json::to_value(&*stats).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        }
    }

    pub fn get_active_processes(&self) -> Vec<(u32, String, bool, bool)> {
        if let Ok(processes) = self.active_processes.lock() {
            processes.iter()
                .map(|(pid, info)| (*pid, info.name.clone(), info.is_primary, info.injection_active))
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn force_inject_process(&mut self, pid: u32) -> Result<(), Box<dyn Error>> {
        log::info!("🔧 Forzatura injection per processo PID: {}", pid);
        
        if let Ok(mut processes) = self.active_processes.lock() {
            if let Some(process_info) = processes.get_mut(&pid) {
                if !process_info.injection_active {
                    Self::start_injection_for_process(
                        process_info,
                        &self.base_injection_config,
                        &self.translation_cache
                    )?;
                    log::info!("✅ Injection forzata completata per PID: {}", pid);
                } else {
                    log::warn!("⚠️ Injection già attiva per PID: {}", pid);
                }
            } else {
                return Err(format!("Processo PID {} non trovato", pid).into());
            }
        }
        
        Ok(())
    }
}
