//! Unreal Engine Localization Pipeline
//! 
//! Estrae, traduce e reinserisce testi di localizzazione da giochi UE4/UE5.
//! Supporta formato .pak e .locres.

use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use sha1::{Sha1, Digest};

const PAK_MAGIC: u32 = 0x5A6F_12E1;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocEntry {
    pub namespace: String,
    pub key: String,
    pub source_hash: u32,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PakFileEntry {
    pub filename: String,
    pub offset: i64,
    pub size: i64,
    pub uncompressed_size: i64,
    pub compression_method: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionResult {
    pub success: bool,
    pub entries: Vec<LocEntry>,
    pub source_file: String,
    pub pak_version: i32,
    pub locres_path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslatedEntry {
    pub namespace: String,
    pub key: String,
    pub source_hash: u32,
    pub original: String,
    pub translated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationPakResult {
    pub success: bool,
    pub pak_path: String,
    pub entries_count: usize,
    pub message: String,
}

// ═══════════════════════════════════════════════════════════════════
// BINARY READ HELPERS
// ═══════════════════════════════════════════════════════════════════

fn read_u8(data: &[u8], offset: &mut usize) -> Result<u8, String> {
    if *offset >= data.len() {
        return Err(format!("EOF reading u8 at offset {}", offset));
    }
    let v = data[*offset];
    *offset += 1;
    Ok(v)
}

fn read_i32(data: &[u8], offset: &mut usize) -> Result<i32, String> {
    if *offset + 4 > data.len() {
        return Err(format!("EOF reading i32 at offset {}", offset));
    }
    let v = i32::from_le_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
    ]);
    *offset += 4;
    Ok(v)
}

fn read_u32(data: &[u8], offset: &mut usize) -> Result<u32, String> {
    if *offset + 4 > data.len() {
        return Err(format!("EOF reading u32 at offset {}", offset));
    }
    let v = u32::from_le_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
    ]);
    *offset += 4;
    Ok(v)
}

fn read_i64(data: &[u8], offset: &mut usize) -> Result<i64, String> {
    if *offset + 8 > data.len() {
        return Err(format!("EOF reading i64 at offset {}", offset));
    }
    let v = i64::from_le_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
        data[*offset + 4], data[*offset + 5], data[*offset + 6], data[*offset + 7],
    ]);
    *offset += 8;
    Ok(v)
}

#[allow(dead_code)]
fn read_u64(data: &[u8], offset: &mut usize) -> Result<u64, String> {
    if *offset + 8 > data.len() {
        return Err(format!("EOF reading u64 at offset {}", offset));
    }
    let v = u64::from_le_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
        data[*offset + 4], data[*offset + 5], data[*offset + 6], data[*offset + 7],
    ]);
    *offset += 8;
    Ok(v)
}

fn read_bytes(data: &[u8], offset: &mut usize, count: usize) -> Result<Vec<u8>, String> {
    if *offset + count > data.len() {
        return Err(format!("EOF reading {} bytes at offset {}", count, offset));
    }
    let v = data[*offset..*offset + count].to_vec();
    *offset += count;
    Ok(v)
}

/// Legge una FString serializzata UE4 (length-prefixed, null-terminated)
fn read_fstring(data: &[u8], offset: &mut usize) -> Result<String, String> {
    let length = read_i32(data, offset)?;
    
    if length == 0 {
        return Ok(String::new());
    }
    
    if length > 0 {
        // UTF-8 string
        let len = length as usize;
        if *offset + len > data.len() {
            return Err(format!("EOF reading FString({}) at offset {}", len, offset));
        }
        let bytes = &data[*offset..*offset + len];
        *offset += len;
        
        // Remove null terminator
        let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
        Ok(String::from_utf8_lossy(&bytes[..end]).to_string())
    } else {
        // UTF-16 string (negative length)
        let char_count = (-length) as usize;
        let byte_count = char_count * 2;
        if *offset + byte_count > data.len() {
            return Err(format!("EOF reading FString UTF-16({}) at offset {}", char_count, offset));
        }
        
        let mut chars = Vec::with_capacity(char_count);
        for _ in 0..char_count {
            let lo = data[*offset] as u16;
            let hi = data[*offset + 1] as u16;
            chars.push(lo | (hi << 8));
            *offset += 2;
        }
        
        // Remove null terminator
        if let Some(pos) = chars.iter().position(|&c| c == 0) {
            chars.truncate(pos);
        }
        
        String::from_utf16(&chars).map_err(|e| format!("Invalid UTF-16: {}", e))
    }
}

// ═══════════════════════════════════════════════════════════════════
// BINARY WRITE HELPERS
// ═══════════════════════════════════════════════════════════════════

fn write_i32(buf: &mut Vec<u8>, v: i32) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn write_u32(buf: &mut Vec<u8>, v: u32) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn write_i64(buf: &mut Vec<u8>, v: i64) {
    buf.extend_from_slice(&v.to_le_bytes());
}

