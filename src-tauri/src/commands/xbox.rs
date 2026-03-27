//! # Microsoft Store / Xbox Game Pass Integration Module
//!
//! Rileva giochi installati tramite:
//! 1. Registro Windows - GamingServices PackageRepository
//! 2. Cartella XboxGames (installazioni Xbox App)
//! 3. WindowsApps (Microsoft Store packages)
//! 4. Gaming Services registry entries

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use crate::commands::library::InstalledGame;
use log::{info, debug};

#[cfg(windows)]
use winreg::enums::*;
#[cfg(windows)]
use winreg::RegKey;

// ============================================================================
// STRUTTURE DATI
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XboxGame {
    pub package_family_name: String,
    pub display_name: String,
    pub install_location: String,
    pub publisher_display_name: Option<String>,
    pub is_game_pass: bool,
    pub version: Option<String>,
}

// ============================================================================
// FUNZIONI PRINCIPALI
// ============================================================================

/// Scansiona i giochi Microsoft Store / Xbox Game Pass installati
#[tauri::command]
pub async fn get_xbox_installed_games() -> Result<Vec<InstalledGame>, String> {
    info!("[XBOX] Scansione giochi Microsoft Store / Xbox Game Pass...");

    let mut games: Vec<InstalledGame> = Vec::new();

    // Metodo 1: Cartella XboxGames (Xbox App - percorso più comune)
    let xbox_games = scan_xbox_games_folder().await;
    info!("[XBOX] XboxGames folder: {} giochi", xbox_games.len());
    games.extend(xbox_games);

    // Metodo 2: Registro Windows - GamingServices
    #[cfg(windows)]
    {
        let registry_games = scan_xbox_registry();
        info!("[XBOX] Registry: {} giochi", registry_games.len());
        // Aggiungi solo se non già presenti (evita duplicati)
        for rg in registry_games {
            if !games.iter().any(|g| g.id == rg.id) {
                games.push(rg);
            }
        }
    }

    // Metodo 3: WindowsApps (giochi Microsoft Store)
    let store_games = scan_windows_apps_folder().await;
    info!("[XBOX] WindowsApps: {} giochi", store_games.len());
    for sg in store_games {
        if !games.iter().any(|g| g.id == sg.id) {
            games.push(sg);
        }
    }

    info!("[XBOX] ✅ Totale giochi Microsoft Store/Xbox: {}", games.len());
    Ok(games)
}

/// Scansiona la cartella XboxGames (default: C:\XboxGames)
async fn scan_xbox_games_folder() -> Vec<InstalledGame> {
    let mut games = Vec::new();

    // Percorsi possibili per i giochi Xbox
    let drives = get_drive_letters();
    let mut search_paths: Vec<PathBuf> = Vec::new();

    for drive in &drives {
        search_paths.push(PathBuf::from(format!("{}\\XboxGames", drive)));
        search_paths.push(PathBuf::from(format!("{}\\Games\\Xbox Games", drive)));
        search_paths.push(PathBuf::from(format!("{}\\Xbox Games", drive)));
    }

    let mut seen_titles: std::collections::HashSet<String> = std::collections::HashSet::new();

    for base_path in search_paths {
        if !base_path.exists() {
            continue;
        }
        debug!("[XBOX] Scansione cartella: {:?}", base_path);

        let Ok(entries) = std::fs::read_dir(&base_path) else { continue };

        for entry in entries.flatten() {
            let game_dir = entry.path();
            if !game_dir.is_dir() {
                continue;
            }

            let folder_name = entry.file_name().to_string_lossy().to_string();

            // Salta cartelle di sistema
            if folder_name.starts_with('.') || folder_name == "System Volume Information" {
                continue;
            }

            // Leggi MicrosoftGame.config se presente (fornisce nome e ID ufficiale)
            let (display_name, package_id) = read_microsoft_game_config(&game_dir)
                .unwrap_or_else(|| (folder_name.clone(), format!("xbox_{}", sanitize_id(&folder_name))));

            // Salta launcher e tool (non sono giochi)
            if is_xbox_tool(&display_name) {
                continue;
            }

            // Deduplicazione per titolo normalizzato (es. Minecraft appare con 2 package)
            let title_key = display_name.to_lowercase();
            if seen_titles.contains(&title_key) {
                debug!("[XBOX] Duplicato saltato: {}", display_name);
                continue;
            }
            seen_titles.insert(title_key);

            let executable = find_xbox_executable(&game_dir).await;
            let last_modified = get_folder_modified_time(&game_dir);

            games.push(InstalledGame {
                id: format!("xbox_{}", sanitize_id(&package_id)),
                name: display_name,
                path: game_dir.to_string_lossy().to_string(),
                executable,
                size_bytes: None,
                last_modified,
                platform: "Xbox Game Pass".to_string(),
            });
        }
    }

    games
}

