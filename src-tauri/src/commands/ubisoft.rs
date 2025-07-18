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
pub struct UbisoftGame {
    pub id: String,
    pub title: String,
    pub install_path: Option<String>,
    pub executable: Option<String>,
    pub platform: String, // "Ubisoft Connect" or "Uplay"
    pub size_bytes: Option<u64>,
    pub last_modified: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UbisoftCredentials {
    pub email_encrypted: String,
    pub password_encrypted: String,
    pub username: Option<String>,
    pub saved_at: String,
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct UbisoftUser {
    pub username: String,
    pub email: String,
    pub profile_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UbisoftApiGame {
    pub id: String,
    pub name: String,
    pub platform: String,
}

/// Scansiona i giochi Ubisoft Connect installati localmente
pub async fn get_ubisoft_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // 1. Scansiona giochi Ubisoft Connect dal registro
    if let Ok(ubisoft_games) = scan_ubisoft_registry().await {
        games.extend(ubisoft_games);
    }
    
    // 2. Scansiona giochi Uplay (legacy) dal registro
    if let Ok(uplay_games) = scan_uplay_registry().await {
        games.extend(uplay_games);
    }
    
    // 3. Scansiona cartelle di installazione comuni
    if let Ok(folder_games) = scan_ubisoft_folders().await {
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

/// Scansiona giochi Ubisoft Connect dal registro
async fn scan_ubisoft_registry() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    // Chiavi di registro per Ubisoft Connect
    let registry_paths = vec![
        "SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs",
        "SOFTWARE\\Ubisoft\\Launcher\\Installs",
        "SOFTWARE\\WOW6432Node\\Ubisoft\\Ubisoft Game Launcher\\Installs",
        "SOFTWARE\\Ubisoft\\Ubisoft Game Launcher\\Installs",
    ];
    
    for registry_path in registry_paths {
        if let Ok(ubisoft_key) = hklm.open_subkey(registry_path) {
            for game_key_name in ubisoft_key.enum_keys().flatten() {
                if let Ok(game_key) = ubisoft_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_ubisoft_registry_entry(&game_key, &game_key_name, "Ubisoft Connect").await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona giochi Uplay (legacy) dal registro
async fn scan_uplay_registry() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    // Chiavi di registro per Uplay (legacy)
    let registry_paths = vec![
        "SOFTWARE\\WOW6432Node\\Ubisoft\\Uplay\\Installs",
        "SOFTWARE\\Ubisoft\\Uplay\\Installs",
    ];
    
    for registry_path in registry_paths {
        if let Ok(uplay_key) = hklm.open_subkey(registry_path) {
            for game_key_name in uplay_key.enum_keys().flatten() {
                if let Ok(game_key) = uplay_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_ubisoft_registry_entry(&game_key, &game_key_name, "Uplay").await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona cartelle di installazione comuni per Ubisoft Connect
async fn scan_ubisoft_folders() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Cartelle comuni per Ubisoft Connect
    let possible_paths = vec![
        r"C:\Program Files (x86)\Ubisoft\Ubisoft Game Launcher\games",
        r"C:\Program Files\Ubisoft\Ubisoft Game Launcher\games",
        r"C:\Program Files (x86)\Uplay\games",
        r"C:\Program Files\Uplay\games",
        r"D:\Ubisoft Games",
        r"D:\Uplay Games",
        r"E:\Ubisoft Games",
        r"E:\Uplay Games",
    ];
    
    for base_path in possible_paths {
        let path = Path::new(base_path);
        if path.exists() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Ok(game) = parse_ubisoft_game_folder(&entry.path()).await {
                            games.push(game);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Test della connessione Ubisoft Connect
#[tauri::command]
pub async fn test_ubisoft_connection() -> Result<String, String> {
    println!("[UBISOFT] Test connessione");
    
    // Prima prova a caricare credenziali salvate
    match load_ubisoft_credentials().await {
        Ok(credentials) => {
            if let (Some(email), Some(password)) = (
                credentials.get("email").and_then(|v| v.as_str()),
                credentials.get("password").and_then(|v| v.as_str())
            ) {
                println!("[UBISOFT] Utilizzando credenziali salvate");
                
                // Testa l'autenticazione
                match test_ubisoft_auth(email, password).await {
                    Ok(user) => {
                        let games = get_ubisoft_installed_games().await?;
                        Ok(format!("✅ Connesso come '{}' - {} giochi locali trovati", 
                                  user.username, games.len()))
                    }
                    Err(e) => {
                        println!("[UBISOFT] Errore autenticazione salvata: {}", e);
                        // Fallback a scansione locale
                        let games = get_ubisoft_installed_games().await?;
                        Ok(format!("❌ Account disconnesso (credenziali non valide) - {} giochi locali trovati", games.len()))
                    }
                }
            } else {
                // Fallback a scansione locale
                let games = get_ubisoft_installed_games().await?;
                Ok(format!("Scansione Ubisoft Connect completata: {} giochi trovati", games.len()))
            }
        }
        Err(_) => {
            // Nessuna credenziale salvata - scansione locale
            println!("[UBISOFT] Nessuna credenziale salvata");
            let games = get_ubisoft_installed_games().await?;
            Ok(format!("Scansione Ubisoft Connect completata: {} giochi trovati", games.len()))
        }
    }
}

/// Recupera informazioni su un gioco Ubisoft Connect specifico
#[tauri::command]
pub async fn get_ubisoft_game_info(game_id: String) -> Result<UbisoftGame, String> {
    println!("[UBISOFT] Recupero informazioni per: {}", game_id);
    
    let games = get_ubisoft_installed_games().await?;
    
    for game in games {
        if game.id == game_id {
            return Ok(UbisoftGame {
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

/// Recupera le copertine per i giochi Ubisoft Connect (placeholder)
#[tauri::command]
pub async fn get_ubisoft_covers_batch(game_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    println!("[UBISOFT] Recupero copertine per {} giochi (placeholder)", game_ids.len());
    
    // Ubisoft Connect non ha API pubblica per le copertine
    // Restituiamo un HashMap vuoto per ora
    // In futuro si potrebbe implementare il recupero da fonti alternative
    let covers = HashMap::new();
    
    Ok(covers)
}

// Funzioni helper private

async fn parse_ubisoft_registry_entry(game_key: &RegKey, game_id: &str, platform: &str) -> Result<InstalledGame, String> {
    // Prova a leggere diversi campi possibili per Ubisoft Connect
    let name = game_key.get_value::<String, _>("DisplayName")
        .or_else(|_| game_key.get_value::<String, _>("ProductName"))
        .or_else(|_| game_key.get_value::<String, _>("Title"))
        .or_else(|_| game_key.get_value::<String, _>("GameName"))
        .unwrap_or_else(|_| game_id.to_string());
    
    let install_path = game_key.get_value::<String, _>("InstallDir")
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
        id: format!("{}_{}", platform.to_lowercase().replace(" ", "_"), game_id.to_lowercase()),
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

async fn parse_ubisoft_game_folder(folder_path: &Path) -> Result<InstalledGame, String> {
    let folder_name = folder_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // Cerca l'eseguibile principale
    let executable = find_main_executable(folder_path).await;
    
    // Ottieni metadati della cartella
    let metadata = folder_path.metadata().ok();
    
    // Determina se è Ubisoft Connect o Uplay basandosi sul percorso
    let platform = if folder_path.to_string_lossy().contains("Uplay") {
        "Uplay"
    } else {
        "Ubisoft Connect"
    };
    
    Ok(InstalledGame {
        id: format!("{}_{}", platform.to_lowercase().replace(" ", "_"), folder_name.to_lowercase().replace(" ", "_")),
        name: folder_name.clone(),
        path: folder_path.to_string_lossy().to_string(),
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

async fn find_main_executable(game_path: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(game_path) {
        // Prima cerca eseguibili comuni di Ubisoft
        let common_executables = vec![
            "Game.exe", "game.exe",
            "Launcher.exe", "launcher.exe",
            "Main.exe", "main.exe",
            "Start.exe", "start.exe",
        ];
        
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if common_executables.contains(&file_name) {
                    return Some(entry.path().to_string_lossy().to_string());
                }
            }
        }
        
        // Cerca eseguibili specifici di giochi Ubisoft famosi
        let ubisoft_game_executables = vec![
            // Assassin's Creed series
            "ACOrigins.exe", "ACOdyssey.exe", "ACValhalla.exe", "ACMirage.exe",
            "AC2.exe", "ACBrotherhood.exe", "ACRevelations.exe", "AC3.exe", "AC4BFMP.exe",
            "ACUnity.exe", "ACSyndicate.exe", "AssassinsCreed.exe",
            // Far Cry series
            "FarCry.exe", "FarCry2.exe", "FarCry3.exe", "FarCry4.exe", 
            "FarCry5.exe", "FarCry6.exe", "FarCryNewDawn.exe", "FarCryPrimal.exe",
            // Rainbow Six series
            "RainbowSix.exe", "R6Game.exe", "RainbowSixSiege.exe", "RainbowSixVegas.exe", "RainbowSixVegas2.exe",
            // Watch Dogs series
            "WatchDogs.exe", "WatchDogs2.exe", "WatchDogsLegion.exe",
            // The Division series
            "TheDivision.exe", "TheDivision2.exe",
            // Ghost Recon series
            "GRW.exe", "GhostRecon.exe", "GhostReconWildlands.exe", "GhostReconBreakpoint.exe",
            "GhostReconAdvancedWarfighter.exe", "GhostReconAdvancedWarfighter2.exe",
            // Splinter Cell series
            "SplinterCell.exe", "SplinterCellChaosTheory.exe", "SplinterCellConviction.exe", "SplinterCellBlacklist.exe",
            // For Honor
            "ForHonor.exe", "ForHonor_BE.exe",
            // Anno series
            "Anno1800.exe", "Anno2070.exe", "Anno2205.exe", "Anno1404.exe", "Anno1701.exe",
            // Prince of Persia series
            "PrinceOfPersia.exe", "POP_SandsOfTime.exe", "POP_WarriorWithin.exe", "POP_TwoThrones.exe",
            // Rayman series
            "Rayman.exe", "RaymanLegends.exe", "RaymanOrigins.exe",
            // The Crew series
            "TheCrew.exe", "TheCrew2.exe",
            // Trials series
            "Trials.exe", "TrialsEvolution.exe", "TrialsFusion.exe", "TrialsRising.exe",
            // Skull and Bones
            "SkullAndBones.exe",
            // Immortals Fenyx Rising
            "ImmortalsFenyxRising.exe", "Immortals.exe",
            // Riders Republic
            "RidersRepublic.exe",
            // South Park games
            "SouthPark.exe", "SouthParkSOT.exe", "SouthParkFBW.exe",
            // Child of Light
            "ChildOfLight.exe",
            // Valiant Hearts
            "ValiantHearts.exe",
            // Beyond Good and Evil
            "BeyondGoodAndEvil.exe", "BGE2.exe",
            // Driver series
            "Driver.exe", "DriverSanFrancisco.exe",
            // Might & Magic series
            "MightAndMagic.exe", "Heroes.exe",
            // Rocksmith series
            "Rocksmith.exe", "Rocksmith2014.exe",
        ];
        
        if let Ok(entries) = fs::read_dir(game_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if ubisoft_game_executables.iter().any(|&exe| file_name.contains(&exe[..exe.len()-4])) {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
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
                        && !file_name.contains("UbisoftGameLauncher")
                        && !file_name.contains("upc.exe") {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    None
}

// Funzioni per gestione credenziali Ubisoft Connect

fn get_ubisoft_credentials_path() -> Result<PathBuf, String> {
    let mut path = std::env::current_dir()
        .map_err(|e| format!("Errore getting current dir: {}", e))?;
    path.push(".cache");
    
    // Crea la directory .cache se non esiste
    if !path.exists() {
        fs::create_dir_all(&path)
            .map_err(|e| format!("Errore creating .cache directory: {}", e))?;
    }
    
    path.push("ubisoft_credentials.json");
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
    
    use base64::{Engine as _, engine::general_purpose};
    
    Ok((
        general_purpose::STANDARD.encode(&email_ciphertext),
        general_purpose::STANDARD.encode(&password_ciphertext),
        general_purpose::STANDARD.encode(&nonce_bytes)
    ))
}

fn decrypt_credentials(email_encrypted: &str, password_encrypted: &str, nonce_str: &str) -> Result<(String, String), String> {
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    use base64::{Engine as _, engine::general_purpose};
    
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

/// Test autenticazione Ubisoft Connect (simulato)
pub async fn test_ubisoft_auth(email: &str, password: &str) -> Result<UbisoftUser, String> {
    println!("[UBISOFT] Testing authentication for: {}", email);
    
    // NOTA: Ubisoft Connect non ha API pubblica facilmente accessibile
    // Per ora simulo l'autenticazione controllando che le credenziali non siano vuote
    // In futuro si potrebbe implementare l'integrazione con l'API Ubisoft Connect
    
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
    
    Ok(UbisoftUser {
        username,
        email: email.to_string(),
        profile_id: Some("simulated_profile_id".to_string()),
    })
}

/// Connetti account Ubisoft Connect
#[tauri::command]
pub async fn connect_ubisoft(email: String, password: String) -> Result<String, String> {
    println!("[UBISOFT] Connessione account");
    
    // Test autenticazione
    match test_ubisoft_auth(&email, &password).await {
        Ok(user) => {
            // Salva le credenziali
            let save_result = save_ubisoft_credentials(email, password, user.username.clone()).await;
            match save_result {
                Ok(_) => println!("[UBISOFT] Credenziali salvate con successo"),
                Err(e) => println!("[UBISOFT] Avviso: Non è stato possibile salvare le credenziali: {}", e),
            }
            
            // Conta giochi locali
            let games = get_ubisoft_installed_games().await?;
            
            Ok(format!("✅ Connesso come '{}' - {} giochi locali trovati", 
                      user.username, games.len()))
        }
        Err(e) => {
            println!("[UBISOFT] Errore autenticazione: {}", e);
            Err(format!("❌ Errore autenticazione: {}", e))
        }
    }
}

/// Salva credenziali Ubisoft Connect criptate
#[tauri::command]
pub async fn save_ubisoft_credentials(email: String, password: String, username: String) -> Result<String, String> {
    println!("[UBISOFT] Salvando credenziali per user: {}", username);
    
    if email.is_empty() || password.is_empty() {
        return Err("Email e password sono obbligatorie".to_string());
    }
    
    // Cripta le credenziali
    let (email_encrypted, password_encrypted, nonce) = encrypt_credentials(&email, &password)?;
    
    let credentials = UbisoftCredentials {
        email_encrypted,
        password_encrypted,
        username: Some(username.clone()),
        saved_at: chrono::Utc::now().to_rfc3339(),
        nonce,
    };
    
    let credentials_path = get_ubisoft_credentials_path()?;
    let json_data = serde_json::to_string_pretty(&credentials)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&credentials_path, json_data)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    println!("[UBISOFT] ✅ Credenziali salvate per: {}", username);
    Ok("Credenziali Ubisoft Connect salvate con encryption AES-256".to_string())
}

/// Carica credenziali Ubisoft Connect
#[tauri::command]
pub async fn load_ubisoft_credentials() -> Result<serde_json::Value, String> {
    let credentials_path = get_ubisoft_credentials_path()?;
    
    if !credentials_path.exists() {
        return Err("Nessuna credenziale Ubisoft Connect salvata".to_string());
    }
    
    let json_data = fs::read_to_string(&credentials_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let credentials: UbisoftCredentials = serde_json::from_str(&json_data)
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

/// Cancella credenziali Ubisoft Connect
#[tauri::command]
pub async fn clear_ubisoft_credentials() -> Result<String, String> {
    let credentials_path = get_ubisoft_credentials_path()?;
    
    if credentials_path.exists() {
        fs::remove_file(&credentials_path)
            .map_err(|e| format!("Errore cancellazione file: {}", e))?;
    }
    
    Ok("Credenziali Ubisoft Connect cancellate".to_string())
}
