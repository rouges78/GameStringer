use std::path::PathBuf;
use serde::Serialize;
use super::process_util::no_window_command;
use super::ollama_endpoint::{ollama_base_url, ollama_host_port};

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

/// Trova il path dell'eseguibile Ollama.
///
/// NB: trovare l'eseguibile NON è più condizione necessaria per usare Ollama —
/// vedi `check_ollama_status`. Serve solo per avviarlo/fermarlo dall'app e per
/// mostrarne la versione. Un Ollama in Docker, WSL o su un'altra macchina non
/// ha un eseguibile locale ma è perfettamente utilizzabile.
fn find_ollama_path() -> Option<PathBuf> {
    // 1. Controlla PATH di sistema (`where` su Windows, `which` altrove:
    //    prima era solo `where`, quindi su Linux/macOS falliva sempre)
    let lookup = if cfg!(windows) { "where" } else { "which" };
    if let Ok(output) = no_window_command(lookup).arg("ollama").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().lines().next().unwrap_or("").to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }
    
    // 2. Controlla path comuni su Windows
    let common_paths = if cfg!(windows) {
        vec![
            dirs::home_dir().map(|h| h.join("AppData\\Local\\Programs\\Ollama\\ollama.exe")),
            Some(PathBuf::from("C:\\Program Files\\Ollama\\ollama.exe")),
            Some(PathBuf::from("C:\\Program Files (x86)\\Ollama\\ollama.exe")),
            dirs::home_dir().map(|h| h.join("AppData\\Local\\Ollama\\ollama.exe")),
        ]
    } else {
        // macOS e Linux: prima erano assenti del tutto
        vec![
            Some(PathBuf::from("/usr/local/bin/ollama")),
            Some(PathBuf::from("/usr/bin/ollama")),
            Some(PathBuf::from("/opt/homebrew/bin/ollama")),
            Some(PathBuf::from("/Applications/Ollama.app/Contents/Resources/ollama")),
            dirs::home_dir().map(|h| h.join(".local/bin/ollama")),
        ]
    };
    
    for path_opt in &common_paths {
        if let Some(path) = path_opt {
            if path.exists() {
                return Some(path.clone());
            }
        }
    }
    
    None
}

/// Controlla se Ollama risponde sull'endpoint configurato.
/// Risolve host/porta via `ollama_base_url` (override utente → OLLAMA_HOST →
/// 127.0.0.1:11434), invece di dare per scontata la porta di default.
fn is_ollama_running(base_url: &str) -> bool {
    use std::net::ToSocketAddrs;
    let (host, port) = ollama_host_port(base_url);
    match (host.as_str(), port).to_socket_addrs() {
        Ok(addrs) => addrs.into_iter().any(|a| {
            std::net::TcpStream::connect_timeout(&a, std::time::Duration::from_secs(2)).is_ok()
        }),
        Err(_) => false,
    }
}

/// Ottieni la versione di Ollama installata
fn get_ollama_version(ollama_path: &PathBuf) -> String {
    if let Ok(output) = no_window_command(ollama_path).arg("--version").output() {
        if output.status.success() {
            return String::from_utf8_lossy(&output.stdout).trim().to_string();
        }
    }
    "unknown".to_string()
}

