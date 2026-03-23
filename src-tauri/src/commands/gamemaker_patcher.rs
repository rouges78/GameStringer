// GameMaker data.win string extractor & patcher
// Parses IFF-format data.win files to extract/replace strings from the STRG chunk.
// Compatible with GameMaker Studio 1.x, 2.x, and 2.3+.

use std::collections::HashMap;
use std::fs;
// std::io imports removed — patching uses extend_from_slice on Vec<u8>
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

// ── Types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmString {
    pub index: usize,
    pub offset: u64,       // offset in data.win del puntatore nella string table
    pub data_offset: u64,  // offset dove inizia il contenuto stringa
    pub original: String,
    pub translated: Option<String>,
    pub length: usize,
    pub is_translatable: bool, // euristica: contiene testo visibile?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmDataInfo {
    pub file_path: String,
    pub file_size: u64,
    pub gm_version: String,
    pub total_strings: usize,
    pub translatable_strings: usize,
    pub chunks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmPatchResult {
    pub success: bool,
    pub patched_count: usize,
    pub backup_path: String,
    pub message: String,
}

// ── IFF Chunk parsing helpers ──

// IffChunk struct omitted — we use tuples in parse_chunks instead

fn read_u32_le(data: &[u8], pos: usize) -> u32 {
    if pos + 4 > data.len() { return 0; }
    u32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]])
}

fn write_u32_le(data: &mut [u8], pos: usize, val: u32) {
    let bytes = val.to_le_bytes();
    data[pos..pos+4].copy_from_slice(&bytes);
}

/// Read a null-terminated UTF-8 string from data at given offset
fn read_gm_string(data: &[u8], offset: usize) -> String {
    if offset >= data.len() { return String::new(); }
    // GameMaker strings: 4-byte length prefix, then chars, then null terminator
    let len = read_u32_le(data, offset) as usize;
    let start = offset + 4;
    let end = (start + len).min(data.len());
    if start >= data.len() { return String::new(); }
    String::from_utf8_lossy(&data[start..end]).to_string()
}

/// Detect GM version from chunks present
fn detect_version(chunks: &[String]) -> String {
    if chunks.contains(&"SEQN".to_string()) || chunks.contains(&"FEDS".to_string()) {
        "Studio 2.3+".to_string()
    } else if chunks.contains(&"TGIN".to_string()) {
        "Studio 2.x".to_string()
    } else {
        "Studio 1.x".to_string()
    }
}

