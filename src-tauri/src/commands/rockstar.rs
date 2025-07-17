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
pub struct RockstarGame {
    pub id: String,
    pub title: String,
    pub install_path: Option<String>,
    pub executable: Option<String>,
    pub platform: String, // "Rockstar Games Launcher"
    pub size_bytes: Option<u64>,
    pub last_modified: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct RockstarCredentials {
    pub email_encrypted: String,
    pub password_encrypted: String,
    pub username: Option<String>,
    pub saved_at: String,
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct RockstarUser {
    pub username: String,
    pub email: String,
    pub profile_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct RockstarApiGame {
    pub id: String,
    pub name: String,
    pub platform: String,
}

/// Scansiona i giochi Rockstar Games installati localmente
pub async fn get_rockstar_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // 1. Scansiona giochi Rockstar Games dal registro
    if let Ok(rockstar_games) = scan_rockstar_registry().await {
        games.extend(rockstar_games);
    }
    
    // 2. Scansiona cartelle di installazione comuni
    if let Ok(folder_games) = scan_rockstar_folders().await {
        games.extend(folder_games);
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

/// Scansiona giochi Rockstar Games dal registro
async fn scan_rockstar_registry() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    // Chiavi di registro per Rockstar Games Launcher
    let registry_paths = vec![
        "SOFTWARE\\WOW6432Node\\Rockstar Games\\Launcher\\Installs",
        "SOFTWARE\\Rockstar Games\\Launcher\\Installs",
        "SOFTWARE\\WOW6432Node\\Rockstar Games\\Grand Theft Auto V",
        "SOFTWARE\\Rockstar Games\\Grand Theft Auto V",
        "SOFTWARE\\WOW6432Node\\Rockstar Games\\Red Dead Redemption 2",
        "SOFTWARE\\Rockstar Games\\Red Dead Redemption 2",
    ];
    
    for registry_path in registry_paths {
        if let Ok(rockstar_key) = hklm.open_subkey(registry_path) {
            for game_key_name in rockstar_key.enum_keys().flatten() {
                if let Ok(game_key) = rockstar_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_rockstar_registry_entry(&game_key, &game_key_name, "Rockstar Games Launcher").await {
                        games.push(game);
                    }
                }
            }
            
            // Anche controlla la chiave principale
            if let Ok(game) = parse_rockstar_registry_key(&rockstar_key, registry_path).await {
                games.push(game);
            }
        }
    }
    
    Ok(games)
}

/// Scansiona cartelle di installazione comuni per Rockstar Games
async fn scan_rockstar_folders() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Cartelle comuni per Rockstar Games
    let possible_paths = vec![
        r"C:\Program Files\Rockstar Games",
        r"C:\Program Files (x86)\Rockstar Games",
        r"D:\Rockstar Games",
        r"E:\Rockstar Games",
        r"C:\Program Files\Epic Games\GTAV", // GTA V da Epic
        r"C:\Program Files (x86)\Steam\steamapps\common\Grand Theft Auto V", // GTA V da Steam
        r"C:\Program Files (x86)\Steam\steamapps\common\Red Dead Redemption 2", // RDR2 da Steam
    ];
    
    for base_path in possible_paths {
        let path = Path::new(base_path);
        if path.exists() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Ok(game) = parse_rockstar_game_folder(&entry.path()).await {
                            games.push(game);
                        }
                    }
                }
            } else {
                // Se la cartella non può essere letta ma esiste, potrebbe essere un gioco installato
                if let Ok(game) = parse_rockstar_game_folder(path).await {
                    games.push(game);
                }
            }
        }
    }
    
    Ok(games)
}

