use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use reqwest::Client;
use once_cell::sync::Lazy;

// Client HTTP globale per Epic Games
static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("GameStringer/1.0")
        .build()
        .expect("Failed to create HTTP client")
});

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpicGame {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub release_date: Option<String>,
    pub price: Option<EpicPrice>,
    pub images: Vec<EpicImage>,
    pub categories: Vec<EpicCategory>,
    pub tags: Vec<EpicTag>,
    pub rating: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpicPrice {
    pub currency: String,
    pub original_price: Option<i32>,
    pub discount_price: Option<i32>,
    pub discount_percentage: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpicImage {
    pub r#type: String,
    pub url: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpicCategory {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpicTag {
    pub id: String,
    pub name: String,
}

/// Recupera i dettagli di un gioco Epic Games tramite l'API pubblica
#[tauri::command]
pub async fn get_epic_game_details(app_name: String) -> Result<EpicGame, String> {
    println!("[EPIC] Recupero dettagli per: {}", app_name);
    
    // Epic Games Store API endpoint (pubblico)
    let url = format!(
        "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=it&country=IT&allowCountries=IT"
    );
    
    match HTTP_CLIENT.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        // Cerca il gioco specifico nei dati
                        if let Some(games) = data["data"]["Catalog"]["searchStore"]["elements"].as_array() {
                            for game in games {
                                if let Some(id) = game["id"].as_str() {
                                    if id == app_name || game["title"].as_str().unwrap_or("").to_lowercase().contains(&app_name.to_lowercase()) {
                                        return parse_epic_game_data(game);
                                    }
                                }
                            }
                        }
                        Err(format!("Gioco '{}' non trovato nell'Epic Games Store", app_name))
                    }
                    Err(e) => Err(format!("Errore parsing JSON Epic API: {}", e)),
                }
            } else {
                Err(format!("Errore HTTP Epic API: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Errore connessione Epic API: {}", e)),
    }
}

/// Recupera l'URL della copertina di un gioco Epic Games
#[tauri::command]
pub async fn get_epic_game_cover(app_name: String) -> Result<String, String> {
    println!("[EPIC] Recupero copertina per: {}", app_name);
    
    match get_epic_game_details(app_name).await {
        Ok(game) => {
            // Cerca l'immagine di tipo "DieselStoreFrontWide" o "OfferImageWide"
            for image in &game.images {
                if image.r#type == "DieselStoreFrontWide" || image.r#type == "OfferImageWide" {
                    return Ok(image.url.clone());
                }
            }
            
            // Se non troviamo l'immagine specifica, prendiamo la prima disponibile
            if let Some(first_image) = game.images.first() {
                Ok(first_image.url.clone())
            } else {
                Err("Nessuna immagine disponibile per questo gioco".to_string())
            }
        }
        Err(e) => Err(e),
    }
}

/// Recupera più copertine Epic Games in batch
#[tauri::command]
pub async fn get_epic_covers_batch(app_names: Vec<String>) -> Result<HashMap<String, String>, String> {
    println!("[EPIC] Recupero copertine batch per {} giochi", app_names.len());
    
    let mut covers = HashMap::new();
    
    // Per evitare di sovraccaricare l'API, processiamo in batch di 5
    for chunk in app_names.chunks(5) {
        let mut tasks = Vec::new();
        
        for app_name in chunk {
            let app_name_clone = app_name.clone();
            tasks.push(tokio::spawn(async move {
                (app_name_clone.clone(), get_epic_game_cover(app_name_clone).await)
            }));
        }
        
        // Aspetta che tutti i task del batch completino
        for task in tasks {
            if let Ok((app_name, result)) = task.await {
                if let Ok(cover_url) = result {
                    covers.insert(app_name, cover_url);
                }
            }
        }
        
        // Pausa tra i batch per rispettare i rate limits
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    
    Ok(covers)
}

/// Test della connessione Epic Games API
#[tauri::command]
pub async fn test_epic_connection() -> Result<String, String> {
    println!("[RUST] 🧪 test_epic_connection called!");
    
    // Test connessione all'API Epic Games Store
    let url = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions";
    
    match HTTP_CLIENT.get(url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                Ok(format!("Connessione Epic Games API riuscita (Status: {} OK)", response.status().as_u16()))
            } else {
                Err(format!("Epic Games API ha risposto con errore: {}", response.status()))
            }
        }
        Err(e) => {
            Err(format!("Errore di connessione Epic Games API: {}", e))
        }
    }
}

#[tauri::command]
pub async fn disconnect_epic() -> Result<String, String> {
    println!("[RUST] 🔌 disconnect_epic called!");
    
    // Per Epic Games, la disconnessione significa invalidare le credenziali locali
    // In futuro qui potremmo cancellare token salvati o cache
    
    Ok("Epic Games disconnesso con successo".to_string())
}

// Funzione helper per parsare i dati di un gioco Epic
fn parse_epic_game_data(game_data: &serde_json::Value) -> Result<EpicGame, String> {
    let id = game_data["id"].as_str().unwrap_or("").to_string();
    let title = game_data["title"].as_str().unwrap_or("Unknown").to_string();
    let description = game_data["description"].as_str().map(|s| s.to_string());
    
    // Parsing delle immagini
    let mut images = Vec::new();
    if let Some(key_images) = game_data["keyImages"].as_array() {
        for img in key_images {
            if let Some(url) = img["url"].as_str() {
                images.push(EpicImage {
                    r#type: img["type"].as_str().unwrap_or("").to_string(),
                    url: url.to_string(),
                    width: img["width"].as_i64().map(|w| w as i32),
                    height: img["height"].as_i64().map(|h| h as i32),
                });
            }
        }
    }
    
    // Parsing delle categorie
    let mut categories = Vec::new();
    if let Some(cats) = game_data["categories"].as_array() {
        for cat in cats {
            if let Some(path) = cat["path"].as_str() {
                categories.push(EpicCategory {
                    path: path.to_string(),
                });
            }
        }
    }
    
    // Parsing dei tag
    let mut tags = Vec::new();
    if let Some(tag_array) = game_data["tags"].as_array() {
        for tag in tag_array {
            if let Some(id) = tag["id"].as_str() {
                tags.push(EpicTag {
                    id: id.to_string(),
                    name: tag["name"].as_str().unwrap_or(id).to_string(),
                });
            }
        }
    }
    
    // Parsing del prezzo
    let price = if let Some(price_data) = game_data["price"].as_object() {
        Some(EpicPrice {
            currency: price_data["currencyCode"].as_str().unwrap_or("EUR").to_string(),
            original_price: price_data["originalPrice"].as_i64().map(|p| p as i32),
            discount_price: price_data["discountPrice"].as_i64().map(|p| p as i32),
            discount_percentage: price_data["discountPercentage"].as_i64().map(|p| p as i32),
        })
    } else {
        None
    };
    
    Ok(EpicGame {
        id,
        title,
        description,
        developer: game_data["developer"].as_str().map(|s| s.to_string()),
        publisher: game_data["publisher"].as_str().map(|s| s.to_string()),
        release_date: game_data["releaseDate"].as_str().map(|s| s.to_string()),
        price,
        images,
        categories,
        tags,
        rating: game_data["rating"].as_f64().map(|r| r as f32),
    })
}
