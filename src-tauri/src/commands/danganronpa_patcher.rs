// Danganronpa PAK/PO Patcher
// Supporto per estrazione e modifica file PAK e traduzioni PO

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write, BufReader, BufRead};
use std::path::{Path, PathBuf};
use tauri::command;
use zip::write::FileOptions;
use zip::ZipWriter;

// ============================================================================
// STRUTTURE DATI
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PakEntry {
    pub name: String,
    pub offset: u32,
    pub size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PakArchive {
    pub path: String,
    pub entries: Vec<PakEntry>,
    pub pak_type: PakType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PakType {
    Text,      // Type 1: Testi diretti
    Script,    // Type 2: File LIN
    Font,      // Type 3: PAK annidati
    Texture,   // Texture PAK
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoEntry {
    pub msgid: String,
    pub msgstr: String,
    pub comments: Vec<String>,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoFile {
    pub path: String,
    pub entries: Vec<PoEntry>,
    pub header: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DanganronpaGame {
    pub path: String,
    pub game_type: DanganronpaType,
    pub pak_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DanganronpaType {
    TriggerHappyHavoc,
    GoodbyeDespair,
    AnotherEpisode,
    Unknown,
}

// ============================================================================
// RILEVAMENTO GIOCO
// ============================================================================

/// Rileva se una cartella contiene un gioco Danganronpa
#[command]
pub fn detect_danganronpa_game(game_path: String) -> Result<DanganronpaGame, String> {
    let path = Path::new(&game_path);
    
    if !path.exists() {
        return Err("Percorso non esistente".to_string());
    }
    
    // Cerca file caratteristici
    let dr1_exe = path.join("DR1_us.exe");
    let dr2_exe = path.join("DR2_us.exe");
    let drae_exe = path.join("game.exe"); // Another Episode
    
    let game_type = if dr1_exe.exists() {
        DanganronpaType::TriggerHappyHavoc
    } else if dr2_exe.exists() {
        DanganronpaType::GoodbyeDespair
    } else if drae_exe.exists() && path.join("data").exists() {
        DanganronpaType::AnotherEpisode
    } else {
        DanganronpaType::Unknown
    };
    
    // Trova file PAK
    let pak_files = find_pak_files(&game_path)?;
    
    log::info!("🎮 Rilevato Danganronpa: {:?} con {} file PAK", game_type, pak_files.len());
    
    Ok(DanganronpaGame {
        path: game_path,
        game_type,
        pak_files,
    })
}

/// Trova tutti i file PAK, WAD e LIN nel gioco
fn find_pak_files(game_path: &str) -> Result<Vec<String>, String> {
    let mut pak_files = Vec::new();
    
    let data_paths = [
        Path::new(game_path).join("data"),
        Path::new(game_path).join("Dr1").join("data"),
        Path::new(game_path).join("Dr2").join("data"),
        Path::new(game_path).join("Dr1"),
        Path::new(game_path).join("Dr2"),
        PathBuf::from(game_path),
    ];
    
    for data_path in &data_paths {
        if data_path.exists() {
            for entry in walkdir::WalkDir::new(data_path)
                .max_depth(8)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if entry.file_type().is_file() {
                    if let Some(ext) = entry.path().extension() {
                        let ext_lower = ext.to_string_lossy().to_lowercase();
                        // Danganronpa usa .pak, .wad, .cpk (V3) e .lin (script)
                        if ext_lower == "pak" || ext_lower == "wad" || ext_lower == "cpk" || ext_lower == "lin" {
                            if let Some(path_str) = entry.path().to_str() {
                                pak_files.push(path_str.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Deduplica (percorsi multipli possono trovare gli stessi file)
    pak_files.sort();
    pak_files.dedup();
    log::info!("📁 Trovati {} file (pak/wad/cpk/lin)", pak_files.len());
    Ok(pak_files)
}

// ============================================================================
// LETTURA PAK/WAD
// ============================================================================

/// Leggi header e lista file da un PAK o WAD
#[command]
pub fn read_pak_archive(pak_path: String) -> Result<PakArchive, String> {
    let path = Path::new(&pak_path);
    
    if !path.exists() {
        return Err(format!("File non trovato: {}", pak_path));
    }
    
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    // Usa parser appropriato
    if ext == "wad" {
        read_wad_archive(&pak_path)
    } else if ext == "cpk" {
        read_cpk_archive(&pak_path)
    } else {
        read_pak_archive_internal(&pak_path)
    }
}

/// Parser WAD per Danganronpa
fn read_wad_archive(wad_path: &str) -> Result<PakArchive, String> {
    let path = Path::new(wad_path);
    let data = fs::read(wad_path)
        .map_err(|e| format!("Errore lettura WAD: {}", e))?;
    
    if data.len() < 24 {
        return Err("File WAD troppo piccolo".to_string());
    }
    
    let mut entries = Vec::new();
    let magic = &data[0..4];
    
    if magic == b"AGAR" {
        // Formato AGAR (DR1, DR2, DRAE, V3)
        // Header: AGAR(4) + version(4) + ?(4) + ?(4) + file_count(4) = 20 bytes
        let file_count = u32::from_le_bytes([data[16], data[17], data[18], data[19]]) as usize;
        
        log::info!("📦 WAD AGAR: {} file dichiarati", file_count);
        
        // Entry table starts at offset 20
        // Each entry: name_len(4) + name(name_len) + size(4) + offset(8)
        let mut pos = 20;
        
        for _i in 0..file_count.min(50000) {
            if pos + 4 > data.len() {
                break;
            }
            
            // Leggi lunghezza nome
            let name_len = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
            pos += 4;
            
            if name_len == 0 || name_len > 512 || pos + name_len > data.len() {
                break;
            }
            
            // Leggi nome
            let name = String::from_utf8_lossy(&data[pos..pos + name_len]).to_string();
            pos += name_len;
            
            // Leggi size (8 bytes) e offset (8 bytes)
            if pos + 16 > data.len() {
                break;
            }
            
            let size = u64::from_le_bytes([
                data[pos], data[pos + 1], data[pos + 2], data[pos + 3],
                data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7],
            ]) as u32;
            pos += 8;
            
            let offset = u64::from_le_bytes([
                data[pos], data[pos + 1], data[pos + 2], data[pos + 3],
                data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7],
            ]) as u32;
            pos += 8;
            
            if !name.is_empty() {
                entries.push(PakEntry {
                    name,
                    offset,
                    size,
                });
            }
        }
        
        log::info!("📦 WAD AGAR: {} file estratti", entries.len());
    } else {
        // Formato non-AGAR: prova come raw archive
        let file_size = data.len() as u32;
        let wad_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");
        
        entries.push(PakEntry {
            name: format!("{} ({:.1} MB)", wad_name, file_size as f64 / 1024.0 / 1024.0),
            offset: 0,
            size: file_size,
        });
    }
    
    // Se nessun file trovato, mostra almeno il WAD stesso
    if entries.is_empty() {
        let file_size = data.len() as u32;
        let wad_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");
        
        entries.push(PakEntry {
            name: format!("{} ({:.1} MB)", wad_name, file_size as f64 / 1024.0 / 1024.0),
            offset: 0,
            size: file_size,
        });
    }
    
    let pak_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    let pak_type = classify_pak_type(pak_name);
    
    log::info!("📦 WAD letto: {} ({} entries)", wad_path, entries.len());
    
    Ok(PakArchive {
        path: wad_path.to_string(),
        entries,
        pak_type,
    })
}

/// Parser CPK per Danganronpa V3 (CRI Package format)
fn read_cpk_archive(cpk_path: &str) -> Result<PakArchive, String> {
    let path = Path::new(cpk_path);
    let data = fs::read(cpk_path)
        .map_err(|e| format!("Errore lettura CPK: {}", e))?;
    
    if data.len() < 16 {
        return Err("File CPK troppo piccolo".to_string());
    }
    
    let mut entries = Vec::new();
    
    // CPK header: "CPK " (4 bytes) + version info
    let magic = &data[0..4];
    
    if magic == b"CPK " {
        log::info!("📦 CPK CRI Package rilevato");
        
        // CPK format è complesso con tabelle UTF
        // Cerchiamo la TOC (Table of Contents)
        
        // Cerca "TOC " marker
        let mut toc_offset: Option<usize> = None;
        for i in 0..data.len().saturating_sub(4) {
            if &data[i..i+4] == b"TOC " {
                toc_offset = Some(i);
                break;
            }
        }
        
        if let Some(toc_pos) = toc_offset {
            log::info!("📦 CPK TOC trovato a offset {}", toc_pos);
            
            // Parse UTF table dopo TOC
            // Formato: TOC (4) + flags (4) + table_size (8) + UTF table
            if toc_pos + 16 <= data.len() {
                let _table_size = u64::from_le_bytes([
                    data[toc_pos + 8], data[toc_pos + 9], data[toc_pos + 10], data[toc_pos + 11],
                    data[toc_pos + 12], data[toc_pos + 13], data[toc_pos + 14], data[toc_pos + 15],
                ]);
                
                // Cerca "@UTF" marker per la tabella UTF
                let utf_start = toc_pos + 16;
                if utf_start + 4 <= data.len() && &data[utf_start..utf_start+4] == b"@UTF" {
                    // Parse UTF table per estrarre nomi file
                    entries = parse_cpk_utf_table(&data, utf_start)?;
                }
            }
        }
        
        // Se non troviamo TOC, cerca ITOC (Index TOC)
        if entries.is_empty() {
            for i in 0..data.len().saturating_sub(4) {
                if &data[i..i+4] == b"ITOC" {
                    log::info!("📦 CPK ITOC trovato a offset {}", i);
                    // ITOC usa indici numerici invece di nomi
                    let file_size = data.len() as u32;
                    entries.push(PakEntry {
                        name: format!("CPK con ITOC ({} file indicizzati)", file_size / 1024 / 1024),
                        offset: 0,
                        size: file_size,
                    });
                    break;
                }
            }
        }
    }
    
    // Fallback
    if entries.is_empty() {
        let file_size = data.len() as u32;
        let cpk_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");
        
        entries.push(PakEntry {
            name: format!("{} ({:.1} MB)", cpk_name, file_size as f64 / 1024.0 / 1024.0),
            offset: 0,
            size: file_size,
        });
    }
    
    let pak_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    let pak_type = classify_pak_type(pak_name);
    
    log::info!("📦 CPK letto: {} ({} entries)", cpk_path, entries.len());
    
    Ok(PakArchive {
        path: cpk_path.to_string(),
        entries,
        pak_type,
    })
}

/// Parse CPK UTF table per estrarre file entries
fn parse_cpk_utf_table(data: &[u8], utf_start: usize) -> Result<Vec<PakEntry>, String> {
    let mut entries = Vec::new();
    
    if utf_start + 32 > data.len() {
        return Ok(entries);
    }
    
    // UTF header: @UTF (4) + table_size (4) + rows_offset (4) + string_offset (4) + data_offset (4)
    //             + table_name_offset (4) + num_columns (2) + row_width (2) + num_rows (4)
    
    let _table_size = u32::from_be_bytes([data[utf_start+4], data[utf_start+5], data[utf_start+6], data[utf_start+7]]);
    let _rows_offset = u32::from_be_bytes([data[utf_start+8], data[utf_start+9], data[utf_start+10], data[utf_start+11]]) as usize;
    let string_offset = u32::from_be_bytes([data[utf_start+12], data[utf_start+13], data[utf_start+14], data[utf_start+15]]) as usize;
    let _data_offset = u32::from_be_bytes([data[utf_start+16], data[utf_start+17], data[utf_start+18], data[utf_start+19]]) as usize;
    let num_rows = u32::from_be_bytes([data[utf_start+24], data[utf_start+25], data[utf_start+26], data[utf_start+27]]) as usize;
    
    log::info!("📦 CPK UTF: {} rows, strings at {}", num_rows, string_offset);
    
    // String table base
    let string_base = utf_start + 8 + string_offset;
    
    // Estrai nomi dalla string table
    let mut string_pos = string_base;
    let mut file_index = 0u32;
    
    while string_pos < data.len() && entries.len() < num_rows.min(10000) {
        // Cerca stringhe null-terminated che sembrano nomi file
        let start = string_pos;
        while string_pos < data.len() && data[string_pos] != 0 {
            string_pos += 1;
        }
        
        if string_pos > start {
            let name = String::from_utf8_lossy(&data[start..string_pos]).to_string();
            
            // Filtra solo nomi che sembrano file (contengono . o /)
            if name.contains('.') || name.contains('/') {
                entries.push(PakEntry {
                    name,
                    offset: file_index,
                    size: 0, // Size sconosciuto senza parsing completo
                });
                file_index += 1;
            }
        }
        
        string_pos += 1; // Skip null terminator
        
        // Limita ricerca
        if string_pos > string_base + 100000 {
            break;
        }
    }
    
    Ok(entries)
}

/// Parser PAK interno
fn read_pak_archive_internal(pak_path: &str) -> Result<PakArchive, String> {
    let path = Path::new(pak_path);
    
    let data = fs::read(pak_path)
        .map_err(|e| format!("Errore apertura PAK: {}", e))?;
    
    if data.len() < 4 {
        return Err("File PAK troppo piccolo".to_string());
    }
    
    let mut entries = Vec::new();
    let pak_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    
    // Prova formato Danganronpa: primi 4 bytes = file_count
    let file_count = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
    
    // Verifica se è un archivio PAK valido
    // Header: file_count (4) + entries (file_count * 8)
    let expected_header_size = 4 + (file_count as usize) * 8;
    
    if file_count > 0 && file_count < 10000 && expected_header_size < data.len() {
        // Verifica che gli offset siano ragionevoli
        let mut valid = true;
        let mut pos = 4;
        
        for _ in 0..file_count.min(5) {
            if pos + 8 > data.len() {
                valid = false;
                break;
            }
            let offset = u32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]]);
            let size = u32::from_le_bytes([data[pos+4], data[pos+5], data[pos+6], data[pos+7]]);
            
            // Offset deve essere >= header e offset+size <= file_size
            if offset < expected_header_size as u32 || (offset as usize + size as usize) > data.len() {
                valid = false;
                break;
            }
            pos += 8;
        }
        
        if valid {
            // Parse come archivio PAK standard
            pos = 4;
            for i in 0..file_count {
                let offset = u32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]]);
                let size = u32::from_le_bytes([data[pos+4], data[pos+5], data[pos+6], data[pos+7]]);
                pos += 8;
                
                entries.push(PakEntry {
                    name: format!("file_{:04}", i),
                    offset,
                    size,
                });
            }
            
            let pak_type = classify_pak_type(pak_name);
            log::info!("📦 PAK letto: {} ({} file)", pak_path, entries.len());
            
            return Ok(PakArchive {
                path: pak_path.to_string(),
                entries,
                pak_type,
            });
        }
    }
    
    // Non è un archivio: mostra come file singolo
    let file_size = data.len() as u32;
    entries.push(PakEntry {
        name: pak_name.to_string(),
        offset: 0,
        size: file_size,
    });
    
    let pak_type = classify_pak_type(pak_name);
    log::info!("📦 PAK singolo: {} ({} bytes)", pak_path, file_size);
    
    Ok(PakArchive {
        path: pak_path.to_string(),
        entries,
        pak_type,
    })
}

/// Classifica il tipo di PAK dal nome
fn classify_pak_type(pak_name: &str) -> PakType {
    let name_lower = pak_name.to_lowercase();
    
    if name_lower.contains("font") {
        PakType::Font
    } else if name_lower.contains("script") || name_lower.contains("novel") {
        PakType::Script
    } else if name_lower.contains("tex") || name_lower.contains("sprite") || name_lower.contains("bg") {
        PakType::Texture
    } else if name_lower.contains("system") || name_lower.contains("menu") {
        PakType::Text
    } else {
        PakType::Unknown
    }
}

/// Estrai un file specifico da un PAK
#[command]
pub fn extract_pak_file(pak_path: String, entry_index: u32, output_path: String) -> Result<(), String> {
    let archive = read_pak_archive(pak_path.clone())?;
    
    let entry = archive.entries.get(entry_index as usize)
        .ok_or("Indice entry non valido")?;
    
    let mut file = File::open(&pak_path)
        .map_err(|e| format!("Errore apertura PAK: {}", e))?;
    
    file.seek(SeekFrom::Start(entry.offset as u64))
        .map_err(|e| format!("Errore seek: {}", e))?;
    
    let mut data = vec![0u8; entry.size as usize];
    file.read_exact(&mut data)
        .map_err(|e| format!("Errore lettura dati: {}", e))?;
    
    fs::write(&output_path, &data)
        .map_err(|e| format!("Errore scrittura output: {}", e))?;
    
    log::info!("📤 Estratto: {} -> {}", entry.name, output_path);
    
    Ok(())
}

/// Estrai tutti i file da un PAK
#[command]
pub fn extract_all_pak(pak_path: String, output_dir: String) -> Result<u32, String> {
    let archive = read_pak_archive(pak_path.clone())?;
    
    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Errore creazione directory: {}", e))?;
    
    let mut file = File::open(&pak_path)
        .map_err(|e| format!("Errore apertura PAK: {}", e))?;
    
    let mut extracted = 0u32;
    
    for (i, entry) in archive.entries.iter().enumerate() {
        file.seek(SeekFrom::Start(entry.offset as u64))
            .map_err(|e| format!("Errore seek entry {}: {}", i, e))?;
        
        let mut data = vec![0u8; entry.size as usize];
        file.read_exact(&mut data)
            .map_err(|e| format!("Errore lettura entry {}: {}", i, e))?;
        
        let output_path = Path::new(&output_dir).join(&entry.name);
        
        // Crea sottocartelle se necessario
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Errore creazione directory {}: {}", parent.display(), e))?;
        }
        
        fs::write(&output_path, &data)
            .map_err(|e| format!("Errore scrittura {}: {}", entry.name, e))?;
        
        extracted += 1;
    }
    
    log::info!("📤 Estratti {} file da {}", extracted, pak_path);
    
    Ok(extracted)
}

// ============================================================================
// FILE PO (GETTEXT)
// ============================================================================

/// Leggi un file PO
#[command]
pub fn read_po_file(po_path: String) -> Result<PoFile, String> {
    let content = fs::read_to_string(&po_path)
        .map_err(|e| format!("Errore lettura PO: {}", e))?;
    
    let mut entries = Vec::new();
    let mut header = HashMap::new();
    
    let mut current_msgid = String::new();
    let mut current_msgstr = String::new();
    let mut current_comments = Vec::new();
    let mut current_context: Option<String> = None;
    let mut in_msgid = false;
    let mut in_msgstr = false;
    
    for line in content.lines() {
        let line = line.trim();
        
        if line.is_empty() {
            // Fine entry
            if !current_msgid.is_empty() || !current_msgstr.is_empty() {
                entries.push(PoEntry {
                    msgid: current_msgid.clone(),
                    msgstr: current_msgstr.clone(),
                    comments: current_comments.clone(),
                    context: current_context.clone(),
                });
            }
            current_msgid.clear();
            current_msgstr.clear();
            current_comments.clear();
            current_context = None;
            in_msgid = false;
            in_msgstr = false;
            continue;
        }
        
        if line.starts_with('#') {
            current_comments.push(line.to_string());
        } else if line.starts_with("msgctxt ") {
            current_context = Some(extract_po_string(line, "msgctxt "));
        } else if line.starts_with("msgid ") {
            in_msgid = true;
            in_msgstr = false;
            current_msgid = extract_po_string(line, "msgid ");
        } else if line.starts_with("msgstr ") {
            in_msgid = false;
            in_msgstr = true;
            current_msgstr = extract_po_string(line, "msgstr ");
        } else if line.starts_with('"') && line.ends_with('"') {
            // Continuazione stringa
            let s = &line[1..line.len()-1];
            if in_msgid {
                current_msgid.push_str(s);
            } else if in_msgstr {
                current_msgstr.push_str(s);
            }
        }
    }
    
    // Ultima entry
    if !current_msgid.is_empty() || !current_msgstr.is_empty() {
        entries.push(PoEntry {
            msgid: current_msgid,
            msgstr: current_msgstr,
            comments: current_comments,
            context: current_context,
        });
    }
    
    // Prima entry con msgid vuoto è l'header
    if let Some(first) = entries.first() {
        if first.msgid.is_empty() {
            for line in first.msgstr.split("\\n") {
                if let Some((key, value)) = line.split_once(':') {
                    header.insert(key.trim().to_string(), value.trim().to_string());
                }
            }
        }
    }
    
    log::info!("📄 PO letto: {} ({} entry)", po_path, entries.len());
    
    Ok(PoFile {
        path: po_path,
        entries,
        header,
    })
}

/// Estrai stringa da linea PO
fn extract_po_string(line: &str, prefix: &str) -> String {
    let rest = line.strip_prefix(prefix).unwrap_or(line);
    if rest.starts_with('"') && rest.ends_with('"') {
        rest[1..rest.len()-1].to_string()
    } else {
        rest.to_string()
    }
}

/// Scrivi un file PO
#[command]
pub fn write_po_file(po_path: String, entries: Vec<PoEntry>) -> Result<(), String> {
    let mut output = String::new();
    
    for entry in &entries {
        // Commenti
        for comment in &entry.comments {
            output.push_str(comment);
            output.push('\n');
        }
        
        // Context
        if let Some(ctx) = &entry.context {
            output.push_str(&format!("msgctxt \"{}\"\n", escape_po_string(ctx)));
        }
        
        // msgid
        output.push_str(&format!("msgid \"{}\"\n", escape_po_string(&entry.msgid)));
        
        // msgstr
        output.push_str(&format!("msgstr \"{}\"\n", escape_po_string(&entry.msgstr)));
        
        output.push('\n');
    }
    
    fs::write(&po_path, output)
        .map_err(|e| format!("Errore scrittura PO: {}", e))?;
    
    log::info!("💾 PO salvato: {} ({} entry)", po_path, entries.len());
    
    Ok(())
}

/// Escape caratteri speciali per PO
fn escape_po_string(s: &str) -> String {
    s.replace('\\', "\\\\")
     .replace('"', "\\\"")
     .replace('\n', "\\n")
     .replace('\t', "\\t")
}

/// Traduci automaticamente entry PO non tradotte usando Ollama
#[command]
pub async fn translate_po_entries(
    po_path: String,
    source_lang: String,
    target_lang: String,
) -> Result<u32, String> {
    let mut po_file = read_po_file(po_path.clone())?;
    
    // Verifica che Ollama sia attivo e trova un modello
    let status = super::offline_translation::offline_translation_status().await
        .map_err(|e| format!("Ollama non disponibile: {}", e))?;
    
    if !status.ollama_running {
        return Err("Ollama non è in esecuzione. Avvialo dalla sezione Ollama Manager.".to_string());
    }
    if status.recommended_model.is_empty() {
        return Err("Nessun modello Ollama installato. Scarica un modello dalla sezione Ollama Manager.".to_string());
    }
    
    let model = status.recommended_model;
    let mut translated = 0u32;
    let total_to_translate = po_file.entries.iter()
        .filter(|e| !e.msgid.is_empty() && e.msgstr.is_empty())
        .count();
    
    log::info!("🌐 Inizio traduzione PO: {} entry da tradurre con {}", total_to_translate, model);
    
    for entry in &mut po_file.entries {
        // Salta header e già tradotti
        if entry.msgid.is_empty() || !entry.msgstr.is_empty() {
            continue;
        }
        
        // Traduci con Ollama
        match super::offline_translation::offline_translate_text(
            entry.msgid.clone(),
            source_lang.clone(),
            target_lang.clone(),
            Some(model.clone()),
        ).await {
            Ok(result) => {
                entry.msgstr = result.translated;
                translated += 1;
                if translated % 10 == 0 {
                    log::info!("🌐 Progresso PO: {}/{} tradotte", translated, total_to_translate);
                }
            }
            Err(e) => {
                log::warn!("⚠️ Errore traduzione entry '{}': {}", 
                    &entry.msgid.chars().take(40).collect::<String>(), e);
                // Continua con le altre entry
            }
        }
    }
    
    write_po_file(po_path.clone(), po_file.entries)?;
    
    log::info!("🌐 Traduzione PO completata: {}/{} entry in {}", translated, total_to_translate, po_path);
    
    Ok(translated)
}

/// Ottieni statistiche traduzione PO
#[command]
pub fn get_po_stats(po_path: String) -> Result<PoStats, String> {
    let po_file = read_po_file(po_path)?;
    
    let total = po_file.entries.len();
    let translated = po_file.entries.iter()
        .filter(|e| !e.msgid.is_empty() && !e.msgstr.is_empty() && !e.msgstr.starts_with("[TODO]"))
        .count();
    let untranslated = po_file.entries.iter()
        .filter(|e| !e.msgid.is_empty() && e.msgstr.is_empty())
        .count();
    let fuzzy = po_file.entries.iter()
        .filter(|e| e.comments.iter().any(|c| c.contains("fuzzy")))
        .count();
    
    Ok(PoStats {
        total,
        translated,
        untranslated,
        fuzzy,
        percentage: if total > 0 { (translated * 100) / total } else { 0 },
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoStats {
    pub total: usize,
    pub translated: usize,
    pub untranslated: usize,
    pub fuzzy: usize,
    pub percentage: usize,
}

// ============================================================================
// INTEGRAZIONE DRAT
// ============================================================================

/// Verifica se DRAT è installato
#[command]
pub fn is_drat_available() -> bool {
    let possible_paths = [
        PathBuf::from(r"C:\Tools\DRAT\DRAT.exe"),
        PathBuf::from(r"DRAT.exe"),
        dirs::data_local_dir()
            .map(|p| p.join("GameStringer").join("tools").join("DRAT.exe"))
            .unwrap_or_default(),
    ];
    
    possible_paths.iter().any(|p| p.exists())
}

/// Ottieni info su DRAT
#[command]
pub fn get_drat_info() -> DratInfo {
    DratInfo {
        available: is_drat_available(),
        download_url: "https://github.com/Liquid-S/Danganronpa-Another-Tool/releases".to_string(),
        description: "Tool per estrarre e modificare file PAK di Danganronpa".to_string(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DratInfo {
    pub available: bool,
    pub download_url: String,
    pub description: String,
}

// ============================================================================
// APPLICAZIONE PATCH (WAD)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGameInfo {
    pub found: bool,
    pub path: String,
    pub game_name: String,
    pub app_id: String,
    pub wad_files: Vec<WadFileInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WadFileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_patched: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatchResult {
    pub success: bool,
    pub message: String,
    pub backup_path: Option<String>,
}

/// Trova installazione Danganronpa su Steam
#[command]
pub fn find_danganronpa_steam() -> Result<Vec<SteamGameInfo>, String> {
    let mut games = Vec::new();
    
    // Percorsi Steam comuni
    let steam_paths = get_steam_library_paths();
    
    // App IDs Danganronpa
    let danganronpa_games = [
        ("413410", "Danganronpa: Trigger Happy Havoc", "Danganronpa Trigger Happy Havoc"),
        ("413420", "Danganronpa 2: Goodbye Despair", "Danganronpa 2 Goodbye Despair"),
        ("555950", "Danganronpa V3: Killing Harmony", "Danganronpa V3 Killing Harmony"),
        ("366350", "Danganronpa Another Episode: Ultra Despair Girls", "Danganronpa Another Episode Ultra Despair Girls"),
    ];
    
    for steam_path in &steam_paths {
        let steamapps = Path::new(steam_path).join("steamapps").join("common");
        
        if steamapps.exists() {
            for (app_id, display_name, folder_name) in &danganronpa_games {
                let game_path = steamapps.join(folder_name);
                
                if game_path.exists() {
                    let wad_files = find_wad_files(&game_path);
                    
                    games.push(SteamGameInfo {
                        found: true,
                        path: game_path.to_string_lossy().to_string(),
                        game_name: display_name.to_string(),
                        app_id: app_id.to_string(),
                        wad_files,
                    });
                    
                    log::info!("🎮 Trovato: {} in {}", display_name, game_path.display());
                }
            }
        }
    }
    
    if games.is_empty() {
        log::info!("⚠️ Nessun gioco Danganronpa trovato su Steam");
    }
    
    Ok(games)
}

/// Ottieni percorsi librerie Steam
fn get_steam_library_paths() -> Vec<String> {
    let mut paths = Vec::new();
    
    #[cfg(target_os = "windows")]
    {
        // Percorsi Steam Windows comuni
        let common_paths = [
            r"C:\Program Files (x86)\Steam",
            r"C:\Program Files\Steam",
            r"D:\Steam",
            r"D:\SteamLibrary",
            r"E:\Steam",
            r"E:\SteamLibrary",
            r"F:\Steam",
            r"F:\SteamLibrary",
        ];
        
        for p in common_paths {
            if Path::new(p).exists() {
                paths.push(p.to_string());
            }
        }
        
        // Leggi librerie aggiuntive da libraryfolders.vdf
        if let Some(main_steam) = paths.first() {
            let vdf_path = Path::new(main_steam)
                .join("steamapps")
                .join("libraryfolders.vdf");
            
            if vdf_path.exists() {
                if let Ok(content) = fs::read_to_string(&vdf_path) {
                    for line in content.lines() {
                        if line.contains("\"path\"") {
                            if let Some(path) = extract_vdf_value(line) {
                                let clean_path = path.replace("\\\\", "\\");
                                if Path::new(&clean_path).exists() && !paths.contains(&clean_path) {
                                    paths.push(clean_path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        if let Some(home) = dirs::home_dir() {
            let linux_paths = [
                home.join(".steam/steam"),
                home.join(".local/share/Steam"),
            ];
            for p in linux_paths {
                if p.exists() {
                    paths.push(p.to_string_lossy().to_string());
                }
            }
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let mac_path = home.join("Library/Application Support/Steam");
            if mac_path.exists() {
                paths.push(mac_path.to_string_lossy().to_string());
            }
        }
    }
    
    paths
}

/// Estrai valore da linea VDF
fn extract_vdf_value(line: &str) -> Option<String> {
    let parts: Vec<&str> = line.split('"').collect();
    if parts.len() >= 4 {
        Some(parts[3].to_string())
    } else {
        None
    }
}

/// Trova file WAD in una cartella gioco
fn find_wad_files(game_path: &Path) -> Vec<WadFileInfo> {
    let mut wad_files = Vec::new();
    
    if let Ok(entries) = fs::read_dir(game_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext.to_string_lossy().to_lowercase() == "wad" {
                        let name = path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("unknown")
                            .to_string();
                        
                        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        
                        // Controlla se è una patch italiana (euristica)
                        let is_patched = name.contains("keyboard") || name.contains("_it") || name.contains("italian");
                        
                        wad_files.push(WadFileInfo {
                            name,
                            path: path.to_string_lossy().to_string(),
                            size,
                            is_patched,
                        });
                    }
                }
            }
        }
    }
    
    // Cerca anche in sottocartelle
    let subfolders = ["data", "Data", "Dr1", "Dr2"];
    for subfolder in subfolders {
        let sub_path = game_path.join(subfolder);
        if sub_path.exists() {
            if let Ok(entries) = fs::read_dir(&sub_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(ext) = path.extension() {
                            if ext.to_string_lossy().to_lowercase() == "wad" {
                                let name = path.file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("unknown")
                                    .to_string();
                                
                                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                                let is_patched = name.contains("keyboard") || name.contains("_it");
                                
                                wad_files.push(WadFileInfo {
                                    name,
                                    path: path.to_string_lossy().to_string(),
                                    size,
                                    is_patched,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    
    wad_files
}

/// Applica patch WAD a un gioco Danganronpa
#[command]
pub fn apply_danganronpa_patch(
    patch_file: String,
    game_path: String,
    create_backup: bool,
) -> Result<PatchResult, String> {
    let patch_path = Path::new(&patch_file);
    let game_dir = Path::new(&game_path);
    
    if !patch_path.exists() {
        return Err("File patch non trovato".to_string());
    }
    
    if !game_dir.exists() {
        return Err("Cartella gioco non trovata".to_string());
    }
    
    // Determina nome file destinazione
    let patch_filename = patch_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Nome file patch non valido")?;
    
    let dest_path = game_dir.join(patch_filename);
    
    // Crea backup se richiesto e il file esiste già
    let mut backup_path_result = None;
    
    if dest_path.exists() && create_backup {
        let backup_dir = game_dir.join("backup_originali");
        fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Errore creazione cartella backup: {}", e))?;
        
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let backup_filename = format!("{}_{}", timestamp, patch_filename);
        let backup_path = backup_dir.join(&backup_filename);
        
        fs::copy(&dest_path, &backup_path)
            .map_err(|e| format!("Errore creazione backup: {}", e))?;
        
        backup_path_result = Some(backup_path.to_string_lossy().to_string());
        log::info!("💾 Backup creato: {}", backup_path.display());
    }
    
    // Copia il file patch
    fs::copy(patch_path, &dest_path)
        .map_err(|e| format!("Errore copia patch: {}", e))?;
    
    log::info!("✅ Patch applicata: {} -> {}", patch_file, dest_path.display());
    
    Ok(PatchResult {
        success: true,
        message: format!("Patch '{}' applicata con successo!", patch_filename),
        backup_path: backup_path_result,
    })
}

/// Ripristina file originale da backup
#[command]
pub fn restore_danganronpa_backup(
    backup_file: String,
    game_path: String,
) -> Result<PatchResult, String> {
    let backup_path = Path::new(&backup_file);
    let game_dir = Path::new(&game_path);
    
    if !backup_path.exists() {
        return Err("File backup non trovato".to_string());
    }
    
    // Estrai nome file originale (rimuovi timestamp)
    let backup_filename = backup_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Nome file backup non valido")?;
    
    // Formato: YYYYMMDD_HHMMSS_originalname.wad
    let original_name = if backup_filename.len() > 16 && backup_filename.chars().nth(15) == Some('_') {
        &backup_filename[16..]
    } else {
        backup_filename
    };
    
    let dest_path = game_dir.join(original_name);
    
    fs::copy(backup_path, &dest_path)
        .map_err(|e| format!("Errore ripristino: {}", e))?;
    
    log::info!("🔄 Backup ripristinato: {} -> {}", backup_file, dest_path.display());
    
    Ok(PatchResult {
        success: true,
        message: format!("File '{}' ripristinato!", original_name),
        backup_path: None,
    })
}

/// Lista backup disponibili per un gioco
#[command]
pub fn list_danganronpa_backups(game_path: String) -> Result<Vec<WadFileInfo>, String> {
    let backup_dir = Path::new(&game_path).join("backup_originali");
    
    if !backup_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut backups = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&backup_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext.to_string_lossy().to_lowercase() == "wad" {
                        let name = path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("unknown")
                            .to_string();
                        
                        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        
                        backups.push(WadFileInfo {
                            name,
                            path: path.to_string_lossy().to_string(),
                            size,
                            is_patched: false,
                        });
                    }
                }
            }
        }
    }
    
    backups.sort_by(|a, b| b.name.cmp(&a.name)); // Più recenti prima
    
    Ok(backups)
}

/// Info patch All-Ice Team
#[command]
pub fn get_allice_patch_info() -> AllIcePatchInfo {
    AllIcePatchInfo {
        team_name: "All-Ice Team".to_string(),
        website: "http://alliceteam.altervista.org/".to_string(),
        discord: "https://discord.gg/y9EmHFr".to_string(),
        patches: vec![
            AllIcePatch {
                game: "Danganronpa: Trigger Happy Havoc".to_string(),
                version: "1.2".to_string(),
                release_date: "30 giugno 2020".to_string(),
                file_name: "dr1_data_keyboard_us.wad".to_string(),
                download_url: "http://alliceteam.altervista.org/danganronpa/".to_string(),
                notes: "Selezionare 'Keyboard and Mouse' nel Launcher".to_string(),
            },
            AllIcePatch {
                game: "Danganronpa 2: Goodbye Despair".to_string(),
                version: "1.1".to_string(),
                release_date: "".to_string(),
                file_name: "dr2_data_keyboard.wad".to_string(),
                download_url: "http://alliceteam.altervista.org/danganronpa-2/".to_string(),
                notes: "Selezionare 'Keyboard and Mouse' nel Launcher".to_string(),
            },
        ],
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllIcePatchInfo {
    pub team_name: String,
    pub website: String,
    pub discord: String,
    pub patches: Vec<AllIcePatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllIcePatch {
    pub game: String,
    pub version: String,
    pub release_date: String,
    pub file_name: String,
    pub download_url: String,
    pub notes: String,
}

// ============================================================================
// ESTRATTORE LIN (Script Danganronpa)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinFile {
    pub path: String,
    pub header: LinHeader,
    pub entries: Vec<LinEntry>,
    pub strings: Vec<LinString>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinHeader {
    pub signature: String,
    pub version: u32,
    pub entry_count: u32,
    pub string_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinEntry {
    pub index: u32,
    pub opcode: u8,
    pub opcode_name: String,
    pub args: Vec<u16>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinString {
    pub index: u32,
    pub offset: u32,
    pub text: String,
    pub speaker_id: Option<u32>,
    pub speaker_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinExtractionResult {
    pub success: bool,
    pub message: String,
    pub dialogues: Vec<LinDialogue>,
    pub total_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinDialogue {
    pub id: String,
    pub speaker: String,
    pub original: String,
    pub translated: String,
    pub file: String,
    pub line_index: u32,
}

/// Danganronpa character IDs
fn get_dr1_character_name(id: u32) -> &'static str {
    match id {
        0 => "Makoto Naegi",
        1 => "Kiyotaka Ishimaru",
        2 => "Byakuya Togami",
        3 => "Mondo Owada",
        4 => "Leon Kuwata",
        5 => "Hifumi Yamada",
        6 => "Yasuhiro Hagakure",
        7 => "Sayaka Maizono",
        8 => "Kyoko Kirigiri",
        9 => "Aoi Asahina",
        10 => "Toko Fukawa",
        11 => "Sakura Ogami",
        12 => "Celestia Ludenberg",
        13 => "Junko Enoshima",
        14 => "Chihiro Fujisaki",
        15 => "Monokuma",
        16 => "Jin Kirigiri",
        17 => "Alter Ego",
        18 => "Genocide Jack",
        19 => "Narrator",
        20 => "Makoto (Pensiero)",
        _ => "???",
    }
}

/// Opcode descriptions for LIN format
fn get_opcode_name(opcode: u8) -> &'static str {
    match opcode {
        0x00 => "TEXT_COUNT",
        0x01 => "UNKNOWN_01",
        0x02 => "TEXT",
        0x03 => "FORMAT",
        0x04 => "FILTER",
        0x05 => "MOVIE",
        0x06 => "ANIMATION",
        0x07 => "VOICE",
        0x08 => "MUSIC",
        0x09 => "SFX",
        0x0A => "TRUTH_BULLET",
        0x0B => "UNKNOWN_0B",
        0x0C => "UNKNOWN_0C",
        0x0D => "SET_LABEL",
        0x0E => "CHOICE",
        0x0F => "UNKNOWN_0F",
        0x10 => "UNKNOWN_10",
        0x11 => "WAIT_INPUT",
        0x12 => "WAIT_FRAME",
        0x13 => "END_FLAG",
        0x14 => "SPEAKER",
        0x15 => "SCREEN_FLASH",
        0x16 => "UNKNOWN_16",
        0x17 => "SHOW_BACKGROUND",
        0x18 => "UNKNOWN_18",
        0x19 => "SPRITE",
        0x1A => "SCREEN_FLASH_2",
        0x1B => "SCREEN_SHAKE",
        0x1C => "AUTO_ADVANCE",
        0x1D => "UNKNOWN_1D",
        0x1E => "SPRITE_FLIP",
        0x1F => "UNKNOWN_1F",
        0x20 => "UNKNOWN_20",
        0x21 => "SPRITE_2",
        0x22 => "UNKNOWN_22",
        0x23 => "UNKNOWN_23",
        0x24 => "UNKNOWN_24",
        0x25 => "CG",
        0x26 => "UNKNOWN_26",
        0x27 => "UNKNOWN_27",
        0x28 => "UNKNOWN_28",
        0x29 => "UNKNOWN_29",
        0x2A => "UNKNOWN_2A",
        0x2B => "UNKNOWN_2B",
        0x2C => "CAMERA_FOCUS",
        0x2D => "UNKNOWN_2D",
        0x2E => "UNKNOWN_2E",
        0x2F => "UNKNOWN_2F",
        0x30 => "TRIAL_CAMERA",
        0x31 => "UNKNOWN_31",
        0x32 => "UNKNOWN_32",
        0x33 => "LOAD_MAP",
        0x34 => "SCRIPT",
        0x35 => "STOP_SCRIPT",
        0x36 => "RUN_SCRIPT",
        0x37 => "UNKNOWN_37",
        0x38 => "UNKNOWN_38",
        0x39 => "UNKNOWN_39",
        0x3A => "NONSTOP_DEBATE",
        0x3B => "UNKNOWN_3B",
        0x3C => "UNKNOWN_3C",
        _ => "UNKNOWN",
    }
}

/// Check if data looks like UTF-16LE text
fn is_utf16le_text(data: &[u8]) -> bool {
    if data.len() < 4 {
        return false;
    }
    // UTF-16LE pattern: ASCII char followed by 0x00
    // Check first few characters
    let mut utf16_count = 0;
    for i in (0..data.len().min(20)).step_by(2) {
        if i + 1 < data.len() {
            let low = data[i];
            let high = data[i + 1];
            // Printable ASCII in UTF-16LE: 0x20-0x7E followed by 0x00
            // Or newline (0x0A, 0x0D)
            if high == 0 && ((0x20..=0x7E).contains(&low) || low == 0x0A || low == 0x0D) {
                utf16_count += 1;
            }
        }
    }
    utf16_count >= 5
}

/// Parse script_pak files (UTF-16LE text with dialogues)
fn parse_script_pak_text(data: &[u8], path: &str, filename: &str) -> Result<LinFile, String> {
    let mut strings = Vec::new();
    
    // Decode UTF-16LE
    let text = decode_utf16le(data);
    
    // Split into lines and extract dialogues
    let lines: Vec<&str> = text.split('\n').collect();
    let mut text_index = 0u32;
    
    for line in &lines {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.len() < 2 {
            continue;
        }
        
        // Skip control codes and metadata
        if trimmed.starts_with('\u{FFFE}') || trimmed.starts_with('\u{FEFF}') {
            continue;
        }
        
        strings.push(LinString {
            index: text_index,
            offset: 0,
            text: trimmed.to_string(),
            speaker_id: None,
            speaker_name: None,
        });
        text_index += 1;
    }
    
    log::info!("📜 Script PAK estratto: {} ({} stringhe)", filename, strings.len());
    
    Ok(LinFile {
        path: path.to_string(),
        header: LinHeader {
            signature: "SCRIPT_PAK".to_string(),
            version: 0,
            entry_count: 0,
            string_count: strings.len() as u32,
        },
        entries: Vec::new(),
        strings,
    })
}

/// Decode UTF-16LE bytes to String
fn decode_utf16le(data: &[u8]) -> String {
    let mut result = String::new();
    let mut i = 0;
    
    // Skip BOM if present
    if data.len() >= 2 && data[0] == 0xFF && data[1] == 0xFE {
        i = 2;
    }
    
    while i + 1 < data.len() {
        let code = u16::from_le_bytes([data[i], data[i + 1]]);
        i += 2;
        
        if code == 0 {
            continue;
        }
        
        if let Some(c) = char::from_u32(code as u32) {
            result.push(c);
        }
    }
    
    result
}

/// Decode UTF-16BE bytes to String
fn decode_utf16be(data: &[u8]) -> String {
    let mut result = String::new();
    let mut i = 0;
    
    // Skip BOM if present (BE BOM = FE FF)
    if data.len() >= 2 && data[0] == 0xFE && data[1] == 0xFF {
        i = 2;
    }
    
    while i + 1 < data.len() {
        let code = u16::from_be_bytes([data[i], data[i + 1]]);
        i += 2;
        
        if code == 0 {
            continue;
        }
        
        if let Some(c) = char::from_u32(code as u32) {
            result.push(c);
        }
    }
    
    result
}

/// Auto-detect UTF-16 endianness and decode
/// Returns (decoded_text, encoding_name)
fn decode_utf16_auto(data: &[u8]) -> (String, &'static str) {
    if data.len() < 2 {
        return (String::new(), "empty");
    }
    
    // Check BOM first
    if data[0] == 0xFF && data[1] == 0xFE {
        return (decode_utf16le(data), "UTF-16LE (BOM)");
    }
    if data[0] == 0xFE && data[1] == 0xFF {
        return (decode_utf16be(data), "UTF-16BE (BOM)");
    }
    
    // Handle files starting with 00 FF FE (null + LE BOM)
    if data.len() >= 3 && data[0] == 0x00 && data[1] == 0xFF && data[2] == 0xFE {
        return (decode_utf16le(&data[1..]), "UTF-16LE (0+BOM)");
    }
    
    // Auto-detect by checking byte patterns
    // UTF-16BE: high byte first, so ASCII chars have 0x00 as first byte
    // UTF-16LE: low byte first, so ASCII chars have 0x00 as second byte
    let mut be_score = 0i32;
    let mut le_score = 0i32;
    let check_len = data.len().min(40);
    
    for i in (0..check_len).step_by(2) {
        if i + 1 >= data.len() { break; }
        let b0 = data[i];
        let b1 = data[i + 1];
        // BE pattern: 0x00 followed by printable ASCII
        if b0 == 0x00 && (0x20..=0x7E).contains(&b1) { be_score += 1; }
        // LE pattern: printable ASCII followed by 0x00
        if b1 == 0x00 && (0x20..=0x7E).contains(&b0) { le_score += 1; }
    }
    
    if be_score > le_score && be_score >= 3 {
        (decode_utf16be(data), "UTF-16BE")
    } else if le_score >= 3 {
        (decode_utf16le(data), "UTF-16LE")
    } else {
        // Can't determine — try BE first (majority of DR1 files)
        let be_text = decode_utf16be(data);
        let ascii_ratio = be_text.chars().filter(|c| c.is_ascii()).count() as f64 / be_text.len().max(1) as f64;
        if ascii_ratio > 0.5 {
            (be_text, "UTF-16BE (guess)")
        } else {
            (decode_utf16le(data), "UTF-16LE (guess)")
        }
    }
}

/// Decompress SPC/CMP compressed data (Danganronpa compression)
fn decompress_spc(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < 16 {
        return Err("File SPC troppo piccolo".to_string());
    }
    
    // SPC header: magic(4) + unknown(4) + decompressed_size(4) + compressed_size(4)
    let magic = &data[0..4];
    
    if magic == b"SPC " {
        // SPC format
        let decompressed_size = u32::from_le_bytes([data[8], data[9], data[10], data[11]]) as usize;
        let _compressed_size = u32::from_le_bytes([data[12], data[13], data[14], data[15]]) as usize;
        
        let mut output = Vec::with_capacity(decompressed_size);
        let mut pos = 16usize;
        
        while pos < data.len() && output.len() < decompressed_size {
            let flag = data[pos];
            pos += 1;
            
            if flag == 0 {
                // Literal byte
                if pos < data.len() {
                    output.push(data[pos]);
                    pos += 1;
                }
            } else if flag < 0x80 {
                // Copy from input
                let count = flag as usize;
                for _ in 0..count {
                    if pos < data.len() {
                        output.push(data[pos]);
                        pos += 1;
                    }
                }
            } else {
                // LZ copy from output buffer
                if pos + 1 < data.len() {
                    let offset = u16::from_le_bytes([data[pos], data[pos + 1]]) as usize;
                    pos += 2;
                    let count = ((flag & 0x7F) as usize) + 3;
                    
                    for i in 0..count {
                        if output.len() > offset {
                            let idx = output.len() - offset - 1 + (i % (offset + 1));
                            if idx < output.len() {
                                output.push(output[idx]);
                            }
                        }
                    }
                }
            }
        }
        
        Ok(output)
    } else if magic == b"$CMP" {
        // CMP format - try simple zlib decompression
        // Skip header and try to decompress
        let compressed = &data[16..];
        
        // Try miniz/deflate
        use std::io::Read;
        let mut decoder = flate2::read::DeflateDecoder::new(compressed);
        let mut output = Vec::new();
        
        match decoder.read_to_end(&mut output) {
            Ok(_) => Ok(output),
            Err(_) => {
                // Fallback: return raw data without header
                Ok(data[16..].to_vec())
            }
        }
    } else {
        // Not compressed, return as-is
        Ok(data.to_vec())
    }
}

/// Estrai file LIN (script Danganronpa)
#[command]
pub fn extract_lin_file(lin_path: String) -> Result<LinFile, String> {
    let path = Path::new(&lin_path);
    
    if !path.exists() {
        return Err("File LIN non trovato".to_string());
    }
    
    let raw_data = fs::read(&lin_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    if raw_data.len() < 4 {
        return Err("File troppo piccolo".to_string());
    }
    
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    // Check if it's a script_pak file (UTF-16LE text)
    if filename.starts_with("script_pak") || is_utf16le_text(&raw_data) {
        return parse_script_pak_text(&raw_data, &lin_path, &filename);
    }
    
    // Check if file is SPC compressed (Danganronpa compression)
    let data = if raw_data.len() >= 4 && (&raw_data[0..4] == b"SPC " || &raw_data[0..4] == b"$CMP") {
        decompress_spc(&raw_data)?
    } else {
        raw_data
    };
    
    // Parse header
    // LIN format: tipo 1 (DR1/DR2) o tipo 2 (V3)
    let header_type = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
    
    let (entries, strings) = if header_type == 1 || header_type == 2 {
        // Tipo 1/2: Header semplice
        parse_lin_type1(&data)?
    } else {
        // Prova parsing alternativo
        parse_lin_simple(&data)?
    };
    
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    log::info!("📜 LIN estratto: {} ({} entries, {} stringhe)", 
        filename, entries.len(), strings.len());
    
    Ok(LinFile {
        path: lin_path,
        header: LinHeader {
            signature: format!("LIN Type {}", header_type),
            version: header_type,
            entry_count: entries.len() as u32,
            string_count: strings.len() as u32,
        },
        entries,
        strings,
    })
}

/// Parse LIN type 1 (DR1, DR2)
fn parse_lin_type1(data: &[u8]) -> Result<(Vec<LinEntry>, Vec<LinString>), String> {
    let mut entries = Vec::new();
    let mut strings = Vec::new();
    
    if data.len() < 8 {
        return Err("Dati insufficienti".to_string());
    }
    
    let _header_type = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
    let text_block_offset = u32::from_le_bytes([data[4], data[5], data[6], data[7]]) as usize;
    
    // Script block starts at offset 8
    let mut pos = 8usize;
    let mut entry_index = 0u32;
    let mut _current_speaker: Option<u32> = None;
    
    while pos < text_block_offset && pos < data.len() {
        if data[pos] != 0x70 {
            pos += 1;
            continue;
        }
        
        pos += 1; // Skip 0x70 marker
        
        if pos >= data.len() {
            break;
        }
        
        let opcode = data[pos];
        pos += 1;
        
        let opcode_name = get_opcode_name(opcode).to_string();
        let mut args = Vec::new();
        let mut description = String::new();
        
        // Get argument count based on opcode
        let arg_count = get_opcode_arg_count(opcode);
        
        for _ in 0..arg_count {
            if pos + 1 < data.len() {
                let arg = u16::from_le_bytes([data[pos], data[pos + 1]]);
                args.push(arg);
                pos += 2;
            }
        }
        
        // Handle specific opcodes
        match opcode {
            0x14 => { // SPEAKER
                if !args.is_empty() {
                    _current_speaker = Some(args[0] as u32);
                    let speaker_name = get_dr1_character_name(args[0] as u32);
                    description = format!("Speaker: {} (ID: {})", speaker_name, args[0]);
                }
            }
            0x02 => { // TEXT
                if !args.is_empty() {
                    let text_index = args[0] as u32;
                    description = format!("Text index: {}", text_index);
                }
            }
            _ => {
                if !args.is_empty() {
                    description = format!("Args: {:?}", args);
                }
            }
        }
        
        entries.push(LinEntry {
            index: entry_index,
            opcode,
            opcode_name,
            args: args.clone(),
            description,
        });
        
        entry_index += 1;
    }
    
    // Parse text block
    if text_block_offset < data.len() {
        strings = parse_text_block(&data[text_block_offset..], &entries)?;
    }
    
    Ok((entries, strings))
}

/// Get argument count for opcode
fn get_opcode_arg_count(opcode: u8) -> usize {
    match opcode {
        0x00 => 2, // TEXT_COUNT
        0x02 => 1, // TEXT
        0x03 => 2, // FORMAT
        0x04 => 3, // FILTER
        0x05 => 2, // MOVIE
        0x06 => 3, // ANIMATION
        0x07 => 2, // VOICE
        0x08 => 3, // MUSIC
        0x09 => 2, // SFX
        0x0A => 2, // TRUTH_BULLET
        0x0D => 1, // SET_LABEL
        0x0E => 2, // CHOICE
        0x11 => 0, // WAIT_INPUT
        0x12 => 1, // WAIT_FRAME
        0x13 => 0, // END_FLAG
        0x14 => 1, // SPEAKER
        0x15 => 2, // SCREEN_FLASH
        0x17 => 2, // SHOW_BACKGROUND
        0x19 => 3, // SPRITE
        0x1A => 2, // SCREEN_FLASH_2
        0x1B => 2, // SCREEN_SHAKE
        0x1C => 1, // AUTO_ADVANCE
        0x21 => 3, // SPRITE_2
        0x25 => 2, // CG
        0x2C => 2, // CAMERA_FOCUS
        0x30 => 3, // TRIAL_CAMERA
        0x33 => 3, // LOAD_MAP
        0x34 => 2, // SCRIPT
        0x35 => 0, // STOP_SCRIPT
        0x36 => 2, // RUN_SCRIPT
        0x3A => 3, // NONSTOP_DEBATE
        _ => 0,
    }
}

/// Parse text block
fn parse_text_block(data: &[u8], entries: &[LinEntry]) -> Result<Vec<LinString>, String> {
    let mut strings = Vec::new();
    
    if data.len() < 4 {
        return Ok(strings);
    }
    
    // Text block header: count of strings
    let string_count = if data.len() >= 4 {
        u32::from_le_bytes([data[0], data[1], data[2], data[3]]) as usize
    } else {
        0
    };
    
    // String table offset
    let table_offset = 4usize;
    
    // Find speaker for each text
    let mut speaker_map: std::collections::HashMap<u32, u32> = std::collections::HashMap::new();
    let mut last_speaker: Option<u32> = None;
    
    for entry in entries {
        if entry.opcode == 0x14 && !entry.args.is_empty() { // SPEAKER
            last_speaker = Some(entry.args[0] as u32);
        } else if entry.opcode == 0x02 && !entry.args.is_empty() { // TEXT
            let text_idx = entry.args[0] as u32;
            if let Some(speaker) = last_speaker {
                speaker_map.insert(text_idx, speaker);
            }
        }
    }
    
    // Parse string offsets and data
    for i in 0..string_count.min(1000) {
        let offset_pos = table_offset + (i * 4);
        
        if offset_pos + 4 > data.len() {
            break;
        }
        
        let string_offset = u32::from_le_bytes([
            data[offset_pos], 
            data[offset_pos + 1], 
            data[offset_pos + 2], 
            data[offset_pos + 3]
        ]) as usize;
        
        if string_offset >= data.len() {
            continue;
        }
        
        // Read null-terminated string (UTF-16LE for Danganronpa)
        let text = read_utf16_string(&data[string_offset..]);
        
        if text.is_empty() {
            continue;
        }
        
        let speaker_id = speaker_map.get(&(i as u32)).copied();
        let speaker_name = speaker_id.map(|id| get_dr1_character_name(id).to_string());
        
        strings.push(LinString {
            index: i as u32,
            offset: string_offset as u32,
            text,
            speaker_id,
            speaker_name,
        });
    }
    
    Ok(strings)
}

/// Read UTF-16LE string
fn read_utf16_string(data: &[u8]) -> String {
    let mut chars = Vec::new();
    let mut i = 0;
    
    while i + 1 < data.len() {
        let code = u16::from_le_bytes([data[i], data[i + 1]]);
        
        if code == 0 {
            break;
        }
        
        // Handle special characters
        if code == 0x000A { // Newline
            chars.push('\n');
        } else if !(0xD800..=0xDFFF).contains(&code) {
            if let Some(c) = char::from_u32(code as u32) {
                chars.push(c);
            }
        }
        
        i += 2;
    }
    
    chars.into_iter().collect()
}

/// Parse LIN simple (fallback)
fn parse_lin_simple(data: &[u8]) -> Result<(Vec<LinEntry>, Vec<LinString>), String> {
    let entries = Vec::new();
    let mut strings = Vec::new();
    
    // Try to find text patterns directly
    let mut text_index = 0u32;
    
    // Search for UTF-16 strings
    let mut i = 0;
    while i < data.len().saturating_sub(4) {
        // Look for printable UTF-16 sequences
        if data[i] != 0 && data[i + 1] == 0 && data[i].is_ascii_graphic() {
            let text = read_utf16_string(&data[i..]);
            if text.len() >= 3 && !text.chars().all(|c| c.is_ascii_digit()) {
                strings.push(LinString {
                    index: text_index,
                    offset: i as u32,
                    text,
                    speaker_id: None,
                    speaker_name: None,
                });
                text_index += 1;
            }
        }
        i += 2;
    }
    
    Ok((entries, strings))
}

/// Estrai tutti i dialoghi da file LIN per traduzione
#[command]
pub fn extract_lin_dialogues(lin_path: String) -> Result<LinExtractionResult, String> {
    let lin_file = extract_lin_file(lin_path.clone())?;
    
    let filename = Path::new(&lin_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let dialogues: Vec<LinDialogue> = lin_file.strings.iter()
        .filter(|s| !s.text.is_empty())
        .map(|s| LinDialogue {
            id: format!("{}_{}", filename.replace('.', "_"), s.index),
            speaker: s.speaker_name.clone().unwrap_or_else(|| "???".to_string()),
            original: s.text.clone(),
            translated: String::new(),
            file: filename.clone(),
            line_index: s.index,
        })
        .collect();
    
    let total_count = dialogues.len() as u32;
    
    log::info!("💬 Estratti {} dialoghi da {}", total_count, filename);
    
    Ok(LinExtractionResult {
        success: true,
        message: format!("Estratti {} dialoghi", total_count),
        dialogues,
        total_count,
    })
}

/// Salva dialoghi LIN in JSON
#[command]
pub fn save_lin_dialogues(
    output_path: String,
    dialogues: Vec<LinDialogue>,
) -> Result<u32, String> {
    let json = serde_json::to_string_pretty(&dialogues)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&output_path, json)
        .map_err(|e| format!("Errore scrittura: {}", e))?;
    
    let count = dialogues.len() as u32;
    log::info!("💾 Salvati {} dialoghi LIN", count);
    
    Ok(count)
}

/// Carica dialoghi LIN da JSON
#[command]
pub fn load_lin_dialogues(input_path: String) -> Result<Vec<LinDialogue>, String> {
    let content = fs::read_to_string(&input_path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let dialogues: Vec<LinDialogue> = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing: {}", e))?;
    
    log::info!("📂 Caricati {} dialoghi LIN", dialogues.len());
    
    Ok(dialogues)
}

/// Statistiche dialoghi LIN
#[command]
pub fn get_lin_dialogue_stats(dialogues: Vec<LinDialogue>) -> LinDialogueStats {
    let total = dialogues.len();
    let translated = dialogues.iter().filter(|d| !d.translated.is_empty()).count();
    let untranslated = total - translated;
    let percentage = if total > 0 { (translated * 100) / total } else { 0 };
    
    // Count by speaker
    let mut by_speaker: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for d in &dialogues {
        *by_speaker.entry(d.speaker.clone()).or_default() += 1;
    }
    
    LinDialogueStats {
        total,
        translated,
        untranslated,
        percentage,
        by_speaker,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinDialogueStats {
    pub total: usize,
    pub translated: usize,
    pub untranslated: usize,
    pub percentage: usize,
    pub by_speaker: std::collections::HashMap<String, usize>,
}

// ============================================================================
// IMPORT DA DRAT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DratImportResult {
    pub success: bool,
    pub message: String,
    pub imported_count: usize,
    pub matched_count: usize,
}

/// Import traduzioni da file DRAT (JSON o TXT)
#[command]
pub fn import_drat_translations(
    drat_path: String,
    dialogues: Vec<LinDialogue>,
) -> Result<(Vec<LinDialogue>, DratImportResult), String> {
    let path = Path::new(&drat_path);
    
    if !path.exists() {
        return Err("File DRAT non trovato".to_string());
    }
    
    let content = fs::read_to_string(&drat_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    let mut updated_dialogues = dialogues.clone();
    let mut matched_count = 0usize;
    let mut imported_count = 0usize;
    
    if ext == "json" {
        // Parse JSON DRAT format
        // DRAT JSON: array of { "original": "...", "translation": "..." }
        // or { "texts": [...] }
        
        if let Ok(json_data) = serde_json::from_str::<serde_json::Value>(&content) {
            let texts = if let Some(arr) = json_data.as_array() {
                arr.clone()
            } else if let Some(obj) = json_data.as_object() {
                obj.get("texts")
                    .and_then(|t| t.as_array())
                    .cloned()
                    .unwrap_or_default()
            } else {
                Vec::new()
            };
            
            for item in texts {
                if let Some(obj) = item.as_object() {
                    let original = obj.get("original")
                        .or_else(|| obj.get("text"))
                        .or_else(|| obj.get("source"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    
                    let translation = obj.get("translation")
                        .or_else(|| obj.get("translated"))
                        .or_else(|| obj.get("target"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    
                    if !original.is_empty() && !translation.is_empty() {
                        imported_count += 1;
                        
                        // Match by original text
                        for dialogue in &mut updated_dialogues {
                            if dialogue.original.trim() == original.trim() {
                                dialogue.translated = translation.to_string();
                                matched_count += 1;
                            }
                        }
                    }
                }
            }
        }
    } else {
        // Parse TXT format (tab-separated or line pairs)
        let lines: Vec<&str> = content.lines().collect();
        
        // Try tab-separated format first: original\ttranslation
        let mut i = 0;
        while i < lines.len() {
            let line = lines[i].trim();
            
            if line.contains('\t') {
                // Tab-separated
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 2 {
                    let original = parts[0].trim();
                    let translation = parts[1].trim();
                    
                    if !original.is_empty() && !translation.is_empty() {
                        imported_count += 1;
                        
                        for dialogue in &mut updated_dialogues {
                            if dialogue.original.trim() == original {
                                dialogue.translated = translation.to_string();
                                matched_count += 1;
                            }
                        }
                    }
                }
                i += 1;
            } else if i + 1 < lines.len() {
                // Line pairs format: original on one line, translation on next
                let original = line;
                let translation = lines[i + 1].trim();
                
                if !original.is_empty() && !translation.is_empty() && !original.starts_with('#') {
                    imported_count += 1;
                    
                    for dialogue in &mut updated_dialogues {
                        if dialogue.original.trim() == original {
                            dialogue.translated = translation.to_string();
                            matched_count += 1;
                        }
                    }
                }
                i += 2;
            } else {
                i += 1;
            }
        }
    }
    
    let result = DratImportResult {
        success: matched_count > 0,
        message: format!(
            "Importate {} traduzioni, {} corrispondenze trovate su {} dialoghi",
            imported_count, matched_count, updated_dialogues.len()
        ),
        imported_count,
        matched_count,
    };
    
    log::info!("📥 DRAT import: {}", result.message);
    
    Ok((updated_dialogues, result))
}

// ============================================================================
// TRADUZIONE AUTOMATICA COMPLETA
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoTranslateResult {
    pub success: bool,
    pub message: String,
    pub total_strings: u32,
    pub translated_strings: u32,
    pub failed_strings: u32,
    pub output_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationProgress {
    pub current: u32,
    pub total: u32,
    pub current_text: String,
    pub percentage: u8,
}

/// Estrazione SOLO dialoghi da un gioco Danganronpa (senza traduzione)
/// Il frontend si occupa della traduzione con API AI
#[command]
pub fn extract_danganronpa_dialogues(
    game_path: String,
) -> Result<ExtractResult, String> {
    log::info!("🔍 Estrazione dialoghi Danganronpa: {}", game_path);
    
    let game_dir = Path::new(&game_path);
    if !game_dir.exists() {
        return Err("Cartella gioco non trovata".to_string());
    }
    
    // Crea cartella output
    let output_dir = game_dir.join("GameStringer_Translation");
    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Errore creazione cartella output: {}", e))?;
    
    // Trova file PAK
    let pak_files = find_pak_files(&game_path)?;
    log::info!("📦 Trovati {} file PAK/WAD", pak_files.len());
    
    let mut all_dialogues: Vec<LinDialogue> = Vec::new();
    
    let mut files_processed = 0u32;
    let mut files_with_dialogues = 0u32;
    
    for pak_path in &pak_files {
        let pak_name = Path::new(pak_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");
        let pak_ext = Path::new(pak_path).extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        
        // Salta file non testuali (solo per .pak, i .lin sono sempre dialogo)
        if pak_ext != "lin" && (pak_name.contains("bg_") || pak_name.contains("tex_") || 
           pak_name.contains("sprite") || pak_name.contains("model") ||
           pak_name.contains("font")) {
            continue;
        }
        
        files_processed += 1;
        match extract_dialogues_from_pak(pak_path) {
            Ok(dialogues) => {
                if !dialogues.is_empty() {
                    files_with_dialogues += 1;
                }
                all_dialogues.extend(dialogues);
            }
            Err(e) => {
                log::warn!("⚠️ Errore estrazione {}: {}", pak_name, e);
            }
        }
    }
    
    log::info!("📊 Processati {}/{} file, {} con dialoghi, {} stringhe totali",
        files_processed, pak_files.len(), files_with_dialogues, all_dialogues.len());
    
    // Filtra SOLO stringhe da fallback (non da LIN parser) — rimuovi garbage binario
    // Le stringhe da LIN/UTF-16LE sono già validate, applica solo filtro minimo
    all_dialogues.retain(|d| {
        let t = d.original.trim();
        // Rimuovi stringhe vuote o troppo corte
        if t.len() < 2 { return false; }
        // Rimuovi stringhe con solo caratteri speciali/numeri
        if !t.chars().any(|c| c.is_alphabetic()) { return false; }
        true
    });
    
    let total = all_dialogues.len() as u32;
    log::info!("📝 Totale dialoghi filtrati: {} (dopo filtro qualità)", total);
    
    // Salva originali
    let originals_path = output_dir.join("originals.json");
    let json = serde_json::to_string_pretty(&all_dialogues)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    fs::write(&originals_path, &json)
        .map_err(|e| format!("Errore salvataggio: {}", e))?;
    
    Ok(ExtractResult {
        success: total > 0,
        total_strings: total,
        output_path: output_dir.to_string_lossy().to_string(),
        dialogues: all_dialogues,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractResult {
    pub success: bool,
    pub total_strings: u32,
    pub output_path: String,
    pub dialogues: Vec<LinDialogue>,
}

/// Traduzione automatica COMPLETA di un gioco Danganronpa (LEGACY - usa extract_danganronpa_dialogues)
/// Estrae → Traduce con AI → Prepara per repack
#[command]
pub async fn auto_translate_danganronpa(
    game_path: String,
    target_lang: String,
    ai_provider: String,
) -> Result<AutoTranslateResult, String> {
    log::info!("🚀 Avvio traduzione automatica Danganronpa: {}", game_path);
    
    let game_dir = Path::new(&game_path);
    if !game_dir.exists() {
        return Err("Cartella gioco non trovata".to_string());
    }
    
    // 1. Crea cartella output
    let output_dir = game_dir.join("GameStringer_Translation");
    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Errore creazione cartella output: {}", e))?;
    
    // 2. Trova tutti i file con testo traducibile
    let pak_files = find_pak_files(&game_path)?;
    log::info!("📦 Trovati {} file PAK/WAD", pak_files.len());
    
    let mut total_strings = 0u32;
    let mut translated_strings = 0u32;
    let mut failed_strings = 0u32;
    let mut all_dialogues: Vec<LinDialogue> = Vec::new();
    
    // 3. Estrai testi da ogni file
    for pak_path in &pak_files {
        let pak_name = Path::new(pak_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");
        
        // Salta file non testuali
        if pak_name.contains("bg_") || pak_name.contains("tex_") || 
           pak_name.contains("sprite") || pak_name.contains("model") ||
           pak_name.contains("font") {
            continue;
        }
        
        log::info!("📜 Elaborazione: {}", pak_name);
        
        // Estrai dialoghi
        match extract_dialogues_from_pak(pak_path) {
            Ok(dialogues) => {
                total_strings += dialogues.len() as u32;
                all_dialogues.extend(dialogues);
            }
            Err(e) => {
                log::warn!("⚠️ Errore estrazione {}: {}", pak_name, e);
            }
        }
    }
    
    log::info!("📝 Totale stringhe estratte: {}", total_strings);
    
    // 4. Salva file originali per riferimento
    let originals_path = output_dir.join("originals.json");
    let originals_json = serde_json::to_string_pretty(&all_dialogues)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    fs::write(&originals_path, &originals_json)
        .map_err(|e| format!("Errore salvataggio originali: {}", e))?;
    
    // 5. Prepara batch per traduzione
    let mut translated_dialogues = all_dialogues.clone();
    let batch_size = 50;
    let total_batches = all_dialogues.len().div_ceil(batch_size);
    
    log::info!("🌐 Avvio traduzione: {} batch da {} stringhe", total_batches, batch_size);
    
    for (batch_idx, chunk) in all_dialogues.chunks(batch_size).enumerate() {
        let texts: Vec<String> = chunk.iter()
            .filter(|d| !d.original.is_empty() && d.original.len() > 1)
            .map(|d| d.original.clone())
            .collect();
        
        if texts.is_empty() {
            continue;
        }
        
        log::info!("📤 Batch {}/{}: {} testi", batch_idx + 1, total_batches, texts.len());
        
        // Chiama API traduzione (integra con sistema esistente)
        match translate_batch_internal(&texts, "en", &target_lang, &ai_provider).await {
            Ok(translations) => {
                // Applica traduzioni
                let start_idx = batch_idx * batch_size;
                for (i, translation) in translations.iter().enumerate() {
                    let global_idx = start_idx + i;
                    if global_idx < translated_dialogues.len() {
                        translated_dialogues[global_idx].translated = translation.clone();
                        translated_strings += 1;
                    }
                }
            }
            Err(e) => {
                log::error!("❌ Errore batch {}: {}", batch_idx + 1, e);
                failed_strings += texts.len() as u32;
            }
        }
        
        // Pausa tra batch per evitare rate limiting
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }
    
    // 6. Salva traduzioni completate
    let translations_path = output_dir.join("translations.json");
    let translations_json = serde_json::to_string_pretty(&translated_dialogues)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    fs::write(&translations_path, &translations_json)
        .map_err(|e| format!("Errore salvataggio traduzioni: {}", e))?;
    
    // 7. Genera file PO per DRAT
    let po_path = output_dir.join("danganronpa_translation.po");
    generate_po_from_dialogues(&translated_dialogues, &po_path)?;
    
    // 8. Genera TSV per importazione facile
    let tsv_path = output_dir.join("translations.tsv");
    generate_tsv_from_dialogues(&translated_dialogues, &tsv_path)?;
    
    let result = AutoTranslateResult {
        success: translated_strings > 0,
        message: format!(
            "Traduzione completata! {} su {} stringhe tradotte ({} errori)",
            translated_strings, total_strings, failed_strings
        ),
        total_strings,
        translated_strings,
        failed_strings,
        output_path: output_dir.to_string_lossy().to_string(),
    };
    
    log::info!("✅ {}", result.message);
    
    Ok(result)
}

/// Prova a parsare dati binari come script LIN e restituisce i dialoghi
fn try_parse_lin_data(data: &[u8], pak_name: &str, entry_name: &str) -> Vec<LinDialogue> {
    let mut dialogues = Vec::new();
    
    if data.len() < 8 {
        return dialogues;
    }
    
    // Check header: LIN type 1/2 hanno header_type = 1 o 2
    let header_type = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
    if header_type != 1 && header_type != 2 {
        return dialogues;
    }
    
    let text_block_offset = u32::from_le_bytes([data[4], data[5], data[6], data[7]]) as usize;
    if text_block_offset == 0 || text_block_offset >= data.len() {
        return dialogues;
    }
    
    // Prova parsing LIN
    if let Ok((entries, strings)) = parse_lin_type1(data) {
        for s in &strings {
            if s.text.is_empty() || s.text.len() > 500 {
                continue;
            }
            let speaker = s.speaker_name.clone().unwrap_or_default();
            dialogues.push(LinDialogue {
                id: format!("{}_{}_s{}", pak_name, entry_name.replace('.', "_"), s.index),
                speaker,
                original: s.text.clone(),
                translated: String::new(),
                file: format!("{}/{}", pak_name, entry_name),
                line_index: s.index,
            });
        }
        if !dialogues.is_empty() {
            log::info!("📜 LIN parsed {}/{}: {} entries, {} dialogues", 
                pak_name, entry_name, entries.len(), dialogues.len());
        }
    }
    
    dialogues
}

/// Estrai dialoghi da un file PAK (usa parser LIN per dialoghi reali)
fn extract_dialogues_from_pak(pak_path: &str) -> Result<Vec<LinDialogue>, String> {
    // Limite dimensione file: max 50MB
    let metadata = fs::metadata(pak_path)
        .map_err(|e| format!("Errore metadata: {}", e))?;
    
    if metadata.len() > 50_000_000 {
        log::warn!("⚠️ File troppo grande, saltato: {} ({} MB)", pak_path, metadata.len() / 1_000_000);
        return Ok(Vec::new());
    }
    
    let data = fs::read(pak_path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let pak_name = Path::new(pak_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");
    
    let mut dialogues = Vec::new();
    let pak_ext = Path::new(pak_path).extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    // 0. File .lin: dialoghi Danganronpa — auto-detect UTF-16 endianness
    if pak_ext == "lin" {
        if data.len() < 4 {
            return Ok(dialogues);
        }
        
        // DR1 .lin files sono testo UTF-16 (BE o LE) con dialoghi
        let (text, encoding) = decode_utf16_auto(&data);
        
        // Filtra: il testo decodificato deve contenere caratteri ASCII leggibili
        let ascii_count = text.chars().filter(|c| c.is_ascii_alphanumeric() || c.is_ascii_whitespace()).count();
        let ascii_ratio = ascii_count as f64 / text.len().max(1) as f64;
        
        if ascii_ratio < 0.3 || text.len() < 5 {
            // Non è testo leggibile — skip (file binario/compresso)
            return Ok(dialogues);
        }
        
        // DR1 usa ÿ (U+00FF) come delimitatore tra entry di testo.
        // Dopo ÿ c'è un byte FE+XX in UTF-16BE dove XX è la prima lettera del testo.
        // Splitta per ÿ, recupera la prima lettera, tronca garbage binario.
        let entries: Vec<String> = text.split('\u{00FF}')
            .map(|entry| {
                let trimmed = entry.trim_start_matches(['\n', '\r']);
                if trimmed.is_empty() { return String::new(); }
                
                // Recupera prima lettera mangiata dal control char FE+XX / FF+XX
                // In UTF-16BE, byte FE+XX diventa U+FEXX, il low byte XX è la lettera
                let mut chars = trimmed.chars();
                let mut result = String::new();
                if let Some(first) = chars.next() {
                    let code = first as u32;
                    if (0xFE00..=0xFEFF).contains(&code) {
                        // Recupera: low byte = prima lettera ASCII
                        let recovered = (code & 0xFF) as u8;
                        if (0x20..=0x7E).contains(&recovered) {
                            result.push(recovered as char);
                        }
                    } else if (0xFF00..=0xFFFF).contains(&code) {
                        let recovered = (code & 0xFF) as u8;
                        if (0x20..=0x7E).contains(&recovered) {
                            result.push(recovered as char);
                        }
                    } else if first.is_ascii() || ('\u{00C0}'..='\u{024F}').contains(&first) {
                        result.push(first);
                    }
                    // else: skip non-Latin first char
                }
                result.push_str(&chars.collect::<String>());
                
                // Tronca garbage binario: 3+ chars consecutivi non-Latin = bytecode
                let result_chars: Vec<char> = result.chars().collect();
                let mut non_latin_streak = 0usize;
                let mut truncate_idx = result_chars.len();
                for (i, &c) in result_chars.iter().enumerate() {
                    if c.is_ascii() || ('\u{00C0}'..='\u{024F}').contains(&c) {
                        non_latin_streak = 0;
                    } else {
                        non_latin_streak += 1;
                        if non_latin_streak >= 3 {
                            truncate_idx = i.saturating_sub(2);
                            break;
                        }
                    }
                }
                let clean: String = result_chars[..truncate_idx].iter().collect();
                
                // Unisci righe interne: \n → spazio (sono wrap visivi)
                let joined = clean.lines()
                    .map(|l| l.trim())
                    .filter(|l| !l.is_empty())
                    .collect::<Vec<&str>>()
                    .join(" ");
                
                // Rimuovi tag CLT: <CLT>, <CLT N>, </CLT>
                let mut no_clt = joined.clone();
                while let Some(start) = no_clt.find("<CLT") {
                    if let Some(end) = no_clt[start..].find('>') {
                        no_clt = format!("{}{}", &no_clt[..start], &no_clt[start + end + 1..]);
                    } else {
                        break;
                    }
                }
                no_clt.trim().to_string()
            })
            .filter(|entry| {
                let len = entry.len();
                if !(3..=2000).contains(&len) { return false; }
                // Deve contenere almeno una lettera ASCII
                entry.chars().any(|c| c.is_ascii_alphabetic())
            })
            .collect();
        
        if !entries.is_empty() {
            for (idx, entry) in entries.iter().enumerate() {
                dialogues.push(LinDialogue {
                    id: format!("{}_s{}", pak_name.replace('.', "_"), idx),
                    speaker: String::new(),
                    original: entry.clone(),
                    translated: String::new(),
                    file: pak_name.to_string(),
                    line_index: idx as u32,
                });
            }
            log::info!("📜 LIN {} {}: {} entry dialogo", encoding, pak_name, dialogues.len());
            return Ok(dialogues);
        }
        
        return Ok(dialogues);
    }
    
    // 1. Prova parsing come WAD AGAR
    if data.len() >= 4 && &data[0..4] == b"AGAR" {
        if let Ok(archive) = read_wad_archive(pak_path) {
            for entry in archive.entries.iter().take(500) {
                if entry.size == 0 || entry.size > 5_000_000 {
                    continue;
                }
                let start = entry.offset as usize;
                let end = start + entry.size as usize;
                if end > data.len() {
                    continue;
                }
                let entry_data = &data[start..end];
                let entry_name = if entry.name.is_empty() { 
                    format!("entry_{}", entry.offset) 
                } else { 
                    entry.name.clone() 
                };
                
                // a) Prova come script LIN (dialoghi con speaker)
                let lin_dialogues = try_parse_lin_data(entry_data, pak_name, &entry_name);
                if !lin_dialogues.is_empty() {
                    dialogues.extend(lin_dialogues);
                    continue;
                }
                
                // b) Prova SPC decompression + LIN
                if entry_data.len() >= 4 && (&entry_data[0..4] == b"SPC " || &entry_data[0..4] == b"$CMP") {
                    if let Ok(decompressed) = decompress_spc(entry_data) {
                        let lin_dialogues = try_parse_lin_data(&decompressed, pak_name, &entry_name);
                        if !lin_dialogues.is_empty() {
                            dialogues.extend(lin_dialogues);
                            continue;
                        }
                    }
                }
                
                // c) Fallback: UTF-16LE text (per script_pak e simili)
                if entry_name.contains("script") || is_utf16le_text(entry_data) {
                    let text = decode_utf16le(entry_data);
                    for (line_idx, line) in text.lines().take(200).enumerate() {
                        let trimmed = line.trim();
                        if trimmed.len() > 5 && trimmed.len() < 500 
                            && !trimmed.starts_with('\u{FFFE}')
                            && is_likely_dialogue(trimmed) {
                            dialogues.push(LinDialogue {
                                id: format!("{}_{}_t{}", pak_name, entry_name.replace('.', "_"), line_idx),
                                speaker: "".to_string(),
                                original: trimmed.to_string(),
                                translated: String::new(),
                                file: format!("{}/{}", pak_name, entry_name),
                                line_index: line_idx as u32,
                            });
                        }
                    }
                }
            }
        }
    }
    // 2. File LIN diretto (non dentro WAD)
    else if data.len() >= 8 {
        let lin_dialogues = try_parse_lin_data(&data, pak_name, pak_name);
        if !lin_dialogues.is_empty() {
            dialogues.extend(lin_dialogues);
        }
        // Prova SPC + LIN
        else if data.len() >= 4 && (&data[0..4] == b"SPC " || &data[0..4] == b"$CMP") {
            if let Ok(decompressed) = decompress_spc(&data) {
                let lin_dialogues = try_parse_lin_data(&decompressed, pak_name, pak_name);
                dialogues.extend(lin_dialogues);
            }
        }
        // UTF-16LE text diretto
        else if is_utf16le_text(&data) && data.len() < 5_000_000 {
            let text = decode_utf16le(&data);
            for (line_idx, line) in text.lines().take(500).enumerate() {
                let trimmed = line.trim();
                if trimmed.len() > 5 && trimmed.len() < 500 && is_likely_dialogue(trimmed) {
                    dialogues.push(LinDialogue {
                        id: format!("{}_{}", pak_name, line_idx),
                        speaker: "".to_string(),
                        original: trimmed.to_string(),
                        translated: String::new(),
                        file: pak_name.to_string(),
                        line_index: line_idx as u32,
                    });
                }
            }
        }
    }
    // NOTA: rimosso extract_strings_from_binary — produceva solo garbage
    
    log::info!("📄 {}: {} dialoghi estratti", pak_name, dialogues.len());
    Ok(dialogues)
}

/// Verifica se una stringa sembra un vero dialogo/testo di gioco
fn is_likely_dialogue(text: &str) -> bool {
    let trimmed = text.trim();
    // Troppo corta o troppo lunga
    if trimmed.len() < 8 || trimmed.len() > 400 {
        return false;
    }
    // DEVE contenere almeno uno spazio (dialoghi veri sono frasi con parole)
    if !trimmed.contains(' ') {
        return false;
    }
    // Deve contenere lettere
    let letter_count = trimmed.chars().filter(|c| c.is_alphabetic()).count();
    let letter_ratio = letter_count as f64 / trimmed.len() as f64;
    // Deve avere almeno 60% lettere (era 50%, troppo lasco)
    if letter_ratio < 0.6 { return false; }
    // Filtra path/URL
    if trimmed.contains('/') && trimmed.contains('.') { return false; }
    if trimmed.contains('\\') { return false; }
    if trimmed.starts_with("http") { return false; }
    // Filtra codice/variabili (troppe underscore, camelCase patterns)
    let underscore_count = trimmed.chars().filter(|&c| c == '_').count();
    if underscore_count > 1 { return false; }
    // Filtra stringhe tecniche (solo maiuscole + underscore)
    if trimmed.chars().all(|c| c.is_uppercase() || c == '_' || c == ' ' || c.is_ascii_digit()) && trimmed.len() > 3 {
        return false;
    }
    // Filtra stringhe con troppi caratteri speciali
    let special_count = trimmed.chars().filter(|c| !c.is_alphanumeric() && !c.is_whitespace() && *c != '.' && *c != ',' && *c != '!' && *c != '?' && *c != '\'' && *c != '"' && *c != '-').count();
    if special_count as f64 / trimmed.len() as f64 > 0.15 { return false; }
    // Deve contenere vocali (testo inglese reale ha vocali; garbage binario raramente)
    let vowel_count = trimmed.chars().filter(|c| "aeiouAEIOU".contains(*c)).count();
    if vowel_count == 0 { return false; }
    let vowel_ratio = vowel_count as f64 / letter_count.max(1) as f64;
    // Testo inglese ha ~35-45% vocali; sotto il 10% è garbage
    if vowel_ratio < 0.10 { return false; }
    // Deve avere almeno 30% lettere minuscole (testo reale è prevalentemente lowercase)
    let lowercase_count = trimmed.chars().filter(|c| c.is_lowercase()).count();
    let lowercase_ratio = lowercase_count as f64 / letter_count.max(1) as f64;
    if lowercase_ratio < 0.3 { return false; }
    // Conta "parole leggibili": sequenze di 2+ lettere separate da spazi
    let words: Vec<&str> = trimmed.split_whitespace()
        .filter(|w| w.chars().filter(|c| c.is_alphabetic()).count() >= 2)
        .collect();
    // Deve avere almeno 2 parole leggibili
    if words.len() < 2 { return false; }
    true
}

/// Estrai stringhe leggibili da dati binari
#[allow(dead_code)]
fn extract_strings_from_binary(data: &[u8]) -> Vec<String> {
    let mut strings = Vec::new();
    let mut current = String::new();
    
    for &byte in data {
        if (0x20..0x7F).contains(&byte) {
            current.push(byte as char);
        } else if !current.is_empty() {
            if current.len() >= 4 && current.chars().any(|c| c.is_alphabetic()) {
                // Filtra stringhe che sembrano testo reale
                if !current.chars().all(|c| c.is_ascii_digit() || c == '.' || c == '_') {
                    strings.push(current.clone());
                }
            }
            current.clear();
        }
    }
    
    if current.len() >= 4 {
        strings.push(current);
    }
    
    strings
}

/// Batch translation usando Ollama
async fn translate_batch_internal(
    texts: &[String],
    source_lang: &str,
    target_lang: &str,
    _ai_provider: &str,
) -> Result<Vec<String>, String> {
    let results = super::offline_translation::offline_translate_batch(
        texts.to_vec(),
        source_lang.to_string(),
        target_lang.to_string(),
        None,
    ).await?;
    
    Ok(results.into_iter().map(|r| r.translated).collect())
}

/// Genera file PO da dialoghi tradotti
fn generate_po_from_dialogues(dialogues: &[LinDialogue], output_path: &Path) -> Result<(), String> {
    let mut content = String::new();
    
    // Header PO
    content.push_str("# Danganronpa Translation - Generated by GameStringer\n");
    content.push_str("# https://github.com/GameStringer\n");
    content.push_str("msgid \"\"\n");
    content.push_str("msgstr \"\"\n");
    content.push_str("\"Content-Type: text/plain; charset=UTF-8\\n\"\n");
    content.push_str("\"Language: it\\n\"\n\n");
    
    for dialogue in dialogues {
        if dialogue.original.is_empty() {
            continue;
        }
        
        // Commento con info
        content.push_str(&format!("#: {}:{}\n", dialogue.file, dialogue.line_index));
        if !dialogue.speaker.is_empty() {
            content.push_str(&format!("#. Speaker: {}\n", dialogue.speaker));
        }
        
        // msgid e msgstr
        content.push_str(&format!("msgid \"{}\"\n", escape_po_string(&dialogue.original)));
        content.push_str(&format!("msgstr \"{}\"\n\n", escape_po_string(&dialogue.translated)));
    }
    
    fs::write(output_path, content)
        .map_err(|e| format!("Errore scrittura PO: {}", e))?;
    
    log::info!("📄 PO generato: {}", output_path.display());
    
    Ok(())
}

/// Genera file TSV da dialoghi tradotti
fn generate_tsv_from_dialogues(dialogues: &[LinDialogue], output_path: &Path) -> Result<(), String> {
    let mut content = String::new();
    
    // Header
    content.push_str("ID\tFile\tSpeaker\tOriginal\tTranslation\n");
    
    for dialogue in dialogues {
        content.push_str(&format!(
            "{}\t{}\t{}\t{}\t{}\n",
            dialogue.id,
            dialogue.file,
            dialogue.speaker,
            dialogue.original.replace('\t', " ").replace('\n', "\\n"),
            dialogue.translated.replace('\t', " ").replace('\n', "\\n"),
        ));
    }
    
    fs::write(output_path, content)
        .map_err(|e| format!("Errore scrittura TSV: {}", e))?;
    
    log::info!("📄 TSV generato: {}", output_path.display());
    
    Ok(())
}

// ============================================================================
// PARSER STX (String Table - DR2, V3)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StxFile {
    pub path: String,
    pub strings: Vec<StxString>,
    pub table_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StxString {
    pub table_id: u32,
    pub string_id: u32,
    pub text: String,
}

/// Parse file STX (String Table usato in DR2 e V3)
#[allow(dead_code)]
#[command]
pub fn parse_stx_file(stx_path: String) -> Result<StxFile, String> {
    let path = Path::new(&stx_path);
    
    if !path.exists() {
        return Err("File STX non trovato".to_string());
    }
    
    let data = fs::read(&stx_path)
        .map_err(|e| format!("Errore lettura STX: {}", e))?;
    
    if data.len() < 8 {
        return Err("File STX troppo piccolo".to_string());
    }
    
    let mut strings = Vec::new();
    
    // STX format: header + string tables
    // Header: magic "STX\0" (4) + table_count (4)
    let magic = &data[0..4];
    
    if magic == b"STX\0" || magic == b"STXT" {
        let table_count = u32::from_le_bytes([data[4], data[5], data[6], data[7]]);
        
        log::info!("📜 STX: {} tabelle", table_count);
        
        // Parse each table
        let mut pos = 8usize;
        
        for table_id in 0..table_count.min(100) {
            if pos + 8 > data.len() {
                break;
            }
            
            // Table header: string_count (4) + data_size (4)
            let string_count = u32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]]) as usize;
            pos += 4;
            let _data_size = u32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]]) as usize;
            pos += 4;
            
            // String offsets table
            let offsets_start = pos;
            pos += string_count * 4;
            
            // String data
            for string_id in 0..string_count.min(1000) {
                let offset_pos = offsets_start + string_id * 4;
                if offset_pos + 4 > data.len() {
                    break;
                }
                
                let string_offset = u32::from_le_bytes([
                    data[offset_pos], data[offset_pos+1], 
                    data[offset_pos+2], data[offset_pos+3]
                ]) as usize;
                
                let abs_offset = pos + string_offset;
                if abs_offset < data.len() {
                    let text = read_utf16_string(&data[abs_offset..]);
                    if !text.is_empty() && text.len() < 1000 {
                        strings.push(StxString {
                            table_id,
                            string_id: string_id as u32,
                            text,
                        });
                    }
                }
            }
        }
        
        log::info!("📜 STX estratto: {} stringhe", strings.len());
        
        Ok(StxFile {
            path: stx_path,
            strings,
            table_count,
        })
    } else {
        // Try as raw UTF-16LE text
        if is_utf16le_text(&data) {
            let text = decode_utf16le(&data);
            for (idx, line) in text.lines().enumerate() {
                let trimmed = line.trim();
                if !trimmed.is_empty() && trimmed.len() < 1000 {
                    strings.push(StxString {
                        table_id: 0,
                        string_id: idx as u32,
                        text: trimmed.to_string(),
                    });
                }
            }
        }
        
        Ok(StxFile {
            path: stx_path,
            strings,
            table_count: 1,
        })
    }
}

/// Estrai stringhe STX per traduzione
#[allow(dead_code)]
#[command]
pub fn extract_stx_for_translation(stx_path: String) -> Result<Vec<LinDialogue>, String> {
    let stx = parse_stx_file(stx_path.clone())?;
    
    let filename = Path::new(&stx_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");
    
    let dialogues: Vec<LinDialogue> = stx.strings.iter()
        .map(|s| LinDialogue {
            id: format!("{}_t{}_s{}", filename.replace('.', "_"), s.table_id, s.string_id),
            speaker: String::new(),
            original: s.text.clone(),
            translated: String::new(),
            file: filename.to_string(),
            line_index: s.string_id,
        })
        .collect();
    
    log::info!("📜 STX -> {} dialoghi per traduzione", dialogues.len());
    
    Ok(dialogues)
}

/// Export dialoghi in formato DRAT-compatibile
#[command]
pub fn export_for_drat(
    output_path: String,
    dialogues: Vec<LinDialogue>,
) -> Result<String, String> {
    let _path = Path::new(&output_path);
    
    // Create JSON format compatible with DRAT
    let export_data: Vec<serde_json::Value> = dialogues
        .iter()
        .map(|d| {
            serde_json::json!({
                "original": d.original,
                "translation": d.translated,
                "speaker": d.speaker,
                "file": d.file,
                "index": d.line_index
            })
        })
        .collect();
    
    let json_content = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&output_path, &json_content)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    log::info!("📤 Export DRAT: {} dialoghi salvati in {}", dialogues.len(), output_path);
    
    Ok(format!("Esportati {} dialoghi in formato DRAT", dialogues.len()))
}

// ============================================================================
// EXPORT PATCH DISTRIBUIBILE (.zip)
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPatchResult {
    pub success: bool,
    pub zip_path: String,
    pub zip_size_mb: f64,
    pub files_included: Vec<String>,
}

/// Esporta una patch distribuibile come .zip
#[command]
pub fn export_danganronpa_patch(
    game_path: String,
    output_path: String,
) -> Result<ExportPatchResult, String> {
    log::info!("📦 Export patch Danganronpa: {} → {}", game_path, output_path);

    let game_dir = Path::new(&game_path);
    let wad_path = game_dir.join("dr1_data_keyboard_us.wad");
    let translations_path = game_dir.join("GameStringer_Translation").join("translations.json");

    if !wad_path.exists() {
        return Err("WAD patchato non trovato (dr1_data_keyboard_us.wad). Applica prima la patch.".to_string());
    }

    let wad_size = fs::metadata(&wad_path)
        .map_err(|e| format!("Errore lettura WAD: {}", e))?
        .len();

    if wad_size < 100_000_000 {
        return Err(format!(
            "Il WAD sembra troppo piccolo ({:.1} MB). Assicurati che sia stato patchato con v15.",
            wad_size as f64 / 1_048_576.0
        ));
    }

    log::info!("   WAD: {:.1} MB", wad_size as f64 / 1_048_576.0);

    // README
    let readme = r#"========================================================
  DANGANRONPA: TRIGGER HAPPY HAVOC - PATCH ITALIANO
  Creato con GameStringer
========================================================

CONTENUTO PATCH
- dr1_data_keyboard_us.wad  : File di gioco patchato (italiano)
- translations.json         : Traduzioni sorgente (per modding)
- install.bat               : Installer automatico (Steam)

INSTALLAZIONE AUTOMATICA (consigliata)
1. Estrai lo .zip in una cartella qualsiasi
2. Doppio click su "install.bat"
3. Lo script trovera' il gioco su Steam e installera' la patch
4. Verra' creato un backup del file originale (.backup)

INSTALLAZIONE MANUALE
1. Steam -> Danganronpa -> Tasto destro -> Gestisci -> Sfoglia file locali
2. Fai un BACKUP di "dr1_data_keyboard_us.wad" (rinominalo .backup)
3. Copia il "dr1_data_keyboard_us.wad" di questa patch nella cartella

ATTIVAZIONE IN GIOCO
Impostazioni -> Control Hints -> seleziona "Keyboard and Mouse"
Il testo cambiera' in italiano!

DISINSTALLAZIONE
Rinomina "dr1_data_keyboard_us.wad.backup" in "dr1_data_keyboard_us.wad"
oppure verifica l'integrita' dei file su Steam.

CREDITI
- All-Ice Team: Traduzione base italiana completa
- GameStringer: Tool di traduzione e patch personalizzate
- Spike Chunsoft: Sviluppatore originale
"#;

    // install.bat
    let install_bat = r#"@echo off
chcp 65001 >nul 2>&1
title Danganronpa ITA Patch - GameStringer Installer
color 0A
echo.
echo  ========================================================
echo   DANGANRONPA: TRIGGER HAPPY HAVOC
echo   PATCH ITALIANO - GameStringer Installer
echo  ========================================================
echo.

set "STEAM_COMMON=C:\Program Files (x86)\Steam\steamapps\common"
set "GAME_FOLDER=Danganronpa Trigger Happy Havoc"
set "GAME_PATH=%STEAM_COMMON%\%GAME_FOLDER%"
set "WAD_NAME=dr1_data_keyboard_us.wad"

if not exist "%GAME_PATH%" (
    echo  [!] Gioco non trovato nel percorso Steam predefinito.
    echo      Cercando in altre posizioni...
    for /f "tokens=*" %%a in ('dir /b /s /ad "D:\SteamLibrary\steamapps\common\%GAME_FOLDER%" 2^>nul') do set "GAME_PATH=%%a"
    for /f "tokens=*" %%a in ('dir /b /s /ad "E:\SteamLibrary\steamapps\common\%GAME_FOLDER%" 2^>nul') do set "GAME_PATH=%%a"
)

if not exist "%GAME_PATH%" (
    echo  [ERRORE] Danganronpa non trovato! Installa il gioco da Steam.
    pause
    exit /b 1
)

echo  [OK] Gioco trovato: %GAME_PATH%
echo.

if exist "%GAME_PATH%\%WAD_NAME%" (
    if not exist "%GAME_PATH%\%WAD_NAME%.backup" (
        echo  [1/3] Creazione backup...
        copy "%GAME_PATH%\%WAD_NAME%" "%GAME_PATH%\%WAD_NAME%.backup" >nul
        echo        Backup creato: %WAD_NAME%.backup
    ) else (
        echo  [1/3] Backup gia' esistente, skip.
    )
)

echo  [2/3] Installazione patch...
copy /Y "%~dp0%WAD_NAME%" "%GAME_PATH%\%WAD_NAME%" >nul
if errorlevel 1 (
    echo  [ERRORE] Impossibile copiare il file. Chiudi il gioco e riprova.
    pause
    exit /b 1
)
echo        WAD patchato installato!

if exist "%~dp0translations.json" (
    echo  [3/3] Copia traduzioni sorgente...
    if not exist "%GAME_PATH%\GameStringer_Translation" mkdir "%GAME_PATH%\GameStringer_Translation"
    copy /Y "%~dp0translations.json" "%GAME_PATH%\GameStringer_Translation\translations.json" >nul
    echo        Traduzioni copiate.
) else (
    echo  [3/3] Traduzioni non incluse, skip.
)

echo.
echo  ========================================================
echo   PATCH INSTALLATA CON SUCCESSO!
echo.
echo   Avvia Danganronpa e vai su:
echo   Impostazioni - Control Hints - Keyboard and Mouse
echo   Il testo sara' in italiano!
echo  ========================================================
echo.
pause
"#;

    // Crea ZIP
    let zip_file = File::create(&output_path)
        .map_err(|e| format!("Errore creazione ZIP: {}", e))?;
    let mut zip = ZipWriter::new(zip_file);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Stored);

    let mut files_included = Vec::new();

    // 1. WAD patchato (streaming per file grandi)
    log::info!("   Aggiunta WAD al ZIP...");
    zip.start_file("dr1_data_keyboard_us.wad", options)
        .map_err(|e| format!("Errore ZIP WAD: {}", e))?;

    let wad_file = File::open(&wad_path)
        .map_err(|e| format!("Errore apertura WAD: {}", e))?;
    let mut reader = BufReader::with_capacity(8 * 1024 * 1024, wad_file);
    let mut total_written: u64 = 0;

    loop {
        let buf = reader.fill_buf()
            .map_err(|e| format!("Errore lettura WAD: {}", e))?;
        if buf.is_empty() { break; }
        let len = buf.len();
        zip.write_all(buf)
            .map_err(|e| format!("Errore scrittura ZIP: {}", e))?;
        reader.consume(len);
        total_written += len as u64;
        if total_written % (100 * 1024 * 1024) == 0 {
            log::info!("   ... {:.0} MB scritti", total_written as f64 / 1_048_576.0);
        }
    }
    files_included.push(format!("dr1_data_keyboard_us.wad ({:.1} MB)", wad_size as f64 / 1_048_576.0));

    // 2. README
    zip.start_file("LEGGIMI.txt", options)
        .map_err(|e| format!("Errore ZIP README: {}", e))?;
    zip.write_all(readme.as_bytes())
        .map_err(|e| format!("Errore scrittura README: {}", e))?;
    files_included.push("LEGGIMI.txt".to_string());

    // 3. install.bat
    zip.start_file("install.bat", options)
        .map_err(|e| format!("Errore ZIP install.bat: {}", e))?;
    zip.write_all(install_bat.as_bytes())
        .map_err(|e| format!("Errore scrittura install.bat: {}", e))?;
    files_included.push("install.bat".to_string());

    // 4. translations.json (se presente)
    if translations_path.exists() {
        let tr_data = fs::read(&translations_path)
            .map_err(|e| format!("Errore lettura traduzioni: {}", e))?;
        let tr_size = tr_data.len();
        zip.start_file("translations.json", options)
            .map_err(|e| format!("Errore ZIP translations: {}", e))?;
        zip.write_all(&tr_data)
            .map_err(|e| format!("Errore scrittura translations: {}", e))?;
        files_included.push(format!("translations.json ({:.1} KB)", tr_size as f64 / 1024.0));
    }

    zip.finish()
        .map_err(|e| format!("Errore finalizzazione ZIP: {}", e))?;

    let zip_size = fs::metadata(&output_path)
        .map_err(|e| format!("Errore lettura dimensione ZIP: {}", e))?
        .len();
    let zip_size_mb = zip_size as f64 / 1_048_576.0;

    log::info!("✅ ZIP creato: {} ({:.1} MB)", output_path, zip_size_mb);

    Ok(ExportPatchResult {
        success: true,
        zip_path: output_path,
        zip_size_mb,
        files_included,
    })
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ----------------------------------------------------------------
    // classify_pak_type
    // ----------------------------------------------------------------

    #[test]
    fn classify_pak_type_font() {
        assert!(matches!(classify_pak_type("system_font.pak"), PakType::Font));
        assert!(matches!(classify_pak_type("FONT_data.pak"), PakType::Font));
    }

    #[test]
    fn classify_pak_type_script() {
        assert!(matches!(classify_pak_type("novel_01.pak"), PakType::Script));
        assert!(matches!(classify_pak_type("Script_main.pak"), PakType::Script));
    }

    #[test]
    fn classify_pak_type_texture() {
        assert!(matches!(classify_pak_type("tex_ui.pak"), PakType::Texture));
        assert!(matches!(classify_pak_type("sprite_01.pak"), PakType::Texture));
        assert!(matches!(classify_pak_type("bg_room.pak"), PakType::Texture));
    }

    #[test]
    fn classify_pak_type_text() {
        assert!(matches!(classify_pak_type("system_config.pak"), PakType::Text));
        assert!(matches!(classify_pak_type("menu_strings.pak"), PakType::Text));
    }

    #[test]
    fn classify_pak_type_unknown() {
        assert!(matches!(classify_pak_type("data.pak"), PakType::Unknown));
        assert!(matches!(classify_pak_type(""), PakType::Unknown));
    }

    // ----------------------------------------------------------------
    // extract_po_string
    // ----------------------------------------------------------------

    #[test]
    fn extract_po_string_basic() {
        assert_eq!(extract_po_string("msgid \"Hello world\"", "msgid "), "Hello world");
    }

    #[test]
    fn extract_po_string_empty() {
        assert_eq!(extract_po_string("msgid \"\"", "msgid "), "");
    }

    #[test]
    fn extract_po_string_no_quotes() {
        // When there are no quotes, returns the rest as-is
        assert_eq!(extract_po_string("msgid bare", "msgid "), "bare");
    }

    #[test]
    fn extract_po_string_with_escape() {
        assert_eq!(
            extract_po_string(r#"msgstr "line1\nline2""#, "msgstr "),
            r"line1\nline2"
        );
    }

    // ----------------------------------------------------------------
    // escape_po_string
    // ----------------------------------------------------------------

    #[test]
    fn escape_po_string_basic() {
        assert_eq!(escape_po_string("hello"), "hello");
    }

    #[test]
    fn escape_po_string_special_chars() {
        assert_eq!(escape_po_string("say \"hi\""), r#"say \"hi\""#);
        assert_eq!(escape_po_string("a\\b"), "a\\\\b");
        assert_eq!(escape_po_string("line1\nline2"), "line1\\nline2");
        assert_eq!(escape_po_string("col1\tcol2"), "col1\\tcol2");
    }

    #[test]
    fn escape_po_string_empty() {
        assert_eq!(escape_po_string(""), "");
    }

    // ----------------------------------------------------------------
    // extract_vdf_value
    // ----------------------------------------------------------------

    #[test]
    fn extract_vdf_value_standard() {
        let line = r#"		"path"		"D:\\SteamLibrary""#;
        // The function splits by '"' and returns parts[3], which is the raw content
        // between the 3rd and 4th quote characters. In the raw string, \\\\ is two backslashes.
        assert_eq!(extract_vdf_value(line), Some("D:\\\\SteamLibrary".to_string()));
    }

    #[test]
    fn extract_vdf_value_too_few_quotes() {
        assert_eq!(extract_vdf_value(r#""path""#), None);
        assert_eq!(extract_vdf_value("no quotes"), None);
    }

    // ----------------------------------------------------------------
    // get_dr1_character_name
    // ----------------------------------------------------------------

    #[test]
    fn character_name_known_ids() {
        assert_eq!(get_dr1_character_name(0), "Makoto Naegi");
        assert_eq!(get_dr1_character_name(15), "Monokuma");
        assert_eq!(get_dr1_character_name(8), "Kyoko Kirigiri");
    }

    #[test]
    fn character_name_unknown_id() {
        assert_eq!(get_dr1_character_name(999), "???");
    }

    // ----------------------------------------------------------------
    // get_opcode_name / get_opcode_arg_count
    // ----------------------------------------------------------------

    #[test]
    fn opcode_name_known() {
        assert_eq!(get_opcode_name(0x02), "TEXT");
        assert_eq!(get_opcode_name(0x14), "SPEAKER");
        assert_eq!(get_opcode_name(0x08), "MUSIC");
    }

    #[test]
    fn opcode_name_unknown() {
        assert_eq!(get_opcode_name(0xFF), "UNKNOWN");
    }

    #[test]
    fn opcode_arg_count_known() {
        assert_eq!(get_opcode_arg_count(0x02), 1); // TEXT
        assert_eq!(get_opcode_arg_count(0x14), 1); // SPEAKER
        assert_eq!(get_opcode_arg_count(0x11), 0); // WAIT_INPUT
        assert_eq!(get_opcode_arg_count(0x19), 3); // SPRITE
    }

    #[test]
    fn opcode_arg_count_unknown() {
        assert_eq!(get_opcode_arg_count(0xFF), 0);
    }

    // ----------------------------------------------------------------
    // is_utf16le_text
    // ----------------------------------------------------------------

    #[test]
    fn is_utf16le_text_valid() {
        // "Hello World" in UTF-16LE
        let data: Vec<u8> = "Hello World!"
            .encode_utf16()
            .flat_map(|c| c.to_le_bytes())
            .collect();
        assert!(is_utf16le_text(&data));
    }

    #[test]
    fn is_utf16le_text_too_short() {
        assert!(!is_utf16le_text(&[0x41, 0x00])); // only 2 bytes
        assert!(!is_utf16le_text(&[]));
    }

    #[test]
    fn is_utf16le_text_binary_data() {
        let data = vec![0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89];
        assert!(!is_utf16le_text(&data));
    }

    // ----------------------------------------------------------------
    // decode_utf16le
    // ----------------------------------------------------------------

    #[test]
    fn decode_utf16le_basic() {
        // "ABC" in UTF-16LE
        let data = vec![0x41, 0x00, 0x42, 0x00, 0x43, 0x00];
        assert_eq!(decode_utf16le(&data), "ABC");
    }

    #[test]
    fn decode_utf16le_with_bom() {
        // BOM + "Hi"
        let data = vec![0xFF, 0xFE, 0x48, 0x00, 0x69, 0x00];
        assert_eq!(decode_utf16le(&data), "Hi");
    }

    #[test]
    fn decode_utf16le_skip_nulls() {
        // Null characters in the middle are skipped
        let data = vec![0x41, 0x00, 0x00, 0x00, 0x42, 0x00];
        assert_eq!(decode_utf16le(&data), "AB");
    }

    #[test]
    fn decode_utf16le_empty() {
        assert_eq!(decode_utf16le(&[]), "");
    }

    #[test]
    fn decode_utf16le_odd_length() {
        // Odd number of bytes -- last byte ignored
        let data = vec![0x41, 0x00, 0x42];
        assert_eq!(decode_utf16le(&data), "A");
    }

    // ----------------------------------------------------------------
    // decode_utf16be
    // ----------------------------------------------------------------

    #[test]
    fn decode_utf16be_basic() {
        // "ABC" in UTF-16BE
        let data = vec![0x00, 0x41, 0x00, 0x42, 0x00, 0x43];
        assert_eq!(decode_utf16be(&data), "ABC");
    }

    #[test]
    fn decode_utf16be_with_bom() {
        // BOM (FE FF) + "Hi"
        let data = vec![0xFE, 0xFF, 0x00, 0x48, 0x00, 0x69];
        assert_eq!(decode_utf16be(&data), "Hi");
    }

    // ----------------------------------------------------------------
    // decode_utf16_auto
    // ----------------------------------------------------------------

    #[test]
    fn decode_utf16_auto_le_bom() {
        let data = vec![0xFF, 0xFE, 0x41, 0x00, 0x42, 0x00];
        let (text, enc) = decode_utf16_auto(&data);
        assert_eq!(text, "AB");
        assert_eq!(enc, "UTF-16LE (BOM)");
    }

    #[test]
    fn decode_utf16_auto_be_bom() {
        let data = vec![0xFE, 0xFF, 0x00, 0x41, 0x00, 0x42];
        let (text, enc) = decode_utf16_auto(&data);
        assert_eq!(text, "AB");
        assert_eq!(enc, "UTF-16BE (BOM)");
    }

    #[test]
    fn decode_utf16_auto_empty() {
        let (text, enc) = decode_utf16_auto(&[]);
        assert_eq!(text, "");
        assert_eq!(enc, "empty");
    }

    #[test]
    fn decode_utf16_auto_single_byte() {
        let (text, enc) = decode_utf16_auto(&[0x41]);
        assert_eq!(text, "");
        assert_eq!(enc, "empty");
    }

    #[test]
    fn decode_utf16_auto_detect_le() {
        // Long enough UTF-16LE without BOM to trigger auto-detection
        let input = "Hello World test string";
        let data: Vec<u8> = input
            .encode_utf16()
            .flat_map(|c| c.to_le_bytes())
            .collect();
        let (text, enc) = decode_utf16_auto(&data);
        assert_eq!(text, input);
        assert!(enc.contains("UTF-16LE"), "Expected LE detection, got {}", enc);
    }

    #[test]
    fn decode_utf16_auto_detect_be() {
        // Long enough UTF-16BE without BOM to trigger auto-detection
        let input = "Hello World test string";
        let data: Vec<u8> = input
            .encode_utf16()
            .flat_map(|c| c.to_be_bytes())
            .collect();
        let (text, enc) = decode_utf16_auto(&data);
        assert_eq!(text, input);
        assert!(enc.contains("UTF-16BE"), "Expected BE detection, got {}", enc);
    }

    // ----------------------------------------------------------------
    // read_utf16_string (null-terminated)
    // ----------------------------------------------------------------

    #[test]
    fn read_utf16_string_basic() {
        // "Hi" + null terminator
        let data = vec![0x48, 0x00, 0x69, 0x00, 0x00, 0x00, 0x41, 0x00];
        assert_eq!(read_utf16_string(&data), "Hi");
    }

    #[test]
    fn read_utf16_string_with_newline() {
        // "A\nB" + null
        let data = vec![0x41, 0x00, 0x0A, 0x00, 0x42, 0x00, 0x00, 0x00];
        assert_eq!(read_utf16_string(&data), "A\nB");
    }

    #[test]
    fn read_utf16_string_empty() {
        // Immediate null terminator
        let data = vec![0x00, 0x00];
        assert_eq!(read_utf16_string(&data), "");
    }

    #[test]
    fn read_utf16_string_no_null_terminator() {
        // No null: reads until end of data
        let data = vec![0x41, 0x00, 0x42, 0x00];
        assert_eq!(read_utf16_string(&data), "AB");
    }

    // ----------------------------------------------------------------
    // is_likely_dialogue
    // ----------------------------------------------------------------

    #[test]
    fn is_likely_dialogue_valid() {
        assert!(is_likely_dialogue("I wonder what happened to her after the trial ended."));
        assert!(is_likely_dialogue("You are the Ultimate Hope, Makoto Naegi."));
    }

    #[test]
    fn is_likely_dialogue_too_short() {
        assert!(!is_likely_dialogue("Hi"));
        assert!(!is_likely_dialogue("OK man"));
    }

    #[test]
    fn is_likely_dialogue_no_space() {
        assert!(!is_likely_dialogue("SingleWordWithNoSpaces"));
    }

    #[test]
    fn is_likely_dialogue_path_like() {
        assert!(!is_likely_dialogue("data/scripts/chapter1.lin"));
        assert!(!is_likely_dialogue("C:\\Users\\test\\file.txt is here"));
    }

    #[test]
    fn is_likely_dialogue_url() {
        assert!(!is_likely_dialogue("http://example.com is my website here"));
    }

    #[test]
    fn is_likely_dialogue_all_uppercase() {
        assert!(!is_likely_dialogue("THIS IS ALL UPPERCASE TEXT HERE"));
    }

    #[test]
    fn is_likely_dialogue_too_many_underscores() {
        assert!(!is_likely_dialogue("some_variable_name_that is used here often"));
    }

    #[test]
    fn is_likely_dialogue_too_many_specials() {
        assert!(!is_likely_dialogue("###$$$%%% ^^^ &&& *** ((( ))) @@@"));
    }

    #[test]
    fn is_likely_dialogue_no_vowels() {
        assert!(!is_likely_dialogue("bcd fgh jkl mnp qrst vwx"));
    }

    #[test]
    fn is_likely_dialogue_empty() {
        assert!(!is_likely_dialogue(""));
    }

    // ----------------------------------------------------------------
    // extract_strings_from_binary
    // ----------------------------------------------------------------

    #[test]
    fn extract_strings_from_binary_finds_ascii() {
        let mut data = vec![0x00; 20];
        // Insert "Hello" at offset 5
        data[5] = b'H';
        data[6] = b'e';
        data[7] = b'l';
        data[8] = b'l';
        data[9] = b'o';
        let strings = extract_strings_from_binary(&data);
        assert_eq!(strings.len(), 1);
        assert_eq!(strings[0], "Hello");
    }

    #[test]
    fn extract_strings_from_binary_skips_short() {
        // "Hi" is only 2 chars, minimum is 4
        let data = vec![0x00, b'H', b'i', 0x00];
        let strings = extract_strings_from_binary(&data);
        assert!(strings.is_empty());
    }

    #[test]
    fn extract_strings_from_binary_skips_numeric_only() {
        let data = b"\x001234\x00";
        let strings = extract_strings_from_binary(data);
        assert!(strings.is_empty());
    }

    // ----------------------------------------------------------------
    // decompress_spc
    // ----------------------------------------------------------------

    #[test]
    fn decompress_spc_not_compressed() {
        // Must be >= 16 bytes to pass the size check
        let data = vec![0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
                        0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10];
        let result = decompress_spc(&data).unwrap();
        // Not SPC or $CMP, returned as-is
        assert_eq!(result, data);
    }

    #[test]
    fn decompress_spc_too_small() {
        let data = vec![0x53, 0x50, 0x43, 0x20]; // "SPC " but only 4 bytes
        assert!(decompress_spc(&data).is_err());
    }

    #[test]
    fn decompress_spc_literal_bytes() {
        // SPC header + literal copy operations
        let mut data = vec![0u8; 16];
        data[0..4].copy_from_slice(b"SPC ");
        // decompressed_size = 3
        data[8] = 3;
        // compressed_size (not really validated)
        data[12] = 10;
        // flag=3 means copy 3 literal bytes
        data.push(3);
        data.push(b'A');
        data.push(b'B');
        data.push(b'C');
        let result = decompress_spc(&data).unwrap();
        assert_eq!(result, b"ABC");
    }

    // ----------------------------------------------------------------
    // parse_cpk_utf_table
    // ----------------------------------------------------------------

    #[test]
    fn parse_cpk_utf_table_too_small() {
        let data = vec![0u8; 20];
        let result = parse_cpk_utf_table(&data, 0).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn parse_cpk_utf_table_with_filename_strings() {
        // Build a minimal @UTF table with a string table containing file-like names
        let mut data = vec![0u8; 200];
        // @UTF magic at offset 0
        data[0..4].copy_from_slice(b"@UTF");
        // table_size (BE)
        data[4..8].copy_from_slice(&100u32.to_be_bytes());
        // rows_offset (BE)
        data[8..12].copy_from_slice(&80u32.to_be_bytes());
        // string_offset (BE) - relative to utf_start+8, so string table at offset 8+20=28
        data[12..16].copy_from_slice(&20u32.to_be_bytes());
        // data_offset (BE)
        data[16..20].copy_from_slice(&90u32.to_be_bytes());
        // padding (4 bytes)
        // num_rows at offset 24 (BE) = 2
        data[24..28].copy_from_slice(&2u32.to_be_bytes());

        // String table starts at offset 8 + 20 = 28
        // Place "test.txt\0other.bin\0" at offset 28
        let strings = b"test.txt\0other.bin\0";
        data[28..28 + strings.len()].copy_from_slice(strings);

        let result = parse_cpk_utf_table(&data, 0).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].name, "test.txt");
        assert_eq!(result[1].name, "other.bin");
    }

    // ----------------------------------------------------------------
    // WAD AGAR archive parsing
    // ----------------------------------------------------------------

    #[test]
    fn wad_archive_too_small() {
        // Create a tiny temp file
        let dir = std::env::temp_dir().join("dr_test_wad_small");
        let _ = fs::create_dir_all(&dir);
        let wad_path = dir.join("tiny.wad");
        fs::write(&wad_path, &[0u8; 10]).unwrap();
        let result = read_wad_archive(wad_path.to_str().unwrap());
        assert!(result.is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn wad_archive_non_agar_fallback() {
        let dir = std::env::temp_dir().join("dr_test_wad_nonagar");
        let _ = fs::create_dir_all(&dir);
        let wad_path = dir.join("nonagar.wad");
        // 24+ bytes, not AGAR magic
        let data = vec![0u8; 30];
        fs::write(&wad_path, &data).unwrap();
        let result = read_wad_archive(wad_path.to_str().unwrap()).unwrap();
        // Should produce a single fallback entry
        assert_eq!(result.entries.len(), 1);
        assert!(result.entries[0].name.contains("nonagar.wad"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn wad_archive_agar_zero_files() {
        let dir = std::env::temp_dir().join("dr_test_wad_agar0");
        let _ = fs::create_dir_all(&dir);
        let wad_path = dir.join("empty.wad");
        let mut data = vec![0u8; 24];
        data[0..4].copy_from_slice(b"AGAR");
        // file_count at offset 16 = 0
        fs::write(&wad_path, &data).unwrap();
        let result = read_wad_archive(wad_path.to_str().unwrap()).unwrap();
        // No files parsed, should fallback to WAD-level entry
        assert_eq!(result.entries.len(), 1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn wad_archive_agar_with_entries() {
        let dir = std::env::temp_dir().join("dr_test_wad_agar_entries");
        let _ = fs::create_dir_all(&dir);
        let wad_path = dir.join("test.wad");

        let mut data = Vec::new();
        // AGAR header (20 bytes)
        data.extend_from_slice(b"AGAR");
        data.extend_from_slice(&0u32.to_le_bytes()); // version
        data.extend_from_slice(&0u32.to_le_bytes()); // ?
        data.extend_from_slice(&0u32.to_le_bytes()); // ?
        data.extend_from_slice(&1u32.to_le_bytes()); // file_count = 1

        // Entry: name_len(4) + name(name_len) + size(8) + offset(8)
        let name = b"hello.txt";
        data.extend_from_slice(&(name.len() as u32).to_le_bytes());
        data.extend_from_slice(name);
        data.extend_from_slice(&100u64.to_le_bytes()); // size
        data.extend_from_slice(&200u64.to_le_bytes()); // offset

        // Pad to make file big enough
        data.resize(300, 0);

        fs::write(&wad_path, &data).unwrap();
        let result = read_wad_archive(wad_path.to_str().unwrap()).unwrap();
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].name, "hello.txt");
        assert_eq!(result.entries[0].size, 100);
        assert_eq!(result.entries[0].offset, 200);
        let _ = fs::remove_dir_all(&dir);
    }

    // ----------------------------------------------------------------
    // PAK archive parsing
    // ----------------------------------------------------------------

    #[test]
    fn pak_archive_too_small() {
        let dir = std::env::temp_dir().join("dr_test_pak_small");
        let _ = fs::create_dir_all(&dir);
        let pak_path = dir.join("tiny.pak");
        fs::write(&pak_path, &[0u8; 2]).unwrap();
        let result = read_pak_archive_internal(pak_path.to_str().unwrap());
        assert!(result.is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn pak_archive_single_file_fallback() {
        let dir = std::env::temp_dir().join("dr_test_pak_single");
        let _ = fs::create_dir_all(&dir);
        let pak_path = dir.join("data.pak");
        // file_count looks unreasonable => single file fallback
        let mut data = vec![0u8; 100];
        data[0..4].copy_from_slice(&0xFFFFFFFFu32.to_le_bytes());
        fs::write(&pak_path, &data).unwrap();
        let result = read_pak_archive_internal(pak_path.to_str().unwrap()).unwrap();
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].name, "data.pak");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn pak_archive_valid_entries() {
        let dir = std::env::temp_dir().join("dr_test_pak_valid");
        let _ = fs::create_dir_all(&dir);
        let pak_path = dir.join("archive.pak");

        // Build a valid PAK: 2 files
        // Header: file_count(4) + entry0(offset,size)(8) + entry1(offset,size)(8) = 20 bytes header
        // file_count = 2, header_size = 4 + 2*8 = 20
        let file_count = 2u32;
        let header_size = 4 + (file_count as usize) * 8;
        let mut data = Vec::new();
        data.extend_from_slice(&file_count.to_le_bytes());

        // Entry 0: offset=header_size, size=5
        data.extend_from_slice(&(header_size as u32).to_le_bytes());
        data.extend_from_slice(&5u32.to_le_bytes());
        // Entry 1: offset=header_size+5, size=3
        data.extend_from_slice(&((header_size + 5) as u32).to_le_bytes());
        data.extend_from_slice(&3u32.to_le_bytes());

        // File data
        data.extend_from_slice(b"AAAAA"); // file 0
        data.extend_from_slice(b"BBB");   // file 1

        fs::write(&pak_path, &data).unwrap();
        let result = read_pak_archive_internal(pak_path.to_str().unwrap()).unwrap();
        assert_eq!(result.entries.len(), 2);
        assert_eq!(result.entries[0].name, "file_0000");
        assert_eq!(result.entries[0].size, 5);
        assert_eq!(result.entries[1].name, "file_0001");
        assert_eq!(result.entries[1].size, 3);
        let _ = fs::remove_dir_all(&dir);
    }

    // ----------------------------------------------------------------
    // CPK archive parsing
    // ----------------------------------------------------------------

    #[test]
    fn cpk_archive_too_small() {
        let dir = std::env::temp_dir().join("dr_test_cpk_small");
        let _ = fs::create_dir_all(&dir);
        let cpk_path = dir.join("tiny.cpk");
        fs::write(&cpk_path, &[0u8; 10]).unwrap();
        let result = read_cpk_archive(cpk_path.to_str().unwrap());
        assert!(result.is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn cpk_archive_no_magic_fallback() {
        let dir = std::env::temp_dir().join("dr_test_cpk_nomagic");
        let _ = fs::create_dir_all(&dir);
        let cpk_path = dir.join("notcpk.cpk");
        let data = vec![0u8; 100];
        fs::write(&cpk_path, &data).unwrap();
        let result = read_cpk_archive(cpk_path.to_str().unwrap()).unwrap();
        assert_eq!(result.entries.len(), 1);
        assert!(result.entries[0].name.contains("notcpk.cpk"));
        let _ = fs::remove_dir_all(&dir);
    }

    // ----------------------------------------------------------------
    // parse_text_block
    // ----------------------------------------------------------------

    #[test]
    fn parse_text_block_empty() {
        let result = parse_text_block(&[], &[]).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn parse_text_block_small_data() {
        let data = vec![0, 0, 0]; // less than 4 bytes
        let result = parse_text_block(&data, &[]).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn parse_text_block_zero_strings() {
        let data = vec![0, 0, 0, 0]; // string_count = 0
        let result = parse_text_block(&data, &[]).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn parse_text_block_with_strings() {
        // string_count = 1
        // offset table: 1 entry pointing to string data
        // string data: UTF-16LE "Hi" + null terminator
        let mut data = Vec::new();
        data.extend_from_slice(&1u32.to_le_bytes()); // string_count
        // Offset 0 relative to where data starts after the offset table
        // The string offset is absolute within the data slice
        // table_offset = 4, offset_pos = 4 + 0*4 = 4
        // string_offset value: we'll point to offset 8 (after the offset table entry)
        data.extend_from_slice(&8u32.to_le_bytes()); // string_offset = 8
        // Pad to offset 8
        // Currently data is 8 bytes, so string is right here
        // UTF-16LE "Hi" + null
        data.extend_from_slice(&[0x48, 0x00, 0x69, 0x00, 0x00, 0x00]);

        let result = parse_text_block(&data, &[]).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].text, "Hi");
    }

    #[test]
    fn parse_text_block_with_speaker_mapping() {
        let entries = vec![
            LinEntry {
                index: 0,
                opcode: 0x14, // SPEAKER
                opcode_name: "SPEAKER".to_string(),
                args: vec![0], // Makoto Naegi
                description: String::new(),
            },
            LinEntry {
                index: 1,
                opcode: 0x02, // TEXT
                opcode_name: "TEXT".to_string(),
                args: vec![0], // text index 0
                description: String::new(),
            },
        ];

        let mut data = Vec::new();
        data.extend_from_slice(&1u32.to_le_bytes()); // 1 string
        data.extend_from_slice(&8u32.to_le_bytes()); // offset to string
        // "Ok" in UTF-16LE + null
        data.extend_from_slice(&[0x4F, 0x00, 0x6B, 0x00, 0x00, 0x00]);

        let result = parse_text_block(&data, &entries).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].speaker_id, Some(0));
        assert_eq!(result[0].speaker_name.as_deref(), Some("Makoto Naegi"));
    }

    // ----------------------------------------------------------------
    // parse_lin_type1
    // ----------------------------------------------------------------

    #[test]
    fn parse_lin_type1_too_small() {
        let data = vec![0u8; 4];
        assert!(parse_lin_type1(&data).is_err());
    }

    #[test]
    fn parse_lin_type1_empty_script_block() {
        // header_type = 1, text_block_offset = 8 (immediately after header)
        // text block has 0 strings
        let mut data = Vec::new();
        data.extend_from_slice(&1u32.to_le_bytes()); // header type
        data.extend_from_slice(&8u32.to_le_bytes()); // text_block_offset = 8
        // text block: string_count = 0
        data.extend_from_slice(&0u32.to_le_bytes());

        let (entries, strings) = parse_lin_type1(&data).unwrap();
        assert!(entries.is_empty());
        assert!(strings.is_empty());
    }

    // ----------------------------------------------------------------
    // parse_lin_simple
    // ----------------------------------------------------------------

    #[test]
    fn parse_lin_simple_empty() {
        let data = vec![0u8; 10];
        let (entries, strings) = parse_lin_simple(&data).unwrap();
        assert!(entries.is_empty());
        assert!(strings.is_empty());
    }

    #[test]
    fn parse_lin_simple_finds_utf16_strings() {
        // Embed a UTF-16LE string "Test" (4 chars >= 3 minimum)
        let mut data = vec![0u8; 100];
        // Place "Test" at offset 10 in UTF-16LE
        let text = "Test";
        let encoded: Vec<u8> = text.encode_utf16().flat_map(|c| c.to_le_bytes()).collect();
        data[10..10 + encoded.len()].copy_from_slice(&encoded);
        // Null terminator
        data[10 + encoded.len()] = 0;
        data[10 + encoded.len() + 1] = 0;

        let (entries, strings) = parse_lin_simple(&data).unwrap();
        assert!(entries.is_empty());
        // Should find at least one string matching "Test"
        let found = strings.iter().any(|s| s.text.contains("Test"));
        assert!(found, "Expected to find 'Test' in parsed strings: {:?}", strings);
    }

    // ----------------------------------------------------------------
    // PO file round-trip (via temp files)
    // ----------------------------------------------------------------

    #[test]
    fn po_file_roundtrip() {
        let dir = std::env::temp_dir().join("dr_test_po_roundtrip");
        let _ = fs::create_dir_all(&dir);
        let po_path = dir.join("test.po");

        let entries = vec![
            PoEntry {
                msgid: "".to_string(),
                msgstr: "Content-Type: text/plain; charset=UTF-8\\nLanguage: it\\n".to_string(),
                comments: vec!["# Header".to_string()],
                context: None,
            },
            PoEntry {
                msgid: "Hello".to_string(),
                msgstr: "Ciao".to_string(),
                comments: vec!["#: file.lin:0".to_string()],
                context: None,
            },
            PoEntry {
                msgid: "Good morning".to_string(),
                msgstr: "Buongiorno".to_string(),
                comments: vec![],
                context: Some("greeting".to_string()),
            },
        ];

        write_po_file(po_path.to_str().unwrap().to_string(), entries.clone()).unwrap();
        let read_back = read_po_file(po_path.to_str().unwrap().to_string()).unwrap();

        assert_eq!(read_back.entries.len(), 3);
        assert_eq!(read_back.entries[1].msgid, "Hello");
        assert_eq!(read_back.entries[1].msgstr, "Ciao");
        assert_eq!(read_back.entries[2].context, Some("greeting".to_string()));

        // Header should be parsed
        assert!(read_back.header.contains_key("Content-Type"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn po_file_multiline_strings() {
        let dir = std::env::temp_dir().join("dr_test_po_multiline");
        let _ = fs::create_dir_all(&dir);
        let po_path = dir.join("multi.po");

        let content = r#"msgid ""
"Hello "
"World"
msgstr ""
"Ciao "
"Mondo"

msgid "Simple"
msgstr "Semplice"
"#;

        fs::write(&po_path, content).unwrap();
        let result = read_po_file(po_path.to_str().unwrap().to_string()).unwrap();

        assert_eq!(result.entries.len(), 2);
        assert_eq!(result.entries[0].msgid, "Hello World");
        assert_eq!(result.entries[0].msgstr, "Ciao Mondo");
        assert_eq!(result.entries[1].msgid, "Simple");
        assert_eq!(result.entries[1].msgstr, "Semplice");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn po_file_empty() {
        let dir = std::env::temp_dir().join("dr_test_po_empty");
        let _ = fs::create_dir_all(&dir);
        let po_path = dir.join("empty.po");
        fs::write(&po_path, "").unwrap();
        let result = read_po_file(po_path.to_str().unwrap().to_string()).unwrap();
        assert!(result.entries.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    // ----------------------------------------------------------------
    // generate_po_from_dialogues
    // ----------------------------------------------------------------

    #[test]
    fn generate_po_from_dialogues_basic() {
        let dir = std::env::temp_dir().join("dr_test_gen_po");
        let _ = fs::create_dir_all(&dir);
        let po_path = dir.join("generated.po");

        let dialogues = vec![
            LinDialogue {
                id: "test_0".to_string(),
                speaker: "Makoto Naegi".to_string(),
                original: "Hello there".to_string(),
                translated: "Ciao".to_string(),
                file: "script.lin".to_string(),
                line_index: 0,
            },
        ];

        generate_po_from_dialogues(&dialogues, &po_path).unwrap();

        let content = fs::read_to_string(&po_path).unwrap();
        assert!(content.contains("msgid \"Hello there\""));
        assert!(content.contains("msgstr \"Ciao\""));
        assert!(content.contains("Speaker: Makoto Naegi"));
        assert!(content.contains("#: script.lin:0"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn generate_po_skips_empty_originals() {
        let dir = std::env::temp_dir().join("dr_test_gen_po_skip");
        let _ = fs::create_dir_all(&dir);
        let po_path = dir.join("skip.po");

        let dialogues = vec![
            LinDialogue {
                id: "t0".to_string(),
                speaker: "".to_string(),
                original: "".to_string(),
                translated: "".to_string(),
                file: "f.lin".to_string(),
                line_index: 0,
            },
            LinDialogue {
                id: "t1".to_string(),
                speaker: "".to_string(),
                original: "Real text".to_string(),
                translated: "Testo vero".to_string(),
                file: "f.lin".to_string(),
                line_index: 1,
            },
        ];

        generate_po_from_dialogues(&dialogues, &po_path).unwrap();
        let content = fs::read_to_string(&po_path).unwrap();
        // Should only contain one msgid (not the empty one)
        let msgid_count = content.matches("msgid \"").count();
        // Header has one msgid "" plus the real one
        assert_eq!(msgid_count, 2); // header + "Real text"

        let _ = fs::remove_dir_all(&dir);
    }

    // ----------------------------------------------------------------
    // generate_tsv_from_dialogues
    // ----------------------------------------------------------------

    #[test]
    fn generate_tsv_from_dialogues_basic() {
        let dir = std::env::temp_dir().join("dr_test_gen_tsv");
        let _ = fs::create_dir_all(&dir);
        let tsv_path = dir.join("out.tsv");

        let dialogues = vec![
            LinDialogue {
                id: "id1".to_string(),
                speaker: "Kyoko".to_string(),
                original: "Investigate".to_string(),
                translated: "Indaga".to_string(),
                file: "ch1.lin".to_string(),
                line_index: 5,
            },
        ];

        generate_tsv_from_dialogues(&dialogues, &tsv_path).unwrap();
        let content = fs::read_to_string(&tsv_path).unwrap();
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines[0], "ID\tFile\tSpeaker\tOriginal\tTranslation");
        assert!(lines[1].contains("id1"));
        assert!(lines[1].contains("Kyoko"));
        assert!(lines[1].contains("Investigate"));
        assert!(lines[1].contains("Indaga"));

        let _ = fs::remove_dir_all(&dir);
    }

    // ----------------------------------------------------------------
    // get_lin_dialogue_stats
    // ----------------------------------------------------------------

    #[test]
    fn lin_dialogue_stats_basic() {
        let dialogues = vec![
            LinDialogue {
                id: "d0".to_string(),
                speaker: "Makoto".to_string(),
                original: "Hello".to_string(),
                translated: "Ciao".to_string(),
                file: "s.lin".to_string(),
                line_index: 0,
            },
            LinDialogue {
                id: "d1".to_string(),
                speaker: "Makoto".to_string(),
                original: "Bye".to_string(),
                translated: "".to_string(),
                file: "s.lin".to_string(),
                line_index: 1,
            },
            LinDialogue {
                id: "d2".to_string(),
                speaker: "Kyoko".to_string(),
                original: "Think".to_string(),
                translated: "Pensa".to_string(),
                file: "s.lin".to_string(),
                line_index: 2,
            },
        ];

        let stats = get_lin_dialogue_stats(dialogues);
        assert_eq!(stats.total, 3);
        assert_eq!(stats.translated, 2);
        assert_eq!(stats.untranslated, 1);
        assert_eq!(stats.percentage, 66); // 2*100/3 = 66
        assert_eq!(stats.by_speaker["Makoto"], 2);
        assert_eq!(stats.by_speaker["Kyoko"], 1);
    }

    #[test]
    fn lin_dialogue_stats_empty() {
        let stats = get_lin_dialogue_stats(vec![]);
        assert_eq!(stats.total, 0);
        assert_eq!(stats.translated, 0);
        assert_eq!(stats.percentage, 0);
    }

    // ----------------------------------------------------------------
    // PoStats (get_po_stats via file)
    // ----------------------------------------------------------------

    #[test]
    fn po_stats_computation() {
        let dir = std::env::temp_dir().join("dr_test_po_stats");
        let _ = fs::create_dir_all(&dir);
        let po_path = dir.join("stats.po");

        let content = r#"msgid ""
msgstr "header"

#, fuzzy
msgid "Fuzzy one"
msgstr "Fuzzy tradotto"

msgid "Translated"
msgstr "Tradotto"

msgid "Untranslated"
msgstr ""

msgid "Todo marker"
msgstr "[TODO] da fare"
"#;

        fs::write(&po_path, content).unwrap();
        let stats = get_po_stats(po_path.to_str().unwrap().to_string()).unwrap();
        assert_eq!(stats.total, 5); // header + 4 entries
        // translated: non-empty msgid, non-empty msgstr, not starting with [TODO]
        // "Fuzzy one" -> has msgstr, doesn't start with [TODO] -> translated=yes
        // "Translated" -> translated=yes
        // "Untranslated" -> msgstr empty -> not translated
        // "Todo marker" -> starts with [TODO] -> not translated
        assert_eq!(stats.translated, 2);
        assert_eq!(stats.untranslated, 1); // only "Untranslated" has empty msgstr
        assert_eq!(stats.fuzzy, 1);

        let _ = fs::remove_dir_all(&dir);
    }

    // ----------------------------------------------------------------
    // get_allice_patch_info
    // ----------------------------------------------------------------

    #[test]
    fn allice_patch_info_not_empty() {
        let info = get_allice_patch_info();
        assert_eq!(info.team_name, "All-Ice Team");
        assert!(!info.patches.is_empty());
        assert!(info.patches.len() >= 2);
    }

    // ----------------------------------------------------------------
    // get_drat_info
    // ----------------------------------------------------------------

    #[test]
    fn drat_info_has_url() {
        let info = get_drat_info();
        assert!(info.download_url.contains("github.com"));
        assert!(!info.description.is_empty());
    }

    // ----------------------------------------------------------------
    // parse_script_pak_text
    // ----------------------------------------------------------------

    #[test]
    fn parse_script_pak_text_basic() {
        // UTF-16LE text with a few lines
        let text = "Line one\nLine two\nAB";
        let data: Vec<u8> = text.encode_utf16().flat_map(|c| c.to_le_bytes()).collect();

        let result = parse_script_pak_text(&data, "/test/path", "script_pak_01").unwrap();
        assert_eq!(result.header.signature, "SCRIPT_PAK");
        assert!(result.strings.len() >= 2); // depends on length filter (>=2 chars)
        assert_eq!(result.strings[0].text, "Line one");
        assert_eq!(result.strings[1].text, "Line two");
    }

    #[test]
    fn parse_script_pak_text_empty() {
        let result = parse_script_pak_text(&[], "/path", "script_pak_empty").unwrap();
        assert!(result.strings.is_empty());
    }

    // ----------------------------------------------------------------
    // Edge case: decode_utf16_auto with 00+BOM prefix
    // ----------------------------------------------------------------

    #[test]
    fn decode_utf16_auto_null_plus_le_bom() {
        // 00 FF FE + "A" in LE
        let data = vec![0x00, 0xFF, 0xFE, 0x41, 0x00];
        let (text, enc) = decode_utf16_auto(&data);
        assert_eq!(text, "A");
        assert_eq!(enc, "UTF-16LE (0+BOM)");
    }

    // ----------------------------------------------------------------
    // try_parse_lin_data edge cases
    // ----------------------------------------------------------------

    #[test]
    fn try_parse_lin_data_too_small() {
        let data = vec![0u8; 4];
        let result = try_parse_lin_data(&data, "test.pak", "entry");
        assert!(result.is_empty());
    }

    #[test]
    fn try_parse_lin_data_wrong_header_type() {
        let mut data = vec![0u8; 20];
        // header_type = 99 (not 1 or 2)
        data[0..4].copy_from_slice(&99u32.to_le_bytes());
        let result = try_parse_lin_data(&data, "test.pak", "entry");
        assert!(result.is_empty());
    }

    #[test]
    fn try_parse_lin_data_zero_text_block_offset() {
        let mut data = vec![0u8; 20];
        data[0..4].copy_from_slice(&1u32.to_le_bytes()); // header_type = 1
        data[4..8].copy_from_slice(&0u32.to_le_bytes()); // text_block_offset = 0
        let result = try_parse_lin_data(&data, "test.pak", "entry");
        assert!(result.is_empty());
    }
}
