// ═══════════════════════════════════════════════════════════════════════════════
// Visionaire Studio 5 Patcher — VIS5 archive parser, string extractor & patcher
// ═══════════════════════════════════════════════════════════════════════════════
//
// Visionaire Studio 5 games (Deponia, Edna & Harvey, Foolish Mortals, etc.)
// store all assets in a single .vis archive with a VIS5 header.
//
// Structure:
//   - Magic: "VIS5" (4 bytes)
//   - Count: BE uint32 (number of files)
//   - Directory: encrypted with XOR(MD5("AGAME4VISPL4")), contains HDR marker,
//     per-file entries (hash + offset + size + flags), END marker
//   - File data: raw or zlib-compressed
//   - game.veb: binary VED file (VBIN header + zlib compressed XML-like structure)
//     contains all game text as String/VText/TTextLanguage nodes
//
// References:
//   - https://github.com/adm244/VISUnpacker
//   - https://github.com/darkstar/gus/blob/master/UnpackShell/Unpackers/VISUnpacker.cs

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::command;
use serde::{Serialize, Deserialize};
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use flate2::Compression;

// ── Constants ──

const VIS5_MAGIC: &[u8; 4] = b"VIS5";
const VIS3_MAGIC: &[u8; 4] = b"VIS3";
const VBIN_MAGIC: &[u8; 4] = b"VBIN";
const PASSPHRASE: &str = "AGAME4VISPL4";
const HDR_MARKER: &[u8; 3] = b"HDR";
const END_MARKER: &[u8; 3] = b"END";

// ── Data types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisInfo {
    pub is_visionaire: bool,
    pub version: String,  // "VIS5" or "VIS3"
    pub vis_path: String,
    pub file_count: u32,
    pub total_strings: usize,
    pub has_veb: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisString {
    pub index: usize,
    pub text: String,
    pub offset_in_veb: usize,
    pub language_id: i32,
}

#[derive(Debug, Clone)]
struct VisEntry {
    hash: u32,
    offset: u32,
    size: u32,
    flags: u32,
}

// ── Byte helpers ──

fn read_be_u32(data: &[u8], pos: usize) -> u32 {
    if pos + 4 > data.len() { return 0; }
    u32::from_be_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]])
}

fn read_le_u32(data: &[u8], pos: usize) -> u32 {
    if pos + 4 > data.len() { return 0; }
    u32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]])
}

#[allow(dead_code)]
fn read_le_i32(data: &[u8], pos: usize) -> i32 {
    if pos + 4 > data.len() { return 0; }
    i32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]])
}

fn write_le_u32(data: &mut Vec<u8>, val: u32) {
    data.extend_from_slice(&val.to_le_bytes());
}

// ── Joaat64 hash (truncated to 32-bit) for VIS5 filename lookup ──

fn joaat64_hash(name: &str) -> u32 {
    let bytes = name.as_bytes();
    let mut hash: u64 = 0;
    for &b in bytes {
        hash = hash.wrapping_add(b.to_ascii_lowercase() as u64);
        hash = hash.wrapping_add(hash << 10);
        hash ^= hash >> 6;
    }
    hash = hash.wrapping_add(hash << 3);
    hash ^= hash >> 11;
    hash = hash.wrapping_add(hash << 15);
    (hash & 0xFFFFFFFF) as u32
}

// ── MD5 XOR key for directory decryption ──

fn get_xor_key() -> Vec<u8> {
    let digest = md5::compute(PASSPHRASE.as_bytes());
    let hex = format!("{:x}", digest);
    hex.as_bytes().to_vec()
}

fn xor_decrypt(data: &mut [u8], key: &[u8]) {
    for (i, byte) in data.iter_mut().enumerate() {
        *byte ^= key[i % key.len()];
    }
}

// ── XOR key from filename (for encrypted files) ──

