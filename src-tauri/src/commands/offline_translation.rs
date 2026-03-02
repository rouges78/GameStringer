use tauri::command;
use serde::{Deserialize, Serialize};

const OLLAMA_API: &str = "http://localhost:11434";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OfflineTranslationResult {
    pub original: String,
    pub translated: String,
    pub model: String,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct OfflineModelInfo {
    pub name: String,
    pub size_gb: f64,
    pub installed: bool,
    pub recommended: bool,
    pub description: String,
}

#[derive(Debug, Serialize)]
pub struct OfflineStatus {
    pub ollama_running: bool,
    pub available_models: Vec<String>,
    pub recommended_model: String,
}

/// Controlla se Ollama è attivo e quali modelli sono disponibili
#[command]
pub async fn offline_translation_status() -> Result<OfflineStatus, String> {
    let running = check_ollama_running().await;
    let models = if running {
        get_installed_models().await
    } else {
        vec![]
    };

    // Scegli il modello migliore per traduzione tra quelli installati
    let recommended = pick_best_translation_model(&models);

    Ok(OfflineStatus {
        ollama_running: running,
        available_models: models,
        recommended_model: recommended,
    })
}

/// Ottieni lista modelli consigliati per traduzione con stato installazione
#[command]
pub async fn offline_translation_models() -> Result<Vec<OfflineModelInfo>, String> {
    let installed = get_installed_models().await;

    let recommended = vec![
        OfflineModelInfo {
            name: "gemma3:4b".to_string(),
            size_gb: 3.3,
            installed: installed.iter().any(|m| m.starts_with("gemma3:4b") || m == "gemma3"),
            recommended: true,
            description: "Google Gemma 3 4B — Ottimo per traduzioni, veloce e preciso".to_string(),
        },
        OfflineModelInfo {
            name: "qwen3:4b".to_string(),
            size_gb: 2.6,
            installed: installed.iter().any(|m| m.starts_with("qwen3:4b") || m.starts_with("qwen3")),
            recommended: true,
            description: "Alibaba Qwen 3 4B — Eccellente multilingue, leggero".to_string(),
        },
        OfflineModelInfo {
            name: "llama3.2:3b".to_string(),
            size_gb: 2.0,
            installed: installed.iter().any(|m| m.starts_with("llama3.2:3b")),
            recommended: false,
            description: "Meta Llama 3.2 3B — Buono per PC con poca VRAM".to_string(),
        },
        OfflineModelInfo {
            name: "gemma3:12b".to_string(),
            size_gb: 8.1,
            installed: installed.iter().any(|m| m.starts_with("gemma3:12b")),
            recommended: false,
            description: "Google Gemma 3 12B — Qualità superiore, richiede 12GB+ VRAM".to_string(),
        },
        OfflineModelInfo {
            name: "qwen3:8b".to_string(),
            size_gb: 5.2,
            installed: installed.iter().any(|m| m.starts_with("qwen3:8b")),
            recommended: false,
            description: "Alibaba Qwen 3 8B — Qualità alta, richiede 8GB+ VRAM".to_string(),
        },
    ];

    Ok(recommended)
}

/// Traduci un singolo testo offline usando Ollama
#[command]
pub async fn offline_translate_text(
    text: String,
    source_lang: String,
    target_lang: String,
    model: Option<String>,
) -> Result<OfflineTranslationResult, String> {
    if !check_ollama_running().await {
        return Err("Ollama non è in esecuzione. Avvialo dalla sezione Setup.".to_string());
    }

    let installed = get_installed_models().await;
    let model_name = model.unwrap_or_else(|| pick_best_translation_model(&installed));

    if model_name.is_empty() {
        return Err("Nessun modello installato. Scarica un modello dalla sezione Setup.".to_string());
    }

    let start = std::time::Instant::now();
    let translated = call_ollama_translate(&text, &source_lang, &target_lang, &model_name).await?;
    let duration_ms = start.elapsed().as_millis() as u64;

    log::info!(
        "[OFFLINE] Tradotto '{}' ({} → {}) in {}ms con {}",
        &text.chars().take(50).collect::<String>(),
        source_lang,
        target_lang,
        duration_ms,
        model_name
    );

    Ok(OfflineTranslationResult {
        original: text,
        translated,
        model: model_name,
        duration_ms,
    })
}

/// Traduci un batch di testi offline
#[command]
pub async fn offline_translate_batch(
    texts: Vec<String>,
    source_lang: String,
    target_lang: String,
    model: Option<String>,
) -> Result<Vec<OfflineTranslationResult>, String> {
    if !check_ollama_running().await {
        return Err("Ollama non è in esecuzione.".to_string());
    }

    let installed = get_installed_models().await;
    let model_name = model.unwrap_or_else(|| pick_best_translation_model(&installed));

    if model_name.is_empty() {
        return Err("Nessun modello installato.".to_string());
    }

    let mut results = Vec::with_capacity(texts.len());

    for text in &texts {
        let start = std::time::Instant::now();
        match call_ollama_translate(text, &source_lang, &target_lang, &model_name).await {
            Ok(translated) => {
                results.push(OfflineTranslationResult {
                    original: text.clone(),
                    translated,
                    model: model_name.clone(),
                    duration_ms: start.elapsed().as_millis() as u64,
                });
            }
            Err(e) => {
                log::warn!("[OFFLINE] Errore traduzione '{}': {}", &text.chars().take(30).collect::<String>(), e);
                results.push(OfflineTranslationResult {
                    original: text.clone(),
                    translated: format!("[ERRORE] {}", e),
                    model: model_name.clone(),
                    duration_ms: start.elapsed().as_millis() as u64,
                });
            }
        }
    }

    log::info!("[OFFLINE] Batch completato: {} testi tradotti", results.len());
    Ok(results)
}

// ═══════════════════════════════════════════════════════════════════
// FUNZIONI INTERNE
// ═══════════════════════════════════════════════════════════════════

async fn check_ollama_running() -> bool {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .unwrap_or_default();

    client.get(OLLAMA_API).send().await.is_ok()
}

async fn get_installed_models() -> Vec<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap_or_default();

    let url = format!("{}/api/tags", OLLAMA_API);
    match client.get(&url).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(models) = json["models"].as_array() {
                    return models
                        .iter()
                        .filter_map(|m| m["name"].as_str().map(String::from))
                        .collect();
                }
            }
            vec![]
        }
        Err(_) => vec![],
    }
}

