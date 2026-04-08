use std::path::Path;

#[derive(Debug, PartialEq, Clone)]
#[allow(dead_code)]
pub enum GameEngine {
    Unity,
    Unreal,
    Godot,
    RPGMaker,
    RenPy,
    GameMaker,
    Source,
    Source2,
    CryEngine,
    Frostbite,
    REDengine,
    Creation,
    IdTech,
    Telltale,
    AdobeAIR,
    Construct,
    Love2D,
    Phaser,
    Kirikiri,
    NScripter,
    Wolf,
    Clausewitz,
    Anvil,
    Decima,
    REEngine,
    FOXEngine,
    IWEngine,
    Snowdrop,
    Cocos2d,
    Defold,
    Haxe,
    MonoGame,
    XNA,
    LibGDX,
    LWJGL,
    Electron,
    NWjs,
    SpikeChunsoft,
    RAGE,
    MTFramework,
    Glacier,
    FromSoft,
    Techland,
    Luminous,
    Void,
    Platinum,
    Visionaire,
    SierraSCI,
    Unknown,
}

impl GameEngine {
    pub fn as_str(&self) -> &'static str {
        match self {
            GameEngine::Unity => "Unity",
            GameEngine::Unreal => "Unreal Engine",
            GameEngine::Godot => "Godot",
            GameEngine::RPGMaker => "RPG Maker",
            GameEngine::RenPy => "Ren'Py",
            GameEngine::GameMaker => "GameMaker",
            GameEngine::Source => "Source Engine",
            GameEngine::Source2 => "Source 2",
            GameEngine::CryEngine => "CryEngine",
            GameEngine::Frostbite => "Frostbite",
            GameEngine::REDengine => "REDengine",
            GameEngine::Creation => "Creation Engine",
            GameEngine::IdTech => "id Tech",
            GameEngine::Telltale => "Telltale Tool",
            GameEngine::AdobeAIR => "Adobe AIR",
            GameEngine::Construct => "Construct",
            GameEngine::Love2D => "LÖVE",
            GameEngine::Phaser => "Phaser",
            GameEngine::Kirikiri => "Kirikiri",
            GameEngine::NScripter => "NScripter",
            GameEngine::Wolf => "Wolf RPG Editor",
            GameEngine::Clausewitz => "Clausewitz",
            GameEngine::Anvil => "Anvil Engine",
            GameEngine::Decima => "Decima",
            GameEngine::REEngine => "RE Engine",
            GameEngine::FOXEngine => "FOX Engine",
            GameEngine::IWEngine => "IW Engine",
            GameEngine::Snowdrop => "Snowdrop",
            GameEngine::Cocos2d => "Cocos2d",
            GameEngine::Defold => "Defold",
            GameEngine::Haxe => "Haxe/OpenFL",
            GameEngine::MonoGame => "MonoGame",
            GameEngine::XNA => "XNA",
            GameEngine::LibGDX => "LibGDX",
            GameEngine::LWJGL => "LWJGL",
            GameEngine::Electron => "Electron",
            GameEngine::NWjs => "NW.js",
            GameEngine::SpikeChunsoft => "Spike Chunsoft Engine",
            GameEngine::RAGE => "RAGE Engine",
            GameEngine::MTFramework => "MT Framework",
            GameEngine::Glacier => "Glacier Engine",
            GameEngine::FromSoft => "FromSoftware Engine",
            GameEngine::Techland => "C-Engine (Techland)",
            GameEngine::Luminous => "Luminous Engine",
            GameEngine::Void => "Void Engine",
            GameEngine::Platinum => "Platinum Engine",
            GameEngine::Visionaire => "Visionaire Studio",
            GameEngine::SierraSCI => "Sierra SCI",
            GameEngine::Unknown => "Unknown",
        }
    }
}

pub fn detect_engine(game_path: &Path) -> GameEngine {
    if !game_path.exists() {
        return GameEngine::Unknown;
    }

    // 1. Unity - molto comune
    if is_unity(game_path) {
        return GameEngine::Unity;
    }
    
    // 1.5. Spike Chunsoft (Danganronpa) - PRIMA di Unreal per evitare falsi positivi con .pak
    if is_spike_chunsoft(game_path) {
        return GameEngine::SpikeChunsoft;
    }
    
    // 2. Unreal Engine
    if is_unreal(game_path) {
        return GameEngine::Unreal;
    }
    
    // 3. Godot
    if is_godot(game_path) {
        return GameEngine::Godot;
    }
    
    // 4. RPG Maker (tutte le versioni)
    if is_rpg_maker(game_path) {
        return GameEngine::RPGMaker;
    }
    
    // 5. Ren'Py
    if is_renpy(game_path) {
        return GameEngine::RenPy;
    }
    
    // 6. GameMaker
    if is_gamemaker(game_path) {
        return GameEngine::GameMaker;
    }
    
    // 6.5. Visionaire Studio
    if is_visionaire(game_path) {
        return GameEngine::Visionaire;
    }

    // 6.6. Sierra SCI (Gabriel Knight, Phantasmagoria, King's Quest, etc.)
    if is_sierra_sci(game_path) {
        return GameEngine::SierraSCI;
    }

    // 7. Source Engine
    if is_source(game_path) {
        return GameEngine::Source;
    }
    
    // 8. CryEngine
    if is_cryengine(game_path) {
        return GameEngine::CryEngine;
    }
    
    // 9. Telltale Tool
    if is_telltale(game_path) {
        return GameEngine::Telltale;
    }
    
    // 10. Adobe AIR
    if is_adobe_air(game_path) {
        return GameEngine::AdobeAIR;
    }
    
    // 11. Construct 2/3
    if is_construct(game_path) {
        return GameEngine::Construct;
    }
    
    // 12. LÖVE (Lua)
    if is_love2d(game_path) {
        return GameEngine::Love2D;
    }
    
    // 13. Kirikiri (Visual Novels)
    if is_kirikiri(game_path) {
        return GameEngine::Kirikiri;
    }
    
    // 14. NScripter
    if is_nscripter(game_path) {
        return GameEngine::NScripter;
    }
    
    // 15. Wolf RPG Editor
    if is_wolf(game_path) {
        return GameEngine::Wolf;
    }
    
    // 16. Clausewitz (Paradox)
    if is_clausewitz(game_path) {
        return GameEngine::Clausewitz;
    }
    
    // 17. Electron/NW.js
    if is_electron(game_path) {
        return GameEngine::Electron;
    }
    
    // 18. Cocos2d
    if is_cocos2d(game_path) {
        return GameEngine::Cocos2d;
    }
    
    // 19. MonoGame/XNA
    if is_monogame(game_path) {
        return GameEngine::MonoGame;
    }
    
    // 20. Haxe/OpenFL
    if is_haxe(game_path) {
        return GameEngine::Haxe;
    }
    
    // 21. REDengine (CD Projekt)
    if is_redengine(game_path) {
        return GameEngine::REDengine;
    }
    
    // 22. id Tech
    if is_idtech(game_path) {
        return GameEngine::IdTech;
    }
    
    // 23. Creation Engine (Bethesda)
    if is_creation(game_path) {
        return GameEngine::Creation;
    }
    
    // 24. Defold
    if is_defold(game_path) {
        return GameEngine::Defold;
    }
    
    // 25. Frostbite (EA)
    if is_frostbite(game_path) {
        return GameEngine::Frostbite;
    }
    
    // 26. Source 2 (Valve)
    if is_source2(game_path) {
        return GameEngine::Source2;
    }
    
    // 27. RE Engine (Capcom nuovo)
    if is_reengine(game_path) {
        return GameEngine::REEngine;
    }
    
    // 28. MT Framework (Capcom vecchio)
    if is_mt_framework(game_path) {
        return GameEngine::MTFramework;
    }
    
    // 29. RAGE (Rockstar)
    if is_rage(game_path) {
        return GameEngine::RAGE;
    }
    
    // 30. IW Engine (Call of Duty)
    if is_iwengine(game_path) {
        return GameEngine::IWEngine;
    }
    
    // 31. Glacier (IO Interactive)
    if is_glacier(game_path) {
        return GameEngine::Glacier;
    }
    
    // 32. Void Engine (Arkane)
    if is_void_engine(game_path) {
        return GameEngine::Void;
    }
    
    // 33. C-Engine (Techland)
    if is_techland(game_path) {
        return GameEngine::Techland;
    }
    
    // 34. FALLBACK: scansiona binari .exe per stringhe engine
    let exe_scan = scan_exe_for_engine(game_path);
    if exe_scan != GameEngine::Unknown {
        return exe_scan;
    }

    GameEngine::Unknown
}

