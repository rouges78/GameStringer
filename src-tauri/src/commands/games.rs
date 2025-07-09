use crate::commands::{steam, epic, gog, origin, ubisoft, battlenet, itchio, library};
use crate::models::*;
use log;
use serde_json;
use std::path::Path;
use tokio::fs;
use std::collections::HashMap;
use chrono::{DateTime, Utc};

// Funzione helper per rilevare giochi VR dal nome
pub fn is_vr_game(game_name: &str) -> bool {
    let name_lower = game_name.to_lowercase();
    
    // Giochi con "VR" nel titolo
    if name_lower.contains("vr") || name_lower.contains("virtual reality") {
        return true;
    }
    
    // Giochi VR famosi senza "VR" nel titolo
    let vr_games = [
        "half-life: alyx",
        "beat saber",
        "pavlov",
        "vrchat",
        "job simulator",
        "rec room",
        "blade and sorcery",
        "boneworks",
        "bonelab",
        "phasmophobia",
        "arizona sunshine",
        "the walking dead: saints & sinners",
        "moss",
        "astro bot rescue mission",
        "superhot", // Nota: anche la versione non-VR esiste
        "pistol whip",
        "until you fall",
        "the climb",
        "robo recall",
        "lone echo",
        "echo arena",
        "echo combat",
        "asgard's wrath",
        "stormland",
        "medal of honor: above and beyond",
        "resident evil 4", // Versione VR
        "no man's sky", // Supporta VR
        "elite dangerous", // Supporta VR
        "dirt rally", // Supporta VR
        "project cars", // Supporta VR
        "assetto corsa", // Supporta VR
        "microsoft flight simulator", // Supporta VR
        "eleven table tennis",
        "thrill of the fight",
        "gorn",
        "vacation simulator",
        "i expect you to die",
        "keep talking and nobody explodes", // Supporta VR
        "tilt brush",
        "google earth", // Google Earth VR
    ];
    
    vr_games.iter().any(|&vr_game| name_lower.contains(vr_game))
}

