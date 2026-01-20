//! Unreal Engine Patcher - Sistema di traduzione runtime per giochi UE4/UE5
//! 
//! Questo modulo gestisce:
//! - Rilevamento giochi Unreal Engine
//! - Injection della DLL di traduzione
//! - Comunicazione IPC con la DLL
//! - Gestione cache traduzioni

use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};

/// Informazioni su un gioco Unreal Engine rilevato
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnrealGameInfo {
    pub game_path: String,
    pub executable: String,
    pub ue_version: String,
    pub is_ue5: bool,
    pub has_pak_files: bool,
    pub can_patch: bool,
    pub patch_installed: bool,
    pub message: String,
}

/// Stato della patch installata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnrealPatchStatus {
    pub installed: bool,
    pub version: String,
    pub target_language: String,
    pub translations_count: u32,
    pub last_used: Option<String>,
}

/// Configurazione della patch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnrealPatchConfig {
    pub target_language: String,
    pub source_language: String,
    pub translation_service: String, // "google", "deepl", "local"
    pub cache_enabled: bool,
    pub auto_translate: bool,
}

impl Default for UnrealPatchConfig {
    fn default() -> Self {
        Self {
            target_language: "it".to_string(),
            source_language: "en".to_string(),
            translation_service: "google".to_string(),
            cache_enabled: true,
            auto_translate: true,
        }
    }
}

/// Rileva se un gioco è Unreal Engine e raccoglie informazioni
#[tauri::command]
pub async fn detect_unreal_game(game_path: String) -> Result<UnrealGameInfo, String> {
    let path = Path::new(&game_path);
    
    if !path.exists() {
        return Err("Il percorso specificato non esiste".to_string());
    }
    
    let game_dir = if path.is_file() {
        path.parent().unwrap_or(path)
    } else {
        path
    };
    
    // Cerca indicatori Unreal Engine
    let has_engine_folder = game_dir.join("Engine").exists();
    let has_content_folder = game_dir.join("Content").exists();
    
    // Cerca file .pak
    let has_pak_files = fs::read_dir(game_dir)
        .map(|entries| {
            entries.filter_map(|e| e.ok())
                .any(|e| e.path().extension().map(|ext| ext == "pak").unwrap_or(false))
        })
        .unwrap_or(false);
    
    // Cerca in sottocartelle comuni
    let content_paks = game_dir.join("Content").join("Paks");
    let has_content_paks = content_paks.exists() && fs::read_dir(&content_paks)
        .map(|entries| {
            entries.filter_map(|e| e.ok())
                .any(|e| e.path().extension().map(|ext| ext == "pak").unwrap_or(false))
        })
        .unwrap_or(false);
    
    // Rileva versione UE
    let (ue_version, is_ue5) = detect_ue_version(game_dir);
    
    let is_unreal = has_engine_folder || has_content_folder || has_pak_files || has_content_paks;
    
    // Trova eseguibile
    let executable = find_game_executable(game_dir);
    
    let (can_patch, message) = if is_unreal {
        (true, format!("✓ Gioco {} rilevato - compatibile con GameStringer Translator", ue_version))
    } else {
        (false, "✗ Non sembra essere un gioco Unreal Engine".to_string())
    };
    
    // Verifica se patch già installata
    let patch_installed = check_patch_installed(game_dir);
    
    Ok(UnrealGameInfo {
        game_path: game_dir.to_string_lossy().to_string(),
        executable: executable.unwrap_or_default(),
        ue_version,
        is_ue5,
        has_pak_files: has_pak_files || has_content_paks,
        can_patch,
        patch_installed,
        message,
    })
}

