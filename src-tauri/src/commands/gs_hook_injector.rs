//! Comando di injection per gs-hook (Universal Text Interception Framework).
//!
//! Differenza chiave rispetto a `unity_injector`: gs-hook è buildato **dual-arch**
//! (x86 + x64). Qui rileviamo il bitness del processo target e di conseguenza:
//!   1. scegliamo la DLL giusta   → `resources/gs-hook/<arch>/gs-hook.dll`
//!   2. lanciamo l'injector helper della STESSA arch del target
//!                                 → `resources/gs-hook/<arch>/gs-injector.exe`
//!
//! Perché un helper esterno e non `CreateRemoteThread` diretto come in
//! `unity_injector`? Perché il backend Tauri è x64: iniettare in un processo a
//! 32-bit (RPG Maker & co.) richiederebbe l'indirizzo di `LoadLibrary` del
//! kernel32 *a 32-bit* del target — non quello del nostro host x64. Lanciando un
//! helper compilato nella stessa arch del target, la `LoadLibraryW` remota usa
//! un kernel32 valido nel target, e il caso x64→x86 si risolve senza WoW64
//! PE-parsing nel backend.
//!
//! 🛡️ Il gate anti-cheat resta in Rust, PRIMA di lanciare l'helper. L'helper non
//! contiene logica anti-cheat ed è un dettaglio interno del backend: l'unico
//! punto autorizzato a invocarlo è questo comando, già passato dal gate.

use tauri::command;

/// Risultato injection (specifico di questo modulo).
#[derive(serde::Serialize, serde::Deserialize)]
pub struct InjectionResult {
    pub success: bool,
    pub message: String,
}

/// Se la traduzione a runtime è percorribile, e se il gioco è già avviato.
///
/// Serve a decidere PRIMA di provare: senza questa sonda l'unica risposta
/// possibile a «il gioco è chiuso» sarebbe un'injection fallita, mentre è
/// un invito ad agire («avvia il gioco»). La regola che ci ragiona sopra sta
/// in `lib/translation/runtime-fallback.ts` con i suoi test.
#[derive(Debug, serde::Serialize)]
pub struct GsHookStatus {
    /// DLL e injector presenti per almeno un'architettura.
    pub available: bool,
    /// `process_name` è vivo adesso.
    pub process_running: bool,
}

#[command]
pub async fn gs_hook_status(process_name: Option<String>) -> Result<GsHookStatus, String> {
    // Basta una delle due arch: quale serve davvero si sa solo col PID in mano.
    let available = ["x64", "x86"].iter().any(|arch| {
        gs_hook_paths(arch)
            .map(|(dll, injector)| dll.exists() && injector.exists())
            .unwrap_or(false)
    });

    let process_running = process_name
        .as_deref()
        .and_then(find_process_by_name)
        .is_some();

    Ok(GsHookStatus { available, process_running })
}

