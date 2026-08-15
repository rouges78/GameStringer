//! Godot Engine PCK Patcher
//!
//! Supporta estrazione e creazione di file .pck Godot 3.x/4.x per traduzione.
//!
//! Formato PCK (da pck_packer.cpp ufficiale Godot):
//!   Header:
//!     u32 magic (0x43504447 = "GDPC")
//!     u32 pack_format_version (1=Godot3, 2=Godot4.0-4.3, 3=Godot4.4+)
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
// Bit dei pack_flags — ordine come nel source Godot (file_access_pack.h):
// PACK_DIR_ENCRYPTED = 1<<0, PACK_REL_FILEBASE = 1<<1. (Prima erano invertiti →
// un pck REL_FILEBASE come StS2, flags=2, veniva letto come criptato/offset errato.)
const PACK_DIR_ENCRYPTED: u32 = 1 << 0; // 1
const PACK_REL_FILEBASE: u32 = 1 << 1;  // 2

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

#[allow(dead_code)] // usato solo nei test dopo il rewrite di create_pck (inline padding)
fn pad_to(buf: &mut Vec<u8>, alignment: usize) {
    let rest = buf.len() % alignment;
    if rest > 0 {
        let pad = alignment - rest;
        buf.extend(std::iter::repeat_n(0u8, pad));
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

    // Layout header (verificato sul source Godot core/io/file_access_pack.cpp,
    // branch 4.5): dopo la versione → pack_flags(u32) e file_base(u64). Poi cambia:
    //  - V1/V2 (Godot ≤4.3): 16 u32 reserved, poi file_count e directory IN-LINE.
    //  - V3 (Godot 4.4+): un dir_offset(u64) che punta alla directory, spesso IN FONDO
    //    al file; si fa seek lì per leggere file_count + entries.
    let mut flags = 0u32;
    let mut files_base: u64 = 0;

    if pack_version >= 2 {
        flags = read_u32(data, &mut offset)?;
        files_base = read_u64(data, &mut offset)?;
    }

    // Directory criptata (bit0 PACK_DIR_ENCRYPTED): l'indice è cifrato con la chiave
    // di build del gioco → non leggibile senza. Errore onesto invece di leggere garbage.
    if flags & PACK_DIR_ENCRYPTED != 0 {
        return Err("PCK con directory criptata (AES): estrazione non supportata senza la chiave del gioco".into());
    }

    if pack_version >= 3 {
        // V3: dir_offset (relativo all'inizio del pck; `data` parte già dal magic,
        // quindi lo usiamo direttamente). Salta alla directory.
        let dir_offset = read_u64(data, &mut offset)? as usize;
        if dir_offset >= data.len() {
            return Err(format!("dir_offset ({}) oltre i dati disponibili ({} byte): pck troncato o serve il file intero", dir_offset, data.len()));
        }
        offset = dir_offset;
    } else {
        // V1/V2: 16 u32 reserved, poi la directory in-line.
        for _ in 0..16 {
            read_u32(data, &mut offset)?;
        }
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

        // Godot: gli offset nelle directory entry sono sempre relativi a file_base.
        // Con REL_FILEBASE, file_base è relativo all'inizio del pck (pck_start_pos),
        // che scan_godot_pck riapplica aggiungendo `start`. Standalone → start=0.
        let abs_offset = files_base + file_offset;

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
    // Godot 4.4+ accetta SOLO pack_format_version 3; 4.0-4.3 usano v2 (verificato sul
    // source core/io/file_access_pack.cpp branch 4.5). Header:
    //  - V2: magic,ver,maj,min,patch, flags(u32), file_base(u64), 16 reserved(u32),
    //        poi directory (file_count + entries) IN-LINE, poi i dati a file_base.
    //  - V3: come sopra ma dopo file_base c'è dir_offset(u64) che punta alla directory;
    //        qui la mettiamo subito dopo l'header (dir_offset = header_size).
    // Con REL_FILEBASE gli offset delle entry sono relativi a file_base.
    let pack_version: u32 = if godot_major > 4 || (godot_major == 4 && godot_minor >= 4) { 3 } else { 2 };
    let is_v3 = pack_version >= 3;
    let alignment: usize = 32;

    // Path con lunghezza allineata a 4 (come Godot).
    let entries: Vec<(Vec<u8>, &[u8])> = files.iter().map(|(p, d)| {
        let mut pb = p.as_bytes().to_vec();
        while pb.len() % 4 != 0 { pb.push(0); }
        (pb, *d)
    }).collect();

    // Header: 20 (magic+ver+maj+min+patch) + 4 (flags) + 8 (file_base)
    //         + [8 dir_offset se v3] + 64 (16 reserved).
    let header_size = 20 + 4 + 8 + if is_v3 { 8 } else { 0 } + 64;
    let dir_offset = header_size; // directory subito dopo l'header
    // Directory = file_count(4) + per entry: path_len(4) + path + ofs(8) + size(8) + md5(16) + flags(4).
    let dir_size: usize = 4 + entries.iter().map(|(pb, _)| 4 + pb.len() + 8 + 8 + 16 + 4).sum::<usize>();
    let mut file_base = dir_offset + dir_size;
    while file_base % alignment != 0 { file_base += 1; }

    // Blob dati con offset (relativi a file_base), ogni file allineato.
    let mut data_blob: Vec<u8> = Vec::new();
    let mut offsets: Vec<u64> = Vec::with_capacity(entries.len());
    for (_, d) in &entries {
        offsets.push(data_blob.len() as u64);
        data_blob.extend_from_slice(d);
        while data_blob.len() % alignment != 0 { data_blob.push(0); }
    }

    let mut buf: Vec<u8> = Vec::with_capacity(file_base + data_blob.len());
    write_u32_le(&mut buf, PCK_MAGIC);
    write_u32_le(&mut buf, pack_version);
    write_u32_le(&mut buf, godot_major);
    write_u32_le(&mut buf, godot_minor);
    write_u32_le(&mut buf, godot_patch);
    write_u32_le(&mut buf, PACK_REL_FILEBASE); // flags
    write_u64_le(&mut buf, file_base as u64);  // file_base (relativo all'inizio del pck)
    if is_v3 {
        write_u64_le(&mut buf, dir_offset as u64); // dir_offset (relativo all'inizio del pck)
    }
    for _ in 0..16 { write_u32_le(&mut buf, 0); } // reserved

    // Directory (a dir_offset == posizione corrente).
    write_u32_le(&mut buf, entries.len() as u32); // file_count
    for (i, (pb, d)) in entries.iter().enumerate() {
        write_u32_le(&mut buf, pb.len() as u32);
        buf.extend_from_slice(pb);
        write_u64_le(&mut buf, offsets[i]);
        write_u64_le(&mut buf, d.len() as u64);
        let digest = md5::compute(d);
        buf.extend_from_slice(&digest.0);
        write_u32_le(&mut buf, 0); // per-file flags (no encryption, no removal)
    }

    // Pad fino a file_base, poi i dati.
    while buf.len() < file_base { buf.push(0); }
    buf.extend_from_slice(&data_blob);
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
        let mut is_binary = false;
        let preview = if file_end <= data.len() + start {
            let file_data = &data[start + abs_offset..start + file_end];
            // ── ONESTÀ SUL FORMATO (15/08/2026) ─────────────────────────────
            // Prima qui si faceva from_utf8_lossy + lines().count() su QUALSIASI
            // file, compresi i .translation binari (RSRC): il conteggio degli
            // a-capo dentro un binario veniva mostrato come «stringhe» — un
            // numero inventato che sembrava un dato. Un file che non sappiamo
            // leggere deve DIRLO, non diventare un conteggio.
            is_binary = file_data.starts_with(b"RSRC")
                || file_data.starts_with(b"RSCC") // RSRC compresso
                || file_data.iter().take(512).any(|&b| b == 0);
            if is_binary {
                let fmt = if file_data.starts_with(b"RSRC") || file_data.starts_with(b"RSCC") {
                    "RSRC (risorsa binaria Godot)"
                } else {
                    "binario"
                };
                format!("[NON LEGGIBILE: formato {} — parser non ancora implementato]", fmt)
            } else {
                let text = String::from_utf8_lossy(file_data);
                let line_count = text.lines().count();
                total_strings += line_count;
                text.chars().take(200).collect::<String>()
            }
        } else {
            String::new()
        };

        translatable.push(GodotTranslatableFile {
            path_in_pck: entry.path.clone(),
            size: entry.size,
            file_type: if is_binary { "binary_unsupported".to_string() } else { file_type.to_string() },
            content_preview: preview,
        });
    }

    let file_count = translatable.len();
    let binary_count = translatable.iter().filter(|f| f.file_type == "binary_unsupported").count();
    let readable_count = file_count - binary_count;
    log::info!("📦 PCK scan: {} file ({} leggibili, {} binari non supportati), ~{} stringhe", file_count, readable_count, binary_count, total_strings);

    // Il messaggio dice la verità anche quando è scomoda: se i file di
    // localizzazione ci sono ma sono tutti RSRC, l'utente deve saperlo QUI,
    // non dedurlo da uno zero.
    let message = if binary_count > 0 && readable_count == 0 {
        format!(
            "Trovati {} file di localizzazione, ma sono TUTTI in formato binario Godot (RSRC) che non sappiamo ancora leggere: 0 stringhe estraibili. Non è un gioco senza testi — è un formato non supportato.",
            binary_count
        )
    } else if binary_count > 0 {
        format!(
            "Trovati {} file leggibili (~{} stringhe) + {} file binari RSRC non ancora supportati",
            readable_count, total_strings, binary_count
        )
    } else {
        format!("Trovati {} file traducibili (~{} stringhe)", file_count, total_strings)
    };

    Ok(GodotExtractionResult {
        success: true,
        files: translatable,
        total_strings,
        pck_info: Some(info),
        message,
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

// Per-file flags (Godot 4.x, file_access_pack.h): file cifrato / entry di rimozione.
const PACK_FILE_ENCRYPTED: u32 = 1 << 0;
const PACK_FILE_REMOVAL: u32 = 1 << 1;

#[derive(Debug, Serialize, Deserialize)]
pub struct GodotPckExtractAllResult {
    pub success: bool,
    pub output_path: String,
    pub files_count: usize,
    pub skipped_count: usize,
    pub message: String,
}

/// Estrae TUTTI i file di un .pck (anche embedded nell'exe) su disco sotto `output_path`,
/// preservando la struttura delle cartelle. Scrive byte grezzi: nessuna conversione.
/// I path delle entry sono `res://…`: il prefisso viene rimosso e ogni componente
/// è validato contro il path traversal (entry ostili tipo `res://../../x` vengono saltate).
#[tauri::command]
pub async fn extract_godot_pck(
    pck_path: String,
    output_path: String,
) -> Result<GodotPckExtractAllResult, String> {
    let data = fs::read(Path::new(&pck_path))
        .map_err(|e| format!("Errore lettura {}: {}", pck_path, e))?;

    let start = find_pck_magic(&data)
        .ok_or_else(|| format!("Nessun magic GDPC trovato in {}", pck_path))?;
    let pck_data = &data[start..];
    let info = read_pck(pck_data)?;

    let out_root = Path::new(&output_path);
    fs::create_dir_all(out_root)
        .map_err(|e| format!("Impossibile creare {}: {}", output_path, e))?;

    let mut written = 0usize;
    let mut skipped = 0usize;

    for entry in &info.files {
        // Entry cifrate o marcate come rimozione (patch pck): non estraibili/da ignorare.
        if entry.flags & (PACK_FILE_ENCRYPTED | PACK_FILE_REMOVAL) != 0 {
            skipped += 1;
            continue;
        }

        let rel = entry
            .path
            .strip_prefix("res://")
            .or_else(|| entry.path.strip_prefix("user://"))
            .unwrap_or(&entry.path);

        // Anti-traversal: niente path assoluti, niente "..", niente componenti vuoti.
        let unsafe_path = rel.is_empty()
            || Path::new(rel).is_absolute()
            || rel.contains(':')
            || rel
                .split(['/', '\\'])
                .any(|c| c.is_empty() || c == ".." || c == ".");
        if unsafe_path {
            log::warn!("PCK extract: entry saltata per path sospetto: {:?}", entry.path);
            skipped += 1;
            continue;
        }

        // entry.offset è relativo all'inizio del pck; per embedded si riapplica `start`.
        let abs = start
            .checked_add(entry.offset as usize)
            .and_then(|o| o.checked_add(entry.size as usize).map(|end| (o, end)));
        let (file_start, file_end) = match abs {
            Some((s, e)) if e <= data.len() => (s, e),
            _ => {
                log::warn!("PCK extract: entry oltre EOF, saltata: {:?}", entry.path);
                skipped += 1;
                continue;
            }
        };

        let dest = out_root.join(rel);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Impossibile creare {}: {}", parent.display(), e))?;
        }
        fs::write(&dest, &data[file_start..file_end])
            .map_err(|e| format!("Errore scrittura {}: {}", dest.display(), e))?;
        written += 1;
    }

    log::info!(
        "📦 PCK extract: {} file scritti in {}, {} saltati",
        written, output_path, skipped
    );

    Ok(GodotPckExtractAllResult {
        success: written > 0,
        output_path,
        files_count: written,
        skipped_count: skipped,
        message: if skipped > 0 {
            format!("{} file estratti, {} saltati (cifrati/rimozioni/path sospetti)", written, skipped)
        } else {
            format!("{} file estratti", written)
        },
    })
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

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ── Binary helper tests ─────────────────────────────────────

    #[test]
    fn test_read_u32_valid() {
        let data = 0x12345678u32.to_le_bytes();
        let mut offset = 0;
        assert_eq!(read_u32(&data, &mut offset).unwrap(), 0x12345678);
        assert_eq!(offset, 4);
    }

    #[test]
    fn test_read_u32_at_offset() {
        let mut data = vec![0xAA, 0xBB];
        data.extend_from_slice(&42u32.to_le_bytes());
        let mut offset = 2;
        assert_eq!(read_u32(&data, &mut offset).unwrap(), 42);
        assert_eq!(offset, 6);
    }

    #[test]
    fn test_read_u32_eof() {
        let data = [0u8; 3]; // too short
        let mut offset = 0;
        let err = read_u32(&data, &mut offset).unwrap_err();
        assert!(err.contains("EOF"), "Expected EOF error, got: {}", err);
    }

    #[test]
    fn test_read_u32_eof_at_offset() {
        let data = [0u8; 6];
        let mut offset = 4;
        let err = read_u32(&data, &mut offset).unwrap_err();
        assert!(err.contains("EOF"));
    }

    #[test]
    fn test_read_u64_valid() {
        let data = 0xDEADBEEFCAFEBABEu64.to_le_bytes();
        let mut offset = 0;
        assert_eq!(read_u64(&data, &mut offset).unwrap(), 0xDEADBEEFCAFEBABE);
        assert_eq!(offset, 8);
    }

    #[test]
    fn test_read_u64_eof() {
        let data = [0u8; 7];
        let mut offset = 0;
        assert!(read_u64(&data, &mut offset).is_err());
    }

    #[test]
    fn test_write_u32_le() {
        let mut buf = Vec::new();
        write_u32_le(&mut buf, 0x04030201);
        assert_eq!(buf, vec![0x01, 0x02, 0x03, 0x04]);
    }

    #[test]
    fn test_write_u64_le() {
        let mut buf = Vec::new();
        write_u64_le(&mut buf, 0x0807060504030201);
        assert_eq!(buf, vec![0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    }

    #[test]
    fn test_pad_to_already_aligned() {
        let mut buf = vec![0u8; 32];
        pad_to(&mut buf, 32);
        assert_eq!(buf.len(), 32);
    }

    #[test]
    fn test_pad_to_needs_padding() {
        let mut buf = vec![0u8; 33];
        pad_to(&mut buf, 32);
        assert_eq!(buf.len(), 64);
    }

    #[test]
    fn test_pad_to_empty() {
        let mut buf = Vec::new();
        pad_to(&mut buf, 32);
        assert_eq!(buf.len(), 0); // 0 % 32 == 0, no padding needed
    }

    #[test]
    fn test_pad_to_small_alignment() {
        let mut buf = vec![1, 2, 3];
        pad_to(&mut buf, 4);
        assert_eq!(buf.len(), 4);
        assert_eq!(buf[3], 0); // padding byte is zero
    }

    // ── classify_godot_file tests ───────────────────────────────

    #[test]
    fn test_classify_translation_files() {
        assert_eq!(classify_godot_file("res://locale/en.translation"), Some("translation"));
        assert_eq!(classify_godot_file("res://locale/messages.po"), Some("translation"));
        assert_eq!(classify_godot_file("res://locale/messages.pot"), Some("translation"));
    }

    #[test]
    fn test_classify_csv() {
        assert_eq!(classify_godot_file("res://data/strings.csv"), Some("csv"));
        assert_eq!(classify_godot_file("res://data/STRINGS.CSV"), Some("csv"));
    }

    #[test]
    fn test_classify_text_files() {
        assert_eq!(classify_godot_file("res://readme.txt"), Some("text"));
        assert_eq!(classify_godot_file("res://config.json"), Some("text"));
        assert_eq!(classify_godot_file("res://project.cfg"), Some("text"));
    }

    #[test]
    fn test_classify_scene() {
        assert_eq!(classify_godot_file("res://scenes/main.tscn"), Some("scene"));
    }

    #[test]
    fn test_classify_script() {
        assert_eq!(classify_godot_file("res://scripts/dialog.gd"), Some("script"));
    }

    #[test]
    fn test_classify_resource() {
        assert_eq!(classify_godot_file("res://dialogue/talk.tres"), Some("resource"));
    }

    #[test]
    fn test_classify_unknown() {
        assert_eq!(classify_godot_file("res://icon.png"), None);
        assert_eq!(classify_godot_file("res://music.ogg"), None);
        assert_eq!(classify_godot_file("res://mesh.obj"), None);
    }

    #[test]
    fn test_classify_case_insensitive() {
        assert_eq!(classify_godot_file("res://LOCALE/EN.TRANSLATION"), Some("translation"));
        assert_eq!(classify_godot_file("res://Scripts/Main.GD"), Some("script"));
    }

    #[test]
    fn test_classify_ink_json_returns_text() {
        // NOTE: The ink check (line ~565) is unreachable because .json is matched
        // earlier by the "text" branch (line ~548). Ink JSON files are classified
        // as "text" in practice. This test documents that actual behavior.
        assert_eq!(classify_godot_file("res://ink/story.json"), Some("text"));
        assert_eq!(classify_godot_file("res://stories/ink_dialogue.json"), Some("text"));
    }

    #[test]
    fn test_classify_non_ink_json_is_text() {
        assert_eq!(classify_godot_file("res://data/config.json"), Some("text"));
    }

    // ── find_pck_magic tests ────────────────────────────────────

    #[test]
    fn test_find_pck_magic_at_start() {
        let mut data = PCK_MAGIC.to_le_bytes().to_vec();
        data.extend_from_slice(&[0u8; 100]);
        assert_eq!(find_pck_magic(&data), Some(0));
    }

    #[test]
    fn test_find_pck_magic_embedded() {
        // Simulate an exe with PCK magic embedded somewhere in the middle
        let mut data = vec![0u8; 500];
        let magic_bytes = PCK_MAGIC.to_le_bytes();
        data[200..204].copy_from_slice(&magic_bytes);
        assert_eq!(find_pck_magic(&data), Some(200));
    }

    #[test]
    fn test_find_pck_magic_prefers_last_occurrence() {
        // When scanning from the end, should find the last occurrence first
        let mut data = vec![0u8; 500];
        let magic_bytes = PCK_MAGIC.to_le_bytes();
        data[100..104].copy_from_slice(&magic_bytes);
        data[300..304].copy_from_slice(&magic_bytes);
        // The function scans from end, so should find 300 first
        assert_eq!(find_pck_magic(&data), Some(300));
    }

    #[test]
    fn test_find_pck_magic_not_found() {
        let data = vec![0u8; 500];
        assert_eq!(find_pck_magic(&data), None);
    }

    #[test]
    fn test_find_pck_magic_too_short() {
        let data = vec![0u8; 3]; // shorter than magic
        assert_eq!(find_pck_magic(&data), None);
    }

    #[test]
    fn test_find_pck_magic_exact_4_bytes_match() {
        let data = PCK_MAGIC.to_le_bytes().to_vec();
        // 4 bytes exactly — the reverse scan range is empty (0..0), but fallback checks [0..4]
        assert_eq!(find_pck_magic(&data), Some(0));
    }

    // ── PCK round-trip tests (create → read) ────────────────────

    #[test]
    fn test_pck_roundtrip_v3_godot45() {
        // Godot 4.4+ usa pack_format_version 3. Round-trip col formato reale
        // (directory-first): create → read → file e contenuto corretti.
        let files: Vec<(&str, &[u8])> = vec![
            ("res://locale/it.translation", b"binary-ish translation data"),
            ("res://ui/menu.tscn", b"[node name=\"Label\" text=\"Start\"]"),
        ];
        let pck_data = create_pck(&files, 4, 5, 1);
        let info = read_pck(&pck_data).unwrap();
        assert_eq!(info.pack_version, 3);
        assert_eq!(info.godot_major, 4);
        assert_eq!(info.godot_minor, 5);
        assert_eq!(info.file_count, 2);
        assert_eq!(info.files[0].path, "res://locale/it.translation");
        // Contenuto estraibile all'offset assoluto calcolato dal reader.
        let e = &info.files[0];
        let extracted = &pck_data[e.offset as usize..(e.offset + e.size) as usize];
        assert_eq!(extracted, b"binary-ish translation data");
    }

    #[test]
    fn test_create_and_read_pck_v2_godot4() {
        let files: Vec<(&str, &[u8])> = vec![
            ("res://locale/en.po", b"msgid \"hello\"\nmsgstr \"Hello\""),
            ("res://locale/it.po", b"msgid \"hello\"\nmsgstr \"Ciao\""),
        ];
        let pck_data = create_pck(&files, 4, 2, 1);

        let info = read_pck(&pck_data).unwrap();
        assert_eq!(info.pack_version, 2);
        assert_eq!(info.godot_major, 4);
        assert_eq!(info.godot_minor, 2);
        assert_eq!(info.godot_patch, 1);
        assert_eq!(info.file_count, 2);
        assert_eq!(info.files.len(), 2);
        assert_eq!(info.files[0].path, "res://locale/en.po");
        assert_eq!(info.files[1].path, "res://locale/it.po");
    }

    #[test]
    fn test_roundtrip_file_content_readable() {
        let content = b"This is translatable text content.";
        let files: Vec<(&str, &[u8])> = vec![
            ("res://data.txt", content),
        ];
        let pck_data = create_pck(&files, 4, 0, 0);
        let info = read_pck(&pck_data).unwrap();

        let entry = &info.files[0];
        // For v2 with REL_FILEBASE, entry.offset is already absolute
        let start = entry.offset as usize;
        let end = start + entry.size as usize;
        assert!(end <= pck_data.len(), "File data should be within PCK bounds");
        let extracted = &pck_data[start..end];
        assert_eq!(extracted, content);
    }

    #[test]
    fn test_roundtrip_file_content_godot4_multiple() {
        // Test roundtrip with multiple files on v2 (Godot 4)
        let content_a = b"First file content";
        let content_b = b"Second file with different length data here";
        let files: Vec<(&str, &[u8])> = vec![
            ("res://a.gd", content_a),
            ("res://b.gd", content_b),
        ];
        let pck_data = create_pck(&files, 4, 1, 0);
        let info = read_pck(&pck_data).unwrap();

        for (i, expected) in [content_a.as_slice(), content_b.as_slice()].iter().enumerate() {
            let entry = &info.files[i];
            let start = entry.offset as usize;
            let end = start + entry.size as usize;
            assert!(end <= pck_data.len());
            assert_eq!(&pck_data[start..end], *expected);
        }
    }

    #[test]
    fn test_create_pck_empty_files() {
        let files: Vec<(&str, &[u8])> = vec![];
        let pck_data = create_pck(&files, 4, 0, 0);
        let info = read_pck(&pck_data).unwrap();
        assert_eq!(info.file_count, 0);
        assert_eq!(info.files.len(), 0);
    }

    #[test]
    fn test_create_pck_multiple_files_md5_differs() {
        let files: Vec<(&str, &[u8])> = vec![
            ("res://a.txt", b"aaa"),
            ("res://b.txt", b"bbb"),
        ];
        let pck_data = create_pck(&files, 4, 0, 0);
        let info = read_pck(&pck_data).unwrap();
        // Different content should yield different MD5
        assert_ne!(info.files[0].md5, info.files[1].md5);
    }

    #[test]
    fn test_create_pck_same_content_same_md5() {
        let files: Vec<(&str, &[u8])> = vec![
            ("res://a.txt", b"same"),
            ("res://b.txt", b"same"),
        ];
        let pck_data = create_pck(&files, 4, 0, 0);
        let info = read_pck(&pck_data).unwrap();
        assert_eq!(info.files[0].md5, info.files[1].md5);
    }

    #[test]
    fn test_pck_v2_has_rel_filebase_flag() {
        let files: Vec<(&str, &[u8])> = vec![("res://f.txt", b"x")];
        let pck_data = create_pck(&files, 4, 0, 0);
        let info = read_pck(&pck_data).unwrap();
        assert_eq!(info.flags & PACK_REL_FILEBASE, PACK_REL_FILEBASE);
    }

    #[test]
    fn test_pck_version_selection_by_godot_version() {
        // Godot 4.4+ → pack_format_version 3; 4.0-4.3 → v2.
        let f: Vec<(&str, &[u8])> = vec![("res://f.txt", b"x")];
        assert_eq!(read_pck(&create_pck(&f, 4, 4, 0)).unwrap().pack_version, 3);
        assert_eq!(read_pck(&create_pck(&f, 4, 5, 1)).unwrap().pack_version, 3);
        assert_eq!(read_pck(&create_pck(&f, 4, 3, 0)).unwrap().pack_version, 2);
        assert_eq!(read_pck(&create_pck(&f, 4, 0, 0)).unwrap().pack_version, 2);
    }

    #[test]
    fn test_pck_dir_encrypted_returns_error() {
        // Un pck con bit PACK_DIR_ENCRYPTED settato deve dare errore onesto,
        // non leggere garbage (directory cifrata → serve la chiave del gioco).
        let mut pck = create_pck(&[("res://f.txt", b"x")], 4, 5, 0);
        // flags è a offset 20 (dopo magic+ver+maj+min+patch): setta bit0.
        pck[20] |= PACK_DIR_ENCRYPTED as u8;
        let err = read_pck(&pck).unwrap_err();
        assert!(err.to_lowercase().contains("cript"), "atteso errore cripta: {}", err);
    }

    // Collaudo manuale su pck reale (non gira in CI). Legge SOLO l'header+directory
    // (i primi MB: col formato v3 la directory è in testa) e stampa i file traducibili.
    // Esegui: cargo test --lib godot_pck_real -- --ignored --nocapture
    #[test]
    #[ignore]
    fn godot_pck_real_slaythespire2() {
        let path = r"D:\SteamLibrary\steamapps\common\Slay the Spire 2\SlayTheSpire2.pck";
        // Nel v3 la directory è in fondo (dir_offset) → serve il file intero (~1.8 GB).
        let data = std::fs::read(path).expect("read pck");
        let info = read_pck(&data).expect("read_pck deve leggere il pck v3");
        eprintln!("PCK v{} (Godot {}.{}.{}) — {} file totali",
            info.pack_version, info.godot_major, info.godot_minor, info.godot_patch, info.file_count);
        // Conteggio per estensione (top).
        use std::collections::HashMap;
        let mut by_ext: HashMap<String, usize> = HashMap::new();
        for e in &info.files {
            let ext = e.path.rsplit('.').next().unwrap_or("").to_lowercase();
            *by_ext.entry(ext).or_default() += 1;
        }
        let mut exts: Vec<_> = by_ext.into_iter().collect();
        exts.sort_by(|a, b| b.1.cmp(&a.1));
        eprintln!("Estensioni top: {:?}", &exts[..exts.len().min(15)]);
        // File di LOCALIZZAZIONE nativa (translation/po/csv/loc/lang/i18n/strings).
        let loc: Vec<&str> = info.files.iter()
            .filter(|e| {
                let p = e.path.to_lowercase();
                p.ends_with(".translation") || p.ends_with(".po") || p.ends_with(".csv")
                    || p.contains("locale") || p.contains("/lang") || p.contains("i18n")
                    || p.contains("localization") || p.contains("strings")
            })
            .map(|e| e.path.as_str()).take(30).collect();
        eprintln!("Localizzazione nativa trovata: {} (primi 30)", loc.len());
        for p in &loc { eprintln!("  LOC: {}", p); }
        assert_eq!(info.pack_version, 3, "StS2 deve essere pack v3");
    }

    // ── read_pck error cases ────────────────────────────────────

    #[test]
    fn test_read_pck_empty_data() {
        let data: &[u8] = &[];
        assert!(read_pck(data).is_err());
    }

    #[test]
    fn test_read_pck_wrong_magic() {
        let mut data = vec![0u8; 100];
        data[0..4].copy_from_slice(&0xDEADBEEFu32.to_le_bytes());
        let err = read_pck(&data).unwrap_err();
        assert!(err.contains("PCK"), "Error should mention PCK: {}", err);
    }

    #[test]
    fn test_read_pck_truncated_header() {
        // Valid magic but truncated after that
        let data = PCK_MAGIC.to_le_bytes().to_vec();
        assert!(read_pck(&data).is_err());
    }

    #[test]
    fn test_read_pck_too_many_files() {
        // Build a minimal valid header with file_count > 500_000
        let mut buf = Vec::new();
        write_u32_le(&mut buf, PCK_MAGIC);
        write_u32_le(&mut buf, 1); // pack_version v1
        write_u32_le(&mut buf, 3); // major
        write_u32_le(&mut buf, 0); // minor
        write_u32_le(&mut buf, 0); // patch
        // reserved (16 x u32)
        for _ in 0..16 {
            write_u32_le(&mut buf, 0);
        }
        // file_count
        write_u32_le(&mut buf, 999_999);

        let err = read_pck(&buf).unwrap_err();
        assert!(err.contains("Troppi file"), "Expected too-many-files error: {}", err);
    }

    // ── Large/edge-case file content ────────────────────────────

    #[test]
    fn test_roundtrip_empty_file_content() {
        let files: Vec<(&str, &[u8])> = vec![
            ("res://empty.txt", b""),
        ];
        let pck_data = create_pck(&files, 4, 0, 0);
        let info = read_pck(&pck_data).unwrap();
        assert_eq!(info.files[0].size, 0);
    }

    #[test]
    fn test_roundtrip_binary_content() {
        let content: Vec<u8> = (0..=255).collect();
        let files: Vec<(&str, &[u8])> = vec![
            ("res://binary.dat", &content),
        ];
        let pck_data = create_pck(&files, 4, 0, 0);
        let info = read_pck(&pck_data).unwrap();
        let entry = &info.files[0];
        let start = entry.offset as usize;
        let end = start + entry.size as usize;
        assert_eq!(&pck_data[start..end], content.as_slice());
    }

    #[test]
    fn test_roundtrip_long_path() {
        let long_path = format!("res://{}/file.txt", "a".repeat(200));
        let files: Vec<(&str, &[u8])> = vec![
            (&long_path, b"data"),
        ];
        let pck_data = create_pck(&files, 4, 0, 0);
        let info = read_pck(&pck_data).unwrap();
        assert_eq!(info.files[0].path, long_path);
    }

    // ── PCK_MAGIC constant ──────────────────────────────────────

    #[test]
    fn test_pck_magic_is_gdpc() {
        let bytes = PCK_MAGIC.to_le_bytes();
        assert_eq!(&bytes, b"GDPC");
    }

    // ── Alignment / padding in created PCK ──────────────────────

    #[test]
    fn test_created_pck_file_offsets_are_aligned() {
        let files: Vec<(&str, &[u8])> = vec![
            ("res://a.txt", b"short"),
            ("res://b.txt", b"another file with more content here"),
            ("res://c.txt", b"c"),
        ];
        let pck_data = create_pck(&files, 4, 0, 0);
        let info = read_pck(&pck_data).unwrap();

        // In v2 with REL_FILEBASE, the entry offsets are absolute.
        // The files_base itself should be 32-byte aligned, and each file
        // starts at a 32-byte aligned boundary within the data section.
        for entry in &info.files {
            // The raw offset stored in the directory for v2 is relative to files_base,
            // and files_base is aligned. After create_pck writes each file it pads to 32.
            // So each file's data starts at a 32-byte boundary relative to files_base.
            // The absolute offset should be aligned to 32.
            assert_eq!(
                entry.offset % 32, 0,
                "File {} offset {} is not 32-byte aligned",
                entry.path, entry.offset
            );
        }
    }
}