#[allow(dead_code)]
fn write_u64(buf: &mut Vec<u8>, v: u64) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn write_fstring(buf: &mut Vec<u8>, s: &str) {
    if s.is_empty() {
        write_i32(buf, 0);
        return;
    }
    // Write as UTF-8 with null terminator
    let len = (s.len() + 1) as i32; // +1 for null terminator
    write_i32(buf, len);
    buf.extend_from_slice(s.as_bytes());
    buf.push(0); // null terminator
}

#[allow(dead_code)]
fn write_bytes(buf: &mut Vec<u8>, data: &[u8]) {
    buf.extend_from_slice(data);
}

// ═══════════════════════════════════════════════════════════════════
// PAK READER
// ═══════════════════════════════════════════════════════════════════

/// Trova e legge il footer del .pak dalla fine del file
fn find_pak_footer(data: &[u8]) -> Result<(i32, i64, i64, bool), String> {
    let len = data.len();
    if len < 44 {
        return Err("File troppo piccolo per essere un .pak valido".into());
    }
    
    // Cerca il magic dalla fine del file (ultimi 1024 bytes)
    let search_start = if len > 1024 { len - 1024 } else { 0 };
    
    for i in (search_start..len.saturating_sub(24)).rev() {
        if i + 4 > len { continue; }
        let magic = u32::from_le_bytes([data[i], data[i + 1], data[i + 2], data[i + 3]]);
        
        if magic == PAK_MAGIC {
            if i + 24 > len { continue; }
            
            let version = i32::from_le_bytes([
                data[i + 4], data[i + 5], data[i + 6], data[i + 7],
            ]);
            let index_offset = i64::from_le_bytes([
                data[i + 8], data[i + 9], data[i + 10], data[i + 11],
                data[i + 12], data[i + 13], data[i + 14], data[i + 15],
            ]);
            let index_size = i64::from_le_bytes([
                data[i + 16], data[i + 17], data[i + 18], data[i + 19],
                data[i + 20], data[i + 21], data[i + 22], data[i + 23],
            ]);
            
            // Verifica se l'indice è criptato (byte prima del magic, se v7+)
            let encrypted = if i > 0 && version >= 7 {
                data[i - 1] != 0
            } else {
                false
            };
            
            // Sanity check
            if version >= 1 && version <= 11 
                && index_offset >= 0 
                && index_offset < len as i64 
                && index_size > 0 
                && index_size < len as i64 
            {
                log::info!(
                    "📦 PAK footer trovato: v{}, index@{} size={}, encrypted={}",
                    version, index_offset, index_size, encrypted
                );
                return Ok((version, index_offset, index_size, encrypted));
            }
        }
    }
    
    Err("Magic PAK (0x5A6F12E1) non trovato nel file".into())
}

/// Parsa l'indice del .pak e restituisce le entry dei file
fn parse_pak_index(
    data: &[u8],
    version: i32,
    index_offset: i64,
    _index_size: i64,
) -> Result<(String, Vec<PakFileEntry>), String> {
    let mut offset = index_offset as usize;
    
    // Mount point
    let mount_point = read_fstring(data, &mut offset)?;
    log::info!("📦 Mount point: {}", mount_point);
    
    // Numero di record
    let num_records = read_i32(data, &mut offset)?;
    log::info!("📦 Records: {}", num_records);
    
    if num_records < 0 || num_records > 1_000_000 {
        return Err(format!("Numero record sospetto: {}", num_records));
    }
    
    // Per versione >= 10 (UE4.26+), il formato dell'indice è diverso
    // con PathHashSeed, PathHashIndex, etc.
    // Per ora supportiamo v1-v9 (coprono la maggior parte dei giochi UE4)
    if version >= 10 {
        return Err(format!(
            "PAK v{} usa il formato indice UE5 (PathHash). Richiede implementazione aggiuntiva.", 
            version
        ));
    }
    
    let mut entries = Vec::with_capacity(num_records as usize);
    
    for i in 0..num_records as usize {
        let filename = read_fstring(data, &mut offset)?;
        
        // Entry record header (CompressionMethodIndex for v8+, CompressionMethod for older)
        let offset_in_pak = read_i64(data, &mut offset)?;
        let compressed_size = read_i64(data, &mut offset)?;
        let uncompressed_size = read_i64(data, &mut offset)?;
        
        let compression_method = if version <= 4 {
            read_i32(data, &mut offset)? as u32
        } else {
            read_u32(data, &mut offset)?
        };
        
        // Timestamp (solo v1)
        if version == 1 {
            let _ = read_i64(data, &mut offset)?;
        }
        
        // SHA1 hash
        let _ = read_bytes(data, &mut offset, 20)?;
        
        // Compression blocks (v3+ se compresso)
        if version >= 3 && compression_method != 0 {
            let block_count = read_u32(data, &mut offset)?;
            for _ in 0..block_count {
                let _ = read_i64(data, &mut offset)?; // start
                let _ = read_i64(data, &mut offset)?; // end
            }
        }
        
        // Flags (v3+)
        let _flags = if version >= 3 {
            read_u8(data, &mut offset)?
        } else {
            0
        };
        
        // Compression block size (v3+)
        let _block_size = if version >= 3 {
            read_u32(data, &mut offset)?
        } else {
            0
        };
        
        entries.push(PakFileEntry {
            filename,
            offset: offset_in_pak,
            size: compressed_size,
            uncompressed_size,
            compression_method,
        });
        
        // Log primi file per debug
        if i < 5 || entries.last().map(|e| e.filename.contains(".locres")).unwrap_or(false) {
            log::info!("  📄 {} ({} bytes)", entries.last().unwrap().filename, uncompressed_size);
        }
    }
    
    Ok((mount_point, entries))
}