/// Inietta `gs-hook.dll` (arch corretta) nel processo `process_name`.
#[command]
pub async fn inject_gs_hook(
    app: tauri::AppHandle,
    process_name: String,
    // `share_frames`: se `true`, la DLL pubblicherà i fotogrammi in memoria
    // condivisa perché il percorso OCR li legga (`read_game_frame`). Costa gli
    // hook sui blit, quindi resta spento se nessuno li chiede.
    share_frames: Option<bool>,
) -> Result<InjectionResult, String> {
    log::info!("🎯 Injection gs-hook in: {}", process_name);

    // Prima dell'iniezione, non dopo: la DLL legge la sentinella quando
    // installa gli hook, e dopo non la guarda più.
    if let Err(e) = imposta_condivisione_fotogrammi(share_frames.unwrap_or(false)) {
        log::warn!("🖼️ Sentinella fotogrammi non aggiornata ({}), si procede", e);
    }

    #[cfg(target_os = "windows")]
    {
        let pid = find_process_by_name(&process_name)
            .ok_or_else(|| format!("Processo {} non trovato", process_name))?;
        log::info!("📍 Trovato PID: {}", pid);

        // 🛡️ GATE ANTI-CHEAT — choke-point obbligatorio prima di QUALSIASI tocco
        // al processo target (incluso lo spawn dell'helper). Blocco rigido.
        crate::anti_cheat::assert_injection_allowed(pid)?;

        // Dizionario pre-caricato, PRIMA dell'iniezione. Non è un'ottimizzazione:
        // su Unreal la stessa stringa passa da FText::ToString una volta sola
        // (la display string resta in cache dentro l'FTextData), quindi il
        // percorso fire-and-forget della DLL — chiedi al primo avvistamento,
        // usa dal secondo — non scatta mai. Senza questo file la traduzione non
        // compare, per quanto bene funzionino pipe e dizionario.
        //
        // Il percorso è convenuto invece che passato come variabile d'ambiente
        // perché una env var non si può impostare in un processo già avviato:
        // la DLL cerca %APPDATA%\GameStringer\gs-hook-cache.gstc.
        match preload_dictionary(&app) {
            Ok(0) => log::info!("📖 Dizionario vuoto: gs-hook partirà senza traduzioni note"),
            Ok(n) => log::info!("📖 Pre-caricate {} traduzioni per gs-hook", n),
            // Un dizionario mancante non deve impedire l'iniezione: senza, la
            // DLL cattura comunque il testo e lo manda all'app via pipe.
            Err(e) => log::warn!("📖 Dizionario non pre-caricato ({}), si procede", e),
        }

        // Bitness del target → arch della DLL/injector da usare.
        let arch = match target_is_wow64(pid) {
            Some(true) => "x86",  // processo a 32-bit (WoW64 su Windows x64)
            Some(false) => "x64", // processo a 64-bit
            None => {
                return Ok(InjectionResult {
                    success: false,
                    message: "Impossibile determinare il bitness del processo target".into(),
                })
            }
        };
        log::info!("🧬 Target {} → uso build {}", process_name, arch);

        let (dll_path, injector_path) = gs_hook_paths(arch)?;

        if !dll_path.exists() {
            return Ok(InjectionResult {
                success: false,
                message: format!(
                    "DLL gs-hook ({}) non trovata in {}. Builda con gs-hook/build-all.ps1.",
                    arch,
                    dll_path.display()
                ),
            });
        }
        if !injector_path.exists() {
            return Ok(InjectionResult {
                success: false,
                message: format!(
                    "Injector ({}) non trovato in {}. Builda con gs-hook/build-all.ps1.",
                    arch,
                    injector_path.display()
                ),
            });
        }

        // Lancia l'helper per-arch: argv = <pid> <percorso-dll>.
        let status = std::process::Command::new(&injector_path)
            .arg(pid.to_string())
            .arg(&dll_path)
            .status()
            .map_err(|e| format!("Impossibile avviare l'injector: {}", e))?;

        if status.success() {
            log::info!("✅ gs-hook ({}) iniettata in {} (PID {})", arch, process_name, pid);
            // Apri l'overlay PRIMA che il testo cominci a fluire (modalità "in
            // tempo reale": le sorgenti di estrazione inoltrano qui). Non blocca
            // né fa fallire l'injection se la finestra non si crea.
            if let Err(e) = crate::overlay_ipc::ensure_overlay_window(&app) {
                log::warn!("Overlay non aperto: {}", e);
            }
            Ok(InjectionResult {
                success: true,
                message: format!("gs-hook ({}) iniettata in {} (PID {})", arch, process_name, pid),
            })
        } else {
            Ok(InjectionResult {
                success: false,
                message: format!(
                    "Injector ha fallito (exit code {:?}). Vedi i log dell'helper.",
                    status.code()
                ),
            })
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = process_name;
        Err("Injection supportata solo su Windows".into())
    }
}

/// Path di DLL e injector per l'architettura `arch` ("x86" | "x64"), risolti
/// accanto all'eseguibile (`<exe_dir>/resources/gs-hook/<arch>/...`), come fa
/// `unity_injector` per le proprie risorse.
#[cfg(target_os = "windows")]
/// Percorso del dizionario che gs-hook legge all'avvio. Deve combaciare con
/// quello in `gs-hook/src/dllmain.cpp`.
fn gs_hook_cache_path() -> Result<std::path::PathBuf, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA non impostata".to_string())?;
    Ok(std::path::Path::new(&appdata)
        .join("GameStringer")
        .join("gs-hook-cache.gstc"))
}

