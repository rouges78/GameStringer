#![allow(dead_code)]

use tauri::command;
use std::path::Path;
#[allow(unused_imports)]
use std::path::PathBuf;
use std::fs::{self, File};
use std::io::Read;
#[allow(unused_imports)]
use std::io::Write;
#[allow(unused_imports)]
use reqwest::Client;

/// Engine types supportati
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub enum GameEngine {
    Unity,
    UnrealEngine,
    Godot,
    RPGMakerMV,
    RPGMakerMZ,
    RPGMakerVXAce,
    RPGMakerXP,
    GameMaker,
    RenPy,
    Kirikiri,
    NScripter,
    Wolf,
    Unknown,
}

impl GameEngine {
    #[allow(dead_code)]
    pub fn name(&self) -> &'static str {
        match self {
            GameEngine::Unity => "Unity",
            GameEngine::UnrealEngine => "Unreal Engine",
            GameEngine::Godot => "Godot",
            GameEngine::RPGMakerMV => "RPG Maker MV",
            GameEngine::RPGMakerMZ => "RPG Maker MZ",
            GameEngine::RPGMakerVXAce => "RPG Maker VX Ace",
            GameEngine::RPGMakerXP => "RPG Maker XP",
            GameEngine::GameMaker => "GameMaker",
            GameEngine::RenPy => "Ren'Py",
            GameEngine::Kirikiri => "Kirikiri",
            GameEngine::NScripter => "NScripter",
            GameEngine::Wolf => "Wolf RPG Editor",
            GameEngine::Unknown => "Unknown",
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct EngineDetectionResult {
    pub engine: GameEngine,
    pub engine_name: String,
    pub version: Option<String>,
    pub can_inject: bool,
    pub injection_method: String,
    pub tools_required: Vec<InjectionTool>,
    pub translatable_files: Vec<TranslatableFile>,
    pub notes: Vec<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct InjectionTool {
    pub name: String,
    pub url: String,
    pub description: String,
    pub auto_install: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TranslatableFile {
    pub path: String,
    pub file_type: String,
    pub description: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct InjectionResult {
    pub success: bool,
    pub message: String,
    pub steps_completed: Vec<String>,
    pub files_modified: Vec<String>,
    pub backup_path: Option<String>,
}

/// Rileva automaticamente l'engine di un gioco
#[command]
pub async fn detect_game_engine(game_path: String) -> Result<EngineDetectionResult, String> {
    let path = Path::new(&game_path);
    
    if !path.exists() {
        return Err("Il percorso del gioco non esiste".to_string());
    }

    // Cerca in ordine di priorità
    
    // 1. Unity - cerca cartella _Data con globalgamemanagers
    if let Some(result) = detect_unity(path) {
        return Ok(result);
    }

    // 2. Unreal Engine - cerca .pak files e Engine folder
    if let Some(result) = detect_unreal(path) {
        return Ok(result);
    }

    // 3. Godot - cerca .pck files o project.godot
    if let Some(result) = detect_godot(path) {
        return Ok(result);
    }

    // 4. RPG Maker MV/MZ - cerca www/data o js folder
    if let Some(result) = detect_rpgmaker_mv_mz(path) {
        return Ok(result);
    }

    // 5. RPG Maker VX Ace / XP - cerca Game.rgss3a o .rxdata
    if let Some(result) = detect_rpgmaker_vx(path) {
        return Ok(result);
    }

    // 6. GameMaker - cerca data.win
    if let Some(result) = detect_gamemaker(path) {
        return Ok(result);
    }

    // 7. Ren'Py - cerca renpy folder o .rpa files
    if let Some(result) = detect_renpy(path) {
        return Ok(result);
    }

    // 8. Kirikiri - cerca .xp3 files
    if let Some(result) = detect_kirikiri(path) {
        return Ok(result);
    }

    // 9. NScripter - cerca nscript.dat
    if let Some(result) = detect_nscripter(path) {
        return Ok(result);
    }

    // 10. Wolf RPG Editor - cerca Data folder con .wolf files
    if let Some(result) = detect_wolf(path) {
        return Ok(result);
    }

    // Engine non riconosciuto
    Ok(EngineDetectionResult {
        engine: GameEngine::Unknown,
        engine_name: "Sconosciuto".to_string(),
        version: None,
        can_inject: false,
        injection_method: "Manuale".to_string(),
        tools_required: vec![],
        translatable_files: vec![],
        notes: vec![
            "Engine non riconosciuto automaticamente".to_string(),
            "Prova a cercare file di testo (.txt, .json, .xml) nella cartella del gioco".to_string(),
        ],
    })
}

fn detect_unity(game_dir: &Path) -> Option<EngineDetectionResult> {
    // Cerca cartella _Data
    let data_folder = fs::read_dir(game_dir).ok()?
        .filter_map(|e| e.ok())
        .find(|e| e.file_name().to_string_lossy().ends_with("_Data"))?;

    let data_path = data_folder.path();
    let ggm_path = data_path.join("globalgamemanagers");
    
    if !ggm_path.exists() && !data_path.join("mainData").exists() {
        return None;
    }

    // Rileva versione
    let version = read_unity_version(&ggm_path);

    Some(EngineDetectionResult {
        engine: GameEngine::Unity,
        engine_name: "Unity".to_string(),
        version,
        can_inject: true,
        injection_method: "BepInEx + XUnity.AutoTranslator".to_string(),
        tools_required: vec![
            InjectionTool {
                name: "BepInEx".to_string(),
                url: "https://github.com/BepInEx/BepInEx".to_string(),
                description: "Framework per mod Unity".to_string(),
                auto_install: true,
            },
            InjectionTool {
                name: "XUnity.AutoTranslator".to_string(),
                url: "https://github.com/bbepis/XUnity.AutoTranslator".to_string(),
                description: "Plugin per traduzione automatica".to_string(),
                auto_install: true,
            },
        ],
        translatable_files: vec![
            TranslatableFile {
                path: "BepInEx/Translation".to_string(),
                file_type: "TXT".to_string(),
                description: "File di traduzione XUnity".to_string(),
            },
        ],
        notes: vec![
            "Usa il Unity Patcher per installazione automatica".to_string(),
        ],
    })
}

fn read_unity_version(ggm_path: &Path) -> Option<String> {
    let mut file = File::open(ggm_path).ok()?;
    let mut buffer = vec![0u8; 4096];
    file.read(&mut buffer).ok()?;
    
    // Cerca pattern versione Unity (es. "2021.3.1f1", "5.6.7f1")
    let content = String::from_utf8_lossy(&buffer);
    let re = regex::Regex::new(r"(\d+\.\d+\.\d+[a-z]\d+)").ok()?;
    re.find(&content).map(|m| m.as_str().to_string())
}

fn detect_unreal(game_dir: &Path) -> Option<EngineDetectionResult> {
    // Cerca .pak files
    let has_pak = fs::read_dir(game_dir).ok()?
        .filter_map(|e| e.ok())
        .any(|e| e.path().extension().map_or(false, |ext| ext == "pak"));

    // Cerca Engine folder o Content folder
    let has_engine = game_dir.join("Engine").exists() 
        || game_dir.join("Content").exists()
        || game_dir.join("Binaries").exists();

    if !has_pak && !has_engine {
        return None;
    }

    // Cerca versione in .pak o manifest
    let version = detect_unreal_version(game_dir);

    Some(EngineDetectionResult {
        engine: GameEngine::UnrealEngine,
        engine_name: "Unreal Engine".to_string(),
        version,
        can_inject: true,
        injection_method: "UnrealLocres / Localization Editor".to_string(),
        tools_required: vec![
            InjectionTool {
                name: "UnrealLocres".to_string(),
                url: "https://github.com/Jerem584/UnrealLocres".to_string(),
                description: "Estrae e modifica testi dai .pak Unreal".to_string(),
                auto_install: false,
            },
            InjectionTool {
                name: "UAssetGUI".to_string(),
                url: "https://github.com/atenfyr/UAssetGUI".to_string(),
                description: "Editor visuale per .uasset".to_string(),
                auto_install: false,
            },
            InjectionTool {
                name: "UnrealPak".to_string(),
                url: "https://github.com/allcoolthingsatoneplace/UnrealPakTool".to_string(),
                description: "Estrae e crea file .pak".to_string(),
                auto_install: false,
            },
        ],
        translatable_files: find_unreal_translatable(game_dir),
        notes: vec![
            "I giochi Unreal usano file .pak criptati".to_string(),
            "Cerca cartella Localization per i testi".to_string(),
            "File .locres contengono le stringhe traducibili".to_string(),
        ],
    })
}

fn detect_unreal_version(game_dir: &Path) -> Option<String> {
    // Cerca nel manifest o nei file .pak
    let manifest = game_dir.join("Manifest.txt");
    if manifest.exists() {
        if let Ok(content) = fs::read_to_string(&manifest) {
            if content.contains("4.") {
                return Some("4.x".to_string());
            } else if content.contains("5.") {
                return Some("5.x".to_string());
            }
        }
    }
    None
}

fn find_unreal_translatable(game_dir: &Path) -> Vec<TranslatableFile> {
    let mut files = vec![];
    
    // Cerca .pak files
    if let Ok(entries) = fs::read_dir(game_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "pak") {
                files.push(TranslatableFile {
                    path: path.file_name().unwrap().to_string_lossy().to_string(),
                    file_type: "PAK".to_string(),
                    description: "Archivio Unreal (richiede estrazione)".to_string(),
                });
            }
        }
    }
    
    files
}

fn detect_godot(game_dir: &Path) -> Option<EngineDetectionResult> {
    // Cerca .pck files o project.godot
    let has_pck = fs::read_dir(game_dir).ok()?
        .filter_map(|e| e.ok())
        .any(|e| e.path().extension().map_or(false, |ext| ext == "pck"));

    let has_project = game_dir.join("project.godot").exists();

    if !has_pck && !has_project {
        return None;
    }

    Some(EngineDetectionResult {
        engine: GameEngine::Godot,
        engine_name: "Godot".to_string(),
        version: None,
        can_inject: true,
        injection_method: "GDScript editing / PCK extraction".to_string(),
        tools_required: vec![
            InjectionTool {
                name: "Godot RE Tools".to_string(),
                url: "https://github.com/bruvzg/gdsdecomp".to_string(),
                description: "Decompila progetti Godot".to_string(),
                auto_install: false,
            },
        ],
        translatable_files: vec![
            TranslatableFile {
                path: "*.pck".to_string(),
                file_type: "PCK".to_string(),
                description: "Archivio Godot (usa gdsdecomp per estrarre)".to_string(),
            },
        ],
        notes: vec![
            "I giochi Godot usano file .pck compressi".to_string(),
            "Usa gdsdecomp per estrarre e modificare".to_string(),
            "I testi sono spesso in file .csv o .tres".to_string(),
        ],
    })
}

fn detect_rpgmaker_mv_mz(game_dir: &Path) -> Option<EngineDetectionResult> {
    // Cerca www/data folder (MV/MZ)
    let www_path = game_dir.join("www");
    let data_path = if www_path.exists() {
        www_path.join("data")
    } else {
        game_dir.join("data")
    };

    let js_path = if www_path.exists() {
        www_path.join("js")
    } else {
        game_dir.join("js")
    };

    if !data_path.exists() || !js_path.exists() {
        return None;
    }

    // Determina se è MV o MZ
    let is_mz = js_path.join("rmmz_core.js").exists();
    let engine = if is_mz { GameEngine::RPGMakerMZ } else { GameEngine::RPGMakerMV };

    let mut translatable = vec![];
    
    // Trova file JSON traducibili
    if let Ok(entries) = fs::read_dir(&data_path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                let filename = path.file_name().unwrap().to_string_lossy().to_string();
                // File con testi traducibili
                if ["Actors.json", "Classes.json", "CommonEvents.json", "Enemies.json",
                    "Items.json", "Map", "Skills.json", "States.json", "System.json",
                    "Troops.json", "Weapons.json", "Armors.json"].iter()
                    .any(|&f| filename.contains(f)) {
                    translatable.push(TranslatableFile {
                        path: format!("data/{}", filename),
                        file_type: "JSON".to_string(),
                        description: "Database RPG Maker".to_string(),
                    });
                }
            }
        }
    }

    Some(EngineDetectionResult {
        engine,
        engine_name: if is_mz { "RPG Maker MZ" } else { "RPG Maker MV" }.to_string(),
        version: None,
        can_inject: true,
        injection_method: "Modifica diretta JSON".to_string(),
        tools_required: vec![
            InjectionTool {
                name: "RPG Maker Trans".to_string(),
                url: "https://rpgmakertrans.bitbucket.io/".to_string(),
                description: "Tool ufficiale per traduzione RPG Maker".to_string(),
                auto_install: false,
            },
        ],
        translatable_files: translatable,
        notes: vec![
            "I file JSON sono modificabili direttamente".to_string(),
            "Fai backup prima di modificare!".to_string(),
            "I dialoghi sono in CommonEvents.json e nei file Map*.json".to_string(),
        ],
    })
}

fn detect_rpgmaker_vx(game_dir: &Path) -> Option<EngineDetectionResult> {
    // Cerca Game.rgss3a (VX Ace) o Game.rgss2a (VX) o Data/*.rxdata (XP)
    let rgss3a = game_dir.join("Game.rgss3a");
    let rgss2a = game_dir.join("Game.rgss2a");
    let data_folder = game_dir.join("Data");

    let (engine, version) = if rgss3a.exists() {
        (GameEngine::RPGMakerVXAce, "VX Ace")
    } else if rgss2a.exists() {
        (GameEngine::RPGMakerVXAce, "VX")
    } else if data_folder.exists() {
        // Cerca .rxdata files (XP)
        let has_rxdata = fs::read_dir(&data_folder).ok()?
            .filter_map(|e| e.ok())
            .any(|e| e.path().extension().map_or(false, |ext| ext == "rxdata"));
        
        if has_rxdata {
            (GameEngine::RPGMakerXP, "XP")
        } else {
            return None;
        }
    } else {
        return None;
    };

    Some(EngineDetectionResult {
        engine,
        engine_name: format!("RPG Maker {}", version),
        version: Some(version.to_string()),
        can_inject: true,
        injection_method: "RPGMaker Trans / RGSS Decryptor".to_string(),
        tools_required: vec![
            InjectionTool {
                name: "RPG Maker Trans".to_string(),
                url: "https://rpgmakertrans.bitbucket.io/".to_string(),
                description: "Estrae e inietta traduzioni".to_string(),
                auto_install: false,
            },
            InjectionTool {
                name: "RGSS Decryptor".to_string(),
                url: "https://github.com/rgss-decryptor".to_string(),
                description: "Decripta archivi RGSS".to_string(),
                auto_install: false,
            },
        ],
        translatable_files: vec![
            TranslatableFile {
                path: format!("Game.rgss{}a", if version == "VX Ace" { "3" } else { "2" }),
                file_type: "RGSS".to_string(),
                description: "Archivio criptato (usa decryptor)".to_string(),
            },
        ],
        notes: vec![
            "Gli archivi RGSS sono criptati".to_string(),
            "Usa RPG Maker Trans per estrazione automatica".to_string(),
        ],
    })
}

fn detect_gamemaker(game_dir: &Path) -> Option<EngineDetectionResult> {
    // Cerca data.win
    let data_win = game_dir.join("data.win");
    
    if !data_win.exists() {
        return None;
    }

    Some(EngineDetectionResult {
        engine: GameEngine::GameMaker,
        engine_name: "GameMaker".to_string(),
        version: None,
        can_inject: true,
        injection_method: "UndertaleModTool".to_string(),
        tools_required: vec![
            InjectionTool {
                name: "UndertaleModTool".to_string(),
                url: "https://github.com/krzys-h/UndertaleModTool".to_string(),
                description: "Editor completo per giochi GameMaker".to_string(),
                auto_install: false,
            },
        ],
        translatable_files: vec![
            TranslatableFile {
                path: "data.win".to_string(),
                file_type: "WIN".to_string(),
                description: "Database GameMaker".to_string(),
            },
        ],
        notes: vec![
            "Usa UndertaleModTool per estrarre e modificare".to_string(),
            "I testi sono nelle stringhe del gioco".to_string(),
            "Funziona con Undertale, Deltarune e altri".to_string(),
        ],
    })
}

fn detect_renpy(game_dir: &Path) -> Option<EngineDetectionResult> {
    // Cerca renpy folder o game folder con .rpy files
    let renpy_folder = game_dir.join("renpy");
    let game_folder = game_dir.join("game");
    
    let has_renpy = renpy_folder.exists();
    let has_rpa = if game_folder.exists() {
        fs::read_dir(&game_folder).ok()?
            .filter_map(|e| e.ok())
            .any(|e| e.path().extension().map_or(false, |ext| ext == "rpa" || ext == "rpy"))
    } else {
        false
    };

    if !has_renpy && !has_rpa {
        return None;
    }

    let mut translatable = vec![];
    
    // Trova file .rpy e .rpa
    if game_folder.exists() {
        if let Ok(entries) = fs::read_dir(&game_folder) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if ext == "rpy" || ext == "rpa" {
                    translatable.push(TranslatableFile {
                        path: format!("game/{}", path.file_name().unwrap().to_string_lossy()),
                        file_type: ext.to_uppercase(),
                        description: if ext == "rpy" { 
                            "Script Ren'Py (modificabile)".to_string() 
                        } else { 
                            "Archivio Ren'Py (da estrarre)".to_string() 
                        },
                    });
                }
            }
        }
    }

    Some(EngineDetectionResult {
        engine: GameEngine::RenPy,
        engine_name: "Ren'Py".to_string(),
        version: None,
        can_inject: true,
        injection_method: "Modifica diretta .rpy o estrazione .rpa".to_string(),
        tools_required: vec![
            InjectionTool {
                name: "UnRPA".to_string(),
                url: "https://github.com/Lattyware/unrpa".to_string(),
                description: "Estrae archivi .rpa".to_string(),
                auto_install: false,
            },
            InjectionTool {
                name: "Ren'Py SDK".to_string(),
                url: "https://www.renpy.org/".to_string(),
                description: "Per compilare script modificati".to_string(),
                auto_install: false,
            },
        ],
        translatable_files: translatable,
        notes: vec![
            "I file .rpy sono script Python modificabili".to_string(),
            "I file .rpa sono archivi (usa unrpa per estrarre)".to_string(),
            "I dialoghi sono nelle stringhe tra virgolette".to_string(),
        ],
    })
}