fn is_unity(path: &Path) -> bool {
    // Check for UnityPlayer.dll (Windows)
    if path.join("UnityPlayer.dll").exists() {
        return true;
    }

    // Check for specific Unity folder structure (GameName_Data)
    // iterate over entries to find a folder ending in _Data
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.ends_with("_Data") {
                            // verify it contains Level* or SharedAssets* or Managed
                            let data_path = entry.path();
                            if data_path.join("Managed").exists() || data_path.join("globalgamemanagers").exists() {
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }
    
    false
}

fn is_unreal(path: &Path) -> bool {
    // 1. Engine folder (dev builds / some packaged games)
    if path.join("Engine").exists() && path.join("Engine/Binaries").exists() {
        return true;
    }

    // 2. UE-specific DLLs (very reliable)
    let ue_dlls = [
        "UE4Game.dll", "UE4Game-Win64-Shipping.dll",
        "UE5Game.dll", "UnrealEditor.dll",
        "UE4PrereqSetup_x64.exe",
        "tbb.dll",  // Intel TBB often shipped with UE
    ];
    for dll in &ue_dlls {
        if path.join(dll).exists() {
            return true;
        }
    }

    // 3. .uproject file
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if entry.path().extension().is_some_and(|e| e == "uproject") {
                return true;
            }
        }
    }

    // 4. Standard UE packaging: SubDir/Binaries/Win64 or SubDir/Content/Paks
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if entry.file_type().is_ok_and(|ft| ft.is_dir()) {
                let p = entry.path();
                let name = entry.file_name().to_string_lossy().to_lowercase();
                if name != "engine" && (p.join("Binaries/Win64").exists() || p.join("Content/Paks").exists()) {
                    return true;
                }
            }
        }
    }

    // 5. WindowsNoEditor pattern (common UE4 packaging)
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.contains("WindowsNoEditor") || name.contains("WindowsServer") {
                return true;
            }
        }
    }

    // 6. .pak files with UE naming convention (pakchunkN-*, *-Windows*.pak)
    //    Plain .pak alone is NOT enough — many engines use .pak (id Tech, Quake, etc.)
    if let Ok(entries) = std::fs::read_dir(path) {
        let mut has_ue_named_pak = false;
        let mut has_any_pak = false;
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "pak" {
                    has_any_pak = true;
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if name.starts_with("pakchunk") 
                        || name.contains("-windows")
                        || name.contains("_windows")
                        || name.contains("global.pak")
                        || name.contains("startup") {
                        has_ue_named_pak = true;
                    }
                }
            }
        }
        if has_ue_named_pak {
            return true;
        }
        // .pak + UE companion evidence (PhysX, NVIDIA tools)
        if has_any_pak {
            let ue_evidence = [
                "PhysX3_x64.dll", "PhysX3Common_x64.dll",
                "nvToolsExt64_1.dll", "steam_api64.dll",
            ];
            let companion_count = ue_evidence.iter()
                .filter(|f| path.join(f).exists())
                .count();
            // Need PhysX specifically (steam_api alone is too generic)
            if path.join("PhysX3_x64.dll").exists() || path.join("PhysX3Common_x64.dll").exists() {
                return true;
            }
            // .pak + Binaries folder at root level
            if path.join("Binaries").exists() || companion_count >= 2 {
                return true;
            }
        }
    }

    false
}

fn is_godot(path: &Path) -> bool {
    // Check for project.godot (dev env) or .pck files
    if path.join("project.godot").exists() {
        return true;
    }
    
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "pck" {
                    return true;
                }
            }
        }
    }
    
    false
}

fn is_rpg_maker(path: &Path) -> bool {
    // RPG Maker MV/MZ
    if path.join("www").exists() && path.join("www/data/System.json").exists() {
        return true;
    }
    
    if path.join("Game.rpgproject").exists() {
        return true;
    }
    
    // Older RPG Makers (XP, VX, VX Ace) use rgss*.dll
    // RGSS10*.dll, RGSS20*.dll, RGSS30*.dll
     if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.to_lowercase().starts_with("rgss") && name.to_lowercase().ends_with(".dll") {
                    return true;
                }
            }
        }
    }
    
    false
}

fn is_renpy(path: &Path) -> bool {
    // Check for renpy folder
    if path.join("renpy").exists() {
        return true;
    }
    
    // Check for .rpa files in game folder
    if path.join("game").exists() {
        if let Ok(entries) = std::fs::read_dir(path.join("game")) {
            for entry in entries.flatten() {
                if let Some(ext) = entry.path().extension() {
                    if ext == "rpa" || ext == "rpyc" {
                        return true;
                    }
                }
            }
        }
    }
    
    // Check for lib/pythonXX folder (Ren'Py bundled Python)
    if let Ok(entries) = std::fs::read_dir(path.join("lib")) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name.starts_with("python") || name.contains("renpy") {
                return true;
            }
        }
    }
    
    false
}

fn is_visionaire(path: &Path) -> bool {
    // Visionaire Studio 5 — .vis archive file (data.vis, game.vis, etc.)
    // Also check config.ini for "FILE = *.vis" pattern
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().is_some_and(|e| e.eq_ignore_ascii_case("vis")) {
                // Verify VIS5/VIS3 magic
                if let Ok(f) = std::fs::File::open(&p) {
                    use std::io::Read;
                    let mut magic = [0u8; 4];
                    if (&f).take(4).read(&mut magic).is_ok() && (&magic == b"VIS5" || &magic == b"VIS3") {
                        return true;
                    }
                }
            }
        }
    }
    // Fallback: config.ini with FILE=data.vis or similar
    let config = path.join("config.ini");
    if config.exists() {
        if let Ok(content) = std::fs::read_to_string(&config) {
            let lower = content.to_lowercase();
            if lower.contains(".vis") && (lower.contains("file") || lower.contains("fullscreen") || lower.contains("resolution")) {
                return true;
            }
        }
    }
    false
}