/// Installa la patch di traduzione per un gioco Unreal
#[tauri::command]
pub async fn install_unreal_patch(
    game_path: String,
    config: UnrealPatchConfig,
) -> Result<String, String> {
    let game_dir = Path::new(&game_path);
    
    if !game_dir.exists() {
        return Err("Il percorso del gioco non esiste".to_string());
    }
    
    // Verifica che sia un gioco Unreal
    let game_info = detect_unreal_game(game_path.clone()).await?;
    if !game_info.can_patch {
        return Err(game_info.message);
    }
    
    log::info!("📦 Installazione patch Unreal per: {}", game_path);
    
    // Crea cartella per la patch
    let patch_dir = game_dir.join("GameStringer");
    fs::create_dir_all(&patch_dir)
        .map_err(|e| format!("Errore creazione cartella patch: {}", e))?;
    
    // Copia DLL appropriata (x64 per UE4/UE5)
    let dll_name = if game_info.is_ue5 { "gs_translator_x64.dll" } else { "gs_translator_x64.dll" };
    let dll_source = get_translator_dll_path()?;
    let dll_dest = patch_dir.join(dll_name);
    
    if dll_source.exists() {
        fs::copy(&dll_source, &dll_dest)
            .map_err(|e| format!("Errore copia DLL: {}", e))?;
    } else {
        log::warn!("DLL translator non trovata, verrà creata al primo build");
    }
    
    // Salva configurazione
    let config_path = patch_dir.join("config.json");
    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Errore serializzazione config: {}", e))?;
    fs::write(&config_path, config_json)
        .map_err(|e| format!("Errore scrittura config: {}", e))?;
    
    // Crea file marker per indicare patch installata
    let marker_path = patch_dir.join(".gs_installed");
    fs::write(&marker_path, format!("version=1.0.0\ninstalled={}", chrono::Utc::now().to_rfc3339()))
        .map_err(|e| format!("Errore creazione marker: {}", e))?;
    
    // Crea cartella cache traduzioni
    let cache_dir = patch_dir.join("translations");
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Errore creazione cartella cache: {}", e))?;
    
    log::info!("✅ Patch Unreal installata con successo!");
    
    Ok(format!("Patch installata in {}", patch_dir.display()))
}

/// Rimuove la patch da un gioco Unreal
#[tauri::command]
pub async fn uninstall_unreal_patch(game_path: String) -> Result<String, String> {
    let game_dir = Path::new(&game_path);
    let patch_dir = game_dir.join("GameStringer");
    
    if !patch_dir.exists() {
        return Err("Nessuna patch installata per questo gioco".to_string());
    }
    
    log::info!("🗑️ Rimozione patch Unreal da: {}", game_path);
    
    fs::remove_dir_all(&patch_dir)
        .map_err(|e| format!("Errore rimozione patch: {}", e))?;
    
    log::info!("✅ Patch rimossa con successo!");
    
    Ok("Patch rimossa con successo".to_string())
}

/// Ottiene lo stato della patch per un gioco
#[tauri::command]
pub async fn get_unreal_patch_status(game_path: String) -> Result<UnrealPatchStatus, String> {
    let game_dir = Path::new(&game_path);
    let patch_dir = game_dir.join("GameStringer");
    
    if !patch_dir.exists() {
        return Ok(UnrealPatchStatus {
            installed: false,
            version: String::new(),
            target_language: String::new(),
            translations_count: 0,
            last_used: None,
        });
    }
    
    // Leggi configurazione
    let config_path = patch_dir.join("config.json");
    let config: UnrealPatchConfig = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Errore lettura config: {}", e))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        UnrealPatchConfig::default()
    };
    
    // Conta traduzioni in cache
    let cache_dir = patch_dir.join("translations");
    let translations_count = if cache_dir.exists() {
        fs::read_dir(&cache_dir)
            .map(|entries| entries.count() as u32)
            .unwrap_or(0)
    } else {
        0
    };
    
    // Leggi marker per data installazione
    let marker_path = patch_dir.join(".gs_installed");
    let last_used = if marker_path.exists() {
        fs::read_to_string(&marker_path).ok()
    } else {
        None
    };
    
    Ok(UnrealPatchStatus {
        installed: true,
        version: "1.0.0".to_string(),
        target_language: config.target_language,
        translations_count,
        last_used,
    })
}

