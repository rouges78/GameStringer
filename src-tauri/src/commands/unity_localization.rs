//! Unity Localization Package Pipeline
//!
//! Estrae, analizza e ricostruisce testi di localizzazione da giochi Unity
//! che usano il pacchetto Unity Localization (StringTable + Addressables).
//! Supporta UnityFS bundles, Smart Strings e catalog.json.

use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartToken {
    pub token_type: String,
    pub raw: String,
    pub inner: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StringTableEntry {
    pub key_id: i64,
    pub key_name: String,
    pub value: String,
    pub is_smart: bool,
    pub smart_tokens: Vec<SmartToken>,
    pub metadata: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StringTableInfo {
    pub table_name: String,
    pub table_id: String,
    pub locale: String,
    pub locale_name: String,
    pub entries: Vec<StringTableEntry>,
    pub bundle_path: String,
    pub asset_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressablesCatalog {
    pub locales: Vec<String>,
    pub tables: Vec<CatalogTableRef>,
    pub bundles: Vec<CatalogBundleRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogTableRef {
    pub table_name: String,
    pub locale: String,
    pub bundle_filename: String,
    pub internal_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogBundleRef {
    pub internal_id: String,
    pub bundle_path: String,
    pub dependencies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartStringValidation {
    pub valid: bool,
    pub missing_tokens: Vec<String>,
    pub extra_tokens: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslatedStringTableEntry {
    pub key_id: i64,
    pub translated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatchResult {
    pub success: bool,
    pub output_path: String,
    pub entries_patched: usize,
    pub message: String,
}

// ═══════════════════════════════════════════════════════════════════
// BINARY READ HELPERS
// ═══════════════════════════════════════════════════════════════════

#[allow(dead_code)]
fn read_u8(data: &[u8], offset: &mut usize) -> Result<u8, String> {
    if *offset >= data.len() {
        return Err(format!("EOF reading u8 at offset {}", offset));
    }
    let v = data[*offset];
    *offset += 1;
    Ok(v)
}

#[allow(dead_code)]
fn read_u16(data: &[u8], offset: &mut usize) -> Result<u16, String> {
    if *offset + 2 > data.len() {
        return Err(format!("EOF reading u16 at offset {}", offset));
    }
    let v = u16::from_le_bytes([data[*offset], data[*offset + 1]]);
    *offset += 2;
    Ok(v)
}

#[allow(dead_code)]
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

#[allow(dead_code)]
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

#[allow(dead_code)]
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

#[allow(dead_code)]
fn read_bytes(data: &[u8], offset: &mut usize, count: usize) -> Result<Vec<u8>, String> {
    if *offset + count > data.len() {
        return Err(format!("EOF reading {} bytes at offset {}", count, offset));
    }
    let v = data[*offset..*offset + count].to_vec();
    *offset += count;
    Ok(v)
}

// ═══════════════════════════════════════════════════════════════════
// BINARY WRITE HELPERS
// ═══════════════════════════════════════════════════════════════════

#[allow(dead_code)]
fn write_i32(buf: &mut Vec<u8>, v: i32) {
    buf.extend_from_slice(&v.to_le_bytes());
}

#[allow(dead_code)]
fn write_u32(buf: &mut Vec<u8>, v: u32) {
    buf.extend_from_slice(&v.to_le_bytes());
}

#[allow(dead_code)]
fn write_i64(buf: &mut Vec<u8>, v: i64) {
    buf.extend_from_slice(&v.to_le_bytes());
}

#[allow(dead_code)]
fn write_bytes(buf: &mut Vec<u8>, data: &[u8]) {
    buf.extend_from_slice(data);
}

// ═══════════════════════════════════════════════════════════════════
// UNITY-SPECIFIC HELPERS
// ═══════════════════════════════════════════════════════════════════

/// Allinea un offset al prossimo multiplo di 4
#[allow(dead_code)]
fn align4(offset: usize) -> usize {
    (offset + 3) & !3
}

/// Legge una stringa serializzata Unity (i32 length + bytes + padding a 4 byte)
#[allow(dead_code)]
fn read_unity_string(data: &[u8], offset: &mut usize) -> Result<String, String> {
    let length = read_i32(data, offset)?;

    if length < 0 {
        return Err(format!("Lunghezza stringa negativa ({}) a offset {}", length, *offset - 4));
    }
    if length == 0 {
        return Ok(String::new());
    }

    let len = length as usize;
    if *offset + len > data.len() {
        return Err(format!("EOF reading unity string ({} bytes) at offset {}", len, *offset));
    }

    let bytes = &data[*offset..*offset + len];
    *offset += len;

    // Padding a 4-byte alignment
    *offset = align4(*offset);

    // Prova UTF-8, fallback a lossy
    Ok(String::from_utf8_lossy(bytes).to_string())
}

/// Scrive una stringa serializzata Unity con alignment a 4 byte
#[allow(dead_code)]
fn write_unity_string(buf: &mut Vec<u8>, s: &str) {
    let bytes = s.as_bytes();
    write_i32(buf, bytes.len() as i32);
    buf.extend_from_slice(bytes);

    // Padding a 4-byte alignment
    let padded = align4(bytes.len());
    for _ in bytes.len()..padded {
        buf.push(0u8);
    }
}

/// Legge una stringa null-terminated dai dati
#[allow(dead_code)]
fn read_null_terminated_string(data: &[u8], offset: &mut usize) -> Result<String, String> {
    let start = *offset;
    while *offset < data.len() {
        if data[*offset] == 0 {
            let s = String::from_utf8_lossy(&data[start..*offset]).to_string();
            *offset += 1; // skip null terminator
            return Ok(s);
        }
        *offset += 1;
    }
    Err(format!("EOF cercando null terminator da offset {}", start))
}

// ═══════════════════════════════════════════════════════════════════
// LOCALE DETECTION
// ═══════════════════════════════════════════════════════════════════

/// Mappa di codici locale comuni usati da Unity Localization
fn locale_code_to_name(code: &str) -> String {
    match code.to_lowercase().as_str() {
        "en" => "English".to_string(),
        "it" => "Italian".to_string(),
        "fr" => "French".to_string(),
        "de" => "German".to_string(),
        "es" => "Spanish".to_string(),
        "pt" | "pt-br" => "Portuguese".to_string(),
        "ja" => "Japanese".to_string(),
        "ko" => "Korean".to_string(),
        "zh" | "zh-cn" => "Chinese (Simplified)".to_string(),
        "zh-tw" | "zh-hant" => "Chinese (Traditional)".to_string(),
        "ru" => "Russian".to_string(),
        "pl" => "Polish".to_string(),
        "nl" => "Dutch".to_string(),
        "sv" => "Swedish".to_string(),
        "da" => "Danish".to_string(),
        "fi" => "Finnish".to_string(),
        "no" | "nb" => "Norwegian".to_string(),
        "tr" => "Turkish".to_string(),
        "ar" => "Arabic".to_string(),
        "th" => "Thai".to_string(),
        "vi" => "Vietnamese".to_string(),
        "uk" => "Ukrainian".to_string(),
        "cs" => "Czech".to_string(),
        "hu" => "Hungarian".to_string(),
        "ro" => "Romanian".to_string(),
        "el" => "Greek".to_string(),
        "id" => "Indonesian".to_string(),
        other => other.to_string(),
    }
}

/// Estrae il codice locale da un nome file o internal_id di Unity
/// Pattern: "_en.asset", "_it.asset", "english(en)", "StringTable_ja", ecc.
fn detect_locale_from_name(name: &str) -> Option<String> {
    let lower = name.to_lowercase();

    // Pattern 1: "english(en)", "italian(it)" ecc.
    if let Some(start) = lower.find('(') {
        if let Some(end) = lower[start..].find(')') {
            let code = &lower[start + 1..start + end];
            if code.len() >= 2 && code.len() <= 5 && code.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
                return Some(code.to_string());
            }
        }
    }

    // Pattern 2: "_en.asset", "_ja.asset", "_pt-br.asset"
    let name_no_ext = if let Some(dot_pos) = lower.rfind('.') {
        &lower[..dot_pos]
    } else {
        &lower
    };

    if let Some(underscore_pos) = name_no_ext.rfind('_') {
        let candidate = &name_no_ext[underscore_pos + 1..];
        if candidate.len() >= 2 && candidate.len() <= 5
            && candidate.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
        {
            // Verifica che sia un codice locale noto
            let known = locale_code_to_name(candidate);
            if known != candidate {
                return Some(candidate.to_string());
            }
        }
    }

    // Pattern 3: path contiene /en/ o /english/ ecc.
    let locale_dirs = [
        ("english", "en"), ("italian", "it"), ("french", "fr"),
        ("german", "de"), ("spanish", "es"), ("japanese", "ja"),
        ("korean", "ko"), ("chinese", "zh"), ("russian", "ru"),
        ("portuguese", "pt"), ("polish", "pl"), ("dutch", "nl"),
        ("turkish", "tr"), ("arabic", "ar"), ("thai", "th"),
    ];

    for (long, short) in &locale_dirs {
        if lower.contains(&format!("/{}/", long)) || lower.contains(&format!("\\{}\\", long)) {
            return Some(short.to_string());
        }
        // Solo se è un segmento di path isolato (es. /en/)
        if lower.contains(&format!("/{}/", short)) || lower.contains(&format!("\\{}\\", short)) {
            return Some(short.to_string());
        }
    }

    None
}

// ═══════════════════════════════════════════════════════════════════
// UNITYFS BUNDLE PARSER
// ═══════════════════════════════════════════════════════════════════

/// Header di un UnityFS bundle
#[derive(Debug)]
struct UnityFSHeader {
    #[allow(dead_code)]
    format_version: u32,
    #[allow(dead_code)]
    unity_version: String,
    #[allow(dead_code)]
    generator_version: String,
    file_size: i64,
    compressed_block_info_size: u32,
    uncompressed_block_info_size: u32,
    flags: u32,
}

/// Informazioni su un blocco di dati nel bundle
#[derive(Debug)]
struct BlockInfo {
    uncompressed_size: u32,
    compressed_size: u32,
    flags: u16,
}

/// Entry di un file dentro il bundle
#[derive(Debug)]
struct NodeEntry {
    offset: i64,
    size: i64,
    #[allow(dead_code)]
    flags: u32,
    name: String,
}

/// Parsa l'header UnityFS da un buffer
fn parse_unityfs_header(data: &[u8]) -> Result<(UnityFSHeader, usize), String> {
    // Magic: "UnityFS\0"
    if data.len() < 16 {
        return Err("File troppo piccolo per essere un bundle Unity".into());
    }

    let magic = &data[0..8];
    if magic != b"UnityFS\0" {
        return Err(format!(
            "Magic non valido: atteso 'UnityFS\\0', trovato {:?}",
            String::from_utf8_lossy(&data[0..8])
        ));
    }

    let mut offset = 8usize;

    // Format version (u32 big-endian)
    let format_version = u32::from_be_bytes([
        data[offset], data[offset + 1], data[offset + 2], data[offset + 3],
    ]);
    offset += 4;

    // Unity version (null-terminated string)
    let unity_version = read_null_terminated_string(data, &mut offset)?;

    // Generator version (null-terminated string)
    let generator_version = read_null_terminated_string(data, &mut offset)?;

    // File size (i64 big-endian)
    let file_size = i64::from_be_bytes([
        data[offset], data[offset + 1], data[offset + 2], data[offset + 3],
        data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7],
    ]);
    offset += 8;

    // Compressed block info size (u32 big-endian)
    let compressed_block_info_size = u32::from_be_bytes([
        data[offset], data[offset + 1], data[offset + 2], data[offset + 3],
    ]);
    offset += 4;

    // Uncompressed block info size (u32 big-endian)
    let uncompressed_block_info_size = u32::from_be_bytes([
        data[offset], data[offset + 1], data[offset + 2], data[offset + 3],
    ]);
    offset += 4;

    // Flags (u32 big-endian)
    let flags = u32::from_be_bytes([
        data[offset], data[offset + 1], data[offset + 2], data[offset + 3],
    ]);
    offset += 4;

    log::info!(
        "UnityFS header: v{}, unity={}, size={}, block_info={}(compressed)/{}(uncompressed), flags=0x{:X}",
        format_version, unity_version, file_size,
        compressed_block_info_size, uncompressed_block_info_size, flags
    );

    Ok((UnityFSHeader {
        format_version,
        unity_version,
        generator_version,
        file_size,
        compressed_block_info_size,
        uncompressed_block_info_size,
        flags,
    }, offset))
}

/// Decomprime i block info e ottiene i blocchi + nodi
fn parse_block_info(
    data: &[u8],
    header: &UnityFSHeader,
    header_end: usize,
) -> Result<(Vec<BlockInfo>, Vec<NodeEntry>, usize), String> {
    let flags = header.flags;
    let compression = flags & 0x3F;

    // Determina dove si trovano i block info
    let block_info_at_end = (flags & 0x80) != 0;
    let block_info_offset = if block_info_at_end {
        // Block info alla fine del file
        (header.file_size as usize) - header.compressed_block_info_size as usize
    } else {
        header_end
    };

    let compressed_size = header.compressed_block_info_size as usize;
    if block_info_offset + compressed_size > data.len() {
        return Err(format!(
            "Block info fuori dal file: offset={}, size={}, file_len={}",
            block_info_offset, compressed_size, data.len()
        ));
    }

    let block_info_data = &data[block_info_offset..block_info_offset + compressed_size];

    // Decomprimi block info se necessario
    let uncompressed_info = match compression {
        0 => {
            // Nessuna compressione
            block_info_data.to_vec()
        }
        1 => {
            // LZMA — non supportato per ora
            return Err("Compressione LZMA per block info non supportata".into());
        }
        2 | 3 => {
            // LZ4 / LZ4HC
            let uncompressed_size = header.uncompressed_block_info_size as usize;
            lz4_flex::decompress(block_info_data, uncompressed_size)
                .map_err(|e| format!("Errore decompressione LZ4 block info: {}", e))?
        }
        _ => {
            return Err(format!("Tipo compressione block info sconosciuto: {}", compression));
        }
    };

    // Parsa block info decompresso
    let mut off = 0usize;
    let info_data = &uncompressed_info;

    // Skip uncompressed data hash (16 bytes)
    if off + 16 > info_data.len() {
        return Err("Block info troppo corto per hash".into());
    }
    off += 16;

    // Block count (i32 big-endian)
    if off + 4 > info_data.len() {
        return Err("Block info troppo corto per block count".into());
    }
    let block_count = i32::from_be_bytes([
        info_data[off], info_data[off + 1], info_data[off + 2], info_data[off + 3],
    ]);
    off += 4;

    if block_count < 0 || block_count > 100_000 {
        return Err(format!("Numero blocchi sospetto: {}", block_count));
    }

    let mut blocks = Vec::with_capacity(block_count as usize);
    for _ in 0..block_count {
        if off + 10 > info_data.len() {
            return Err("Block info troppo corto per blocco".into());
        }
        let uncompressed_size = u32::from_be_bytes([
            info_data[off], info_data[off + 1], info_data[off + 2], info_data[off + 3],
        ]);
        off += 4;
        let compressed_size = u32::from_be_bytes([
            info_data[off], info_data[off + 1], info_data[off + 2], info_data[off + 3],
        ]);
        off += 4;
        let block_flags = u16::from_be_bytes([info_data[off], info_data[off + 1]]);
        off += 2;

        blocks.push(BlockInfo {
            uncompressed_size,
            compressed_size,
            flags: block_flags,
        });
    }

    // Node count (i32 big-endian)
    if off + 4 > info_data.len() {
        return Err("Block info troppo corto per node count".into());
    }
    let node_count = i32::from_be_bytes([
        info_data[off], info_data[off + 1], info_data[off + 2], info_data[off + 3],
    ]);
    off += 4;

    if node_count < 0 || node_count > 100_000 {
        return Err(format!("Numero nodi sospetto: {}", node_count));
    }

    let mut nodes = Vec::with_capacity(node_count as usize);
    for _ in 0..node_count {
        if off + 20 > info_data.len() {
            return Err("Block info troppo corto per nodo".into());
        }
        let node_offset = i64::from_be_bytes([
            info_data[off], info_data[off + 1], info_data[off + 2], info_data[off + 3],
            info_data[off + 4], info_data[off + 5], info_data[off + 6], info_data[off + 7],
        ]);
        off += 8;
        let node_size = i64::from_be_bytes([
            info_data[off], info_data[off + 1], info_data[off + 2], info_data[off + 3],
            info_data[off + 4], info_data[off + 5], info_data[off + 6], info_data[off + 7],
        ]);
        off += 8;
        let node_flags = u32::from_be_bytes([
            info_data[off], info_data[off + 1], info_data[off + 2], info_data[off + 3],
        ]);
        off += 4;

        // Node name is a null-terminated string
        let name = {
            let start = off;
            while off < info_data.len() && info_data[off] != 0 {
                off += 1;
            }
            let s = String::from_utf8_lossy(&info_data[start..off]).to_string();
            if off < info_data.len() {
                off += 1; // skip null
            }
            s
        };

        nodes.push(NodeEntry {
            offset: node_offset,
            size: node_size,
            flags: node_flags,
            name,
        });
    }

    // Calcola dove iniziano i dati dei blocchi
    let data_offset = if block_info_at_end {
        header_end
    } else {
        block_info_offset + compressed_size
    };

    log::info!(
        "UnityFS: {} blocchi, {} nodi, data_offset={}",
        blocks.len(), nodes.len(), data_offset
    );

    Ok((blocks, nodes, data_offset))
}

/// Decomprime tutti i blocchi dati del bundle in un singolo buffer
fn decompress_blocks(data: &[u8], blocks: &[BlockInfo], data_offset: usize) -> Result<Vec<u8>, String> {
    let mut result = Vec::new();
    let mut current_offset = data_offset;

    for (i, block) in blocks.iter().enumerate() {
        let comp_size = block.compressed_size as usize;
        let uncomp_size = block.uncompressed_size as usize;
        let compression = block.flags & 0x3F;

        if current_offset + comp_size > data.len() {
            return Err(format!(
                "Blocco {} fuori dal file: offset={}, size={}, file_len={}",
                i, current_offset, comp_size, data.len()
            ));
        }

        let block_data = &data[current_offset..current_offset + comp_size];

        match compression {
            0 => {
                // Nessuna compressione
                result.extend_from_slice(block_data);
            }
            1 => {
                // LZMA
                return Err(format!("Blocco {} usa LZMA, non supportato", i));
            }
            2 | 3 => {
                // LZ4 / LZ4HC
                let decompressed = lz4_flex::decompress(block_data, uncomp_size)
                    .map_err(|e| format!("Errore LZ4 blocco {}: {}", i, e))?;
                result.extend_from_slice(&decompressed);
            }
            _ => {
                return Err(format!("Blocco {} compressione sconosciuta: {}", i, compression));
            }
        }

        current_offset += comp_size;
    }

    log::info!("Decompresso {} bytes totali dai blocchi", result.len());
    Ok(result)
}

// ═══════════════════════════════════════════════════════════════════
// STRING TABLE EXTRACTION (PATTERN SCANNING)
// ═══════════════════════════════════════════════════════════════════

/// Cerca una sequenza di byte in un buffer. Restituisce tutte le posizioni trovate.
fn find_all_occurrences(data: &[u8], pattern: &[u8]) -> Vec<usize> {
    let mut positions = Vec::new();
    if pattern.is_empty() || data.len() < pattern.len() {
        return positions;
    }
    for i in 0..=data.len() - pattern.len() {
        if data[i..i + pattern.len()] == *pattern {
            positions.push(i);
        }
    }
    positions
}

/// Verifica se una sequenza di byte è una stringa UTF-8 ragionevole
fn is_reasonable_utf8(bytes: &[u8]) -> bool {
    if bytes.is_empty() {
        return false;
    }
    match std::str::from_utf8(bytes) {
        Ok(s) => {
            // Deve avere almeno un carattere stampabile
            s.chars().any(|c| !c.is_control()) &&
            // Non deve essere tutta punteggiatura/spazi
            s.chars().any(|c| c.is_alphanumeric())
        }
        Err(_) => false,
    }
}

/// Cerca coppie (i64 key, string value) nel buffer decompresso.
/// Questo è il formato serializzato di m_TableEntries in Unity.
fn scan_for_string_table_entries(data: &[u8]) -> Vec<StringTableEntry> {
    let mut entries = Vec::new();

    // Strategia 1: Cerca "m_TableCollectionName" per localizzare l'asset
    let marker = b"m_TableCollectionName";
    let marker_positions = find_all_occurrences(data, marker);

    if !marker_positions.is_empty() {
        log::info!("Trovati {} marker m_TableCollectionName", marker_positions.len());
    }

    // Strategia 2: Cerca pattern di array serializzati
    // Unity serializza m_TableEntries come:
    //   i32 array_size (numero di entry)
    //   per ogni entry:
    //     i64 key_id
    //     i32 string_length
    //     bytes string_data
    //     (alignment padding)
    //     ... metadata opzionale

    // Scansione euristica: cerca sequenze di (i64, i32 len, utf8 string)
    let mut off = 0usize;
    let min_entries_for_table = 3; // Minimo entry per considerarlo una tabella valida
    let mut candidate_entries: Vec<StringTableEntry> = Vec::new();

    while off + 12 < data.len() {
        // Prova a leggere un i64 (potenziale key_id)
        let key_id = i64::from_le_bytes([
            data[off], data[off + 1], data[off + 2], data[off + 3],
            data[off + 4], data[off + 5], data[off + 6], data[off + 7],
        ]);

        // I key ID di Unity sono tipicamente hash a 64 bit o sequenziali piccoli
        // Filtriamo valori ragionevoli
        if key_id == 0 || (key_id > 0 && key_id < 0x7FFF_FFFF_FFFF_FFFF) {
            let str_off = off + 8;
            if str_off + 4 <= data.len() {
                let str_len = i32::from_le_bytes([
                    data[str_off], data[str_off + 1], data[str_off + 2], data[str_off + 3],
                ]);

                // Lunghezza ragionevole per una stringa di localizzazione
                if str_len > 0 && str_len < 10_000 {
                    let str_start = str_off + 4;
                    let str_end = str_start + str_len as usize;

                    if str_end <= data.len() && is_reasonable_utf8(&data[str_start..str_end]) {
                        let value = String::from_utf8_lossy(&data[str_start..str_end]).to_string();
                        let is_smart = value.contains('{') && value.contains('}');

                        let smart_tokens = if is_smart {
                            tokenize_smart_string(&value).unwrap_or_default()
                        } else {
                            Vec::new()
                        };

                        candidate_entries.push(StringTableEntry {
                            key_id,
                            key_name: format!("key_{}", key_id),
                            value,
                            is_smart,
                            smart_tokens,
                            metadata: None,
                        });

                        // Avanza oltre questa stringa + alignment
                        off = align4(str_end);
                        continue;
                    }
                }
            }
        }

        off += 1;
    }

    // Se abbiamo trovato abbastanza entry consecutive, considerala una tabella
    if candidate_entries.len() >= min_entries_for_table {
        log::info!(
            "Scansione euristica: trovate {} entry candidate",
            candidate_entries.len()
        );
        entries.extend(candidate_entries);
    }

    // Strategia 3: Cerca stringhe con pattern di chiave/valore Unity
    // Formato alternativo: m_TableEntries con array di SharedTableData.SharedTableEntry
    // che ha Key (i64) + Id (string) + Metadata
    let table_entries_marker = b"m_TableEntries";
    let te_positions = find_all_occurrences(data, table_entries_marker);

    for pos in te_positions {
        log::info!("Trovato m_TableEntries a offset {}", pos);

        // Cerca l'array serializzato dopo il marker
        // Salta marker + possibile type info + i32 array_count
        let search_start = pos + table_entries_marker.len();
        let search_end = std::cmp::min(search_start + 256, data.len());

        for scan_off in search_start..search_end.saturating_sub(4) {
            let potential_count = i32::from_le_bytes([
                data[scan_off], data[scan_off + 1], data[scan_off + 2], data[scan_off + 3],
            ]);

            if potential_count > 0 && potential_count < 100_000 {
                let mut entry_off = scan_off + 4;
                let mut found_entries = Vec::new();

                for _ in 0..potential_count {
                    if entry_off + 12 > data.len() {
                        break;
                    }

                    let kid = i64::from_le_bytes([
                        data[entry_off], data[entry_off + 1], data[entry_off + 2], data[entry_off + 3],
                        data[entry_off + 4], data[entry_off + 5], data[entry_off + 6], data[entry_off + 7],
                    ]);
                    entry_off += 8;

                    // Prova a leggere una Unity string (valore)
                    let mut temp_off = entry_off;
                    match read_unity_string(data, &mut temp_off) {
                        Ok(val) if !val.is_empty() && is_reasonable_utf8(val.as_bytes()) => {
                            let is_smart = val.contains('{') && val.contains('}');
                            let smart_tokens = if is_smart {
                                tokenize_smart_string(&val).unwrap_or_default()
                            } else {
                                Vec::new()
                            };

                            found_entries.push(StringTableEntry {
                                key_id: kid,
                                key_name: format!("key_{}", kid),
                                value: val,
                                is_smart,
                                smart_tokens,
                                metadata: None,
                            });
                            entry_off = temp_off;
                        }
                        _ => break,
                    }
                }

                if found_entries.len() >= min_entries_for_table {
                    log::info!(
                        "m_TableEntries array: {} entry estratte a offset {}",
                        found_entries.len(), scan_off
                    );
                    // Deduplicazione: non aggiungere se i key_id sono già presenti
                    let existing_keys: std::collections::HashSet<i64> =
                        entries.iter().map(|e| e.key_id).collect();
                    for fe in found_entries {
                        if !existing_keys.contains(&fe.key_id) {
                            entries.push(fe);
                        }
                    }
                    break; // Trovato l'array, stop scan per questo marker
                }
            }
        }
    }

    entries
}

/// Estrae il nome della tabella dal buffer decompresso
fn extract_table_name(data: &[u8]) -> Option<String> {
    // Cerca m_TableCollectionName seguito da una stringa
    let marker = b"m_TableCollectionName";
    for pos in find_all_occurrences(data, marker) {
        let after = pos + marker.len();
        // Cerca la prossima stringa serializzata Unity
        // Potrebbe esserci type info tra il marker e il valore
        let search_end = std::cmp::min(after + 128, data.len());
        for off in after..search_end.saturating_sub(4) {
            let len = i32::from_le_bytes([
                data[off], data[off + 1], data[off + 2], data[off + 3],
            ]);
            if len > 0 && len < 256 {
                let str_start = off + 4;
                let str_end = str_start + len as usize;
                if str_end <= data.len() {
                    if let Ok(s) = std::str::from_utf8(&data[str_start..str_end]) {
                        if s.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == ' ') {
                            return Some(s.to_string());
                        }
                    }
                }
            }
        }
    }

    // Fallback: cerca m_Name
    let name_marker = b"m_Name";
    for pos in find_all_occurrences(data, name_marker) {
        let after = pos + name_marker.len();
        let search_end = std::cmp::min(after + 128, data.len());
        for off in after..search_end.saturating_sub(4) {
            let len = i32::from_le_bytes([
                data[off], data[off + 1], data[off + 2], data[off + 3],
            ]);
            if len > 2 && len < 256 {
                let str_start = off + 4;
                let str_end = str_start + len as usize;
                if str_end <= data.len() {
                    if let Ok(s) = std::str::from_utf8(&data[str_start..str_end]) {
                        if s.contains("StringTable") || s.contains("Localization") {
                            return Some(s.to_string());
                        }
                    }
                }
            }
        }
    }

    None
}

/// Estrae il table ID (GUID) dal buffer decompresso
fn extract_table_id(data: &[u8]) -> Option<String> {
    // Cerca m_TableCollectionNameGuid
    let marker = b"m_TableCollectionNameGuid";
    for pos in find_all_occurrences(data, marker) {
        let after = pos + marker.len();
        let search_end = std::cmp::min(after + 128, data.len());
        for off in after..search_end.saturating_sub(4) {
            let len = i32::from_le_bytes([
                data[off], data[off + 1], data[off + 2], data[off + 3],
            ]);
            // GUID tipicamente 32-36 caratteri
            if len >= 32 && len <= 40 {
                let str_start = off + 4;
                let str_end = str_start + len as usize;
                if str_end <= data.len() {
                    if let Ok(s) = std::str::from_utf8(&data[str_start..str_end]) {
                        if s.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
                            return Some(s.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

// ═══════════════════════════════════════════════════════════════════
// SMART STRING TOKENIZER
// ═══════════════════════════════════════════════════════════════════

/// Tokenizza una Smart String di Unity in segmenti
fn tokenize_smart_string(input: &str) -> Result<Vec<SmartToken>, String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();
    let mut i = 0;
    let mut literal_buf = String::new();

    while i < len {
        // Escaped brace
        if chars[i] == '\\' && i + 1 < len && (chars[i + 1] == '{' || chars[i + 1] == '}') {
            literal_buf.push(chars[i + 1]);
            i += 2;
            continue;
        }

        if chars[i] == '{' {
            // Flush literal
            if !literal_buf.is_empty() {
                tokens.push(SmartToken {
                    token_type: "literal".to_string(),
                    raw: literal_buf.clone(),
                    inner: None,
                });
                literal_buf.clear();
            }

            // Trova la fine del token, gestendo braces annidati
            let start = i;
            let mut depth = 0;
            let mut end = i;

            while end < len {
                if chars[end] == '\\' && end + 1 < len {
                    end += 2; // skip escaped
                    continue;
                }
                if chars[end] == '{' {
                    depth += 1;
                } else if chars[end] == '}' {
                    depth -= 1;
                    if depth == 0 {
                        end += 1;
                        break;
                    }
                }
                end += 1;
            }

            let raw: String = chars[start..end].iter().collect();
            let inner_str: String = if end > start + 2 {
                chars[start + 1..end - 1].iter().collect()
            } else {
                String::new()
            };

            // Classifica il token
            let token_type = classify_smart_token(&inner_str);

            tokens.push(SmartToken {
                token_type,
                raw,
                inner: Some(inner_str),
            });

            i = end;
        } else {
            literal_buf.push(chars[i]);
            i += 1;
        }
    }

    // Flush ultimo literal
    if !literal_buf.is_empty() {
        tokens.push(SmartToken {
            token_type: "literal".to_string(),
            raw: literal_buf,
            inner: None,
        });
    }

    Ok(tokens)
}

/// Classifica il tipo di un token Smart String dal suo contenuto interno
fn classify_smart_token(inner: &str) -> String {
    if inner.is_empty() {
        return "variable".to_string();
    }

    // Controlla per plural: contiene "plural:" e sotto-braces
    if inner.contains(":plural:") || inner.contains(":p:") {
        return "plural".to_string();
    }

    // Controlla per braces annidati (nested)
    if inner.contains('{') {
        return "nested".to_string();
    }

    // Controlla per formatter: contiene ":"
    if inner.contains(':') {
        return "formatter".to_string();
    }

    // Semplice variabile
    "variable".to_string()
}

/// Estrae tutti i token `{...}` da una stringa (per confronto traduzioni)
fn extract_brace_tokens(s: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = s.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        if chars[i] == '\\' && i + 1 < len {
            i += 2;
            continue;
        }
        if chars[i] == '{' {
            let start = i;
            let mut depth = 0;
            while i < len {
                if chars[i] == '\\' && i + 1 < len {
                    i += 2;
                    continue;
                }
                if chars[i] == '{' {
                    depth += 1;
                } else if chars[i] == '}' {
                    depth -= 1;
                    if depth == 0 {
                        i += 1;
                        break;
                    }
                }
                i += 1;
            }
            let token: String = chars[start..i].iter().collect();
            tokens.push(token);
        } else {
            i += 1;
        }
    }

    tokens
}

// ═══════════════════════════════════════════════════════════════════
// FILESYSTEM HELPERS
// ═══════════════════════════════════════════════════════════════════

/// Walk directory fino a max_depth
fn walkdir(dir: &Path, max_depth: usize) -> Result<Vec<PathBuf>, String> {
    let mut results = Vec::new();
    walkdir_inner(dir, max_depth, 0, &mut results)?;
    Ok(results)
}

fn walkdir_inner(
    dir: &Path,
    max_depth: usize,
    depth: usize,
    results: &mut Vec<PathBuf>,
) -> Result<(), String> {
    if depth > max_depth {
        return Ok(());
    }

    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Errore lettura dir {}: {}", dir.display(), e))?;

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

// ═══════════════════════════════════════════════════════════════════
// TAURI COMMANDS
// ═══════════════════════════════════════════════════════════════════

/// Parsa il catalog.json di Unity Addressables per estrarre info su tabelle e bundle
#[tauri::command]
pub async fn parse_addressables_catalog(catalog_path: String) -> Result<AddressablesCatalog, String> {
    let path = Path::new(&catalog_path);

    if !path.exists() {
        return Err(format!("File catalogo non trovato: {}", catalog_path));
    }

    log::info!("Parsing catalogo Addressables: {}", catalog_path);

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Errore lettura catalogo: {}", e))?;

    let catalog: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON catalogo: {}", e))?;

    // Estrai m_InternalIds
    let internal_ids: Vec<String> = catalog
        .get("m_InternalIds")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    log::info!("Catalogo: {} internal IDs trovati", internal_ids.len());

    // Trova tabelle StringTable e bundle
    let mut locales = std::collections::HashSet::new();
    let mut tables = Vec::new();
    let mut bundles = Vec::new();
    let mut bundle_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    // Prima passata: identifica i bundle (path che finiscono con estensione bundle o senza estensione)
    for id in &internal_ids {
        let lower = id.to_lowercase();
        if lower.ends_with(".bundle") || lower.contains("_assets_") || lower.contains("_scenes_") {
            let filename = Path::new(id)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            bundle_map.insert(id.clone(), filename);
        }
    }

    // Seconda passata: identifica le StringTable
    for id in &internal_ids {
        let lower = id.to_lowercase();
        if lower.contains("stringtable") || lower.contains("localization") || lower.contains("localiz") {
            if lower.ends_with(".asset") {
                // Questo è un riferimento a una StringTable
                let table_name = Path::new(id)
                    .file_stem()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                let locale = detect_locale_from_name(id).unwrap_or_else(|| "unknown".to_string());
                locales.insert(locale.clone());

                // Trova il bundle associato (euristica: stesso prefisso o vicino nell'array)
                let bundle_filename = find_associated_bundle(id, &internal_ids, &bundle_map);

                tables.push(CatalogTableRef {
                    table_name: table_name.clone(),
                    locale: locale.clone(),
                    bundle_filename: bundle_filename.clone(),
                    internal_id: id.clone(),
                });
            }
        }
    }

    // Costruisci lista bundle
    for (internal_id, filename) in &bundle_map {
        bundles.push(CatalogBundleRef {
            internal_id: internal_id.clone(),
            bundle_path: filename.clone(),
            dependencies: Vec::new(), // Le dipendenze richiederebbero parsing più complesso di EntryData
        });
    }

    let mut locale_list: Vec<String> = locales.into_iter().collect();
    locale_list.sort();

    log::info!(
        "Catalogo parsato: {} locali, {} tabelle, {} bundle",
        locale_list.len(), tables.len(), bundles.len()
    );

    Ok(AddressablesCatalog {
        locales: locale_list,
        tables,
        bundles,
    })
}

/// Euristica per trovare il bundle associato a un asset di StringTable
fn find_associated_bundle(
    asset_id: &str,
    internal_ids: &[String],
    bundle_map: &std::collections::HashMap<String, String>,
) -> String {
    let asset_lower = asset_id.to_lowercase();

    // Estrai nome base della tabella (prima di _locale)
    let stem = Path::new(asset_id)
        .file_stem()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    // Cerca bundle con nome simile
    for (bid, bname) in bundle_map {
        let blower = bid.to_lowercase();
        if blower.contains(&stem) || bname.to_lowercase().contains(&stem) {
            return bname.clone();
        }
    }

    // Fallback: cerca bundle "vicino" nell'array di internal_ids
    if let Some(asset_idx) = internal_ids.iter().position(|id| id == asset_id) {
        // Cerca il bundle più vicino prima o dopo nell'array
        for distance in 1..20 {
            if asset_idx >= distance {
                let candidate = &internal_ids[asset_idx - distance];
                if bundle_map.contains_key(candidate) {
                    return bundle_map[candidate].clone();
                }
            }
            if asset_idx + distance < internal_ids.len() {
                let candidate = &internal_ids[asset_idx + distance];
                if bundle_map.contains_key(candidate) {
                    return bundle_map[candidate].clone();
                }
            }
        }
    }

    let _ = asset_lower; // suppress warning
    String::new()
}

/// Scansiona una cartella (tipicamente StreamingAssets/aa/StandaloneWindows64/)
/// alla ricerca di StringTable, bundle e catalog.json
#[tauri::command]
pub async fn detect_string_tables_in_folder(folder_path: String) -> Result<Vec<StringTableInfo>, String> {
    let dir = Path::new(&folder_path);

    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Directory non trovata: {}", folder_path));
    }

    log::info!("Scansione cartella per StringTable: {}", folder_path);

    let files = walkdir(dir, 4)
        .map_err(|e| format!("Errore scansione cartella: {}", e))?;

    let mut results = Vec::new();

    // 1. Cerca catalog.json
    let catalogs: Vec<&PathBuf> = files.iter()
        .filter(|f| {
            f.file_name()
                .map(|n| n.to_string_lossy().to_lowercase().contains("catalog") &&
                         n.to_string_lossy().to_lowercase().ends_with(".json"))
                .unwrap_or(false)
        })
        .collect();

    if !catalogs.is_empty() {
        log::info!("Trovati {} file catalog.json", catalogs.len());
        for cat_path in &catalogs {
            match parse_addressables_catalog(cat_path.to_string_lossy().to_string()).await {
                Ok(catalog) => {
                    for table_ref in &catalog.tables {
                        results.push(StringTableInfo {
                            table_name: table_ref.table_name.clone(),
                            table_id: String::new(),
                            locale: table_ref.locale.clone(),
                            locale_name: locale_code_to_name(&table_ref.locale),
                            entries: Vec::new(), // Non estratte ancora, solo detection
                            bundle_path: table_ref.bundle_filename.clone(),
                            asset_path: table_ref.internal_id.clone(),
                        });
                    }
                }
                Err(e) => {
                    log::warn!("Errore parsing catalogo {}: {}", cat_path.display(), e);
                }
            }
        }
    }

    // 2. Cerca file .bundle con nomi localizzazione
    let bundle_files: Vec<&PathBuf> = files.iter()
        .filter(|f| {
            let name = f.to_string_lossy().to_lowercase();
            (name.ends_with(".bundle") || name.contains("_assets_all_")) &&
            (name.contains("local") || name.contains("string") || name.contains("text"))
        })
        .collect();

    for bundle_path in &bundle_files {
        let name = bundle_path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let locale = detect_locale_from_name(&name).unwrap_or_else(|| "unknown".to_string());

        // Controlla se non è già stato trovato dal catalogo
        let already_found = results.iter().any(|r| {
            r.bundle_path == name || r.bundle_path == bundle_path.to_string_lossy().to_string()
        });

        if !already_found {
            results.push(StringTableInfo {
                table_name: name.clone(),
                table_id: String::new(),
                locale: locale.clone(),
                locale_name: locale_code_to_name(&locale),
                entries: Vec::new(),
                bundle_path: bundle_path.to_string_lossy().to_string(),
                asset_path: String::new(),
            });
        }
    }

    // 3. Cerca file .asset diretti che potrebbero essere StringTable
    let asset_files: Vec<&PathBuf> = files.iter()
        .filter(|f| {
            let name = f.to_string_lossy().to_lowercase();
            name.ends_with(".asset") &&
            (name.contains("stringtable") || name.contains("localization"))
        })
        .collect();

    for asset_path in &asset_files {
        let name = asset_path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let locale = detect_locale_from_name(&name).unwrap_or_else(|| "unknown".to_string());

        results.push(StringTableInfo {
            table_name: name.clone(),
            table_id: String::new(),
            locale: locale.clone(),
            locale_name: locale_code_to_name(&locale),
            entries: Vec::new(),
            bundle_path: String::new(),
            asset_path: asset_path.to_string_lossy().to_string(),
        });
    }

    log::info!("Scansione completata: {} tabelle trovate", results.len());
    Ok(results)
}

/// Estrae le StringTable da un Unity Asset Bundle.
/// Parser ibrido: prova type tree, poi scansione a pattern.
#[tauri::command]
pub async fn extract_string_table(bundle_path: String) -> Result<Vec<StringTableInfo>, String> {
    let path = Path::new(&bundle_path);

    if !path.exists() {
        return Err(format!("File bundle non trovato: {}", bundle_path));
    }

    log::info!("Estrazione StringTable da bundle: {}", bundle_path);

    let data = fs::read(path)
        .map_err(|e| format!("Errore lettura bundle: {}", e))?;

    // 1. Parsa header UnityFS
    let (header, header_end) = parse_unityfs_header(&data)?;

    // 2. Parsa block info
    let (blocks, nodes, data_offset) = parse_block_info(&data, &header, header_end)?;

    // 3. Decomprimi tutti i blocchi
    let decompressed = decompress_blocks(&data, &blocks, data_offset)?;

    log::info!(
        "Bundle decompresso: {} bytes, {} nodi",
        decompressed.len(), nodes.len()
    );

    // 4. Per ogni nodo, estrai i dati dell'asset e cerca StringTable
    let mut tables = Vec::new();

    for node in &nodes {
        let node_start = node.offset as usize;
        let node_end = node_start + node.size as usize;

        if node_end > decompressed.len() {
            log::warn!(
                "Nodo '{}' fuori dal buffer: offset={}, size={}, buffer={}",
                node.name, node.offset, node.size, decompressed.len()
            );
            continue;
        }

        let node_data = &decompressed[node_start..node_end];

        log::info!(
            "Analisi nodo '{}': {} bytes (offset {})",
            node.name, node.size, node.offset
        );

        // Cerca le entry della StringTable
        let entries = scan_for_string_table_entries(node_data);

        if entries.is_empty() {
            log::info!("Nodo '{}': nessuna entry StringTable trovata", node.name);
            continue;
        }

        // Estrai metadati
        let table_name = extract_table_name(node_data)
            .unwrap_or_else(|| node.name.clone());
        let table_id = extract_table_id(node_data)
            .unwrap_or_default();

        let locale = detect_locale_from_name(&bundle_path)
            .or_else(|| detect_locale_from_name(&node.name))
            .or_else(|| detect_locale_from_name(&table_name))
            .unwrap_or_else(|| "unknown".to_string());

        log::info!(
            "Tabella '{}' (locale: {}): {} entry estratte",
            table_name, locale, entries.len()
        );

        tables.push(StringTableInfo {
            table_name,
            table_id,
            locale: locale.clone(),
            locale_name: locale_code_to_name(&locale),
            entries,
            bundle_path: bundle_path.clone(),
            asset_path: node.name.clone(),
        });
    }

    // Se nessun nodo ha prodotto risultati, prova scansione globale
    if tables.is_empty() && !decompressed.is_empty() {
        log::info!("Nessuna tabella trovata nei nodi, provo scansione globale...");

        let entries = scan_for_string_table_entries(&decompressed);

        if !entries.is_empty() {
            let table_name = extract_table_name(&decompressed)
                .unwrap_or_else(|| {
                    Path::new(&bundle_path)
                        .file_stem()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "UnknownTable".to_string())
                });

            let table_id = extract_table_id(&decompressed).unwrap_or_default();
            let locale = detect_locale_from_name(&bundle_path)
                .unwrap_or_else(|| "unknown".to_string());

            log::info!(
                "Scansione globale: '{}' (locale: {}): {} entry",
                table_name, locale, entries.len()
            );

            tables.push(StringTableInfo {
                table_name,
                table_id,
                locale: locale.clone(),
                locale_name: locale_code_to_name(&locale),
                entries,
                bundle_path: bundle_path.clone(),
                asset_path: String::new(),
            });
        }
    }

    if tables.is_empty() {
        log::warn!("Nessuna StringTable trovata nel bundle {}", bundle_path);
    }

    Ok(tables)
}

/// Tokenizza una Smart String di Unity in segmenti
#[tauri::command]
pub async fn parse_smart_string(input: String) -> Result<Vec<SmartToken>, String> {
    log::info!("Parsing Smart String: '{}'", &input[..std::cmp::min(input.len(), 80)]);
    tokenize_smart_string(&input)
}

/// Valida una traduzione rispetto all'originale verificando i token Smart String
#[tauri::command]
pub async fn validate_smart_string_translation(
    original: String,
    translated: String,
) -> Result<SmartStringValidation, String> {
    let original_tokens = extract_brace_tokens(&original);
    let translated_tokens = extract_brace_tokens(&translated);

    let mut missing_tokens = Vec::new();
    let mut extra_tokens = Vec::new();
    let mut warnings = Vec::new();

    // Confronta token originali vs tradotti
    let mut translated_remaining: Vec<String> = translated_tokens.clone();

    for orig_token in &original_tokens {
        if let Some(pos) = translated_remaining.iter().position(|t| t == orig_token) {
            translated_remaining.remove(pos);
        } else {
            missing_tokens.push(orig_token.clone());
        }
    }

    // Token in più nella traduzione
    for extra in &translated_remaining {
        extra_tokens.push(extra.clone());
    }

    // Warning aggiuntivi
    if original_tokens.is_empty() && translated_tokens.is_empty() {
        // Nessun token, tutto OK
    } else if original_tokens.is_empty() && !translated_tokens.is_empty() {
        warnings.push(format!(
            "L'originale non contiene token Smart String, ma la traduzione ne ha {}",
            translated_tokens.len()
        ));
    }

    // Controlla ordine dei token (warning, non errore)
    if missing_tokens.is_empty() && extra_tokens.is_empty() {
        let orig_order: Vec<&str> = original_tokens.iter().map(|s| s.as_str()).collect();
        let trans_order: Vec<&str> = translated_tokens.iter().map(|s| s.as_str()).collect();
        if orig_order != trans_order {
            warnings.push(
                "I token sono presenti ma in ordine diverso. Questo potrebbe essere intenzionale per la lingua target.".to_string()
            );
        }
    }

    // Controlla braces non bilanciate nella traduzione
    let open_count = translated.chars().filter(|&c| c == '{').count();
    let close_count = translated.chars().filter(|&c| c == '}').count();
    if open_count != close_count {
        warnings.push(format!(
            "Braces non bilanciate nella traduzione: {} aperture, {} chiusure",
            open_count, close_count
        ));
    }

    let valid = missing_tokens.is_empty() && extra_tokens.is_empty() &&
        warnings.iter().all(|w| !w.contains("non bilanciate"));

    Ok(SmartStringValidation {
        valid,
        missing_tokens,
        extra_tokens,
        warnings,
    })
}

/// Costruisce un bundle patchato con le traduzioni fornite.
/// Strategia iniziale: sostituzione diretta per stringhe di uguale o minore lunghezza,
/// con padding a null per riempire lo spazio rimanente.
#[tauri::command]
pub async fn build_patched_bundle(
    original_bundle: String,
    translations: Vec<TranslatedStringTableEntry>,
    output_path: String,
) -> Result<PatchResult, String> {
    let path = Path::new(&original_bundle);

    if !path.exists() {
        return Err(format!("Bundle originale non trovato: {}", original_bundle));
    }

    log::info!(
        "Patching bundle: {} con {} traduzioni -> {}",
        original_bundle, translations.len(), output_path
    );

    let data = fs::read(path)
        .map_err(|e| format!("Errore lettura bundle: {}", e))?;

    // 1. Parsa header e decomprimi
    let (header, header_end) = parse_unityfs_header(&data)?;
    let (blocks, _nodes, data_offset) = parse_block_info(&data, &header, header_end)?;
    let mut decompressed = decompress_blocks(&data, &blocks, data_offset)?;

    // 2. Costruisci mappa traduzioni per key_id
    let translation_map: std::collections::HashMap<i64, &str> = translations.iter()
        .map(|t| (t.key_id, t.translated.as_str()))
        .collect();

    // 3. Estrai le entry originali per trovare le posizioni delle stringhe
    let original_entries = scan_for_string_table_entries(&decompressed);

    let mut patched_count = 0usize;
    let mut skipped_longer = 0usize;

    // 4. Per ogni entry, cerca e sostituisci la stringa nel buffer decompresso
    for entry in &original_entries {
        if let Some(&translated) = translation_map.get(&entry.key_id) {
            // Trova la stringa originale nel buffer
            let original_bytes = entry.value.as_bytes();
            let translated_bytes = translated.as_bytes();

            // Cerca la stringa originale preceduta dalla sua lunghezza (i32)
            let original_len = original_bytes.len() as i32;
            let len_bytes = original_len.to_le_bytes();

            let mut found = false;
            for i in 0..decompressed.len().saturating_sub(4 + original_bytes.len()) {
                if decompressed[i..i + 4] == len_bytes
                    && i + 4 + original_bytes.len() <= decompressed.len()
                    && decompressed[i + 4..i + 4 + original_bytes.len()] == *original_bytes
                {
                    // Trovata la stringa. Controlla se la traduzione ci sta
                    let available_space = original_bytes.len();
                    let aligned_end = align4(i + 4 + available_space);
                    let total_available = aligned_end - (i + 4);

                    if translated_bytes.len() <= total_available {
                        // Scrivi la nuova lunghezza
                        let new_len_bytes = (translated_bytes.len() as i32).to_le_bytes();
                        decompressed[i..i + 4].copy_from_slice(&new_len_bytes);

                        // Scrivi la traduzione
                        let write_start = i + 4;
                        decompressed[write_start..write_start + translated_bytes.len()]
                            .copy_from_slice(translated_bytes);

                        // Padding con null
                        for j in write_start + translated_bytes.len()..aligned_end {
                            if j < decompressed.len() {
                                decompressed[j] = 0;
                            }
                        }

                        patched_count += 1;
                        found = true;
                        break;
                    } else {
                        log::warn!(
                            "Traduzione troppo lunga per key {}: {} bytes > {} disponibili",
                            entry.key_id, translated_bytes.len(), total_available
                        );
                        skipped_longer += 1;
                        found = true;
                        break;
                    }
                }
            }

            if !found {
                log::warn!(
                    "Stringa originale non trovata nel buffer per key {}: '{}'",
                    entry.key_id, &entry.value[..std::cmp::min(entry.value.len(), 50)]
                );
            }
        }
    }

    // 5. Ricomprimi e scrivi il file di output
    let output = rebuild_bundle(&data, &header, header_end, &blocks, data_offset, &decompressed)?;

    // Crea directory di output se necessario
    if let Some(parent) = Path::new(&output_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Errore creazione directory output: {}", e))?;
    }

    fs::write(&output_path, &output)
        .map_err(|e| format!("Errore scrittura bundle patchato: {}", e))?;

    let message = if skipped_longer > 0 {
        format!(
            "Patchate {} entry su {} ({} saltate: traduzione troppo lunga)",
            patched_count, translations.len(), skipped_longer
        )
    } else {
        format!("Patchate {} entry su {}", patched_count, translations.len())
    };

    log::info!("Patching completato: {}", message);

    Ok(PatchResult {
        success: patched_count > 0,
        output_path: output_path.clone(),
        entries_patched: patched_count,
        message,
    })
}

/// Ricostruisce un bundle Unity dai dati decompessi modificati.
/// Per compressione LZ4 ricomprime i blocchi; per nessuna compressione copia direttamente.
fn rebuild_bundle(
    original_data: &[u8],
    header: &UnityFSHeader,
    header_end: usize,
    original_blocks: &[BlockInfo],
    original_data_offset: usize,
    decompressed: &[u8],
) -> Result<Vec<u8>, String> {
    let flags = header.flags;
    let block_info_at_end = (flags & 0x80) != 0;

    // Ricostruisci i blocchi dati
    let mut new_block_data = Vec::new();
    let mut new_blocks_info: Vec<(u32, u32, u16)> = Vec::new(); // (uncomp, comp, flags)
    let mut decomp_offset = 0usize;

    for block in original_blocks {
        let uncomp_size = block.uncompressed_size as usize;
        let block_compression = block.flags & 0x3F;

        let block_end = std::cmp::min(decomp_offset + uncomp_size, decompressed.len());
        let block_slice = &decompressed[decomp_offset..block_end];

        match block_compression {
            0 => {
                // Nessuna compressione: copia direttamente
                new_block_data.extend_from_slice(block_slice);
                new_blocks_info.push((block_slice.len() as u32, block_slice.len() as u32, 0));
            }
            2 | 3 => {
                // LZ4/LZ4HC: ricomprimi con LZ4
                let compressed = lz4_flex::compress(block_slice);
                new_block_data.extend_from_slice(&compressed);
                new_blocks_info.push((
                    block_slice.len() as u32,
                    compressed.len() as u32,
                    block.flags,
                ));
            }
            _ => {
                return Err(format!(
                    "Impossibile ricostruire blocco con compressione {}",
                    block_compression
                ));
            }
        }

        decomp_offset += uncomp_size;
    }

    // Ricostruisci il block info
    let mut new_block_info_buf = Vec::new();

    // Hash dei dati non compressi (16 bytes, usiamo zeri per semplicità)
    new_block_info_buf.extend_from_slice(&[0u8; 16]);

    // Block count (i32 big-endian)
    let block_count = new_blocks_info.len() as i32;
    new_block_info_buf.extend_from_slice(&block_count.to_be_bytes());

    for (uncomp, comp, bflags) in &new_blocks_info {
        new_block_info_buf.extend_from_slice(&uncomp.to_be_bytes());
        new_block_info_buf.extend_from_slice(&comp.to_be_bytes());
        new_block_info_buf.extend_from_slice(&bflags.to_be_bytes());
    }

    // Node info (copia dall'originale)
    // Dobbiamo ricostruire la sezione nodi dal block info originale
    let original_compression = flags & 0x3F;
    let original_block_info_offset = if block_info_at_end {
        (header.file_size as usize) - header.compressed_block_info_size as usize
    } else {
        header_end
    };

    let original_compressed_info = &original_data[
        original_block_info_offset..original_block_info_offset + header.compressed_block_info_size as usize
    ];

    let original_uncompressed_info = match original_compression {
        0 => original_compressed_info.to_vec(),
        2 | 3 => {
            lz4_flex::decompress(original_compressed_info, header.uncompressed_block_info_size as usize)
                .map_err(|e| format!("Errore decompressione block info per rebuild: {}", e))?
        }
        _ => return Err("Compressione block info non supportata per rebuild".into()),
    };

    // Estrai la sezione nodi dall'info originale (tutto dopo i blocchi)
    // Skip: hash(16) + block_count(4) + blocks(10*n)
    let original_blocks_section_size = 16 + 4 + (original_blocks.len() * 10);
    if original_blocks_section_size < original_uncompressed_info.len() {
        let nodes_section = &original_uncompressed_info[original_blocks_section_size..];
        new_block_info_buf.extend_from_slice(nodes_section);
    }

    // Comprimi il nuovo block info
    let compressed_block_info = match original_compression {
        0 => new_block_info_buf.clone(),
        2 | 3 => lz4_flex::compress(&new_block_info_buf),
        _ => return Err("Compressione non supportata".into()),
    };

    // Assembla il file finale
    let mut result = Vec::new();

    // Copia header fino alla fine (prima dei campi variabili)
    // Ricostruiamo l'header da zero per aggiornare le dimensioni
    result.extend_from_slice(b"UnityFS\0");

    // Format version (big-endian)
    result.extend_from_slice(&header.format_version.to_be_bytes());

    // Unity version (null-terminated)
    result.extend_from_slice(header.unity_version.as_bytes());
    result.push(0);

    // Generator version (null-terminated)
    result.extend_from_slice(header.generator_version.as_bytes());
    result.push(0);

    // Placeholder per file_size (aggiornato dopo)
    let file_size_offset = result.len();
    result.extend_from_slice(&[0u8; 8]);

    // Compressed block info size
    result.extend_from_slice(&(compressed_block_info.len() as u32).to_be_bytes());

    // Uncompressed block info size
    result.extend_from_slice(&(new_block_info_buf.len() as u32).to_be_bytes());

    // Flags (conserva gli originali)
    result.extend_from_slice(&flags.to_be_bytes());

    if block_info_at_end {
        // Dati prima, block info alla fine
        result.extend_from_slice(&new_block_data);
        result.extend_from_slice(&compressed_block_info);
    } else {
        // Block info prima, poi dati
        result.extend_from_slice(&compressed_block_info);
        result.extend_from_slice(&new_block_data);
    }

    // Aggiorna file_size nell'header
    let file_size = result.len() as i64;
    let file_size_bytes = file_size.to_be_bytes();
    result[file_size_offset..file_size_offset + 8].copy_from_slice(&file_size_bytes);

    let _ = original_data_offset; // suppress warning

    Ok(result)
}