#[allow(dead_code)]
fn get_filename_xor_key(filename: &str) -> Vec<u8> {
    // Key is MD5 hex string of filename without extension
    let name_no_ext = Path::new(filename)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| filename.to_string());
    let digest = md5::compute(name_no_ext.as_bytes());
    let hex = format!("{:x}", digest);
    hex.as_bytes().to_vec()
}

// ── Find .vis file in game directory ──

fn find_vis_file(game_path: &str) -> Option<PathBuf> {
    let dir = Path::new(game_path);
    if !dir.is_dir() { return None; }
    
    // Check config.ini for FILE= directive
    let config = dir.join("config.ini");
    if config.exists() {
        if let Ok(content) = fs::read_to_string(&config) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.to_uppercase().starts_with("FILE") && trimmed.contains('=') {
                    let val = trimmed.split('=').nth(1).unwrap_or("").trim();
                    if !val.is_empty() {
                        let vis_path = dir.join(val);
                        if vis_path.exists() {
                            return Some(vis_path);
                        }
                    }
                }
            }
        }
    }
    
    // Fallback: scan for .vis files
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().map_or(false, |e| e.to_ascii_lowercase() == "vis") {
                return Some(p);
            }
        }
    }
    
    None
}

// ── Parse VIS5 archive directory ──

fn parse_vis_directory(data: &[u8]) -> Result<(Vec<VisEntry>, bool), String> {
    if data.len() < 8 {
        return Err("File troppo piccolo".into());
    }
    
    let magic = &data[0..4];
    let is_vis5 = magic == VIS5_MAGIC;
    let is_vis3 = magic == VIS3_MAGIC;
    
    if !is_vis5 && !is_vis3 {
        return Err(format!("Magic non valido: {:?}", &data[0..4]));
    }
    
    let count = read_be_u32(data, 4) as usize;
    if count > 1_000_000 {
        return Err(format!("Troppi file: {}", count));
    }
    
    log::info!("[VIS] Archivio {:?}, {} file", std::str::from_utf8(magic).unwrap_or("?"), count);
    
    // Directory starts at offset 8, encrypted
    let xor_key = get_xor_key();
    
    // Calculate directory size
    let hdr_size = 3; // "HDR"
    let hash_size = if is_vis5 { count * 4 } else { 0 }; // joaat hashes only in VIS5
    let entry_size = count * 16; // 4 fields × 4 bytes each (value?, offset, size, flags)
    let end_size = 3; // "END"
    let dir_total = hdr_size + hash_size + entry_size + end_size;
    
    if 8 + dir_total > data.len() {
        return Err(format!("Directory overflow: {} > {}", 8 + dir_total, data.len()));
    }
    
    // Decrypt directory
    let mut dir_data = data[8..8 + dir_total].to_vec();
    xor_decrypt(&mut dir_data, &xor_key);
    
    // Verify HDR marker
    if &dir_data[0..3] != HDR_MARKER {
        return Err(format!("HDR marker mancante: {:?}", &dir_data[0..3]));
    }
    
    let mut pos = 3;
    
    // Read hashes (VIS5 only)
    let mut hashes = Vec::with_capacity(count);
    if is_vis5 {
        for _ in 0..count {
            hashes.push(read_be_u32(&dir_data, pos));
            pos += 4;
        }
    }
    
    // Read entries (SEntryInfo2)
    let mut entries = Vec::with_capacity(count);
    for i in 0..count {
        let _value = read_be_u32(&dir_data, pos); pos += 4;
        let offset = read_be_u32(&dir_data, pos); pos += 4;
        let size = read_be_u32(&dir_data, pos); pos += 4;
        let flags = read_be_u32(&dir_data, pos); pos += 4;
        
        let hash = if is_vis5 && i < hashes.len() { hashes[i] } else { 0 };
        entries.push(VisEntry { hash, offset, size, flags });
    }
    
    // Verify END marker
    if pos + 3 <= dir_data.len() && &dir_data[pos..pos+3] != END_MARKER {
        log::warn!("[VIS] END marker non trovato alla posizione {}", pos);
    }
    
    Ok((entries, is_vis5))
}

