use serde::{Deserialize, Serialize};
use std::error::Error;
use std::mem;
use winapi::shared::minwindef::{DWORD, FALSE, MAX_PATH};
use winapi::um::handleapi::CloseHandle;
use winapi::um::processthreadsapi::OpenProcess;
use winapi::um::psapi::{EnumProcesses, GetModuleBaseNameW};
use winapi::um::tlhelp32::{CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32, TH32CS_SNAPPROCESS};
use winapi::um::winnt::{HANDLE, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
use winapi::um::winuser::{EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub window_title: Option<String>,
}

// Lista di processi di gioco comuni
const GAME_PROCESSES: &[&str] = &[
    // Steam games
    "csgo.exe", "dota2.exe", "hl2.exe", "portal2.exe", "left4dead2.exe",
    // Epic Games
    "FortniteClient-Win64-Shipping.exe", "r5apex.exe",
    // Blizzard
    "Overwatch.exe", "WoW.exe", "Diablo III64.exe", "StarCraft II.exe",
    // Riot
    "League of Legends.exe", "VALORANT-Win64-Shipping.exe",
    // Altri giochi popolari
    "GTA5.exe", "RDR2.exe", "Minecraft.exe", "javaw.exe",
    "TheWitcher3.exe", "Cyberpunk2077.exe", "EldenRing.exe",
    // Emulatori
    "rpcs3.exe", "yuzu.exe", "ryujinx.exe", "cemu.exe", "pcsx2.exe",
];

// Struttura per passare dati al callback di EnumWindows
struct WindowEnumData {
    pid: DWORD,
    window_title: Option<String>,
}

// Callback per EnumWindows
unsafe extern "system" fn enum_windows_callback(hwnd: winapi::shared::windef::HWND, lparam: winapi::shared::minwindef::LPARAM) -> winapi::shared::minwindef::BOOL {
    let data = &mut *(lparam as *mut WindowEnumData);
    let mut window_pid: DWORD = 0;
    
    GetWindowThreadProcessId(hwnd, &mut window_pid);
    
    if window_pid == data.pid && IsWindowVisible(hwnd) != FALSE {
        let mut title: [u16; 256] = [0; 256];
        let len = GetWindowTextW(hwnd, title.as_mut_ptr(), 256);
        
        if len > 0 {
            let title_string = String::from_utf16_lossy(&title[..len as usize]);
            if !title_string.is_empty() {
                data.window_title = Some(title_string);
                return FALSE; // Stop enumeration
            }
        }
    }
    
    1 // Continue enumeration
}

// Ottiene il titolo della finestra principale di un processo
unsafe fn get_window_title_for_process(pid: DWORD) -> Option<String> {
    let mut data = WindowEnumData {
        pid,
        window_title: None,
    };
    
    EnumWindows(Some(enum_windows_callback), &mut data as *mut _ as winapi::shared::minwindef::LPARAM);
    data.window_title
}

// Trova tutti i processi di gioco in esecuzione
pub fn find_game_processes() -> Result<Vec<ProcessInfo>, Box<dyn Error>> {
    unsafe {
        let mut processes = Vec::new();
        
        // Crea snapshot dei processi
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == winapi::um::handleapi::INVALID_HANDLE_VALUE {
            return Err("Impossibile creare snapshot processi".into());
        }
        
        let mut process_entry: PROCESSENTRY32 = mem::zeroed();
        process_entry.dwSize = mem::size_of::<PROCESSENTRY32>() as u32;
        
        // Itera attraverso tutti i processi
        if Process32First(snapshot, &mut process_entry) != FALSE {
            loop {
                let process_name = String::from_utf8_lossy(
                    &process_entry.szExeFile
                        .iter()
                        .take_while(|&&c| c != 0)
                        .map(|&c| c as u8)
                        .collect::<Vec<u8>>()
                ).to_string();
                
                // Controlla se è un processo di gioco noto
                let is_game = GAME_PROCESSES.iter().any(|&game| {
                    process_name.to_lowercase().contains(&game.to_lowercase())
                });
                
                // Controlla anche se ha una finestra visibile (potrebbe essere un gioco)
                let window_title = get_window_title_for_process(process_entry.th32ProcessID);
                let has_window = window_title.is_some();
                
                if is_game || has_window {
                    processes.push(ProcessInfo {
                        pid: process_entry.th32ProcessID,
                        name: process_name,
                        window_title,
                    });
                }
                
                if Process32Next(snapshot, &mut process_entry) == FALSE {
                    break;
                }
            }
        }
        
        CloseHandle(snapshot);
        
        // Ordina per nome
        processes.sort_by(|a, b| a.name.cmp(&b.name));
        
        Ok(processes)
    }
}

// Verifica se un processo è ancora in esecuzione
pub fn is_process_running(pid: u32) -> bool {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, pid);
        if handle.is_null() {
            return false;
        }
        
        CloseHandle(handle);
        true
    }
}
