//! API di Traduzione Esterne
//! 
//! Integrazione con DeepL, Google Translate e altri servizi

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Risultato traduzione
#[derive(Debug, Serialize, Deserialize)]
pub struct TranslationResult {
    pub original: String,
    pub translated: String,
    pub source_lang: String,
    pub target_lang: String,
    pub provider: String,
    pub confidence: Option<f64>,
}

/// Risultato batch traduzione
#[derive(Debug, Serialize)]
pub struct BatchTranslationResult {
    pub translations: Vec<TranslationResult>,
    pub provider: String,
    pub total: usize,
    pub successful: usize,
    pub failed: usize,
    pub elapsed_ms: u64,
}

// ============================================================================
// DEEPL API
// ============================================================================

/// Traduce testo usando DeepL API
#[tauri::command]
pub async fn translate_deepl(
    text: String,
    target_lang: String,
    source_lang: Option<String>,
    api_key: String,
    formality: Option<String>,
) -> Result<TranslationResult, String> {
    log::info!("🔵 DeepL: Traduzione verso {}", target_lang);
    
    let client = reqwest::Client::new();
    
    // DeepL usa codici lingua maiuscoli (IT, EN, DE, etc.)
    let target = target_lang.to_uppercase();
    let source = source_lang.map(|s| s.to_uppercase());
    
    // Determina endpoint (free vs pro)
    let base_url = if api_key.ends_with(":fx") {
        "https://api-free.deepl.com/v2/translate"
    } else {
        "https://api.deepl.com/v2/translate"
    };
    
    let mut params: HashMap<&str, String> = HashMap::new();
    params.insert("text", text.clone());
    params.insert("target_lang", target.clone());
    
    if let Some(ref src) = source {
        params.insert("source_lang", src.clone());
    }
    
    if let Some(ref form) = formality {
        // "default", "more", "less", "prefer_more", "prefer_less"
        params.insert("formality", form.clone());
    }
    
    let response = client
        .post(base_url)
        .header("Authorization", format!("DeepL-Auth-Key {}", api_key))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Errore richiesta DeepL: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("DeepL errore {}: {}", status, error_text));
    }
    
    #[derive(Deserialize)]
    struct DeepLResponse {
        translations: Vec<DeepLTranslation>,
    }
    
    #[derive(Deserialize)]
    struct DeepLTranslation {
        text: String,
        detected_source_language: Option<String>,
    }
    
    let deepl_response: DeepLResponse = response
        .json()
        .await
        .map_err(|e| format!("Errore parsing risposta DeepL: {}", e))?;
    
    let translation = deepl_response.translations
        .into_iter()
        .next()
        .ok_or("Nessuna traduzione ricevuta da DeepL")?;
    
    let detected_source = translation.detected_source_language
        .unwrap_or_else(|| source.unwrap_or_else(|| "auto".to_string()));
    
    log::info!("✅ DeepL: Tradotto {} -> {}", detected_source, target);
    
    Ok(TranslationResult {
        original: text,
        translated: translation.text,
        source_lang: detected_source.to_lowercase(),
        target_lang: target.to_lowercase(),
        provider: "deepl".to_string(),
        confidence: Some(1.0), // DeepL non fornisce confidence score
    })
}

