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
    let model_name = resolve_model(model, &installed);

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
    // Il modello richiesto dal frontend può NON essere installato: il
    // 03/08/2026 il default 'gemma4:e4b' cablato in 5 call-site TS ha prodotto
    // 25.936 errori 404 su Foolish Mortals — tutti dichiarati "tradotti" dal
    // vecchio contatore. Precisazione dell'08/08/2026: quel modello ESISTE
    // nella libreria Ollama, non era un nome inventato — il 404 diceva «non ce
    // l'hai in locale». Il difetto resta lo stesso (nominare un modello senza
    // sapere se l'utente ce l'ha) e questa guardia copre tutti i chiamanti:
    // modello non installato → selettore automatico, con avviso nel log.
    let model_name = resolve_model(model, &installed);

    if model_name.is_empty() {
        return Err("Nessun modello installato.".to_string());
    }

    let mut results = Vec::with_capacity(texts.len());

    // Prima passata: tutto il batch in UNA chiamata (righe numerate).
    // Prima era un round-trip HTTP per stringa: 26k stringhe = 26k chiamate
    // sequenziali, ore di attesa. Le stringhe multilinea (il \n romperebbe la
    // numerazione) e quelle che il modello sbaglia ricadono sul per-stringa.
    let mut prefill: Vec<Option<String>> = vec![None; texts.len()];
    let batchable: Vec<usize> = texts.iter().enumerate()
        .filter(|(_, t)| !t.contains('\n') && !t.trim().is_empty())
        .map(|(i, _)| i).collect();
    if batchable.len() > 1 {
        let numbered = batchable.iter().enumerate()
            .map(|(n, &i)| format!("{}. {}", n + 1, texts[i]))
            .collect::<Vec<_>>().join("\n");
        let prompt = format!(
            "Translate each numbered line from {} to {}. \
             Reply with the same numbering, one translated line per number. \
             Output ONLY the numbered translations, nothing else. \
             Keep any game control codes EXACTLY as they appear, in the same position — \
             do not translate, remove, reorder or alter them \
             (e.g. \\C[n] \\V[n] \\N[n] \\I[n] and other backslash codes, {{...}} tokens, %1..%9).\n\n{}",
            source_lang, target_lang, numbered
        );
        if let Ok(text) = call_ollama_raw(&prompt, &model_name, 6144).await {
            let parsed = parse_numbered_lines(&text, batchable.len());
            for (n, &i) in batchable.iter().enumerate() {
                if let Some(t) = parsed.get(n).and_then(|p| p.clone()) {
                    prefill[i] = Some(t);
                }
            }
        }
    }

    for (i, text) in texts.iter().enumerate() {
        let start = std::time::Instant::now();
        let outcome = match prefill[i].take() {
            Some(t) => Ok(t),
            None => call_ollama_translate(text, &source_lang, &target_lang, &model_name).await,
        };
        match outcome {
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

    // Contatore ONESTO: il vecchio log diceva "N testi tradotti" contando
    // anche i falliti — 40 errori 404 diventavano "40 tradotti".
    let ok_count = results.iter().filter(|r| !r.translated.starts_with("[ERRORE]")).count();
    let err_count = results.len() - ok_count;
    if err_count == 0 {
        log::info!("[OFFLINE] Batch completato: {} testi tradotti con {}", ok_count, model_name);
    } else {
        log::warn!("[OFFLINE] Batch: {} tradotti, {} FALLITI su {} (modello {})", ok_count, err_count, results.len(), model_name);
    }
    Ok(results)
}

/// Modello richiesto se installato, altrimenti il migliore tra gli installati.
/// Accetta sia il nome esatto ("gemma3:4b") sia il prefisso ("gemma3").
fn resolve_model(requested: Option<String>, installed: &[String]) -> String {
    if let Some(m) = requested {
        if installed.iter().any(|i| i == &m) {
            return m;
        }
        // Prefisso senza tag ("gemma3"): ritorna il nome INSTALLATO completo,
        // non il prefisso — Ollama risolverebbe "gemma3" in "gemma3:latest",
        // che può non esserci (il primo giro di questo test l'ha dimostrato).
        if let Some(hit) = installed.iter().find(|i| i.starts_with(&format!("{}:", m))) {
            return hit.clone();
        }
        let fallback = pick_best_translation_model(installed);
        log::warn!("[OFFLINE] Modello richiesto '{}' NON installato: uso '{}'", m, fallback);
        return fallback;
    }
    pick_best_translation_model(installed)
}

/// Estrae le traduzioni da una risposta a righe numerate ("1. ...", "2) ...").
/// Ritorna un vettore lungo `expected`; None dove la riga manca o non si parsa.
fn parse_numbered_lines(text: &str, expected: usize) -> Vec<Option<String>> {
    let mut out: Vec<Option<String>> = vec![None; expected];
    for line in text.lines() {
        let line = line.trim();
        let Some(dot) = line.find(['.', ')']) else { continue };
        let Ok(n) = line[..dot].trim().parse::<usize>() else { continue };
        if n >= 1 && n <= expected {
            let t = line[dot + 1..].trim();
            if !t.is_empty() {
                out[n - 1] = Some(t.to_string());
            }
        }
    }
    out
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
    // Priorità AGGIORNATE 03/08/2026: la lista vecchia (gemma3>qwen3>llama3)
    // non corrispondeva a NESSUNO dei modelli nuovi e ripiegava sul "primo
    // della lista" — su Foolish Mortals ha scelto un 8B generico invece dello
    // specialista di traduzione installato: ETA 13h invece di ~3h.
    // Ordine: specialisti di traduzione prima (HY-MT #1 WMT25, TranslateGemma),
    // poi i generici in ordine di generazione. `contains` e non `starts_with`
    // sul primo: il nome reale è huihui_ai/hy-mt1.5-abliterated:7b.
    let priorities: [(&str, fn(&str) -> bool); 7] = [
        ("hy-mt", |m| m.contains("hy-mt")),
        ("translategemma", |m| m.starts_with("translategemma")),
        ("gemma4", |m| m.starts_with("gemma4")),
        ("gemma3", |m| m.starts_with("gemma3")),
        ("qwen3", |m| m.starts_with("qwen3")),
        ("llama3", |m| m.starts_with("llama3")),
        // llava e simili (visione) NON sono da traduzione: mai preferirli.
        ("", |m| !m.starts_with("llava")),
    ];
    for (_, matches) in &priorities {
        if let Some(m) = installed.iter().find(|m| matches(m.as_str())) {
            return m.clone();
        }
    }
    installed.first().cloned().unwrap_or_default()
}

/// Chiamata Ollama con prompt libero (usata dal batch a righe numerate).
async fn call_ollama_raw(prompt: &str, model: &str, num_predict: u32) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Errore client HTTP: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": false,
        "options": { "temperature": 0.3, "top_p": 0.9, "num_predict": num_predict }
    });

    let url = format!("{}/api/generate", OLLAMA_API);
    let resp = client.post(&url).json(&body).send().await
        .map_err(|e| format!("Errore connessione Ollama: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama errore {}: {}", status, body_text));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| format!("Errore parsing risposta: {}", e))?;
    let response_text = json["response"].as_str().unwrap_or("").trim().to_string();
    if response_text.is_empty() {
        return Err("Ollama ha restituito una risposta vuota".to_string());
    }
    Ok(response_text)
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
         Do not add explanations, notes, or quotes. \
         Keep any game control codes EXACTLY as they appear, in the same position — \
         do not translate, remove, reorder or alter them \
         (e.g. \\C[n] \\V[n] \\N[n] \\I[n] and other backslash codes, {{...}} tokens, %1..%9).\n\n{}",
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

