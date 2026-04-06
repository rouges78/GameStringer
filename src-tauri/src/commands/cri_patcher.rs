// CRI Middleware Patcher
// Supporto per giochi CRI (Persona, Yakuza/Like a Dragon, Tales of, Dragon Ball, Danganronpa V3 PC, ecc.)
// Parsing CPK, decompressione CRILAYLA, estrazione/patch testi

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
pub struct CriGameInfo {
    pub game_type: String,
    pub game_name: String,
    pub game_path: String,
    pub cpk_files: Vec<CpkFileInfo>,
    pub text_file_patterns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpkFileInfo {
    pub path: String,
    pub size: u64,
    pub file_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpkEntry {
    pub path: String,
    pub size: u64,
    pub extract_size: u64,
    pub compressed: bool,
    pub id: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriTextFile {
    pub internal_path: String,
    pub data: Vec<u8>,
    pub encoding: String,
    pub format_hint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriStringEntry {
    pub index: u32,
    pub key: String,
    pub value: String,
    pub context: String,
    pub speaker: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriFilePatch {
    pub internal_path: String,
    pub data: Vec<u8>,
}

// ============================================================================
// BINARY READ HELPERS (Big Endian per UTF tables CRI)
// ============================================================================

fn read_u8_at(data: &[u8], offset: &mut usize) -> Result<u8, String> {
    if *offset >= data.len() {
        return Err(format!("EOF leggendo u8 a offset {}", offset));
    }
    let v = data[*offset];
    *offset += 1;
    Ok(v)
}

fn read_u16_be(data: &[u8], offset: &mut usize) -> Result<u16, String> {
    if *offset + 2 > data.len() {
        return Err(format!("EOF leggendo u16 BE a offset {}", offset));
    }
    let v = u16::from_be_bytes([data[*offset], data[*offset + 1]]);
    *offset += 2;
    Ok(v)
}

fn read_u32_be(data: &[u8], offset: &mut usize) -> Result<u32, String> {
    if *offset + 4 > data.len() {
        return Err(format!("EOF leggendo u32 BE a offset {}", offset));
    }
    let v = u32::from_be_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
    ]);
    *offset += 4;
    Ok(v)
}

fn read_u64_be(data: &[u8], offset: &mut usize) -> Result<u64, String> {
    if *offset + 8 > data.len() {
        return Err(format!("EOF leggendo u64 BE a offset {}", offset));
    }
    let v = u64::from_be_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
        data[*offset + 4], data[*offset + 5], data[*offset + 6], data[*offset + 7],
    ]);
    *offset += 8;
    Ok(v)
}

fn read_i32_be(data: &[u8], offset: &mut usize) -> Result<i32, String> {
    if *offset + 4 > data.len() {
        return Err(format!("EOF leggendo i32 BE a offset {}", offset));
    }
    let v = i32::from_be_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
    ]);
    *offset += 4;
    Ok(v)
}

fn read_i64_be(data: &[u8], offset: &mut usize) -> Result<i64, String> {
    if *offset + 8 > data.len() {
        return Err(format!("EOF leggendo i64 BE a offset {}", offset));
    }
    let v = i64::from_be_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
        data[*offset + 4], data[*offset + 5], data[*offset + 6], data[*offset + 7],
    ]);
    *offset += 8;
    Ok(v)
}

fn read_f32_be(data: &[u8], offset: &mut usize) -> Result<f32, String> {
    if *offset + 4 > data.len() {
        return Err(format!("EOF leggendo f32 BE a offset {}", offset));
    }
    let v = f32::from_be_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
    ]);
    *offset += 4;
    Ok(v)
}

fn read_f64_be(data: &[u8], offset: &mut usize) -> Result<f64, String> {
    if *offset + 8 > data.len() {
        return Err(format!("EOF leggendo f64 BE a offset {}", offset));
    }
    let v = f64::from_be_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
        data[*offset + 4], data[*offset + 5], data[*offset + 6], data[*offset + 7],
    ]);
    *offset += 8;
    Ok(v)
}

fn read_u32_le(data: &[u8], offset: &mut usize) -> Result<u32, String> {
    if *offset + 4 > data.len() {
        return Err(format!("EOF leggendo u32 LE a offset {}", offset));
    }
    let v = u32::from_le_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
    ]);
    *offset += 4;
    Ok(v)
}

/// Legge una stringa null-terminated dal buffer a partire da offset assoluto
fn read_cstring(data: &[u8], start: usize) -> Result<String, String> {
    if start >= data.len() {
        return Err(format!("Offset stringa {} fuori range (len={})", start, data.len()));
    }
    let end = data[start..].iter().position(|&b| b == 0).unwrap_or(data.len() - start);
    let bytes = &data[start..start + end];
    String::from_utf8(bytes.to_vec())
        .map_err(|_| format!("Stringa UTF-8 non valida a offset {}", start))
}

// ============================================================================
// WRITE HELPERS (Big Endian)
// ============================================================================

#[allow(dead_code)]
fn write_u32_be(buf: &mut Vec<u8>, v: u32) {
    buf.extend_from_slice(&v.to_be_bytes());
}

#[allow(dead_code)]
fn write_u64_be(buf: &mut Vec<u8>, v: u64) {
    buf.extend_from_slice(&v.to_be_bytes());
}

#[allow(dead_code)]
fn write_u16_be(buf: &mut Vec<u8>, v: u16) {
    buf.extend_from_slice(&v.to_be_bytes());
}

// ============================================================================
// UTF TABLE — struttura core di tutti i formati CRI
// ============================================================================

/// Tipo di dato di una colonna UTF
#[derive(Debug, Clone, Copy, PartialEq)]
enum UtfDataType {
    U8 = 0,
    S8 = 1,
    U16 = 2,
    S16 = 3,
    U32 = 4,
    S32 = 5,
    U64 = 6,
    S64 = 7,
    Float = 8,
    Double = 9,
    StringRef = 10,
    Data = 11,
}

impl UtfDataType {
    fn from_flags(flags: u8) -> Result<Self, String> {
        match flags & 0x0F {
            0 => Ok(Self::U8),
            1 => Ok(Self::S8),
            2 => Ok(Self::U16),
            3 => Ok(Self::S16),
            4 => Ok(Self::U32),
            5 => Ok(Self::S32),
            6 => Ok(Self::U64),
            7 => Ok(Self::S64),
            8 => Ok(Self::Float),
            9 => Ok(Self::Double),
            10 => Ok(Self::StringRef),
            11 => Ok(Self::Data),
            other => Err(format!("Tipo dato UTF sconosciuto: {}", other)),
        }
    }

    fn byte_size(&self) -> usize {
        match self {
            Self::U8 | Self::S8 => 1,
            Self::U16 | Self::S16 => 2,
            Self::U32 | Self::S32 | Self::Float | Self::StringRef => 4,
            Self::U64 | Self::S64 | Self::Double => 8,
            Self::Data => 8, // offset(4) + size(4)
        }
    }
}

/// Tipo di storage di una colonna UTF
#[derive(Debug, Clone, Copy, PartialEq)]
enum UtfStorageType {
    PerRow = 0,
    Constant = 1,
    Zero = 3,
}

impl UtfStorageType {
    fn from_flags(flags: u8) -> Result<Self, String> {
        match (flags >> 4) & 0x0F {
            0 => Ok(Self::PerRow),
            1 => Ok(Self::Constant),
            3 => Ok(Self::Zero),
            other => Err(format!("Tipo storage UTF sconosciuto: {}", other)),
        }
    }
}

/// Definizione colonna UTF
#[derive(Debug, Clone)]
struct UtfColumn {
    name: String,
    data_type: UtfDataType,
    storage_type: UtfStorageType,
    constant_value: Option<UtfValue>,
}

/// Valore possibile in una cella UTF
#[derive(Debug, Clone)]
#[allow(dead_code)]
enum UtfValue {
    U8(u8),
    S8(i8),
    U16(u16),
    S16(i16),
    U32(u32),
    S32(i32),
    U64(u64),
    S64(i64),
    Float(f32),
    Double(f64),
    StringRef(String),
    Data(Vec<u8>),
    Null,
}

impl UtfValue {
    fn as_u32(&self) -> Option<u32> {
        match self {
            Self::U8(v) => Some(*v as u32),
            Self::U16(v) => Some(*v as u32),
            Self::U32(v) => Some(*v),
            Self::S32(v) => Some(*v as u32),
            _ => None,
        }
    }

    fn as_u64(&self) -> Option<u64> {
        match self {
            Self::U8(v) => Some(*v as u64),
            Self::U16(v) => Some(*v as u64),
            Self::U32(v) => Some(*v as u64),
            Self::U64(v) => Some(*v),
            Self::S64(v) => Some(*v as u64),
            _ => None,
        }
    }

    fn as_string(&self) -> Option<&str> {
        match self {
            Self::StringRef(s) => Some(s.as_str()),
            _ => None,
        }
    }
}

/// Tabella UTF parsata
#[derive(Debug, Clone)]
#[allow(dead_code)]
struct UtfTable {
    name: String,
    columns: Vec<UtfColumn>,
    rows: Vec<Vec<UtfValue>>,
}

impl UtfTable {
    /// Cerca il valore di una colonna in una riga
    fn get(&self, row: usize, col_name: &str) -> Option<&UtfValue> {
        let col_idx = self.columns.iter().position(|c| c.name == col_name)?;
        self.rows.get(row)?.get(col_idx)
    }

    fn get_string(&self, row: usize, col_name: &str) -> Option<&str> {
        self.get(row, col_name)?.as_string()
    }

    fn get_u32(&self, row: usize, col_name: &str) -> Option<u32> {
        self.get(row, col_name)?.as_u32()
    }

    fn get_u64(&self, row: usize, col_name: &str) -> Option<u64> {
        self.get(row, col_name)?.as_u64()
    }
}

/// Parsa una tabella @UTF dal buffer
fn parse_utf_table(data: &[u8], base_offset: usize) -> Result<UtfTable, String> {
    let mut off = base_offset;

    // Magic check: @UTF
    if off + 4 > data.len() {
        return Err("Dati insufficienti per magic @UTF".to_string());
    }
    if &data[off..off + 4] != b"@UTF" {
        return Err(format!("Magic @UTF non trovato a offset {} (trovato: {:?})",
            off, &data[off..off.min(data.len()).max(off + 4)]));
    }
    off += 4;

    let table_size = read_u32_be(data, &mut off)? as usize;
    let utf_data_start = off; // Inizio dei dati relativi alla tabella
    let utf_data_end = utf_data_start + table_size;

    if utf_data_end > data.len() {
        return Err(format!("Tabella UTF troncata: atteso {} byte, disponibili {}",
            table_size, data.len() - utf_data_start));
    }

    let schema_offset = read_u32_be(data, &mut off)? as usize;
    let rows_offset = read_u32_be(data, &mut off)? as usize;
    let string_table_offset = read_u32_be(data, &mut off)? as usize;
    let data_offset = read_u32_be(data, &mut off)? as usize;
    let name_string_offset = read_u32_be(data, &mut off)? as usize;
    let num_columns = read_u16_be(data, &mut off)? as usize;
    let row_length = read_u16_be(data, &mut off)?;
    let num_rows = read_u32_be(data, &mut off)? as usize;

    // Calcola offset assoluti
    let abs_string_table = utf_data_start + string_table_offset;
    let abs_data_section = utf_data_start + data_offset;

    // Nome della tabella
    let table_name = if abs_string_table + name_string_offset < data.len() {
        read_cstring(data, abs_string_table + name_string_offset).unwrap_or_default()
    } else {
        String::new()
    };

    // Parsa schema colonne
    let mut schema_off = utf_data_start + schema_offset;
    let mut columns = Vec::with_capacity(num_columns);

    for _ in 0..num_columns {
        let flags = read_u8_at(data, &mut schema_off)?;
        let col_name_offset = read_u32_be(data, &mut schema_off)? as usize;

        let data_type = UtfDataType::from_flags(flags)?;
        let storage_type = UtfStorageType::from_flags(flags)?;

        let col_name = if abs_string_table + col_name_offset < data.len() {
            read_cstring(data, abs_string_table + col_name_offset).unwrap_or_default()
        } else {
            format!("col_{}", columns.len())
        };

        // Leggi valore costante se storage=Constant
        let constant_value = if storage_type == UtfStorageType::Constant {
            Some(read_utf_value(data, &mut schema_off, data_type, abs_string_table, abs_data_section)?)
        } else {
            None
        };

        columns.push(UtfColumn {
            name: col_name,
            data_type,
            storage_type,
            constant_value,
        });
    }

    // Parsa righe
    let mut rows = Vec::with_capacity(num_rows);
    let abs_rows_start = utf_data_start + rows_offset;

    for row_idx in 0..num_rows {
        let mut row_off = abs_rows_start + row_idx * row_length as usize;
        let mut row = Vec::with_capacity(num_columns);

        for col in &columns {
            let value = match col.storage_type {
                UtfStorageType::Constant => {
                    col.constant_value.clone().unwrap_or(UtfValue::Null)
                }
                UtfStorageType::Zero => {
                    default_value_for_type(col.data_type)
                }
                UtfStorageType::PerRow => {
                    read_utf_value(data, &mut row_off, col.data_type, abs_string_table, abs_data_section)?
                }
            };
            row.push(value);
        }

        rows.push(row);
    }

    Ok(UtfTable {
        name: table_name,
        columns,
        rows,
    })
}