fn is_sierra_sci(path: &Path) -> bool {
    // Sierra SCI Engine — Gabriel Knight 1/2, Phantasmagoria, King's Quest, etc.
    // Look for: RESOURCE.MAP, RESOURCE.000-999, *.VMD, *.RBT, *.DUK, SIERRA.EXE
    let sci_markers = ["resource.map", "resource.cfg", "sierra.ini"];
    let sci_extensions = ["vmd", "rbt", "duk"];

    if let Ok(entries) = std::fs::read_dir(path) {
        let mut has_resource_files = false;
        let mut has_video_files = false;

        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();

            // Check per file marker SCI
            if sci_markers.iter().any(|m| name == *m) {
                has_resource_files = true;
            }
            // RESOURCE.000, RESOURCE.001, etc.
            if name.starts_with("resource.") && name.len() > 9 {
                if let Some(ext) = name.strip_prefix("resource.") {
                    if ext.chars().all(|c| c.is_ascii_digit()) {
                        has_resource_files = true;
                    }
                }
            }
            // Sierra video files (VMD, RBT, DUK)
            if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                if sci_extensions.iter().any(|e| ext.eq_ignore_ascii_case(e)) {
                    has_video_files = true;
                }
            }
            // SIERRA.EXE or SCIV.EXE
            if name == "sierra.exe" || name == "sciv.exe" || name == "sciw.exe" || name == "dosbox.exe" {
                has_resource_files = true;
            }
        }

        // Se ha resource files SCI O una combinazione di video Sierra
        if has_resource_files {
            return true;
        }
        // Alcuni remaster (Steam) non hanno RESOURCE.MAP ma hanno VMD in sottocartelle
        if has_video_files {
            return true;
        }
    }

    // Check ricorsivo per cartelle tipiche dei remaster Steam (es. Gabriel Knight 2)
    let steam_subdirs = ["MOVIES", "movies", "VIDEO", "video", "Data", "data"];
    for subdir in &steam_subdirs {
        let sub = path.join(subdir);
        if sub.exists() {
            if let Ok(entries) = std::fs::read_dir(&sub) {
                for entry in entries.flatten() {
                    if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                        if sci_extensions.iter().any(|e| ext.eq_ignore_ascii_case(e)) {
                            return true;
                        }
                    }
                }
            }
        }
    }

    false
}

fn is_gamemaker(path: &Path) -> bool {
    // GameMaker Studio - data.win (Windows), game.ios (iOS), game.droid (Android)
    if path.join("data.win").exists() 
        || path.join("game.ios").exists()
        || path.join("game.droid").exists()
        || path.join("game.unx").exists() {
        return true;
    }
    
    // Check for options.ini with GameMaker signatures
    let options = path.join("options.ini");
    if options.exists() {
        if let Ok(content) = std::fs::read_to_string(&options) {
            if content.contains("GameMaker") || content.contains("YoYo") {
                return true;
            }
        }
    }
    
    false
}

fn is_source(path: &Path) -> bool {
    // Source Engine - hl2.exe, gameinfo.txt, .vpk files
    if path.join("hl2.exe").exists() || path.join("gameinfo.txt").exists() {
        return true;
    }
    
    // Check for .vpk files
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "vpk" {
                    return true;
                }
            }
        }
    }
    
    // Check for bin folder with engine DLLs
    let bin = path.join("bin");
    if bin.exists() && (bin.join("engine.dll").exists() 
            || bin.join("vstdlib.dll").exists() || bin.join("tier0.dll").exists()) {
        return true;
    }
    
    false
}

fn is_cryengine(path: &Path) -> bool {
    // CryEngine - CrySystem.dll, Engine folder with cry files
    if path.join("CrySystem.dll").exists() 
        || path.join("Bin64/CrySystem.dll").exists()
        || path.join("CryGame.dll").exists() {
        return true;
    }
    
    // Check for .pak files with CryEngine structure
    if path.join("Engine").exists() && path.join("GameData").exists() {
        return true;
    }
    
    // Check for cry* DLLs
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name.starts_with("cry") && name.ends_with(".dll") {
                return true;
            }
        }
    }
    
    false
}

fn is_telltale(path: &Path) -> bool {
    // Telltale Tool - .ttarch/.ttarch2 files, WalkingDead*.exe, etc.
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let ext = entry.path().extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            
            if ext == "ttarch" || ext == "ttarch2" {
                return true;
            }
            
            // Check for .langdb files (Telltale language databases)
            if ext == "langdb" || ext == "landb" || ext == "dlog" {
                return true;
            }
        }
    }
    
    // Check for Pack folder (common in Telltale games)
    if path.join("Pack").exists() {
        if let Ok(entries) = std::fs::read_dir(path.join("Pack")) {
            for entry in entries.flatten() {
                if entry.path().extension().is_some_and(|e| e == "ttarch" || e == "ttarch2") {
                    return true;
                }
            }
        }
    }
    
    false
}

fn is_adobe_air(path: &Path) -> bool {
    // Adobe AIR - Adobe AIR folder, META-INF/AIR, .swf files with AIR descriptor
    if path.join("Adobe AIR").exists() 
        || path.join("META-INF/AIR").exists()
        || path.join("AIR").exists() {
        return true;
    }
    
    // Check for .air files or application.xml
    if path.join("application.xml").exists() {
        return true;
    }
    
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "air" || ext == "swf" {
                    // Additional check for AIR runtime
                    if path.join("Adobe AIR/Versions").exists() {
                        return true;
                    }
                }
            }
        }
    }
    
    false
}

fn is_construct(path: &Path) -> bool {
    // Construct 2/3 - NW.js based with c2runtime.js or c3runtime.js
    let nwjs_indicators = ["nw.exe", "node.dll", "package.json"];
    let has_nwjs = nwjs_indicators.iter().any(|f| path.join(f).exists());
    
    if has_nwjs {
        // Check for Construct runtime files
        if let Ok(content) = std::fs::read_to_string(path.join("package.json")) {
            if content.contains("c2runtime") || content.contains("c3runtime") || content.contains("construct") {
                return true;
            }
        }
        
        // Check for data.js or c2runtime.js
        if path.join("data.js").exists() 
            || path.join("c2runtime.js").exists()
            || path.join("c3runtime.js").exists() {
            return true;
        }
    }
    
    false
}

fn is_love2d(path: &Path) -> bool {
    // LÖVE - love.dll, .love files, or conf.lua
    if path.join("love.dll").exists() 
        || path.join("love.exe").exists() {
        return true;
    }
    
    // Check for .love files (ZIP archives with Lua scripts)
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "love" {
                    return true;
                }
            }
        }
    }
    
    // Check for main.lua + conf.lua (LÖVE project structure)
    if path.join("main.lua").exists() && path.join("conf.lua").exists() {
        return true;
    }
    
    false
}

fn is_kirikiri(path: &Path) -> bool {
    // Kirikiri - .xp3 files, krkr.eXe, tvpwin32.exe
    if path.join("krkr.eXe").exists() 
        || path.join("krkrrel.exe").exists()
        || path.join("tvpwin32.exe").exists() {
        return true;
    }
    
    // Check for .xp3 archive files
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "xp3" {
                    return true;
                }
            }
        }
    }
    
    false
}

fn is_nscripter(path: &Path) -> bool {
    // NScripter - nscript.dat, arc.nsa, arc*.nsa
    if path.join("nscript.dat").exists() 
        || path.join("nscr_sec.dat").exists()
        || path.join("arc.nsa").exists() {
        return true;
    }
    
    // Check for .nsa files
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "nsa" {
                    return true;
                }
            }
        }
    }
    
    false
}

fn is_wolf(path: &Path) -> bool {
    // Wolf RPG Editor - Game.dat, .wolf files, Data folder
    if path.join("Game.dat").exists() || path.join("Game.exe").exists() {
        // Additional check for Wolf-specific files
        let data = path.join("Data");
        if data.exists() {
            if let Ok(entries) = std::fs::read_dir(&data) {
                for entry in entries.flatten() {
                    if let Some(ext) = entry.path().extension() {
                        if ext == "wolf" {
                            return true;
                        }
                    }
                }
            }
        }
    }
    
    // Check for Config.ini with Wolf signatures
    if path.join("Config.ini").exists() {
        if let Ok(content) = std::fs::read_to_string(path.join("Config.ini")) {
            if content.contains("WolfRPG") || content.contains("Wolf RPG") {
                return true;
            }
        }
    }
    
    false
}

