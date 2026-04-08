use tauri::command;
use std::path::Path;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // ── Helper ──────────────────────────────────────────────────────────
    fn setup_dir_with_files(files: &[(&str, &[u8])]) -> TempDir {
        let dir = TempDir::new().unwrap();
        for (name, content) in files {
            let p = dir.path().join(name);
            if let Some(parent) = p.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(&p, content).unwrap();
        }
        dir
    }

    // ── scan_game_audio_files ───────────────────────────────────────────

    #[tokio::test]
    async fn scan_finds_supported_audio_extensions() {
        let dir = setup_dir_with_files(&[
            ("music.wav", b"RIFF"),
            ("voice.ogg", b"OggS"),
            ("theme.mp3", b"ID3"),
            ("ambient.flac", b"fLaC"),
        ]);
        let result = scan_game_audio_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert_eq!(result.len(), 4);
        let exts: Vec<&str> = result.iter().map(|f| f.extension.as_str()).collect();
        assert!(exts.contains(&"wav"));
        assert!(exts.contains(&"ogg"));
        assert!(exts.contains(&"mp3"));
        assert!(exts.contains(&"flac"));
    }

    #[tokio::test]
    async fn scan_ignores_non_audio_files() {
        let dir = setup_dir_with_files(&[
            ("readme.txt", b"hello"),
            ("image.png", b"\x89PNG"),
            ("data.json", b"{}"),
            ("only_audio.wav", b"RIFF"),
        ]);
        let result = scan_game_audio_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].extension, "wav");
    }

    #[tokio::test]
    async fn scan_handles_uppercase_extensions() {
        let dir = setup_dir_with_files(&[
            ("MUSIC.WAV", b"RIFF"),
            ("VOICE.OGG", b"OggS"),
        ]);
        let result = scan_game_audio_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn scan_recurses_subdirectories() {
        let dir = setup_dir_with_files(&[
            ("root.wav", b"RIFF"),
            ("sub/deep.ogg", b"OggS"),
            ("sub/deeper/very.mp3", b"ID3"),
        ]);
        let result = scan_game_audio_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert_eq!(result.len(), 3);
    }

    #[tokio::test]
    async fn scan_returns_sorted_by_size_descending() {
        let dir = setup_dir_with_files(&[
            ("small.wav", b"s"),
            ("medium.wav", b"medium_content"),
            ("large.wav", b"this_is_a_much_larger_file_content"),
        ]);
        let result = scan_game_audio_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert_eq!(result.len(), 3);
        assert!(result[0].size_bytes >= result[1].size_bytes);
        assert!(result[1].size_bytes >= result[2].size_bytes);
    }

    #[tokio::test]
    async fn scan_empty_directory() {
        let dir = TempDir::new().unwrap();
        let result = scan_game_audio_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn scan_nonexistent_directory_returns_error() {
        let result = scan_game_audio_files("/nonexistent/path/xyz123".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn scan_audio_file_fields_are_correct() {
        let dir = setup_dir_with_files(&[("track.mp3", b"ID3data")]);
        let result = scan_game_audio_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert_eq!(result.len(), 1);
        let f = &result[0];
        assert_eq!(f.name, "track.mp3");
        assert_eq!(f.extension, "mp3");
        assert_eq!(f.size_bytes, 7);
        assert!(f.path.contains("track.mp3"));
    }

    #[tokio::test]
    async fn scan_file_without_extension_is_ignored() {
        let dir = setup_dir_with_files(&[
            ("noext", b"data"),
            ("valid.wav", b"RIFF"),
        ]);
        let result = scan_game_audio_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert_eq!(result.len(), 1);
    }

    // ── replace_audio_file ──────────────────────────────────────────────

    #[tokio::test]
    async fn replace_creates_backup_and_writes_new_file() {
        use base64::{Engine as _, engine::general_purpose};
        let dir = setup_dir_with_files(&[("voice.wav", b"original_audio_data")]);
        let original = dir.path().join("voice.wav");
        let new_data = general_purpose::STANDARD.encode(b"new_audio_data");

        let result = replace_audio_file(
            original.to_string_lossy().to_string(),
            new_data,
        ).await.unwrap();
        assert!(result);

        // Backup should exist
        let backup = dir.path().join("voice.wav.original");
        assert!(backup.exists());
        assert_eq!(fs::read(&backup).unwrap(), b"original_audio_data");

        // New file should contain decoded data
        assert_eq!(fs::read(&original).unwrap(), b"new_audio_data");
    }

    #[tokio::test]
    async fn replace_does_not_overwrite_existing_backup() {
        use base64::{Engine as _, engine::general_purpose};
        let dir = setup_dir_with_files(&[
            ("voice.wav", b"patched_v1"),
            ("voice.wav.original", b"truly_original"),
        ]);
        let original = dir.path().join("voice.wav");
        let new_data = general_purpose::STANDARD.encode(b"patched_v2");

        let result = replace_audio_file(
            original.to_string_lossy().to_string(),
            new_data,
        ).await.unwrap();
        assert!(result);

        // Backup should still contain the truly original data
        let backup = dir.path().join("voice.wav.original");
        assert_eq!(fs::read(&backup).unwrap(), b"truly_original");

        // New file should be patched_v2
        assert_eq!(fs::read(&original).unwrap(), b"patched_v2");
    }

    #[tokio::test]
    async fn replace_nonexistent_file_returns_error() {
        let result = replace_audio_file(
            "/nonexistent/file.wav".to_string(),
            "aGVsbG8=".to_string(),
        ).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn replace_invalid_base64_returns_error_and_does_not_lose_file() {
        let dir = setup_dir_with_files(&[("voice.wav", b"original")]);
        let original = dir.path().join("voice.wav");

        let result = replace_audio_file(
            original.to_string_lossy().to_string(),
            "!!!invalid-base64!!!".to_string(),
        ).await;
        assert!(result.is_err());

        // The original file should be restored via rollback
        // (backup was created then renamed back)
        assert!(original.exists() || dir.path().join("voice.wav.original").exists());
    }

    #[tokio::test]
    async fn replace_strips_data_uri_prefix() {
        use base64::{Engine as _, engine::general_purpose};
        let dir = setup_dir_with_files(&[("clip.wav", b"old")]);
        let original = dir.path().join("clip.wav");
        let payload = format!("data:audio/wav;base64,{}", general_purpose::STANDARD.encode(b"decoded_payload"));

        let result = replace_audio_file(
            original.to_string_lossy().to_string(),
            payload,
        ).await.unwrap();
        assert!(result);
        assert_eq!(fs::read(&original).unwrap(), b"decoded_payload");
    }

    // ── restore_audio_file ──────────────────────────────────────────────

    #[tokio::test]
    async fn restore_recovers_original_from_backup() {
        let dir = setup_dir_with_files(&[
            ("voice.wav", b"patched_data"),
            ("voice.wav.original", b"original_data"),
        ]);
        let original = dir.path().join("voice.wav");

        let result = restore_audio_file(original.to_string_lossy().to_string()).await.unwrap();
        assert!(result);

        // Original should be restored
        assert_eq!(fs::read(&original).unwrap(), b"original_data");
        // Backup should be gone
        assert!(!dir.path().join("voice.wav.original").exists());
    }

    #[tokio::test]
    async fn restore_without_backup_returns_error() {
        let dir = setup_dir_with_files(&[("voice.wav", b"data")]);
        let original = dir.path().join("voice.wav");

        let result = restore_audio_file(original.to_string_lossy().to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn restore_works_when_patched_file_already_deleted() {
        // Only backup exists, patched file was manually deleted
        let dir = setup_dir_with_files(&[
            ("voice.wav.original", b"original_data"),
        ]);
        let original = dir.path().join("voice.wav");

        let result = restore_audio_file(original.to_string_lossy().to_string()).await.unwrap();
        assert!(result);
        assert_eq!(fs::read(&original).unwrap(), b"original_data");
    }

    #[tokio::test]
    async fn restore_nonexistent_path_without_backup_returns_error() {
        let result = restore_audio_file("/nonexistent/path/file.wav".to_string()).await;
        assert!(result.is_err());
    }

    // ── Round-trip: replace then restore ────────────────────────────────

    #[tokio::test]
    async fn round_trip_replace_then_restore() {
        use base64::{Engine as _, engine::general_purpose};
        let dir = setup_dir_with_files(&[("dialogue.ogg", b"original_ogg_content")]);
        let original = dir.path().join("dialogue.ogg");
        let path_str = original.to_string_lossy().to_string();

        // Replace
        let b64 = general_purpose::STANDARD.encode(b"translated_content");
        replace_audio_file(path_str.clone(), b64).await.unwrap();
        assert_eq!(fs::read(&original).unwrap(), b"translated_content");

        // Restore
        restore_audio_file(path_str).await.unwrap();
        assert_eq!(fs::read(&original).unwrap(), b"original_ogg_content");
    }
}