fn pick_best_translation_model(installed: &[String]) -> String {
    // Priorità: gemma3 > qwen3 > llama3 > qualsiasi altro
    let priorities = ["gemma3", "qwen3", "llama3"];
    for prefix in &priorities {
        if let Some(m) = installed.iter().find(|m| m.starts_with(prefix)) {
            return m.clone();
        }
    }
    // Fallback: primo modello disponibile
    installed.first().cloned().unwrap_or_default()
}

async fn call_ollama_translate(
    text: &str,
    source_lang: &str,
    target_lang: &str,
    model: &str,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Errore client HTTP: {}", e))?;

    let prompt = format!(
        "Translate the following text from {} to {}. \
         Output ONLY the translation, nothing else. \
         Do not add explanations, notes, or quotes.\n\n{}",
        source_lang, target_lang, text
    );

    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": false,
        "options": {
            "temperature": 0.3,
            "top_p": 0.9,
            "num_predict": 2048,
        }
    });

    let url = format!("{}/api/generate", OLLAMA_API);
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Errore connessione Ollama: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama errore {}: {}", status, body_text));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Errore parsing risposta: {}", e))?;

    let response_text = json["response"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    if response_text.is_empty() {
        return Err("Ollama ha restituito una risposta vuota".to_string());
    }

    Ok(response_text)
}