/// Legge MicrosoftGame.config per ottenere nome e ID ufficiale del gioco
fn read_microsoft_game_config(game_dir: &Path) -> Option<(String, String)> {
    let config_path = game_dir.join("MicrosoftGame.config");
    if !config_path.exists() {
        return None;
    }

    let content = std::fs::read_to_string(&config_path).ok()?;

    // Estrai ShellVisuals DisplayName
    let display_name = extract_xml_attr(&content, "ShellVisuals", "DefaultDisplayName")
        .or_else(|| extract_xml_attr(&content, "Game", "DisplayName"))
        .or_else(|| extract_xml_tag(&content, "DisplayName"))
        .unwrap_or_default();

    // Estrai Identity Name
    let identity_name = extract_xml_attr(&content, "Identity", "Name")
        .unwrap_or_default();

    if display_name.is_empty() || identity_name.is_empty() {
        return None;
    }

    Some((display_name, identity_name))
}

/// Scansiona il registro Windows per giochi Xbox/GamingServices
#[cfg(windows)]
fn scan_xbox_registry() -> Vec<InstalledGame> {
    let mut games = Vec::new();

    // Chiavi registro per Gaming Services
    let reg_paths = [
        r"SOFTWARE\Microsoft\GamingServices\PackageRepository\Root",
        r"SOFTWARE\Microsoft\GamingServices\PackageRepository\Package",
        r"SOFTWARE\Xbox\GamingOverlay",
    ];

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    for reg_path in &reg_paths {
        // Prova HKLM
        if let Ok(key) = hklm.open_subkey(reg_path) {
            games.extend(parse_gaming_services_key(&key));
        }
        // Prova HKCU
        if let Ok(key) = hkcu.open_subkey(reg_path) {
            games.extend(parse_gaming_services_key(&key));
        }
    }

    // Cerca anche in HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\Repository\Packages
    let packages_path = r"Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\Repository\Packages";
    if let Ok(packages_key) = hkcu.open_subkey(packages_path) {
        games.extend(parse_appmodel_packages(&packages_key));
    }

    games
}

/// Parsa le chiavi GamingServices per trovare giochi installati
#[cfg(windows)]
fn parse_gaming_services_key(key: &RegKey) -> Vec<InstalledGame> {
    let mut games = Vec::new();

    for subkey_name in key.enum_keys().flatten() {
        if let Ok(subkey) = key.open_subkey(&subkey_name) {
            let install_path: String = subkey.get_value("Root").unwrap_or_default();
            let display_name: String = subkey.get_value("DisplayName").unwrap_or_default();

            if install_path.is_empty() || !std::path::Path::new(&install_path).exists() {
                continue;
            }

            let name = if display_name.is_empty() {
                // Estrai dal PackageFamilyName (es. "Microsoft.HaloInfinite_8wekyb3d8bbwe")
                subkey_name.split('_').next()
                    .unwrap_or(&subkey_name)
                    .replace('.', " ")
                    .trim()
                    .to_string()
            } else {
                display_name
            };

            if is_xbox_tool(&name) || name.is_empty() {
                continue;
            }

            games.push(InstalledGame {
                id: format!("xbox_{}", sanitize_id(&subkey_name)),
                name,
                path: install_path,
                executable: None,
                size_bytes: None,
                last_modified: None,
                platform: "Xbox Game Pass".to_string(),
            });
        }
    }

    games
}

/// Parsa i packages AppModel per trovare giochi Xbox
#[cfg(windows)]
fn parse_appmodel_packages(key: &RegKey) -> Vec<InstalledGame> {
    let mut games = Vec::new();

    for package_name in key.enum_keys().flatten() {
        // Filtra solo pacchetti che sembrano giochi Xbox (publisher Microsoft + tipo Game)
        if !is_xbox_game_package(&package_name) {
            continue;
        }

        if let Ok(pkg_key) = key.open_subkey(&package_name) {
            let install_path: String = pkg_key.get_value("PackageRootFolder").unwrap_or_default();
            if install_path.is_empty() || !std::path::Path::new(&install_path).exists() {
                continue;
            }

            let install_path_buf = PathBuf::from(&install_path);
            let display_name = extract_display_name_from_package(&install_path_buf)
                .unwrap_or_else(|| {
                    package_name.split('_').next()
                        .unwrap_or(&package_name)
                        .replace('.', " ")
                        .trim()
                        .to_string()
                });

            if is_xbox_tool(&display_name) || display_name.is_empty() {
                continue;
            }

            games.push(InstalledGame {
                id: format!("xbox_{}", sanitize_id(&package_name)),
                name: display_name,
                path: install_path,
                executable: None,
                size_bytes: None,
                last_modified: None,
                platform: "Xbox Game Pass".to_string(),
            });
        }
    }

    games
}

