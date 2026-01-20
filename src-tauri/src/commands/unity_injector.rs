//! Comandi per Unity DLL Injection diretta
//! Bypassa BepInEx - injection a basso livello

use tauri::command;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "windows")]
use std::ffi::CString;

static IPC_SERVER_RUNNING: AtomicBool = AtomicBool::new(false);

/// Risultato injection
#[derive(serde::Serialize, serde::Deserialize)]
pub struct InjectionResult {
    pub success: bool,
    pub message: String,
}

/// Inietta la DLL translator in un processo Unity
#[command]
pub async fn inject_unity_translator(
    process_name: String,
) -> Result<InjectionResult, String> {
    log::info!("🎯 Injection Unity translator in: {}", process_name);
    
    #[cfg(target_os = "windows")]
    {
        // Trova il processo
        let pid = find_process_by_name(&process_name)
            .ok_or_else(|| format!("Processo {} non trovato", process_name))?;
        
        log::info!("📍 Trovato PID: {}", pid);
        
        // Trova la DLL
        let dll_path = get_unity_translator_dll()?;
        
        if !dll_path.exists() {
            return Ok(InjectionResult {
                success: false,
                message: "DLL translator non trovata. Deve essere compilata.".to_string(),
            });
        }
        
        // Inietta
        match inject_dll(pid, &dll_path) {
            Ok(_) => Ok(InjectionResult {
                success: true,
                message: format!("DLL iniettata in {} (PID: {})", process_name, pid),
            }),
            Err(e) => Ok(InjectionResult {
                success: false,
                message: format!("Errore injection: {}", e),
            }),
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Injection supportata solo su Windows".to_string())
    }
}

/// Trova processo per nome
#[cfg(target_os = "windows")]
fn find_process_by_name(name: &str) -> Option<u32> {
    use std::mem::zeroed;
    
    #[repr(C)]
    struct PROCESSENTRY32W {
        dw_size: u32,
        cnt_usage: u32,
        th32_process_id: u32,
        th32_default_heap_id: usize,
        th32_module_id: u32,
        cnt_threads: u32,
        th32_parent_process_id: u32,
        pc_pri_class_base: i32,
        dw_flags: u32,
        sz_exe_file: [u16; 260],
    }
    
    extern "system" {
        fn CreateToolhelp32Snapshot(flags: u32, pid: u32) -> *mut std::ffi::c_void;
        fn Process32FirstW(snap: *mut std::ffi::c_void, entry: *mut PROCESSENTRY32W) -> i32;
        fn Process32NextW(snap: *mut std::ffi::c_void, entry: *mut PROCESSENTRY32W) -> i32;
        fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
    }
    
    const TH32CS_SNAPPROCESS: u32 = 0x00000002;
    
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap.is_null() {
            return None;
        }
        
        let mut entry: PROCESSENTRY32W = zeroed();
        entry.dw_size = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        
        let name_lower = name.to_lowercase();
        
        if Process32FirstW(snap, &mut entry) != 0 {
            loop {
                let exe_name = String::from_utf16_lossy(&entry.sz_exe_file)
                    .trim_matches('\0')
                    .to_lowercase();
                
                if exe_name.contains(&name_lower) || name_lower.contains(&exe_name.replace(".exe", "")) {
                    CloseHandle(snap);
                    return Some(entry.th32_process_id);
                }
                
                if Process32NextW(snap, &mut entry) == 0 {
                    break;
                }
            }
        }
        
        CloseHandle(snap);
    }
    
    None
}