/// Legge un valore UTF dal buffer secondo il tipo
fn read_utf_value(
    data: &[u8],
    offset: &mut usize,
    data_type: UtfDataType,
    abs_string_table: usize,
    abs_data_section: usize,
) -> Result<UtfValue, String> {
    match data_type {
        UtfDataType::U8 => Ok(UtfValue::U8(read_u8_at(data, offset)?)),
        UtfDataType::S8 => Ok(UtfValue::S8(read_u8_at(data, offset)? as i8)),
        UtfDataType::U16 => Ok(UtfValue::U16(read_u16_be(data, offset)?)),
        UtfDataType::S16 => Ok(UtfValue::S16(read_u16_be(data, offset)? as i16)),
        UtfDataType::U32 => Ok(UtfValue::U32(read_u32_be(data, offset)?)),
        UtfDataType::S32 => Ok(UtfValue::S32(read_i32_be(data, offset)?)),
        UtfDataType::U64 => Ok(UtfValue::U64(read_u64_be(data, offset)?)),
        UtfDataType::S64 => Ok(UtfValue::S64(read_i64_be(data, offset)?)),
        UtfDataType::Float => Ok(UtfValue::Float(read_f32_be(data, offset)?)),
        UtfDataType::Double => Ok(UtfValue::Double(read_f64_be(data, offset)?)),
        UtfDataType::StringRef => {
            let str_offset = read_u32_be(data, offset)? as usize;
            let abs = abs_string_table + str_offset;
            let s = if abs < data.len() {
                read_cstring(data, abs).unwrap_or_default()
            } else {
                String::new()
            };
            Ok(UtfValue::StringRef(s))
        }
        UtfDataType::Data => {
            let data_off = read_u32_be(data, offset)? as usize;
            let data_size = read_u32_be(data, offset)? as usize;
            let abs = abs_data_section + data_off;
            if abs + data_size <= data.len() {
                Ok(UtfValue::Data(data[abs..abs + data_size].to_vec()))
            } else {
                Ok(UtfValue::Data(Vec::new()))
            }
        }
    }
}

/// Valore default per tipo (storage Zero)
fn default_value_for_type(data_type: UtfDataType) -> UtfValue {
    match data_type {
        UtfDataType::U8 => UtfValue::U8(0),
        UtfDataType::S8 => UtfValue::S8(0),
        UtfDataType::U16 => UtfValue::U16(0),
        UtfDataType::S16 => UtfValue::S16(0),
        UtfDataType::U32 => UtfValue::U32(0),
        UtfDataType::S32 => UtfValue::S32(0),
        UtfDataType::U64 => UtfValue::U64(0),
        UtfDataType::S64 => UtfValue::S64(0),
        UtfDataType::Float => UtfValue::Float(0.0),
        UtfDataType::Double => UtfValue::Double(0.0),
        UtfDataType::StringRef => UtfValue::StringRef(String::new()),
        UtfDataType::Data => UtfValue::Data(Vec::new()),
    }
}

// ============================================================================
// CRILAYLA DECOMPRESSION
// ============================================================================

/// Decompressore CRILAYLA — compressione LZ bit-level con lettura all'indietro
fn decompress_crilayla(data: &[u8], start_offset: usize) -> Result<Vec<u8>, String> {
    let mut off = start_offset;

    // Magic: CRILAYLA
    if off + 8 > data.len() || &data[off..off + 8] != b"CRILAYLA" {
        return Err("Magic CRILAYLA non trovato".to_string());
    }
    off += 8;

    let uncompressed_size = read_u32_le(data, &mut off)? as usize;
    let compressed_size = read_u32_le(data, &mut off)? as usize;

    let compressed_start = off;
    let compressed_end = compressed_start + compressed_size;

    if compressed_end > data.len() {
        return Err(format!("Dati CRILAYLA compressi troncati: atteso {} byte", compressed_size));
    }

    // I primi 0x100 byte del file originale sono memorizzati DOPO i dati compressi (prefisso non compresso)
    let uncompressed_prefix_start = compressed_end;
    let prefix_size = 0x100.min(data.len().saturating_sub(uncompressed_prefix_start));
    let uncompressed_prefix = if prefix_size > 0 && uncompressed_prefix_start + prefix_size <= data.len() {
        &data[uncompressed_prefix_start..uncompressed_prefix_start + prefix_size]
    } else {
        &[] as &[u8]
    };

    // Buffer di output: prefisso + decompressione
    let total_size = uncompressed_prefix.len() + uncompressed_size;
    let mut output = vec![0u8; total_size];

    // Copia il prefisso non compresso all'inizio
    output[..uncompressed_prefix.len()].copy_from_slice(uncompressed_prefix);

    // Decompressione bit-level all'indietro
    let compressed_data = &data[compressed_start..compressed_end];
    let mut bit_reader = CrilaylaBitReader::new(compressed_data);
    let mut out_pos = total_size; // Scriviamo dalla fine verso l'inizio

    while out_pos > uncompressed_prefix.len() {
        // Leggi 1 bit
        let flag = bit_reader.read_bits(1)?;

        if flag == 0 {
            // Byte letterale
            if out_pos == 0 {
                break;
            }
            out_pos -= 1;
            output[out_pos] = bit_reader.read_bits(8)? as u8;
        } else {
            // Backreference: leggi offset e lunghezza
            let offset_bits = bit_reader.read_bits(13)? as usize + 3;
            let length;

            // Lunghezza variabile: leggi 2 bit per categoria
            let length_category = bit_reader.read_bits(2)?;

            match length_category {
                0 => length = 3,
                1 => length = 4,
                2 => length = 5 + bit_reader.read_bits(1)? as usize,
                3 => {
                    // Lunghezza estesa
                    let mut extra_bits = 3;
                    let mut extra = bit_reader.read_bits(extra_bits)? as usize;
                    let mut base = 7;
                    loop {
                        if extra != (1 << extra_bits) - 1 {
                            length = base + extra;
                            break;
                        }
                        extra_bits += 1;
                        if extra_bits > 20 {
                            return Err("Loop infinito nella decompressione CRILAYLA".to_string());
                        }
                        base += (1 << (extra_bits - 1)) - 1;
                        extra = bit_reader.read_bits(extra_bits)? as usize;
                    }
                }
                _ => unreachable!(),
            }

            // Copia backreference
            for _ in 0..length {
                if out_pos == 0 || out_pos + offset_bits - 1 >= total_size {
                    break;
                }
                out_pos -= 1;
                output[out_pos] = output[out_pos + offset_bits];
            }
        }
    }

    Ok(output)
}

/// Lettore di bit per CRILAYLA — legge dall'ultimo byte verso il primo
struct CrilaylaBitReader<'a> {
    data: &'a [u8],
    byte_pos: isize,
    bit_pos: u8,
}

impl<'a> CrilaylaBitReader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self {
            data,
            byte_pos: data.len() as isize - 1,
            bit_pos: 0,
        }
    }

    fn read_bits(&mut self, count: usize) -> Result<u32, String> {
        let mut result = 0u32;
        for i in 0..count {
            if self.byte_pos < 0 {
                return Err("CRILAYLA: fine dei dati compressi raggiunta prematuramente".to_string());
            }
            let byte = self.data[self.byte_pos as usize];
            let bit = (byte >> self.bit_pos) & 1;
            result |= (bit as u32) << i;

            self.bit_pos += 1;
            if self.bit_pos >= 8 {
                self.bit_pos = 0;
                self.byte_pos -= 1;
            }
        }
        Ok(result)
    }
}

// ============================================================================
// CPK PARSING
// ============================================================================

/// Struttura CPK parsata
struct CpkArchive {
    toc_entries: Vec<CpkTocEntry>,
    content_offset: u64,
    toc_offset: u64,
}

/// Entry TOC nel CPK
struct CpkTocEntry {
    dir_name: String,
    file_name: String,
    file_size: u64,
    extract_size: u64,
    file_offset: u64,
    id: u32,
}

/// Parsa l'header e il TOC di un file CPK
fn parse_cpk(data: &[u8]) -> Result<CpkArchive, String> {
    // Check magic: "CPK " (con spazio)
    if data.len() < 16 || &data[0..4] != b"CPK " {
        return Err("Magic CPK non trovato".to_string());
    }

    // CPK header UTF table inizia a offset 0x10
    let cpk_header = parse_utf_table(data, 0x10)?;

    // Leggi offset e dimensioni dalla tabella CPK header
    let content_offset = cpk_header.get_u64(0, "ContentOffset").unwrap_or(0);
    let toc_offset = cpk_header.get_u64(0, "TocOffset").unwrap_or(0);
    let toc_size = cpk_header.get_u64(0, "TocSize").unwrap_or(0);
    let _itoc_offset = cpk_header.get_u64(0, "ItocOffset").unwrap_or(0);
    let _etoc_offset = cpk_header.get_u64(0, "EtocOffset").unwrap_or(0);

    if toc_offset == 0 || toc_size == 0 {
        return Err("TOC offset/size non trovati nel CPK header".to_string());
    }

    // Parsa il TOC
    let toc_abs = toc_offset as usize;
    if toc_abs + 4 > data.len() {
        return Err(format!("TOC offset {} fuori range (file size={})", toc_abs, data.len()));
    }

    // Il TOC ha il suo magic "TOC " seguito dalla UTF table
    if &data[toc_abs..toc_abs + 4] != b"TOC " {
        return Err(format!("Magic TOC non trovato a offset {}", toc_abs));
    }

    let toc_table = parse_utf_table(data, toc_abs + 0x10)?;

    let mut toc_entries = Vec::with_capacity(toc_table.rows.len());
    for row_idx in 0..toc_table.rows.len() {
        let dir_name = toc_table.get_string(row_idx, "DirName")
            .unwrap_or("").to_string();
        let file_name = toc_table.get_string(row_idx, "FileName")
            .unwrap_or("").to_string();
        let file_size = toc_table.get_u64(row_idx, "FileSize")
            .or_else(|| toc_table.get_u32(row_idx, "FileSize").map(|v| v as u64))
            .unwrap_or(0);
        let extract_size = toc_table.get_u64(row_idx, "ExtractSize")
            .or_else(|| toc_table.get_u32(row_idx, "ExtractSize").map(|v| v as u64))
            .unwrap_or(file_size);
        let file_offset = toc_table.get_u64(row_idx, "FileOffset")
            .or_else(|| toc_table.get_u32(row_idx, "FileOffset").map(|v| v as u64))
            .unwrap_or(0);
        let id = toc_table.get_u32(row_idx, "ID").unwrap_or(row_idx as u32);

        toc_entries.push(CpkTocEntry {
            dir_name,
            file_name,
            file_size,
            extract_size,
            file_offset,
            id,
        });
    }

    Ok(CpkArchive {
        toc_entries,
        content_offset,
        toc_offset,
    })
}

