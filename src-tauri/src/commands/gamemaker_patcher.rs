// GameMaker data.win string extractor & patcher
// Parses IFF-format data.win files to extract/replace strings from the STRG chunk.
// Compatible with GameMaker Studio 1.x, 2.x, and 2.3+.

use std::collections::HashMap;
use std::fs;
// std::io imports removed — patching uses extend_from_slice on Vec<u8>
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use crate::commands::encoding_utils;

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
    pub is_yyc: bool,         // true if game is compiled with YYC (text in EXE, not data.win)
    pub exe_path: Option<String>, // path to game executable (for YYC games)
    pub has_language_files: bool,  // true if game has language/*.jn files
    pub language_dir: Option<String>, // path to language directory
    pub language_file_count: usize, // number of .jn files in engLanguage/
    pub string_source: String,  // "strg", "exe", or "language_files"
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

#[allow(dead_code)]
fn _write_u32_le(data: &mut [u8], pos: usize, val: u32) {
    let bytes = val.to_le_bytes();
    data[pos..pos+4].copy_from_slice(&bytes);
}

/// Read a length-prefixed string from data at given offset.
/// GameMaker STRG strings may be UTF-8, Windows-1252, or Shift-JIS.
fn read_gm_string(data: &[u8], offset: usize) -> String {
    if offset >= data.len() { return String::new(); }
    // GameMaker strings: 4-byte length prefix, then chars, then null terminator
    let len = read_u32_le(data, offset) as usize;
    let start = offset + 4;
    let end = (start + len).min(data.len());
    if start >= data.len() { return String::new(); }
    let bytes = &data[start..end];
    // Try UTF-8 first (most common in modern GameMaker)
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }
    // Non-UTF-8: detect encoding (Windows-1252, Shift-JIS, etc.)
    // Note: STRG strings are never UTF-16, so we use detect_encoding but
    // override any false-positive BOM detection (short byte sequences can
    // coincidentally start with 0xFF 0xFE).
    let enc_result = encoding_utils::detect_encoding(bytes);
    let encoding = if enc_result.encoding.starts_with("utf-16") {
        // STRG chunk strings are single-byte or multi-byte, never UTF-16;
        // fall back to Windows-1252 which covers the full 0x00-0xFF range.
        "windows-1252"
    } else {
        &enc_result.encoding
    };
    encoding_utils::decode_string(bytes, encoding)
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

// ── YYC EXE string extraction ──

/// Find the game executable in game directory
fn find_game_exe(game_path: &str) -> Option<PathBuf> {
    let dir = Path::new(game_path);
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    if ext.eq_ignore_ascii_case("exe") {
                        // Skip common non-game executables
                        if let Some(name) = p.file_stem().and_then(|n| n.to_str()) {
                            let lower = name.to_lowercase();
                            if lower.contains("unins") || lower.contains("setup") 
                               || lower.contains("crash") || lower.contains("redist")
                               || lower.contains("vcredist") || lower.contains("dxsetup") {
                                continue;
                            }
                        }
                        return Some(p);
                    }
                }
            }
        }
    }
    None
}

/// Heuristic: is this EXE string translatable game text?
fn is_translatable_exe_string(s: &str) -> bool {
    let s = s.trim();
    if s.len() < 8 { return false; }
    // Must contain a space (real text, not identifiers)
    if !s.contains(' ') { return false; }
    // Must have letters
    if !s.chars().any(|c| c.is_alphabetic()) { return false; }
    
    let lower = s.to_lowercase();
    
    // ── Structural text quality checks ──
    // x86 machine code decoded as ASCII produces strings like "L$ UVWATAUAVAWH",
    // "D$(9D$ }\HcD$ H", "uVfE9E uOfE9E0". These pass naive word-count checks
    // because they contain letter sequences. We need deeper structural analysis.
    
    // Split into "tokens" separated by non-alphanumeric chars
    let tokens: Vec<&str> = s.split(|c: char| !c.is_alphanumeric()).filter(|t| !t.is_empty()).collect();
    
    // Count tokens that look like real words:
    // - 3+ chars
    // - Contains at least one vowel AND one consonant (not all-consonant gibberish)
    // - Not a mix of digits and letters (like "9r", "E9Z", "D24")
    let vowels = "aeiouAEIOU";
    let mut real_word_count = 0usize;
    let mut letter_count = 0usize;
    
    for token in &tokens {
        let has_digit = token.chars().any(|c| c.is_ascii_digit());
        let has_letter = token.chars().any(|c| c.is_alphabetic());
        let letter_chars: String = token.chars().filter(|c| c.is_alphabetic()).collect();
        
        // Count letters globally
        letter_count += token.chars().filter(|c| c.is_alphabetic()).count();
        
        // Skip tokens that mix digits and letters (x86 artifact: "9r", "E9Z", "H0u")
        if has_digit && has_letter { continue; }
        
        // Only consider letter-only tokens of 3+ chars
        if letter_chars.len() < 3 { continue; }
        
        let has_vowel = letter_chars.chars().any(|c| vowels.contains(c));
        let has_consonant = letter_chars.chars().any(|c| c.is_alphabetic() && !vowels.contains(c));
        
        // Real words have vowels AND consonants
        if has_vowel && has_consonant {
            real_word_count += 1;
        }
    }
    
    // Must have at least 2 real words
    if real_word_count < 2 { return false; }
    // Letters must be at least 40% of total
    let letter_ratio = letter_count as f64 / s.len() as f64;
    if letter_ratio < 0.40 { return false; }
    
    // ── Known non-game patterns ──
    if lower.contains("dos mode") || lower.contains("this program") { return false; }
    
    // ── C format strings / GM runtime error messages ──
    // These contain %d, %s, %f, %i, %u patterns (printf-style)
    if s.contains("%d") || s.contains("%s") || s.contains("%f") || s.contains("%i") || s.contains("%u") || s.contains("%x") || s.contains("%p") {
        return false;
    }
    // GM runtime/engine error messages
    if lower.contains("index out of bounds") { return false; }
    if lower.contains("not an array") || lower.contains("not a number") { return false; }
    if lower.contains("unable to") && (lower.contains("convert") || lower.contains("add") || lower.contains("find") || lower.contains("allocate")) { return false; }
    if lower.contains("invalid type") || lower.contains("invalid argument") { return false; }
    if lower.contains("stack overflow") || lower.contains("out of memory") { return false; }
    if lower.contains("trying to") && (lower.contains("index") || lower.contains("access") || lower.contains("read") || lower.contains("write")) { return false; }
    if lower.contains("variable") && (lower.contains("not set") || lower.contains("not found") || lower.contains("uninitialized")) { return false; }
    if lower.contains("array") && (lower.contains("expected") || lower.contains("bounds") || lower.contains("dimension")) { return false; }
    if lower.contains("argument count") || lower.contains("wrong number") { return false; }
    if lower.contains("division by zero") || lower.contains("negative value") { return false; }
    if lower.contains("ds_") && lower.contains("does not exist") { return false; }
    if lower.contains("instance") && lower.contains("does not exist") { return false; }
    if lower.contains("fatal error") || lower.contains("unhandled exception") { return false; }
    if lower.contains("assertion") || lower.contains("debug_break") { return false; }
    
    // ── Shader / GPU code ──
    if lower.contains("#define") || lower.contains("#include") || lower.contains("#version") { return false; }
    if lower.contains("precision ") && lower.contains("float") { return false; }
    if lower.contains("sampler2d") || lower.contains("uniform ") { return false; }
    if lower.contains("vec4 ") || lower.contains("vec3 ") || lower.contains("float ") { return false; }
    if lower.starts_with("//") { return false; }
    if lower.contains("matrix") && lower.contains("view") { return false; }
    if lower.contains("register(") { return false; }
    if lower.contains("microsoft") && (lower.contains("compiler") || lower.contains("shader")) { return false; }
    
    // ── OS / System strings ──
    if lower.contains(".dll") || lower.contains(".exe") || lower.contains(".sys") { return false; }
    if lower.contains("kernel32") || lower.contains("ntdll") || lower.contains("advapi") || lower.contains("user32") { return false; }
    if lower.contains("hresult") || lower.contains("win32") || lower.contains("directx") { return false; }
    if lower.contains("copyright") && lower.contains("microsoft") { return false; }
    
    // ── GML code patterns ──
    if lower.contains("global.") || lower.contains("self.") || lower.contains("other.") { return false; }
    if lower.contains("var ") && lower.contains(";") { return false; }
    if lower.contains("function(") || lower.contains("if (") || lower.contains("while (") { return false; }
    if lower.contains("&&") || lower.contains("||") || lower.contains("!=") { return false; }
    if lower.contains("gml_") || lower.contains("obj_") || lower.contains("scr_") { return false; }
    if lower.contains("ds_map") || lower.contains("ds_list") || lower.contains("ds_grid") { return false; }
    
    // ── Save file / config / debug strings ──
    if lower.contains("save file") && lower.contains("for ") { return false; }
    if lower.contains("[debug]") || lower.contains("[error]") || lower.contains("[warning]") { return false; }
    if lower.contains("[load]") || lower.contains("[save]") { return false; }
    // Dev log messages: "something loaded:", "something not found!", "something failed:"
    if lower.ends_with(':') && s.len() < 40 { return false; }
    if lower.contains("not found") && s.len() < 50 { return false; }
    if lower.contains("loaded:") || lower.contains("loading:") || lower.contains("failed:") { return false; }
    if lower.contains("folder not found") || lower.contains("file not found") { return false; }
    if lower.contains("initialized") && s.len() < 50 { return false; }
    
    true
}

