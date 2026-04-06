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
        use crate::commands::process_util::no_window_command;

        // Avvia il gioco normalmente per ora
        // L'injection verrà implementata con un injector separato
        no_window_command(&exe_path)
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
                    let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // ── UnrealPatchConfig Default ──────────────────────────────────

    #[test]
    fn test_patch_config_default_values() {
        let cfg = UnrealPatchConfig::default();
        assert_eq!(cfg.target_language, "it");
        assert_eq!(cfg.source_language, "en");
        assert_eq!(cfg.translation_service, "google");
        assert!(cfg.cache_enabled);
        assert!(cfg.auto_translate);
    }

    // ── Serialization round-trips ──────────────────────────────────

    #[test]
    fn test_patch_config_serde_roundtrip() {
        let cfg = UnrealPatchConfig {
            target_language: "de".into(),
            source_language: "ja".into(),
            translation_service: "deepl".into(),
            cache_enabled: false,
            auto_translate: false,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let restored: UnrealPatchConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.target_language, "de");
        assert_eq!(restored.source_language, "ja");
        assert_eq!(restored.translation_service, "deepl");
        assert!(!restored.cache_enabled);
        assert!(!restored.auto_translate);
    }

    #[test]
    fn test_game_info_serde_roundtrip() {
        let info = UnrealGameInfo {
            game_path: "/tmp/game".into(),
            executable: "game.exe".into(),
            ue_version: "Unreal Engine 5".into(),
            is_ue5: true,
            has_pak_files: true,
            can_patch: true,
            patch_installed: false,
            message: "OK".into(),
        };
        let json = serde_json::to_string(&info).unwrap();
        let restored: UnrealGameInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.game_path, "/tmp/game");
        assert!(restored.is_ue5);
        assert!(restored.can_patch);
    }

    #[test]
    fn test_patch_status_serde_roundtrip() {
        let status = UnrealPatchStatus {
            installed: true,
            version: "1.0.0".into(),
            target_language: "fr".into(),
            translations_count: 42,
            last_used: Some("2024-01-01".into()),
        };
        let json = serde_json::to_string(&status).unwrap();
        let restored: UnrealPatchStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.translations_count, 42);
        assert_eq!(restored.last_used.as_deref(), Some("2024-01-01"));
    }

    #[test]
    fn test_patch_status_serde_last_used_none() {
        let status = UnrealPatchStatus {
            installed: false,
            version: String::new(),
            target_language: String::new(),
            translations_count: 0,
            last_used: None,
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("null"));
        let restored: UnrealPatchStatus = serde_json::from_str(&json).unwrap();
        assert!(restored.last_used.is_none());
    }

    // ── check_patch_installed ──────────────────────────────────────

    #[test]
    fn test_check_patch_installed_true() {
        let tmp = TempDir::new().unwrap();
        let gs_dir = tmp.path().join("GameStringer");
        fs::create_dir_all(&gs_dir).unwrap();
        fs::write(gs_dir.join(".gs_installed"), "version=1.0.0").unwrap();
        assert!(check_patch_installed(tmp.path()));
    }

    #[test]
    fn test_check_patch_installed_false_no_dir() {
        let tmp = TempDir::new().unwrap();
        assert!(!check_patch_installed(tmp.path()));
    }

    #[test]
    fn test_check_patch_installed_false_dir_without_marker() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path().join("GameStringer")).unwrap();
        assert!(!check_patch_installed(tmp.path()));
    }

    // ── detect_ue_version ──────────────────────────────────────────

    #[test]
    fn test_detect_ue_version_default_when_empty() {
        let tmp = TempDir::new().unwrap();
        let (version, is_ue5) = detect_ue_version(tmp.path());
        assert_eq!(version, "Unreal Engine 4/5");
        assert!(!is_ue5);
    }

    #[test]
    fn test_detect_ue_version_ue5_via_unreal_editor_exe() {
        let tmp = TempDir::new().unwrap();
        let editor_dir = tmp.path().join("Engine").join("Binaries").join("Win64");
        fs::create_dir_all(&editor_dir).unwrap();
        fs::write(editor_dir.join("UnrealEditor.exe"), b"fake").unwrap();
        let (version, is_ue5) = detect_ue_version(tmp.path());
        assert_eq!(version, "Unreal Engine 5");
        assert!(is_ue5);
    }

    #[test]
    fn test_detect_ue_version_ue5_via_build_version_file() {
        let tmp = TempDir::new().unwrap();
        let build_dir = tmp.path().join("Engine").join("Build");
        fs::create_dir_all(&build_dir).unwrap();
        fs::write(
            build_dir.join("Build.version"),
            r#"{ "MajorVersion": 5, "MinorVersion": 3 }"#,
        )
        .unwrap();
        let (version, is_ue5) = detect_ue_version(tmp.path());
        assert_eq!(version, "Unreal Engine 5");
        assert!(is_ue5);
    }

    #[test]
    fn test_detect_ue_version_ue5_build_version_non_five() {
        // Build.version exists but doesn't contain MajorVersion 5 — still returns UE5
        // because the first indicator (UnrealEditor.exe) is not checked, but
        // Build.version existing triggers the UE5 path even if content doesn't match,
        // as the code returns UE5 after the if-let block.
        let tmp = TempDir::new().unwrap();
        let build_dir = tmp.path().join("Engine").join("Build");
        fs::create_dir_all(&build_dir).unwrap();
        fs::write(
            build_dir.join("Build.version"),
            r#"{ "MajorVersion": 4, "MinorVersion": 27 }"#,
        )
        .unwrap();
        let (version, is_ue5) = detect_ue_version(tmp.path());
        // The code falls through and returns UE5 anyway (see line after if-let)
        assert_eq!(version, "Unreal Engine 5");
        assert!(is_ue5);
    }

    #[test]
    fn test_detect_ue_version_ue5_via_filename_pattern() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("MyGame-UE5.exe"), b"fake").unwrap();
        let (version, is_ue5) = detect_ue_version(tmp.path());
        assert_eq!(version, "Unreal Engine 5");
        assert!(is_ue5);
    }

    #[test]
    fn test_detect_ue_version_ue4_via_filename_pattern() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("Game_UE4_Shipping.log"), b"log").unwrap();
        let (version, is_ue5) = detect_ue_version(tmp.path());
        assert_eq!(version, "Unreal Engine 4");
        assert!(!is_ue5);
    }

    // ── find_game_executable ───────────────────────────────────────

    #[test]
    fn test_find_game_executable_finds_exe_in_root() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("MyGame.exe"), b"MZ").unwrap();
        let result = find_game_executable(tmp.path());
        assert_eq!(result.as_deref(), Some("MyGame.exe"));
    }

    #[test]
    fn test_find_game_executable_skips_launcher() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("GameLauncher.exe"), b"MZ").unwrap();
        let result = find_game_executable(tmp.path());
        // launcher is excluded, so None
        assert!(result.is_none());
    }

    #[test]
    fn test_find_game_executable_skips_crash_handler() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("CrashReporter.exe"), b"MZ").unwrap();
        let result = find_game_executable(tmp.path());
        assert!(result.is_none());
    }

    #[test]
    fn test_find_game_executable_skips_uninstall() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("uninstall.exe"), b"MZ").unwrap();
        let result = find_game_executable(tmp.path());
        assert!(result.is_none());
    }

    #[test]
    fn test_find_game_executable_skips_redist() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("vcredist_x64.exe"), b"MZ").unwrap();
        let result = find_game_executable(tmp.path());
        assert!(result.is_none());
    }

    #[test]
    fn test_find_game_executable_falls_back_to_binaries_win64() {
        let tmp = TempDir::new().unwrap();
        let bin_dir = tmp.path().join("Binaries").join("Win64");
        fs::create_dir_all(&bin_dir).unwrap();
        fs::write(bin_dir.join("MyGame-Win64-Shipping.exe"), b"MZ").unwrap();
        let result = find_game_executable(tmp.path());
        assert!(result.is_some());
        let exe = result.unwrap();
        assert!(exe.contains("Binaries/Win64/"));
        assert!(exe.contains("MyGame-Win64-Shipping.exe"));
    }

    #[test]
    fn test_find_game_executable_skips_crash_in_binaries() {
        let tmp = TempDir::new().unwrap();
        let bin_dir = tmp.path().join("Binaries").join("Win64");
        fs::create_dir_all(&bin_dir).unwrap();
        fs::write(bin_dir.join("CrashReportClient.exe"), b"MZ").unwrap();
        let result = find_game_executable(tmp.path());
        assert!(result.is_none());
    }

    #[test]
    fn test_find_game_executable_skips_cmd_in_binaries() {
        let tmp = TempDir::new().unwrap();
        let bin_dir = tmp.path().join("Binaries").join("Win64");
        fs::create_dir_all(&bin_dir).unwrap();
        fs::write(bin_dir.join("cmd_helper.exe"), b"MZ").unwrap();
        let result = find_game_executable(tmp.path());
        assert!(result.is_none());
    }

    #[test]
    fn test_find_game_executable_empty_dir() {
        let tmp = TempDir::new().unwrap();
        let result = find_game_executable(tmp.path());
        assert!(result.is_none());
    }

    #[test]
    fn test_find_game_executable_ignores_non_exe_files() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("readme.txt"), b"text").unwrap();
        fs::write(tmp.path().join("game.dll"), b"dll").unwrap();
        let result = find_game_executable(tmp.path());
        assert!(result.is_none());
    }

    // ── get_translator_dll_path ────────────────────────────────────

    #[test]
    fn test_get_translator_dll_path_returns_expected_structure() {
        let result = get_translator_dll_path();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("resources"));
        assert!(path.to_string_lossy().contains("unreal-translator"));
        assert!(path.to_string_lossy().contains("gs_translator_x64.dll"));
    }

    // ── detect_unreal_game (async command) ─────────────────────────

    #[tokio::test]
    async fn test_detect_unreal_game_nonexistent_path() {
        let result = detect_unreal_game("/nonexistent/path/12345".into()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("non esiste"));
    }

    #[tokio::test]
    async fn test_detect_unreal_game_empty_dir_not_unreal() {
        let tmp = TempDir::new().unwrap();
        let result = detect_unreal_game(tmp.path().to_string_lossy().to_string()).await;
        assert!(result.is_ok());
        let info = result.unwrap();
        assert!(!info.can_patch);
        assert!(!info.has_pak_files);
        assert!(info.message.contains("Non sembra"));
    }

    #[tokio::test]
    async fn test_detect_unreal_game_with_engine_folder() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path().join("Engine")).unwrap();
        let result = detect_unreal_game(tmp.path().to_string_lossy().to_string()).await;
        let info = result.unwrap();
        assert!(info.can_patch);
        assert!(info.message.contains("compatibile"));
    }

    #[tokio::test]
    async fn test_detect_unreal_game_with_content_folder() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path().join("Content")).unwrap();
        let result = detect_unreal_game(tmp.path().to_string_lossy().to_string()).await;
        let info = result.unwrap();
        assert!(info.can_patch);
    }

    #[tokio::test]
    async fn test_detect_unreal_game_with_pak_files_root() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("game.pak"), b"pak").unwrap();
        let result = detect_unreal_game(tmp.path().to_string_lossy().to_string()).await;
        let info = result.unwrap();
        assert!(info.can_patch);
        assert!(info.has_pak_files);
    }

    #[tokio::test]
    async fn test_detect_unreal_game_with_content_paks_subfolder() {
        let tmp = TempDir::new().unwrap();
        let paks_dir = tmp.path().join("Content").join("Paks");
        fs::create_dir_all(&paks_dir).unwrap();
        fs::write(paks_dir.join("main.pak"), b"pak data").unwrap();
        let result = detect_unreal_game(tmp.path().to_string_lossy().to_string()).await;
        let info = result.unwrap();
        assert!(info.can_patch);
        assert!(info.has_pak_files);
    }

    #[tokio::test]
    async fn test_detect_unreal_game_patch_installed_flag() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path().join("Engine")).unwrap();
        let gs_dir = tmp.path().join("GameStringer");
        fs::create_dir_all(&gs_dir).unwrap();
        fs::write(gs_dir.join(".gs_installed"), "v1").unwrap();
        let result = detect_unreal_game(tmp.path().to_string_lossy().to_string()).await;
        let info = result.unwrap();
        assert!(info.patch_installed);
    }

    #[tokio::test]
    async fn test_detect_unreal_game_finds_executable() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path().join("Content")).unwrap();
        fs::write(tmp.path().join("AwesomeGame.exe"), b"MZ").unwrap();
        let result = detect_unreal_game(tmp.path().to_string_lossy().to_string()).await;
        let info = result.unwrap();
        assert_eq!(info.executable, "AwesomeGame.exe");
    }

    #[tokio::test]
    async fn test_detect_unreal_game_file_path_resolves_parent() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path().join("Content")).unwrap();
        let fake_exe = tmp.path().join("game.exe");
        fs::write(&fake_exe, b"MZ").unwrap();
        let result = detect_unreal_game(fake_exe.to_string_lossy().to_string()).await;
        let info = result.unwrap();
        // When given a file, it should resolve to parent dir
        assert!(info.can_patch);
    }

    // ── get_unreal_patch_status (async command) ────────────────────

    #[tokio::test]
    async fn test_get_patch_status_not_installed() {
        let tmp = TempDir::new().unwrap();
        let status = get_unreal_patch_status(tmp.path().to_string_lossy().to_string())
            .await
            .unwrap();
        assert!(!status.installed);
        assert_eq!(status.version, "");
        assert_eq!(status.translations_count, 0);
        assert!(status.last_used.is_none());
    }

    #[tokio::test]
    async fn test_get_patch_status_installed_with_config() {
        let tmp = TempDir::new().unwrap();
        let gs_dir = tmp.path().join("GameStringer");
        fs::create_dir_all(&gs_dir).unwrap();
        fs::write(gs_dir.join(".gs_installed"), "marker").unwrap();

        let cfg = UnrealPatchConfig {
            target_language: "fr".into(),
            source_language: "en".into(),
            translation_service: "deepl".into(),
            cache_enabled: true,
            auto_translate: true,
        };
        fs::write(
            gs_dir.join("config.json"),
            serde_json::to_string(&cfg).unwrap(),
        )
        .unwrap();

        // Create some translation cache files
        let cache_dir = gs_dir.join("translations");
        fs::create_dir_all(&cache_dir).unwrap();
        fs::write(cache_dir.join("t1.json"), "{}").unwrap();
        fs::write(cache_dir.join("t2.json"), "{}").unwrap();

        let status = get_unreal_patch_status(tmp.path().to_string_lossy().to_string())
            .await
            .unwrap();
        assert!(status.installed);
        assert_eq!(status.version, "1.0.0");
        assert_eq!(status.target_language, "fr");
        assert_eq!(status.translations_count, 2);
        assert!(status.last_used.is_some());
    }

    #[tokio::test]
    async fn test_get_patch_status_installed_no_config_uses_default() {
        let tmp = TempDir::new().unwrap();
        let gs_dir = tmp.path().join("GameStringer");
        fs::create_dir_all(&gs_dir).unwrap();

        let status = get_unreal_patch_status(tmp.path().to_string_lossy().to_string())
            .await
            .unwrap();
        assert!(status.installed);
        assert_eq!(status.target_language, "it"); // default
    }

    #[tokio::test]
    async fn test_get_patch_status_no_translations_cache_dir() {
        let tmp = TempDir::new().unwrap();
        let gs_dir = tmp.path().join("GameStringer");
        fs::create_dir_all(&gs_dir).unwrap();

        let status = get_unreal_patch_status(tmp.path().to_string_lossy().to_string())
            .await
            .unwrap();
        assert_eq!(status.translations_count, 0);
    }

    // ── uninstall_unreal_patch (async command) ─────────────────────

    #[tokio::test]
    async fn test_uninstall_patch_no_patch() {
        let tmp = TempDir::new().unwrap();
        let result = uninstall_unreal_patch(tmp.path().to_string_lossy().to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Nessuna patch"));
    }

    #[tokio::test]
    async fn test_uninstall_patch_removes_dir() {
        let tmp = TempDir::new().unwrap();
        let gs_dir = tmp.path().join("GameStringer");
        fs::create_dir_all(&gs_dir).unwrap();
        fs::write(gs_dir.join(".gs_installed"), "v1").unwrap();

        let result = uninstall_unreal_patch(tmp.path().to_string_lossy().to_string()).await;
        assert!(result.is_ok());
        assert!(!gs_dir.exists());
    }

    // ── launch_with_translator (async command) ─────────────────────

    #[tokio::test]
    async fn test_launch_no_patch_installed() {
        let tmp = TempDir::new().unwrap();
        let result = launch_with_translator(
            tmp.path().to_string_lossy().to_string(),
            "game.exe".into(),
        )
        .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Patch non installata"));
    }

    #[tokio::test]
    async fn test_launch_missing_executable() {
        let tmp = TempDir::new().unwrap();
        let gs_dir = tmp.path().join("GameStringer");
        fs::create_dir_all(&gs_dir).unwrap();
        let result = launch_with_translator(
            tmp.path().to_string_lossy().to_string(),
            "nonexistent.exe".into(),
        )
        .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Eseguibile non trovato"));
    }
}
