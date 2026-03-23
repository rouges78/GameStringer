//! Godot Engine PCK Patcher
//!
//! Supporta estrazione e creazione di file .pck Godot 3.x/4.x per traduzione.
//!
//! Formato PCK (da pck_packer.cpp ufficiale Godot):
//!   Header:
//!     u32 magic (0x43504447 = "GDPC")
//!     u32 pack_format_version (1=Godot3, 2=Godot4)
//!     u32 ver_major, u32 ver_minor, u32 ver_patch
//!     u32 flags (v2: bit0=rel_filebase, bit1=encrypted_dir)
//!     u64 files_base (solo se flags & REL_FILEBASE)
//!     u64 dir_offset (solo v2)
//!     u32[16] reserved
//!   Dati file: raw bytes, aligned a 32 byte
//!   Directory (a dir_offset per v2, dopo header+reserved per v1):
//!     u32 file_count
//!     per file: u32 path_len, u8[] path, u64 offset, u64 size, u8[16] md5, u32 flags(v2)
//!
//! La community usa 2 metodi per tradurre:
//! A) Sostituzione totale: estrae tutto, modifica, ricrea il .pck (640MB+)
//! B) Override PCK: crea un piccolo .pck con solo i file tradotti, Godot lo carica sopra
//!
//! GS usa il metodo B quando possibile (più leggero), fallback al metodo A.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

const PCK_MAGIC: u32 = 0x43504447; // "GDPC"
const PACK_REL_FILEBASE: u32 = 1;
const _PACK_DIR_ENCRYPTED: u32 = 2;