/// Heuristic: is this string translatable (visible user text)?
/// Key insight: real game text contains spaces (sentences, descriptions).
/// Internal resource names (sprites, sounds, objects) are snake_case without spaces.
fn is_translatable(s: &str) -> bool {
    let s = s.trim();
    // Skip empty or very short
    if s.len() < 3 { return false; }
    // Skip pure numbers / floats
    if s.parse::<f64>().is_ok() { return false; }
    // Skip file paths
    if s.contains('/') || s.contains('\\') { return false; }
    // Skip file extensions
    let lower = s.to_lowercase();
    if lower.ends_with(".ogg") || lower.ends_with(".wav") || lower.ends_with(".mp3")
       || lower.ends_with(".png") || lower.ends_with(".jpg") || lower.ends_with(".gif")
       || lower.ends_with(".bmp") || lower.ends_with(".json") || lower.ends_with(".csv")
       || lower.ends_with(".xml") || lower.ends_with(".ini") || lower.ends_with(".txt")
       || lower.ends_with(".gml") || lower.ends_with(".yy") || lower.ends_with(".yyp") {
        return false;
    }
    if s.starts_with('.') && s.len() < 10 { return false; }
    // Skip hex colors
    if s.starts_with('#') && s.len() <= 9 && s[1..].chars().all(|c| c.is_ascii_hexdigit()) {
        return false;
    }
    // Skip if no letter at all
    if !s.chars().any(|c| c.is_alphabetic()) { return false; }
    // Skip very long strings (likely code blocks)
    if s.len() > 5000 { return false; }
    // Skip GML code patterns
    if s.contains("var ") && s.contains(";") { return false; }
    if s.contains("function(") || s.contains("if (") || s.contains("while (") { return false; }
    if s.contains("&&") || s.contains("||") || s.contains("!=") { return false; }
    if s.contains("global.") || s.contains("self.") || s.contains("other.") { return false; }
    // Skip known GM internal prefixes (very comprehensive)
    if lower.starts_with("@@") || lower.starts_with("$$") { return false; }

    // ── GameMaker resource prefixes ──
    // Standard GM resource prefixes
    const GM_PREFIXES: &[&str] = &[
        "gml_", "scr_", "obj_", "spr_", "snd_", "rm_", "bg_", "fnt_", "tl_",
        "seq_", "ds_", "ev_", "__",
        // Sprite / visual asset prefixes (WOH-style and generic)
        "s_", "scard_", "shaus_", "smenu_", "smap_", "shud_", "ssumm_",
        // Sound / music prefixes
        "nes_", "sfx_", "ost_", "voc_", "ness_",
        // Character sprite prefixes
        "char_",
        // UI / menu prefixes
        "menu_", "menut_",
        // Audio group prefixes  
        "audiogroup_",
        // Pattern / card / god prefixes
        "pattern_", "cardgod_",
        // Other common GM resource prefixes
        "sprite", "sound", "font", "path", "timeline", "object", "room",
        // Control/system prefixes
        "vk_", "mb_", "cr_", "os_", "gp_", "buffer_",
    ];
    for prefix in GM_PREFIXES {
        if lower.starts_with(prefix) {
            return false;
        }
    }

    // ── Key rule: real translatable text almost always contains spaces ──
    // Internal identifiers (theme_combat, select_god, combat_win) do NOT have spaces.
    // Real game text: "FRESH MEAT - gain a mysterious meat", "Choose your character", etc.
    let has_space = s.contains(' ');
    
    if !has_space {
        // No space: only allow if it looks like a single real word (no underscores, not camelCase)
        // e.g. "Yes", "No", "OK", "Cancel", "STAMINA", "REASON" are legit short words
        if s.contains('_') { return false; } // snake_case identifier
        // Check for camelCase: lowercase followed by uppercase
        let chars: Vec<char> = s.chars().collect();
        for i in 1..chars.len() {
            if chars[i-1].is_lowercase() && chars[i].is_uppercase() {
                return false; // camelCase identifier
            }
        }
        // Single word with no underscore and no camelCase — could be a label
        // But skip if it looks like a known resource naming pattern
        if lower.starts_with("new_") || lower.starts_with("combat_") || lower.starts_with("select_")
           || lower.starts_with("theme_") || lower.starts_with("terminal_") {
            return false;
        }
        // Allow single real words (labels, UI elements)
        return true;
    }

    // Has spaces — very likely real text. Final sanity checks:
    // Skip if it looks like a comma-separated list of identifiers
    let words: Vec<&str> = s.split_whitespace().collect();
    if words.len() >= 2 && words.iter().all(|w| w.contains('_') && !w.contains(' ')) {
        return false; // list of identifiers separated by spaces
    }

    true
}

// ── Main parsing ──

/// Parse data.win and list all chunks
fn parse_chunks(data: &[u8]) -> Vec<(String, u32, u64)> {
    let mut chunks = Vec::new();
    if data.len() < 8 { return chunks; }
    // Verify FORM header
    if &data[0..4] != b"FORM" { return chunks; }
    let form_size = read_u32_le(data, 4) as u64;
    
    let mut pos: u64 = 8; // after FORM + size
    let end = (8 + form_size).min(data.len() as u64);
    
    while pos + 8 <= end {
        let p = pos as usize;
        let magic = String::from_utf8_lossy(&data[p..p+4]).to_string();
        let size = read_u32_le(data, p + 4);
        chunks.push((magic, size, pos + 8)); // data starts after magic+size
        pos += 8 + size as u64;
        // Align to 4 bytes (some GM versions)
        // Actually GM IFF doesn't require alignment, chunks are contiguous
    }
    chunks
}

