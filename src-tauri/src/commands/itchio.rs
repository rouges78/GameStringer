use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::fs;
use winreg::enums::*;
use winreg::RegKey;
use crate::commands::library::InstalledGame;
use std::path::PathBuf;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use aes_gcm::aead::Aead;
use rand::{RngCore, rngs::OsRng};
use base64;
use chrono;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ItchioGame {
    pub id: String,
    pub title: String,
    pub install_path: Option<String>,
    pub executable: Option<String>,
    pub platform: String, // "itch.io"
    pub size_bytes: Option<u64>,
    pub last_modified: Option<u64>,
    pub author: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ItchioCredentials {
    pub api_key_encrypted: String,
    pub username: String,
    pub saved_at: String,
    pub nonce: String,
}

/// Scansiona i giochi itch.io installati localmente
pub async fn get_itchio_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // 1. Scansiona giochi itch.io dal registro
    if let Ok(itchio_games) = scan_itchio_registry().await {
        games.extend(itchio_games);
    }
    
    // 2. Scansiona cartelle di installazione itch.io
    if let Ok(folder_games) = scan_itchio_folders().await {
        games.extend(folder_games);
    }
    
    // 3. Scansiona database itch.io app (se disponibile)
    if let Ok(db_games) = scan_itchio_database().await {
        games.extend(db_games);
    }
    
    // Rimuovi duplicati basandosi sul nome del gioco
    let mut unique_games = Vec::new();
    let mut seen_names = std::collections::HashSet::new();
    
    for game in games {
        if seen_names.insert(game.name.clone()) {
            unique_games.push(game);
        }
    }
    
    Ok(unique_games)
}

