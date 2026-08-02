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
        // Lunghezza POSITIVA = ANSI a byte singolo, NON UTF-8: UE legge ogni
        // byte come un ANSICHAR. Decodificarlo come UTF-8 trasformerebbe i byte
        // alti in U+FFFD; Latin-1 è la lettura simmetrica a come scriviamo.
        let len = length as usize;
        if *offset + len > data.len() {
            return Err(format!("EOF reading FString({}) at offset {}", len, offset));
        }
        let bytes = &data[*offset..*offset + len];
        *offset += len;

        // Remove null terminator
        let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
        Ok(bytes[..end].iter().map(|&b| b as char).collect())
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

/// Scrive una FString nel formato di UE.
///
/// ⚠️ La lunghezza POSITIVA in UE significa ANSI A BYTE SINGOLO, non UTF-8:
/// il motore legge ogni byte come un ANSICHAR. Scrivere UTF-8 con lunghezza
/// positiva fa uscire "perché" come "perchÃ©" — cioè rompe esattamente le
/// lingue accentate (italiano, francese, spagnolo, tedesco).
/// Quindi: ASCII puro → percorso a byte singolo; tutto il resto → UTF-16
/// con lunghezza NEGATIVA, che è il modo in cui UE trasporta il non-ASCII.
/// In entrambi i casi la lunghezza INCLUDE il terminatore nullo.
fn write_fstring(buf: &mut Vec<u8>, s: &str) {
    if s.is_empty() {
        write_i32(buf, 0);
        return;
    }

    if s.is_ascii() {
        // ANSI: 1 byte per carattere + terminatore
        let len = (s.len() + 1) as i32;
        write_i32(buf, len);
        buf.extend_from_slice(s.as_bytes());
        buf.push(0);
    } else {
        // UTF-16LE: lunghezza negativa in UNITÀ da 16 bit, terminatore incluso
        let units: Vec<u16> = s.encode_utf16().collect();
        let len = -((units.len() + 1) as i32);
        write_i32(buf, len);
        for u in &units {
            buf.extend_from_slice(&u.to_le_bytes());
        }
        buf.extend_from_slice(&[0u8, 0u8]); // terminatore UTF-16
    }
}

// ═══════════════════════════════════════════════════════════════════
// .locmeta (FTextLocalizationMetaDataResource)
// ═══════════════════════════════════════════════════════════════════

/// Magic del .locmeta: FGuid(0xA14CEE4F, 0x83554868, 0xBD464C4C, 0x7C50DA70)
/// serializzato come quattro u32 little-endian.
///
/// ✅ VERIFICATO SU FILE AUTENTICO il 02/08/2026: Game.locmeta di Below,
/// Rusted Gods (123 byte, estratto dal .pak del gioco), primi 16 byte
/// `4F EE 4C A1 68 48 55 83 6C 4C 46 BD 70 DA 50 7C`, byte 17 = 01
/// (versione AddedCompiledCultures).
///
/// STORIA: la prima versione di questa costante veniva "dalla sorgente UE"
/// citata a memoria ed era SBAGLIATA in 12 byte su 16 — lezione locres-magic,
/// seconda volta, identica. La differenza che ha salvato la giornata: il magic
/// è controllato in parse su un file che viene dal gioco vero PRIMA di
/// scrivere qualsiasi cosa, quindi l'errore si è annunciato in un log invece
/// di uscire in un pak che il motore avrebbe ignorato in silenzio.
const LOCMETA_MAGIC: [u8; 16] = [
    0x4F, 0xEE, 0x4C, 0xA1,
    0x68, 0x48, 0x55, 0x83,
    0x6C, 0x4C, 0x46, 0xBD,
    0x70, 0xDA, 0x50, 0x7C,
];

/// Contenuto di un .locmeta.
/// version 0 = Initial (solo cultura nativa) · 1 = AddedCompiledCultures
/// (aggiunge l'elenco delle culture compilate — è QUELLO l'elenco che
/// registra una lingua agli occhi del motore nei giochi impacchettati).
#[derive(Debug, Clone, PartialEq)]
pub struct LocMetaInfo {
    pub version: u8,
    pub native_culture: String,          // es. "en"
    pub native_locres: String,           // es. "en/Game.locres"
    pub compiled_cultures: Vec<String>,  // vuoto per version 0
}

pub fn parse_locmeta(data: &[u8]) -> Result<LocMetaInfo, String> {
    if data.len() < 17 {
        return Err(format!("file troppo corto per un .locmeta: {} byte", data.len()));
    }
    if data[..16] != LOCMETA_MAGIC {
        // Stampa i byte VERI: è così che si corregge un magic sbagliato — con
        // il file autentico, non con un'altra citazione della documentazione.
        // (02/08/2026: il magic preso dalla sorgente UE non corrispondeva al
        // Game.locmeta reale di Below — lezione locres-magic, seconda volta.)
        let trovato: String = data[..16].iter().map(|b| format!("{:02X} ", b)).collect();
        let atteso: String = LOCMETA_MAGIC.iter().map(|b| format!("{:02X} ", b)).collect();
        return Err(format!(
            "magic .locmeta non riconosciuto — trovato: {}· atteso: {}· byte 17 (versione?): {:02X}",
            trovato, atteso, data.get(16).copied().unwrap_or(0)
        ));
    }
    let mut off = 16usize;
    let version = data[off];
    off += 1;
    if version > 1 {
        return Err(format!("versione .locmeta {} non supportata (conosciamo 0 e 1)", version));
    }
    let native_culture = read_fstring(data, &mut off)?;
    let native_locres = read_fstring(data, &mut off)?;
    let mut compiled_cultures = Vec::new();
    if version >= 1 {
        let n = read_i32(data, &mut off)?;
        if !(0..=10_000).contains(&n) {
            return Err(format!("numero culture compilate assurdo: {}", n));
        }
        for _ in 0..n {
            compiled_cultures.push(read_fstring(data, &mut off)?);
        }
    }
    Ok(LocMetaInfo { version, native_culture, native_locres, compiled_cultures })
}