/// Estrae il contenuto di un file dal .pak (solo non compresso)
fn extract_file_from_pak(data: &[u8], entry: &PakFileEntry) -> Result<Vec<u8>, String> {
    if entry.compression_method != 0 {
        return Err(format!(
            "File {} è compresso (metodo {}). Estrazione compressa non supportata.",
            entry.filename, entry.compression_method
        ));
    }
    
    // L'entry offset nel pak punta a un "Entry Header" seguito dai dati
    // Entry header ha: offset(8) + size(8) + uncompressed(8) + compression(4) + hash(20) = 48 bytes minimo
    // Ma per semplicità, cerchiamo il magic .locres nei dati a partire dall'offset
    
    let start = entry.offset as usize;
    if start >= data.len() {
        return Err(format!("Offset {} fuori dal file", start));
    }
    
    // Salta l'entry header (varia per versione, tipicamente 53+ bytes)
    // Cerchiamo i dati reali
    let search_end = std::cmp::min(start + 200, data.len());
    
    // Per file .locres, cerchiamo il magic
    if entry.filename.ends_with(".locres") {
        let locres_magic_bytes: [u8; 4] = [0x0E, 0x14, 0xDA, 0x7A];
        for i in start..search_end {
            if i + 4 <= data.len() && data[i..i + 4] == locres_magic_bytes {
                let end = std::cmp::min(i + entry.uncompressed_size as usize, data.len());
                return Ok(data[i..end].to_vec());
            }
        }
    }
    
    // Fallback: salta un header tipico di 53 bytes
    let data_start = start + 53;
    if data_start >= data.len() {
        return Err("Offset dati fuori dal file".into());
    }
    let end = std::cmp::min(data_start + entry.uncompressed_size as usize, data.len());
    Ok(data[data_start..end].to_vec())
}

// ═══════════════════════════════════════════════════════════════════
// LOCRES PARSER
// ═══════════════════════════════════════════════════════════════════

/// Parsa un file .locres UE4 e restituisce le entry di localizzazione
fn parse_locres(data: &[u8]) -> Result<(u8, Vec<LocEntry>), String> {
    let mut offset = 0usize;
    
    // Magic
    let magic = read_u32(data, &mut offset)?;
    if magic != 0x0E14DA7A {
        // Prova senza magic (alcuni locres vecchi non lo hanno)
        offset = 0;
    }
    
    // Version
    let version = read_u8(data, &mut offset)?;
    log::info!("📝 LocRes version: {}", version);
    
    if version > 3 {
        return Err(format!("Versione LocRes {} non supportata (max 3)", version));
    }
    
    // Localized String Array (versione >= 2 "Optimized")
    let mut string_array: Vec<String> = Vec::new();
    
    if version >= 2 {
        let str_count = read_i64(data, &mut offset)? as usize;
        log::info!("📝 String array: {} stringhe condivise", str_count);
        
        if str_count > 1_000_000 {
            return Err(format!("Troppe stringhe condivise: {}", str_count));
        }
        
        for _ in 0..str_count {
            let s = read_fstring(data, &mut offset)?;
            let _ref_count = read_i32(data, &mut offset)?;
            string_array.push(s);
        }
    }
    
    // Namespaces
    let namespace_count = read_i32(data, &mut offset)?;
    log::info!("📝 Namespaces: {}", namespace_count);
    
    if namespace_count < 0 || namespace_count > 100_000 {
        return Err(format!("Numero namespace sospetto: {}", namespace_count));
    }
    
    let mut entries = Vec::new();
    
    for _ in 0..namespace_count {
        // Namespace key
        let _ns_hash = if version >= 1 { read_u32(data, &mut offset)? } else { 0 };
        let namespace = read_fstring(data, &mut offset)?;
        
        // Entries in questo namespace
        let entry_count = read_i32(data, &mut offset)?;
        
        for _ in 0..entry_count {
            // Entry key
            let _key_hash = if version >= 1 { read_u32(data, &mut offset)? } else { 0 };
            let key = read_fstring(data, &mut offset)?;
            
            let source_hash = read_u32(data, &mut offset)?;
            
            let value = if version >= 2 {
                // Indice nella string array
                let string_idx = read_i32(data, &mut offset)?;
                if string_idx >= 0 && (string_idx as usize) < string_array.len() {
                    string_array[string_idx as usize].clone()
                } else {
                    // -1 = usa la key come valore
                    key.clone()
                }
            } else {
                // Stringa diretta
                read_fstring(data, &mut offset)?
            };
            
            // Filtra stringhe vuote o troppo corte
            if !value.is_empty() {
                entries.push(LocEntry {
                    namespace: namespace.clone(),
                    key: key.clone(),
                    source_hash,
                    value,
                });
            }
        }
    }
    
    log::info!("📝 Totale entry: {}", entries.len());
    Ok((version, entries))
}