/// Traduce batch di testi usando DeepL
#[tauri::command]
pub async fn translate_deepl_batch(
    texts: Vec<String>,
    target_lang: String,
    source_lang: Option<String>,
    api_key: String,
) -> Result<BatchTranslationResult, String> {
    log::info!("🔵 DeepL Batch: {} testi verso {}", texts.len(), target_lang);
    
    let start = std::time::Instant::now();
    let client = reqwest::Client::new();
    
    let target = target_lang.to_uppercase();
    let source = source_lang.map(|s| s.to_uppercase());
    
    let base_url = if api_key.ends_with(":fx") {
        "https://api-free.deepl.com/v2/translate"
    } else {
        "https://api.deepl.com/v2/translate"
    };
    
    // DeepL supporta fino a 50 testi per richiesta
    let mut all_translations = Vec::new();
    let mut failed = 0;
    
    for chunk in texts.chunks(50) {
        let mut params: Vec<(&str, String)> = Vec::new();
        
        for text in chunk {
            params.push(("text", text.clone()));
        }
        params.push(("target_lang", target.clone()));
        
        if let Some(ref src) = source {
            params.push(("source_lang", src.clone()));
        }
        
        let response = client
            .post(base_url)
            .header("Authorization", format!("DeepL-Auth-Key {}", api_key))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .form(&params)
            .send()
            .await;
        
        match response {
            Ok(resp) if resp.status().is_success() => {
                #[derive(Deserialize)]
                struct DeepLResponse {
                    translations: Vec<DeepLTranslation>,
                }
                
                #[derive(Deserialize)]
                struct DeepLTranslation {
                    text: String,
                    detected_source_language: Option<String>,
                }
                
                if let Ok(deepl_resp) = resp.json::<DeepLResponse>().await {
                    for (i, trans) in deepl_resp.translations.into_iter().enumerate() {
                        let original = chunk.get(i).cloned().unwrap_or_default();
                        let detected = trans.detected_source_language
                            .unwrap_or_else(|| source.clone().unwrap_or_else(|| "auto".to_string()));
                        
                        all_translations.push(TranslationResult {
                            original,
                            translated: trans.text,
                            source_lang: detected.to_lowercase(),
                            target_lang: target.to_lowercase(),
                            provider: "deepl".to_string(),
                            confidence: Some(1.0),
                        });
                    }
                } else {
                    failed += chunk.len();
                }
            }
            _ => {
                failed += chunk.len();
            }
        }
    }
    
    let elapsed = start.elapsed().as_millis() as u64;
    let total = texts.len();
    let successful = all_translations.len();
    
    log::info!("✅ DeepL Batch: {}/{} tradotti in {}ms", successful, total, elapsed);
    
    Ok(BatchTranslationResult {
        translations: all_translations,
        provider: "deepl".to_string(),
        total,
        successful,
        failed,
        elapsed_ms: elapsed,
    })
}

// ============================================================================
// GOOGLE TRANSLATE API
// ============================================================================

/// Traduce testo usando Google Cloud Translation API
#[tauri::command]
pub async fn translate_google(
    text: String,
    target_lang: String,
    source_lang: Option<String>,
    api_key: String,
) -> Result<TranslationResult, String> {
    log::info!("🔍 Google: Traduzione verso {}", target_lang);
    
    let client = reqwest::Client::new();
    
    let url = format!(
        "https://translation.googleapis.com/language/translate/v2?key={}",
        api_key
    );
    
    let mut body = serde_json::json!({
        "q": text,
        "target": target_lang.to_lowercase(),
        "format": "text"
    });
    
    if let Some(ref src) = source_lang {
        body["source"] = serde_json::json!(src.to_lowercase());
    }
    
    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Errore richiesta Google: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Google errore {}: {}", status, error_text));
    }
    
    #[derive(Deserialize)]
    struct GoogleResponse {
        data: GoogleData,
    }
    
    #[derive(Deserialize)]
    struct GoogleData {
        translations: Vec<GoogleTranslation>,
    }
    
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct GoogleTranslation {
        translated_text: String,
        detected_source_language: Option<String>,
    }
    
    let google_response: GoogleResponse = response
        .json()
        .await
        .map_err(|e| format!("Errore parsing risposta Google: {}", e))?;
    
    let translation = google_response.data.translations
        .into_iter()
        .next()
        .ok_or("Nessuna traduzione ricevuta da Google")?;
    
    let detected_source = translation.detected_source_language
        .or(source_lang)
        .unwrap_or_else(|| "auto".to_string());
    
    log::info!("✅ Google: Tradotto {} -> {}", detected_source, target_lang);
    
    Ok(TranslationResult {
        original: text,
        translated: translation.translated_text,
        source_lang: detected_source.to_lowercase(),
        target_lang: target_lang.to_lowercase(),
        provider: "google".to_string(),
        confidence: None,
    })
}

