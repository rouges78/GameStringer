//! Lettura READ-ONLY dell'header di `global-metadata.dat` (Unity IL2CPP).
//!
//! Non estrae né riscrive stringhe: legge solo i primi 8 byte del file di
//! metadata IL2CPP per (1) confermare che un gioco è davvero IL2CPP e (2)
//! ricavare la **versione di metadata**, che è ciò che determina se BepInEx
//! IL2CPP riesce ad agganciarsi — non la versione di Unity.
//!
//! Formato (invariato da anni, cfr. Il2CppDumper):
//!   offset 0: u32 magic  = 0xFAB11BAF  (su disco little-endian: AF 1B B1 FA)
//!   offset 4: i32 version (24, 27, 29, 31, …) — solo il "major"; le
//!             sotto-versioni (24.1, 24.2…) non stanno nell'header.

use std::path::{Path, PathBuf};

/// Magic dell'header global-metadata.dat.
pub const IL2CPP_METADATA_MAGIC: u32 = 0xFAB1_1BAF;

/// Versione di metadata più recente su cui il percorso BepInEx 6 IL2CPP
/// (v6.0.0-pre.2 + XUnity IL2CPP) è stato verificato funzionare.
///
/// - v24 → Unity 2019.3–2020.x · v27 → Unity 2021.x · v29 → Unity 2022.x
/// - v31 → Unity 2023 / Unity 6 → NON ancora agganciabile da BepInEx pre.2
///
/// Oltre questa soglia rifiutiamo l'installazione BepInEx e indirizziamo al
/// percorso asset (Unity CSV) o all'OCR, riportando la versione REALE invece
/// di indovinare dalla stringa "6000.x" di Unity.
pub const MAX_SUPPORTED_METADATA_VERSION: i32 = 29;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Il2CppMetadataInfo {
    /// Path del global-metadata.dat trovato.
    pub path: String,
    /// Versione major di metadata (dal campo header).
    pub version: i32,
    /// true se `version <= MAX_SUPPORTED_METADATA_VERSION`.
    pub bepinex_supported: bool,
}

/// Cerca `global-metadata.dat` sotto una directory di gioco Unity.
/// Percorso canonico: `<Game>_Data/il2cpp_data/Metadata/global-metadata.dat`,
/// ma la cartella `*_Data` ha nome variabile, quindi la scandiamo.
pub fn find_global_metadata(game_dir: &Path) -> Option<PathBuf> {
    // 1) Percorso diretto se qualcuno passa già la _Data
    let direct = game_dir
        .join("il2cpp_data")
        .join("Metadata")
        .join("global-metadata.dat");
    if direct.is_file() {
        return Some(direct);
    }

    // 2) Trova la cartella <nome>_Data e guarda dentro
    let entries = std::fs::read_dir(game_dir).ok()?;
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() && p.file_name().map(|n| n.to_string_lossy().ends_with("_Data")).unwrap_or(false) {
            let candidate = p.join("il2cpp_data").join("Metadata").join("global-metadata.dat");
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

/// Legge magic + versione dai primi 8 byte. Ritorna la versione se il magic è
/// valido; `None` se il file è troppo corto o il magic non corrisponde (quindi
/// non è un global-metadata.dat IL2CPP).
pub fn read_metadata_version(bytes: &[u8]) -> Option<i32> {
    if bytes.len() < 8 {
        return None;
    }
    let magic = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    if magic != IL2CPP_METADATA_MAGIC {
        return None;
    }
    let version = i32::from_le_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]);
    Some(version)
}

/// Rileva e apre il metadata IL2CPP di un gioco, restituendo versione e verdetto
/// di supporto BepInEx. `None` se il gioco non è IL2CPP (nessun metadata valido).
pub fn detect_il2cpp_metadata(game_dir: &Path) -> Option<Il2CppMetadataInfo> {
    let path = find_global_metadata(game_dir)?;
    // Bastano 8 byte: leggiamo solo l'header, non l'intero file (può essere MB).
    let mut buf = [0u8; 8];
    {
        use std::io::Read;
        let mut f = std::fs::File::open(&path).ok()?;
        if f.read_exact(&mut buf).is_err() {
            return None;
        }
    }
    let version = read_metadata_version(&buf)?;
    Some(Il2CppMetadataInfo {
        path: path.to_string_lossy().to_string(),
        version,
        bepinex_supported: version <= MAX_SUPPORTED_METADATA_VERSION,
    })
}

/// Comando Tauri: ritorna versione metadata IL2CPP + verdetto BepInEx per un
/// gioco. `Ok(None)` = non è IL2CPP (o metadata non leggibile).
#[tauri::command]
pub async fn get_il2cpp_metadata_version(game_path: String) -> Result<Option<Il2CppMetadataInfo>, String> {
    let dir = Path::new(&game_path);
    if !dir.exists() {
        return Err(format!("Percorso non trovato: {}", game_path));
    }
    Ok(detect_il2cpp_metadata(dir))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn header(magic: u32, version: i32) -> Vec<u8> {
        let mut v = Vec::new();
        v.extend_from_slice(&magic.to_le_bytes());
        v.extend_from_slice(&version.to_le_bytes());
        v
    }

    #[test]
    fn reads_valid_version() {
        let buf = header(IL2CPP_METADATA_MAGIC, 29);
        assert_eq!(read_metadata_version(&buf), Some(29));
    }

    #[test]
    fn rejects_bad_magic() {
        let buf = header(0x1234_5678, 29);
        assert_eq!(read_metadata_version(&buf), None);
    }

    #[test]
    fn rejects_short_buffer() {
        assert_eq!(read_metadata_version(&[0xAF, 0x1B, 0xB1]), None);
    }

    #[test]
    fn magic_on_disk_is_little_endian() {
        // I primi byte su disco devono essere AF 1B B1 FA.
        let buf = header(IL2CPP_METADATA_MAGIC, 24);
        assert_eq!(&buf[0..4], &[0xAF, 0x1B, 0xB1, 0xFA]);
    }

    #[test]
    fn support_ceiling_flags_unity6_metadata() {
        // v29 (Unity 2022) supportato; v31 (Unity 6) no.
        assert!(29 <= MAX_SUPPORTED_METADATA_VERSION);
        assert!(31 > MAX_SUPPORTED_METADATA_VERSION);
    }

    #[test]
    fn detect_reads_from_data_folder() {
        let tmp = tempfile::TempDir::new().unwrap();
        let meta_dir = tmp.path().join("MyGame_Data").join("il2cpp_data").join("Metadata");
        std::fs::create_dir_all(&meta_dir).unwrap();
        std::fs::write(meta_dir.join("global-metadata.dat"), header(IL2CPP_METADATA_MAGIC, 27)).unwrap();

        let info = detect_il2cpp_metadata(tmp.path()).expect("metadata IL2CPP non rilevato");
        assert_eq!(info.version, 27);
        assert!(info.bepinex_supported);
    }

    #[test]
    fn detect_none_when_not_il2cpp() {
        let tmp = tempfile::TempDir::new().unwrap();
        std::fs::create_dir_all(tmp.path().join("MyGame_Data")).unwrap();
        assert!(detect_il2cpp_metadata(tmp.path()).is_none());
    }
}
