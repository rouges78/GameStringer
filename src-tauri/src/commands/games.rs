use crate::commands::{steam, epic, gog, origin, ubisoft, battlenet, itchio, rockstar, amazon, xbox, library};
use crate::models::*;
use log;
use serde_json;
use std::path::Path;
use tokio::fs;
use std::collections::HashMap;
use chrono::Utc;

// ============================================================
// Helper: Conversione InstalledGame → GameInfo / GameScanResult
// Evita duplicazione dello stesso blocco per ogni store
// ============================================================

/// Converte un InstalledGame generico (GOG, Origin, Ubisoft, Battle.net, itch.io, Rockstar) in GameInfo
fn installed_game_to_game_info(
    game: &library::InstalledGame,
    header_image: Option<String>,
    default_languages: Option<Vec<String>>,
) -> GameInfo {
    GameInfo {
        id: game.id.clone(),
        title: game.name.clone(),
        platform: game.platform.clone(),
        install_path: Some(game.path.clone()),
        executable_path: game.executable.clone(),
        icon: None,
        image_url: header_image.clone(),
        header_image,
        is_installed: true,
        steam_app_id: None,
        is_vr: is_vr_game(&game.name),
        engine: None,
        last_played: game.last_modified,
        is_shared: false,
        supported_languages: default_languages.or_else(|| Some(vec!["english".to_string()])),
        genres: None,
        added_date: None,
    }
}

/// Converte un InstalledGame generico in GameScanResult
fn installed_game_to_scan_result(
    game: &library::InstalledGame,
    source: &str,
) -> GameScanResult {
    GameScanResult {
        title: game.name.clone(),
        path: game.path.clone(),
        executable_path: game.executable.clone(),
        app_id: Some(game.id.clone()),
        source: source.to_string(),
        is_installed: true,
        id: game.id.clone(),
        platform: game.platform.clone(),
        header_image: None,
        is_vr: is_vr_game(&game.name),
        engine: None,
        supported_languages: None,
        genres: None,
        last_played: game.last_modified,
    }
}

// ============================================================
// Helper: Cerca copertina gioco via Steam Store API per nome
// Usata da Origin, Ubisoft, Battle.net che non hanno API copertine
// ============================================================

/// Mapping statico per titoli noti che non sono su Steam o hanno nomi diversi
fn get_known_cover_url(game_name: &str) -> Option<String> {
    let name_lower = game_name.to_lowercase();
    let mappings: &[(&[&str], u32)] = &[
        // Blizzard / Battle.net
        (&["overwatch"], 2357570),
        (&["diablo iv", "diablo 4"], 2344520),
        (&["diablo iii", "diablo 3", "diabloiii"], 0), // no Steam
        (&["world of warcraft", "wow"], 0),
        (&["hearthstone"], 0),
        (&["starcraft ii", "starcraft 2", "starcraftii"], 0),
        (&["heroes of the storm"], 0),
        (&["call of duty: modern warfare", "cod modern warfare", "call of duty modern warfare"], 393080),
        (&["call of duty: warzone", "cod warzone", "call of duty warzone"], 1962663),
        (&["call of duty: black ops", "cod black ops"], 311210),
        (&["crash bandicoot"], 731490),
        // EA / Origin
        (&["apex legends"], 1172470),
        (&["battlefield 2042"], 1517290),
        (&["battlefield v", "battlefield 5"], 1238810),
        (&["battlefield 1"], 1238840),
        (&["the sims 4", "sims 4"], 1222670),
        (&["star wars jedi: survivor"], 1774580),
        (&["star wars jedi: fallen order"], 1172380),
        (&["dead space"], 2231750),
        (&["it takes two"], 1426210),
        (&["mass effect legendary"], 1328670),
        (&["dragon age: the veilguard"], 1845910),
        (&["titanfall 2"], 1237970),
        (&["need for speed"], 1846380), // Unbound
        (&["fifa", "ea sports fc"], 2195250),
        // Ubisoft
        (&["assassin's creed valhalla", "ac valhalla"], 2208920),
        (&["assassin's creed mirage", "ac mirage"], 2593960),
        (&["assassin's creed odyssey", "ac odyssey"], 812140),
        (&["assassin's creed origins", "ac origins"], 582160),
        (&["far cry 6"], 2369390),
        (&["far cry 5"], 552520),
        (&["rainbow six siege", "r6 siege"], 359550),
        (&["watch dogs: legion"], 2289860),
        (&["watch dogs 2"], 447040),
        (&["the division 2"], 2221490),
        (&["ghost recon breakpoint"], 2231380),
        (&["anno 1800"], 916440),
        (&["immortals fenyx rising"], 2231920),
        (&["prince of persia: the lost crown"], 2344520),
        (&["riders republic"], 2231930),
        (&["skull and bones"], 2379780),
        (&["avatar: frontiers of pandora"], 2508790),
    ];

    for (keywords, appid) in mappings {
        for keyword in *keywords {
            if name_lower.contains(keyword) {
                if *appid > 0 {
                    return Some(format!(
                        "https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg",
                        appid
                    ));
                }
                return None; // Gioco noto ma non su Steam
            }
        }
    }
    None
}

/// Cerca un gioco su Steam Store API per nome e restituisce l'URL copertina
pub async fn search_steam_cover_by_name(game_name: &str) -> Option<String> {
    // 1. Prima controlla il mapping statico
    if let Some(url) = get_known_cover_url(game_name) {
        return Some(url);
    }

    // 2. Cerca via Steam Store search API
    let search_term = game_name
        .replace("™", "")
        .replace("®", "")
        .replace("'", "'")
        .trim()
        .to_string();

    let url = format!(
        "https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=US",
        urlencoding::encode(&search_term)
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok()?;

    let response = client.get(&url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }

    let body: serde_json::Value = response.json().await.ok()?;
    let items = body.get("items")?.as_array()?;

    if let Some(first) = items.first() {
        let appid = first.get("id")?.as_u64()?;
        return Some(format!(
            "https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg",
            appid
        ));
    }

    None
}

/// Cerca copertine per un batch di nomi gioco (usata da Origin, Ubisoft, Battle.net)
pub async fn search_covers_batch(game_names: &HashMap<String, String>) -> HashMap<String, String> {
    let mut covers = HashMap::new();
    
    for (game_id, game_name) in game_names {
        if let Some(cover_url) = search_steam_cover_by_name(game_name).await {
            covers.insert(game_id.clone(), cover_url);
        }
        // Rate limit: 200ms tra richieste per non sovraccaricare Steam API
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }
    
    covers
}

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
                                genres: None, added_date: None,
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
    crate::engine_detector::detect_engine_by_name(game_name)
}



