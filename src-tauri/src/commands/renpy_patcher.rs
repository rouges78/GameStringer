// Ren'Py Patcher
// Supporto per giochi visual novel Ren'Py

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::command;
use crate::commands::encoding_utils;

// ============================================================================
// STRUTTURE DATI
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenpyGame {
    pub path: String,
    pub title: String,
    pub version: Option<String>,
    pub script_files: Vec<RenpyScriptFile>,
    pub has_translations: bool,
    pub available_languages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenpyScriptFile {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub string_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenpyString {
    pub id: String,
    pub original: String,
    pub translated: String,
    pub file: String,
    pub line_number: u32,
    pub string_type: RenpyStringType,
    pub character: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RenpyStringType {
    Dialogue,
    Menu,
    Narration,
    String,
    Label,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenpyExtractionResult {
    pub success: bool,
    pub message: String,
    pub strings: Vec<RenpyString>,
    pub total_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenpyStats {
    pub total: usize,
    pub translated: usize,
    pub untranslated: usize,
    pub percentage: usize,
    pub by_type: HashMap<String, usize>,
}

// ============================================================================
// RILEVAMENTO GIOCO
// ============================================================================

/// Rileva se una cartella contiene un gioco Ren'Py
#[command]
pub fn detect_renpy_game(game_path: String) -> Result<RenpyGame, String> {
    let path = Path::new(&game_path);
    
    if !path.exists() {
        return Err("Percorso non esistente".to_string());
    }
    
    // Cerca file caratteristici di Ren'Py
    let game_folder = path.join("game");
    let renpy_folder = path.join("renpy");
    
    if !game_folder.exists() && !renpy_folder.exists() {
        return Err("Non sembra essere un gioco Ren'Py (manca cartella 'game')".to_string());
    }
    
    // Trova script .rpy
    let script_files = find_rpy_files(&game_path)?;
    
    if script_files.is_empty() {
        return Err("Nessun file .rpy trovato".to_string());
    }
    
    // Estrai titolo e versione
    let (title, version) = extract_game_info(&game_path);
    
    // Controlla traduzioni esistenti
    let tl_folder = game_folder.join("tl");
    let has_translations = tl_folder.exists();
    let available_languages = if has_translations {
        get_available_languages(&tl_folder)
    } else {
        Vec::new()
    };
    
    log::info!("🎮 Rilevato Ren'Py: {} ({} script, {} lingue)", 
        title, script_files.len(), available_languages.len());
    
    Ok(RenpyGame {
        path: game_path,
        title,
        version,
        script_files,
        has_translations,
        available_languages,
    })
}

/// Trova tutti i file .rpy nel gioco
fn find_rpy_files(game_path: &str) -> Result<Vec<RenpyScriptFile>, String> {
    let path = Path::new(game_path);
    let game_folder = path.join("game");
    
    let search_folder = if game_folder.exists() {
        game_folder
    } else {
        path.to_path_buf()
    };
    
    let mut files = Vec::new();
    
    // 07/08/2026: max_depth era 5 e Scarlet Hollow tiene i copioni a
    // profondità 6 (scripts/_day_3/<caccia>/<luogo>/<personaggio>/file.rpy):
    // i più annidati sparivano IN SILENZIO dal conteggio. 12 copre con margine.
    for entry in walkdir::WalkDir::new(&search_folder)
        .max_depth(12)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension() {
                if ext.to_string_lossy().to_lowercase() == "rpy" {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    
                    // Ignora file nella cartella tl (traduzioni esistenti)
                    let path_str = entry.path().to_string_lossy().to_string();
                    if !path_str.contains("\\tl\\") && !path_str.contains("/tl/") {
                        files.push(RenpyScriptFile {
                            path: path_str,
                            filename,
                            size,
                            string_count: None,
                        });
                    }
                }
            }
        }
    }
    
    files.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(files)
}

/// Estrai info del gioco da options.rpy
fn extract_game_info(game_path: &str) -> (String, Option<String>) {
    let path = Path::new(game_path);
    let options_path = path.join("game").join("options.rpy");
    
    let mut title = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Ren'Py Game")
        .to_string();
    let mut version = None;
    
    if options_path.exists() {
        if let Ok(content) = fs::read_to_string(&options_path) {
            // Cerca config.name
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("define config.name") {
                    if let Some(name) = extract_string_value(trimmed) {
                        title = name;
                    }
                }
                if trimmed.starts_with("define config.version") {
                    if let Some(ver) = extract_string_value(trimmed) {
                        version = Some(ver);
                    }
                }
            }
        }
    }
    
    (title, version)
}

/// Estrai valore stringa da linea Ren'Py
fn extract_string_value(line: &str) -> Option<String> {
    // Cerca tra virgolette
    if let Some(start) = line.find('"') {
        if let Some(end) = line[start+1..].find('"') {
            return Some(line[start+1..start+1+end].to_string());
        }
    }
    None
}

/// Ottieni lingue disponibili dalla cartella tl
fn get_available_languages(tl_folder: &Path) -> Vec<String> {
    let mut languages = Vec::new();
    
    if let Ok(entries) = fs::read_dir(tl_folder) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                if let Some(name) = entry.file_name().to_str() {
                    // Ignora cartelle speciali
                    if name != "None" && name != "common" {
                        languages.push(name.to_string());
                    }
                }
            }
        }
    }
    
    languages.sort();
    languages
}

// ============================================================================
// ESTRAZIONE STRINGHE
// ============================================================================

/// Estrai stringhe da un file .rpy
#[command]
pub fn extract_renpy_strings(file_path: String) -> Result<RenpyExtractionResult, String> {
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err("File non trovato".to_string());
    }
    
    let raw_bytes = fs::read(&file_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    let (content, _enc) = encoding_utils::auto_decode(&raw_bytes);

    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let mut strings = Vec::new();
    let mut id_counter = 0u32;

    // ── AST-lite state-machine parser ──────────────────────────────────
    #[derive(Debug, Clone, Copy, PartialEq)]
    #[allow(dead_code)]
    enum BlockKind { Normal, Python, Screen, Menu, Translate }

    /// Track block context by indentation level
    struct BlockCtx {
        indent: usize,
        kind: BlockKind,
    }

    let mut block_stack: Vec<BlockCtx> = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    let mut line_idx = 0;

    // Screen-text keywords whose first quoted argument is user-visible text
    let screen_text_kw: &[&str] = &["text ", "textbutton ", "label ", "vbox:", "hbox:"];

    while line_idx < lines.len() {
        let line = lines[line_idx];
        let trimmed = line.trim();

        // Skip comments and blank lines PRIMA di toccare lo stack dei blocchi.
        //
        // 08/08/2026, il difetto che ha spento la traduzione dei menu di OGNI
        // gioco Ren'Py: una riga vuota ha indentazione 0, e il pop stava PRIMA
        // di questo salto — quindi la prima riga vuota dentro uno `screen`
        // (screens.rpy ne è pieno) chiudeva il blocco Screen. Da lì in poi ogni
        // `text "..."` cadeva nell'estrazione generica: «text» è alfanumerico,
        // diventava il nome del personaggio, e la stringa finiva Dialogue nel
        // filtro say — che il testo delle screen non lo tocca. Misurato su
        // Scarlet Hollow: 2.127 stringhe UI in screens.rpy+gui.rpy, di cui
        // SOLO 3 classificate String (le uniche prima della prima riga vuota);
        // 435 Dialogue con speaker "text"/"textbutton". Per Ren'Py una riga
        // vuota o un commento non chiudono un blocco: nemmeno per noi.
        if trimmed.starts_with('#') || trimmed.is_empty() {
            line_idx += 1;
            continue;
        }

        // Measure indentation (spaces; treat tab as 4 spaces)
        let indent: usize = line.chars().take_while(|c| c.is_whitespace())
            .map(|c| if c == '\t' { 4 } else { 1 }).sum();

        // Pop blocks that we have un-indented out of
        while let Some(top) = block_stack.last() {
            if indent <= top.indent { block_stack.pop(); } else { break; }
        }

        let in_python = block_stack.iter().any(|b| b.kind == BlockKind::Python);

        // Skip if we are inside a python block
        if in_python {
            line_idx += 1;
            continue;
        }

        // ── Detect new blocks ──────────────────────────────────────────
        if trimmed.starts_with("python:") || trimmed.starts_with("init python:") || trimmed.starts_with("init ") && trimmed.contains("python:") {
            block_stack.push(BlockCtx { indent, kind: BlockKind::Python });
            line_idx += 1;
            continue;
        }
        if trimmed.starts_with("screen ") {
            block_stack.push(BlockCtx { indent, kind: BlockKind::Screen });
            line_idx += 1;
            continue;
        }
        if trimmed == "menu:" || trimmed.starts_with("menu ") {
            block_stack.push(BlockCtx { indent, kind: BlockKind::Menu });
            line_idx += 1;
            continue;
        }
        if trimmed.starts_with("translate ") {
            block_stack.push(BlockCtx { indent, kind: BlockKind::Translate });
            line_idx += 1;
            continue;
        }

        // ── Skip keywords that are not extractable ─────────────────────
        let skip_keywords: &[&str] = &[
            "define ", "init ", "$", "if ", "elif ", "else:", "label ",
            "jump ", "call ", "return", "show ", "hide ", "scene ",
            "play ", "stop ", "with ", "transform ", "style ",
            "image ", "default ", "pause", "window ", "pass",
        ];
        let is_skip_keyword = skip_keywords.iter().any(|kw| trimmed.starts_with(kw));
        // Don't skip if we are inside a screen/translate block and the
        // line contains a quoted string we should extract
        let in_screen = block_stack.iter().any(|b| b.kind == BlockKind::Screen);
        let in_translate = block_stack.iter().any(|b| b.kind == BlockKind::Translate);

        if is_skip_keyword && !in_screen && !in_translate {
            line_idx += 1;
            continue;
        }

        // ── Screen text: text "...", textbutton "...", action Notify("...") ─
        if in_screen {
            // Extract all quoted strings from screen-text keywords
            let is_screen_text = screen_text_kw.iter().any(|kw| trimmed.starts_with(kw));
            let has_notify = trimmed.contains("Notify(\"") || trimmed.contains("Notify('");

            if is_screen_text || has_notify {
                for extracted in extract_quoted_strings(trimmed) {
                    if extracted.len() > 1 {
                        id_counter += 1;
                        strings.push(RenpyString {
                            id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                            original: extracted,
                            translated: String::new(),
                            file: filename.clone(),
                            line_number: (line_idx + 1) as u32,
                            string_type: RenpyStringType::String,
                            character: None,
                        });
                    }
                }
                line_idx += 1;
                continue;
            }
            // Other screen lines (action, style, etc.) -- skip
            line_idx += 1;
            continue;
        }

        // ── Triple-quoted strings """...""" ─────────────────────────────
        if trimmed.contains("\"\"\"") {
            let (text, consumed) = parse_triple_quoted(trimmed, &lines, line_idx);
            if let Some(text) = text {
                if text.len() > 1 {
                    // Detect character prefix before the triple quote
                    let before_quote = trimmed.split("\"\"\"").next().unwrap_or("").trim();
                    let character = if !before_quote.is_empty() && before_quote.chars().all(|c| c.is_alphanumeric() || c == '_') {
                        Some(before_quote.to_string())
                    } else {
                        None
                    };

                    id_counter += 1;
                    let string_type = if character.is_some() {
                        RenpyStringType::Dialogue
                    } else {
                        RenpyStringType::Narration
                    };
                    strings.push(RenpyString {
                        id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                        original: text,
                        translated: String::new(),
                        file: filename.clone(),
                        line_number: (line_idx + 1) as u32,
                        string_type,
                        character,
                    });
                }
            }
            line_idx += consumed;
            continue;
        }

        // ── Menu choices: "text": ──────────────────────────────────────
        if trimmed.ends_with("\":") || trimmed.ends_with("\": ") {
            if let Some(text) = extract_first_quoted(trimmed) {
                if text.len() > 1 {
                    id_counter += 1;
                    strings.push(RenpyString {
                        id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                        original: text,
                        translated: String::new(),
                        file: filename.clone(),
                        line_number: (line_idx + 1) as u32,
                        string_type: RenpyStringType::Menu,
                        character: None,
                    });
                }
            }
            line_idx += 1;
            continue;
        }

        // ── Dialogue / Narration / Translate text ──────────────────────
        if let Some(first_q) = trimmed.find('"') {
            // Everything before the first quote is the potential character name
            let before = trimmed[..first_q].trim();
            // Extract the quoted string (handling escaped quotes)
            if let Some(text) = extract_first_quoted(trimmed) {
                if text.len() > 1 {
                    let character = if !before.is_empty()
                        && before.chars().all(|c| c.is_alphanumeric() || c == '_')
                        && !is_skip_keyword
                    {
                        Some(before.to_string())
                    } else {
                        None
                    };

                    let string_type = if in_translate {
                        RenpyStringType::Narration
                    } else if character.is_some() {
                        RenpyStringType::Dialogue
                    } else {
                        RenpyStringType::Narration
                    };

                    id_counter += 1;
                    strings.push(RenpyString {
                        id: format!("{}_{}", filename.replace('.', "_"), id_counter),
                        original: text,
                        translated: String::new(),
                        file: filename.clone(),
                        line_number: (line_idx + 1) as u32,
                        string_type,
                        character,
                    });
                }
            }
        }

        line_idx += 1;
    }
    
    let total_count = strings.len() as u32;
    
    log::info!("📝 Estratte {} stringhe da {}", total_count, filename);
    
    Ok(RenpyExtractionResult {
        success: true,
        message: format!("Estratte {} stringhe", total_count),
        strings,
        total_count,
    })
}