/// Percorso della sentinella che accende la pubblicazione dei fotogrammi.
///
/// È un file e non una variabile d'ambiente per lo stesso motivo del
/// dizionario: l'iniezione avviene in un processo GIÀ AVVIATO, e in un processo
/// avviato una variabile d'ambiente non si può più impostare. La DLL controlla
/// questo percorso all'attivazione (vedi `CondivisioneAttiva` in
/// `source_gdi.cpp`); il contenuto non conta, conta l'esistenza.
fn gs_hook_frame_share_path() -> Result<std::path::PathBuf, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA non impostata".to_string())?;
    Ok(std::path::Path::new(&appdata)
        .join("GameStringer")
        .join("gs-hook-frame-share"))
}

/// Accende o spegne la pubblicazione dei fotogrammi per le iniezioni SUCCESSIVE.
///
/// Non ha effetto su un gioco già agganciato: la DLL legge la sentinella una
/// volta sola, quando installa gli hook. Dirlo qui evita l'aspettativa
/// sbagliata che l'interruttore agisca a caldo.
fn imposta_condivisione_fotogrammi(attiva: bool) -> Result<(), String> {
    let path = gs_hook_frame_share_path()?;
    if attiva {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        std::fs::write(&path, b"1").map_err(|e| e.to_string())
    } else {
        match std::fs::remove_file(&path) {
            Ok(()) => Ok(()),
            // Assente = già spenta: non è un errore.
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

/// Scrive la coppia di lingue attiva del Translation Bridge nel file che la DLL
/// caricherà. Ritorna quante traduzioni sono state scritte.
fn preload_dictionary(app: &tauri::AppHandle) -> Result<usize, String> {
    use tauri::Manager;

    let path = gs_hook_cache_path()?;
    let state = app.state::<crate::commands::translation_bridge::TranslationBridgeState>();
    let dict = state.dictionary.read();
    dict.export_gstc(&path.to_string_lossy())
}

fn gs_hook_paths(arch: &str) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("Impossibile ottenere cartella exe")?
        .to_path_buf();

    let base = exe_dir.join("resources").join("gs-hook").join(arch);
    Ok((base.join("gs-hook.dll"), base.join("gs-injector.exe")))
}

/// `Some(true)` se il processo gira sotto WoW64 (cioè è un processo a 32-bit su
/// Windows a 64-bit), `Some(false)` se è nativo a 64-bit, `None` se non è stato
/// possibile interrogarlo.
///
/// Nota: su un (raro) host Windows a 32-bit `IsWow64Process` ritorna sempre
/// `false`; in quel caso esiste solo la build x86 e andrebbe forzata. Fuori
/// scopo per lo spike (target a 64-bit non esistono su host a 32-bit).
#[cfg(target_os = "windows")]
fn target_is_wow64(pid: u32) -> Option<bool> {
    extern "system" {
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut std::ffi::c_void;
        fn IsWow64Process(handle: *mut std::ffi::c_void, wow64: *mut i32) -> i32;
        fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
    }
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return None;
        }
        let mut wow64: i32 = 0;
        let ok = IsWow64Process(handle, &mut wow64);
        CloseHandle(handle);
        if ok == 0 {
            return None;
        }
        Some(wow64 != 0)
    }
}

/// Trova il PID del primo processo il cui nome contiene `name` (case-insensitive).
/// Stessa logica di `unity_injector::find_process_by_name`.
#[cfg(target_os = "windows")]
pub(crate) fn find_process_by_name(name: &str) -> Option<u32> {
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