// 🎮 SMART ENGINE DETECTION
pub fn detect_game_engine_smart(name: &str, install_path: Option<&String>) -> Option<String> {
    let path = install_path.map(std::path::Path::new);
    let result = crate::engine_detector::detect_engine_smart(name, path);
    
    if result == "Unknown" {
        None
    } else {
        Some(result)
    }
}

/// Cerca engine su PCGamingWiki via API
async fn search_engine_on_pcgamingwiki(game_name: &str) -> Option<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok()?;
    
    // Cerca il gioco su PCGamingWiki
    let search_url = format!(
        "https://www.pcgamingwiki.com/w/api.php?action=query&list=search&srsearch={}&format=json",
        urlencoding::encode(game_name)
    );
    
    let response = client.get(&search_url).send().await.ok()?;
    let json: serde_json::Value = response.json().await.ok()?;
    
    // Ottieni il titolo della prima pagina trovata
    let page_title = json["query"]["search"]
        .get(0)?
        ["title"]
        .as_str()?;
    
    // Ottieni il contenuto della pagina
    let content_url = format!(
        "https://www.pcgamingwiki.com/w/api.php?action=parse&page={}&prop=wikitext&format=json",
        urlencoding::encode(page_title)
    );
    
    let content_response = client.get(&content_url).send().await.ok()?;
    let content_json: serde_json::Value = content_response.json().await.ok()?;
    let wikitext = content_json["parse"]["wikitext"]["*"].as_str()?;
    
    // Cerca il campo "Engine" nel wikitext
    // Pattern: |engines = {{Engine|Unity}}
    if let Some(engine_match) = wikitext.find("|engines") {
        let engine_section = &wikitext[engine_match..];
        if let Some(end) = engine_section.find('\n') {
            let engine_line = &engine_section[..end];
            // Estrai nome engine da {{Engine|NomeEngine}}
            if let Some(start) = engine_line.find("{{Engine|") {
                let after_start = &engine_line[start + 9..];
                if let Some(end_bracket) = after_start.find("}}") {
                    let engine_name = after_start[..end_bracket].split('|').next()?;
                    log::info!("🌐 PCGamingWiki engine trovato: {}", engine_name);
                    return Some(engine_name.to_string());
                }
            }
        }
    }
    
    None
}

/// Cerca engine su IGDB (Twitch) - richiede Client ID
async fn search_engine_on_igdb(game_name: &str) -> Option<String> {
    // IGDB API gratuita con Twitch auth - fallback senza auth
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok()?;
    
    // Prova prima la ricerca diretta su IGDB (potrebbe funzionare senza auth per dati pubblici)
    let _search_query = format!(
        "search \"{}\"; fields name,game_engines.name; limit 1;",
        game_name.replace("\"", "\\\"")
    );
    
    // Se non funziona IGDB diretto, usa MobyGames come alternativa
    let moby_url = format!(
        "https://api.mobygames.com/v1/games?title={}&format=normal",
        urlencoding::encode(game_name)
    );
    
    if let Ok(response) = client.get(&moby_url).send().await {
        if let Ok(json) = response.json::<serde_json::Value>().await {
            if let Some(games) = json["games"].as_array() {
                if let Some(first_game) = games.first() {
                    // MobyGames non ha sempre l'engine ma ha altre info utili
                    log::info!("🎮 MobyGames trovato: {}", first_game["title"]);
                }
            }
        }
    }
    
    None
}

/// Genera suggerimenti intelligenti quando engine non trovato
fn generate_smart_suggestions(game_name: &str, install_path: Option<&String>) -> Vec<String> {
    let mut suggestions = vec![];
    
    // Suggerimenti basati sul nome del gioco
    let name_lower = game_name.to_lowercase();
    
    if name_lower.contains("visual novel") || name_lower.contains("vn") {
        suggestions.push("💡 Sembra una Visual Novel - prova Ren'Py o Kirikiri tools".to_string());
    }
    if name_lower.contains("rpg") || name_lower.contains("maker") {
        suggestions.push("💡 Potrebbe essere RPG Maker - cerca file .rgss3a o .rvdata2".to_string());
    }
    if name_lower.contains("indie") {
        suggestions.push("💡 Molti indie usano Unity o GameMaker - cerca cartella _Data o data.win".to_string());
    }
    
    // Suggerimenti generali
    suggestions.push("🔍 Cerca su PCGamingWiki per info sul motore".to_string());
    suggestions.push("📁 Scansiona la cartella del gioco per identificare i file".to_string());
    suggestions.push("🌐 Cerca '[nome gioco] engine' su Google".to_string());
    
    // Se abbiamo il path, suggerisci cosa cercare
    if install_path.is_some() {
        suggestions.push("📂 File comuni da cercare:".to_string());
        suggestions.push("   • _Data/ → Unity".to_string());
        suggestions.push("   • *.pak → Unreal".to_string());
        suggestions.push("   • *.pck → Godot".to_string());
        suggestions.push("   • data.win → GameMaker".to_string());
        suggestions.push("   • *.rpa → Ren'Py".to_string());
    }
    
    suggestions
}

