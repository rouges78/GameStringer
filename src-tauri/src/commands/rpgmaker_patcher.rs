// RPG Maker Patcher
// Supporto per RPG Maker XP, VX, VX Ace, MV, MZ

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;

use crate::commands::encoding_utils;

// ============================================================================
// STRUTTURE DATI
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RpgMakerVersion {
    XP,      // .rxdata (Ruby Marshal)
    VX,      // .rvdata (Ruby Marshal)
    VXAce,   // .rvdata2 (Ruby Marshal)
    MV,      // .json
    MZ,      // .json
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpgMakerGame {
    pub path: String,
    pub version: RpgMakerVersion,
    pub title: String,
    pub data_files: Vec<RpgMakerDataFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpgMakerDataFile {
    pub path: String,
    pub filename: String,
    pub file_type: RpgMakerFileType,
    pub size: u64,
    pub string_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RpgMakerFileType {
    Actors,
    Armors,
    Classes,
    CommonEvents,
    Enemies,
    Items,
    Map,
    Skills,
    States,
    System,
    Troops,
    Weapons,
    Plugins,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpgMakerString {
    pub id: String,
    pub original: String,
    pub translated: String,
    pub context: String,
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionResult {
    pub success: bool,
    pub message: String,
    pub strings: Vec<RpgMakerString>,
    pub total_count: u32,
}

// ============================================================================
// RILEVAMENTO GIOCO
// ============================================================================

/// Rileva se una cartella contiene un gioco RPG Maker
#[command]
pub fn detect_rpgmaker_game(game_path: String) -> Result<RpgMakerGame, String> {
    let path = Path::new(&game_path);
    
    if !path.exists() {
        return Err("Percorso non esistente".to_string());
    }
    
    // Rileva versione
    let version = detect_rpgmaker_version(&game_path);
    
    if matches!(version, RpgMakerVersion::Unknown) {
        return Err("Non sembra essere un gioco RPG Maker".to_string());
    }
    
    // Trova file dati
    let data_files = find_data_files(&game_path, &version)?;
    
    // Estrai titolo
    let title = extract_game_title(&game_path, &version);
    
    log::info!("🎮 Rilevato RPG Maker {:?}: {} ({} file dati)", version, title, data_files.len());
    
    Ok(RpgMakerGame {
        path: game_path,
        version,
        title,
        data_files,
    })
}

/// Rileva la versione di RPG Maker
fn detect_rpgmaker_version(game_path: &str) -> RpgMakerVersion {
    let path = Path::new(game_path);
    
    // MV/MZ: hanno www/data/ con file .json
    let mv_data = path.join("www").join("data");
    let mz_data = path.join("data");
    
    if mv_data.exists() && mv_data.join("System.json").exists() {
        // Controlla se è MZ (ha effetti particolari)
        let plugins = mv_data.join("..").join("js").join("plugins.js");
        if plugins.exists() {
            if let Ok(content) = fs::read_to_string(&plugins) {
                if content.contains("VisuMZ") || content.contains("MZ") {
                    return RpgMakerVersion::MZ;
                }
            }
        }
        return RpgMakerVersion::MV;
    }
    
    if mz_data.exists() && mz_data.join("System.json").exists() {
        return RpgMakerVersion::MZ;
    }
    
    // VX Ace: Data/*.rvdata2
    let data_folder = path.join("Data");
    if data_folder.exists() {
        if data_folder.join("System.rvdata2").exists() {
            return RpgMakerVersion::VXAce;
        }
        if data_folder.join("System.rvdata").exists() {
            return RpgMakerVersion::VX;
        }
        if data_folder.join("System.rxdata").exists() {
            return RpgMakerVersion::XP;
        }
    }
    
    RpgMakerVersion::Unknown
}

/// Trova tutti i file dati del gioco
fn find_data_files(game_path: &str, version: &RpgMakerVersion) -> Result<Vec<RpgMakerDataFile>, String> {
    let path = Path::new(game_path);
    let mut files = Vec::new();
    
    let (data_folder, extension) = match version {
        RpgMakerVersion::MV => (path.join("www").join("data"), "json"),
        RpgMakerVersion::MZ => {
            let mz_path = path.join("data");
            if mz_path.exists() {
                (mz_path, "json")
            } else {
                (path.join("www").join("data"), "json")
            }
        }
        RpgMakerVersion::VXAce => (path.join("Data"), "rvdata2"),
        RpgMakerVersion::VX => (path.join("Data"), "rvdata"),
        RpgMakerVersion::XP => (path.join("Data"), "rxdata"),
        RpgMakerVersion::Unknown => return Err("Versione non supportata".to_string()),
    };
    
    if !data_folder.exists() {
        return Err(format!("Cartella dati non trovata: {:?}", data_folder));
    }
    
    for entry in fs::read_dir(&data_folder).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_path = entry.path();
        
        if file_path.is_file() {
            if let Some(ext) = file_path.extension() {
                if ext.to_string_lossy().to_lowercase() == extension {
                    let filename = file_path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();
                    
                    let file_type = classify_rpgmaker_file(&filename);
                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    
                    files.push(RpgMakerDataFile {
                        path: file_path.to_string_lossy().to_string(),
                        filename,
                        file_type,
                        size,
                        string_count: None,
                    });
                }
            }
        }
    }
    
    files.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(files)
}

/// Classifica il tipo di file RPG Maker
fn classify_rpgmaker_file(filename: &str) -> RpgMakerFileType {
    let name_lower = filename.to_lowercase();
    
    if name_lower.contains("actor") { return RpgMakerFileType::Actors; }
    if name_lower.contains("armor") { return RpgMakerFileType::Armors; }
    if name_lower.contains("class") { return RpgMakerFileType::Classes; }
    if name_lower.contains("commonevent") { return RpgMakerFileType::CommonEvents; }
    if name_lower.contains("enem") { return RpgMakerFileType::Enemies; }
    if name_lower.contains("item") { return RpgMakerFileType::Items; }
    if name_lower.starts_with("map") { return RpgMakerFileType::Map; }
    if name_lower.contains("skill") { return RpgMakerFileType::Skills; }
    if name_lower.contains("state") { return RpgMakerFileType::States; }
    if name_lower.contains("system") { return RpgMakerFileType::System; }
    if name_lower.contains("troop") { return RpgMakerFileType::Troops; }
    if name_lower.contains("weapon") { return RpgMakerFileType::Weapons; }
    if name_lower.contains("plugin") { return RpgMakerFileType::Plugins; }
    
    RpgMakerFileType::Other
}

/// Estrai titolo del gioco
fn extract_game_title(game_path: &str, _version: &RpgMakerVersion) -> String {
    let path = Path::new(game_path);
    
    // Prova a leggere da System.json (MV/MZ)
    let system_paths = [
        path.join("www").join("data").join("System.json"),
        path.join("data").join("System.json"),
    ];
    
    for system_path in &system_paths {
        if system_path.exists() {
            if let Ok(content) = fs::read_to_string(system_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(title) = json.get("gameTitle").and_then(|t| t.as_str()) {
                        return title.to_string();
                    }
                }
            }
        }
    }
    
    // Fallback: nome cartella
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("RPG Maker Game")
        .to_string()
}

// ============================================================================
// RUBY MARSHAL PARSER (XP / VX / VX Ace)
// ============================================================================
// Formato: Marshal.dump version 4.8
// Riferimento: https://docs.ruby-lang.org/en/3.2/marshal_rdoc.html

/// Estrae tutte le stringhe da un file Ruby Marshal (.rxdata/.rvdata/.rvdata2)
fn extract_strings_from_marshal(data: &[u8]) -> Result<Vec<RpgMakerString>, String> {
    if data.len() < 2 {
        return Err("File Marshal troppo piccolo".to_string());
    }
    // Version check: Marshal 4.8
    if data[0] != 4 || data[1] != 8 {
        return Err(format!("Versione Marshal non supportata: {}.{}", data[0], data[1]));
    }

    let mut strings = Vec::new();
    let mut parser = MarshalParser::new(&data[2..]);
    parser.extract_all_strings(&mut strings);

    Ok(strings)
}

/// Parser per il formato Ruby Marshal
struct MarshalParser<'a> {
    data: &'a [u8],
    pos: usize,
    symbols: Vec<String>,    // symbol cache (per '@' references)
    objects: Vec<usize>,     // object cache positions (per ';' references)
    string_counter: u32,
    context_stack: Vec<String>,
}

impl<'a> MarshalParser<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self {
            data,
            pos: 0,
            symbols: Vec::new(),
            objects: Vec::new(),
            string_counter: 0,
            context_stack: Vec::new(),
        }
    }

    fn remaining(&self) -> usize {
        self.data.len().saturating_sub(self.pos)
    }

    fn read_byte(&mut self) -> Option<u8> {
        if self.pos < self.data.len() {
            let b = self.data[self.pos];
            self.pos += 1;
            Some(b)
        } else {
            None
        }
    }

    /// Read a Marshal "long" (packed integer)
    fn read_marshal_long(&mut self) -> Option<i32> {
        let b = self.read_byte()? as i8;
        if b == 0 {
            return Some(0);
        }
        if b > 0 && b <= 4 {
            // Positive: b bytes, little-endian
            let count = b as usize;
            let mut result = 0i32;
            for i in 0..count {
                let byte = self.read_byte()? as i32;
                result |= byte << (i * 8);
            }
            return Some(result);
        }
        if b >= -4 && b < 0 {
            // Negative: |b| bytes, little-endian, sign-extended
            let count = (-b) as usize;
            let mut result = -1i32; // start with all 1s for sign extension
            for i in 0..count {
                let byte = self.read_byte()? as i32;
                result &= !(0xFF << (i * 8));
                result |= byte << (i * 8);
            }
            return Some(result);
        }
        // Short form: value = b + (if b > 0 then -5 else 5)
        if b > 4 {
            Some(b as i32 - 5)
        } else {
            Some(b as i32 + 5)
        }
    }

    /// Read raw bytes of given length
    fn read_bytes(&mut self, len: usize) -> Option<Vec<u8>> {
        if self.pos + len > self.data.len() {
            return None;
        }
        let bytes = self.data[self.pos..self.pos + len].to_vec();
        self.pos += len;
        Some(bytes)
    }

    /// Read a Marshal string (length-prefixed bytes).
    /// Uses encoding_utils::auto_decode for proper Shift-JIS support
    /// (RPG Maker XP/VX/VXAce games are often Japanese).
    fn read_raw_string(&mut self) -> Option<String> {
        let len = self.read_marshal_long()? as usize;
        if len > self.remaining() {
            return None;
        }
        let bytes = self.read_bytes(len)?;
        let (decoded, _enc) = encoding_utils::auto_decode(&bytes);
        Some(decoded)
    }

    /// Read a symbol
    fn read_symbol(&mut self) -> Option<String> {
        let len = self.read_marshal_long()? as usize;
        if len > self.remaining() {
            return None;
        }
        let bytes = self.read_bytes(len)?;
        let sym = String::from_utf8_lossy(&bytes).to_string();
        self.symbols.push(sym.clone());
        Some(sym)
    }

    /// Read a symbol reference
    fn read_symlink(&mut self) -> Option<String> {
        let idx = self.read_marshal_long()? as usize;
        self.symbols.get(idx).cloned()
    }

    /// Current context as string
    fn context(&self) -> String {
        self.context_stack.join(".")
    }

    /// Check if a string looks like translatable game text
    fn is_translatable_string(s: &str) -> bool {
        let trimmed = s.trim();
        if trimmed.len() < 2 {
            return false;
        }
        // Skip strings that look like code, paths, or identifiers
        if trimmed.starts_with("img/") || trimmed.starts_with("audio/")
            || trimmed.starts_with("Graphics/") || trimmed.starts_with("Audio/")
            || trimmed.starts_with("Data/")
            || trimmed.ends_with(".png") || trimmed.ends_with(".ogg")
            || trimmed.ends_with(".wav") || trimmed.ends_with(".mp3")
            || trimmed.ends_with(".rxdata") || trimmed.ends_with(".rvdata")
            || trimmed.ends_with(".rvdata2")
        {
            return false;
        }
        // Skip pure numbers
        if trimmed.parse::<f64>().is_ok() {
            return false;
        }
        // Skip color/hex codes
        if trimmed.starts_with('#') && trimmed.len() <= 9 {
            return false;
        }
        // Skip very short single-char identifiers
        if trimmed.len() == 1 && !trimmed.chars().next().unwrap().is_alphabetic() {
            return false;
        }
        // Must contain at least one alphabetic character
        trimmed.chars().any(|c| c.is_alphabetic())
    }

    /// Extract all strings by walking the Marshal structure
    fn extract_all_strings(&mut self, strings: &mut Vec<RpgMakerString>) {
        self.walk_value(strings);
    }

    /// Walk a single Marshal value, collecting strings
    fn walk_value(&mut self, strings: &mut Vec<RpgMakerString>) {
        let type_byte = match self.read_byte() {
            Some(b) => b,
            None => return,
        };

        match type_byte {
            b'0' => {} // nil
            b'T' => {} // true
            b'F' => {} // false
            b'i' => { // Fixnum
                let _ = self.read_marshal_long();
            }
            b'f' => { // Float
                let _ = self.read_raw_string();
            }
            b'"' => { // String
                self.objects.push(self.pos);
                if let Some(s) = self.read_raw_string() {
                    if Self::is_translatable_string(&s) {
                        self.string_counter += 1;
                        strings.push(RpgMakerString {
                            id: format!("marshal_{:05}", self.string_counter),
                            original: s,
                            translated: String::new(),
                            context: self.context(),
                            file: String::new(), // filled by caller
                        });
                    }
                }
            }
            b':' => { // Symbol
                let _ = self.read_symbol();
            }
            b';' => { // Symbol reference
                let _ = self.read_symlink();
            }
            b'[' => { // Array
                self.objects.push(self.pos);
                if let Some(len) = self.read_marshal_long() {
                    for i in 0..len {
                        self.context_stack.push(format!("[{}]", i));
                        self.walk_value(strings);
                        self.context_stack.pop();
                    }
                }
            }
            b'{' => { // Hash
                self.objects.push(self.pos);
                if let Some(len) = self.read_marshal_long() {
                    for _ in 0..len {
                        // Key
                        let key_name = self.peek_string_value();
                        self.walk_value(strings); // walk key (don't collect)
                        // Value
                        let ctx = key_name.unwrap_or_else(|| "?".to_string());
                        self.context_stack.push(ctx);
                        self.walk_value(strings);
                        self.context_stack.pop();
                    }
                }
            }
            b'o' => { // Object
                self.objects.push(self.pos);
                // Class name (symbol or symlink)
                let class_name = match self.read_byte() {
                    Some(b':') => self.read_symbol().unwrap_or_default(),
                    Some(b';') => self.read_symlink().unwrap_or_default(),
                    _ => String::new(),
                };
                self.context_stack.push(class_name);
                if let Some(num_ivars) = self.read_marshal_long() {
                    for _ in 0..num_ivars {
                        // ivar name (symbol)
                        let ivar_name = match self.read_byte() {
                            Some(b':') => self.read_symbol().unwrap_or_default(),
                            Some(b';') => self.read_symlink().unwrap_or_default(),
                            _ => String::new(),
                        };
                        self.context_stack.push(ivar_name);
                        self.walk_value(strings);
                        self.context_stack.pop();
                    }
                }
                self.context_stack.pop();
            }
            b'I' => { // Instance variables (wraps another value, usually String)
                self.walk_value(strings);
                // Read instance variables (e.g., encoding for strings)
                if let Some(num_ivars) = self.read_marshal_long() {
                    for _ in 0..num_ivars {
                        // ivar name
                        match self.read_byte() {
                            Some(b':') => { let _ = self.read_symbol(); }
                            Some(b';') => { let _ = self.read_symlink(); }
                            _ => {}
                        }
                        // ivar value
                        self.walk_value(strings);
                    }
                }
            }
            b'@' => { // Object reference
                let _ = self.read_marshal_long();
            }
            b'l' => { // Bignum
                let sign = self.read_byte();
                if sign.is_some() {
                    if let Some(len) = self.read_marshal_long() {
                        let byte_count = (len as usize) * 2;
                        let _ = self.read_bytes(byte_count);
                    }
                }
            }
            b'/' => { // Regexp
                self.objects.push(self.pos);
                let _ = self.read_raw_string();
                let _ = self.read_byte(); // flags
            }
            b'c' | b'm' => { // Class / Module
                let _ = self.read_raw_string();
            }
            b'S' => { // Struct
                self.objects.push(self.pos);
                // Class name
                match self.read_byte() {
                    Some(b':') => { let _ = self.read_symbol(); }
                    Some(b';') => { let _ = self.read_symlink(); }
                    _ => {}
                }
                if let Some(num_members) = self.read_marshal_long() {
                    for _ in 0..num_members {
                        // member name
                        match self.read_byte() {
                            Some(b':') => { let _ = self.read_symbol(); }
                            Some(b';') => { let _ = self.read_symlink(); }
                            _ => {}
                        }
                        self.walk_value(strings);
                    }
                }
            }
            b'u' => { // User-defined (custom _dump)
                self.objects.push(self.pos);
                match self.read_byte() {
                    Some(b':') => { let _ = self.read_symbol(); }
                    Some(b';') => { let _ = self.read_symlink(); }
                    _ => {}
                }
                let _ = self.read_raw_string();
            }
            b'U' => { // User-marshal
                self.objects.push(self.pos);
                match self.read_byte() {
                    Some(b':') => { let _ = self.read_symbol(); }
                    Some(b';') => { let _ = self.read_symlink(); }
                    _ => {}
                }
                self.walk_value(strings);
            }
            b'e' => { // Extended (module extension)
                match self.read_byte() {
                    Some(b':') => { let _ = self.read_symbol(); }
                    Some(b';') => { let _ = self.read_symlink(); }
                    _ => {}
                }
                self.walk_value(strings);
            }
            b'C' => { // User class (subclass of core type)
                self.objects.push(self.pos);
                match self.read_byte() {
                    Some(b':') => { let _ = self.read_symbol(); }
                    Some(b';') => { let _ = self.read_symlink(); }
                    _ => {}
                }
                self.walk_value(strings);
            }
            _ => {
                // Unknown type — stop parsing this branch
            }
        }
    }

    /// Peek at the next value if it's a string (for hash key context)
    fn peek_string_value(&self) -> Option<String> {
        let mut pos = self.pos;
        if pos >= self.data.len() {
            return None;
        }
        let type_byte = self.data[pos];
        pos += 1;

        match type_byte {
            b'"' | b':' => {
                // String or Symbol — read length + bytes
                if pos >= self.data.len() { return None; }
                let b = self.data[pos] as i8;
                pos += 1;
                let len = if b == 0 { 0 }
                    else if b > 0 && b <= 4 {
                        let mut v = 0usize;
                        for i in 0..b as usize {
                            if pos + i >= self.data.len() { return None; }
                            v |= (self.data[pos + i] as usize) << (i * 8);
                        }
                        pos += b as usize;
                        v
                    }
                    else if b > 4 { (b as i32 - 5) as usize }
                    else { return None; };
                if pos + len > self.data.len() { return None; }
                let (decoded, _enc) = encoding_utils::auto_decode(&self.data[pos..pos + len]);
                Some(decoded)
            }
            b';' => {
                // Symlink — reference by index
                if pos >= self.data.len() { return None; }
                let b = self.data[pos] as i8;
                let idx = if b > 4 { (b as i32 - 5) as usize } else { return None; };
                self.symbols.get(idx).cloned()
            }
            b'I' => {
                // IVar wrapper — peek inside
                if pos >= self.data.len() { return None; }
                // Recurse once (the inner value)
                let inner_type = self.data[pos];
                if inner_type == b'"' {
                    pos += 1;
                    if pos >= self.data.len() { return None; }
                    let b = self.data[pos] as i8;
                    pos += 1;
                    let len = if b == 0 { 0 }
                        else if b > 0 && b <= 4 {
                            let mut v = 0usize;
                            for i in 0..b as usize {
                                if pos + i >= self.data.len() { return None; }
                                v |= (self.data[pos + i] as usize) << (i * 8);
                            }
                            pos += b as usize;
                            v
                        }
                        else if b > 4 { (b as i32 - 5) as usize }
                        else { return None; };
                    if pos + len > self.data.len() { return None; }
                    let (decoded, _enc) = encoding_utils::auto_decode(&self.data[pos..pos + len]);
                    Some(decoded)
                } else {
                    None
                }
            }
            _ => None,
        }
    }
}

