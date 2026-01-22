use serde::{Deserialize, Serialize};

/// Informazioni su un aggiornamento disponibile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_notes: Option<String>,
    pub download_url: Option<String>,
    pub published_at: Option<String>,
}

/// Controlla se sono disponibili aggiornamenti
/// Confronta la versione corrente con l'ultima release su GitHub
#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    
    // URL API GitHub per le release
    let github_api_url = "https://api.github.com/repos/rouges78/GameStringer/releases/latest";
    
    let client = reqwest::Client::builder()
        .user_agent("GameStringer-UpdateChecker")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Errore creazione client HTTP: {}", e))?;
    
    let response = client
        .get(github_api_url)
        .send()
        .await
        .map_err(|e| format!("Errore connessione GitHub: {}", e))?;
    
    if !response.status().is_success() {
        // Se non c'è una release o errore API, ritorna nessun aggiornamento
        return Ok(UpdateInfo {
            current_version: current_version.clone(),
            latest_version: current_version,
            update_available: false,
            release_notes: None,
            download_url: None,
            published_at: None,
        });
    }
    
    let release: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Errore parsing risposta GitHub: {}", e))?;
    
    let latest_version = release["tag_name"]
        .as_str()
        .unwrap_or(&current_version)
        .trim_start_matches('v')
        .to_string();
    
    let release_notes = release["body"].as_str().map(|s| s.to_string());
    let download_url = release["html_url"].as_str().map(|s| s.to_string());
    let published_at = release["published_at"].as_str().map(|s| s.to_string());
    
    // Confronta versioni (semplice confronto stringhe semantico)
    let update_available = is_newer_version(&latest_version, &current_version);
    
    Ok(UpdateInfo {
        current_version,
        latest_version,
        update_available,
        release_notes,
        download_url,
        published_at,
    })
}

/// Confronta due versioni semantiche (es. "3.3.2" vs "3.3.1")
fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse_version = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|p| p.parse::<u32>().ok())
            .collect()
    };
    
    let latest_parts = parse_version(latest);
    let current_parts = parse_version(current);
    
    for i in 0..3 {
        let latest_num = latest_parts.get(i).copied().unwrap_or(0);
        let current_num = current_parts.get(i).copied().unwrap_or(0);
        
        if latest_num > current_num {
            return true;
        } else if latest_num < current_num {
            return false;
        }
    }
    
    false
}

/// Ottiene la versione corrente dell'app
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
