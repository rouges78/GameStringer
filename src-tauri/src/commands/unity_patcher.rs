use tauri::command;
use std::path::Path;
use std::fs::{self, File};
use std::io::{Cursor, Read};
use reqwest::Client;
use zip::ZipArchive;

// URL per BepInEx 5.x (Unity 2017+) - Aggiornato a v5.4.23.4
const BEPINEX5_X64_URL: &str = "https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.4/BepInEx_win_x64_5.4.23.4.zip";
const BEPINEX5_X86_URL: &str = "https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.4/BepInEx_win_x86_5.4.23.4.zip";

// URL per BepInEx Legacy (Unity 5.6+) - v5.4.11 più compatibile con Unity vecchie
const BEPINEX_LEGACY_X64_URL: &str = "https://github.com/BepInEx/BepInEx/releases/download/v5.4.11/BepInEx_x64_5.4.11.0.zip";
const BEPINEX_LEGACY_X86_URL: &str = "https://github.com/BepInEx/BepInEx/releases/download/v5.4.11/BepInEx_x86_5.4.11.0.zip";

// URL per IPA (Illusion Plugin Architecture) - Per Unity 5.0-5.5 molto vecchie
const IPA_URL: &str = "https://github.com/Eusth/IPA/releases/download/3.4.1/IPA-3.4.1.zip";

// XUnity per IPA (versione IPA-compatible)
const XUNITY_IPA_URL: &str = "https://github.com/bbepis/XUnity.AutoTranslator/releases/download/v5.5.0/XUnity.AutoTranslator-IPA-5.5.0.zip";

// URL per BepInEx 6.x Mono (Unity 2021+) - Pre-release ufficiale v6.0.0-pre.2
#[allow(dead_code)]
const BEPINEX6_MONO_X64_URL: &str = "https://github.com/BepInEx/BepInEx/releases/download/v6.0.0-pre.2/BepInEx-Unity.Mono-win-x64-6.0.0-pre.2.zip";
#[allow(dead_code)]
const BEPINEX6_MONO_X86_URL: &str = "https://github.com/BepInEx/BepInEx/releases/download/v6.0.0-pre.2/BepInEx-Unity.Mono-win-x86-6.0.0-pre.2.zip";

// URL per BepInEx 6.x IL2CPP - Per giochi Unity IL2CPP
const BEPINEX6_IL2CPP_X64_URL: &str = "https://github.com/BepInEx/BepInEx/releases/download/v6.0.0-pre.2/BepInEx-Unity.IL2CPP-win-x64-6.0.0-pre.2.zip";
const BEPINEX6_IL2CPP_X86_URL: &str = "https://github.com/BepInEx/BepInEx/releases/download/v6.0.0-pre.2/BepInEx-Unity.IL2CPP-win-x86-6.0.0-pre.2.zip";

// XUnity AutoTranslator - Aggiornato a v5.5.0
const XUNITY_URL: &str = "https://github.com/bbepis/XUnity.AutoTranslator/releases/download/v5.5.0/XUnity.AutoTranslator-BepInEx-5.5.0.zip";

// XUnity per BepInEx IL2CPP (versione speciale per IL2CPP)
const XUNITY_IL2CPP_URL: &str = "https://github.com/bbepis/XUnity.AutoTranslator/releases/download/v5.5.0/XUnity.AutoTranslator-BepInEx-IL2CPP-5.5.0.zip";

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct PatchStatus {
    success: bool,
    message: String,
    steps_completed: Vec<String>,
}