/// Scansiona giochi itch.io dal registro
async fn scan_itchio_registry() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    // Chiavi di registro per itch.io
    let registry_paths = vec![
        ("HKLM", "SOFTWARE\\WOW6432Node\\itch"),
        ("HKLM", "SOFTWARE\\itch"),
        ("HKCU", "SOFTWARE\\itch"),
        ("HKCU", "SOFTWARE\\itch.io"),
    ];
    
    for (hive, registry_path) in registry_paths {
        let reg_key = match hive {
            "HKLM" => &hklm,
            "HKCU" => &hkcu,
            _ => continue,
        };
        
        if let Ok(itch_key) = reg_key.open_subkey(registry_path) {
            for game_key_name in itch_key.enum_keys().flatten() {
                if let Ok(game_key) = itch_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_itchio_registry_entry(&game_key, &game_key_name).await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona cartelle di installazione itch.io
async fn scan_itchio_folders() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Cartelle comuni per itch.io
    let possible_paths = vec![
        // Percorsi standard itch.io app
        r"C:\Users\%USERNAME%\AppData\Roaming\itch\apps",
        r"C:\Users\%USERNAME%\AppData\Local\itch\apps",
        r"C:\Program Files\itch\apps",
        r"C:\Program Files (x86)\itch\apps",
        // Percorsi personalizzati comuni
        r"D:\itch.io",
        r"E:\itch.io",
        r"D:\Games\itch.io",
        r"E:\Games\itch.io",
    ];
    
    // Espandi %USERNAME% nei percorsi
    let username = std::env::var("USERNAME").unwrap_or_else(|_| "User".to_string());
    
    for base_path_template in possible_paths {
        let base_path = base_path_template.replace("%USERNAME%", &username);
        let path = Path::new(&base_path);
        
        if path.exists() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Ok(game) = parse_itchio_game_folder(&entry.path()).await {
                            games.push(game);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona database itch.io app (se disponibile)
async fn scan_itchio_database() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // itch.io app memorizza i dati in SQLite, ma per semplicità
    // cerchiamo i file di configurazione JSON
    let username = std::env::var("USERNAME").unwrap_or_else(|_| "User".to_string());
    
    let config_paths = vec![
        format!(r"C:\Users\{}\AppData\Roaming\itch\db\butler.db", username),
        format!(r"C:\Users\{}\AppData\Roaming\itch\preferences.json", username),
        format!(r"C:\Users\{}\AppData\Local\itch\preferences.json", username),
    ];
    
    for config_path in config_paths {
        let path = Path::new(&config_path);
        if path.exists() {
            // Per ora, saltiamo il parsing del database SQLite
            // In futuro si potrebbe implementare il parsing del database
            // per ottenere informazioni più dettagliate sui giochi
            break;
        }
    }
    
    Ok(games)
}

/// Test della connessione itch.io API
#[tauri::command]
pub async fn test_itchio_connection(api_key: Option<String>) -> Result<String, String> {
    println!("[ITCH.IO] Test connessione API");
    
    // Prima prova con API key passata, poi con credenziali salvate
    let key_to_use = if let Some(key) = api_key {
        Some(key)
    } else {
        // Carica credenziali salvate
        match load_itchio_credentials().await {
            Ok(credentials) => {
                if let Some(saved_key) = credentials.get("api_key").and_then(|v| v.as_str()) {
                    println!("[ITCH.IO] Utilizzando credenziali salvate");
                    Some(saved_key.to_string())
                } else {
                    None
                }
            }
            Err(_) => {
                println!("[ITCH.IO] Nessuna credenziale salvata");
                None
            }
        }
    };
    
    if let Some(key) = key_to_use {
        // Test connessione API itch.io
        match test_itchio_api(&key).await {
            Ok(user) => {
                match get_itchio_owned_games(&key).await {
                    Ok(games) => {
                        Ok(format!("✅ Connesso come '{}' - {} giochi trovati", 
                                  user.display_name.unwrap_or_else(|| user.username), 
                                  games.len()))
                    }
                    Err(e) => {
                        if e.contains("403") || e.contains("Forbidden") {
                            Ok(format!("✅ Connesso come '{}' - Autenticazione riuscita (limitazioni API per lista giochi)", 
                                      user.display_name.unwrap_or_else(|| user.username)))
                        } else {
                            Ok(format!("✅ Connesso come '{}' - Autenticazione riuscita", 
                                      user.display_name.unwrap_or_else(|| user.username)))
                        }
                    }
                }
            }
            Err(e) => Err(format!("❌ Errore connessione API: {}", e))
        }
    } else {
        // Fallback a scansione locale
        println!("[ITCH.IO] Nessuna API key - fallback a scansione locale");
        let games = get_itchio_installed_games().await?;
        Ok(format!("Scansione locale completata: {} giochi trovati", games.len()))
    }
}

/// Recupera informazioni su un gioco itch.io specifico
#[tauri::command]
pub async fn get_itchio_game_info(game_id: String) -> Result<ItchioGame, String> {
    println!("[ITCH.IO] Recupero informazioni per: {}", game_id);
    
    let games = get_itchio_installed_games().await?;
    
    for game in games {
        if game.id == game_id {
            return Ok(ItchioGame {
                id: game.id,
                title: game.name,
                install_path: Some(game.path),
                executable: game.executable,
                platform: game.platform,
                size_bytes: game.size_bytes,
                last_modified: game.last_modified,
                author: None, // Potrebbe essere estratto dal nome della cartella
                version: None, // Potrebbe essere estratto dai metadati
            });
        }
    }
    
    Err(format!("Gioco '{}' non trovato", game_id))
}

/// Recupera le copertine per i giochi itch.io (placeholder)
#[tauri::command]
pub async fn get_itchio_covers_batch(game_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    println!("[ITCH.IO] Recupero copertine per {} giochi (placeholder)", game_ids.len());
    
    // itch.io non ha API pubblica per le copertine
    // Restituiamo un HashMap vuoto per ora
    // In futuro si potrebbe implementare il recupero da fonti alternative
    // o cercare immagini locali nelle cartelle dei giochi
    let covers = HashMap::new();
    
    Ok(covers)
}

// Funzioni helper private

async fn parse_itchio_registry_entry(game_key: &RegKey, game_id: &str) -> Result<InstalledGame, String> {
    // Prova a leggere diversi campi possibili per itch.io
    let name = game_key.get_value::<String, _>("DisplayName")
        .or_else(|_| game_key.get_value::<String, _>("ProductName"))
        .or_else(|_| game_key.get_value::<String, _>("Title"))
        .or_else(|_| game_key.get_value::<String, _>("GameName"))
        .unwrap_or_else(|_| game_id.to_string());
    
    let install_path = game_key.get_value::<String, _>("InstallPath")
        .or_else(|_| game_key.get_value::<String, _>("InstallLocation"))
        .or_else(|_| game_key.get_value::<String, _>("Install Dir"))
        .or_else(|_| game_key.get_value::<String, _>("Path"))
        .unwrap_or_default();
    
    if install_path.is_empty() {
        return Err("Percorso di installazione non trovato".to_string());
    }
    
    let game_path = Path::new(&install_path);
    let executable = find_main_executable(game_path).await;
    
    // Ottieni metadati della cartella
    let metadata = game_path.metadata().ok();
    
    Ok(InstalledGame {
        id: format!("itchio_{}", game_id.to_lowercase()),
        name,
        path: install_path,
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "itch.io".to_string(),
    })
}

async fn parse_itchio_game_folder(folder_path: &Path) -> Result<InstalledGame, String> {
    let folder_name = folder_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // Salta cartelle che non sono giochi
    if folder_name.contains("itch") 
        || folder_name.contains("temp")
        || folder_name.contains("cache")
        || folder_name.contains("logs")
        || folder_name.starts_with(".") {
        return Err("Non è una cartella di gioco".to_string());
    }
    
    // Cerca l'eseguibile principale
    let executable = find_main_executable(folder_path).await;
    
    // Se non trova eseguibili, potrebbe essere un gioco web-only
    // In questo caso, cerchiamo file HTML o altri indicatori
    let has_web_content = if executable.is_none() {
        check_for_web_game(folder_path).await
    } else {
        false
    };
    
    // Ottieni metadati della cartella
    let metadata = folder_path.metadata().ok();
    
    // Pulisci il nome del gioco (spesso i nomi delle cartelle itch.io includono l'autore)
    let clean_name = clean_itchio_game_name(&folder_name);
    
    Ok(InstalledGame {
        id: format!("itchio_{}", folder_name.to_lowercase().replace(" ", "_").replace("-", "_")),
        name: clean_name,
        path: folder_path.to_string_lossy().to_string(),
        executable: if has_web_content { Some("web_game".to_string()) } else { executable },
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "itch.io".to_string(),
    })
}

async fn find_main_executable(game_path: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(game_path) {
        // Prima cerca eseguibili comuni per giochi indie
        let common_executables = vec![
            "game.exe", "Game.exe",
            "main.exe", "Main.exe",
            "start.exe", "Start.exe",
            "run.exe", "Run.exe",
            "play.exe", "Play.exe",
            "launcher.exe", "Launcher.exe",
        ];
        
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if common_executables.contains(&file_name) {
                    return Some(entry.path().to_string_lossy().to_string());
                }
            }
        }
        
        // Cerca qualsiasi .exe che non sia un installer/uninstaller
        if let Ok(entries) = fs::read_dir(game_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.ends_with(".exe") 
                        && !file_name.contains("unins") 
                        && !file_name.contains("Uninstall")
                        && !file_name.contains("setup")
                        && !file_name.contains("Setup")
                        && !file_name.contains("install")
                        && !file_name.contains("Install") {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    None
}

async fn check_for_web_game(game_path: &Path) -> bool {
    if let Ok(entries) = fs::read_dir(game_path) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if file_name.ends_with(".html") 
                    || file_name == "index.html"
                    || file_name.ends_with(".swf")
                    || file_name.ends_with(".unity3d") {
                    return true;
                }
            }
        }
    }
    false
}

fn clean_itchio_game_name(folder_name: &str) -> String {
    // I nomi delle cartelle itch.io spesso seguono il formato "game-name-by-author"
    // o "author-game-name". Proviamo a pulire il nome.
    
    let name = folder_name.replace("-", " ").replace("_", " ");
    
    // Rimuovi pattern comuni
    let cleaned = name
        .replace(" by ", " - ")
        .replace("by ", "")
        .trim()
        .to_string();
    
    // Capitalizza la prima lettera di ogni parola
    cleaned
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<String>>()
        .join(" ")
}

#[derive(Debug, Serialize, Deserialize)]
struct ItchioUser {
    pub username: String,
    pub display_name: Option<String>,
    pub url: Option<String>,
    pub id: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ItchioProfileResponse {
    pub user: ItchioUser,
}

#[derive(Debug, Serialize, Deserialize)]
struct ItchioApiGame {
    pub id: u64,
    pub title: String,
    pub url: String,
    pub short_text: Option<String>,
    pub cover_url: Option<String>,
    pub user: Option<ItchioUser>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ItchioApiResponse {
    pub games: Vec<ItchioApiGame>,
}

/// Test connessione API itch.io
pub async fn test_itchio_api(api_key: &str) -> Result<ItchioUser, String> {
    println!("[ITCH.IO] Testing API connection with key: {}...", &api_key[..8]);
    
    let client = reqwest::Client::new();
    let response = client
        .get("https://itch.io/api/1/key/me")
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("API returned status: {}", response.status()));
    }
    
    // Prima ottieni il testo della risposta per debug
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to get response text: {}", e))?;
    
    println!("[ITCH.IO] Raw API response: {}", response_text);
    
    // Prova a parsare come ItchioProfileResponse
    match serde_json::from_str::<ItchioProfileResponse>(&response_text) {
        Ok(profile_response) => {
            println!("[ITCH.IO] Successfully authenticated as: {}", profile_response.user.username);
            Ok(profile_response.user)
        }
        Err(_) => {
            // Se fallisce, prova a parsare direttamente come user
            match serde_json::from_str::<ItchioUser>(&response_text) {
                Ok(user) => {
                    println!("[ITCH.IO] Successfully authenticated as: {}", user.username);
                    Ok(user)
                }
                Err(e) => {
                    Err(format!("Failed to parse response as either format: {} | Response: {}", e, response_text))
                }
            }
        }
    }
}

/// Recupera giochi posseduti da itch.io API
pub async fn get_itchio_owned_games(api_key: &str) -> Result<Vec<ItchioApiGame>, String> {
    println!("[ITCH.IO] Fetching owned games from API");
    
    let client = reqwest::Client::new();
    let response = client
        .get("https://itch.io/api/1/key/my-games")
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("API returned status: {}", response.status()));
    }
    
    let api_response: ItchioApiResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse games: {}", e))?;
    
    println!("[ITCH.IO] Found {} games from API", api_response.games.len());
    Ok(api_response.games)
}

