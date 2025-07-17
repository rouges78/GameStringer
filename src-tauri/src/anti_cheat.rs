use std::collections::HashMap;
use std::error::Error;
use std::sync::{Arc, Mutex};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use winapi::um::tlhelp32::{CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32, TH32CS_SNAPPROCESS};
use winapi::um::psapi::{EnumProcessModules, GetModuleBaseNameA};
use winapi::um::handleapi::CloseHandle;
use winapi::um::processthreadsapi::OpenProcess;
use winapi::um::winnt::{PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntiCheatInfo {
    pub name: String,
    pub detection_method: DetectionMethod,
    pub risk_level: RiskLevel,
    pub compatibility_mode: CompatibilityMode,
    pub bypass_strategies: Vec<BypassStrategy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DetectionMethod {
    ProcessName,
    ModuleName,
    ServiceName,
    RegistryKey,
    FileSystem,
    NetworkSignature,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,      // Injection possibile con precauzioni
    Medium,   // Injection rischiosa, richiede bypass
    High,     // Injection altamente rischiosa
    Critical, // Injection sconsigliata
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CompatibilityMode {
    Direct,        // Injection diretta
    Delayed,       // Injection ritardata
    Stealth,       // Injection nascosta
    Proxy,         // Injection tramite proxy
    Disabled,      // Injection disabilitata
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BypassStrategy {
    DelayedInjection,
    ProcessHollowing,
    ManualMapping,
    ReflectiveDLL,
    ThreadHijacking,
    SetWindowsHook,
    WaitForSafeWindow,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntiCheatDetection {
    pub detected_systems: Vec<String>,
    pub risk_assessment: RiskLevel,
    pub recommended_mode: CompatibilityMode,
    pub detection_time: DateTime<Utc>,
    pub process_id: u32,
    pub details: HashMap<String, String>,
}

pub struct AntiCheatManager {
    known_systems: HashMap<String, AntiCheatInfo>,
    detection_cache: Arc<Mutex<HashMap<u32, AntiCheatDetection>>>,
    cache_duration: chrono::Duration,
}

impl AntiCheatManager {
    pub fn new() -> Self {
        let mut known_systems = HashMap::new();
        
        // Sistemi anti-cheat noti con informazioni dettagliate
        known_systems.insert("battleye".to_string(), AntiCheatInfo {
            name: "BattlEye".to_string(),
            detection_method: DetectionMethod::ProcessName,
            risk_level: RiskLevel::High,
            compatibility_mode: CompatibilityMode::Stealth,
            bypass_strategies: vec![
                BypassStrategy::DelayedInjection,
                BypassStrategy::WaitForSafeWindow,
                BypassStrategy::SetWindowsHook,
            ],
        });

        known_systems.insert("eac".to_string(), AntiCheatInfo {
            name: "Easy Anti-Cheat".to_string(),
            detection_method: DetectionMethod::ProcessName,
            risk_level: RiskLevel::High,
            compatibility_mode: CompatibilityMode::Stealth,
            bypass_strategies: vec![
                BypassStrategy::DelayedInjection,
                BypassStrategy::ManualMapping,
                BypassStrategy::WaitForSafeWindow,
            ],
        });

        known_systems.insert("vac".to_string(), AntiCheatInfo {
            name: "Valve Anti-Cheat".to_string(),
            detection_method: DetectionMethod::ModuleName,
            risk_level: RiskLevel::Critical,
            compatibility_mode: CompatibilityMode::Disabled,
            bypass_strategies: vec![],
        });

        known_systems.insert("ricochet".to_string(), AntiCheatInfo {
            name: "Ricochet Anti-Cheat".to_string(),
            detection_method: DetectionMethod::ProcessName,
            risk_level: RiskLevel::Critical,
            compatibility_mode: CompatibilityMode::Disabled,
            bypass_strategies: vec![],
        });

        known_systems.insert("xigncode".to_string(), AntiCheatInfo {
            name: "XIGNCODE3".to_string(),
            detection_method: DetectionMethod::ProcessName,
            risk_level: RiskLevel::Medium,
            compatibility_mode: CompatibilityMode::Delayed,
            bypass_strategies: vec![
                BypassStrategy::DelayedInjection,
                BypassStrategy::ThreadHijacking,
            ],
        });

        known_systems.insert("nprotect".to_string(), AntiCheatInfo {
            name: "nProtect GameGuard".to_string(),
            detection_method: DetectionMethod::ProcessName,
            risk_level: RiskLevel::Medium,
            compatibility_mode: CompatibilityMode::Stealth,
            bypass_strategies: vec![
                BypassStrategy::DelayedInjection,
                BypassStrategy::ProcessHollowing,
            ],
        });

        known_systems.insert("punkbuster".to_string(), AntiCheatInfo {
            name: "PunkBuster".to_string(),
            detection_method: DetectionMethod::ProcessName,
            risk_level: RiskLevel::Low,
            compatibility_mode: CompatibilityMode::Direct,
            bypass_strategies: vec![
                BypassStrategy::DelayedInjection,
            ],
        });

        Self {
            known_systems,
            detection_cache: Arc::new(Mutex::new(HashMap::new())),
            cache_duration: chrono::Duration::minutes(5),
        }
    }

    pub fn detect_anti_cheat(&self, pid: u32) -> Result<AntiCheatDetection, Box<dyn Error>> {
        // Controlla cache prima
        {
            let cache = self.detection_cache.lock().unwrap();
            if let Some(cached) = cache.get(&pid) {
                let age = Utc::now() - cached.detection_time;
                if age < self.cache_duration {
                    return Ok(cached.clone());
                }
            }
        }

        let mut detected_systems = Vec::new();
        let mut details = HashMap::new();
        let mut max_risk = RiskLevel::Low;

        // Scansiona processi in esecuzione
        let running_processes = self.get_running_processes()?;
        for process in &running_processes {
            for (key, info) in &self.known_systems {
                if matches!(info.detection_method, DetectionMethod::ProcessName) {
                    if process.name.to_lowercase().contains(key) {
                        detected_systems.push(info.name.clone());
                        details.insert(
                            format!("process_{}", key),
                            format!("Processo rilevato: {} (PID: {})", process.name, process.pid)
                        );
                        max_risk = self.max_risk_level(&max_risk, &info.risk_level);
                    }
                }
            }
        }

        // Scansiona moduli del processo target
        if let Ok(modules) = self.get_process_modules(pid) {
            for module in &modules {
                for (key, info) in &self.known_systems {
                    if matches!(info.detection_method, DetectionMethod::ModuleName) {
                        if module.to_lowercase().contains(key) {
                            detected_systems.push(info.name.clone());
                            details.insert(
                                format!("module_{}", key),
                                format!("Modulo rilevato: {}", module)
                            );
                            max_risk = self.max_risk_level(&max_risk, &info.risk_level);
                        }
                    }
                }
            }
        }

        // Determina modalità compatibilità raccomandata
        let recommended_mode = self.determine_compatibility_mode(&detected_systems);

        let detection = AntiCheatDetection {
            detected_systems,
            risk_assessment: max_risk,
            recommended_mode,
            detection_time: Utc::now(),
            process_id: pid,
            details,
        };

        // Aggiorna cache
        {
            let mut cache = self.detection_cache.lock().unwrap();
            cache.insert(pid, detection.clone());
        }

        Ok(detection)
    }

    pub fn get_compatibility_strategies(&self, anti_cheat_name: &str) -> Vec<BypassStrategy> {
        for (key, info) in &self.known_systems {
            if info.name.to_lowercase().contains(&anti_cheat_name.to_lowercase()) {
                return info.bypass_strategies.clone();
            }
        }
        vec![]
    }

    pub fn is_injection_safe(&self, detection: &AntiCheatDetection) -> bool {
        matches!(detection.risk_assessment, RiskLevel::Low) &&
        !matches!(detection.recommended_mode, CompatibilityMode::Disabled)
    }

    pub fn get_injection_delay(&self, detection: &AntiCheatDetection) -> Option<u64> {
        match detection.recommended_mode {
            CompatibilityMode::Delayed => Some(5000), // 5 secondi
            CompatibilityMode::Stealth => Some(10000), // 10 secondi
            CompatibilityMode::Proxy => Some(15000), // 15 secondi
            _ => None,
        }
    }

    fn get_running_processes(&self) -> Result<Vec<ProcessInfo>, Box<dyn Error>> {
        let mut processes = Vec::new();
        
        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snapshot == winapi::um::handleapi::INVALID_HANDLE_VALUE {
                return Err("Impossibile creare snapshot processi".into());
            }

            let mut entry: PROCESSENTRY32 = std::mem::zeroed();
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32>() as u32;

            if Process32First(snapshot, &mut entry) != 0 {
                loop {
                    let name = std::ffi::CStr::from_ptr(entry.szExeFile.as_ptr())
                        .to_string_lossy()
                        .to_string();
                    
                    processes.push(ProcessInfo {
                        pid: entry.th32ProcessID,
                        name,
                    });

                    if Process32Next(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }

            CloseHandle(snapshot);
        }

        Ok(processes)
    }

    fn get_process_modules(&self, pid: u32) -> Result<Vec<String>, Box<dyn Error>> {
        let mut modules = Vec::new();

        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
            if handle.is_null() {
                return Err("Impossibile aprire processo".into());
            }

            let mut module_handles = [std::ptr::null_mut(); 1024];
            let mut bytes_needed = 0;

            if EnumProcessModules(
                handle,
                module_handles.as_mut_ptr(),
                (module_handles.len() * std::mem::size_of::<winapi::shared::minwindef::HMODULE>()) as u32,
                &mut bytes_needed,
            ) != 0 {
                let module_count = bytes_needed as usize / std::mem::size_of::<winapi::shared::minwindef::HMODULE>();
                
                for i in 0..module_count.min(module_handles.len()) {
                    let mut module_name = [0u8; 256];
                    if GetModuleBaseNameA(
                        handle,
                        module_handles[i],
                        module_name.as_mut_ptr() as *mut i8,
                        module_name.len() as u32,
                    ) > 0 {
                        let name = std::ffi::CStr::from_ptr(module_name.as_ptr() as *const i8)
                            .to_string_lossy()
                            .to_string();
                        modules.push(name);
                    }
                }
            }

            CloseHandle(handle);
        }

        Ok(modules)
    }

    fn max_risk_level(&self, current: &RiskLevel, new: &RiskLevel) -> RiskLevel {
        match (current, new) {
            (_, RiskLevel::Critical) => RiskLevel::Critical,
            (RiskLevel::Critical, _) => RiskLevel::Critical,
            (_, RiskLevel::High) => RiskLevel::High,
            (RiskLevel::High, _) => RiskLevel::High,
            (_, RiskLevel::Medium) => RiskLevel::Medium,
            (RiskLevel::Medium, _) => RiskLevel::Medium,
            _ => RiskLevel::Low,
        }
    }

    fn determine_compatibility_mode(&self, detected_systems: &[String]) -> CompatibilityMode {
        let mut max_restriction = CompatibilityMode::Direct;

        for system_name in detected_systems {
            for (_, info) in &self.known_systems {
                if info.name == *system_name {
                    max_restriction = match (&max_restriction, &info.compatibility_mode) {
                        (_, CompatibilityMode::Disabled) => CompatibilityMode::Disabled,
                        (CompatibilityMode::Disabled, _) => CompatibilityMode::Disabled,
                        (_, CompatibilityMode::Proxy) => CompatibilityMode::Proxy,
                        (CompatibilityMode::Proxy, _) => CompatibilityMode::Proxy,
                        (_, CompatibilityMode::Stealth) => CompatibilityMode::Stealth,
                        (CompatibilityMode::Stealth, _) => CompatibilityMode::Stealth,
                        (_, CompatibilityMode::Delayed) => CompatibilityMode::Delayed,
                        (CompatibilityMode::Delayed, _) => CompatibilityMode::Delayed,
                        _ => CompatibilityMode::Direct,
                    };
                }
            }
        }

        max_restriction
    }

    pub fn clear_cache(&self) {
        let mut cache = self.detection_cache.lock().unwrap();
        cache.clear();
    }

    pub fn get_cache_stats(&self) -> HashMap<String, usize> {
        let cache = self.detection_cache.lock().unwrap();
        let mut stats = HashMap::new();
        stats.insert("cached_detections".to_string(), cache.len());
        stats.insert("known_systems".to_string(), self.known_systems.len());
        stats
    }
}

#[derive(Debug, Clone)]
struct ProcessInfo {
    pid: u32,
    name: String,
}

impl Default for AntiCheatManager {
    fn default() -> Self {
        Self::new()
    }
}