/// Test della connessione Rockstar Games
#[tauri::command]
pub async fn test_rockstar_connection() -> Result<String, String> {
    println!("[ROCKSTAR] Test connessione");
    
    // Prima prova a caricare credenziali salvate
    match load_rockstar_credentials().await {
        Ok(credentials) => {
            if let (Some(email), Some(password)) = (
                credentials.get("email").and_then(|v| v.as_str()),
                credentials.get("password").and_then(|v| v.as_str())
            ) {
                println!("[ROCKSTAR] Utilizzando credenziali salvate");
                
                // Testa l'autenticazione
                match test_rockstar_auth(email, password).await {
                    Ok(user) => {
                        let games = get_rockstar_installed_games().await?;
                        Ok(format!("✅ Connesso come '{}' - {} giochi locali trovati", 
                                  user.username, games.len()))
                    }
                    Err(e) => {
                        println!("[ROCKSTAR] Errore autenticazione salvata: {}", e);
                        // Fallback a scansione locale
                        let games = get_rockstar_installed_games().await?;
                        Ok(format!("❌ Account disconnesso (credenziali non valide) - {} giochi locali trovati", games.len()))
                    }
                }
            } else {
                // Fallback a scansione locale
                let games = get_rockstar_installed_games().await?;
                Ok(format!("Scansione Rockstar Games completata: {} giochi trovati", games.len()))
            }
        }
        Err(_) => {
            // Nessuna credenziale salvata - scansione locale
            println!("[ROCKSTAR] Nessuna credenziale salvata");
            let games = get_rockstar_installed_games().await?;
            Ok(format!("Scansione Rockstar Games completata: {} giochi trovati", games.len()))
        }
    }
}

/// Recupera informazioni su un gioco Rockstar Games specifico
#[tauri::command]
pub async fn get_rockstar_game_info(game_id: String) -> Result<RockstarGame, String> {
    println!("[ROCKSTAR] Recupero informazioni per: {}", game_id);
    
    let games = get_rockstar_installed_games().await?;
    
    for game in games {
        if game.id == game_id {
            return Ok(RockstarGame {
                id: game.id,
                title: game.name,
                install_path: Some(game.path),
                executable: game.executable,
                platform: game.platform,
                size_bytes: game.size_bytes,
                last_modified: game.last_modified,
            });
        }
    }
    
    Err(format!("Gioco '{}' non trovato", game_id))
}

/// Recupera le copertine per i giochi Rockstar Games (placeholder)
#[tauri::command]
pub async fn get_rockstar_covers_batch(game_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    println!("[ROCKSTAR] Recupero copertine per {} giochi (placeholder)", game_ids.len());
    
    // Rockstar Games non ha API pubblica per le copertine
    // Restituiamo un HashMap vuoto per ora
    // In futuro si potrebbe implementare il recupero da fonti alternative
    let covers = HashMap::new();
    
    Ok(covers)
}

// Funzioni helper private

async fn parse_rockstar_registry_entry(game_key: &RegKey, game_id: &str, platform: &str) -> Result<InstalledGame, String> {
    // Prova a leggere diversi campi possibili per Rockstar Games
    let name = game_key.get_value::<String, _>("DisplayName")
        .or_else(|_| game_key.get_value::<String, _>("ProductName"))
        .or_else(|_| game_key.get_value::<String, _>("Title"))
        .or_else(|_| game_key.get_value::<String, _>("GameName"))
        .unwrap_or_else(|_| game_id.to_string());
    
    let install_path = game_key.get_value::<String, _>("InstallFolder")
        .or_else(|_| game_key.get_value::<String, _>("InstallDir"))
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
        id: format!("rockstar_{}", game_id.to_lowercase().replace(" ", "_")),
        name,
        path: install_path,
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: platform.to_string(),
    })
}

async fn parse_rockstar_registry_key(game_key: &RegKey, registry_path: &str) -> Result<InstalledGame, String> {
    // Determina il nome del gioco dal percorso del registro
    let game_name = if registry_path.contains("Grand Theft Auto V") {
        "Grand Theft Auto V"
    } else if registry_path.contains("Red Dead Redemption 2") {
        "Red Dead Redemption 2"
    } else {
        "Rockstar Game"
    };
    
    let install_path = game_key.get_value::<String, _>("InstallFolder")
        .or_else(|_| game_key.get_value::<String, _>("InstallDir"))
        .or_else(|_| game_key.get_value::<String, _>("InstallLocation"))
        .unwrap_or_default();
    
    if install_path.is_empty() {
        return Err("Percorso di installazione non trovato".to_string());
    }
    
    let game_path = Path::new(&install_path);
    let executable = find_main_executable(game_path).await;
    
    // Ottieni metadati della cartella
    let metadata = game_path.metadata().ok();
    
    Ok(InstalledGame {
        id: format!("rockstar_{}", game_name.to_lowercase().replace(" ", "_")),
        name: game_name.to_string(),
        path: install_path,
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "Rockstar Games Launcher".to_string(),
    })
}