/// Connetti account itch.io usando API key
#[tauri::command]
pub async fn connect_itchio(api_key: String) -> Result<String, String> {
    println!("[ITCH.IO] Connessione account con API key");
    
    // Test connessione API
    match test_itchio_api(&api_key).await {
        Ok(user) => {
            // Salva le credenziali (per ora solo logging, in futuro salva in modo sicuro)
            println!("[ITCH.IO] Connesso come: {}", user.username);
            
            // Salva le credenziali
            let save_result = save_itchio_credentials(api_key.clone(), user.username.clone()).await;
            match save_result {
                Ok(_) => println!("[ITCH.IO] Credenziali salvate con successo"),
                Err(e) => println!("[ITCH.IO] Avviso: Non è stato possibile salvare le credenziali: {}", e),
            }
            
            // Prova a recuperare giochi (opzionale)
            match get_itchio_owned_games(&api_key).await {
                Ok(games) => {
                    println!("[ITCH.IO] {} giochi trovati nell'account", games.len());
                    Ok(format!("✅ Connesso come '{}' - {} giochi trovati", 
                              user.display_name.unwrap_or_else(|| user.username.clone()), 
                              games.len()))
                }
                Err(e) => {
                    println!("[ITCH.IO] Avviso recupero giochi: {} (connessione comunque riuscita)", e);
                    // Se l'autenticazione funziona ma i giochi no, considera comunque la connessione riuscita
                    if e.contains("403") || e.contains("Forbidden") {
                        Ok(format!("✅ Connesso come '{}' - Autenticazione riuscita (limitazioni API per lista giochi)", 
                                  user.display_name.unwrap_or_else(|| user.username.clone())))
                    } else {
                        Ok(format!("✅ Connesso come '{}' - Autenticazione riuscita", 
                                  user.display_name.unwrap_or_else(|| user.username.clone())))
                    }
                }
            }
        }
        Err(e) => {
            println!("[ITCH.IO] Errore connessione: {}", e);
            Err(format!("❌ Errore connessione: {}", e))
        }
    }
}

