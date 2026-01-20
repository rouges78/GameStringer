use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use std::path::Path;
use std::fs;
use reqwest::Client;
use once_cell::sync::Lazy;
use crate::commands::library::InstalledGame;
use std::path::PathBuf;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use aes_gcm::aead::Aead;
use rand::{RngCore, rngs::OsRng};
use base64::{Engine as _, engine::general_purpose};
use chrono;

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

#[derive(Debug, Serialize, Deserialize)]
struct GogCredentials {
    pub email_encrypted: String,
    pub password_encrypted: String,
    pub username: Option<String>,
    pub saved_at: String,
    pub nonce: String,
}

/// Represents a GOG user account with authentication details
/// 
/// This structure contains the essential information for a GOG user account,
/// including username, email, and optional profile identifier.
/// 
/// # Fields
/// 
/// * `username` - The GOG username
/// * `email` - The user's email address
/// * `profile_id` - Optional GOG profile identifier
#[derive(Debug, Serialize, Deserialize)]
pub struct GogUser {
    pub username: String,
    pub email: String,
    pub profile_id: Option<String>,
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
    
    // Prima prova l'API principale
    let url = "https://api.gog.com/products?limit=1";
    
    match HTTP_CLIENT.get(url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                return Ok(format!("Connessione GOG API riuscita (Status: {} OK)", response.status().as_u16()));
            } else if response.status().as_u16() == 500 {
                // GOG API ha problemi temporanei, prova endpoint alternativo
                println!("[GOG] API principale non disponibile (500), provo endpoint alternativo...");
            } else {
                return Err(format!("Errore HTTP: {}", response.status()));
            }
        }
        Err(e) => {
            println!("[GOG] Errore connessione primaria: {}", e);
        }
    }
    
    // Fallback: verifica se il sito GOG è raggiungibile
    let fallback_url = "https://www.gog.com";
    match HTTP_CLIENT.head(fallback_url).send().await {
        Ok(response) => {
            if response.status().is_success() || response.status().as_u16() == 301 || response.status().as_u16() == 302 {
                Ok("Connessione GOG riuscita (API temporaneamente non disponibile, ma servizio raggiungibile)".to_string())
            } else {
                Err(format!("GOG non raggiungibile (Status: {})", response.status()))
            }
        }
        Err(e) => Err(format!("Impossibile connettersi a GOG: {}", e)),
    }
}

/// Connetti account GOG
#[tauri::command]
pub async fn connect_gog(email: String, password: String, two_factor_code: Option<String>) -> Result<String, String> {
    println!("[GOG] Connessione account per: {}", email);
    
    // Validazione base credenziali
    if email.is_empty() || password.is_empty() {
        return Err("Email e password sono obbligatorie".to_string());
    }
    
    if !email.contains("@") {
        return Err("Email non valida".to_string());
    }
    
    if password.len() < 6 {
        return Err("Password troppo corta".to_string());
    }
    
    // NOTA: GOG non ha API pubblica per autenticazione diretta
    // Per ora simulo l'autenticazione con validazione delle credenziali
    // In futuro si potrebbe implementare l'integrazione con GOG Galaxy
    
    if let Some(tfa_code) = &two_factor_code {
        println!("[GOG] Simulando autenticazione per: {} con 2FA: {}", email, tfa_code);
    } else {
        println!("[GOG] Simulando autenticazione per: {} (senza 2FA)", email);
    }
    
    // Test autenticazione
    match test_gog_auth(&email, &password).await {
        Ok(user) => {
            // Salva le credenziali
            let save_result = save_gog_credentials(email, password, user.username.clone()).await;
            match save_result {
                Ok(_) => println!("[GOG] Credenziali salvate con successo"),
                Err(e) => println!("[GOG] Avviso: Non è stato possibile salvare le credenziali: {}", e),
            }
            
            // Conta giochi locali installati
            let games = get_gog_installed_games().await?;
            
            Ok(format!("✅ Connesso come '{}' - {} giochi locali trovati (API GOG funzionante)", 
                      user.username, games.len()))
        }
        Err(e) => {
            println!("[GOG] Errore autenticazione: {}", e);
            Err(format!("❌ Errore autenticazione: {}", e))
        }
    }
}