fn is_clausewitz(path: &Path) -> bool {
    // Clausewitz Engine (Paradox) - common, events, localization folders
    let paradox_folders = ["common", "events", "localisation", "localization", "gfx", "interface"];
    let matches = paradox_folders.iter().filter(|f| path.join(f).exists()).count();
    
    if matches >= 3 {
        return true;
    }
    
    // Check for .txt files in common folder (Paradox script files)
    if path.join("common").exists() && path.join("map").exists() {
        return true;
    }
    
    // Check for descriptor.mod or launcher-settings.json
    if path.join("launcher-settings.json").exists() {
        if let Ok(content) = std::fs::read_to_string(path.join("launcher-settings.json")) {
            if content.contains("paradox") || content.contains("clausewitz") {
                return true;
            }
        }
    }
    
    false
}

fn is_electron(path: &Path) -> bool {
    // Electron/NW.js - node.dll, resources/app folder, package.json
    if path.join("resources/app").exists() 
        || path.join("resources/app.asar").exists() {
        return true;
    }
    
    if path.join("nw.exe").exists() || path.join("nw.dll").exists() {
        return true;
    }
    
    // Check for electron.exe or package.json with electron
    if path.join("electron.exe").exists() {
        return true;
    }
    
    if path.join("package.json").exists() {
        if let Ok(content) = std::fs::read_to_string(path.join("package.json")) {
            if content.contains("electron") || content.contains("nw.js") {
                return true;
            }
        }
    }
    
    false
}

fn is_cocos2d(path: &Path) -> bool {
    // Cocos2d - cocos2d-x folders, libcocos2d.dll, res folder structure
    if path.join("libcocos2d.dll").exists() 
        || path.join("cocos2d-x").exists() {
        return true;
    }
    
    // Check for res folder with cocos structure
    let res = path.join("res");
    if res.exists() && path.join("src").exists() {
        // Common in Cocos2d-JS games
        return true;
    }
    
    // Check for .csb files (Cocos Studio binary)
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "csb" {
                    return true;
                }
            }
        }
    }
    
    false
}

fn is_monogame(path: &Path) -> bool {
    // MonoGame/XNA - MonoGame.Framework.dll, XNA assemblies
    if path.join("MonoGame.Framework.dll").exists()
        || path.join("Microsoft.Xna.Framework.dll").exists() {
        return true;
    }
    
    // Check for FNA.dll (alternative XNA implementation)
    if path.join("FNA.dll").exists() {
        return true;
    }
    
    // Check for .xnb files (XNA content)
    if let Ok(entries) = std::fs::read_dir(path.join("Content")) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "xnb" {
                    return true;
                }
            }
        }
    }
    
    false
}

fn is_haxe(path: &Path) -> bool {
    // Haxe/OpenFL - lime.ndll, openfl folder
    if path.join("lime.ndll").exists()
        || path.join("openfl").exists()
        || path.join("lime.dll").exists() {
        return true;
    }
    
    // Check for HashLink VM (Haxe runtime)
    if path.join("hl.exe").exists() || path.join("libhl.dll").exists() {
        return true;
    }
    
    // Check for .hlboot file (HashLink boot file)
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "hlboot" || ext == "hl" {
                    return true;
                }
            }
        }
    }
    
    false
}

fn is_redengine(path: &Path) -> bool {
    // REDengine (CD Projekt) - .archive files, REDprelauncher
    if path.join("REDprelauncher.exe").exists() 
        || path.join("bin/x64/witcher3.exe").exists()
        || path.join("bin/x64/Cyberpunk2077.exe").exists() {
        return true;
    }
    
    // Check for .archive files (REDengine 4)
    if let Ok(entries) = std::fs::read_dir(path.join("archive/pc/content")) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "archive" {
                    return true;
                }
            }
        }
    }
    
    // Check for .bundle files (REDengine 3)
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "bundle" {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if name.contains("content") || name.contains("patch") {
                        return true;
                    }
                }
            }
        }
    }
    
    false
}

fn is_idtech(path: &Path) -> bool {
    // id Tech - .pk3/.pk4/.resources files, base folder
    let base = path.join("base");
    
    if base.exists() {
        if let Ok(entries) = std::fs::read_dir(&base) {
            for entry in entries.flatten() {
                if let Some(ext) = entry.path().extension() {
                    let ext_str = ext.to_str().unwrap_or("");
                    if ext_str == "pk3" || ext_str == "pk4" || ext_str == "resources" {
                        return true;
                    }
                }
            }
        }
    }
    
    // Check for .mega files (DOOM 2016+)
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "mega" || ext == "resources" {
                    return true;
                }
            }
        }
    }
    
    false
}

fn is_creation(path: &Path) -> bool {
    // Creation Engine (Bethesda) - .esm/.esp/.bsa/.ba2 files
    let data = path.join("Data");
    
    if data.exists() {
        if let Ok(entries) = std::fs::read_dir(&data) {
            for entry in entries.flatten() {
                if let Some(ext) = entry.path().extension() {
                    let ext_str = ext.to_str().unwrap_or("");
                    if ext_str == "esm" || ext_str == "esp" || ext_str == "bsa" || ext_str == "ba2" {
                        return true;
                    }
                }
            }
        }
    }
    
    // Check for Creation Kit files
    if path.join("CreationKit.exe").exists() {
        return true;
    }
    
    false
}

fn is_defold(path: &Path) -> bool {
    // Defold - game.project, .arcd/.arci files
    if path.join("game.project").exists() {
        return true;
    }
    
    // Check for .arcd/.arci files (Defold archives)
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "arcd" || ext == "arci" {
                    return true;
                }
            }
        }
    }
    
    false
}

pub fn detect_engine_smart(name: &str, path: Option<&Path>) -> String {
    // 1. File system detection
    if let Some(p) = path {
        if p.exists() {
             let detected = detect_engine(p);
             if detected != GameEngine::Unknown {
                 return detected.as_str().to_string();
             }
        }
    }
    
    // 2. Name detection
    detect_engine_by_name(name).unwrap_or_else(|| "Unknown".to_string())
}