/// Ottieni lista modelli installati via API
async fn get_installed_models(base_url: &str) -> Vec<String> {
    let client = reqwest::Client::new();
    match client.get(format!("{}/api/tags", base_url))
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

/// Stato di Ollama.
///
/// `base_url` è l'eventuale indirizzo scelto dall'utente. Prima non esisteva:
/// l'indirizzo era cablato, quindi chi eseguiva Ollama su un'altra porta, in
/// WSL, in Docker o su un'altra macchina non aveva modo di dirlo all'app.
///
/// Cambio importante: `installed` NON dipende più solo dal trovare
/// l'eseguibile. Se l'API risponde, Ollama è utilizzabile — punto. Prima un
/// Ollama perfettamente funzionante ma installato in un percorso non previsto
/// (o in un container) risultava "non installato" e la UI non provava nemmeno
/// a contattarlo: è la causa della segnalazione «dai log non prova nemmeno a
/// connettersi».
#[tauri::command]
pub async fn check_ollama_status(base_url: Option<String>) -> Result<OllamaStatus, String> {
    // Questo comando è il posto giusto per ricordare l'indirizzo: lo riceve dal
    // frontend ed è già chiamato al boot (main-layout.tsx) e a ogni apertura
    // delle Impostazioni. La spia del tray, che gira in background e non ha modo
    // di leggere il localStorage, legge di qui — vedi `remember_user_override`.
    super::ollama_endpoint::remember_user_override(base_url.as_deref());

    let endpoint = ollama_base_url(base_url.as_deref());
    let ollama_path = find_ollama_path();
    let running = is_ollama_running(&endpoint);

    let models = if running {
        get_installed_models(&endpoint).await
    } else {
        vec![]
    };

    // Utilizzabile se l'eseguibile c'è OPPURE se il server risponde.
    let installed = ollama_path.is_some() || running;

    let version = if let Some(ref path) = ollama_path {
        get_ollama_version(path)
    } else {
        String::new()
    };

    let install_path = ollama_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    println!("[OLLAMA] Status: endpoint={}, installed={}, running={}, version={}, models={}",
        endpoint, installed, running, version, models.len());

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
    
    // Avvia l'installer (questo è un GUI, non serve no_window)
    let installer_str = installer_path.to_string_lossy().to_string();
    std::process::Command::new(&installer_str)
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
pub async fn start_ollama(base_url: Option<String>) -> Result<String, String> {
    let endpoint = ollama_base_url(base_url.as_deref());
    // Controlla se già in esecuzione
    if is_ollama_running(&endpoint) {
        return Ok("Ollama è già in esecuzione".to_string());
    }
    
    let ollama_path = find_ollama_path()
        .ok_or_else(|| "Ollama non trovato. Installalo prima.".to_string())?;
    
    println!("[OLLAMA] Avvio {:?} serve", ollama_path);
    
    // Avvia ollama serve in background (usa no_window_command che ha già CREATE_NO_WINDOW)
    no_window_command(&ollama_path)
        .arg("serve")
        .spawn()
        .map_err(|e| format!("Impossibile avviare Ollama: {}", e))?;
    
    // Attendi che sia pronto (max 15 secondi)
    for i in 0..30 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if is_ollama_running(&endpoint) {
            println!("[OLLAMA] Avviato con successo dopo {}ms", (i + 1) * 500);
            return Ok("Ollama avviato con successo".to_string());
        }
    }
    
    // Il messaggio nomina l'indirizzo REALMENTE contattato. Prima diceva sempre
    // «porta 11434» anche a chi aveva Ollama altrove: mandava a cercare il guasto
    // dalla parte sbagliata, che è peggio di un messaggio generico.
    Err(format!("Ollama avviato ma non risponde su {}", endpoint))
}

#[tauri::command]
pub async fn stop_ollama(base_url: Option<String>) -> Result<String, String> {
    let endpoint = ollama_base_url(base_url.as_deref());
    if !is_ollama_running(&endpoint) {
        return Ok("Ollama non è in esecuzione".to_string());
    }
    
    println!("[OLLAMA] Arresto in corso...");
    
    #[cfg(target_os = "windows")]
    {
        let _ = no_window_command("taskkill")
            .args(["/F", "/IM", "ollama.exe"])
            .output();
        let _ = no_window_command("taskkill")
            .args(["/F", "/IM", "ollama_llama_server.exe"])
            .output();
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let _ = no_window_command("pkill").arg("ollama").output();
    }
    
    // Attendi arresto
    for _ in 0..10 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if !is_ollama_running(&endpoint) {
            println!("[OLLAMA] Arrestato con successo");
            return Ok("Ollama arrestato".to_string());
        }
    }
    
    Err("Impossibile arrestare Ollama".to_string())
}