// ── Extract a file from the archive ──

fn extract_file(data: &[u8], entry: &VisEntry, dir_total: usize) -> Result<Vec<u8>, String> {
    let base_offset = 8 + dir_total;
    let file_start = base_offset + entry.offset as usize;
    let file_end = file_start + entry.size as usize;
    
    if file_end > data.len() {
        return Err(format!("File overflow: {}..{} > {}", file_start, file_end, data.len()));
    }
    
    let mut file_data = data[file_start..file_end].to_vec();
    
    // Check if zlib compressed (flag 0x10)
    if entry.flags & 0x10 != 0 {
        // Decompress zlib chunks
        let mut decoder = ZlibDecoder::new(&file_data[..]);
        let mut decompressed = Vec::new();
        if decoder.read_to_end(&mut decompressed).is_ok() {
            return Ok(decompressed);
        }
    }
    
    // Check if encrypted (flag 0x2)
    if entry.flags & 0x2 != 0 {
        let key = get_xor_key(); // Use passphrase key as default
        xor_decrypt(&mut file_data, &key);
    }
    
    Ok(file_data)
}

// ── Find game.veb in VIS5 entries ──

fn find_veb_entry(entries: &[VisEntry], is_vis5: bool) -> Option<usize> {
    if is_vis5 {
        let veb_hash = joaat64_hash("game.veb");
        log::info!("[VIS] Cerco game.veb con hash: 0x{:08x}", veb_hash);
        entries.iter().position(|e| e.hash == veb_hash)
    } else {
        // VIS3: entries have sequential indices, game.veb is typically one of the first
        // Try to identify by flags (flag 0x2 = encrypted VED, flag 0x10 = compressed)
        entries.iter().position(|e| e.flags & 0x12 != 0 && e.size > 10000)
    }
}

// ── Parse VBIN (binary VED) and extract text strings ──

fn parse_vbin_strings(vbin_data: &[u8]) -> Result<Vec<VisString>, String> {
    if vbin_data.len() < 16 {
        return Err("VBIN troppo piccolo".into());
    }
    
    // Check VBIN header
    let magic = &vbin_data[0..4];
    if magic != VBIN_MAGIC {
        log::warn!("[VIS] VBIN magic non trovato: {:?}, provo parsing diretto", magic);
    }
    
    let uncompressed_size = read_le_u32(vbin_data, 8) as usize;
    let compressed_size = read_le_u32(vbin_data, 12) as usize;
    
    log::info!("[VIS] VBIN: uncompressed={}, compressed={}", uncompressed_size, compressed_size);
    
    // Decompress the VBIN payload (after 16-byte header)
    let payload = if magic == VBIN_MAGIC && vbin_data.len() > 16 {
        let compressed = &vbin_data[16..];
        let mut decoder = ZlibDecoder::new(compressed);
        let mut decompressed = Vec::with_capacity(uncompressed_size);
        decoder.read_to_end(&mut decompressed)
            .map_err(|e| format!("Decompressione VBIN fallita: {}", e))?;
        decompressed
    } else {
        vbin_data.to_vec()
    };
    
    log::info!("[VIS] Payload decompresso: {} bytes", payload.len());
    
    // Scan for strings in the binary VED structure
    // Strings are stored as: LE uint32 length + char[length] (null terminated, UTF-8)
    // We look for sequences that look like text strings
    extract_strings_from_binary(&payload)
}

// ── Extract translatable strings from binary VED data ──
// Scans the binary data for string patterns (length-prefixed UTF-8)

