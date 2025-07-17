use std::collections::HashMap;
use crate::error_manager::{ErrorType, ERROR_MANAGER, classify_error};
use crate::cache_manager::{CACHE_MANAGER, CacheType};
use crate::models::SteamGame;
use log::{debug, warn, error};
use serde::{Serialize, Deserialize};

/// Wrapper per chiamate Steam API con gestione errori robusta
pub async fn steam_api_call_with_error_handling<T>(
    operation: impl Fn() -> Result<T, String> + Send + Sync,
    operation_name: &str,
) -> Result<T, String> {
    let mut context = HashMap::new();
    context.insert("operation".to_string(), operation_name.to_string());
    context.insert("store".to_string(), "steam".to_string());
    
    // Classifica il tipo di errore basato sull'operazione
    let error_type = match operation_name {
        "api_call" => ErrorType::ApiServerError,
        "network_request" => ErrorType::NetworkTimeout,
        "parse_json" => ErrorType::JsonParseError,
        "steam_not_found" => ErrorType::SteamNotInstalled,
        "rate_limited" => ErrorType::ApiRateLimited,
        "invalid_credentials" => ErrorType::ApiKeyInvalid,
        _ => ErrorType::Unknown,
    };
    
    // Esegui l'operazione con retry automatico
    match ERROR_MANAGER.execute_with_retry(error_type.clone(), operation).await {
        Ok(result) => {
            debug!("[Steam] Operazione '{}' completata con successo", operation_name);
            Ok(result)
        }
        Err(e) => {
            // Log dell'errore con contesto
            context.insert("error_message".to_string(), e.to_string());
            let error_info = ERROR_MANAGER.log_error(error_type, context).await;
            
            error!("[Steam] Errore in '{}': {} - Suggerimento: {}", 
                   operation_name, error_info.message, error_info.suggested_action);
            
            Err(format!("{} - {}", error_info.message, error_info.suggested_action))
        }
    }
}

/// Wrapper per operazioni Steam con cache intelligente
pub async fn steam_cached_operation<T>(
    cache_key: &str,
    cache_type: CacheType,
    operation: impl Fn() -> Result<T, String> + Send + Sync,
) -> Result<T, String> 
where
    T: Clone + serde::Serialize + for<'de> serde::Deserialize<'de> + Send + Sync + 'static,
{
    // Prova prima dalla cache
    if let Ok(Some(cached_result)) = CACHE_MANAGER.get::<T>(cache_type.clone(), cache_key).await {
        debug!("[Steam] Cache hit per chiave: {}", cache_key);
        return Ok(cached_result);
    }
    
    // Esegui l'operazione con gestione errori
    let result = steam_api_call_with_error_handling(operation, "cached_operation").await?;
    
    // Salva in cache
    if let Err(e) = CACHE_MANAGER.set(cache_type, cache_key.to_string(), result.clone()).await {
        warn!("[Steam] Errore nel salvare in cache: {}", e);
    }
    
    Ok(result)
}

/// Wrapper specifico per chiamate API Steam con classificazione errori automatica
pub async fn steam_api_request_with_error_handling(
    url: &str,
    operation_name: &str,
) -> Result<reqwest::Response, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Errore creazione client: {}", e))?;
    
    let operation = || {
        let client = client.clone();
        let url = url.to_string();
        async move {
            client.get(&url).send().await
                .map_err(|e| {
                    let error_msg = e.to_string();
                    if error_msg.contains("timeout") {
                        "Network timeout occurred".to_string()
                    } else if error_msg.contains("connection") {
                        "Connection failed".to_string()
                    } else if error_msg.contains("dns") {
                        "DNS resolution failed".to_string()
                    } else {
                        format!("Request failed: {}", error_msg)
                    }
                })
        }
    };
    
    // Classifica automaticamente il tipo di errore
    let error_type = if url.contains("api.steampowered.com") {
        ErrorType::ApiServerError
    } else {
        ErrorType::NetworkConnectionFailed
    };
    
    let mut context = HashMap::new();
    context.insert("url".to_string(), url.to_string());
    context.insert("operation".to_string(), operation_name.to_string());
    
    match ERROR_MANAGER.execute_with_retry(error_type.clone(), || {
        tokio::runtime::Handle::current().block_on(operation())
    }).await {
        Ok(response) => {
            debug!("[Steam] Richiesta API '{}' completata con successo", operation_name);
            Ok(response)
        }
        Err(e) => {
            context.insert("error_message".to_string(), e.to_string());
            let error_info = ERROR_MANAGER.log_error(error_type, context).await;
            
            error!("[Steam] Errore richiesta API '{}': {}", operation_name, error_info.message);
            Err(format!("{} - {}", error_info.message, error_info.suggested_action))
        }
    }
}