#[tauri::command]
pub async fn pull_ollama_model(app: tauri::AppHandle, model_name: String, base_url: Option<String>) -> Result<String, String> {
    let endpoint = ollama_base_url(base_url.as_deref());
    use tauri::Emitter;
    
    if !is_ollama_running(&endpoint) {
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
    let response = client.post(format!("{}/api/pull", endpoint))
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
        // ─── TRADUZIONE SPECIALIZZATA ───
        OllamaModelInfo {
            name: "huihui_ai/hy-mt1.5-abliterated:7b".to_string(),
            size: "~4.5 GB".to_string(),
            description: "⭐ Tencent HY-MT 1.5 7B — #1 WMT25, batte Google Translate in 30/31 lingue. Senza censura.".to_string(),
        },
        OllamaModelInfo {
            name: "huihui_ai/hy-mt1.5-abliterated:1.8b".to_string(),
            size: "~1.2 GB".to_string(),
            description: "Tencent HY-MT 1.5 1.8B — Versione ultra-leggera e velocissima. Ideale per batch massicci.".to_string(),
        },
        OllamaModelInfo {
            name: "translategemma:12b".to_string(),
            size: "~8.0 GB".to_string(),
            description: "Google TranslateGemma 12B — 55 lingue, qualità alta, richiede 10+ GB VRAM.".to_string(),
        },
        OllamaModelInfo {
            name: "translategemma:2b".to_string(),
            size: "~1.5 GB".to_string(),
            description: "Google TranslateGemma 2B — 55 lingue, veloce e leggero.".to_string(),
        },
        // ─── MoE ULTRA-VELOCI (Marzo 2026) ───
        OllamaModelInfo {
            name: "qwen3.5:35b-a3b".to_string(),
            size: "~4.5 GB".to_string(),
            description: "🚀 Qwen 3.5 35B-A3B (MoE) — 35B parametri, attiva solo 3B. Velocità di un 3B, qualità di un 35B!".to_string(),
        },
        OllamaModelInfo {
            name: "lfm2:24b".to_string(),
            size: "~3.5 GB".to_string(),
            description: "🚀 LFM2 24B-A2B (MoE) — Liquid AI, attiva solo 2B. Velocissimo su 8GB RAM!".to_string(),
        },
        // ─── GEMMA 4 (Aprile 2026) ───
        OllamaModelInfo {
            name: "gemma4:27b".to_string(),
            size: "~16 GB".to_string(),
            description: "🆕 Google Gemma 4 27B MoE (A4B) — 27B totali, attiva solo 4B. Qualità da 27B, velocità da 4B! 256K context, 35+ lingue.".to_string(),
        },
        OllamaModelInfo {
            name: "gemma4:e4b".to_string(),
            size: "~3 GB".to_string(),
            description: "🆕 Google Gemma 4 E4B — Edge-optimized, 128K context, multimodale. Gira su GPU consumer.".to_string(),
        },
        OllamaModelInfo {
            name: "gemma4:e2b".to_string(),
            size: "~1.5 GB".to_string(),
            description: "🆕 Google Gemma 4 E2B — Ultra-leggero, ASR + traduzione audio. Gira anche su Raspberry Pi.".to_string(),
        },
        // ─── MULTILINGUE GENERAL PURPOSE ───
        OllamaModelInfo {
            name: "glm4:8b".to_string(),
            size: "~5.0 GB".to_string(),
            description: "🆕 GLM-4.7 Flash 8B — Zhipu AI, tuttofare veloce, molto lodato dalla community.".to_string(),
        },
        OllamaModelInfo {
            name: "qwen3:8b".to_string(),
            size: "~5.2 GB".to_string(),
            description: "Alibaba Qwen3 8B — Top multilingue, ragionamento avanzato, eccellente su CJK e europee.".to_string(),
        },
        OllamaModelInfo {
            name: "qwen3:4b".to_string(),
            size: "~2.6 GB".to_string(),
            description: "Alibaba Qwen3 4B — Compatto, ottimo rapporto qualità/velocità per traduzione.".to_string(),
        },
        OllamaModelInfo {
            name: "gemma3:12b".to_string(),
            size: "~8.1 GB".to_string(),
            description: "Google Gemma 3 12B — Prosa pulita, 128K context, multilingue.".to_string(),
        },
        OllamaModelInfo {
            name: "gemma3:4b".to_string(),
            size: "~2.8 GB".to_string(),
            description: "Google Gemma 3 4B — Versione leggera, gira su 8GB RAM.".to_string(),
        },
        // ─── REASONING / ANALISI ───
        OllamaModelInfo {
            name: "deepseek-r1:14b".to_string(),
            size: "~9.0 GB".to_string(),
            description: "DeepSeek R1 14B — Chain-of-thought esplicito, ragionamento complesso.".to_string(),
        },
        OllamaModelInfo {
            name: "deepseek-r1:7b".to_string(),
            size: "~4.7 GB".to_string(),
            description: "DeepSeek R1 7B — Chain-of-thought leggero, gira su 8GB.".to_string(),
        },
        OllamaModelInfo {
            name: "phi4:14b".to_string(),
            size: "~8.5 GB".to_string(),
            description: "Microsoft Phi-4 14B — Miglior ragionamento per GB (MATH: 80.4%).".to_string(),
        },
        OllamaModelInfo {
            name: "phi4-mini".to_string(),
            size: "~2.4 GB".to_string(),
            description: "Microsoft Phi-4 Mini 3.8B — Ultra-leggero, buono con poca VRAM.".to_string(),
        },
        // ─── MODELLI GRANDI (16GB+ VRAM) ───
        OllamaModelInfo {
            name: "llama3.3:8b".to_string(),
            size: "~5.0 GB".to_string(),
            description: "Meta Llama 3.3 8B — Miglior all-rounder classe 8B, ecosistema vasto.".to_string(),
        },
        OllamaModelInfo {
            name: "mistral-small3.1:24b".to_string(),
            size: "~14 GB".to_string(),
            description: "Mistral Small 3.1 24B — Il più veloce (~50 tok/s), ottimo per lingue europee.".to_string(),
        },
        OllamaModelInfo {
            name: "deepseek-r1:32b".to_string(),
            size: "~19 GB".to_string(),
            description: "DeepSeek R1 32B — Ragionamento top, chain-of-thought. Richiede 24GB+ VRAM.".to_string(),
        },
        OllamaModelInfo {
            name: "llama3.3:70b".to_string(),
            size: "~40 GB".to_string(),
            description: "Meta Llama 3.3 70B — General-purpose top. Richiede 48GB+ VRAM.".to_string(),
        },
    ])
}

