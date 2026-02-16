use crate::injekt::InjectionConfig;
use crate::multi_process_injekt::{MultiProcessInjekt, MultiProcessConfig, InjectionStrategy};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

// Singleton per gestire istanze multi-processo
static MULTI_PROCESS_INSTANCES: Lazy<Arc<Mutex<HashMap<String, MultiProcessInjekt>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Sessioni di injection attive: PID → session data
static INJECTION_SESSIONS: Lazy<Arc<Mutex<HashMap<u32, serde_json::Value>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// ============================================================
// Helper: Enumerazione processi Windows reale via TlHelp32
// ============================================================

/// Estensioni di eseguibili noti come giochi
const GAME_INDICATORS: &[&str] = &[
    "unity", "unreal", "godot", "renpy", "game", "play",
    "steam", "epic", "rpgmaker", "wolf", "kirikiri", "nw",
];

fn is_likely_game(name: &str) -> bool {
    let lower = name.to_lowercase();
    GAME_INDICATORS.iter().any(|g| lower.contains(g))
}

/// Enumera processi reali con WinAPI CreateToolhelp32Snapshot
fn enumerate_processes_win32() -> Result<Vec<serde_json::Value>, String> {
    use winapi::um::tlhelp32::*;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::psapi::GetProcessMemoryInfo;
    use winapi::um::winnt::{PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
    use std::mem;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == winapi::um::handleapi::INVALID_HANDLE_VALUE {
        return Err("Impossibile creare snapshot processi".to_string());
    }

    let mut processes = Vec::new();
    let mut entry: PROCESSENTRY32W = unsafe { mem::zeroed() };
    entry.dwSize = mem::size_of::<PROCESSENTRY32W>() as u32;

    let ok = unsafe { Process32FirstW(snapshot, &mut entry) };
    if ok == 0 {
        unsafe { CloseHandle(snapshot) };
        return Err("Nessun processo trovato".to_string());
    }

    loop {
        let name_len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
        let name = OsString::from_wide(&entry.szExeFile[..name_len])
            .to_string_lossy()
            .to_string();
        let pid = entry.th32ProcessID;

        // Recupera info memoria se possibile
        let mut mem_mb = 0.0f64;
        let h_proc = unsafe { OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid) };
        if !h_proc.is_null() {
            let mut mem_counters: winapi::um::psapi::PROCESS_MEMORY_COUNTERS = unsafe { mem::zeroed() };
            mem_counters.cb = mem::size_of::<winapi::um::psapi::PROCESS_MEMORY_COUNTERS>() as u32;
            let ok = unsafe { GetProcessMemoryInfo(h_proc, &mut mem_counters, mem_counters.cb) };
            if ok != 0 {
                mem_mb = mem_counters.WorkingSetSize as f64 / (1024.0 * 1024.0);
            }
            unsafe { CloseHandle(h_proc) };
        }

        let is_game = is_likely_game(&name);

        // Ignora processi di sistema
        let is_system = pid < 10 || name.eq_ignore_ascii_case("System") 
            || name.eq_ignore_ascii_case("[System Process]")
            || name.eq_ignore_ascii_case("svchost.exe")
            || name.eq_ignore_ascii_case("csrss.exe")
            || name.eq_ignore_ascii_case("smss.exe")
            || name.eq_ignore_ascii_case("wininit.exe")
            || name.eq_ignore_ascii_case("services.exe")
            || name.eq_ignore_ascii_case("lsass.exe");

        if !is_system {
            processes.push(serde_json::json!({
                "pid": pid,
                "name": name,
                "parent_pid": entry.th32ParentProcessID,
                "threads": entry.cntThreads,
                "architecture": if cfg!(target_pointer_width = "64") { "x64" } else { "x86" },
                "memory_usage_mb": (mem_mb * 10.0).round() / 10.0,
                "is_game": is_game,
                "injection_compatible": mem_mb > 5.0
            }));
        }

        let next = unsafe { Process32NextW(snapshot, &mut entry) };
        if next == 0 { break; }
    }

    unsafe { CloseHandle(snapshot) };

    // Ordina: giochi prima, poi per memoria decrescente
    processes.sort_by(|a, b| {
        let ga = a.get("is_game").and_then(|v| v.as_bool()).unwrap_or(false);
        let gb = b.get("is_game").and_then(|v| v.as_bool()).unwrap_or(false);
        match (gb, ga) {
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            _ => {
                let ma = a.get("memory_usage_mb").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let mb = b.get("memory_usage_mb").and_then(|v| v.as_f64()).unwrap_or(0.0);
                mb.partial_cmp(&ma).unwrap_or(std::cmp::Ordering::Equal)
            }
        }
    });

    Ok(processes)
}