fn detect_kirikiri(game_dir: &Path) -> Option<EngineDetectionResult> {
    // Cerca .xp3 files
    let has_xp3 = fs::read_dir(game_dir).ok()?
        .filter_map(|e| e.ok())
        .any(|e| e.path().extension().map_or(false, |ext| ext == "xp3"));

    if !has_xp3 {
        return None;
    }

    Some(EngineDetectionResult {
        engine: GameEngine::Kirikiri,
        engine_name: "Kirikiri".to_string(),
        version: None,
        can_inject: true,
        injection_method: "XP3 extraction".to_string(),
        tools_required: vec![
            InjectionTool {
                name: "GARbro".to_string(),
                url: "https://github.com/morkt/GARbro".to_string(),
                description: "Estrae archivi visual novel (XP3, etc)".to_string(),
                auto_install: false,
            },
        ],
        translatable_files: vec![
            TranslatableFile {
                path: "*.xp3".to_string(),
                file_type: "XP3".to_string(),
                description: "Archivio Kirikiri".to_string(),
            },
        ],
        notes: vec![
            "I file .xp3 sono archivi criptati".to_string(),
            "Usa GARbro per estrarre".to_string(),
            "I testi sono in file .ks (KiriKiri Script)".to_string(),
        ],
    })
}