/// Extract the first double-quoted string from a line, handling escaped quotes.
fn extract_first_quoted(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let mut i = 0;
    // Find opening quote
    while i < bytes.len() {
        if bytes[i] == b'"' { break; }
        i += 1;
    }
    if i >= bytes.len() { return None; }
    i += 1; // skip opening quote
    let mut result = String::new();
    while i < bytes.len() {
        if bytes[i] == b'\\' && i + 1 < bytes.len() {
            // Keep escape sequences as-is in the extracted string
            result.push('\\');
            result.push(bytes[i + 1] as char);
            i += 2;
        } else if bytes[i] == b'"' {
            return if result.is_empty() { None } else { Some(result) };
        } else {
            result.push(bytes[i] as char);
            i += 1;
        }
    }
    None // unterminated string
}

/// Extract all double-quoted strings from a line.
fn extract_quoted_strings(s: &str) -> Vec<String> {
    let mut results = Vec::new();
    let mut remaining = s;
    while let Some(pos) = remaining.find('"') {
        if let Some(text) = extract_first_quoted(&remaining[pos..]) {
            results.push(text.clone());
            // Advance past the closing quote
            let skip = text.len() + 2; // opening quote + content + closing quote (approximate)
            if pos + 1 + skip <= remaining.len() {
                remaining = &remaining[pos + 1 + skip..];
            } else {
                break;
            }
        } else {
            break;
        }
    }
    results
}

/// Parse a triple-quoted string ("""..."""), potentially spanning multiple lines.
/// Returns (Some(text), lines_consumed) or (None, 1) on failure.
fn parse_triple_quoted(first_trimmed: &str, lines: &[&str], start_idx: usize) -> (Option<String>, usize) {
    // Find the opening """
    let open_pos = match first_trimmed.find("\"\"\"") {
        Some(p) => p,
        None => return (None, 1),
    };
    let after_open = &first_trimmed[open_pos + 3..];

    // Check if closing """ is on the same line
    if let Some(close_pos) = after_open.find("\"\"\"") {
        let text = after_open[..close_pos].to_string();
        return (Some(text), 1);
    }

    // Multi-line: collect until we find closing """
    let mut parts = vec![after_open.to_string()];
    let mut idx = start_idx + 1;
    while idx < lines.len() {
        let line = lines[idx];
        if let Some(close_pos) = line.find("\"\"\"") {
            let before_close = line[..close_pos].to_string();
            // Trim the indentation from intermediate lines but keep the text
            parts.push(before_close.trim().to_string());
            let text = parts.join("\n");
            return (Some(text.trim().to_string()), idx - start_idx + 1);
        }
        parts.push(line.trim().to_string());
        idx += 1;
    }
    (None, 1) // unterminated
}

/// Estrai tutte le stringhe da un gioco Ren'Py
#[command]
pub fn extract_all_renpy_strings(game_path: String) -> Result<RenpyExtractionResult, String> {
    let game = detect_renpy_game(game_path)?;
    
    let mut all_strings = Vec::new();
    
    for script_file in &game.script_files {
        match extract_renpy_strings(script_file.path.clone()) {
            Ok(result) => {
                all_strings.extend(result.strings);
            }
            Err(e) => {
                log::warn!("⚠️ Errore estrazione {}: {}", script_file.filename, e);
            }
        }
    }
    
    let total_count = all_strings.len() as u32;
    
    log::info!("📝 Totale: {} stringhe estratte dal gioco Ren'Py", total_count);
    
    Ok(RenpyExtractionResult {
        success: true,
        message: format!("Estratte {} stringhe totali", total_count),
        strings: all_strings,
        total_count,
    })
}

// ============================================================================
// GENERAZIONE FILE TRADUZIONE
// ============================================================================