// ═══════════════════════════════════════════════════════════════════
// LOCRES WRITER
// ═══════════════════════════════════════════════════════════════════

/// Scrive un file .locres con le traduzioni (formato v0 Legacy, massima compatibilità)
fn write_locres_v0(entries: &[LocEntry]) -> Vec<u8> {
    let mut buf = Vec::new();
    
    // Magic
    write_u32(&mut buf, 0x0E14DA7A);
    
    // Version 0 (Legacy - massima compatibilità)
    buf.push(0u8);
    
    // Raggruppa per namespace
    let mut namespaces: std::collections::BTreeMap<&str, Vec<&LocEntry>> = std::collections::BTreeMap::new();
    for entry in entries {
        namespaces.entry(&entry.namespace).or_default().push(entry);
    }
    
    // Namespace count
    write_i32(&mut buf, namespaces.len() as i32);
    
    for (ns_name, ns_entries) in &namespaces {
        // Namespace string
        write_fstring(&mut buf, ns_name);
        
        // Entry count
        write_i32(&mut buf, ns_entries.len() as i32);
        
        for entry in ns_entries {
            // Key string
            write_fstring(&mut buf, &entry.key);
            
            // Source hash
            write_u32(&mut buf, entry.source_hash);
            
            // Translated value
            write_fstring(&mut buf, &entry.value);
        }
    }
    
    buf
}

// ═══════════════════════════════════════════════════════════════════
// PAK WRITER (formato semplice v4)
// ═══════════════════════════════════════════════════════════════════

/// Crea un file .pak v4 con i file specificati
pub fn create_pak_v4(files: &[(&str, &[u8])]) -> Vec<u8> {
    let mut buf = Vec::new();
    let mount_point = "../../../";
    
    // Prima scrittura: i dati dei file con inline entry record
    struct EntryInfo {
        filename: String,
        offset: i64,
        size: i64,
    }
    
    let mut entry_infos = Vec::new();
    
    for (filename, data) in files {
        let entry_offset = buf.len() as i64;
        let size = data.len() as i64;
        
        // Inline entry record (UE4 PAK v4 format)
        // L'offset punta a dove inizia questo entry record
        write_i64(&mut buf, entry_offset); // offset (punta a sé stesso)
        write_i64(&mut buf, size); // compressed size
        write_i64(&mut buf, size); // uncompressed size  
        write_u32(&mut buf, 0); // no compression
        
        // SHA1 hash del file data
        let mut file_hasher = Sha1::new();
        file_hasher.update(data);
        let file_hash = file_hasher.finalize();
        buf.extend_from_slice(&file_hash);
        
        // Flags
        buf.push(0u8);
        
        // Block size
        write_u32(&mut buf, 0);
        
        // Dati del file
        buf.extend_from_slice(data);
        
        entry_infos.push(EntryInfo {
            filename: filename.to_string(),
            offset: entry_offset,
            size,
        });
    }
    
    // Indice
    let index_offset = buf.len() as i64;
    
    // Mount point
    write_fstring(&mut buf, mount_point);
    
    // Numero di record
    write_i32(&mut buf, entry_infos.len() as i32);
    
    for info in &entry_infos {
        // Filename
        write_fstring(&mut buf, &info.filename);
        
        // Entry: offset, compressed, uncompressed, compression, hash, flags, blocksize
        write_i64(&mut buf, info.offset);
        write_i64(&mut buf, info.size);
        write_i64(&mut buf, info.size);
        write_u32(&mut buf, 0); // no compression
        
        // SHA1 hash (zeros in index — engine usa quello inline)
        buf.extend_from_slice(&[0u8; 20]);
        
        // Flags
        buf.push(0u8);
        // Block size
        write_u32(&mut buf, 0);
    }
    
    let index_end = buf.len() as i64;
    let index_size = index_end - index_offset;
    
    // Calcola SHA1 dell'indice
    let index_data = &buf[index_offset as usize..index_end as usize];
    let mut index_hasher = Sha1::new();
    index_hasher.update(index_data);
    let index_hash = index_hasher.finalize();
    
    // Footer
    write_u32(&mut buf, PAK_MAGIC);
    write_i32(&mut buf, 4); // Version 4
    write_i64(&mut buf, index_offset);
    write_i64(&mut buf, index_size);
    buf.extend_from_slice(&index_hash); // SHA1 reale dell'indice
    
    buf
}