// ============================================================================
// ESTRAZIONE STRINGHE (MV/MZ - JSON)
// ============================================================================

/// Estrai stringhe da un file JSON di RPG Maker MV/MZ
#[command]
pub fn extract_rpgmaker_strings(file_path: String) -> Result<ExtractionResult, String> {
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err("File non trovato".to_string());
    }
    
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let mut strings = Vec::new();
    let mut id_counter = 0u32;
    
    // Estrai stringhe ricorsivamente
    extract_strings_recursive(&json, &filename, "", &mut strings, &mut id_counter);
    
    let total_count = strings.len() as u32;
    
    log::info!("📝 Estratte {} stringhe da {}", total_count, filename);
    
    Ok(ExtractionResult {
        success: true,
        message: format!("Estratte {} stringhe", total_count),
        strings,
        total_count,
    })
}

/// Estrai stringhe ricorsivamente da JSON
fn extract_strings_recursive(
    value: &serde_json::Value,
    file: &str,
    path: &str,
    strings: &mut Vec<RpgMakerString>,
    counter: &mut u32,
) {
    match value {
        serde_json::Value::String(s) => {
            // Filtra stringhe vuote e troppo corte
            let trimmed = s.trim();
            if !trimmed.is_empty() && trimmed.len() > 1 {
                // Ignora stringhe che sembrano essere path o codice
                if !trimmed.starts_with("img/")
                    && !trimmed.starts_with("audio/")
                    && !trimmed.starts_with("Graphics/")
                    && !trimmed.starts_with("Audio/")
                    && !trimmed.contains(".png")
                    && !trimmed.contains(".ogg")
                    && !trimmed.contains(".wav")
                    && !trimmed.contains(".mp3")
                {
                    // Note: \V[n], \N[n], \C[n] etc. are RPG Maker control codes
                    // inside dialogue text — they MUST be preserved, not filtered
                    *counter += 1;
                    strings.push(RpgMakerString {
                        id: format!("{}_{}", file.replace('.', "_"), counter),
                        original: s.clone(),
                        translated: String::new(),
                        context: path.to_string(),
                        file: file.to_string(),
                    });
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for (i, item) in arr.iter().enumerate() {
                let new_path = format!("{}[{}]", path, i);
                extract_strings_recursive(item, file, &new_path, strings, counter);
            }
        }
        serde_json::Value::Object(obj) => {
            for (key, val) in obj {
                // Focus su campi che contengono testo traducibile
                if is_translatable_field(key) {
                    let new_path = if path.is_empty() {
                        key.clone()
                    } else {
                        format!("{}.{}", path, key)
                    };
                    extract_strings_recursive(val, file, &new_path, strings, counter);
                }
            }
        }
        _ => {}
    }
}

/// Determina se un campo JSON contiene testo traducibile
fn is_translatable_field(field: &str) -> bool {
    let translatable_fields = [
        // Core fields
        "name", "nickname", "description", "message1", "message2",
        "message3", "message4", "note", "profile", "text",
        "title", "terms", "messages", "parameters", "list",
        "pages", "gameTitle", "currencyUnit",
        // Dialogue & events
        "dialogue", "dialogues", "choices", "label",
        // Battle
        "battlelog", "battlemessage",
        // UI terms
        "basic", "commands", "params",
        // Items/skills (nested)
        "events", "moveRoute",
    ];

    let lower = field.to_lowercase();
    translatable_fields.iter().any(|f| lower.contains(&f.to_lowercase()))
}

/// Estrai tutte le stringhe da un gioco RPG Maker
#[command]
pub fn extract_all_rpgmaker_strings(game_path: String) -> Result<ExtractionResult, String> {
    let game = detect_rpgmaker_game(game_path)?;
    
    let mut all_strings = Vec::new();
    
    for data_file in &game.data_files {
        if data_file.path.ends_with(".json") {
            // MV/MZ: JSON parsing
            match extract_rpgmaker_strings(data_file.path.clone()) {
                Ok(result) => {
                    all_strings.extend(result.strings);
                }
                Err(e) => {
                    log::warn!("⚠️ Errore estrazione {}: {}", data_file.filename, e);
                }
            }
        } else if data_file.path.ends_with(".rxdata")
            || data_file.path.ends_with(".rvdata")
            || data_file.path.ends_with(".rvdata2")
        {
            // XP/VX/VXAce: Ruby Marshal parsing
            match fs::read(&data_file.path) {
                Ok(raw_data) => {
                    match extract_strings_from_marshal(&raw_data) {
                        Ok(mut marshal_strings) => {
                            // Set the file field on each string
                            for s in &mut marshal_strings {
                                s.file = data_file.filename.clone();
                            }
                            log::info!("📝 Estratte {} stringhe Marshal da {}", marshal_strings.len(), data_file.filename);
                            all_strings.extend(marshal_strings);
                        }
                        Err(e) => {
                            log::warn!("⚠️ Errore parsing Marshal {}: {}", data_file.filename, e);
                        }
                    }
                }
                Err(e) => {
                    log::warn!("⚠️ Errore lettura {}: {}", data_file.filename, e);
                }
            }
        }
    }
    
    let total_count = all_strings.len() as u32;
    
    log::info!("📝 Totale: {} stringhe estratte dal gioco", total_count);
    
    Ok(ExtractionResult {
        success: true,
        message: format!("Estratte {} stringhe totali", total_count),
        strings: all_strings,
        total_count,
    })
}

// ============================================================================
// SALVATAGGIO/CARICAMENTO TRADUZIONI
// ============================================================================

/// Salva le traduzioni in un file JSON
#[command]
pub fn save_rpgmaker_translations(
    output_path: String,
    strings: Vec<RpgMakerString>,
) -> Result<u32, String> {
    let json = serde_json::to_string_pretty(&strings)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&output_path, json)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    let count = strings.len() as u32;
    log::info!("💾 Salvate {} traduzioni in {}", count, output_path);
    
    Ok(count)
}

/// Carica traduzioni da file JSON
#[command]
pub fn load_rpgmaker_translations(input_path: String) -> Result<Vec<RpgMakerString>, String> {
    let content = fs::read_to_string(&input_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let strings: Vec<RpgMakerString> = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    log::info!("📂 Caricate {} traduzioni da {}", strings.len(), input_path);
    
    Ok(strings)
}

/// Applica traduzioni a un file JSON di RPG Maker
#[command]
pub fn apply_rpgmaker_translations(
    file_path: String,
    translations: HashMap<String, String>,
    output_path: String,
) -> Result<u32, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    let mut applied = 0u32;
    apply_translations_recursive(&mut json, &translations, &mut applied);
    
    let output = serde_json::to_string_pretty(&json)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&output_path, output)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    log::info!("✅ Applicate {} traduzioni a {}", applied, output_path);
    
    Ok(applied)
}