pub fn detect_engine_by_name(name: &str) -> Option<String> {
    let name_lower = name.to_lowercase();
    
    // 🔶 UNITY ENGINE — Confermati Unity
    let unity_games = [
        // Indie famosi
        "hollow knight", "cuphead", "ori and", "cities skylines", "kerbal space program",
        "subnautica", "the forest", "green hell", "rust", "7 days to die",
        "valheim", "raft", "slime rancher", "a hat in time", "risk of rain",
        "dead cells", "enter the gungeon", "the binding of isaac", "fez", "limbo",
        "inside", "little nightmares", "ori and the blind forest", "ori and the will",
        "firewatch", "what remains of edith finch", "untitled goose game",
        "among us", "fall guys", "phasmophobia", "devour",
        // Horror Unity
        "lethal company", "content warning", "forewarned", "ghost watchers", "demonologist",
        "the backrooms", "poppy playtime", "bendy and the ink", "hello neighbor", "fnaf",
        "five nights at freddy", "amnesia", "soma", "penumbra",
        // Survival/Crafting Unity
        "don't starve", "oxygen not included", "rimworld", "prison architect",
        "astroneer", "grounded", "stranded deep", "the long dark",
        "project zomboid", "unturned", "scrap mechanic", "trailmakers",
        // Roguelike/Action Unity
        "slay the spire", "monster train", "cult of the lamb", "vampire survivors",
        "20 minutes till dawn", "gunfire reborn", "roboquest", "synthetik",
        // AAA con Unity
        "hearthstone", "legends of runeterra", "gwent", "monument valley",
        "tarkov", "escape from tarkov", "marauders", "the cycle",
        // VR Unity
        "beat saber", "job simulator", "vacation simulator", "superhot vr", "pistol whip",
        "moss", "arizona sunshine", "pavlov vr", "onward", "gorilla tag",
        "vrchat", "rec room", "bigscreen", "demeo", "walkabout mini golf",
        // Simulatori Unity
        "cities skylines 2", "planet zoo", "planet coaster", "two point hospital",
        "two point campus", "parkitect", "megaquarium",
        // Mobile/Multiplat
        "pokémon go", "genshin impact", "call of duty mobile",
        // Indie narrativi Unity
        "return of the obra dinn", "outer wilds", "the pathless", "abzu",
        "gris", "spiritfarer", "coffee talk", "a short hike", "unpacking", "toem",
        "the gardens between", "before your eyes", "twelve minutes", "the artful escape",
        "genesis noir", "last stop", "road 96", "lake", "tunic",
        // Puzzle/Strategy Unity
        "return to monkey island", "the case of the golden idol",
        "inscryption", "buckshot roulette", "balatro", "luck be a landlord",
        "stacklands", "halls of torment", "against the storm",
        "dredge", "terra nil", "dave the diver", "plate up", "turbo overkill",
        "ultrakill", "prodeus", "trepang2", "ghostrunner"
    ];
    
    // 🔷 UNREAL ENGINE — Confermati UE4/UE5
    let unreal_games = [
        // Epic/AAA
        "fortnite", "borderlands", "bioshock", "gears of war",
        "rocket league", "dead by daylight", "ark survival", "pubg", "squad",
        "hell let loose", "post scriptum", "rising storm", "red orchestra",
        "killing floor", "deep rock galactic", "sea of thieves",
        "state of decay", "scorn", "the ascent", "outriders", "remnant",
        "atomic heart", "hogwarts legacy", "jedi survivor", "jedi fallen order",
        "black myth wukong", "lies of p", "lords of the fallen", "mortal shell",
        "satisfactory", "stray", "sifu", "little nightmares 2",
        // VR Games Unreal
        "boneworks", "bonelab", "blade & sorcery",
        "into the radius", "asgard's wrath", "lone echo",
        "medal of honor: above and beyond", "sniper elite vr", "walking dead saints",
        "after the fall", "green hell vr", "red matter", "hubris",
        // Horror Unreal
        "outlast", "outlast 2", "outlast trials", "the callisto protocol",
        "sons of the forest", "dead island 2",
        // Fighting games (UE)
        "mortal kombat", "injustice", "tekken", "dragon ball fighterz",
        "guilty gear strive", "granblue fantasy versus",
        // Shooter UE
        "valorant", "paladins", "rogue company", "the finals",
        "xdefiant", "ready or not", "ground branch", "zero hour",
        // Soulslike/Action UE
        "steelrising", "thymesia", "dolmen",
        // RPG/Adventure UE
        "kingdom hearts 3", "final fantasy vii remake", "final fantasy vii rebirth",
        "scarlet nexus", "tales of arise", "code vein", "god eater 3",
        "dragon quest xi", "octopath traveler", "palworld",
        // Racing/Sports
        "hot wheels unleashed",
        // Indie Horror UE
        "visage", "madison", "infliction", "devotion", "detention",
        "home sweet home", "pamali", "dreadout"
    ];
    
    // ⚔️ FROMSOFT ENGINE (FromSoftware proprietario)
    let fromsoft_games = [
        "elden ring", "dark souls", "dark souls ii", "dark souls iii",
        "sekiro", "bloodborne", "armored core vi", "armored core 6",
        "demon's souls"
    ];
    
    // 🗡️ PLATINUM ENGINE (PlatinumGames)
    let platinum_games = [
        "nier automata", "nier replicant", "bayonetta", "bayonetta 2", "bayonetta 3",
        "metal gear rising", "astral chain", "the wonderful 101",
        "vanquish", "mad world"
    ];
    
    // 🏎️ RAGE ENGINE (Rockstar)
    let rage_games = [
        "grand theft auto", "gta v", "gta iv", "red dead redemption",
        "max payne 3", "midnight club", "bully"
    ];
    
    // 🎯 IW ENGINE (Call of Duty)
    let iw_games = [
        "call of duty", "warzone", "modern warfare", "black ops", "vanguard"
    ];
    
    // 🏔️ GLACIER ENGINE (IO Interactive)
    let glacier_games = [
        "hitman", "hitman 2", "hitman 3", "world of assassination",
        "kane & lynch", "freedom fighters"
    ];
    
    // 🧟 TECHLAND / C-ENGINE
    let techland_games = [
        "dying light", "dying light 2", "dead island", "call of juarez"
    ];
    
    // 💎 LUMINOUS ENGINE (Square Enix)
    let luminous_games = [
        "final fantasy xv", "final fantasy 15", "forspoken"
    ];
    
    // 🌀 VOID ENGINE (Arkane)
    let void_games = [
        "dishonored 2", "dishonored death of the outsider", "deathloop"
    ];
    
    // 🟠 SOURCE ENGINE (Valve + licensees)
    let source_games = [
        "half-life 2", "counter-strike source", "counter-strike global",
        "portal", "portal 2", "team fortress 2", "left 4 dead",
        "black mesa", "garry's mod", "titanfall", "apex legends",
        "the stanley parable", "dear esther", "insurgency", "day of defeat",
        "vampire the masquerade bloodlines"
    ];
    
    // 🟠 SOURCE 2
    let source2_games = [
        "half-life: alyx", "dota 2", "counter-strike 2", "deadlock"
    ];
    
    // 🟫 CREATION ENGINE (Bethesda)
    let creation_games = [
        "fallout 4", "fallout 76", "skyrim", "starfield"
    ];
    
    // 🟫 GAMEBRYO (old Bethesda)
    let gamebryo_games = ["fallout 3", "fallout new vegas", "oblivion", "morrowind"];
    
    // 🔴 CRYENGINE
    let cryengine_games = [
        "crysis", "hunt showdown", "kingdom come deliverance",
        "star citizen", "squadron 42", "ryse son of rome", "warface", "archeage"
    ];
    
    // 🟢 FROSTBITE (EA)
    let frostbite_games = [
        "battlefield", "mirror's edge", "need for speed", "fifa", "ea sports fc",
        "madden nfl", "star wars battlefront", "anthem",
        "mass effect andromeda", "mass effect legendary",
        "dragon age inquisition", "dragon age veilguard",
        "dead space remake", "dead space 2023"
    ];
    
    // 🔵 PROPRIETARY ENGINES
    let anvil_games = ["assassin's creed", "watch dogs", "for honor", "prince of persia"];
    let dunia_games = ["far cry 3", "far cry 4", "far cry 5", "far cry 6", "far cry primal"];
    let chrome_games = ["metro exodus", "metro last light", "metro 2033"];
    let aurora_games = ["neverwinter nights", "dragon age origins", "mass effect 1"];
    let id_tech_games = ["doom", "quake", "wolfenstein", "rage 2", "evil within"];
    let decima_games = ["horizon zero dawn", "horizon forbidden west", "death stranding"];
    let fox_games = ["metal gear solid v", "pro evolution soccer", "pes 20"];
    let snowdrop_games = ["the division", "mario + rabbids", "star wars outlaws"];
    let re_engine_games = [
        "resident evil village", "resident evil 4 remake", "resident evil 2 remake",
        "resident evil 3 remake", "devil may cry 5", "monster hunter rise",
        "monster hunter wilds", "street fighter 6"
    ];
    let mt_framework_games = [
        "resident evil 5", "resident evil 6", "dragon's dogma",
        "lost planet", "devil may cry 4", "monster hunter world"
    ];
    
    // 🎲 INDIE ENGINES
    let godot_games = [
        "cassette beasts", "cruelty squad", "dome keeper", "brotato",
        "sonic colors ultimate", "halls of torment"
    ];
    // 🎭 VISIONAIRE STUDIO (Adventure games)
    let visionaire_games = [
        "deponia", "edna & harvey", "edna and harvey", "the whispered world",
        "the dark eye", "memoria", "silence", "anna's quest", "the inner world",
        "foolish mortals", "kelvin and the infamous machine", "trüberbrook",
        "truberbrook", "unforeseen incidents", "gibbous", "lamplight city",
        "detective gallo", "the raven", "the book of unwritten tales",
        "harvey's new eyes", "a new beginning", "chains of satinav",
    ];
    
    let gamemaker_games = [
        "undertale", "deltarune", "hyper light drifter", "hotline miami",
        "nuclear throne", "decarnation", "katana zero", "downwell",
        "minit", "forager", "moonlighter", "chicory", "heartbound",
        "everhood", "spelunky", "risk of rain classic"
    ];
    
    // 🎮 RPG MAKER
    let rpgmaker_games = [
        "to the moon", "finding paradise", "rakuen", "oneshot", "ib",
        "corpse party", "mad father", "witch's house", "misao", "yume nikki",
        "lisa the painful", "off", "space funeral", "jimmy and the pulsating mass",
        "omori", "hello charlotte", "mogeko castle", "the gray garden"
    ];
    
    // 🐍 REN'PY (Visual Novels)
    let renpy_games = [
        "doki doki literature club", "ddlc", "katawa shoujo", "long live the queen",
        "butterfly soup", "a summer's end", "highway blossoms", "ladykiller in a bind",
        "analogue a hate story", "hate plus", "va-11 hall-a"
    ];
    
    // 🎮 MONOGAME / XNA / FNA
    let monogame_games = [
        "celeste", "stardew valley", "terraria", "fez", "bastion",
        "transistor", "hades", "pyre", "super meat boy"
    ];
    
    // Controllo specifico per nome (ordinato: proprietari prima, generici dopo)
    // — Proprietari specifici (match esatto su serie)
    if fromsoft_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("FromSoftware Engine".to_string());
    }
    if platinum_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Platinum Engine".to_string());
    }
    if rage_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("RAGE Engine".to_string());
    }
    if iw_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("IW Engine".to_string());
    }
    if glacier_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Glacier Engine".to_string());
    }
    if techland_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("C-Engine (Techland)".to_string());
    }
    if luminous_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Luminous Engine".to_string());
    }
    if void_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Void Engine".to_string());
    }
    if re_engine_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("RE Engine".to_string());
    }
    if mt_framework_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("MT Framework".to_string());
    }
    if anvil_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Anvil Engine".to_string());
    }
    if dunia_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Dunia Engine".to_string());
    }
    if frostbite_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Frostbite".to_string());
    }
    if cryengine_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("CryEngine".to_string());
    }
    if decima_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Decima".to_string());
    }
    if fox_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("FOX Engine".to_string());
    }
    if snowdrop_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Snowdrop".to_string());
    }
    if chrome_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("4A Engine".to_string());
    }
    if id_tech_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("id Tech".to_string());
    }
    if gamebryo_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Gamebryo".to_string());
    }
    if aurora_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Aurora Engine".to_string());
    }
    if source2_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Source 2".to_string());
    }
    // — Engine generici (ordine: Unity, Unreal, Source, Creation, indie)
    if monogame_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("MonoGame/FNA".to_string());
    }
    if unity_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Unity".to_string());
    }
    if unreal_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Unreal Engine".to_string());
    }
    if source_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Source Engine".to_string());
    }
    if creation_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Creation Engine".to_string());
    }
    if gamemaker_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("GameMaker".to_string());
    }
    if godot_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Godot".to_string());
    }
    if visionaire_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Visionaire Studio".to_string());
    }
    if rpgmaker_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("RPG Maker".to_string());
    }
    if renpy_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Ren'Py".to_string());
    }
    
    // Rilevamento generico basato su keyword nel nome
    if name_lower.contains("call of duty") || name_lower.contains("warzone") {
        return Some("IW Engine".to_string());
    }
    if name_lower.contains("fifa") || name_lower.contains("madden") || name_lower.contains("battlefield") {
        return Some("Frostbite".to_string());
    }
    if name_lower.contains("minecraft") {
        return Some("Java/Bedrock".to_string());
    }
    if name_lower.contains("overwatch") {
        return Some("Proprietary (Blizzard)".to_string());
    }
    if name_lower.contains("league of legends") || name_lower.contains("valorant") {
        return Some("Unreal Engine".to_string());
    }
    
    None
}