/// Genera i file di traduzione Ren'Py nella cartella `game/tl/<lang>/`.
///
/// **Perché due meccanismi diversi.** In Ren'Py il blocco
/// `translate <lang> strings:` con coppie `old`/`new` traduce SOLO le stringhe
/// UI / `_()`. I dialoghi (`say`), la narrazione e le scelte di `menu` passano
/// invece per il sistema a identificatori (hash interni), NON per `old`/`new`:
/// generarli come `old`/`new` produce un file che in gioco lascia i dialoghi in
/// lingua originale. Per tradurli in modo robusto senza replicare gli hash di
/// Ren'Py generiamo un filtro runtime (`config.say_menu_text_filter`) con un
/// dizionario originale→tradotto, attivo solo quando il giocatore ha
/// selezionato questa lingua (`preferences.language`), e che concatena un
/// eventuale filtro preesistente del gioco.
#[command]
pub fn generate_renpy_translation(
    game_path: String,
    language: String,
    strings: Vec<RenpyString>,
) -> Result<String, String> {
    let path = Path::new(&game_path);
    let tl_folder = path.join("game").join("tl").join(&language);

    // PRIMA di creare qualsiasi cosa: game/ esisteva già? Serve più avanti,
    // e va misurato ADESSO. La prima versione lo controllava dopo la
    // create_dir_all qui sotto — che game/ la crea — quindi la guardia
    // «questa cartella non è un gioco Ren'Py, non ci scrivo» non poteva mai
    // scattare: su un percorso sbagliato GameStringer si inventava un albero
    // game/tl/it/ e dichiarava successo. Una protezione scritta nel commento
    // e assente nei fatti è peggio di nessuna protezione.
    let had_game_dir = path.join("game").is_dir();

    // Crea cartella traduzione
    fs::create_dir_all(&tl_folder)
        .map_err(|e| format!("Errore creazione cartella: {}", e))?;

    // Partiziona le stringhe TRADOTTE per meccanismo di applicazione:
    //  - dialogue_like (Dialogue/Narration/Menu) → filtro runtime say_menu_text_filter
    //  - ui_strings   (String, es. testo nelle screen) → blocco `translate <lang> strings:`
    //  - Label        → non è testo visibile, ignorata
    let mut dialogue_like: Vec<&RenpyString> = Vec::new();
    let mut ui_strings: HashMap<String, Vec<&RenpyString>> = HashMap::new();

    for s in &strings {
        if s.translated.is_empty() {
            continue;
        }
        match s.string_type {
            RenpyStringType::Dialogue
            | RenpyStringType::Narration
            | RenpyStringType::Menu => dialogue_like.push(s),
            RenpyStringType::String => {
                ui_strings.entry(s.file.clone()).or_default().push(s);
            }
            RenpyStringType::Label => { /* non testo visibile */ }
        }
    }

    let mut generated_files: Vec<String> = Vec::new();

    // ── Blocco `strings` old/new per il testo UI delle screen ───────────
    // Dedup GLOBALE per lingua, non per file: Ren'Py rifiuta con eccezione
    // FATALE («A translation for "X" already exists») un `old` ripetuto
    // OVUNQUE dentro tl/<lang>/ — scoperto l'08/08/2026 sul campo, quando
    // Scarlet Hollow è morto all'avvio su `old "Case"` scritto due volte in
    // 01virtual_keyboard_it.rpy (la tastiera virtuale ripete le etichette per
    // la riga maiuscole/minuscole). Il filtro say deduplicava già, questo
    // ramo no: stessa famiglia dei 233 duplicati della mappa di Larry 3. La
    // prima occorrenza vince, come fa `seen` nel filtro.
    let mut ui_seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for (file, file_strings) in &ui_strings {
        let output_filename = file.replace(".rpy", &format!("_{}.rpy", language));
        let output_path = tl_folder.join(&output_filename);

        let mut content = format!("# Translation file for {}\n\n", file);
        content.push_str(&format!("translate {} strings:\n\n", language));
        let mut wrote_any = false;

        for s in file_strings {
            // L'estrazione conserva gli escape sorgente (\" \n …). La stringa
            // runtime con cui Ren'Py confronta `old` è de-escapata: de-escapiamo
            // e poi ri-escapiamo per il literal, evitando il doppio escape.
            let runtime_key = unescape_renpy_string(&s.original);
            if !ui_seen.insert(runtime_key.clone()) {
                continue; // già tradotta altrove: un secondo `old` è un crash
            }
            let key = escape_renpy_string(&runtime_key);
            let val = escape_renpy_string(&s.translated);
            content.push_str(&format!("    # {}:{}\n", s.file, s.line_number));
            content.push_str(&format!("    old \"{}\"\n", key));
            content.push_str(&format!("    new \"{}\"\n\n", val));
            wrote_any = true;
        }

        // Un file di soli duplicati sarebbe un `translate strings:` vuoto —
        // inutile, e per Ren'Py un blocco senza contenuto è comunque un file
        // da compilare. Non lo scriviamo proprio.
        if !wrote_any {
            continue;
        }

        fs::write(&output_path, content)
            .map_err(|e| format!("Errore scrittura {}: {}", output_filename, e))?;
        generated_files.push(output_filename);
    }

    // ── Filtro runtime per dialoghi / narrazione / scelte menu ──────────
    if !dialogue_like.is_empty() {
        let filter_filename = GS_FILTER_FILENAME.to_string();
        let filter_path = tl_folder.join(&filter_filename);

        // Deduplica per chiave runtime (l'ultima traduzione vince)
        let mut seen: HashMap<String, String> = HashMap::new();
        for s in &dialogue_like {
            seen.insert(unescape_renpy_string(&s.original), s.translated.clone());
        }

        let mut content = String::new();
        content.push_str(&format!(
            "# GameStringer — filtro traduzione dialoghi runtime per '{}'.\n",
            language
        ));
        content.push_str("# Generato automaticamente: non modificare a mano.\n");
        content.push_str("# Traduce say/menu via config.say_menu_text_filter, attivo solo\n");
        content.push_str("# quando il giocatore seleziona questa lingua.\n\n");
        content.push_str("init 1900 python:\n");
        content.push_str("    __gs_tl = {\n");
        for (key_runtime, translated) in &seen {
            content.push_str(&format!(
                "        u\"{}\": u\"{}\",\n",
                escape_renpy_string(key_runtime),
                escape_renpy_string(translated)
            ));
        }
        content.push_str("    }\n");
        content.push_str(&format!(
            "    __gs_lang = \"{}\"\n",
            escape_renpy_string(&language)
        ));
        content.push_str("    __gs_prev_filter = getattr(config, \"say_menu_text_filter\", None)\n");
        content.push_str("    def __gs_say_filter(s):\n");
        content.push_str("        try:\n");
        content.push_str("            if renpy.game.preferences.language == __gs_lang:\n");
        content.push_str("                t = __gs_tl.get(s)\n");
        content.push_str("                if t is not None:\n");
        content.push_str("                    return t\n");
        content.push_str("        except Exception:\n");
        content.push_str("            pass\n");
        content.push_str("        if __gs_prev_filter is not None:\n");
        content.push_str("            return __gs_prev_filter(s)\n");
        content.push_str("        return s\n");
        content.push_str("    config.say_menu_text_filter = __gs_say_filter\n");

        fs::write(&filter_path, content)
            .map_err(|e| format!("Errore scrittura {}: {}", filter_filename, e))?;
        generated_files.push(filter_filename);
    }

    let count = generated_files.len();

    // ── Attivazione della lingua (game/gs_language.rpy) ─────────────────
    // Senza questo passo tutto il resto è irraggiungibile: i blocchi
    // `translate <lang> strings:` e il filtro say si attivano SOLO quando
    // `preferences.language == <lang>`, e un gioco monolingua non ha nessun
    // menu lingue con cui selezionarla. L'08/08/2026 Scarlet Hollow aveva i
    // file tl/ scritti e corretti e restava in inglese: il file di
    // attivazione era stato scritto A MANO. Se resta a mano, ogni Ren'Py
    // monolingua che passa di qui nasce spento — la sesta comparsa in 24 ore
    // del pattern "lavoro completo e irraggiungibile".
    let activator = if count > 0 {
        // NON con `?`: se l'attivatore non si scrive (permessi, disco pieno)
        // la traduzione è comunque tutta sul disco, e far fallire l'intero
        // comando direbbe all'utente «non è stato scritto niente», che è
        // falso. Si degrada dicendo cosa manca, invece di buttare via un
        // successo vero.
        match write_language_activator(path, &language, had_game_dir) {
            Ok(note) => note,
            Err(e) => {
                log::warn!("Attivazione lingua NON scritta: {}", e);
                Some(format!(
                    " ⚠ attivazione NON scritta ({}): la traduzione c'è ma il gioco non la accende — \
                     crea a mano game/gs_language.rpy con `init 999 python: config.language = \"{}\"`",
                    e, language
                ))
            }
        }
    } else {
        // Nessun file scritto = niente da attivare. Puntare config.language a
        // una lingua vuota non tradurrebbe nulla e cambierebbe comunque le
        // stringhe interne di Ren'Py: un effetto senza beneficio.
        None
    };

    log::info!(
        "✅ Generati {} file di traduzione in game/tl/{}/ ({} dialoghi/menu via filtro runtime){}",
        count,
        language,
        dialogue_like.len(),
        activator.as_deref().unwrap_or(" — attivazione NON scritta")
    );

    Ok(format!(
        "Generati {} file in game/tl/{}/ ({} stringhe dialogo/menu via filtro runtime){}",
        count,
        language,
        dialogue_like.len(),
        activator.as_deref().unwrap_or("")
    ))
}

/// Nomi di cartelle sotto `game/tl/` che NON sono lingue selezionabili.
const TL_NON_LANGUAGES: [&str; 2] = ["None", "common"];

/// Filtro runtime dei dialoghi: è anche il marcatore che riconosce una
/// cartella `tl/<lang>` come generata da GameStringer.
const GS_FILTER_FILENAME: &str = "gamestringer_say_filter.rpy";

/// Prima riga di `game/gs_language.rpy`: la nostra firma. Serve a riconoscere
/// un attivatore che abbiamo scritto noi da uno messo lì dall'utente o dal
/// gioco — l'unico caso in cui è lecito sovrascriverlo.
const GS_ACTIVATOR_SIGNATURE: &str = "# GameStringer — attivazione della lingua";