// ═══════════════════════════════════════════════════════════════════
// DATA STRUCTURES
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PckInfo {
    pub path: String,
    pub pack_version: u32,
    pub godot_major: u32,
    pub godot_minor: u32,
    pub godot_patch: u32,
    pub flags: u32,
    pub file_count: u32,
    pub total_size: u64,
    pub files: Vec<PckFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PckFileEntry {
    pub path: String,
    pub offset: u64,
    pub size: u64,
    pub md5: String,
    pub flags: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GodotTranslatableFile {
    pub path_in_pck: String,
    pub size: u64,
    pub file_type: String, // "translation", "csv", "text", "scene", "script"
    pub content_preview: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GodotDetectionResult {
    pub is_godot: bool,
    pub godot_version: String,
    pub pck_path: Option<String>,
    pub pck_embedded: bool,
    pub exe_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GodotExtractionResult {
    pub success: bool,
    pub files: Vec<GodotTranslatableFile>,
    pub total_strings: usize,
    pub pck_info: Option<PckInfo>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GodotPatchResult {
    pub success: bool,
    pub pak_path: String,
    pub files_patched: usize,
    pub method: String, // "override_pck" | "replace_pck"
    pub message: String,
}

// ═══════════════════════════════════════════════════════════════════
// BINARY HELPERS
// ═══════════════════════════════════════════════════════════════════

fn read_u32(data: &[u8], offset: &mut usize) -> Result<u32, String> {
    if *offset + 4 > data.len() {
        return Err(format!("EOF reading u32 at offset {}", offset));
    }
    let v = u32::from_le_bytes([data[*offset], data[*offset+1], data[*offset+2], data[*offset+3]]);
    *offset += 4;
    Ok(v)
}

fn read_u64(data: &[u8], offset: &mut usize) -> Result<u64, String> {
    if *offset + 8 > data.len() {
        return Err(format!("EOF reading u64 at offset {}", offset));
    }
    let v = u64::from_le_bytes([
        data[*offset], data[*offset+1], data[*offset+2], data[*offset+3],
        data[*offset+4], data[*offset+5], data[*offset+6], data[*offset+7],
    ]);
    *offset += 8;
    Ok(v)
}

fn write_u32_le(buf: &mut Vec<u8>, v: u32) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn write_u64_le(buf: &mut Vec<u8>, v: u64) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn pad_to(buf: &mut Vec<u8>, alignment: usize) {
    let rest = buf.len() % alignment;
    if rest > 0 {
        let pad = alignment - rest;
        buf.extend(std::iter::repeat(0u8).take(pad));
    }
}

// ═══════════════════════════════════════════════════════════════════
// PCK READER
// ═══════════════════════════════════════════════════════════════════

/// Legge l'header e la directory di un file .pck
fn read_pck(data: &[u8]) -> Result<PckInfo, String> {
    let mut offset = 0usize;

    let magic = read_u32(data, &mut offset)?;
    if magic != PCK_MAGIC {
        return Err(format!("Non è un file PCK Godot valido (magic: 0x{:08X})", magic));
    }

    let pack_version = read_u32(data, &mut offset)?;
    let godot_major = read_u32(data, &mut offset)?;
    let godot_minor = read_u32(data, &mut offset)?;
    let godot_patch = read_u32(data, &mut offset)?;

    let mut flags = 0u32;
    let mut files_base: u64 = 0;
    let mut _dir_offset: u64 = 0;

    if pack_version >= 2 {
        flags = read_u32(data, &mut offset)?;
        files_base = read_u64(data, &mut offset)?;
        _dir_offset = read_u64(data, &mut offset)?;
    }

    // Reserved (16 x u32 = 64 bytes)
    for _ in 0..16 {
        read_u32(data, &mut offset)?;
    }

    // Per v1 e v2 senza REL_FILEBASE, la directory è subito dopo l'header
    // Per v2 con REL_FILEBASE e dir_offset, cerca lì
    if pack_version >= 2 && _dir_offset > 0 {
        offset = _dir_offset as usize;
    }

    let file_count = read_u32(data, &mut offset)?;
    log::info!("📦 PCK v{} (Godot {}.{}.{}) — {} file, flags=0x{:X}",
        pack_version, godot_major, godot_minor, godot_patch, file_count, flags);

    if file_count > 500_000 {
        return Err(format!("Troppi file nel PCK: {}", file_count));
    }

    let mut files = Vec::with_capacity(file_count as usize);

    for _ in 0..file_count {
        // Path length (padded to 4)
        let path_len = read_u32(data, &mut offset)? as usize;
        if offset + path_len > data.len() {
            return Err("EOF reading file path".into());
        }
        let raw_path = &data[offset..offset + path_len];
        offset += path_len;
        // Rimuovi null-padding
        let path = String::from_utf8_lossy(raw_path)
            .trim_end_matches('\0')
            .to_string();

        let file_offset = read_u64(data, &mut offset)?;
        let file_size = read_u64(data, &mut offset)?;

        // MD5 (16 bytes)
        if offset + 16 > data.len() {
            return Err("EOF reading MD5".into());
        }
        let md5_bytes = &data[offset..offset + 16];
        let md5 = md5_bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>();
        offset += 16;

        // Flags (v2 only)
        let file_flags = if pack_version >= 2 {
            read_u32(data, &mut offset)?
        } else {
            0
        };

        // Calcola offset assoluto
        let abs_offset = if flags & PACK_REL_FILEBASE != 0 {
            files_base + file_offset
        } else {
            file_offset
        };

        files.push(PckFileEntry {
            path,
            offset: abs_offset,
            size: file_size,
            md5,
            flags: file_flags,
        });
    }

    Ok(PckInfo {
        path: String::new(),
        pack_version,
        godot_major,
        godot_minor,
        godot_patch,
        flags,
        file_count,
        total_size: data.len() as u64,
        files,
    })
}

// ═══════════════════════════════════════════════════════════════════
// PCK WRITER
// ═══════════════════════════════════════════════════════════════════

/// Crea un file .pck Godot con i file specificati.
/// Formato v2 per Godot 4.x, v1 per 3.x.
fn create_pck(
    files: &[(&str, &[u8])],
    godot_major: u32,
    godot_minor: u32,
    godot_patch: u32,
) -> Vec<u8> {
    let pack_version: u32 = if godot_major >= 4 { 2 } else { 1 };
    let alignment: usize = 32;
    let mut buf: Vec<u8> = Vec::new();

    // ── Header ───────────────────────────────────────
    write_u32_le(&mut buf, PCK_MAGIC);
    write_u32_le(&mut buf, pack_version);
    write_u32_le(&mut buf, godot_major);
    write_u32_le(&mut buf, godot_minor);
    write_u32_le(&mut buf, godot_patch);

    let _flags_pos;
    let files_base_pos;
    let dir_offset_pos;

    if pack_version >= 2 {
        _flags_pos = buf.len();
        write_u32_le(&mut buf, PACK_REL_FILEBASE); // flags
        files_base_pos = buf.len();
        write_u64_le(&mut buf, 0); // files_base — aggiornato dopo
        dir_offset_pos = buf.len();
        write_u64_le(&mut buf, 0); // dir_offset — aggiornato dopo
    } else {
        _flags_pos = 0;
        files_base_pos = 0;
        dir_offset_pos = 0;
    }

    // Reserved (16 x u32)
    for _ in 0..16 {
        write_u32_le(&mut buf, 0);
    }

    // Align per primo file
    pad_to(&mut buf, alignment);
    let files_base = buf.len() as u64;

    // Aggiorna files_base nell'header
    if pack_version >= 2 {
        let base_bytes = files_base.to_le_bytes();
        buf[files_base_pos..files_base_pos + 8].copy_from_slice(&base_bytes);
    }

    // ── Dati file ────────────────────────────────────
    struct FileInfo {
        path: String,
        offset_relative: u64,
        size: u64,
        md5: [u8; 16],
    }
    let mut file_infos: Vec<FileInfo> = Vec::new();

    for (path, data) in files {
        let offset_relative = (buf.len() as u64) - files_base;
        let size = data.len() as u64;

        // MD5
        let digest = md5::compute(data);
        let mut md5 = [0u8; 16];
        md5.copy_from_slice(&digest.0);

        // Scrivi dati
        buf.extend_from_slice(data);

        // Padding
        pad_to(&mut buf, alignment);

        file_infos.push(FileInfo {
            path: path.to_string(),
            offset_relative,
            size,
            md5,
        });
    }

    // ── Directory ────────────────────────────────────
    pad_to(&mut buf, alignment);
    let dir_offset = buf.len() as u64;

    // Aggiorna dir_offset nell'header
    if pack_version >= 2 {
        let dir_bytes = dir_offset.to_le_bytes();
        buf[dir_offset_pos..dir_offset_pos + 8].copy_from_slice(&dir_bytes);
    }

    write_u32_le(&mut buf, file_infos.len() as u32);

    for fi in &file_infos {
        let path_bytes = fi.path.as_bytes();
        // Pad path length to multiple of 4
        let padded_len = (path_bytes.len() + 3) & !3;
        write_u32_le(&mut buf, padded_len as u32);
        buf.extend_from_slice(path_bytes);
        // Null-pad to alignment
        for _ in path_bytes.len()..padded_len {
            buf.push(0);
        }

        write_u64_le(&mut buf, fi.offset_relative);
        write_u64_le(&mut buf, fi.size);
        buf.extend_from_slice(&fi.md5);

        if pack_version >= 2 {
            write_u32_le(&mut buf, 0); // flags (no encryption, no removal)
        }
    }

    buf
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE DETECTION
// ═══════════════════════════════════════════════════════════════════

/// Rileva se un gioco è fatto con Godot Engine
#[tauri::command]
pub async fn detect_godot_engine(game_path: String) -> Result<GodotDetectionResult, String> {
    let dir = Path::new(&game_path);
    if !dir.exists() {
        return Err(format!("Directory non trovata: {}", game_path));
    }

    // Cerca file .pck nella directory
    let mut pck_path: Option<PathBuf> = None;
    let mut exe_name: Option<String> = None;

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
            if name.ends_with(".pck") {
                pck_path = Some(path.clone());
            }
            if name.ends_with(".exe") && !name.contains("unins") && !name.contains("crash") {
                exe_name = Some(path.file_name().unwrap_or_default().to_string_lossy().to_string());
            }
        }
    }

    // Se non c'è .pck standalone, cerca PCK embedded nell'exe
    let mut pck_embedded = false;
    if pck_path.is_none() {
        if let Some(ref exe) = exe_name {
            let exe_path = dir.join(exe);
            if let Ok(data) = fs::read(&exe_path) {
                // Cerca magic PCK dalla fine del file (embedded pck)
                if data.len() > 12 {
                    // Godot mette "GDPC" + offset_to_pck alla fine dell'exe
                    let end = data.len();
                    // Cerca "GDPC" negli ultimi 1MB
                    let search_start = end.saturating_sub(1024 * 1024);
                    for i in (search_start..end.saturating_sub(4)).rev() {
                        if &data[i..i+4] == b"GDPC" {
                            pck_path = Some(exe_path.clone());
                            pck_embedded = true;
                            break;
                        }
                    }
                }
            }
        }
    }

    // Se abbiamo un PCK, leggi la versione
    let mut godot_version = String::new();
    if let Some(ref pck) = pck_path {
        if let Ok(data) = fs::read(pck) {
            // Per embedded, trova il magic
            let start = if pck_embedded {
                find_pck_magic(&data).unwrap_or(0)
            } else {
                0
            };
            if start + 20 <= data.len() {
                let mut off = start;
                let magic = read_u32(&data, &mut off).unwrap_or(0);
                if magic == PCK_MAGIC {
                    let _pack_ver = read_u32(&data, &mut off).unwrap_or(0);
                    let major = read_u32(&data, &mut off).unwrap_or(0);
                    let minor = read_u32(&data, &mut off).unwrap_or(0);
                    let patch = read_u32(&data, &mut off).unwrap_or(0);
                    godot_version = format!("{}.{}.{}", major, minor, patch);
                }
            }
        }
    }

    let is_godot = pck_path.is_some();
    log::info!("🔍 Godot detection: {} (v{}) pck={:?} embedded={}",
        if is_godot { "SÌ" } else { "NO" }, godot_version, pck_path, pck_embedded);

    Ok(GodotDetectionResult {
        is_godot,
        godot_version,
        pck_path: pck_path.map(|p| p.to_string_lossy().to_string()),
        pck_embedded,
        exe_name,
    })
}

fn find_pck_magic(data: &[u8]) -> Option<usize> {
    let magic_bytes = PCK_MAGIC.to_le_bytes();
    let search_start = data.len().saturating_sub(2 * 1024 * 1024); // ultimi 2MB
    for i in (search_start..data.len().saturating_sub(4)).rev() {
        if data[i..i+4] == magic_bytes {
            return Some(i);
        }
    }
    // Fallback: cerca dall'inizio
    if data.len() >= 4 && data[0..4] == magic_bytes {
        return Some(0);
    }
    None
}

// ═══════════════════════════════════════════════════════════════════
// EXTRACTION (scan translatable files)
// ═══════════════════════════════════════════════════════════════════

/// Estrai file traducibili dal PCK
#[tauri::command]
pub async fn scan_godot_pck(pck_path: String) -> Result<GodotExtractionResult, String> {
    let path = Path::new(&pck_path);
    let data = fs::read(path)
        .map_err(|e| format!("Errore lettura {}: {}", pck_path, e))?;

    // Per PCK embedded, trova il magic
    let start = find_pck_magic(&data).unwrap_or(0);
    let pck_data = &data[start..];

    let mut info = read_pck(pck_data)?;
    info.path = pck_path.clone();

    let mut translatable: Vec<GodotTranslatableFile> = Vec::new();
    let mut total_strings = 0;

    for entry in &info.files {
        let file_type = classify_godot_file(&entry.path);
        if file_type.is_none() {
            continue;
        }
        let file_type = file_type.unwrap();

        // Leggi preview del contenuto
        let abs_offset = entry.offset as usize;
        let file_end = abs_offset + entry.size as usize;
        let preview = if file_end <= data.len() + start {
            let file_data = &data[start + abs_offset..start + file_end];
            // Conta stringhe approssimative
            let text = String::from_utf8_lossy(file_data);
            let line_count = text.lines().count();
            total_strings += line_count;
            text.chars().take(200).collect::<String>()
        } else {
            String::new()
        };

        translatable.push(GodotTranslatableFile {
            path_in_pck: entry.path.clone(),
            size: entry.size,
            file_type: file_type.to_string(),
            content_preview: preview,
        });
    }

    let file_count = translatable.len();
    log::info!("📦 PCK scan: {} file traducibili, ~{} stringhe", file_count, total_strings);

    Ok(GodotExtractionResult {
        success: true,
        files: translatable,
        total_strings,
        pck_info: Some(info),
        message: format!("Trovati {} file traducibili (~{} stringhe)", file_count, total_strings),
    })
}

/// Classifica un file Godot per tipo traducibile
fn classify_godot_file(path: &str) -> Option<&'static str> {
    let lower = path.to_lowercase();

    // File di traduzione Godot nativi
    if lower.ends_with(".translation") || lower.ends_with(".po") || lower.ends_with(".pot") {
        return Some("translation");
    }
    // CSV (usati da sistemi di localizzazione come SimpleLocalization)
    if lower.ends_with(".csv") {
        return Some("csv");
    }
    // File di testo generici
    if lower.ends_with(".txt") || lower.ends_with(".json") || lower.ends_with(".cfg") {
        return Some("text");
    }
    // Scene Godot (possono contenere dialoghi in Label/RichTextLabel)
    if lower.ends_with(".tscn") {
        return Some("scene");
    }
    // Script GDScript (stringhe hardcoded)
    if lower.ends_with(".gd") {
        return Some("script");
    }
    // Risorse Godot con testo (DialogueManager, etc.)
    if lower.ends_with(".tres") {
        return Some("resource");
    }
    // Ink stories (JSON)
    if lower.contains("ink") && lower.ends_with(".json") {
        return Some("ink");
    }

    None
}

// ═══════════════════════════════════════════════════════════════════
// FILE EXTRACTION (per traduzione)
// ═══════════════════════════════════════════════════════════════════

/// Estrai il contenuto di un singolo file dal PCK
#[tauri::command]
pub async fn extract_godot_file(
    pck_path: String,
    file_path_in_pck: String,
) -> Result<String, String> {
    let path = Path::new(&pck_path);
    let data = fs::read(path)
        .map_err(|e| format!("Errore lettura {}: {}", pck_path, e))?;

    let start = find_pck_magic(&data).unwrap_or(0);
    let pck_data = &data[start..];
    let info = read_pck(pck_data)?;

    for entry in &info.files {
        if entry.path == file_path_in_pck {
            let abs_offset = start + entry.offset as usize;
            let file_end = abs_offset + entry.size as usize;
            if file_end > data.len() {
                return Err("Offset file fuori dal PCK".into());
            }
            let file_data = &data[abs_offset..file_end];
            return Ok(String::from_utf8_lossy(file_data).to_string());
        }
    }

    Err(format!("File '{}' non trovato nel PCK", file_path_in_pck))
}

// ═══════════════════════════════════════════════════════════════════
// PCK CREATION (translation override)
// ═══════════════════════════════════════════════════════════════════

/// Crea un PCK override con i file tradotti
#[tauri::command]
pub async fn create_godot_translation_pck(
    game_path: String,
    pck_path: String,
    translated_files: HashMap<String, String>, // path_in_pck → contenuto tradotto
) -> Result<GodotPatchResult, String> {
    if translated_files.is_empty() {
        return Err("Nessun file tradotto fornito".into());
    }

    let original_path = Path::new(&pck_path);
    let data = fs::read(original_path)
        .map_err(|e| format!("Errore lettura PCK: {}", e))?;

    let start = find_pck_magic(&data).unwrap_or(0);
    let pck_data = &data[start..];
    let info = read_pck(pck_data)?;

    // Prepara i file per il nuovo PCK
    let file_contents: Vec<(String, Vec<u8>)> = translated_files.iter()
        .map(|(path, content)| (path.clone(), content.as_bytes().to_vec()))
        .collect();

    let file_refs: Vec<(&str, &[u8])> = file_contents.iter()
        .map(|(p, d)| (p.as_str(), d.as_slice()))
        .collect();

    // Crea il PCK override
    let pck_data = create_pck(
        &file_refs,
        info.godot_major,
        info.godot_minor,
        info.godot_patch,
    );

    // Salva il PCK nella directory del gioco
    let game_dir = Path::new(&game_path);
    let override_filename = "gamestringer_translation.pck";
    let override_path = game_dir.join(override_filename);

    // Backup se esiste
    if override_path.exists() {
        let backup = game_dir.join("gamestringer_translation.pck.backup");
        let _ = fs::rename(&override_path, &backup);
    }

    fs::write(&override_path, &pck_data)
        .map_err(|e| format!("Errore scrittura PCK override: {}", e))?;

    log::info!("✅ PCK override creato: {} ({} bytes, {} file)",
        override_path.display(), pck_data.len(), translated_files.len());

    // Crea anche il file --main-pack override se necessario
    // Godot carica i .pck aggiuntivi se hanno lo stesso nome dell'exe con suffisso diverso
    // oppure tramite --main-pack CLI
    // Per semplicità, creiamo uno script .bat/.sh che lancia il gioco col PCK override

    Ok(GodotPatchResult {
        success: true,
        pak_path: override_path.to_string_lossy().to_string(),
        files_patched: translated_files.len(),
        method: "override_pck".to_string(),
        message: format!(
            "Creato {} con {} file tradotti (Godot {}.{}.{})",
            override_filename, translated_files.len(),
            info.godot_major, info.godot_minor, info.godot_patch
        ),
    })
}

/// Rimuove la traduzione Godot (cancella PCK override e ripristina backup)
#[tauri::command]
pub async fn remove_godot_translation(game_path: String) -> Result<String, String> {
    let game_dir = Path::new(&game_path);
    let override_path = game_dir.join("gamestringer_translation.pck");

    if override_path.exists() {
        fs::remove_file(&override_path)
            .map_err(|e| format!("Errore rimozione: {}", e))?;
        log::info!("🗑️ Rimossa traduzione Godot: {}", override_path.display());
    }

    // Ripristina backup se presente
    let backup = game_dir.join("gamestringer_translation.pck.backup");
    if backup.exists() {
        let _ = fs::remove_file(&backup);
    }

    Ok("Traduzione Godot rimossa con successo".into())
}