/// Comando Tauri per rilevare il motore di un gioco scansionando i file
#[tauri::command]
pub async fn detect_engine_for_game(
    game_name: String,
    install_path: Option<String>,
) -> Result<DetectEngineResult, String> {
    log::info!("🔍 Rilevamento motore per: {} (path: {:?})", game_name, install_path);
    
    // 1. Prima prova rilevamento locale (file system + database nomi)
    let mut engine = detect_game_engine_smart(&game_name, install_path.as_ref());
    let mut source = "local";
    
    // 2. Se non trovato, cerca su PCGamingWiki
    if engine.is_none() || engine.as_ref().map(|e| e == "Unknown").unwrap_or(false) {
        log::info!("🌐 Ricerca engine su PCGamingWiki per: {}", game_name);
        if let Some(web_engine) = search_engine_on_pcgamingwiki(&game_name).await {
            engine = Some(web_engine);
            source = "PCGamingWiki";
        }
    }
    
    // 3. Se ancora non trovato, prova IGDB/MobyGames
    if engine.is_none() || engine.as_ref().map(|e| e == "Unknown").unwrap_or(false) {
        log::info!("🎮 Ricerca engine su IGDB/MobyGames per: {}", game_name);
        if let Some(web_engine) = search_engine_on_igdb(&game_name).await {
            engine = Some(web_engine);
            source = "IGDB";
        }
    }
    
    let engine_str = engine.unwrap_or_else(|| "Unknown".to_string());
    
    // Determina suggerimenti in base al motore
    let (can_patch, patch_tool, patch_description, extra_tips) = match engine_str.as_str() {
        "Unity" => (
            true,
            Some("BepInEx + XUnity.AutoTranslator".to_string()),
            Some("Installa BepInEx e XUnity.AutoTranslator per tradurre automaticamente i testi Unity.".to_string()),
            vec![
                "✅ Unity supportato! Usa il Patcher integrato".to_string(),
                "📁 I testi tradotti vanno in BepInEx/Translation/".to_string(),
            ]
        ),
        "Unreal Engine" | "Unreal" => (
            false,
            Some("UnrealLocres".to_string()),
            Some("I giochi Unreal richiedono estrazione dei file .pak con UnrealLocres.".to_string()),
            vec![
                "🔧 Scarica UnrealLocres da GitHub".to_string(),
                "📁 Cerca cartella Localization nei file .pak".to_string(),
                "💡 I testi sono in file .locres".to_string(),
            ]
        ),
        "RPG Maker" | "RPG Maker MV" | "RPG Maker MZ" | "RPG Maker VX" | "RPG Maker VX Ace" => (
            true,
            Some("RPG Maker Trans / Translator++".to_string()),
            Some("Usa RPG Maker Trans o Translator++ per estrarre e tradurre i testi.".to_string()),
            vec![
                "✅ RPG Maker supportato!".to_string(),
                "📁 Testi in www/data/ (MV/MZ) o Data/ (VX)".to_string(),
                "💡 Translator++ ha GUI user-friendly".to_string(),
            ]
        ),
        "Ren'Py" => (
            true,
            Some("UnRen + Editor testi".to_string()),
            Some("Estrai i file .rpa con UnRen e modifica i file .rpy per tradurre.".to_string()),
            vec![
                "✅ Ren'Py supportato!".to_string(),
                "📁 Estrai .rpa con UnRen".to_string(),
                "💡 Modifica i file .rpy nella cartella game/".to_string(),
            ]
        ),
        "Godot" => (
            true,
            Some("Godot RE Tools (gdsdecomp)".to_string()),
            Some("Estrai i file .pck con gdsdecomp per accedere ai testi.".to_string()),
            vec![
                "🔧 Scarica gdsdecomp da GitHub".to_string(),
                "📁 Estrai il file .pck".to_string(),
                "💡 Cerca file .csv o .tres per i testi".to_string(),
            ]
        ),
        "GameMaker" | "GameMaker Studio" | "GameMaker Studio 2" => (
            true,
            Some("UndertaleModTool".to_string()),
            Some("Usa UndertaleModTool per estrarre e modificare i testi dei giochi GameMaker.".to_string()),
            vec![
                "✅ GameMaker supportato!".to_string(),
                "📁 Apri data.win con UndertaleModTool".to_string(),
                "💡 Cerca sezione 'Strings' per i testi".to_string(),
            ]
        ),
        "Kirikiri" | "KiriKiri" => (
            true,
            Some("KiriKiri Tools / XP3 Extractor".to_string()),
            Some("Estrai i file .xp3 e modifica gli script .ks/.tjs.".to_string()),
            vec![
                "📁 Estrai file .xp3 con XP3 Viewer".to_string(),
                "💡 Testi in file .ks o .tjs".to_string(),
            ]
        ),
        "Spike Chunsoft Engine" => (
            true,
            Some("DRAT (Danganronpa Another Tool)".to_string()),
            Some("Estrai i file .pak con DRAT, traduci i .PO con Poedit, poi repack.".to_string()),
            vec![
                "🎮 Danganronpa rilevato!".to_string(),
                "� Tool: DRAT → github.com/Liquid-S/Danganronpa-Another-Tool".to_string(),
                "📁 I file .pak contengono testi in formato .PO".to_string(),
                "✏️ Traduci i .PO con Poedit (poedit.net)".to_string(),
                "🔄 Repack con DRAT e copia nella cartella gioco".to_string(),
                "🇮🇹 Patch ITA esistente: alliceteam.altervista.org".to_string(),
            ]
        ),
        _ => {
            let tips = generate_smart_suggestions(&game_name, install_path.as_ref());
            (
                false,
                None,
                Some("Motore non riconosciuto. Segui i suggerimenti per identificarlo.".to_string()),
                tips
            )
        },
    };
    
    log::info!("✅ Motore rilevato: {} (fonte: {}, can_patch: {})", engine_str, source, can_patch);
    
    Ok(DetectEngineResult {
        engine: engine_str,
        can_patch,
        patch_tool,
        patch_description,
        source: Some(source.to_string()),
        tips: Some(extra_tips),
    })
}

#[derive(serde::Serialize)]
pub struct DetectEngineResult {
    pub engine: String,
    pub can_patch: bool,
    pub patch_tool: Option<String>,
    pub patch_description: Option<String>,
    pub source: Option<String>,
    pub tips: Option<Vec<String>>,
}

#[derive(serde::Serialize)]
pub struct TranslateResult {
    pub translated_text: String,
}

