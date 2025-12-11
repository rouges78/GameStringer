use std::path::Path;

#[derive(Debug, PartialEq, Clone)]
pub enum GameEngine {
    Unity,
    Unreal,
    Godot,
    RPGMaker,
    RenPy,
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
            GameEngine::Unknown => "Unknown",
        }
    }
}

pub fn detect_engine(game_path: &Path) -> GameEngine {
    if !game_path.exists() {
        return GameEngine::Unknown;
    }

    if is_unity(game_path) {
        return GameEngine::Unity;
    }
    
    if is_unreal(game_path) {
        return GameEngine::Unreal;
    }
    
    if is_godot(game_path) {
        return GameEngine::Godot;
    }
    
    if is_rpg_maker(game_path) {
        return GameEngine::RPGMaker;
    }
    
    if is_renpy(game_path) {
        return GameEngine::RenPy;
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
    
    // Check for GameName/Binaries/Win64
    // Usually Unreal games have a folder with the Project Name, and inside Binaries
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    let entry_path = entry.path();
                    // Avoid Engine folder here, we are looking for Project folder
                    if entry.file_name() != "Engine" {
                        if entry_path.join("Binaries/Win64").exists() || entry_path.join("Content/Paks").exists() {
                             return true;
                        }
                    }
                }
            }
        }
    }
    
    // Check for common Unreal descriptor files
    // .uproject file?
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "uproject" {
                    return true;
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
        // AAA con Unity
        "hearthstone", "legends of runeterra", "gwent", "monument valley", "alto's",
        "beat saber", "job simulator", "vacation simulator", "superhot vr", "pistol whip",
        "moss", "arizona sunshine", "pavlov vr", "onward", "blade and sorcery",
        "boneworks", "half-life alyx", "vrchat", "rec room", "bigscreen",
        // Mobile/Multiplat
        "pokémon go", "mario kart tour", "call of duty mobile", "pubg mobile"
    ];
    
    // 🔷 UNREAL ENGINE (500+ giochi)
    let unreal_games = [
        // Epic/AAA
        "fortnite", "borderlands", "bioshock", "mass effect", "gears of war",
        "rocket league", "dead by daylight", "ark survival", "pubg", "squad",
        "hell let loose", "post scriptum", "rising storm", "red orchestra",
        "killing floor", "tripwire", "deep rock galactic", "sea of thieves",
        "state of decay", "scorn", "the ascent", "outriders", "remnant",
        // Fighting games
        "mortal kombat", "injustice", "street fighter", "tekken", "dragon ball",
        "guilty gear", "blazblue", "granblue fantasy", "under night",
        // Battle Royale/Shooter
        "apex legends", "valorant", "overwatch", "paladins", "rogue company",
        "spellbreak", "darwin project", "realm royale", "hyperscape",
        // Horror/Indie UE4
        "phasmophobia", "the dark pictures", "until dawn", "man of medan",
        "little hope", "house of ashes", "layers of fear", "observer",
        "blair witch", "the medium", "visage", "madison", "outlast",
        // RPG/Adventure UE4
        "kingdom hearts", "final fantasy vii remake", "nier automata", "nier replicant",
        "scarlet nexus", "tales of arise", "code vein", "god eater", "bandai namco"
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
    let godot_games = ["sonic colors ultimate", "the interactive adventures of dog mendonça"];
    let gamemaker_games = ["undertale", "hyper light drifter", "hotline miami", "spelunky", "nuclear throne"];
    
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
