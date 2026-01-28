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
    // Check for Engine folder
    if path.join("Engine").exists() && path.join("Engine/Binaries").exists() {
        return true;
    }
    
    // Check for .pak files directly in root (common in packaged UE games)
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "pak" {
                    return true;
                }
            }
        }
    }
    
    // Check for GameName/Binaries/Win64 or Content/Paks
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    let entry_path = entry.path();
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    
                    // Avoid Engine folder here, we are looking for Project folder
                    if name != "engine" {
                        // Standard UE structure
                        if entry_path.join("Binaries/Win64").exists() 
                            || entry_path.join("Content/Paks").exists()
                            || entry_path.join("Content").exists() {
                            return true;
                        }
                        
                        // Check for .pak files in subdirectories
                        if let Ok(sub_entries) = std::fs::read_dir(&entry_path) {
                            for sub in sub_entries.flatten() {
                                if let Some(ext) = sub.path().extension() {
                                    if ext == "pak" {
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Check for common Unreal descriptor files (.uproject)
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "uproject" {
                    return true;
                }
            }
        }
    }
    
    // Check for UE4/UE5 specific DLLs
    let ue_dlls = [
        "UE4Game.dll", "UE4Game-Win64-Shipping.dll",
        "UE5Game.dll", "UnrealEditor.dll",
        "PhysX3_x64.dll", "PhysX3Common_x64.dll",  // PhysX (common in UE4)
        "nvToolsExt64_1.dll",  // NVIDIA tools (UE4)
    ];
    for dll in ue_dlls {
        if path.join(dll).exists() {
            return true;
        }
    }
    
    // Deep scan: check for -WindowsNoEditor or similar UE packaging patterns
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.contains("WindowsNoEditor") 
                || name.contains("Windows")
                || name.ends_with("Game") {
                let sub_path = entry.path();
                if sub_path.is_dir() {
                    // Check for Content folder inside
                    if sub_path.join("Content").exists() {
                        return true;
                    }
                }
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
    if bin.exists() {
        if bin.join("engine.dll").exists() 
            || bin.join("vstdlib.dll").exists()
            || bin.join("tier0.dll").exists() {
            return true;
        }
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
                if entry.path().extension().map_or(false, |e| e == "ttarch" || e == "ttarch2") {
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
    
    // 🔶 UNITY ENGINE (1000+ giochi)
    let unity_games = [
        // Indie famosi
        "hollow knight", "cuphead", "ori and", "cities skylines", "kerbal space program",
        "subnautica", "the forest", "green hell", "rust", "7 days to die",
        "valheim", "raft", "slime rancher", "a hat in time", "shovel knight",
        "katana zero", "hotline miami", "nuclear throne", "risk of rain",
        "dead cells", "enter the gungeon", "spelunky", "celeste", "super meat boy",
        "the binding of isaac", "fez", "braid", "limbo", "inside", "little nightmares",
        "ori and the blind forest", "ori and the will", "steamworld", "papers please",
        "firewatch", "the witness", "what remains of edith finch", "stanley parable",
        "untitled goose game", "among us", "fall guys", "phasmophobia", "devour",
        // Horror Unity
        "lethal company", "content warning", "forewarned", "ghost watchers", "demonologist",
        "the backrooms", "poppy playtime", "bendy and the ink", "hello neighbor", "fnaf",
        "five nights at freddy", "amnesia", "soma", "penumbra", "frictional",
        // Survival/Crafting Unity
        "don't starve", "oxygen not included", "rimworld", "prison architect", "factorio",
        "satisfactory", "astroneer", "grounded", "stranded deep", "the long dark",
        "project zomboid", "cataclysm", "unturned", "scrap mechanic", "trailmakers",
        // Roguelike/Action Unity
        "hades", "slay the spire", "monster train", "cult of the lamb", "vampire survivors",
        "brotato", "20 minutes till dawn", "gunfire reborn", "roboquest", "synthetik",
        // AAA con Unity
        "hearthstone", "legends of runeterra", "gwent", "monument valley", "alto's",
        "tarkov", "escape from tarkov", "battlestate", "marauders", "the cycle",
        // VR Unity
        "beat saber", "job simulator", "vacation simulator", "superhot vr", "pistol whip",
        "moss", "arizona sunshine", "pavlov vr", "onward", "gorilla tag",
        "vrchat", "rec room", "bigscreen", "demeo", "walkabout mini golf",
        // Simulatori Unity
        "cities skylines 2", "planet zoo", "planet coaster", "two point hospital",
        "two point campus", "parkitect", "megaquarium", "softwareincdev",
        // Mobile/Multiplat
        "pokémon go", "mario kart tour", "call of duty mobile", "pubg mobile", "genshin impact"
    ];
    
    // 🔷 UNREAL ENGINE (500+ giochi)
    let unreal_games = [
        // Epic/AAA
        "fortnite", "borderlands", "bioshock", "mass effect", "gears of war",
        "rocket league", "dead by daylight", "ark survival", "pubg", "squad",
        "hell let loose", "post scriptum", "rising storm", "red orchestra",
        "killing floor", "tripwire", "deep rock galactic", "sea of thieves",
        "state of decay", "scorn", "the ascent", "outriders", "remnant",
        "atomic heart", "hogwarts legacy", "jedi survivor", "jedi fallen order",
        "black myth wukong", "lies of p", "lords of the fallen", "mortal shell",
        // VR Games Unreal
        "a wake inn", "half-life: alyx", "boneworks", "bonelab", "blade & sorcery",
        "into the radius", "vertigo", "asgard's wrath", "stormland", "lone echo",
        "medal of honor: above and beyond", "sniper elite vr", "walking dead saints",
        "after the fall", "green hell vr", "kayak vr", "red matter", "hubris",
        "ghostbusters vr", "jurassic world aftermath", "wraith the oblivion",
        // Horror Unreal
        "outlast", "outlast 2", "outlast trials", "alien isolation", "the callisto protocol",
        "dead space", "dead space remake", "silent hill", "evil dead the game",
        "dying light 2", "dead island 2", "sons of the forest", "the forest 2",
        // Fighting games
        "mortal kombat", "injustice", "street fighter", "tekken", "dragon ball",
        "guilty gear", "blazblue", "granblue fantasy", "under night",
        // Battle Royale/Shooter
        "valorant", "overwatch", "paladins", "rogue company", "the finals",
        "spellbreak", "darwin project", "realm royale", "hyperscape", "xdefiant",
        // Soulslike/Action Unreal
        "elden ring", "armored core", "sekiro", "dark souls", "bloodborne",
        "nioh", "wo long", "steelrising", "thymesia", "dolmen",
        // RPG/Adventure UE4
        "kingdom hearts", "final fantasy vii remake", "final fantasy xvi", "ff7",
        "nier automata", "nier replicant", "scarlet nexus", "tales of arise",
        "code vein", "god eater", "dragon quest", "octopath traveler",
        // Racing/Sports
        "forza", "dirt 5", "grid legends", "hot wheels unleashed",
        // Indie Horror UE
        "emotionless", "the last ticket", "visage", "madison", "infliction",
        "devotion", "detention", "home sweet home", "pamali", "dreadout"
    ];
    
    // 🟠 SOURCE ENGINE (Valve + licensees)
    let source_games = [
        "half-life", "counter-strike", "portal", "team fortress", "left 4 dead",
        "dota 2", "black mesa", "garry's mod", "titanfall", "apex legends",
        "the stanley parable", "dear esther", "insurgency", "day of defeat",
        "vampire the masquerade bloodlines", "zeno clash", "postal"
    ];
    
    // 🟫 CREATION ENGINE (Bethesda)
    let creation_games = [
        "fallout", "elder scrolls", "skyrim", "oblivion", "morrowind", "starfield"
    ];
    
    // 🔴 CRYENGINE
    let cryengine_games = [
        "far cry", "crysis", "hunt showdown", "kingdom come deliverance",
        "star citizen", "squadron 42", "robinson the journey", "the climb",
        "ryse son of rome", "warface", "archeage", "aion"
    ];
    
    // 🟢 FROSTBITE (EA)
    let frostbite_games = [
        "battlefield", "mirror's edge", "need for speed", "fifa", "madden nfl",
        "star wars battlefront", "anthem", "mass effect andromeda", "dragon age inquisition"
    ];
    
    // 🔵 PROPRIETARY ENGINES
    let rage_games = ["grand theft auto", "red dead redemption", "max payne", "midnight club"];
    let anvil_games = ["assassin's creed", "watch dogs", "for honor", "skull and bones"];
    let dunia_games = ["far cry 2", "far cry 3", "far cry 4", "far cry primal"];
    let chrome_games = ["metro", "4a games"];
    let aurora_games = ["neverwinter nights", "dragon age origins", "mass effect 1"];
    let gamebryo_games = ["fallout 3", "fallout new vegas", "oblivion", "morrowind"];
    let id_tech_games = ["doom", "quake", "wolfenstein", "rage", "evil within"];
    let decima_games = ["horizon zero dawn", "death stranding"];
    let fox_games = ["metal gear solid v", "pro evolution soccer"];
    let snowdrop_games = ["the division", "mario + rabbids", "skull and bones"];
    let rei_games = ["resident evil", "devil may cry", "monster hunter", "street fighter"];
    let mt_framework_games = ["resident evil 4", "resident evil 5", "resident evil 6", "lost planet"];
    
    // 🎲 INDIE ENGINES
    let godot_games = [
        "sonic colors ultimate", "the interactive adventures of dog mendonça",
        "cassette beasts", "cruelty squad", "dome keeper", "brotato", "david lynch"
    ];
    let gamemaker_games = [
        "undertale", "deltarune", "hyper light drifter", "hotline miami", "spelunky",
        "nuclear throne", "decarnation", "katana zero", "shovel knight", "downwell",
        "minit", "forager", "moonlighter", "eastward", "chicory", "heartbound",
        "everhood", "omori", "oneshot", "lisa the painful", "yume nikki",
        "ib", "ao oni", "corpse party", "mad father", "witch's house"
    ];
    
    // 🎮 RPG MAKER
    let rpgmaker_games = [
        "to the moon", "finding paradise", "rakuen", "oneshot", "ib",
        "corpse party", "mad father", "witch's house", "misao", "yume nikki",
        "lisa", "off", "space funeral", "jimmy and the pulsating mass",
        "omori", "hello charlotte", "mogeko castle", "the gray garden"
    ];
    
    // 🐍 REN'PY (Visual Novels)
    let renpy_games = [
        "doki doki literature club", "ddlc", "katawa shoujo", "long live the queen",
        "butterfly soup", "a summer's end", "highway blossoms", "ladykiller in a bind",
        "analogue a hate story", "hate plus", "va-11 hall-a", "coffee talk"
    ];
    
    // Controllo specifico per nome (ordinato per priorità)
    if rage_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("RAGE Engine".to_string());
    }
    if anvil_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Anvil Engine".to_string());
    }
    if frostbite_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Frostbite".to_string());
    }
    if cryengine_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("CryEngine".to_string());
    }
    if decima_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Decima Engine".to_string());
    }
    if fox_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("FOX Engine".to_string());
    }
    if snowdrop_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Snowdrop".to_string());
    }
    if rei_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("RE Engine".to_string());
    }
    if mt_framework_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("MT Framework".to_string());
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
    if dunia_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Dunia Engine".to_string());
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
    if rpgmaker_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("RPG Maker".to_string());
    }
    if renpy_games.iter().any(|&game| name_lower.contains(game)) {
        return Some("Ren'Py".to_string());
    }
    
    // Rilevamento generico basato su pattern nel nome
    if name_lower.contains("unity") {
        return Some("Unity".to_string());
    }
    if name_lower.contains("unreal") {
        return Some("Unreal Engine".to_string());
    }
    if name_lower.contains("source") {
        return Some("Source Engine".to_string());
    }
    if name_lower.contains("cryengine") || name_lower.contains("cry engine") {
        return Some("CryEngine".to_string());
    }
    if name_lower.contains("frostbite") {
        return Some("Frostbite".to_string());
    }
    
    // Pattern addizionali per giochi comuni
    if name_lower.contains("fifa") || name_lower.contains("madden") || name_lower.contains("battlefield") {
        return Some("Frostbite".to_string());
    }
    if name_lower.contains("call of duty") || name_lower.contains("warzone") {
        return Some("IW Engine".to_string());
    }
    if name_lower.contains("minecraft") {
        return Some("Java/C++".to_string());
    }
    
    None
}