// Funzioni per gestione credenziali itch.io

fn get_itchio_credentials_path() -> Result<PathBuf, String> {
    let mut path = std::env::current_dir()
        .map_err(|e| format!("Errore getting current dir: {}", e))?;
    path.push(".cache");
    
    // Crea la directory .cache se non esiste
    if !path.exists() {
        fs::create_dir_all(&path)
            .map_err(|e| format!("Errore creating .cache directory: {}", e))?;
    }
    
    path.push("itchio_credentials.json");
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

fn encrypt_api_key(api_key: &str) -> Result<(String, String), String> {
    if api_key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    // Aggiungi timestamp per verifica integrità
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let payload = format!("{}:{}", api_key, timestamp);
    
    // Genera nonce sicuro
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Cripta con AES-GCM
    let ciphertext = cipher.encrypt(nonce, payload.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    use base64::{Engine as _, engine::general_purpose};
    
    Ok((
        general_purpose::STANDARD.encode(&ciphertext),
        general_purpose::STANDARD.encode(&nonce_bytes)
    ))
}

fn decrypt_api_key(encrypted_data: &str, nonce_str: &str) -> Result<String, String> {
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    use base64::{Engine as _, engine::general_purpose};
    
    let ciphertext = general_purpose::STANDARD.decode(encrypted_data)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;
    let nonce_bytes = general_purpose::STANDARD.decode(nonce_str)
        .map_err(|e| format!("Nonce decode failed: {}", e))?;
    
    if nonce_bytes.len() != 12 {
        return Err("Invalid nonce length".to_string());
    }
    
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = cipher.decrypt(nonce, ciphertext.as_slice())
        .map_err(|e| format!("Decryption failed: {}", e))?;
    
    let payload = String::from_utf8(plaintext)
        .map_err(|e| format!("UTF-8 decode failed: {}", e))?;
    
    // Estrai API key dal payload (formato: "api_key:timestamp")
    let parts: Vec<&str> = payload.split(':').collect();
    if parts.len() != 2 {
        return Err("Invalid payload format".to_string());
    }
    
    Ok(parts[0].to_string())
}

/// Salva credenziali itch.io criptate
#[tauri::command]
pub async fn save_itchio_credentials(api_key: String, username: String) -> Result<String, String> {
    println!("[ITCH.IO] Salvando credenziali per user: {}", username);
    
    if api_key.is_empty() || username.is_empty() {
        return Err("API key e username sono obbligatori".to_string());
    }
    
    // Cripta l'API key
    let (encrypted_api_key, nonce) = encrypt_api_key(&api_key)?;
    
    let credentials = ItchioCredentials {
        api_key_encrypted: encrypted_api_key,
        username: username.clone(),
        saved_at: chrono::Utc::now().to_rfc3339(),
        nonce,
    };
    
    let credentials_path = get_itchio_credentials_path()?;
    let json_data = serde_json::to_string_pretty(&credentials)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&credentials_path, json_data)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    println!("[ITCH.IO] ✅ Credenziali salvate per: {}", username);
    Ok("Credenziali itch.io salvate con encryption AES-256".to_string())
}

/// Carica credenziali itch.io
#[tauri::command]
pub async fn load_itchio_credentials() -> Result<serde_json::Value, String> {
    let credentials_path = get_itchio_credentials_path()?;
    
    if !credentials_path.exists() {
        return Err("Nessuna credenziale itch.io salvata".to_string());
    }
    
    let json_data = fs::read_to_string(&credentials_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let credentials: ItchioCredentials = serde_json::from_str(&json_data)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    // Decripta l'API key
    let api_key = decrypt_api_key(&credentials.api_key_encrypted, &credentials.nonce)?;
    
    Ok(serde_json::json!({
        "username": credentials.username,
        "api_key": api_key,
        "saved_at": credentials.saved_at
    }))
}

/// Cancella credenziali itch.io
#[tauri::command]
pub async fn clear_itchio_credentials() -> Result<String, String> {
    let credentials_path = get_itchio_credentials_path()?;
    
    if credentials_path.exists() {
        fs::remove_file(&credentials_path)
            .map_err(|e| format!("Errore cancellazione file: {}", e))?;
    }
    
    Ok("Credenziali itch.io cancellate".to_string())
}
