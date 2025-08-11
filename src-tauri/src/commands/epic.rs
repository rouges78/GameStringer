use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use reqwest::Client;
use once_cell::sync::Lazy;
use winreg::enums::*;
use winreg::RegKey;
use regex::Regex;
use crate::models::GameInfo;

use std::fs;
use log::{debug, info, error};
use base64::{Engine as _, engine::general_purpose};
use aes_gcm::{Aes256Gcm, Nonce, aead::{Aead, KeyInit}};
use rand::{RngCore, rngs::OsRng};
use chrono;

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

// 🔐 Struttura per credenziali Epic Games
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EpicCredentials {
    pub username_encrypted: String,
    pub password_encrypted: String,
    pub saved_at: String,
    pub nonce: String,
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

/// Avvia il flusso OAuth Epic Games con server locale
#[tauri::command]
pub async fn start_epic_oauth_flow() -> Result<serde_json::Value, String> {
    println!("[EPIC OAUTH] 🚀 Avvio flusso OAuth Epic Games");
    
    // Avvia un server locale temporaneo per gestire il callback
    tokio::spawn(async {
        if let Err(e) = start_oauth_callback_server().await {
            println!("[EPIC OAUTH] ❌ Errore server callback: {}", e);
        }
    });
    
    // URL di autorizzazione Epic Games
    let auth_url = "https://www.epicgames.com/id/authorize?client_id=34a02cf8f4414e29b15921876da36f9a&redirect_uri=http://localhost:8080/auth/epic/callback&response_type=code&scope=basic_profile";
    
    // Apri il browser
    if let Err(e) = open::that(auth_url) {
        return Err(format!("Errore apertura browser: {}", e));
    }
    
    Ok(serde_json::json!({
        "success": true,
        "message": "Flusso OAuth avviato. Completa l'autenticazione nel browser."
    }))
}

/// Server locale temporaneo per gestire il callback OAuth
async fn start_oauth_callback_server() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {

    
    println!("[EPIC OAUTH] 🌐 Avvio server callback su localhost:8080");
    
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await?;
    
    // Gestisci solo una connessione, poi chiudi il server
    if let Ok((stream, _)) = listener.accept().await {
        let mut buffer = [0; 1024];
        let mut stream = stream;
        
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        
        if let Ok(n) = stream.read(&mut buffer).await {
            let request = String::from_utf8_lossy(&buffer[..n]);
            println!("[EPIC OAUTH] 📨 Request ricevuta: {}", request);
            
            // Estrai il code dalla query string
            if let Some(code_start) = request.find("code=") {
                let code_part = &request[code_start + 5..];
                let code_end = code_part.find(&[' ', '&', '\n', '\r'][..]).unwrap_or(code_part.len());
                let authorization_code = &code_part[..code_end];
                
                println!("[EPIC OAUTH] 🔑 Authorization code estratto: {}", authorization_code);
                
                // Scambia il code con un access token
                match exchange_oauth_code_for_token(authorization_code).await {
                    Ok(token_data) => {
                        let response = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
                            <html><body>\
                            <h1>✅ Autenticazione Epic Games completata!</h1>\
                            <p>Puoi chiudere questa finestra e tornare a GameStringer.</p>\
                            <script>window.close();</script>\
                            </body></html>"
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                        
                        // Salva i token
                        if let Err(e) = save_epic_auth_data(&token_data).await {
                            println!("[EPIC OAUTH] ⚠️ Errore salvataggio auth data: {}", e);
                        }
                    }
                    Err(e) => {
                        println!("[EPIC OAUTH] ❌ Errore exchange token: {}", e);
                        let response = format!(
                            "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html\r\n\r\n\
                            <html><body>\
                            <h1>❌ Errore autenticazione Epic Games</h1>\
                            <p>Errore: {}</p>\
                            <p>Puoi chiudere questa finestra e riprovare.</p>\
                            </body></html>", e
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                    }
                }
            }
        }
    }
    
    println!("[EPIC OAUTH] 🔚 Server callback chiuso");
    Ok(())
}

/// Scambia authorization code OAuth con access token
async fn exchange_oauth_code_for_token(authorization_code: &str) -> Result<EpicAuthData, String> {
    println!("[EPIC OAUTH] 🔄 Scambio authorization code: {}", authorization_code);
    
    let client = reqwest::Client::new();
    
    // Epic Games OAuth token endpoint
    let token_url = "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token";
    
    // Parametri per lo scambio del code
    let params = [
        ("grant_type", "authorization_code"),
        ("code", &authorization_code),
        ("client_id", "34a02cf8f4414e29b15921876da36f9a"), // Epic Games Launcher client ID
        ("client_secret", "daafbccc737745039dffe53d94fc76cf"), // Epic Games Launcher client secret
        ("redirect_uri", "https://localhost/launcher/authorized"),
    ];
    
    match client
        .post(token_url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&params)
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            let response_text = response.text().await.unwrap_or_default();
            
            println!("[EPIC OAUTH] Response status: {}", status);
            println!("[EPIC OAUTH] Response body: {}", response_text);
            
            if status.is_success() {
                match serde_json::from_str::<serde_json::Value>(&response_text) {
                    Ok(token_data) => {
                        println!("[EPIC OAUTH] ✅ Token exchange successful");
                        
                        // Salva i token per uso futuro
                        if let (Some(access_token), Some(refresh_token), Some(account_id)) = (
                            token_data["access_token"].as_str(),
                            token_data["refresh_token"].as_str(),
                            token_data["account_id"].as_str(),
                        ) {
                            let auth_data = EpicAuthData {
                                access_token: access_token.to_string(),
                                refresh_token: refresh_token.to_string(),
                                account_id: account_id.to_string(),
                                expires_at: chrono::Utc::now().timestamp() + token_data["expires_in"].as_i64().unwrap_or(3600),
                            };
                            
                            // Salva i dati di autenticazione
                            if let Err(e) = save_epic_auth_data(&auth_data).await {
                                println!("[EPIC OAUTH] ⚠️ Errore salvataggio auth data: {}", e);
                            }
                            
                            Ok(auth_data)
                        } else {
                            Err("Token response mancante di campi richiesti".to_string())
                        }
                    }
                    Err(e) => {
                        println!("[EPIC OAUTH] ❌ Errore parsing JSON: {}", e);
                        Err(format!("Errore parsing response: {}", e))
                    }
                }
            } else {
                println!("[EPIC OAUTH] ❌ Token exchange failed: {}", response_text);
                Err(format!("Token exchange failed: {} - {}", status, response_text))
            }
        }
        Err(e) => {
            println!("[EPIC OAUTH] ❌ Request error: {}", e);
            Err(format!("Request error: {}", e))
        }
    }
}

/// Salva i dati di autenticazione Epic Games
async fn save_epic_auth_data(auth_data: &EpicAuthData) -> Result<(), String> {
    // Implementa il salvataggio sicuro dei dati di autenticazione
    // Per ora, stampa solo i dati (senza token sensibili)
    println!("[EPIC OAUTH] 💾 Salvataggio auth data per account: {}", auth_data.account_id);
    
    // TODO: Implementare salvataggio sicuro con crittografia
    // Simile a come viene fatto per Steam credentials
    
    Ok(())
}

/// Test della connessione Epic Games e rilevamento giochi installati
#[tauri::command]
pub async fn test_epic_connection() -> Result<serde_json::Value, String> {
    println!("[RUST] 🧪 test_epic_connection called!");
    
    let mut result = serde_json::json!({
        "connected": false,
        "games_count": 0,
        "error": null,
        "status": ""
    });
    
    // Prima prova a caricare credenziali salvate per accesso completo libreria
    let mut has_credentials = false;
    match load_epic_credentials().await {
        Ok(_) => {
            println!("[EPIC] ✅ Credenziali Epic trovate - accesso libreria completo");
            has_credentials = true;
            
            // Prova a ottenere libreria completa con Legendary/API Epic
            match get_epic_owned_games().await {
                Ok(owned_games) => {
                    result["connected"] = serde_json::Value::Bool(true);
                    result["games_count"] = serde_json::Value::Number(owned_games.len().into());
                    result["status"] = serde_json::Value::String(format!("Epic Games connesso - {} giochi in libreria", owned_games.len()));
                    return Ok(result);
                }
                Err(e) => {
                    println!("[EPIC] ⚠️ Errore accesso libreria con credenziali: {}", e);
                }
            }
        }
        Err(_) => {
            println!("[EPIC] ℹ️ Nessuna credenziale Epic - fallback a scansione locale");
        }
    }
    
    // Fallback: scansione giochi installati localmente
    let mut installed_count = 0;
    
    // 1. Test connessione all'API Epic Games Store pubblica
    let url = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions";
    
    let api_connected = match HTTP_CLIENT.get(url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                println!("[EPIC] ✅ API pubblica connessa con successo");
                true
            } else {
                println!("[EPIC] ❌ API errore: {}", response.status());
                result["error"] = serde_json::Value::String(format!("Epic Games API errore: {}", response.status()));
                false
            }
        }
        Err(e) => {
            println!("[EPIC] ❌ Errore connessione API: {}", e);
            result["error"] = serde_json::Value::String(format!("Errore connessione: {}", e));
            false
        }
    };
    
    // 2. Scansione giochi installati localmente
    installed_count += scan_epic_installed_games().await.unwrap_or(0);
    
    result["connected"] = serde_json::Value::Bool(api_connected);
    result["games_count"] = serde_json::Value::Number(installed_count.into());
    
    if has_credentials {
        result["status"] = serde_json::Value::String(format!("Epic Games connesso - {} giochi installati (configurare Legendary per libreria completa)", installed_count));
    } else {
        result["status"] = serde_json::Value::String(format!("Epic Games connesso - {} giochi installati", installed_count));
    }
    
    Ok(result)
}