/// Scansiona WindowsApps per giochi Microsoft Store (richiede privilegi elevati, ma prova comunque)
async fn scan_windows_apps_folder() -> Vec<InstalledGame> {
    let mut games = Vec::new();

    let drives = get_drive_letters();
    for drive in &drives {
        let windows_apps = PathBuf::from(format!("{}\\Program Files\\WindowsApps", drive));
        if !windows_apps.exists() {
            continue;
        }

        let Ok(entries) = std::fs::read_dir(&windows_apps) else { continue };

        for entry in entries.flatten() {
            let pkg_dir = entry.path();
            if !pkg_dir.is_dir() {
                continue;
            }

            let pkg_name = entry.file_name().to_string_lossy().to_string();

            // Filtra solo pacchetti Xbox/Game Pass
            if !is_xbox_game_package(&pkg_name) {
                continue;
            }

            let display_name = extract_display_name_from_package(&pkg_dir)
                .unwrap_or_else(|| {
                    pkg_name.split('_').next()
                        .unwrap_or(&pkg_name)
                        .replace('.', " ")
                        .trim()
                        .to_string()
                });

            if is_xbox_tool(&display_name) || display_name.is_empty() {
                continue;
            }

            let id = format!("xbox_{}", sanitize_id(&pkg_name));
            games.push(InstalledGame {
                id,
                name: display_name,
                path: pkg_dir.to_string_lossy().to_string(),
                executable: None,
                size_bytes: None,
                last_modified: get_folder_modified_time(&pkg_dir),
                platform: "Xbox Game Pass".to_string(),
            });
        }
    }

    games
}

// ============================================================================
// HELPERS
// ============================================================================

/// Ritorna le lettere dei drive disponibili
fn get_drive_letters() -> Vec<String> {
    #[cfg(windows)]
    {
        let mut drives = Vec::new();
        for letter in b'C'..=b'Z' {
            let drive = format!("{}:", char::from(letter));
            if std::path::Path::new(&drive).exists() {
                drives.push(drive);
            }
        }
        if drives.is_empty() {
            drives.push("C:".to_string());
        }
        drives
    }
    #[cfg(not(windows))]
    {
        vec!["C:".to_string()]
    }
}

/// Verifica se un package name appartiene a un gioco Xbox
fn is_xbox_game_package(package_name: &str) -> bool {
    let name_lower = package_name.to_lowercase();
    // Publisher Xbox/Microsoft noti
    let xbox_publishers = [
        "microsoft.xbox", "xbox.", "bethesda.", "microsoft.halo",
        "microsoft.forza", "microsoft.gears", "microsoft.minecraft",
        "mojang.", "activision.", "zenimax.", "id-software.",
        "obsidian.", "inxile.", "playground.",
    ];
    xbox_publishers.iter().any(|p| name_lower.contains(p))
}

/// Estrae il nome visualizzato da AppxManifest.xml di un package
fn extract_display_name_from_package(pkg_dir: &Path) -> Option<String> {
    // Prima prova MicrosoftGame.config
    if let Some((name, _)) = read_microsoft_game_config(pkg_dir) {
        if !name.is_empty() {
            return Some(name);
        }
    }

    // Poi prova AppxManifest.xml
    let manifest = pkg_dir.join("AppxManifest.xml");
    if !manifest.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&manifest).ok()?;

    // Cerca DisplayName in Properties o VisualElements
    extract_xml_tag(&content, "DisplayName")
        .or_else(|| extract_xml_attr(&content, "uap:VisualElements", "DisplayName"))
        .or_else(|| extract_xml_attr(&content, "VisualElements", "DisplayName"))
        .filter(|s| !s.is_empty() && !s.starts_with("ms-resource:"))
}

