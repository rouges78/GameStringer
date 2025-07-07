use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use std::path::Path;
use std::fs;
use reqwest::Client;
use once_cell::sync::Lazy;
use crate::commands::library::InstalledGame;

// Client HTTP globale per GOG
static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("GameStringer/1.0")
        .build()
        .expect("Failed to create HTTP client")
});

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GogGame {
    pub id: u64,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub release_date: Option<String>,
    pub price: Option<GogPrice>,
    pub images: GogImages,
    pub genres: Vec<String>,
    pub tags: Vec<String>,
    pub rating: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GogPrice {
    pub currency: String,
    pub base_price: Option<String>,
    pub final_price: Option<String>,
    pub discount_percentage: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GogImages {
    pub background: Option<String>,
    pub logo: Option<String>,
    pub icon: Option<String>,
    pub boxart: Option<String>,
}

/// Scansiona i giochi GOG installati localmente
pub async fn get_gog_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // GOG Galaxy installa i giochi in diverse cartelle
    let possible_paths = vec![
        r"C:\Program Files (x86)\GOG Galaxy\Games",
        r"C:\GOG Games",
        r"D:\GOG Games",
        r"E:\GOG Games",
    ];
    
    for base_path in possible_paths {
        let path = Path::new(base_path);
        if path.exists() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Ok(game) = parse_gog_game_folder(&entry.path()).await {
                            games.push(game);
                        }
                    }
                }
            }
        }
    }
    
    // Controlla anche il registro di Windows per i giochi GOG
    if let Ok(registry_games) = get_gog_games_from_registry().await {
        games.extend(registry_games);
    }
    
    Ok(games)
}

/// Recupera i dettagli di un gioco GOG tramite l'API pubblica
#[tauri::command]
pub async fn get_gog_game_details(game_id: String) -> Result<GogGame, String> {
    println!("[GOG] Recupero dettagli per: {}", game_id);
    
    // GOG API endpoint pubblico
    let url = format!("https://api.gog.com/products/{}?expand=description", game_id);
    
    match HTTP_CLIENT.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => parse_gog_game_data(&data),
                    Err(e) => Err(format!("Errore parsing JSON GOG API: {}", e)),
                }
            } else {
                Err(format!("Errore HTTP GOG API: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Errore connessione GOG API: {}", e)),
    }
}

/// Cerca un gioco GOG per nome
#[tauri::command]
pub async fn search_gog_game(query: String) -> Result<Vec<GogGame>, String> {
    println!("[GOG] Ricerca gioco: {}", query);
    
    let url = format!("https://api.gog.com/products?search={}&limit=10", 
                     urlencoding::encode(&query));
    
    match HTTP_CLIENT.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        let mut games = Vec::new();
                        if let Some(products) = data["products"].as_array() {
                            for product in products {
                                if let Ok(game) = parse_gog_game_data(product) {
                                    games.push(game);
                                }
                            }
                        }
                        Ok(games)
                    }
                    Err(e) => Err(format!("Errore parsing JSON GOG search: {}", e)),
                }
            } else {
                Err(format!("Errore HTTP GOG search: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Errore connessione GOG search: {}", e)),
    }
}

/// Recupera l'URL della copertina di un gioco GOG
#[tauri::command]
pub async fn get_gog_game_cover(game_id: String) -> Result<String, String> {
    println!("[GOG] Recupero copertina per: {}", game_id);
    
    match get_gog_game_details(game_id).await {
        Ok(game) => {
            // Priorità: boxart > logo > icon > background
            if let Some(boxart) = &game.images.boxart {
                Ok(boxart.clone())
            } else if let Some(logo) = &game.images.logo {
                Ok(logo.clone())
            } else if let Some(icon) = &game.images.icon {
                Ok(icon.clone())
            } else if let Some(background) = &game.images.background {
                Ok(background.clone())
            } else {
                Err("Nessuna immagine disponibile per questo gioco".to_string())
            }
        }
        Err(e) => Err(e),
    }
}

/// Recupera più copertine GOG in batch
#[tauri::command]
pub async fn get_gog_covers_batch(game_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    println!("[GOG] Recupero copertine batch per {} giochi", game_ids.len());
    
    let mut covers = HashMap::new();
    
    // Processa in batch di 3 per rispettare i rate limits di GOG
    for chunk in game_ids.chunks(3) {
        let mut tasks = Vec::new();
        
        for game_id in chunk {
            let game_id_clone = game_id.clone();
            tasks.push(tokio::spawn(async move {
                (game_id_clone.clone(), get_gog_game_cover(game_id_clone).await)
            }));
        }
        
        // Aspetta che tutti i task del batch completino
        for task in tasks {
            if let Ok((game_id, result)) = task.await {
                if let Ok(cover_url) = result {
                    covers.insert(game_id, cover_url);
                }
            }
        }
        
        // Pausa tra i batch per rispettare i rate limits
        tokio::time::sleep(Duration::from_millis(1000)).await;
    }
    
    Ok(covers)
}