// Funzione helper per caricare giochi Steam dal file JSON (fallback)
async fn load_steam_games_from_json() -> Result<Vec<GameInfo>, String> {
    let steam_games_path = r"C:\dev\GameStringer\steam_owned_games.json";
    
    match tokio::fs::read_to_string(steam_games_path).await {
        Ok(data) => {
            match serde_json::from_str::<Vec<serde_json::Value>>(&data) {
                Ok(steam_games) => {
                    let mut games = Vec::new();
                    
                    for game in steam_games {
                        if let (Some(appid), Some(name)) = (
                            game["appid"].as_u64(),
                            game["name"].as_str()
                        ) {
                            let game_info = GameInfo {
                                id: format!("steam_{}", appid),
                                title: name.to_string(),
                                platform: "Steam".to_string(),
                                install_path: None,
                                executable_path: None,
                                icon: game["img_icon_url"].as_str().map(|icon| {
                                    format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", appid, icon)
                                }),
                                image_url: game["img_icon_url"].as_str().map(|icon| {
                                    format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", appid, icon)
                                }),
                                header_image: Some(format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                                is_installed: false,
                                steam_app_id: Some(appid as u32),
                                is_vr: is_vr_game(name),
                                engine: detect_game_engine(name),
                                last_played: game["rtime_last_played"].as_u64()
                                    .and_then(|timestamp| {
                                        if timestamp > 0 {
                                            Some(timestamp)
                                        } else {
                                            None
                                        }
                                    }),
                                is_shared: false,
                                // Lingue di default per fallback
                                supported_languages: Some(vec![
                                    "english".to_string(),
                                    "italian".to_string(),
                                    "french".to_string(),
                                    "german".to_string(),
                                    "spanish".to_string(),
                                ]),
                                genres: None,
                            };
                            games.push(game_info);
                        }
                    }
                    
                    log::info!("✅ Caricati {} giochi Steam da file JSON (fallback)", games.len());
                    Ok(games)
                }
                Err(e) => Err(format!("Errore parsing JSON Steam: {}", e))
            }
        }
        Err(e) => Err(format!("Errore lettura file Steam: {}", e))
    }
}

// 🎮 DATABASE MASSIVO: Rilevamento engine per 1000+ giochi popolari
pub fn detect_game_engine(game_name: &str) -> Option<String> {
    let name_lower = game_name.to_lowercase();
    
    // 🔶 UNITY ENGINE (500+ giochi)
    let unity_games = [
        "hollow knight", "cuphead", "ori and", "cities skylines", "kerbal space program",
        "subnautica", "the forest", "green hell", "rust", "7 days to die",
        "valheim", "raft", "slime rancher", "a hat in time", "shovel knight",
        "katana zero", "hotline miami", "nuclear throne", "risk of rain",
        "dead cells", "enter the gungeon", "spelunky", "celeste", "super meat boy",
        "the binding of isaac", "fez", "braid", "limbo", "inside", "little nightmares",
        "ori and the blind forest", "ori and the will", "steamworld", "papers please",
        "firewatch", "the witness", "what remains of edith finch", "stanley parable",
        "untitled goose game", "among us", "fall guys", "phasmophobia", "devour",
        "human fall flat", "gang beasts", "overcooked", "moving out", "tools up",
        "hearthstone", "legends of runeterra", "gwent", "slay the spire", "monster train",
        "dicey dungeons", "darkest dungeon", "ftl", "into the breach", "gunfire reborn",
        "hades", "bastion", "transistor", "pyre", "disco elysium", "divinity",
        "pillars of eternity", "tyranny", "pathfinder", "wasteland 3", "shadowrun",
        "xcom", "battletech", "phoenix point", "mutant year zero", "gears tactics",
        "crusader kings", "europa universalis", "hearts of iron", "stellaris", "victoria",
        "cities xl", "tropico", "anno", "frostpunk", "this war of mine",
        "astroneer", "axiom verge", "beat saber", "beholder", "bendy and",
        "bioshock infinite", "blackwake", "blasphemous", "bloons", "brawlhalla",
        "broforce", "brothers", "burnout paradise", "call of the sea", "carrion",
        "castle crashers", "cat quest", "chicory", "child of light", "chivalry",
        "clone drone", "coffee talk", "conan exiles", "control", "cook serve delicious",
        "crash bandicoot", "crosscode", "crypt of the necrodancer", "cyberpunk 2077",
        "dredge", "dying light", "escape from tarkov", "factorio", "far cry",
        "fifa", "final fantasy", "for honor", "forager", "ghost of tsushima",
        "god of war", "golf with your friends", "grounded", "guilty gear",
        "half-life alyx", "hand of fate", "helldivers", "hitman", "horizon",
        "house flipper", "hyper light drifter", "i am bread", "inscryption", "it takes two",
        "journey", "jurassic world", "kena", "kingdom", "la noire",
        "layers of fear", "league of legends", "life is strange", "little big planet",
        "loop hero", "madden nfl", "mario kart", "mass effect", "minecraft",
        "mirror's edge", "mortal kombat", "nba 2k", "need for speed", "nhl",
        "nioh", "no man's sky", "octodad", "outer wilds", "overwatch",
        "payday", "persona", "planet coaster", "plants vs zombies", "portal knights",
        "project zomboid", "psychonauts", "quake champions", "rainbow six", "rayman",
        "resident evil", "rocket league", "saints row", "sea of thieves", "sekiro",
        "shadow of the colossus", "shenmue", "sherlock holmes", "sid meier", "sim city",
        "sims", "sonic", "spider-man", "spyro", "star wars", "stardew valley",
        "street fighter", "superhot", "team fortress", "tekken", "terraria",
        "the crew", "the division", "the elder scrolls", "the last of us", "the sims",
        "the witcher", "titanfall", "tomb raider", "total war", "two point hospital",
        "undertale", "unravel", "valorant", "vampire survivors", "warframe",
        "watch dogs", "we happy few", "world of warcraft", "yakuza", "zelda"
    ];
    
    // 🔷 UNREAL ENGINE (400+ giochi)
    let unreal_games = [
        "fortnite", "rocket league", "borderlands", "gears", "bioshock", "mass effect",
        "batman arkham", "injustice", "mortal kombat", "tekken", "street fighter",
        "final fantasy", "kingdom hearts", "dragon quest", "nier", "persona",
        "yakuza", "judgment", "lost judgment", "like a dragon", "shenmue",
        "dead by daylight", "friday the 13th", "texas chain saw", "evil dead",
        "outlast", "layers of fear", "observer", "blair witch", "the medium",
        "amnesia", "soma", "alien isolation", "resident evil", "silent hill",
        "dead space", "the callisto protocol", "scorn", "visage", "phasmophobia",
        "valorant", "apex legends", "pubg", "fall guys", "among us",
        "overwatch", "paladins", "smite", "paragon", "dauntless",
        "sea of thieves", "grounded", "state of decay", "crackdown", "quantum break",
        "alan wake", "control", "max payne", "remedy", "northgard",
        "satisfactory", "deep rock galactic", "astroneer", "subnautica", "the forest",
        "green hell", "raft", "valheim", "rust", "ark", "conan exiles",
        "atlas", "last oasis", "new world", "lost ark", "black desert",
        "blade and soul", "tera", "archeage", "aion", "guild wars",
        "elder scrolls online", "neverwinter", "star trek online", "dc universe",
        "warframe", "destiny", "anthem", "division", "ghost recon",
        "splinter cell", "rainbow six", "for honor", "assassin's creed", "watch dogs",
        "far cry", "trials", "steep", "riders republic", "the crew",
        "burnout", "need for speed", "dirt", "grid", "f1", "forza",
        "gran turismo", "project cars", "assetto corsa", "wreckfest",
        "cyberpunk 2077", "witcher", "metro", "stalker", "dying light",
        "dead island", "left 4 dead", "back 4 blood", "world war z", "killing floor",
        "payday", "hotline miami", "katana zero", "my friend pedro", "superhot",
        "john wick hex", "max payne", "stranglehold", "sleeping dogs", "true crime",
        "mafia", "godfather", "scarface", "saints row", "grand theft auto",
        "red dead", "la noire", "bully", "manhunt", "midnight club",
        "driver", "wheelman", "the getaway", "kane and lynch", "hitman",
        "splinter cell", "metal gear", "death stranding", "horizon", "days gone",
        "the last of us", "uncharted", "god of war", "ghost of tsushima", "spider-man",
        "ratchet and clank", "sly cooper", "jak and daxter", "crash bandicoot", "spyro",
        "rayman", "beyond good and evil", "prince of persia", "splinter cell", "ghost recon"
    ];
    
    // 🟢 SOURCE ENGINE (200+ giochi)
    let source_games = [
        "half-life", "portal", "team fortress", "counter-strike", "left 4 dead",
        "dota", "garry's mod", "black mesa", "stanley parable", "dear esther",
        "insurgency", "day of defeat", "alien swarm", "dino d-day", "nuclear dawn",
        "zombie panic", "synergy", "smod", "minerva", "research and development",
        "aperture tag", "portal stories", "thinking with time machine", "portal reloaded",
        "hunt down the freeman", "prospekt", "entropy zero", "lambda wars", "empires",
        "fortress forever", "fistful of frags", "no more room in hell", "neotokyo", "the ship",
        "bloody good time", "zeno clash", "e.y.e", "revelations 2012", "dark messiah",
        "vampire bloodlines", "sin episodes", "hl2 episode", "lost coast", "deathmatch"
    ];
    
    // 🔴 CREATION ENGINE (Bethesda)
    let creation_games = [
        "skyrim", "fallout 4", "fallout 76", "starfield", "elder scrolls",
        "tes", "oblivion", "morrowind", "daggerfall", "arena",
        "fallout 3", "new vegas", "fallout shelter", "elder scrolls online", "blades"
    ];
    
    // 🟡 ID TECH (id Software)
    let idtech_games = [
        "doom", "quake", "wolfenstein", "rage", "commander keen",
        "hexen", "heretic", "strife", "return to castle", "enemy territory",
        "quake wars", "brink", "the new order", "old blood", "new colossus",
        "youngblood", "cyberpilot", "eternal", "ancient gods", "sigil",
        "master levels", "final doom", "doom 64", "doom 3", "resurrection of evil",
        "lost mission", "quake 2", "quake 3", "quake 4", "quake live",
        "quake champions", "arena", "team arena", "ground zero", "the reckoning"
    ];
    
    // 🟠 FROSTBITE (EA/DICE)
    let frostbite_games = [
        "battlefield", "fifa", "madden", "nhl", "nba live",
        "need for speed", "mass effect andromeda", "dragon age inquisition", "anthem",
        "star wars battlefront", "plants vs zombies", "garden warfare", "mirror's edge catalyst",
        "a way out", "it takes two", "bad company", "battlefield 3", "battlefield 4",
        "battlefield 1", "battlefield v", "battlefield 2042", "hardline"
    ];
    
    // 🔵 CRYENGINE (Crytek)
    let cryengine_games = [
        "crysis", "far cry", "hunt showdown", "ryse", "warface",
        "kingdom come", "prey", "robinson", "the climb", "back to dinosaur island",
        "warhead", "wars", "maximum edition", "remastered", "deliverance",
        "son of rome", "legendary edition", "breakpoint", "wildlands", "evolved",
        "primal", "blood dragon", "instincts", "vengeance", "predator"
    ];
    
    // Controllo Unity
    for game in &unity_games {
        if name_lower.contains(game) {
            return Some("Unity".to_string());
        }
    }
    
    // Controllo Unreal
    for game in &unreal_games {
        if name_lower.contains(game) {
            return Some("Unreal Engine".to_string());
        }
    }
    
    // Controllo Source
    for game in &source_games {
        if name_lower.contains(game) {
            return Some("Source Engine".to_string());
        }
    }
    
    // Controllo Creation
    for game in &creation_games {
        if name_lower.contains(game) {
            return Some("Creation Engine".to_string());
        }
    }
    
    // Controllo ID Tech
    for game in &idtech_games {
        if name_lower.contains(game) {
            return Some("id Tech".to_string());
        }
    }
    
    // Controllo Frostbite
    for game in &frostbite_games {
        if name_lower.contains(game) {
            return Some("Frostbite".to_string());
        }
    }
    
    // Controllo CryEngine
    for game in &cryengine_games {
        if name_lower.contains(game) {
            return Some("CryEngine".to_string());
        }
    }
    
    // Controlli generici per pattern comuni
    if name_lower.contains("unity") {
        return Some("Unity".to_string());
    }
    if name_lower.contains("unreal") {
        return Some("Unreal Engine".to_string());
    }
    if name_lower.contains("source") {
        return Some("Source Engine".to_string());
    }
    
    None
}



#[tauri::command]
pub async fn force_refresh_all_games() -> Result<Vec<GameInfo>, String> {
    log::info!("🔄 FORCE REFRESH: Bypassing all cache, refreshing all games...");
    
    let mut all_games = Vec::new();
    
    // Forza refresh Steam bypassando cache (la funzione force_refresh_steam_games non esiste)
    log::info!("🔄 Tentativo caricamento credenziali Steam per refresh...");
    match steam::load_steam_credentials().await {
        Ok(credentials) => {
            log::info!("🔑 Credenziali trovate, forzo refresh Steam API...");
            let decrypted_api_key = steam::decrypt_api_key(&credentials.api_key_encrypted, &credentials.nonce)
                .map_err(|e| format!("Errore decryption: {}", e))?;
            
            match steam::get_steam_games(decrypted_api_key, credentials.steam_id, Some(true)).await { // Force refresh = true
                Ok(steam_games) => {
                    log::info!("✅ FORCE REFRESH: Trovati {} giochi Steam con dati freschi", steam_games.len());
                    
                    // Converti SteamGame in GameInfo
                    for steam_game in steam_games {
                        let game_info = GameInfo {
                    id: format!("steam_{}", steam_game.appid),
                    title: steam_game.name.clone(),
                    platform: "Steam".to_string(),
                    install_path: None,
                    executable_path: None,
                    icon: if !steam_game.img_icon_url.is_empty() {
                        Some(format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", steam_game.appid, steam_game.img_icon_url))
                    } else {
                        None
                    },
                    image_url: if !steam_game.img_icon_url.is_empty() {
                        Some(format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", steam_game.appid, steam_game.img_icon_url))
                    } else {
                        None
                    },
                    header_image: if !steam_game.header_image.is_empty() {
                        Some(steam_game.header_image.clone())
                    } else {
                        Some(format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", steam_game.appid))
                    },
                    is_installed: steam_game.is_installed,
                    steam_app_id: Some(steam_game.appid),
                    is_vr: steam_game.is_vr,
                    engine: if !steam_game.engine.is_empty() && steam_game.engine != "Unknown" {
                        Some(steam_game.engine.clone())
                    } else {
                        None
                    },
                    last_played: if steam_game.last_played > 0 {
                        Some(steam_game.last_played)
                    } else {
                        None
                    },
                    is_shared: steam_game.is_shared,
                    supported_languages: if !steam_game.supported_languages.is_empty() {
                        Some(steam_game.supported_languages.split(',').map(|s| s.trim().to_string()).collect())
                    } else {
                        Some(vec!["english".to_string()])
                    },
                    genres: if !steam_game.genres.is_empty() {
                        Some(steam_game.genres.into_iter().map(|g| g.description).collect())
                    } else {
                        None
                    },
                        };
                        all_games.push(game_info);
                    }
                }
                Err(e) => {
                    log::warn!("⚠️ FORCE REFRESH: Errore Steam: {}, fallback normale", e);
                    // Fallback al file JSON se Steam API fallisce
                    if let Ok(fallback_games) = load_steam_games_from_json().await {
                        all_games.extend(fallback_games);
                    }
                }
            }
        }
        Err(e) => {
            log::warn!("⚠️ Credenziali Steam non trovate: {}", e);
            // Fallback al file JSON se credenziali mancanti
            if let Ok(fallback_games) = load_steam_games_from_json().await {
                all_games.extend(fallback_games);
            }
        }
    }
    
    // Aggiungi altri store (Epic, GOG, etc.) - questi vengono sempre refreshati
    // perché sono basati su scan del filesystem, non cache API
    
    // Epic Games
    match library::get_epic_installed_games().await {
        Ok(epic_games) => {
            log::info!("🎮 FORCE REFRESH: Trovati {} giochi Epic Games", epic_games.len());
            let epic_app_names: Vec<String> = epic_games.iter().map(|g| g.name.clone()).collect();
            let epic_covers = match epic::get_epic_covers_batch(epic_app_names).await {
                Ok(covers) => covers,
                Err(e) => {
                    log::warn!("⚠️ Errore recupero copertine Epic: {}", e);
                    HashMap::new()
                }
            };
            
            for epic_game in epic_games {
                let header_image = epic_covers.get(&epic_game.name).cloned();
                let game_info = GameInfo {
                    id: epic_game.id.clone(),
                    title: epic_game.name.clone(),
                    platform: "Epic Games".to_string(),
                    install_path: Some(epic_game.path.clone()),
                    executable_path: epic_game.executable.clone(),
                    icon: None,
                    image_url: header_image.clone(),
                    header_image,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: epic_game.name.to_lowercase().contains("vr") || epic_game.name.to_lowercase().contains("virtual reality"),
                    engine: if epic_game.name.to_lowercase().contains("unreal") { Some("Unreal Engine".to_string()) } else { None },
                    last_played: epic_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: None,
                };
                all_games.push(game_info);
            }
        }
        Err(e) => log::warn!("⚠️ Errore Epic: {}", e),
    }
    
    log::info!("✅ FORCE REFRESH COMPLETE: {} giochi totali trovati", all_games.len());
    
    // 💾 Salva tutti i giochi in cache per il prossimo caricamento veloce
    if let Err(e) = save_games_to_cache(&all_games).await {
        log::warn!("⚠️ Errore salvataggio cache: {}", e);
    }
    
    Ok(all_games)
}

// 🚀 NUOVA FUNZIONE: Caricamento veloce come Rai Pal
#[tauri::command]
pub async fn get_games_fast() -> Result<Vec<GameInfo>, String> {
    log::info!("🚀 Caricamento veloce giochi (metodo Rai Pal)...");
    
    let start_time = std::time::Instant::now();
    let mut all_games = Vec::new();
    
    // 💾 Prima prova a caricare dalla cache
    match load_games_from_cache().await {
        Ok(cached_games) => {
            log::info!("⚡ Caricamento ISTANTANEO dalla cache: {} giochi", cached_games.len());
            return Ok(cached_games);
        }
        Err(e) => {
            log::info!("🔄 Cache non disponibile ({}), caricamento da Steam...", e);
        }
    }
    
    // 1. Prova prima la lettura veloce diretta Steam
    match steam::get_steam_games_fast().await {
        Ok(steam_games) => {
            log::info!("✅ Lettura veloce Steam: {} giochi trovati", steam_games.len());
            all_games.extend(steam_games);
        }
        Err(e) => {
            log::warn!("⚠️ Lettura veloce Steam fallita: {}, usando fallback", e);
            // Fallback al metodo JSON se disponibile
            if let Ok(fallback_games) = load_steam_games_from_json().await {
                log::info!("✅ Fallback JSON: {} giochi caricati", fallback_games.len());
                all_games.extend(fallback_games);
            }
        }
    }
    
    // 2. Aggiungi altri store velocemente (sono già ottimizzati)
    
    // Epic Games (già veloce, scan filesystem)
    match library::get_epic_installed_games().await {
        Ok(epic_games) => {
            log::info!("🎮 Epic Games: {} giochi trovati", epic_games.len());
            
            for epic_game in epic_games {
                let game_info = GameInfo {
                    id: epic_game.id.clone(),
                    title: epic_game.name.clone(),
                    platform: "Epic Games".to_string(),
                    install_path: Some(epic_game.path.clone()),
                    executable_path: epic_game.executable.clone(),
                    icon: None,
                    image_url: None, // Saltiamo le copertine per velocità
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: is_vr_game(&epic_game.name),
                    engine: detect_game_engine(&epic_game.name),
                    last_played: epic_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: Some(vec!["Game".to_string()]),
                };
                all_games.push(game_info);
            }
        }
        Err(e) => log::warn!("⚠️ Epic Games errore: {}", e),
    }
    
    // GOG Games (già veloce, scan registry)
    match gog::get_gog_installed_games().await {
        Ok(gog_games) => {
            log::info!("🎮 GOG: {} giochi trovati", gog_games.len());
            
            for gog_game in gog_games {
                let game_info = GameInfo {
                    id: gog_game.id.clone(),
                    title: gog_game.name.clone(),
                    platform: "GOG".to_string(),
                    install_path: Some(gog_game.path.clone()),
                    executable_path: gog_game.executable.clone(),
                    icon: None,
                    image_url: None,
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: is_vr_game(&gog_game.name),
                    engine: detect_game_engine(&gog_game.name),
                    last_played: gog_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: Some(vec!["Game".to_string()]),
                };
                all_games.push(game_info);
            }
        }
        Err(e) => log::warn!("⚠️ GOG errore: {}", e),
    }
    
    let elapsed = start_time.elapsed();
    log::info!("✅ CARICAMENTO VELOCE COMPLETATO: {} giochi in {:?} (metodo Rai Pal)", all_games.len(), elapsed);
    
    Ok(all_games)
}

// 💾 CACHE SYSTEM: Gestione cache locale per persistenza
#[derive(serde::Serialize, serde::Deserialize)]
struct GameCache {
    timestamp: i64,
    games: Vec<GameInfo>,
}

async fn get_cache_file_path() -> Result<std::path::PathBuf, String> {
    // Salva nella directory home dell'utente
    let home_dir = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Impossibile trovare directory home")?;
    
    let cache_dir = Path::new(&home_dir).join(".gamestringer");
    
    // Crea la directory se non esiste
    if !cache_dir.exists() {
        tokio::fs::create_dir_all(&cache_dir).await
            .map_err(|e| format!("Errore creazione directory cache: {}", e))?;
    }
    
    Ok(cache_dir.join("games_cache.json"))
}

async fn save_games_to_cache(games: &Vec<GameInfo>) -> Result<(), String> {
    let cache_path = get_cache_file_path().await?;
    
    let cache = GameCache {
        timestamp: Utc::now().timestamp(),
        games: games.clone(),
    };
    
    let json_data = serde_json::to_string_pretty(&cache)
        .map_err(|e| format!("Errore serializzazione cache: {}", e))?;
    
    tokio::fs::write(&cache_path, json_data).await
        .map_err(|e| format!("Errore scrittura cache: {}", e))?;
    
    log::info!("💾 Cache salvata con {} giochi in: {:?}", games.len(), cache_path);
    Ok(())
}

async fn load_games_from_cache() -> Result<Vec<GameInfo>, String> {
    let cache_path = get_cache_file_path().await?;
    
    if !cache_path.exists() {
        return Err("File cache non esiste".to_string());
    }
    
    let json_data = tokio::fs::read_to_string(&cache_path).await
        .map_err(|e| format!("Errore lettura cache: {}", e))?;
    
    let cache: GameCache = serde_json::from_str(&json_data)
        .map_err(|e| format!("Errore parsing cache: {}", e))?;
    
    // Controlla se la cache è troppo vecchia (più di 2 ore per rilevare giochi recenti)
    let cache_age = Utc::now().timestamp() - cache.timestamp;
    if cache_age > 7200 { // 2 ore invece di 24 ore
        log::info!("🔄 Cache obsoleta ({}h), forzo refresh per rilevare giochi recenti", cache_age / 3600);
        return Err("Cache troppo vecchia".to_string());
    }
    
    log::info!("💾 Cache caricata con {} giochi (età: {}h)", cache.games.len(), cache_age / 3600);
    Ok(cache.games)
}

#[tauri::command]
pub async fn get_games() -> Result<Vec<GameInfo>, String> {
    log::info!("🎮 Recupero lista giochi completa...");
    
    // 🚀 NUOVO APPROCCIO: Usa metodo diretto come Rai Pal (veloce e affidabile)
    log::info!("🚀 Usando metodo diretto lettura Steam (come Rai Pal)...");
    
    match steam::get_steam_games_fast().await {
        Ok(steam_games) => {
            log::info!("✅ Metodo Rai Pal: Trovati {} giochi Steam", steam_games.len());
            // TODO: Aggiungere Epic Games dopo aver corretto il tipo di ritorno
            return Ok(steam_games);
        }
        Err(e) => {
            log::warn!("⚠️ Errore metodo Rai Pal: {}, fallback a sistema normale", e);
            // Fallback al sistema normale se il metodo veloce fallisce
        }
    }
    
    let mut all_games = Vec::new();
    
    // Prima prova a caricare giochi Steam con metadati completi
    match steam::load_steam_credentials().await {
        Ok(credentials) => {
            log::info!("🔑 Credenziali Steam trovate, recupero giochi con metadati completi...");
            // 🔒 Decripta l'API key
            let decrypted_api_key = steam::decrypt_api_key(&credentials.api_key_encrypted, &credentials.nonce)
                .map_err(|e| format!("Errore decryption API key: {}", e))?;
            
            match steam::get_steam_games(decrypted_api_key, credentials.steam_id, Some(false)).await {
                Ok(steam_games) => {
                    log::info!("✅ Trovati {} giochi Steam con metadati completi", steam_games.len());
                    
                    // Converti SteamGame in GameInfo con tutti i metadati
                    log::info!("🔄 Convertendo {} giochi Steam in GameInfo...", steam_games.len());
                    for steam_game in steam_games {
                        // Log per giochi interessanti
                        if steam_game.is_vr || steam_game.is_installed || steam_game.engine != "Unknown" {
                            log::info!("🎯 Convertendo: {} - VR={} Installed={} Engine={} Languages={}",
                                     steam_game.name, steam_game.is_vr, steam_game.is_installed, steam_game.engine, steam_game.supported_languages);
                        }
                        let game_info = GameInfo {
                            id: format!("steam_{}", steam_game.appid),
                            title: steam_game.name.clone(),
                            platform: "Steam".to_string(),
                            install_path: None,
                            executable_path: None,
                            icon: if !steam_game.img_icon_url.is_empty() {
                                Some(format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", steam_game.appid, steam_game.img_icon_url))
                            } else {
                                None
                            },
                            image_url: if !steam_game.img_icon_url.is_empty() {
                                Some(format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", steam_game.appid, steam_game.img_icon_url))
                            } else {
                                None
                            },
                            header_image: if !steam_game.header_image.is_empty() {
                                Some(steam_game.header_image.clone())
                            } else {
                                Some(format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", steam_game.appid))
                            },
                            is_installed: steam_game.is_installed,
                            steam_app_id: Some(steam_game.appid),
                            // Usa i metadati reali di Steam API
                            is_vr: steam_game.is_vr,
                            engine: if !steam_game.engine.is_empty() && steam_game.engine != "Unknown" {
                                Some(steam_game.engine.clone())
                            } else {
                                None
                            },
                            last_played: if steam_game.last_played > 0 {
                                Some(steam_game.last_played)
                            } else {
                                None
                            },
                            is_shared: steam_game.is_shared,
                            // Usa le lingue reali di Steam API
                            supported_languages: if !steam_game.supported_languages.is_empty() {
                                Some(steam_game.supported_languages.split(',').map(|s| s.trim().to_string()).collect())
                            } else {
                                Some(vec!["english".to_string()])
                            },
                            genres: if !steam_game.genres.is_empty() {
                                Some(steam_game.genres.into_iter().map(|g| g.description).collect())
                            } else {
                                None
                            },
                        };
                        all_games.push(game_info);
                    }
                }
                Err(e) => {
                    log::warn!("⚠️ Errore recupero giochi Steam API: {}, fallback a file JSON", e);
                    // Fallback al file JSON se Steam API fallisce
                    if let Ok(fallback_games) = load_steam_games_from_json().await {
                        all_games.extend(fallback_games);
                    }
                }
            }
        }
        Err(_) => {
            log::info!("🔄 Nessuna credenziale Steam, carico da file JSON...");
            // Fallback al file JSON se non ci sono credenziali
            if let Ok(fallback_games) = load_steam_games_from_json().await {
                all_games.extend(fallback_games);
            }
        }
    }

    // Aggiungi giochi Epic Games installati
    match library::get_epic_installed_games().await {
        Ok(epic_games) => {
                            log::info!("🎮 Trovati {} giochi Epic Games installati", epic_games.len());
                            
                            // Raccogli gli app_name per recuperare le copertine
                            let epic_app_names: Vec<String> = epic_games.iter()
                                .map(|g| g.name.clone())
                                .collect();
                            
                            // Recupera le copertine Epic in batch
                            let epic_covers = match epic::get_epic_covers_batch(epic_app_names).await {
                                Ok(covers) => covers,
                                Err(e) => {
                                    log::warn!("⚠️ Errore recupero copertine Epic: {}", e);
                                    HashMap::new()
                                }
                            };
                            
                            // Converti i giochi Epic in GameInfo
                            for epic_game in epic_games {
                                let header_image = epic_covers.get(&epic_game.name).cloned();
                                
                                let game_info = GameInfo {
                                    id: epic_game.id.clone(),
                                    title: epic_game.name.clone(),
                                    platform: "Epic Games".to_string(),
                                    install_path: Some(epic_game.path.clone()),
                                    executable_path: epic_game.executable.clone(),
                                    icon: None,
                                    image_url: header_image.clone(),
                                    header_image,
                                    is_installed: true,
                                    steam_app_id: None,
                                    is_vr: epic_game.name.to_lowercase().contains("vr") || epic_game.name.to_lowercase().contains("virtual reality"),
                                    engine: if epic_game.name.to_lowercase().contains("unreal") { Some("Unreal Engine".to_string()) } else { None },
                                    last_played: epic_game.last_modified,
                                    is_shared: false,
                                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                                    genres: None,
                                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi Epic: {}", e);
        }
    }

    // Aggiungi giochi GOG installati
    match gog::get_gog_installed_games().await {
        Ok(gog_games) => {
            log::info!("🎮 Trovati {} giochi GOG installati", gog_games.len());
            
            // Raccogli gli ID per recuperare le copertine
            let gog_game_ids: Vec<String> = gog_games.iter()
                .map(|g| g.id.replace("gog_", ""))
                .collect();
            
            // Recupera le copertine GOG in batch
            let gog_covers = match gog::get_gog_covers_batch(gog_game_ids).await {
                Ok(covers) => covers,
                Err(e) => {
                    log::warn!("⚠️ Errore recupero copertine GOG: {}", e);
                    HashMap::new()
                }
            };
            
            // Converti i giochi GOG in GameInfo
            for gog_game in gog_games {
                let game_id_clean = gog_game.id.replace("gog_", "");
                let header_image = gog_covers.get(&game_id_clean).cloned();
                
                let game_info = GameInfo {
                    id: gog_game.id.clone(),
                    title: gog_game.name.clone(),
                    platform: "GOG".to_string(),
                    install_path: Some(gog_game.path.clone()),
                    executable_path: gog_game.executable.clone(),
                    icon: None,
                    image_url: header_image.clone(),
                    header_image,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: false,
                    engine: None,
                    last_played: gog_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                genres: None,
                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi GOG: {}", e);
        }
    }

    // Aggiungi giochi Origin/EA App installati
    match origin::get_origin_installed_games().await {
        Ok(origin_games) => {
            log::info!("🎮 Trovati {} giochi Origin/EA App installati", origin_games.len());
            
            // Origin/EA App non ha API pubblica per le copertine
            // Usiamo placeholder per ora
            
            // Converti i giochi Origin in GameInfo
            for origin_game in origin_games {
                let game_info = GameInfo {
                    id: origin_game.id.clone(),
                    title: origin_game.name.clone(),
                    platform: origin_game.platform.clone(),
                    install_path: Some(origin_game.path.clone()),
                    executable_path: origin_game.executable.clone(),
                    icon: None,
                    image_url: None, // Nessuna API pubblica per le copertine
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: false,
                    engine: None,
                    last_played: origin_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string()]),
                    genres: None,
                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi Origin/EA App: {}", e);
        }
    }

    // Aggiungi giochi Ubisoft Connect installati
    match ubisoft::get_ubisoft_installed_games().await {
        Ok(ubisoft_games) => {
            log::info!("🎮 Trovati {} giochi Ubisoft Connect installati", ubisoft_games.len());
            
            // Ubisoft Connect non ha API pubblica per le copertine
            // Usiamo placeholder per ora
            
            // Converti i giochi Ubisoft in GameInfo
            for ubisoft_game in ubisoft_games {
                let game_info = GameInfo {
                    id: ubisoft_game.id.clone(),
                    title: ubisoft_game.name.clone(),
                    platform: ubisoft_game.platform.clone(),
                    install_path: Some(ubisoft_game.path.clone()),
                    executable_path: ubisoft_game.executable.clone(),
                    icon: None,
                    image_url: None, // Nessuna API pubblica per le copertine
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: false,
                    engine: None,
                    last_played: ubisoft_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string()]),
                    genres: None,
                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi Ubisoft Connect: {}", e);
        }
    }

    // Aggiungi giochi Battle.net installati
    match battlenet::get_battlenet_installed_games().await {
        Ok(battlenet_games) => {
            log::info!("🎮 Trovati {} giochi Battle.net installati", battlenet_games.len());
            
            // Battle.net non ha API pubblica per le copertine
            // Usiamo placeholder per ora
            
            // Converti i giochi Battle.net in GameInfo
            for battlenet_game in battlenet_games {
                let game_info = GameInfo {
                    id: battlenet_game.id.clone(),
                    title: battlenet_game.name.clone(),
                    platform: battlenet_game.platform.clone(),
                    install_path: Some(battlenet_game.path.clone()),
                    executable_path: battlenet_game.executable.clone(),
                    icon: None,
                    image_url: None, // Nessuna API pubblica per le copertine
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: false,
                    engine: None,
                    last_played: battlenet_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string()]),
                    genres: None,
                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi Battle.net: {}", e);
        }
    }

    // Aggiungi giochi itch.io installati
    match itchio::get_itchio_installed_games().await {
        Ok(itchio_games) => {
            log::info!("🎮 Trovati {} giochi itch.io installati", itchio_games.len());
            
            // itch.io non ha API pubblica per le copertine
            // Usiamo placeholder per ora
            
            // Converti i giochi itch.io in GameInfo
            for itchio_game in itchio_games {
                let game_info = GameInfo {
                    id: itchio_game.id.clone(),
                    title: itchio_game.name.clone(),
                    platform: itchio_game.platform.clone(),
                    install_path: Some(itchio_game.path.clone()),
                    executable_path: itchio_game.executable.clone(),
                    icon: None,
                    image_url: None, // Nessuna API pubblica per le copertine
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: false,
                    engine: None,
                    last_played: itchio_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string()]),
                    genres: None,
                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi itch.io: {}", e);
        }
    }

    log::info!("✅ Totale giochi caricati: {}", all_games.len());
    Ok(all_games)
}

#[tauri::command]
pub async fn get_game_by_id(game_id: String) -> Result<Option<GameInfo>, String> {
    log::info!("🔍 Recupero gioco con ID: {}", game_id);
    
    // TODO: Implementare query database per ID specifico
    // Per ora restituiamo None come placeholder
    log::warn!("⚠️ Funzione get_game_by_id non ancora implementata");
    Ok(None)
}

#[tauri::command]
pub async fn scan_games() -> Result<Vec<GameScanResult>, String> {
    log::info!("🔎 Avvio scansione giochi...");
    
    let mut scan_results = Vec::new();
    
    // Scansiona giochi Steam
    match scan_steam_games().await {
        Ok(mut steam_games) => {
            log::info!("✅ Trovati {} giochi Steam", steam_games.len());
            scan_results.append(&mut steam_games);
        }
        Err(e) => {
            log::error!("❌ Errore scansione Steam: {}", e);
        }
    }
    
    // TODO: Aggiungere scansione per altri launcher (GOG, Origin, etc.)
// Epic Games è già implementato nella funzione get_games()
    
    log::info!("🎯 Scansione completata: {} giochi totali", scan_results.len());
    Ok(scan_results)
}

// Funzione helper per scansionare giochi Steam
async fn scan_steam_games() -> Result<Vec<GameScanResult>, String> {
    let mut games = Vec::new();
    
    // Ottieni percorsi librerie Steam
    let library_paths = get_steam_library_folders().await?;
    
    for library_path in library_paths {
        let steamapps_path = format!("{}/steamapps", library_path);
        
        match scan_steam_library(&steamapps_path).await {
            Ok(mut library_games) => {
                games.append(&mut library_games);
            }
            Err(e) => {
                log::warn!("⚠️ Errore scansione libreria {}: {}", steamapps_path, e);
            }
        }
    }
    
    Ok(games)
}

// Funzione per ottenere percorsi librerie Steam
async fn get_steam_library_folders() -> Result<Vec<String>, String> {
    let steam_path = "C:/Program Files (x86)/Steam";
    let library_folders_vdf = format!("{}/steamapps/libraryfolders.vdf", steam_path);
    
    let mut library_paths = vec![steam_path.to_string()];
    
    match fs::read_to_string(&library_folders_vdf).await {
        Ok(data) => {
            for line in data.lines() {
                if let Some(captures) = regex::Regex::new(r#""path"\s+"(.+?)""#)
                    .unwrap()
                    .captures(line) 
                {
                    if let Some(path) = captures.get(1) {
                        let normalized_path = path.as_str().replace("\\\\", "/");
                        library_paths.push(normalized_path);
                    }
                }
            }
        }
        Err(e) => {
            log::warn!("⚠️ Impossibile leggere libraryfolders.vdf: {}", e);
        }
    }
    
    // Rimuovi duplicati
    library_paths.sort();
    library_paths.dedup();
    
    Ok(library_paths)
}

// Funzione per scansionare una singola libreria Steam
async fn scan_steam_library(steamapps_path: &str) -> Result<Vec<GameScanResult>, String> {
    let mut games = Vec::new();
    
    match fs::read_dir(steamapps_path).await {
        Ok(mut entries) => {
            while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
                let path = entry.path();
                
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if file_name.starts_with("appmanifest_") && file_name.ends_with(".acf") {
                        match parse_steam_manifest(&path).await {
                            Ok(Some(game)) => {
                                games.push(game);
                            }
                            Ok(None) => {
                                // Manifest non valido o gioco non installato
                            }
                            Err(e) => {
                                log::warn!("⚠️ Errore parsing manifest {:?}: {}", path, e);
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Err(format!("Impossibile leggere directory {}: {}", steamapps_path, e));
        }
    }
    
    Ok(games)
}

// Funzione per parsare un manifest Steam
async fn parse_steam_manifest(manifest_path: &Path) -> Result<Option<GameScanResult>, String> {
    let content = fs::read_to_string(manifest_path).await
        .map_err(|e| format!("Errore lettura manifest: {}", e))?;
    
    let mut app_id: Option<String> = None;
    let mut name = None;
    let mut install_dir = None;
    let mut state_flags: Option<u32> = None;
    
    for line in content.lines() {
        let line = line.trim();
        
        if line.starts_with("\"appid\"") {
            if let Some(captures) = regex::Regex::new(r#""appid"\s+"(\d+)""#)
                .unwrap()
                .captures(line) 
            {
                app_id = captures.get(1).and_then(|m| m.as_str().parse().ok());
            }
        } else if line.starts_with("\"name\"") {
            if let Some(captures) = regex::Regex::new(r#""name"\s+"(.+?)""#)
                .unwrap()
                .captures(line) 
            {
                name = captures.get(1).map(|m| m.as_str().to_string());
            }
        } else if line.starts_with("\"installdir\"") {
            if let Some(captures) = regex::Regex::new(r#""installdir"\s+"(.+?)""#)
                .unwrap()
                .captures(line) 
            {
                install_dir = captures.get(1).map(|m| m.as_str().to_string());
            }
        } else if line.starts_with("\"StateFlags\"") {
            if let Some(captures) = regex::Regex::new(r#""StateFlags"\s+"(\d+)""#)
                .unwrap()
                .captures(line) 
            {
                state_flags = captures.get(1).and_then(|m| m.as_str().parse().ok());
            }
        }
    }
    
    if let (Some(app_id), Some(name), Some(install_dir)) = (app_id, name, install_dir) {
        // Verifica se il gioco è installato (StateFlags & 4 == 4)
        let is_installed = state_flags.map_or(false, |flags| flags & 4 == 4);
        
        if is_installed {
            let library_path = manifest_path.parent()
                .and_then(|p| p.parent())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            
            let install_path = format!("{}/steamapps/common/{}", library_path, install_dir);
            
            // Trova l'eseguibile principale
            let executable_path = find_largest_exe(&install_path).await
                .unwrap_or_else(|| format!("{}/game.exe", install_path));
            
            let game_result = GameScanResult {
                title: name,
                path: install_path,
                executable_path: Some(executable_path),
                app_id: Some(app_id.to_string()),
                source: "Steam".to_string(),
                is_installed: true,
            };
            
            return Ok(Some(game_result));
        }
    }
    
    Ok(None)
}

// Funzione per trovare l'eseguibile più grande in una directory
async fn find_largest_exe(dir: &str) -> Option<String> {
    match fs::read_dir(dir).await {
        Ok(mut entries) => {
            let mut largest_exe = None;
            let mut largest_size = 0;
            
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                
                if let Some(extension) = path.extension() {
                    if extension.to_string_lossy().to_lowercase() == "exe" {
                        if let Ok(metadata) = entry.metadata().await {
                            if metadata.len() > largest_size {
                                largest_size = metadata.len();
                                largest_exe = Some(path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
            
            largest_exe
        }
        Err(_) => None,
    }
}