/// Scrive `game/gs_language.rpy` per attivare `language` nei giochi che non
/// offrono un menu lingue.
///
/// **Perché serve.** Ren'Py applica una traduzione solo quando quella lingua è
/// *selezionata*. Un gioco pensato per una lingua sola non ha nulla che la
/// selezioni: i file in `tl/<lang>/` esistono e non li legge nessuno.
///
/// **Perché così.** La documentazione Ren'Py (Translation → *Unsanctioned
/// Translations* e *Default Language*) indica esattamente questa strada: un
/// blocco `init python` che imposta [`config.language`], che «sets the language
/// to use at game launch, overriding any memorized choice made by the user».
/// `_preferences.language` è invece dichiarato read-only, quindi scriverci
/// sarebbe la strada sbagliata — verificato sui doc PRIMA di scegliere.
/// Priorità 999: dopo l'init normale del gioco (offset 0), così vince su un
/// eventuale `config.language` già definito in options.rpy, e prima del filtro
/// say generato a 1900.
///
/// **Quando NON si scrive.** Se il gioco ha già altre lingue *sue* in `tl/`,
/// quasi certamente ha un menu lingue: forzare `config.language` scavalcherebbe
/// per sempre la scelta del giocatore (lo dice la documentazione stessa). In
/// quel caso la traduzione si seleziona dal menu del gioco e questo file non
/// serve. Attenzione a cosa vuol dire «sue»: le cartelle che abbiamo generato
/// NOI non contano — vedi `other_languages_in_tl`.
///
/// Ritorna `Some(nota)` se il file è stato scritto, `None` se saltato.
fn write_language_activator(
    game_root: &Path,
    language: &str,
    had_game_dir: bool,
) -> Result<Option<String>, String> {
    let game_dir = game_root.join("game");
    if !had_game_dir {
        // Nessuna cartella game/ PRIMA che iniziassimo: non è un layout Ren'Py
        // standard. Non inventiamo un percorso — meglio dirlo che scrivere in
        // un posto che il gioco non legge (sarebbe di nuovo un file
        // irraggiungibile).
        log::warn!(
            "Attivazione lingua saltata: {} non conteneva una cartella game/",
            game_root.display()
        );
        return Ok(None);
    }

    let out = game_dir.join("gs_language.rpy");
    // Un attivatore con la NOSTRA firma è la prova che questo gioco era
    // monolingua quando ci siamo passati la prima volta: qualunque cosa ci sia
    // ora in tl/ (la nostra traduzione precedente) non è un menu lingue.
    let ours_already = fs::read_to_string(&out)
        .map(|c| c.starts_with(GS_ACTIVATOR_SIGNATURE))
        .unwrap_or(false);

    let others = other_languages_in_tl(&game_dir, language);
    if !others.is_empty() && !ours_already {
        log::info!(
            "Attivazione lingua saltata: il gioco ha già {} lingua/e sue in tl/ ({}) — \
             ha un menu lingue, la scelta resta al giocatore",
            others.len(),
            others.join(", ")
        );
        return Ok(None);
    }

    let lang = escape_renpy_string(language);
    let content = format!(
        "# GameStringer — attivazione della lingua \"{0}\".\n\
         # Generato automaticamente: non modificare a mano.\n\
         #\n\
         # Questo gioco non offre un menu delle lingue, quindi la traduzione in\n\
         # game/tl/{0}/ non sarebbe selezionabile da nessuno. config.language\n\
         # la imposta all'avvio (doc Ren'Py, «Unsanctioned Translations»).\n\
         #\n\
         # PER TORNARE ALLA LINGUA ORIGINALE non basta cancellare questo file:\n\
         # al primo avvio Ren'Py ha MEMORIZZATO la lingua nei dati persistenti\n\
         # (_init_language chiama change_language, che scrive in preferences),\n\
         # quindi senza config.language il gioco ricadrebbe comunque su \"{0}\".\n\
         # Servono DUE cose: cancellare questo file E la cartella game/tl/{0}/.\n\
         \n\
         init 999 python:\n\
         \x20   config.language = \"{0}\"\n",
        lang
    );

    fs::write(&out, content)
        .map_err(|e| format!("Errore scrittura game/gs_language.rpy: {}", e))?;

    // Ren'Py preferisce il .rpyc quando è più recente del .rpy: un .rpyc
    // rimasto da un'attivazione precedente (lingua diversa, o file cancellato
    // a mano per tornare all'originale) continuerebbe a comandare e il file
    // appena scritto non avrebbe alcun effetto — un file scritto e ignorato,
    // di nuovo. Si rimuove, Ren'Py lo ricompila al primo avvio.
    let stale = game_dir.join("gs_language.rpyc");
    if stale.exists() {
        if let Err(e) = fs::remove_file(&stale) {
            log::warn!("gs_language.rpyc vecchio non rimosso ({}): il gioco potrebbe usare quello", e);
        }
    }

    log::info!(
        "✅ Attivazione lingua scritta: game/gs_language.rpy (config.language = \"{}\")",
        language
    );
    Ok(Some(format!(
        " + game/gs_language.rpy: la lingua «{}» si attiva da sola all'avvio",
        language
    )))
}

/// Lingue del GIOCO già presenti in `game/tl/` — cioè la prova che esiste un
/// menu lingue. Escluse: le cartelle di servizio (`None`, `common`), quella che
/// stiamo generando adesso, e **quelle generate da GameStringer in una run
/// precedente**.
///
/// Quest'ultima esclusione non è un dettaglio. Senza, bastava tradurre prima in
/// italiano e poi in francese perché la seconda run vedesse `tl/it` (la NOSTRA)
/// e concludesse «il gioco ha un menu lingue»: attivatore non scritto, il
/// vecchio `gs_language.rpy` con `"it"` lasciato sul disco a comandare, e
/// `tl/fr/` completo e irraggiungibile — con il messaggio che invita a
/// selezionare FR da un menu che non esiste. Il pattern «lavoro completo e
/// irraggiungibile» reintrodotto proprio dal codice scritto per eliminarlo.
///
/// Il marcatore è `gamestringer_say_filter.rpy`, che generiamo noi in ogni
/// lingua con almeno un dialogo. Per le traduzioni di sola UI (nessun dialogo,
/// nessun filtro) resta il secondo riconoscimento in `write_language_activator`:
/// un `gs_language.rpy` che porta la nostra firma.
fn other_languages_in_tl(game_dir: &Path, language: &str) -> Vec<String> {
    let tl = game_dir.join("tl");
    let entries = match fs::read_dir(&tl) {
        Ok(e) => e,
        Err(_) => return Vec::new(), // nessuna cartella tl/ = nessun'altra lingua
    };
    let mut out: Vec<String> = entries
        .flatten()
        .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .filter_map(|e| e.file_name().to_str().map(str::to_string))
        .filter(|n| !TL_NON_LANGUAGES.contains(&n.as_str()) && n != language)
        .filter(|n| !tl.join(n).join(GS_FILTER_FILENAME).exists())
        .collect();
    out.sort();
    out
}

/// Escape caratteri speciali per stringhe Ren'Py (literal `"..."`).
fn escape_renpy_string(s: &str) -> String {
    s.replace('\\', "\\\\")
     .replace('"', "\\\"")
     .replace('\n', "\\n")
}

/// Inverte `escape_renpy_string` / gli escape sorgente conservati in fase di
/// estrazione: `\\`→`\`, `\"`→`"`, `\n`→newline, `\t`→tab. Una sequenza
/// sconosciuta (`\x`) viene mantenuta invariata (backslash + carattere).
fn unescape_renpy_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('\\') => out.push('\\'),
                Some('"') => out.push('"'),
                Some('n') => out.push('\n'),
                Some('t') => out.push('\t'),
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

// ============================================================================
// SALVATAGGIO/CARICAMENTO
// ============================================================================

/// Salva traduzioni in formato JSON
#[command]
pub fn save_renpy_translations(
    output_path: String,
    strings: Vec<RenpyString>,
) -> Result<u32, String> {
    let json = serde_json::to_string_pretty(&strings)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&output_path, json)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    let count = strings.len() as u32;
    log::info!("💾 Salvate {} traduzioni Ren'Py", count);
    
    Ok(count)
}