fn detect_nscripter(game_dir: &Path) -> Option<EngineDetectionResult> {
    // Cerca nscript.dat o arc.nsa
    let nscript = game_dir.join("nscript.dat");
    let arc_nsa = game_dir.join("arc.nsa");
    
    if !nscript.exists() && !arc_nsa.exists() {
        return None;
    }

    Some(EngineDetectionResult {
        engine: GameEngine::NScripter,
        engine_name: "NScripter".to_string(),
        version: None,
        can_inject: true,
        injection_method: "NSA extraction".to_string(),
        tools_required: vec![
            InjectionTool {
                name: "NSADec".to_string(),
                url: "https://github.com".to_string(),
                description: "Decripta archivi NSA".to_string(),
                auto_install: false,
            },
        ],
        translatable_files: vec![
            TranslatableFile {
                path: "nscript.dat".to_string(),
                file_type: "DAT".to_string(),
                description: "Script NScripter".to_string(),
            },
        ],
        notes: vec![
            "Engine usato da molte visual novel giapponesi".to_string(),
            "I testi sono in formato proprietario".to_string(),
        ],
    })
}

fn detect_wolf(game_dir: &Path) -> Option<EngineDetectionResult> {
    // Cerca Data folder con file .wolf o Game.dat
    let data_folder = game_dir.join("Data");
    let game_dat = game_dir.join("Game.dat");
    
    let has_wolf = if data_folder.exists() {
        fs::read_dir(&data_folder).ok()?
            .filter_map(|e| e.ok())
            .any(|e| e.path().extension().map_or(false, |ext| ext == "wolf"))
    } else {
        false
    };

    if !has_wolf && !game_dat.exists() {
        return None;
    }

    Some(EngineDetectionResult {
        engine: GameEngine::Wolf,
        engine_name: "Wolf RPG Editor".to_string(),
        version: None,
        can_inject: true,
        injection_method: "Wolf Trans".to_string(),
        tools_required: vec![
            InjectionTool {
                name: "Wolf Trans".to_string(),
                url: "https://github.com".to_string(),
                description: "Tool per traduzione Wolf RPG".to_string(),
                auto_install: false,
            },
        ],
        translatable_files: vec![
            TranslatableFile {
                path: "Data/*.wolf".to_string(),
                file_type: "WOLF".to_string(),
                description: "Database Wolf RPG".to_string(),
            },
        ],
        notes: vec![
            "Engine giapponese per RPG 2D".to_string(),
            "I file .wolf contengono dati criptati".to_string(),
        ],
    })
}

