use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct HookCandidate {
    pub address: String,
    pub module_name: String,
    pub text_preview: String,
    pub confidence: f64,
    pub hook_type: String,
}

#[derive(Debug, Serialize)]
pub struct HookScanResult {
    pub candidates: Vec<HookCandidate>,
    pub scan_duration_ms: u64,
    pub process_name: String,
    pub process_id: u32,
}

/// Scansiona la memoria di un processo per trovare stringhe di testo
/// e identifica automaticamente gli hook point per la traduzione.
/// 
/// Questo è il "Click-to-hook" che rende obsoleto il reverse engineering manuale
/// di Textractor: l'utente clicca sul testo a schermo, noi scansioniamo la memoria
/// del processo target cercando quella stringa e restituiamo i candidati.
#[cfg(windows)]
#[tauri::command]
pub async fn scan_for_text_hooks(
    process_id: u32,
    search_text: String,
) -> Result<HookScanResult, String> {
    use std::time::Instant;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::memoryapi::{VirtualQueryEx, ReadProcessMemory};
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::winnt::{
        PROCESS_VM_READ, PROCESS_QUERY_INFORMATION,
        MEMORY_BASIC_INFORMATION, MEM_COMMIT,
        PAGE_READWRITE, PAGE_READONLY, PAGE_EXECUTE_READ, PAGE_EXECUTE_READWRITE,
    };

    let start = Instant::now();
    let mut candidates = Vec::new();

    if search_text.len() < 2 {
        return Err("Il testo di ricerca deve essere almeno 2 caratteri".to_string());
    }

    unsafe {
        let handle = OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, 0, process_id);
        if handle.is_null() {
            return Err(format!("Impossibile aprire il processo {} (errore accesso)", process_id));
        }

        let search_bytes_utf8 = search_text.as_bytes();
        let search_bytes_utf16: Vec<u8> = search_text.encode_utf16()
            .flat_map(|c| c.to_le_bytes())
            .collect();

        let mut address: usize = 0;
        let mut mbi: MEMORY_BASIC_INFORMATION = std::mem::zeroed();
        let mbi_size = std::mem::size_of::<MEMORY_BASIC_INFORMATION>();

        while VirtualQueryEx(handle, address as *const _, &mut mbi, mbi_size) == mbi_size {
            let protect = mbi.Protect;
            let is_readable = protect == PAGE_READWRITE || protect == PAGE_READONLY 
                || protect == PAGE_EXECUTE_READ || protect == PAGE_EXECUTE_READWRITE;

            if mbi.State == MEM_COMMIT && is_readable && mbi.RegionSize > 0 && mbi.RegionSize < 100_000_000 {
                let mut buffer = vec![0u8; mbi.RegionSize];
                let mut bytes_read: usize = 0;
                
                let read_ok = ReadProcessMemory(
                    handle,
                    mbi.BaseAddress as *const _,
                    buffer.as_mut_ptr() as *mut _,
                    mbi.RegionSize,
                    &mut bytes_read,
                );

                if read_ok != 0 && bytes_read > 0 {
                    buffer.truncate(bytes_read);
                    
                    // Cerca UTF-8
                    for (i, window) in buffer.windows(search_bytes_utf8.len()).enumerate() {
                        if window == search_bytes_utf8 {
                            let addr = mbi.BaseAddress as usize + i;
                            candidates.push(HookCandidate {
                                address: format!("0x{:X}", addr),
                                module_name: "unknown".to_string(),
                                text_preview: extract_text_around(&buffer, i, 100),
                                confidence: 0.85,
                                hook_type: "UTF-8".to_string(),
                            });
                        }
                    }

                    // Cerca UTF-16LE
                    if search_bytes_utf16.len() <= buffer.len() {
                        for (i, window) in buffer.windows(search_bytes_utf16.len()).enumerate() {
                            if window == search_bytes_utf16.as_slice() {
                                let addr = mbi.BaseAddress as usize + i;
                                candidates.push(HookCandidate {
                                    address: format!("0x{:X}", addr),
                                    module_name: "unknown".to_string(),
                                    text_preview: extract_utf16_around(&buffer, i, 100),
                                    confidence: 0.90,
                                    hook_type: "UTF-16LE".to_string(),
                                });
                            }
                        }
                    }
                }
            }

            address = mbi.BaseAddress as usize + mbi.RegionSize;
            if address < mbi.BaseAddress as usize { break; }
        }

        CloseHandle(handle);
    }

    // Ordina per confidence
    candidates.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));
    candidates.truncate(20);

    let duration = start.elapsed().as_millis() as u64;
    println!("[AUTO-HOOK] Scan PID {} for '{}': {} candidates in {}ms", 
        process_id, search_text, candidates.len(), duration);

    Ok(HookScanResult {
        candidates,
        scan_duration_ms: duration,
        process_name: get_process_name(process_id),
        process_id,
    })
}

#[cfg(windows)]
fn get_process_name(pid: u32) -> String {
    use crate::commands::process_util::no_window_command;
    if let Ok(output) = no_window_command("tasklist")
        .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
        .output()
    {
        let text = String::from_utf8_lossy(&output.stdout);
        if let Some(first_field) = text.split(',').next() {
            return first_field.trim_matches('"').trim().to_string();
        }
    }
    format!("PID:{}", pid)
}

#[cfg(windows)]
fn extract_text_around(buffer: &[u8], pos: usize, radius: usize) -> String {
    let start = pos.saturating_sub(radius);
    let end = (pos + radius).min(buffer.len());
    let slice = &buffer[start..end];
    String::from_utf8_lossy(slice)
        .chars()
        .filter(|c| c.is_ascii_graphic() || c.is_ascii_whitespace())
        .collect::<String>()
        .trim()
        .chars()
        .take(200)
        .collect()
}

#[cfg(windows)]
fn extract_utf16_around(buffer: &[u8], pos: usize, radius: usize) -> String {
    let start = pos.saturating_sub(radius * 2);
    let end = (pos + radius * 2).min(buffer.len());
    let slice = &buffer[start..end];
    if slice.len() % 2 != 0 { return String::new(); }
    let u16_chars: Vec<u16> = slice.chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();
    String::from_utf16_lossy(&u16_chars)
        .chars()
        .filter(|c| !c.is_control())
        .take(200)
        .collect()
}

// Non-windows stub
#[cfg(not(windows))]
#[tauri::command]
pub async fn scan_for_text_hooks(
    _process_id: u32,
    _search_text: String,
) -> Result<HookScanResult, String> {
    Err("Auto-Hook Scanner è disponibile solo su Windows".to_string())
}
