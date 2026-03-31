// TyranoScript Patcher - Electron/NW.js games with .asar + .ks files
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use tauri::command;

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
                        Some(count_ks_strings(&String::from_utf8(d).ok()?))
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
                if let Ok(text) = String::from_utf8(data) {
                    all.extend(parse_ks_strings(&text, &sf.filename));
                    done += 1;
                }
            }
        }
    } else {
        for sf in &game.script_files {
            if let Ok(text) = fs::read_to_string(&sf.path) {
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

fn replace_ks_text(
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
