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

use std::fs::{self, File};
use std::io::{Read, Write, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::command;
use serde::{Serialize, Deserialize};
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use crate::commands::encoding_utils;

// ── Global VBIN cache — avoids re-reading and decompressing 5MB+61MB on every paginated call ──

struct VbinCache {
    vis_path: String,
    strings: Vec<VisString>,
}

static VBIN_CACHE: once_cell::sync::Lazy<Mutex<Option<VbinCache>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(None));

fn get_cached_strings(vis_path: &str) -> Option<Vec<VisString>> {
    let cache = VBIN_CACHE.lock().ok()?;
    if let Some(ref c) = *cache {
        if c.vis_path == vis_path {
            return Some(c.strings.clone());
        }
    }
    None
}

fn set_cached_strings(vis_path: &str, strings: Vec<VisString>) {
    if let Ok(mut cache) = VBIN_CACHE.lock() {
        *cache = Some(VbinCache {
            vis_path: vis_path.to_string(),
            strings,
        });
    }
}

fn invalidate_cache() {
    if let Ok(mut cache) = VBIN_CACHE.lock() {
        *cache = None;
    }
}

// ── Constants ──

const VIS5_MAGIC: &[u8; 4] = b"VIS5";
const VIS3_MAGIC: &[u8; 4] = b"VIS3";
const VBIN_MAGIC: &[u8; 4] = b"VBIN";
#[allow(dead_code)]
const PASSPHRASE: &str = "AGAME4VISPL4";
#[allow(dead_code)]
const HDR_MARKER: &[u8; 3] = b"HDR";
#[allow(dead_code)]
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

#[allow(dead_code)]
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

#[allow(dead_code)]
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

#[allow(dead_code)]
fn get_xor_key() -> Vec<u8> {
    let digest = md5::compute(PASSPHRASE.as_bytes());
    digest.0.to_vec()
}

#[allow(dead_code)]
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
            if p.extension().is_some_and(|e| e.eq_ignore_ascii_case("vis")) {
                return Some(p);
            }
        }
    }
    
    None
}

// ── Scan .vis file for VBIN magic (brute-force) ──
// The VIS5 directory entry layout differs from documentation.
// Instead of parsing entries, we scan the archive for the VBIN magic directly.
// game.veb is the only VBIN block in a .vis archive.

#[derive(Debug)]
struct VbinLocation {
    offset: u64,         // absolute offset of VBIN header in .vis file
    _unknown: u32,       // unknown field at VBIN+4
    uncompressed: usize, // uncompressed payload size
    compressed: usize,   // compressed payload size
}

/// Find VBIN magic in a .vis file using seek-based I/O.
/// Only reads ~16MB chunks backwards from end — never loads the full file.
fn find_vbin_in_file(file: &mut File, file_size: u64) -> Result<VbinLocation, String> {
    let needle: &[u8] = VBIN_MAGIC;
    let chunk_size: u64 = 16 * 1024 * 1024;
    let mut search_end = file_size;
    
    while search_end > 16 {
        let search_start = search_end.saturating_sub(chunk_size);
        let read_len = (search_end - search_start) as usize;
        
        let mut chunk = vec![0u8; read_len];
        file.seek(SeekFrom::Start(search_start))
            .map_err(|e| format!("Seek fallito: {}", e))?;
        file.read_exact(&mut chunk)
            .map_err(|e| format!("Read fallito: {}", e))?;
        
        if let Some(rel_pos) = chunk.windows(4).rposition(|w| w == needle) {
            let pos = search_start + rel_pos as u64;
            if pos + 16 < file_size {
                // Read VBIN header at this position
                let hdr_offset = rel_pos;
                if hdr_offset + 16 <= chunk.len() {
                    let unknown = read_le_u32(&chunk, hdr_offset + 4);
                    let uncompressed = read_le_u32(&chunk, hdr_offset + 8) as usize;
                    let compressed = read_le_u32(&chunk, hdr_offset + 12) as usize;
                    
                    if compressed > 0 && (pos + 16 + compressed as u64) <= file_size
                        && uncompressed > 0 && uncompressed < 500_000_000
                    {
                        log::info!("[VIS] VBIN trovato a offset {}: uncomp={} comp={}", pos, uncompressed, compressed);
                        return Ok(VbinLocation { offset: pos, _unknown: unknown, uncompressed, compressed });
                    }
                }
            }
        }
        
        if search_start == 0 { break; }
        search_end = search_start + 4;
    }
    
    Err("VBIN non trovato nell'archivio .vis".to_string())
}

/// Read header (magic + file count) from .vis file — only reads 8 bytes.
fn read_vis_header(file: &mut File) -> Result<(String, u32), String> {
    let mut hdr = [0u8; 8];
    file.seek(SeekFrom::Start(0)).map_err(|e| format!("Seek: {}", e))?;
    file.read_exact(&mut hdr).map_err(|e| format!("Read header: {}", e))?;
    
    let magic = &hdr[0..4];
    let version = if magic == VIS5_MAGIC {
        "VIS5".to_string()
    } else if magic == VIS3_MAGIC {
        "VIS3".to_string()
    } else {
        return Err(format!("Magic non valido: {:?}", magic));
    };
    let count = read_be_u32(&hdr, 4);
    Ok((version, count))
}

/// Read and decompress VBIN payload from file — only reads the compressed data (~5MB).
fn read_vbin_payload(file: &mut File, loc: &VbinLocation) -> Result<Vec<u8>, String> {
    let compressed_start = loc.offset + 16;
    
    let mut compressed = vec![0u8; loc.compressed];
    file.seek(SeekFrom::Start(compressed_start))
        .map_err(|e| format!("Seek VBIN payload: {}", e))?;
    file.read_exact(&mut compressed)
        .map_err(|e| format!("Read VBIN payload: {}", e))?;
    
    let mut decoder = ZlibDecoder::new(&compressed[..]);
    let mut decompressed = Vec::with_capacity(loc.uncompressed);
    decoder.read_to_end(&mut decompressed)
        .map_err(|e| format!("Decompressione VBIN fallita: {}", e))?;
    
    log::info!("[VIS] VBIN decompresso: {} bytes (attesi {})", decompressed.len(), loc.uncompressed);
    Ok(decompressed)
}

// ── Parse decompressed VBIN payload and extract text strings ──