#[derive(Debug, Serialize)]
pub struct OllamaHttpResponse {
    pub status: u16,
    pub ok: bool,
    pub body: String,
}

/// Proxy HTTP generico verso Ollama, eseguito lato Rust sull'endpoint risolto
/// con reqwest per aggirare il CORS del webview Tauri (origine `tauri://localhost` /
/// `http://tauri.localhost` non ammessa dagli `OLLAMA_ORIGINS` di default).
/// Supporta chiamate NON-streaming: GET/DELETE e POST con body JSON (`stream:false`).
#[tauri::command]
pub async fn ollama_http(
    method: String,
    path: String,
    body: Option<String>,
    timeout_ms: Option<u64>,
    base_url: Option<String>,
) -> Result<OllamaHttpResponse, String> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", ollama_base_url(base_url.as_deref()), path);
    let timeout = std::time::Duration::from_millis(timeout_ms.unwrap_or(180_000));

    let builder = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "DELETE" => client.delete(&url),
        "POST" => {
            let b = client.post(&url).header("Content-Type", "application/json");
            match body {
                Some(payload) => b.body(payload),
                None => b,
            }
        }
        other => return Err(format!("Metodo HTTP non supportato: {}", other)),
    };

    let resp = builder
        .timeout(timeout)
        .send()
        .await
        .map_err(|e| format!("Ollama non raggiungibile: {}", e))?;

    let status = resp.status().as_u16();
    let ok = resp.status().is_success();
    let body = resp.text().await.map_err(|e| e.to_string())?;

    Ok(OllamaHttpResponse { status, ok, body })
}
