//! Injector DLL per Unreal Engine
//! 
//! Gestisce l'injection della DLL translator nel processo di gioco UE.

use std::path::Path;
use std::ffi::OsStr;

#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

/// Risultato dell'injection
#[derive(Debug, Clone)]
pub struct InjectionResult {
    pub success: bool,
    pub process_id: u32,
    pub message: String,
}

/// Inietta la DLL translator in un processo UE
#[cfg(target_os = "windows")]
pub fn inject_translator_dll(process_id: u32, dll_path: &Path) -> Result<InjectionResult, String> {
    use std::ptr::null_mut;
    
    if !dll_path.exists() {
        return Err(format!("DLL non trovata: {}", dll_path.display()));
    }
    
    log::info!("🔧 Tentativo injection DLL in processo {}", process_id);
    log::info!("📁 DLL path: {}", dll_path.display());
    
    // Converti path in wide string
    let dll_path_wide: Vec<u16> = OsStr::new(dll_path.as_os_str())
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    
    unsafe {
        // Apri il processo target
        let process_handle = OpenProcess(
            PROCESS_ALL_ACCESS,
            0, // FALSE
            process_id
        );
        
        if process_handle.is_null() {
            return Err(format!("Impossibile aprire processo {}: errore {}", 
                process_id, GetLastError()));
        }
        
        // Alloca memoria nel processo target
        let dll_path_size = dll_path_wide.len() * std::mem::size_of::<u16>();
        let remote_memory = VirtualAllocEx(
            process_handle,
            null_mut(),
            dll_path_size,
            MEM_COMMIT | MEM_RESERVE,
            PAGE_READWRITE
        );
        
        if remote_memory.is_null() {
            CloseHandle(process_handle);
            return Err(format!("Impossibile allocare memoria: errore {}", GetLastError()));
        }
        
        // Scrivi il path della DLL nella memoria allocata
        let mut bytes_written: usize = 0;
        let write_result = WriteProcessMemory(
            process_handle,
            remote_memory,
            dll_path_wide.as_ptr() as *const _,
            dll_path_size,
            &mut bytes_written
        );
        
        if write_result == 0 {
            VirtualFreeEx(process_handle, remote_memory, 0, MEM_RELEASE);
            CloseHandle(process_handle);
            return Err(format!("Impossibile scrivere memoria: errore {}", GetLastError()));
        }
        
        // Ottieni indirizzo di LoadLibraryW
        let kernel32 = GetModuleHandleW(wide_string("kernel32.dll").as_ptr());
        if kernel32.is_null() {
            VirtualFreeEx(process_handle, remote_memory, 0, MEM_RELEASE);
            CloseHandle(process_handle);
            return Err("Impossibile ottenere handle kernel32".to_string());
        }
        
        let load_library_addr = GetProcAddress(kernel32, b"LoadLibraryW\0".as_ptr() as *const i8);
        if load_library_addr.is_null() {
            VirtualFreeEx(process_handle, remote_memory, 0, MEM_RELEASE);
            CloseHandle(process_handle);
            return Err("Impossibile ottenere indirizzo LoadLibraryW".to_string());
        }
        
        // Crea thread remoto per caricare la DLL
        let remote_thread = CreateRemoteThread(
            process_handle,
            null_mut(),
            0,
            std::mem::transmute(load_library_addr),
            remote_memory,
            0,
            null_mut()
        );
        
        if remote_thread.is_null() {
            VirtualFreeEx(process_handle, remote_memory, 0, MEM_RELEASE);
            CloseHandle(process_handle);
            return Err(format!("Impossibile creare thread remoto: errore {}", GetLastError()));
        }
        
        // Aspetta che il thread completi
        WaitForSingleObject(remote_thread, 5000); // 5 secondi timeout
        
        // Cleanup
        CloseHandle(remote_thread);
        VirtualFreeEx(process_handle, remote_memory, 0, MEM_RELEASE);
        CloseHandle(process_handle);
        
        log::info!("✅ DLL iniettata con successo!");
        
        Ok(InjectionResult {
            success: true,
            process_id,
            message: "DLL translator iniettata con successo".to_string(),
        })
    }
}

