use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct GspackInfo {
    pub filename: String,
    pub size_bytes: u64,
    pub path: String,
}

/// Salva un file .gspack su disco
#[tauri::command]
pub async fn save_gspack(content: String, filename: String, directory: Option<String>) -> Result<GspackInfo, String> {
    let dir = if let Some(d) = directory {
        PathBuf::from(d)
    } else {
        dirs::document_dir()
            .or_else(dirs::home_dir)
            .unwrap_or_else(|| PathBuf::from("."))
            .join("GameStringer")
            .join("packs")
    };

    // Crea directory se non esiste
    std::fs::create_dir_all(&dir).map_err(|e| format!("Impossibile creare directory: {}", e))?;

    let path = dir.join(&filename);
    std::fs::write(&path, &content).map_err(|e| format!("Errore scrittura file: {}", e))?;

    let size = content.len() as u64;

    Ok(GspackInfo {
        filename,
        size_bytes: size,
        path: path.to_string_lossy().to_string(),
    })
}

/// Legge un file .gspack da disco
#[tauri::command]
pub async fn load_gspack(path: String) -> Result<String, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    Ok(content)
}

/// Lista tutti i .gspack nella directory packs
#[tauri::command]
pub async fn list_gspacks(directory: Option<String>) -> Result<Vec<GspackInfo>, String> {
    let dir = if let Some(d) = directory {
        PathBuf::from(d)
    } else {
        dirs::document_dir()
            .or_else(dirs::home_dir)
            .unwrap_or_else(|| PathBuf::from("."))
            .join("GameStringer")
            .join("packs")
    };

    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut packs = Vec::new();
    let entries = std::fs::read_dir(&dir)
        .map_err(|e| format!("Errore lettura directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("gspack") {
            if let Ok(metadata) = std::fs::metadata(&path) {
                packs.push(GspackInfo {
                    filename: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                    size_bytes: metadata.len(),
                    path: path.to_string_lossy().to_string(),
                });
            }
        }
    }

    Ok(packs)
}

/// Elimina un file .gspack
#[tauri::command]
pub async fn delete_gspack(path: String) -> Result<bool, String> {
    std::fs::remove_file(&path)
        .map_err(|e| format!("Errore eliminazione: {}", e))?;
    Ok(true)
}