/// Calcola l'offset assoluto di un file nel CPK
fn calculate_absolute_offset(cpk: &CpkArchive, entry: &CpkTocEntry) -> u64 {
    // L'offset del file è relativo a ContentOffset o (TocOffset + 0x800) a seconda della versione
    let base = if cpk.content_offset > 0 && cpk.content_offset != cpk.toc_offset {
        cpk.content_offset
    } else {
        cpk.toc_offset + 0x800
    };
    base + entry.file_offset
}

/// Estrai i byte grezzi di un file dal CPK, gestendo CRILAYLA
fn extract_file_from_cpk(data: &[u8], cpk: &CpkArchive, entry: &CpkTocEntry) -> Result<Vec<u8>, String> {
    let abs_offset = calculate_absolute_offset(cpk, entry) as usize;
    let file_end = abs_offset + entry.file_size as usize;

    if file_end > data.len() {
        return Err(format!("File '{}' troncato nel CPK (offset={}, size={}, cpk_size={})",
            entry.file_name, abs_offset, entry.file_size, data.len()));
    }

    let file_data = &data[abs_offset..file_end];

    // Controlla se è compresso CRILAYLA
    if file_data.len() >= 8 && &file_data[0..8] == b"CRILAYLA" {
        decompress_crilayla(file_data, 0)
    } else {
        Ok(file_data.to_vec())
    }
}

/// Costruisce il path interno di una entry TOC
fn toc_entry_path(entry: &CpkTocEntry) -> String {
    if entry.dir_name.is_empty() {
        entry.file_name.clone()
    } else {
        format!("{}/{}", entry.dir_name, entry.file_name)
    }
}

// ============================================================================
// ENCODING DETECTION
// ============================================================================

/// Rileva la codifica di un buffer di testo
fn detect_encoding(data: &[u8]) -> String {
    encoding_utils::detect_encoding(data).encoding
}

/// Decodifica bytes in stringa usando la codifica rilevata
fn decode_text(data: &[u8], encoding: &str) -> String {
    encoding_utils::decode_string(data, encoding)
}

/// Rileva il tipo di formato testuale dal path/estensione
fn detect_format_from_path(path: &str) -> String {
    let lower = path.to_lowercase();
    if lower.ends_with(".msg") { return "msg".to_string(); }
    if lower.ends_with(".bmd") { return "bmd".to_string(); }
    if lower.ends_with(".json") { return "json".to_string(); }
    if lower.ends_with(".xml") { return "xml".to_string(); }
    if lower.ends_with(".ftd") { return "ftd".to_string(); }
    if lower.ends_with(".txt") || lower.ends_with(".csv") { return "generic".to_string(); }
    "generic".to_string()
}

// ============================================================================
// TEXT FORMAT PARSERS
// ============================================================================

/// Parsa un file MSG (Persona) — stringhe null-separated con codici di controllo
fn parse_msg_format(data: &[u8]) -> Result<Vec<CriStringEntry>, String> {
    let mut entries = Vec::new();
    let mut idx = 0u32;
    let mut pos = 0;

    while pos < data.len() {
        // Cerca stringhe: sequenze di byte stampabili tra null terminators
        let _start = pos;

        // Salta byte nulli e codici di controllo CRI (0xF1-0xFF sono codici speciali)
        while pos < data.len() && (data[pos] == 0 || data[pos] >= 0xF1) {
            pos += 1;
        }
        if pos >= data.len() { break; }

        let string_start = pos;

        // Accumula fino al prossimo null o codice di controllo
        while pos < data.len() && data[pos] != 0 {
            if data[pos] >= 0xF1 {
                // Codice di controllo: salta la sequenza
                pos += 1;
                // I codici di controllo hanno lunghezze variabili,
                // la maggior parte sono 2-4 byte
                while pos < data.len() && data[pos] >= 0x80 && data[pos] < 0xF1 {
                    pos += 1;
                }
                continue;
            }
            pos += 1;
        }

        if pos > string_start {
            let raw_bytes = &data[string_start..pos];
            let text = decode_text(raw_bytes, &detect_encoding(raw_bytes));
            let text = text.trim().to_string();

            if !text.is_empty() && text.len() >= 2 {
                entries.push(CriStringEntry {
                    index: idx,
                    key: format!("msg_{:04}", idx),
                    value: text,
                    context: format!("offset: 0x{:X}", string_start),
                    speaker: String::new(),
                });
                idx += 1;
            }
        }
        pos += 1;
    }

    Ok(entries)
}

/// Parsa un file BMD (Persona) — wrapper MSG con tabella nomi
fn parse_bmd_format(data: &[u8]) -> Result<Vec<CriStringEntry>, String> {
    // BMD ha un header con:
    // - magic (4 byte) — variabile per versione
    // - conteggio messaggi (4 byte)
    // - offset tabella nomi
    // - offset dati messaggio
    if data.len() < 16 {
        return Err("File BMD troppo piccolo".to_string());
    }

    // Controlla vari magic BMD conosciuti
    let magic = &data[0..4];
    let is_bmd = magic == b"MSG1" || magic == b"MSB1" || magic == b"\x07MSG";

    if !is_bmd {
        // Prova come MSG generico
        return parse_msg_format(data);
    }

    let mut off: usize = 4;
    // Leggi header BMD (formato varia, prova il layout più comune)
    // Tipo: 0=little endian, 1=big endian
    let msg_type = read_u8_at(data, &mut off)?;
    let _padding = &data[off..off.min(data.len()).max(off + 3)];

    // Conteggio entry
    let entry_count = if msg_type == 0 {
        // Little endian
        u32::from_le_bytes([data[8], data[9], data[10], data[11]])
    } else {
        u32::from_be_bytes([data[8], data[9], data[10], data[11]])
    } as usize;

    off = 12;

    // Tabella offset messaggi
    let mut msg_offsets = Vec::new();
    for _ in 0..entry_count.min(10000) {
        if off + 8 > data.len() { break; }
        let msg_type_val = if msg_type == 0 {
            u32::from_le_bytes([data[off], data[off + 1], data[off + 2], data[off + 3]])
        } else {
            u32::from_be_bytes([data[off], data[off + 1], data[off + 2], data[off + 3]])
        };
        off += 4;
        let msg_offset = if msg_type == 0 {
            u32::from_le_bytes([data[off], data[off + 1], data[off + 2], data[off + 3]])
        } else {
            u32::from_be_bytes([data[off], data[off + 1], data[off + 2], data[off + 3]])
        };
        off += 4;
        msg_offsets.push((msg_type_val, msg_offset as usize));
    }

    // Estrai stringhe da ogni messaggio
    let mut entries = Vec::new();
    for (msg_idx, (mtype, moff)) in msg_offsets.iter().enumerate() {
        if *moff >= data.len() { continue; }

        // Prova a leggere il nome speaker (prima stringa null-terminated)
        let mut speaker = String::new();
        let mut text_start = *moff;

        // In BMD1, il messaggio inizia con la stringa del nome
        if text_start < data.len() {
            let name_bytes: Vec<u8> = data[text_start..].iter()
                .take_while(|&&b| b != 0)
                .cloned().collect();
            if !name_bytes.is_empty() {
                speaker = decode_text(&name_bytes, &detect_encoding(&name_bytes));
                text_start += name_bytes.len() + 1;
            }
        }

        // Leggi il testo del messaggio
        if text_start < data.len() {
            let text_end = data[text_start..].iter()
                .position(|&b| b == 0)
                .map(|p| text_start + p)
                .unwrap_or(data.len());
            let text_bytes = &data[text_start..text_end];
            let text = decode_text(text_bytes, &detect_encoding(text_bytes)).trim().to_string();

            if !text.is_empty() {
                entries.push(CriStringEntry {
                    index: msg_idx as u32,
                    key: format!("bmd_{:04}", msg_idx),
                    value: text,
                    context: format!("msg_type: {}, offset: 0x{:X}", mtype, moff),
                    speaker,
                });
            }
        }
    }

    if entries.is_empty() {
        // Fallback a parser MSG generico
        return parse_msg_format(data);
    }

    Ok(entries)
}

/// Parsa un file FTD (Persona Fixed Table Data)
fn parse_ftd_format(data: &[u8]) -> Result<Vec<CriStringEntry>, String> {
    // FTD è un formato tabellare semplice con header fisso
    if data.len() < 16 {
        return Err("File FTD troppo piccolo".to_string());
    }

    // FTD header: entry_count(4, LE), entry_size(4, LE), ...
    let mut off = 0;
    let entry_count = u32::from_le_bytes([data[off], data[off + 1], data[off + 2], data[off + 3]]) as usize;
    off = 4;
    let entry_size = u32::from_le_bytes([data[off], data[off + 1], data[off + 2], data[off + 3]]) as usize;

    if entry_count > 100_000 || entry_size == 0 || entry_size > 4096 {
        // Probabilmente non è un FTD valido, prova come testo generico
        return parse_generic_text(data);
    }

    let data_start = 16;
    let mut entries = Vec::new();

    for i in 0..entry_count {
        let entry_off = data_start + i * entry_size;
        if entry_off + entry_size > data.len() { break; }

        let entry_data = &data[entry_off..entry_off + entry_size];
        // Cerca stringhe nel blocco entry
        let text = extract_strings_from_block(entry_data);
        if !text.is_empty() {
            entries.push(CriStringEntry {
                index: i as u32,
                key: format!("ftd_{:04}", i),
                value: text,
                context: format!("entry_size: {}, offset: 0x{:X}", entry_size, entry_off),
                speaker: String::new(),
            });
        }
    }

    Ok(entries)
}

/// Estrai stringhe leggibili da un blocco di dati binari
fn extract_strings_from_block(data: &[u8]) -> String {
    let mut strings = Vec::new();
    let mut current = String::new();

    for &b in data {
        if b == 0 {
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() && trimmed.len() >= 2 {
                strings.push(trimmed);
            }
            current.clear();
        } else if b >= 0x20 && b < 0x7F {
            current.push(b as char);
        } else if b >= 0x80 {
            // Potenziale multibyte, includi
            current.push(b as char);
        }
    }

    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() && trimmed.len() >= 2 {
        strings.push(trimmed);
    }

    strings.join("\n")
}

/// Parsa JSON estraendo i valori stringa
fn parse_json_text(data: &[u8]) -> Result<Vec<CriStringEntry>, String> {
    let text = decode_text(data, &detect_encoding(data));

    // Parser JSON minimale: estrai tutte le coppie chiave-valore stringa
    let parsed: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;

    let mut entries = Vec::new();
    let mut idx = 0u32;

    fn walk_json(value: &serde_json::Value, prefix: &str, entries: &mut Vec<CriStringEntry>, idx: &mut u32) {
        match value {
            serde_json::Value::Object(map) => {
                for (key, val) in map {
                    let path = if prefix.is_empty() {
                        key.clone()
                    } else {
                        format!("{}.{}", prefix, key)
                    };
                    walk_json(val, &path, entries, idx);
                }
            }
            serde_json::Value::Array(arr) => {
                for (i, val) in arr.iter().enumerate() {
                    let path = format!("{}[{}]", prefix, i);
                    walk_json(val, &path, entries, idx);
                }
            }
            serde_json::Value::String(s) => {
                if s.len() >= 2 {
                    entries.push(CriStringEntry {
                        index: *idx,
                        key: prefix.to_string(),
                        value: s.clone(),
                        context: "json".to_string(),
                        speaker: String::new(),
                    });
                    *idx += 1;
                }
            }
            _ => {}
        }
    }

    walk_json(&parsed, "", &mut entries, &mut idx);
    Ok(entries)
}