/// Test della connessione GOG API
#[tauri::command]
pub async fn test_gog_connection() -> Result<String, String> {
    println!("[GOG] Test connessione API");
    
    let url = "https://api.gog.com/products?limit=1";
    
    match HTTP_CLIENT.get(url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                Ok(format!("Connessione GOG API riuscita (Status: {} OK)", response.status().as_u16()))
            } else {
                Err(format!("Errore HTTP: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Errore connessione: {}", e)),
    }
}

#[tauri::command]
pub async fn disconnect_gog() -> Result<String, String> {
    println!("[RUST] 🔌 disconnect_gog called!");
    
    // Per GOG, la disconnessione significa invalidare le credenziali locali
    // In futuro qui potremmo cancellare token salvati o cache
    
    Ok("GOG disconnesso con successo".to_string())
}

// Funzioni helper private

async fn parse_gog_game_folder(folder_path: &Path) -> Result<InstalledGame, String> {
    let folder_name = folder_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // Cerca l'eseguibile principale
    let executable = find_main_executable(folder_path).await;
    
    // Ottieni metadati della cartella
    let metadata = folder_path.metadata().ok();
    
    Ok(InstalledGame {
        id: format!("gog_{}", folder_name.to_lowercase().replace(" ", "_")),
        name: folder_name.clone(),
        path: folder_path.to_string_lossy().to_string(),
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "GOG".to_string(),
    })
}

async fn find_main_executable(game_path: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(game_path) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if file_name.ends_with(".exe") && !file_name.contains("unins") {
                    return Some(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

async fn get_gog_games_from_registry() -> Result<Vec<InstalledGame>, String> {
    use winreg::enums::*;
    use winreg::RegKey;
    
    let mut games = Vec::new();
    
    // Controlla il registro di Windows per i giochi GOG
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    if let Ok(uninstall_key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall") {
        for subkey_name in uninstall_key.enum_keys().flatten() {
            if let Ok(subkey) = uninstall_key.open_subkey(&subkey_name) {
                if let Ok(publisher) = subkey.get_value::<String, _>("Publisher") {
                    if publisher.contains("GOG") {
                        if let (Ok(display_name), Ok(install_location)) = (
                            subkey.get_value::<String, _>("DisplayName"),
                            subkey.get_value::<String, _>("InstallLocation")
                        ) {
                            let game = InstalledGame {
                                id: format!("gog_{}", subkey_name.to_lowercase()),
                                name: display_name,
                                path: install_location.clone(),
                                executable: find_main_executable(Path::new(&install_location)).await,
                                size_bytes: None,
                                last_modified: None,
                                platform: "GOG".to_string(),
                            };
                            games.push(game);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

fn parse_gog_game_data(data: &serde_json::Value) -> Result<GogGame, String> {
    let id = data["id"].as_u64().unwrap_or(0);
    let title = data["title"].as_str().unwrap_or("Unknown").to_string();
    let slug = data["slug"].as_str().unwrap_or("").to_string();
    let description = data["description"].as_str().map(|s| s.to_string());
    
    // Parsing delle immagini
    let images = GogImages {
        background: data["images"]["background"].as_str().map(|s| s.to_string()),
        logo: data["images"]["logo"].as_str().map(|s| s.to_string()),
        icon: data["images"]["icon"].as_str().map(|s| s.to_string()),
        boxart: data["images"]["boxart"].as_str().map(|s| s.to_string()),
    };
    
    // Parsing dei generi
    let mut genres = Vec::new();
    if let Some(genre_array) = data["genres"].as_array() {
        for genre in genre_array {
            if let Some(name) = genre["name"].as_str() {
                genres.push(name.to_string());
            }
        }
    }
    
    // Parsing dei tag
    let mut tags = Vec::new();
    if let Some(tag_array) = data["tags"].as_array() {
        for tag in tag_array {
            if let Some(name) = tag["name"].as_str() {
                tags.push(name.to_string());
            }
        }
    }
    
    // Parsing del prezzo
    let price = if let Some(price_data) = data["price"].as_object() {
        Some(GogPrice {
            currency: price_data["currency"].as_str().unwrap_or("USD").to_string(),
            base_price: price_data["basePrice"].as_str().map(|s| s.to_string()),
            final_price: price_data["finalPrice"].as_str().map(|s| s.to_string()),
            discount_percentage: price_data["discountPercentage"].as_i64().map(|p| p as i32),
        })
    } else {
        None
    };
    
    Ok(GogGame {
        id,
        title,
        slug,
        description,
        developer: data["developer"]["name"].as_str().map(|s| s.to_string()),
        publisher: data["publisher"]["name"].as_str().map(|s| s.to_string()),
        release_date: data["releaseDate"].as_str().map(|s| s.to_string()),
        price,
        images,
        genres,
        tags,
        rating: data["rating"].as_f64().map(|r| r as f32),
    })
}