/// Traduce testo usando Google Translate (web scraping, nessun limite)
#[tauri::command]
pub async fn translate_text_simple(
    text: String,
    target_lang: String,
) -> Result<TranslateResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;
    
    // Google Translate API non ufficiale (gratuita, affidabile)
    let url = format!(
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl={}&dt=t&q={}",
        target_lang,
        urlencoding::encode(&text)
    );
    
    match client.get(&url).send().await {
        Ok(response) => {
            if let Ok(json) = response.json::<serde_json::Value>().await {
                // Formato risposta: [[["traduzione","originale",...],...],...]
                if let Some(arr) = json.get(0).and_then(|v| v.as_array()) {
                    let mut result = String::new();
                    for item in arr {
                        if let Some(translated) = item.get(0).and_then(|v| v.as_str()) {
                            result.push_str(translated);
                        }
                    }
                    if !result.is_empty() {
                        return Ok(TranslateResult { translated_text: result });
                    }
                }
            }
        }
        Err(_) => {}
    }
    
    // Fallback: ritorna testo originale
    Ok(TranslateResult { translated_text: text })
}

#[tauri::command]
pub async fn force_refresh_all_games(
    profile_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>
) -> Result<Vec<GameInfo>, String> {
    log::info!("🔄 FORCE REFRESH: Bypassing all cache, refreshing all games...");
    
    let mut all_games = Vec::new();
    
    // Forza refresh Steam bypassando cache usando il metodo completo con Family Sharing
    log::info!("🔄 Tentativo caricamento credenziali Steam per refresh...");
    match steam::load_steam_credentials(profile_state.clone()).await {
        Ok(credentials) => {
            log::info!("📋 Credenziali caricate - API Key len: {}, Steam ID: {}", 
                credentials.api_key_encrypted.len(), 
                if credentials.steam_id.is_empty() { "VUOTO" } else { &credentials.steam_id });
            
            // Skip se credenziali vuote
            if credentials.api_key_encrypted.is_empty() || credentials.steam_id.is_empty() {
                log::warn!("⚠️ Credenziali Steam vuote, uso scan locale...");
                let local_games = crate::commands::steam_enhanced::scan_all_steam_games_fast().await?;
                return Ok(local_games);
            }
            
            log::info!("🔑 Credenziali OK, forzo refresh Steam API con Family Sharing...");
            // L'API key è ora salvata in chiaro nel ProfileManager
            let api_key = credentials.api_key_encrypted.clone();
            
            // Usa get_steam_games_with_family_sharing invece di get_steam_games per avere tutti i dati
            match steam::get_steam_games_with_family_sharing(api_key, credentials.steam_id, Some(true), profile_state.clone()).await {
                Ok(steam_games) => {
                    // Debug: conta giochi con nomi validi vs "Game X"
                    let valid_names = steam_games.iter().filter(|g| !g.name.starts_with("Game ") && !g.name.starts_with("Shared Game ")).count();
                    let invalid_names = steam_games.len() - valid_names;
                    log::info!("✅ FORCE REFRESH: Trovati {} giochi Steam ({} con nome, {} senza)", steam_games.len(), valid_names, invalid_names);
                    
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
                    added_date: None,
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

    // Merge install_path dai dati locali Steam (scan filesystem)
    // L'API Steam non conosce i path locali, quindi li recuperiamo dallo scan
    if let Ok(local_games) = crate::commands::steam_enhanced::scan_all_steam_games_fast().await {
        let local_map: std::collections::HashMap<String, String> = local_games.iter()
            .filter_map(|g| {
                if let (Some(app_id), Some(path)) = (g.steam_app_id, g.install_path.as_ref()) {
                    if !path.is_empty() {
                        Some((format!("steam_{}", app_id), path.clone()))
                    } else { None }
                } else { None }
            })
            .collect();
        for game in all_games.iter_mut() {
            if game.install_path.is_none() {
                if let Some(path) = local_map.get(&game.id) {
                    game.install_path = Some(path.clone());
                }
            }
        }
        log::info!("🔗 Merge install_path: {} path locali applicati", local_map.len());
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
                    engine: detect_game_engine_smart(&epic_game.name, Some(&epic_game.path)),
                    last_played: epic_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: None, added_date: None,
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
    log::info!("🚀 Caricamento veloce giochi (metodo Rai Pal) - PARALLEL MODE...");
    
    let start_time = std::time::Instant::now();
    let mut all_games = Vec::new();
    
    // 💾 Prima prova a caricare dalla cache
    match load_games_from_cache().await {
        Ok(cached_games) => {
            log::info!("⚡ Caricamento ISTANTANEO dalla cache: {} giochi", cached_games.len());
            // Continuiamo comunque in background per aggiornare se necessario o ritorniamo subito?
            // Per ora ritorniamo subito per massima velocità, l'utente può fare refresh manuale
            return Ok(cached_games);
        }
        Err(e) => {
            log::info!("🔄 Cache non disponibile ({}), caricamento completo...", e);
        }
    }
    
    // Avvia task in parallelo
    let steam_task = tokio::spawn(steam::get_steam_games_fast());
    let epic_task = tokio::spawn(library::get_epic_installed_games());
    let gog_task = tokio::spawn(gog::get_gog_installed_games());
    let origin_task = tokio::spawn(origin::get_origin_installed_games());
    let ubisoft_task = tokio::spawn(ubisoft::get_ubisoft_installed_games());
    let battlenet_task = tokio::spawn(battlenet::get_battlenet_installed_games());
    let itchio_task = tokio::spawn(itchio::get_itchio_installed_games());
    let rockstar_task = tokio::spawn(rockstar::get_rockstar_installed_games());
    let amazon_task = tokio::spawn(amazon::get_amazon_installed_games());
    
    // 1. Steam Result
    match steam_task.await {
        Ok(Ok(steam_games)) => {
            log::info!("✅ Lettura veloce Steam: {} giochi trovati", steam_games.len());
            all_games.extend(steam_games);
        }
        Ok(Err(e)) => {
            log::warn!("⚠️ Lettura veloce Steam fallita: {}, usando fallback", e);
            if let Ok(fallback_games) = load_steam_games_from_json().await {
                log::info!("✅ Fallback JSON: {} giochi caricati", fallback_games.len());
                all_games.extend(fallback_games);
            }
        }
        Err(e) => log::error!("🔥 Panic in Steam task: {}", e),
    }
    
    // 2. Epic Games Result
    match epic_task.await {
        Ok(Ok(epic_games)) => {
            log::info!("🎮 Epic Games: {} giochi trovati", epic_games.len());
            for epic_game in epic_games {
                let game_info = GameInfo {
                    id: epic_game.id.clone(),
                    title: epic_game.name.clone(),
                    platform: "Epic Games".to_string(),
                    install_path: Some(epic_game.path.clone()),
                    executable_path: epic_game.executable.clone(),
                    icon: None,
                    image_url: None,
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: is_vr_game(&epic_game.name),
                    engine: detect_game_engine_smart(&epic_game.name, Some(&epic_game.path)),
                    last_played: epic_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: Some(vec!["Game".to_string()]), added_date: None,
                };
                all_games.push(game_info);
            }
        }
        Ok(Err(e)) => log::warn!("⚠️ Epic Games errore: {}", e),
        Err(e) => log::error!("🔥 Panic in Epic task: {}", e),
    }
    
    // 3. GOG Result
    match gog_task.await {
        Ok(Ok(gog_games)) => {
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
                    engine: detect_game_engine_smart(&gog_game.name, Some(&gog_game.path)),
                    last_played: gog_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: Some(vec!["Game".to_string()]), added_date: None,
                };
                all_games.push(game_info);
            }
        }
        Ok(Err(e)) => log::warn!("⚠️ GOG errore: {}", e),
        Err(e) => log::error!("🔥 Panic in GOG task: {}", e),
    }

    // 4. Origin/EA Result
    match origin_task.await {
        Ok(Ok(origin_games)) => {
            log::info!("🎮 Origin/EA: {} giochi trovati", origin_games.len());
            for origin_game in origin_games {
                let game_info = GameInfo {
                    id: origin_game.id.clone(),
                    title: origin_game.name.clone(),
                    platform: origin_game.platform.clone(),
                    install_path: Some(origin_game.path.clone()),
                    executable_path: origin_game.executable.clone(),
                    icon: None,
                    image_url: None,
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: is_vr_game(&origin_game.name),
                    engine: detect_game_engine_smart(&origin_game.name, Some(&origin_game.path)),
                    last_played: origin_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: Some(vec!["Game".to_string()]), added_date: None,
                };
                all_games.push(game_info);
            }
        }
        Ok(Err(e)) => log::warn!("⚠️ Origin/EA errore: {}", e),
        Err(e) => log::error!("🔥 Panic in Origin task: {}", e),
    }

    // 5. Ubisoft Connect Result
    match ubisoft_task.await {
        Ok(Ok(ubisoft_games)) => {
            log::info!("🎮 Ubisoft: {} giochi trovati", ubisoft_games.len());
            for ubisoft_game in ubisoft_games {
                let game_info = GameInfo {
                    id: ubisoft_game.id.clone(),
                    title: ubisoft_game.name.clone(),
                    platform: ubisoft_game.platform.clone(),
                    install_path: Some(ubisoft_game.path.clone()),
                    executable_path: ubisoft_game.executable.clone(),
                    icon: None,
                    image_url: None,
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: is_vr_game(&ubisoft_game.name),
                    engine: detect_game_engine_smart(&ubisoft_game.name, Some(&ubisoft_game.path)),
                    last_played: ubisoft_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: Some(vec!["Game".to_string()]), added_date: None,
                };
                all_games.push(game_info);
            }
        }
        Ok(Err(e)) => log::warn!("⚠️ Ubisoft errore: {}", e),
        Err(e) => log::error!("🔥 Panic in Ubisoft task: {}", e),
    }

    // 6. Battle.net Result
    match battlenet_task.await {
        Ok(Ok(battlenet_games)) => {
            log::info!("🎮 Battle.net: {} giochi trovati", battlenet_games.len());
            for battlenet_game in battlenet_games {
                let game_info = GameInfo {
                    id: battlenet_game.id.clone(),
                    title: battlenet_game.name.clone(),
                    platform: battlenet_game.platform.clone(),
                    install_path: Some(battlenet_game.path.clone()),
                    executable_path: battlenet_game.executable.clone(),
                    icon: None,
                    image_url: None,
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: is_vr_game(&battlenet_game.name),
                    engine: detect_game_engine_smart(&battlenet_game.name, Some(&battlenet_game.path)),
                    last_played: battlenet_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: Some(vec!["Game".to_string()]), added_date: None,
                };
                all_games.push(game_info);
            }
        }
        Ok(Err(e)) => log::warn!("⚠️ Battle.net errore: {}", e),
        Err(e) => log::error!("🔥 Panic in Battle.net task: {}", e),
    }

    // 7. itch.io Result
    match itchio_task.await {
        Ok(Ok(itchio_games)) => {
            log::info!("🎮 itch.io: {} giochi trovati", itchio_games.len());
            for itchio_game in itchio_games {
                let game_info = GameInfo {
                    id: itchio_game.id.clone(),
                    title: itchio_game.name.clone(),
                    platform: itchio_game.platform.clone(),
                    install_path: Some(itchio_game.path.clone()),
                    executable_path: itchio_game.executable.clone(),
                    icon: None,
                    image_url: None,
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: is_vr_game(&itchio_game.name),
                    engine: detect_game_engine_smart(&itchio_game.name, Some(&itchio_game.path)),
                    last_played: itchio_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: Some(vec!["Game".to_string()]), added_date: None,
                };
                all_games.push(game_info);
            }
        }
        Ok(Err(e)) => log::warn!("⚠️ itch.io errore: {}", e),
        Err(e) => log::error!("🔥 Panic in itch.io task: {}", e),
    }

    // 8. Rockstar Games Result
    match rockstar_task.await {
        Ok(Ok(rockstar_games)) => {
            log::info!("🎮 Rockstar Games: {} giochi trovati", rockstar_games.len());
            for rockstar_game in rockstar_games {
                let game_info = GameInfo {
                    id: rockstar_game.id.clone(),
                    title: rockstar_game.name.clone(),
                    platform: rockstar_game.platform.clone(),
                    install_path: Some(rockstar_game.path.clone()),
                    executable_path: rockstar_game.executable.clone(),
                    icon: None,
                    image_url: None,
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: is_vr_game(&rockstar_game.name),
                    engine: detect_game_engine_smart(&rockstar_game.name, Some(&rockstar_game.path)),
                    last_played: rockstar_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: Some(vec!["Game".to_string()]), added_date: None,
                };
                all_games.push(game_info);
            }
        }
        Ok(Err(e)) => log::warn!("⚠️ Rockstar Games errore: {}", e),
        Err(e) => log::error!("🔥 Panic in Rockstar task: {}", e),
    }

    // 9. Amazon Games Result
    match amazon_task.await {
        Ok(Ok(amazon_games)) => {
            log::info!("🎮 Amazon Games: {} giochi trovati", amazon_games.len());
            for amazon_game in amazon_games {
                let game_info = GameInfo {
                    id: amazon_game.id.clone(),
                    title: amazon_game.name.clone(),
                    platform: "Amazon Games".to_string(),
                    install_path: Some(amazon_game.path.clone()),
                    executable_path: amazon_game.executable.clone(),
                    icon: None,
                    image_url: None,
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: is_vr_game(&amazon_game.name),
                    engine: detect_game_engine_smart(&amazon_game.name, Some(&amazon_game.path)),
                    last_played: amazon_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                    genres: Some(vec!["Game".to_string()]), added_date: None,
                };
                all_games.push(game_info);
            }
        }
        Ok(Err(e)) => log::warn!("⚠️ Amazon Games errore: {}", e),
        Err(e) => log::error!("🔥 Panic in Amazon task: {}", e),
    }
    
    let elapsed = start_time.elapsed();
    log::info!("✅ CARICAMENTO PARALLELO COMPLETATO: {} giochi in {:?} (metodo Rai Pal)", all_games.len(), elapsed);
    
    // Salva in cache per la prossima volta
    if let Err(e) = save_games_to_cache(&all_games).await {
        log::warn!("⚠️ Errore salvataggio cache: {}", e);
    }
    
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
pub async fn get_games(
    profile_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>
) -> Result<Vec<GameInfo>, String> {
    log::info!("🎮 Recupero lista giochi completa...");
    
    // 🚀 NUOVO APPROCCIO: Usa metodo diretto come Rai Pal (veloce e affidabile)
    log::info!("🚀 Usando metodo diretto lettura Steam (come Rai Pal)...");
    
    let mut all_games = Vec::new();
    
    match steam::get_steam_games_fast().await {
        Ok(steam_games) => {
            log::info!("✅ Metodo Rai Pal: Trovati {} giochi Steam", steam_games.len());
            all_games.extend(steam_games);
        }
        Err(e) => {
            log::warn!("⚠️ Errore metodo Rai Pal: {}, fallback a sistema normale", e);
            // Fallback al sistema normale se il metodo veloce fallisce
            
            // Prima prova a caricare giochi Steam con metadati completi
            match steam::load_steam_credentials(profile_state.clone()).await {
                Ok(credentials) => {
                    log::info!("🔑 Credenziali Steam trovate, recupero giochi con metadati completi...");
                    // 🔒 Decripta l'API key
                    let decrypted_api_key = steam::decrypt_api_key(&credentials.api_key_encrypted, &credentials.nonce)
                        .unwrap_or_default();
                    
                    if !decrypted_api_key.is_empty() {
                        match steam::get_steam_games(decrypted_api_key, credentials.steam_id, Some(false), profile_state.clone()).await {
                            Ok(steam_games) => {
                                log::info!("✅ Trovati {} giochi Steam con metadati completi", steam_games.len());
                                for steam_game in steam_games {
                                    let game_info = GameInfo {
                                        id: format!("steam_{}", steam_game.appid),
                                        title: steam_game.name.clone(),
                                        platform: "Steam".to_string(),
                                        install_path: None,
                                        executable_path: None,
                                        icon: if !steam_game.img_icon_url.is_empty() {
                                            Some(format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", steam_game.appid, steam_game.img_icon_url))
                                        } else { None },
                                        image_url: if !steam_game.img_icon_url.is_empty() {
                                            Some(format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", steam_game.appid, steam_game.img_icon_url))
                                        } else { None },
                                        header_image: if !steam_game.header_image.is_empty() {
                                            Some(steam_game.header_image.clone())
                                        } else {
                                            Some(format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", steam_game.appid))
                                        },
                                        is_installed: steam_game.is_installed,
                                        steam_app_id: Some(steam_game.appid),
                                        is_vr: steam_game.is_vr,
                                        engine: if !steam_game.engine.is_empty() && steam_game.engine != "Unknown" { Some(steam_game.engine.clone()) } else { None },
                                        last_played: if steam_game.last_played > 0 { Some(steam_game.last_played) } else { None },
                                        is_shared: steam_game.is_shared,
                                        supported_languages: if !steam_game.supported_languages.is_empty() {
                                            Some(steam_game.supported_languages.split(',').map(|s| s.trim().to_string()).collect())
                                        } else { Some(vec!["english".to_string()]) },
                                        genres: if !steam_game.genres.is_empty() {
                                            Some(steam_game.genres.into_iter().map(|g| g.description).collect())
                                        } else { None },
                                        added_date: None,
                                    };
                                    all_games.push(game_info);
                                }
                            }
                            Err(_) => {
                                if let Ok(fallback_games) = load_steam_games_from_json().await {
                                    all_games.extend(fallback_games);
                                }
                            }
                        }
                    }
                }
                Err(_) => {
                    if let Ok(fallback_games) = load_steam_games_from_json().await {
                        all_games.extend(fallback_games);
                    }
                }
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
                                    genres: None, added_date: None,
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
            
            // Recupera le copertine GOG in batch
            let gog_game_ids: Vec<String> = gog_games.iter()
                .map(|g| g.id.replace("gog_", ""))
                .collect();
            let gog_covers = match gog::get_gog_covers_batch(gog_game_ids).await {
                Ok(covers) => covers,
                Err(e) => { log::warn!("⚠️ Errore recupero copertine GOG: {}", e); HashMap::new() }
            };
            
            for gog_game in &gog_games {
                let cover = gog_covers.get(&gog_game.id.replace("gog_", "")).cloned();
                let langs = Some(vec!["english".to_string(), "italian".to_string()]);
                all_games.push(installed_game_to_game_info(gog_game, cover, langs));
            }
        }
        Err(e) => { log::warn!("⚠️ Errore caricamento giochi GOG: {}", e); }
    }

    // Aggiungi giochi Origin/EA App installati
    match origin::get_origin_installed_games().await {
        Ok(games) => {
            log::info!("🎮 Trovati {} giochi Origin/EA App installati", games.len());
            for g in &games { all_games.push(installed_game_to_game_info(g, None, None)); }
        }
        Err(e) => { log::warn!("⚠️ Errore caricamento giochi Origin/EA App: {}", e); }
    }

    // Aggiungi giochi Ubisoft Connect installati
    match ubisoft::get_ubisoft_installed_games().await {
        Ok(games) => {
            log::info!("🎮 Trovati {} giochi Ubisoft Connect installati", games.len());
            for g in &games { all_games.push(installed_game_to_game_info(g, None, None)); }
        }
        Err(e) => { log::warn!("⚠️ Errore caricamento giochi Ubisoft Connect: {}", e); }
    }

    // Aggiungi giochi Battle.net installati
    match battlenet::get_battlenet_installed_games().await {
        Ok(games) => {
            log::info!("🎮 Trovati {} giochi Battle.net installati", games.len());
            for g in &games { all_games.push(installed_game_to_game_info(g, None, None)); }
        }
        Err(e) => { log::warn!("⚠️ Errore caricamento giochi Battle.net: {}", e); }
    }

    // Aggiungi giochi itch.io installati
    match itchio::get_itchio_installed_games().await {
        Ok(games) => {
            log::info!("🎮 Trovati {} giochi itch.io installati", games.len());
            for g in &games { all_games.push(installed_game_to_game_info(g, None, None)); }
        }
        Err(e) => { log::warn!("⚠️ Errore caricamento giochi itch.io: {}", e); }
    }

    log::info!("✅ Totale giochi caricati: {}", all_games.len());
    Ok(all_games)
}

#[tauri::command]
pub async fn get_game_by_id(
    game_id: String,
    profile_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>
) -> Result<Option<GameInfo>, String> {
    log::info!("🔍 Recupero gioco con ID: {}", game_id);
    
    // Strategia 1: Se è un ID Steam, prova lettura veloce dal cache JSON locale
    if game_id.starts_with("steam_") {
        if let Ok(Some(game)) = find_steam_game_fast(&game_id).await {
            return Ok(Some(game));
        }
    }
    
    // Strategia 2: Cerca tra tutti i giochi caricati
    let all_games = get_games(profile_state).await?;
    let found = all_games.into_iter().find(|g| g.id == game_id);
    
    if found.is_some() {
        log::info!("✅ Gioco trovato: {}", game_id);
    } else {
        log::warn!("⚠️ Gioco non trovato: {}", game_id);
    }
    
    Ok(found)
}

/// Ricerca veloce di un gioco Steam dal cache JSON locale senza caricare tutto
async fn find_steam_game_fast(game_id: &str) -> Result<Option<GameInfo>, String> {
    let appid_str = game_id.strip_prefix("steam_").unwrap_or(game_id);
    let appid: u32 = appid_str.parse().map_err(|_| "ID Steam non valido".to_string())?;
    
    let cache_path = get_steam_cache_path();
    if !cache_path.exists() {
        return Ok(None);
    }
    
    let data = fs::read_to_string(&cache_path).await.map_err(|e| e.to_string())?;
    let games: Vec<GameInfo> = serde_json::from_str(&data).unwrap_or_default();
    
    Ok(games.into_iter().find(|g| g.steam_app_id == Some(appid) || g.id == game_id.to_string()))
}

/// Percorso cache Steam
fn get_steam_cache_path() -> std::path::PathBuf {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .unwrap_or_else(|_| ".".to_string());
    std::path::PathBuf::from(local_app_data)
        .join("GameStringer")
        .join("steam_games_cache.json")
}

#[tauri::command]
pub async fn scan_games() -> Result<Vec<GameScanResult>, String> {
    log::info!("🔎 Avvio scansione giochi - PARALLEL MODE...");
    
    let start_time = std::time::Instant::now();
    let mut scan_results = Vec::new();
    
    // Avvia task in parallelo
    let steam_task = tokio::spawn(scan_steam_games());
    let epic_task = tokio::spawn(epic::get_epic_games_complete());
    let gog_task = tokio::spawn(gog::get_gog_installed_games());
    let origin_task = tokio::spawn(origin::get_origin_installed_games());
    let ubisoft_task = tokio::spawn(ubisoft::get_ubisoft_installed_games());
    let battlenet_task = tokio::spawn(battlenet::get_battlenet_installed_games());
    let itchio_task = tokio::spawn(itchio::get_itchio_installed_games());
    let rockstar_task = tokio::spawn(rockstar::get_rockstar_installed_games());
    let xbox_task = tokio::spawn(xbox::get_xbox_installed_games());
    
    // 1. Steam
    match steam_task.await {
        Ok(Ok(mut steam_games)) => {
            log::info!("✅ scan_games: {} giochi Steam", steam_games.len());
            scan_results.append(&mut steam_games);
        }
        Ok(Err(e)) => log::error!("❌ Errore scansione Steam: {}", e),
        Err(e) => log::error!("🔥 Panic in Steam task: {}", e),
    }
    
    // 2. Epic Games
    match epic_task.await {
        Ok(Ok(epic_games)) => {
            let epic_scan_results: Vec<GameScanResult> = epic_games.into_iter().map(|game| {
                // game.id arriva già come "epic_AppName" da try_legendary_library_direct
                let final_id = if game.id.starts_with("epic_") {
                    game.id.clone()
                } else {
                    format!("epic_{}", game.id)
                };
                GameScanResult {
                    title: game.title.clone(),
                    path: game.install_path.unwrap_or_else(|| "Unknown".to_string()),
                    executable_path: game.executable_path,
                    app_id: Some(final_id.clone()),
                    source: "Epic Games".to_string(),
                    is_installed: game.is_installed,
                    id: final_id,
                    platform: "Epic Games".to_string(),
                    header_image: game.header_image,
                    is_vr: is_vr_game(&game.title),
                    engine: game.engine,
                    supported_languages: game.supported_languages,
                    genres: game.genres,
                    last_played: game.last_played,
                }
            }).collect();
            log::info!("✅ scan_games: Trovati {} giochi Epic Games", epic_scan_results.len());
            if !epic_scan_results.is_empty() {
                log::info!("  📋 Primi 3 Epic: {:?}", epic_scan_results.iter().take(3).map(|g| (&g.id, &g.title)).collect::<Vec<_>>());
            }
            scan_results.extend(epic_scan_results);
        }
        Ok(Err(e)) => log::error!("❌ Errore scansione Epic Games: {}", e),
        Err(e) => log::error!("🔥 Panic in Epic task: {}", e),
    }
    
    // 3-8. Store con struttura InstalledGame comune — usa helper
    let store_tasks: Vec<(&str, Result<Result<Vec<library::InstalledGame>, String>, _>)> = vec![
        ("GOG", gog_task.await),
        ("Origin", origin_task.await),
        ("Ubisoft Connect", ubisoft_task.await),
        ("Battle.net", battlenet_task.await),
        ("itch.io", itchio_task.await),
        ("Rockstar Games", rockstar_task.await),
        ("Xbox Game Pass", xbox_task.await),
    ];
    
    for (store_name, result) in store_tasks {
        match result {
            Ok(Ok(games)) => {
                let count = games.len();
                let results: Vec<GameScanResult> = games.iter()
                    .map(|g| installed_game_to_scan_result(g, store_name))
                    .collect();
                log::info!("✅ Trovati {} giochi {}", count, store_name);
                scan_results.extend(results);
            }
            Ok(Err(e)) => log::error!("❌ Errore scansione {}: {}", store_name, e),
            Err(e) => log::error!("🔥 Panic in {} task: {}", store_name, e),
        }
    }
    
    let elapsed = start_time.elapsed();
    log::info!("🎯 scan_games completata: {} giochi totali in {:?}", scan_results.len(), elapsed);
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
                title: name.clone(),
                path: install_path.clone(),
                executable_path: Some(executable_path),
                app_id: Some(app_id.to_string()),
                source: "Steam".to_string(),
                is_installed: true,
                id: format!("steam_{}", app_id),
                platform: "Steam".to_string(),
                header_image: None,
                is_vr: is_vr_game(&name),
                engine: detect_game_engine_smart(&name, Some(&install_path)),
                supported_languages: None,
                genres: None,
                last_played: None,
            };
            
            return Ok(Some(game_result));
        }
    }
    
    Ok(None)
}

// Funzione per trovare l'eseguibile più grande in una directory
/// Comando Tauri per trovare gli eseguibili in una cartella
#[tauri::command]
pub async fn find_executables_in_folder(folder_path: String) -> Result<Vec<String>, String> {
    log::info!("🔍 Cercando eseguibili in: {}", folder_path);
    
    let mut executables = Vec::new();
    
    match tokio::fs::read_dir(&folder_path).await {
        Ok(mut entries) => {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                
                if let Some(extension) = path.extension() {
                    if extension.to_string_lossy().to_lowercase() == "exe" {
                        if let Some(file_name) = path.file_name() {
                            let name = file_name.to_string_lossy().to_string();
                            // Escludi eseguibili di sistema/launcher comuni
                            if !name.to_lowercase().contains("unins") 
                                && !name.to_lowercase().contains("redist")
                                && !name.to_lowercase().contains("vcredist")
                                && !name.to_lowercase().contains("dxsetup")
                                && !name.to_lowercase().contains("crashhandler")
                                && !name.to_lowercase().contains("ue4prereq")
                            {
                                executables.push(name);
                            }
                        }
                    }
                }
            }
            
            // Ordina per nome
            executables.sort();
            log::info!("✅ Trovati {} eseguibili", executables.len());
            Ok(executables)
        }
        Err(e) => {
            log::error!("❌ Errore lettura cartella: {}", e);
            Err(format!("Impossibile leggere la cartella: {}", e))
        }
    }
}

/// Comando Tauri per avviare un eseguibile
#[tauri::command]
pub async fn launch_executable(path: String) -> Result<String, String> {
    log::info!("🚀 Avvio eseguibile: {}", path);
    
    let path_obj = std::path::Path::new(&path);
    if !path_obj.exists() {
        return Err(format!("File non trovato: {}", path));
    }
    
    // Ottieni la directory di lavoro
    let work_dir = path_obj.parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string());
    
    let path_clone = path.clone();
    let work_dir_clone = work_dir.clone();
    
    // Usa PowerShell Start-Process - più affidabile su Windows
    let result = tokio::task::spawn_blocking(move || {
        use std::process::Command;
        
        #[cfg(target_os = "windows")]
        {
            // PowerShell Start-Process con working directory
            let output = Command::new("powershell")
                .args(&[
                    "-NoProfile",
                    "-Command",
                    &format!(
                        "Start-Process -FilePath '{}' -WorkingDirectory '{}'",
                        path_clone.replace("'", "''"),
                        work_dir_clone.replace("'", "''")
                    )
                ])
                .output();
            
            match output {
                Ok(out) => {
                    if out.status.success() {
                        Ok(())
                    } else {
                        let stderr = String::from_utf8_lossy(&out.stderr);
                        Err(format!("PowerShell error: {}", stderr))
                    }
                }
                Err(e) => Err(format!("Failed to start PowerShell: {}", e))
            }
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            Command::new("open")
                .arg(&path_clone)
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("Errore: {}", e))
        }
    }).await;
    
    match result {
        Ok(Ok(())) => {
            log::info!("✅ Eseguibile avviato con PowerShell Start-Process");
            Ok(format!("Avviato: {}", path))
        }
        Ok(Err(e)) => {
            log::error!("❌ Errore avvio: {}", e);
            Err(e)
        }
        Err(e) => {
            log::error!("❌ Errore spawn_blocking: {}", e);
            Err(format!("Errore thread: {}", e))
        }
    }
}

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
