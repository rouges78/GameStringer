use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{Write, Seek, SeekFrom};
use std::path::PathBuf;
use log::info;
use rand::Rng;

// ============================================================================
// SECURE DELETE SYSTEM - Cancellazione sicura dati sensibili
// ============================================================================

/// Risultato cancellazione sicura
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecureDeleteResult {
    pub success: bool,
    pub files_deleted: u32,
    pub bytes_overwritten: u64,
    pub passes: u32,
    pub errors: Vec<String>,
}

/// Opzioni per cancellazione sicura
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecureDeleteOptions {
    pub passes: u32,           // Numero di passaggi di sovrascrittura (default 3)
    pub verify: bool,          // Verifica sovrascrittura
    pub include_metadata: bool, // Azzera anche metadata file
}

impl Default for SecureDeleteOptions {
    fn default() -> Self {
        Self {
            passes: 3,
            verify: true,
            include_metadata: true,
        }
    }
}

/// Sovrascrive un file con dati casuali prima di eliminarlo
fn secure_overwrite_file(filepath: &PathBuf, passes: u32) -> Result<u64, String> {
    let metadata = fs::metadata(filepath)
        .map_err(|e| format!("Errore lettura metadata: {}", e))?;
    
    let file_size = metadata.len();
    
    if file_size == 0 {
        // File vuoto, elimina direttamente
        fs::remove_file(filepath)
            .map_err(|e| format!("Errore eliminazione: {}", e))?;
        return Ok(0);
    }
    
    // Apri file per sovrascrittura
    let mut file = OpenOptions::new()
        .write(true)
        .open(filepath)
        .map_err(|e| format!("Errore apertura file: {}", e))?;
    
    let mut rng = rand::thread_rng();
    let buffer_size = 65536; // 64KB buffer
    let mut buffer = vec![0u8; buffer_size];
    
    for pass in 0..passes {
        // Torna all'inizio del file
        file.seek(SeekFrom::Start(0))
            .map_err(|e| format!("Errore seek: {}", e))?;
        
        let mut written = 0u64;
        while written < file_size {
            let to_write = std::cmp::min(buffer_size as u64, file_size - written) as usize;
            
            // Pattern diverso per ogni passaggio
            match pass % 3 {
                0 => rng.fill(&mut buffer[..to_write]), // Random
                1 => buffer[..to_write].fill(0x00),      // Zeros
                _ => buffer[..to_write].fill(0xFF),      // Ones
            }
            
            file.write_all(&buffer[..to_write])
                .map_err(|e| format!("Errore scrittura: {}", e))?;
            
            written += to_write as u64;
        }
        
        // Flush per assicurare scrittura su disco
        file.sync_all()
            .map_err(|e| format!("Errore sync: {}", e))?;
    }
    
    // Chiudi file e elimina
    drop(file);
    fs::remove_file(filepath)
        .map_err(|e| format!("Errore eliminazione finale: {}", e))?;
    
    Ok(file_size)
}

/// Cancella in modo sicuro un singolo file
#[tauri::command]
pub async fn secure_delete_file(
    filepath: String,
    passes: Option<u32>,
) -> Result<SecureDeleteResult, String> {
    let path = PathBuf::from(&filepath);
    
    if !path.exists() {
        return Err("File non trovato".to_string());
    }
    
    let num_passes = passes.unwrap_or(3);
    
    info!("🔐 Secure delete: {} ({} passes)", filepath, num_passes);
    
    match secure_overwrite_file(&path, num_passes) {
        Ok(bytes) => {
            info!("✅ File eliminato in modo sicuro: {} bytes", bytes);
            Ok(SecureDeleteResult {
                success: true,
                files_deleted: 1,
                bytes_overwritten: bytes,
                passes: num_passes,
                errors: vec![],
            })
        }
        Err(e) => Ok(SecureDeleteResult {
            success: false,
            files_deleted: 0,
            bytes_overwritten: 0,
            passes: num_passes,
            errors: vec![e],
        })
    }
}

/// Cancella in modo sicuro una directory
#[tauri::command]
pub async fn secure_delete_directory(
    dirpath: String,
    passes: Option<u32>,
) -> Result<SecureDeleteResult, String> {
    let path = PathBuf::from(&dirpath);
    
    if !path.exists() {
        return Err("Directory non trovata".to_string());
    }
    
    if !path.is_dir() {
        return Err("Il percorso non è una directory".to_string());
    }
    
    let num_passes = passes.unwrap_or(3);
    let mut total_files = 0u32;
    let mut total_bytes = 0u64;
    let mut errors = Vec::new();
    
    info!("🔐 Secure delete directory: {} ({} passes)", dirpath, num_passes);
    
    // Raccogli tutti i file ricorsivamente
    fn collect_files(dir: &PathBuf, files: &mut Vec<PathBuf>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    collect_files(&path, files);
                } else {
                    files.push(path);
                }
            }
        }
    }
    
    let mut files_to_delete = Vec::new();
    collect_files(&path, &mut files_to_delete);
    
    // Elimina tutti i file
    for file in files_to_delete {
        match secure_overwrite_file(&file, num_passes) {
            Ok(bytes) => {
                total_files += 1;
                total_bytes += bytes;
            }
            Err(e) => {
                errors.push(format!("{}: {}", file.display(), e));
            }
        }
    }
    
    // Rimuovi directory vuote
    fn remove_empty_dirs(dir: &PathBuf) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    remove_empty_dirs(&path);
                    let _ = fs::remove_dir(&path);
                }
            }
        }
        let _ = fs::remove_dir(dir);
    }
    
    remove_empty_dirs(&path);
    
    info!("✅ Directory eliminata: {} files, {} bytes", total_files, total_bytes);
    
    Ok(SecureDeleteResult {
        success: errors.is_empty(),
        files_deleted: total_files,
        bytes_overwritten: total_bytes,
        passes: num_passes,
        errors,
    })
}