/// Inietta hook di traduzione per l'engine rilevato
#[command]
pub async fn inject_translation_hook(
    game_path: String,
    engine: String,
    create_backup: bool,
) -> Result<InjectionResult, String> {
    let path = Path::new(&game_path);
    let mut steps = vec![];
    let mut files_modified = vec![];
    let mut backup_path = None;

    // Crea backup se richiesto
    if create_backup {
        let backup_dir = path.join("_backup_gamestringer");
        if !backup_dir.exists() {
            fs::create_dir_all(&backup_dir)
                .map_err(|e| format!("Impossibile creare backup: {}", e))?;
            steps.push("Cartella backup creata".to_string());
            backup_path = Some(backup_dir.to_string_lossy().to_string());
        }
    }

    // Logica di injection specifica per engine
    match engine.as_str() {
        "Unity" => {
            // Usa il patcher Unity esistente
            steps.push("Per Unity usa il Unity Patcher dedicato".to_string());
            return Ok(InjectionResult {
                success: true,
                message: "Unity rilevato - usa il Unity Patcher".to_string(),
                steps_completed: steps,
                files_modified,
                backup_path,
            });
        }
        "RPGMakerMV" | "RPGMakerMZ" => {
            // Crea cartella per traduzioni
            let trans_dir = path.join("www").join("languages").join("it");
            if !trans_dir.exists() {
                fs::create_dir_all(&trans_dir)
                    .map_err(|e| format!("Impossibile creare cartella traduzioni: {}", e))?;
                steps.push(format!("Cartella traduzioni creata: {:?}", trans_dir));
            }
            
            // Crea file di configurazione per plugin traduzioni
            let plugin_config = r#"{
  "name": "GameStringerTranslation",
  "status": true,
  "description": "Plugin per traduzioni GameStringer",
  "parameters": {
    "targetLanguage": "it"
  }
}"#;
            let plugin_path = path.join("www").join("js").join("plugins").join("GameStringerTranslation.json");
            fs::write(&plugin_path, plugin_config)
                .map_err(|e| format!("Impossibile scrivere plugin config: {}", e))?;
            steps.push("Plugin configurazione creato".to_string());
            files_modified.push(plugin_path.to_string_lossy().to_string());
        }
        "RenPy" => {
            // Crea cartella tl per traduzioni Ren'Py
            let tl_dir = path.join("game").join("tl").join("italian");
            if !tl_dir.exists() {
                fs::create_dir_all(&tl_dir)
                    .map_err(|e| format!("Impossibile creare cartella traduzioni: {}", e))?;
                steps.push(format!("Cartella traduzioni Ren'Py creata: {:?}", tl_dir));
            }
            
            // Crea file options.rpy per lingua
            let options = r#"# GameStringer Translation Config
define config.language = "italian"
"#;
            let options_path = tl_dir.join("options.rpy");
            fs::write(&options_path, options)
                .map_err(|e| format!("Impossibile scrivere options.rpy: {}", e))?;
            steps.push("Configurazione lingua creata".to_string());
            files_modified.push(options_path.to_string_lossy().to_string());
        }
        "Godot" => {
            steps.push("Godot richiede estrazione manuale del .pck".to_string());
            steps.push("Usa gdsdecomp per estrarre il progetto".to_string());
        }
        "UnrealEngine" => {
            steps.push("Unreal Engine richiede tool esterni".to_string());
            steps.push("Usa UnrealLocres per modificare i .pak".to_string());
        }
        _ => {
            steps.push(format!("Engine {} non supporta injection automatica", engine));
        }
    }

    Ok(InjectionResult {
        success: true,
        message: format!("Injection completata per {}", engine),
        steps_completed: steps,
        files_modified,
        backup_path,
    })
}