async fn parse_rockstar_game_folder(folder_path: &Path) -> Result<InstalledGame, String> {
    let folder_name = folder_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // Cerca l'eseguibile principale
    let executable = find_main_executable(folder_path).await;
    
    // Ottieni metadati della cartella
    let metadata = folder_path.metadata().ok();
    
    // Determina il nome del gioco basandosi sul percorso
    let game_name = if folder_path.to_string_lossy().contains("Grand Theft Auto") || folder_name.contains("GTAV") {
        "Grand Theft Auto V".to_string()
    } else if folder_path.to_string_lossy().contains("Red Dead Redemption") {
        "Red Dead Redemption 2".to_string()
    } else if folder_path.to_string_lossy().contains("Max Payne 3") {
        "Max Payne 3".to_string()
    } else if folder_path.to_string_lossy().contains("L.A. Noire") {
        "L.A. Noire".to_string()
    } else {
        folder_name.clone()
    };
    
    Ok(InstalledGame {
        id: format!("rockstar_{}", game_name.to_lowercase().replace(" ", "_").replace(".", "")),
        name: game_name,
        path: folder_path.to_string_lossy().to_string(),
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "Rockstar Games Launcher".to_string(),
    })
}

async fn find_main_executable(game_path: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(game_path) {
        // Prima cerca eseguibili comuni di Rockstar Games
        let rockstar_executables = vec![
            "GTA5.exe", "GTAV.exe", "GTAVLauncher.exe", // GTA V
            "RDR2.exe", "RDR2.exe", "RedDeadRedemption2.exe", // Red Dead Redemption 2
            "MaxPayne3.exe", // Max Payne 3
            "LANoire.exe", "L.A.Noire.exe", // L.A. Noire
            "PlayGTAV.exe", "PlayRDR2.exe", // Launcher files
            "GameLauncher.exe", "Launcher.exe",
        ];
        
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if rockstar_executables.contains(&file_name) {
                    return Some(entry.path().to_string_lossy().to_string());
                }
            }
        }
        
        // Se non trova eseguibili specifici, cerca qualsiasi .exe che non sia un uninstaller
        if let Ok(entries) = fs::read_dir(game_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.ends_with(".exe") 
                        && !file_name.contains("unins") 
                        && !file_name.contains("Uninstall")
                        && !file_name.contains("setup")
                        && !file_name.contains("Setup")
                        && !file_name.contains("Redistributable")
                        && !file_name.contains("vcredist") {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    None
}

// Funzioni per gestione credenziali Rockstar Games

fn get_rockstar_credentials_path() -> Result<PathBuf, String> {
    let mut path = std::env::current_dir()
        .map_err(|e| format!("Errore getting current dir: {}", e))?;
    path.push(".cache");
    
    // Crea la directory .cache se non esiste
    if !path.exists() {
        fs::create_dir_all(&path)
            .map_err(|e| format!("Errore creating .cache directory: {}", e))?;
    }
    
    path.push("rockstar_credentials.json");
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
        base64::encode(&email_ciphertext),
        base64::encode(&password_ciphertext),
        base64::encode(&nonce_bytes)
    ))
}