/// Parsa XML estraendo i nodi testo
fn parse_xml_text(data: &[u8]) -> Result<Vec<CriStringEntry>, String> {
    let text = decode_text(data, &detect_encoding(data));
    let mut entries = Vec::new();
    let mut idx = 0u32;

    // Parser XML minimale con regex-like
    // Estrai contenuto tra tag: >testo<
    let mut pos = 0;
    let chars: Vec<char> = text.chars().collect();

    while pos < chars.len() {
        // Cerca '>'
        if chars[pos] == '>' {
            pos += 1;
            let text_start = pos;
            // Accumula fino a '<'
            while pos < chars.len() && chars[pos] != '<' {
                pos += 1;
            }
            let content: String = chars[text_start..pos].iter().collect();
            let content = content.trim().to_string();
            if !content.is_empty() && content.len() >= 2 && !content.starts_with("<?") {
                entries.push(CriStringEntry {
                    index: idx,
                    key: format!("xml_{:04}", idx),
                    value: content,
                    context: "xml".to_string(),
                    speaker: String::new(),
                });
                idx += 1;
            }
        } else {
            pos += 1;
        }
    }

    Ok(entries)
}

/// Estrae stringhe con euristica generica (stringhe ASCII/UTF-8 > 3 caratteri)
fn parse_generic_text(data: &[u8]) -> Result<Vec<CriStringEntry>, String> {
    let encoding = detect_encoding(data);
    let text = decode_text(data, &encoding);
    let mut entries = Vec::new();
    let mut idx = 0u32;

    // Dividi per linee o null
    for line in text.split(|c: char| c == '\n' || c == '\r' || c == '\0') {
        let line = line.trim();
        if line.len() >= 3 && line.chars().any(|c| c.is_alphabetic()) {
            entries.push(CriStringEntry {
                index: idx,
                key: format!("str_{:04}", idx),
                value: line.to_string(),
                context: format!("encoding: {}", encoding),
                speaker: String::new(),
            });
            idx += 1;
        }
    }

    Ok(entries)
}

// ============================================================================
// GAME DETECTION PATTERNS
// ============================================================================

#[allow(dead_code)]
struct GameProfile {
    game_type: &'static str,
    game_name: &'static str,
    cpk_patterns: &'static [&'static str],
    text_patterns: Vec<String>,
    /// File/directory marker per detection
    markers: &'static [&'static str],
}

fn get_game_profiles() -> Vec<GameProfile> {
    vec![
        GameProfile {
            game_type: "persona5royal",
            game_name: "Persona 5 Royal",
            cpk_patterns: &["data.cpk", "data_e.cpk", "patch1.cpk", "patch2.cpk", "patch3.cpk"],
            text_patterns: vec!["*.bmd", "*.msg", "*.ftd", "*.bf"].iter().map(|s| s.to_string()).collect(),
            markers: &["CPK", "data.cpk", "ps3.cpk.66600", "USRDIR"],
        },
        GameProfile {
            game_type: "persona4golden",
            game_name: "Persona 4 Golden",
            cpk_patterns: &["data.cpk", "data_e.cpk", "data00000.cpk", "movie.cpk"],
            text_patterns: vec!["*.bmd", "*.msg", "*.ftd"].iter().map(|s| s.to_string()).collect(),
            markers: &["data.cpk", "P4G"],
        },
        GameProfile {
            game_type: "persona3",
            game_name: "Persona 3 Reload / Portable",
            cpk_patterns: &["data.cpk", "data_e.cpk"],
            text_patterns: vec!["*.bmd", "*.msg", "*.ftd"].iter().map(|s| s.to_string()).collect(),
            markers: &["data.cpk", "P3R"],
        },
        GameProfile {
            game_type: "yakuza",
            game_name: "Yakuza / Like a Dragon",
            cpk_patterns: &["*.par", "data/*.par", "media/*.cpk"],
            text_patterns: vec!["*.json", "*.xml", "*.msg", "*.gmd"].iter().map(|s| s.to_string()).collect(),
            markers: &[".par", "media", "auth", "2dpar"],
        },
        GameProfile {
            game_type: "tales",
            game_name: "Tales of (Arise/Berseria/Vesperia)",
            cpk_patterns: &["*.cpk", "data/*.cpk"],
            text_patterns: vec!["*.txt", "*.json", "*.scp", "*.tss"].iter().map(|s| s.to_string()).collect(),
            markers: &[".cpk", "BANDAINAMCO", "Tales"],
        },
        GameProfile {
            game_type: "danganronpav3",
            game_name: "Danganronpa V3",
            cpk_patterns: &["*.cpk", "data/*.cpk"],
            text_patterns: vec!["*.txt", "*.json", "*.stx"].iter().map(|s| s.to_string()).collect(),
            markers: &[".cpk", "partition_data_win"],
        },
        GameProfile {
            game_type: "dragonball",
            game_name: "Dragon Ball (Xenoverse/FighterZ/Kakarot)",
            cpk_patterns: &["*.cpk", "data/*.cpk"],
            text_patterns: vec!["*.msg", "*.xml", "*.json"].iter().map(|s| s.to_string()).collect(),
            markers: &[".cpk", "DBXV", "DBFZ"],
        },
    ]
}