/// Rileva giochi Spike Chunsoft (Danganronpa, etc.) - hanno file .pak ma NON sono Unreal
fn is_spike_chunsoft(path: &Path) -> bool {
    // File specifici di Danganronpa
    if path.join("dr1_data.pak").exists() 
        || path.join("dr2_data.pak").exists()
        || path.join("drv3_data.pak").exists()
        || path.join("Dr1").exists()
        || path.join("Dr2").exists() {
        return true;
    }
    
    // Cartella flash usata da Danganronpa
    if path.join("flash").exists() && path.join("flash/minigame").exists() {
        return true;
    }
    
    // Check nome cartella per Danganronpa
    if let Some(folder_name) = path.file_name() {
        let name = folder_name.to_string_lossy().to_lowercase();
        if name.contains("danganronpa") {
            return true;
        }
    }
    
    // Zero Escape series (altro gioco Spike Chunsoft)
    if path.join("data.cpk").exists() || path.join("movie").exists() {
        if let Some(folder_name) = path.file_name() {
            let name = folder_name.to_string_lossy().to_lowercase();
            if name.contains("zero escape") || name.contains("virtue") || name.contains("nonary") {
                return true;
            }
        }
    }
    
    false
}

fn is_frostbite(path: &Path) -> bool {
    // Frostbite (EA): .cas/.cat/.sb/.toc files, Data/Win32 structure
    let fb_exts = ["cas", "cat", "sb", "toc"];
    // Check Data/Win32 or Data folder
    for data_dir in &["Data", "Data/Win32", "Data/Win64"] {
        let dp = path.join(data_dir);
        if dp.exists() {
            if let Ok(entries) = std::fs::read_dir(&dp) {
                for entry in entries.flatten() {
                    if let Some(ext) = entry.path().extension() {
                        let e = ext.to_str().unwrap_or("");
                        if fb_exts.contains(&e) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    // FrostyModManager support file
    if path.join("ModData").exists() || path.join("FrostyModManager").exists() {
        return true;
    }
    false
}

fn is_source2(path: &Path) -> bool {
    // Source 2: game/ folder with vpk + bin/win64
    let game_dir = path.join("game");
    if game_dir.exists() {
        if game_dir.join("bin/win64").exists() || game_dir.join("core").exists() {
            return true;
        }
        // Check for pak01_dir.vpk inside game subdirs
        if let Ok(entries) = std::fs::read_dir(&game_dir) {
            for entry in entries.flatten() {
                if entry.file_type().is_ok_and(|ft| ft.is_dir()) && entry.path().join("pak01_dir.vpk").exists() {
                    return true;
                }
            }
        }
    }
    // Check for .vpk + gameinfo.gi (Source 2 uses .gi instead of .txt)
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if entry.path().extension().is_some_and(|e| e == "gi") {
                return true;
            }
        }
    }
    false
}

fn is_reengine(path: &Path) -> bool {
    // RE Engine (Capcom): re_chunk_000.pak, natives/ folder, .pak.patch_* files
    if path.join("natives").exists() {
        // natives/stm or natives/x64 is RE Engine signature
        let n = path.join("natives");
        if n.join("stm").exists() || n.join("x64").exists() || n.join("STM").exists() {
            return true;
        }
    }
    // re_chunk_*.pak files
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name.starts_with("re_chunk") && name.ends_with(".pak") {
                return true;
            }
            if name.starts_with("re_dlc") && name.ends_with(".pak") {
                return true;
            }
        }
    }
    false
}

fn is_rage(path: &Path) -> bool {
    // RAGE Engine (Rockstar): .rpf files, update/update.rpf, x64/ folder
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if entry.path().extension().is_some_and(|e| e == "rpf") {
                return true;
            }
        }
    }
    // x64/ folder with rpf inside
    if path.join("x64").exists() || path.join("update").exists() {
        if let Ok(entries) = std::fs::read_dir(path.join("x64")) {
            for entry in entries.flatten() {
                if entry.path().extension().is_some_and(|e| e == "rpf") {
                    return true;
                }
            }
        }
        if path.join("update/update.rpf").exists() {
            return true;
        }
    }
    false
}