/// Traduce batch di testi usando Google Translate
#[tauri::command]
pub async fn translate_google_batch(
    texts: Vec<String>,
    target_lang: String,
    source_lang: Option<String>,
    api_key: String,
) -> Result<BatchTranslationResult, String> {
    log::info!("🔍 Google Batch: {} testi verso {}", texts.len(), target_lang);
    
    let start = std::time::Instant::now();
    let client = reqwest::Client::new();
    
    let url = format!(
        "https://translation.googleapis.com/language/translate/v2?key={}",
        api_key
    );
    
    // Google supporta fino a 128 testi per richiesta
    let mut all_translations = Vec::new();
    let mut failed = 0;
    
    for chunk in texts.chunks(128) {
        let mut body = serde_json::json!({
            "q": chunk,
            "target": target_lang.to_lowercase(),
            "format": "text"
        });
        
        if let Some(ref src) = source_lang {
            body["source"] = serde_json::json!(src.to_lowercase());
        }
        
        let response = client
            .post(&url)
            .json(&body)
            .send()
            .await;
        
        match response {
            Ok(resp) if resp.status().is_success() => {
                #[derive(Deserialize)]
                struct GoogleResponse {
                    data: GoogleData,
                }
                
                #[derive(Deserialize)]
                struct GoogleData {
                    translations: Vec<GoogleTranslation>,
                }
                
                #[derive(Deserialize)]
                #[serde(rename_all = "camelCase")]
                struct GoogleTranslation {
                    translated_text: String,
                    detected_source_language: Option<String>,
                }
                
                if let Ok(google_resp) = resp.json::<GoogleResponse>().await {
                    for (i, trans) in google_resp.data.translations.into_iter().enumerate() {
                        let original = chunk.get(i).cloned().unwrap_or_default();
                        let detected = trans.detected_source_language
                            .or_else(|| source_lang.clone())
                            .unwrap_or_else(|| "auto".to_string());
                        
                        all_translations.push(TranslationResult {
                            original,
                            translated: trans.translated_text,
                            source_lang: detected.to_lowercase(),
                            target_lang: target_lang.to_lowercase(),
                            provider: "google".to_string(),
                            confidence: None,
                        });
                    }
                } else {
                    failed += chunk.len();
                }
            }
            _ => {
                failed += chunk.len();
            }
        }
    }
    
    let elapsed = start.elapsed().as_millis() as u64;
    let total = texts.len();
    let successful = all_translations.len();
    
    log::info!("✅ Google Batch: {}/{} tradotti in {}ms", successful, total, elapsed);
    
    Ok(BatchTranslationResult {
        translations: all_translations,
        provider: "google".to_string(),
        total,
        successful,
        failed,
        elapsed_ms: elapsed,
    })
}

// ============================================================================
// LIBRE TRANSLATE (Self-hosted / Free)
// ============================================================================

/// Traduce testo usando LibreTranslate (gratuito, self-hosted)
#[tauri::command]
pub async fn translate_libre(
    text: String,
    target_lang: String,
    source_lang: Option<String>,
    api_url: Option<String>,
    api_key: Option<String>,
) -> Result<TranslationResult, String> {
    log::info!("🆓 LibreTranslate: Traduzione verso {}", target_lang);
    
    let client = reqwest::Client::new();
    
    // URL default per LibreTranslate pubblico
    let base_url = api_url.unwrap_or_else(|| "https://libretranslate.com/translate".to_string());
    
    let mut body = serde_json::json!({
        "q": text,
        "source": source_lang.clone().unwrap_or_else(|| "auto".to_string()),
        "target": target_lang.to_lowercase(),
        "format": "text"
    });
    
    if let Some(key) = &api_key {
        body["api_key"] = serde_json::json!(key);
    }
    
    let response = client
        .post(&base_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Errore richiesta LibreTranslate: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("LibreTranslate errore {}: {}", status, error_text));
    }
    
    #[derive(Deserialize)]
    struct LibreResponse {
        #[serde(rename = "translatedText")]
        translated_text: String,
        #[serde(rename = "detectedLanguage")]
        detected_language: Option<DetectedLang>,
    }
    
    #[derive(Deserialize)]
    struct DetectedLang {
        language: String,
        confidence: f64,
    }
    
    let libre_response: LibreResponse = response
        .json()
        .await
        .map_err(|e| format!("Errore parsing risposta LibreTranslate: {}", e))?;
    
    let (detected_source, confidence) = if let Some(detected) = libre_response.detected_language {
        (detected.language, Some(detected.confidence))
    } else {
        (source_lang.unwrap_or_else(|| "auto".to_string()), None)
    };
    
    log::info!("✅ LibreTranslate: Tradotto {} -> {}", detected_source, target_lang);
    
    Ok(TranslationResult {
        original: text,
        translated: libre_response.translated_text,
        source_lang: detected_source.to_lowercase(),
        target_lang: target_lang.to_lowercase(),
        provider: "libretranslate".to_string(),
        confidence,
    })
}

// ============================================================================
// UNIFIED TRANSLATE (Auto-select provider)
// ============================================================================

/// Provider di traduzione disponibili
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TranslationProvider {
    DeepL,
    Google,
    LibreTranslate,
}

/// Traduce usando il provider specificato
#[tauri::command]
pub async fn translate_text_unified(
    text: String,
    target_lang: String,
    source_lang: Option<String>,
    provider: String,
    api_key: Option<String>,
    api_url: Option<String>,
) -> Result<TranslationResult, String> {
    match provider.to_lowercase().as_str() {
        "deepl" => {
            let key = api_key.ok_or("API key DeepL richiesta")?;
            translate_deepl(text, target_lang, source_lang, key, None).await
        }
        "google" => {
            let key = api_key.ok_or("API key Google richiesta")?;
            translate_google(text, target_lang, source_lang, key).await
        }
        "libre" | "libretranslate" => {
            translate_libre(text, target_lang, source_lang, api_url, api_key).await
        }
        _ => Err(format!("Provider non supportato: {}. Usa: deepl, google, libre", provider))
    }
}