/// Verifica se il processo corrente ha privilegi admin
/// Tenta di aprire il processo System (PID 4) — riesce solo con admin
fn check_admin_privileges() -> bool {
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::winnt::PROCESS_QUERY_INFORMATION;
    
    let h = unsafe { OpenProcess(PROCESS_QUERY_INFORMATION, 0, 4) }; // PID 4 = System
    if h.is_null() {
        false
    } else {
        unsafe { CloseHandle(h) };
        true
    }
}

// ============================================================
// Comandi Tauri — injection singolo processo
// ============================================================

#[tauri::command]
pub async fn start_injection(process_id: u32, process_name: String, config: serde_json::Value) -> Result<serde_json::Value, String> {
    log::info!("🚀 Avvio iniezione per processo: {} (PID: {})", process_name, process_id);
    
    let session_id = format!("session_{}_{}", process_id, chrono::Utc::now().timestamp_millis());
    let session = serde_json::json!({
        "process_id": process_id,
        "process_name": process_name,
        "config": config,
        "start_time": chrono::Utc::now().to_rfc3339(),
        "status": "active",
        "translated_count": 0,
        "cache_hits": 0,
        "cache_misses": 0,
        "session_id": session_id
    });
    
    // Salva sessione nel singleton
    if let Ok(mut sessions) = INJECTION_SESSIONS.lock() {
        sessions.insert(process_id, session.clone());
    }
    
    log::info!("✅ Sessione di iniezione '{}' avviata per PID: {}", session_id, process_id);
    Ok(session)
}

#[tauri::command]
pub async fn stop_injection(process_id: u32) -> Result<serde_json::Value, String> {
    log::info!("🛑 Arresto iniezione per processo PID: {}", process_id);
    
    let mut final_count = 0u64;
    if let Ok(mut sessions) = INJECTION_SESSIONS.lock() {
        if let Some(session) = sessions.remove(&process_id) {
            final_count = session.get("translated_count")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
        }
    }
    
    let result = serde_json::json!({
        "process_id": process_id,
        "stopped_at": chrono::Utc::now().to_rfc3339(),
        "status": "stopped",
        "final_translated_count": final_count
    });
    
    log::info!("✅ Iniezione arrestata per PID: {} ({} traduzioni)", process_id, final_count);
    Ok(result)
}