/// Extract strings from the STRG chunk
fn extract_strings(data: &[u8], strg_offset: u64, _strg_size: u32) -> Vec<GmString> {
    let mut strings = Vec::new();
    let off = strg_offset as usize;
    
    if off + 4 > data.len() { return strings; }
    let count = read_u32_le(data, off) as usize;
    
    // String table: count, then count u32 pointers to string data
    // Each pointer is an absolute offset from start of file
    let table_start = off + 4;
    
    for i in 0..count {
        let ptr_offset = table_start + i * 4;
        if ptr_offset + 4 > data.len() { break; }
        let str_abs_offset = read_u32_le(data, ptr_offset) as usize;
        
        if str_abs_offset + 4 > data.len() { continue; }
        let text = read_gm_string(data, str_abs_offset);
        let translatable = is_translatable(&text);
        let len = text.len();
        
        strings.push(GmString {
            index: i,
            offset: ptr_offset as u64,
            data_offset: str_abs_offset as u64,
            original: text,
            translated: None,
            length: len,
            is_translatable: translatable,
        });
    }
    strings
}

// ── Tauri Commands ──

/// Find data.win in game directory
fn find_data_win(game_path: &str) -> Option<PathBuf> {
    let dir = Path::new(game_path);
    // Direct data.win
    let dw = dir.join("data.win");
    if dw.exists() { return Some(dw); }
    // game.unx (Linux)
    let unx = dir.join("game.unx");
    if unx.exists() { return Some(unx); }
    // game.ios
    let ios = dir.join("game.ios");
    if ios.exists() { return Some(ios); }
    // Subdirectories
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                    if name == "data.win" || name == "game.unx" || name == "game.ios" {
                        return Some(p);
                    }
                }
            }
        }
    }
    None
}