#[allow(dead_code)]
fn is_foxengine(path: &Path) -> bool {
    // FOX Engine (Konami): .fpk/.fpkd files, master/ folder, chunk*.dat
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                let e = ext.to_str().unwrap_or("");
                if e == "fpk" || e == "fpkd" {
                    return true;
                }
            }
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name.starts_with("chunk") && name.ends_with(".dat") {
                return true;
            }
        }
    }
    if path.join("master").exists() || path.join("0").exists() {
        // MGSV uses numbered folders + .fpk
        return true;
    }
    false
}

fn is_iwengine(path: &Path) -> bool {
    // IW Engine (Call of Duty): .ff files, zone/ folder, .iwd files
    let zone = path.join("zone");
    if zone.exists() {
        if let Ok(entries) = std::fs::read_dir(&zone) {
            for entry in entries.flatten() {
                if entry.path().extension().is_some_and(|e| e == "ff") {
                    return true;
                }
            }
        }
    }
    // .ff or .iwd in root
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                let e = ext.to_str().unwrap_or("");
                if e == "ff" || e == "iwd" {
                    return true;
                }
            }
        }
    }
    // main/ folder with iwd files (older CoD)
    if path.join("main").exists() {
        if let Ok(entries) = std::fs::read_dir(path.join("main")) {
            for entry in entries.flatten() {
                if entry.path().extension().is_some_and(|e| e == "iwd") {
                    return true;
                }
            }
        }
    }
    false
}

fn is_glacier(path: &Path) -> bool {
    // Glacier Engine (IO Interactive / Hitman): .rpkg files, Runtime/ folder
    if path.join("Runtime").exists() {
        if let Ok(entries) = std::fs::read_dir(path.join("Runtime")) {
            for entry in entries.flatten() {
                if entry.path().extension().is_some_and(|e| e == "rpkg") {
                    return true;
                }
            }
        }
    }
    // .rpkg in root
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if entry.path().extension().is_some_and(|e| e == "rpkg") {
                return true;
            }
        }
    }
    false
}

fn is_mt_framework(path: &Path) -> bool {
    // MT Framework (Capcom old): .arc files, nativePC/ or nativeWin64/ folder
    if path.join("nativePC").exists() || path.join("nativeWin64").exists() || path.join("nativePCx64").exists() {
        return true;
    }
    // .arc files (MT Framework archive format)
    if let Ok(entries) = std::fs::read_dir(path) {
        let mut arc_count = 0;
        for entry in entries.flatten() {
            if entry.path().extension().is_some_and(|e| e == "arc") {
                arc_count += 1;
                if arc_count >= 2 {
                    return true;
                }
            }
        }
    }
    false
}

fn is_void_engine(path: &Path) -> bool {
    // Void Engine (Arkane): .index files, generatedresources/ folder, .resourceinterleaved
    if path.join("generatedresources").exists() || path.join("base").join("generatedresources").exists() {
        return true;
    }
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                let e = ext.to_str().unwrap_or("");
                if e == "index" || e == "resourceinterleaved" || e == "sharedassets" {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if name.contains("gameresources") || name.contains("generated") {
                        return true;
                    }
                }
            }
        }
    }
    false
}

fn is_techland(path: &Path) -> bool {
    // C-Engine (Techland): .rpack files, Data0.pak - Data3.pak pattern, DW/ folder
    if path.join("DW").exists() && path.join("engine").exists() {
        return true;
    }
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "rpack" {
                    return true;
                }
            }
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name.starts_with("data") && name.ends_with(".pak") {
                // Data0.pak, Data1.pak pattern — but verify it's Techland by checking DW/
                if path.join("DW").exists() {
                    return true;
                }
            }
        }
    }
    false
}

/// Scansiona gli .exe nella root per stringhe engine embedded e PE headers (fallback potente)
fn scan_exe_for_engine(path: &Path) -> GameEngine {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().is_some_and(|e| e == "exe") {
                if let Ok(data) = std::fs::read(&p) {
                    // FASE 1: Analisi PE Import Table (DLL names) — molto affidabile
                    if let Some(engine) = detect_engine_from_pe_imports(&data) {
                        return engine;
                    }

                    // FASE 2: Scan stringhe nei primi 8MB
                    let scan_len = data.len().min(8 * 1024 * 1024);
                    let slice = &data[..scan_len];
                    let haystack = String::from_utf8_lossy(slice);
                    
                    // Ordine di priorità (più specifico prima)
                    if haystack.contains("UnityPlayer") || haystack.contains("unity_builtin_extra") || haystack.contains("mono_jit_init") {
                        return GameEngine::Unity;
                    }
                    if haystack.contains("UnrealEngine") || haystack.contains("UE4Editor") || haystack.contains("Epic Games") || haystack.contains("UObjectBase") {
                        return GameEngine::Unreal;
                    }
                    if haystack.contains("Godot Engine") || haystack.contains("godot_") || haystack.contains("GDScript") {
                        return GameEngine::Godot;
                    }
                    if haystack.contains("CRYENGINE") || haystack.contains("CrySystem") || haystack.contains("CryRender") {
                        return GameEngine::CryEngine;
                    }
                    if haystack.contains("Frostbite") || haystack.contains("fb://") || haystack.contains("FrostbiteEngine") {
                        return GameEngine::Frostbite;
                    }
                    if haystack.contains("REDengine") || haystack.contains("CDProjektRed") || haystack.contains("W2RC") {
                        return GameEngine::REDengine;
                    }
                    if haystack.contains("RE ENGINE") || haystack.contains("re_engine") || haystack.contains("via.render") {
                        return GameEngine::REEngine;
                    }
                    if haystack.contains("FOX ENGINE") || haystack.contains("fox_engine") || haystack.contains("FoxLib") {
                        return GameEngine::FOXEngine;
                    }
                    if haystack.contains("Glacier") && haystack.contains("IOInteractive") {
                        return GameEngine::Glacier;
                    }
                    if haystack.contains("GameMaker") || haystack.contains("YoYoGames") || haystack.contains("GMLua") {
                        return GameEngine::GameMaker;
                    }
                    if haystack.contains("MonoGame") || haystack.contains("Microsoft.Xna") || haystack.contains("XnaFramework") {
                        return GameEngine::MonoGame;
                    }
                    if haystack.contains("libgdx") || haystack.contains("com.badlogic") {
                        return GameEngine::LibGDX;
                    }
                    if haystack.contains("HashLink") || haystack.contains("hlboot") || haystack.contains("hl_") {
                        return GameEngine::Haxe;
                    }
                    if haystack.contains("love.dll") || haystack.contains("love2d") || haystack.contains("LOVE ") {
                        return GameEngine::Love2D;
                    }
                    if haystack.contains("Defold") || haystack.contains("defold_engine") || haystack.contains("dmengine") {
                        return GameEngine::Defold;
                    }
                    if haystack.contains("rpg_core") || haystack.contains("RGSS") || haystack.contains("RPGMaker") {
                        return GameEngine::RPGMaker;
                    }
                    if haystack.contains("renpy") || haystack.contains("Ren'Py") || haystack.contains("pygame") {
                        return GameEngine::RenPy;
                    }
                    if haystack.contains("Cocos2d") || haystack.contains("cocos2d-x") {
                        return GameEngine::Cocos2d;
                    }
                    if haystack.contains("RAGE") && haystack.contains("Rockstar") {
                        return GameEngine::RAGE;
                    }
                    if haystack.contains("IW Engine") || haystack.contains("iw_") || (haystack.contains("Infinity Ward") && haystack.contains("iwdll")) {
                        return GameEngine::IWEngine;
                    }
                    if haystack.contains("AnvilNext") || haystack.contains("Scimitar") || haystack.contains("Ubisoft") {
                        return GameEngine::Clausewitz; // Ubisoft Anvil as generic
                    }
                    if haystack.contains("id Tech") || haystack.contains("idlib") || haystack.contains("Doom") && haystack.contains("idSoft") {
                        return GameEngine::IdTech;
                    }
                    if haystack.contains("Creation Engine") || haystack.contains("Bethesda") && haystack.contains("Papyrus") {
                        return GameEngine::Creation;
                    }
                }
            }
        }
    }
    GameEngine::Unknown
}