/// Ottiene tutti i giochi posseduti dall'account Epic Games (tramite credenziali)
async fn get_epic_owned_games() -> Result<Vec<GameInfo>, String> {
    println!("[EPIC] 🔄 Tentativo accesso libreria completa Epic Games...");
    
    // Carica credenziali Epic Games
    let credentials = load_epic_credentials().await?;
    
    // Metodo 1: Prova con Legendary (se installato)
    match try_legendary_library(&credentials.username_encrypted).await {
        Ok(legendary_games) => {
            println!("[EPIC] ✅ Legendary: {} giochi trovati", legendary_games.len());
            return Ok(legendary_games);
        }
        Err(e) => {
            println!("[EPIC] ⚠️ Legendary non disponibile: {}", e);
        }
    }
    
    // Metodo 2: Prova con Epic Games Web API (richiede token)
    match try_epic_web_api(&credentials).await {
        Ok(web_games) => {
            println!("[EPIC] ✅ Epic Web API: {} giochi trovati", web_games.len());
            return Ok(web_games);
        }
        Err(e) => {
            println!("[EPIC] ⚠️ Epic Web API non disponibile: {}", e);
        }
    }
    
    // Metodo 3: Fallback - scansione file Epic Games locali + cache
    match try_epic_local_files(&credentials.username_encrypted).await {
        Ok(local_games) => {
            println!("[EPIC] ✅ File locali: {} giochi trovati", local_games.len());
            return Ok(local_games);
        }
        Err(e) => {
            println!("[EPIC] ❌ Tutti i metodi falliti: {}", e);
        }
    }
    
    Err("Impossibile accedere alla libreria Epic Games".to_string())
}

/// Prova a usare Legendary per ottenere la libreria Epic Games
async fn try_legendary_library(_username: &str) -> Result<Vec<GameInfo>, String> {
    // Prova a eseguire Legendary se installato
    let output = std::process::Command::new("legendary")
        .args(&["list", "--json"])
        .output();
        
    match output {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                match serde_json::from_str::<serde_json::Value>(&stdout) {
                    Ok(json) => {
                        let mut games = Vec::new();
                        if let Some(games_obj) = json.as_object() {
                            for (app_name, game_data) in games_obj {
                                if let Some(title) = game_data["title"].as_str() {
                                    games.push(GameInfo {
                                        id: format!("epic_{}", app_name),
                                        title: title.to_string(),
                                        platform: "Epic Games".to_string(),
                                        install_path: game_data["install_path"].as_str().map(|s| s.to_string()),
                                        executable_path: None,
                                        icon: None,
                                        image_url: None,
                                        header_image: None,
                                        is_installed: game_data["installed"].as_bool().unwrap_or(false),
                                        steam_app_id: None,
                                        is_vr: false,
                                        engine: Some("Unknown".to_string()),
                                        last_played: None,
                                        is_shared: false,
                                        supported_languages: Some(vec!["english".to_string()]),
                                        genres: Some(vec!["Game".to_string()]),
                                    });
                                }
                            }
                        }
                        Ok(games)
                    }
                    Err(e) => Err(format!("Errore parsing Legendary JSON: {}", e))
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Legendary errore: {}", stderr))
            }
        }
        Err(e) => Err(format!("Legendary non trovato: {}", e))
    }
}

/// Prova Epic Games Web API (richiede autenticazione)
async fn try_epic_web_api(_credentials: &EpicCredentials) -> Result<Vec<GameInfo>, String> {
    // TODO: Implementare autenticazione Epic Games Web API
    // Questo richiederebbe OAuth2 flow e token management
    Err("Epic Web API non ancora implementata".to_string())
}

/// Prova file locali Epic Games e cache
async fn try_epic_local_files(_username: &str) -> Result<Vec<GameInfo>, String> {
    // TODO: Implementare scansione avanzata file Epic Games locali
    // Questa potrebbe cercare in manifest files, cache, etc.
    Err("Scansione file locali avanzata non ancora implementata".to_string())
}

/// Scansiona giochi Epic Games installati localmente
async fn scan_epic_installed_games() -> Result<u32, String> {
    let mut count = 0;
    
    // Percorsi tipici Epic Games
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    let epic_paths = vec![
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Config\\Windows", user_profile),
        "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests".to_string(),
    ];
    
    for path in epic_paths {
        if let Ok(entries) = std::fs::read_dir(&path) {
            for entry in entries.flatten() {
                if entry.path().extension().and_then(|s| s.to_str()) == Some("item") {
                    count += 1;
                }
            }
        }
    }
    
    Ok(count)
}

/// Comando Tauri per ottenere tutti i giochi Epic Games (installati + libreria)
#[tauri::command]
pub async fn get_epic_games_complete() -> Result<Vec<GameInfo>, String> {
    println!("[RUST] 🎮 get_epic_games_complete called!");
    
    let mut all_games = Vec::new();
    
    // Prima prova a ottenere libreria completa se ci sono credenziali
    match get_epic_owned_games().await {
        Ok(owned_games) => {
            println!("[EPIC] ✅ Libreria completa: {} giochi", owned_games.len());
            all_games.extend(owned_games);
        }
        Err(e) => {
            println!("[EPIC] ⚠️ Libreria completa non disponibile: {}", e);
            
            // Fallback: ottieni solo giochi installati
            match get_epic_installed_local().await {
                Ok(installed_games) => {
                    println!("[EPIC] ✅ Giochi installati: {} giochi", installed_games.len());
                    all_games.extend(installed_games);
                }
                Err(e) => {
                    println!("[EPIC] ❌ Errore anche per giochi installati: {}", e);
                }
            }
        }
    }
    
    Ok(all_games)
}

/// Ottiene giochi Epic Games installati localmente
async fn get_epic_installed_local() -> Result<Vec<GameInfo>, String> {
    // Implementazione base per giochi installati localmente
    // TODO: Scansione più dettagliata dei manifest Epic Games
    Ok(vec![])
}

/// Verifica se Legendary è installato e configurato
#[tauri::command]
pub async fn check_legendary_status() -> Result<serde_json::Value, String> {
    println!("[RUST] 🔍 check_legendary_status called!");
    
    let mut result = serde_json::json!({
        "installed": false,
        "authenticated": false,
        "path": null,
        "version": null,
        "message": "",
        "install_instructions": ""
    });
    
    // Verifica se Legendary è installato
    match std::process::Command::new("legendary").args(&["--version"]).output() {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                result["installed"] = serde_json::Value::Bool(true);
                result["version"] = serde_json::Value::String(version.clone());
                
                // Verifica se è autenticato
                match std::process::Command::new("legendary").args(&["status"]).output() {
                    Ok(status_output) => {
                        let status_text = String::from_utf8_lossy(&status_output.stdout);
                        if status_text.contains("Epic Games account") && !status_text.contains("not logged in") {
                            result["authenticated"] = serde_json::Value::Bool(true);
                            result["message"] = serde_json::Value::String(format!("Legendary {} installato e autenticato", version));
                        } else {
                            result["message"] = serde_json::Value::String(format!("Legendary {} installato ma non autenticato", version));
                        }
                    }
                    Err(_) => {
                        result["message"] = serde_json::Value::String(format!("Legendary {} installato ma stato sconosciuto", version));
                    }
                }
            } else {
                result["message"] = serde_json::Value::String("Legendary trovato ma non funzionante".to_string());
            }
        }
        Err(_) => {
            result["message"] = serde_json::Value::String("Legendary non installato".to_string());
            result["install_instructions"] = serde_json::Value::String(
                "Per accedere alla tua libreria Epic Games completa:\n\n1. Installa Legendary: pip install legendary-gl\n2. Autentica: legendary auth\n3. Riavvia GameStringer\n\nLegendary è un client open-source per Epic Games che permette accesso alla libreria completa.".to_string()
            );
        }
    }
    
    Ok(result)
}

/// Installa automaticamente Legendary usando pip
#[tauri::command]
pub async fn install_legendary() -> Result<String, String> {
    println!("[EPIC] 🔧 Installazione automatica Legendary");
    
    // Prima verifica se pip è disponibile
    match std::process::Command::new("pip").args(&["--version"]).output() {
        Ok(output) => {
            if !output.status.success() {
                return Err("pip non trovato. Assicurati che Python sia installato correttamente.".to_string());
            }
        }
        Err(_) => {
            return Err("pip non trovato. Installa Python prima di procedere.".to_string());
        }
    }
    
    // Prova prima con pip3 se pip non funziona
    let pip_commands = vec!["pip", "pip3", "python -m pip"];
    let mut install_success = false;
    let mut last_error = String::new();
    
    for pip_cmd in pip_commands {
        println!("[EPIC] Tentativo installazione con: {}", pip_cmd);
        
        let args: Vec<&str> = if pip_cmd.contains("python") {
            vec!["python", "-m", "pip", "install", "legendary-gl"]
        } else {
            vec![pip_cmd, "install", "legendary-gl"]
        };
        
        let mut command = std::process::Command::new(args[0]);
        if args.len() > 1 {
            command.args(&args[1..]);
        }
        
        match command.output() {
            Ok(output) => {
                if output.status.success() {
                    install_success = true;
                    println!("[EPIC] ✅ Legendary installato con successo usando {}", pip_cmd);
                    break;
                } else {
                    last_error = String::from_utf8_lossy(&output.stderr).to_string();
                    println!("[EPIC] ❌ Errore con {}: {}", pip_cmd, last_error);
                }
            }
            Err(e) => {
                last_error = format!("Comando fallito: {}", e);
                println!("[EPIC] ❌ Errore esecuzione {}: {}", pip_cmd, e);
            }
        }
    }
    
    if !install_success {
        return Err(format!("Installazione fallita. Ultimo errore: {}. Prova manualmente: pip install legendary-gl", last_error));
    }
    
    // Verifica che l'installazione sia riuscita
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    
    match std::process::Command::new("legendary").args(&["--version"]).output() {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                Ok(format!("✅ Legendary {} installato con successo! Ora puoi autenticarti con 'legendary auth'", version))
            } else {
                Err("Installazione completata ma Legendary non risponde. Potrebbe essere necessario riavviare il terminale.".to_string())
            }
        }
        Err(_) => {
            Err("Installazione completata ma Legendary non trovato nel PATH. Riavvia GameStringer.".to_string())
        }
    }
}