#[tauri::command(rename_all = "camelCase")]
pub async fn gm_scan_data_win(game_path: String) -> Result<GmDataInfo, String> {
    println!("[GM] Scanning data.win in: {}", game_path);
    
    let data_win_path = find_data_win(&game_path)
        .ok_or_else(|| "data.win non trovato nella cartella del gioco".to_string())?;
    
    let data = fs::read(&data_win_path)
        .map_err(|e| format!("Errore lettura data.win: {}", e))?;
    
    let chunks = parse_chunks(&data);
    let chunk_names: Vec<String> = chunks.iter().map(|(name, _, _)| name.clone()).collect();
    let version = detect_version(&chunk_names);
    
    // Find STRG chunk
    let strg = chunks.iter().find(|(name, _, _)| name == "STRG");
    let (total, translatable) = if let Some((_, size, offset)) = strg {
        let strings = extract_strings(&data, *offset, *size);
        let t = strings.iter().filter(|s| s.is_translatable).count();
        (strings.len(), t)
    } else {
        (0, 0)
    };
    
    let info = GmDataInfo {
        file_path: data_win_path.to_string_lossy().to_string(),
        file_size: data.len() as u64,
        gm_version: version,
        total_strings: total,
        translatable_strings: translatable,
        chunks: chunk_names,
    };
    
    println!("[GM] Found {} strings ({} translatable) in {} ({})", 
             total, translatable, data_win_path.display(), info.gm_version);
    
    Ok(info)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn gm_extract_strings(
    game_path: String,
    only_translatable: Option<bool>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<GmString>, String> {
    println!("[GM] Extracting strings from: {}", game_path);
    
    let data_win_path = find_data_win(&game_path)
        .ok_or_else(|| "data.win non trovato".to_string())?;
    
    let data = fs::read(&data_win_path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let chunks = parse_chunks(&data);
    let strg = chunks.iter().find(|(name, _, _)| name == "STRG")
        .ok_or_else(|| "Chunk STRG non trovato in data.win".to_string())?;
    
    let mut strings = extract_strings(&data, strg.2, strg.1);
    
    if only_translatable.unwrap_or(true) {
        strings.retain(|s| s.is_translatable);
    }
    
    // Pagination
    let start = offset.unwrap_or(0);
    let count = limit.unwrap_or(500);
    let end = (start + count).min(strings.len());
    
    if start < strings.len() {
        strings = strings[start..end].to_vec();
    } else {
        strings = Vec::new();
    }
    
    println!("[GM] Returning {} strings (offset={}, limit={})", strings.len(), start, count);
    Ok(strings)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn gm_patch_strings(
    game_path: String,
    translations: HashMap<usize, String>, // index -> translated text
) -> Result<GmPatchResult, String> {
    println!("[GM] Patching {} strings in: {}", translations.len(), game_path);
    
    let data_win_path = find_data_win(&game_path)
        .ok_or_else(|| "data.win non trovato".to_string())?;
    
    // Read original
    let data = fs::read(&data_win_path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    // Backup
    let backup_path = data_win_path.with_extension("win.bak");
    if !backup_path.exists() {
        fs::copy(&data_win_path, &backup_path)
            .map_err(|e| format!("Errore backup: {}", e))?;
        println!("[GM] Backup creato: {}", backup_path.display());
    }
    
    let chunks = parse_chunks(&data);
    let strg = chunks.iter().find(|(name, _, _)| name == "STRG")
        .ok_or_else(|| "Chunk STRG non trovato".to_string())?;
    
    let all_strings = extract_strings(&data, strg.2, strg.1);
    
    // Strategy: rebuild the STRG chunk with modified strings.
    // GameMaker STRG format:
    //   u32 count
    //   u32[count] pointers (absolute offsets to string data)
    //   String data: for each string: u32 length, chars[length], null byte
    //
    // When we change a string length, all subsequent pointers shift.
    // We rebuild the entire STRG chunk and adjust the FORM size.
    
    let strg_chunk_header_offset = strg.2 as usize - 8; // "STRG" magic + size
    let strg_data_offset = strg.2 as usize;
    let old_strg_size = strg.1 as usize;
    
    // Build new string data
    let count = all_strings.len();
    let table_size = 4 + count * 4; // count + pointers
    
    // First pass: collect all final strings
    let _final_strings: Vec<&str> = Vec::with_capacity(count);
    let mut patched_count = 0;
    
    // We need owned strings for translated versions
    let mut owned_translations: Vec<Option<String>> = vec![None; count];
    for s in &all_strings {
        if let Some(translated) = translations.get(&s.index) {
            owned_translations[s.index] = Some(translated.clone());
            patched_count += 1;
        }
    }
    
    // Calculate new string data section
    // After the pointer table, strings are: u32 len + chars + \0
    let mut string_data_buf: Vec<u8> = Vec::new();
    let mut new_pointers: Vec<u32> = Vec::with_capacity(count);
    
    // The absolute offset where string data starts (after the pointer table)
    // We'll calculate the actual absolute offset after we know where STRG lands
    // For now, use placeholder and fix later
    
    for (i, s) in all_strings.iter().enumerate() {
        let text = if let Some(ref t) = owned_translations[i] {
            t.as_str()
        } else {
            s.original.as_str()
        };
        let text_bytes = text.as_bytes();
        let text_len = text_bytes.len() as u32;
        
        // Record where this string data will be (relative to string_data_buf start)
        new_pointers.push(string_data_buf.len() as u32);
        
        // Write: u32 length + chars + null
        string_data_buf.extend_from_slice(&text_len.to_le_bytes());
        string_data_buf.extend_from_slice(text_bytes);
        string_data_buf.push(0); // null terminator
        
        // Align to 4 bytes (some GM versions need this)
        // Actually, let's check: padding between strings
        // GM usually packs strings tightly without alignment
    }
    
    // Build new STRG chunk data
    let new_strg_data_size = table_size + string_data_buf.len();
    let mut new_strg_data: Vec<u8> = Vec::with_capacity(new_strg_data_size);
    
    // Write count
    new_strg_data.extend_from_slice(&(count as u32).to_le_bytes());
    
    // Calculate absolute base for string data
    // The pointers table lives at: strg_data_offset + 4 + (i * 4)
    // String data starts at: strg_data_offset + 4 + count * 4
    let string_data_abs_base = (strg_data_offset + 4 + count * 4) as u32;
    
    // Write pointers (absolute offsets adjusted for new positions)
    for ptr in &new_pointers {
        let abs_ptr = string_data_abs_base + ptr;
        new_strg_data.extend_from_slice(&abs_ptr.to_le_bytes());
    }
    
    // Write string data
    new_strg_data.extend_from_slice(&string_data_buf);
    
    // Now rebuild the file
    // Parts: [before STRG chunk] [new STRG header + data] [after old STRG chunk]
    let before_strg = &data[..strg_chunk_header_offset];
    let after_strg_offset = strg_chunk_header_offset + 8 + old_strg_size;
    let after_strg = if after_strg_offset < data.len() {
        &data[after_strg_offset..]
    } else {
        &[]
    };
    
    let mut new_file: Vec<u8> = Vec::with_capacity(data.len());
    new_file.extend_from_slice(before_strg);
    
    // Write STRG chunk header
    new_file.extend_from_slice(b"STRG");
    new_file.extend_from_slice(&(new_strg_data.len() as u32).to_le_bytes());
    new_file.extend_from_slice(&new_strg_data);
    
    // If the STRG chunk size changed, we need to adjust all absolute offsets
    // in chunks AFTER STRG. This is complex — for now, if sizes differ,
    // we need to adjust pointers in other chunks too.
    let size_delta = new_strg_data.len() as i64 - old_strg_size as i64;
    
    if size_delta != 0 {
        // For chunks after STRG that contain absolute offsets, we'd need to 
        // adjust them. This is a simplified approach: we only support same-size
        // or we rebuild properly.
        // 
        // Better approach: pad shorter translations to original length,
        // or use a "full rebuild" mode.
        //
        // For safety, let's pad/truncate strings to keep STRG same size:
        if size_delta != 0 {
            // Rebuild with padding to maintain original size
            return rebuild_same_size(
                &data, &all_strings, &owned_translations, 
                strg_chunk_header_offset, strg_data_offset, old_strg_size,
                &data_win_path, &backup_path
            );
        }
    }
    
    new_file.extend_from_slice(after_strg);
    
    // Update FORM size
    let new_form_size = (new_file.len() - 8) as u32;
    write_u32_le(&mut new_file, 4, new_form_size);
    
    // Write patched file
    fs::write(&data_win_path, &new_file)
        .map_err(|e| format!("Errore scrittura data.win: {}", e))?;
    
    println!("[GM] Patch completata: {} stringhe modificate", patched_count);
    
    Ok(GmPatchResult {
        success: true,
        patched_count,
        backup_path: backup_path.to_string_lossy().to_string(),
        message: format!("{} stringhe tradotte e salvate in data.win", patched_count),
    })
}

/// Rebuild STRG chunk keeping the same total size by padding/truncating strings
fn rebuild_same_size(
    data: &[u8],
    all_strings: &[GmString],
    translations: &[Option<String>],
    _strg_chunk_header_offset: usize,
    strg_data_offset: usize,
    old_strg_size: usize,
    data_win_path: &Path,
    backup_path: &Path,
) -> Result<GmPatchResult, String> {
    println!("[GM] Using same-size rebuild strategy (safer)");
    
    let count = all_strings.len();
    let table_size = 4 + count * 4;
    let string_data_abs_base = (strg_data_offset + table_size) as u32;
    let available_data_space = old_strg_size - table_size;
    
    // Build string data with exact-fit: pad short strings, truncate long ones
    let mut string_data_buf: Vec<u8> = Vec::with_capacity(available_data_space);
    let mut new_pointers: Vec<u32> = Vec::with_capacity(count);
    let mut patched_count = 0;
    
    for (i, s) in all_strings.iter().enumerate() {
        let text = if let Some(ref t) = translations[i] {
            patched_count += 1;
            t.as_str()
        } else {
            s.original.as_str()
        };
        
        let text_bytes = text.as_bytes();
        let _original_entry_size = s.length + 4 + 1; // u32 len + chars + null
        
        // Calculate how much space this entry had originally
        let next_data_offset = if i + 1 < all_strings.len() {
            all_strings[i + 1].data_offset as usize - strg_data_offset - table_size
        } else {
            available_data_space
        };
        let entry_space = next_data_offset - string_data_buf.len();
        
        // Minimum: 4 (len) + 1 (null) = 5
        if entry_space < 5 {
            // No space, write minimal
            new_pointers.push(string_data_abs_base + string_data_buf.len() as u32);
            string_data_buf.extend_from_slice(&0u32.to_le_bytes());
            string_data_buf.push(0);
            // Pad remaining
            while string_data_buf.len() < next_data_offset {
                string_data_buf.push(0);
            }
            continue;
        }
        
        let max_text_len = entry_space - 5; // space for len prefix + null
        let actual_text = if text_bytes.len() > max_text_len {
            // Truncate at valid UTF-8 boundary
            let mut end = max_text_len;
            while end > 0 && !text.is_char_boundary(end) {
                end -= 1;
            }
            &text_bytes[..end]
        } else {
            text_bytes
        };
        
        new_pointers.push(string_data_abs_base + string_data_buf.len() as u32);
        string_data_buf.extend_from_slice(&(actual_text.len() as u32).to_le_bytes());
        string_data_buf.extend_from_slice(actual_text);
        string_data_buf.push(0);
        
        // Pad to fill original space
        while string_data_buf.len() < next_data_offset {
            string_data_buf.push(0);
        }
    }
    
    // Ensure exact size
    string_data_buf.resize(available_data_space, 0);
    
    // Build new STRG chunk
    let mut new_strg: Vec<u8> = Vec::with_capacity(old_strg_size);
    new_strg.extend_from_slice(&(count as u32).to_le_bytes());
    for ptr in &new_pointers {
        new_strg.extend_from_slice(&ptr.to_le_bytes());
    }
    new_strg.extend_from_slice(&string_data_buf);
    new_strg.resize(old_strg_size, 0);
    
    // Patch directly into file copy
    let mut new_file = data.to_vec();
    let strg_data_start = strg_data_offset;
    let strg_data_end = strg_data_start + old_strg_size;
    
    if strg_data_end <= new_file.len() && new_strg.len() == old_strg_size {
        new_file[strg_data_start..strg_data_end].copy_from_slice(&new_strg);
    } else {
        return Err("Errore: dimensioni STRG non corrispondono".to_string());
    }
    
    fs::write(data_win_path, &new_file)
        .map_err(|e| format!("Errore scrittura: {}", e))?;
    
    println!("[GM] Same-size patch completata: {} stringhe", patched_count);
    
    Ok(GmPatchResult {
        success: true,
        patched_count,
        backup_path: backup_path.to_string_lossy().to_string(),
        message: format!("{} stringhe tradotte (same-size mode)", patched_count),
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn gm_restore_backup(game_path: String) -> Result<String, String> {
    let data_win_path = find_data_win(&game_path)
        .ok_or_else(|| "data.win non trovato".to_string())?;
    
    let backup_path = data_win_path.with_extension("win.bak");
    if !backup_path.exists() {
        return Err("Nessun backup trovato (data.win.bak)".to_string());
    }
    
    fs::copy(&backup_path, &data_win_path)
        .map_err(|e| format!("Errore ripristino: {}", e))?;
    
    println!("[GM] Backup ripristinato: {}", data_win_path.display());
    Ok("Backup ripristinato con successo".to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn gm_search_strings(
    game_path: String,
    query: String,
    only_translatable: Option<bool>,
) -> Result<Vec<GmString>, String> {
    let data_win_path = find_data_win(&game_path)
        .ok_or_else(|| "data.win non trovato".to_string())?;
    
    let data = fs::read(&data_win_path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let chunks = parse_chunks(&data);
    let strg = chunks.iter().find(|(name, _, _)| name == "STRG")
        .ok_or_else(|| "Chunk STRG non trovato".to_string())?;
    
    let strings = extract_strings(&data, strg.2, strg.1);
    let query_lower = query.to_lowercase();
    
    let results: Vec<GmString> = strings.into_iter()
        .filter(|s| {
            if only_translatable.unwrap_or(true) && !s.is_translatable {
                return false;
            }
            s.original.to_lowercase().contains(&query_lower)
        })
        .take(200)
        .collect();
    
    Ok(results)
}