/// Inietta DLL nel processo
#[cfg(target_os = "windows")]
fn inject_dll(pid: u32, dll_path: &Path) -> Result<(), String> {
    extern "system" {
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut std::ffi::c_void;
        fn VirtualAllocEx(process: *mut std::ffi::c_void, addr: *mut std::ffi::c_void, 
                         size: usize, alloc_type: u32, protect: u32) -> *mut std::ffi::c_void;
        fn WriteProcessMemory(process: *mut std::ffi::c_void, addr: *mut std::ffi::c_void,
                             buffer: *const std::ffi::c_void, size: usize, written: *mut usize) -> i32;
        fn CreateRemoteThread(process: *mut std::ffi::c_void, attrs: *mut std::ffi::c_void,
                             stack: usize, start: *mut std::ffi::c_void, param: *mut std::ffi::c_void,
                             flags: u32, tid: *mut u32) -> *mut std::ffi::c_void;
        fn WaitForSingleObject(handle: *mut std::ffi::c_void, ms: u32) -> u32;
        fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
        fn VirtualFreeEx(process: *mut std::ffi::c_void, addr: *mut std::ffi::c_void,
                        size: usize, free_type: u32) -> i32;
        fn GetModuleHandleA(name: *const i8) -> *mut std::ffi::c_void;
        fn GetProcAddress(module: *mut std::ffi::c_void, name: *const i8) -> *mut std::ffi::c_void;
    }
    
    const PROCESS_ALL_ACCESS: u32 = 0x1F0FFF;
    const MEM_COMMIT: u32 = 0x1000;
    const MEM_RESERVE: u32 = 0x2000;
    const MEM_RELEASE: u32 = 0x8000;
    const PAGE_READWRITE: u32 = 0x04;
    
    let dll_str = dll_path.to_string_lossy().to_string();
    let dll_cstr = CString::new(dll_str.clone()).map_err(|e| e.to_string())?;
    
    unsafe {
        // Apri processo
        let process = OpenProcess(PROCESS_ALL_ACCESS, 0, pid);
        if process.is_null() {
            return Err("Impossibile aprire il processo".to_string());
        }
        
        // Alloca memoria per il path della DLL
        let path_len = dll_cstr.as_bytes_with_nul().len();
        let remote_mem = VirtualAllocEx(process, std::ptr::null_mut(), path_len,
                                        MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
        if remote_mem.is_null() {
            CloseHandle(process);
            return Err("Impossibile allocare memoria".to_string());
        }
        
        // Scrivi path DLL
        let mut written: usize = 0;
        if WriteProcessMemory(process, remote_mem, dll_cstr.as_ptr() as *const _,
                             path_len, &mut written) == 0 {
            VirtualFreeEx(process, remote_mem, 0, MEM_RELEASE);
            CloseHandle(process);
            return Err("Impossibile scrivere nella memoria".to_string());
        }
        
        // Trova LoadLibraryA
        let kernel32 = CString::new("kernel32.dll").unwrap();
        let load_lib = CString::new("LoadLibraryA").unwrap();
        let k32_handle = GetModuleHandleA(kernel32.as_ptr());
        let load_lib_addr = GetProcAddress(k32_handle, load_lib.as_ptr());
        
        if load_lib_addr.is_null() {
            VirtualFreeEx(process, remote_mem, 0, MEM_RELEASE);
            CloseHandle(process);
            return Err("LoadLibraryA non trovata".to_string());
        }
        
        // Crea thread remoto
        let thread = CreateRemoteThread(process, std::ptr::null_mut(), 0,
                                       load_lib_addr, remote_mem, 0, std::ptr::null_mut());
        if thread.is_null() {
            VirtualFreeEx(process, remote_mem, 0, MEM_RELEASE);
            CloseHandle(process);
            return Err("Impossibile creare thread remoto".to_string());
        }
        
        // Attendi completamento
        WaitForSingleObject(thread, 10000);
        
        // Cleanup
        CloseHandle(thread);
        VirtualFreeEx(process, remote_mem, 0, MEM_RELEASE);
        CloseHandle(process);
        
        log::info!("✅ DLL {} iniettata con successo!", dll_str);
    }
    
    Ok(())
}

/// Ottiene path della DLL Unity translator
fn get_unity_translator_dll() -> Result<std::path::PathBuf, String> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("Impossibile ottenere cartella exe")?
        .to_path_buf();
    
    // Cerca in resources
    let dll_path = exe_dir.join("resources").join("unity-translator").join("unity_auto_translator.dll");
    
    Ok(dll_path)
}

/// Avvia il server IPC per le traduzioni Unity
#[command]
pub async fn start_unity_translation_server(
    target_language: String,
) -> Result<String, String> {
    if IPC_SERVER_RUNNING.load(Ordering::SeqCst) {
        return Ok("Server IPC già in esecuzione".to_string());
    }
    
    log::info!("🚀 Avvio server IPC Unity translation (target: {})", target_language);
    
    #[cfg(target_os = "windows")]
    {
        let lang = target_language.clone();
        std::thread::spawn(move || {
            run_ipc_server(&lang);
        });
        
        Ok(format!("Server IPC avviato per traduzione in {}", target_language))
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Server IPC supportato solo su Windows".to_string())
    }
}

/// Ferma il server IPC
#[command]
pub async fn stop_unity_translation_server() -> Result<String, String> {
    IPC_SERVER_RUNNING.store(false, Ordering::SeqCst);
    Ok("Server IPC fermato".to_string())
}

