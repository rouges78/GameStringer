use std::process::Command;
use std::path::PathBuf;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct OllamaStatus {
    pub installed: bool,
    pub running: bool,
    pub version: String,
    pub models: Vec<String>,
    pub install_path: String,
}

#[derive(Debug, Serialize)]
pub struct OllamaModelInfo {
    pub name: String,
    pub size: String,
    pub description: String,
}

/// Trova il path dell'eseguibile Ollama su Windows
fn find_ollama_path() -> Option<PathBuf> {
    // 1. Controlla PATH di sistema
    if let Ok(output) = Command::new("where").arg("ollama").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().lines().next().unwrap_or("").to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }
    
    // 2. Controlla path comuni su Windows
    let common_paths = [
        dirs::home_dir().map(|h| h.join("AppData\\Local\\Programs\\Ollama\\ollama.exe")),
        Some(PathBuf::from("C:\\Program Files\\Ollama\\ollama.exe")),
        Some(PathBuf::from("C:\\Program Files (x86)\\Ollama\\ollama.exe")),
        dirs::home_dir().map(|h| h.join("AppData\\Local\\Ollama\\ollama.exe")),
    ];
    
    for path_opt in &common_paths {
        if let Some(path) = path_opt {
            if path.exists() {
                return Some(path.clone());
            }
        }
    }
    
    None
}

/// Controlla se Ollama è in esecuzione (porta 11434)
fn is_ollama_running() -> bool {
    // Tenta una connessione TCP a localhost:11434
    std::net::TcpStream::connect_timeout(
        &"127.0.0.1:11434".parse().unwrap(),
        std::time::Duration::from_secs(2),
    ).is_ok()
}

/// Ottieni la versione di Ollama installata
fn get_ollama_version(ollama_path: &PathBuf) -> String {
    if let Ok(output) = Command::new(ollama_path).arg("--version").output() {
        if output.status.success() {
            return String::from_utf8_lossy(&output.stdout).trim().to_string();
        }
    }
    "unknown".to_string()
}

/// Ottieni lista modelli installati via API
async fn get_installed_models() -> Vec<String> {
    let client = reqwest::Client::new();
    match client.get("http://localhost:11434/api/tags")
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(resp) => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                if let Some(models) = data["models"].as_array() {
                    return models.iter()
                        .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                        .collect();
                }
            }
            vec![]
        }
        Err(_) => vec![],
    }
}

// ═══════════════════════════════════════════════════════════════════
// COMANDI TAURI
// ═══════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn check_ollama_status() -> Result<OllamaStatus, String> {
    let ollama_path = find_ollama_path();
    let installed = ollama_path.is_some();
    let running = is_ollama_running();
    
    let version = if let Some(ref path) = ollama_path {
        get_ollama_version(path)
    } else {
        String::new()
    };
    
    let install_path = ollama_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    
    let models = if running {
        get_installed_models().await
    } else {
        vec![]
    };
    
    println!("[OLLAMA] Status: installed={}, running={}, version={}, models={}", 
        installed, running, version, models.len());
    
    Ok(OllamaStatus {
        installed,
        running,
        version,
        models,
        install_path,
    })
}

#[tauri::command]
pub async fn download_ollama(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Emitter;
    
    let download_url = "https://ollama.com/download/OllamaSetup.exe";
    let download_dir = dirs::download_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let installer_path = download_dir.join("OllamaSetup.exe");
    
    println!("[OLLAMA] Downloading from {} to {:?}", download_url, installer_path);
    let _ = app.emit("ollama-download-progress", serde_json::json!({
        "stage": "downloading",
        "progress": 0,
        "message": "Download in corso..."
    }));
    
    let client = reqwest::Client::new();
    let response = client.get(download_url)
        .send()
        .await
        .map_err(|e| format!("Download fallito: {}", e))?;
    
    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    
    let mut file = std::fs::File::create(&installer_path)
        .map_err(|e| format!("Impossibile creare file: {}", e))?;
    
    use std::io::Write;
    let mut stream = response.bytes_stream();
    use futures::StreamExt;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Errore download: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Errore scrittura: {}", e))?;
        downloaded += chunk.len() as u64;
        
        if total_size > 0 {
            let progress = (downloaded as f64 / total_size as f64 * 100.0) as u32;
            let _ = app.emit("ollama-download-progress", serde_json::json!({
                "stage": "downloading",
                "progress": progress,
                "message": format!("Download: {}%  ({:.1} MB / {:.1} MB)", progress, downloaded as f64 / 1_048_576.0, total_size as f64 / 1_048_576.0)
            }));
        }
    }
    
    drop(file);
    
    println!("[OLLAMA] Download completato: {:?} ({} bytes)", installer_path, downloaded);
    let _ = app.emit("ollama-download-progress", serde_json::json!({
        "stage": "downloaded",
        "progress": 100,
        "message": "Download completato! Avvio installazione..."
    }));
    
    // Avvia l'installer
    let installer_str = installer_path.to_string_lossy().to_string();
    Command::new(&installer_str)
        .spawn()
        .map_err(|e| format!("Impossibile avviare installer: {}", e))?;
    
    let _ = app.emit("ollama-download-progress", serde_json::json!({
        "stage": "installing",
        "progress": 100,
        "message": "Installer avviato. Segui le istruzioni a schermo."
    }));
    
    Ok(installer_str)
}

