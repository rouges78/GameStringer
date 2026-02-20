use tauri::command;
use std::path::{Path, PathBuf};
use std::fs;
use walkdir::WalkDir;

#[derive(serde::Serialize, Clone)]
pub struct AudioFile {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub extension: String,
}

/// Scansiona una directory alla ricerca di file audio supportati
#[command]
pub async fn scan_game_audio_files(game_path: String) -> Result<Vec<AudioFile>, String> {
    log::info!("🔍 Avviata scansione file audio in: {}", game_path);
    
    let path = Path::new(&game_path);
    if !path.exists() {
        return Err("La cartella del gioco non esiste".to_string());
    }

    let mut audio_files = Vec::new();
    
    // Estensioni audio comuni nei giochi
    let supported_extensions = ["wav", "ogg", "mp3", "flac"];

    // Usa WalkDir per attraversare ricorsivamente la cartella del gioco
    for entry in WalkDir::new(path)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
    {
        let file_path = entry.path();
        
        if let Some(ext) = file_path.extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            if supported_extensions.contains(&ext_lower.as_str()) {
                if let Ok(metadata) = entry.metadata() {
                    audio_files.push(AudioFile {
                        name: entry.file_name().to_string_lossy().to_string(),
                        path: file_path.to_string_lossy().to_string(),
                        size_bytes: metadata.len(),
                        extension: ext_lower,
                    });
                }
            }
        }
    }

    log::info!("✅ Trovati {} file audio in {}", audio_files.len(), game_path);
    
    // Ordina per dimensione (decrescente) per dare priorità a dialoghi e musiche lunghe rispetto a sfx brevi
    audio_files.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    
    Ok(audio_files)
}

/// Sostituisce un file audio originale con uno tradotto generato dal Voice Cloning locale.
/// Effettua automaticamente un backup del file originale rinominandolo con ".original" se non esiste già.
#[command]
pub async fn replace_audio_file(original_path: String, new_audio_base64: String) -> Result<bool, String> {
    log::info!("🔄 Sostituzione file audio: {}", original_path);
    
    let path = Path::new(&original_path);
    if !path.exists() {
        return Err("File audio originale non trovato".to_string());
    }

    let backup_path = path.with_extension(format!("{}.original", path.extension().unwrap_or_default().to_string_lossy()));
    
    // Crea backup solo se non esiste (evita di sovrascrivere il backup originale se l'utente patcha due volte)
    if !backup_path.exists() {
        if let Err(e) = fs::rename(path, &backup_path) {
            return Err(format!("Errore creazione backup: {}", e));
        }
        log::info!("💾 Backup creato: {:?}", backup_path);
    } else {
        // Se il backup esiste, eliminiamo l'attuale (che è già patchato) per fare spazio al nuovo
        if let Err(e) = fs::remove_file(path) {
            return Err(format!("Errore rimozione vecchio file patchato: {}", e));
        }
    }

    // Decodifica l'audio base64 generato da XTTS e lo salva come nuovo file originale
    use base64::{Engine as _, engine::general_purpose};
    let audio_data = match general_purpose::STANDARD.decode(new_audio_base64.replace("data:audio/wav;base64,", "")) {
        Ok(data) => data,
        Err(e) => {
            // Rollback: se decodifica fallisce e abbiamo spostato il file, ripristina il backup
            let _ = fs::rename(&backup_path, path);
            return Err(format!("Errore decodifica Base64: {}", e));
        }
    };

    if let Err(e) = fs::write(path, audio_data) {
        // Rollback
        let _ = fs::rename(&backup_path, path);
        return Err(format!("Errore scrittura nuovo file audio: {}", e));
    }

    log::info!("✅ File audio sostituito con successo");
    Ok(true)
}

/// Ripristina un file audio patchato recuperandolo dal backup ".original"
#[command]
pub async fn restore_audio_file(original_path: String) -> Result<bool, String> {
    log::info!("↩️ Ripristino file audio: {}", original_path);
    
    let path = Path::new(&original_path);
    let backup_path = path.with_extension(format!("{}.original", path.extension().unwrap_or_default().to_string_lossy()));
    
    if !backup_path.exists() {
        return Err("Backup originale non trovato".to_string());
    }

    // Se esiste il file modificato, lo elimina
    if path.exists() {
        let _ = fs::remove_file(path);
    }

    // Ripristina rinominando il backup
    if let Err(e) = fs::rename(&backup_path, path) {
        return Err(format!("Errore ripristino backup: {}", e));
    }

    log::info!("✅ File audio ripristinato con successo");
    Ok(true)
}