#[cfg(target_os = "windows")]
fn run_ipc_server(target_language: &str) {
    use std::ptr::null_mut;
    
    #[link(name = "kernel32")]
    extern "system" {
        fn CreateNamedPipeA(
            name: *const i8, open_mode: u32, pipe_mode: u32,
            max_instances: u32, out_buffer: u32, in_buffer: u32,
            timeout: u32, attrs: *mut std::ffi::c_void
        ) -> *mut std::ffi::c_void;
        fn ConnectNamedPipe(pipe: *mut std::ffi::c_void, overlapped: *mut std::ffi::c_void) -> i32;
        fn DisconnectNamedPipe(pipe: *mut std::ffi::c_void) -> i32;
        fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
    }
    
    const PIPE_ACCESS_DUPLEX: u32 = 0x00000003;
    const PIPE_TYPE_MESSAGE: u32 = 0x00000004;
    const PIPE_READMODE_MESSAGE: u32 = 0x00000002;
    const PIPE_WAIT: u32 = 0x00000000;
    const INVALID_HANDLE_VALUE: *mut std::ffi::c_void = -1isize as *mut std::ffi::c_void;
    
    let pipe_name = CString::new("\\\\.\\pipe\\GameStringerUETranslator").unwrap();
    
    IPC_SERVER_RUNNING.store(true, Ordering::SeqCst);
    log::info!("📡 Server IPC in ascolto su {}", pipe_name.to_str().unwrap());
    
    while IPC_SERVER_RUNNING.load(Ordering::SeqCst) {
        unsafe {
            let pipe = CreateNamedPipeA(
                pipe_name.as_ptr(),
                PIPE_ACCESS_DUPLEX,
                PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT,
                1, 4096, 4096, 0, null_mut()
            );
            
            if pipe == INVALID_HANDLE_VALUE {
                log::error!("❌ Errore creazione pipe");
                std::thread::sleep(std::time::Duration::from_secs(1));
                continue;
            }
            
            log::info!("⏳ Attendo connessione DLL...");
            
            if ConnectNamedPipe(pipe, null_mut()) != 0 || std::io::Error::last_os_error().raw_os_error() == Some(535) {
                log::info!("✅ Client DLL connesso!");
                
                // Gestisci connessione
                handle_ipc_client(pipe, target_language);
                
                DisconnectNamedPipe(pipe);
            }
            
            CloseHandle(pipe);
        }
    }
    
    log::info!("🛑 Server IPC terminato");
}

#[cfg(target_os = "windows")]
fn handle_ipc_client(pipe: *mut std::ffi::c_void, target_language: &str) {
    // Per ora, traduzione mock - in futuro collegheremo al translation engine
    let mut buffer = [0u8; 4096];
    
    #[link(name = "kernel32")]
    extern "system" {
        fn ReadFile(
            handle: *mut std::ffi::c_void, buffer: *mut u8, 
            to_read: u32, read: *mut u32, overlapped: *mut std::ffi::c_void
        ) -> i32;
        fn WriteFile(
            handle: *mut std::ffi::c_void, buffer: *const u8,
            to_write: u32, written: *mut u32, overlapped: *mut std::ffi::c_void
        ) -> i32;
    }
    
    while IPC_SERVER_RUNNING.load(Ordering::SeqCst) {
        let mut bytes_read: u32 = 0;
        
        unsafe {
            if ReadFile(pipe, buffer.as_mut_ptr(), buffer.len() as u32, &mut bytes_read, std::ptr::null_mut()) == 0 {
                break;
            }
        }
        
        if bytes_read == 0 {
            std::thread::sleep(std::time::Duration::from_millis(10));
            continue;
        }
        
        // Parse richiesta JSON
        let request = String::from_utf8_lossy(&buffer[..bytes_read as usize]);
        log::debug!("📥 Richiesta: {}", request.trim());
        
        // Estrai testo da tradurre
        if let Some(text) = extract_text_from_request(&request) {
            // Per ora traduzione mock con prefisso
            let translated = format!("[{}] {}", target_language.to_uppercase(), text);
            let response = format!("{{\"translated\":\"{}\"}}\n", translated.replace("\"", "\\\""));
            
            log::debug!("📤 Risposta: {}", response.trim());
            
            unsafe {
                let mut bytes_written: u32 = 0;
                WriteFile(pipe, response.as_ptr(), response.len() as u32, &mut bytes_written, std::ptr::null_mut());
            }
        }
    }
}

fn extract_text_from_request(json: &str) -> Option<String> {
    // Parse semplice JSON {"type":"translate","text":"..."}
    if let Some(start) = json.find("\"text\":\"") {
        let start = start + 8;
        if let Some(end) = json[start..].find("\"") {
            return Some(json[start..start+end].to_string());
        }
    }
    None
}