// ═══════════════════════════════════════════════════════════════════
// FILESYSTEM HELPERS
// ═══════════════════════════════════════════════════════════════════

/// Cerca file .pak nella directory del gioco
#[allow(dead_code)]
fn find_pak_files(game_path: &Path) -> Vec<PathBuf> {
    let mut paks = Vec::new();
    
    // Cerca ricorsivamente in Content/Paks e sottodirectory
    let search_dirs = vec![
        game_path.to_path_buf(),
    ];
    
    for dir in search_dirs {
        if let Ok(walker) = walkdir(&dir, 4) {
            for entry in walker {
                if entry.extension().map(|e| e == "pak").unwrap_or(false) {
                    paks.push(entry);
                }
            }
        }
    }
    
    paks
}

/// Walk directory fino a max_depth
fn walkdir(dir: &Path, max_depth: usize) -> Result<Vec<PathBuf>, String> {
    let mut results = Vec::new();
    walkdir_inner(dir, max_depth, 0, &mut results)?;
    Ok(results)
}

fn walkdir_inner(dir: &Path, max_depth: usize, depth: usize, results: &mut Vec<PathBuf>) -> Result<(), String> {
    if depth > max_depth {
        return Ok(());
    }
    
    let entries = fs::read_dir(dir).map_err(|e| format!("Errore lettura dir {}: {}", dir.display(), e))?;
    
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            results.push(path);
        } else if path.is_dir() {
            walkdir_inner(&path, max_depth, depth + 1, results)?;
        }
    }
    
    Ok(())
}

/// Cerca file .locres liberi (non in .pak) — ricerca profonda ricorsiva
fn find_loose_locres(game_path: &Path) -> Vec<PathBuf> {
    let mut locres = Vec::new();
    
    if let Ok(walker) = walkdir(game_path, 10) {
        for entry in walker {
            if entry.extension().map(|e| e == "locres").unwrap_or(false) {
                locres.push(entry);
            }
        }
    }
    
    locres
}

/// Trova tutte le directory Content/Paks del gioco — ricerca ricorsiva
pub fn find_paks_dir(game_path: &Path) -> Option<PathBuf> {
    // Cerca ricorsivamente directory chiamate "Paks" fino a 5 livelli
    fn find_paks_recursive(dir: &Path, depth: usize, results: &mut Vec<PathBuf>) {
        if depth > 5 { return; }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if path.file_name().map(|n| n == "Paks").unwrap_or(false) {
                        // Verifica che contenga .pak o .utoc
                        if let Ok(paks_entries) = fs::read_dir(&path) {
                            let has_paks = paks_entries.into_iter().flatten().any(|e| {
                                let p = e.path();
                                p.extension().map(|ext| ext == "pak" || ext == "utoc").unwrap_or(false)
                            });
                            if has_paks {
                                results.push(path.clone());
                            }
                        }
                    }
                    find_paks_recursive(&path, depth + 1, results);
                }
            }
        }
    }
    
    let mut paks_dirs = Vec::new();
    find_paks_recursive(game_path, 0, &mut paks_dirs);
    
    if !paks_dirs.is_empty() {
        log::info!("📦 Trovate {} directory Paks", paks_dirs.len());
        for d in &paks_dirs {
            log::info!("  📁 {}", d.display());
        }
        return Some(paks_dirs[0].clone());
    }
    
    log::info!("📦 Nessuna directory Paks trovata in {}", game_path.display());
    None
}

// ═══════════════════════════════════════════════════════════════════
// TAURI COMMANDS
// ═══════════════════════════════════════════════════════════════════