pub fn write_locmeta(meta: &LocMetaInfo) -> Vec<u8> {
    let mut buf = Vec::new();
    buf.extend_from_slice(&LOCMETA_MAGIC);
    buf.push(meta.version);
    write_fstring(&mut buf, &meta.native_culture);
    write_fstring(&mut buf, &meta.native_locres);
    if meta.version >= 1 {
        write_i32(&mut buf, meta.compiled_cultures.len() as i32);
        for c in &meta.compiled_cultures {
            write_fstring(&mut buf, c);
        }
    }
    buf
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
    let search_start = len.saturating_sub(1024);
    
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
            if (1..=11).contains(&version) 
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
    
    if !(0..=1_000_000).contains(&num_records) {
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
        if let Some(last) = entries.last() {
            if i < 5 || last.filename.contains(".locres") {
                log::info!("  📄 {} ({} bytes)", last.filename, uncompressed_size);
            }
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
    // NB: trova solo i .locres v1+ — i Legacy (v0) non hanno magic per definizione.
    if entry.filename.ends_with(".locres") {
        for i in start..search_end {
            if i + 16 <= data.len() && data[i..i + 16] == LOCRES_MAGIC {
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

/// Magic di un file .locres: è un FGuid da 16 BYTE, non un u32.
///
/// `FTextLocalizationResourceVersion::LocResMagic = FGuid(0x7574140E, 0xFC034A67,
/// 0x9D90154A, 0x1B7F37C3)` (documentazione Epic, header
/// Internationalization/TextLocalizationResourceVersion.h), serializzato come
/// quattro u32 little-endian.
///
/// I file LEGACY (v0) NON hanno questo magic: è stato aggiunto in v1. UE lo
/// rileva proprio così — legge 16 byte, se non combaciano torna a offset 0 e
/// tratta il file come Legacy.
const LOCRES_MAGIC: [u8; 16] = [
    0x0E, 0x14, 0x74, 0x75, // 0x7574140E LE
    0x67, 0x4A, 0x03, 0xFC, // 0xFC034A67 LE
    0x4A, 0x15, 0x90, 0x9D, // 0x9D90154A LE
    0xC3, 0x37, 0x7F, 0x1B, // 0x1B7F37C3 LE
];

/// Versioni note (`ELocResVersion`): 0 Legacy · 1 Compact · 2 Optimized
/// (CityHash64/UTF-16) · 3 Optimized_CRC32.
const LOCRES_MAX_KNOWN_VERSION: u8 = 3;

/// Parsa un file .locres UE4/UE5 e restituisce le entry di localizzazione
fn parse_locres(data: &[u8]) -> Result<(u8, Vec<LocEntry>), String> {
    let mut offset = 0usize;

    // Magic da 16 byte: se c'è, segue il byte di versione; se manca, è Legacy
    // e il file comincia DIRETTAMENTE dal conteggio dei namespace.
    let version = if data.len() >= 16 && data[0..16] == LOCRES_MAGIC {
        offset = 16;
        read_u8(data, &mut offset)?
    } else {
        0 // Legacy: nessun header
    };
    log::info!("📝 LocRes version: {}", version);

    if version > LOCRES_MAX_KNOWN_VERSION {
        return Err(format!(
            "Versione LocRes {} non supportata (max {})",
            version, LOCRES_MAX_KNOWN_VERSION
        ));
    }

    // Localized String Array (versione >= 1): nell'header c'è un OFFSET i64
    // ASSOLUTO, non l'array. L'array sta altrove nel file (di norma in fondo).
    let mut string_array: Vec<String> = Vec::new();

    if version >= 1 {
        let array_offset = read_i64(data, &mut offset)?;

        // -1 (INDEX_NONE) = nessun array condiviso
        if array_offset >= 0 {
            let mut o = array_offset as usize;
            if o > data.len() {
                return Err(format!(
                    "Offset string array {} fuori dal file ({} byte)",
                    array_offset,
                    data.len()
                ));
            }

            let str_count = read_i32(data, &mut o)?;
            log::info!("📝 String array: {} stringhe condivise", str_count);

            if !(0..=5_000_000).contains(&str_count) {
                return Err(format!("Numero stringhe condivise sospetto: {}", str_count));
            }

            for _ in 0..str_count {
                let s = read_fstring(data, &mut o)?;
                // Il refcount per stringa compare dalla v2 in poi.
                if version >= 2 {
                    let _ref_count = read_i32(data, &mut o)?;
                }
                string_array.push(s);
            }
        }
    }

    // v3 (Optimized_CRC32) antepone il totale delle entry
    if version >= 3 {
        let _entries_count = read_u32(data, &mut offset)?;
    }

    // Namespaces
    let namespace_count = read_i32(data, &mut offset)?;
    log::info!("📝 Namespaces: {}", namespace_count);
    
    if !(0..=100_000).contains(&namespace_count) {
        return Err(format!("Numero namespace sospetto: {}", namespace_count));
    }
    
    let mut entries = Vec::new();
    
    for _ in 0..namespace_count {
        // Namespace key — l'hash accompagna la stringa solo dalla v2 in poi
        // (FTextKey::SerializeWithHash); prima è una FString e basta.
        let _ns_hash = if version >= 2 { read_u32(data, &mut offset)? } else { 0 };
        let namespace = read_fstring(data, &mut offset)?;

        // Entries in questo namespace
        let entry_count = read_i32(data, &mut offset)?;

        for _ in 0..entry_count {
            // Entry key
            let _key_hash = if version >= 2 { read_u32(data, &mut offset)? } else { 0 };
            let key = read_fstring(data, &mut offset)?;

            let source_hash = read_u32(data, &mut offset)?;

            let value = if version >= 1 {
                // Indice nella string array (dalla v1 "Compact" in poi)
                let string_idx = read_i32(data, &mut offset)?;
                if string_idx >= 0 && (string_idx as usize) < string_array.len() {
                    string_array[string_idx as usize].clone()
                } else {
                    // -1 = nessuna stringa localizzata. Prima qui si usava la
                    // KEY come valore: testo inventato che finiva nel conteggio,
                    // all'AI e riscritto nel gioco. Vuoto = l'entry viene
                    // scartata dal filtro qui sotto.
                    String::new()
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

/// Scrive un file .locres in formato v0 "Legacy" (massima compatibilità).
///
/// ⚠️ Legacy NON ha header: niente magic, niente byte di versione. UE riconosce
/// il formato proprio dall'ASSENZA del magic (legge 16 byte, non combaciano,
/// torna a 0 e legge da lì il conteggio dei namespace). Scriverci un header
/// davanti produce un file che il motore interpreta come spazzatura.
///
/// È anche l'unico formato SENZA hash di namespace/key: nessun valore inventato
/// da parte nostra può far mancare una lookup a runtime.
fn write_locres_v0(entries: &[LocEntry]) -> Vec<u8> {
    let mut buf = Vec::new();

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

/// Scrive un file .locres in formato v2 "Optimized" (UE4.25+ e UE5)
/// Questo è il formato usato dalla maggior parte dei giochi moderni.
///
/// ⚠️ Il campo che segue il byte di versione è un OFFSET i64 ASSOLUTO al
/// string array, non il conteggio delle stringhe: UE fa un Seek a quell'offset.
/// Scrivere l'array in linea significa dare al motore un puntatore che vale
/// "numero di stringhe" — cioè farlo saltare nel mezzo dell'header.
/// Qui l'array va IN FONDO e l'offset viene ricucito a posteriori.
fn write_locres_v2(entries: &[LocEntry]) -> Vec<u8> {
    let mut buf = Vec::new();

    // Magic (16 byte) + versione
    buf.extend_from_slice(&LOCRES_MAGIC);
    buf.push(2u8);

    // Segnaposto per l'offset del string array: lo riscriviamo alla fine,
    // quando sappiamo dove finiscono i namespace.
    let array_offset_pos = buf.len();
    write_i64(&mut buf, -1i64);

    // Costruisci stringa array deduplicata (mantenendo ordine di inserimento)
    let mut string_array: Vec<String> = Vec::new();
    let mut string_index: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    for entry in entries {
        if !entry.value.is_empty() && !string_index.contains_key(&entry.value) {
            let idx = string_array.len() as i32;
            string_index.insert(entry.value.clone(), idx);
            string_array.push(entry.value.clone());
        }
    }

    // Raggruppa per namespace (ordine deterministico)
    let mut namespaces: std::collections::BTreeMap<&str, Vec<&LocEntry>> = std::collections::BTreeMap::new();
    for entry in entries {
        namespaces.entry(&entry.namespace).or_default().push(entry);
    }

    // Namespace count (i32)
    write_i32(&mut buf, namespaces.len() as i32);

    for (ns_name, ns_entries) in &namespaces {
        // Namespace hash (CityHash32 del nome, ma UE lo ignora per il lookup)
        let ns_hash = cityhash32(ns_name.as_bytes());
        write_u32(&mut buf, ns_hash);
        write_fstring(&mut buf, ns_name);

        write_i32(&mut buf, ns_entries.len() as i32);

        for entry in ns_entries {
            let key_hash = cityhash32(entry.key.as_bytes());
            write_u32(&mut buf, key_hash);
            write_fstring(&mut buf, &entry.key);
            write_u32(&mut buf, entry.source_hash);

            // String index (i32): -1 se vuota, altrimenti indice nella string_array
            let idx = if entry.value.is_empty() {
                -1i32
            } else {
                *string_index.get(&entry.value).unwrap_or(&-1)
            };
            write_i32(&mut buf, idx);
        }
    }

    // Ora l'array, in fondo: count (i32) + per ogni stringa FString + refcount (i32)
    let array_offset = buf.len() as i64;
    write_i32(&mut buf, string_array.len() as i32);
    for s in &string_array {
        write_fstring(&mut buf, s);
        write_i32(&mut buf, 1); // refcount: UE lo usa per il GC delle stringhe, 1 è sicuro
    }

    // Ricuci l'offset nell'header
    buf[array_offset_pos..array_offset_pos + 8].copy_from_slice(&array_offset.to_le_bytes());

    buf
}

/// Hash di namespace/key per i formati v2/v3.
///
/// ⚠️ NON È L'HASH DI UE. UE usa CityHash64 su UTF-16 (v2) o FCrc::StrCrc32 su
/// UTF-16 (v3); questo è un CRC32 moltiplicato per una costante, cioè un valore
/// inventato. Se il motore si fida dell'hash salvato per indicizzare la mappa
/// delle stringhe, un hash sbagliato rende le entry NON TROVABILI a runtime e
/// il gioco resta in lingua originale senza dare errore.
/// Domanda ancora APERTA, da chiudere confrontando gli hash di un .locres vero
/// (`npm run ue:locres-check`), non deducendola. Finché è aperta, il percorso
/// sicuro è v0 Legacy, che di hash non ne ha.
fn cityhash32(s: &[u8]) -> u32 {
    let mut h = crc32fast::hash(s);
    h = h.wrapping_mul(0x9e3779b9);
    h
}

/// Scrive un locres usando la stessa versione del sorgente estratto.
///
/// Nota: v0 Legacy è letto da OGNI versione di UE ed è privo di hash, quindi
/// resta il ripiego più sicuro quando il sorgente non impone altro.
pub fn write_locres_matching_version(entries: &[LocEntry], source_version: u8) -> Vec<u8> {
    if source_version >= 2 {
        if source_version > 2 {
            // Non sappiamo scrivere v3: downgrade dichiarato, non silenzioso.
            log::info!("📝 Sorgente LocRes v{}: scrivo v2 (writer v3 non implementato)", source_version);
        }
        write_locres_v2(entries)
    } else {
        write_locres_v0(entries)
    }
}

// ═══════════════════════════════════════════════════════════════════
// PAK WRITER (formato v8, compatibile UE5)
// ═══════════════════════════════════════════════════════════════════

/// Crea un file .pak v8 con i file specificati (compatibile UE5)
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
    
    // Footer v8 (compatibile UE5)
    // 1. EncryptionKeyGuid (16 bytes, all zeros = no encryption)
    buf.extend_from_slice(&[0u8; 16]);
    // 2. bEncryptedIndex (1 byte, 0 = not encrypted)
    buf.push(0u8);
    // 3. Magic
    write_u32(&mut buf, PAK_MAGIC);
    // 4. Version 8 (FNameBasedCompressionMethod — compatibile UE5)
    write_i32(&mut buf, 8);
    // 5. Index offset
    write_i64(&mut buf, index_offset);
    // 6. Index size
    write_i64(&mut buf, index_size);
    // 7. Index SHA1 hash
    buf.extend_from_slice(&index_hash);
    // 8. CompressionMethods (5 entries * 32 bytes = 160 bytes, all zeros = no compression)
    buf.extend_from_slice(&[0u8; 160]);
    
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
        
        let (version, entries) = parse_locres(&data)?;
        let count = entries.len();

        return Ok(ExtractionResult {
            success: true,
            entries,
            source_file: locres_path.to_string_lossy().to_string(),
            pak_version: 0,
            locres_path: locres_path.to_string_lossy().to_string(),
            message: format!("Estratte {} stringhe da .locres libero (LocRes v{})", count, version),
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
        
        // Cerca il magic nel file (solo v1+: i Legacy non ne hanno uno).
        // ..= : l'ultima finestra valida è len-16 compresa.
        for i in 0..=data.len().saturating_sub(16) {
            if data.len() >= 16 && data[i..i + 16] == LOCRES_MAGIC {
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
    
    // Scrivi il .locres in formato v0 Legacy.
    //
    // ⚠️ Qui c'era write_locres_v2. La v2 porta un hash u32 per ogni namespace
    // e per ogni key, e l'hash che sappiamo calcolare NON è quello di UE (vedi
    // `cityhash32`): se il motore si fida dell'hash salvato per indicizzare le
    // stringhe, le entry restano non trovabili e il gioco resta in lingua
    // originale SENZA dare errore — il tipo di fallimento peggiore, quello muto.
    // Il Legacy di hash non ne ha, ed è letto da ogni versione di UE (il
    // motore lo riconosce dall'assenza del magic). Finché la domanda sull'hash
    // non è chiusa su un file vero (`npm run ue:locres-check`), questo è
    // l'unico formato che possiamo scrivere senza indovinare.
    let locres_data = write_locres_v0(&loc_entries);
    
    // Determina il path del .locres nel .pak.
    // Pattern reale: [ProjectName]/Content/Localization/[Target]/[lang]/[Target].locres
    //
    // ⚠️ Il nome del file è quello del TARGET di localizzazione ("Game"), NON quello
    // del progetto. Qui si scriveva `{project_name}.locres` — cioè, su Below,
    // `BelowRustedGods.locres` invece di `Game.locres` — mentre il commento sopra
    // diceva già "Game.locres": il codice non seguiva la sua stessa documentazione.
    // Un override col nome sbagliato NON viene caricato e NON dà errore: il gioco
    // resta in lingua originale, il fallimento muto peggiore.
    // MISURATO 01/08/2026 leggendo il .pak di Below col pak reader nativo:
    //   BelowRustedGods/Content/Localization/Game/en/Game.locres  ← il file vero
    // "Game" è il nome del target di default di Unreal e vale per la quasi totalità
    // dei giochi; resta da parametrizzare per i rari progetti che lo rinominano.
    const LOC_TARGET: &str = "Game";
    let project_name = find_project_name(game_dir).unwrap_or_else(|| LOC_TARGET.to_string());
    let locres_path_target = format!(
        "{}/Content/Localization/{}/{}/{}.locres",
        project_name, LOC_TARGET, target_language, LOC_TARGET
    );

    // Crea il .locres anche al path "en" — UE5 potrebbe non caricare la cultura target
    // se il gioco non la supporta ufficialmente, ma caricherà sempre la cultura inglese.
    let mut pak_files: Vec<(String, Vec<u8>)> = Vec::new();
    pak_files.push((locres_path_target.clone(), locres_data.clone()));

    if target_language != "en" {
        let locres_path_en = format!(
            "{}/Content/Localization/{}/en/{}.locres",
            project_name, LOC_TARGET, LOC_TARGET
        );
        log::info!("📦 Anche .locres override inglese: {}", locres_path_en);
        pak_files.push((locres_path_en, locres_data.clone()));
    }

    // ── .locmeta: registra la cultura target ──────────────────────────────
    // Il .locmeta v1 elenca le culture compilate del target: se quella
    // richiesta non c'è, il motore può ignorare i .locres anche se i file
    // esistono — è la causa radice per cui su Below l'italiano ha dovuto
    // viaggiare travestito da spagnolo (02/08/2026).
    //
    // Regola: si parte SEMPRE dal locmeta ORIGINALE del gioco e si aggiunge
    // solo la cultura target. NIENTE locmeta inventato da zero: un override
    // che elencasse meno culture di quelle vere le cancellerebbe dal menu.
    // Se l'originale non si trova o non si legge, non si scrive nulla e il
    // comportamento resta quello di oggi (travestimento) — un downgrade
    // dichiarato nei log, non un file sbagliato spedito in silenzio.
    //
    // ⚠️ NON ANCORA PROVATO IN GIOCO: che il motore accetti un .locmeta da un
    // override _P.pak è l'ipotesi da verificare su Below — lezione ADR-005,
    // i difetti veri escono solo in-app.
    match super::unreal_iostore::read_game_locmeta(game_dir) {
        Some((orig_path, bytes)) => match parse_locmeta(&bytes) {
            Ok(mut meta) if meta.version >= 1 => {
                if meta.compiled_cultures.iter().any(|c| c == &target_language) {
                    log::info!("📗 locmeta: cultura '{}' già registrata dal gioco — nessun override necessario", target_language);
                } else {
                    meta.compiled_cultures.push(target_language.clone());
                    let locmeta_path = format!(
                        "{}/Content/Localization/{}/{}.locmeta",
                        project_name, LOC_TARGET, LOC_TARGET
                    );
                    log::info!(
                        "📗 locmeta: aggiungo cultura '{}' alle {} esistenti (da {}) → {}",
                        target_language, meta.compiled_cultures.len() - 1, orig_path, locmeta_path
                    );
                    pak_files.push((locmeta_path, write_locmeta(&meta)));
                }
            }
            Ok(meta) => {
                log::info!("📗 locmeta v{} senza elenco culture: niente da registrare via locmeta", meta.version);
            }
            Err(e) => {
                log::warn!("⚠️ locmeta del gioco ({}) non parsabile: {} — NON ne scrivo uno inventato", orig_path, e);
            }
        },
        None => {
            log::warn!("⚠️ Game.locmeta originale non trovato nei .pak — nessun override locmeta (comportamento invariato)");
        }
    }

    log::info!("📦 Creazione PAK con {} file: {}", pak_files.len(), locres_path_target);
    
    // Trova la directory Paks
    let paks_dir = find_paks_dir(game_dir)
        .ok_or("Directory Content/Paks non trovata")?;
    
    let pak_filename = format!("{}_GameStringer_{}_P.pak", project_name, target_language);
    let pak_path = paks_dir.join(&pak_filename);
    
    // Rimuovi pak GS precedente se esiste
    if pak_path.exists() {
        let _ = fs::remove_file(&pak_path);
    }
    
    // Usa repak (con fallback al writer custom) per massima compatibilità
    let pak_file_refs: Vec<(&str, &[u8])> = pak_files.iter()
        .map(|(path, data)| (path.as_str(), data.as_slice()))
        .collect();
    
    let repak_result = super::repak_wrapper::create_pak(&pak_file_refs, &pak_path, None).await
        .map_err(|e| format!("Errore creazione PAK: {}", e))?;

    log::info!("✅ PAK traduzione salvato via {}: {} ({} entries)",
        repak_result.method, pak_path.display(), loc_entries.len());

    // ── TRIPLETTA: coppia .utoc/.ucas accanto al pak ─────────────────────
    // Nei giochi IoStore (UE5.6+) un _P.pak ORFANO non viene montato: patch
    // "installata", gioco in lingua originale, nessun errore. Misurato su
    // Below il 02/08/2026, due volte nello stesso pomeriggio — la seconda
    // perché il Rimuovi cancella la coppia e l'apply ricreava solo il pak.
    // Il gioco è IoStore se nella cartella Paks ci sono .utoc SUOI (non i
    // nostri _GameStringer_). Se la coppia non si può generare, si FALLISCE:
    // un pak orfano su un gioco IoStore è un file rotto con un altro nome.
    let game_is_iostore = fs::read_dir(&paks_dir)
        .map(|entries| entries.flatten().any(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.to_lowercase().ends_with(".utoc") && !name.contains("GameStringer")
        }))
        .unwrap_or(false);

    let mut triple_note = String::new();
    if game_is_iostore {
        let (utoc, ucas) = super::retoc_wrapper::write_zen_pair_for(&pak_path).await
            .map_err(|e| {
                // Niente pak orfano in giro: meglio nessuna patch di una
                // patch che sembra installata e non fa nulla.
                let _ = fs::remove_file(&pak_path);
                format!("Coppia .utoc/.ucas non generata: {} — il pak è stato rimosso per non lasciare una patch che sembra installata ma il gioco ignorerebbe.", e)
            })?;
        // Prova di effetto: la tripletta è su disco, tutti e tre i file.
        for p in [&pak_path, &utoc, &ucas] {
            if !p.exists() {
                return Err(format!("Tripletta incompleta: manca {}", p.display()));
            }
        }
        log::info!("✅ Tripletta completa: {} + .utoc + .ucas", pak_filename);
        triple_note = " + coppia .utoc/.ucas (tripletta IoStore)".to_string();
    } else {
        log::info!("📦 Gioco senza IoStore: il _P.pak da solo basta, niente coppia zen");
    }

    Ok(TranslationPakResult {
        success: true,
        pak_path: pak_path.to_string_lossy().to_string(),
        entries_count: loc_entries.len(),
        message: format!(
            "Creato {} con {} traduzioni [{}]{}",
            pak_filename, loc_entries.len(), repak_result.method, triple_note
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
    
    let (source_version, entries) = parse_locres(&data)?;
    
    log::info!("📝 Creazione PAK tradotto: {} entry, {} traduzioni (LocRes v{})", entries.len(), translations.len(), source_version);
    
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
    
    // Scrivi il .locres nella stessa versione del sorgente (v2 per UE5, v0 per vecchi UE4)
    let locres_data = write_locres_matching_version(&translated_entries, source_version);
    
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

// ═══════════════════════════════════════════════════════════════════
// STATO E PIPELINE COMPLETA
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Serialize, Deserialize)]
pub struct UnrealLocStatus {
    pub has_locres: bool,
    pub locres_count: usize,
    pub has_gs_pak: bool,
    pub gs_pak_path: Option<String>,
    pub translated_entries: usize,
    pub paks_dir: Option<String>,
    pub message: String,
}

/// Restituisce lo stato corrente della localizzazione di un gioco UE
#[tauri::command]
pub async fn get_unreal_localization_status(game_path: String) -> Result<UnrealLocStatus, String> {
    let game_dir = Path::new(&game_path);
    let paks_dir = find_paks_dir(game_dir);

    let mut has_gs_pak = false;
    let mut gs_pak_path: Option<String> = None;
    let mut translated_entries = 0usize;

    if let Some(ref paks) = paks_dir {
        if let Ok(entries) = fs::read_dir(paks) {
            for entry in entries.flatten() {
                let p = entry.path();
                let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                if name.contains("GameStringer") && name.ends_with("_P.pak") {
                    has_gs_pak = true;
                    gs_pak_path = Some(p.to_string_lossy().to_string());
                }
            }
        }
    }

    // Prova a contare le stringhe nel pak GS se presente
    if let Some(ref pak_path) = gs_pak_path {
        if let Ok(data) = fs::read(pak_path) {
            if let Ok((_, index_offset, index_size, false)) = find_pak_footer(&data) {
                if let Ok((_, pak_entries)) = parse_pak_index(&data, 4, index_offset, index_size) {
                    for pe in &pak_entries {
                        if pe.filename.ends_with(".locres") {
                            if let Ok(locres_data) = extract_file_from_pak(&data, pe) {
                                if let Ok((_, loc_entries)) = parse_locres(&locres_data) {
                                    translated_entries += loc_entries.iter().filter(|e| !e.value.is_empty()).count();
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Cerca .locres liberi
    let loose_locres = find_loose_locres(game_dir);
    let has_locres = !loose_locres.is_empty() || paks_dir.is_some();
    let locres_count = loose_locres.len();

    let message = if has_gs_pak {
        format!("Patch GameStringer installata — {} stringhe tradotte", translated_entries)
    } else if has_locres {
        "Localizzazione trovata — pronto per la traduzione AI".to_string()
    } else {
        "Nessuna localizzazione trovata".to_string()
    };

    Ok(UnrealLocStatus {
        has_locres,
        locres_count,
        has_gs_pak,
        gs_pak_path,
        translated_entries,
        paks_dir: paks_dir.map(|p| p.to_string_lossy().to_string()),
        message,
    })
}

/// Pipeline completa: riceve entries già tradotte dal frontend (Ollama) e crea il _P.pak
/// Rimuove automaticamente il vecchio pak GS prima di creare il nuovo
#[tauri::command]
pub async fn auto_translate_unreal(
    game_path: String,
    translations: Vec<TranslatedEntry>,
    target_language: String,
) -> Result<TranslationPakResult, String> {
    let game_dir = Path::new(&game_path);

    if !game_dir.exists() {
        return Err(format!("Directory gioco non trovata: {}", game_path));
    }
    if translations.is_empty() {
        return Err("Nessuna traduzione fornita".to_string());
    }

    // 1. Rimuovi vecchi pak GS per questo gioco/lingua
    if let Some(paks_dir) = find_paks_dir(game_dir) {
        if let Ok(entries) = fs::read_dir(&paks_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                if name.contains("GameStringer") && name.contains(&target_language) && name.ends_with("_P.pak") {
                    let _ = fs::remove_file(&p);
                    log::info!("🗑️ Rimosso vecchio pak: {}", name);
                }
            }
        }
    }

    // 2. Applica traduzioni e crea nuovo pak
    apply_unreal_translation(game_path, translations, target_language).await
}

/// Rimuove la patch di traduzione dal gioco.
/// Retry automatico per file bloccati (es. gioco ancora in esecuzione).
/// Non abortisce al primo errore — prova a rimuovere tutti i file e segnala i fallimenti.
#[tauri::command]
pub async fn remove_unreal_translation(game_path: String) -> Result<String, String> {
    let game_dir = Path::new(&game_path);
    let paks_dir = find_paks_dir(game_dir)
        .ok_or("Directory Content/Paks non trovata")?;
    
    let mut removed = 0;
    let mut failed: Vec<String> = Vec::new();
    
    // Raccogli i file da rimuovere
    let mut targets: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(entries) = fs::read_dir(&paks_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name() {
                let name_str = name.to_string_lossy();
                if name_str.contains("GameStringer") && 
                   (name_str.ends_with("_P.pak") || name_str.ends_with("_P.utoc") || name_str.ends_with("_P.ucas")) {
                    targets.push(path);
                }
            }
        }
    }
    
    // Rimuovi con retry (3 tentativi, 500ms tra uno e l'altro)
    for path in &targets {
        let mut ok = false;
        for attempt in 1..=3 {
            match fs::remove_file(path) {
                Ok(()) => {
                    removed += 1;
                    log::info!("🗑️ Rimosso: {}", path.display());
                    ok = true;
                    break;
                }
                Err(e) => {
                    log::warn!("⚠️ Tentativo {}/3 rimozione {}: {}", attempt, path.display(), e);
                    if attempt < 3 {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                    }
                }
            }
        }
        if !ok {
            failed.push(path.file_name().unwrap_or_default().to_string_lossy().to_string());
        }
    }
    
    if failed.is_empty() {
        Ok(format!("Rimossi {} file di traduzione", removed))
    } else {
        Err(format!(
            "Rimossi {}/{} file. {} file bloccati (chiudi il gioco e riprova): {}",
            removed, targets.len(), failed.len(), failed.join(", ")
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;
    use tempfile::TempDir;

    // ── Helpers ─────────────────────────────────────────────────────────
    fn sample_entries() -> Vec<LocEntry> {
        vec![
            LocEntry { namespace: "UI".into(), key: "start".into(), source_hash: 111, value: "Start".into() },
            LocEntry { namespace: "UI".into(), key: "quit".into(), source_hash: 222, value: "Quit".into() },
            LocEntry { namespace: "Dialog".into(), key: "hello".into(), source_hash: 333, value: "Ciao mondo".into() },
        ]
    }

    /// Set comparabile (namespace, key, source_hash, value) per confronto indipendente dall'ordine.
    fn to_set(entries: &[LocEntry]) -> BTreeSet<(String, String, u32, String)> {
        entries.iter().map(|e| (e.namespace.clone(), e.key.clone(), e.source_hash, e.value.clone())).collect()
    }

    // ── Helper binari ───────────────────────────────────────────────────
    #[test]
    fn i32_round_trip() {
        let mut buf = Vec::new();
        write_i32(&mut buf, -123456);
        write_i32(&mut buf, 987654);
        let mut off = 0;
        assert_eq!(read_i32(&buf, &mut off).unwrap(), -123456);
        assert_eq!(read_i32(&buf, &mut off).unwrap(), 987654);
        assert_eq!(off, 8);
    }

    #[test]
    fn fstring_utf8_round_trip() {
        let mut buf = Vec::new();
        write_fstring(&mut buf, "Ciao");
        let mut off = 0;
        assert_eq!(read_fstring(&buf, &mut off).unwrap(), "Ciao");
    }

    /// ⚠️ Il difetto che rompeva l'italiano: la lunghezza POSITIVA in UE è
    /// ANSI a byte singolo, quindi "perché" scritto come UTF-8 con lunghezza
    /// positiva veniva riletto dal motore come "perchÃ©". Il non-ASCII deve
    /// uscire in UTF-16 con lunghezza NEGATIVA.
    #[test]
    fn fstring_non_ascii_is_written_as_utf16() {
        let mut buf = Vec::new();
        write_fstring(&mut buf, "perché");

        let len = i32::from_le_bytes(buf[0..4].try_into().unwrap());
        assert!(len < 0, "il non-ASCII deve avere lunghezza negativa (UTF-16), invece è {}", len);
        // 6 caratteri + terminatore = 7 unità da 16 bit
        assert_eq!(len, -7);
        assert_eq!(buf.len(), 4 + 7 * 2);
        // 'p' = 0x0070 little-endian
        assert_eq!(&buf[4..6], &[0x70u8, 0x00][..]);
        // terminatore UTF-16 in fondo
        assert_eq!(&buf[buf.len() - 2..], &[0x00u8, 0x00][..]);

        let mut off = 0;
        assert_eq!(read_fstring(&buf, &mut off).unwrap(), "perché");
    }

    #[test]
    fn fstring_ascii_stays_single_byte() {
        let mut buf = Vec::new();
        write_fstring(&mut buf, "Start");
        let len = i32::from_le_bytes(buf[0..4].try_into().unwrap());
        assert_eq!(len, 6); // 5 caratteri + terminatore
        assert_eq!(buf.len(), 4 + 6);
    }

    /// Tutte le lingue accentate che il progetto dichiara di supportare devono
    /// sopravvivere al giro completo, non solo l'italiano.
    #[test]
    fn locres_preserves_accented_languages() {
        let entries = vec![
            LocEntry { namespace: "UI".into(), key: "it".into(), source_hash: 1, value: "Perché però È".into() },
            LocEntry { namespace: "UI".into(), key: "fr".into(), source_hash: 2, value: "Élève à côté".into() },
            LocEntry { namespace: "UI".into(), key: "de".into(), source_hash: 3, value: "Grüße für Straße".into() },
            LocEntry { namespace: "UI".into(), key: "ru".into(), source_hash: 4, value: "Привет".into() },
            LocEntry { namespace: "UI".into(), key: "ja".into(), source_hash: 5, value: "こんにちは".into() },
            LocEntry { namespace: "UI".into(), key: "emoji".into(), source_hash: 6, value: "ok 🎮".into() },
        ];
        for bytes in [write_locres_v0(&entries), write_locres_v2(&entries)] {
            let (_v, parsed) = parse_locres(&bytes).unwrap();
            assert_eq!(to_set(&parsed), to_set(&entries));
        }
    }

    #[test]
    fn fstring_empty_round_trip() {
        let mut buf = Vec::new();
        write_fstring(&mut buf, "");
        let mut off = 0;
        assert_eq!(read_fstring(&buf, &mut off).unwrap(), "");
        assert_eq!(off, 4); // solo l'i32 di lunghezza
    }

    #[test]
    fn read_i32_eof_errors() {
        let buf = [0u8, 1];
        let mut off = 0;
        assert!(read_i32(&buf, &mut off).is_err());
    }

    // ── LocRes parser/writer round-trip ─────────────────────────────────
    #[test]
    fn locres_v0_round_trip() {
        let entries = sample_entries();
        let bytes = write_locres_v0(&entries);
        let (version, parsed) = parse_locres(&bytes).unwrap();
        assert_eq!(version, 0);
        assert_eq!(to_set(&parsed), to_set(&entries));
    }

    #[test]
    fn locres_v2_round_trip() {
        let entries = sample_entries();
        let bytes = write_locres_v2(&entries);
        let (version, parsed) = parse_locres(&bytes).unwrap();
        assert_eq!(version, 2);
        assert_eq!(to_set(&parsed), to_set(&entries));
    }

    // ── Forma del file, non round-trip ──────────────────────────────────
    // I test qui sotto NON usano il nostro parser per validare il nostro
    // writer: controllano i byte contro la specifica. Un round-trip che passa
    // dice solo che sappiamo rileggere quello che scriviamo, ed è esattamente
    // il motivo per cui il magic sbagliato è sopravvissuto ai test per mesi.

    /// Il magic è il FGuid documentato da Epic, 16 byte, non un u32.
    #[test]
    fn locres_v2_starts_with_the_ue_guid() {
        let bytes = write_locres_v2(&sample_entries());
        let atteso: [u8; 16] = [
            0x0E, 0x14, 0x74, 0x75, 0x67, 0x4A, 0x03, 0xFC,
            0x4A, 0x15, 0x90, 0x9D, 0xC3, 0x37, 0x7F, 0x1B,
        ];
        assert_eq!(
            &bytes[0..16],
            &atteso[..],
            "magic .locres diverso da FGuid(0x7574140E, 0xFC034A67, 0x9D90154A, 0x1B7F37C3)"
        );
        assert_eq!(bytes[16], 2, "il byte di versione segue i 16 del magic");
    }

    /// Legacy non ha header: il file comincia dal conteggio dei namespace.
    #[test]
    fn locres_v0_has_no_header_at_all() {
        let entries = sample_entries();
        let bytes = write_locres_v0(&entries);
        assert_ne!(&bytes[0..16], &LOCRES_MAGIC[..], "il Legacy NON deve avere il magic");
        // 2 namespace distinti in sample_entries: Dialog e UI
        let ns_count = i32::from_le_bytes(bytes[0..4].try_into().unwrap());
        assert_eq!(ns_count, 2, "il primo campo di un Legacy è il conteggio dei namespace");
    }

    /// Il campo dopo la versione è un OFFSET assoluto, non un conteggio.
    #[test]
    fn locres_v2_header_holds_an_absolute_offset() {
        let bytes = write_locres_v2(&sample_entries());
        let offset = i64::from_le_bytes(bytes[17..25].try_into().unwrap());

        assert!(offset > 25, "l'offset deve puntare oltre l'header, non valere 3 (il numero di stringhe)");
        assert!((offset as usize) < bytes.len(), "offset fuori dal file");

        // A quell'offset ci deve essere il conteggio delle stringhe condivise
        let o = offset as usize;
        let count = i32::from_le_bytes(bytes[o..o + 4].try_into().unwrap());
        assert_eq!(count, 3, "3 valori distinti in sample_entries");
    }

    /// Fixture scritta a mano dalla specifica: se il nostro parser la legge,
    /// il layout che assumiamo è quello di UE e non una nostra convenzione.
    #[test]
    fn parses_a_handbuilt_v3_fixture() {
        fn ansi(buf: &mut Vec<u8>, s: &str) {
            buf.extend_from_slice(&((s.len() + 1) as i32).to_le_bytes());
            buf.extend_from_slice(s.as_bytes());
            buf.push(0);
        }

        let mut buf = Vec::new();
        buf.extend_from_slice(&LOCRES_MAGIC);
        buf.push(3u8); // Optimized_CRC32
        let offset_pos = buf.len();
        buf.extend_from_slice(&(-1i64).to_le_bytes()); // segnaposto
        buf.extend_from_slice(&1u32.to_le_bytes()); // entries count (solo v3)
        buf.extend_from_slice(&1i32.to_le_bytes()); // 1 namespace
        buf.extend_from_slice(&0xAABBCCDDu32.to_le_bytes()); // ns hash
        ansi(&mut buf, "UI");
        buf.extend_from_slice(&1i32.to_le_bytes()); // 1 entry
        buf.extend_from_slice(&0x11223344u32.to_le_bytes()); // key hash
        ansi(&mut buf, "start");
        buf.extend_from_slice(&111u32.to_le_bytes()); // source hash
        buf.extend_from_slice(&0i32.to_le_bytes()); // indice nella string array

        let array_offset = buf.len() as i64;
        buf.extend_from_slice(&1i32.to_le_bytes()); // 1 stringa condivisa
        ansi(&mut buf, "Avvia");
        buf.extend_from_slice(&1i32.to_le_bytes()); // refcount
        buf[offset_pos..offset_pos + 8].copy_from_slice(&array_offset.to_le_bytes());

        let (version, entries) = parse_locres(&buf).unwrap();
        assert_eq!(version, 3);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].namespace, "UI");
        assert_eq!(entries[0].key, "start");
        assert_eq!(entries[0].source_hash, 111);
        assert_eq!(entries[0].value, "Avvia");
    }

    /// I file prodotti dal writer sbagliato (magic u32 0x0E14DA7A) non devono
    /// essere accettati in silenzio: senza magic valido diventano "Legacy" e
    /// il primo campo è spazzatura, quindi il parse deve FALLIRE.
    #[test]
    fn rejects_files_written_with_the_old_invented_magic() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&0x0E14DA7Au32.to_le_bytes());
        buf.push(2u8);
        buf.extend_from_slice(&[0u8; 64]);
        let err = parse_locres(&buf).unwrap_err();
        // Deve fallire per il MOTIVO giusto: senza magic valido il file viene
        // trattato da Legacy e il primo i32 (i byte del magic fasullo) è un
        // conteggio namespace assurdo. Un errore qualsiasi non basterebbe.
        assert!(err.contains("namespace"), "errore inatteso: {}", err);
    }

    #[test]
    fn locres_v2_dedups_shared_strings() {
        // Due entry con lo stesso valore: la string array deve deduplicare ma il parse li recupera entrambi.
        let entries = vec![
            LocEntry { namespace: "A".into(), key: "k1".into(), source_hash: 1, value: "Stesso".into() },
            LocEntry { namespace: "A".into(), key: "k2".into(), source_hash: 2, value: "Stesso".into() },
        ];
        let bytes = write_locres_v2(&entries);
        let (_v, parsed) = parse_locres(&bytes).unwrap();
        assert_eq!(parsed.len(), 2);
        assert!(parsed.iter().all(|e| e.value == "Stesso"));
    }

    #[test]
    fn matching_version_selects_writer() {
        let entries = sample_entries();
        // source_version >= 2 → writer v2
        let (v_hi, _) = parse_locres(&write_locres_matching_version(&entries, 3)).unwrap();
        assert_eq!(v_hi, 2);
        // source_version < 2 → writer v0
        let (v_lo, _) = parse_locres(&write_locres_matching_version(&entries, 1)).unwrap();
        assert_eq!(v_lo, 0);
    }

    #[test]
    fn parse_locres_rejects_future_version() {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&LOCRES_MAGIC);
        bytes.push(5u8); // versione > 3
        assert!(parse_locres(&bytes).is_err());
    }

    // ── .locmeta: round-trip e guardie ───────────────────────────────────
    // ⚠️ Il round-trip prova solo che scriviamo ciò che leggiamo: NON prova
    // che il formato sia quello di UE (fixture indipendente dal parser,
    // lezione [locres-magic]). La prova vera è parse_locmeta su un
    // Game.locmeta AUTENTICO estratto da un gioco — e poi lo schermo.

    #[test]
    fn locmeta_round_trip_v1() {
        let meta = LocMetaInfo {
            version: 1,
            native_culture: "en".to_string(),
            native_locres: "en/Game.locres".to_string(),
            compiled_cultures: vec!["en", "es", "de", "fr"].into_iter().map(String::from).collect(),
        };
        let bytes = write_locmeta(&meta);
        assert_eq!(&bytes[..16], &LOCMETA_MAGIC, "magic in testa");
        let parsed = parse_locmeta(&bytes).expect("round-trip v1");
        assert_eq!(parsed, meta);
    }

    #[test]
    fn locmeta_round_trip_v0_ignores_cultures() {
        let meta = LocMetaInfo {
            version: 0,
            native_culture: "en".to_string(),
            native_locres: "en/Game.locres".to_string(),
            compiled_cultures: vec![],
        };
        let parsed = parse_locmeta(&write_locmeta(&meta)).expect("round-trip v0");
        assert_eq!(parsed, meta);
        // v0 non serializza l'elenco: anche se qualcuno lo riempie, non esce.
        let mut sporco = meta.clone();
        sporco.compiled_cultures.push("it".to_string());
        let riletto = parse_locmeta(&write_locmeta(&sporco)).expect("v0 con elenco pieno");
        assert!(riletto.compiled_cultures.is_empty(), "v0 non deve serializzare culture");
    }

    #[test]
    fn locmeta_rejects_bad_magic_and_future_version() {
        assert!(parse_locmeta(&[0u8; 32]).is_err(), "magic sbagliato");
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&LOCMETA_MAGIC);
        bytes.push(2u8); // versione ignota
        bytes.extend_from_slice(&[0u8; 8]);
        assert!(parse_locmeta(&bytes).is_err(), "versione futura");
    }

    #[test]
    fn locmeta_add_culture_preserves_original() {
        // Il flusso di apply_unreal_translation: locmeta del gioco + cultura target.
        let originale = LocMetaInfo {
            version: 1,
            native_culture: "en".to_string(),
            native_locres: "en/Game.locres".to_string(),
            compiled_cultures: vec!["en", "es"].into_iter().map(String::from).collect(),
        };
        let mut modificato = parse_locmeta(&write_locmeta(&originale)).unwrap();
        assert!(!modificato.compiled_cultures.iter().any(|c| c == "it"));
        modificato.compiled_cultures.push("it".to_string());
        let finale = parse_locmeta(&write_locmeta(&modificato)).unwrap();
        assert_eq!(finale.native_culture, originale.native_culture, "cultura nativa intatta");
        assert_eq!(finale.native_locres, originale.native_locres, "path nativo intatto");
        assert_eq!(finale.compiled_cultures.len(), originale.compiled_cultures.len() + 1);
        assert!(finale.compiled_cultures.iter().any(|c| c == "it"));
        assert!(finale.compiled_cultures.iter().any(|c| c == "es"), "le culture del gioco restano");
    }

    // ── PAK writer + footer + index + estrazione (round-trip completo) ───
    #[test]
    fn pak_round_trip_extracts_locres() {
        let entries = sample_entries();
        let locres = write_locres_v0(&entries);
        let inner_path = "Game/Content/Localization/Game/en/Game.locres";
        let pak = create_pak_v4(&[(inner_path, &locres)]);

        // Footer
        let (version, index_offset, index_size, encrypted) = find_pak_footer(&pak).unwrap();
        assert_eq!(version, 8);
        assert!(!encrypted);

        // Index
        let (_mount, pak_entries) = parse_pak_index(&pak, version, index_offset, index_size).unwrap();
        assert_eq!(pak_entries.len(), 1);
        assert_eq!(pak_entries[0].filename, inner_path);
        assert_eq!(pak_entries[0].compression_method, 0);

        // Estrazione + parse del .locres contenuto
        let extracted = extract_file_from_pak(&pak, &pak_entries[0]).unwrap();
        let (_v, parsed) = parse_locres(&extracted).unwrap();
        assert_eq!(to_set(&parsed), to_set(&entries));
    }

    #[test]
    fn find_pak_footer_errors_on_garbage() {
        assert!(find_pak_footer(&[0u8; 64]).is_err());
    }

    #[test]
    fn cityhash32_is_deterministic() {
        assert_eq!(cityhash32(b"Hello"), cityhash32(b"Hello"));
        assert_ne!(cityhash32(b"Hello"), cityhash32(b"World"));
    }

    // ── Helper filesystem ───────────────────────────────────────────────
    fn touch(dir: &Path, rel: &str) {
        let p = dir.join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(&p, b"x").unwrap();
    }

    #[test]
    fn find_project_name_from_content_dir() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "MyGame/Content/placeholder");
        assert_eq!(find_project_name(tmp.path()).as_deref(), Some("MyGame"));
    }

    #[test]
    fn find_paks_dir_locates_paks_with_pak() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "MyGame/Content/Paks/MyGame.pak");
        let found = find_paks_dir(tmp.path()).unwrap();
        assert!(found.ends_with("Paks"));
    }

    #[test]
    fn find_paks_dir_none_when_absent() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "random/file.txt");
        assert!(find_paks_dir(tmp.path()).is_none());
    }

    #[test]
    fn find_loose_locres_finds_nested() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "a/b/c/Game.locres");
        let found = find_loose_locres(tmp.path());
        assert_eq!(found.len(), 1);
    }

    // ── Comandi (async) ─────────────────────────────────────────────────
    #[tokio::test]
    async fn parse_locres_file_command_round_trip() {
        let tmp = TempDir::new().unwrap();
        let p = tmp.path().join("Game.locres");
        fs::write(&p, write_locres_v2(&sample_entries())).unwrap();
        let res = parse_locres_file(p.to_string_lossy().to_string()).await.unwrap();
        assert!(res.success);
        assert_eq!(res.entries.len(), 3);
    }

    #[tokio::test]
    async fn parse_locres_file_command_errors_on_missing() {
        assert!(parse_locres_file("/nope/missing.locres".into()).await.is_err());
    }

    #[tokio::test]
    async fn status_reports_no_localization_for_empty_dir() {
        let tmp = TempDir::new().unwrap();
        let st = get_unreal_localization_status(tmp.path().to_string_lossy().to_string()).await.unwrap();
        assert!(!st.has_gs_pak);
        assert!(!st.has_locres);
    }

    #[tokio::test]
    async fn extract_unreal_localization_reads_loose_locres() {
        let tmp = TempDir::new().unwrap();
        let loc = tmp.path().join("Content/Localization/Game/en/Game.locres");
        fs::create_dir_all(loc.parent().unwrap()).unwrap();
        fs::write(&loc, write_locres_v0(&sample_entries())).unwrap();
        let res = extract_unreal_localization(tmp.path().to_string_lossy().to_string()).await.unwrap();
        assert!(res.success);
        assert_eq!(res.entries.len(), 3);
        // Regressione: il messaggio non deve dire "Estratte 0 stringhe".
        assert!(!res.message.contains("Estratte 0 "));
    }
}