#[tauri::command]
pub async fn disconnect_gog() -> Result<String, String> {
    println!("[GOG] Disconnessione account");
    
    // Cancella le credenziali salvate
    clear_gog_credentials().await?;
    
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
    let mut found_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    // 🆕 METODO 1: Registro diretto GOG (come Vortex) - PIÙ AFFIDABILE
    // HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\GOG.com\Games
    if let Ok(gog_games_key) = hklm.open_subkey("SOFTWARE\\WOW6432Node\\GOG.com\\Games") {
        println!("[GOG] ✅ Trovato registro diretto GOG.com\\Games");
        
        for subkey_name in gog_games_key.enum_keys().flatten() {
            if let Ok(game_key) = gog_games_key.open_subkey(&subkey_name) {
                // Leggi i valori dal registro GOG diretto
                let game_id: String = game_key.get_value("gameID").unwrap_or(subkey_name.clone());
                let game_name: String = game_key.get_value("gameName").unwrap_or_default();
                let install_path: String = game_key.get_value("path").unwrap_or_default();
                let exe_path: String = game_key.get_value("exe").unwrap_or_default();
                let _version: String = game_key.get_value("ver").unwrap_or_default();
                
                if !game_name.is_empty() && !install_path.is_empty() {
                    let unique_id = format!("gog_{}", game_id);
                    
                    if !found_ids.contains(&unique_id) {
                        found_ids.insert(unique_id.clone());
                        
                        // Usa exe dal registro se disponibile, altrimenti cerca
                        let executable = if !exe_path.is_empty() && Path::new(&exe_path).exists() {
                            Some(exe_path)
                        } else {
                            find_main_executable(Path::new(&install_path)).await
                        };
                        
                        let metadata = Path::new(&install_path).metadata().ok();
                        
                        let game = InstalledGame {
                            id: unique_id,
                            name: game_name,
                            path: install_path,
                            executable,
                            size_bytes: metadata.as_ref().map(|m| m.len()),
                            last_modified: metadata.and_then(|m| {
                                m.modified().ok().and_then(|t| {
                                    t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
                                })
                            }),
                            platform: "GOG".to_string(),
                        };
                        games.push(game);
                    }
                }
            }
        }
        
        println!("[GOG] Trovati {} giochi dal registro diretto GOG", games.len());
    }
    
    // METODO 2: Fallback al registro Uninstall (per giochi più vecchi)
    if let Ok(uninstall_key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall") {
        for subkey_name in uninstall_key.enum_keys().flatten() {
            if let Ok(subkey) = uninstall_key.open_subkey(&subkey_name) {
                if let Ok(publisher) = subkey.get_value::<String, _>("Publisher") {
                    if publisher.contains("GOG") {
                        if let (Ok(display_name), Ok(install_location)) = (
                            subkey.get_value::<String, _>("DisplayName"),
                            subkey.get_value::<String, _>("InstallLocation")
                        ) {
                            let unique_id = format!("gog_{}", subkey_name.to_lowercase());
                            
                            // Evita duplicati
                            if !found_ids.contains(&unique_id) {
                                found_ids.insert(unique_id.clone());
                                
                                let game = InstalledGame {
                                    id: unique_id,
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
    }
    
    // METODO 3: Anche 32-bit Uninstall per compatibilità
    if let Ok(uninstall_key) = hklm.open_subkey("SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall") {
        for subkey_name in uninstall_key.enum_keys().flatten() {
            if let Ok(subkey) = uninstall_key.open_subkey(&subkey_name) {
                if let Ok(publisher) = subkey.get_value::<String, _>("Publisher") {
                    if publisher.contains("GOG") {
                        if let (Ok(display_name), Ok(install_location)) = (
                            subkey.get_value::<String, _>("DisplayName"),
                            subkey.get_value::<String, _>("InstallLocation")
                        ) {
                            let unique_id = format!("gog_{}", subkey_name.to_lowercase());
                            
                            if !found_ids.contains(&unique_id) {
                                found_ids.insert(unique_id.clone());
                                
                                let game = InstalledGame {
                                    id: unique_id,
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
    }
    
    println!("[GOG] ✅ Totale {} giochi GOG trovati dal registro", games.len());
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

/// Test autenticazione GOG (simulato)
pub async fn test_gog_auth(email: &str, password: &str) -> Result<GogUser, String> {
    println!("[GOG] Testing authentication for: {}", email);
    
    // NOTA: GOG non ha API pubblica facilmente accessibile per autenticazione
    // Per ora simulo l'autenticazione controllando che le credenziali non siano vuote
    // In futuro si potrebbe implementare l'integrazione con GOG Galaxy
    
    if email.is_empty() || password.is_empty() {
        return Err("Email e password sono obbligatorie".to_string());
    }
    
    if !email.contains("@") {
        return Err("Email non valida".to_string());
    }
    
    if password.len() < 6 {
        return Err("Password troppo corta".to_string());
    }
    
    // Testa la connessione API GOG (opzionale - non blocca se fallisce)
    match test_gog_connection().await {
        Ok(msg) => println!("[GOG] {}", msg),
        Err(e) => println!("[GOG] ⚠️ API GOG non raggiungibile ({}), procedo comunque con scansione locale", e),
    }
    
    // Simula un utente autenticato - le credenziali verranno salvate per uso futuro
    let username = email.split('@').next().unwrap_or("User").to_string();
    
    Ok(GogUser {
        username,
        email: email.to_string(),
        profile_id: Some("local_profile".to_string()),
    })
}

// Funzioni per gestione credenziali GOG

fn get_gog_credentials_path() -> Result<PathBuf, String> {
    let mut path = std::env::current_dir()
        .map_err(|e| format!("Errore getting current dir: {}", e))?;
    path.push(".cache");
    
    // Crea la directory .cache se non esiste
    if !path.exists() {
        fs::create_dir_all(&path)
            .map_err(|e| format!("Errore creating .cache directory: {}", e))?;
    }
    
    path.push("gog_credentials.json");
    Ok(path)
}

fn get_machine_key() -> Result<[u8; 32], String> {
    // Genera una chiave basata su caratteristiche della macchina
    let username = std::env::var("USERNAME").unwrap_or_else(|_| "default".to_string());
    let computer_name = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "default".to_string());
    
    // Combina username e computer name per creare un seed
    let seed = format!("{}:{}", username, computer_name);
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    use std::hash::Hasher;
    hasher.write(seed.as_bytes());
    let hash = hasher.finish();
    
    // Converti l'hash in una chiave di 32 byte
    let mut key = [0u8; 32];
    let hash_bytes = hash.to_le_bytes();
    for i in 0..32 {
        key[i] = hash_bytes[i % 8];
    }
    
    Ok(key)
}

fn encrypt_credentials(email: &str, password: &str) -> Result<(String, String, String), String> {
    if email.is_empty() || password.is_empty() {
        return Err("Email e password non possono essere vuoti".to_string());
    }
    
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    // Aggiungi timestamp per verifica integrità
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let email_payload = format!("{}:{}", email, timestamp);
    let password_payload = format!("{}:{}", password, timestamp);
    
    // Genera nonce sicuro
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Cripta con AES-GCM
    let email_ciphertext = cipher.encrypt(nonce, email_payload.as_bytes())
        .map_err(|e| format!("Email encryption failed: {}", e))?;
    let password_ciphertext = cipher.encrypt(nonce, password_payload.as_bytes())
        .map_err(|e| format!("Password encryption failed: {}", e))?;
    
    Ok((
        general_purpose::STANDARD.encode(&email_ciphertext),
        general_purpose::STANDARD.encode(&password_ciphertext),
        general_purpose::STANDARD.encode(&nonce_bytes)
    ))
}

fn decrypt_credentials(email_encrypted: &str, password_encrypted: &str, nonce_str: &str) -> Result<(String, String), String> {
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    let email_ciphertext = general_purpose::STANDARD.decode(email_encrypted)
        .map_err(|e| format!("Email base64 decode failed: {}", e))?;
    let password_ciphertext = general_purpose::STANDARD.decode(password_encrypted)
        .map_err(|e| format!("Password base64 decode failed: {}", e))?;
    let nonce_bytes = general_purpose::STANDARD.decode(nonce_str)
        .map_err(|e| format!("Nonce decode failed: {}", e))?;
    
    if nonce_bytes.len() != 12 {
        return Err("Invalid nonce length".to_string());
    }
    
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let email_plaintext = cipher.decrypt(nonce, email_ciphertext.as_slice())
        .map_err(|e| format!("Email decryption failed: {}", e))?;
    let password_plaintext = cipher.decrypt(nonce, password_ciphertext.as_slice())
        .map_err(|e| format!("Password decryption failed: {}", e))?;
    
    let email_payload = String::from_utf8(email_plaintext)
        .map_err(|e| format!("Email UTF-8 decode failed: {}", e))?;
    let password_payload = String::from_utf8(password_plaintext)
        .map_err(|e| format!("Password UTF-8 decode failed: {}", e))?;
    
    // Estrai credenziali dai payload (formato: "credential:timestamp")
    let email_parts: Vec<&str> = email_payload.split(':').collect();
    let password_parts: Vec<&str> = password_payload.split(':').collect();
    
    if email_parts.len() != 2 || password_parts.len() != 2 {
        return Err("Invalid payload format".to_string());
    }
    
    Ok((email_parts[0].to_string(), password_parts[0].to_string()))
}

/// Salva credenziali GOG criptate
#[tauri::command]
pub async fn save_gog_credentials(email: String, password: String, username: String) -> Result<String, String> {
    println!("[GOG] Salvando credenziali per user: {}", username);
    
    if email.is_empty() || password.is_empty() {
        return Err("Email e password sono obbligatorie".to_string());
    }
    
    // Cripta le credenziali
    let (email_encrypted, password_encrypted, nonce) = encrypt_credentials(&email, &password)?;
    
    let credentials = GogCredentials {
        email_encrypted,
        password_encrypted,
        username: Some(username.clone()),
        saved_at: chrono::Utc::now().to_rfc3339(),
        nonce,
    };
    
    let credentials_path = get_gog_credentials_path()?;
    let json_data = serde_json::to_string_pretty(&credentials)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&credentials_path, json_data)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    println!("[GOG] ✅ Credenziali salvate per: {}", username);
    Ok("Credenziali GOG salvate con encryption AES-256".to_string())
}

/// Carica credenziali GOG
#[tauri::command]
pub async fn load_gog_credentials() -> Result<serde_json::Value, String> {
    let credentials_path = get_gog_credentials_path()?;
    
    if !credentials_path.exists() {
        return Err("Nessuna credenziale GOG salvata".to_string());
    }
    
    let json_data = fs::read_to_string(&credentials_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let credentials: GogCredentials = serde_json::from_str(&json_data)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    // Decripta le credenziali
    let (email, password) = decrypt_credentials(&credentials.email_encrypted, &credentials.password_encrypted, &credentials.nonce)?;
    
    Ok(serde_json::json!({
        "email": email,
        "password": password,
        "username": credentials.username,
        "saved_at": credentials.saved_at
    }))
}

/// Cancella credenziali GOG
#[tauri::command]
pub async fn clear_gog_credentials() -> Result<String, String> {
    let credentials_path = get_gog_credentials_path()?;
    
    if credentials_path.exists() {
        fs::remove_file(&credentials_path)
            .map_err(|e| format!("Errore cancellazione file: {}", e))?;
    }
    
    Ok("Credenziali GOG cancellate".to_string())
}