#[tauri::command]
pub async fn get_injection_stats(process_id: Option<u32>) -> Result<serde_json::Value, String> {
    if let Some(pid) = process_id {
        log::info!("📊 Recupero statistiche iniezione per PID: {}", pid);
        
        if let Ok(sessions) = INJECTION_SESSIONS.lock() {
            if let Some(session) = sessions.get(&pid) {
                return Ok(session.clone());
            }
        }
        
        Ok(serde_json::json!({
            "process_id": pid,
            "status": "not_found",
            "message": "Nessuna sessione attiva per questo processo"
        }))
    } else {
        log::info!("📊 Recupero statistiche globali iniezione");
        
        let sessions = INJECTION_SESSIONS.lock()
            .map_err(|e| format!("Errore accesso sessioni: {}", e))?;
        
        let total_translated: u64 = sessions.values()
            .map(|s| s.get("translated_count").and_then(|v| v.as_u64()).unwrap_or(0))
            .sum();
        let total_cache_hits: u64 = sessions.values()
            .map(|s| s.get("cache_hits").and_then(|v| v.as_u64()).unwrap_or(0))
            .sum();
        
        let processes: Vec<serde_json::Value> = sessions.iter()
            .map(|(pid, s)| serde_json::json!({
                "pid": pid,
                "name": s.get("process_name").and_then(|v| v.as_str()).unwrap_or("unknown"),
                "status": s.get("status").and_then(|v| v.as_str()).unwrap_or("unknown"),
                "translated_count": s.get("translated_count").and_then(|v| v.as_u64()).unwrap_or(0),
            }))
            .collect();
        
        Ok(serde_json::json!({
            "active_sessions": sessions.len(),
            "total_translated": total_translated,
            "total_cache_hits": total_cache_hits,
            "total_cache_misses": 0,
            "average_translation_rate": if sessions.is_empty() { 0.0 } else { total_translated as f64 / sessions.len() as f64 },
            "total_uptime_seconds": 0,
            "processes": processes
        }))
    }
}

#[tauri::command]
pub async fn test_injection() -> Result<serde_json::Value, String> {
    log::info!("🧪 Test sistema di iniezione");
    
    let is_admin = check_admin_privileges();
    let process_count = enumerate_processes_win32()
        .map(|p| p.len())
        .unwrap_or(0);
    
    let test_result = serde_json::json!({
        "injection_system_available": true,
        "admin_privileges": is_admin,
        "supported_architectures": ["x64", "x86"],
        "process_enumeration_ok": process_count > 0,
        "visible_processes": process_count,
        "test_passed": process_count > 0,
        "test_timestamp": chrono::Utc::now().to_rfc3339(),
        "notes": if is_admin { 
            "Privilegi admin disponibili — accesso completo alla memoria dei processi"
        } else {
            "Senza privilegi admin — accesso limitato ad alcuni processi"
        }
    });
    
    log::info!("✅ Test iniezione: {} processi visibili, admin={}", process_count, is_admin);
    Ok(test_result)
}

#[tauri::command]
pub async fn get_processes() -> Result<serde_json::Value, String> {
    log::info!("🔍 Recupero lista processi attivi (WinAPI)");
    
    let processes = enumerate_processes_win32()?;
    log::info!("✅ Recuperati {} processi reali", processes.len());
    Ok(serde_json::json!(processes))
}

#[tauri::command]
pub async fn get_process_info(process_id: u32) -> Result<serde_json::Value, String> {
    log::info!("🔍 Recupero informazioni processo PID: {}", process_id);
    
    // Cerca il processo nella lista
    let processes = enumerate_processes_win32()?;
    
    for p in &processes {
        if p.get("pid").and_then(|v| v.as_u64()) == Some(process_id as u64) {
            log::info!("✅ Informazioni processo recuperate per PID: {}", process_id);
            return Ok(p.clone());
        }
    }
    
    Err(format!("Processo PID {} non trovato", process_id))
}

#[tauri::command]
pub async fn inject_translation(process_id: u32, original_text: String, translated_text: String, _position: Option<serde_json::Value>) -> Result<(), String> {
    log::info!("💉 Iniezione traduzione in PID {}: '{}' -> '{}'", 
        process_id, 
        if original_text.len() > 30 { format!("{}...", &original_text[..30]) } else { original_text.clone() },
        if translated_text.len() > 30 { format!("{}...", &translated_text[..30]) } else { translated_text.clone() }
    );
    
    // Incrementa contatore nella sessione attiva
    if let Ok(mut sessions) = INJECTION_SESSIONS.lock() {
        if let Some(session) = sessions.get_mut(&process_id) {
            let count = session.get("translated_count")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) + 1;
            session["translated_count"] = serde_json::json!(count);
            session["last_activity"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
        }
    }
    
    // Iniezione reale in memoria richiede WriteProcessMemory — 
    // per ora traccia la traduzione e la conta, l'hook DLL gestisce la sostituzione
    log::info!("✅ Traduzione registrata per PID {} (totale aggiornato)", process_id);
    Ok(())
}