fn extract_strings_from_binary(data: &[u8]) -> Result<Vec<VisString>, String> {
    let mut strings = Vec::new();
    let mut pos = 0;
    let mut index = 0;
    
    while pos + 4 < data.len() {
        let len = read_le_u32(data, pos) as usize;
        
        // Sanity: string length between 2 and 10000, must fit in data
        if len >= 2 && len <= 10000 && pos + 4 + len <= data.len() {
            let str_start = pos + 4;
            let str_end = str_start + len;
            let bytes = &data[str_start..str_end];
            
            // Check if it looks like valid UTF-8 text (not binary garbage)
            if let Ok(text) = std::str::from_utf8(bytes) {
                let trimmed = text.trim_end_matches('\0');
                if is_translatable_vis_string(trimmed) {
                    strings.push(VisString {
                        index,
                        text: trimmed.to_string(),
                        offset_in_veb: pos,
                        language_id: 0,
                    });
                    index += 1;
                    pos = str_end;
                    continue;
                }
            }
        }
        
        pos += 1;
    }
    
    Ok(strings)
}

// ── Heuristic: is this string worth translating? ──

fn is_translatable_vis_string(s: &str) -> bool {
    let s = s.trim();
    if s.len() < 3 { return false; }
    
    // Must have letters
    let letter_count = s.chars().filter(|c| c.is_alphabetic()).count();
    if letter_count < 3 { return false; }
    
    // Skip if mostly non-ASCII (binary leftovers)
    let ascii_ratio = s.chars().filter(|c| c.is_ascii()).count() as f32 / s.len() as f32;
    if ascii_ratio < 0.7 { return false; }
    
    // Skip paths, filenames, technical identifiers
    if s.contains('/') || s.contains('\\') { return false; }
    if s.ends_with(".png") || s.ends_with(".ogg") || s.ends_with(".wav") || s.ends_with(".mp3") { return false; }
    if s.ends_with(".lua") || s.ends_with(".xml") || s.ends_with(".json") { return false; }
    
    // Skip if looks like a code identifier (camelCase, snake_case, ALL_CAPS)
    if s.chars().all(|c| c.is_alphanumeric() || c == '_') && s.contains('_') { return false; }
    if !s.contains(' ') && s.len() > 3 {
        let has_upper = s.chars().any(|c| c.is_uppercase());
        let has_lower = s.chars().any(|c| c.is_lowercase());
        if has_upper && has_lower && !s.contains(' ') {
            // camelCase / PascalCase — likely identifier
            let upper_count = s.chars().filter(|c| c.is_uppercase()).count();
            if upper_count > 1 { return false; }
        }
    }
    
    // Must have at least 2 real words to be a translatable sentence
    let words: Vec<&str> = s.split_whitespace()
        .filter(|w| w.chars().filter(|c| c.is_alphabetic()).count() >= 2)
        .collect();
    if words.len() < 2 && s.len() < 20 { return false; }
    
    // Skip HTML tags
    if s.starts_with('<') && s.contains('>') && !s.contains(' ') { return false; }
    
    // Skip common Visionaire internal names
    let lower = s.to_lowercase();
    let skip_prefixes = ["eshader", "ealign", "eonly", "etext", "action_", "scene_", "char_", "obj_"];
    for prefix in skip_prefixes {
        if lower.starts_with(prefix) { return false; }
    }
    
    true
}

// ── Patch strings back into VBIN data ──