/// Estrae stringhe di localizzazione da un gioco Unreal Engine
#[tauri::command]
pub async fn extract_unreal_localization(game_path: String) -> Result<ExtractionResult, String> {
    let game_dir = Path::new(&game_path);
    
    if !game_dir.exists() {
        return Err(format!("Directory gioco non trovata: {}", game_path));
    }
    
    log::info!("🔍 Estrazione localizzazione da: {}", game_path);
    
    // 1. Prima cerca file .locres liberi (non in .pak)
    let loose_locres = find_loose_locres(game_dir);
    if !loose_locres.is_empty() {
        log::info!("📄 Trovati {} file .locres liberi", loose_locres.len());
        
        // Usa il primo .locres trovato (preferibilmente english)
        let locres_path = loose_locres.iter()
            .find(|p| {
                let path_str = p.to_string_lossy().to_lowercase();
                path_str.contains("/en/") || path_str.contains("\\en\\") || path_str.contains("english")
            })
            .unwrap_or(&loose_locres[0]);
        
        let data = fs::read(locres_path)
            .map_err(|e| format!("Errore lettura {}: {}", locres_path.display(), e))?;
        
        let (_version, entries) = parse_locres(&data)?;
        
        return Ok(ExtractionResult {
            success: true,
            entries,
            source_file: locres_path.to_string_lossy().to_string(),
            pak_version: 0,
            locres_path: locres_path.to_string_lossy().to_string(),
            message: format!("Estratte {} stringhe da .locres libero", 0),
        });
    }
    
    // 2. Cerca file .pak
    let paks_dir = find_paks_dir(game_dir);
    if paks_dir.is_none() {
        return Err("Nessuna directory Content/Paks trovata".into());
    }
    
    let paks_dir = paks_dir.unwrap();
    let pak_files: Vec<PathBuf> = fs::read_dir(&paks_dir)
        .map_err(|e| format!("Errore lettura Paks: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().map(|e| e == "pak").unwrap_or(false))
        .collect();
    
    if pak_files.is_empty() {
        return Err("Nessun file .pak trovato in Content/Paks".into());
    }
    
    log::info!("📦 Trovati {} file .pak", pak_files.len());
    
    // 3. Prova ad aprire ogni .pak e cercare .locres
    for pak_path in &pak_files {
        log::info!("📦 Analisi: {}", pak_path.display());
        
        let data = match fs::read(pak_path) {
            Ok(d) => d,
            Err(e) => {
                log::warn!("⚠️ Impossibile leggere {}: {}", pak_path.display(), e);
                continue;
            }
        };
        
        // Trova footer
        let (version, index_offset, _index_size, encrypted) = match find_pak_footer(&data) {
            Ok(f) => f,
            Err(e) => {
                log::warn!("⚠️ Footer non trovato in {}: {}", pak_path.display(), e);
                continue;
            }
        };
        
        if encrypted {
            log::warn!("⚠️ {} ha indice criptato, skip", pak_path.display());
            continue;
        }
        
        // Parsa indice
        let (_mount_point, entries) = match parse_pak_index(&data, version, index_offset, _index_size) {
            Ok(r) => r,
            Err(e) => {
                log::warn!("⚠️ Errore parsing indice {}: {}", pak_path.display(), e);
                continue;
            }
        };
        
        // Cerca file .locres nell'indice
        let locres_entries: Vec<&PakFileEntry> = entries.iter()
            .filter(|e| e.filename.ends_with(".locres"))
            .collect();
        
        if locres_entries.is_empty() {
            log::info!("📦 Nessun .locres in {}", pak_path.display());
            
            // Log tutti i file per debug
            let file_list: Vec<String> = entries.iter()
                .take(20)
                .map(|e| format!("  {}", e.filename))
                .collect();
            log::info!("📦 Primi file: \n{}", file_list.join("\n"));
            
            continue;
        }
        
        log::info!("📝 Trovati {} file .locres in {}", locres_entries.len(), pak_path.display());
        
        // Preferisci la versione English
        let locres_entry = locres_entries.iter()
            .find(|e| {
                let f = e.filename.to_lowercase();
                f.contains("/en/") || f.contains("\\en\\") || f.contains("english")
            })
            .unwrap_or(&locres_entries[0]);
        
        // Estrai file .locres dal .pak
        let locres_data = match extract_file_from_pak(&data, locres_entry) {
            Ok(d) => d,
            Err(e) => {
                log::warn!("⚠️ Errore estrazione {}: {}", locres_entry.filename, e);
                continue;
            }
        };
        
        // Parsa il .locres
        let (locres_version, loc_entries) = match parse_locres(&locres_data) {
            Ok(r) => r,
            Err(e) => {
                log::warn!("⚠️ Errore parsing .locres: {}", e);
                continue;
            }
        };
        
        let entry_count = loc_entries.len();
        
        return Ok(ExtractionResult {
            success: true,
            entries: loc_entries,
            source_file: pak_path.to_string_lossy().to_string(),
            pak_version: version,
            locres_path: locres_entry.filename.clone(),
            message: format!(
                "Estratte {} stringhe da {} (PAK v{}, LocRes v{})", 
                entry_count, pak_path.file_name().unwrap_or_default().to_string_lossy(),
                version, locres_version
            ),
        });
    }
    
    // 4. Se nessun .locres trovato nei .pak, cerca testi con approccio brute-force
    // Scansioniamo i .pak per il magic .locres
    log::info!("🔍 Tentativo brute-force: cerco magic .locres nei .pak...");
    
    for pak_path in &pak_files {
        let data = match fs::read(pak_path) {
            Ok(d) => d,
            Err(_) => continue,
        };
        
        let locres_magic: [u8; 4] = [0x0E, 0x14, 0xDA, 0x7A];
        
        // Cerca il magic nel file
        for i in 0..data.len().saturating_sub(4) {
            if data[i..i + 4] == locres_magic {
                log::info!("📝 Magic .locres trovato a offset {} in {}", i, pak_path.display());
                
                // Prova a parsare da qui
                let remaining = &data[i..];
                if let Ok((ver, entries)) = parse_locres(remaining) {
                    if !entries.is_empty() {
                        let count = entries.len();
                        return Ok(ExtractionResult {
                            success: true,
                            entries,
                            source_file: pak_path.to_string_lossy().to_string(),
                            pak_version: 0,
                            locres_path: format!("brute-force@offset:{}", i),
                            message: format!(
                                "Estratte {} stringhe (brute-force) da {} (LocRes v{})", 
                                count, pak_path.file_name().unwrap_or_default().to_string_lossy(), ver
                            ),
                        });
                    }
                }
            }
        }
    }
    
    Err("Nessuna stringa di localizzazione trovata nei file .pak del gioco".into())
}

/// Applica traduzioni creando un .pak con il .locres tradotto
#[tauri::command]
pub async fn apply_unreal_translation(
    game_path: String,
    translations: Vec<TranslatedEntry>,
    target_language: String,
) -> Result<TranslationPakResult, String> {
    let game_dir = Path::new(&game_path);
    
    if !game_dir.exists() {
        return Err(format!("Directory gioco non trovata: {}", game_path));
    }
    
    log::info!("📝 Applicazione {} traduzioni per lingua: {}", translations.len(), target_language);
    
    // Crea le LocEntry tradotte
    let loc_entries: Vec<LocEntry> = translations.iter().map(|t| {
        LocEntry {
            namespace: t.namespace.clone(),
            key: t.key.clone(),
            source_hash: t.source_hash,
            value: t.translated.clone(),
        }
    }).collect();
    
    // Scrivi il .locres
    let locres_data = write_locres_v0(&loc_entries);
    
    // Determina il path del .locres nel .pak
    // Pattern standard: [ProjectName]/Content/Localization/Game/[lang]/Game.locres
    let project_name = find_project_name(game_dir).unwrap_or_else(|| "Game".to_string());
    let locres_path_target = format!(
        "{}/Content/Localization/Game/{}/{}.locres",
        project_name, target_language, project_name
    );
    
    // Crea il .locres anche al path "en" — UE5 potrebbe non caricare la cultura target
    // se il gioco non la supporta ufficialmente, ma caricherà sempre la cultura inglese.
    let mut pak_files: Vec<(String, Vec<u8>)> = Vec::new();
    pak_files.push((locres_path_target.clone(), locres_data.clone()));
    
    if target_language != "en" {
        let locres_path_en = format!(
            "{}/Content/Localization/Game/en/{}.locres",
            project_name, project_name
        );
        log::info!("📦 Anche .locres override inglese: {}", locres_path_en);
        pak_files.push((locres_path_en, locres_data.clone()));
    }
    
    log::info!("📦 Creazione PAK con {} .locres: {}", pak_files.len(), locres_path_target);
    
    // Crea il .pak con tutti i .locres
    let pak_file_refs: Vec<(&str, &[u8])> = pak_files.iter()
        .map(|(path, data)| (path.as_str(), data.as_slice()))
        .collect();
    let pak_data = create_pak_v4(&pak_file_refs);
    
    // Trova la directory Paks
    let paks_dir = find_paks_dir(game_dir)
        .ok_or("Directory Content/Paks non trovata")?;
    
    // Salva il .pak con suffisso _P (patch priority)
    let pak_filename = format!("{}_GameStringer_{}_P.pak", project_name, target_language);
    let pak_path = paks_dir.join(&pak_filename);
    
    fs::write(&pak_path, &pak_data)
        .map_err(|e| format!("Errore scrittura {}: {}", pak_path.display(), e))?;
    
    log::info!("✅ PAK traduzione salvato: {} ({} bytes)", pak_path.display(), pak_data.len());
    
    Ok(TranslationPakResult {
        success: true,
        pak_path: pak_path.to_string_lossy().to_string(),
        entries_count: loc_entries.len(),
        message: format!(
            "Creato {} con {} traduzioni ({})", 
            pak_filename, loc_entries.len(), target_language
        ),
    })
}

/// Trova il nome del progetto UE dalla struttura delle directory
pub fn find_project_name(game_dir: &Path) -> Option<String> {
    // Cerca directory con Content/Paks dentro
    if let Ok(entries) = fs::read_dir(game_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join("Content").exists() {
                return path.file_name()
                    .map(|n| n.to_string_lossy().to_string());
            }
        }
    }
    None
}

/// Wrapper pubblico per parse_locres (usato da unreal_iostore)
pub fn parse_locres_pub(data: &[u8]) -> Result<(u8, Vec<LocEntry>), String> {
    parse_locres(data)
}

/// Parsa un file .locres esportato (es. da FModel) e restituisce le stringhe
#[tauri::command]
pub async fn parse_locres_file(locres_path: String) -> Result<ExtractionResult, String> {
    let path = Path::new(&locres_path);
    
    if !path.exists() {
        return Err(format!("File non trovato: {}", locres_path));
    }
    
    let data = fs::read(path)
        .map_err(|e| format!("Errore lettura {}: {}", locres_path, e))?;
    
    log::info!("📝 Parsing .locres esterno: {} ({} bytes)", locres_path, data.len());
    
    let (version, entries) = parse_locres(&data)?;
    let count = entries.len();
    
    log::info!("✅ Estratte {} stringhe da .locres v{}", count, version);
    
    Ok(ExtractionResult {
        success: true,
        entries,
        source_file: locres_path.clone(),
        pak_version: 0,
        locres_path,
        message: format!("Estratte {} stringhe (LocRes v{})", count, version),
    })
}

/// Crea un .pak di traduzione da un file .locres sorgente + traduzioni
#[tauri::command]
pub async fn create_translation_pak(
    game_path: String,
    source_locres_path: String,
    translations: std::collections::HashMap<String, String>,
    target_language: String,
) -> Result<TranslationPakResult, String> {
    let game_dir = Path::new(&game_path);
    let source_path = Path::new(&source_locres_path);
    
    if !game_dir.exists() {
        return Err(format!("Directory gioco non trovata: {}", game_path));
    }
    
    // Leggi e parsa il .locres sorgente
    let data = fs::read(source_path)
        .map_err(|e| format!("Errore lettura .locres sorgente: {}", e))?;
    
    let (_version, entries) = parse_locres(&data)?;
    
    log::info!("📝 Creazione PAK tradotto: {} entry, {} traduzioni", entries.len(), translations.len());
    
    // Applica traduzioni: per ogni entry, se c'è una traduzione usa quella, altrimenti mantieni l'originale
    let translated_entries: Vec<LocEntry> = entries.iter().map(|e| {
        let key = format!("{}::{}", e.namespace, e.key);
        let value = translations.get(&key)
            .cloned()
            .unwrap_or_else(|| e.value.clone());
        LocEntry {
            namespace: e.namespace.clone(),
            key: e.key.clone(),
            source_hash: e.source_hash,
            value,
        }
    }).collect();
    
    // Scrivi il .locres tradotto
    let locres_data = write_locres_v0(&translated_entries);
    
    // Determina path nel .pak
    let project_name = find_project_name(game_dir).unwrap_or_else(|| "Game".to_string());
    let locres_path_in_pak = format!(
        "{}/Content/Localization/Game/{}/{}.locres",
        project_name, target_language, project_name
    );
    
    // Crea anche il .locmeta per registrare la lingua
    // (il .locmeta dice al motore che questa lingua esiste)
    let _locmeta_path_in_pak = format!(
        "{}/Content/Localization/Game/Game.locmeta",
        project_name
    );
    
    log::info!("📦 Creazione PAK: {}", locres_path_in_pak);
    
    // Crea il .pak con il .locres tradotto
    let pak_data = create_pak_v4(&[(&locres_path_in_pak, &locres_data)]);
    
    // Trova la directory Paks
    let paks_dir = find_paks_dir(game_dir)
        .ok_or("Directory Content/Paks non trovata")?;
    
    // Salva il .pak
    let pak_filename = format!("{}_GameStringer_{}_P.pak", project_name, target_language);
    let pak_path = paks_dir.join(&pak_filename);
    
    fs::write(&pak_path, &pak_data)
        .map_err(|e| format!("Errore scrittura {}: {}", pak_path.display(), e))?;
    
    let translated_count = translations.len();
    
    log::info!("✅ PAK traduzione salvato: {} ({} bytes, {} traduzioni)", 
        pak_path.display(), pak_data.len(), translated_count);
    
    Ok(TranslationPakResult {
        success: true,
        pak_path: pak_path.to_string_lossy().to_string(),
        entries_count: translated_count,
        message: format!(
            "Creato {} con {} traduzioni in {}", 
            pak_filename, translated_count, target_language
        ),
    })
}

/// Rimuove la patch di traduzione dal gioco
#[tauri::command]
pub async fn remove_unreal_translation(game_path: String) -> Result<String, String> {
    let game_dir = Path::new(&game_path);
    let paks_dir = find_paks_dir(game_dir)
        .ok_or("Directory Content/Paks non trovata")?;
    
    let mut removed = 0;
    
    if let Ok(entries) = fs::read_dir(&paks_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name() {
                let name_str = name.to_string_lossy();
                if name_str.contains("GameStringer") && 
                   (name_str.ends_with("_P.pak") || name_str.ends_with("_P.utoc") || name_str.ends_with("_P.ucas")) {
                    fs::remove_file(&path)
                        .map_err(|e| format!("Errore rimozione {}: {}", path.display(), e))?;
                    removed += 1;
                    log::info!("🗑️ Rimosso: {}", path.display());
                }
            }
        }
    }
    
    Ok(format!("Rimossi {} file di traduzione", removed))
}