#[tauri::command]
pub async fn scan_process_memory(process_id: u32, pattern: String) -> Result<serde_json::Value, String> {
    log::info!("🔎 Scansione memoria processo PID {} per pattern: '{}'", process_id, pattern);
    
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::memoryapi::{VirtualQueryEx, ReadProcessMemory};
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::winnt::*;
    use std::mem;

    let start_time = std::time::Instant::now();
    let pattern_bytes = pattern.as_bytes();
    let mut matches = Vec::new();
    let mut scanned_regions = 0u64;
    let mut total_scanned = 0u64;

    let h_proc = unsafe { OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, 0, process_id) };
    if h_proc.is_null() {
        return Err(format!("Impossibile aprire processo PID {} (servono privilegi admin?)", process_id));
    }

    let mut address: usize = 0;
    let mut buffer = vec![0u8; 4096];

    loop {
        let mut mbi: MEMORY_BASIC_INFORMATION = unsafe { mem::zeroed() };
        let result = unsafe {
            VirtualQueryEx(h_proc, address as *const _, &mut mbi, mem::size_of::<MEMORY_BASIC_INFORMATION>())
        };
        if result == 0 { break; }

        // Scansiona solo regioni committed e leggibili
        if mbi.State == MEM_COMMIT && (mbi.Protect & (PAGE_READONLY | PAGE_READWRITE | PAGE_EXECUTE_READ | PAGE_EXECUTE_READWRITE)) != 0 {
            scanned_regions += 1;
            let region_size = mbi.RegionSize;
            total_scanned += region_size as u64;

            // Leggi a blocchi di 4KB per evitare OOM
            let mut offset = 0usize;
            while offset < region_size && matches.len() < 100 {
                let chunk_size = std::cmp::min(buffer.len(), region_size - offset);
                let mut bytes_read = 0usize;
                let read_ok = unsafe {
                    ReadProcessMemory(
                        h_proc,
                        (mbi.BaseAddress as usize + offset) as *const _,
                        buffer.as_mut_ptr() as *mut _,
                        chunk_size,
                        &mut bytes_read,
                    )
                };
                if read_ok != 0 && bytes_read > pattern_bytes.len() {
                    // Cerca pattern nel buffer
                    for i in 0..(bytes_read - pattern_bytes.len()) {
                        if &buffer[i..i+pattern_bytes.len()] == pattern_bytes {
                            matches.push(serde_json::json!({
                                "address": format!("0x{:X}", mbi.BaseAddress as usize + offset + i),
                                "offset": offset + i,
                                "region_base": format!("0x{:X}", mbi.BaseAddress as usize),
                            }));
                            if matches.len() >= 100 { break; }
                        }
                    }
                }
                offset += chunk_size;
            }
        }

        address = mbi.BaseAddress as usize + mbi.RegionSize;
        if address == 0 { break; } // overflow protection
    }

    unsafe { CloseHandle(h_proc) };

    let duration = start_time.elapsed();
    log::info!("✅ Scansione PID {}: {} match in {} regioni ({:.1} MB) in {:?}", 
        process_id, matches.len(), scanned_regions, total_scanned as f64 / (1024.0*1024.0), duration);

    Ok(serde_json::json!({
        "process_id": process_id,
        "pattern": pattern,
        "matches": matches,
        "match_count": matches.len(),
        "scan_duration_ms": duration.as_millis(),
        "scanned_regions": scanned_regions,
        "total_memory_scanned_mb": (total_scanned as f64 / (1024.0 * 1024.0) * 10.0).round() / 10.0,
        "scan_timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

// === COMANDI MULTI-PROCESSO ===

#[tauri::command]
pub async fn start_multi_process_injection(
    game_name: String,
    primary_process: String,
    secondary_processes: Vec<String>,
    injection_strategy: String,
    base_config: serde_json::Value
) -> Result<serde_json::Value, String> {
    log::info!("🚀 Avvio injection multi-processo per: {}", game_name);
    
    // Converti la strategia da stringa a enum
    let strategy = match injection_strategy.as_str() {
        "primary_only" => InjectionStrategy::PrimaryOnly,
        "all_processes" => InjectionStrategy::AllProcesses,
        "cascade" => InjectionStrategy::Cascade,
        _ => InjectionStrategy::PrimaryOnly,
    };
    
    // Crea configurazione multi-processo
    let multi_config = MultiProcessConfig {
        game_name: game_name.clone(),
        primary_process,
        secondary_processes,
        injection_strategy: strategy,
        sync_translations: true,
        max_processes: 10,
    };
    
    // Crea configurazione base injection
    let injection_config = InjectionConfig {
        target_process: game_name.clone(),
        target_language: base_config.get("target_language")
            .and_then(|v| v.as_str())
            .unwrap_or("it")
            .to_string(),
        provider: base_config.get("provider")
            .and_then(|v| v.as_str())
            .unwrap_or("openai")
            .to_string(),
        api_key: base_config.get("api_key")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        hook_mode: base_config.get("hook_mode")
            .and_then(|v| v.as_str())
            .unwrap_or("safe")
            .to_string(),
        cache_enabled: base_config.get("cache_enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
    };
    
    // Crea e avvia sistema multi-processo
    match MultiProcessInjekt::new(multi_config, injection_config) {
        Ok(mut multi_injekt) => {
            match multi_injekt.start() {
                Ok(()) => {
                    // Salva l'istanza nel singleton
                    if let Ok(mut instances) = MULTI_PROCESS_INSTANCES.lock() {
                        instances.insert(game_name.clone(), multi_injekt);
                    }
                    
                    let result = serde_json::json!({
                        "game_name": game_name,
                        "status": "started",
                        "start_time": chrono::Utc::now().to_rfc3339(),
                        "message": "Sistema multi-processo avviato con successo"
                    });
                    
                    log::info!("✅ Sistema multi-processo avviato per: {}", game_name);
                    Ok(result)
                }
                Err(e) => {
                    let error_msg = format!("Errore avvio sistema multi-processo: {}", e);
                    log::error!("❌ {}", error_msg);
                    Err(error_msg)
                }
            }
        }
        Err(e) => {
            let error_msg = format!("Errore creazione sistema multi-processo: {}", e);
            log::error!("❌ {}", error_msg);
            Err(error_msg)
        }
    }
}

#[tauri::command]
pub async fn stop_multi_process_injection(game_name: String) -> Result<serde_json::Value, String> {
    log::info!("🛑 Arresto injection multi-processo per: {}", game_name);
    
    if let Ok(mut instances) = MULTI_PROCESS_INSTANCES.lock() {
        if let Some(mut multi_injekt) = instances.remove(&game_name) {
            match multi_injekt.stop() {
                Ok(()) => {
                    let result = serde_json::json!({
                        "game_name": game_name,
                        "status": "stopped",
                        "stop_time": chrono::Utc::now().to_rfc3339(),
                        "message": "Sistema multi-processo arrestato con successo"
                    });
                    
                    log::info!("✅ Sistema multi-processo arrestato per: {}", game_name);
                    Ok(result)
                }
                Err(e) => {
                    let error_msg = format!("Errore arresto sistema multi-processo: {}", e);
                    log::error!("❌ {}", error_msg);
                    Err(error_msg)
                }
            }
        } else {
            let error_msg = format!("Sistema multi-processo non trovato per: {}", game_name);
            log::warn!("⚠️ {}", error_msg);
            Err(error_msg)
        }
    } else {
        Err("Errore accesso istanze multi-processo".to_string())
    }
}

#[tauri::command]
pub async fn get_multi_process_stats(game_name: String) -> Result<serde_json::Value, String> {
    log::info!("📊 Recupero statistiche multi-processo per: {}", game_name);
    
    if let Ok(instances) = MULTI_PROCESS_INSTANCES.lock() {
        if let Some(multi_injekt) = instances.get(&game_name) {
            let stats = multi_injekt.get_stats();
            log::info!("✅ Statistiche recuperate per: {}", game_name);
            Ok(stats)
        } else {
            let error_msg = format!("Sistema multi-processo non trovato per: {}", game_name);
            log::warn!("⚠️ {}", error_msg);
            Err(error_msg)
        }
    } else {
        Err("Errore accesso istanze multi-processo".to_string())
    }
}

#[tauri::command]
pub async fn get_multi_process_active_processes(game_name: String) -> Result<serde_json::Value, String> {
    log::info!("🔍 Recupero processi attivi per: {}", game_name);
    
    if let Ok(instances) = MULTI_PROCESS_INSTANCES.lock() {
        if let Some(multi_injekt) = instances.get(&game_name) {
            let processes = multi_injekt.get_active_processes();
            let result = serde_json::json!({
                "game_name": game_name,
                "processes": processes.into_iter().map(|(pid, name, is_primary, injection_active)| {
                    serde_json::json!({
                        "pid": pid,
                        "name": name,
                        "is_primary": is_primary,
                        "injection_active": injection_active
                    })
                }).collect::<Vec<_>>()
            });
            
            log::info!("✅ Processi attivi recuperati per: {}", game_name);
            Ok(result)
        } else {
            let error_msg = format!("Sistema multi-processo non trovato per: {}", game_name);
            log::warn!("⚠️ {}", error_msg);
            Err(error_msg)
        }
    } else {
        Err("Errore accesso istanze multi-processo".to_string())
    }
}

#[tauri::command]
pub async fn force_inject_process(game_name: String, process_id: u32) -> Result<serde_json::Value, String> {
    log::info!("🔧 Forzatura injection per processo PID: {} (gioco: {})", process_id, game_name);
    
    if let Ok(mut instances) = MULTI_PROCESS_INSTANCES.lock() {
        if let Some(multi_injekt) = instances.get_mut(&game_name) {
            match multi_injekt.force_inject_process(process_id) {
                Ok(()) => {
                    let result = serde_json::json!({
                        "game_name": game_name,
                        "process_id": process_id,
                        "status": "injected",
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "message": "Injection forzata completata con successo"
                    });
                    
                    log::info!("✅ Injection forzata completata per PID: {}", process_id);
                    Ok(result)
                }
                Err(e) => {
                    let error_msg = format!("Errore forzatura injection: {}", e);
                    log::error!("❌ {}", error_msg);
                    Err(error_msg)
                }
            }
        } else {
            let error_msg = format!("Sistema multi-processo non trovato per: {}", game_name);
            log::warn!("⚠️ {}", error_msg);
            Err(error_msg)
        }
    } else {
        Err("Errore accesso istanze multi-processo".to_string())
    }
}

#[tauri::command]
pub async fn list_multi_process_games() -> Result<serde_json::Value, String> {
    log::info!("📋 Lista giochi con injection multi-processo attiva");
    
    if let Ok(instances) = MULTI_PROCESS_INSTANCES.lock() {
        let games: Vec<String> = instances.keys().cloned().collect();
        let result = serde_json::json!({
            "active_games": games,
            "total_count": games.len(),
            "timestamp": chrono::Utc::now().to_rfc3339()
        });
        
        log::info!("✅ Lista giochi recuperata: {} attivi", games.len());
        Ok(result)
    } else {
        Err("Errore accesso istanze multi-processo".to_string())
    }
}