/// Extract readable text strings from a YYC-compiled EXE binary
fn extract_exe_strings(data: &[u8], min_len: usize) -> Vec<GmString> {
    let mut strings = Vec::new();
    let mut i = 0;
    let mut index = 0;
    
    while i < data.len() {
        // Find start of a readable ASCII sequence
        if data[i] >= 0x20 && data[i] <= 0x7e || data[i] == b'\r' || data[i] == b'\n' || data[i] == b'\t' {
            let start = i;
            while i < data.len() && (data[i] >= 0x20 && data[i] <= 0x7e || data[i] == b'\r' || data[i] == b'\n' || data[i] == b'\t') {
                i += 1;
            }
            let len = i - start;
            if len >= min_len {
                if let Ok(text) = std::str::from_utf8(&data[start..i]) {
                    let text = text.trim();
                    if text.len() >= min_len {
                        let translatable = is_translatable_exe_string(text);
                        strings.push(GmString {
                            index,
                            offset: start as u64,
                            data_offset: start as u64,
                            original: text.to_string(),
                            translated: None,
                            length: len,
                            is_translatable: translatable,
                        });
                        index += 1;
                    }
                }
            }
        }
        i += 1;
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

/// Find language directory with .jn files (e.g. language/engLanguage/)
fn find_language_dir(game_path: &str) -> Option<(PathBuf, PathBuf)> {
    let dir = Path::new(game_path);
    let lang_dir = dir.join("language");
    if !lang_dir.is_dir() { return None; }
    
    // Look for engLanguage/ (English source for translations)
    let eng_dir = lang_dir.join("engLanguage");
    if eng_dir.is_dir() {
        // Check if it has .jn files
        if let Ok(entries) = fs::read_dir(&eng_dir) {
            let jn_count = entries.flatten()
                .filter(|e| e.path().extension().is_some_and(|ext| ext == "jn"))
                .count();
            if jn_count > 0 {
                return Some((lang_dir, eng_dir));
            }
        }
    }
    None
}

/// Count translatable strings in .jn files (format: "English text|Japanese text" per line)
fn count_jn_strings(eng_dir: &Path) -> (usize, usize) {
    let mut total = 0usize;
    let mut file_count = 0usize;
    
    if let Ok(entries) = fs::read_dir(eng_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext == "jn") {
                file_count += 1;
                if let Ok(content) = fs::read_to_string(&path) {
                    for line in content.lines() {
                        let line = line.trim();
                        if !line.is_empty() && line.contains('|') {
                            total += 1;
                        }
                    }
                }
            }
        }
    }
    (total, file_count)
}

/// Extract strings from .jn files as GmString entries
fn extract_jn_strings(eng_dir: &Path) -> Vec<GmString> {
    let mut strings = Vec::new();
    let mut index = 0;
    
    if let Ok(entries) = fs::read_dir(eng_dir) {
        let mut paths: Vec<_> = entries.flatten().map(|e| e.path()).collect();
        paths.sort();
        
        for path in paths {
            if path.extension().is_none_or(|ext| ext != "jn") { continue; }
            let _filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            
            if let Ok(content) = fs::read_to_string(&path) {
                for (line_num, line) in content.lines().enumerate() {
                    let line = line.trim();
                    if line.is_empty() { continue; }
                    
                    // Format: "English text|Japanese text" or just "English text"
                    let english_part = if let Some(pipe_pos) = line.find('|') {
                        &line[..pipe_pos]
                    } else {
                        line
                    };
                    
                    if english_part.is_empty() { continue; }
                    
                    strings.push(GmString {
                        index,
                        offset: line_num as u64,     // line number in file
                        data_offset: 0,              // not used for .jn
                        original: english_part.to_string(),
                        translated: None,
                        length: english_part.len(),
                        is_translatable: true,       // all .jn strings are translatable
                    });
                    index += 1;
                }
            }
        }
    }
    strings
}

