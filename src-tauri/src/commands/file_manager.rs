use std::fs;
use std::path::Path;
use chrono::Local;
use tauri::command;

/// Salva un file creando automaticamente un backup dell'originale
#[command]
pub async fn save_file_with_backup(
    file_path: String,
    content: String,
    create_backup: bool,
) -> Result<SaveResult, String> {
    let path = Path::new(&file_path);
    let mut backup_path: Option<String> = None;
    
    // Se il file esiste e create_backup è true, crea un backup
    if path.exists() && create_backup {
        let timestamp = Local::now().format("%Y%m%d_%H%M%S");
        let file_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file");
        
        let backup_dir = path.parent()
            .map(|p| p.join(".gamestringer_backups"))
            .ok_or("Cannot determine backup directory")?;
        
        // Crea la directory di backup se non esiste
        if !backup_dir.exists() {
            fs::create_dir_all(&backup_dir)
                .map_err(|e| format!("Failed to create backup directory: {}", e))?;
        }
        
        let backup_file = backup_dir.join(format!("{}_{}", timestamp, file_name));
        
        // Copia il file originale nel backup
        fs::copy(path, &backup_file)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
        
        backup_path = Some(backup_file.to_string_lossy().to_string());
        println!("[FILE MANAGER] ✅ Backup creato: {}", backup_file.display());
    }
    
    // Scrivi il nuovo contenuto
    fs::write(path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    println!("[FILE MANAGER] ✅ File salvato: {}", file_path);
    
    Ok(SaveResult {
        success: true,
        file_path,
        backup_path,
        message: "File salvato con successo".to_string(),
    })
}

/// Legge un file
#[command]
pub async fn read_file_content(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Lista i backup disponibili per un file
#[command]
pub async fn list_file_backups(file_path: String) -> Result<Vec<BackupInfo>, String> {
    let path = Path::new(&file_path);
    let file_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");
    
    let backup_dir = path.parent()
        .map(|p| p.join(".gamestringer_backups"))
        .ok_or("Cannot determine backup directory")?;
    
    if !backup_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut backups = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&backup_dir) {
        for entry in entries.flatten() {
            let entry_name = entry.file_name().to_string_lossy().to_string();
            if entry_name.ends_with(file_name) {
                if let Ok(metadata) = entry.metadata() {
                    backups.push(BackupInfo {
                        path: entry.path().to_string_lossy().to_string(),
                        name: entry_name,
                        size: metadata.len(),
                        created: metadata.modified()
                            .map(|t| t.duration_since(std::time::UNIX_EPOCH)
                                .map(|d| d.as_secs())
                                .unwrap_or(0))
                            .unwrap_or(0),
                    });
                }
            }
        }
    }
    
    // Ordina per data (più recente prima)
    backups.sort_by(|a, b| b.created.cmp(&a.created));
    
    Ok(backups)
}

/// Ripristina un backup
#[command]
pub async fn restore_backup(backup_path: String, target_path: String) -> Result<SaveResult, String> {
    // Prima crea un backup del file attuale
    let result = save_file_with_backup(
        target_path.clone(),
        fs::read_to_string(&target_path).unwrap_or_default(),
        true,
    ).await?;
    
    // Poi ripristina il backup
    let backup_content = fs::read_to_string(&backup_path)
        .map_err(|e| format!("Failed to read backup: {}", e))?;
    
    fs::write(&target_path, &backup_content)
        .map_err(|e| format!("Failed to restore backup: {}", e))?;
    
    println!("[FILE MANAGER] ✅ Backup ripristinato: {} -> {}", backup_path, target_path);
    
    Ok(SaveResult {
        success: true,
        file_path: target_path,
        backup_path: result.backup_path,
        message: "Backup ripristinato con successo".to_string(),
    })
}

/// Ottiene il percorso del Desktop
#[command]
pub async fn get_desktop_path() -> Result<String, String> {
    dirs::desktop_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Cannot find desktop directory".to_string())
}

/// Salva un file binario da base64
#[command]
pub async fn save_binary_file(file_path: String, base64_content: String) -> Result<SaveResult, String> {
    use base64::{Engine as _, engine::general_purpose};
    
    let bytes = general_purpose::STANDARD
        .decode(&base64_content)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write binary file: {}", e))?;
    
    println!("[FILE MANAGER] ✅ File binario salvato: {} ({} bytes)", file_path, bytes.len());
    
    Ok(SaveResult {
        success: true,
        file_path: file_path.clone(),
        backup_path: None,
        message: format!("File saved successfully ({} bytes)", bytes.len()),
    })
}

/// Crea una directory (e tutte le directory parent necessarie)
#[command]
pub async fn ensure_directory(path: String) -> Result<EnsureDirectoryResult, String> {
    let dir_path = Path::new(&path);
    
    if dir_path.exists() {
        return Ok(EnsureDirectoryResult {
            success: true,
            path: path.clone(),
            created: false,
            message: "Directory already exists".to_string(),
        });
    }
    
    fs::create_dir_all(&dir_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    println!("[FILE MANAGER] ✅ Directory creata: {}", path);
    
    Ok(EnsureDirectoryResult {
        success: true,
        path,
        created: true,
        message: "Directory created successfully".to_string(),
    })
}

/// Scrive un file di testo creando le directory parent se necessario
#[command]
pub async fn write_text_file(path: String, content: String) -> Result<SaveResult, String> {
    let file_path = Path::new(&path);
    
    // Crea le directory parent se non esistono
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories: {}", e))?;
        }
    }
    
    fs::write(file_path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    println!("[FILE MANAGER] ✅ File scritto: {}", path);
    
    Ok(SaveResult {
        success: true,
        file_path: path,
        backup_path: None,
        message: "File written successfully".to_string(),
    })
}

#[derive(serde::Serialize)]
pub struct EnsureDirectoryResult {
    pub success: bool,
    pub path: String,
    pub created: bool,
    pub message: String,
}

#[derive(serde::Serialize)]
pub struct SaveResult {
    pub success: bool,
    pub file_path: String,
    pub backup_path: Option<String>,
    pub message: String,
}

#[derive(serde::Serialize)]
pub struct BackupInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub created: u64,
}
