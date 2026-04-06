// TyranoScript Patcher - Electron/NW.js games with .asar + .ks files
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use tauri::command;
use crate::commands::encoding_utils;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TyranoGame {
    pub path: String,
    pub title: String,
    pub engine_variant: String,
    pub asar_path: Option<String>,
    pub script_files: Vec<TyranoScriptFile>,
    pub has_asar: bool,
    pub total_strings: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TyranoScriptFile {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub string_count: u32,
    pub is_inside_asar: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TyranoString {
    pub id: String,
    pub original: String,
    pub translated: String,
    pub file: String,
    pub line_number: u32,
    pub string_type: String,
    pub character: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TyranoExtractionResult {
    pub success: bool,
    pub message: String,
    pub strings: Vec<TyranoString>,
    pub total_count: u32,
    pub files_processed: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TyranoPatchResult {
    pub success: bool,
    pub message: String,
    pub files_patched: u32,
    pub strings_replaced: u32,
    pub backup_path: String,
}

// === ASAR read/extract ===

fn read_asar_header(p: &Path) -> Result<(serde_json::Value, u64), String> {
    let mut f = fs::File::open(p).map_err(|e| e.to_string())?;
    let mut b = [0u8; 4];
    f.read_exact(&mut b).map_err(|e| e.to_string())?;
    f.read_exact(&mut b).map_err(|e| e.to_string())?;
    f.read_exact(&mut b).map_err(|e| e.to_string())?;
    f.read_exact(&mut b).map_err(|e| e.to_string())?;
    let sz = u32::from_le_bytes(b) as usize;
    let mut hb = vec![0u8; sz];
    f.read_exact(&mut hb).map_err(|e| e.to_string())?;
    let hdr: serde_json::Value = serde_json::from_str(
        &String::from_utf8(hb).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    Ok((hdr, 16 + sz as u64))
}

fn read_asar_file(p: &Path, doff: u64, off: u64, sz: u64) -> Result<Vec<u8>, String> {
    let mut f = fs::File::open(p).map_err(|e| e.to_string())?;
    f.seek(SeekFrom::Start(doff + off)).map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; sz as usize];
    f.read_exact(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf)
}

fn extract_asar_all(asar: &Path, out: &Path) -> Result<u32, String> {
    let (hdr, doff) = read_asar_header(asar)?;
    let mut c = 0u32;
    extract_recursive(&hdr, asar, doff, out, &PathBuf::new(), &mut c)?;
    Ok(c)
}

fn extract_recursive(
    node: &serde_json::Value, asar: &Path, doff: u64,
    out: &Path, cur: &Path, count: &mut u32,
) -> Result<(), String> {
    if let Some(files) = node.get("files").and_then(|f| f.as_object()) {
        for (name, entry) in files {
            let ep = cur.join(name);
            if entry.get("files").is_some() {
                fs::create_dir_all(out.join(&ep)).ok();
                extract_recursive(entry, asar, doff, out, &ep, count)?;
            } else if let (Some(os), Some(sz)) = (
                entry.get("offset").and_then(|o| o.as_str()),
                entry.get("size").and_then(|s| s.as_u64()),
            ) {
                let off: u64 = os.parse().unwrap_or(0);
                if sz > 0 {
                    let data = read_asar_file(asar, doff, off, sz)?;
                    let fp = out.join(&ep);
                    if let Some(par) = fp.parent() { fs::create_dir_all(par).ok(); }
                    fs::write(&fp, &data).map_err(|e| e.to_string())?;
                    *count += 1;
                }
            }
        }
    }
    Ok(())
}

// === ASAR repack ===

fn repack_asar(src: &Path, out: &Path) -> Result<u32, String> {
    let mut fd: Vec<(String, Vec<u8>)> = Vec::new();
    collect_files(src, src, &mut fd)?;
    fd.sort_by(|a, b| a.0.cmp(&b.0));
    let mut off: u64 = 0;
    let mut root = serde_json::json!({"files": {}});
    for (rp, data) in &fd {
        let parts: Vec<&str> = rp.split('/').collect();
        let mut node = &mut root["files"];
        for (i, part) in parts.iter().enumerate() {
            if i < parts.len() - 1 {
                if node.get(part).is_none() {
                    node[part] = serde_json::json!({"files": {}});
                }
                node = &mut node[part]["files"];
            } else {
                node[part] = serde_json::json!({
                    "offset": off.to_string(),
                    "size": data.len()
                });
                off += data.len() as u64;
            }
        }
    }
    let hs = serde_json::to_string(&root).map_err(|e| e.to_string())?;
    let hb = hs.as_bytes();
    let ssz = hb.len() as u32;
    let mut f = fs::File::create(out).map_err(|e| e.to_string())?;
    f.write_all(&(ssz + 12).to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&(ssz + 8).to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&(ssz + 4).to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&ssz.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(hb).map_err(|e| e.to_string())?;
    for (_, data) in &fd {
        f.write_all(data).map_err(|e| e.to_string())?;
    }
    Ok(fd.len() as u32)
}

fn collect_files(
    base: &Path, cur: &Path, files: &mut Vec<(String, Vec<u8>)>,
) -> Result<(), String> {
    for e in fs::read_dir(cur).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        let p = e.path();
        if p.is_dir() {
            collect_files(base, &p, files)?;
        } else {
            let rel = p.strip_prefix(base).map_err(|e| e.to_string())?;
            let data = fs::read(&p).map_err(|e| e.to_string())?;
            files.push((rel.to_string_lossy().replace('\\', "/"), data));
        }
    }
    Ok(())
}

// === KS string parsing ===

fn count_ks_strings(content: &str) -> u32 {
    let mut c = 0u32;
    for line in content.lines() {
        let t = line.trim();
        if t.is_empty() || t.starts_with(';') || t.starts_with('*') { continue; }
        if t.starts_with('@') { continue; }
        if t.starts_with('[') { continue; }
        if t.starts_with('#') || t.len() > 1 { c += 1; }
    }
    c
}

fn parse_ks_strings(content: &str, filename: &str) -> Vec<TyranoString> {
    let mut strings = Vec::new();
    let mut id_counter = 0u32;
    let mut current_char: Option<String> = None;
    let tag_re = regex::Regex::new(r"\[[^\]]*\]").unwrap();
    let link_re = regex::Regex::new(r"\[link[^\]]*\](.*?)\[endlink\]").unwrap();

    for (ln, line) in content.lines().enumerate() {
        let t = line.trim();
        if t.is_empty() || t.starts_with(';') || t.starts_with('*') { continue; }

        // Character name: #Name
        if t.starts_with('#') {
            let name = t[1..].trim().to_string();
            if !name.is_empty() {
                id_counter += 1;
                strings.push(TyranoString {
                    id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                    original: name.clone(), translated: String::new(),
                    file: filename.to_string(), line_number: (ln + 1) as u32,
                    string_type: "name".to_string(), character: None,
                });
                current_char = Some(name);
            }
            continue;
        }

        // Pure tags (skip)
        if t.starts_with('@') { continue; }

        // Choice: [link target=*x]Text[endlink]
        if t.contains("[link") && t.contains("[endlink]") {
            if let Some(caps) = link_re.captures(t) {
                if let Some(m) = caps.get(1) {
                    let text = m.as_str().trim().to_string();
                    if text.len() > 1 {
                        id_counter += 1;
                        strings.push(TyranoString {
                            id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                            original: text, translated: String::new(),
                            file: filename.to_string(), line_number: (ln + 1) as u32,
                            string_type: "choice".to_string(), character: None,
                        });
                    }
                }
            }
            continue;
        }

        // Lines starting with [ that are pure tags
        if t.starts_with('[') {
            let clean = tag_re.replace_all(t, "").trim().to_string();
            if clean.len() > 1 {
                id_counter += 1;
                strings.push(TyranoString {
                    id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                    original: clean, translated: String::new(),
                    file: filename.to_string(), line_number: (ln + 1) as u32,
                    string_type: "dialogue".to_string(), character: current_char.clone(),
                });
            }
            continue;
        }

        // Regular text line
        let clean = tag_re.replace_all(t, "").trim().to_string();
        if clean.len() > 1 {
            id_counter += 1;
            let stype = if current_char.is_some() { "dialogue" } else { "narration" };
            strings.push(TyranoString {
                id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                original: clean, translated: String::new(),
                file: filename.to_string(), line_number: (ln + 1) as u32,
                string_type: stype.to_string(), character: current_char.clone(),
            });
        }
    }
    strings
}

// === Helper: find file in asar header ===

fn find_file_data(
    node: &serde_json::Value, asar: &Path, doff: u64, target: &str,
) -> Option<Vec<u8>> {
    if let Some(files) = node.get("files").and_then(|f| f.as_object()) {
        for (name, entry) in files {
            if entry.get("files").is_some() {
                if let Some(d) = find_file_data(entry, asar, doff, target) {
                    return Some(d);
                }
            } else if target.ends_with(name.as_str()) {
                if let (Some(os), Some(sz)) = (
                    entry.get("offset").and_then(|o| o.as_str()),
                    entry.get("size").and_then(|s| s.as_u64()),
                ) {
                    let off: u64 = os.parse().ok()?;
                    return read_asar_file(asar, doff, off, sz).ok();
                }
            }
        }
    }
    None
}

fn find_ks_in_asar(asar: &Path) -> Result<Vec<TyranoScriptFile>, String> {
    let (hdr, doff) = read_asar_header(asar)?;
    let mut files = Vec::new();
    scan_ks_header(&hdr, asar, doff, &PathBuf::new(), &mut files)?;
    files.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(files)
}

fn scan_ks_header(
    node: &serde_json::Value, asar: &Path, doff: u64,
    cur: &Path, files: &mut Vec<TyranoScriptFile>,
) -> Result<(), String> {
    if let Some(dir) = node.get("files").and_then(|f| f.as_object()) {
        for (name, entry) in dir {
            let ep = cur.join(name);
            if entry.get("files").is_some() {
                scan_ks_header(entry, asar, doff, &ep, files)?;
            } else if name.ends_with(".ks") {
                let sz = entry.get("size").and_then(|s| s.as_u64()).unwrap_or(0);
                let sc = entry.get("offset").and_then(|o| o.as_str())
                    .and_then(|os| {
                        let off: u64 = os.parse().ok()?;
                        let d = read_asar_file(asar, doff, off, sz).ok()?;
                        let (text, _enc) = encoding_utils::auto_decode(&d);
                        Some(count_ks_strings(&text))
                    }).unwrap_or(0);
                files.push(TyranoScriptFile {
                    path: ep.to_string_lossy().replace('\\', "/"),
                    filename: name.clone(), size: sz,
                    string_count: sc, is_inside_asar: true,
                });
            }
        }
    }
    Ok(())
}

fn find_ks_files(folder: &Path) -> Result<Vec<TyranoScriptFile>, String> {
    let mut files = Vec::new();
    for e in walkdir::WalkDir::new(folder).max_depth(8)
        .into_iter().filter_map(|e| e.ok())
    {
        if e.file_type().is_file()
            && e.path().extension().map(|x| x == "ks").unwrap_or(false)
        {
            let content = fs::read_to_string(e.path()).unwrap_or_default();
            files.push(TyranoScriptFile {
                path: e.path().to_string_lossy().to_string(),
                filename: e.file_name().to_string_lossy().to_string(),
                size: e.metadata().map(|m| m.len()).unwrap_or(0),
                string_count: count_ks_strings(&content),
                is_inside_asar: false,
            });
        }
    }
    Ok(files)
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Rileva gioco TyranoScript/Electron
#[command]
pub fn detect_tyrano_game(game_path: String) -> Result<TyranoGame, String> {
    let path = Path::new(&game_path);
    if !path.exists() {
        return Err("Percorso non esistente".to_string());
    }
    let asar_path = path.join("resources").join("app.asar");
    let app_folder = path.join("resources").join("app");
    let has_asar = asar_path.exists();
    if !has_asar && !app_folder.exists() {
        return Err("Non trovato resources/app.asar né resources/app".to_string());
    }
    let mut engine = "electron".to_string();
    for e in fs::read_dir(path).into_iter().flatten().flatten() {
        if e.file_name().to_string_lossy().to_lowercase().contains("tyrano") {
            engine = "tyranoscript".to_string();
            break;
        }
    }
    let title = path.file_name()
        .and_then(|n| n.to_str()).unwrap_or("Game").to_string();
    let scripts = if has_asar {
        find_ks_in_asar(&asar_path)?
    } else {
        find_ks_files(&app_folder)?
    };
    let total: u32 = scripts.iter().map(|f| f.string_count).sum();
    log::info!(
        "🎮 TyranoScript: {} ({} files, {} strings)",
        title, scripts.len(), total
    );
    Ok(TyranoGame {
        path: game_path, title, engine_variant: engine,
        asar_path: if has_asar {
            Some(asar_path.to_string_lossy().to_string())
        } else { None },
        script_files: scripts, has_asar, total_strings: total,
    })
}

/// Estrae tutte le stringhe traducibili dal gioco
#[command]
pub fn extract_tyrano_strings(
    game_path: String,
) -> Result<TyranoExtractionResult, String> {
    let game = detect_tyrano_game(game_path)?;
    let mut all = Vec::new();
    let mut done = 0u32;

    if game.has_asar {
        let asar = Path::new(game.asar_path.as_ref().unwrap());
        let (hdr, doff) = read_asar_header(asar)?;
        for sf in &game.script_files {
            if let Some(data) = find_file_data(&hdr, asar, doff, &sf.path) {
                let (text, _enc) = encoding_utils::auto_decode(&data);
                all.extend(parse_ks_strings(&text, &sf.filename));
                done += 1;
            }
        }
    } else {
        for sf in &game.script_files {
            if let Ok(raw_bytes) = fs::read(&sf.path) {
                let (text, _enc) = encoding_utils::auto_decode(&raw_bytes);
                all.extend(parse_ks_strings(&text, &sf.filename));
                done += 1;
            }
        }
    }

    let total = all.len() as u32;
    log::info!("📝 TyranoScript: {} strings from {} files", total, done);
    Ok(TyranoExtractionResult {
        success: true,
        message: format!("{} strings from {} files", total, done),
        strings: all, total_count: total, files_processed: done,
    })
}

/// Applica patch traduzione: estrae asar, sostituisce stringhe nei .ks, repack
#[command]
pub fn apply_tyrano_patch(
    game_path: String,
    strings: Vec<TyranoString>,
) -> Result<TyranoPatchResult, String> {
    let game = detect_tyrano_game(game_path.clone())?;
    let path = Path::new(&game_path);

    let work_base = dirs::data_local_dir()
        .ok_or("Impossibile trovare AppData")?
        .join("GameStringer").join("tyrano_work");
    let gname = path.file_name()
        .and_then(|n| n.to_str()).unwrap_or("game");
    let work_dir = work_base.join(gname);
    let backup_dir = work_base.join(format!("{}_backup", gname));

    // Cleanup previous work
    if work_dir.exists() { fs::remove_dir_all(&work_dir).ok(); }
    fs::create_dir_all(&work_dir)
        .map_err(|e| format!("Errore creazione work dir: {}", e))?;
    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Errore creazione backup dir: {}", e))?;

    if !game.has_asar {
        return Err("Solo giochi con app.asar sono supportati".to_string());
    }

    let asar = Path::new(game.asar_path.as_ref().unwrap());

    // Step 1: Backup originale
    let backup_asar = backup_dir.join("app.asar.bak");
    if !backup_asar.exists() {
        fs::copy(asar, &backup_asar)
            .map_err(|e| format!("Backup fallito: {}", e))?;
    }
    log::info!("📦 Backup asar creato");

    // Step 2: Estrai asar
    let extracted = extract_asar_all(asar, &work_dir)?;
    log::info!("📂 Estratti {} file dall'asar", extracted);

    // Step 3: Costruisci mappa traduzioni per file
    let mut by_file: HashMap<String, Vec<&TyranoString>> = HashMap::new();
    for s in &strings {
        if !s.translated.is_empty() {
            by_file.entry(s.file.clone()).or_default().push(s);
        }
    }

    // Step 4: Applica traduzioni ai file .ks
    let mut files_patched = 0u32;
    let mut strings_replaced = 0u32;
    let tag_re = regex::Regex::new(r"\[[^\]]*\]").unwrap();

    for (filename, file_strings) in &by_file {
        // Trova il file nella work dir
        let ks_path = find_ks_in_dir(&work_dir, filename);
        if ks_path.is_none() {
            log::warn!("⚠️ File non trovato: {}", filename);
            continue;
        }
        let ks_path = ks_path.unwrap();

        let content = fs::read_to_string(&ks_path)
            .map_err(|e| format!("Read {}: {}", filename, e))?;
        let lines: Vec<&str> = content.lines().collect();
        let mut new_lines: Vec<String> = lines.iter().map(|l| l.to_string()).collect();

        for ts in file_strings {
            let idx = (ts.line_number as usize).saturating_sub(1);
            if idx < new_lines.len() {
                let old_line = &new_lines[idx];
                // Sostituisci il testo mantenendo i tag TyranoScript
                let new_line = replace_ks_text(old_line, &ts.original, &ts.translated, &tag_re);
                if new_line != *old_line {
                    new_lines[idx] = new_line;
                    strings_replaced += 1;
                }
            }
        }

        let new_content = new_lines.join("\n");
        fs::write(&ks_path, new_content)
            .map_err(|e| format!("Write {}: {}", filename, e))?;
        files_patched += 1;
    }

    log::info!("✏️ Patchati {} file, {} stringhe", files_patched, strings_replaced);

    // Step 5: Repack asar
    let repacked = repack_asar(&work_dir, asar)?;
    log::info!("📦 Repack completato: {} file nell'asar", repacked);

    // Cleanup work dir
    fs::remove_dir_all(&work_dir).ok();

    Ok(TyranoPatchResult {
        success: true,
        message: format!(
            "Patch applicata: {} file, {} stringhe tradotte",
            files_patched, strings_replaced
        ),
        files_patched, strings_replaced,
        backup_path: backup_asar.to_string_lossy().to_string(),
    })
}

/// Ripristina backup originale
#[command]
pub fn restore_tyrano_backup(game_path: String) -> Result<bool, String> {
    let path = Path::new(&game_path);
    let work_base = dirs::data_local_dir()
        .ok_or("AppData non trovato")?
        .join("GameStringer").join("tyrano_work");
    let gname = path.file_name()
        .and_then(|n| n.to_str()).unwrap_or("game");
    let backup = work_base.join(format!("{}_backup", gname)).join("app.asar.bak");
    let asar = path.join("resources").join("app.asar");

    if !backup.exists() {
        return Err("Nessun backup trovato".to_string());
    }
    fs::copy(&backup, &asar).map_err(|e| format!("Restore: {}", e))?;
    log::info!("✅ Backup ripristinato per {}", gname);
    Ok(true)
}

/// Statistiche traduzioni TyranoScript
#[command]
pub fn get_tyrano_stats(strings: Vec<TyranoString>) -> HashMap<String, serde_json::Value> {
    let total = strings.len();
    let translated = strings.iter().filter(|s| !s.translated.is_empty()).count();
    let mut by_type: HashMap<String, usize> = HashMap::new();
    let mut by_file: HashMap<String, usize> = HashMap::new();
    for s in &strings {
        *by_type.entry(s.string_type.clone()).or_default() += 1;
        *by_file.entry(s.file.clone()).or_default() += 1;
    }
    let mut result = HashMap::new();
    result.insert("total".into(), serde_json::json!(total));
    result.insert("translated".into(), serde_json::json!(translated));
    result.insert("percentage".into(), serde_json::json!(
        if total > 0 { translated * 100 / total } else { 0 }
    ));
    result.insert("by_type".into(), serde_json::json!(by_type));
    result.insert("by_file".into(), serde_json::json!(by_file));
    result
}

// === Helpers for patching ===

fn find_ks_in_dir(dir: &Path, filename: &str) -> Option<PathBuf> {
    for e in walkdir::WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        if e.file_type().is_file() && e.file_name().to_string_lossy() == filename {
            return Some(e.path().to_path_buf());
        }
    }
    None
}

pub(crate) fn replace_ks_text(
    line: &str, original: &str, translated: &str,
    tag_re: &regex::Regex,
) -> String {
    // If line contains the original text directly, replace it
    if line.contains(original) {
        return line.replace(original, translated);
    }
    // If original was stripped of tags, we need to replace text portions
    let clean = tag_re.replace_all(line, "").trim().to_string();
    if clean == original {
        // Rebuild: keep tags, replace text
        // Simple approach: replace the clean text portion
        // Find text segments between tags and replace
        let mut last_end = 0;
        let mut segments: Vec<(usize, usize, bool)> = Vec::new(); // (start, end, is_tag)
        for m in tag_re.find_iter(line) {
            if m.start() > last_end {
                segments.push((last_end, m.start(), false));
            }
            segments.push((m.start(), m.end(), true));
            last_end = m.end();
        }
        if last_end < line.len() {
            segments.push((last_end, line.len(), false));
        }

        // If there's only one text segment, replace it
        let text_segments: Vec<_> = segments.iter()
            .filter(|s| !s.2).collect();
        if text_segments.len() == 1 {
            let (start, end, _) = text_segments[0];
            let result = format!("{}{}{}", &line[..*start], translated, &line[*end..]);
            return result;
        } else {
            // Multiple text segments — just replace the whole line preserving leading tags
            let result = line.replace(&clean, translated);
            return result;
        }
    }
    // Fallback: return original line unchanged
    line.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write as IoWrite;

    // ========================================================================
    // count_ks_strings
    // ========================================================================

    #[test]
    fn count_ks_strings_empty_input() {
        assert_eq!(count_ks_strings(""), 0);
    }

    #[test]
    fn count_ks_strings_only_comments_and_labels() {
        let input = "; this is a comment\n; another comment\n*label1\n*label2\n";
        assert_eq!(count_ks_strings(input), 0);
    }

    #[test]
    fn count_ks_strings_skips_at_tags() {
        let input = "@jump target=scene2\n@bg storage=bg1.jpg\n";
        assert_eq!(count_ks_strings(input), 0);
    }

    #[test]
    fn count_ks_strings_skips_bracket_tags() {
        let input = "[cm]\n[p]\n[wait time=1000]\n";
        assert_eq!(count_ks_strings(input), 0);
    }

    #[test]
    fn count_ks_strings_counts_character_names() {
        // #Name is counted when len > 1 (the '#' line itself: t.starts_with('#') || t.len() > 1)
        let input = "#Alice\n#Bob\n";
        assert_eq!(count_ks_strings(input), 2);
    }

    #[test]
    fn count_ks_strings_counts_dialogue_lines() {
        let input = "Hello, this is dialogue.\nAnother line of text.\n";
        assert_eq!(count_ks_strings(input), 2);
    }

    #[test]
    fn count_ks_strings_skips_empty_and_whitespace_lines() {
        let input = "\n   \n\t\nHello\n";
        assert_eq!(count_ks_strings(input), 1);
    }

    #[test]
    fn count_ks_strings_mixed_content() {
        let input = "\
; comment
*label
@command
[tag]
#CharacterName
Hello world!
Another dialogue line.
; another comment
";
        // #CharacterName = 1, Hello world! = 1, Another dialogue line. = 1
        assert_eq!(count_ks_strings(input), 3);
    }

    #[test]
    fn count_ks_strings_single_char_line_not_counted() {
        // A line with exactly 1 char that is not '#' and doesn't start with special chars
        // t.starts_with('#') || t.len() > 1 => for single char "x" (len=1): false || false = false
        let input = "x\n";
        assert_eq!(count_ks_strings(input), 0);
    }

    #[test]
    fn count_ks_strings_hash_only_line() {
        // "#" alone: starts_with('#') is true, len()>1 is false -> condition is true via starts_with
        let input = "#\n";
        assert_eq!(count_ks_strings(input), 1);
    }

    // ========================================================================
    // parse_ks_strings
    // ========================================================================

    #[test]
    fn parse_ks_strings_empty_input() {
        let result = parse_ks_strings("", "test.ks");
        assert!(result.is_empty());
    }

    #[test]
    fn parse_ks_strings_character_name() {
        let input = "#Alice\nHello there!\n";
        let result = parse_ks_strings(input, "scene.ks");
        assert_eq!(result.len(), 2);

        assert_eq!(result[0].original, "Alice");
        assert_eq!(result[0].string_type, "name");
        assert_eq!(result[0].line_number, 1);
        assert!(result[0].character.is_none());

        assert_eq!(result[1].original, "Hello there!");
        assert_eq!(result[1].string_type, "dialogue");
        assert_eq!(result[1].character, Some("Alice".to_string()));
        assert_eq!(result[1].line_number, 2);
    }

    #[test]
    fn parse_ks_strings_narration_without_character() {
        let input = "This is narration text.\n";
        let result = parse_ks_strings(input, "test.ks");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].string_type, "narration");
        assert!(result[0].character.is_none());
    }

    #[test]
    fn parse_ks_strings_dialogue_after_character() {
        let input = "#Bob\nFirst line of dialogue.\nSecond line.\n";
        let result = parse_ks_strings(input, "test.ks");
        assert_eq!(result.len(), 3);
        // Name
        assert_eq!(result[0].string_type, "name");
        // Both dialogue lines have Bob as character
        assert_eq!(result[1].character, Some("Bob".to_string()));
        assert_eq!(result[2].character, Some("Bob".to_string()));
    }

    #[test]
    fn parse_ks_strings_choice_link() {
        let input = "[link target=*choice1]Go to the park[endlink]\n";
        let result = parse_ks_strings(input, "test.ks");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].original, "Go to the park");
        assert_eq!(result[0].string_type, "choice");
    }

    #[test]
    fn parse_ks_strings_choice_short_text_ignored() {
        // Choice text must be len > 1
        let input = "[link target=*x]A[endlink]\n";
        let result = parse_ks_strings(input, "test.ks");
        assert!(result.is_empty());
    }

    #[test]
    fn parse_ks_strings_skips_comments_labels_at_tags() {
        let input = "; comment\n*label\n@jump target=x\n";
        let result = parse_ks_strings(input, "test.ks");
        assert!(result.is_empty());
    }

    #[test]
    fn parse_ks_strings_inline_tags_stripped_from_text() {
        let input = "Hello[wait time=500] world!\n";
        let result = parse_ks_strings(input, "test.ks");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].original, "Hello world!");
    }

    #[test]
    fn parse_ks_strings_line_starting_with_bracket_has_text() {
        // A line like "[r]Some text here" - starts with [, tag stripped, text remains
        let input = "[r]Some important text\n";
        let result = parse_ks_strings(input, "test.ks");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].original, "Some important text");
        assert_eq!(result[0].string_type, "dialogue");
    }

    #[test]
    fn parse_ks_strings_id_format() {
        let input = "#Alice\nHello!\n";
        let result = parse_ks_strings(input, "scene01.ks");
        // Dots in filename are replaced with underscores
        assert_eq!(result[0].id, "scene01_ks_1");
        assert_eq!(result[1].id, "scene01_ks_2");
    }

    #[test]
    fn parse_ks_strings_empty_hash_name_skipped() {
        // "# " (hash followed by only whitespace) => name is empty after trim => skipped
        let input = "#   \nSome text line.\n";
        let result = parse_ks_strings(input, "test.ks");
        // # with whitespace-only name is skipped, text is narration (no char set)
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].string_type, "narration");
    }

    #[test]
    fn parse_ks_strings_tag_only_bracket_line_skipped() {
        // [cm] -> stripped = "" (len 0) -> skipped
        let input = "[cm]\n";
        let result = parse_ks_strings(input, "test.ks");
        assert!(result.is_empty());
    }

    #[test]
    fn parse_ks_strings_single_char_text_skipped() {
        // clean text len must be > 1
        let input = "x\n";
        let result = parse_ks_strings(input, "test.ks");
        assert!(result.is_empty());
    }

    #[test]
    fn parse_ks_strings_full_scene() {
        let input = "\
; Scene 1
*start
@bg storage=bg_school.jpg
#Alice
Nice to meet you!
[p]
#Bob
Hello, Alice.
[link target=*agree]I agree[endlink]
";
        let result = parse_ks_strings(input, "scene1.ks");
        // #Alice (name), "Nice to meet you!" (dialogue, char=Alice),
        // #Bob (name), "Hello, Alice." (dialogue, char=Bob),
        // "I agree" (choice)
        assert_eq!(result.len(), 5);
        let types: Vec<&str> = result.iter().map(|s| s.string_type.as_str()).collect();
        assert_eq!(types, vec!["name", "dialogue", "name", "dialogue", "choice"]);
    }

    // ========================================================================
    // replace_ks_text
    // ========================================================================

    fn tag_regex() -> regex::Regex {
        regex::Regex::new(r"\[[^\]]*\]").unwrap()
    }

    #[test]
    fn replace_ks_text_direct_match() {
        let re = tag_regex();
        let result = replace_ks_text(
            "Hello world!", "Hello world!", "Ciao mondo!", &re,
        );
        assert_eq!(result, "Ciao mondo!");
    }

    #[test]
    fn replace_ks_text_partial_match() {
        let re = tag_regex();
        let result = replace_ks_text(
            "She said Hello world! to him", "Hello world!", "Ciao mondo!", &re,
        );
        assert_eq!(result, "She said Ciao mondo! to him");
    }

    #[test]
    fn replace_ks_text_with_tags_single_segment() {
        let re = tag_regex();
        // Line has tags, original is the stripped version
        let result = replace_ks_text(
            "[r]Hello world![p]", "Hello world!", "Ciao mondo!", &re,
        );
        assert_eq!(result, "[r]Ciao mondo![p]");
    }

    #[test]
    fn replace_ks_text_no_match_returns_original() {
        let re = tag_regex();
        let result = replace_ks_text(
            "Some unrelated text", "Not found", "Translation", &re,
        );
        assert_eq!(result, "Some unrelated text");
    }

    #[test]
    fn replace_ks_text_empty_line() {
        let re = tag_regex();
        let result = replace_ks_text("", "hello", "ciao", &re);
        assert_eq!(result, "");
    }

    #[test]
    fn replace_ks_text_tag_only_line() {
        let re = tag_regex();
        // Line is only tags, clean text is empty, doesn't match "hello"
        let result = replace_ks_text("[cm][p]", "hello", "ciao", &re);
        assert_eq!(result, "[cm][p]");
    }

    #[test]
    fn replace_ks_text_leading_tag_text() {
        let re = tag_regex();
        let result = replace_ks_text(
            "[wait time=500]Good morning!", "Good morning!", "Buongiorno!", &re,
        );
        assert_eq!(result, "[wait time=500]Buongiorno!");
    }

    #[test]
    fn replace_ks_text_text_between_tags() {
        let re = tag_regex();
        // text surrounded by tags, single text segment
        let result = replace_ks_text(
            "[font size=24]Hello there[resetfont]",
            "Hello there",
            "Salve",
            &re,
        );
        assert_eq!(result, "[font size=24]Salve[resetfont]");
    }

    // ========================================================================
    // get_tyrano_stats
    // ========================================================================

    #[test]
    fn get_tyrano_stats_empty() {
        let stats = get_tyrano_stats(vec![]);
        assert_eq!(stats["total"], serde_json::json!(0));
        assert_eq!(stats["translated"], serde_json::json!(0));
        assert_eq!(stats["percentage"], serde_json::json!(0));
    }

    #[test]
    fn get_tyrano_stats_with_translations() {
        let strings = vec![
            TyranoString {
                id: "s1".into(), original: "Hello".into(),
                translated: "Ciao".into(), file: "a.ks".into(),
                line_number: 1, string_type: "dialogue".into(),
                character: None,
            },
            TyranoString {
                id: "s2".into(), original: "World".into(),
                translated: "".into(), file: "a.ks".into(),
                line_number: 2, string_type: "narration".into(),
                character: None,
            },
            TyranoString {
                id: "s3".into(), original: "Bye".into(),
                translated: "Addio".into(), file: "b.ks".into(),
                line_number: 1, string_type: "dialogue".into(),
                character: Some("Alice".into()),
            },
        ];
        let stats = get_tyrano_stats(strings);
        assert_eq!(stats["total"], serde_json::json!(3));
        assert_eq!(stats["translated"], serde_json::json!(2));
        assert_eq!(stats["percentage"], serde_json::json!(66)); // 2*100/3 = 66
        // by_type should have dialogue=2, narration=1
        let by_type = stats["by_type"].as_object().unwrap();
        assert_eq!(by_type["dialogue"], serde_json::json!(2));
        assert_eq!(by_type["narration"], serde_json::json!(1));
        // by_file should have a.ks=2, b.ks=1
        let by_file = stats["by_file"].as_object().unwrap();
        assert_eq!(by_file["a.ks"], serde_json::json!(2));
        assert_eq!(by_file["b.ks"], serde_json::json!(1));
    }

    #[test]
    fn get_tyrano_stats_all_translated() {
        let strings = vec![
            TyranoString {
                id: "s1".into(), original: "A".into(),
                translated: "B".into(), file: "x.ks".into(),
                line_number: 1, string_type: "name".into(),
                character: None,
            },
        ];
        let stats = get_tyrano_stats(strings);
        assert_eq!(stats["percentage"], serde_json::json!(100));
    }

    // ========================================================================
    // ASAR round-trip: repack then read header
    // ========================================================================

    #[test]
    fn asar_roundtrip_repack_and_read() {
        let tmp = tempfile::tempdir().unwrap();
        let src_dir = tmp.path().join("src");
        let sub_dir = src_dir.join("subdir");
        std::fs::create_dir_all(&sub_dir).unwrap();

        // Create some test files
        std::fs::write(src_dir.join("hello.txt"), b"Hello World").unwrap();
        std::fs::write(sub_dir.join("data.bin"), b"\x00\x01\x02\x03").unwrap();
        std::fs::write(src_dir.join("scene.ks"), b"#Alice\nHello!\n").unwrap();

        let asar_path = tmp.path().join("test.asar");
        let count = repack_asar(&src_dir, &asar_path).unwrap();
        assert_eq!(count, 3);

        // Read back the header
        let (hdr, doff) = read_asar_header(&asar_path).unwrap();
        assert!(doff > 16); // header offset must be past the 16-byte preamble

        // Verify header structure
        let files = hdr.get("files").unwrap().as_object().unwrap();
        assert!(files.contains_key("hello.txt"));
        assert!(files.contains_key("scene.ks"));
        assert!(files.contains_key("subdir"));

        // Read back a file
        let hello_entry = &files["hello.txt"];
        let off: u64 = hello_entry["offset"].as_str().unwrap().parse().unwrap();
        let sz = hello_entry["size"].as_u64().unwrap();
        let data = read_asar_file(&asar_path, doff, off, sz).unwrap();
        assert_eq!(data, b"Hello World");

        // Read nested file
        let sub_files = files["subdir"]["files"].as_object().unwrap();
        let data_entry = &sub_files["data.bin"];
        let off2: u64 = data_entry["offset"].as_str().unwrap().parse().unwrap();
        let sz2 = data_entry["size"].as_u64().unwrap();
        let data2 = read_asar_file(&asar_path, doff, off2, sz2).unwrap();
        assert_eq!(data2, b"\x00\x01\x02\x03");
    }

    #[test]
    fn asar_extract_all_roundtrip() {
        let tmp = tempfile::tempdir().unwrap();
        let src_dir = tmp.path().join("pack_src");
        std::fs::create_dir_all(src_dir.join("data/scenario")).unwrap();

        let ks_content = "#Hero\nWelcome to the game!\n[p]\n";
        std::fs::write(src_dir.join("data/scenario/main.ks"), ks_content).unwrap();
        std::fs::write(src_dir.join("index.html"), b"<html></html>").unwrap();

        // Pack
        let asar_path = tmp.path().join("app.asar");
        repack_asar(&src_dir, &asar_path).unwrap();

        // Extract
        let out_dir = tmp.path().join("extracted");
        let extracted = extract_asar_all(&asar_path, &out_dir).unwrap();
        assert_eq!(extracted, 2);

        // Verify extracted content
        let extracted_ks = std::fs::read_to_string(out_dir.join("data/scenario/main.ks")).unwrap();
        assert_eq!(extracted_ks, ks_content);
        let extracted_html = std::fs::read_to_string(out_dir.join("index.html")).unwrap();
        assert_eq!(extracted_html, "<html></html>");
    }

    // ========================================================================
    // find_file_data (via ASAR)
    // ========================================================================

    #[test]
    fn find_file_data_locates_nested_file() {
        let tmp = tempfile::tempdir().unwrap();
        let src_dir = tmp.path().join("src");
        std::fs::create_dir_all(src_dir.join("scenario")).unwrap();
        std::fs::write(src_dir.join("scenario/test.ks"), b"test content").unwrap();

        let asar_path = tmp.path().join("test.asar");
        repack_asar(&src_dir, &asar_path).unwrap();

        let (hdr, doff) = read_asar_header(&asar_path).unwrap();
        let data = find_file_data(&hdr, &asar_path, doff, "test.ks");
        assert!(data.is_some());
        assert_eq!(data.unwrap(), b"test content");
    }

    #[test]
    fn find_file_data_returns_none_for_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let src_dir = tmp.path().join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(src_dir.join("a.txt"), b"data").unwrap();

        let asar_path = tmp.path().join("test.asar");
        repack_asar(&src_dir, &asar_path).unwrap();

        let (hdr, doff) = read_asar_header(&asar_path).unwrap();
        let data = find_file_data(&hdr, &asar_path, doff, "nonexistent.ks");
        assert!(data.is_none());
    }

    // ========================================================================
    // read_asar_header error paths
    // ========================================================================

    #[test]
    fn read_asar_header_nonexistent_file() {
        let result = read_asar_header(Path::new("/nonexistent/path/app.asar"));
        assert!(result.is_err());
    }

    #[test]
    fn read_asar_header_truncated_file() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("bad.asar");
        // Write only 8 bytes (need 16 for the preamble)
        std::fs::write(&path, &[0u8; 8]).unwrap();
        let result = read_asar_header(&path);
        assert!(result.is_err());
    }

    #[test]
    fn read_asar_header_invalid_json() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("bad.asar");
        let mut f = std::fs::File::create(&path).unwrap();
        let bad_json = b"not json at all!";
        let sz = bad_json.len() as u32;
        // Write 4 ints then the bad json
        f.write_all(&0u32.to_le_bytes()).unwrap();
        f.write_all(&0u32.to_le_bytes()).unwrap();
        f.write_all(&0u32.to_le_bytes()).unwrap();
        f.write_all(&sz.to_le_bytes()).unwrap();
        f.write_all(bad_json).unwrap();
        let result = read_asar_header(&path);
        assert!(result.is_err());
    }

    // ========================================================================
    // find_ks_in_dir
    // ========================================================================

    #[test]
    fn find_ks_in_dir_finds_file() {
        let tmp = tempfile::tempdir().unwrap();
        let sub = tmp.path().join("a/b");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::write(sub.join("scene.ks"), b"content").unwrap();

        let result = find_ks_in_dir(tmp.path(), "scene.ks");
        assert!(result.is_some());
        assert!(result.unwrap().ends_with("scene.ks"));
    }

    #[test]
    fn find_ks_in_dir_returns_none_when_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let result = find_ks_in_dir(tmp.path(), "missing.ks");
        assert!(result.is_none());
    }

    // ========================================================================
    // collect_files
    // ========================================================================

    #[test]
    fn collect_files_gathers_with_forward_slashes() {
        let tmp = tempfile::tempdir().unwrap();
        let sub = tmp.path().join("dir1");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::write(sub.join("file.txt"), b"data").unwrap();
        std::fs::write(tmp.path().join("root.txt"), b"root").unwrap();

        let mut files = Vec::new();
        collect_files(tmp.path(), tmp.path(), &mut files).unwrap();
        files.sort_by(|a, b| a.0.cmp(&b.0));

        assert_eq!(files.len(), 2);
        // All paths should use forward slashes
        for (path, _) in &files {
            assert!(!path.contains('\\'), "path should use forward slashes: {}", path);
        }
        assert!(files.iter().any(|(p, _)| p == "dir1/file.txt"));
        assert!(files.iter().any(|(p, _)| p == "root.txt"));
    }

    // ========================================================================
    // Integration-style: parse then replace round-trip
    // ========================================================================

    #[test]
    fn parse_and_replace_roundtrip() {
        let content = "\
; Opening scene
*start
@bg storage=bg_classroom.jpg
#Alice
Good morning, everyone!
[p]
#Bob
Hello, Alice. How are you?
[link target=*reply1]I'm fine, thanks![endlink]
";
        let strings = parse_ks_strings(content, "scene.ks");
        // We should have: Alice(name), Good morning...(dialogue),
        //                  Bob(name), Hello Alice...(dialogue), I'm fine...(choice)
        assert_eq!(strings.len(), 5);

        // Simulate translating
        let re = tag_regex();
        let lines: Vec<&str> = content.lines().collect();

        // Translate "Good morning, everyone!" on line 5
        let s = &strings[1];
        assert_eq!(s.original, "Good morning, everyone!");
        assert_eq!(s.line_number, 5);
        let new_line = replace_ks_text(
            lines[(s.line_number - 1) as usize],
            &s.original,
            "Buongiorno a tutti!",
            &re,
        );
        assert_eq!(new_line, "Buongiorno a tutti!");

        // Translate choice
        let choice = &strings[4];
        assert_eq!(choice.string_type, "choice");
        assert_eq!(choice.original, "I'm fine, thanks!");
        let choice_line = replace_ks_text(
            lines[(choice.line_number - 1) as usize],
            &choice.original,
            "Sto bene, grazie!",
            &re,
        );
        assert_eq!(choice_line, "[link target=*reply1]Sto bene, grazie![endlink]");
    }

    // ========================================================================
    // Edge case: multiple character changes
    // ========================================================================

    #[test]
    fn parse_ks_strings_character_switch() {
        let input = "\
#Alice
Hello!
#Bob
Hi there!
#Alice
How's it going?
";
        let result = parse_ks_strings(input, "test.ks");
        assert_eq!(result.len(), 6); // 3 names + 3 dialogues
        // After second #Alice, character should be Alice again
        assert_eq!(result[5].character, Some("Alice".to_string()));
        assert_eq!(result[5].original, "How's it going?");
    }

    // ========================================================================
    // Edge: ASAR with empty files (size=0 skipped in extract)
    // ========================================================================

    #[test]
    fn asar_repack_empty_file_is_included() {
        let tmp = tempfile::tempdir().unwrap();
        let src_dir = tmp.path().join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(src_dir.join("empty.txt"), b"").unwrap();
        std::fs::write(src_dir.join("notempty.txt"), b"data").unwrap();

        let asar_path = tmp.path().join("test.asar");
        let count = repack_asar(&src_dir, &asar_path).unwrap();
        // Both files are packed (including empty)
        assert_eq!(count, 2);

        // But extract_asar_all skips size=0 files
        let out_dir = tmp.path().join("out");
        let extracted = extract_asar_all(&asar_path, &out_dir).unwrap();
        assert_eq!(extracted, 1); // Only notempty.txt
    }

    // ========================================================================
    // Edge: replace_ks_text with multiple text segments
    // ========================================================================

    #[test]
    fn replace_ks_text_multiple_text_segments_fallback() {
        let re = tag_regex();
        // "Hello[r]World" -> clean = "HelloWorld", two text segments
        // The replace tries line.replace("HelloWorld", ...) but "HelloWorld" is not
        // a substring of "Hello[r]World", so the line is returned unchanged.
        // This is a known limitation of the multi-segment fallback path.
        let result = replace_ks_text(
            "Hello[r]World", "HelloWorld", "CiaoMondo", &re,
        );
        assert_eq!(result, "Hello[r]World");
    }
}