#[tauri::command(rename_all = "camelCase")]
pub async fn gm_scan_data_win(game_path: String) -> Result<GmDataInfo, String> {
    println!("[GM] Scanning in: {}", game_path);
    
    let data_win_path = find_data_win(&game_path)
        .ok_or_else(|| "data.win non trovato nella cartella del gioco".to_string())?;
    
    let data = fs::read(&data_win_path)
        .map_err(|e| format!("Errore lettura data.win: {}", e))?;
    
    let chunks = parse_chunks(&data);
    let chunk_names: Vec<String> = chunks.iter().map(|(name, _, _)| name.clone()).collect();
    let version = detect_version(&chunk_names);
    
    // ── Priority 1: Check for language/*.jn files ──
    if let Some((lang_dir, eng_dir)) = find_language_dir(&game_path) {
        let (jn_total, jn_file_count) = count_jn_strings(&eng_dir);
        println!("[GM] Language files found: {} .jn files, {} strings in {}", 
                 jn_file_count, jn_total, eng_dir.display());
        
        return Ok(GmDataInfo {
            file_path: data_win_path.to_string_lossy().to_string(),
            file_size: data.len() as u64,
            gm_version: format!("{} (Language Files)", version),
            total_strings: jn_total,
            translatable_strings: jn_total, // all .jn strings are translatable
            chunks: chunk_names,
            is_yyc: false,
            exe_path: None,
            has_language_files: true,
            language_dir: Some(lang_dir.to_string_lossy().to_string()),
            language_file_count: jn_file_count,
            string_source: "language_files".to_string(),
        });
    }
    
    // ── Priority 2: STRG chunk analysis ──
    let strg = chunks.iter().find(|(name, _, _)| name == "STRG");
    let (strg_total, strg_translatable) = if let Some((_, size, offset)) = strg {
        let strings = extract_strings(&data, *offset, *size);
        let t = strings.iter().filter(|s| s.is_translatable).count();
        (strings.len(), t)
    } else {
        (0, 0)
    };
    
    // ── Priority 3: YYC detection → EXE scan ──
    let yyc_threshold = (strg_total as f64 * 0.05) as usize;
    let is_yyc = strg_translatable < yyc_threshold.max(50);
    
    let (total, translatable, exe_path, source) = if is_yyc {
        if let Some(exe) = find_game_exe(&game_path) {
            println!("[GM] YYC detected — scanning EXE: {}", exe.display());
            match fs::read(&exe) {
                Ok(exe_data) => {
                    let exe_strings = extract_exe_strings(&exe_data, 15);
                    let t = exe_strings.iter().filter(|s| s.is_translatable).count();
                    println!("[GM] EXE: {} total, {} translatable", exe_strings.len(), t);
                    (exe_strings.len(), t, Some(exe.to_string_lossy().to_string()), "exe")
                }
                Err(e) => {
                    println!("[GM] Failed to read EXE: {}", e);
                    (strg_total, strg_translatable, None, "strg")
                }
            }
        } else {
            (strg_total, strg_translatable, None, "strg")
        }
    } else {
        (strg_total, strg_translatable, None, "strg")
    };
    
    println!("[GM] Found {} strings ({} translatable) — source={}, YYC={}", 
             total, translatable, source, is_yyc);
    
    Ok(GmDataInfo {
        file_path: data_win_path.to_string_lossy().to_string(),
        file_size: data.len() as u64,
        gm_version: if is_yyc { format!("{} (YYC)", version) } else { version },
        total_strings: total,
        translatable_strings: translatable,
        chunks: chunk_names,
        is_yyc,
        exe_path,
        has_language_files: false,
        language_dir: None,
        language_file_count: 0,
        string_source: source.to_string(),
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn gm_extract_strings(
    game_path: String,
    only_translatable: Option<bool>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<GmString>, String> {
    println!("[GM] Extracting strings from: {}", game_path);
    
    // ── Priority 1: Language .jn files ──
    if let Some((_lang_dir, eng_dir)) = find_language_dir(&game_path) {
        let mut strings = extract_jn_strings(&eng_dir);
        println!("[GM] Language files mode — {} strings from .jn files", strings.len());
        
        if only_translatable.unwrap_or(true) {
            strings.retain(|s| s.is_translatable);
        }
        let start = offset.unwrap_or(0);
        let count = limit.unwrap_or(100);
        let end = (start + count).min(strings.len());
        if start < strings.len() {
            strings = strings[start..end].to_vec();
        } else {
            strings = vec![];
        }
        println!("[GM] Returning {} strings (offset={}, limit={}, source=jn)", strings.len(), start, count);
        return Ok(strings);
    }
    
    // ── Priority 2/3: STRG or EXE ──
    let data_win_path = find_data_win(&game_path)
        .ok_or_else(|| "data.win non trovato".to_string())?;
    
    let data = fs::read(&data_win_path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let chunks = parse_chunks(&data);
    let strg = chunks.iter().find(|(name, _, _)| name == "STRG")
        .ok_or_else(|| "Chunk STRG non trovato in data.win".to_string())?;
    
    let strg_strings = extract_strings(&data, strg.2, strg.1);
    let strg_translatable = strg_strings.iter().filter(|s| s.is_translatable).count();
    let is_yyc = strg_translatable < 50;
    
    let mut strings = if is_yyc {
        if let Some(exe_path) = find_game_exe(&game_path) {
            println!("[GM] YYC mode — extracting from EXE: {}", exe_path.display());
            let exe_data = fs::read(&exe_path)
                .map_err(|e| format!("Errore lettura EXE: {}", e))?;
            extract_exe_strings(&exe_data, 15)
        } else {
            strg_strings
        }
    } else {
        strg_strings
    };
    
    if only_translatable.unwrap_or(true) {
        strings.retain(|s| s.is_translatable);
    }
    
    // Pagination
    let start = offset.unwrap_or(0);
    let count = limit.unwrap_or(100);
    let end = (start + count).min(strings.len());
    
    if start < strings.len() {
        strings = strings[start..end].to_vec();
    } else {
        strings = Vec::new();
    }
    
    println!("[GM] Returning {} strings (offset={}, limit={}, yyc={})", strings.len(), start, count, is_yyc);
    Ok(strings)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn gm_patch_strings(
    game_path: String,
    translations: HashMap<usize, String>, // index -> translated text
) -> Result<GmPatchResult, String> {
    println!("[GM] Patching {} strings in: {}", translations.len(), game_path);
    
    // ── Priority 1: Language .jn files → create itaLanguage/ ──
    if let Some((lang_dir, eng_dir)) = find_language_dir(&game_path) {
        return patch_language_files(&lang_dir, &eng_dir, &translations);
    }
    
    // ── Priority 2/3: EXE or data.win ──
    let data_win_path = find_data_win(&game_path)
        .ok_or_else(|| "data.win non trovato".to_string())?;
    
    let data = fs::read(&data_win_path)
        .map_err(|e| format!("Errore lettura data.win: {}", e))?;
    
    let chunks = parse_chunks(&data);
    let strg = chunks.iter().find(|(name, _, _)| name == "STRG")
        .ok_or_else(|| "Chunk STRG non trovato".to_string())?;
    
    let strg_strings = extract_strings(&data, strg.2, strg.1);
    let strg_translatable = strg_strings.iter().filter(|s| s.is_translatable).count();
    let is_yyc = strg_translatable < 50;
    
    if is_yyc {
        patch_exe(&game_path, &translations)
    } else {
        patch_data_win(&data, &data_win_path, strg, &strg_strings, &translations)
    }
}

/// Overwrite engLanguage/ .jn files with translations (backup to engLanguage.bak/)
fn patch_language_files(
    lang_dir: &Path,
    eng_dir: &Path,
    translations: &HashMap<usize, String>,
) -> Result<GmPatchResult, String> {
    // Backup engLanguage/ → engLanguage.bak/ (only first time)
    let backup_dir = lang_dir.join("engLanguage.bak");
    if !backup_dir.exists() {
        println!("[GM-JN] Backup engLanguage/ → engLanguage.bak/");
        fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Errore creazione backup: {}", e))?;
        
        if let Ok(entries) = fs::read_dir(eng_dir) {
            for entry in entries.flatten() {
                let src = entry.path();
                if src.is_file() {
                    let dst = backup_dir.join(entry.file_name());
                    fs::copy(&src, &dst)
                        .map_err(|e| format!("Errore backup {}: {}", src.display(), e))?;
                }
            }
        }
    }
    
    println!("[GM-JN] Patching engLanguage/ in {}", lang_dir.display());
    
    // Re-walk .jn files in same order as extract_jn_strings
    let mut entries = fs::read_dir(eng_dir)
        .map_err(|e| format!("Errore lettura engLanguage/: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .collect::<Vec<_>>();
    entries.sort();
    
    let mut global_index = 0usize;
    let mut patched_count = 0usize;
    
    for path in &entries {
        if path.extension().is_none_or(|ext| ext != "jn") { continue; }
        let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        
        // Read from backup (original) to avoid re-patching already patched files
        let backup_file = backup_dir.join(&filename);
        let content = if backup_file.exists() {
            fs::read_to_string(&backup_file)
                .map_err(|e| format!("Errore lettura backup {}: {}", filename, e))?
        } else {
            fs::read_to_string(path)
                .map_err(|e| format!("Errore lettura {}: {}", filename, e))?
        };
        
        let mut output_lines = Vec::new();
        
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                output_lines.push(String::new());
                continue;
            }
            
            // Parse: "English text|Japanese text"
            let (english_part, jp_part) = if let Some(pipe_pos) = trimmed.find('|') {
                (&trimmed[..pipe_pos], Some(&trimmed[pipe_pos + 1..]))
            } else {
                (trimmed, None)
            };
            
            if english_part.is_empty() {
                output_lines.push(trimmed.to_string());
                global_index += 1;
                continue;
            }
            
            // Check if we have a translation for this index
            if let Some(translated) = translations.get(&global_index) {
                if let Some(jp) = jp_part {
                    output_lines.push(format!("{}|{}", translated, jp));
                } else {
                    output_lines.push(translated.clone());
                }
                patched_count += 1;
            } else {
                // No translation — copy original
                output_lines.push(trimmed.to_string());
            }
            
            global_index += 1;
        }
        
        // Overwrite engLanguage/ file directly (CRLF line endings to match original)
        fs::write(path, output_lines.join("\r\n"))
            .map_err(|e| format!("Errore scrittura {}: {}", filename, e))?;
    }
    
    let file_count = entries.iter().filter(|p| p.extension().is_some_and(|ext| ext == "jn")).count();
    println!("[GM-JN] engLanguage/ patchata: {} stringhe in {} file", patched_count, file_count);
    
    Ok(GmPatchResult {
        success: true,
        patched_count,
        backup_path: backup_dir.to_string_lossy().to_string(),
        message: format!("{} stringhe tradotte in engLanguage/ (backup in engLanguage.bak/)", patched_count),
    })
}

/// Patch a YYC-compiled EXE by replacing strings at their exact byte offsets
fn patch_exe(
    game_path: &str,
    translations: &HashMap<usize, String>,
) -> Result<GmPatchResult, String> {
    let exe_path = find_game_exe(game_path)
        .ok_or_else(|| "EXE del gioco non trovato".to_string())?;
    
    println!("[GM-YYC] Patching EXE: {}", exe_path.display());
    
    // Backup EXE
    let backup_path = exe_path.with_extension("exe.bak");
    if !backup_path.exists() {
        fs::copy(&exe_path, &backup_path)
            .map_err(|e| format!("Errore backup EXE: {}", e))?;
        println!("[GM-YYC] Backup EXE creato: {}", backup_path.display());
    }
    
    // Read EXE
    let mut exe_data = fs::read(&exe_path)
        .map_err(|e| format!("Errore lettura EXE: {}", e))?;
    
    // Re-extract strings to get offsets
    let all_strings = extract_exe_strings(&exe_data, 15);
    
    let mut patched_count = 0;
    
    for (idx, translated) in translations.iter() {
        // Find the string by index
        if let Some(s) = all_strings.iter().find(|s| s.index == *idx) {
            let offset = s.data_offset as usize;
            let original_len = s.length; // byte length in EXE
            let trans_bytes = translated.as_bytes();
            
            // Same-length replacement: pad with spaces or truncate
            let end = offset + original_len;
            if end > exe_data.len() { continue; }
            
            // Write translated bytes (truncate if longer)
            let write_len = trans_bytes.len().min(original_len);
            exe_data[offset..offset + write_len].copy_from_slice(&trans_bytes[..write_len]);
            
            // Pad remaining with spaces (0x20) to keep same length
            if write_len < original_len {
                for b in &mut exe_data[offset + write_len..end] {
                    *b = 0x20; // space padding
                }
            }
            
            patched_count += 1;
        }
    }
    
    // Write patched EXE
    fs::write(&exe_path, &exe_data)
        .map_err(|e| format!("Errore scrittura EXE: {}", e))?;
    
    println!("[GM-YYC] Patch EXE completata: {} stringhe", patched_count);
    
    Ok(GmPatchResult {
        success: true,
        patched_count,
        backup_path: backup_path.to_string_lossy().to_string(),
        message: format!("{} stringhe tradotte nell'EXE (same-length)", patched_count),
    })
}

/// Patch data.win STRG chunk (standard non-YYC games)
fn patch_data_win(
    data: &[u8],
    data_win_path: &Path,
    strg: &(String, u32, u64),
    all_strings: &[GmString],
    translations: &HashMap<usize, String>,
) -> Result<GmPatchResult, String> {
    // Backup
    let backup_path = data_win_path.with_extension("win.bak");
    if !backup_path.exists() {
        fs::copy(data_win_path, &backup_path)
            .map_err(|e| format!("Errore backup: {}", e))?;
        println!("[GM] Backup creato: {}", backup_path.display());
    }
    
    let strg_chunk_header_offset = strg.2 as usize - 8;
    let strg_data_offset = strg.2 as usize;
    let old_strg_size = strg.1 as usize;
    let count = all_strings.len();
    
    // Build owned translations array
    let mut owned_translations: Vec<Option<String>> = vec![None; count];
    for s in all_strings {
        if let Some(translated) = translations.get(&s.index) {
            if s.index < count {
                owned_translations[s.index] = Some(translated.clone());
            }
        }
    }
    
    // Always use same-size rebuild for safety
    rebuild_same_size(
        data, all_strings, &owned_translations,
        strg_chunk_header_offset, strg_data_offset, old_strg_size,
        data_win_path, &backup_path
    )
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
    let mut restored = Vec::new();
    
    // Try restoring data.win backup
    if let Some(data_win_path) = find_data_win(&game_path) {
        let backup_path = data_win_path.with_extension("win.bak");
        if backup_path.exists() {
            fs::copy(&backup_path, &data_win_path)
                .map_err(|e| format!("Errore ripristino data.win: {}", e))?;
            println!("[GM] data.win backup ripristinato: {}", data_win_path.display());
            restored.push("data.win");
        }
    }
    
    // Try restoring EXE backup (YYC games)
    if let Some(exe_path) = find_game_exe(&game_path) {
        let backup_path = exe_path.with_extension("exe.bak");
        if backup_path.exists() {
            fs::copy(&backup_path, &exe_path)
                .map_err(|e| format!("Errore ripristino EXE: {}", e))?;
            println!("[GM] EXE backup ripristinato: {}", exe_path.display());
            restored.push("EXE");
        }
    }
    
    // Try restoring engLanguage.bak/ (language file games)
    if let Some((_lang_dir, eng_dir)) = find_language_dir(&game_path) {
        let backup_dir = eng_dir.parent().unwrap_or(Path::new(".")).join("engLanguage.bak");
        if backup_dir.exists() {
            if let Ok(entries) = fs::read_dir(&backup_dir) {
                for entry in entries.flatten() {
                    let src = entry.path();
                    if src.is_file() {
                        let dst = eng_dir.join(entry.file_name());
                        fs::copy(&src, &dst)
                            .map_err(|e| format!("Errore ripristino {}: {}", src.display(), e))?;
                    }
                }
            }
            println!("[GM] engLanguage/ ripristinata da backup");
            restored.push("engLanguage");
        }
    }
    
    if restored.is_empty() {
        return Err("Nessun backup trovato".to_string());
    }
    
    Ok(format!("Backup ripristinato: {}", restored.join(" + ")))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn gm_search_strings(
    game_path: String,
    query: String,
    only_translatable: Option<bool>,
) -> Result<Vec<GmString>, String> {
    // ── Priority 1: Language .jn files ──
    let strings = if let Some((_lang_dir, eng_dir)) = find_language_dir(&game_path) {
        extract_jn_strings(&eng_dir)
    } else {
        // ── Priority 2/3: STRG or EXE ──
        let data_win_path = find_data_win(&game_path)
            .ok_or_else(|| "data.win non trovato".to_string())?;
        let data = fs::read(&data_win_path)
            .map_err(|e| format!("Errore lettura: {}", e))?;
        let chunks = parse_chunks(&data);
        let strg = chunks.iter().find(|(name, _, _)| name == "STRG")
            .ok_or_else(|| "Chunk STRG non trovato".to_string())?;
        let strg_strings = extract_strings(&data, strg.2, strg.1);
        let strg_translatable = strg_strings.iter().filter(|s| s.is_translatable).count();
        if strg_translatable < 50 {
            if let Some(exe_path) = find_game_exe(&game_path) {
                let exe_data = fs::read(&exe_path)
                    .map_err(|e| format!("Errore lettura EXE: {}", e))?;
                extract_exe_strings(&exe_data, 15)
            } else {
                strg_strings
            }
        } else {
            strg_strings
        }
    };
    
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

#[cfg(test)]
mod tests {
    use super::*;

    // ── Helper: build a minimal IFF/FORM file with given chunks ──
    fn build_form(chunks: &[(&[u8; 4], &[u8])]) -> Vec<u8> {
        let mut body = Vec::new();
        for (magic, data) in chunks {
            body.extend_from_slice(*magic);
            body.extend_from_slice(&(data.len() as u32).to_le_bytes());
            body.extend_from_slice(data);
        }
        let mut out = Vec::new();
        out.extend_from_slice(b"FORM");
        out.extend_from_slice(&(body.len() as u32).to_le_bytes());
        out.extend_from_slice(&body);
        out
    }

    /// Build a STRG chunk body with the given strings.
    /// Returns (full FORM file, strg_data_offset, strg_size).
    fn build_strg_file(strings: &[&str]) -> (Vec<u8>, u64, u32) {
        let count = strings.len();
        let table_size = 4 + count * 4; // count + pointers

        // The STRG chunk data offset inside FORM = 8 (FORM header) + 8 (STRG header)
        let strg_data_abs = 16u32; // FORM(4)+size(4)+STRG(4)+size(4)

        // First pass: compute string data
        let mut string_data = Vec::new();
        let mut offsets = Vec::new();
        for s in strings {
            let abs_offset = strg_data_abs + table_size as u32 + string_data.len() as u32;
            offsets.push(abs_offset);
            let bytes = s.as_bytes();
            string_data.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
            string_data.extend_from_slice(bytes);
            string_data.push(0); // null terminator
        }

        // Build STRG body: count, pointers, string data
        let mut strg_body = Vec::new();
        strg_body.extend_from_slice(&(count as u32).to_le_bytes());
        for off in &offsets {
            strg_body.extend_from_slice(&off.to_le_bytes());
        }
        strg_body.extend_from_slice(&string_data);

        let form = build_form(&[(b"STRG", &strg_body)]);
        let strg_data_offset = 16u64; // after FORM(8) + STRG magic(4) + STRG size(4)
        let strg_size = strg_body.len() as u32;
        (form, strg_data_offset, strg_size)
    }

    // ═══════════════════════════════════════════════════════
    // read_u32_le
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_read_u32_le_basic() {
        let data = [0x01, 0x00, 0x00, 0x00];
        assert_eq!(read_u32_le(&data, 0), 1);
    }

    #[test]
    fn test_read_u32_le_large_value() {
        let data = [0xFF, 0xFF, 0xFF, 0xFF];
        assert_eq!(read_u32_le(&data, 0), u32::MAX);
    }

    #[test]
    fn test_read_u32_le_offset() {
        let data = [0x00, 0x00, 0x78, 0x56, 0x34, 0x12];
        assert_eq!(read_u32_le(&data, 2), 0x12345678);
    }

    #[test]
    fn test_read_u32_le_out_of_bounds() {
        let data = [0x01, 0x02];
        assert_eq!(read_u32_le(&data, 0), 0); // returns 0 when out of bounds
    }

    #[test]
    fn test_read_u32_le_empty() {
        let data: [u8; 0] = [];
        assert_eq!(read_u32_le(&data, 0), 0);
    }

    // ═══════════════════════════════════════════════════════
    // read_gm_string
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_read_gm_string_basic() {
        // Format: 4-byte length prefix, then chars, then null
        let mut data = Vec::new();
        let text = b"Hello";
        data.extend_from_slice(&(text.len() as u32).to_le_bytes());
        data.extend_from_slice(text);
        data.push(0);
        assert_eq!(read_gm_string(&data, 0), "Hello");
    }

    #[test]
    fn test_read_gm_string_empty_string() {
        let mut data = Vec::new();
        data.extend_from_slice(&0u32.to_le_bytes());
        data.push(0);
        assert_eq!(read_gm_string(&data, 0), "");
    }

    #[test]
    fn test_read_gm_string_offset_beyond_data() {
        let data = [0x00; 4];
        assert_eq!(read_gm_string(&data, 100), "");
    }

    #[test]
    fn test_read_gm_string_at_nonzero_offset() {
        let mut data = vec![0xAA, 0xBB]; // garbage prefix
        let text = b"Test";
        data.extend_from_slice(&(text.len() as u32).to_le_bytes());
        data.extend_from_slice(text);
        data.push(0);
        assert_eq!(read_gm_string(&data, 2), "Test");
    }

    #[test]
    fn test_read_gm_string_length_exceeds_data() {
        // Length says 100 but only 3 bytes available
        let mut data = Vec::new();
        data.extend_from_slice(&100u32.to_le_bytes());
        data.extend_from_slice(b"abc");
        // Should return "abc" (clamped to data.len())
        assert_eq!(read_gm_string(&data, 0), "abc");
    }

    #[test]
    fn test_read_gm_string_invalid_utf8_lossy() {
        let mut data = Vec::new();
        data.extend_from_slice(&3u32.to_le_bytes());
        data.push(0xFF);
        data.push(0xFE);
        data.push(b'A');
        data.push(0);
        let result = read_gm_string(&data, 0);
        // Should decode non-UTF-8 bytes via encoding detection and not panic
        assert!(result.contains('A'));
    }

    // ═══════════════════════════════════════════════════════
    // detect_version
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_detect_version_studio_23_seqn() {
        let chunks = vec!["GEN8".to_string(), "SEQN".to_string(), "STRG".to_string()];
        assert_eq!(detect_version(&chunks), "Studio 2.3+");
    }

    #[test]
    fn test_detect_version_studio_23_feds() {
        let chunks = vec!["FEDS".to_string()];
        assert_eq!(detect_version(&chunks), "Studio 2.3+");
    }

    #[test]
    fn test_detect_version_studio_2x() {
        let chunks = vec!["GEN8".to_string(), "TGIN".to_string(), "STRG".to_string()];
        assert_eq!(detect_version(&chunks), "Studio 2.x");
    }

    #[test]
    fn test_detect_version_studio_1x() {
        let chunks = vec!["GEN8".to_string(), "STRG".to_string()];
        assert_eq!(detect_version(&chunks), "Studio 1.x");
    }

    #[test]
    fn test_detect_version_empty_chunks() {
        let chunks: Vec<String> = vec![];
        assert_eq!(detect_version(&chunks), "Studio 1.x");
    }

    // ═══════════════════════════════════════════════════════
    // is_translatable
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_is_translatable_real_text_with_spaces() {
        assert!(is_translatable("Hello world, this is a test"));
        assert!(is_translatable("Choose your character"));
        assert!(is_translatable("FRESH MEAT - gain a mysterious meat"));
    }

    #[test]
    fn test_is_translatable_short_labels() {
        assert!(is_translatable("Yes"));
        assert!(is_translatable("Cancel"));
        assert!(is_translatable("STAMINA"));
    }

    #[test]
    fn test_is_translatable_empty_and_short() {
        assert!(!is_translatable(""));
        assert!(!is_translatable("ab"));
        assert!(!is_translatable("  "));
    }

    #[test]
    fn test_is_translatable_pure_numbers() {
        assert!(!is_translatable("12345"));
        assert!(!is_translatable("3.14"));
        assert!(!is_translatable("-42"));
    }

    #[test]
    fn test_is_translatable_file_paths() {
        assert!(!is_translatable("sprites/player/idle.png"));
        assert!(!is_translatable("sounds\\explosion.wav"));
    }

    #[test]
    fn test_is_translatable_file_extensions() {
        assert!(!is_translatable("music.ogg"));
        assert!(!is_translatable("data.json"));
        assert!(!is_translatable("config.ini"));
        assert!(!is_translatable("script.gml"));
        assert!(!is_translatable("project.yyp"));
    }

    #[test]
    fn test_is_translatable_hex_colors() {
        assert!(!is_translatable("#FF0000"));
        assert!(!is_translatable("#abc"));
        assert!(!is_translatable("#12345678"));
    }

    #[test]
    fn test_is_translatable_no_letters() {
        assert!(!is_translatable("---"));
        assert!(!is_translatable("12345!!"));
    }

    #[test]
    fn test_is_translatable_very_long_string() {
        let long = "a ".repeat(3000);
        assert!(!is_translatable(&long));
    }

    #[test]
    fn test_is_translatable_gml_code() {
        assert!(!is_translatable("var x = 10;"));
        assert!(!is_translatable("function(arg)"));
        assert!(!is_translatable("if (x > 0) {}"));
        assert!(!is_translatable("a && b"));
        assert!(!is_translatable("a || b"));
        assert!(!is_translatable("a != b"));
        assert!(!is_translatable("global.player_hp"));
        assert!(!is_translatable("self.name"));
    }

    #[test]
    fn test_is_translatable_gm_prefixes() {
        assert!(!is_translatable("gml_Script_something"));
        assert!(!is_translatable("scr_player_attack"));
        assert!(!is_translatable("obj_player"));
        assert!(!is_translatable("spr_hero_idle"));
        assert!(!is_translatable("snd_explosion"));
        assert!(!is_translatable("rm_title"));
        assert!(!is_translatable("bg_sky"));
        assert!(!is_translatable("fnt_main"));
        assert!(!is_translatable("audiogroup_default"));
    }

    #[test]
    fn test_is_translatable_internal_prefixes() {
        assert!(!is_translatable("@@built_in"));
        assert!(!is_translatable("$$global"));
    }

    #[test]
    fn test_is_translatable_snake_case_no_spaces() {
        assert!(!is_translatable("theme_combat"));
        assert!(!is_translatable("select_god"));
        assert!(!is_translatable("some_identifier_name"));
    }

    #[test]
    fn test_is_translatable_camel_case() {
        assert!(!is_translatable("camelCaseIdentifier"));
        assert!(!is_translatable("playerHealth"));
    }

    #[test]
    fn test_is_translatable_short_dot_extension() {
        assert!(!is_translatable(".gml"));
        assert!(!is_translatable(".txt"));
    }

    #[test]
    fn test_is_translatable_identifier_list_with_spaces() {
        // Space-separated identifiers that all contain underscores
        assert!(!is_translatable("theme_combat select_god combat_win"));
    }

    // ═══════════════════════════════════════════════════════
    // parse_chunks
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_parse_chunks_empty() {
        assert!(parse_chunks(&[]).is_empty());
    }

    #[test]
    fn test_parse_chunks_no_form_header() {
        let data = b"NOTFORMdata";
        assert!(parse_chunks(data).is_empty());
    }

    #[test]
    fn test_parse_chunks_too_short() {
        let data = b"FORM";
        assert!(parse_chunks(data).is_empty());
    }

    #[test]
    fn test_parse_chunks_single_chunk() {
        let chunk_data = b"hello";
        let form = build_form(&[(b"GEN8", chunk_data)]);
        let chunks = parse_chunks(&form);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].0, "GEN8");
        assert_eq!(chunks[0].1, 5); // size of "hello"
    }

    #[test]
    fn test_parse_chunks_multiple_chunks() {
        let form = build_form(&[
            (b"GEN8", &[0; 4]),
            (b"STRG", &[0; 8]),
            (b"TXTR", &[0; 2]),
        ]);
        let chunks = parse_chunks(&form);
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].0, "GEN8");
        assert_eq!(chunks[1].0, "STRG");
        assert_eq!(chunks[2].0, "TXTR");
        assert_eq!(chunks[0].1, 4);
        assert_eq!(chunks[1].1, 8);
        assert_eq!(chunks[2].1, 2);
    }

    #[test]
    fn test_parse_chunks_data_offsets_correct() {
        let form = build_form(&[
            (b"GEN8", &[0; 4]),
            (b"STRG", &[0; 8]),
        ]);
        let chunks = parse_chunks(&form);
        // First chunk data starts at offset 16 (FORM:4 + size:4 + GEN8:4 + size:4)
        assert_eq!(chunks[0].2, 16);
        // Second chunk data starts at 16 + 4 (GEN8 data) + 8 (STRG header)
        assert_eq!(chunks[1].2, 16 + 4 + 8);
    }

    // ═══════════════════════════════════════════════════════
    // extract_strings
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_extract_strings_basic() {
        let (form, offset, size) = build_strg_file(&["Hello", "World"]);
        let strings = extract_strings(&form, offset, size);
        assert_eq!(strings.len(), 2);
        assert_eq!(strings[0].original, "Hello");
        assert_eq!(strings[1].original, "World");
        assert_eq!(strings[0].index, 0);
        assert_eq!(strings[1].index, 1);
    }

    #[test]
    fn test_extract_strings_empty_strg() {
        // STRG with count=0
        let strg_body = 0u32.to_le_bytes().to_vec();
        let form = build_form(&[(b"STRG", &strg_body)]);
        let strings = extract_strings(&form, 16, strg_body.len() as u32);
        assert!(strings.is_empty());
    }

    #[test]
    fn test_extract_strings_offset_beyond_data() {
        let data = [0u8; 16];
        let strings = extract_strings(&data, 1000, 100);
        assert!(strings.is_empty());
    }

    #[test]
    fn test_extract_strings_preserves_length() {
        let (form, offset, size) = build_strg_file(&["abc"]);
        let strings = extract_strings(&form, offset, size);
        assert_eq!(strings[0].length, 3);
    }

    #[test]
    fn test_extract_strings_translatable_flag() {
        let (form, offset, size) = build_strg_file(&[
            "Hello world this is text",   // translatable (has spaces, real words)
            "spr_player_idle",             // not translatable (gm prefix + snake_case)
        ]);
        let strings = extract_strings(&form, offset, size);
        assert!(strings[0].is_translatable);
        assert!(!strings[1].is_translatable);
    }

    // ═══════════════════════════════════════════════════════
    // is_translatable_exe_string
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_exe_string_real_game_text() {
        assert!(is_translatable_exe_string("Welcome to the dungeon adventurer"));
        assert!(is_translatable_exe_string("Press any key to continue playing"));
    }

    #[test]
    fn test_exe_string_too_short() {
        assert!(!is_translatable_exe_string("short"));
        assert!(!is_translatable_exe_string("ab cd"));
    }

    #[test]
    fn test_exe_string_no_spaces() {
        assert!(!is_translatable_exe_string("NoSpacesHereAtAll"));
    }

    #[test]
    fn test_exe_string_no_letters() {
        assert!(!is_translatable_exe_string("123 456 789 000"));
    }

    #[test]
    fn test_exe_string_x86_gibberish() {
        // Typical x86 decoded noise
        assert!(!is_translatable_exe_string("L$ UVWATAUAVAWH"));
        assert!(!is_translatable_exe_string("D$(9D$ }HcD$ H"));
    }

    #[test]
    fn test_exe_string_format_strings() {
        assert!(!is_translatable_exe_string("Error code: %d in module %s"));
        assert!(!is_translatable_exe_string("Value: %f percent: %i"));
    }

    #[test]
    fn test_exe_string_dos_program() {
        assert!(!is_translatable_exe_string("This program cannot be run in dos mode"));
    }

    #[test]
    fn test_exe_string_shader_code() {
        assert!(!is_translatable_exe_string("#version 330 core output something"));
        assert!(!is_translatable_exe_string("precision mediump float something else"));
        assert!(!is_translatable_exe_string("uniform sampler2D some texture thing"));
    }

    #[test]
    fn test_exe_string_dll_system() {
        assert!(!is_translatable_exe_string("loading module kernel32.dll now please"));
        assert!(!is_translatable_exe_string("something about user32.dll loading"));
    }

    #[test]
    fn test_exe_string_gml_code() {
        assert!(!is_translatable_exe_string("global.player with some data attached"));
        assert!(!is_translatable_exe_string("var something = value; more stuff"));
    }

    #[test]
    fn test_exe_string_runtime_errors() {
        assert!(!is_translatable_exe_string("index out of bounds for array access"));
        assert!(!is_translatable_exe_string("fatal error occurred during execution of something"));
        assert!(!is_translatable_exe_string("stack overflow detected in recursive function"));
        assert!(!is_translatable_exe_string("division by zero attempted in calculation"));
    }

    #[test]
    fn test_exe_string_debug_messages() {
        assert!(!is_translatable_exe_string("[debug] something happened here now"));
        assert!(!is_translatable_exe_string("[error] something failed over here"));
    }

    #[test]
    fn test_exe_string_ds_map() {
        assert!(!is_translatable_exe_string("ds_map entry does not exist here"));
    }

    // ═══════════════════════════════════════════════════════
    // extract_exe_strings
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_extract_exe_strings_finds_ascii_runs() {
        // Put some readable text in binary noise
        let mut data = vec![0x00; 10];
        data.extend_from_slice(b"This is readable text in binary");
        data.extend_from_slice(&[0x00; 10]);
        data.extend_from_slice(b"Another readable string here");
        data.extend_from_slice(&[0x00; 10]);

        let strings = extract_exe_strings(&data, 8);
        // Should find at least the two ASCII runs
        assert!(strings.len() >= 2);
        assert!(strings.iter().any(|s| s.original.contains("This is readable")));
        assert!(strings.iter().any(|s| s.original.contains("Another readable")));
    }

    #[test]
    fn test_extract_exe_strings_respects_min_len() {
        let mut data = vec![0x00; 5];
        data.extend_from_slice(b"Hi"); // too short for min_len=8
        data.extend_from_slice(&[0x00; 5]);
        data.extend_from_slice(b"This is long enough text");
        data.extend_from_slice(&[0x00; 5]);

        let strings = extract_exe_strings(&data, 8);
        assert!(strings.iter().all(|s| s.original.len() >= 8));
    }

    #[test]
    fn test_extract_exe_strings_empty_data() {
        let strings = extract_exe_strings(&[], 8);
        assert!(strings.is_empty());
    }

    #[test]
    fn test_extract_exe_strings_all_binary() {
        let data = vec![0x00, 0x01, 0x02, 0xFF, 0xFE, 0x80];
        let strings = extract_exe_strings(&data, 4);
        assert!(strings.is_empty());
    }

    #[test]
    fn test_extract_exe_strings_indexes_sequential() {
        let mut data = vec![0x00; 5];
        data.extend_from_slice(b"First string here now");
        data.extend_from_slice(&[0x00; 5]);
        data.extend_from_slice(b"Second string here now");
        data.extend_from_slice(&[0x00; 5]);

        let strings = extract_exe_strings(&data, 8);
        for (i, s) in strings.iter().enumerate() {
            assert_eq!(s.index, i);
        }
    }

    // ═══════════════════════════════════════════════════════
    // _write_u32_le
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_write_u32_le_basic() {
        let mut data = [0u8; 4];
        _write_u32_le(&mut data, 0, 0x12345678);
        assert_eq!(data, [0x78, 0x56, 0x34, 0x12]);
    }

    #[test]
    fn test_write_u32_le_roundtrip() {
        let mut data = [0u8; 8];
        _write_u32_le(&mut data, 2, 42);
        assert_eq!(read_u32_le(&data, 2), 42);
    }

    // ═══════════════════════════════════════════════════════
    // Edge cases for is_translatable
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_is_translatable_dot_prefix_short() {
        assert!(!is_translatable(".png"));
        assert!(!is_translatable(".csv"));
    }

    #[test]
    fn test_is_translatable_whitespace_only() {
        assert!(!is_translatable("   "));
    }

    #[test]
    fn test_is_translatable_single_real_word() {
        // Single words without underscores or camelCase should pass
        assert!(is_translatable("ATTACK"));
        assert!(is_translatable("Inventory"));
    }

    #[test]
    fn test_is_translatable_known_combat_prefix() {
        // These start with combat_ / select_ / theme_ etc - blocked even without camelCase/underscore
        // Actually they contain underscores so blocked by snake_case rule
        assert!(!is_translatable("combat_start"));
        assert!(!is_translatable("select_hero"));
        assert!(!is_translatable("theme_dark"));
    }

    #[test]
    fn test_is_translatable_vk_prefix() {
        assert!(!is_translatable("vk_enter"));
        assert!(!is_translatable("mb_left"));
        assert!(!is_translatable("buffer_grow"));
    }

    // ═══════════════════════════════════════════════════════
    // Integration: full STRG roundtrip
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_full_strg_roundtrip() {
        let test_strings = &[
            "Hello World",
            "spr_player",
            "This is translatable text here",
            "obj_enemy_boss",
            "42",
        ];
        let (form, offset, size) = build_strg_file(test_strings);

        // Parse chunks
        let chunks = parse_chunks(&form);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].0, "STRG");

        // Extract strings
        let strings = extract_strings(&form, offset, size);
        assert_eq!(strings.len(), 5);
        for (i, expected) in test_strings.iter().enumerate() {
            assert_eq!(strings[i].original, *expected);
        }

        // Verify translatability
        assert!(strings[0].is_translatable);  // "Hello World" — has space, real words
        assert!(!strings[1].is_translatable); // "spr_player" — GM prefix
        assert!(strings[2].is_translatable);  // "This is translatable text here"
        assert!(!strings[3].is_translatable); // "obj_enemy_boss" — GM prefix
        assert!(!strings[4].is_translatable); // "42" — too short / number
    }

    #[test]
    fn test_parse_chunks_with_multiple_types() {
        let form = build_form(&[
            (b"GEN8", &[0; 4]),
            (b"STRG", &[0; 4]),
            (b"TGIN", &[0; 4]),
            (b"SEQN", &[0; 4]),
        ]);
        let chunks = parse_chunks(&form);
        let names: Vec<&str> = chunks.iter().map(|(n, _, _)| n.as_str()).collect();
        assert_eq!(names, vec!["GEN8", "STRG", "TGIN", "SEQN"]);
        assert_eq!(detect_version(&names.iter().map(|s| s.to_string()).collect::<Vec<_>>()), "Studio 2.3+");
    }

    // ═══════════════════════════════════════════════════════
    // Edge cases for extract_strings with malformed data
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_extract_strings_count_exceeds_data() {
        // STRG body claims 1000 strings but has no pointer data
        let mut strg_body = Vec::new();
        strg_body.extend_from_slice(&1000u32.to_le_bytes());
        // Only 4 bytes of data — pointers will be out of bounds
        let form = build_form(&[(b"STRG", &strg_body)]);
        let strings = extract_strings(&form, 16, strg_body.len() as u32);
        // Should not panic, just return what it can
        assert!(strings.is_empty());
    }

    #[test]
    fn test_extract_strings_pointer_beyond_file() {
        // STRG with 1 string, but pointer points beyond file
        let mut strg_body = Vec::new();
        strg_body.extend_from_slice(&1u32.to_le_bytes()); // count = 1
        strg_body.extend_from_slice(&0xFFFFFFFFu32.to_le_bytes()); // pointer way beyond
        let form = build_form(&[(b"STRG", &strg_body)]);
        let strings = extract_strings(&form, 16, strg_body.len() as u32);
        // The string pointer is beyond data, so extract should skip it
        // (read_gm_string returns empty for out-of-bounds offset)
        // It may still push a GmString with empty original
        for s in &strings {
            assert_eq!(s.original, "");
        }
    }

    // ═══════════════════════════════════════════════════════
    // is_translatable_exe_string - more edge cases
    // ═══════════════════════════════════════════════════════

    #[test]
    fn test_exe_string_low_letter_ratio() {
        // Mostly symbols/numbers with a few letters
        assert!(!is_translatable_exe_string("123 456 ab 789 000 cd 111"));
    }

    #[test]
    fn test_exe_string_save_file_pattern() {
        assert!(!is_translatable_exe_string("save file location for player data backup"));
    }

    #[test]
    fn test_exe_string_copyright_microsoft() {
        assert!(!is_translatable_exe_string("copyright reserved microsoft corporation year"));
    }

    #[test]
    fn test_exe_string_shader_register() {
        assert!(!is_translatable_exe_string("register(b0) constant buffer data here"));
    }

    #[test]
    fn test_exe_string_comment_prefix() {
        assert!(!is_translatable_exe_string("// this is some comment text here now"));
    }
}