// ═══════════════════════════════════════════════════════════════════
// TRADUZIONE CON CONTESTO (glossario + voce personaggio)
// ═══════════════════════════════════════════════════════════════════

/// Coppia di glossario passata dal frontend (camelCase: doNotTranslate).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryPair {
    pub source: String,
    #[serde(default)]
    pub target: String,
    #[serde(default)]
    pub do_not_translate: bool,
}

/// Costruisce il prompt per Ollama iniettando glossario e contesto/voce del
/// personaggio. Funzione pura → unit-testabile senza Ollama.
pub fn build_context_prompt(
    text: &str,
    context: Option<&str>,
    glossary: &[GlossaryPair],
    source_lang: &str,
    target_lang: &str,
) -> String {
    let mut p = String::new();
    p.push_str(&format!(
        "You are a professional video game translator. Translate from {} to {}.\n",
        source_lang, target_lang
    ));

    if !glossary.is_empty() {
        p.push_str("Apply this glossary exactly and consistently:\n");
        for g in glossary {
            if g.do_not_translate {
                p.push_str(&format!("- \"{}\": keep unchanged (do NOT translate)\n", g.source));
            } else if !g.target.is_empty() {
                p.push_str(&format!("- \"{}\" => \"{}\"\n", g.source, g.target));
            }
        }
    }

    if let Some(c) = context {
        let c = c.trim();
        if !c.is_empty() {
            p.push_str(&format!(
                "This line is spoken by character \"{}\"; keep a consistent voice and register for this speaker.\n",
                c
            ));
        }
    }

    p.push_str(
        "Keep any game control codes EXACTLY as they appear, in the same position — do not translate, \
         remove, reorder or alter them (e.g. \\C[n] \\V[n] \\N[n] \\I[n] and other backslash codes, \
         {...} tokens, %1..%9).\n",
    );
    p.push_str("Output ONLY the translation of the text below — no notes, no quotes, no explanations.\n\n");
    p.push_str(text);
    p
}

