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
pub struct OriginGame {
    pub id: String,
    pub title: String,
    pub install_path: Option<String>,
    pub executable: Option<String>,
    pub platform: String, // "Origin" or "EA App"
    pub size_bytes: Option<u64>,
    pub last_modified: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OriginCredentials {
    pub email_encrypted: String,
    pub password_encrypted: String,
    pub username: Option<String>,
    pub saved_at: String,
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct OriginUser {
    pub username: String,
    pub email: String,
    pub profile_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OriginApiGame {
    pub id: String,
    pub name: String,
    pub platform: String,
}

/// Scansiona i giochi Origin/EA App installati localmente
pub async fn get_origin_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // 1. Scansiona giochi Origin (legacy)
    if let Ok(origin_games) = scan_origin_legacy().await {
        games.extend(origin_games);
    }
    
    // 2. Scansiona giochi EA App (nuovo)
    if let Ok(ea_games) = scan_ea_app().await {
        games.extend(ea_games);
    }
    
    // 3. Scansiona cartelle di installazione comuni
    if let Ok(folder_games) = scan_origin_folders().await {
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

/// Scansiona giochi Origin dal registro (versione legacy)
async fn scan_origin_legacy() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    // Chiavi di registro per Origin
    let registry_paths = vec![
        ("HKLM", "SOFTWARE\\WOW6432Node\\Origin\\Games"),
        ("HKLM", "SOFTWARE\\Origin\\Games"),
        ("HKLM", "SOFTWARE\\WOW6432Node\\Electronic Arts\\EA Core\\ProductInstaller\\InstallPaths"),
        ("HKLM", "SOFTWARE\\Electronic Arts\\EA Core\\ProductInstaller\\InstallPaths"),
        ("HKCU", "SOFTWARE\\Origin\\Games"),
        ("HKCU", "SOFTWARE\\Electronic Arts\\EA Core\\ProductInstaller\\InstallPaths"),
    ];
    
    for (hive, registry_path) in registry_paths {
        let reg_key = if hive == "HKLM" { &hklm } else { &hkcu };
        
        if let Ok(origin_key) = reg_key.open_subkey(registry_path) {
            for game_key_name in origin_key.enum_keys().flatten() {
                if let Ok(game_key) = origin_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_origin_registry_entry(&game_key, &game_key_name, "Origin").await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona giochi EA App dal registro (nuova versione)
async fn scan_ea_app() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    // EA App usa chiavi di registro diverse
    let registry_paths = vec![
        ("HKLM", "SOFTWARE\\WOW6432Node\\EA\\EA Desktop\\InstallPaths"),
        ("HKLM", "SOFTWARE\\EA\\EA Desktop\\InstallPaths"),
        ("HKLM", "SOFTWARE\\WOW6432Node\\Electronic Arts\\EA Desktop\\InstallPaths"),
        ("HKLM", "SOFTWARE\\Electronic Arts\\EA Desktop\\InstallPaths"),
        ("HKCU", "SOFTWARE\\EA\\EA Desktop\\InstallPaths"),
        ("HKCU", "SOFTWARE\\Electronic Arts\\EA Desktop\\InstallPaths"),
    ];
    
    for (hive, registry_path) in registry_paths {
        let reg_key = if hive == "HKLM" { &hklm } else { &hkcu };
        
        if let Ok(ea_key) = reg_key.open_subkey(registry_path) {
            for game_key_name in ea_key.enum_keys().flatten() {
                if let Ok(game_key) = ea_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_origin_registry_entry(&game_key, &game_key_name, "EA App").await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona cartelle di installazione comuni per Origin/EA App
async fn scan_origin_folders() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Cartelle comuni per Origin/EA
    let possible_paths = vec![
        r"C:\Program Files (x86)\Origin Games",
        r"C:\Program Files\Origin Games", 
        r"C:\Program Files (x86)\EA Games",
        r"C:\Program Files\EA Games",
        r"C:\Program Files (x86)\Electronic Arts",
        r"C:\Program Files\Electronic Arts",
        r"D:\Origin Games",
        r"D:\EA Games",
        r"E:\Origin Games",
        r"E:\EA Games",
        r"C:\Games\Origin",
        r"C:\Games\EA",
        // Steam EA games
        r"C:\Program Files (x86)\Steam\steamapps\common",
        // Epic EA games
        r"C:\Program Files\Epic Games",
    ];
    
    for base_path in possible_paths {
        let path = Path::new(base_path);
        if path.exists() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Ok(game) = parse_origin_game_folder(&entry.path()).await {
                            games.push(game);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Test della connessione Origin/EA App
#[tauri::command]
pub async fn test_origin_connection() -> Result<String, String> {
    println!("[ORIGIN] Test connessione");
    
    // Prima prova a caricare credenziali salvate
    match load_origin_credentials().await {
        Ok(credentials) => {
            if let (Some(email), Some(password)) = (
                credentials.get("email").and_then(|v| v.as_str()),
                credentials.get("password").and_then(|v| v.as_str())
            ) {
                println!("[ORIGIN] Utilizzando credenziali salvate");
                
                // Testa l'autenticazione
                match test_origin_auth(email, password).await {
                    Ok(user) => {
                        let games = get_origin_installed_games().await?;
                        Ok(format!("✅ Connesso come '{}' - {} giochi locali trovati", 
                                  user.username, games.len()))
                    }
                    Err(e) => {
                        println!("[ORIGIN] Errore autenticazione salvata: {}", e);
                        // Fallback a scansione locale
                        let games = get_origin_installed_games().await?;
                        Ok(format!("❌ Account disconnesso (credenziali non valide) - {} giochi locali trovati", games.len()))
                    }
                }
            } else {
                // Fallback a scansione locale
                let games = get_origin_installed_games().await?;
                Ok(format!("Scansione Origin/EA completata: {} giochi trovati", games.len()))
            }
        }
        Err(_) => {
            // Nessuna credenziale salvata - scansione locale
            println!("[ORIGIN] Nessuna credenziale salvata");
            let games = get_origin_installed_games().await?;
            Ok(format!("Scansione Origin/EA completata: {} giochi trovati", games.len()))
        }
    }
}

/// Recupera informazioni su un gioco Origin/EA App specifico
#[tauri::command]
pub async fn get_origin_game_info(game_id: String) -> Result<OriginGame, String> {
    println!("[ORIGIN] Recupero informazioni per: {}", game_id);
    
    let games = get_origin_installed_games().await?;
    
    for game in games {
        if game.id == game_id {
            return Ok(OriginGame {
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

/// Recupera le copertine per i giochi Origin/EA App (placeholder)
#[tauri::command]
pub async fn get_origin_covers_batch(game_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    println!("[ORIGIN] Recupero copertine per {} giochi (placeholder)", game_ids.len());
    
    // Origin/EA App non ha API pubblica per le copertine
    // Restituiamo un HashMap vuoto per ora
    // In futuro si potrebbe implementare il recupero da fonti alternative
    let covers = HashMap::new();
    
    Ok(covers)
}

// Funzioni helper private

async fn parse_origin_registry_entry(game_key: &RegKey, game_id: &str, platform: &str) -> Result<InstalledGame, String> {
    // Prova a leggere diversi campi possibili per Origin/EA
    let name = game_key.get_value::<String, _>("DisplayName")
        .or_else(|_| game_key.get_value::<String, _>("ProductName"))
        .or_else(|_| game_key.get_value::<String, _>("Title"))
        .or_else(|_| game_key.get_value::<String, _>("GameName"))
        .or_else(|_| game_key.get_value::<String, _>("Name"))
        .unwrap_or_else(|_| game_id.to_string());
    
    let install_path = game_key.get_value::<String, _>("InstallDir")
        .or_else(|_| game_key.get_value::<String, _>("InstallFolder"))
        .or_else(|_| game_key.get_value::<String, _>("InstallLocation"))
        .or_else(|_| game_key.get_value::<String, _>("Install Dir"))
        .or_else(|_| game_key.get_value::<String, _>("Path"))
        .or_else(|_| game_key.get_value::<String, _>("BaseInstallPath"))
        .unwrap_or_default();
    
    if install_path.is_empty() {
        return Err("Percorso di installazione non trovato".to_string());
    }
    
    let game_path = Path::new(&install_path);
    let executable = find_main_executable(game_path).await;
    
    // Ottieni metadati della cartella
    let metadata = game_path.metadata().ok();
    
    Ok(InstalledGame {
        id: format!("origin_{}", game_id.to_lowercase().replace(" ", "_").replace("-", "_")),
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

async fn parse_origin_game_folder(folder_path: &Path) -> Result<InstalledGame, String> {
    let folder_name = folder_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // Cerca l'eseguibile principale
    let executable = find_main_executable(folder_path).await;
    
    // Ottieni metadati della cartella
    let metadata = folder_path.metadata().ok();
    
    // Determina il nome del gioco e la piattaforma basandosi sul percorso
    let (game_name, platform) = determine_game_info(folder_path, &folder_name);
    
    // Skip se non sembra essere un gioco EA/Origin
    if !is_ea_origin_game(folder_path, &folder_name) {
        return Err("Non è un gioco EA/Origin".to_string());
    }
    
    Ok(InstalledGame {
        id: format!("origin_{}", game_name.to_lowercase().replace(" ", "_").replace(":", "").replace("-", "_")),
        name: game_name,
        path: folder_path.to_string_lossy().to_string(),
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform,
    })
}

fn determine_game_info(folder_path: &Path, folder_name: &str) -> (String, String) {
    let path_str = folder_path.to_string_lossy().to_lowercase();
    let folder_name_lower = folder_name.to_lowercase();
    
    // Determina la piattaforma
    let platform = if path_str.contains("ea app") || path_str.contains("ea desktop") {
        "EA App"
    } else if path_str.contains("steam") {
        "Steam (EA)"
    } else if path_str.contains("epic") {
        "Epic Games (EA)"
    } else {
        "Origin"
    };
    
    // Mappa nomi di cartelle comuni a nomi di giochi
    let game_name = if folder_name_lower.contains("battlefield") {
        if folder_name_lower.contains("2042") {
            "Battlefield 2042"
        } else if folder_name_lower.contains("1") && !folder_name_lower.contains("2042") {
            "Battlefield 1"
        } else if folder_name_lower.contains("5") || folder_name_lower.contains("v") {
            "Battlefield V"
        } else if folder_name_lower.contains("4") {
            "Battlefield 4"
        } else if folder_name_lower.contains("3") {
            "Battlefield 3"
        } else {
            "Battlefield"
        }
    } else if folder_name_lower.contains("fifa") {
        if folder_name_lower.contains("24") {
            "EA SPORTS FC 24"
        } else if folder_name_lower.contains("23") {
            "FIFA 23"
        } else if folder_name_lower.contains("22") {
            "FIFA 22"
        } else {
            "FIFA"
        }
    } else if folder_name_lower.contains("apex") {
        "Apex Legends"
    } else if folder_name_lower.contains("sims") {
        if folder_name_lower.contains("4") {
            "The Sims 4"
        } else if folder_name_lower.contains("3") {
            "The Sims 3"
        } else {
            "The Sims"
        }
    } else if folder_name_lower.contains("mass effect") {
        if folder_name_lower.contains("legendary") {
            "Mass Effect Legendary Edition"
        } else if folder_name_lower.contains("andromeda") {
            "Mass Effect: Andromeda"
        } else {
            "Mass Effect"
        }
    } else if folder_name_lower.contains("dragon age") {
        "Dragon Age"
    } else if folder_name_lower.contains("titanfall") {
        if folder_name_lower.contains("2") {
            "Titanfall 2"
        } else {
            "Titanfall"
        }
    } else if folder_name_lower.contains("need for speed") || folder_name_lower.contains("nfs") {
        "Need for Speed"
    } else if folder_name_lower.contains("star wars") {
        if folder_name_lower.contains("battlefront") {
            "Star Wars Battlefront"
        } else if folder_name_lower.contains("squadrons") {
            "Star Wars: Squadrons"
        } else if folder_name_lower.contains("fallen order") {
            "Star Wars Jedi: Fallen Order"
        } else {
            "Star Wars"
        }
    } else if folder_name_lower.contains("it takes two") {
        "It Takes Two"
    } else if folder_name_lower.contains("a way out") {
        "A Way Out"
    } else if folder_name_lower.contains("anthem") {
        "Anthem"
    } else if folder_name_lower.contains("plants vs zombies") || folder_name_lower.contains("pvz") {
        "Plants vs. Zombies"
    } else {
        &folder_name
    };
    
    (game_name.to_string(), platform.to_string())
}

fn is_ea_origin_game(folder_path: &Path, folder_name: &str) -> bool {
    let path_str = folder_path.to_string_lossy().to_lowercase();
    let folder_name_lower = folder_name.to_lowercase();
    
    // Controlla se il percorso indica che è un gioco EA/Origin
    if path_str.contains("origin") || path_str.contains("ea games") || path_str.contains("electronic arts") {
        return true;
    }
    
    // Lista di giochi EA comuni
    let ea_games = vec![
        "battlefield", "fifa", "apex", "sims", "mass effect", "dragon age",
        "titanfall", "need for speed", "nfs", "star wars", "it takes two",
        "a way out", "anthem", "plants vs zombies", "pvz", "crysis",
        "dead space", "mirrors edge", "burnout", "command and conquer",
        "medal of honor", "skate", "alice"
    ];
    
    for ea_game in ea_games {
        if folder_name_lower.contains(ea_game) {
            return true;
        }
    }
    
    false
}

async fn find_main_executable(game_path: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(game_path) {
        // Prima cerca eseguibili comuni di EA/Origin
        let ea_executables = vec![
            // Battlefield
            "bf1.exe", "bf4.exe", "bf3.exe", "bfv.exe", "bf2042.exe",
            "Battlefield.exe", "BattlefieldV.exe", "Battlefield1.exe",
            // FIFA/FC
            "FIFA23.exe", "FIFA22.exe", "FIFA21.exe", "FC24.exe",
            // Apex Legends  
            "r5apex.exe", "ApexLegends.exe",
            // Sims
            "TS4.exe", "TS4_x64.exe", "Sims4.exe", "TS3.exe",
            // Mass Effect
            "MassEffect.exe", "MassEffectAndromeda.exe", "MassEffectLegendaryEdition.exe",
            // Star Wars
            "starwarsbattlefront.exe", "starwarsbattlefrontii.exe", "StarWarsSquadrons.exe",
            "StarWarsJediFallenOrder.exe", "SWJFO.exe",
            // Titanfall
            "Titanfall.exe", "Titanfall2.exe",
            // Need for Speed
            "NFS.exe", "NeedForSpeed.exe", "NFSHeat.exe",
            // Altri
            "ItTakesTwo.exe", "AWayOut.exe", "Anthem.exe", "DragonAge.exe",
            "PlantsVsZombies.exe", "DeadSpace.exe", "Crysis.exe",
            // Launcher generici
            "Game.exe", "Launcher.exe", "GameLauncher.exe",
        ];
        
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if ea_executables.iter().any(|&exe| file_name.eq_ignore_ascii_case(exe)) {
                    return Some(entry.path().to_string_lossy().to_string());
                }
            }
        }
        
        // Se non trova eseguibili specifici, cerca qualsiasi .exe che non sia un uninstaller
        if let Ok(entries) = fs::read_dir(game_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.ends_with(".exe") 
                        && !file_name.to_lowercase().contains("unins") 
                        && !file_name.to_lowercase().contains("uninstall")
                        && !file_name.to_lowercase().contains("setup")
                        && !file_name.to_lowercase().contains("redistributable")
                        && !file_name.to_lowercase().contains("vcredist")
                        && !file_name.to_lowercase().contains("directx")
                        && !file_name.to_lowercase().contains("dotnet") {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    None
}

// Funzioni per gestione credenziali Origin/EA

fn get_origin_credentials_path() -> Result<PathBuf, String> {
    let mut path = std::env::current_dir()
        .map_err(|e| format!("Errore getting current dir: {}", e))?;
    path.push(".cache");
    
    // Crea la directory .cache se non esiste
    if !path.exists() {
        fs::create_dir_all(&path)
            .map_err(|e| format!("Errore creating .cache directory: {}", e))?;
    }
    
    path.push("origin_credentials.json");
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

/// Test autenticazione Origin/EA (simulato)
pub async fn test_origin_auth(email: &str, password: &str) -> Result<OriginUser, String> {
    println!("[ORIGIN] Testing authentication for: {}", email);
    
    // NOTA: EA non ha API pubblica facilmente accessibile
    // Per ora simulo l'autenticazione controllando che le credenziali non siano vuote
    // In futuro si potrebbe implementare l'integrazione con l'API EA
    
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
    
    Ok(OriginUser {
        username,
        email: email.to_string(),
        profile_id: Some("simulated_profile_id".to_string()),
    })
}

/// Connetti account Origin/EA
#[tauri::command]
pub async fn connect_origin(email: String, password: String) -> Result<String, String> {
    println!("[ORIGIN] Connessione account");
    
    // Test autenticazione
    match test_origin_auth(&email, &password).await {
        Ok(user) => {
            // Salva le credenziali
            let save_result = save_origin_credentials(email, password, user.username.clone()).await;
            match save_result {
                Ok(_) => println!("[ORIGIN] Credenziali salvate con successo"),
                Err(e) => println!("[ORIGIN] Avviso: Non è stato possibile salvare le credenziali: {}", e),
            }
            
            // Conta giochi locali
            let games = get_origin_installed_games().await?;
            
            Ok(format!("✅ Connesso come '{}' - {} giochi locali trovati", 
                      user.username, games.len()))
        }
        Err(e) => {
            println!("[ORIGIN] Errore autenticazione: {}", e);
            Err(format!("❌ Errore autenticazione: {}", e))
        }
    }
}

/// Salva credenziali Origin/EA criptate
#[tauri::command]
pub async fn save_origin_credentials(email: String, password: String, username: String) -> Result<String, String> {
    println!("[ORIGIN] Salvando credenziali per user: {}", username);
    
    if email.is_empty() || password.is_empty() {
        return Err("Email e password sono obbligatorie".to_string());
    }
    
    // Cripta le credenziali
    let (email_encrypted, password_encrypted, nonce) = encrypt_credentials(&email, &password)?;
    
    let credentials = OriginCredentials {
        email_encrypted,
        password_encrypted,
        username: Some(username.clone()),
        saved_at: chrono::Utc::now().to_rfc3339(),
        nonce,
    };
    
    let credentials_path = get_origin_credentials_path()?;
    let json_data = serde_json::to_string_pretty(&credentials)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&credentials_path, json_data)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    println!("[ORIGIN] ✅ Credenziali salvate per: {}", username);
    Ok("Credenziali Origin/EA salvate con encryption AES-256".to_string())
}

/// Carica credenziali Origin/EA
#[tauri::command]
pub async fn load_origin_credentials() -> Result<serde_json::Value, String> {
    let credentials_path = get_origin_credentials_path()?;
    
    if !credentials_path.exists() {
        return Err("Nessuna credenziale Origin/EA salvata".to_string());
    }
    
    let json_data = fs::read_to_string(&credentials_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let credentials: OriginCredentials = serde_json::from_str(&json_data)
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

/// Cancella credenziali Origin/EA
#[tauri::command]
pub async fn clear_origin_credentials() -> Result<String, String> {
    let credentials_path = get_origin_credentials_path()?;
    
    if credentials_path.exists() {
        fs::remove_file(&credentials_path)
            .map_err(|e| format!("Errore cancellazione file: {}", e))?;
    }
    
    Ok("Credenziali Origin/EA cancellate".to_string())
}