/// Cancella in modo sicuro tutti i dati sensibili di un profilo
#[tauri::command]
pub async fn secure_delete_profile_data(
    profile_id: String,
    passes: Option<u32>,
) -> Result<SecureDeleteResult, String> {
    let num_passes = passes.unwrap_or(3);
    let mut total_files = 0u32;
    let mut total_bytes = 0u64;
    let mut errors = Vec::new();
    
    info!("🔐 Secure delete profile data: {} ({} passes)", profile_id, num_passes);
    
    let data_dir = dirs::data_local_dir()
        .ok_or("Directory dati non trovata")?
        .join("GameStringer");
    
    // Lista di percorsi da eliminare per questo profilo
    let paths_to_check = vec![
        data_dir.join("profiles").join(format!("{}.json", profile_id)),
        data_dir.join("preferences").join(format!("{}.json", profile_id)),
        data_dir.join("credentials").join(format!("{}.enc", profile_id)),
        data_dir.join("translation_memory").join(&profile_id),
        data_dir.join("dictionaries").join(&profile_id),
    ];
    
    for path in paths_to_check {
        if !path.exists() {
            continue;
        }
        
        if path.is_file() {
            match secure_overwrite_file(&path, num_passes) {
                Ok(bytes) => {
                    total_files += 1;
                    total_bytes += bytes;
                }
                Err(e) => {
                    errors.push(format!("{}: {}", path.display(), e));
                }
            }
        } else if path.is_dir() {
            match secure_delete_directory(path.to_string_lossy().to_string(), Some(num_passes)).await {
                Ok(result) => {
                    total_files += result.files_deleted;
                    total_bytes += result.bytes_overwritten;
                    errors.extend(result.errors);
                }
                Err(e) => {
                    errors.push(e);
                }
            }
        }
    }
    
    info!("✅ Profile data eliminato: {} files, {} bytes", total_files, total_bytes);
    
    Ok(SecureDeleteResult {
        success: errors.is_empty(),
        files_deleted: total_files,
        bytes_overwritten: total_bytes,
        passes: num_passes,
        errors,
    })
}

/// Cancella in modo sicuro le API keys salvate
#[tauri::command]
pub async fn secure_delete_api_keys(
    profile_id: String,
    passes: Option<u32>,
) -> Result<SecureDeleteResult, String> {
    let num_passes = passes.unwrap_or(5); // Più passaggi per dati critici
    let mut total_files = 0u32;
    let mut total_bytes = 0u64;
    let mut errors = Vec::new();
    
    info!("🔐 Secure delete API keys: {} ({} passes)", profile_id, num_passes);
    
    let data_dir = dirs::data_local_dir()
        .ok_or("Directory dati non trovata")?
        .join("GameStringer");
    
    // Percorsi delle API keys
    let key_paths = vec![
        data_dir.join("credentials").join(format!("{}_steam.enc", profile_id)),
        data_dir.join("credentials").join(format!("{}_openai.enc", profile_id)),
        data_dir.join("credentials").join(format!("{}_anthropic.enc", profile_id)),
        data_dir.join("credentials").join(format!("{}_api_keys.enc", profile_id)),
        // Anche file JSON non criptati legacy
        data_dir.join("steam_credentials.json"),
    ];
    
    for path in key_paths {
        if path.exists() && path.is_file() {
            match secure_overwrite_file(&path, num_passes) {
                Ok(bytes) => {
                    total_files += 1;
                    total_bytes += bytes;
                }
                Err(e) => {
                    errors.push(format!("{}: {}", path.display(), e));
                }
            }
        }
    }
    
    info!("✅ API keys eliminate: {} files, {} bytes", total_files, total_bytes);
    
    Ok(SecureDeleteResult {
        success: errors.is_empty(),
        files_deleted: total_files,
        bytes_overwritten: total_bytes,
        passes: num_passes,
        errors,
    })
}

/// Pulisce in modo sicuro i dati temporanei e cache
#[tauri::command]
pub async fn secure_cleanup_temp_data(
    passes: Option<u32>,
) -> Result<SecureDeleteResult, String> {
    let num_passes = passes.unwrap_or(1); // Un passaggio per dati temp
    let mut total_files = 0u32;
    let mut total_bytes = 0u64;
    let mut errors = Vec::new();
    
    info!("🔐 Secure cleanup temp data ({} passes)", num_passes);
    
    let data_dir = dirs::data_local_dir()
        .ok_or("Directory dati non trovata")?
        .join("GameStringer");
    
    // Directory temporanee da pulire
    let temp_dirs = vec![
        data_dir.join("temp"),
        data_dir.join("cache"),
        data_dir.join("logs"),
    ];
    
    for dir in temp_dirs {
        if dir.exists() && dir.is_dir() {
            match secure_delete_directory(dir.to_string_lossy().to_string(), Some(num_passes)).await {
                Ok(result) => {
                    total_files += result.files_deleted;
                    total_bytes += result.bytes_overwritten;
                    errors.extend(result.errors);
                }
                Err(e) => {
                    errors.push(e);
                }
            }
        }
    }
    
    info!("✅ Temp data pulito: {} files, {} bytes", total_files, total_bytes);
    
    Ok(SecureDeleteResult {
        success: errors.is_empty(),
        files_deleted: total_files,
        bytes_overwritten: total_bytes,
        passes: num_passes,
        errors,
    })
}