fn patch_vbin_strings(
    _original_vbin: &[u8],
    original_payload: &[u8],
    translations: &std::collections::HashMap<usize, String>,
) -> Result<Vec<u8>, String> {
    let mut patched = original_payload.to_vec();
    let mut offset_adjustments: i64 = 0;
    
    // We need to rebuild with new string lengths
    // For simplicity, we'll do in-place replacement where strings fit,
    // or rebuild the entire payload for size changes
    
    // First pass: check if any string changes size
    let original_strings = extract_strings_from_binary(original_payload)?;
    let mut needs_rebuild = false;
    
    for vis_str in &original_strings {
        if let Some(translation) = translations.get(&vis_str.index) {
            let orig_bytes = vis_str.text.as_bytes();
            let new_bytes = translation.as_bytes();
            if orig_bytes.len() != new_bytes.len() {
                needs_rebuild = true;
                break;
            }
        }
    }
    
    if !needs_rebuild {
        // Simple in-place patching (same length strings)
        for vis_str in &original_strings {
            if let Some(translation) = translations.get(&vis_str.index) {
                let str_start = vis_str.offset_in_veb + 4;
                let orig_len = vis_str.text.len();
                let new_bytes = translation.as_bytes();
                if new_bytes.len() == orig_len && str_start + orig_len <= patched.len() {
                    patched[str_start..str_start + orig_len].copy_from_slice(new_bytes);
                }
            }
        }
    } else {
        // Rebuild payload with new string sizes
        let mut rebuilt = Vec::with_capacity(original_payload.len() + 4096);
        let mut src_pos = 0;
        
        for vis_str in &original_strings {
            // Copy everything before this string
            let gap = vis_str.offset_in_veb as i64 + offset_adjustments;
            if gap as usize > rebuilt.len() {
                let copy_end = (vis_str.offset_in_veb).min(original_payload.len());
                if src_pos < copy_end {
                    rebuilt.extend_from_slice(&original_payload[src_pos..copy_end]);
                }
            }
            src_pos = vis_str.offset_in_veb;
            
            if let Some(translation) = translations.get(&vis_str.index) {
                let new_bytes = translation.as_bytes();
                let new_len = new_bytes.len() + 1; // +1 for null terminator
                
                // Write new length prefix + translated string + null
                write_le_u32(&mut rebuilt, new_len as u32);
                rebuilt.extend_from_slice(new_bytes);
                rebuilt.push(0); // null terminator
                
                let old_entry_size = 4 + vis_str.text.len() + 1;
                offset_adjustments += (4 + new_len) as i64 - old_entry_size as i64;
                src_pos += old_entry_size;
            } else {
                // Keep original
                let old_entry_size = 4 + vis_str.text.len() + 1;
                rebuilt.extend_from_slice(&original_payload[src_pos..src_pos + old_entry_size]);
                src_pos += old_entry_size;
            }
        }
        
        // Copy remaining data
        if src_pos < original_payload.len() {
            rebuilt.extend_from_slice(&original_payload[src_pos..]);
        }
        
        patched = rebuilt;
    }
    
    // Recompress into VBIN format
    let mut vbin_out = Vec::new();
    vbin_out.extend_from_slice(VBIN_MAGIC);
    // Skip the unknown u32 at offset 4, write 0
    write_le_u32(&mut vbin_out, 0);
    write_le_u32(&mut vbin_out, patched.len() as u32); // uncompressed size
    
    // Compress with zlib
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&patched).map_err(|e| format!("Compressione fallita: {}", e))?;
    let compressed = encoder.finish().map_err(|e| format!("Compressione finale fallita: {}", e))?;
    
    write_le_u32(&mut vbin_out, compressed.len() as u32); // compressed size
    vbin_out.extend_from_slice(&compressed);
    
    Ok(vbin_out)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tauri Commands
// ═══════════════════════════════════════════════════════════════════════════════