/// Cerca file CPK/PAR in un percorso
fn find_cpk_files(game_path: &str) -> Result<Vec<String>, String> {
    let mut results = Vec::new();
    let path = Path::new(game_path);

    if !path.exists() {
        return Err("Percorso non esistente".to_string());
    }

    fn walk_dir(dir: &Path, results: &mut Vec<String>, depth: usize) {
        if depth > 4 { return; }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    walk_dir(&p, results, depth + 1);
                } else if let Some(ext) = p.extension() {
                    let ext_lower = ext.to_string_lossy().to_lowercase();
                    if ext_lower == "cpk" || ext_lower == "par" {
                        results.push(p.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    walk_dir(path, &mut results, 0);
    results.sort();
    Ok(results)
}

/// Conta rapidamente le entry TOC di un CPK senza parsing completo
fn quick_cpk_file_count(data: &[u8]) -> u32 {
    // Leggi il TOC offset dal CPK header, poi conta le righe
    if data.len() < 0x20 || &data[0..4] != b"CPK " {
        return 0;
    }
    match parse_cpk(data) {
        Ok(cpk) => cpk.toc_entries.len() as u32,
        Err(_) => 0,
    }
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Rileva il tipo di gioco CRI e i file CPK presenti
#[command]
pub fn detect_cri_game(game_path: String) -> Result<CriGameInfo, String> {
    let path = Path::new(&game_path);
    if !path.exists() {
        return Err("Percorso non esistente".to_string());
    }

    let cpk_paths = find_cpk_files(&game_path)?;
    if cpk_paths.is_empty() {
        return Err("Nessun file CPK/PAR trovato nella cartella".to_string());
    }

    // Prova a rilevare il gioco dai pattern
    let profiles = get_game_profiles();
    let mut detected_type = "generic_cri".to_string();
    let mut detected_name = "Gioco CRI generico".to_string();
    let mut text_patterns = vec!["*.txt".to_string(), "*.json".to_string(), "*.xml".to_string()];

    // Controlla marker nella struttura directory
    for profile in &profiles {
        let mut score = 0;
        for marker in profile.markers {
            // Controlla se un file/directory con questo marker esiste
            for cpk_path in &cpk_paths {
                if cpk_path.to_lowercase().contains(&marker.to_lowercase()) {
                    score += 1;
                }
            }
            // Controlla directory
            let marker_path = path.join(marker);
            if marker_path.exists() {
                score += 2;
            }
        }
        if score >= 2 {
            detected_type = profile.game_type.to_string();
            detected_name = profile.game_name.to_string();
            text_patterns = profile.text_patterns.clone();
            break;
        }
    }

    // Costruisci info file CPK
    let mut cpk_files = Vec::new();
    for cpk_path in &cpk_paths {
        let meta = fs::metadata(cpk_path).map_err(|e| e.to_string())?;
        let size = meta.len();

        // Prova a contare rapidamente i file senza caricare tutto in memoria
        let file_count = if size < 100 * 1024 * 1024 {
            // Solo per file < 100MB, carica e conta
            match fs::read(cpk_path) {
                Ok(data) => quick_cpk_file_count(&data),
                Err(_) => 0,
            }
        } else {
            0 // Per file grandi, non contare ora
        };

        cpk_files.push(CpkFileInfo {
            path: cpk_path.clone(),
            size,
            file_count,
        });
    }

    log::info!("Rilevato gioco CRI: {} ({}) con {} file CPK", detected_name, detected_type, cpk_files.len());

    Ok(CriGameInfo {
        game_type: detected_type,
        game_name: detected_name,
        game_path,
        cpk_files,
        text_file_patterns: text_patterns,
    })
}

/// Lista il contenuto di un file CPK (header + TOC)
#[command]
pub fn list_cpk_contents(cpk_path: String) -> Result<Vec<CpkEntry>, String> {
    let data = fs::read(&cpk_path).map_err(|e| format!("Errore lettura {}: {}", cpk_path, e))?;
    let cpk = parse_cpk(&data)?;

    let mut entries = Vec::with_capacity(cpk.toc_entries.len());
    for entry in &cpk.toc_entries {
        let path = toc_entry_path(entry);
        let compressed = entry.file_size != entry.extract_size;

        entries.push(CpkEntry {
            path,
            size: entry.file_size,
            extract_size: entry.extract_size,
            compressed,
            id: entry.id,
        });
    }

    log::info!("CPK {} contiene {} file", cpk_path, entries.len());
    Ok(entries)
}

/// Estrae file di testo dal CPK che corrispondono ai pattern
#[command]
pub fn extract_text_files_from_cpk(cpk_path: String, patterns: Vec<String>) -> Result<Vec<CriTextFile>, String> {
    let data = fs::read(&cpk_path).map_err(|e| format!("Errore lettura {}: {}", cpk_path, e))?;
    let cpk = parse_cpk(&data)?;

    let mut text_files = Vec::new();

    for entry in &cpk.toc_entries {
        let internal_path = toc_entry_path(entry);

        // Controlla se il path corrisponde a uno dei pattern
        if !matches_any_pattern(&internal_path, &patterns) {
            continue;
        }

        // Estrai il file
        match extract_file_from_cpk(&data, &cpk, entry) {
            Ok(file_data) => {
                let encoding = detect_encoding(&file_data);
                let format_hint = detect_format_from_path(&internal_path);

                text_files.push(CriTextFile {
                    internal_path,
                    data: file_data,
                    encoding,
                    format_hint,
                });
            }
            Err(e) => {
                log::warn!("Errore estrazione {}: {}", internal_path, e);
            }
        }
    }

    log::info!("Estratti {} file di testo da {}", text_files.len(), cpk_path);
    Ok(text_files)
}

/// Matching semplice di pattern glob (*.ext)
fn matches_any_pattern(path: &str, patterns: &[String]) -> bool {
    if patterns.is_empty() {
        return true;
    }

    let lower_path = path.to_lowercase();
    for pattern in patterns {
        let lower_pattern = pattern.to_lowercase();
        if lower_pattern.starts_with("*.") {
            let ext = &lower_pattern[1..]; // ".ext"
            if lower_path.ends_with(ext) {
                return true;
            }
        } else if lower_path.contains(&lower_pattern) {
            return true;
        }
    }
    false
}

/// Parsa un file di testo estratto in stringhe strutturate
#[command]
pub fn parse_cri_text_file(data: Vec<u8>, format: String) -> Result<Vec<CriStringEntry>, String> {
    match format.as_str() {
        "msg" => parse_msg_format(&data),
        "bmd" => parse_bmd_format(&data),
        "json" => parse_json_text(&data),
        "xml" => parse_xml_text(&data),
        "ftd" => parse_ftd_format(&data),
        "generic" | _ => parse_generic_text(&data),
    }
}

/// Costruisce un CPK patchato con file modificati
#[command]
pub fn build_patched_cpk(
    original_cpk: String,
    patches: Vec<CriFilePatch>,
    output_path: String,
) -> Result<String, String> {
    let data = fs::read(&original_cpk)
        .map_err(|e| format!("Errore lettura CPK originale: {}", e))?;
    let cpk = parse_cpk(&data)?;

    // Mappa patch per path
    let patch_map: HashMap<String, &[u8]> = patches.iter()
        .map(|p| (p.internal_path.clone(), p.data.as_slice()))
        .collect();

    // Strategia: copia il CPK originale, poi riscrivi il TOC con offset aggiornati
    // e accoda i file patchati alla fine

    // Step 1: Copia l'header originale (fino al contenuto)
    let _toc_offset = cpk.toc_offset as usize;
    let content_start = calculate_absolute_offset(&cpk, &cpk.toc_entries[0]) as usize;
    let _min_content_offset = cpk.toc_entries.iter()
        .map(|e| calculate_absolute_offset(&cpk, e) as usize)
        .min()
        .unwrap_or(content_start);

    // Step 2: Calcola i nuovi offset
    // Per semplicità: copia tutti i file non-patchati nella loro posizione originale,
    // poi accoda i file patchati alla fine del CPK

    let mut output = data.clone();

    // Raccogli i file patchati che devono essere accodati
    let mut appended_patches: Vec<(usize, String, &[u8])> = Vec::new(); // (toc_index, path, data)
    let mut patched_count = 0;

    for (toc_idx, entry) in cpk.toc_entries.iter().enumerate() {
        let entry_path = toc_entry_path(entry);
        if let Some(new_data) = patch_map.get(&entry_path) {
            appended_patches.push((toc_idx, entry_path, new_data));
            patched_count += 1;
        }
    }

    // Step 3: Accoda i file patchati alla fine
    let _append_base = output.len();
    let mut new_offsets: HashMap<usize, (u64, u64, u64)> = HashMap::new(); // toc_idx -> (offset_from_content, new_size, extract_size)

    for (toc_idx, _path, new_data) in &appended_patches {
        let current_pos = output.len();
        output.extend_from_slice(new_data);

        // L'offset nel TOC è relativo al content_offset
        let relative_offset = if cpk.content_offset > 0 && cpk.content_offset != cpk.toc_offset {
            current_pos as u64 - cpk.content_offset
        } else {
            current_pos as u64 - (cpk.toc_offset + 0x800)
        };

        new_offsets.insert(*toc_idx, (
            relative_offset,
            new_data.len() as u64,
            new_data.len() as u64,
        ));
    }

    // Step 4: Aggiorna il TOC nel buffer di output
    // Il TOC è a toc_offset + 0x10 (dopo magic "TOC ") come tabella UTF
    // Dobbiamo riscrivere i campi FileOffset, FileSize, ExtractSize per i file patchati
    // Questo richiede una ricostruzione parziale del TOC UTF — complessa

    // Per semplicità e robustezza: ricostruiamo il TOC come blocco UTF binario
    if !new_offsets.is_empty() {
        rebuild_toc_in_place(&mut output, &cpk, &new_offsets, &data)?;
    }

    // Allinea la fine del file a 2048 byte
    while output.len() % 2048 != 0 {
        output.push(0);
    }

    // Scrivi il file output
    let out_path = Path::new(&output_path);
    if let Some(parent) = out_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Errore creazione directory: {}", e))?;
    }
    fs::write(&output_path, &output)
        .map_err(|e| format!("Errore scrittura CPK patchato: {}", e))?;

    log::info!("CPK patchato creato: {} ({} file patchati)", output_path, patched_count);
    Ok(format!("CPK patchato salvato in {} ({} file modificati)", output_path, patched_count))
}

/// Ricostruisce i valori FileOffset/FileSize/ExtractSize nel TOC in-place
/// Questo è un approccio semplificato che modifica direttamente i byte nel buffer
fn rebuild_toc_in_place(
    output: &mut Vec<u8>,
    cpk: &CpkArchive,
    new_offsets: &HashMap<usize, (u64, u64, u64)>,
    original_data: &[u8],
) -> Result<(), String> {
    // Riparsa il TOC per trovare gli offset esatti dei campi per-row
    let toc_abs = cpk.toc_offset as usize;
    if toc_abs + 0x14 > original_data.len() || &original_data[toc_abs..toc_abs + 4] != b"TOC " {
        return Err("Impossibile localizzare TOC per patch in-place".to_string());
    }

    // Il TOC UTF inizia a toc_abs + 0x10
    let utf_start = toc_abs + 0x10;
    if utf_start + 4 > original_data.len() || &original_data[utf_start..utf_start + 4] != b"@UTF" {
        return Err("Tabella @UTF del TOC non trovata".to_string());
    }

    let mut off = utf_start + 4;
    let _table_size = read_u32_be(original_data, &mut off)?;
    let utf_data_start = off;

    let schema_offset_val = read_u32_be(original_data, &mut off)?;
    let rows_offset = read_u32_be(original_data, &mut off)? as usize;
    let string_table_offset_val = read_u32_be(original_data, &mut off)?;
    let _data_offset = read_u32_be(original_data, &mut off)?;
    let _name_string_offset = read_u32_be(original_data, &mut off)?;
    let num_columns = read_u16_be(original_data, &mut off)? as usize;
    let row_length = read_u16_be(original_data, &mut off)? as usize;
    let num_rows = read_u32_be(original_data, &mut off)? as usize;

    // Parsa schema per trovare posizioni dei campi
    let abs_string_table = utf_data_start + string_table_offset_val as usize;

    let mut schema_off = utf_data_start + schema_offset_val as usize;
    struct ColInfo {
        name: String,
        data_type: UtfDataType,
        storage_type: UtfStorageType,
        row_field_size: usize,
    }
    let mut col_infos = Vec::new();

    for _ in 0..num_columns {
        let flags = read_u8_at(original_data, &mut schema_off)?;
        let col_name_offset = read_u32_be(original_data, &mut schema_off)? as usize;
        let data_type = UtfDataType::from_flags(flags)?;
        let storage_type = UtfStorageType::from_flags(flags)?;

        let col_name = if abs_string_table + col_name_offset < original_data.len() {
            read_cstring(original_data, abs_string_table + col_name_offset).unwrap_or_default()
        } else {
            String::new()
        };

        // Per Constant, salta il valore costante nello schema
        if storage_type == UtfStorageType::Constant {
            schema_off += data_type.byte_size();
        }

        let row_field_size = if storage_type == UtfStorageType::PerRow {
            data_type.byte_size()
        } else {
            0
        };

        col_infos.push(ColInfo { name: col_name, data_type, storage_type, row_field_size });
    }

    // Per ogni riga, calcola l'offset di FileOffset, FileSize, ExtractSize nel buffer
    let abs_rows_start = utf_data_start + rows_offset;

    for (toc_idx, (new_file_offset, new_file_size, new_extract_size)) in new_offsets {
        if *toc_idx >= num_rows { continue; }

        let mut field_offset_in_row = 0usize;
        for col in &col_infos {
            if col.storage_type != UtfStorageType::PerRow { continue; }

            let abs_field = abs_rows_start + toc_idx * row_length + field_offset_in_row;

            match col.name.as_str() {
                "FileOffset" => {
                    // Scrivi nuovo offset
                    match col.data_type {
                        UtfDataType::U64 | UtfDataType::S64 => {
                            if abs_field + 8 <= output.len() {
                                output[abs_field..abs_field + 8].copy_from_slice(&new_file_offset.to_be_bytes());
                            }
                        }
                        UtfDataType::U32 | UtfDataType::S32 => {
                            if abs_field + 4 <= output.len() {
                                output[abs_field..abs_field + 4].copy_from_slice(&(*new_file_offset as u32).to_be_bytes());
                            }
                        }
                        _ => {}
                    }
                }
                "FileSize" => {
                    match col.data_type {
                        UtfDataType::U64 | UtfDataType::S64 => {
                            if abs_field + 8 <= output.len() {
                                output[abs_field..abs_field + 8].copy_from_slice(&new_file_size.to_be_bytes());
                            }
                        }
                        UtfDataType::U32 | UtfDataType::S32 => {
                            if abs_field + 4 <= output.len() {
                                output[abs_field..abs_field + 4].copy_from_slice(&(*new_file_size as u32).to_be_bytes());
                            }
                        }
                        _ => {}
                    }
                }
                "ExtractSize" => {
                    match col.data_type {
                        UtfDataType::U64 | UtfDataType::S64 => {
                            if abs_field + 8 <= output.len() {
                                output[abs_field..abs_field + 8].copy_from_slice(&new_extract_size.to_be_bytes());
                            }
                        }
                        UtfDataType::U32 | UtfDataType::S32 => {
                            if abs_field + 4 <= output.len() {
                                output[abs_field..abs_field + 4].copy_from_slice(&(*new_extract_size as u32).to_be_bytes());
                            }
                        }
                        _ => {}
                    }
                }
                _ => {}
            }

            field_offset_in_row += col.row_field_size;
        }
    }

    Ok(())
}

// ═══════════════════════════════════════════════════════════════════
// TESTS — Autoresearch harness for CRI parser accuracy
// ═══════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ─────────────────────────────────────────────────────────────
    // BINARY READ HELPERS
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_read_u8_at() {
        let data = [0xAB];
        let mut off = 0;
        assert_eq!(read_u8_at(&data, &mut off).unwrap(), 0xAB);
        assert_eq!(off, 1);
    }

    #[test]
    fn test_read_u8_at_eof() {
        let data = [];
        let mut off = 0;
        assert!(read_u8_at(&data, &mut off).is_err());
    }

    #[test]
    fn test_read_u16_be() {
        let data = [0x12, 0x34];
        let mut off = 0;
        assert_eq!(read_u16_be(&data, &mut off).unwrap(), 0x1234);
        assert_eq!(off, 2);
    }

    #[test]
    fn test_read_u32_be() {
        let data = [0x12, 0x34, 0x56, 0x78];
        let mut off = 0;
        assert_eq!(read_u32_be(&data, &mut off).unwrap(), 0x12345678);
    }

    #[test]
    fn test_read_u64_be() {
        let data = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];
        let mut off = 0;
        assert_eq!(read_u64_be(&data, &mut off).unwrap(), 0x0102030405060708);
    }

    #[test]
    fn test_read_i32_be() {
        // -1 in big endian = 0xFFFFFFFF
        let data = [0xFF, 0xFF, 0xFF, 0xFF];
        let mut off = 0;
        assert_eq!(read_i32_be(&data, &mut off).unwrap(), -1);
    }

    #[test]
    fn test_read_f32_be() {
        // 1.0f32 in big endian
        let data = 1.0f32.to_be_bytes();
        let mut off = 0;
        assert_eq!(read_f32_be(&data, &mut off).unwrap(), 1.0);
    }

    #[test]
    fn test_read_u32_le_cri() {
        let data = [0x78, 0x56, 0x34, 0x12];
        let mut off = 0;
        assert_eq!(read_u32_le(&data, &mut off).unwrap(), 0x12345678);
    }

    #[test]
    fn test_read_cstring() {
        let data = b"Hello\0World\0";
        let s = read_cstring(data, 0).unwrap();
        assert_eq!(s, "Hello");
        let s2 = read_cstring(data, 6).unwrap();
        assert_eq!(s2, "World");
    }

    #[test]
    fn test_read_cstring_eof() {
        let data = b"NoNull";
        let s = read_cstring(data, 0).unwrap();
        assert_eq!(s, "NoNull");
    }

    #[test]
    fn test_read_cstring_out_of_range() {
        let data = [0x41];
        assert!(read_cstring(&data, 5).is_err());
    }

    // ─────────────────────────────────────────────────────────────
    // UTF DATA TYPE & STORAGE TYPE
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_utf_data_type_from_flags() {
        assert_eq!(UtfDataType::from_flags(0x00).unwrap(), UtfDataType::U8);
        assert_eq!(UtfDataType::from_flags(0x01).unwrap(), UtfDataType::S8);
        assert_eq!(UtfDataType::from_flags(0x02).unwrap(), UtfDataType::U16);
        assert_eq!(UtfDataType::from_flags(0x04).unwrap(), UtfDataType::U32);
        assert_eq!(UtfDataType::from_flags(0x06).unwrap(), UtfDataType::U64);
        assert_eq!(UtfDataType::from_flags(0x08).unwrap(), UtfDataType::Float);
        assert_eq!(UtfDataType::from_flags(0x09).unwrap(), UtfDataType::Double);
        assert_eq!(UtfDataType::from_flags(0x0A).unwrap(), UtfDataType::StringRef);
        assert_eq!(UtfDataType::from_flags(0x0B).unwrap(), UtfDataType::Data);
    }

    #[test]
    fn test_utf_data_type_invalid() {
        assert!(UtfDataType::from_flags(0x0C).is_err());
        assert!(UtfDataType::from_flags(0x0F).is_err());
    }

    #[test]
    fn test_utf_data_type_ignores_upper_bits() {
        // Upper nibble should not affect data type
        assert_eq!(UtfDataType::from_flags(0x14).unwrap(), UtfDataType::U32);
        assert_eq!(UtfDataType::from_flags(0x3A).unwrap(), UtfDataType::StringRef);
    }

    #[test]
    fn test_utf_storage_type_from_flags() {
        assert_eq!(UtfStorageType::from_flags(0x04).unwrap(), UtfStorageType::PerRow);
        assert_eq!(UtfStorageType::from_flags(0x14).unwrap(), UtfStorageType::Constant);
        assert_eq!(UtfStorageType::from_flags(0x34).unwrap(), UtfStorageType::Zero);
    }

    #[test]
    fn test_utf_storage_type_invalid() {
        // Upper nibble 2 is not a valid storage type
        assert!(UtfStorageType::from_flags(0x24).is_err());
    }

    #[test]
    fn test_utf_data_type_byte_sizes() {
        assert_eq!(UtfDataType::U8.byte_size(), 1);
        assert_eq!(UtfDataType::S8.byte_size(), 1);
        assert_eq!(UtfDataType::U16.byte_size(), 2);
        assert_eq!(UtfDataType::U32.byte_size(), 4);
        assert_eq!(UtfDataType::Float.byte_size(), 4);
        assert_eq!(UtfDataType::StringRef.byte_size(), 4);
        assert_eq!(UtfDataType::U64.byte_size(), 8);
        assert_eq!(UtfDataType::Double.byte_size(), 8);
        assert_eq!(UtfDataType::Data.byte_size(), 8);
    }

    // ─────────────────────────────────────────────────────────────
    // UTF VALUE CONVERSIONS
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_utf_value_as_u32() {
        assert_eq!(UtfValue::U8(42).as_u32(), Some(42));
        assert_eq!(UtfValue::U16(1000).as_u32(), Some(1000));
        assert_eq!(UtfValue::U32(0xDEADBEEF).as_u32(), Some(0xDEADBEEF));
        assert_eq!(UtfValue::S32(-1).as_u32(), Some(u32::MAX));
        assert_eq!(UtfValue::StringRef("x".into()).as_u32(), None);
    }

    #[test]
    fn test_utf_value_as_u64() {
        assert_eq!(UtfValue::U32(100).as_u64(), Some(100));
        assert_eq!(UtfValue::U64(0xDEADBEEF_CAFEBABE).as_u64(), Some(0xDEADBEEF_CAFEBABE));
        assert_eq!(UtfValue::Float(1.0).as_u64(), None);
    }

    #[test]
    fn test_utf_value_as_string() {
        assert_eq!(UtfValue::StringRef("hello".into()).as_string(), Some("hello"));
        assert_eq!(UtfValue::U32(42).as_string(), None);
    }

    // ─────────────────────────────────────────────────────────────
    // DEFAULT VALUES FOR TYPE
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_default_values() {
        assert!(matches!(default_value_for_type(UtfDataType::U8), UtfValue::U8(0)));
        assert!(matches!(default_value_for_type(UtfDataType::U32), UtfValue::U32(0)));
        assert!(matches!(default_value_for_type(UtfDataType::Float), UtfValue::Float(v) if v == 0.0));
        assert!(matches!(default_value_for_type(UtfDataType::StringRef), UtfValue::StringRef(ref s) if s.is_empty()));
        assert!(matches!(default_value_for_type(UtfDataType::Data), UtfValue::Data(ref v) if v.is_empty()));
    }

    // ─────────────────────────────────────────────────────────────
    // @UTF TABLE BUILDER + PARSER
    // ─────────────────────────────────────────────────────────────

    /// Build a minimal @UTF table with PerRow columns
    fn build_utf_table_fixture(
        table_name: &str,
        columns: &[(&str, UtfDataType)],
        rows: &[Vec<Vec<u8>>],  // each row is Vec<raw_bytes_for_column>
    ) -> Vec<u8> {
        let mut buf = Vec::new();

        // Build string table first
        let mut string_table = Vec::new();
        let mut string_offsets: HashMap<String, u32> = HashMap::new();

        let mut add_string = |s: &str, table: &mut Vec<u8>, offsets: &mut HashMap<String, u32>| -> u32 {
            if let Some(&off) = offsets.get(s) {
                return off;
            }
            let off = table.len() as u32;
            table.extend_from_slice(s.as_bytes());
            table.push(0);
            offsets.insert(s.to_string(), off);
            off
        };

        let name_off = add_string(table_name, &mut string_table, &mut string_offsets);
        let col_name_offsets: Vec<u32> = columns.iter()
            .map(|(name, _)| add_string(name, &mut string_table, &mut string_offsets))
            .collect();

        // Schema: for each column: flags(1) + name_offset(4)
        let num_columns = columns.len();
        let schema_size = num_columns * 5; // 1+4 per column for PerRow

        // Row length = sum of column byte sizes
        let row_length: usize = columns.iter().map(|(_, dt)| dt.byte_size()).sum();

        // Layout of the table body (after @UTF + table_size):
        // UTF header: schema_off(4) + rows_off(4) + string_table_off(4) + data_off(4) +
        //             name_string_off(4) + num_columns(2) + row_length(2) + num_rows(4) = 28
        // schema_offset (relative to utf_data_start) = 28
        // rows_offset = 28 + schema_size
        // string_table_offset = 28 + schema_size + rows.len() * row_length
        // data_offset = string_table_offset + string_table.len() (no data section used)
        let header_size = 28usize; // 5*u32 + u16 + u16 + u32
        let schema_offset = header_size;
        let rows_offset = schema_offset + schema_size;
        let string_table_offset = rows_offset + rows.len() * row_length;
        let data_offset = string_table_offset + string_table.len();
        let table_size = data_offset;

        // Write magic
        buf.extend_from_slice(b"@UTF");
        // Write table_size
        buf.extend_from_slice(&(table_size as u32).to_be_bytes());

        let _utf_data_start_pos = buf.len(); // this is where relative offsets are measured from

        // Header fields (all relative to utf_data_start)
        buf.extend_from_slice(&(schema_offset as u32).to_be_bytes());
        buf.extend_from_slice(&(rows_offset as u32).to_be_bytes());
        buf.extend_from_slice(&(string_table_offset as u32).to_be_bytes());
        buf.extend_from_slice(&(data_offset as u32).to_be_bytes());
        buf.extend_from_slice(&(name_off as u32).to_be_bytes()); // name_string_offset
        buf.extend_from_slice(&(num_columns as u16).to_be_bytes());
        buf.extend_from_slice(&(row_length as u16).to_be_bytes());
        buf.extend_from_slice(&(rows.len() as u32).to_be_bytes());

        // Schema entries
        for (i, (_, data_type)) in columns.iter().enumerate() {
            let flags = 0x00 | (*data_type as u8); // PerRow (0x00 upper nibble) + data type
            buf.push(flags);
            buf.extend_from_slice(&col_name_offsets[i].to_be_bytes());
        }

        // Row data
        for row in rows {
            for col_data in row {
                buf.extend_from_slice(col_data);
            }
        }

        // String table
        buf.extend_from_slice(&string_table);

        buf
    }

    #[test]
    fn test_utf_table_single_u32_column() {
        let fixture = build_utf_table_fixture(
            "TestTable",
            &[("Value", UtfDataType::U32)],
            &[
                vec![42u32.to_be_bytes().to_vec()],
                vec![100u32.to_be_bytes().to_vec()],
            ],
        );

        let table = parse_utf_table(&fixture, 0).unwrap();
        assert_eq!(table.name, "TestTable");
        assert_eq!(table.columns.len(), 1);
        assert_eq!(table.columns[0].name, "Value");
        assert_eq!(table.rows.len(), 2);
        assert_eq!(table.get_u32(0, "Value"), Some(42));
        assert_eq!(table.get_u32(1, "Value"), Some(100));
    }

    #[test]
    fn test_utf_table_multiple_columns() {
        let fixture = build_utf_table_fixture(
            "MultiCol",
            &[
                ("ID", UtfDataType::U32),
                ("Size", UtfDataType::U64),
            ],
            &[
                vec![
                    1u32.to_be_bytes().to_vec(),
                    1024u64.to_be_bytes().to_vec(),
                ],
            ],
        );

        let table = parse_utf_table(&fixture, 0).unwrap();
        assert_eq!(table.columns.len(), 2);
        assert_eq!(table.get_u32(0, "ID"), Some(1));
        assert_eq!(table.get_u64(0, "Size"), Some(1024));
    }

    #[test]
    fn test_utf_table_string_column() {
        // For StringRef, the row data contains a u32 offset into the string table
        // We need to know where our string will be in the string table
        // The string table already has "TestTable\0" and "Name\0"
        // "TestTable\0" at offset 0 (10 bytes)
        // "Name\0" at offset 10 (5 bytes)
        // Our string "Hello\0" would be at offset 15
        // But the builder puts strings in insertion order...
        // Let's add a custom string at a known offset

        // Actually, we need to put the target string IN the string table
        // and reference it. The fixture builder doesn't handle this.
        // Let me build this one manually.

        let mut buf = Vec::new();
        // String table: "T\0" (table name) + "N\0" (col name) + "Hello\0" (value)
        let string_table = b"T\0N\0Hello\0";

        let schema_offset = 28u32; // header: 5*u32 + u16 + u16 + u32 = 28
        let rows_offset = schema_offset + 5; // 1 col * 5 bytes
        let string_table_offset = rows_offset + 4; // 1 row * 4 bytes (StringRef)
        let data_offset = string_table_offset + string_table.len() as u32;
        let table_size = data_offset;

        buf.extend_from_slice(b"@UTF");
        buf.extend_from_slice(&table_size.to_be_bytes());
        buf.extend_from_slice(&schema_offset.to_be_bytes());
        buf.extend_from_slice(&rows_offset.to_be_bytes());
        buf.extend_from_slice(&string_table_offset.to_be_bytes());
        buf.extend_from_slice(&data_offset.to_be_bytes());
        buf.extend_from_slice(&0u32.to_be_bytes()); // name at string offset 0 = "T"
        buf.extend_from_slice(&1u16.to_be_bytes()); // 1 column
        buf.extend_from_slice(&4u16.to_be_bytes()); // row_length = 4
        buf.extend_from_slice(&1u32.to_be_bytes()); // 1 row

        // Schema: flags=0x0A (PerRow + StringRef), name_offset=2 (points to "N")
        buf.push(0x0A);
        buf.extend_from_slice(&2u32.to_be_bytes());

        // Row data: string offset = 4 (points to "Hello")
        buf.extend_from_slice(&4u32.to_be_bytes());

        // String table
        buf.extend_from_slice(string_table);

        let table = parse_utf_table(&buf, 0).unwrap();
        assert_eq!(table.name, "T");
        assert_eq!(table.get_string(0, "N"), Some("Hello"));
    }

    #[test]
    fn test_utf_table_empty() {
        let fixture = build_utf_table_fixture(
            "Empty",
            &[("X", UtfDataType::U32)],
            &[], // no rows
        );
        let table = parse_utf_table(&fixture, 0).unwrap();
        assert_eq!(table.rows.len(), 0);
        assert_eq!(table.columns.len(), 1);
    }

    #[test]
    fn test_utf_table_bad_magic() {
        let data = b"NOPE1234567890123456789012345678";
        let result = parse_utf_table(data, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("@UTF"));
    }

    #[test]
    fn test_utf_table_too_small() {
        let data = [0u8; 3];
        assert!(parse_utf_table(&data, 0).is_err());
    }

    #[test]
    fn test_utf_table_at_offset() {
        // Place the table at a non-zero offset
        let mut data = vec![0u8; 16]; // padding
        let fixture = build_utf_table_fixture(
            "Offset",
            &[("Val", UtfDataType::U32)],
            &[vec![99u32.to_be_bytes().to_vec()]],
        );
        data.extend_from_slice(&fixture);

        let table = parse_utf_table(&data, 16).unwrap();
        assert_eq!(table.get_u32(0, "Val"), Some(99));
    }

    // ─────────────────────────────────────────────────────────────
    // CRILAYLA BIT READER
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_bit_reader_single_byte() {
        let data = [0b10110100]; // byte value in binary
        let mut reader = CrilaylaBitReader::new(&data);

        // Reads from bit 0 of last byte (which is the only byte)
        // bit 0 = 0
        assert_eq!(reader.read_bits(1).unwrap(), 0);
        // bit 1 = 0
        assert_eq!(reader.read_bits(1).unwrap(), 0);
        // bit 2 = 1
        assert_eq!(reader.read_bits(1).unwrap(), 1);
    }

    #[test]
    fn test_bit_reader_full_byte() {
        let data = [0xFF];
        let mut reader = CrilaylaBitReader::new(&data);
        // Reading 8 bits from 0xFF should give 0xFF
        assert_eq!(reader.read_bits(8).unwrap(), 0xFF);
    }

    #[test]
    fn test_bit_reader_cross_byte() {
        // Two bytes: reader starts at last byte
        let data = [0b00000001, 0b11111110];
        let mut reader = CrilaylaBitReader::new(&data);
        // byte[1] = 0b11111110
        // Read 8 bits: bits 0-7 of byte[1]
        // bit 0 = 0, bit 1 = 1, bit 2 = 1, ..., bit 7 = 1
        let val = reader.read_bits(8).unwrap();
        assert_eq!(val, 0b11111110);
        // Now at byte[0], read 1 bit
        // byte[0] = 0b00000001, bit 0 = 1
        assert_eq!(reader.read_bits(1).unwrap(), 1);
    }

    #[test]
    fn test_bit_reader_eof() {
        let data = [0x00];
        let mut reader = CrilaylaBitReader::new(&data);
        // Read all 8 bits
        let _ = reader.read_bits(8).unwrap();
        // Now past the data — should error
        assert!(reader.read_bits(1).is_err());
    }

    // ─────────────────────────────────────────────────────────────
    // CRILAYLA DECOMPRESSION
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_crilayla_single_literal_byte() {
        // Decompress a CRILAYLA blob containing a single literal byte: 0x41 ('A')
        // The output after decompression should be [0x41]
        //
        // Layout:
        //   "CRILAYLA" (8 bytes)
        //   uncompressed_size = 1 (u32 LE)
        //   compressed_size = 2 (u32 LE)
        //   compressed_data = [0x00, 0x82] (2 bytes)
        //   (no prefix)
        //
        // Bit stream (read from byte[1] backward):
        //   byte[1]=0x82=0b10000010: flag=bit0=0 (literal), value bits 0-6
        //   byte[0]=0x00: value bit 7=0
        //   value = 0b01000001 = 0x41

        let mut blob = Vec::new();
        blob.extend_from_slice(b"CRILAYLA");
        blob.extend_from_slice(&1u32.to_le_bytes());  // uncompressed_size
        blob.extend_from_slice(&2u32.to_le_bytes());  // compressed_size
        blob.extend_from_slice(&[0x00, 0x82]);        // compressed data

        let result = decompress_crilayla(&blob, 0).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], 0x41);
    }

    #[test]
    fn test_crilayla_with_prefix() {
        // CRILAYLA with 0x100 prefix: the prefix is stored after compressed data
        // and placed at the start of output

        let prefix = vec![0xAA; 4]; // small prefix
        let mut blob = Vec::new();
        blob.extend_from_slice(b"CRILAYLA");
        blob.extend_from_slice(&1u32.to_le_bytes());  // uncompressed_size = 1
        blob.extend_from_slice(&2u32.to_le_bytes());  // compressed_size = 2
        blob.extend_from_slice(&[0x00, 0x82]);        // compressed: literal 0x41
        blob.extend_from_slice(&prefix);               // uncompressed prefix

        let result = decompress_crilayla(&blob, 0).unwrap();
        // total_size = prefix.len() + uncompressed_size = 4 + 1 = 5
        assert_eq!(result.len(), 5);
        // First 4 bytes should be the prefix
        assert_eq!(&result[0..4], &[0xAA, 0xAA, 0xAA, 0xAA]);
        // Decompressed byte at position 4
        assert_eq!(result[4], 0x41);
    }

    #[test]
    fn test_crilayla_bad_magic() {
        let blob = b"NOTCRILAYLAXXXXXXXXXXXXXX";
        assert!(decompress_crilayla(blob, 0).is_err());
    }

    #[test]
    fn test_crilayla_truncated() {
        let mut blob = Vec::new();
        blob.extend_from_slice(b"CRILAYLA");
        blob.extend_from_slice(&100u32.to_le_bytes()); // uncompressed_size
        blob.extend_from_slice(&999u32.to_le_bytes()); // compressed_size > remaining
        assert!(decompress_crilayla(&blob, 0).is_err());
    }

    #[test]
    fn test_crilayla_at_offset() {
        // Place CRILAYLA data at a non-zero offset
        let mut blob = vec![0u8; 10]; // padding
        blob.extend_from_slice(b"CRILAYLA");
        blob.extend_from_slice(&1u32.to_le_bytes());
        blob.extend_from_slice(&2u32.to_le_bytes());
        blob.extend_from_slice(&[0x00, 0x82]);

        let result = decompress_crilayla(&blob, 10).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], 0x41);
    }

    // ─────────────────────────────────────────────────────────────
    // ENCODING DETECTION
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_detect_encoding_utf8() {
        let data = b"Hello world";
        assert_eq!(detect_encoding(data), "utf-8");
    }

    #[test]
    fn test_detect_encoding_utf8_bom() {
        let data = [0xEF, 0xBB, 0xBF, b'H', b'i'];
        assert_eq!(detect_encoding(&data), "utf-8-bom");
    }

    #[test]
    fn test_detect_encoding_utf16le_bom() {
        let data = [0xFF, 0xFE, b'H', 0x00];
        assert_eq!(detect_encoding(&data), "utf-16le");
    }

    #[test]
    fn test_detect_encoding_utf16be_bom() {
        let data = [0xFE, 0xFF, 0x00, b'H'];
        assert_eq!(detect_encoding(&data), "utf-16be");
    }

    #[test]
    fn test_detect_encoding_shift_jis() {
        // 0x82 0x60 is a valid Shift-JIS sequence (ぁ)
        let data = [0x82, 0x60, 0x82, 0x61];
        assert_eq!(detect_encoding(&data), "shift-jis");
    }

    // ─────────────────────────────────────────────────────────────
    // DECODE TEXT
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_decode_text_utf8() {
        assert_eq!(decode_text(b"Hello", "utf-8"), "Hello");
    }

    #[test]
    fn test_decode_text_utf8_bom() {
        let data = [0xEF, 0xBB, 0xBF, b'O', b'K'];
        assert_eq!(decode_text(&data, "utf-8-bom"), "OK");
    }

    #[test]
    fn test_decode_text_utf16le() {
        // "Hi" in UTF-16 LE with BOM
        let data = [0xFF, 0xFE, b'H', 0x00, b'i', 0x00];
        assert_eq!(decode_text(&data, "utf-16le"), "Hi");
    }

    #[test]
    fn test_decode_text_utf16be() {
        let data = [0xFE, 0xFF, 0x00, b'H', 0x00, b'i'];
        assert_eq!(decode_text(&data, "utf-16be"), "Hi");
    }

    #[test]
    fn test_decode_text_shift_jis_ascii() {
        // Pure ASCII through Shift-JIS decoder
        assert_eq!(decode_text(b"ABC", "shift-jis"), "ABC");
    }

    #[test]
    fn test_decode_text_shift_jis_halfwidth_katakana() {
        // 0xA1 should map to U+FF61 (。) via encoding_rs
        let data = [0xA1];
        let result = decode_text(&data, "shift-jis");
        assert_eq!(result, "\u{FF61}");
    }

    #[test]
    fn test_decode_text_shift_jis_null_terminated() {
        // encoding_rs decodes the full buffer (including null bytes)
        let data = [b'H', b'i', 0x00, b'X'];
        let result = decode_text(&data, "shift-jis");
        assert!(result.starts_with("Hi")); // null is decoded, but Hi prefix is preserved
    }

    // ─────────────────────────────────────────────────────────────
    // FORMAT DETECTION
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_detect_format_from_path() {
        assert_eq!(detect_format_from_path("data/script.msg"), "msg");
        assert_eq!(detect_format_from_path("data/dialog.bmd"), "bmd");
        assert_eq!(detect_format_from_path("config.json"), "json");
        assert_eq!(detect_format_from_path("strings.xml"), "xml");
        assert_eq!(detect_format_from_path("table.ftd"), "ftd");
        assert_eq!(detect_format_from_path("readme.txt"), "generic");
        assert_eq!(detect_format_from_path("data.csv"), "generic");
        assert_eq!(detect_format_from_path("unknown.xyz"), "generic");
    }

    #[test]
    fn test_detect_format_case_insensitive() {
        assert_eq!(detect_format_from_path("Script.MSG"), "msg");
        assert_eq!(detect_format_from_path("DATA.JSON"), "json");
    }

    // ─────────────────────────────────────────────────────────────
    // GLOB PATTERN MATCHING
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_matches_any_pattern_ext() {
        let patterns = vec!["*.msg".to_string(), "*.bmd".to_string()];
        assert!(matches_any_pattern("data/script.msg", &patterns));
        assert!(matches_any_pattern("folder/dialog.bmd", &patterns));
        assert!(!matches_any_pattern("config.json", &patterns));
    }

    #[test]
    fn test_matches_any_pattern_substring() {
        let patterns = vec!["dialog".to_string()];
        assert!(matches_any_pattern("data/dialog_01.txt", &patterns));
        assert!(!matches_any_pattern("data/script.txt", &patterns));
    }

    #[test]
    fn test_matches_any_pattern_empty() {
        assert!(matches_any_pattern("anything.txt", &[])); // empty → match all
    }

    #[test]
    fn test_matches_any_pattern_case_insensitive() {
        let patterns = vec!["*.MSG".to_string()];
        assert!(matches_any_pattern("data/Script.msg", &patterns));
    }

    // ─────────────────────────────────────────────────────────────
    // TEXT PARSERS — MSG FORMAT
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_parse_msg_basic() {
        // MSG format: null-separated strings, skip control codes (0xF1-0xFF)
        let data = b"Hello World\0Good morning\0";
        let result = parse_msg_format(data).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].value, "Hello World");
        assert_eq!(result[1].value, "Good morning");
    }

    #[test]
    fn test_parse_msg_skips_short() {
        // Strings shorter than 2 chars are filtered out
        let data = b"A\0OK here\0B\0";
        let result = parse_msg_format(data).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].value, "OK here");
    }

    #[test]
    fn test_parse_msg_control_codes() {
        // Control codes (0xF1-0xFF) should be skipped
        let mut data = Vec::new();
        data.extend_from_slice(b"Text");
        data.push(0xF1); // control code
        data.push(0x80); // continuation byte
        data.extend_from_slice(b"More");
        data.push(0);

        let result = parse_msg_format(&data).unwrap();
        assert_eq!(result.len(), 1);
        assert!(result[0].value.contains("Text"));
    }

    #[test]
    fn test_parse_msg_empty() {
        let data = [0u8; 4]; // only nulls
        let result = parse_msg_format(&data).unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_parse_msg_key_format() {
        let data = b"Test message\0";
        let result = parse_msg_format(data).unwrap();
        assert_eq!(result[0].key, "msg_0000");
        assert!(result[0].context.contains("0x"));
    }

    // ─────────────────────────────────────────────────────────────
    // TEXT PARSERS — BMD FORMAT
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_parse_bmd_msg1() {
        // Build a minimal MSG1 BMD file
        let mut data = Vec::new();
        data.extend_from_slice(b"MSG1");
        data.push(0); // msg_type = 0 (little endian)
        data.extend_from_slice(&[0; 3]); // padding
        data.extend_from_slice(&1u32.to_le_bytes()); // entry_count = 1

        // Message offset table: msg_type_val(4) + msg_offset(4)
        let msg_offset = data.len() as u32 + 8; // after this entry
        data.extend_from_slice(&0u32.to_le_bytes()); // msg_type_val
        data.extend_from_slice(&msg_offset.to_le_bytes());

        // Message data: speaker name + null + text + null
        data.extend_from_slice(b"Guard\0");
        data.extend_from_slice(b"Halt! Who goes there?\0");

        let result = parse_bmd_format(&data).unwrap();
        assert!(result.len() >= 1);
        // Should have extracted the speaker and/or text
        let has_text = result.iter().any(|e| e.value.contains("Halt"));
        assert!(has_text, "Should extract dialogue text");
    }

    #[test]
    fn test_parse_bmd_fallback_to_msg() {
        // Non-BMD data → should fall back to parse_msg_format
        let data = b"Random text here\0Another line\0";
        let result = parse_bmd_format(data).unwrap();
        assert!(result.len() >= 1);
    }

    #[test]
    fn test_parse_bmd_too_small() {
        let data = [0u8; 8];
        assert!(parse_bmd_format(&data).is_err());
    }

    // ─────────────────────────────────────────────────────────────
    // TEXT PARSERS — JSON FORMAT
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_parse_json_basic() {
        let json = br#"{"name": "Iron Sword", "description": "A basic weapon"}"#;
        let result = parse_json_text(json).unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().any(|e| e.value == "Iron Sword"));
        assert!(result.iter().any(|e| e.value == "A basic weapon"));
    }

    #[test]
    fn test_parse_json_nested() {
        let json = br#"{"items": [{"name": "Potion"}, {"name": "Elixir"}]}"#;
        let result = parse_json_text(json).unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().any(|e| e.value == "Potion"));
        assert!(result.iter().any(|e| e.value == "Elixir"));
    }

    #[test]
    fn test_parse_json_skips_short_strings() {
        let json = br#"{"x": "A", "long": "Hello World"}"#;
        let result = parse_json_text(json).unwrap();
        // "A" is < 2 chars, should be skipped
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].value, "Hello World");
    }

    #[test]
    fn test_parse_json_invalid() {
        let data = b"not json {{{";
        assert!(parse_json_text(data).is_err());
    }

    #[test]
    fn test_parse_json_key_paths() {
        let json = br#"{"dialogue": {"line1": "Hello there"}}"#;
        let result = parse_json_text(json).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].key, "dialogue.line1");
    }

    // ─────────────────────────────────────────────────────────────
    // TEXT PARSERS — XML FORMAT
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_parse_xml_basic() {
        let xml = b"<root><item>Iron Sword</item><desc>A sharp blade</desc></root>";
        let result = parse_xml_text(xml).unwrap();
        assert!(result.iter().any(|e| e.value == "Iron Sword"));
        assert!(result.iter().any(|e| e.value == "A sharp blade"));
    }

    #[test]
    fn test_parse_xml_skips_short() {
        let xml = b"<a>X</a><b>Hello World</b>";
        let result = parse_xml_text(xml).unwrap();
        // "X" is < 2 chars, should be skipped
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].value, "Hello World");
    }

    #[test]
    fn test_parse_xml_empty_tags() {
        let xml = b"<a></a><b>Content</b>";
        let result = parse_xml_text(xml).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].value, "Content");
    }

    // ─────────────────────────────────────────────────────────────
    // TEXT PARSERS — FTD FORMAT
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_parse_ftd_basic() {
        // FTD: header (16 bytes) + entries
        let entry_size = 32u32;
        let entry_count = 2u32;
        let mut data = Vec::new();
        data.extend_from_slice(&entry_count.to_le_bytes());
        data.extend_from_slice(&entry_size.to_le_bytes());
        data.extend_from_slice(&[0u8; 8]); // rest of header

        // Entry 1: "Hello World" + padding
        let mut entry1 = b"Hello World\0".to_vec();
        entry1.resize(entry_size as usize, 0);
        data.extend_from_slice(&entry1);

        // Entry 2: "Test Entry" + padding
        let mut entry2 = b"Test Entry\0".to_vec();
        entry2.resize(entry_size as usize, 0);
        data.extend_from_slice(&entry2);

        let result = parse_ftd_format(&data).unwrap();
        assert_eq!(result.len(), 2);
        assert!(result[0].value.contains("Hello World"));
        assert!(result[1].value.contains("Test Entry"));
    }

    #[test]
    fn test_parse_ftd_invalid_falls_back() {
        // entry_count > 100000 → falls back to generic parser
        let mut data = Vec::new();
        data.extend_from_slice(&200000u32.to_le_bytes()); // too many entries
        data.extend_from_slice(&32u32.to_le_bytes());
        data.extend_from_slice(&[0u8; 8]);
        // Add some text for the fallback parser
        data.extend_from_slice(b"Fallback text\n");

        let result = parse_ftd_format(&data).unwrap();
        // Should have fallen back to generic parser
        assert!(result.iter().any(|e| e.value.contains("Fallback")));
    }

    // ─────────────────────────────────────────────────────────────
    // TEXT PARSERS — GENERIC
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_parse_generic_text() {
        let data = b"First line\nSecond line\nThird line\n";
        let result = parse_generic_text(data).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].value, "First line");
        assert_eq!(result[1].value, "Second line");
    }

    #[test]
    fn test_parse_generic_skips_nonalpha() {
        let data = b"123456\nHello\n";
        let result = parse_generic_text(data).unwrap();
        // "123456" has no alphabetic chars, should be skipped
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].value, "Hello");
    }

    #[test]
    fn test_parse_generic_skips_short() {
        let data = b"Hi\nHello World\n";
        let result = parse_generic_text(data).unwrap();
        // "Hi" is < 3 chars, should be skipped
        assert_eq!(result.len(), 1);
    }

    // ─────────────────────────────────────────────────────────────
    // EXTRACT STRINGS FROM BLOCK
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_extract_strings_from_block() {
        let block = b"Hello\0World\0";
        let result = extract_strings_from_block(block);
        assert!(result.contains("Hello"));
        assert!(result.contains("World"));
    }

    #[test]
    fn test_extract_strings_from_block_single_char_skipped() {
        let block = b"A\0OK\0";
        let result = extract_strings_from_block(block);
        assert!(!result.contains("\nA\n")); // "A" < 2 chars, should be skipped
        assert!(result.contains("OK"));
    }

    // ─────────────────────────────────────────────────────────────
    // CPK PARSING
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_cpk_bad_magic() {
        let data = b"NOT_CPK_FILE_1234";
        assert!(parse_cpk(data).is_err());
    }

    #[test]
    fn test_cpk_too_small() {
        let data = b"CPK ";
        assert!(parse_cpk(data).is_err());
    }

    // ─────────────────────────────────────────────────────────────
    // TOC ENTRY PATH
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_toc_entry_path_with_dir() {
        let entry = CpkTocEntry {
            dir_name: "data/scripts".to_string(),
            file_name: "dialog.msg".to_string(),
            file_size: 100,
            extract_size: 100,
            file_offset: 0,
            id: 0,
        };
        assert_eq!(toc_entry_path(&entry), "data/scripts/dialog.msg");
    }

    #[test]
    fn test_toc_entry_path_no_dir() {
        let entry = CpkTocEntry {
            dir_name: String::new(),
            file_name: "readme.txt".to_string(),
            file_size: 50,
            extract_size: 50,
            file_offset: 0,
            id: 0,
        };
        assert_eq!(toc_entry_path(&entry), "readme.txt");
    }

    // ─────────────────────────────────────────────────────────────
    // PARSE_CRI_TEXT_FILE DISPATCH
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_parse_cri_text_file_json() {
        let json = br#"{"key": "value here"}"#.to_vec();
        let result = parse_cri_text_file(json, "json".to_string()).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].value, "value here");
    }

    #[test]
    fn test_parse_cri_text_file_generic() {
        let data = b"Some generic text\n".to_vec();
        let result = parse_cri_text_file(data, "generic".to_string()).unwrap();
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_parse_cri_text_file_unknown_format() {
        // Unknown format should fall back to generic
        let data = b"Fallback text here\n".to_vec();
        let result = parse_cri_text_file(data, "unknown_format".to_string()).unwrap();
        assert!(result.len() >= 1);
    }

    // ─────────────────────────────────────────────────────────────
    // SCORER — aggregate metric
    // ─────────────────────────────────────────────────────────────

    #[test]
    fn test_cri_accuracy_score() {
        // This test is a meta-test: counts how many of the above subtests
        // conceptually pass. Since all are individual #[test], if this
        // test runs, it means the suite compiled and this one runs.
        // The real metric is: cargo test --lib commands::cri_patcher::tests
        // should report 0 failed.
        println!("\n═══════════════════════════════════════════════");
        println!("AUTORESEARCH SCORER — CRI Patcher");
        println!("═══════════════════════════════════════════════");
        println!("If you see this, all CRI patcher tests compiled.");
        println!("Check 'test result:' line for pass/fail counts.");
        println!("═══════════════════════════════════════════════\n");
    }
}