/// Rileva se un eseguibile PE è 32-bit o 64-bit
fn detect_exe_architecture(exe_path: &Path) -> Result<bool, String> {
    let mut file = File::open(exe_path).map_err(|e| format!("Impossibile aprire exe: {}", e))?;
    let mut buffer = [0u8; 512];
    file.read(&mut buffer).map_err(|e| format!("Impossibile leggere exe: {}", e))?;
    
    // Verifica signature DOS "MZ"
    if buffer[0] != 0x4D || buffer[1] != 0x5A {
        return Err("Non è un file PE valido".to_string());
    }
    
    // Offset al PE header è a 0x3C
    let pe_offset = u32::from_le_bytes([buffer[0x3C], buffer[0x3D], buffer[0x3E], buffer[0x3F]]) as usize;
    
    if pe_offset + 6 > buffer.len() {
        return Err("PE header fuori range".to_string());
    }
    
    // Verifica signature PE "PE\0\0"
    if buffer[pe_offset] != 0x50 || buffer[pe_offset + 1] != 0x45 {
        return Err("Signature PE non trovata".to_string());
    }
    
    // Machine type è a pe_offset + 4
    let machine = u16::from_le_bytes([buffer[pe_offset + 4], buffer[pe_offset + 5]]);
    
    // 0x8664 = AMD64 (x64), 0x14c = i386 (x86)
    Ok(machine == 0x8664)
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct GameEngineCheck {
    pub is_unity: bool,
    pub is_unreal: bool,
    pub engine_name: String,
    pub engine_version: Option<String>,
    pub can_patch: bool,
    pub message: String,
    pub alternative_tools: Vec<AlternativeTool>,
    pub has_bepinex: bool,
    pub has_xunity: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct AlternativeTool {
    pub name: String,
    pub url: String,
    pub description: String,
    pub compatible: bool,
}

/// Rileva versione Unity da multiple fonti (globalgamemanagers, level0, mainData, Player.log, exe resources)
fn detect_unity_version(game_dir: &Path) -> Option<String> {
    // Cerca cartella _Data
    let data_folder = fs::read_dir(game_dir).ok()?
        .filter_map(|e| e.ok())
        .find(|e| e.file_name().to_string_lossy().ends_with("_Data") && e.path().is_dir())?;
    
    // 1. globalgamemanagers (metodo primario per Unity 5.x+)
    let ggm_path = data_folder.path().join("globalgamemanagers");
    if let Some(ver) = read_unity_version_from_binary(&ggm_path, 8192) {
        return Some(ver);
    }
    
    // 2. globalgamemanagers.assets (Unity alternativo)
    let ggm_assets = data_folder.path().join("globalgamemanagers.assets");
    if let Some(ver) = read_unity_version_from_binary(&ggm_assets, 4096) {
        return Some(ver);
    }
    
    // 3. mainData (Unity 4.x e precedenti)
    let main_data = data_folder.path().join("mainData");
    if let Some(ver) = read_unity_version_from_binary(&main_data, 4096) {
        return Some(ver);
    }
    
    // 4. level0 (fallback)
    let level0_path = data_folder.path().join("level0");
    if let Some(ver) = read_unity_version_from_binary(&level0_path, 2048) {
        return Some(ver);
    }
    
    // 5. data.unity3d (WebGL builds)
    let unity3d = data_folder.path().join("data.unity3d");
    if let Some(ver) = read_unity_version_from_binary(&unity3d, 4096) {
        return Some(ver);
    }
    
    // 6. Player.log nella cartella %APPDATA% (se il gioco è stato avviato)
    if let Some(app_data) = std::env::var("APPDATA").ok() {
        // Cerca nella cartella del publisher/gioco
        let log_path = Path::new(&app_data).parent()
            .map(|p| p.join("LocalLow"));
        if let Some(local_low) = log_path {
            if let Some(ver) = search_player_log_for_version(&local_low) {
                return Some(ver);
            }
        }
    }
    
    // 7. UnityCrashHandler per stimare versione maggiore
    let crash64 = game_dir.join("UnityCrashHandler64.exe");
    let crash32 = game_dir.join("UnityCrashHandler32.exe");
    if let Some(ver) = detect_version_from_pe_resources(&crash64)
        .or_else(|| detect_version_from_pe_resources(&crash32)) {
        return Some(ver);
    }
    
    // 8. UnityPlayer.dll resources
    let unity_player = game_dir.join("UnityPlayer.dll");
    if let Some(ver) = detect_version_from_pe_resources(&unity_player) {
        return Some(ver);
    }
    
    None
}

/// Legge versione Unity da file binario cercando pattern noti
fn read_unity_version_from_binary(path: &Path, buffer_size: usize) -> Option<String> {
    if !path.exists() {
        return None;
    }
    
    let mut file = File::open(path).ok()?;
    let mut buffer = vec![0u8; buffer_size];
    file.read(&mut buffer).ok()?;
    
    let content = String::from_utf8_lossy(&buffer);
    
    // Pattern 1: "20XX.X.XXfX" o "20XX.X.XXpX" (release/patch)
    // Pattern 2: "5.X.XfX" (Unity 5.x)
    // Pattern 3: "4.X.XfX" (Unity 4.x)
    // Pattern 4: "6.X.X" (Unity 6 tech preview)
    use regex::Regex;
    let pattern_strs = [
        r"(202[0-9]\.[0-9]+\.[0-9]+[fpab][0-9]+)",
        r"(201[0-9]\.[0-9]+\.[0-9]+[fpab][0-9]+)",
        r"(5\.[0-9]+\.[0-9]+[fpab][0-9]+)",
        r"(4\.[0-9]+\.[0-9]+[fpab][0-9]+)",
        r"(6\.[0-9]+\.[0-9]+[fpab]?[0-9]*)",
    ];
    
    for pattern_str in &pattern_strs {
        if let Ok(pattern) = Regex::new(pattern_str) {
            if let Some(caps) = pattern.captures(&content) {
                if let Some(m) = caps.get(1) {
                    let ver = m.as_str().to_string();
                    // Validazione: deve avere almeno un punto
                    if ver.contains('.') && ver.len() >= 5 {
                        return Some(ver);
                    }
                }
            }
        }
    }
    
    // Fallback: cerca semplicemente "20" seguito da numeri e punti
    if let Some(start) = content.find("20") {
        let version_str: String = content[start..].chars()
            .take(20)
            .take_while(|c| c.is_alphanumeric() || *c == '.' || *c == 'f' || *c == 'p' || *c == 'a' || *c == 'b')
            .collect();
        if version_str.len() >= 8 && version_str.contains('.') && 
           (version_str.contains('f') || version_str.contains('p')) {
            return Some(version_str);
        }
    }
    
    None
}

/// Cerca Player.log in LocalLow per trovare la versione Unity
fn search_player_log_for_version(local_low: &Path) -> Option<String> {
    // Player.log contiene una riga tipo: "Initialize engine version: 2021.3.15f1"
    let entries = fs::read_dir(local_low).ok()?;
    
    for company in entries.filter_map(|e| e.ok()) {
        if company.path().is_dir() {
            if let Ok(games) = fs::read_dir(company.path()) {
                for game in games.filter_map(|e| e.ok()) {
                    let log_path = game.path().join("Player.log");
                    if log_path.exists() {
                        if let Ok(content) = fs::read_to_string(&log_path) {
                            // Cerca "Initialize engine version: X.X.XfX"
                            if let Some(idx) = content.find("Initialize engine version:") {
                                let after = &content[idx + 27..];
                                let version: String = after.chars()
                                    .skip_while(|c| c.is_whitespace())
                                    .take_while(|c| c.is_alphanumeric() || *c == '.' || *c == 'f' || *c == 'p')
                                    .collect();
                                if version.len() >= 5 {
                                    return Some(version);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// Estrae versione da risorse PE (exe/dll) - legge VERSION_INFO
fn detect_version_from_pe_resources(path: &Path) -> Option<String> {
    if !path.exists() {
        return None;
    }
    
    // Leggi i primi 64KB per cercare stringhe di versione
    let mut file = File::open(path).ok()?;
    let mut buffer = vec![0u8; 65536];
    let bytes_read = file.read(&mut buffer).ok()?;
    
    let content = String::from_utf8_lossy(&buffer[..bytes_read]);
    
    // Cerca pattern "ProductVersion" o "FileVersion" seguito dalla versione
    // Nelle risorse PE, queste sono stringhe wide (UTF-16)
    // Cerchiamo anche versioni ASCII
    
    // Pattern per Unity version string embedded
    if let Some(idx) = content.find("Unity ") {
        let after = &content[idx + 6..];
        let version: String = after.chars()
            .take_while(|c| c.is_alphanumeric() || *c == '.' || *c == 'f' || *c == 'p')
            .collect();
        if version.len() >= 5 && version.contains('.') {
            return Some(version);
        }
    }
    
    None
}

// ============================================================================
// RILEVAMENTO UNREAL ENGINE CON VERSIONE
// ============================================================================

/// Informazioni dettagliate su Unreal Engine
#[derive(Clone)]
struct UnrealEngineInfo {
    version: Option<String>,
    is_ue5: bool,
    project_name: Option<String>,
}

/// Rileva Unreal Engine e versione da multiple fonti
fn detect_unreal_version(game_dir: &Path) -> Option<UnrealEngineInfo> {
    let mut info = UnrealEngineInfo {
        version: None,
        is_ue5: false,
        project_name: None,
    };
    
    // 1. Cerca file .uproject (se presente, contiene versione esplicita)
    if let Ok(entries) = fs::read_dir(game_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map(|e| e == "uproject").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    info.project_name = path.file_stem().map(|s| s.to_string_lossy().to_string());
                    // Parse JSON per "EngineAssociation": "5.3" o "4.27"
                    if let Some(idx) = content.find("EngineAssociation") {
                        let after = &content[idx..];
                        // Estrai il valore tra virgolette
                        let parts: Vec<&str> = after.split('"').collect();
                        if parts.len() >= 4 {
                            let ver = parts[3];
                            if !ver.is_empty() && (ver.starts_with('4') || ver.starts_with('5')) {
                                info.version = Some(ver.to_string());
                                info.is_ue5 = ver.starts_with('5');
                                return Some(info);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 2. Controlla Engine/Binaries per determinare UE4 vs UE5
    let engine_binaries = game_dir.join("Engine/Binaries/Win64");
    if engine_binaries.exists() {
        // UE5 ha file specifici
        if engine_binaries.join("UnrealEditor.exe").exists() ||
           engine_binaries.join("UnrealEditor-Cmd.exe").exists() {
            info.is_ue5 = true;
            info.version = Some("5.x".to_string());
        } else if engine_binaries.join("UE4Editor.exe").exists() ||
                  engine_binaries.join("UE4Editor-Cmd.exe").exists() {
            info.version = Some("4.x".to_string());
        }
    }
    
    // 3. Analizza header dei file .pak per magic number e versione
    if let Some(ver) = detect_unreal_from_pak(game_dir) {
        info.version = Some(ver.clone());
        info.is_ue5 = ver.starts_with('5');
        return Some(info);
    }
    
    // 4. Cerca DefaultEngine.ini per hints sulla versione
    let config_paths = [
        game_dir.join("Config/DefaultEngine.ini"),
        game_dir.join("Engine/Config/BaseEngine.ini"),
    ];
    
    for config_path in &config_paths {
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(config_path) {
                // Cerca "EngineVersion=" o commenti con versione
                for line in content.lines() {
                    if line.contains("EngineVersion=") || line.contains("CompatibleWithEngineVersion") {
                        // Estrai versione numerica
                        let numbers: String = line.chars()
                            .filter(|c| c.is_numeric() || *c == '.')
                            .collect();
                        if numbers.len() >= 3 {
                            info.version = Some(numbers);
                            return Some(info);
                        }
                    }
                }
            }
        }
    }
    
    // 5. Cerca nei nomi delle DLL/exe per hints
    if let Ok(entries) = fs::read_dir(game_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name.contains("ue5") || name.contains("unreal5") {
                info.is_ue5 = true;
                info.version = Some("5.x".to_string());
                return Some(info);
            } else if name.contains("ue4") || name.contains("unreal4") {
                info.version = Some("4.x".to_string());
                return Some(info);
            }
        }
    }
    
    // 6. Presenza di cartelle tipiche UE5
    if game_dir.join("Engine/Content/Slate").exists() {
        // Slate UI presente = almeno UE4
        info.version = Some("4.x+".to_string());
    }
    
    if info.version.is_some() {
        Some(info)
    } else {
        None
    }
}

/// Analizza header .pak per versione Unreal
fn detect_unreal_from_pak(game_dir: &Path) -> Option<String> {
    // Cerca file .pak nella cartella principale o Content/Paks
    let pak_dirs = [
        game_dir.to_path_buf(),
        game_dir.join("Content/Paks"),
        game_dir.join("Paks"),
    ];
    
    for pak_dir in &pak_dirs {
        if let Ok(entries) = fs::read_dir(pak_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.extension().map(|e| e == "pak").unwrap_or(false) {
                    if let Some(ver) = read_pak_version(&path) {
                        return Some(ver);
                    }
                }
            }
        }
    }
    None
}

/// Legge versione da header file .pak
fn read_pak_version(pak_path: &Path) -> Option<String> {
    let mut file = File::open(pak_path).ok()?;
    
    // Il footer del PAK contiene le informazioni di versione
    // Magic: 0x5A6F12E1 (little endian)
    // La versione del PAK indica la versione UE:
    // PAK v1 = UE4.0-4.2
    // PAK v2 = UE4.3
    // PAK v3 = UE4.3-4.15 
    // PAK v4 = UE4.16-4.19
    // PAK v5 = UE4.20
    // PAK v6 = UE4.21
    // PAK v7 = UE4.22
    // PAK v8 = UE4.23-4.24
    // PAK v9 = UE4.25
    // PAK v10 = UE4.26
    // PAK v11 = UE4.27-5.0
    // PAK v12+ = UE5.1+
    
    use std::io::{Seek, SeekFrom};
    
    // Leggi footer (ultimi 45 bytes circa)
    file.seek(SeekFrom::End(-45)).ok()?;
    let mut footer = [0u8; 45];
    file.read_exact(&mut footer).ok()?;
    
    // Cerca magic number 0x5A6F12E1
    let magic = u32::from_le_bytes([0xE1, 0x12, 0x6F, 0x5A]);
    
    // Il magic può essere a diverse posizioni nel footer
    for i in 0..footer.len().saturating_sub(4) {
        let val = u32::from_le_bytes([footer[i], footer[i+1], footer[i+2], footer[i+3]]);
        if val == magic && i + 8 < footer.len() {
            // La versione è subito dopo il magic
            let pak_version = u32::from_le_bytes([
                footer[i+4], footer[i+5], footer[i+6], footer[i+7]
            ]);
            
            // Mappa versione PAK a versione UE
            let ue_version = match pak_version {
                0 => return None,
                1..=2 => "4.0-4.2",
                3 => "4.3-4.15",
                4 => "4.16-4.19",
                5 => "4.20",
                6 => "4.21",
                7 => "4.22",
                8 => "4.23-4.24",
                9 => "4.25",
                10 => "4.26",
                11 => "4.27-5.0",
                12 => "5.1",
                13 => "5.2",
                14 => "5.3",
                _ => "5.4+",
            };
            return Some(ue_version.to_string());
        }
    }
    
    None
}

// ============================================================================
// RILEVAMENTO GODOT CON VERSIONE
// ============================================================================

/// Rileva versione Godot da file .pck o project.godot
fn detect_godot_version(game_dir: &Path) -> Option<String> {
    // 1. Cerca project.godot (se non impacchettato)
    let project_godot = game_dir.join("project.godot");
    if project_godot.exists() {
        if let Ok(content) = fs::read_to_string(&project_godot) {
            // Cerca "config/features=PackedStringArray("4.2")" o simile
            for line in content.lines() {
                if line.contains("config_version=") {
                    // config_version=4 = Godot 3.x
                    // config_version=5 = Godot 4.x
                    if line.contains("5") {
                        return Some("4.x".to_string());
                    } else if line.contains("4") {
                        return Some("3.x".to_string());
                    }
                }
                if line.contains("config/features") {
                    // Estrai versione esplicita
                    if let Some(ver) = extract_godot_version_from_features(line) {
                        return Some(ver);
                    }
                }
            }
        }
    }
    
    // 2. Analizza header file .pck
    if let Ok(entries) = fs::read_dir(game_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map(|e| e == "pck").unwrap_or(false) {
                if let Some(ver) = read_pck_header_version(&path) {
                    return Some(ver);
                }
            }
        }
    }
    
    // 3. Cerca embedded PCK nell'exe
    if let Ok(entries) = fs::read_dir(game_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map(|e| e == "exe").unwrap_or(false) {
                if let Some(ver) = detect_godot_embedded_pck(&path) {
                    return Some(ver);
                }
            }
        }
    }
    
    None
}

fn extract_godot_version_from_features(line: &str) -> Option<String> {
    // config/features=PackedStringArray("4.2", "GL Compatibility")
    let numbers: Vec<&str> = line.split('"')
        .filter(|s| s.chars().next().map(|c| c.is_numeric()).unwrap_or(false))
        .collect();
    
    numbers.first().map(|s| s.to_string())
}

/// Legge header .pck per versione Godot
fn read_pck_header_version(pck_path: &Path) -> Option<String> {
    let mut file = File::open(pck_path).ok()?;
    let mut header = [0u8; 16];
    file.read_exact(&mut header).ok()?;
    
    // Magic: "GDPC" (0x47445043)
    if &header[0..4] != b"GDPC" {
        return None;
    }
    
    // Versione formato: header[4..8] (little endian)
    let format_version = u32::from_le_bytes([header[4], header[5], header[6], header[7]]);
    
    // Versione major Godot: header[8..12]
    let major = u32::from_le_bytes([header[8], header[9], header[10], header[11]]);
    
    // Versione minor: header[12..16]
    let minor = u32::from_le_bytes([header[12], header[13], header[14], header[15]]);
    
    // Format version 1 = Godot 3.x, Format version 2 = Godot 4.x
    if format_version == 2 || major >= 4 {
        Some(format!("{}.{}", major, minor))
    } else if format_version == 1 {
        Some(format!("3.{}", minor))
    } else {
        Some(format!("{}.{}", major, minor))
    }
}

/// Cerca PCK embedded in exe Godot
fn detect_godot_embedded_pck(exe_path: &Path) -> Option<String> {
    let mut file = File::open(exe_path).ok()?;
    
    // Leggi ultimi 8 bytes per cercare magic "GDPC" reversed
    use std::io::{Seek, SeekFrom};
    file.seek(SeekFrom::End(-8)).ok()?;
    let mut tail = [0u8; 8];
    file.read_exact(&mut tail).ok()?;
    
    // Se c'è un PCK embedded, c'è un offset alla fine
    // Cerchiamo il magic "GDPC" partendo dalla fine
    let file_size = file.seek(SeekFrom::End(0)).ok()?;
    
    // Cerca "GDPC" negli ultimi 1MB
    let search_size = std::cmp::min(file_size, 1024 * 1024) as usize;
    file.seek(SeekFrom::End(-(search_size as i64))).ok()?;
    
    let mut buffer = vec![0u8; search_size];
    file.read_exact(&mut buffer).ok()?;
    
    // Cerca magic "GDPC"
    for i in 0..buffer.len().saturating_sub(16) {
        if &buffer[i..i+4] == b"GDPC" {
            let major = u32::from_le_bytes([buffer[i+8], buffer[i+9], buffer[i+10], buffer[i+11]]);
            let minor = u32::from_le_bytes([buffer[i+12], buffer[i+13], buffer[i+14], buffer[i+15]]);
            if major >= 3 && major <= 5 {
                return Some(format!("{}.{}", major, minor));
            }
        }
    }
    
    None
}

// ============================================================================
// RILEVAMENTO RPG MAKER CON VERSIONE SPECIFICA
// ============================================================================

#[derive(Clone)]
struct RpgMakerInfo {
    version: String,
    can_translate_directly: bool,
}

/// Rileva versione specifica RPG Maker
fn detect_rpgmaker_version(game_dir: &Path) -> Option<RpgMakerInfo> {
    // RPG Maker MZ (2020+)
    if game_dir.join("js/rmmz_core.js").exists() || game_dir.join("www/js/rmmz_core.js").exists() {
        return Some(RpgMakerInfo {
            version: "MZ".to_string(),
            can_translate_directly: true,
        });
    }
    
    // RPG Maker MV (2015+)
    if game_dir.join("js/rpg_core.js").exists() || game_dir.join("www/js/rpg_core.js").exists() {
        return Some(RpgMakerInfo {
            version: "MV".to_string(),
            can_translate_directly: true,
        });
    }
    
    // RPG Maker VX Ace (2011)
    if game_dir.join("RGSS301.dll").exists() {
        return Some(RpgMakerInfo {
            version: "VX Ace".to_string(),
            can_translate_directly: false,
        });
    }
    
    // RPG Maker VX (2008)
    if game_dir.join("RGSS202E.dll").exists() || game_dir.join("RGSS202J.dll").exists() {
        return Some(RpgMakerInfo {
            version: "VX".to_string(),
            can_translate_directly: false,
        });
    }
    
    // RPG Maker XP (2004)
    if game_dir.join("RGSS104E.dll").exists() || game_dir.join("RGSS104J.dll").exists() ||
       game_dir.join("RGSS102E.dll").exists() || game_dir.join("RGSS103E.dll").exists() {
        return Some(RpgMakerInfo {
            version: "XP".to_string(),
            can_translate_directly: false,
        });
    }
    
    // RPG Maker 2000/2003 (hanno RPG_RT.exe)
    if game_dir.join("RPG_RT.exe").exists() {
        // 2003 ha più effetti battle
        let is_2003 = game_dir.join("CharSet").exists() && game_dir.join("Battle").exists();
        return Some(RpgMakerInfo {
            version: if is_2003 { "2003" } else { "2000" }.to_string(),
            can_translate_directly: false,
        });
    }
    
    // RPG Maker MV/MZ generico (cartella www)
    if game_dir.join("www").exists() || game_dir.join("js").exists() {
        return Some(RpgMakerInfo {
            version: "MV/MZ".to_string(),
            can_translate_directly: true,
        });
    }
    
    None
}

// ============================================================================
// RILEVAMENTO ALTRI ENGINE
// ============================================================================

#[derive(Clone)]
struct GameMakerInfo {
    version: String,  // "Studio 1.x", "Studio 2.x", "Legacy"
}

/// Rileva versione GameMaker
fn detect_gamemaker_version(game_dir: &Path) -> Option<GameMakerInfo> {
    // GameMaker Studio 2.3+ usa data.win con formato diverso
    let data_win = game_dir.join("data.win");
    if data_win.exists() {
        if let Ok(mut file) = File::open(&data_win) {
            let mut header = [0u8; 8];
            if file.read_exact(&mut header).is_ok() {
                // "FORM" header indica IFF format
                if &header[0..4] == b"FORM" {
                    // Leggi chunks per determinare versione
                    let mut buffer = vec![0u8; 4096];
                    file.read(&mut buffer).ok();
                    let content = String::from_utf8_lossy(&buffer);
                    
                    // GMS2.3+ ha chunk "SEQN" e "FEDS"
                    if content.contains("SEQN") || content.contains("FEDS") {
                        return Some(GameMakerInfo {
                            version: "Studio 2.3+".to_string(),
                        });
                    }
                    // GMS2 ha chunk "TGIN"
                    if content.contains("TGIN") {
                        return Some(GameMakerInfo {
                            version: "Studio 2.x".to_string(),
                        });
                    }
                    // GMS1
                    return Some(GameMakerInfo {
                        version: "Studio 1.x".to_string(),
                    });
                }
            }
        }
    }
    
    // Legacy GameMaker (game.droid per Android)
    if game_dir.join("game.droid").exists() {
        return Some(GameMakerInfo {
            version: "Studio (Android)".to_string(),
        });
    }
    
    // GameMaker 8.x e precedenti (game.exe con icona GM)
    if game_dir.join("game.exe").exists() || game_dir.join("Game.exe").exists() {
        // Potrebbe essere GM8 o precedente
        return Some(GameMakerInfo {
            version: "8.x o precedente".to_string(),
        });
    }
    
    None
}

/// Rileva Ren'Py con versione
fn detect_renpy_version(game_dir: &Path) -> Option<String> {
    // renpy/common contiene file con versione
    let renpy_dir = game_dir.join("renpy");
    
    if renpy_dir.exists() {
        // Cerca __init__.py per versione
        let init_py = renpy_dir.join("__init__.py");
        if init_py.exists() {
            if let Ok(content) = fs::read_to_string(&init_py) {
                // Cerca: version_tuple = (8, 1, 3, ...)
                // O: version = "8.1.3"
                for line in content.lines() {
                    if line.contains("version_tuple") || line.starts_with("version") {
                        let numbers: String = line.chars()
                            .filter(|c| c.is_numeric() || *c == '.' || *c == ',')
                            .collect();
                        let clean: String = numbers.replace(',', ".").chars()
                            .filter(|c| c.is_numeric() || *c == '.')
                            .take(10)
                            .collect();
                        if clean.len() >= 3 {
                            return Some(clean);
                        }
                    }
                }
            }
        }
        
        // Fallback: versione dal nome cartella in lib/
        let lib_dir = game_dir.join("lib");
        if lib_dir.exists() {
            if let Ok(entries) = fs::read_dir(&lib_dir) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let name = entry.file_name().to_string_lossy().to_string();
                    // lib/python3.9-x86_64, lib/py3-windows-x86_64
                    if name.contains("python3") || name.contains("py3") {
                        return Some("7.x+ (Python 3)".to_string());
                    } else if name.contains("python2") || name.contains("py2") {
                        return Some("6.x (Python 2)".to_string());
                    }
                }
            }
        }
        
        return Some("?.?".to_string());
    }
    
    // Alternativo: lib/python
    if game_dir.join("lib/python").exists() || game_dir.join("lib/pythonlib").exists() {
        return Some("6.x-7.x".to_string());
    }
    
    None
}

// ============================================================================
// NUOVI ENGINE SUPPORTATI
// ============================================================================

#[derive(Clone)]
#[allow(dead_code)]
enum DetectedEngine {
    Unity { version: Option<String> },
    UnrealEngine { version: Option<String>, is_ue5: bool },
    Godot { version: Option<String> },
    RpgMaker { version: String, can_translate: bool },
    GameMaker { version: String },
    RenPy { version: Option<String> },
    Source { version: String },
    CryEngine { version: Option<String> },
    REEngine,
    Frostbite,
    CreationEngine { version: Option<String> },
    IdTech { version: Option<String> },
    Construct { version: String },
    RpgInABox,
    AdventureGameStudio { version: Option<String> },
    Defold,
    Love2D,
    MonoGame { variant: String },
    Unknown,
}

/// Rileva Source Engine (Valve)
fn detect_source_engine(game_dir: &Path) -> Option<String> {
    // Source 1: gameinfo.txt, .vpk files, hl2.exe
    if game_dir.join("gameinfo.txt").exists() {
        // Leggi gameinfo per determinare versione
        if let Ok(content) = fs::read_to_string(game_dir.join("gameinfo.txt")) {
            if content.contains("SteamAppId") {
                // Source 1 game
                return Some("Source 1".to_string());
            }
        }
    }
    
    // Source 2: .vpk più recenti, diverse strutture
    if game_dir.join("game/bin/win64").exists() {
        return Some("Source 2".to_string());
    }
    
    // VPK files sono comuni a entrambi
    if let Ok(entries) = fs::read_dir(game_dir) {
        let has_vpk = entries.filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().ends_with(".vpk"));
        if has_vpk {
            return Some("Source".to_string());
        }
    }
    
    None
}

/// Rileva CryEngine
fn detect_cryengine(game_dir: &Path) -> Option<String> {
    // CryEngine: CrySystem.dll, Engine folder, .pak files specifici
    if game_dir.join("Bin64/CrySystem.dll").exists() ||
       game_dir.join("Bin32/CrySystem.dll").exists() ||
       game_dir.join("CrySystem.dll").exists() {
        
        // Cerca versione in Engine.pak o system.cfg
        let system_cfg = game_dir.join("system.cfg");
        if system_cfg.exists() {
            if let Ok(content) = fs::read_to_string(&system_cfg) {
                if content.contains("sys_game_folder") {
                    // CryEngine 3.x+
                    return Some("3.x+".to_string());
                }
            }
        }
        
        return Some("?.?".to_string());
    }
    
    // Lumberyard (Amazon fork di CryEngine)
    if game_dir.join("Bin64vc141/LumberyardLauncher.exe").exists() ||
       game_dir.join("Bin64vc142/LumberyardLauncher.exe").exists() {
        return Some("Lumberyard".to_string());
    }
    
    None
}

/// Rileva RE Engine (Capcom)
fn is_re_engine(game_dir: &Path) -> bool {
    // RE Engine usa file .pak specifici e struttura cartelle unica
    // Giochi: RE2/3 Remake, RE Village, Monster Hunter Rise, etc.
    
    // Cerca natives folder (tipico RE Engine)
    if game_dir.join("natives").exists() {
        // Verifica che ci siano .pak files nella struttura
        return game_dir.join("re_chunk_000.pak").exists() ||
               fs::read_dir(game_dir).ok()
                   .map(|entries| entries.filter_map(|e| e.ok())
                       .any(|e| e.file_name().to_string_lossy().contains("re_chunk")))
                   .unwrap_or(false);
    }
    
    // Cerca stm files (streaming assets RE Engine)
    if let Ok(entries) = fs::read_dir(game_dir) {
        let has_stm = entries.filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().ends_with(".stm"));
        if has_stm {
            return true;
        }
    }
    
    false
}

/// Rileva Frostbite (EA)
fn is_frostbite_engine(game_dir: &Path) -> bool {
    // Frostbite: .cas/.cat files, Data folder specifico
    // Giochi: Battlefield, FIFA, NFS, etc.
    
    // .cas e .cat sono container Frostbite
    if let Ok(entries) = fs::read_dir(game_dir) {
        let extensions: Vec<String> = entries.filter_map(|e| e.ok())
            .filter_map(|e| e.path().extension().map(|ext| ext.to_string_lossy().to_string()))
            .collect();
        
        let has_cas = extensions.iter().any(|e| e == "cas");
        let has_cat = extensions.iter().any(|e| e == "cat");
        
        if has_cas && has_cat {
            return true;
        }
    }
    
    // Data/Win32 o Data/Win64 con .toc files
    let data_paths = ["Data/Win32", "Data/Win64", "Data"];
    for data_path in &data_paths {
        let path = game_dir.join(data_path);
        if path.exists() {
            if let Ok(entries) = fs::read_dir(&path) {
                let has_toc = entries.filter_map(|e| e.ok())
                    .any(|e| e.file_name().to_string_lossy().ends_with(".toc"));
                if has_toc {
                    return true;
                }
            }
        }
    }
    
    false
}

/// Rileva Creation Engine (Bethesda)
fn detect_creation_engine(game_dir: &Path) -> Option<String> {
    // Creation Engine / Gamebryo: .bsa, .esm, .esp files
    // Giochi: Skyrim, Fallout 4, Starfield
    
    let mut has_bsa = false;
    let mut has_esm = false;
    let mut has_ba2 = false;  // Fallout 4+ usa .ba2
    
    if let Ok(entries) = fs::read_dir(game_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let ext = entry.path().extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            
            match ext.as_str() {
                "bsa" => has_bsa = true,
                "esm" | "esp" => has_esm = true,
                "ba2" => has_ba2 = true,
                _ => {}
            }
        }
    }
    
    // Cerca anche in Data/
    let data_dir = game_dir.join("Data");
    if data_dir.exists() {
        if let Ok(entries) = fs::read_dir(&data_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let ext = entry.path().extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                
                match ext.as_str() {
                    "bsa" => has_bsa = true,
                    "esm" | "esp" => has_esm = true,
                    "ba2" => has_ba2 = true,
                    _ => {}
                }
            }
        }
    }
    
    if has_ba2 {
        return Some("Creation Engine 2 (Fallout 4+)".to_string());
    }
    
    if has_bsa && has_esm {
        // Distingui Gamebryo da Creation
        if game_dir.join("TESV.exe").exists() || game_dir.join("SkyrimSE.exe").exists() {
            return Some("Creation Engine (Skyrim)".to_string());
        }
        if game_dir.join("Fallout4.exe").exists() {
            return Some("Creation Engine (Fallout 4)".to_string());
        }
        if game_dir.join("Starfield.exe").exists() {
            return Some("Creation Engine 2 (Starfield)".to_string());
        }
        // Gamebryo classico (Oblivion, Morrowind, Fallout 3/NV)
        if game_dir.join("Oblivion.exe").exists() {
            return Some("Gamebryo (Oblivion)".to_string());
        }
        if game_dir.join("FalloutNV.exe").exists() {
            return Some("Gamebryo (Fallout NV)".to_string());
        }
        return Some("Gamebryo/Creation".to_string());
    }
    
    if has_esm {
        return Some("Gamebryo-based".to_string());
    }
    
    None
}

/// Rileva id Tech
fn detect_idtech(game_dir: &Path) -> Option<String> {
    // id Tech: .pk3, .pk4, .resources, .index files
    // Giochi: Doom, Quake, Wolfenstein, etc.
    
    // DOOM (2016) e DOOM Eternal usano id Tech 6/7
    if game_dir.join("DOOMx64.exe").exists() || game_dir.join("DOOMEternalx64.exe").exists() {
        if game_dir.join("base").exists() {
            // Cerca .resources files
            let base_dir = game_dir.join("base");
            if let Ok(entries) = fs::read_dir(&base_dir) {
                let has_resources = entries.filter_map(|e| e.ok())
                    .any(|e| e.file_name().to_string_lossy().ends_with(".resources"));
                if has_resources {
                    return Some("id Tech 7".to_string());
                }
            }
        }
    }
    
    // Quake-era: .pk3 files
    if let Ok(entries) = fs::read_dir(game_dir) {
        let has_pk3 = entries.filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().ends_with(".pk3"));
        if has_pk3 {
            return Some("id Tech 3/4".to_string());
        }
    }
    
    // .pk4 files (Doom 3)
    if let Ok(entries) = fs::read_dir(game_dir) {
        let has_pk4 = entries.filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().ends_with(".pk4"));
        if has_pk4 {
            return Some("id Tech 4".to_string());
        }
    }
    
    None
}

/// Rileva Construct 2/3
fn detect_construct(game_dir: &Path) -> Option<String> {
    // Construct: data.js, c2runtime.js, c3runtime.js
    
    if game_dir.join("c3runtime.js").exists() {
        return Some("Construct 3".to_string());
    }
    
    if game_dir.join("c2runtime.js").exists() {
        return Some("Construct 2".to_string());
    }
    
    // NW.js build
    if game_dir.join("package.nw").exists() {
        if let Ok(content) = fs::read_to_string(game_dir.join("package.json")) {
            if content.contains("construct") {
                return Some("Construct".to_string());
            }
        }
    }
    
    None
}

/// Rileva Adventure Game Studio
fn detect_ags(game_dir: &Path) -> Option<String> {
    // AGS: acsetup.cfg, winsetup.exe, .vox files
    
    if game_dir.join("acsetup.cfg").exists() {
        // Leggi config per versione
        if let Ok(content) = fs::read_to_string(game_dir.join("acsetup.cfg")) {
            // Cerca versione nei commenti o settings
            if content.contains("3.6") {
                return Some("3.6.x".to_string());
            } else if content.contains("3.5") {
                return Some("3.5.x".to_string());
            } else if content.contains("3.4") {
                return Some("3.4.x".to_string());
            }
        }
        return Some("3.x".to_string());
    }
    
    // Legacy AGS
    if game_dir.join("audio.vox").exists() || game_dir.join("speech.vox").exists() {
        return Some("2.x-3.x".to_string());
    }
    
    None
}

/// Rileva Defold
fn is_defold(game_dir: &Path) -> bool {
    // Defold: .arcd, .arci files (archive files)
    game_dir.join("game.arcd").exists() ||
    game_dir.join("game.arci").exists() ||
    game_dir.join("game.dmanifest").exists()
}

/// Rileva LÖVE (Love2D)
fn is_love2d(game_dir: &Path) -> bool {
    // LÖVE: .love files o cartella con main.lua e conf.lua
    if game_dir.join("main.lua").exists() && game_dir.join("conf.lua").exists() {
        return true;
    }
    
    // .love embedded
    if let Ok(entries) = fs::read_dir(game_dir) {
        return entries.filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().ends_with(".love"));
    }
    
    false
}

/// Rileva MonoGame/XNA
fn detect_monogame(game_dir: &Path) -> Option<String> {
    // MonoGame: MonoGame.Framework.dll
    // XNA: Microsoft.Xna.Framework.dll
    
    if game_dir.join("MonoGame.Framework.dll").exists() {
        return Some("MonoGame".to_string());
    }
    
    if game_dir.join("Microsoft.Xna.Framework.dll").exists() {
        return Some("XNA".to_string());
    }
    
    // FNA (reimplementazione XNA)
    if game_dir.join("FNA.dll").exists() {
        return Some("FNA".to_string());
    }
    
    None
}

/// Verifica se una cartella contiene un gioco e rileva engine/versione con precisione
#[command]
pub async fn check_game_engine(game_path: String) -> Result<GameEngineCheck, String> {
    let game_dir = Path::new(&game_path);
    
    if !game_dir.exists() {
        return Err("Cartella non trovata".to_string());
    }
    
    // Check BepInEx/XUnity già installati
    let has_bepinex = game_dir.join("BepInEx").exists();
    let has_xunity = game_dir.join("BepInEx/plugins/XUnity.AutoTranslator").exists()
        || game_dir.join("BepInEx/Translation").exists();
    
    let mut alternative_tools: Vec<AlternativeTool> = Vec::new();
    
    // ========== UNITY (priorità alta) ==========
    let unity_player = game_dir.join("UnityPlayer.dll").exists();
    let unity_crash_handler = game_dir.join("UnityCrashHandler64.exe").exists() 
        || game_dir.join("UnityCrashHandler32.exe").exists();
    let mono_dll = game_dir.join("mono.dll").exists() 
        || game_dir.join("mono-2.0-bdwgc.dll").exists()
        || game_dir.join("MonoBleedingEdge").exists();
    let has_data_folder = fs::read_dir(game_dir)
        .map(|entries| entries.filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().ends_with("_Data") && e.path().is_dir()))
        .unwrap_or(false);
    
    let is_unity = unity_player || unity_crash_handler || mono_dll || has_data_folder;
    
    if is_unity {
        // Versione semplice senza funzioni complesse
        let ver_str = "?.?".to_string();
        let is_il2cpp = game_dir.join("GameAssembly.dll").exists();
        let runtime = if is_il2cpp { "IL2CPP" } else { "Mono" };
        let unity_version: Option<String> = None;
        
        return Ok(GameEngineCheck {
            is_unity: true,
            is_unreal: false,
            engine_name: format!("Unity {} ({})", ver_str, runtime),
            engine_version: unity_version,
            can_patch: !is_il2cpp, // IL2CPP è più difficile da patchare
            message: if is_il2cpp {
                "⚠ Unity IL2CPP - XUnity potrebbe non funzionare, prova BepInEx 6".to_string()
            } else {
                "✓ Unity Mono - compatibile con XUnity AutoTranslator".to_string()
            },
            alternative_tools,
            has_bepinex,
            has_xunity,
        });
    }
    
    // ========== UNREAL ENGINE ==========
    let has_ue_binaries = game_dir.join("Engine/Binaries").exists();
    let has_pak = fs::read_dir(game_dir).ok()
        .map(|entries| entries.filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().ends_with(".pak")))
        .unwrap_or(false);
    
    if has_ue_binaries || has_pak {
        let ue_info = detect_unreal_version(game_dir);
        let (ver_str, is_ue5) = ue_info.map(|i| (i.version.unwrap_or("?.?".to_string()), i.is_ue5))
            .unwrap_or(("?.?".to_string(), false));
        
        alternative_tools.push(AlternativeTool {
            name: "UnrealLocres".to_string(),
            url: "https://github.com/akintos/UnrealLocres".to_string(),
            description: "Estrae e modifica file .locres di Unreal Engine".to_string(),
            compatible: true,
        });
        alternative_tools.push(AlternativeTool {
            name: "UAssetGUI".to_string(),
            url: "https://github.com/atenfyr/UAssetGUI".to_string(),
            description: "Editor per file .uasset di Unreal".to_string(),
            compatible: true,
        });
        if is_ue5 {
            alternative_tools.push(AlternativeTool {
                name: "FModel".to_string(),
                url: "https://fmodel.app/".to_string(),
                description: "Visualizzatore avanzato per UE4/UE5 .pak".to_string(),
                compatible: true,
            });
        }
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: true,
            engine_name: format!("Unreal Engine {}", ver_str),
            engine_version: Some(ver_str),
            can_patch: false,
            message: "⚠ Unreal Engine - usa UnrealLocres per file .locres".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== GODOT ==========
    let has_pck = fs::read_dir(game_dir).ok()
        .map(|entries| entries.filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().ends_with(".pck")))
        .unwrap_or(false);
    let has_godot_project = game_dir.join("project.godot").exists();
    
    if has_pck || has_godot_project {
        let godot_version = detect_godot_version(game_dir);
        let ver_str = godot_version.clone().unwrap_or_else(|| "?.?".to_string());
        let is_godot4 = ver_str.starts_with('4');
        
        alternative_tools.push(AlternativeTool {
            name: "Godot RE Tools (gdsdecomp)".to_string(),
            url: "https://github.com/bruvzg/gdsdecomp".to_string(),
            description: "Decompila e modifica progetti Godot 3.x/4.x".to_string(),
            compatible: true,
        });
        if is_godot4 {
            alternative_tools.push(AlternativeTool {
                name: "gdre_tools".to_string(),
                url: "https://github.com/bruvzg/gdsdecomp/releases".to_string(),
                description: "Supporto specifico Godot 4.x".to_string(),
                compatible: true,
            });
        }
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: format!("Godot {}", ver_str),
            engine_version: godot_version,
            can_patch: false,
            message: format!("⚠ Godot {} - usa gdsdecomp per estrarre .pck", ver_str),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== RPG MAKER (tutte le versioni) ==========
    if let Some(rpg_info) = detect_rpgmaker_version(game_dir) {
        alternative_tools.push(AlternativeTool {
            name: "RPG Maker Trans".to_string(),
            url: "https://rpgmakertrans.bitbucket.io/".to_string(),
            description: "Traduzione per RPG Maker XP/VX/Ace".to_string(),
            compatible: !rpg_info.can_translate_directly,
        });
        alternative_tools.push(AlternativeTool {
            name: "MTool".to_string(),
            url: "https://amanatsu.booth.pm/items/1526696".to_string(),
            description: "Traduzione per RPG Maker MV/MZ (JSON)".to_string(),
            compatible: rpg_info.can_translate_directly,
        });
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: format!("RPG Maker {}", rpg_info.version),
            engine_version: Some(rpg_info.version.clone()),
            can_patch: rpg_info.can_translate_directly,
            message: if rpg_info.can_translate_directly {
                format!("✓ RPG Maker {} - file JSON traducibili direttamente", rpg_info.version)
            } else {
                format!("⚠ RPG Maker {} - usa RPG Maker Trans", rpg_info.version)
            },
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== GAMEMAKER ==========
    if let Some(gm_info) = detect_gamemaker_version(game_dir) {
        alternative_tools.push(AlternativeTool {
            name: "UndertaleModTool".to_string(),
            url: "https://github.com/krzys-h/UndertaleModTool".to_string(),
            description: "Editor completo per giochi GameMaker".to_string(),
            compatible: true,
        });
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: format!("GameMaker {}", gm_info.version),
            engine_version: Some(gm_info.version),
            can_patch: false,
            message: "⚠ GameMaker - usa UndertaleModTool per estrarre stringhe".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== REN'PY ==========
    if let Some(renpy_version) = detect_renpy_version(game_dir) {
        alternative_tools.push(AlternativeTool {
            name: "UnRPA".to_string(),
            url: "https://github.com/Lattyware/unrpa".to_string(),
            description: "Estrae file .rpa di Ren'Py".to_string(),
            compatible: true,
        });
        alternative_tools.push(AlternativeTool {
            name: "rpatool".to_string(),
            url: "https://github.com/shizmob/rpatool".to_string(),
            description: "Manipola archivi .rpa".to_string(),
            compatible: true,
        });
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: format!("Ren'Py {}", renpy_version),
            engine_version: Some(renpy_version),
            can_patch: true,
            message: "✓ Ren'Py - file .rpy traducibili direttamente".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== SOURCE ENGINE (Valve) ==========
    if let Some(source_version) = detect_source_engine(game_dir) {
        alternative_tools.push(AlternativeTool {
            name: "GCFScape".to_string(),
            url: "https://nemstools.github.io/pages/GCFScape-Download.html".to_string(),
            description: "Estrae file .vpk e .gcf".to_string(),
            compatible: true,
        });
        alternative_tools.push(AlternativeTool {
            name: "Crowbar".to_string(),
            url: "https://github.com/ZeqMacaw/Crowbar".to_string(),
            description: "Decompila modelli e mappe Source".to_string(),
            compatible: true,
        });
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: format!("Source Engine ({})", source_version),
            engine_version: Some(source_version),
            can_patch: false,
            message: "⚠ Source Engine - estrai .vpk con GCFScape".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== CRYENGINE ==========
    if let Some(cry_version) = detect_cryengine(game_dir) {
        alternative_tools.push(AlternativeTool {
            name: "CryEngine PAK Tools".to_string(),
            url: "https://github.com/topics/cryengine".to_string(),
            description: "Strumenti per file .pak CryEngine".to_string(),
            compatible: true,
        });
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: format!("CryEngine {}", cry_version),
            engine_version: Some(cry_version),
            can_patch: false,
            message: "⚠ CryEngine - richiede tool specifici per .pak".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== RE ENGINE (Capcom) ==========
    if is_re_engine(game_dir) {
        alternative_tools.push(AlternativeTool {
            name: "REtool".to_string(),
            url: "https://residentevilmodding.boards.net/thread/10567/retool".to_string(),
            description: "Estrae file RE Engine .pak".to_string(),
            compatible: true,
        });
        alternative_tools.push(AlternativeTool {
            name: "Fluffy Manager 5000".to_string(),
            url: "https://www.nexusmods.com/monsterhunterrise/mods/1".to_string(),
            description: "Mod manager per giochi RE Engine".to_string(),
            compatible: true,
        });
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: "RE Engine (Capcom)".to_string(),
            engine_version: Some("RE".to_string()),
            can_patch: false,
            message: "⚠ RE Engine - usa REtool per estrarre assets".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== FROSTBITE (EA) ==========
    if is_frostbite_engine(game_dir) {
        alternative_tools.push(AlternativeTool {
            name: "Frosty Editor".to_string(),
            url: "https://github.com/CadeEvs/FrostyToolsuite".to_string(),
            description: "Editor completo per Frostbite".to_string(),
            compatible: true,
        });
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: "Frostbite (EA)".to_string(),
            engine_version: Some("Frostbite".to_string()),
            can_patch: false,
            message: "⚠ Frostbite - usa Frosty Editor per modifiche".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== CREATION ENGINE (Bethesda) ==========
    if let Some(creation_version) = detect_creation_engine(game_dir) {
        alternative_tools.push(AlternativeTool {
            name: "xTranslator".to_string(),
            url: "https://www.nexusmods.com/skyrimspecialedition/mods/134".to_string(),
            description: "Traduzione plugin ESP/ESM Bethesda".to_string(),
            compatible: true,
        });
        alternative_tools.push(AlternativeTool {
            name: "BSA Browser".to_string(),
            url: "https://www.nexusmods.com/skyrimspecialedition/mods/1756".to_string(),
            description: "Estrae archivi .bsa/.ba2".to_string(),
            compatible: true,
        });
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: creation_version.clone(),
            engine_version: Some(creation_version),
            can_patch: true,
            message: "✓ Creation Engine - usa xTranslator per tradurre ESP/ESM".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== ID TECH ==========
    if let Some(idtech_version) = detect_idtech(game_dir) {
        alternative_tools.push(AlternativeTool {
            name: "DOOM Eternal Mod Loader".to_string(),
            url: "https://github.com/dcealopez/EternalModLoader".to_string(),
            description: "Mod loader per DOOM Eternal".to_string(),
            compatible: idtech_version.contains("7"),
        });
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: format!("id Tech ({})", idtech_version),
            engine_version: Some(idtech_version),
            can_patch: false,
            message: "⚠ id Tech - richiede tool specifici per .resources".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== CONSTRUCT 2/3 ==========
    if let Some(construct_version) = detect_construct(game_dir) {
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: construct_version.clone(),
            engine_version: Some(construct_version),
            can_patch: true,
            message: "✓ Construct - file JSON/JS modificabili direttamente".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== ADVENTURE GAME STUDIO ==========
    if let Some(ags_version) = detect_ags(game_dir) {
        alternative_tools.push(AlternativeTool {
            name: "AGS Editor".to_string(),
            url: "https://www.adventuregamestudio.co.uk/".to_string(),
            description: "Editor ufficiale AGS".to_string(),
            compatible: true,
        });
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: format!("Adventure Game Studio {}", ags_version),
            engine_version: Some(ags_version),
            can_patch: false,
            message: "⚠ AGS - richiede AGS Editor per traduzioni".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== MONOGAME/XNA/FNA ==========
    if let Some(mono_variant) = detect_monogame(game_dir) {
        alternative_tools.push(AlternativeTool {
            name: "dnSpy".to_string(),
            url: "https://github.com/dnSpy/dnSpy".to_string(),
            description: "Decompilatore .NET per modificare assembly".to_string(),
            compatible: true,
        });
        
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: mono_variant.clone(),
            engine_version: Some(mono_variant),
            can_patch: false,
            message: "⚠ MonoGame/XNA - usa dnSpy per modificare assembly .NET".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== DEFOLD ==========
    if is_defold(game_dir) {
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: "Defold".to_string(),
            engine_version: Some("Defold".to_string()),
            can_patch: false,
            message: "⚠ Defold - richiede tool specifici per .arcd/.arci".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== LÖVE (Love2D) ==========
    if is_love2d(game_dir) {
        return Ok(GameEngineCheck {
            is_unity: false,
            is_unreal: false,
            engine_name: "LÖVE (Love2D)".to_string(),
            engine_version: Some("Love2D".to_string()),
            can_patch: true,
            message: "✓ LÖVE - file .lua modificabili direttamente".to_string(),
            alternative_tools,
            has_bepinex: false,
            has_xunity: false,
        });
    }
    
    // ========== SCONOSCIUTO ==========
    Ok(GameEngineCheck {
        is_unity: false,
        is_unreal: false,
        engine_name: "Sconosciuto".to_string(),
        engine_version: None,
        can_patch: false,
        message: "⚠ Motore non riconosciuto - cerca file di testo/JSON manualmente".to_string(),
        alternative_tools,
        has_bepinex: false,
        has_xunity: false,
    })
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct LocalizationFile {
    pub path: String,
    pub filename: String,
    pub language_code: String,
    pub language_name: String,
    pub size_bytes: u64,
    pub format: String, // "json", "txt", "xml", "csv"
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct LocalizationInfo {
    pub has_localization: bool,
    pub localization_folder: Option<String>,
    pub source_file: Option<LocalizationFile>,
    pub available_languages: Vec<LocalizationFile>,
    pub missing_italian: bool,
    pub can_add_language: bool,
    pub format: String,
    pub message: String,
}

/// Mappa codici lingua a nomi leggibili
fn language_code_to_name(code: &str) -> String {
    match code.to_lowercase().as_str() {
        "en" | "en-us" | "en_us" | "english" => "English".to_string(),
        "it" | "it-it" | "it_it" | "italian" => "Italiano".to_string(),
        "de" | "de-de" | "de_de" | "german" => "Deutsch".to_string(),
        "fr" | "fr-fr" | "fr_fr" | "french" => "Français".to_string(),
        "es" | "es-es" | "es_es" | "spanish" => "Español".to_string(),
        "pt" | "pt-br" | "pt_br" | "portuguese" => "Português".to_string(),
        "ru" | "ru-ru" | "ru_ru" | "russian" => "Русский".to_string(),
        "zh" | "zh-cn" | "zh_cn" | "chinese" => "中文".to_string(),
        "ja" | "jp" | "jp-jp" | "ja-jp" | "japanese" => "日本語".to_string(),
        "ko" | "ko-ko" | "ko-kr" | "korean" => "한국어".to_string(),
        "pl" | "pl-pl" | "polish" => "Polski".to_string(),
        "tr" | "tr-tr" | "turkish" => "Türkçe".to_string(),
        _ => code.to_string(),
    }
}

/// Estrae il codice lingua dal nome file
fn extract_language_code(filename: &str) -> Option<String> {
    let name = filename.to_lowercase();
    let stem = name.trim_end_matches(".txt")
        .trim_end_matches(".json")
        .trim_end_matches(".xml")
        .trim_end_matches(".csv")
        .trim_end_matches(".lang");
    
    // Pattern comuni: en-US.txt, english.txt, lang_en.txt
    if stem.contains('-') || stem.contains('_') {
        Some(stem.to_string())
    } else if stem.len() == 2 || stem.len() == 5 {
        Some(stem.to_string())
    } else {
        // Nomi completi come "english", "italian"
        match stem {
            "english" => Some("en-US".to_string()),
            "italian" => Some("it-IT".to_string()),
            "german" => Some("de-DE".to_string()),
            "french" => Some("fr-FR".to_string()),
            "spanish" => Some("es-ES".to_string()),
            "portuguese" => Some("pt-BR".to_string()),
            "russian" => Some("ru-RU".to_string()),
            "chinese" => Some("zh-CN".to_string()),
            "japanese" => Some("ja-JP".to_string()),
            "korean" => Some("ko-KR".to_string()),
            "polish" => Some("pl-PL".to_string()),
            _ => None,
        }
    }
}

/// Rileva file di localizzazione nel gioco
#[command]
pub async fn detect_localization_files(game_path: String) -> Result<LocalizationInfo, String> {
    let game_dir = Path::new(&game_path);
    
    if !game_dir.exists() {
        return Err("Cartella non trovata".to_string());
    }
    
    // Pattern comuni per cartelle di localizzazione
    let loc_patterns = [
        "Languages", "Language", "Localization", "Localisation", "Loc",
        "Lang", "Translations", "Text", "Strings", "I18n",
        "StreamingAssets/Languages", "StreamingAssets/Localization",
        "*_Data/StreamingAssets/Languages", "*_Data/StreamingAssets/Localization",
    ];
    
    let mut localization_folder: Option<String> = None;
    let mut available_languages: Vec<LocalizationFile> = Vec::new();
    let mut detected_format = "unknown".to_string();
    
    // Cerca cartelle di localizzazione
    for pattern in &loc_patterns {
        if pattern.contains('*') {
            // Cerca con wildcard (es. *_Data)
            if let Ok(entries) = fs::read_dir(game_dir) {
                for entry in entries.filter_map(|e| e.ok()) {
                    if entry.file_name().to_string_lossy().ends_with("_Data") {
                        let sub_path = pattern.replace("*_Data", &entry.file_name().to_string_lossy());
                        let full_path = game_dir.join(&sub_path);
                        if full_path.exists() && full_path.is_dir() {
                            localization_folder = Some(full_path.to_string_lossy().to_string());
                            break;
                        }
                    }
                }
            }
        } else {
            let loc_path = game_dir.join(pattern);
            if loc_path.exists() && loc_path.is_dir() {
                localization_folder = Some(loc_path.to_string_lossy().to_string());
                break;
            }
        }
        if localization_folder.is_some() {
            break;
        }
    }
    
    // Se trovata, leggi i file
    if let Some(ref folder) = localization_folder {
        let folder_path = Path::new(folder);
        if let Ok(entries) = fs::read_dir(folder_path) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() {
                    let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                    let ext = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
                    
                    if ["txt", "json", "xml", "csv", "lang"].contains(&ext.as_str()) {
                        if let Some(lang_code) = extract_language_code(&filename) {
                            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            
                            detected_format = ext.clone();
                            
                            available_languages.push(LocalizationFile {
                                path: path.to_string_lossy().to_string(),
                                filename: filename.clone(),
                                language_code: lang_code.clone(),
                                language_name: language_code_to_name(&lang_code),
                                size_bytes: size,
                                format: ext,
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Ordina per nome lingua
    available_languages.sort_by(|a, b| a.language_name.cmp(&b.language_name));
    
    // Controlla se manca italiano
    let has_italian = available_languages.iter()
        .any(|l| l.language_code.to_lowercase().contains("it"));
    
    // Trova file sorgente (preferibilmente inglese)
    let source_file = available_languages.iter()
        .find(|l| l.language_code.to_lowercase().contains("en"))
        .or_else(|| available_languages.first())
        .cloned();
    
    let has_loc = !available_languages.is_empty();
    
    let message = if has_loc {
        if has_italian {
            format!("✓ {} lingue disponibili (italiano presente)", available_languages.len())
        } else {
            format!("⚠ {} lingue disponibili - ITALIANO MANCANTE!", available_languages.len())
        }
    } else {
        "✗ Nessun file di localizzazione trovato".to_string()
    };
    
    Ok(LocalizationInfo {
        has_localization: has_loc,
        localization_folder,
        source_file,
        available_languages,
        missing_italian: !has_italian && has_loc,
        can_add_language: has_loc,
        format: detected_format,
        message,
    })
}

/// Applica un file di traduzione al gioco
#[command]
pub async fn apply_translation_file(
    game_path: String,
    source_content: String,
    target_language: String,
) -> Result<String, String> {
    let _game_dir = Path::new(&game_path);
    
    // Prima rileva dove mettere il file
    let loc_info = detect_localization_files(game_path.clone()).await?;
    
    let folder = loc_info.localization_folder
        .ok_or("Cartella localizzazione non trovata")?;
    
    // Determina il nome file basandosi sul pattern esistente
    let target_filename = if let Some(ref source) = loc_info.source_file {
        // Usa lo stesso pattern del file sorgente
        let source_name = &source.filename;
        if source_name.contains("en-US") {
            source_name.replace("en-US", &format!("{}-{}", &target_language[..2], target_language[..2].to_uppercase()))
        } else if source_name.contains("en_US") {
            source_name.replace("en_US", &format!("{}_{}", &target_language[..2], target_language[..2].to_uppercase()))
        } else if source_name.to_lowercase().contains("english") {
            source_name.to_lowercase().replace("english", &target_language)
        } else {
            format!("{}.{}", target_language, loc_info.format)
        }
    } else {
        format!("{}.{}", target_language, loc_info.format)
    };
    
    let target_path = Path::new(&folder).join(&target_filename);
    
    // Scrivi il file
    fs::write(&target_path, &source_content)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    Ok(target_path.to_string_lossy().to_string())
}

/// Installa XUnity usando IPA per Unity 5.0-5.5 (molto vecchie)
async fn install_with_ipa(game_dir: &Path, exe_path: &Path, target_lang: &str, mut steps: Vec<String>) -> Result<PatchStatus, String> {
    steps.push("⚠ Unity vecchia rilevata (5.0-5.5) - usando IPA".to_string());
    
    // 1. Scarica e estrai IPA
    steps.push("Download IPA (Illusion Plugin Architecture)...".to_string());
    match download_and_extract(IPA_URL, game_dir).await {
        Ok(_) => steps.push("✓ IPA estratto".to_string()),
        Err(e) => return Err(format!("Errore download IPA: {}", e)),
    }
    
    // 2. Esegui IPA.exe per patchare il gioco
    let ipa_exe = game_dir.join("IPA.exe");
    if !ipa_exe.exists() {
        return Err("IPA.exe non trovato dopo estrazione".to_string());
    }
    
    steps.push("Patching gioco con IPA...".to_string());
    let exe_name = exe_path.file_name().unwrap_or_default().to_string_lossy().to_string();
    
    // Esegui IPA.exe con l'eseguibile del gioco
    let output = std::process::Command::new(&ipa_exe)
        .arg(&exe_name)
        .arg("--nowait")
        .current_dir(game_dir)
        .output();
    
    match output {
        Ok(out) => {
            if out.status.success() {
                steps.push("✓ Gioco patchato con IPA".to_string());
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr);
                steps.push(format!("⚠ IPA warning: {}", stderr));
            }
        }
        Err(e) => {
            return Err(format!("Errore esecuzione IPA: {}", e));
        }
    }
    
    // 3. Scarica XUnity versione IPA
    steps.push("Download XUnity.AutoTranslator (IPA)...".to_string());
    match download_and_extract(XUNITY_IPA_URL, game_dir).await {
        Ok(_) => steps.push("✓ XUnity.AutoTranslator installato".to_string()),
        Err(e) => return Err(format!("Errore installazione XUnity: {}", e)),
    }
    
    // 4. Configurazione
    let plugins_dir = game_dir.join("Plugins");
    fs::create_dir_all(&plugins_dir).ok();
    
    // Crea config per XUnity IPA
    let config_content = format!(r#"[Service]
Endpoint=GoogleTranslateV2
FallbackEndpoint=

[General]
Language={}
FromLanguage=ja

[Behaviour]
MaxCharactersPerTranslation=200
EnableBatching=true
"#, target_lang);
    
    let config_path = plugins_dir.join("XUnity.AutoTranslator").join("Config.ini");
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).ok();
    }
    fs::write(&config_path, config_content).ok();
    steps.push(format!("✓ Configurato per lingua: {}", target_lang));
    
    Ok(PatchStatus {
        success: true,
        message: "Patch IPA installata! Avvia il gioco per completare il setup.".to_string(),
        steps_completed: steps,
    })
}

#[command]
pub async fn install_unity_autotranslator(game_path: String, game_exe_name: String, target_lang: Option<String>, translation_mode: Option<String>) -> Result<PatchStatus, String> {
    let lang = target_lang.unwrap_or_else(|| "it".to_string());
    let mode = translation_mode.unwrap_or_else(|| "capture".to_string());
    let mut steps = Vec::new();
    let game_dir = Path::new(&game_path);
    
    if !game_dir.exists() {
        return Err("Cartella del gioco non trovata".to_string());
    }

    let exe_path = game_dir.join(&game_exe_name);
    
    // Verifica che l'eseguibile esista
    if !exe_path.exists() {
        return Err(format!("Eseguibile del gioco '{}' non trovato nella cartella specificata", game_exe_name));
    }

    // Verifica che sia effettivamente un gioco Unity
    // Cerca UnityPlayer.dll (Windows) - file OBBLIGATORIO per giochi Unity
    let unity_player = game_dir.join("UnityPlayer.dll");
    let unity_crash_handler = game_dir.join("UnityCrashHandler64.exe");
    let mono_dll = game_dir.join("mono.dll");
    let data_folder_exists = game_dir.join(format!("{}_Data", game_exe_name.replace(".exe", ""))).exists();
    
    let is_unity = unity_player.exists() || unity_crash_handler.exists() || mono_dll.exists() || data_folder_exists;
    
    if !is_unity {
        // Controlla se è Unreal Engine
        let is_unreal = game_dir.join("Engine").exists() 
            || game_dir.join("UE4Game.exe").exists()
            || game_dir.join(format!("{}", game_exe_name.replace(".exe", ""))).join("Binaries").exists();
        
        if is_unreal {
            return Err("Questo gioco usa Unreal Engine, non Unity. BepInEx funziona solo con giochi Unity!".to_string());
        }
        
        return Err("Questo non sembra essere un gioco Unity. BepInEx richiede UnityPlayer.dll o una cartella *_Data.".to_string());
    }
    
    // Rileva se è IL2CPP (GameAssembly.dll presente)
    let is_il2cpp = game_dir.join("GameAssembly.dll").exists();
    let runtime_str = if is_il2cpp { "IL2CPP" } else { "Mono" };
    steps.push(format!("✓ Gioco Unity ({}) rilevato", runtime_str));

    // Rileva architettura dell'eseguibile (x64 o x86)
    let is_64bit = detect_exe_architecture(&exe_path).unwrap_or(true); // Default x64 se fallisce
    let arch_str = if is_64bit { "x64 (64-bit)" } else { "x86 (32-bit)" };
    steps.push(format!("✓ Architettura rilevata: {}", arch_str));

    // Rileva versione Unity per scegliere BepInEx appropriato
    let unity_version = detect_unity_version(game_dir);
    
    // Se è IL2CPP, usa BepInEx 6 IL2CPP
    if is_il2cpp {
        steps.push("⚡ Usando BepInEx 6 per IL2CPP...".to_string());
        return install_il2cpp_patch(game_dir, &lang, &mode, is_64bit, steps).await;
    }
    
    // Unity 5.6+ può usare BepInEx Legacy
    let use_legacy = unity_version.as_ref()
        .map(|v| v.starts_with("5.6") || v.starts_with("5.7") || v.starts_with("5.8") || v.starts_with("5.9"))
        .unwrap_or(false);
    
    // Unity 5.0-5.5 e 4.x richiedono IPA (BepInEx non funziona)
    let use_ipa = unity_version.as_ref()
        .map(|v| {
            v.starts_with("4.") || 
            v.starts_with("5.0") || v.starts_with("5.1") || v.starts_with("5.2") || 
            v.starts_with("5.3") || v.starts_with("5.4") || v.starts_with("5.5")
        })
        .unwrap_or(false);
    
    // Se usa IPA, flusso diverso
    if use_ipa {
        return install_with_ipa(game_dir, &exe_path, &lang, steps).await;
    }
    
    // Mono: usa BepInEx 5.x
    let (bepinex_url, xunity_url, bepinex_version) = if use_legacy {
        // Unity 5.6+ usa BepInEx Legacy 5.4.11
        let url = if is_64bit { BEPINEX_LEGACY_X64_URL } else { BEPINEX_LEGACY_X86_URL };
        (url, XUNITY_URL, "5.4.11 (Legacy)")
    } else {
        let url = if is_64bit { BEPINEX5_X64_URL } else { BEPINEX5_X86_URL };
        (url, XUNITY_URL, "5.4.23")
    };
    
    if let Some(ref ver) = unity_version {
        steps.push(format!("✓ Unity {} rilevato", ver));
    }
    steps.push(format!("✓ Usando BepInEx {}", bepinex_version));

    // 1. Scarica e Installa BepInEx
    steps.push(format!("Download BepInEx {} {}...", bepinex_version, arch_str));
    match download_and_extract(bepinex_url, game_dir).await {
        Ok(_) => steps.push("✓ BepInEx installato".to_string()),
        Err(e) => return Err(format!("Errore installazione BepInEx: {}", e)),
    }

    // 2. Scarica e Installa XUnity.AutoTranslator
    steps.push("Download XUnity.AutoTranslator...".to_string());
    match download_and_extract(xunity_url, game_dir).await {
        Ok(_) => steps.push("✓ XUnity.AutoTranslator installato".to_string()),
        Err(e) => return Err(format!("Errore installazione XUnity: {}", e)),
    }

    // 3. Configurazione Iniziale (Creazione cartelle se necessario)
    // Nota: La configurazione vera e propria viene generata al primo avvio del gioco da BepInEx
    // Ma possiamo pre-creare la cartella config per iniettare le nostre preferenze
    let config_dir = game_dir.join("BepInEx").join("config");
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    let auto_translator_config = config_dir.join("AutoTranslatorConfig.ini");
    
    // Configura endpoint in base alla modalità scelta
    let (endpoint, mode_desc) = match mode.as_str() {
        "google" => ("GoogleTranslateV2", "Google Translate (automatico)"),
        "deepl" => ("DeepLTranslate", "DeepL (richiede API key)"),
        _ => ("", "Solo cattura (traduci manualmente)"), // capture = nessun endpoint
    };
    
    // Config ottimizzato per velocità massima
    let config_content = format!(r#"[General]
Language={}
FromLanguage=en

[Service]
Endpoint={}
FallbackEndpoint=

[Behaviour]
MaxCharactersPerTranslation=500
IgnoreWhitespaceInDialogue=true
MinDelayBetweenEndpointCalls=0.05
MaxDelayBetweenEndpointCalls=0.1
EnableBatching=true
MaxBatchSize=50
TrimAllText=true
UseStaticTranslations=true
OverrideFont=

[TextFrameworks]
EnableUGUI=true
EnableTextMeshPro=true
EnableNGUI=true
EnableIMGUI=true

[Texture]
TextureDirectory=Translation\Textures
EnableTextureTranslation=false
EnableTextureDumping=false

[Debug]
EnablePrintHierarchy=false
EnableConsole=false

[Files]
OutputFile=Translation\_AutoGeneratedTranslations.txt
Directory=Translation
EnableTextAssetRedirector=true
"#, lang, endpoint);
    fs::write(&auto_translator_config, config_content).map_err(|e| e.to_string())?;
    steps.push(format!("✓ Configurazione: lingua={}, modalità={}", lang, mode_desc));

    Ok(PatchStatus {
        success: true,
        message: "Patch Unity installata con successo! Avvia il gioco per completare il setup.".to_string(),
        steps_completed: steps,
    })
}

/// Installa BepInEx 6 IL2CPP + XUnity per giochi Unity IL2CPP
async fn install_il2cpp_patch(game_dir: &Path, lang: &str, mode: &str, is_64bit: bool, mut steps: Vec<String>) -> Result<PatchStatus, String> {
    // Verifica versione Unity - Unity 6 (6000.x) non è supportato
    let unity_version = detect_unity_version(game_dir);
    if let Some(ref ver) = unity_version {
        if ver.starts_with("6000") || ver.starts_with("6.") {
            return Err(format!(
                "Unity {} non è ancora supportato da BepInEx IL2CPP. \
                La versione di metadata IL2CPP è troppo nuova. \
                Usa OCR Translator come alternativa per tradurre questo gioco.", ver
            ));
        }
        steps.push(format!("✓ Unity {} rilevato", ver));
    }
    
    // 1. Scarica BepInEx 6 IL2CPP
    let bepinex_url = if is_64bit { BEPINEX6_IL2CPP_X64_URL } else { BEPINEX6_IL2CPP_X86_URL };
    let arch_str = if is_64bit { "x64" } else { "x86" };
    
    steps.push(format!("Download BepInEx 6 IL2CPP {}...", arch_str));
    match download_and_extract(bepinex_url, game_dir).await {
        Ok(_) => steps.push("✓ BepInEx 6 IL2CPP installato".to_string()),
        Err(e) => return Err(format!("Errore installazione BepInEx 6 IL2CPP: {}", e)),
    }

    // 2. Scarica XUnity IL2CPP
    steps.push("Download XUnity.AutoTranslator IL2CPP...".to_string());
    match download_and_extract(XUNITY_IL2CPP_URL, game_dir).await {
        Ok(_) => steps.push("✓ XUnity.AutoTranslator IL2CPP installato".to_string()),
        Err(e) => {
            // Fallback: prova versione standard (potrebbe funzionare con alcuni giochi)
            steps.push(format!("⚠ XUnity IL2CPP non disponibile ({}), provo versione standard...", e));
            match download_and_extract(XUNITY_URL, game_dir).await {
                Ok(_) => steps.push("✓ XUnity.AutoTranslator (standard) installato".to_string()),
                Err(e2) => return Err(format!("Errore installazione XUnity: {}", e2)),
            }
        }
    }

    // 3. Configurazione
    let config_dir = game_dir.join("BepInEx").join("config");
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    let auto_translator_config = config_dir.join("AutoTranslatorConfig.ini");
    
    let (endpoint, mode_desc) = match mode {
        "google" => ("GoogleTranslateV2", "Google Translate (automatico)"),
        "deepl" => ("DeepLTranslate", "DeepL (richiede API key)"),
        _ => ("", "Solo cattura (traduci manualmente)"),
    };
    
    let config_content = format!(r#"[General]
Language={}
FromLanguage=en

[Service]
Endpoint={}
FallbackEndpoint=

[Behaviour]
MaxCharactersPerTranslation=500
IgnoreWhitespaceInDialogue=true
MinDelayBetweenEndpointCalls=0.05
MaxDelayBetweenEndpointCalls=0.1
EnableBatching=true
MaxBatchSize=50
TrimAllText=true
UseStaticTranslations=true

[TextFrameworks]
EnableUGUI=true
EnableTextMeshPro=true
EnableNGUI=true
EnableIMGUI=true

[Debug]
EnablePrintHierarchy=false
EnableConsole=false

[Files]
OutputFile=Translation\_AutoGeneratedTranslations.txt
Directory=Translation
EnableTextAssetRedirector=true
"#, lang, endpoint);

    fs::write(&auto_translator_config, config_content).map_err(|e| e.to_string())?;
    steps.push(format!("✓ Configurazione IL2CPP: lingua={}, modalità={}", lang, mode_desc));
    
    steps.push("⚠ NOTA: Il primo avvio potrebbe richiedere alcuni minuti per generare i file IL2CPP".to_string());

    Ok(PatchStatus {
        success: true,
        message: "Patch Unity IL2CPP installata! Il primo avvio richiederà alcuni minuti.".to_string(),
        steps_completed: steps,
    })
}

async fn download_and_extract(url: &str, target_dir: &Path) -> Result<(), String> {
    let client = Client::new();
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("Download fallito: {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = target_dir.join(file.mangled_name());

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(&p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TranslationEntry {
    pub original: String,
    pub translated: String,
    pub line_number: usize,
}

/// Legge le traduzioni XUnity da un gioco
#[command]
pub async fn read_xunity_translations(game_path: String) -> Result<Vec<TranslationEntry>, String> {
    let translations_file = Path::new(&game_path)
        .join("BepInEx")
        .join("Translation")
        .join("_AutoGeneratedTranslations.txt");
    
    if !translations_file.exists() {
        return Err("File traduzioni non trovato. Avvia il gioco per generare le traduzioni.".to_string());
    }
    
    let content = fs::read_to_string(&translations_file)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let mut entries = Vec::new();
    for (i, line) in content.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with(';') {
            continue;
        }
        
        if let Some(pos) = line.find('=') {
            let original = line[..pos].to_string();
            let translated = line[pos + 1..].to_string();
            entries.push(TranslationEntry {
                original,
                translated,
                line_number: i + 1,
            });
        }
    }
    
    Ok(entries)
}

/// Salva una traduzione modificata
#[command]
pub async fn save_xunity_translation(game_path: String, original: String, new_translation: String) -> Result<(), String> {
    let translations_file = Path::new(&game_path)
        .join("BepInEx")
        .join("Translation")
        .join("_AutoGeneratedTranslations.txt");
    
    if !translations_file.exists() {
        return Err("File traduzioni non trovato".to_string());
    }
    
    let content = fs::read_to_string(&translations_file)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let mut new_content = String::new();
    let mut found = false;
    
    for line in content.lines() {
        if line.starts_with(&format!("{}=", original)) {
            new_content.push_str(&format!("{}={}\n", original, new_translation));
            found = true;
        } else {
            new_content.push_str(line);
            new_content.push('\n');
        }
    }
    
    if !found {
        return Err("Stringa originale non trovata".to_string());
    }
    
    fs::write(&translations_file, new_content)
        .map_err(|e| format!("Errore salvataggio: {}", e))?;
    
    Ok(())
}

/// Rimuove BepInEx e XUnity da un gioco Unity
#[command]
pub async fn remove_unity_patch(game_path: String) -> Result<PatchStatus, String> {
    let game_dir = Path::new(&game_path);
    let mut steps = Vec::new();
    
    if !game_dir.exists() {
        return Err("Cartella del gioco non trovata".to_string());
    }
    
    // File e cartelle da rimuovere
    let items_to_remove = [
        "BepInEx",           // Cartella principale BepInEx
        "winhttp.dll",       // DLL loader BepInEx
        "doorstop_config.ini", // Config doorstop
        ".doorstop_version", // File versione doorstop
    ];
    
    let mut removed_count = 0;
    
    for item in &items_to_remove {
        let path = game_dir.join(item);
        if path.exists() {
            if path.is_dir() {
                match fs::remove_dir_all(&path) {
                    Ok(_) => {
                        steps.push(format!("✓ Rimossa cartella: {}", item));
                        removed_count += 1;
                    }
                    Err(e) => {
                        steps.push(format!("⚠ Errore rimozione {}: {}", item, e));
                    }
                }
            } else {
                match fs::remove_file(&path) {
                    Ok(_) => {
                        steps.push(format!("✓ Rimosso file: {}", item));
                        removed_count += 1;
                    }
                    Err(e) => {
                        steps.push(format!("⚠ Errore rimozione {}: {}", item, e));
                    }
                }
            }
        }
    }
    
    if removed_count == 0 {
        return Ok(PatchStatus {
            success: true,
            message: "Nessuna patch trovata da rimuovere.".to_string(),
            steps_completed: steps,
        });
    }
    
    Ok(PatchStatus {
        success: true,
        message: format!("Patch rimossa con successo! {} elementi eliminati.", removed_count),
        steps_completed: steps,
    })
}

// ============================================================================
// SISTEMA DI RACCOMANDAZIONE TRADUZIONE
// ============================================================================

/// Metodo di traduzione consigliato
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub enum TranslationMethod {
    /// Traduzione al volo con BepInEx + XUnity (Unity)
    LiveUnity,
    /// Traduzione al volo con OCR Overlay (qualsiasi gioco)
    LiveOCR,
    /// Traduzione diretta dei file di localizzazione
    FileTranslation,
    /// Nessun metodo automatico disponibile
    Manual,
}

/// Raccomandazione completa per la traduzione di un gioco
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TranslationRecommendation {
    /// Metodo principale consigliato
    pub primary_method: String,
    /// Descrizione del metodo
    pub method_description: String,
    /// Affidabilità stimata (0-100)
    pub reliability: u8,
    /// AI consigliata per questo tipo di contenuto
    pub recommended_ai: String,
    /// Motivo della raccomandazione
    pub reason: String,
    /// Metodi alternativi disponibili
    pub alternatives: Vec<AlternativeMethod>,
    /// Se il gioco ha già una patch installata
    pub has_existing_patch: bool,
    /// Se sono stati trovati file di localizzazione
    pub has_localization_files: bool,
    /// Formato dei file di localizzazione (se presenti)
    pub localization_format: Option<String>,
    /// Se manca la traduzione italiana
    pub missing_italian: bool,
    /// Azione consigliata (testo per il bottone)
    pub action_label: String,
    /// Route da aprire per l'azione
    pub action_route: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct AlternativeMethod {
    pub method: String,
    pub description: String,
    pub reliability: u8,
    pub route: String,
}

/// Analizza un gioco e restituisce la raccomandazione di traduzione migliore
#[command]
pub async fn get_translation_recommendation(game_path: String, _game_name: String) -> Result<TranslationRecommendation, String> {
    let game_dir = Path::new(&game_path);
    
    if !game_dir.exists() {
        return Err("Cartella del gioco non trovata".to_string());
    }
    
    // 1. Rileva il motore di gioco
    let engine_check = check_game_engine(game_path.clone()).await?;
    
    // 2. Rileva file di localizzazione
    let loc_info = detect_localization_files(game_path.clone()).await.ok();
    
    let has_loc_files = loc_info.as_ref().map(|l| l.has_localization).unwrap_or(false);
    let loc_format = loc_info.as_ref().and_then(|l| {
        if l.format != "unknown" { Some(l.format.clone()) } else { None }
    });
    let missing_italian = loc_info.as_ref().map(|l| l.missing_italian).unwrap_or(true);
    
    // 3. Determina la raccomandazione basata sull'analisi
    let recommendation = if engine_check.is_unity {
        // Unity: BepInEx + XUnity è il metodo migliore
        if engine_check.has_xunity {
            // Già patchato - suggerisci di usare il gioco o modificare traduzioni
            TranslationRecommendation {
                primary_method: "live_unity".to_string(),
                method_description: "XUnity AutoTranslator già installato".to_string(),
                reliability: 95,
                recommended_ai: "gemini".to_string(),
                reason: "Il gioco ha già XUnity installato. Avvia il gioco per la traduzione automatica.".to_string(),
                alternatives: vec![
                    AlternativeMethod {
                        method: "ocr".to_string(),
                        description: "OCR Translator (overlay esterno)".to_string(),
                        reliability: 70,
                        route: "/ocr-translator".to_string(),
                    },
                ],
                has_existing_patch: true,
                has_localization_files: has_loc_files,
                localization_format: loc_format,
                missing_italian,
                action_label: "▶ Avvia Gioco".to_string(),
                action_route: "action:launch_game".to_string(), // Frontend gestirà l'avvio con l'appId corretto
            }
        } else {
            // Unity senza patch - consiglia installazione XUnity
            TranslationRecommendation {
                primary_method: "live_unity".to_string(),
                method_description: "Traduzione al volo con XUnity AutoTranslator".to_string(),
                reliability: 90,
                recommended_ai: "gemini".to_string(),
                reason: format!("Gioco {} - XUnity intercetta i testi e li traduce in tempo reale.", engine_check.engine_name),
                alternatives: vec![
                    AlternativeMethod {
                        method: "ocr".to_string(),
                        description: "OCR Translator (se XUnity non funziona)".to_string(),
                        reliability: 70,
                        route: "/ocr-translator".to_string(),
                    },
                ],
                has_existing_patch: false,
                has_localization_files: has_loc_files,
                localization_format: loc_format,
                missing_italian,
                action_label: "🔧 Installa XUnity".to_string(),
                action_route: "/unity-patcher".to_string(),
            }
        }
    } else if has_loc_files {
        // Ha file di localizzazione - traduzione diretta dei file
        let format_info = loc_format.clone().unwrap_or_else(|| "file".to_string());
        TranslationRecommendation {
            primary_method: "file_translation".to_string(),
            method_description: format!("Traduzione diretta file {} ", format_info.to_uppercase()),
            reliability: 85,
            recommended_ai: if format_info == "json" { "gemini".to_string() } else { "claude".to_string() },
            reason: format!("Trovati file di localizzazione in formato {}. Puoi tradurli direttamente.", format_info.to_uppercase()),
            alternatives: vec![
                AlternativeMethod {
                    method: "ocr".to_string(),
                    description: "OCR Translator (traduzione al volo)".to_string(),
                    reliability: 70,
                    route: "/ocr-translator".to_string(),
                },
            ],
            has_existing_patch: false,
            has_localization_files: true,
            localization_format: loc_format,
            missing_italian,
            action_label: "📝 Traduci File".to_string(),
            action_route: "/translator/pro".to_string(),
        }
    } else {
        // Nessun file di localizzazione e non Unity - OCR è l'unica opzione
        let engine_info = if engine_check.engine_name != "Sconosciuto" {
            format!(" ({})", engine_check.engine_name)
        } else {
            String::new()
        };
        
        TranslationRecommendation {
            primary_method: "ocr".to_string(),
            method_description: "Traduzione OCR con overlay".to_string(),
            reliability: 65,
            recommended_ai: "gemini".to_string(),
            reason: format!("Nessun file di localizzazione trovato{}. L'OCR cattura il testo dallo schermo.", engine_info),
            alternatives: vec![],
            has_existing_patch: false,
            has_localization_files: false,
            localization_format: None,
            missing_italian: true,
            action_label: "👁 OCR Translator".to_string(),
            action_route: "/ocr-translator".to_string(),
        }
    };
    
    Ok(recommendation)
}