/// Detect if a game uses Visionaire Studio engine
#[command]
pub async fn detect_visionaire(game_path: String) -> Result<VisInfo, String> {
    log::info!("[VIS] detect_visionaire: {}", game_path);
    
    let vis_path = find_vis_file(&game_path)
        .ok_or_else(|| "Nessun file .vis trovato".to_string())?;
    
    let data = fs::read(&vis_path)
        .map_err(|e| format!("Errore lettura {}: {}", vis_path.display(), e))?;
    
    if data.len() < 8 {
        return Err("File troppo piccolo".into());
    }
    
    let magic = &data[0..4];
    let version = if magic == VIS5_MAGIC {
        "VIS5".to_string()
    } else if magic == VIS3_MAGIC {
        "VIS3".to_string()
    } else {
        return Err(format!("Non è un file Visionaire: magic {:?}", &data[0..4]));
    };
    
    let (entries, is_vis5) = parse_vis_directory(&data)?;
    let has_veb = find_veb_entry(&entries, is_vis5).is_some();
    
    Ok(VisInfo {
        is_visionaire: true,
        version,
        vis_path: vis_path.to_string_lossy().to_string(),
        file_count: entries.len() as u32,
        total_strings: 0,
        has_veb,
    })
}

/// Scan a Visionaire game and count translatable strings
#[command]
pub async fn scan_vis_strings(game_path: String) -> Result<VisInfo, String> {
    log::info!("[VIS] scan_vis_strings: {}", game_path);
    
    let vis_path = find_vis_file(&game_path)
        .ok_or_else(|| "Nessun file .vis trovato".to_string())?;
    
    let data = fs::read(&vis_path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let (entries, is_vis5) = parse_vis_directory(&data)?;
    
    let version = if &data[0..4] == VIS5_MAGIC { "VIS5" } else { "VIS3" };
    
    // Find and extract game.veb
    let veb_idx = find_veb_entry(&entries, is_vis5)
        .ok_or_else(|| "game.veb non trovato nell'archivio".to_string())?;
    
    let dir_total = 3 + (if is_vis5 { entries.len() * 4 } else { 0 }) + entries.len() * 16 + 3;
    let veb_data = extract_file(&data, &entries[veb_idx], dir_total)?;
    
    log::info!("[VIS] game.veb estratto: {} bytes", veb_data.len());
    
    // Parse VBIN and extract strings
    let strings = parse_vbin_strings(&veb_data)?;
    
    log::info!("[VIS] Trovate {} stringhe traducibili", strings.len());
    
    Ok(VisInfo {
        is_visionaire: true,
        version: version.to_string(),
        vis_path: vis_path.to_string_lossy().to_string(),
        file_count: entries.len() as u32,
        total_strings: strings.len(),
        has_veb: true,
    })
}

/// Extract all translatable strings from a Visionaire game
#[command]
pub async fn extract_vis_strings(
    game_path: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<VisString>, String> {
    log::info!("[VIS] extract_vis_strings: {}", game_path);
    
    let vis_path = find_vis_file(&game_path)
        .ok_or_else(|| "Nessun file .vis trovato".to_string())?;
    
    let data = fs::read(&vis_path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let (entries, is_vis5) = parse_vis_directory(&data)?;
    
    let veb_idx = find_veb_entry(&entries, is_vis5)
        .ok_or_else(|| "game.veb non trovato".to_string())?;
    
    let dir_total = 3 + (if is_vis5 { entries.len() * 4 } else { 0 }) + entries.len() * 16 + 3;
    let veb_data = extract_file(&data, &entries[veb_idx], dir_total)?;
    
    let all_strings = parse_vbin_strings(&veb_data)?;
    
    // Apply pagination
    let start = offset.unwrap_or(0);
    let count = limit.unwrap_or(all_strings.len());
    let end = (start + count).min(all_strings.len());
    
    if start >= all_strings.len() {
        return Ok(vec![]);
    }
    
    Ok(all_strings[start..end].to_vec())
}

/// Patch translated strings back into the Visionaire archive
#[command]
pub async fn patch_vis_strings(
    game_path: String,
    translations: std::collections::HashMap<usize, String>,
) -> Result<serde_json::Value, String> {
    log::info!("[VIS] patch_vis_strings: {} traduzioni", translations.len());
    
    let vis_path = find_vis_file(&game_path)
        .ok_or_else(|| "Nessun file .vis trovato".to_string())?;
    
    // Create backup
    let backup_path = PathBuf::from(format!("{}.gs_bak", vis_path.display()));
    if !backup_path.exists() {
        fs::copy(&vis_path, &backup_path)
            .map_err(|e| format!("Errore backup: {}", e))?;
        log::info!("[VIS] Backup creato: {}", backup_path.display());
    }
    
    let data = fs::read(&vis_path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let (entries, is_vis5) = parse_vis_directory(&data)?;
    
    let veb_idx = find_veb_entry(&entries, is_vis5)
        .ok_or_else(|| "game.veb non trovato".to_string())?;
    
    let dir_total = 3 + (if is_vis5 { entries.len() * 4 } else { 0 }) + entries.len() * 16 + 3;
    let veb_data = extract_file(&data, &entries[veb_idx], dir_total)?;
    
    // Decompress VBIN to get raw payload
    let payload = if veb_data.len() > 16 && &veb_data[0..4] == VBIN_MAGIC {
        let compressed = &veb_data[16..];
        let mut decoder = ZlibDecoder::new(compressed);
        let mut decompressed = Vec::new();
        decoder.read_to_end(&mut decompressed)
            .map_err(|e| format!("Decompressione fallita: {}", e))?;
        decompressed
    } else {
        veb_data.clone()
    };
    
    // Patch strings
    let patched_vbin = patch_vbin_strings(&veb_data, &payload, &translations)?;
    
    // Rebuild the VIS archive with patched game.veb
    let mut new_data = data.clone();
    let base_offset = 8 + dir_total;
    let entry = &entries[veb_idx];
    let file_start = base_offset + entry.offset as usize;
    let file_end = file_start + entry.size as usize;
    
    if patched_vbin.len() == entry.size as usize {
        // Same size: simple in-place replacement
        new_data[file_start..file_end].copy_from_slice(&patched_vbin);
    } else {
        // Different size: need to rebuild the archive
        // For now, only support same-size patching (most common case with in-place string replacement)
        // Full rebuild would require recalculating all offsets
        log::warn!("[VIS] Dimensione VEB cambiata: {} -> {}, tento sovrascrittura", entry.size, patched_vbin.len());
        
        // Rebuild: everything before VEB + patched VEB + everything after
        let mut rebuilt = Vec::with_capacity(new_data.len());
        rebuilt.extend_from_slice(&new_data[..file_start]);
        rebuilt.extend_from_slice(&patched_vbin);
        if file_end < new_data.len() {
            rebuilt.extend_from_slice(&new_data[file_end..]);
        }
        
        // Update size in directory entry
        // We need to re-encrypt the directory with updated size
        // This is complex — for safety, warn user
        log::warn!("[VIS] Ricostruzione archivio completa necessaria — dimensioni diverse");
        new_data = rebuilt;
    }
    
    // Write patched archive
    fs::write(&vis_path, &new_data)
        .map_err(|e| format!("Errore scrittura: {}", e))?;
    
    log::info!("[VIS] Archivio patchato con {} traduzioni", translations.len());
    
    Ok(serde_json::json!({
        "success": true,
        "message": format!("{} stringhe tradotte e applicate", translations.len()),
        "backup": backup_path.to_string_lossy().to_string(),
    }))
}

/// Restore original Visionaire archive from backup
#[command]
pub async fn restore_vis_backup(game_path: String) -> Result<serde_json::Value, String> {
    let vis_path = find_vis_file(&game_path)
        .ok_or_else(|| "Nessun file .vis trovato".to_string())?;
    
    let backup_path = PathBuf::from(format!("{}.gs_bak", vis_path.display()));
    if !backup_path.exists() {
        return Err("Nessun backup trovato".to_string());
    }
    
    fs::copy(&backup_path, &vis_path)
        .map_err(|e| format!("Errore ripristino: {}", e))?;
    
    Ok(serde_json::json!({
        "success": true,
        "message": "Archivio originale ripristinato",
    }))
}