/// Applica traduzioni ricorsivamente
fn apply_translations_recursive(
    value: &mut serde_json::Value,
    translations: &HashMap<String, String>,
    applied: &mut u32,
) {
    match value {
        serde_json::Value::String(s) => {
            if let Some(translated) = translations.get(s.as_str()) {
                if !translated.is_empty() {
                    *s = translated.clone();
                    *applied += 1;
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                apply_translations_recursive(item, translations, applied);
            }
        }
        serde_json::Value::Object(obj) => {
            for (_, val) in obj {
                apply_translations_recursive(val, translations, applied);
            }
        }
        _ => {}
    }
}

// ============================================================================
// STATISTICHE
// ============================================================================

/// Ottieni statistiche sulle traduzioni
#[command]
pub fn get_rpgmaker_translation_stats(strings: Vec<RpgMakerString>) -> RpgMakerStats {
    let total = strings.len();
    let translated = strings.iter().filter(|s| !s.translated.is_empty()).count();
    let untranslated = total - translated;
    let percentage = if total > 0 { (translated * 100) / total } else { 0 };
    
    // Conta per file
    let mut by_file: HashMap<String, (usize, usize)> = HashMap::new();
    for s in &strings {
        let entry = by_file.entry(s.file.clone()).or_insert((0, 0));
        entry.0 += 1;
        if !s.translated.is_empty() {
            entry.1 += 1;
        }
    }
    
    RpgMakerStats {
        total,
        translated,
        untranslated,
        percentage,
        by_file: by_file.into_iter()
            .map(|(file, (total, translated))| FileStats { file, total, translated })
            .collect(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpgMakerStats {
    pub total: usize,
    pub translated: usize,
    pub untranslated: usize,
    pub percentage: usize,
    pub by_file: Vec<FileStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStats {
    pub file: String,
    pub total: usize,
    pub translated: usize,
}

// ============================================================================
// INTEGRAZIONE TRANSLATOR++
// ============================================================================

/// Verifica se Translator++ è installato
#[command]
pub fn is_translator_plus_available() -> bool {
    let possible_paths = [
        PathBuf::from(r"C:\Program Files\Translator++\Translator++.exe"),
        PathBuf::from(r"C:\Program Files (x86)\Translator++\Translator++.exe"),
        dirs::data_local_dir()
            .map(|p| p.join("Programs").join("Translator++").join("Translator++.exe"))
            .unwrap_or_default(),
    ];
    
    possible_paths.iter().any(|p| p.exists())
}

/// Info su Translator++
#[command]
pub fn get_translator_plus_info() -> TranslatorPlusInfo {
    TranslatorPlusInfo {
        available: is_translator_plus_available(),
        download_url: "https://dreamsavior.net/translator-plusplus/".to_string(),
        description: "Tool avanzato per tradurre giochi RPG Maker, Wolf RPG, ecc.".to_string(),
        supported_engines: vec![
            "RPG Maker XP".to_string(),
            "RPG Maker VX".to_string(),
            "RPG Maker VX Ace".to_string(),
            "RPG Maker MV".to_string(),
            "RPG Maker MZ".to_string(),
            "Wolf RPG Editor".to_string(),
        ],
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslatorPlusInfo {
    pub available: bool,
    pub download_url: String,
    pub description: String,
    pub supported_engines: Vec<String>,
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ─────────────────────────────────────────────────────────────
    // Helper: build a minimal Ruby Marshal blob
    // ─────────────────────────────────────────────────────────────

    /// Build Marshal header (version 4.8)
    fn marshal_header() -> Vec<u8> {
        vec![4, 8]
    }

    /// Encode a Marshal "long" (packed integer)
    fn marshal_long(v: i32) -> Vec<u8> {
        if v == 0 {
            return vec![0];
        }
        if v > 0 && v < 123 {
            return vec![(v + 5) as u8];
        }
        if v < 0 && v > -124 {
            return vec![(v - 5) as u8];
        }
        // Multi-byte encoding
        if v > 0 {
            let bytes = v.to_le_bytes();
            let count = if v <= 0xFF { 1 }
                else if v <= 0xFFFF { 2 }
                else if v <= 0xFFFFFF { 3 }
                else { 4 };
            let mut result = vec![count as u8];
            result.extend_from_slice(&bytes[..count]);
            result
        } else {
            let bytes = v.to_le_bytes();
            let abs = v.wrapping_neg();
            let count = if abs <= 0xFF { 1 }
                else if abs <= 0xFFFF { 2 }
                else if abs <= 0xFFFFFF { 3 }
                else { 4 };
            let mut result = vec![-(count as i8) as u8];
            result.extend_from_slice(&bytes[..count as usize]);
            result
        }
    }

    /// Build a Marshal string (type '"' + length + bytes)
    fn marshal_string(s: &str) -> Vec<u8> {
        let bytes = s.as_bytes();
        let mut buf = vec![b'"'];
        buf.extend(marshal_long(bytes.len() as i32));
        buf.extend_from_slice(bytes);
        buf
    }

    /// Build a Marshal IVar-wrapped string (with encoding)
    fn marshal_ivar_string(s: &str) -> Vec<u8> {
        let mut buf = vec![b'I'];
        buf.extend(marshal_string(s));
        // 1 ivar: :E (encoding) = true (UTF-8)
        buf.extend(marshal_long(1));
        buf.push(b':'); // symbol
        buf.extend(marshal_long(1));
        buf.push(b'E');
        buf.push(b'T'); // true
        buf
    }

    /// Build a Marshal symbol
    fn marshal_symbol(s: &str) -> Vec<u8> {
        let bytes = s.as_bytes();
        let mut buf = vec![b':'];
        buf.extend(marshal_long(bytes.len() as i32));
        buf.extend_from_slice(bytes);
        buf
    }

    /// Build a Marshal fixnum
    fn marshal_fixnum(v: i32) -> Vec<u8> {
        let mut buf = vec![b'i'];
        buf.extend(marshal_long(v));
        buf
    }

    /// Build a Marshal nil
    fn marshal_nil() -> Vec<u8> {
        vec![b'0']
    }

    /// Build a Marshal array
    fn marshal_array(items: Vec<Vec<u8>>) -> Vec<u8> {
        let mut buf = vec![b'['];
        buf.extend(marshal_long(items.len() as i32));
        for item in items {
            buf.extend(item);
        }
        buf
    }

    /// Build a Marshal hash
    fn marshal_hash(pairs: Vec<(Vec<u8>, Vec<u8>)>) -> Vec<u8> {
        let mut buf = vec![b'{'];
        buf.extend(marshal_long(pairs.len() as i32));
        for (key, val) in pairs {
            buf.extend(key);
            buf.extend(val);
        }
        buf
    }

    // ─────────────────────────────────────────────────────────────
    // MARSHAL PARSER TESTS
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_marshal_long_encoding() {
        // Test the marshal_long helper
        assert_eq!(marshal_long(0), vec![0]);
        assert_eq!(marshal_long(1), vec![6]); // 1 + 5 = 6
        assert_eq!(marshal_long(5), vec![10]); // 5 + 5 = 10
        assert_eq!(marshal_long(122), vec![127]); // 122 + 5 = 127
    }

    #[test]
    fn test_marshal_parse_string() {
        let mut data = marshal_header();
        data.extend(marshal_ivar_string("Hello World"));

        let result = extract_strings_from_marshal(&data).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].original, "Hello World");
    }

    #[test]
    fn test_marshal_parse_array_of_strings() {
        let mut data = marshal_header();
        data.extend(marshal_array(vec![
            marshal_ivar_string("Sword"),
            marshal_ivar_string("Shield"),
            marshal_ivar_string("Potion"),
        ]));

        let result = extract_strings_from_marshal(&data).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].original, "Sword");
        assert_eq!(result[1].original, "Shield");
        assert_eq!(result[2].original, "Potion");
    }

    #[test]
    fn test_marshal_parse_hash() {
        let mut data = marshal_header();
        data.extend(marshal_hash(vec![
            (marshal_symbol("name"), marshal_ivar_string("Iron Sword")),
            (marshal_symbol("description"), marshal_ivar_string("A basic sword made of iron.")),
        ]));

        let result = extract_strings_from_marshal(&data).unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().any(|s| s.original == "Iron Sword"));
        assert!(result.iter().any(|s| s.original == "A basic sword made of iron."));
    }

    #[test]
    fn test_marshal_filters_paths() {
        let mut data = marshal_header();
        data.extend(marshal_array(vec![
            marshal_ivar_string("img/characters/hero.png"),  // should be filtered
            marshal_ivar_string("audio/bgm/battle.ogg"),     // should be filtered
            marshal_ivar_string("Real dialogue text"),        // should be kept
        ]));

        let result = extract_strings_from_marshal(&data).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].original, "Real dialogue text");
    }

    #[test]
    fn test_marshal_filters_short_strings() {
        let mut data = marshal_header();
        data.extend(marshal_array(vec![
            marshal_ivar_string("A"),      // too short (< 2)
            marshal_ivar_string("OK"),     // 2 chars, should be kept
            marshal_ivar_string("Hello"),  // kept
        ]));

        let result = extract_strings_from_marshal(&data).unwrap();
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_marshal_filters_numbers() {
        let mut data = marshal_header();
        data.extend(marshal_array(vec![
            marshal_ivar_string("12345"),    // pure number
            marshal_ivar_string("3.14"),     // float
            marshal_ivar_string("Item 42"),  // contains number but has text
        ]));

        let result = extract_strings_from_marshal(&data).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].original, "Item 42");
    }

    #[test]
    fn test_marshal_with_nil_and_fixnum() {
        let mut data = marshal_header();
        data.extend(marshal_array(vec![
            marshal_nil(),
            marshal_fixnum(42),
            marshal_ivar_string("Valid text here"),
            marshal_fixnum(-1),
        ]));

        let result = extract_strings_from_marshal(&data).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].original, "Valid text here");
    }

    #[test]
    fn test_marshal_nested_structures() {
        let mut data = marshal_header();
        let inner_array = marshal_array(vec![
            marshal_ivar_string("Nested text"),
        ]);
        data.extend(marshal_hash(vec![
            (marshal_symbol("items"), inner_array),
        ]));

        let result = extract_strings_from_marshal(&data).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].original, "Nested text");
    }

    #[test]
    fn test_marshal_version_check() {
        let data = vec![3, 8]; // wrong version
        assert!(extract_strings_from_marshal(&data).is_err());
    }

    #[test]
    fn test_marshal_too_small() {
        let data = vec![4]; // only 1 byte
        assert!(extract_strings_from_marshal(&data).is_err());
    }

    #[test]
    fn test_marshal_empty() {
        let mut data = marshal_header();
        data.push(b'0'); // nil
        let result = extract_strings_from_marshal(&data).unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_marshal_preserves_control_codes() {
        // RPG Maker control codes like \V[1], \N[2] should be preserved
        let mut data = marshal_header();
        data.extend(marshal_ivar_string("\\V[1] said: Hello \\N[2]!"));

        let result = extract_strings_from_marshal(&data).unwrap();
        assert_eq!(result.len(), 1);
        assert!(result[0].original.contains("\\V[1]"));
        assert!(result[0].original.contains("\\N[2]"));
    }

    #[test]
    fn test_marshal_id_format() {
        let mut data = marshal_header();
        data.extend(marshal_ivar_string("Test string"));

        let result = extract_strings_from_marshal(&data).unwrap();
        assert!(result[0].id.starts_with("marshal_"));
    }

    // ─────────────────────────────────────────────────────────────
    // IS_TRANSLATABLE_STRING TESTS
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_is_translatable_string() {
        assert!(MarshalParser::is_translatable_string("Hello World"));
        assert!(MarshalParser::is_translatable_string("Iron Sword"));
        assert!(MarshalParser::is_translatable_string("\\V[1] attacks!"));

        assert!(!MarshalParser::is_translatable_string(""));
        assert!(!MarshalParser::is_translatable_string("A"));
        assert!(!MarshalParser::is_translatable_string("img/hero.png"));
        assert!(!MarshalParser::is_translatable_string("audio/bgm.ogg"));
        assert!(!MarshalParser::is_translatable_string("12345"));
        assert!(!MarshalParser::is_translatable_string("#FF0000"));
        assert!(!MarshalParser::is_translatable_string("Graphics/Titles/logo.png"));
    }

    // ─────────────────────────────────────────────────────────────
    // MV/MZ FILTER TESTS
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_is_translatable_field_core() {
        assert!(is_translatable_field("name"));
        assert!(is_translatable_field("description"));
        assert!(is_translatable_field("message1"));
        assert!(is_translatable_field("text"));
        assert!(is_translatable_field("title"));
        assert!(is_translatable_field("gameTitle"));
    }

    #[test]
    fn test_is_translatable_field_new_fields() {
        assert!(is_translatable_field("dialogue"));
        assert!(is_translatable_field("dialogues"));
        assert!(is_translatable_field("choices"));
        assert!(is_translatable_field("label"));
        assert!(is_translatable_field("events"));
        assert!(is_translatable_field("commands"));
        assert!(is_translatable_field("params"));
    }

    #[test]
    fn test_is_translatable_field_case_insensitive() {
        assert!(is_translatable_field("Name"));
        assert!(is_translatable_field("DESCRIPTION"));
        assert!(is_translatable_field("gameTitle"));
    }

    #[test]
    fn test_is_translatable_field_rejects() {
        assert!(!is_translatable_field("id"));
        assert!(!is_translatable_field("x"));
        assert!(!is_translatable_field("y"));
        assert!(!is_translatable_field("width"));
        assert!(!is_translatable_field("height"));
        assert!(!is_translatable_field("opacity"));
        assert!(!is_translatable_field("volume"));
    }

    #[test]
    fn test_json_extraction_preserves_control_codes() {
        // RPG Maker MV/MZ text with control codes should NOT be filtered
        let json = serde_json::json!({
            "name": "\\C[2]Hero\\C[0]",
            "description": "Uses \\V[1] power"
        });

        let mut strings = Vec::new();
        let mut counter = 0u32;
        extract_strings_recursive(&json, "test.json", "", &mut strings, &mut counter);

        assert_eq!(strings.len(), 2);
        assert!(strings.iter().any(|s| s.original.contains("\\C[2]")));
        assert!(strings.iter().any(|s| s.original.contains("\\V[1]")));
    }

    #[test]
    fn test_json_extraction_filters_assets() {
        let json = serde_json::json!({
            "name": "Iron Sword",
            "description": "A weapon",
            "parameters": ["img/items/sword.png", "audio/se/slash.ogg", "Real parameter text"]
        });

        let mut strings = Vec::new();
        let mut counter = 0u32;
        extract_strings_recursive(&json, "test.json", "", &mut strings, &mut counter);

        // "img/..." and "audio/..." should be filtered, paths with .png/.ogg too
        let values: Vec<&str> = strings.iter().map(|s| s.original.as_str()).collect();
        assert!(values.contains(&"Iron Sword"));
        assert!(values.contains(&"A weapon"));
        assert!(values.contains(&"Real parameter text"));
        assert!(!values.iter().any(|v| v.contains("img/")));
        assert!(!values.iter().any(|v| v.contains("audio/")));
    }

    // ─────────────────────────────────────────────────────────────
    // FILE CLASSIFICATION TESTS
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_classify_rpgmaker_file() {
        assert!(matches!(classify_rpgmaker_file("Actors.json"), RpgMakerFileType::Actors));
        assert!(matches!(classify_rpgmaker_file("Armors.json"), RpgMakerFileType::Armors));
        assert!(matches!(classify_rpgmaker_file("Map001.json"), RpgMakerFileType::Map));
        assert!(matches!(classify_rpgmaker_file("System.json"), RpgMakerFileType::System));
        assert!(matches!(classify_rpgmaker_file("Weapons.json"), RpgMakerFileType::Weapons));
        assert!(matches!(classify_rpgmaker_file("CommonEvents.json"), RpgMakerFileType::CommonEvents));
        assert!(matches!(classify_rpgmaker_file("custom.json"), RpgMakerFileType::Other));
    }

    // ─────────────────────────────────────────────────────────────
    // STATS TESTS
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_translation_stats() {
        let strings = vec![
            RpgMakerString { id: "1".into(), original: "Hello".into(), translated: "Ciao".into(), context: "".into(), file: "a.json".into() },
            RpgMakerString { id: "2".into(), original: "World".into(), translated: "".into(), context: "".into(), file: "a.json".into() },
            RpgMakerString { id: "3".into(), original: "Test".into(), translated: "Prova".into(), context: "".into(), file: "b.json".into() },
        ];
        let stats = get_rpgmaker_translation_stats(strings);
        assert_eq!(stats.total, 3);
        assert_eq!(stats.translated, 2);
        assert_eq!(stats.untranslated, 1);
        assert_eq!(stats.percentage, 66);
    }
}