#[cfg(not(target_os = "windows"))]
pub fn inject_translator_dll(_process_id: u32, _dll_path: &Path) -> Result<InjectionResult, String> {
    Err("DLL injection supportata solo su Windows".to_string())
}

/// Trova il processo di un gioco UE dato il path dell'eseguibile
#[cfg(target_os = "windows")]
pub fn find_game_process(exe_name: &str) -> Option<u32> {
    use std::mem::size_of;
    
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot.is_null() {
            return None;
        }
        
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
        
        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                let process_name = String::from_utf16_lossy(
                    &entry.szExeFile[..entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len())]
                );
                
                if process_name.to_lowercase() == exe_name.to_lowercase() {
                    CloseHandle(snapshot);
                    return Some(entry.th32ProcessID);
                }
                
                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }
        
        CloseHandle(snapshot);
        None
    }
}

#[cfg(not(target_os = "windows"))]
pub fn find_game_process(_exe_name: &str) -> Option<u32> {
    None
}

// Helper per creare wide string
#[cfg(target_os = "windows")]
fn wide_string(s: &str) -> Vec<u16> {
    OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

// Windows API bindings
#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> *mut std::ffi::c_void;
    fn CloseHandle(hObject: *mut std::ffi::c_void) -> i32;
    fn VirtualAllocEx(hProcess: *mut std::ffi::c_void, lpAddress: *mut std::ffi::c_void, dwSize: usize, flAllocationType: u32, flProtect: u32) -> *mut std::ffi::c_void;
    fn VirtualFreeEx(hProcess: *mut std::ffi::c_void, lpAddress: *mut std::ffi::c_void, dwSize: usize, dwFreeType: u32) -> i32;
    fn WriteProcessMemory(hProcess: *mut std::ffi::c_void, lpBaseAddress: *mut std::ffi::c_void, lpBuffer: *const std::ffi::c_void, nSize: usize, lpNumberOfBytesWritten: *mut usize) -> i32;
    fn CreateRemoteThread(hProcess: *mut std::ffi::c_void, lpThreadAttributes: *mut std::ffi::c_void, dwStackSize: usize, lpStartAddress: *mut std::ffi::c_void, lpParameter: *mut std::ffi::c_void, dwCreationFlags: u32, lpThreadId: *mut u32) -> *mut std::ffi::c_void;
    fn WaitForSingleObject(hHandle: *mut std::ffi::c_void, dwMilliseconds: u32) -> u32;
    fn GetModuleHandleW(lpModuleName: *const u16) -> *mut std::ffi::c_void;
    fn GetProcAddress(hModule: *mut std::ffi::c_void, lpProcName: *const i8) -> *mut std::ffi::c_void;
    fn GetLastError() -> u32;
    fn CreateToolhelp32Snapshot(dwFlags: u32, th32ProcessID: u32) -> *mut std::ffi::c_void;
    fn Process32FirstW(hSnapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
    fn Process32NextW(hSnapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
}

#[cfg(target_os = "windows")]
const PROCESS_ALL_ACCESS: u32 = 0x1F0FFF;
#[cfg(target_os = "windows")]
const MEM_COMMIT: u32 = 0x1000;
#[cfg(target_os = "windows")]
const MEM_RESERVE: u32 = 0x2000;
#[cfg(target_os = "windows")]
const MEM_RELEASE: u32 = 0x8000;
#[cfg(target_os = "windows")]
const PAGE_READWRITE: u32 = 0x04;
#[cfg(target_os = "windows")]
const TH32CS_SNAPPROCESS: u32 = 0x00000002;

#[cfg(target_os = "windows")]
#[repr(C)]
#[allow(non_snake_case)]
struct PROCESSENTRY32W {
    dwSize: u32,
    cntUsage: u32,
    th32ProcessID: u32,
    th32DefaultHeapID: usize,
    th32ModuleID: u32,
    cntThreads: u32,
    th32ParentProcessID: u32,
    pcPriClassBase: i32,
    dwFlags: u32,
    szExeFile: [u16; 260],
}