/// Wrapper per parsing JSON con gestione errori
pub async fn parse_json_with_error_handling<T>(
    json_text: &str,
    operation_name: &str,
) -> Result<T, String>
where
    T: for<'de> serde::Deserialize<'de>,
{
    let operation = || {
        serde_json::from_str::<T>(json_text)
            .map_err(|e| format!("JSON parsing failed: {}", e))
    };
    
    steam_api_call_with_error_handling(operation, &format!("parse_json_{}", operation_name)).await
}

/// Wrapper per operazioni di filesystem con gestione errori
pub async fn filesystem_operation_with_error_handling<T>(
    operation: impl Fn() -> Result<T, std::io::Error> + Send + Sync,
    operation_name: &str,
    file_path: &str,
) -> Result<T, String> {
    let mut context = HashMap::new();
    context.insert("operation".to_string(), operation_name.to_string());
    context.insert("file_path".to_string(), file_path.to_string());
    
    let wrapped_operation = || {
        operation().map_err(|e| {
            match e.kind() {
                std::io::ErrorKind::NotFound => "File not found".to_string(),
                std::io::ErrorKind::PermissionDenied => "Permission denied".to_string(),
                std::io::ErrorKind::InvalidData => "File corrupted or invalid".to_string(),
                _ => format!("Filesystem error: {}", e),
            }
        })
    };
    
    let error_type = match operation_name {
        "read_file" => ErrorType::FileNotFound,
        "write_file" => ErrorType::FilePermissionDenied,
        "create_dir" => ErrorType::DirectoryNotFound,
        _ => ErrorType::Unknown,
    };
    
    match ERROR_MANAGER.execute_with_retry(error_type.clone(), wrapped_operation).await {
        Ok(result) => {
            debug!("[Steam] Operazione filesystem '{}' completata: {}", operation_name, file_path);
            Ok(result)
        }
        Err(e) => {
            context.insert("error_message".to_string(), e.to_string());
            let error_info = ERROR_MANAGER.log_error(error_type, context).await;
            
            error!("[Steam] Errore filesystem '{}' su '{}': {}", 
                   operation_name, file_path, error_info.message);
            
            Err(format!("{} - {}", error_info.message, error_info.suggested_action))
        }
    }
}

/// Comando Tauri per testare il sistema di gestione errori Steam
#[tauri::command]
pub async fn test_steam_error_handling() -> Result<String, String> {
    let mut results = Vec::new();
    
    // Test 1: Errore di rete simulato
    let network_test = steam_api_call_with_error_handling(
        || Err("Connection timeout".to_string()),
        "network_request"
    ).await;
    
    results.push(format!("Test Network Error: {:?}", network_test));
    
    // Test 2: Errore API simulato
    let api_test = steam_api_call_with_error_handling(
        || Err("API key invalid".to_string()),
        "invalid_credentials"
    ).await;
    
    results.push(format!("Test API Error: {:?}", api_test));
    
    // Test 3: Errore parsing JSON simulato
    let json_test = parse_json_with_error_handling::<serde_json::Value>(
        "invalid json {",
        "test_parsing"
    ).await;
    
    results.push(format!("Test JSON Parse Error: {:?}", json_test));
    
    // Test 4: Operazione di successo
    let success_test = steam_api_call_with_error_handling(
        || Ok("Success!".to_string()),
        "test_operation"
    ).await;
    
    results.push(format!("Test Success: {:?}", success_test));
    
    Ok(results.join("\n"))
}