/// Traduzione batch con contesto per-stringa (voce personaggio) e glossario
/// condiviso. `contexts` è parallelo a `texts` (None = nessun contesto).
#[command]
pub async fn offline_translate_batch_context(
    texts: Vec<String>,
    contexts: Vec<Option<String>>,
    glossary: Vec<GlossaryPair>,
    source_lang: String,
    target_lang: String,
    model: Option<String>,
) -> Result<Vec<OfflineTranslationResult>, String> {
    if !check_ollama_running().await {
        return Err("Ollama non è in esecuzione.".to_string());
    }

    let installed = get_installed_models().await;
    let model_name = resolve_model(model, &installed);
    if model_name.is_empty() {
        return Err("Nessun modello installato.".to_string());
    }

    let mut results = Vec::with_capacity(texts.len());
    for (i, text) in texts.iter().enumerate() {
        let ctx = contexts.get(i).and_then(|c| c.as_deref());
        let prompt = build_context_prompt(text, ctx, &glossary, &source_lang, &target_lang);
        let start = std::time::Instant::now();
        match call_ollama_with_prompt(&prompt, &model_name).await {
            Ok(translated) => results.push(OfflineTranslationResult {
                original: text.clone(),
                translated,
                model: model_name.clone(),
                duration_ms: start.elapsed().as_millis() as u64,
            }),
            Err(e) => {
                log::warn!(
                    "[OFFLINE-CTX] Errore '{}': {}",
                    &text.chars().take(30).collect::<String>(),
                    e
                );
                results.push(OfflineTranslationResult {
                    original: text.clone(),
                    translated: format!("[ERRORE] {}", e),
                    model: model_name.clone(),
                    duration_ms: start.elapsed().as_millis() as u64,
                });
            }
        }
    }

    log::info!("[OFFLINE-CTX] Batch completato: {} testi", results.len());
    Ok(results)
}

/// Invia un prompt già costruito a Ollama e ritorna la risposta.
async fn call_ollama_with_prompt(prompt: &str, model: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Errore client HTTP: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": false,
        "options": { "temperature": 0.3, "top_p": 0.9, "num_predict": 2048 }
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

    let response_text = json["response"].as_str().unwrap_or("").trim().to_string();
    if response_text.is_empty() {
        return Err("Ollama ha restituito una risposta vuota".to_string());
    }
    Ok(response_text)
}

#[cfg(test)]
mod batch_tests {
    use super::*;

    #[test]
    fn resolve_model_keeps_installed_exact() {
        let installed = vec!["gemma3:4b".to_string(), "qwen3:4b".to_string()];
        assert_eq!(resolve_model(Some("qwen3:4b".into()), &installed), "qwen3:4b");
    }

    #[test]
    fn resolve_model_accepts_prefix() {
        let installed = vec!["gemma3:4b".to_string()];
        assert_eq!(resolve_model(Some("gemma3".into()), &installed), "gemma3:4b");
    }