/// Lista tutti i file traducibili trovati
#[command]
pub async fn list_translatable_files(game_path: String) -> Result<Vec<TranslatableFile>, String> {
    let path = Path::new(&game_path);
    let mut files = vec![];

    // Cerca ricorsivamente file traducibili
    fn scan_dir(dir: &Path, files: &mut Vec<TranslatableFile>, depth: u32) {
        if depth > 5 {
            return; // Limita profondità
        }
        
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                
                if path.is_dir() {
                    let name = path.file_name().unwrap().to_string_lossy();
                    // Salta cartelle di sistema
                    if !name.starts_with('.') && name != "node_modules" && name != "__pycache__" {
                        scan_dir(&path, files, depth + 1);
                    }
                } else {
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                    let translatable = matches!(ext, 
                        "json" | "txt" | "xml" | "csv" | "yaml" | "yml" | 
                        "rpy" | "ks" | "lua" | "ini" | "cfg" | "lang" | "po" | "pot"
                    );
                    
                    if translatable {
                        files.push(TranslatableFile {
                            path: path.strip_prefix(dir.parent().unwrap_or(dir))
                                .unwrap_or(&path)
                                .to_string_lossy()
                                .to_string(),
                            file_type: ext.to_uppercase(),
                            description: get_file_description(ext),
                        });
                    }
                }
            }
        }
    }

    scan_dir(path, &mut files, 0);
    
    // Limita risultati
    files.truncate(100);
    
    Ok(files)
}

fn get_file_description(ext: &str) -> String {
    match ext {
        "json" => "File JSON (strutturato)".to_string(),
        "txt" => "File di testo".to_string(),
        "xml" => "File XML".to_string(),
        "csv" => "File CSV (tabellare)".to_string(),
        "yaml" | "yml" => "File YAML".to_string(),
        "rpy" => "Script Ren'Py".to_string(),
        "ks" => "Script Kirikiri".to_string(),
        "lua" => "Script Lua".to_string(),
        "ini" | "cfg" => "File configurazione".to_string(),
        "lang" => "File lingua".to_string(),
        "po" | "pot" => "File gettext (traduzioni)".to_string(),
        _ => "File traducibile".to_string(),
    }
}