/// Comando Tauri per testare cache intelligente Steam
#[tauri::command]
pub async fn test_steam_cache_integration() -> Result<String, String> {
    let mut results = Vec::new();
    
    // Test cache con operazione costosa simulata
    let start1 = std::time::Instant::now();
    let cache_test = steam_cached_operation(
        "test_key_expensive",
        CacheType::SteamGames,
        || {
            std::thread::sleep(std::time::Duration::from_millis(100)); // Simula operazione lenta
            Ok("Cached result from expensive operation".to_string())
        }
    ).await;
    let duration1 = start1.elapsed();
    
    results.push(format!("Cache Test 1 ({}ms): {:?}", duration1.as_millis(), cache_test));
    
    // Secondo test dovrebbe essere più veloce (da cache)
    let start2 = std::time::Instant::now();
    let cache_test2 = steam_cached_operation(
        "test_key_expensive",
        CacheType::SteamGames,
        || {
            std::thread::sleep(std::time::Duration::from_millis(100));
            Ok("This should not be called - from cache".to_string())
        }
    ).await;
    let duration2 = start2.elapsed();
    
    results.push(format!("Cache Test 2 ({}ms): {:?}", duration2.as_millis(), cache_test2));
    
    // Test con diversi tipi di cache
    let cover_cache_test = steam_cached_operation(
        "test_cover_123",
        CacheType::SteamCovers,
        || Ok("Cover URL cached".to_string())
    ).await;
    
    results.push(format!("Cover Cache Test: {:?}", cover_cache_test));
    
    // Test gestione errori in cache
    let error_cache_test = steam_cached_operation(
        "test_error_key",
        CacheType::SteamDetails,
        || Err("Simulated cache error".to_string())
    ).await;
    
    results.push(format!("Error Cache Test: {:?}", error_cache_test));
    
    Ok(results.join("\n"))
}

/// Comando Tauri per ottenere statistiche errori Steam
#[tauri::command]
pub async fn get_steam_error_statistics() -> Result<String, String> {
    let stats = ERROR_MANAGER.get_stats().await;
    
    let mut result = Vec::new();
    result.push(format!("Totale errori: {}", stats.total_errors));
    result.push(format!("Errori per minuto: {:.2}", stats.error_rate_per_minute));
    
    if let Some(most_common) = stats.most_common_error {
        result.push(format!("Errore più comune: {:?}", most_common));
    }
    
    result.push("Errori per tipo:".to_string());
    for (error_type, count) in stats.errors_by_type {
        result.push(format!("  {:?}: {}", error_type, count));
    }
    
    result.push("Errori per severità:".to_string());
    for (severity, count) in stats.errors_by_severity {
        result.push(format!("  {:?}: {}", severity, count));
    }
    
    result.push(format!("Errori recenti: {}", stats.recent_errors.len()));
    
    Ok(result.join("\n"))
}

/// Comando Tauri per ottenere suggerimenti per errori Steam
#[tauri::command]
pub async fn get_steam_error_suggestions() -> Result<Vec<String>, String> {
    let suggestions = ERROR_MANAGER.get_error_suggestions().await;
    Ok(suggestions)
}

/// Helper per classificare automaticamente errori Steam
pub fn classify_steam_error(error_message: &str) -> ErrorType {
    let error_lower = error_message.to_lowercase();
    
    if error_lower.contains("steam") && (error_lower.contains("not found") || error_lower.contains("not installed")) {
        ErrorType::SteamNotInstalled
    } else if error_lower.contains("steam") && error_lower.contains("not running") {
        ErrorType::SteamNotRunning
    } else if error_lower.contains("api key") {
        ErrorType::ApiKeyInvalid
    } else if error_lower.contains("rate limit") || error_lower.contains("too many requests") {
        ErrorType::ApiRateLimited
    } else if error_lower.contains("quota") {
        ErrorType::ApiQuotaExceeded
    } else if error_lower.contains("unauthorized") || error_lower.contains("403") {
        ErrorType::ApiUnauthorized
    } else if error_lower.contains("timeout") {
        ErrorType::NetworkTimeout
    } else if error_lower.contains("connection") {
        ErrorType::NetworkConnectionFailed
    } else if error_lower.contains("json") || error_lower.contains("parse") {
        ErrorType::JsonParseError
    } else if error_lower.contains("vdf") {
        ErrorType::VdfParseError
    } else if error_lower.contains("file not found") {
        ErrorType::FileNotFound
    } else if error_lower.contains("permission") {
        ErrorType::FilePermissionDenied
    } else if error_lower.contains("cache") && error_lower.contains("corrupt") {
        ErrorType::CacheCorrupted
    } else {
        ErrorType::Unknown
    }
}

/// Macro di convenienza per operazioni Steam con gestione errori
#[macro_export]
macro_rules! steam_operation {
    ($operation:expr, $name:expr) => {
        $crate::commands::steam_enhanced_error::steam_api_call_with_error_handling($operation, $name).await
    };
}

#[macro_export]
macro_rules! steam_cached {
    ($key:expr, $cache_type:expr, $operation:expr) => {
        $crate::commands::steam_enhanced_error::steam_cached_operation($key, $cache_type, $operation).await
    };
}