/// Avvia un gioco con la patch di traduzione attiva
#[tauri::command]
pub async fn launch_with_translator(game_path: String, executable: String) -> Result<String, String> {
    let game_dir = Path::new(&game_path);
    let patch_dir = game_dir.join("GameStringer");
    
    if !patch_dir.exists() {
        return Err("Patch non installata. Installa prima la patch.".to_string());
    }
    
    let exe_path = game_dir.join(&executable);
    if !exe_path.exists() {
        return Err(format!("Eseguibile non trovato: {}", executable));
    }
    
    log::info!("🚀 Avvio gioco con translator: {}", executable);
    
    // Avvia il gioco con injection della DLL
    // Per ora usiamo un approccio semplice con CreateRemoteThread
    // In futuro potremmo usare un loader più sofisticato
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // Avvia il gioco normalmente per ora
        // L'injection verrà implementata con un injector separato
        Command::new(&exe_path)
            .current_dir(game_dir)
            .spawn()
            .map_err(|e| format!("Errore avvio gioco: {}", e))?;
        
        // TODO: Implementare injection DLL dopo avvio processo
        // Questo richiede:
        // 1. Ottenere PID del processo
        // 2. OpenProcess con PROCESS_ALL_ACCESS
        // 3. VirtualAllocEx per allocare memoria
        // 4. WriteProcessMemory per scrivere path DLL
        // 5. CreateRemoteThread per chiamare LoadLibraryW
        
        log::info!("✅ Gioco avviato! (Injection DLL in sviluppo)");
    }
    
    Ok("Gioco avviato con successo".to_string())
}

// === Funzioni helper private ===

fn detect_ue_version(game_dir: &Path) -> (String, bool) {
    // Cerca file che indicano la versione
    
    // UE5 indicators
    let ue5_indicators = [
        game_dir.join("Engine").join("Binaries").join("Win64").join("UnrealEditor.exe"),
        game_dir.join("Engine").join("Build").join("Build.version"),
    ];
    
    for indicator in &ue5_indicators {
        if indicator.exists() {
            // Prova a leggere versione da Build.version
            if indicator.file_name().map(|n| n == "Build.version").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(indicator) {
                    if content.contains("\"MajorVersion\": 5") {
                        return ("Unreal Engine 5".to_string(), true);
                    }
                }
            }
            return ("Unreal Engine 5".to_string(), true);
        }
    }
    
    // Cerca pattern nei nomi file
    if let Ok(entries) = fs::read_dir(game_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name.contains("ue5") || name.contains("unreal5") {
                return ("Unreal Engine 5".to_string(), true);
            }
            if name.contains("ue4") || name.contains("unreal4") {
                return ("Unreal Engine 4".to_string(), false);
            }
        }
    }
    
    // Default a UE4 se non rilevato specificamente
    ("Unreal Engine 4/5".to_string(), false)
}

fn find_game_executable(game_dir: &Path) -> Option<String> {
    // Cerca eseguibili nella cartella principale
    if let Ok(entries) = fs::read_dir(game_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map(|e| e == "exe").unwrap_or(false) {
                let name = path.file_name()?.to_string_lossy().to_lowercase();
                // Salta launcher e crash handler
                if !name.contains("launcher") && 
                   !name.contains("crash") && 
                   !name.contains("uninstall") &&
                   !name.contains("redist") {
                    return Some(path.file_name()?.to_string_lossy().to_string());
                }
            }
        }
    }
    
    // Cerca in Binaries/Win64
    let binaries = game_dir.join("Binaries").join("Win64");
    if binaries.exists() {
        if let Ok(entries) = fs::read_dir(&binaries) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.extension().map(|e| e == "exe").unwrap_or(false) {
                    let name = path.file_name().unwrap().to_string_lossy().to_lowercase();
                    if !name.contains("crash") && !name.contains("cmd") {
                        return Some(format!("Binaries/Win64/{}", path.file_name()?.to_string_lossy()));
                    }
                }
            }
        }
    }
    
    None
}

fn check_patch_installed(game_dir: &Path) -> bool {
    let marker = game_dir.join("GameStringer").join(".gs_installed");
    marker.exists()
}

fn get_translator_dll_path() -> Result<PathBuf, String> {
    // Cerca la DLL nella cartella dell'applicazione
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Errore ottenimento path exe: {}", e))?
        .parent()
        .ok_or("Impossibile ottenere cartella exe")?
        .to_path_buf();
    
    let dll_path = exe_dir.join("resources").join("unreal-translator").join("gs_translator_x64.dll");
    
    Ok(dll_path)
}