#[tauri::command]
pub async fn start_ollama() -> Result<String, String> {
    // Controlla se già in esecuzione
    if is_ollama_running() {
        return Ok("Ollama è già in esecuzione".to_string());
    }
    
    let ollama_path = find_ollama_path()
        .ok_or_else(|| "Ollama non trovato. Installalo prima.".to_string())?;
    
    println!("[OLLAMA] Avvio {:?} serve", ollama_path);
    
    // Avvia ollama serve in background
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new(&ollama_path)
            .arg("serve")
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Impossibile avviare Ollama: {}", e))?;
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Command::new(&ollama_path)
            .arg("serve")
            .spawn()
            .map_err(|e| format!("Impossibile avviare Ollama: {}", e))?;
    }
    
    // Attendi che sia pronto (max 15 secondi)
    for i in 0..30 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if is_ollama_running() {
            println!("[OLLAMA] Avviato con successo dopo {}ms", (i + 1) * 500);
            return Ok("Ollama avviato con successo".to_string());
        }
    }
    
    Err("Ollama avviato ma non risponde sulla porta 11434".to_string())
}

#[tauri::command]
pub async fn stop_ollama() -> Result<String, String> {
    if !is_ollama_running() {
        return Ok("Ollama non è in esecuzione".to_string());
    }
    
    println!("[OLLAMA] Arresto in corso...");
    
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "ollama.exe"])
            .output();
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "ollama_llama_server.exe"])
            .output();
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("pkill").arg("ollama").output();
    }
    
    // Attendi arresto
    for _ in 0..10 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if !is_ollama_running() {
            println!("[OLLAMA] Arrestato con successo");
            return Ok("Ollama arrestato".to_string());
        }
    }
    
    Err("Impossibile arrestare Ollama".to_string())
}

#[tauri::command]
pub async fn pull_ollama_model(app: tauri::AppHandle, model_name: String) -> Result<String, String> {
    use tauri::Emitter;
    
    if !is_ollama_running() {
        return Err("Ollama non è in esecuzione. Avvialo prima.".to_string());
    }
    
    println!("[OLLAMA] Pull modello: {}", model_name);
    let _ = app.emit("ollama-pull-progress", serde_json::json!({
        "model": model_name,
        "status": "pulling",
        "progress": 0,
        "message": format!("Download modello {}...", model_name)
    }));
    
    let client = reqwest::Client::new();
    let response = client.post("http://localhost:11434/api/pull")
        .json(&serde_json::json!({ "name": model_name, "stream": true }))
        .send()
        .await
        .map_err(|e| format!("Errore pull: {}", e))?;
    
    let mut stream = response.bytes_stream();
    use futures::StreamExt;
    let mut last_status = String::new();
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Errore stream: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        
        for line in text.lines() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                let status = json["status"].as_str().unwrap_or("").to_string();
                let total = json["total"].as_u64().unwrap_or(0);
                let completed = json["completed"].as_u64().unwrap_or(0);
                
                let progress = if total > 0 {
                    (completed as f64 / total as f64 * 100.0) as u32
                } else {
                    0
                };
                
                if status != last_status || progress % 5 == 0 {
                    let msg = if total > 0 {
                        format!("{}: {}% ({:.1} MB / {:.1} MB)", 
                            status, progress, completed as f64 / 1_048_576.0, total as f64 / 1_048_576.0)
                    } else {
                        status.clone()
                    };
                    
                    let _ = app.emit("ollama-pull-progress", serde_json::json!({
                        "model": model_name,
                        "status": status,
                        "progress": progress,
                        "message": msg
                    }));
                    last_status = status;
                }
            }
        }
    }
    
    let _ = app.emit("ollama-pull-progress", serde_json::json!({
        "model": model_name,
        "status": "success",
        "progress": 100,
        "message": format!("Modello {} installato!", model_name)
    }));
    
    println!("[OLLAMA] Modello {} installato", model_name);
    Ok(format!("Modello {} installato con successo", model_name))
}

#[tauri::command]
pub async fn get_recommended_ollama_models() -> Result<Vec<OllamaModelInfo>, String> {
    Ok(vec![
        OllamaModelInfo {
            name: "translategemma:2b".to_string(),
            size: "~1.5 GB".to_string(),
            description: "Google TranslateGemma - Specializzato per traduzione, veloce e preciso".to_string(),
        },
        OllamaModelInfo {
            name: "qwen3:4b".to_string(),
            size: "~2.5 GB".to_string(),
            description: "Alibaba Qwen 3 4B - Ottimo per lingue asiatiche e europee".to_string(),
        },
        OllamaModelInfo {
            name: "qwen3:8b".to_string(),
            size: "~4.9 GB".to_string(),
            description: "Alibaba Qwen 3 8B - Qualità superiore, richiede più VRAM".to_string(),
        },
        OllamaModelInfo {
            name: "gemma3:4b".to_string(),
            size: "~3.0 GB".to_string(),
            description: "Google Gemma 3 4B - Buon bilanciamento qualità/velocità".to_string(),
        },
    ])
}
