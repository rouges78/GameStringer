use std::path::PathBuf;
use std::fs;
use serde::{Deserialize, Serialize};

/// Informazioni su un'immagine cached
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedImage {
    pub url: String,
    pub local_path: String,
    pub cached_at: u64,
    pub size_bytes: u64,
}

/// Statistiche della cache immagini
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageCacheStats {
    pub total_images: u32,
    pub total_size_mb: f64,
    pub oldest_cache_days: u32,
}

/// Ottiene il percorso della directory cache immagini
fn get_cache_dir() -> Result<PathBuf, String> {
    let cache_dir = if cfg!(debug_assertions) {
        PathBuf::from("../gamestringer_data/image_cache")
    } else {
        dirs::cache_dir()
            .ok_or("Impossibile trovare directory cache")?
            .join("GameStringer")
            .join("images")
    };
    
    // Crea la directory se non esiste
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir)
            .map_err(|e| format!("Errore creazione directory cache: {}", e))?;
    }
    
    Ok(cache_dir)
}

/// Genera un nome file sicuro dall'URL
fn url_to_filename(url: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    url.hash(&mut hasher);
    let hash = hasher.finish();
    
    // Estrai estensione dall'URL
    let ext = url.split('.').last()
        .filter(|e| ["jpg", "jpeg", "png", "webp", "gif"].contains(e))
        .unwrap_or("jpg");
    
    format!("{:x}.{}", hash, ext)
}

/// Scarica e salva un'immagine nella cache
#[tauri::command]
pub async fn cache_image(url: String) -> Result<String, String> {
    let cache_dir = get_cache_dir()?;
    let filename = url_to_filename(&url);
    let local_path = cache_dir.join(&filename);
    
    // Se già in cache, ritorna il percorso
    if local_path.exists() {
        return Ok(local_path.to_string_lossy().to_string());
    }
    
    // Scarica l'immagine
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Errore client HTTP: {}", e))?;
    
    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("Errore download immagine: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let bytes = response.bytes()
        .await
        .map_err(|e| format!("Errore lettura bytes: {}", e))?;
    
    // Salva su disco
    fs::write(&local_path, &bytes)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    Ok(local_path.to_string_lossy().to_string())
}

/// Verifica se un'immagine è in cache
#[tauri::command]
pub fn is_image_cached(url: String) -> Result<Option<String>, String> {
    let cache_dir = get_cache_dir()?;
    let filename = url_to_filename(&url);
    let local_path = cache_dir.join(&filename);
    
    if local_path.exists() {
        Ok(Some(local_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

/// Ottiene statistiche sulla cache immagini
#[tauri::command]
pub fn get_image_cache_stats() -> Result<ImageCacheStats, String> {
    let cache_dir = get_cache_dir()?;
    
    let mut total_images = 0u32;
    let mut total_size = 0u64;
    let mut oldest_modified = std::time::SystemTime::now();
    
    if let Ok(entries) = fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    total_images += 1;
                    total_size += metadata.len();
                    
                    if let Ok(modified) = metadata.modified() {
                        if modified < oldest_modified {
                            oldest_modified = modified;
                        }
                    }
                }
            }
        }
    }
    
    let oldest_days = oldest_modified
        .elapsed()
        .map(|d| (d.as_secs() / 86400) as u32)
        .unwrap_or(0);
    
    Ok(ImageCacheStats {
        total_images,
        total_size_mb: total_size as f64 / 1_048_576.0,
        oldest_cache_days: oldest_days,
    })
}

/// Pulisce immagini più vecchie di N giorni
#[tauri::command]
pub fn cleanup_image_cache(max_age_days: u32) -> Result<u32, String> {
    let cache_dir = get_cache_dir()?;
    let max_age_secs = max_age_days as u64 * 86400;
    let mut removed = 0u32;
    
    if let Ok(entries) = fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    if let Ok(modified) = metadata.modified() {
                        if let Ok(age) = modified.elapsed() {
                            if age.as_secs() > max_age_secs {
                                if fs::remove_file(entry.path()).is_ok() {
                                    removed += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(removed)
}

/// Svuota completamente la cache immagini
#[tauri::command]
pub fn clear_image_cache() -> Result<u32, String> {
    let cache_dir = get_cache_dir()?;
    let mut removed = 0u32;
    
    if let Ok(entries) = fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    if fs::remove_file(entry.path()).is_ok() {
                        removed += 1;
                    }
                }
            }
        }
    }
    
    Ok(removed)
}