/// Traduce batch usando il provider specificato
#[tauri::command]
pub async fn translate_batch_unified(
    texts: Vec<String>,
    target_lang: String,
    source_lang: Option<String>,
    provider: String,
    api_key: Option<String>,
    _api_url: Option<String>,
) -> Result<BatchTranslationResult, String> {
    match provider.to_lowercase().as_str() {
        "deepl" => {
            let key = api_key.ok_or("API key DeepL richiesta")?;
            translate_deepl_batch(texts, target_lang, source_lang, key).await
        }
        "google" => {
            let key = api_key.ok_or("API key Google richiesta")?;
            translate_google_batch(texts, target_lang, source_lang, key).await
        }
        "libre" | "libretranslate" => {
            // LibreTranslate non ha batch nativo, traduciamo uno alla volta
            let start = std::time::Instant::now();
            let mut translations = Vec::new();
            let mut failed = 0;
            
            for text in &texts {
                match translate_libre(
                    text.clone(),
                    target_lang.clone(),
                    source_lang.clone(),
                    _api_url.clone(),
                    api_key.clone(),
                ).await {
                    Ok(result) => translations.push(result),
                    Err(_) => failed += 1,
                }
            }
            
            Ok(BatchTranslationResult {
                translations,
                provider: "libretranslate".to_string(),
                total: texts.len(),
                successful: texts.len() - failed,
                failed,
                elapsed_ms: start.elapsed().as_millis() as u64,
            })
        }
        _ => Err(format!("Provider non supportato: {}. Usa: deepl, google, libre", provider))
    }
}

/// Ottiene le lingue supportate dal provider
#[tauri::command]
pub async fn get_supported_languages(
    provider: String,
    api_key: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    match provider.to_lowercase().as_str() {
        "deepl" => {
            let key = api_key.ok_or("API key DeepL richiesta")?;
            let client = reqwest::Client::new();
            
            let base_url = if key.ends_with(":fx") {
                "https://api-free.deepl.com/v2/languages"
            } else {
                "https://api.deepl.com/v2/languages"
            };
            
            let response = client
                .get(base_url)
                .header("Authorization", format!("DeepL-Auth-Key {}", key))
                .send()
                .await
                .map_err(|e| format!("Errore: {}", e))?;
            
            let languages: Vec<serde_json::Value> = response
                .json()
                .await
                .map_err(|e| format!("Errore parsing: {}", e))?;
            
            Ok(languages)
        }
        "google" => {
            let key = api_key.ok_or("API key Google richiesta")?;
            let client = reqwest::Client::new();
            
            let url = format!(
                "https://translation.googleapis.com/language/translate/v2/languages?key={}&target=en",
                key
            );
            
            let response = client
                .get(&url)
                .send()
                .await
                .map_err(|e| format!("Errore: {}", e))?;
            
            #[derive(Deserialize)]
            struct GoogleLangResponse {
                data: GoogleLangData,
            }
            
            #[derive(Deserialize)]
            struct GoogleLangData {
                languages: Vec<serde_json::Value>,
            }
            
            let lang_response: GoogleLangResponse = response
                .json()
                .await
                .map_err(|e| format!("Errore parsing: {}", e))?;
            
            Ok(lang_response.data.languages)
        }
        "libre" | "libretranslate" => {
            // Lingue comuni supportate da LibreTranslate
            Ok(vec![
                serde_json::json!({"language": "en", "name": "English"}),
                serde_json::json!({"language": "it", "name": "Italian"}),
                serde_json::json!({"language": "de", "name": "German"}),
                serde_json::json!({"language": "fr", "name": "French"}),
                serde_json::json!({"language": "es", "name": "Spanish"}),
                serde_json::json!({"language": "pt", "name": "Portuguese"}),
                serde_json::json!({"language": "ru", "name": "Russian"}),
                serde_json::json!({"language": "ja", "name": "Japanese"}),
                serde_json::json!({"language": "zh", "name": "Chinese"}),
                serde_json::json!({"language": "ko", "name": "Korean"}),
                serde_json::json!({"language": "ar", "name": "Arabic"}),
                serde_json::json!({"language": "pl", "name": "Polish"}),
            ])
        }
        _ => Err(format!("Provider non supportato: {}", provider))
    }
}