/// Analizza la PE Import Table per rilevare DLL engine-specifiche
fn detect_engine_from_pe_imports(data: &[u8]) -> Option<GameEngine> {
    // Verifica PE signature: MZ header
    if data.len() < 64 || data[0] != b'M' || data[1] != b'Z' {
        return None;
    }

    // Offset del PE header (a offset 0x3C nel DOS header)
    let pe_offset = u32::from_le_bytes([data[0x3C], data[0x3D], data[0x3E], data[0x3F]]) as usize;
    if pe_offset + 4 > data.len() { return None; }

    // Verifica PE\0\0 signature
    if &data[pe_offset..pe_offset+4] != b"PE\0\0" {
        return None;
    }

    // COFF header starts at pe_offset + 4
    let coff_start = pe_offset + 4;
    if coff_start + 20 > data.len() { return None; }

    // Dimensione optional header
    let optional_header_size = u16::from_le_bytes([data[coff_start + 16], data[coff_start + 17]]) as usize;
    let optional_start = coff_start + 20;
    if optional_start + optional_header_size > data.len() { return None; }

    // Determina se PE32 o PE32+
    let magic = u16::from_le_bytes([data[optional_start], data[optional_start + 1]]);
    let import_dir_offset = match magic {
        0x10b => optional_start + 104, // PE32: Import Directory RVA at offset 104
        0x20b => optional_start + 120, // PE32+: Import Directory RVA at offset 120
        _ => return None,
    };

    if import_dir_offset + 8 > data.len() { return None; }

    let import_rva = u32::from_le_bytes([
        data[import_dir_offset], data[import_dir_offset+1],
        data[import_dir_offset+2], data[import_dir_offset+3],
    ]) as usize;
    let import_size = u32::from_le_bytes([
        data[import_dir_offset+4], data[import_dir_offset+5],
        data[import_dir_offset+6], data[import_dir_offset+7],
    ]) as usize;

    if import_rva == 0 || import_size == 0 { return None; }

    // Trova la sezione che contiene l'Import Directory
    let num_sections = u16::from_le_bytes([data[coff_start + 2], data[coff_start + 3]]) as usize;
    let sections_start = optional_start + optional_header_size;

    let mut dll_names: Vec<String> = Vec::new();

    for i in 0..num_sections {
        let sec_offset = sections_start + i * 40;
        if sec_offset + 40 > data.len() { break; }

        let virt_addr = u32::from_le_bytes([
            data[sec_offset + 12], data[sec_offset + 13],
            data[sec_offset + 14], data[sec_offset + 15],
        ]) as usize;
        let virt_size = u32::from_le_bytes([
            data[sec_offset + 8], data[sec_offset + 9],
            data[sec_offset + 10], data[sec_offset + 11],
        ]) as usize;
        let raw_offset = u32::from_le_bytes([
            data[sec_offset + 20], data[sec_offset + 21],
            data[sec_offset + 22], data[sec_offset + 23],
        ]) as usize;

        // Verifica se l'import directory è in questa sezione
        if import_rva >= virt_addr && import_rva < virt_addr + virt_size {
            let file_offset = raw_offset + (import_rva - virt_addr);

            // Itera le Import Directory entries (20 bytes ciascuna)
            let mut idx = file_offset;
            for _ in 0..100 { // Max 100 DLL
                if idx + 20 > data.len() { break; }

                let name_rva = u32::from_le_bytes([
                    data[idx + 12], data[idx + 13], data[idx + 14], data[idx + 15],
                ]) as usize;

                // End of import directory (null entry)
                if name_rva == 0 { break; }

                // Converti RVA del nome DLL in file offset
                let name_file_offset = raw_offset + (name_rva - virt_addr);
                if name_file_offset < data.len() {
                    // Leggi stringa null-terminated
                    let mut name = String::new();
                    let mut pos = name_file_offset;
                    while pos < data.len() && data[pos] != 0 && name.len() < 256 {
                        name.push(data[pos] as char);
                        pos += 1;
                    }
                    if !name.is_empty() {
                        dll_names.push(name.to_lowercase());
                    }
                }

                idx += 20;
            }
            break;
        }
    }

    // Mappa DLL → Engine (ordine specifico → generico)
    for dll in &dll_names {
        // Unity
        if dll.contains("unityplayer") || dll.contains("mono-2.0") || dll.contains("il2cpp") {
            return Some(GameEngine::Unity);
        }
        // Godot
        if dll.contains("godot") || dll.contains("libgodot") {
            return Some(GameEngine::Godot);
        }
        // GameMaker
        if dll.contains("yoyo") || dll.contains("gamemaker") {
            return Some(GameEngine::GameMaker);
        }
        // CryEngine
        if dll.contains("crysystem") || dll.contains("cryrender") || dll.contains("cryaction") {
            return Some(GameEngine::CryEngine);
        }
        // Frostbite
        if dll.contains("frostbite") || dll.contains("fbcore") {
            return Some(GameEngine::Frostbite);
        }
        // REDengine
        if dll.contains("redengine") || dll.contains("w2rc") {
            return Some(GameEngine::REDengine);
        }
        // RE Engine
        if dll.contains("re_engine") || dll.contains("via.dll") {
            return Some(GameEngine::REEngine);
        }
        // Source Engine
        if dll.contains("tier0") && dll.contains("vstdlib") {
            return Some(GameEngine::Source);
        }
        // MonoGame/XNA
        if dll.contains("monogame") || dll.contains("fna.dll") || dll.contains("sdl2.dll") && dll_names.iter().any(|d| d.contains("fna")) {
            return Some(GameEngine::MonoGame);
        }
        // Haxe/HashLink
        if dll.contains("hashlink") || dll.contains("hl.dll") || dll.contains("libhl") {
            return Some(GameEngine::Haxe);
        }
        // LOVE2D
        if dll.contains("love.dll") || dll.contains("lua51") && dll_names.iter().any(|d| d.contains("sdl2")) {
            return Some(GameEngine::Love2D);
        }
        // RPG Maker (RGSS)
        if dll.contains("rgss") {
            return Some(GameEngine::RPGMaker);
        }
        // Ren'Py (Python)
        if dll.contains("python") && dll_names.iter().any(|d| d.contains("sdl2")) {
            return Some(GameEngine::RenPy);
        }
        // Cocos2d
        if dll.contains("cocos2d") || dll.contains("libcocos") {
            return Some(GameEngine::Cocos2d);
        }
        // Defold
        if dll.contains("defold") || dll.contains("dmengine") {
            return Some(GameEngine::Defold);
        }
    }

    // Check Source Engine via combined DLL presence
    let has_tier0 = dll_names.iter().any(|d| d.contains("tier0"));
    let has_vstdlib = dll_names.iter().any(|d| d.contains("vstdlib"));
    if has_tier0 && has_vstdlib {
        return Some(GameEngine::Source);
    }

    None
}