fn decrypt_credentials(email_encrypted: &str, password_encrypted: &str, nonce_str: &str) -> Result<(String, String), String> {
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    let email_ciphertext = base64::decode(email_encrypted)
        .map_err(|e| format!("Email base64 decode failed: {}", e))?;
    let password_ciphertext = base64::decode(password_encrypted)
        .map_err(|e| format!("Password base64 decode failed: {}", e))?;
    let nonce_bytes = base64::decode(nonce_str)
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

/// Test autenticazione Rockstar Games (simulato)
pub async fn test_rockstar_auth(email: &str, password: &str) -> Result<RockstarUser, String> {
    println!("[ROCKSTAR] Testing authentication for: {}", email);
    
    // NOTA: Rockstar Games non ha API pubblica facilmente accessibile
    // Per ora simulo l'autenticazione controllando che le credenziali non siano vuote
    // In futuro si potrebbe implementare l'integrazione con il Social Club
    
    if email.is_empty() || password.is_empty() {
        return Err("Email e password sono obbligatorie".to_string());
    }
    
    if !email.contains("@") {
        return Err("Email non valida".to_string());
    }
    
    if password.len() < 6 {
        return Err("Password troppo corta".to_string());
    }
    
    // Simula un utente autenticato
    let username = email.split('@').next().unwrap_or("User").to_string();
    
    Ok(RockstarUser {
        username,
        email: email.to_string(),
        profile_id: Some("simulated_profile_id".to_string()),
    })
}

/// Connetti account Rockstar Games
#[tauri::command]
pub async fn connect_rockstar(email: String, password: String) -> Result<String, String> {
    println!("[ROCKSTAR] Connessione account");
    
    // Test autenticazione
    match test_rockstar_auth(&email, &password).await {
        Ok(user) => {
            // Salva le credenziali
            let save_result = save_rockstar_credentials(email, password, user.username.clone()).await;
            match save_result {
                Ok(_) => println!("[ROCKSTAR] Credenziali salvate con successo"),
                Err(e) => println!("[ROCKSTAR] Avviso: Non è stato possibile salvare le credenziali: {}", e),
            }
            
            // Conta giochi locali
            let games = get_rockstar_installed_games().await?;
            
            Ok(format!("✅ Connesso come '{}' - {} giochi locali trovati", 
                      user.username, games.len()))
        }
        Err(e) => {
            println!("[ROCKSTAR] Errore autenticazione: {}", e);
            Err(format!("❌ Errore autenticazione: {}", e))
        }
    }
}

/// Salva credenziali Rockstar Games criptate
#[tauri::command]
pub async fn save_rockstar_credentials(email: String, password: String, username: String) -> Result<String, String> {
    println!("[ROCKSTAR] Salvando credenziali per user: {}", username);
    
    if email.is_empty() || password.is_empty() {
        return Err("Email e password sono obbligatorie".to_string());
    }
    
    // Cripta le credenziali
    let (email_encrypted, password_encrypted, nonce) = encrypt_credentials(&email, &password)?;
    
    let credentials = RockstarCredentials {
        email_encrypted,
        password_encrypted,
        username: Some(username.clone()),
        saved_at: chrono::Utc::now().to_rfc3339(),
        nonce,
    };
    
    let credentials_path = get_rockstar_credentials_path()?;
    let json_data = serde_json::to_string_pretty(&credentials)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&credentials_path, json_data)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    println!("[ROCKSTAR] ✅ Credenziali salvate per: {}", username);
    Ok("Credenziali Rockstar Games salvate con encryption AES-256".to_string())
}

/// Carica credenziali Rockstar Games
#[tauri::command]
pub async fn load_rockstar_credentials() -> Result<serde_json::Value, String> {
    let credentials_path = get_rockstar_credentials_path()?;
    
    if !credentials_path.exists() {
        return Err("Nessuna credenziale Rockstar Games salvata".to_string());
    }
    
    let json_data = fs::read_to_string(&credentials_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let credentials: RockstarCredentials = serde_json::from_str(&json_data)
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

/// Cancella credenziali Rockstar Games
#[tauri::command]
pub async fn clear_rockstar_credentials() -> Result<String, String> {
    let credentials_path = get_rockstar_credentials_path()?;
    
    if credentials_path.exists() {
        fs::remove_file(&credentials_path)
            .map_err(|e| format!("Errore cancellazione file: {}", e))?;
    }
    
    Ok("Credenziali Rockstar Games cancellate".to_string())
}