fn parse_vbin_strings(payload: &[u8]) -> Result<Vec<VisString>, String> {
    log::info!("[VIS] Parsing stringhe da payload {} bytes", payload.len());
    extract_strings_from_binary(payload)
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
        if (2..=10000).contains(&len) && pos + 4 + len <= data.len() {
            let str_start = pos + 4;
            let str_end = str_start + len;
            let bytes = &data[str_start..str_end];
            
            // Reject if first byte is a control char or null — real strings
            // start with printable ASCII. This catches false length-prefix matches
            // where random binary data looks like a valid LE u32 length.
            if bytes[0] < 0x20 && bytes[0] != b'\t' && bytes[0] != b'\n' && bytes[0] != b'\r' {
                pos += 1;
                continue;
            }
            
            // Reject if any of the first 8 bytes are null/control — real dialogue
            // never has embedded nulls except as trailing terminator
            let check_len = bytes.len().min(8);
            let has_early_control = bytes[..check_len].iter()
                .any(|&b| b == 0 || (b < 0x20 && b != b'\t' && b != b'\n' && b != b'\r'));
            if has_early_control {
                pos += 1;
                continue;
            }
            
            // Decode text with encoding auto-detection (supports UTF-8, Windows-1252, etc.)
            let (decoded, enc_result) = encoding_utils::auto_decode(bytes);
            if enc_result.confidence >= 0.1 {
                let trimmed = decoded.trim_end_matches('\0');

                // Extra safety: reject strings that still have embedded nulls
                // (real text has nulls only at the end as terminator)
                if trimmed.contains('\0') {
                    pos += 1;
                    continue;
                }

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
    if s.len() < 5 { return false; }
    
    // Must have letters
    let letter_count = s.chars().filter(|c| c.is_alphabetic()).count();
    if letter_count < 4 { return false; }
    
    // Skip if mostly non-ASCII (binary leftovers)
    let ascii_ratio = s.chars().filter(|c| c.is_ascii()).count() as f32 / s.len() as f32;
    if ascii_ratio < 0.8 { return false; }
    
    // Skip paths and filenames
    if s.contains('/') || s.contains('\\') { return false; }
    let ext_skip = [".png", ".ogg", ".wav", ".mp3", ".mp4", ".webp", ".jpg", ".jpeg",
                    ".lua", ".xml", ".json", ".csv", ".ini", ".cfg", ".ttf", ".otf",
                    ".vis", ".veb", ".ved", ".dat", ".bin", ".exe", ".dll", ".fx",
                    ".hlsl", ".glsl", ".vert", ".frag", ".tga", ".bmp", ".gif"];
    let lower = s.to_lowercase();
    for ext in ext_skip {
        if lower.ends_with(ext) { return false; }
    }
    
    // ── Visionaire engine action logs / commands (biggest source of noise) ──
    // These are prefixes of Visionaire action log entries found in game.veb
    let engine_prefixes: &[&str] = &[
        "pause for ", "play sound", "play animation", "play ",
        "fade '", "fade \"", "fade ",
        "stop sound", "stop character", "stop centering", "stop ",
        "set ", "change ", "show ", "hide ",
        "start ", "call ", "wait ", "if ", "else ", "end if", "end of",
        "cursor ", "at ", "left click", "right click", "mouse ", "key ",
        "add item", "remove item", "character ", "quit ",
        "open ", "close ", "enable ", "disable ",
        "move ", "scroll ", "zoom ", "rotate ", "shake ",
        "load ", "save ", "hint menu",
        "switch to ", "execute ", "begin of", "jump to ",
        "align ", "center ", "send ", "walk ",
        "pick up", "use item", "give item", "combine ",
        "run ", "trigger ", "activate ", "deactivate ",
        "create ", "delete ", "update ", "reset ",
        "flip ", "fade ", "tween ", "scale ",
        "turn ", "look ", "say ", "speak ",
        "delay ", "sleep ", "resume ",
    ];
    if lower.contains("executed") { return false; }
    for prefix in engine_prefixes {
        if lower.starts_with(prefix) { return false; }
    }
    // Also check with leading whitespace/special chars stripped
    let trimmed_lower = lower.trim_start_matches(|c: char| !c.is_alphanumeric());
    if trimmed_lower != lower {
        for prefix in engine_prefixes {
            if trimmed_lower.starts_with(prefix) { return false; }
        }
    }
    
    // Skip strings starting with - ! ; (section names, comments, special)
    if s.starts_with('-') || s.starts_with('!') || s.starts_with(';') { return false; }
    
    // Skip strings starting with digits (sound names: "1-003 cat meow", "99-3-053b Coming Out")
    if s.chars().next().is_some_and(|c| c.is_ascii_digit()) { return false; }
    
    // Skip strings that contain 'identifier_name' patterns (engine references)
    // e.g. "Switch to scene 'deadnettle'", "Play animation 'pickup_waist_back'"
    if s.contains("'") && s.matches('\'').count() >= 2 { return false; }
    if s.contains("[\"") || s.contains("\"]") { return false; } // Lua table access
    if s.contains("replaceItem(") || s.contains("replaceitem(") { return false; }
    if lower.contains("activate voice") || lower.contains("activate text") { return false; }
    if lower.contains("clickbehaviour") || lower.contains("clickbehavior") { return false; }
    
    // Skip Lua code patterns
    if s.contains("function ") || s.contains("local ") || s.contains("end\n") { return false; }
    if s.contains("if ") && s.contains(" then") { return false; }
    if s.contains("return ") || s.contains("require(") { return false; }
    if s.contains(" = ") && (s.contains("true") || s.contains("false") || s.contains("nil")) { return false; }
    if s.contains("getObject(") || s.contains("getName(") || s.contains("setValue(") { return false; }
    if s.contains("startAction(") || s.contains("getLink(") || s.contains(".Value") { return false; }
    
    // Skip config/code lines with = assignment
    if s.contains('=') && !s.contains(' ') { return false; }
    if s.contains('=') && s.contains(';') { return false; }
    
    // Skip XML/HTML content
    if s.starts_with('<') && s.ends_with('>') { return false; }
    if s.contains("</") || s.contains("/>") { return false; }
    
    // Skip strings with >> (Visionaire sequence markers: "692 >> double headline >> 693")
    if s.contains(" >> ") { return false; }
    
    // Skip strings with quotes around identifiers ('item_name', "sound_name")
    if s.contains("'") && !s.contains(' ') { return false; }
    
    // Skip if looks like code identifier (snake_case, camelCase, ALL_CAPS)
    if s.chars().all(|c| c.is_alphanumeric() || c == '_') && s.contains('_') { return false; }
    // Skip if ANY word contains underscore (e.g. "anim_statue worki")
    if s.split_whitespace().any(|w| w.contains('_')) { return false; }
    if s.chars().all(|c| c.is_uppercase() || c == '_' || c.is_numeric() || c == ' ') && s.len() > 3 {
        return false;
    }
    
    // Skip single words (not translatable dialogue)
    if !s.contains(' ') { return false; }
    
    // Must have at least 2 real words (letters >= 2) to be translatable text
    let words: Vec<&str> = s.split_whitespace()
        .filter(|w| w.chars().filter(|c| c.is_alphabetic()).count() >= 2)
        .collect();
    if words.len() < 2 { return false; }
    
    // Skip Visionaire internal names, object names, and plugin strings
    let skip_prefixes = ["eshader", "ealign", "eonly", "etext", "action_", "scene_",
                         "char_", "obj_", "cond_", "val_", "anim_", "sound_",
                         "plugins/", "Graphics/", "Sounds/", "Music/", "Fonts/",
                         "config.", "plugin", "TVis", "TScript", "Vis ", "vis_",
                         "cursor_", "button_", "interface_", "menu_", "dialog_",
                         "sfx_", "bgm_", "vfx_", "ui_", "hud_"];
    for prefix in skip_prefixes {
        if s.starts_with(prefix) || lower.starts_with(&prefix.to_lowercase()) { return false; }
    }
    
    // Skip Visionaire action/command keywords in string
    let skip_contains = ["ActiveAnimations", "PolygonalLink", "ScrollPosition",
                         "CharacterLink", "ObjectLink", "SceneLink", "ActionLink",
                         "SoundLink", "MusicLink", "FontLink", "CursorLink",
                         "ParticleLink", "InterfaceLink", "AnimationLink",
                         "ConditionLink", "ValueLink", "DialogLink",
                         "Brightness", "Saturation", "setPosition", "getPosition",
                         "currentCharacter", "activeScene", "mainCharacter",
                         "milliseconds", " to object ", "object area",
                         "(immediate)", " position"];
    for kw in skip_contains {
        if s.contains(kw) { return false; }
    }
    
    // Real dialogue heuristic: must have at least one lowercase-starting word
    // (articles, prepositions: "the", "a", "is", "in", "to", "of"...)
    // or contain sentence punctuation (. ! ? , — used in dialogue/UI text)
    let has_lowercase_word = words.iter().any(|w| {
        w.chars().next().is_some_and(|c| c.is_lowercase())
    });
    let has_sentence_punct = s.chars().any(|c| matches!(c, '.' | '!' | '?' | ',' | ':' | ';' | '"' | '…'));
    
    if !has_lowercase_word && !has_sentence_punct {
        // No lowercase words and no punctuation — almost certainly an internal name
        return false;
    }
    
    // Short strings (< 40 chars) without sentence-ending punctuation are likely
    // object/animation names, not translatable dialogue
    let has_end_punct = s.chars().last().is_some_and(|c| matches!(c, '.' | '!' | '?' | ';' | ':' | '"' | '\u{2026}'));
    if s.len() < 40 && !has_end_punct && words.len() <= 4 {
        // Exception: dialogue format "character: text"
        if !s.contains(':') {
            return false;
        }
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
    
    let mut file = File::open(&vis_path)
        .map_err(|e| format!("Errore apertura {}: {}", vis_path.display(), e))?;
    
    let (version, file_count) = read_vis_header(&mut file)?;
    let file_size = file.seek(SeekFrom::End(0)).map_err(|e| format!("Seek: {}", e))?;
    let has_veb = find_vbin_in_file(&mut file, file_size).is_ok();
    
    Ok(VisInfo {
        is_visionaire: true,
        version,
        vis_path: vis_path.to_string_lossy().to_string(),
        file_count,
        total_strings: 0,
        has_veb,
    })
}

/// Scan a Visionaire game and count translatable strings (populates cache)
#[command]
pub async fn scan_vis_strings(game_path: String) -> Result<VisInfo, String> {
    log::info!("[VIS] scan_vis_strings: {}", game_path);
    
    let vis_path = find_vis_file(&game_path)
        .ok_or_else(|| "Nessun file .vis trovato".to_string())?;
    let vis_path_str = vis_path.to_string_lossy().to_string();
    
    // Check cache first
    if let Some(cached) = get_cached_strings(&vis_path_str) {
        log::info!("[VIS] Cache hit: {} stringhe", cached.len());
        let mut file = File::open(&vis_path).map_err(|e| format!("Errore: {}", e))?;
        let (version, file_count) = read_vis_header(&mut file)?;
        return Ok(VisInfo {
            is_visionaire: true, version, vis_path: vis_path_str,
            file_count, total_strings: cached.len(), has_veb: true,
        });
    }
    
    let mut file = File::open(&vis_path)
        .map_err(|e| format!("Errore apertura: {}", e))?;
    
    let (version, file_count) = read_vis_header(&mut file)?;
    let file_size = file.seek(SeekFrom::End(0)).map_err(|e| format!("Seek: {}", e))?;
    
    let vbin_loc = find_vbin_in_file(&mut file, file_size)?;
    let payload = read_vbin_payload(&mut file, &vbin_loc)?;
    let strings = parse_vbin_strings(&payload)?;
    
    log::info!("[VIS] Trovate {} stringhe traducibili (cached)", strings.len());
    set_cached_strings(&vis_path_str, strings.clone());
    
    Ok(VisInfo {
        is_visionaire: true,
        version,
        vis_path: vis_path_str,
        file_count,
        total_strings: strings.len(),
        has_veb: true,
    })
}

/// Extract translatable strings from a Visionaire game (uses cache from scan)
#[command]
pub async fn extract_vis_strings(
    game_path: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<VisString>, String> {
    let vis_path = find_vis_file(&game_path)
        .ok_or_else(|| "Nessun file .vis trovato".to_string())?;
    let vis_path_str = vis_path.to_string_lossy().to_string();
    
    // Use cached strings if available (populated by scan_vis_strings)
    let all_strings = if let Some(cached) = get_cached_strings(&vis_path_str) {
        cached
    } else {
        log::info!("[VIS] extract_vis_strings: cache miss, loading from disk");
        let mut file = File::open(&vis_path)
            .map_err(|e| format!("Errore apertura: {}", e))?;
        let file_size = file.seek(SeekFrom::End(0)).map_err(|e| format!("Seek: {}", e))?;
        let vbin_loc = find_vbin_in_file(&mut file, file_size)?;
        let payload = read_vbin_payload(&mut file, &vbin_loc)?;
        let strings = parse_vbin_strings(&payload)?;
        set_cached_strings(&vis_path_str, strings.clone());
        strings
    };
    
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
    
    // Patch requires full file read for rebuild
    let data = fs::read(&vis_path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    // Find VBIN in the loaded data (in-memory scan)
    let needle: &[u8] = VBIN_MAGIC;
    let vbin_pos = data.windows(4).rposition(|w| w == needle)
        .ok_or_else(|| "VBIN non trovato per patching".to_string())?;
    
    let uncompressed = read_le_u32(&data, vbin_pos + 8) as usize;
    let compressed = read_le_u32(&data, vbin_pos + 12) as usize;
    
    if vbin_pos + 16 + compressed > data.len() {
        return Err("VBIN payload overflow".to_string());
    }
    
    // Decompress payload
    let compressed_data = &data[vbin_pos + 16..vbin_pos + 16 + compressed];
    let mut decoder = ZlibDecoder::new(compressed_data);
    let mut payload = Vec::with_capacity(uncompressed);
    decoder.read_to_end(&mut payload)
        .map_err(|e| format!("Decompressione fallita: {}", e))?;
    
    // Patch strings
    let patched_vbin = patch_vbin_strings(&data, &payload, &translations)?;
    
    // Replace VBIN block in the archive
    let vbin_end = vbin_pos + 16 + compressed;
    
    let mut new_data = Vec::with_capacity(data.len());
    new_data.extend_from_slice(&data[..vbin_pos]);
    new_data.extend_from_slice(&patched_vbin);
    if vbin_end < data.len() {
        new_data.extend_from_slice(&data[vbin_end..]);
    }
    
    // Write patched archive
    fs::write(&vis_path, &new_data)
        .map_err(|e| format!("Errore scrittura: {}", e))?;
    
    invalidate_cache(); // file changed, cache stale
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
    
    invalidate_cache(); // restored original, cache stale
    
    Ok(serde_json::json!({
        "success": true,
        "message": "Archivio originale ripristinato",
    }))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Unit Tests
// ═══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ── Byte helper tests ──

    #[test]
    fn test_read_be_u32_basic() {
        let data = [0x00, 0x00, 0x00, 0x0A]; // 10 in big-endian
        assert_eq!(read_be_u32(&data, 0), 10);
    }

    #[test]
    fn test_read_be_u32_large() {
        let data = [0x01, 0x02, 0x03, 0x04];
        assert_eq!(read_be_u32(&data, 0), 0x01020304);
    }

    #[test]
    fn test_read_be_u32_offset() {
        let data = [0xFF, 0xFF, 0x00, 0x00, 0x00, 0x05];
        assert_eq!(read_be_u32(&data, 2), 5);
    }

    #[test]
    fn test_read_be_u32_out_of_bounds() {
        let data = [0x01, 0x02];
        assert_eq!(read_be_u32(&data, 0), 0); // too short
        assert_eq!(read_be_u32(&data, 5), 0); // way out of bounds
    }

    #[test]
    fn test_read_be_u32_empty() {
        let data: [u8; 0] = [];
        assert_eq!(read_be_u32(&data, 0), 0);
    }

    #[test]
    fn test_read_le_u32_basic() {
        let data = [0x0A, 0x00, 0x00, 0x00]; // 10 in little-endian
        assert_eq!(read_le_u32(&data, 0), 10);
    }

    #[test]
    fn test_read_le_u32_large() {
        let data = [0x04, 0x03, 0x02, 0x01];
        assert_eq!(read_le_u32(&data, 0), 0x01020304);
    }

    #[test]
    fn test_read_le_u32_out_of_bounds() {
        let data = [0x01];
        assert_eq!(read_le_u32(&data, 0), 0);
    }

    #[test]
    fn test_read_le_i32_basic() {
        // -1 in LE = [0xFF, 0xFF, 0xFF, 0xFF]
        let data = [0xFF, 0xFF, 0xFF, 0xFF];
        assert_eq!(read_le_i32(&data, 0), -1);
    }

    #[test]
    fn test_read_le_i32_positive() {
        let data = [0x2A, 0x00, 0x00, 0x00]; // 42
        assert_eq!(read_le_i32(&data, 0), 42);
    }

    #[test]
    fn test_read_le_i32_out_of_bounds() {
        let data = [0x01, 0x02];
        assert_eq!(read_le_i32(&data, 0), 0);
    }

    #[test]
    fn test_write_le_u32() {
        let mut buf = Vec::new();
        write_le_u32(&mut buf, 42);
        assert_eq!(buf, [0x2A, 0x00, 0x00, 0x00]);
    }

    #[test]
    fn test_write_le_u32_zero() {
        let mut buf = Vec::new();
        write_le_u32(&mut buf, 0);
        assert_eq!(buf, [0x00, 0x00, 0x00, 0x00]);
    }

    #[test]
    fn test_write_le_u32_max() {
        let mut buf = Vec::new();
        write_le_u32(&mut buf, u32::MAX);
        assert_eq!(buf, [0xFF, 0xFF, 0xFF, 0xFF]);
    }

    #[test]
    fn test_write_le_u32_appends() {
        let mut buf = vec![0xAA, 0xBB];
        write_le_u32(&mut buf, 1);
        assert_eq!(buf, [0xAA, 0xBB, 0x01, 0x00, 0x00, 0x00]);
    }

    // ── Joaat64 hash tests ──

    #[test]
    fn test_joaat64_hash_deterministic() {
        let h1 = joaat64_hash("game.veb");
        let h2 = joaat64_hash("game.veb");
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_joaat64_hash_case_insensitive() {
        assert_eq!(joaat64_hash("GAME.VEB"), joaat64_hash("game.veb"));
        assert_eq!(joaat64_hash("Game.Veb"), joaat64_hash("game.veb"));
    }

    #[test]
    fn test_joaat64_hash_different_inputs() {
        assert_ne!(joaat64_hash("game.veb"), joaat64_hash("other.veb"));
    }

    #[test]
    fn test_joaat64_hash_empty() {
        // Should not panic on empty input
        let _ = joaat64_hash("");
    }

    // ── XOR encryption tests ──

    #[test]
    fn test_xor_decrypt_roundtrip() {
        let key = get_xor_key();
        let original = b"Hello, World!".to_vec();
        let mut encrypted = original.clone();
        xor_decrypt(&mut encrypted, &key);
        assert_ne!(encrypted, original); // should change the data
        xor_decrypt(&mut encrypted, &key); // decrypt = double encrypt with XOR
        assert_eq!(encrypted, original);
    }

    #[test]
    fn test_xor_decrypt_empty() {
        let key = get_xor_key();
        let mut data: Vec<u8> = vec![];
        xor_decrypt(&mut data, &key);
        assert!(data.is_empty());
    }

    #[test]
    fn test_get_xor_key_length() {
        let key = get_xor_key();
        assert_eq!(key.len(), 16); // MD5 produces 16 bytes
    }

    #[test]
    fn test_get_xor_key_deterministic() {
        assert_eq!(get_xor_key(), get_xor_key());
    }

    // ── Filename XOR key tests ──

    #[test]
    fn test_get_filename_xor_key_strips_extension() {
        let key1 = get_filename_xor_key("game.veb");
        let key2 = get_filename_xor_key("game.vis");
        // Both should be MD5 hex of "game"
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_get_filename_xor_key_no_extension() {
        let key1 = get_filename_xor_key("gamefile");
        // MD5 hex of "gamefile" as bytes
        let digest = md5::compute(b"gamefile");
        let expected = format!("{:x}", digest).as_bytes().to_vec();
        assert_eq!(key1, expected);
    }

    #[test]
    fn test_get_filename_xor_key_is_hex() {
        let key = get_filename_xor_key("test.dat");
        // MD5 hex string is 32 chars, all hex digits
        assert_eq!(key.len(), 32);
        assert!(key.iter().all(|&b| b"0123456789abcdef".contains(&b)));
    }

    // ── is_translatable_vis_string tests ──

    #[test]
    fn test_translatable_dialogue() {
        assert!(is_translatable_vis_string("Hello, how are you doing today?"));
        assert!(is_translatable_vis_string("This is a complete sentence."));
        assert!(is_translatable_vis_string("What do you want?"));
        assert!(is_translatable_vis_string("I can't believe it!"));
    }

    #[test]
    fn test_translatable_rejects_short_strings() {
        assert!(!is_translatable_vis_string("Hi"));
        assert!(!is_translatable_vis_string("OK"));
        assert!(!is_translatable_vis_string(""));
        assert!(!is_translatable_vis_string("Hel"));
    }

    #[test]
    fn test_translatable_rejects_paths() {
        assert!(!is_translatable_vis_string("some/path/to/file"));
        assert!(!is_translatable_vis_string("C:\\Users\\file"));
    }

    #[test]
    fn test_translatable_rejects_file_extensions() {
        assert!(!is_translatable_vis_string("background_music.ogg"));
        assert!(!is_translatable_vis_string("texture_file.png"));
        assert!(!is_translatable_vis_string("game_script.lua"));
    }

    #[test]
    fn test_translatable_rejects_engine_commands() {
        assert!(!is_translatable_vis_string("play sound effects here"));
        assert!(!is_translatable_vis_string("set variable to something"));
        assert!(!is_translatable_vis_string("wait for animation complete"));
        assert!(!is_translatable_vis_string("if condition then result"));
        assert!(!is_translatable_vis_string("pause for dramatic effect now"));
    }

    #[test]
    fn test_translatable_rejects_identifiers() {
        assert!(!is_translatable_vis_string("some_variable_name"));
        assert!(!is_translatable_vis_string("another_ident with words"));
        assert!(!is_translatable_vis_string("CONSTANT_VALUE"));
    }

    #[test]
    fn test_translatable_rejects_single_words() {
        assert!(!is_translatable_vis_string("Inventory"));
        assert!(!is_translatable_vis_string("Character"));
    }

    #[test]
    fn test_translatable_rejects_lua_code() {
        assert!(!is_translatable_vis_string("function doSomething() return end"));
        assert!(!is_translatable_vis_string("local x equals something"));
        assert!(!is_translatable_vis_string("if active then do something"));
        assert!(!is_translatable_vis_string("return value from function"));
        assert!(!is_translatable_vis_string("getObject(something) is active"));
    }

    #[test]
    fn test_translatable_rejects_xml() {
        assert!(!is_translatable_vis_string("<tag>content</tag>"));
        assert!(!is_translatable_vis_string("self closing tag here/>"));
    }

    #[test]
    fn test_translatable_rejects_engine_links() {
        assert!(!is_translatable_vis_string("This uses CharacterLink now here"));
        assert!(!is_translatable_vis_string("ActionLink to something else here"));
    }

    #[test]
    fn test_translatable_rejects_starting_with_digit() {
        assert!(!is_translatable_vis_string("1-003 cat meow sound"));
        assert!(!is_translatable_vis_string("99-3-053b Coming Out Now"));
    }

    #[test]
    fn test_translatable_rejects_starting_special_chars() {
        assert!(!is_translatable_vis_string("-some dashed entry here"));
        assert!(!is_translatable_vis_string("!exclamation entry here"));
        assert!(!is_translatable_vis_string(";comment line here thing"));
    }

    #[test]
    fn test_translatable_rejects_sequence_markers() {
        assert!(!is_translatable_vis_string("692 >> double headline >> 693"));
    }

    #[test]
    fn test_translatable_rejects_all_uppercase_with_spaces() {
        assert!(!is_translatable_vis_string("MAIN MENU SCREEN"));
        assert!(!is_translatable_vis_string("GAME OVER 2"));
    }

    #[test]
    fn test_translatable_rejects_config_assignments() {
        assert!(!is_translatable_vis_string("key=value"));
        assert!(!is_translatable_vis_string("volume = 100; max"));
    }

    #[test]
    fn test_translatable_rejects_engine_prefixes() {
        assert!(!is_translatable_vis_string("eshader light diffuse normal"));
        assert!(!is_translatable_vis_string("action_walk_to something here"));
        assert!(!is_translatable_vis_string("scene_forest_night_dark here"));
    }

    #[test]
    fn test_translatable_rejects_quoted_identifiers() {
        assert!(!is_translatable_vis_string("Switch to scene 'deadnettle' now"));
        assert!(!is_translatable_vis_string("Play animation 'pickup_waist_back' now"));
    }

    #[test]
    fn test_translatable_short_without_punctuation() {
        // Short strings without end punctuation and <= 4 words should be rejected
        assert!(!is_translatable_vis_string("Main menu screen"));
        // But with a colon it should be accepted (dialogue format)
        assert!(is_translatable_vis_string("Bob: hello there"));
    }

    #[test]
    fn test_translatable_rejects_executed_keyword() {
        assert!(!is_translatable_vis_string("action executed successfully here"));
    }

    #[test]
    fn test_translatable_rejects_lua_table_access() {
        assert!(!is_translatable_vis_string("something[\"key\"] is accessed"));
    }

    // ── extract_strings_from_binary tests ──

    /// Build a length-prefixed string entry as it appears in VBIN data
    fn make_string_entry(s: &str) -> Vec<u8> {
        let bytes = s.as_bytes();
        let mut entry = Vec::new();
        // Length prefix (LE u32) — includes the string bytes (no null terminator in length)
        entry.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
        entry.extend_from_slice(bytes);
        entry
    }

    #[test]
    fn test_extract_strings_empty_data() {
        let result = extract_strings_from_binary(&[]).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_extract_strings_too_short() {
        let result = extract_strings_from_binary(&[0x01, 0x02, 0x03]).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_extract_strings_finds_dialogue() {
        // Create a binary payload with a translatable string embedded
        let text = "Hello, how are you doing today?";
        let mut data = vec![0u8; 32]; // some leading binary junk (non-matching)
        data.extend_from_slice(&make_string_entry(text));
        data.extend_from_slice(&[0u8; 16]); // trailing junk

        let result = extract_strings_from_binary(&data).unwrap();
        assert!(result.iter().any(|s| s.text == text),
            "Expected to find '{}' in {:?}", text, result);
    }

    #[test]
    fn test_extract_strings_skips_binary_garbage() {
        // Data that looks like a length prefix but points to binary garbage
        let mut data = Vec::new();
        // Length 10, followed by binary bytes with nulls
        data.extend_from_slice(&10u32.to_le_bytes());
        data.extend_from_slice(&[0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]);

        let result = extract_strings_from_binary(&data).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_extract_strings_skips_control_chars() {
        // String starting with control character should be skipped
        let mut data = Vec::new();
        data.extend_from_slice(&10u32.to_le_bytes());
        data.extend_from_slice(&[0x01, b'H', b'e', b'l', b'l', b'o', b' ', b'W', b'o', b'r']);

        let result = extract_strings_from_binary(&data).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_extract_strings_sequential_index() {
        // Multiple translatable strings should have sequential indices
        let s1 = "This is the first dialogue sentence.";
        let s2 = "And this is the second dialogue sentence.";
        let mut data = Vec::new();
        data.extend_from_slice(&make_string_entry(s1));
        data.extend_from_slice(&make_string_entry(s2));

        let result = extract_strings_from_binary(&data).unwrap();
        assert!(result.len() >= 2, "Expected at least 2 strings, got {}", result.len());
        // Check indices are sequential
        for (i, s) in result.iter().enumerate() {
            assert_eq!(s.index, i);
        }
    }

    #[test]
    fn test_extract_strings_records_offset() {
        let text = "What do you think about this situation?";
        let prefix_len = 20;
        let mut data = vec![0u8; prefix_len]; // some leading junk
        data.extend_from_slice(&make_string_entry(text));

        let result = extract_strings_from_binary(&data).unwrap();
        let found = result.iter().find(|s| s.text == text);
        assert!(found.is_some(), "String not found");
        // offset_in_veb should point to the length prefix
        assert_eq!(found.unwrap().offset_in_veb, prefix_len);
    }

    #[test]
    fn test_extract_strings_rejects_too_long_length() {
        // A length of 20000 (> 10000 limit) should be skipped
        let mut data = Vec::new();
        data.extend_from_slice(&20000u32.to_le_bytes());
        data.extend_from_slice(&vec![b'A'; 20000]);

        let result = extract_strings_from_binary(&data).unwrap();
        // Should not extract a 20000-byte string
        assert!(result.iter().all(|s| s.text.len() < 20000));
    }

    #[test]
    fn test_extract_strings_rejects_too_short_length() {
        // Length < 2 is rejected
        let mut data = Vec::new();
        data.extend_from_slice(&1u32.to_le_bytes());
        data.push(b'A');

        let result = extract_strings_from_binary(&data).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_extract_strings_embedded_nulls_rejected() {
        // String with embedded null should be rejected
        let mut data = Vec::new();
        let s = b"Hello\x00World, how are you!";
        data.extend_from_slice(&(s.len() as u32).to_le_bytes());
        data.extend_from_slice(s);

        let result = extract_strings_from_binary(&data).unwrap();
        // The string with embedded null should be rejected by early control check
        assert!(result.iter().all(|r| !r.text.contains("Hello\x00World")));
    }

    // ── patch_vbin_strings tests ──

    #[test]
    fn test_patch_vbin_same_length() {
        // Create a payload with a known translatable string
        let original_text = "Hello, how are you doing today?";
        let replacement = "Ciao, come stai facendo adesso?"; // same length (31 bytes)
        assert_eq!(original_text.len(), replacement.len());

        let payload = make_string_entry(original_text);
        let original_vbin = payload.clone(); // not really used in same-length path

        let mut translations = std::collections::HashMap::new();
        translations.insert(0, replacement.to_string());

        let result = patch_vbin_strings(&original_vbin, &payload, &translations).unwrap();

        // Result should be a valid VBIN: magic + header + compressed data
        assert_eq!(&result[0..4], VBIN_MAGIC);

        // Decompress and verify the patched text
        let uncompressed_size = read_le_u32(&result, 8) as usize;
        let compressed_size = read_le_u32(&result, 12) as usize;
        assert!(compressed_size > 0);

        let compressed_data = &result[16..16 + compressed_size];
        let mut decoder = ZlibDecoder::new(compressed_data);
        let mut decompressed = Vec::new();
        decoder.read_to_end(&mut decompressed).unwrap();

        assert_eq!(decompressed.len(), uncompressed_size);
        // The patched payload should contain the replacement text
        let found = decompressed.windows(replacement.len())
            .any(|w| w == replacement.as_bytes());
        assert!(found, "Replacement text not found in patched output");
    }

    #[test]
    fn test_patch_vbin_different_length() {
        // String where the translation is longer
        let original_text = "Hello, how are you doing today?";
        let replacement = "Buongiorno, come stai facendo in questo bellissimo giorno?";

        // Build payload with null terminator after string (as the rebuild path expects)
        let mut payload = Vec::new();
        let bytes = original_text.as_bytes();
        let entry_len = bytes.len() + 1; // +1 for null terminator
        payload.extend_from_slice(&(entry_len as u32).to_le_bytes());
        payload.extend_from_slice(bytes);
        payload.push(0); // null terminator

        let mut translations = std::collections::HashMap::new();
        translations.insert(0, replacement.to_string());

        let result = patch_vbin_strings(&[], &payload, &translations).unwrap();

        // Verify VBIN structure
        assert_eq!(&result[0..4], VBIN_MAGIC);

        // Decompress and check
        let compressed_size = read_le_u32(&result, 12) as usize;
        let compressed_data = &result[16..16 + compressed_size];
        let mut decoder = ZlibDecoder::new(compressed_data);
        let mut decompressed = Vec::new();
        decoder.read_to_end(&mut decompressed).unwrap();

        let found = decompressed.windows(replacement.len())
            .any(|w| w == replacement.as_bytes());
        assert!(found, "Replacement text not found in rebuilt output");
    }

    #[test]
    fn test_patch_vbin_no_translations() {
        let original_text = "Hello, how are you doing today?";
        let payload = make_string_entry(original_text);
        let translations = std::collections::HashMap::new();

        let result = patch_vbin_strings(&[], &payload, &translations).unwrap();
        assert_eq!(&result[0..4], VBIN_MAGIC);

        // Decompress and verify original text preserved
        let compressed_size = read_le_u32(&result, 12) as usize;
        let compressed_data = &result[16..16 + compressed_size];
        let mut decoder = ZlibDecoder::new(compressed_data);
        let mut decompressed = Vec::new();
        decoder.read_to_end(&mut decompressed).unwrap();

        assert_eq!(decompressed, payload);
    }

    #[test]
    fn test_patch_vbin_output_structure() {
        let payload = make_string_entry("This is a test sentence here.");
        let translations = std::collections::HashMap::new();

        let result = patch_vbin_strings(&[], &payload, &translations).unwrap();

        // VBIN header: magic(4) + unknown(4) + uncompressed_size(4) + compressed_size(4) + data
        assert!(result.len() >= 16);
        assert_eq!(&result[0..4], b"VBIN");
        let unknown = read_le_u32(&result, 4);
        assert_eq!(unknown, 0); // patching writes 0 for unknown field
    }

    // ── read_vis_header tests (using temp files) ──

    #[test]
    fn test_read_vis_header_vis5() {
        let mut data = Vec::new();
        data.extend_from_slice(b"VIS5");
        data.extend_from_slice(&100u32.to_be_bytes()); // file count in BE

        let tmp = std::env::temp_dir().join("test_vis5_header.vis");
        fs::write(&tmp, &data).unwrap();
        let mut file = File::open(&tmp).unwrap();

        let (version, count) = read_vis_header(&mut file).unwrap();
        assert_eq!(version, "VIS5");
        assert_eq!(count, 100);

        fs::remove_file(&tmp).ok();
    }

    #[test]
    fn test_read_vis_header_vis3() {
        let mut data = Vec::new();
        data.extend_from_slice(b"VIS3");
        data.extend_from_slice(&50u32.to_be_bytes());

        let tmp = std::env::temp_dir().join("test_vis3_header.vis");
        fs::write(&tmp, &data).unwrap();
        let mut file = File::open(&tmp).unwrap();

        let (version, count) = read_vis_header(&mut file).unwrap();
        assert_eq!(version, "VIS3");
        assert_eq!(count, 50);

        fs::remove_file(&tmp).ok();
    }

    #[test]
    fn test_read_vis_header_invalid_magic() {
        let mut data = Vec::new();
        data.extend_from_slice(b"XXXX");
        data.extend_from_slice(&0u32.to_be_bytes());

        let tmp = std::env::temp_dir().join("test_bad_header.vis");
        fs::write(&tmp, &data).unwrap();
        let mut file = File::open(&tmp).unwrap();

        let result = read_vis_header(&mut file);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Magic non valido"));

        fs::remove_file(&tmp).ok();
    }

    #[test]
    fn test_read_vis_header_too_short() {
        let data = b"VIS";
        let tmp = std::env::temp_dir().join("test_short_header.vis");
        fs::write(&tmp, data).unwrap();
        let mut file = File::open(&tmp).unwrap();

        let result = read_vis_header(&mut file);
        assert!(result.is_err());

        fs::remove_file(&tmp).ok();
    }

    // ── find_vbin_in_file tests ──

    #[test]
    fn test_find_vbin_in_file_found() {
        // Build a fake .vis file with a VBIN block at the end
        let mut data = Vec::new();
        data.extend_from_slice(b"VIS5");
        data.extend_from_slice(&1u32.to_be_bytes());
        // Pad to simulate archive data
        data.extend_from_slice(&vec![0u8; 100]);

        // Create a small zlib-compressed payload
        let payload = b"test payload data for vbin";
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(payload).unwrap();
        let compressed = encoder.finish().unwrap();

        let vbin_offset = data.len();
        // VBIN header
        data.extend_from_slice(b"VBIN");
        data.extend_from_slice(&42u32.to_le_bytes()); // unknown
        data.extend_from_slice(&(payload.len() as u32).to_le_bytes()); // uncompressed
        data.extend_from_slice(&(compressed.len() as u32).to_le_bytes()); // compressed
        data.extend_from_slice(&compressed);

        let tmp = std::env::temp_dir().join("test_find_vbin.vis");
        fs::write(&tmp, &data).unwrap();
        let mut file = File::open(&tmp).unwrap();
        let file_size = file.seek(SeekFrom::End(0)).unwrap();

        let loc = find_vbin_in_file(&mut file, file_size).unwrap();
        assert_eq!(loc.offset, vbin_offset as u64);
        assert_eq!(loc.uncompressed, payload.len());
        assert_eq!(loc.compressed, compressed.len());

        fs::remove_file(&tmp).ok();
    }

    #[test]
    fn test_find_vbin_in_file_not_found() {
        let data = vec![0u8; 200]; // no VBIN magic anywhere

        let tmp = std::env::temp_dir().join("test_no_vbin.vis");
        fs::write(&tmp, &data).unwrap();
        let mut file = File::open(&tmp).unwrap();
        let file_size = file.seek(SeekFrom::End(0)).unwrap();

        let result = find_vbin_in_file(&mut file, file_size);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("VBIN non trovato"));

        fs::remove_file(&tmp).ok();
    }

    #[test]
    fn test_find_vbin_rejects_zero_compressed() {
        // VBIN header with compressed=0 should be rejected
        let mut data = vec![0u8; 100];
        data.extend_from_slice(b"VBIN");
        data.extend_from_slice(&0u32.to_le_bytes()); // unknown
        data.extend_from_slice(&100u32.to_le_bytes()); // uncompressed
        data.extend_from_slice(&0u32.to_le_bytes()); // compressed = 0 (invalid)
        data.extend_from_slice(&vec![0u8; 50]);

        let tmp = std::env::temp_dir().join("test_vbin_zero_comp.vis");
        fs::write(&tmp, &data).unwrap();
        let mut file = File::open(&tmp).unwrap();
        let file_size = file.seek(SeekFrom::End(0)).unwrap();

        let result = find_vbin_in_file(&mut file, file_size);
        assert!(result.is_err());

        fs::remove_file(&tmp).ok();
    }

    // ── VBIN read + decompress roundtrip test ──

    #[test]
    fn test_read_vbin_payload_roundtrip() {
        let payload = b"This is a test VBIN payload with some content.";

        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(payload).unwrap();
        let compressed = encoder.finish().unwrap();

        let mut data = Vec::new();
        data.extend_from_slice(b"VIS5");
        data.extend_from_slice(&1u32.to_be_bytes());
        data.extend_from_slice(&vec![0u8; 50]); // padding

        let vbin_offset = data.len() as u64;
        data.extend_from_slice(b"VBIN");
        data.extend_from_slice(&0u32.to_le_bytes()); // unknown
        data.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        data.extend_from_slice(&(compressed.len() as u32).to_le_bytes());
        data.extend_from_slice(&compressed);

        let tmp = std::env::temp_dir().join("test_vbin_roundtrip.vis");
        fs::write(&tmp, &data).unwrap();
        let mut file = File::open(&tmp).unwrap();

        let loc = VbinLocation {
            offset: vbin_offset,
            _unknown: 0,
            uncompressed: payload.len(),
            compressed: compressed.len(),
        };

        let result = read_vbin_payload(&mut file, &loc).unwrap();
        assert_eq!(result, payload);

        fs::remove_file(&tmp).ok();
    }

    // ── parse_vbin_strings test ──

    #[test]
    fn test_parse_vbin_strings_delegates_to_extract() {
        let text = "Welcome to the adventure game, traveler!";
        let payload = make_string_entry(text);
        let result = parse_vbin_strings(&payload).unwrap();
        assert!(result.iter().any(|s| s.text == text));
    }

    #[test]
    fn test_parse_vbin_strings_empty() {
        let result = parse_vbin_strings(&[]).unwrap();
        assert!(result.is_empty());
    }

    // ── find_vis_file tests ──

    #[test]
    fn test_find_vis_file_not_a_directory() {
        assert!(find_vis_file("/nonexistent/path/12345").is_none());
    }

    #[test]
    fn test_find_vis_file_with_config_ini() {
        let tmp_dir = std::env::temp_dir().join("test_vis_config_ini");
        fs::create_dir_all(&tmp_dir).ok();

        // Create a .vis file
        let vis_file = tmp_dir.join("mygame.vis");
        fs::write(&vis_file, b"VIS5\x00\x00\x00\x01").unwrap();

        // Create config.ini pointing to it
        let config = tmp_dir.join("config.ini");
        fs::write(&config, "FILE=mygame.vis\n").unwrap();

        let result = find_vis_file(tmp_dir.to_str().unwrap());
        assert!(result.is_some());
        assert!(result.unwrap().ends_with("mygame.vis"));

        fs::remove_dir_all(&tmp_dir).ok();
    }

    #[test]
    fn test_find_vis_file_fallback_scan() {
        let tmp_dir = std::env::temp_dir().join("test_vis_scan_fallback");
        fs::create_dir_all(&tmp_dir).ok();

        // Create a .vis file with no config.ini
        let vis_file = tmp_dir.join("fallback.vis");
        fs::write(&vis_file, b"VIS5data").unwrap();

        let result = find_vis_file(tmp_dir.to_str().unwrap());
        assert!(result.is_some());

        fs::remove_dir_all(&tmp_dir).ok();
    }

    #[test]
    fn test_find_vis_file_empty_dir() {
        let tmp_dir = std::env::temp_dir().join("test_vis_empty_dir");
        fs::create_dir_all(&tmp_dir).ok();

        let result = find_vis_file(tmp_dir.to_str().unwrap());
        assert!(result.is_none());

        fs::remove_dir_all(&tmp_dir).ok();
    }

    // ── Edge cases for is_translatable_vis_string ──

    #[test]
    fn test_translatable_with_ellipsis() {
        assert!(is_translatable_vis_string("I wonder what happened\u{2026}"));
    }

    #[test]
    fn test_translatable_rejects_non_ascii_heavy() {
        // More than 20% non-ASCII should be rejected
        let s = "\u{FF01}\u{FF02}\u{FF03}\u{FF04}\u{FF05}\u{FF06}\u{FF07}\u{FF08} ab";
        assert!(!is_translatable_vis_string(s));
    }

    #[test]
    fn test_translatable_rejects_few_letters() {
        assert!(!is_translatable_vis_string("1234 5678 9012"));
    }

    #[test]
    fn test_translatable_rejects_replace_item() {
        assert!(!is_translatable_vis_string("replaceItem(something) here now"));
    }

    #[test]
    fn test_translatable_rejects_activate_voice() {
        assert!(!is_translatable_vis_string("activate voice something here now"));
    }

    #[test]
    fn test_translatable_rejects_click_behaviour() {
        assert!(!is_translatable_vis_string("clickbehaviour setting value here"));
    }

    // ── Additional edge case: XOR with single-byte key ──

    #[test]
    fn test_xor_decrypt_single_byte_key() {
        let key = vec![0xFF];
        let mut data = vec![0x00, 0x01, 0x02];
        xor_decrypt(&mut data, &key);
        assert_eq!(data, vec![0xFF, 0xFE, 0xFD]);
    }

    // ── Boundary: read_be_u32 at exact boundary ──

    #[test]
    fn test_read_be_u32_exact_boundary() {
        let data = [0x00, 0x00, 0x00, 0x01]; // exactly 4 bytes
        assert_eq!(read_be_u32(&data, 0), 1);
        assert_eq!(read_be_u32(&data, 1), 0); // pos+4 > len
    }

    #[test]
    fn test_read_le_u32_exact_boundary() {
        let data = [0x01, 0x00, 0x00, 0x00];
        assert_eq!(read_le_u32(&data, 0), 1);
        assert_eq!(read_le_u32(&data, 1), 0); // out of bounds
    }
}