    #[test]
    fn resolve_model_falls_back_when_not_installed() {
        // Il caso del 03/08/2026: 'gemma4:e4b' richiesto, non installato su
        // quella macchina (il modello ESISTE nella libreria Ollama — il 404
        // parla del disco locale, non del registry: verificato l'08/08/2026).
        let installed = vec!["gemma3:4b".to_string(), "qwen3:4b".to_string()];
        assert_eq!(resolve_model(Some("gemma4:e4b".into()), &installed), "gemma3:4b");
    }

    #[test]
    fn resolve_model_empty_when_nothing_installed() {
        assert_eq!(resolve_model(Some("gemma4:e4b".into()), &[]), "");
        assert_eq!(resolve_model(None, &[]), "");
    }

    #[test]
    fn pick_best_prefers_translation_specialists() {
        // La libreria REALE di Davide al 03/08/2026: la priorità vecchia
        // (gemma3>qwen3>llama3) non matchava niente e prendeva il primo
        // della lista → ETA 13h. Deve vincere lo specialista HY-MT.
        let installed = vec![
            "gemma4:e4b".to_string(),
            "translategemma:12b".to_string(),
            "llava:latest".to_string(),
            "huihui_ai/hy-mt1.5-abliterated:7b".to_string(),
        ];
        assert_eq!(pick_best_translation_model(&installed), "huihui_ai/hy-mt1.5-abliterated:7b");
    }

    #[test]
    fn pick_best_never_prefers_vision_models() {
        // llava è un modello di VISIONE: va scelto solo se non c'è altro.
        let installed = vec!["llava:latest".to_string(), "gemma4:e4b".to_string()];
        assert_eq!(pick_best_translation_model(&installed), "gemma4:e4b");
        let only_llava = vec!["llava:latest".to_string()];
        assert_eq!(pick_best_translation_model(&only_llava), "llava:latest");
    }

    #[test]
    fn parse_numbered_lines_basic() {
        let out = parse_numbered_lines("1. Ciao\n2. Mondo", 2);
        assert_eq!(out[0].as_deref(), Some("Ciao"));
        assert_eq!(out[1].as_deref(), Some("Mondo"));
    }

    #[test]
    fn parse_numbered_lines_paren_and_holes() {
        // Numerazione con ')' e riga 2 mancante: il buco resta None (→ fallback).
        let out = parse_numbered_lines("1) Salve\n3) Tesoro", 3);
        assert_eq!(out[0].as_deref(), Some("Salve"));
        assert!(out[1].is_none());
        assert_eq!(out[2].as_deref(), Some("Tesoro"));
    }

    #[test]
    fn parse_numbered_lines_ignores_junk_and_out_of_range() {
        // Preamboli del modello, numeri fuori range e righe vuote non sfondano.
        let out = parse_numbered_lines("Here are the translations:\n0. no\n99. no\n1. Sì\n2.   ", 2);
        assert_eq!(out[0].as_deref(), Some("Sì"));
        assert!(out[1].is_none());
    }
}

#[cfg(test)]
mod context_tests {
    use super::*;

    #[test]
    fn test_build_context_prompt_glossary_and_speaker() {
        let gloss = vec![
            GlossaryPair { source: "Liyue".to_string(), target: String::new(), do_not_translate: true },
            GlossaryPair { source: "Sword".to_string(), target: "Spada".to_string(), do_not_translate: false },
        ];
        let p = build_context_prompt("Hello", Some("Eileen"), &gloss, "en", "it");
        assert!(p.contains("from en to it"));
        assert!(p.contains("\"Liyue\": keep unchanged"));
        assert!(p.contains("\"Sword\" => \"Spada\""));
        assert!(p.contains("character \"Eileen\""));
        assert!(p.trim_end().ends_with("Hello"));
    }

    #[test]
    fn test_build_context_prompt_no_glossary_no_speaker() {
        let p = build_context_prompt("Hi", None, &[], "en", "it");
        assert!(!p.contains("glossary"));
        assert!(!p.contains("spoken by"));
        assert!(p.trim_end().ends_with("Hi"));
    }

    #[test]
    fn test_build_context_prompt_skips_empty_speaker() {
        let p = build_context_prompt("Yo", Some("   "), &[], "en", "it");
        assert!(!p.contains("spoken by"));
    }
}