/// Cerca l'eseguibile principale per un gioco Xbox
async fn find_xbox_executable(game_dir: &PathBuf) -> Option<String> {
    if !game_dir.exists() {
        return None;
    }

    // Prima cerca in MicrosoftGame.config
    let config_path = game_dir.join("MicrosoftGame.config");
    if config_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            if let Some(exe) = extract_xml_attr(&content, "ExecutableList", "Executable")
                .or_else(|| extract_xml_attr(&content, "Executable", "Name"))
            {
                let exe_path = game_dir.join(&exe);
                if exe_path.exists() {
                    return Some(exe_path.to_string_lossy().to_string());
                }
            }
        }
    }

    // Fallback: cerca .exe nella root
    if let Ok(entries) = std::fs::read_dir(game_dir) {
        let mut exes: Vec<_> = entries
            .flatten()
            .filter(|e| {
                e.file_name().to_string_lossy().ends_with(".exe")
                    && !e.file_name().to_string_lossy().to_lowercase().contains("unins")
                    && !e.file_name().to_string_lossy().to_lowercase().contains("crash")
                    && !e.file_name().to_string_lossy().to_lowercase().contains("setup")
            })
            .collect();

        exes.sort_by(|a, b| {
            let sa = std::fs::metadata(a.path()).map(|m| m.len()).unwrap_or(0);
            let sb = std::fs::metadata(b.path()).map(|m| m.len()).unwrap_or(0);
            sb.cmp(&sa)
        });

        if let Some(exe) = exes.first() {
            return Some(exe.path().to_string_lossy().to_string());
        }
    }

    None
}

/// Verifica se è un tool/sistema Xbox (non un gioco)
fn is_xbox_tool(name: &str) -> bool {
    let lower = name.to_lowercase();
    let tools = [
        // Xbox system UI / overlay
        "xbox app", "xbox game bar", "xbox identity", "xbox speech",
        "xbox accessories", "xbox insider", "xbox console companion",
        "xboxgamingoverlay", "xbox tcui", "xbox game callable",
        "xbox devices", "xboxdevices", "xboxgamecallableui",
        "xboxidentityprovider", "xboxspeechtotextoverlay",
        // GameSave / cloud saves (non è un gioco)
        "gamesave", "game save",
        // Microsoft Store / Gaming Services
        "microsoft store", "gaming services", "game bar",
        // Windows system
        "windows security", "microsoft edge", "visual studio",
        "crossdevice", "cortana", "onedrive", "onenote",
        // Runtimes / frameworks
        "runtime", "redistributable", "framework", "vclibs",
        "directx", "appruntime", "net native",
        // Advertising / telemetry
        "advertising", "feedback hub", "phone link",
    ];
    tools.iter().any(|t| lower.contains(t))
}

/// Estrae un attributo da un tag XML (parsing semplice senza dipendenze)
fn extract_xml_attr(content: &str, tag: &str, attr: &str) -> Option<String> {
    let search = format!("<{}", tag);
    let tag_start = content.find(&search)?;
    let tag_content = &content[tag_start..];
    let tag_end = tag_content.find('>')?;
    let tag_str = &tag_content[..tag_end];

    let attr_search = format!("{}=\"", attr);
    let attr_start = tag_str.find(&attr_search)?;
    let value_start = attr_start + attr_search.len();
    let value_end = tag_str[value_start..].find('"')?;

    Some(tag_str[value_start..value_start + value_end].to_string())
}

/// Estrae il contenuto di un tag XML (parsing semplice)
fn extract_xml_tag(content: &str, tag: &str) -> Option<String> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    let start = content.find(&open)?;
    let value_start = start + open.len();
    let end = content[value_start..].find(&close)?;
    Some(content[value_start..value_start + end].trim().to_string())
}

/// Sanitizza una stringa per usarla come ID
fn sanitize_id(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>()
        .to_lowercase()
}

/// Ottiene il tempo di modifica di una cartella
fn get_folder_modified_time(path: &PathBuf) -> Option<u64> {
    std::fs::metadata(path).ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
}

/// Verifica se Microsoft Store / Xbox App è installato
#[tauri::command]
pub async fn is_xbox_installed() -> bool {
    // Controlla se esiste almeno una cartella XboxGames
    let drives = get_drive_letters();
    for drive in &drives {
        if PathBuf::from(format!("{}\\XboxGames", drive)).exists() {
            return true;
        }
    }

    // Oppure se Gaming Services è presente nel registro
    #[cfg(windows)]
    {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if hklm.open_subkey(r"SOFTWARE\Microsoft\GamingServices").is_ok() {
            return true;
        }
    }

    false
}

/// Test connessione Xbox / Microsoft Store
#[tauri::command]
pub async fn test_xbox_connection() -> Result<String, String> {
    match get_xbox_installed_games().await {
        Ok(games) => {
            if games.is_empty() {
                Ok("Xbox App/Microsoft Store rilevato ma nessun gioco trovato".to_string())
            } else {
                Ok(format!("✅ Xbox Game Pass: {} giochi installati", games.len()))
            }
        }
        Err(e) => Err(format!("❌ Errore scansione Xbox: {}", e)),
    }
}