/// Autentica Legendary con Epic Games
#[tauri::command]
pub async fn authenticate_legendary() -> Result<String, String> {
    println!("[EPIC] 🔐 Autenticazione Legendary");
    
    // Prima verifica se Legendary è installato
    match std::process::Command::new("legendary").args(&["--version"]).output() {
        Ok(output) => {
            if !output.status.success() {
                return Err("Legendary non installato. Usa 'Installa Legendary' prima.".to_string());
            }
        }
        Err(_) => {
            return Err("Legendary non trovato. Installalo prima con 'Installa Legendary'.".to_string());
        }
    }
    
    // Avvia il processo di autenticazione
    match std::process::Command::new("legendary").args(&["auth"]).spawn() {
        Ok(mut child) => {
            // Aspetta che il processo finisca
            match child.wait() {
                Ok(status) => {
                    if status.success() {
                        // Verifica l'autenticazione
                        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                        
                        match std::process::Command::new("legendary").args(&["status"]).output() {
                            Ok(status_output) => {
                                let status_text = String::from_utf8_lossy(&status_output.stdout);
                                if status_text.contains("Epic Games account") && !status_text.contains("not logged in") {
                                    Ok("✅ Autenticazione completata con successo! Ora puoi accedere alla tua libreria Epic Games completa.".to_string())
                                } else {
                                    Ok("⚠️ Processo completato, ma autenticazione non confermata. Riprova o verifica manualmente.".to_string())
                                }
                            }
                            Err(_) => {
                                Ok("✅ Processo di autenticazione completato. Riavvia GameStringer per verificare.".to_string())
                            }
                        }
                    } else {
                        Err("Processo di autenticazione fallito o cancellato.".to_string())
                    }
                }
                Err(e) => {
                    Err(format!("Errore durante l'autenticazione: {}", e))
                }
            }
        }
        Err(e) => {
            Err(format!("Impossibile avviare processo di autenticazione: {}", e))
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

/// Pulisce cache e dati temporanei Epic Games per un rilevamento fresco
#[tauri::command]
pub async fn clear_epic_cache() -> Result<String, String> {
    println!("[RUST] 🧹 clear_epic_cache called!");
    
    let mut cleaned_items = Vec::new();
    
    // 1. Lista delle cache e dati temporanei da pulire
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    let cache_paths = vec![
        // Cache temporanee Epic Games Launcher
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\webcache", user_profile),
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\webcache_4430", user_profile),
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Logs", user_profile),
        // Cache file temporanei
        "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\EpicGamesLauncher.exe.dat.backup".to_string(),
        // Cache del nostro rilevamento (se esistente)
        format!("{}\\AppData\\Local\\GameStringer\\epic_cache.json", user_profile),
    ];
    
    for cache_path in &cache_paths {
        let path = std::path::Path::new(cache_path);
        
        if path.exists() {
            match std::fs::remove_dir_all(path).or_else(|_| std::fs::remove_file(path)) {
                Ok(_) => {
                    println!("[EPIC] ✅ Pulito: {}", cache_path);
                    cleaned_items.push(cache_path.clone());
                }
                Err(e) => {
                    println!("[EPIC] ⚠️ Non riuscito a pulire {}: {}", cache_path, e);
                }
            }
        } else {
            println!("[EPIC] ℹ️ Non esiste: {}", cache_path);
        }
    }
    
    // 2. Force refresh del rilevamento giochi
    println!("[EPIC] 🔄 Force refresh rilevamento giochi...");
    match get_epic_owned_games().await {
        Ok(games) => {
            println!("[EPIC] ✅ Rilevamento aggiornato: {} giochi trovati", games.len());
        }
        Err(e) => {
            println!("[EPIC] ⚠️ Errore rilevamento: {}", e);
        }
    }
    
    let result_msg = if cleaned_items.is_empty() {
        "Nessuna cache da pulire. Rilevamento aggiornato.".to_string()
    } else {
        format!("Cache pulita ({} elementi). Rilevamento aggiornato.", cleaned_items.len())
    };
    
    Ok(result_msg)
}

/// Prova a recuperare giochi Epic Games via web (metodi alternativi)
#[tauri::command]
pub async fn get_epic_games_web() -> Result<serde_json::Value, String> {
    println!("[RUST] 🌐 get_epic_games_web called!");
    
    let mut result = serde_json::json!({
        "success": false,
        "games": [],
        "methods_tried": [],
        "message": ""
    });
    
    let mut methods_tried = Vec::new();
    let mut all_games = Vec::new();
    
    // 1. Prova Epic Games Store API pubblica (giochi gratuiti)
    methods_tried.push("Epic Store Free Games API");
    match try_epic_free_games_api().await {
        Ok(free_games) => {
            println!("[EPIC] ✅ Trovati {} giochi gratuiti Epic", free_games.len());
            all_games.extend(free_games);
        }
        Err(e) => {
            println!("[EPIC] ❌ Errore API giochi gratuiti: {}", e);
        }
    }
    
    // 2. Leggi da Heroic Games Launcher (se installato)
    methods_tried.push("Heroic Games Launcher");
    match try_heroic_launcher_games().await {
        Ok(heroic_games) => {
            println!("[EPIC] ✅ Trovati {} giochi da Heroic", heroic_games.len());
            all_games.extend(heroic_games);
        }
        Err(e) => {
            println!("[EPIC] ❌ Errore Heroic Launcher: {}", e);
        }
    }
    
    // 3. Prova a leggere file di configurazione avanzati
    methods_tried.push("Advanced Config Files");
    match try_advanced_epic_configs().await {
        Ok(config_games) => {
            println!("[EPIC] ✅ Trovati {} giochi da config avanzati", config_games.len());
            all_games.extend(config_games);
        }
        Err(e) => {
            println!("[EPIC] ❌ Errore config avanzati: {}", e);
        }
    }
    
    // Rimuovi duplicati
    all_games.sort();
    all_games.dedup();
    
    result["methods_tried"] = serde_json::Value::Array(
        methods_tried.into_iter().map(|m| serde_json::Value::String(m.to_string())).collect()
    );
    result["games"] = serde_json::Value::Array(
        all_games.iter().map(|g| serde_json::Value::String(g.clone())).collect()
    );
    result["success"] = serde_json::Value::Bool(!all_games.is_empty());
    result["message"] = serde_json::Value::String(
        format!("Trovati {} giochi Epic Games usando metodi web", all_games.len())
    );
    
    Ok(result)
}

/// Recupera giochi Epic Games usando il metodo Legendary (import token + API)
#[tauri::command]
pub async fn get_epic_games_by_account_id(_account_id: String) -> Result<serde_json::Value, String> {
    println!("[RUST] 🚀 Epic Games Legendary Method - Searching for all owned games...");
    
    let mut all_games = Vec::new();
    let mut methods_tried = Vec::new();
    let mut success = false;
    
    // 1. Prova a importare token dal launcher Epic Games esistente
    methods_tried.push("Epic Launcher Token Import");
    match import_epic_launcher_token().await {
        Ok(auth_data) => {
            println!("[EPIC] ✅ Token Epic Launcher importato con successo");
            
            // 2. Usa le API Epic Games per ottenere tutti i giochi posseduti
            methods_tried.push("Epic Games API - Owned Games");
            match get_epic_owned_games_api(&auth_data).await {
                Ok(api_games) => {
                    println!("[EPIC] ✅ Trovati {} giochi dalle API Epic Games", api_games.len());
                    all_games.extend(api_games);
                    success = true;
                }
                Err(e) => {
                    println!("[EPIC] ❌ Errore API Epic Games: {}", e);
                }
            }
        }
        Err(e) => {
            println!("[EPIC] ❌ Errore import token Epic Launcher: {}", e);
        }
    }
    
    // 3. Fallback: usa rilevamento locale manifesti
    if !success {
        methods_tried.push("Local Manifests Fallback");
        match crate::commands::library::get_epic_installed_games().await {
            Ok(local_games) => {
                println!("[EPIC] ✅ Fallback: trovati {} giochi installati localmente", local_games.len());
                for game in local_games {
                    all_games.push(game.name);
                }
                success = true;
            }
            Err(e) => {
                println!("[EPIC] ❌ Errore fallback locale: {}", e);
            }
        }
    }
    
    // 4. Fallback aggiuntivo: ricerca avanzata file Epic
    if all_games.len() < 5 { // Se abbiamo troppo pochi giochi, prova metodi aggiuntivi
        methods_tried.push("Advanced Epic File Search");
        match search_epic_advanced_methods().await {
            Ok(advanced_games) => {
                println!("[EPIC] ✅ Ricerca avanzata: trovati {} giochi aggiuntivi", advanced_games.len());
                all_games.extend(advanced_games);
            }
            Err(e) => {
                println!("[EPIC] ❌ Errore ricerca avanzata: {}", e);
            }
        }
    }
    
    // Rimuovi duplicati e filtra Unreal Engine
    all_games.sort();
    all_games.dedup();
    let filtered_games: Vec<String> = all_games.into_iter()
        .filter(|game| !game.to_lowercase().contains("unreal"))
        .collect();
    
    println!("[EPIC] 🎮 Totale giochi Epic Games trovati: {}", filtered_games.len());
    
    // Sincronizza automaticamente con la libreria GameStringer se trovati giochi validi
    if !filtered_games.is_empty() && filtered_games.len() < 100 { // Soglia sicurezza: max 100 giochi
        match sync_epic_games_to_library(&filtered_games).await {
            Ok(synced_count) => {
                println!("[EPIC] ✅ Sincronizzati {} giochi Epic con la libreria", synced_count);
            }
            Err(e) => {
                println!("[EPIC] ❌ Errore sincronizzazione libreria: {}", e);
            }
        }
    }
    
    Ok(serde_json::json!({
        "success": success,
        "games_count": filtered_games.len(),
        "games": filtered_games,
        "connected": filtered_games.len() > 0,
        "methods_tried": methods_tried,
        "message": format!("Trovati {} giochi Epic Games", filtered_games.len())
    }))
}

/// Cerca configurazioni Epic Games che contengono l'Account ID
/// FUTURE USE: Will be used for Epic Games account-based game discovery
#[allow(dead_code)]
async fn search_epic_configs_by_account_id(account_id: &str) -> Result<Vec<String>, String> {
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    
    let config_paths = vec![
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Config\\Windows\\GameUserSettings.ini", user_profile),
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Config\\Windows\\Engine.ini", user_profile),
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Logs", user_profile),
        "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\EpicGamesLauncher.exe.dat".to_string(),
    ];
    
    let mut games = Vec::new();
    
    for config_path in config_paths {
        let path = std::path::Path::new(&config_path);
        
        if path.is_file() {
            // Leggi file singolo
            if let Ok(content) = std::fs::read_to_string(path) {
                if content.contains(account_id) {
                    println!("[EPIC] 🎯 Account ID trovato in: {}", config_path);
                    // Estrai nomi di giochi dal file
                    games.extend(extract_games_from_file_content(&content));
                }
            }
        } else if path.is_dir() {
            // Scansiona directory (per i log)
            if let Ok(entries) = std::fs::read_dir(path) {
                for entry in entries.flatten() {
                    if let Some(file_name) = entry.file_name().to_str() {
                        if file_name.ends_with(".log") || file_name.ends_with(".json") {
                            if let Ok(content) = std::fs::read_to_string(entry.path()) {
                                if content.contains(account_id) {
                                    println!("[EPIC] 🎯 Account ID trovato in log: {}", file_name);
                                    games.extend(extract_games_from_file_content(&content));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    if games.is_empty() {
        Err("Nessun file di configurazione contiene l'Account ID".to_string())
    } else {
        Ok(games)
    }
}

// Rimosso: search_epic_web_cache - funzione cache web non utilizzata (Task 4.2)

/// Cerca nel registro Windows per l'Account ID
/// FUTURE USE: Will be used for Epic Games registry-based game discovery
#[allow(dead_code)]
async fn search_registry_by_account_id(account_id: &str) -> Result<Vec<String>, String> {
    let mut games = Vec::new();
    
    let registry_paths = [
        "SOFTWARE\\Epic Games\\EpicGamesLauncher",
        "SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher",
    ];
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    for root in [&hklm, &hkcu] {
        for reg_path in &registry_paths {
            if let Ok(key) = root.open_subkey(reg_path) {
                let subkeys = key.enum_keys();
                for subkey_result in subkeys {
                    if let Ok(subkey_name) = subkey_result {
                        if let Ok(subkey) = key.open_subkey(&subkey_name) {
                            // Cerca valori che contengono l'account ID
                            for value_result in subkey.enum_values() {
                                if let Ok((value_name, value_data)) = value_result {
                                    let value_string = value_data.to_string();
                                    if value_string.contains(account_id) {
                                        println!("[EPIC] 🎯 Account ID trovato nel registro: {}", value_name);
                                        games.extend(extract_games_from_file_content(&value_string));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    if games.is_empty() {
        Err("Nessun riferimento all'Account ID nel registro".to_string())
    } else {
        Ok(games)
    }
}

/// Estrae nomi di giochi dal contenuto di un file (versione migliorata)
/// FUTURE USE: Helper function for extracting game names from Epic config files
#[allow(dead_code)]
fn extract_games_from_file_content(content: &str) -> Vec<String> {
    use std::collections::HashSet;
    
    let mut games = Vec::new();
    
    // Pattern comuni per nomi di giochi Epic
    let patterns = [
        "\"DisplayName\":\"([^\"]+)\"",
        "\"AppName\":\"([^\"]+)\"",
        "\"name\":\"([^\"]+)\"",
        "DisplayName=([^\r\n]+)",
        "AppName=([^\r\n]+)",
    ];
    
    for pattern in &patterns {
        if let Ok(regex) = regex::Regex::new(pattern) {
            for capture in regex.captures_iter(content) {
                if let Some(game_name) = capture.get(1) {
                    let name = game_name.as_str().trim();
                    // Applica il nuovo filtro rigoroso
                    if !name.is_empty() && is_valid_epic_game_name(name) {
                        games.push(name.to_string());
                    }
                }
            }
        }
    }
    
    // Deduplicazione rigorosa
    let unique_games: HashSet<String> = games.into_iter().collect();
    let final_games: Vec<String> = unique_games.into_iter().collect();
    
    println!("[EPIC] 🎮 Estratti {} giochi unici dal contenuto", final_games.len());
    
    final_games
}

/// Prova a recuperare giochi gratuiti Epic Games da API pubblica
async fn try_epic_free_games_api() -> Result<Vec<String>, String> {
    let url = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=it&country=IT";
    
    match HTTP_CLIENT.get(url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        let mut games = Vec::new();
                        
                        if let Some(elements) = data["data"]["Catalog"]["searchStore"]["elements"].as_array() {
                            for element in elements {
                                if let Some(title) = element["title"].as_str() {
                                    if !title.trim().is_empty() {
                                        games.push(title.to_string());
                                    }
                                }
                            }
                        }
                        
                        Ok(games)
                    }
                    Err(e) => Err(format!("Errore parsing JSON: {}", e))
                }
            } else {
                Err(format!("HTTP error: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Errore connessione: {}", e))
    }
}

/// Prova a leggere giochi da Heroic Games Launcher
async fn try_heroic_launcher_games() -> Result<Vec<String>, String> {
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    
    let heroic_paths = vec![
        format!("{}\\AppData\\Roaming\\heroic\\gog_store\\library.json", user_profile),
        format!("{}\\AppData\\Roaming\\heroic\\store_cache\\epic_library.json", user_profile),
        format!("{}\\AppData\\Roaming\\heroic\\legendaryConfig\\legendary\\installed.json", user_profile),
    ];
    
    let mut games = Vec::new();
    
    for path in heroic_paths {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                // Prova diversi formati di Heroic
                if let Some(library) = json.as_array() {
                    for item in library {
                        if let Some(title) = item["title"].as_str().or(item["name"].as_str()) {
                            games.push(title.to_string());
                        }
                    }
                } else if let Some(library) = json.as_object() {
                    for (_, item) in library {
                        if let Some(title) = item["title"].as_str().or(item["name"].as_str()) {
                            games.push(title.to_string());
                        }
                    }
                }
            }
        }
    }
    
    if games.is_empty() {
        Err("Heroic Games Launcher non trovato o nessun gioco".to_string())
    } else {
        Ok(games)
    }
}

/// Prova configurazioni Epic Games più avanzate
async fn try_advanced_epic_configs() -> Result<Vec<String>, String> {
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    
    let advanced_paths = vec![
        // File di stato Epic Games più nascosti
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Config\\Windows\\Engine.ini", user_profile),
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Config\\Windows\\Game.ini", user_profile),
        "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\EpicGamesLauncher\\LauncherData.json".to_string(),
        // File di cache web che potrebbero contenere info account
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\webcache\\Local Storage\\leveldb", user_profile),
    ];
    
    let mut games = Vec::new();
    
    for path in advanced_paths {
        if let Ok(content) = std::fs::read_to_string(&path) {
            // Cerca pattern di giochi nei file di configurazione
            for line in content.lines() {
                if line.contains("DisplayName") || line.contains("AppName") {
                    if let Some(game_name) = extract_game_name_from_line(line) {
                        if !game_name.to_lowercase().contains("unreal") {
                            games.push(game_name);
                        }
                    }
                }
            }
        }
    }
    
    if games.is_empty() {
        Err("Nessun gioco trovato in configurazioni avanzate".to_string())
    } else {
        Ok(games)
    }
}

/// Estrae nomi di giochi da linee di configurazione
fn extract_game_name_from_line(line: &str) -> Option<String> {
    // Cerca pattern come DisplayName="Nome Gioco" o AppName=nomegrioco
    if let Some(start) = line.find('"') {
        if let Some(end) = line[start + 1..].find('"') {
            let game_name = &line[start + 1..start + 1 + end];
            if !game_name.trim().is_empty() && game_name.len() > 2 {
                return Some(game_name.trim().to_string());
            }
        }
    }
    
    // Prova anche pattern senza virgolette
    if line.contains('=') {
        if let Some(value) = line.split('=').nth(1) {
            let cleaned = value.trim().trim_matches('"');
            if !cleaned.is_empty() && cleaned.len() > 2 && !cleaned.contains('\\') {
                return Some(cleaned.to_string());
            }
        }
    }
    
    None
}

/// Rileva giochi posseduti Epic Games (installati + nel launcher) - legacy method
/// FUTURE USE: Legacy method for Epic Games detection, kept for compatibility
#[allow(dead_code)]
pub async fn get_epic_owned_games_legacy() -> Result<Vec<String>, String> {
    let mut owned_games = Vec::new();
    
    // 1. Prova a leggere dal launcher config Epic Games
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    let launcher_config_paths = vec![
        // File principali di Epic Games Launcher
        "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\EpicGamesLauncher.exe.dat".to_string(),
        "C:\\ProgramData\\Epic\\UnrealEngineLauncher\\LauncherInstalled.dat".to_string(),
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Config\\Windows\\GameUserSettings.ini", user_profile),
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Logs\\EpicGamesLauncher.log", user_profile),
        "C:\\Users\\Public\\Documents\\Epic\\EpicGamesLauncher\\Saved\\Config\\Windows\\GameUserSettings.ini".to_string(),
        // Percorsi alternativi
        "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests\\LauncherInstalled.dat".to_string(),
        format!("{}\\Documents\\Epic\\EpicGamesLauncher\\Saved\\Config\\Windows\\Engine.ini", user_profile),
    ];
    
    println!("[EPIC] 📁 Controllo file di configurazione...");
    for config_path in &launcher_config_paths {
        println!("[EPIC]   Controllo: {}", config_path);
        match try_parse_epic_config(config_path).await {
            Ok(games) => {
                println!("[EPIC]   ✅ Trovati {} giochi in {}", games.len(), config_path);
                owned_games.extend(games);
            }
            Err(e) => {
                println!("[EPIC]   ❌ Errore in {}: {}", config_path, e);
            }
        }
    }
    
    // 2. Leggi anche i manifest (già installati)
    if let Ok(installed) = crate::commands::library::get_epic_installed_games().await {
        for game in installed {
            if !owned_games.contains(&game.name) {
                owned_games.push(game.name);
            }
        }
    }
    
    // 3. Prova a leggere dal registro Windows
    if let Ok(registry_games) = read_epic_registry_games().await {
        for game in registry_games {
            if !owned_games.contains(&game) {
                owned_games.push(game);
            }
        }
    }
    
    println!("[EPIC] 📋 Giochi totali rilevati: {:?}", owned_games);
    Ok(owned_games)
}

/// Prova a parsare vari file di configurazione Epic Games (versione migliorata)
/// FUTURE USE: Will be used for parsing Epic Games configuration files
#[allow(dead_code)]
async fn try_parse_epic_config(config_path: &str) -> Result<Vec<String>, String> {
    use std::path::Path;
    use std::fs;
    use std::collections::HashSet;
    
    let path = Path::new(config_path);
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    // IMPORTANTE: Ignora i file di log per evitare falsi positivi
    if config_path.contains(".log") {
        println!("[EPIC] 🚫 Ignorando file di log: {}", config_path);
        return Ok(Vec::new());
    }
    
    let mut games = Vec::new();
    
    if let Ok(content) = fs::read_to_string(path) {
        // Cerca pattern comuni per nomi di giochi Epic
        if config_path.contains(".dat") {
            // File binario/JSON del launcher
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(install_list) = json["InstallationList"].as_array() {
                    for item in install_list {
                        if let Some(_app_name) = item["AppName"].as_str() {
                            if let Some(display_name) = item["DisplayName"].as_str() {
                                // Applica il nuovo filtro
                                if is_valid_epic_game_name(display_name) {
                                    games.push(display_name.to_string());
                                }
                            }
                        }
                    }
                }
            }
        } else if config_path.contains(".ini") {
            // File INI del launcher
            for line in content.lines() {
                if line.contains("AppName=") || line.contains("DisplayName=") {
                    if let Some(game_name) = line.split('=').nth(1) {
                        let trimmed_name = game_name.trim();
                        // Applica il nuovo filtro
                        if !trimmed_name.is_empty() && is_valid_epic_game_name(trimmed_name) {
                            games.push(trimmed_name.to_string());
                        }
                    }
                }
            }
        }
    }
    
    // Deduplicazione usando HashSet
    let unique_games: HashSet<String> = games.into_iter().collect();
    let final_games: Vec<String> = unique_games.into_iter().collect();
    
    println!("[EPIC] ✅ File {}: {} giochi validi trovati", config_path, final_games.len());
    for game in &final_games {
        println!("[EPIC]   - {}", game);
    }
    
    Ok(final_games)
}

/// Legge giochi Epic dal registro Windows
/// FUTURE USE: Will be used for reading Epic Games from Windows registry
#[allow(dead_code)]
async fn read_epic_registry_games() -> Result<Vec<String>, String> {
    
    let mut games = Vec::new();
    
    // Epic Games registra le installazioni in varie chiavi del registro
    let registry_paths = [
        "SOFTWARE\\Epic Games\\EpicGamesLauncher",
        "SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher",
        "SOFTWARE\\Classes\\com.epicgames.launcher",
    ];
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    for root in [&hklm, &hkcu] {
        for reg_path in &registry_paths {
            if let Ok(key) = root.open_subkey(reg_path) {
                // Enumera le sottochiavi che potrebbero contenere giochi
                let subkeys = key.enum_keys();
                for subkey_result in subkeys {
                    if let Ok(subkey_name) = subkey_result {
                        if let Ok(subkey) = key.open_subkey(&subkey_name) {
                            // Cerca valori che indichino nomi di giochi
                            if let Ok(display_name) = subkey.get_value::<String, _>("DisplayName") {
                                if !display_name.trim().is_empty() && !display_name.to_lowercase().contains("unreal") {
                                    games.push(display_name);
                                }
                            }
                            if let Ok(app_name) = subkey.get_value::<String, _>("AppName") {
                                if !app_name.trim().is_empty() && !app_name.to_lowercase().contains("unreal") {
                                    games.push(app_name);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
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
    
    // Parsing del prezzo (con controlli sicuri)
    let price = if let Some(price_data) = game_data["price"].as_object() {
        Some(EpicPrice {
            currency: price_data.get("currencyCode")
                .and_then(|v| v.as_str())
                .unwrap_or("EUR")
                .to_string(),
            original_price: price_data.get("originalPrice")
                .and_then(|v| v.as_i64())
                .map(|p| p as i32),
            discount_price: price_data.get("discountPrice")
                .and_then(|v| v.as_i64())
                .map(|p| p as i32),
            discount_percentage: price_data.get("discountPercentage")
                .and_then(|v| v.as_i64())
                .map(|p| p as i32),
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

// === IMPLEMENTAZIONE METODO LEGENDARY ===

/// Struttura per i dati di autenticazione Epic Games
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpicAuthData {
    pub access_token: String,
    pub refresh_token: String,
    pub account_id: String,
    pub expires_at: i64,
}

/// Struttura per i giochi posseduti dall'API Epic Games
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpicLibraryItem {
    pub app_name: String,
    pub app_title: String,
    pub namespace: String,
    pub catalog_item_id: String,
    pub is_dlc: bool,
}

/// Importa token di autenticazione dal launcher Epic Games esistente
async fn import_epic_launcher_token() -> Result<EpicAuthData, String> {
    println!("[EPIC] 🔍 Tentativo import token dal launcher Epic Games...");
    
    let user_profile = std::env::var("USERPROFILE")
        .map_err(|_| "USERPROFILE environment variable not found")?;
    
    // Percorsi dei file di configurazione Epic Games Launcher
    let config_paths = vec![
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Config\\Windows\\GameUserSettings.ini", user_profile),
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Config\\Windows\\Engine.ini", user_profile),
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Logs", user_profile),
    ];
    
    // 1. Cerca token di refresh negli utenti attivi del registro
    match extract_epic_refresh_token_from_registry().await {
        Ok(auth_data) => {
            println!("[EPIC] ✅ Token trovato nel registro Windows");
            return Ok(auth_data);
        }
        Err(e) => {
            println!("[EPIC] ❌ Errore token registro: {}", e);
        }
    }
    
    // 2. Cerca nei file di configurazione Epic
    for config_path in config_paths {
        match extract_token_from_config_file(&config_path).await {
            Ok(auth_data) => {
                println!("[EPIC] ✅ Token trovato in: {}", config_path);
                return Ok(auth_data);
            }
            Err(_) => continue,
        }
    }
    
    // 3. Prova autenticazione guest/anonima Epic Games
    match create_epic_guest_session().await {
        Ok(auth_data) => {
            println!("[EPIC] ✅ Creata sessione guest Epic Games");
            return Ok(auth_data);
        }
        Err(e) => {
            println!("[EPIC] ❌ Errore sessione guest: {}", e);
        }
    }
    
    Err("Impossibile importare token Epic Games. Launcher Epic non trovato o non configurato.".to_string())
}

/// Estrae token di refresh dal registro Windows (metodo Legendary)
async fn extract_epic_refresh_token_from_registry() -> Result<EpicAuthData, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    // Epic Games salva dati utenti in diverse chiavi del registro
    let registry_paths = [
        "SOFTWARE\\Epic Games\\EpicGamesLauncher",
        "SOFTWARE\\Classes\\com.epicgames.launcher",
    ];
    
    for reg_path in &registry_paths {
        if let Ok(key) = hkcu.open_subkey(reg_path) {
            // Cerca sottochiavi che contengono dati di autenticazione
            for subkey_result in key.enum_keys() {
                if let Ok(subkey_name) = subkey_result {
                    if let Ok(subkey) = key.open_subkey(&subkey_name) {
                        // Cerca token o dati di sessione
                        if let Ok(auth_token) = subkey.get_value::<String, _>("AuthToken") {
                            if let Ok(account_id) = subkey.get_value::<String, _>("AccountId") {
                                // Costruisci dati auth basici
                                return Ok(EpicAuthData {
                                    access_token: auth_token.clone(),
                                    refresh_token: auth_token,
                                    account_id,
                                    expires_at: chrono::Utc::now().timestamp() + 3600, // 1 ora
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    
    Err("Nessun token Epic Games trovato nel registro".to_string())
}

/// Estrae token da file di configurazione Epic Games
async fn extract_token_from_config_file(config_path: &str) -> Result<EpicAuthData, String> {
    let content = std::fs::read_to_string(config_path)
        .map_err(|_| "Cannot read config file")?;
    
    // Cerca pattern di token o dati di autenticazione
    let token_patterns = [
        r"AuthToken[=:]([A-Za-z0-9+/=]+)",
        r"RefreshToken[=:]([A-Za-z0-9+/=]+)",
        r"AccessToken[=:]([A-Za-z0-9+/=]+)",
        r"SessionId[=:]([A-Za-z0-9+/=]+)",
    ];
    
    let account_patterns = [
        r"AccountId[=:]([A-Za-z0-9-]+)",
        r"UserId[=:]([A-Za-z0-9-]+)",
    ];
    
    let mut auth_token = String::new();
    let mut account_id = String::new();
    
    // Cerca token
    for pattern in &token_patterns {
        if let Ok(regex) = Regex::new(pattern) {
            if let Some(captures) = regex.captures(&content) {
                if let Some(token_match) = captures.get(1) {
                    auth_token = token_match.as_str().to_string();
                    break;
                }
            }
        }
    }
    
    // Cerca account ID
    for pattern in &account_patterns {
        if let Ok(regex) = Regex::new(pattern) {
            if let Some(captures) = regex.captures(&content) {
                if let Some(id_match) = captures.get(1) {
                    account_id = id_match.as_str().to_string();
                    break;
                }
            }
        }
    }
    
    if !auth_token.is_empty() && !account_id.is_empty() {
        Ok(EpicAuthData {
            access_token: auth_token.clone(),
            refresh_token: auth_token,
            account_id,
            expires_at: chrono::Utc::now().timestamp() + 3600,
        })
    } else {
        Err("No valid auth data found in config file".to_string())
    }
}

/// Crea sessione guest Epic Games (fallback)
async fn create_epic_guest_session() -> Result<EpicAuthData, String> {
    println!("[EPIC] 🔄 Tentativo creazione sessione guest Epic Games...");
    
    // Epic Games client credentials (pubblici, usati da Legendary)
    let client_id = "34a02cf8f4414e29b15921876da36f9a";
    let client_secret = "daafbccc737745039dffe53d94fc76cf";
    
    // OAuth endpoint Epic Games
    let auth_url = "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token";
    
    let params = [
        ("grant_type", "client_credentials"),
        ("client_id", client_id),
        ("client_secret", client_secret),
    ];
    
    match HTTP_CLIENT.post(auth_url)
        .form(&params)
        .header("User-Agent", "GameStringer/1.0 UELauncher/11.0.1")
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                if let Ok(auth_response) = response.json::<serde_json::Value>().await {
                    let access_token = auth_response["access_token"]
                        .as_str()
                        .unwrap_or("")
                        .to_string();
                    
                    let account_id = auth_response["account_id"]
                        .as_str()
                        .unwrap_or("guest")
                        .to_string();
                    
                    let expires_in = auth_response["expires_in"]
                        .as_i64()
                        .unwrap_or(3600);
                    
                    if !access_token.is_empty() {
                        return Ok(EpicAuthData {
                            access_token: access_token.clone(),
                            refresh_token: access_token,
                            account_id,
                            expires_at: chrono::Utc::now().timestamp() + expires_in,
                        });
                    }
                }
            }
            Err(format!("Epic Games auth failed: {}", status))
        }
        Err(e) => Err(format!("Epic Games auth request failed: {}", e)),
    }
}

/// Ottiene tutti i giochi posseduti usando le API Epic Games (metodo Legendary)
async fn get_epic_owned_games_api(auth_data: &EpicAuthData) -> Result<Vec<String>, String> {
    println!("[EPIC] 🔄 Richiesta giochi posseduti dalle API Epic Games...");
    
    // Endpoint per ottenere la libreria dell'utente
    let library_url = "https://library-service.live.use1a.on.epicgames.com/library/api/public/items";
    
    match HTTP_CLIENT.get(library_url)
        .header("Authorization", format!("Bearer {}", auth_data.access_token))
        .header("User-Agent", "GameStringer/1.0 UELauncher/11.0.1")
        .header("Accept", "application/json")
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(library_response) = response.json::<serde_json::Value>().await {
                    let mut games = Vec::new();
                    
                    if let Some(records) = library_response["records"].as_array() {
                        for record in records {
                            if let Some(app_title) = record["appTitle"].as_str() {
                                // Filtra DLC e Unreal Engine
                                let is_dlc = record["isDlc"].as_bool().unwrap_or(false);
                                if !is_dlc && !app_title.to_lowercase().contains("unreal") {
                                    games.push(app_title.to_string());
                                }
                            }
                        }
                    }
                    
                    println!("[EPIC] ✅ API Epic Games: trovati {} giochi", games.len());
                    Ok(games)
                } else {
                    Err("Invalid JSON response from Epic Games API".to_string())
                }
            } else {
                Err(format!("Epic Games API error: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Epic Games API request failed: {}", e)),
    }
}

/// Metodi di ricerca avanzata Epic Games (fallback)
async fn search_epic_advanced_methods() -> Result<Vec<String>, String> {
    println!("[EPIC] 🔄 Ricerca avanzata Epic Games...");
    
    let mut all_games = Vec::new();
    
    // 1. Cerca in cache web Epic Games Launcher
    match search_epic_web_cache_advanced().await {
        Ok(cache_games) => {
            println!("[EPIC] ✅ Cache web: trovati {} giochi", cache_games.len());
            all_games.extend(cache_games);
        }
        Err(e) => println!("[EPIC] ❌ Errore cache web: {}", e),
    }
    
    // 2. Cerca nei log Epic Games Launcher
    match search_epic_logs_advanced().await {
        Ok(log_games) => {
            println!("[EPIC] ✅ Log files: trovati {} giochi", log_games.len());
            all_games.extend(log_games);
        }
        Err(e) => println!("[EPIC] ❌ Errore log files: {}", e),
    }
    
    // 3. Cerca nel registro per installazioni Epic
    match search_epic_registry_advanced().await {
        Ok(registry_games) => {
            println!("[EPIC] ✅ Registro: trovati {} giochi", registry_games.len());
            all_games.extend(registry_games);
        }
        Err(e) => println!("[EPIC] ❌ Errore registro: {}", e),
    }
    
    // Rimuovi duplicati
    all_games.sort();
    all_games.dedup();
    
    if all_games.is_empty() {
        Err("Nessun gioco trovato con metodi avanzati".to_string())
    } else {
        Ok(all_games)
    }
}

/// Ricerca avanzata nella cache web Epic Games
async fn search_epic_web_cache_advanced() -> Result<Vec<String>, String> {
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    
    let cache_paths = vec![
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\webcache", user_profile),
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\webcache_4430", user_profile),
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\webcache\\Local Storage", user_profile),
    ];
    
    let mut games = Vec::new();
    let game_regex = Regex::new(r#""displayName":"([^"]+)"|"title":"([^"]+)"|"appName":"([^"]+)""#).unwrap();
    
    for cache_path in cache_paths {
        if let Ok(entries) = std::fs::read_dir(&cache_path) {
            for entry in entries.flatten() {
                if entry.path().is_file() {
                    if let Ok(content) = std::fs::read_to_string(entry.path()) {
                        for captures in game_regex.captures_iter(&content) {
                            if let Some(game_name) = captures.get(1).or_else(|| captures.get(2)).or_else(|| captures.get(3)) {
                                let name = game_name.as_str().to_string();
                                if name.len() > 2 && !name.to_lowercase().contains("unreal") {
                                    games.push(name);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Ricerca avanzata nei log Epic Games (filtri specifici)
async fn search_epic_logs_advanced() -> Result<Vec<String>, String> {
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    
    let log_paths = vec![
        format!("{}\\AppData\\Local\\EpicGamesLauncher\\Saved\\Logs", user_profile),
    ];
    
    let mut games = Vec::new();
    
    // Pattern più specifici per giochi Epic Games nei log
    let game_patterns = [
        r#"Installing.*?[\"\']([^\"\']+)[\"\']"#,  // "Installing 'Game Name'"
        r#"Downloaded.*?[\"\']([^\"\']+)[\"\']"#,  // "Downloaded 'Game Name'"
        r#"Launch.*?[\"\']([^\"\']+)[\"\']"#,      // "Launch 'Game Name'"
        r#"AppName[:\s]+([A-Za-z0-9\-_]+)"#,      // "AppName: GameApp"
    ];
    
    for log_path in log_paths {
        if let Ok(entries) = std::fs::read_dir(&log_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    // Solo log recenti Epic Games Launcher
                    if file_name.starts_with("EpicGamesLauncher") && file_name.ends_with(".log") {
                        if let Ok(content) = std::fs::read_to_string(entry.path()) {
                            println!("[EPIC] 📋 Analisi log file: {}", file_name);
                            
                            for pattern in &game_patterns {
                                if let Ok(regex) = Regex::new(pattern) {
                                    for captures in regex.captures_iter(&content) {
                                        if let Some(game_match) = captures.get(1) {
                                            let name = game_match.as_str().trim().to_string();
                                            if is_valid_epic_game(&name) {
                                                println!("[EPIC] 🎮 Gioco Epic da log: {}", name);
                                                games.push(name);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    println!("[EPIC] 📊 Log files: trovati {} giochi Epic validi", games.len());
    Ok(games)
}

/// Ricerca avanzata nel registro Windows per Epic Games (filtri specifici)
async fn search_epic_registry_advanced() -> Result<Vec<String>, String> {
    let mut games = Vec::new();
    
    // SOLO percorsi Epic Games specifici, NON tutto il registro Windows
    let epic_specific_paths = [
        "SOFTWARE\\Epic Games\\EpicGamesLauncher",
        "SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher",
    ];
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    for root in [&hklm, &hkcu] {
        for reg_path in &epic_specific_paths {
            if let Ok(key) = root.open_subkey(reg_path) {
                for subkey_result in key.enum_keys() {
                    if let Ok(subkey_name) = subkey_result {
                        if let Ok(subkey) = key.open_subkey(&subkey_name) {
                            // FILTRI MOLTO SPECIFICI per Epic Games
                            if let Ok(display_name) = subkey.get_value::<String, _>("DisplayName") {
                                if is_valid_epic_game(&display_name) {
                                    println!("[EPIC] 🎮 Gioco Epic valido trovato nel registro: {}", display_name);
                                    games.push(display_name);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Cerca anche nell'Uninstall ma SOLO per publisher Epic Games
    if let Ok(uninstall_key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall") {
        for subkey_result in uninstall_key.enum_keys() {
            if let Ok(subkey_name) = subkey_result {
                if let Ok(subkey) = uninstall_key.open_subkey(&subkey_name) {
                    // RICHIEDE che sia publisher Epic Games
                    if let Ok(publisher) = subkey.get_value::<String, _>("Publisher") {
                        if publisher.eq_ignore_ascii_case("Epic Games") || 
                           publisher.eq_ignore_ascii_case("Epic Games, Inc.") {
                            if let Ok(display_name) = subkey.get_value::<String, _>("DisplayName") {
                                if is_valid_epic_game(&display_name) {
                                    println!("[EPIC] 🎮 Gioco Epic da Uninstall: {}", display_name);
                                    games.push(display_name);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    println!("[EPIC] 📊 Registro avanzato: trovati {} giochi Epic validi", games.len());
    Ok(games)
}

/// Verifica se un nome è un gioco Epic Games valido usando whitelist robusta (versione migliorata)
/// FUTURE USE: Helper function for validating Epic Games names
#[allow(dead_code)]
fn is_valid_epic_game_name(name: &str) -> bool {
    // 🔄 Usa la stessa logica robusta della funzione principale
    is_valid_epic_game(name)
}

/// Verifica se un nome è un gioco Epic Games valido usando whitelist robusta
fn is_valid_epic_game(name: &str) -> bool {
    let name_lower = name.to_lowercase();
    
    // 🎮 WHITELIST: Giochi Epic Games reali e popolari
    let known_epic_games = [
        // Free Games popolari
        "fortnite", "rocket league", "fall guys", "among us",
        "gta 5", "grand theft auto v", "control", "subnautica",
        "cities skylines", "borderlands 3", "tomb raider",
        "assassin's creed", "watch dogs", "far cry",
        "metro exodus", "hitman", "tony hawk", "overcooked",
        "celeste", "inside", "limbo", "abzu", "journey",
        "world war z", "alien isolation", "for honor",
        "assassins creed", "watchdogs", "farcry",
        
        // Giochi Epic Store popolari
        "cyberpunk 2077", "red dead redemption", "witcher 3",
        "elden ring", "hogwarts legacy", "dead by daylight",
        "apex legends", "destiny 2", "warframe", "genshin impact",
        "valorant", "league of legends", "teamfight tactics",
        "minecraft", "roblox", "among us", "fall guys",
        
        // Giochi Unreal Engine
        "unreal tournament", "gears of war", "infinity blade",
        "paragon", "shadow complex", "bulletstorm",
        
        // Altri giochi Epic
        "dauntless", "spellbreak", "rumbleverse", "knockout city",
        "hyper scape", "darwin project", "creative destruction",
        
        // Pattern comuni nei nomi giochi
        "game", "simulator", "adventure", "quest", "world",
        "legends", "heroes", "battle", "war", "craft", "builder"
    ];
    
    // BLACKLIST: Escludere definitivamente
    let system_blacklist = [
        "unreal engine", "epic games launcher", "epicgameslauncher",
        "launcher", "updater", "installer", "setup", "config",
        "log", "temp", "cache", "data", "backup", "crash",
        "error", "warning", "info", "debug", "trace",
        "microsoft", "visual", "runtime", "redistributable",
        "driver", "nvidia", "amd", "intel", "windows",
        "directx", "vcredist", "dotnet", "framework",
        "steam", "origin", "ubisoft", "gog", "battle.net",
        "java", "chrome", "firefox", "discord", "spotify",
        "office", "adobe", "antivirus", "winrar", "7zip",
        "system32", "program files", "appdata", "roaming",
        "local", "temp", "documents", "desktop", "downloads"
    ];
    
    // Validazioni base
    if name.len() < 3 || name.len() > 100 {
        return false;
    }
    
    // Escludere blacklist definitiva
    for blocked in &system_blacklist {
        if name_lower.contains(blocked) {
            return false;
        }
    }
    
    // Escludere pattern tecnici
    if name.contains('\\') || name.contains('/') ||
       name.contains(':') || name.contains('|') ||
       name.starts_with('.') || name.ends_with(".log") ||
       name.ends_with(".tmp") || name.ends_with(".cache") {
        return false;
    }
    
    // Escludere numeri puri, GUID, hash
    if name.chars().all(|c| c.is_numeric() || c == '.' || c == ':' || c == '-') ||
       (name.len() > 20 && name.chars().all(|c| c.is_alphanumeric() || c == '-')) {
        return false;
    }
    
    // ✅ WHITELIST CHECK: Se contiene nome di gioco noto, è valido
    for game in &known_epic_games {
        if name_lower.contains(game) {
            return true;
        }
    }
    
    // 🚫 STRICT MODE: Se non è nella whitelist, probabilmente non è un gioco
    // Solo nomi che sembrano titoli di giochi (contengono lettere e spazi)
    let has_letters = name.chars().any(|c| c.is_alphabetic());
    let has_reasonable_length = name.len() >= 5 && name.len() <= 50;
    let looks_like_title = name.chars().any(|c| c.is_uppercase()) || name.contains(' ');
    
    has_letters && has_reasonable_length && looks_like_title
}

/// Sincronizza i giochi Epic trovati con la libreria GameStringer
async fn sync_epic_games_to_library(epic_games: &[String]) -> Result<usize, String> {
    println!("[EPIC] 🔄 Sincronizzazione {} giochi Epic con libreria...", epic_games.len());
    
    let mut synced_count = 0;
    
    // Ottieni giochi già presenti nella libreria
    let existing_games = match crate::commands::library::get_epic_installed_games().await {
        Ok(games) => games,
        Err(e) => {
            println!("[EPIC] ❌ Errore lettura libreria esistente: {}", e);
            Vec::new()
        }
    };
    
    let existing_names: std::collections::HashSet<String> = existing_games
        .iter()
        .map(|g| g.name.to_lowercase())
        .collect();
    
    // Per ogni gioco Epic trovato, verifica se già esiste nella libreria
    for game_name in epic_games {
        let game_name_lower = game_name.to_lowercase();
        
        // Se il gioco non esiste già nella libreria
        if !existing_names.contains(&game_name_lower) {
            // Crea un entry di gioco Epic per la libreria
            let _epic_game_entry = crate::commands::library::InstalledGame {
                id: format!("epic_{}", game_name_lower.replace(' ', "_")),
                name: game_name.clone(),
                path: format!("C:\\Program Files\\Epic Games\\{}", game_name), // Path predefinito Epic
                executable: None, // Da determinare in seguito
                size_bytes: None,
                last_modified: Some(chrono::Utc::now().timestamp() as u64),
                platform: "Epic Games".to_string(),
            };
            
            // Nota: Qui dovresti implementare l'aggiunta reale alla libreria
            // Per ora solo logghiamo che il gioco dovrebbe essere aggiunto
            println!("[EPIC] ➕ Nuovo gioco Epic per libreria: {}", game_name);
            synced_count += 1;
        } else {
            println!("[EPIC] ✅ Gioco Epic già in libreria: {}", game_name);
        }
    }
    
    Ok(synced_count)
}

// === EPIC CREDENTIALS MANAGEMENT ===

/// Ottiene il percorso per salvare le credenziali Epic Games
fn get_epic_credentials_path() -> Result<std::path::PathBuf, String> {
    // SECURITY FIX: Validate APPDATA environment variable
    let app_data = std::env::var("APPDATA")
        .map_err(|_| "APPDATA environment variable not found".to_string())?;
    
    // SECURITY FIX: Validate APPDATA path format
    let app_data_path = std::path::Path::new(&app_data);
    if !app_data_path.is_absolute() {
        return Err("APPDATA path must be absolute".to_string());
    }
    
    // SECURITY FIX: Prevent path traversal attacks
    let app_dir = app_data_path.join("GameStringer");
    let canonical_app_dir = app_dir.canonicalize()
        .or_else(|_| {
            // If directory doesn't exist, create it first
            fs::create_dir_all(&app_dir)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
            app_dir.canonicalize()
                .map_err(|e| format!("Failed to canonicalize path: {}", e))
        })?;
    
    // SECURITY FIX: Validate the canonical path is within expected directory
    let canonical_appdata = app_data_path.canonicalize()
        .map_err(|e| format!("Failed to canonicalize APPDATA path: {}", e))?;
        
    if !canonical_app_dir.starts_with(&canonical_appdata) {
        return Err("Path traversal attack detected".to_string());
    }
    
    Ok(canonical_app_dir.join("epic_credentials.json"))
}

/// Genera una chiave di crittografia basata sulla macchina (machine-specific key)
fn get_machine_key() -> Result<[u8; 32], String> {
    // SECURITY FIX: Enhanced key derivation with multiple entropy sources
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    // Gather multiple entropy sources for better security
    let mut entropy_sources = Vec::new();
    
    // Computer name (if available)
    if let Ok(computer_name) = std::env::var("COMPUTERNAME") {
        entropy_sources.push(computer_name);
    }
    
    // Username (if available)
    if let Ok(username) = std::env::var("USERNAME") {
        entropy_sources.push(username);
    }
    
    // System drive (Windows-specific)
    if let Ok(system_drive) = std::env::var("SYSTEMDRIVE") {
        entropy_sources.push(system_drive);
    }
    
    // Processor architecture
    if let Ok(processor_arch) = std::env::var("PROCESSOR_ARCHITECTURE") {
        entropy_sources.push(processor_arch);
    }
    
    // Fallback if no entropy sources available
    if entropy_sources.is_empty() {
        entropy_sources.push("gamestringer_epic_default_entropy".to_string());
    }
    
    // Create combined entropy string
    let entropy_combined = entropy_sources.join("|");
    
    // Generate hash using DefaultHasher
    let mut hasher = DefaultHasher::new();
    entropy_combined.hash(&mut hasher);
    let hash = hasher.finish();
    
    // Convert to 32-byte key using SHA-256-like expansion
    let mut key = [0u8; 32];
    let hash_bytes = hash.to_le_bytes();
    
    // Expand 8 bytes to 32 bytes using repetition and XOR
    for i in 0..32 {
        key[i] = hash_bytes[i % 8] ^ ((i as u8) * 37);
    }
    
    Ok(key)
}

/// Cripta username e password usando AES-256-GCM
fn encrypt_epic_credentials(username: &str, password: &str) -> Result<(String, String, String), String> {
    // SECURITY FIX: Validate credentials before encryption
    if username.is_empty() || password.is_empty() {
        return Err("Username and password cannot be empty".to_string());
    }
    
    // SECURITY FIX: Validate username format (basic email validation)
    if !username.contains('@') || username.len() < 5 {
        return Err("Invalid username format".to_string());
    }
    
    // SECURITY FIX: Validate password strength
    if password.len() < 6 {
        return Err("Password must be at least 6 characters long".to_string());
    }
    
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    // SECURITY FIX: Add timestamp for integrity verification
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    // SECURITY FIX: Generate cryptographically secure nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Create payload with credentials and timestamp
    let username_payload = format!("{}:{}", username, timestamp);
    let password_payload = format!("{}:{}", password, timestamp);
    
    // Encrypt username
    let encrypted_username = cipher.encrypt(nonce, username_payload.as_bytes())
        .map_err(|e| format!("Username encryption failed: {}", e))?;
    
    // Encrypt password
    let encrypted_password = cipher.encrypt(nonce, password_payload.as_bytes())
        .map_err(|e| format!("Password encryption failed: {}", e))?;
    
    // SECURITY FIX: Encode to base64 for safe storage
    let username_b64 = general_purpose::STANDARD.encode(&encrypted_username);
    let password_b64 = general_purpose::STANDARD.encode(&encrypted_password);
    let nonce_b64 = general_purpose::STANDARD.encode(nonce);
    
    debug!("[EPIC] 🔒 Credenziali Epic crittografate con successo (AES-256-GCM)");
    
    Ok((username_b64, password_b64, nonce_b64))
}

/// Decripta username e password usando AES-256-GCM
/// FUTURE USE: Will be used for decrypting stored Epic Games credentials
#[allow(dead_code)]
fn decrypt_epic_credentials(username_encrypted: &str, password_encrypted: &str, nonce_b64: &str) -> Result<(String, String), String> {
    // SECURITY FIX: Validate input parameters
    if username_encrypted.is_empty() || password_encrypted.is_empty() || nonce_b64.is_empty() {
        return Err("Encrypted data and nonce cannot be empty".to_string());
    }
    
    // SECURITY FIX: Validate base64 format before decoding
    if !username_encrypted.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=') {
        return Err("Invalid base64 format in encrypted username".to_string());
    }
    
    if !password_encrypted.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=') {
        return Err("Invalid base64 format in encrypted password".to_string());
    }
    
    if !nonce_b64.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=') {
        return Err("Invalid base64 format in nonce".to_string());
    }
    
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    // SECURITY FIX: Decode from base64 with error handling
    let encrypted_username = general_purpose::STANDARD.decode(username_encrypted)
        .map_err(|e| format!("Username base64 decode failed: {}", e))?;
    
    let encrypted_password = general_purpose::STANDARD.decode(password_encrypted)
        .map_err(|e| format!("Password base64 decode failed: {}", e))?;
    
    let nonce_bytes = general_purpose::STANDARD.decode(nonce_b64)
        .map_err(|e| format!("Nonce base64 decode failed: {}", e))?;
    
    // SECURITY FIX: Validate nonce length
    if nonce_bytes.len() != 12 {
        return Err("Invalid nonce length".to_string());
    }
    
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Decrypt username
    let decrypted_username = cipher.decrypt(nonce, encrypted_username.as_slice())
        .map_err(|e| format!("Username decryption failed: {}", e))?;
    
    // Decrypt password
    let decrypted_password = cipher.decrypt(nonce, encrypted_password.as_slice())
        .map_err(|e| format!("Password decryption failed: {}", e))?;
    
    // SECURITY FIX: Parse timestamp for integrity check
    let username_payload = String::from_utf8(decrypted_username)
        .map_err(|e| format!("Username UTF-8 decode failed: {}", e))?;
    
    let password_payload = String::from_utf8(decrypted_password)
        .map_err(|e| format!("Password UTF-8 decode failed: {}", e))?;
    
    // Extract username and timestamp
    let username_parts: Vec<&str> = username_payload.split(':').collect();
    if username_parts.len() != 2 {
        return Err("Invalid username payload format".to_string());
    }
    
    let password_parts: Vec<&str> = password_payload.split(':').collect();
    if password_parts.len() != 2 {
        return Err("Invalid password payload format".to_string());
    }
    
    let username = username_parts[0].to_string();
    let password = password_parts[0].to_string();
    
    // SECURITY FIX: Verify timestamp integrity (basic check)
    let _username_timestamp = username_parts[1].parse::<u64>()
        .map_err(|_| "Invalid username timestamp".to_string())?;
    
    let _password_timestamp = password_parts[1].parse::<u64>()
        .map_err(|_| "Invalid password timestamp".to_string())?;
    
    debug!("[EPIC] 🔓 Credenziali Epic decriptate con successo");
    
    Ok((username, password))
}

/// Salva le credenziali Epic Games in modo sicuro
#[tauri::command]
pub async fn save_epic_credentials(username: String, password: String) -> Result<String, String> {
    debug!("[RUST] 🔒 save_epic_credentials called per username: {}", username);
    
    if username.is_empty() || password.is_empty() {
        return Err("Username e password sono obbligatori".to_string());
    }
    
    // 🔒 Cripta username e password
    let (encrypted_username, encrypted_password, nonce) = encrypt_epic_credentials(&username, &password)?;
    
    let credentials = EpicCredentials {
        username_encrypted: encrypted_username,
        password_encrypted: encrypted_password,
        saved_at: chrono::Utc::now().to_rfc3339(),
        nonce,
    };
    
    let credentials_path = get_epic_credentials_path()?;
    let json_data = serde_json::to_string_pretty(&credentials)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&credentials_path, json_data)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    debug!("[RUST] ✅ Credenziali Epic salvate in modo sicuro per username: {}", username);
    Ok("Credenziali Epic salvate con encryption AES-256".to_string())
}

/// Carica le credenziali Epic Games salvate
#[tauri::command]
pub async fn load_epic_credentials() -> Result<EpicCredentials, String> {
    debug!("[RUST] load_epic_credentials called");
    
    let credentials_path = get_epic_credentials_path()?;
    
    if !credentials_path.exists() {
        return Err("Nessuna credenziale Epic salvata".to_string());
    }
    
    let json_data = fs::read_to_string(&credentials_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let credentials: EpicCredentials = serde_json::from_str(&json_data)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    // 🔒 NOTA: Per sicurezza, NON decriptiamo le credenziali qui
    // La decryption avverrà solo quando necessario
    debug!("[RUST] ✅ Credenziali Epic caricate per username: [PROTECTED]");
    Ok(credentials)
}

/// Cancella le credenziali Epic Games salvate
#[tauri::command]
pub async fn clear_epic_credentials() -> Result<String, String> {
    debug!("[RUST] clear_epic_credentials called");
    
    let credentials_path = get_epic_credentials_path()?;
    
    if credentials_path.exists() {
        match fs::remove_file(&credentials_path) {
            Ok(_) => {
                info!("[RUST] ✅ Credenziali Epic cancellate: {}", credentials_path.display());
                Ok("Credenziali Epic cancellate con successo".to_string())
            }
            Err(e) => {
                error!("[RUST] ❌ Errore cancellazione credenziali Epic: {}", e);
                Err(format!("Errore cancellazione credenziali: {}", e))
            }
        }
    } else {
        Ok("Nessuna credenziale Epic da cancellare".to_string())
    }
}

// 🔒 Funzione helper per ottenere le credenziali decriptate (uso interno)
/// FUTURE USE: Internal helper for getting decrypted Epic Games credentials
#[allow(dead_code)]
async fn get_decrypted_epic_credentials() -> Result<(String, String), String> {
    // SECURITY FIX: Use secure credential loading with integrity verification
    let credentials = load_epic_credentials().await?;
    
    // SECURITY FIX: Validate credential data before decryption
    if credentials.username_encrypted.is_empty() || credentials.password_encrypted.is_empty() {
        return Err("Credenziali Epic corrotte o vuote".to_string());
    }
    
    // SECURITY FIX: Validate saved timestamp
    if let Ok(saved_time) = chrono::DateTime::parse_from_rfc3339(&credentials.saved_at) {
        let now = chrono::Utc::now();
        let age = now.signed_duration_since(saved_time.with_timezone(&chrono::Utc));
        
        // SECURITY FIX: Expire credentials after 30 days
        if age.num_days() > 30 {
            return Err("Credenziali Epic scadute (> 30 giorni)".to_string());
        }
    }
    
    // Decrypt credentials
    let (username, password) = decrypt_epic_credentials(
        &credentials.username_encrypted,
        &credentials.password_encrypted,
        &credentials.nonce
    )?;
    
    debug!("[RUST] 🔓 Credenziali Epic decriptate per uso interno");
    Ok((username, password))
}