/// Carica traduzioni da JSON
#[command]
pub fn load_renpy_translations(input_path: String) -> Result<Vec<RenpyString>, String> {
    let content = fs::read_to_string(&input_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let strings: Vec<RenpyString> = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    log::info!("📂 Caricate {} traduzioni Ren'Py", strings.len());
    
    Ok(strings)
}

// ============================================================================
// STATISTICHE
// ============================================================================

/// Ottieni statistiche traduzioni
#[command]
pub fn get_renpy_translation_stats(strings: Vec<RenpyString>) -> RenpyStats {
    let total = strings.len();
    let translated = strings.iter().filter(|s| !s.translated.is_empty()).count();
    let untranslated = total - translated;
    let percentage = if total > 0 { (translated * 100) / total } else { 0 };
    
    // Conta per tipo
    let mut by_type: HashMap<String, usize> = HashMap::new();
    for s in &strings {
        let type_name = match s.string_type {
            RenpyStringType::Dialogue => "Dialoghi",
            RenpyStringType::Menu => "Menu",
            RenpyStringType::Narration => "Narrazione",
            RenpyStringType::String => "Stringhe",
            RenpyStringType::Label => "Label",
        };
        *by_type.entry(type_name.to_string()).or_default() += 1;
    }
    
    RenpyStats {
        total,
        translated,
        untranslated,
        percentage,
        by_type,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // ── extract_string_value ────────────────────────────────────────────

    #[test]
    fn test_extract_string_value_basic() {
        let line = r#"define config.name = "My Game""#;
        assert_eq!(extract_string_value(line), Some("My Game".to_string()));
    }

    #[test]
    fn test_extract_string_value_with_spaces() {
        let line = r#"define config.version = "1.2.3""#;
        assert_eq!(extract_string_value(line), Some("1.2.3".to_string()));
    }

    #[test]
    fn test_extract_string_value_no_quotes() {
        let line = "define config.name = MyGame";
        assert_eq!(extract_string_value(line), None);
    }

    #[test]
    fn test_extract_string_value_single_quote_only() {
        let line = "define config.name = 'MyGame'";
        assert_eq!(extract_string_value(line), None);
    }

    #[test]
    fn test_extract_string_value_empty_string() {
        let line = r#"define config.name = """#;
        assert_eq!(extract_string_value(line), Some("".to_string()));
    }

    #[test]
    fn test_extract_string_value_empty_input() {
        assert_eq!(extract_string_value(""), None);
    }

    #[test]
    fn test_extract_string_value_one_quote_only() {
        let line = r#"broken "unterminated"#;
        assert_eq!(extract_string_value(line), None);
    }

    // ── escape_renpy_string ─────────────────────────────────────────────

    #[test]
    fn test_escape_renpy_string_no_special_chars() {
        assert_eq!(escape_renpy_string("Hello world"), "Hello world");
    }

    #[test]
    fn test_escape_renpy_string_backslash() {
        assert_eq!(escape_renpy_string(r"path\to\file"), r"path\\to\\file");
    }

    #[test]
    fn test_escape_renpy_string_double_quote() {
        assert_eq!(escape_renpy_string(r#"She said "hi""#), r#"She said \"hi\""#);
    }

    #[test]
    fn test_escape_renpy_string_newline() {
        assert_eq!(escape_renpy_string("line1\nline2"), r"line1\nline2");
    }

    #[test]
    fn test_escape_renpy_string_all_special() {
        assert_eq!(
            escape_renpy_string("a\\b\"c\nd"),
            r#"a\\b\"c\nd"#
        );
    }

    #[test]
    fn test_escape_renpy_string_empty() {
        assert_eq!(escape_renpy_string(""), "");
    }

    // ── unescape_renpy_string ───────────────────────────────────────────

    #[test]
    fn test_unescape_renpy_string_plain() {
        assert_eq!(unescape_renpy_string("Hello world"), "Hello world");
    }

    #[test]
    fn test_unescape_renpy_string_quote_and_backslash() {
        assert_eq!(unescape_renpy_string(r#"She said \"hi\""#), r#"She said "hi""#);
        assert_eq!(unescape_renpy_string(r"path\\to"), r"path\to");
    }

    #[test]
    fn test_unescape_renpy_string_newline_tab() {
        assert_eq!(unescape_renpy_string(r"line1\nline2"), "line1\nline2");
        assert_eq!(unescape_renpy_string(r"a\tb"), "a\tb");
    }

    #[test]
    fn test_unescape_roundtrip_with_escape() {
        let src = r#"He said \"go\" now"#;
        let runtime = unescape_renpy_string(src);
        assert_eq!(runtime, r#"He said "go" now"#);
        assert_eq!(escape_renpy_string(&runtime), r#"He said \"go\" now"#);
    }

    // ── generate_renpy_translation (split ibrido) ───────────────────────

    #[test]
    fn test_generate_splits_dialogue_and_ui() {
        let tmp = TempDir::new().unwrap();
        let game_path = tmp.path().to_str().unwrap().to_string();

        let mut dlg = make_string("Hello there", "Ciao", RenpyStringType::Dialogue);
        dlg.file = "script.rpy".to_string();
        let mut narr = make_string("The sun sets.", "Il sole tramonta.", RenpyStringType::Narration);
        narr.file = "script.rpy".to_string();
        let mut ui = make_string("Start Game", "Inizia partita", RenpyStringType::String);
        ui.file = "screens.rpy".to_string();
        let untr = make_string("Untranslated", "", RenpyStringType::Dialogue);

        let res = generate_renpy_translation(
            game_path.clone(),
            "it".to_string(),
            vec![dlg, narr, ui, untr],
        );
        assert!(res.is_ok(), "generate fallita: {:?}", res);

        let tl = tmp.path().join("game").join("tl").join("it");
        let filter = fs::read_to_string(tl.join("gamestringer_say_filter.rpy")).unwrap();
        let screens = fs::read_to_string(tl.join("screens_it.rpy")).unwrap();

        assert!(filter.contains("config.say_menu_text_filter = __gs_say_filter"));
        assert!(filter.contains("renpy.game.preferences.language == __gs_lang"));
        assert!(filter.contains(r#"u"Hello there": u"Ciao","#));
        assert!(filter.contains(r#"u"The sun sets.": u"Il sole tramonta.","#));
        assert!(!filter.contains("Start Game"));
        assert!(!filter.contains("Untranslated"));

        assert!(screens.contains("translate it strings:"));
        assert!(screens.contains(r#"old "Start Game""#));
        assert!(screens.contains(r#"new "Inizia partita""#));
        assert!(!screens.contains("Hello there"));
    }

    #[test]
    fn test_generate_no_dialogue_skips_filter_file() {
        let tmp = TempDir::new().unwrap();
        let game_path = tmp.path().to_str().unwrap().to_string();

        let mut ui = make_string("Options", "Opzioni", RenpyStringType::String);
        ui.file = "screens.rpy".to_string();

        generate_renpy_translation(game_path.clone(), "it".to_string(), vec![ui]).unwrap();

        let tl = tmp.path().join("game").join("tl").join("it");
        assert!(!tl.join("gamestringer_say_filter.rpy").exists());
        assert!(tl.join("screens_it.rpy").exists());
    }

    #[test]
    fn test_generate_escapes_quotes_in_dialogue_key() {
        let tmp = TempDir::new().unwrap();
        let game_path = tmp.path().to_str().unwrap().to_string();

        let mut dlg = make_string(r#"He said \"go\""#, r#"Disse "vai""#, RenpyStringType::Dialogue);
        dlg.file = "script.rpy".to_string();

        generate_renpy_translation(game_path.clone(), "it".to_string(), vec![dlg]).unwrap();

        let tl = tmp.path().join("game").join("tl").join("it");
        let filter = fs::read_to_string(tl.join("gamestringer_say_filter.rpy")).unwrap();
        assert!(filter.contains(r#"u"He said \"go\"": u"Disse \"vai\"","#));
    }

    // ── attivazione lingua (game/gs_language.rpy) ───────────────────────
    //
    // Prova d'effetto in miniatura: non «il file è stato scritto», ma «il file
    // contiene la riga che accende la lingua». La versione a mano dell'08/08
    // funzionava; questi test servono a non perderla generandola.

    #[test]
    fn test_generate_writes_language_activator_for_monolingual_game() {
        let tmp = TempDir::new().unwrap();
        let game_path = tmp.path().to_str().unwrap().to_string();
        // game/ deve PREESISTERE: è ciò che distingue un gioco Ren'Py da una
        // cartella qualsiasi, e la guardia lo misura prima di creare alcunché.
        fs::create_dir_all(tmp.path().join("game")).unwrap();

        let mut ui = make_string("Start Game", "Inizia partita", RenpyStringType::String);
        ui.file = "screens.rpy".to_string();

        let msg = generate_renpy_translation(game_path, "it".to_string(), vec![ui]).unwrap();

        let act = tmp.path().join("game").join("gs_language.rpy");
        assert!(act.exists(), "gs_language.rpy non scritto: la traduzione resterebbe spenta");
        let body = fs::read_to_string(&act).unwrap();
        assert!(
            body.contains("config.language = \"it\""),
            "manca la riga che attiva davvero la lingua:\n{}",
            body
        );
        assert!(body.contains("init 999 python:"), "priorità init assente:\n{}", body);
        // Il messaggio all'utente deve DIRE che la lingua si attiva da sola,
        // altrimenti Davide continua a scrivere il file a mano per sicurezza.
        assert!(msg.contains("gs_language.rpy"), "messaggio muto sull'attivazione: {}", msg);
    }

    #[test]
    fn test_generate_skips_activator_when_game_has_other_languages() {
        let tmp = TempDir::new().unwrap();
        let game_path = tmp.path().to_str().unwrap().to_string();
        // Il gioco ha già una traduzione giapponese ⇒ ha un menu lingue.
        // Forzare config.language scavalcherebbe PER SEMPRE la scelta del
        // giocatore (lo dice la documentazione Ren'Py): non si tocca.
        fs::create_dir_all(tmp.path().join("game").join("tl").join("japanese")).unwrap();

        let mut ui = make_string("Start Game", "Inizia partita", RenpyStringType::String);
        ui.file = "screens.rpy".to_string();

        generate_renpy_translation(game_path, "it".to_string(), vec![ui]).unwrap();

        assert!(
            !tmp.path().join("game").join("gs_language.rpy").exists(),
            "attivazione forzata su un gioco che ha già un menu lingue"
        );
    }

    #[test]
    fn test_generate_activator_ignores_none_and_common_folders() {
        let tmp = TempDir::new().unwrap();
        let game_path = tmp.path().to_str().unwrap().to_string();
        // tl/None e tl/common ci sono in QUASI OGNI gioco Ren'Py e non sono
        // lingue selezionabili: contarle avrebbe spento l'attivazione ovunque.
        fs::create_dir_all(tmp.path().join("game").join("tl").join("None")).unwrap();
        fs::create_dir_all(tmp.path().join("game").join("tl").join("common")).unwrap();

        let mut ui = make_string("Options", "Opzioni", RenpyStringType::String);
        ui.file = "screens.rpy".to_string();

        generate_renpy_translation(game_path, "it".to_string(), vec![ui]).unwrap();

        assert!(tmp.path().join("game").join("gs_language.rpy").exists());
    }

    #[test]
    fn test_generate_no_activator_when_nothing_was_written() {
        let tmp = TempDir::new().unwrap();
        let game_path = tmp.path().to_str().unwrap().to_string();

        // Nessuna stringa tradotta ⇒ nessun file tl/ ⇒ attivare una lingua
        // vuota cambierebbe le stringhe interne di Ren'Py senza tradurre nulla.
        let untr = make_string("Nothing", "", RenpyStringType::Dialogue);
        generate_renpy_translation(game_path, "it".to_string(), vec![untr]).unwrap();

        assert!(!tmp.path().join("game").join("gs_language.rpy").exists());
    }

    #[test]
    fn test_generate_activator_second_language_on_our_own_monolingual_game() {
        // IL CASO CHE LA PRIMA VERSIONE SBAGLIAVA. Gioco monolingua tradotto
        // prima in italiano da noi, poi in francese: `tl/it` esiste ma è
        // NOSTRA, non è la prova di un menu lingue. Prima l'attivatore veniva
        // saltato e restava quello vecchio con "it" → tl/fr/ completo e
        // irraggiungibile, con l'app che invitava a scegliere FR da un menu
        // inesistente.
        let tmp = TempDir::new().unwrap();
        let game_path = tmp.path().to_str().unwrap().to_string();
        let game_dir = tmp.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();

        let mut ui_it = make_string("Start Game", "Inizia partita", RenpyStringType::String);
        ui_it.file = "screens.rpy".to_string();
        let mut dlg_it = make_string("Hello", "Ciao", RenpyStringType::Dialogue);
        dlg_it.file = "script.rpy".to_string();
        generate_renpy_translation(game_path.clone(), "it".to_string(), vec![ui_it, dlg_it]).unwrap();
        assert!(game_dir.join("gs_language.rpy").exists());

        let mut ui_fr = make_string("Start Game", "Nouvelle partie", RenpyStringType::String);
        ui_fr.file = "screens.rpy".to_string();
        generate_renpy_translation(game_path, "fr".to_string(), vec![ui_fr]).unwrap();

        let body = fs::read_to_string(game_dir.join("gs_language.rpy")).unwrap();
        assert!(
            body.contains("config.language = \"fr\""),
            "l'attivatore è rimasto sulla lingua vecchia:\n{}",
            body
        );
    }

    #[test]
    fn test_generate_no_activator_when_there_was_no_game_dir() {
        // La guardia «non è un gioco Ren'Py» era codice morto: veniva
        // controllata DOPO la create_dir_all che game/ la crea. Qui il
        // percorso è una cartella qualsiasi e l'attivatore non deve nascere.
        let tmp = TempDir::new().unwrap();
        let game_path = tmp.path().to_str().unwrap().to_string();

        let mut ui = make_string("Options", "Opzioni", RenpyStringType::String);
        ui.file = "screens.rpy".to_string();
        generate_renpy_translation(game_path, "it".to_string(), vec![ui]).unwrap();

        assert!(!tmp.path().join("game").join("gs_language.rpy").exists());
    }

    #[test]
    fn test_generate_activator_removes_stale_rpyc() {
        let tmp = TempDir::new().unwrap();
        let game_path = tmp.path().to_str().unwrap().to_string();
        let game_dir = tmp.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();
        // Un .rpyc più recente vince sul .rpy: senza rimozione, il file appena
        // scritto sarebbe l'ennesimo file ignorato dal gioco.
        fs::write(game_dir.join("gs_language.rpyc"), b"stale").unwrap();

        let mut ui = make_string("Options", "Opzioni", RenpyStringType::String);
        ui.file = "screens.rpy".to_string();
        generate_renpy_translation(game_path, "it".to_string(), vec![ui]).unwrap();

        assert!(!game_dir.join("gs_language.rpyc").exists());
        assert!(game_dir.join("gs_language.rpy").exists());
    }

    // ── get_renpy_translation_stats ─────────────────────────────────────

    fn make_string(original: &str, translated: &str, stype: RenpyStringType) -> RenpyString {
        RenpyString {
            id: "test_1".to_string(),
            original: original.to_string(),
            translated: translated.to_string(),
            file: "test.rpy".to_string(),
            line_number: 1,
            string_type: stype,
            character: None,
        }
    }

    #[test]
    fn test_stats_empty() {
        let stats = get_renpy_translation_stats(Vec::new());
        assert_eq!(stats.total, 0);
        assert_eq!(stats.translated, 0);
        assert_eq!(stats.untranslated, 0);
        assert_eq!(stats.percentage, 0);
        assert!(stats.by_type.is_empty());
    }

    #[test]
    fn test_stats_all_translated() {
        let strings = vec![
            make_string("Hello", "Ciao", RenpyStringType::Dialogue),
            make_string("World", "Mondo", RenpyStringType::Narration),
        ];
        let stats = get_renpy_translation_stats(strings);
        assert_eq!(stats.total, 2);
        assert_eq!(stats.translated, 2);
        assert_eq!(stats.untranslated, 0);
        assert_eq!(stats.percentage, 100);
    }

    #[test]
    fn test_stats_none_translated() {
        let strings = vec![
            make_string("Hello", "", RenpyStringType::Dialogue),
            make_string("World", "", RenpyStringType::Menu),
        ];
        let stats = get_renpy_translation_stats(strings);
        assert_eq!(stats.total, 2);
        assert_eq!(stats.translated, 0);
        assert_eq!(stats.untranslated, 2);
        assert_eq!(stats.percentage, 0);
    }

    #[test]
    fn test_stats_partial_translated() {
        let strings = vec![
            make_string("Hello", "Ciao", RenpyStringType::Dialogue),
            make_string("World", "", RenpyStringType::Narration),
            make_string("Yes", "Si", RenpyStringType::Menu),
        ];
        let stats = get_renpy_translation_stats(strings);
        assert_eq!(stats.total, 3);
        assert_eq!(stats.translated, 2);
        assert_eq!(stats.untranslated, 1);
        assert_eq!(stats.percentage, 66); // integer division: 2*100/3 = 66
    }

    #[test]
    fn test_stats_by_type_counts() {
        let strings = vec![
            make_string("a", "", RenpyStringType::Dialogue),
            make_string("b", "", RenpyStringType::Dialogue),
            make_string("c", "", RenpyStringType::Menu),
            make_string("d", "", RenpyStringType::Narration),
            make_string("e", "", RenpyStringType::String),
            make_string("f", "", RenpyStringType::Label),
        ];
        let stats = get_renpy_translation_stats(strings);
        assert_eq!(stats.by_type.get("Dialoghi"), Some(&2));
        assert_eq!(stats.by_type.get("Menu"), Some(&1));
        assert_eq!(stats.by_type.get("Narrazione"), Some(&1));
        assert_eq!(stats.by_type.get("Stringhe"), Some(&1));
        assert_eq!(stats.by_type.get("Label"), Some(&1));
    }

    // ── extract_renpy_strings (file-based) ──────────────────────────────

    fn write_rpy_and_extract(content: &str) -> RenpyExtractionResult {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("test.rpy");
        fs::write(&file_path, content).unwrap();
        extract_renpy_strings(file_path.to_string_lossy().to_string()).unwrap()
    }

    #[test]
    fn test_extract_dialogue_with_character() {
        let result = write_rpy_and_extract(r#"    e "Hello, world!""#);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Hello, world!");
        assert_eq!(result.strings[0].character, Some("e".to_string()));
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Dialogue));
    }

    #[test]
    fn test_extract_narration() {
        let result = write_rpy_and_extract(r#"    "This is narration.""#);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "This is narration.");
        assert_eq!(result.strings[0].character, None);
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Narration));
    }

    #[test]
    fn test_extract_menu_choice() {
        let result = write_rpy_and_extract(r#"        "Go to the park":"#);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Go to the park");
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Menu));
    }

    #[test]
    fn test_extract_skips_comments() {
        let result = write_rpy_and_extract("# This is a comment\n    e \"Hello\"");
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Hello");
    }

    #[test]
    fn test_generate_dedupes_old_strings_globally() {
        // 08/08/2026: `old "Case"` scritto due volte ha ucciso Scarlet Hollow
        // ALL'AVVIO («A translation for "Case" already exists») — Ren'Py vuole
        // un solo old per lingua in tutto tl/<lang>/, anche tra file diversi.
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path().join("game")).unwrap();
        let game_path = tmp.path().to_str().unwrap().to_string();

        // Stesso original due volte nello stesso file E una terza in un altro.
        let mut a = make_string("Case", "Maiusc", RenpyStringType::String);
        a.file = "01virtual_keyboard.rpy".to_string();
        let mut b = make_string("Case", "Maiusc", RenpyStringType::String);
        b.file = "01virtual_keyboard.rpy".to_string();
        let mut c = make_string("Case", "Maiusc", RenpyStringType::String);
        c.file = "screens.rpy".to_string();
        let mut d = make_string("Start", "Inizia", RenpyStringType::String);
        d.file = "screens.rpy".to_string();

        generate_renpy_translation(game_path, "it".to_string(), vec![a, b, c, d]).unwrap();

        let tl = tmp.path().join("game").join("tl").join("it");
        let mut total_case = 0;
        for name in ["01virtual_keyboard_it.rpy", "screens_it.rpy"] {
            let p = tl.join(name);
            if p.exists() {
                total_case += fs::read_to_string(p).unwrap().matches("old \"Case\"").count();
            }
        }
        assert_eq!(total_case, 1, "`old \"Case\"` deve comparire UNA volta in tutta tl/it");
        // La stringa non duplicata sopravvive.
        let screens = fs::read_to_string(tl.join("screens_it.rpy")).unwrap();
        assert!(screens.contains("old \"Start\""));
    }

    #[test]
    fn test_screen_block_survives_blank_lines() {
        // 08/08/2026, misurato su Scarlet Hollow: la riga vuota (indent 0)
        // chiudeva il blocco Screen perché il pop dello stack stava PRIMA del
        // salto vuote/commenti. Da lì `text "..."` diventava Dialogue con
        // speaker "text" e finiva nel filtro say, che il testo delle screen
        // non lo tocca: 2.124 stringhe UI su 2.127 nel canale sbagliato, cioè
        // il menu di OGNI gioco Ren'Py mai tradotto davvero. Questo test è il
        // file screens.rpy minimo che riproduce il caso: se il blocco Screen
        // non sopravvive alla riga vuota, "Load Game" non è String e il test
        // è rosso.
        let content = "screen main_menu():\n    text \"New Game\"\n\n    text \"Load Game\"\n\n    # commento indentato\n    textbutton \"Options\"\n";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 3, "attese 3 stringhe UI: {:?}", result.strings);
        for s in &result.strings {
            assert!(
                matches!(s.string_type, RenpyStringType::String),
                "'{}' doveva essere String, è {:?} (character: {:?})",
                s.original, s.string_type, s.character
            );
            assert_eq!(s.character, None, "il testo di screen non ha parlante");
        }
    }

    #[test]
    fn test_screen_block_still_pops_on_dedent() {
        // Il contrappeso del fix: uscire DAVVERO dal blocco (dedent su codice
        // vero, non su una riga vuota) deve continuare a chiudere lo Screen —
        // il dialogo dopo la screen resta Dialogue, non diventa UI.
        let content = "screen hud():\n    text \"Score\"\nlabel start:\n    e \"Hello\"\n";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 2);
        assert!(matches!(result.strings[0].string_type, RenpyStringType::String));
        assert!(matches!(result.strings[1].string_type, RenpyStringType::Dialogue));
        assert_eq!(result.strings[1].character, Some("e".to_string()));
    }

    #[test]
    fn test_extract_skips_empty_lines() {
        let result = write_rpy_and_extract("\n\n    e \"Hello\"\n\n");
        assert_eq!(result.total_count, 1);
    }

    #[test]
    fn test_extract_skips_define() {
        let result = write_rpy_and_extract("define e = Character(\"Eileen\")");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_label() {
        let result = write_rpy_and_extract("label start:");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_jump() {
        let result = write_rpy_and_extract("jump chapter2");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_call() {
        let result = write_rpy_and_extract("call some_function");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_show_hide_scene() {
        let content = "show eileen happy\nhide eileen\nscene bg room";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_play_stop() {
        let content = "play music \"track.ogg\"\nstop music";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_control_flow() {
        let content = "if flag:\n    e \"Hello\"\nelif other:\n    e \"World\"\nelse:\n    e \"Bye\"";
        let result = write_rpy_and_extract(content);
        // "if ", "elif ", "else:" lines are skipped; the dialogue lines under them are extracted
        assert_eq!(result.total_count, 3);
    }

    #[test]
    fn test_extract_skips_python_and_dollar() {
        let content = "python:\n$ some_var = 1";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_init_with_return() {
        let content = "init python:\nreturn";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_with() {
        let result = write_rpy_and_extract("with dissolve");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_short_strings() {
        // Strings of length 1 are ignored
        let result = write_rpy_and_extract(r#"    e "X""#);
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_keeps_strings_with_backslash() {
        // Strings with escape sequences should NOT be filtered out
        let result = write_rpy_and_extract(r#"    e "Hello\nWorld""#);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, r"Hello\nWorld");
    }

    #[test]
    fn test_extract_empty_file() {
        let result = write_rpy_and_extract("");
        assert_eq!(result.total_count, 0);
        assert!(result.strings.is_empty());
        assert!(result.success);
    }

    #[test]
    fn test_extract_multiple_dialogues() {
        let content = r#"    e "Hello!"
    e "How are you?"
    "This is narration."
    "Choose yes":
    "#;
        let result = write_rpy_and_extract(content);
        // 2 dialogues + 1 narration + 1 menu = 4
        assert_eq!(result.total_count, 4);
    }

    #[test]
    fn test_extract_line_numbers_are_1_based() {
        let content = "# comment\n\n    e \"Hello\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.strings[0].line_number, 3);
    }

    #[test]
    fn test_extract_ids_are_unique() {
        let content = "    e \"Hello\"\n    e \"World\"";
        let result = write_rpy_and_extract(content);
        assert_ne!(result.strings[0].id, result.strings[1].id);
    }

    #[test]
    fn test_extract_ids_use_filename() {
        let result = write_rpy_and_extract(r#"    e "Hello!""#);
        assert!(result.strings[0].id.starts_with("test_rpy_"));
    }

    #[test]
    fn test_extract_nonexistent_file() {
        let result = extract_renpy_strings("/nonexistent/path/to/file.rpy".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_success_flag() {
        let result = write_rpy_and_extract(r#"    e "Hi there""#);
        assert!(result.success);
    }

    #[test]
    fn test_extract_message_contains_count() {
        let result = write_rpy_and_extract(r#"    e "Hi there""#);
        assert!(result.message.contains("1"));
    }

    // ── detect_renpy_game ───────────────────────────────────────────────

    #[test]
    fn test_detect_nonexistent_path() {
        let result = detect_renpy_game("/nonexistent/path".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("non esistente"));
    }

    #[test]
    fn test_detect_no_game_folder() {
        let dir = TempDir::new().unwrap();
        let result = detect_renpy_game(dir.path().to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Ren'Py"));
    }

    #[test]
    fn test_detect_game_folder_but_no_rpy() {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("game")).unwrap();
        let result = detect_renpy_game(dir.path().to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains(".rpy"));
    }

    #[test]
    fn test_detect_valid_game() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();
        fs::write(game_dir.join("script.rpy"), r#"    e "Hello""#).unwrap();

        let result = detect_renpy_game(dir.path().to_string_lossy().to_string());
        assert!(result.is_ok());
        let game = result.unwrap();
        assert_eq!(game.script_files.len(), 1);
        assert_eq!(game.script_files[0].filename, "script.rpy");
        assert!(!game.has_translations);
        assert!(game.available_languages.is_empty());
    }

    #[test]
    fn test_detect_game_with_options() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();
        fs::write(game_dir.join("script.rpy"), r#"    e "Hello""#).unwrap();
        fs::write(
            game_dir.join("options.rpy"),
            "define config.name = \"Test Game\"\ndefine config.version = \"2.0\"",
        ).unwrap();

        let game = detect_renpy_game(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(game.title, "Test Game");
        assert_eq!(game.version, Some("2.0".to_string()));
    }

    #[test]
    fn test_detect_game_with_translations() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        let tl_dir = game_dir.join("tl");
        fs::create_dir_all(tl_dir.join("italian")).unwrap();
        fs::create_dir_all(tl_dir.join("french")).unwrap();
        fs::create_dir_all(tl_dir.join("None")).unwrap(); // should be ignored
        fs::create_dir_all(tl_dir.join("common")).unwrap(); // should be ignored
        fs::write(game_dir.join("script.rpy"), r#"    e "Hello""#).unwrap();

        let game = detect_renpy_game(dir.path().to_string_lossy().to_string()).unwrap();
        assert!(game.has_translations);
        assert_eq!(game.available_languages.len(), 2);
        assert!(game.available_languages.contains(&"italian".to_string()));
        assert!(game.available_languages.contains(&"french".to_string()));
    }

    #[test]
    fn test_detect_game_ignores_tl_rpy_files() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        let tl_dir = game_dir.join("tl").join("italian");
        fs::create_dir_all(&tl_dir).unwrap();
        fs::write(game_dir.join("script.rpy"), r#"    e "Hello""#).unwrap();
        fs::write(tl_dir.join("script_italian.rpy"), r#"old "Hello""#).unwrap();

        let game = detect_renpy_game(dir.path().to_string_lossy().to_string()).unwrap();
        // Only the main script, not the translation file
        assert_eq!(game.script_files.len(), 1);
        assert_eq!(game.script_files[0].filename, "script.rpy");
    }

    #[test]
    fn test_detect_game_with_renpy_folder() {
        // Some games have a "renpy" folder instead/alongside "game"
        let dir = TempDir::new().unwrap();
        let renpy_dir = dir.path().join("renpy");
        fs::create_dir_all(&renpy_dir).unwrap();
        // No game folder, but renpy folder exists - detection should pass the folder check
        // but fail on no .rpy files since find_rpy_files falls back to root
        // Actually it searches in root when no game folder
        fs::write(dir.path().join("script.rpy"), r#"    e "Hello""#).unwrap();

        let game = detect_renpy_game(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(game.script_files.len(), 1);
    }

    // ── find_rpy_files ──────────────────────────────────────────────────

    #[test]
    fn test_find_rpy_files_sorted() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();
        fs::write(game_dir.join("z_script.rpy"), "").unwrap();
        fs::write(game_dir.join("a_script.rpy"), "").unwrap();
        fs::write(game_dir.join("m_script.rpy"), "").unwrap();

        let files = find_rpy_files(&dir.path().to_string_lossy()).unwrap();
        let names: Vec<&str> = files.iter().map(|f| f.filename.as_str()).collect();
        assert_eq!(names, vec!["a_script.rpy", "m_script.rpy", "z_script.rpy"]);
    }

    #[test]
    fn test_find_rpy_files_ignores_non_rpy() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();
        fs::write(game_dir.join("script.rpy"), "").unwrap();
        fs::write(game_dir.join("script.rpyc"), "").unwrap();
        fs::write(game_dir.join("readme.txt"), "").unwrap();

        let files = find_rpy_files(&dir.path().to_string_lossy()).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].filename, "script.rpy");
    }

    // ── save/load round-trip ────────────────────────────────────────────

    #[test]
    fn test_save_and_load_round_trip() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("translations.json");

        let strings = vec![
            make_string("Hello", "Ciao", RenpyStringType::Dialogue),
            make_string("World", "Mondo", RenpyStringType::Narration),
        ];

        let count = save_renpy_translations(
            file_path.to_string_lossy().to_string(),
            strings.clone(),
        ).unwrap();
        assert_eq!(count, 2);

        let loaded = load_renpy_translations(file_path.to_string_lossy().to_string()).unwrap();
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].original, "Hello");
        assert_eq!(loaded[0].translated, "Ciao");
        assert_eq!(loaded[1].original, "World");
        assert_eq!(loaded[1].translated, "Mondo");
    }

    #[test]
    fn test_save_empty_translations() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("empty.json");

        let count = save_renpy_translations(
            file_path.to_string_lossy().to_string(),
            Vec::new(),
        ).unwrap();
        assert_eq!(count, 0);

        let loaded = load_renpy_translations(file_path.to_string_lossy().to_string()).unwrap();
        assert!(loaded.is_empty());
    }

    #[test]
    fn test_load_nonexistent_file() {
        let result = load_renpy_translations("/nonexistent/file.json".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_load_invalid_json() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("bad.json");
        fs::write(&file_path, "not json at all").unwrap();

        let result = load_renpy_translations(file_path.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("parsing JSON"));
    }

    // ── generate_renpy_translation ──────────────────────────────────────

    #[test]
    fn test_generate_translation_creates_files() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();

        let strings = vec![RenpyString {
            id: "test_1".to_string(),
            original: "Hello".to_string(),
            translated: "Ciao".to_string(),
            file: "script.rpy".to_string(),
            line_number: 5,
            string_type: RenpyStringType::String,
            character: None,
        }];

        let result = generate_renpy_translation(
            dir.path().to_string_lossy().to_string(),
            "italian".to_string(),
            strings,
        ).unwrap();

        assert!(result.contains("italian"));

        let tl_file = game_dir.join("tl").join("italian").join("script_italian.rpy");
        assert!(tl_file.exists());

        let content = fs::read_to_string(&tl_file).unwrap();
        assert!(content.contains("old \"Hello\""));
        assert!(content.contains("new \"Ciao\""));
        assert!(content.contains("translate italian strings"));
    }

    #[test]
    fn test_generate_translation_skips_untranslated() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();

        let strings = vec![RenpyString {
            id: "test_1".to_string(),
            original: "Hello".to_string(),
            translated: "".to_string(), // not translated
            file: "script.rpy".to_string(),
            line_number: 5,
            string_type: RenpyStringType::String,
            character: None,
        }];

        generate_renpy_translation(
            dir.path().to_string_lossy().to_string(),
            "italian".to_string(),
            strings,
        ).unwrap();

        // Nessuna stringa tradotta → nessun file di traduzione generato.
        let tl_file = game_dir.join("tl").join("italian").join("script_italian.rpy");
        assert!(!tl_file.exists());
        let filter = game_dir.join("tl").join("italian").join("gamestringer_say_filter.rpy");
        assert!(!filter.exists());
    }

    #[test]
    fn test_generate_translation_escapes_special_chars() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("game");
        fs::create_dir_all(&game_dir).unwrap();

        let strings = vec![RenpyString {
            id: "test_1".to_string(),
            original: "She said \"hello\"".to_string(),
            translated: "Lei disse \"ciao\"".to_string(),
            file: "script.rpy".to_string(),
            line_number: 1,
            string_type: RenpyStringType::String,
            character: None,
        }];

        generate_renpy_translation(
            dir.path().to_string_lossy().to_string(),
            "italian".to_string(),
            strings,
        ).unwrap();

        let tl_file = game_dir.join("tl").join("italian").join("script_italian.rpy");
        let content = fs::read_to_string(&tl_file).unwrap();
        assert!(content.contains(r#"old "She said \"hello\"""#));
        assert!(content.contains(r#"new "Lei disse \"ciao\"""#));
    }

    // ── extract_game_info (via detect) ──────────────────────────────────

    #[test]
    fn test_extract_game_info_no_options_file() {
        let dir = TempDir::new().unwrap();
        let (title, version) = extract_game_info(&dir.path().to_string_lossy());
        // Falls back to folder name
        assert!(!title.is_empty());
        assert!(version.is_none());
    }

    // ── Serialization round-trip for RenpyStringType ────────────────────

    #[test]
    fn test_string_type_serialization() {
        let s = make_string("hi", "ciao", RenpyStringType::Dialogue);
        let json = serde_json::to_string(&s).unwrap();
        let deserialized: RenpyString = serde_json::from_str(&json).unwrap();
        assert!(matches!(deserialized.string_type, RenpyStringType::Dialogue));
    }

    #[test]
    fn test_all_string_types_serialize() {
        let types = vec![
            RenpyStringType::Dialogue,
            RenpyStringType::Menu,
            RenpyStringType::Narration,
            RenpyStringType::String,
            RenpyStringType::Label,
        ];
        for t in types {
            let s = make_string("x", "y", t);
            let json = serde_json::to_string(&s).unwrap();
            let _: RenpyString = serde_json::from_str(&json).unwrap();
        }
    }

    // ── AST-lite parser: new capability tests ──────────────────────────

    #[test]
    fn test_extract_triple_quoted_single_line() {
        let result = write_rpy_and_extract(r#"    e """Hello triple world!""""#);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Hello triple world!");
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Dialogue));
        assert_eq!(result.strings[0].character, Some("e".to_string()));
    }

    #[test]
    fn test_extract_triple_quoted_multiline() {
        let content = "    \"\"\"\n    This is line one.\n    This is line two.\n    \"\"\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains("This is line one."));
        assert!(result.strings[0].original.contains("This is line two."));
    }

    #[test]
    fn test_extract_triple_quoted_narration() {
        let result = write_rpy_and_extract(r#"    """Narration triple text""""#);
        assert_eq!(result.total_count, 1);
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Narration));
        assert_eq!(result.strings[0].character, None);
    }

    #[test]
    fn test_extract_screen_text() {
        let content = "screen settings():\n    text \"Settings\"\n    textbutton \"Save Game\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 2);
        assert_eq!(result.strings[0].original, "Settings");
        assert_eq!(result.strings[1].original, "Save Game");
        assert!(matches!(result.strings[0].string_type, RenpyStringType::String));
    }

    #[test]
    fn test_extract_screen_notify() {
        let content = "screen prefs():\n    textbutton \"Click\" action Notify(\"Saved!\")";
        let result = write_rpy_and_extract(content);
        // Should extract both "Click" and "Saved!"
        assert!(result.total_count >= 2);
        let texts: Vec<&str> = result.strings.iter().map(|s| s.original.as_str()).collect();
        assert!(texts.contains(&"Click"));
        assert!(texts.contains(&"Saved!"));
    }

    #[test]
    fn test_extract_menu_choice_with_colon() {
        let content = "menu:\n        \"Go to the park\":\n        \"Stay home\":";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 2);
        assert_eq!(result.strings[0].original, "Go to the park");
        assert_eq!(result.strings[1].original, "Stay home");
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Menu));
        assert!(matches!(result.strings[1].string_type, RenpyStringType::Menu));
    }

    #[test]
    fn test_extract_escape_sequences_preserved() {
        // Escaped quotes inside dialogue
        let result = write_rpy_and_extract(r#"    e "She said \"hello\" to me""#);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains("\\\"hello\\\""));
    }

    #[test]
    fn test_extract_interpolation_preserved() {
        let result = write_rpy_and_extract(r#"    e "Hello [player_name], welcome!""#);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains("[player_name]"));
    }

    #[test]
    fn test_extract_renpy_tags_preserved() {
        let result = write_rpy_and_extract(r#"    e "{b}Bold{/b} and {i}italic{/i} text""#);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains("{b}"));
        assert!(result.strings[0].original.contains("{/b}"));
        assert!(result.strings[0].original.contains("{i}"));
    }

    #[test]
    fn test_extract_color_tags_preserved() {
        let result = write_rpy_and_extract(r#"    e "{color=#ff0000}Red text{/color}""#);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains("{color=#ff0000}"));
    }

    #[test]
    fn test_extract_translate_block() {
        let content = "translate spanish start_abc:\n    \"Translated narration text here\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Translated narration text here");
    }

    #[test]
    fn test_extract_skips_python_block() {
        // 08/08/2026: il fixture originale metteva il dialogo "dopo" il blocco
        // ALLA STESSA INDENTAZIONE del corpo python — per Ren'Py è ancora
        // dentro il blocco, e il test passava solo grazie al bug della riga
        // vuota che chiudeva lo stack (lo stesso che spegneva i menu, vedi
        // test_screen_block_survives_blank_lines). Fixture che validava il
        // difetto, non il comportamento: ora il dialogo esce col DEDENT, come
        // in un .rpy vero.
        let content = "python:\n    x = \"not extractable\"\n    y = 42\n\ne \"After python\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "After python");
    }

    #[test]
    fn test_extract_skips_init_python_block() {
        // Stesso fixture-che-validava-il-bug del test sopra: dedent vero.
        let content = "init python:\n    config.foo = \"bar\"\n\ne \"After init python\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "After init python");
    }

    #[test]
    fn test_extract_skips_transform_keyword() {
        let result = write_rpy_and_extract("transform my_transform:");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_skips_style_keyword() {
        let result = write_rpy_and_extract("style my_style:");
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_extract_indentation_tracking() {
        // Label keyword itself is skipped, but dialogue inside is extracted
        let content = "label start:\n    e \"Inside label\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Inside label");
    }

    #[test]
    fn test_extract_screen_label_text() {
        let content = "screen info():\n    label \"Important Notice\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].original, "Important Notice");
    }

    #[test]
    fn test_extract_newline_escape_in_dialogue() {
        let result = write_rpy_and_extract(r#"    e "Line one\nLine two""#);
        assert_eq!(result.total_count, 1);
        assert!(result.strings[0].original.contains(r"\n"));
    }

    #[test]
    fn test_extract_triple_quoted_with_character() {
        let content = "    narrator \"\"\"A long speech\nthat spans lines.\"\"\"";
        let result = write_rpy_and_extract(content);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.strings[0].character, Some("narrator".to_string()));
        assert!(matches!(result.strings[0].string_type, RenpyStringType::Dialogue));
    }
}
