// Bethesda Engine Patcher
// Supporto per BSA/BA2, STRINGS/DLSTRINGS/ILSTRINGS, ESP/ESM plugin
// Giochi: Skyrim, Fallout 4, Starfield, Oblivion, Fallout 3/NV

use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::command;

use crate::commands::encoding_utils;

/// Decode bytes that may be UTF-8 or Windows-1252 (common in Bethesda mods).
/// Tries UTF-8 first; falls back to Windows-1252 via encoding_utils for proper
/// handling of accented characters (é, ö, ü, ñ, etc.) in European translations.
/// Bethesda games (Skyrim, Fallout, Oblivion) use Windows-1252 for non-UTF-8 strings.
fn decode_lossy(data: &[u8]) -> String {
    match std::str::from_utf8(data) {
        Ok(s) => s.to_string(),
        Err(_) => encoding_utils::decode_string(data, "windows-1252"),
    }
}

// ═══════════════════════════════════════════════════════════════════
// STRUCTS
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BethesdaGameInfo {
    pub game_type: String,
    pub game_name: String,
    pub data_path: String,
    pub plugins: Vec<PluginInfo>,
    pub string_tables: Vec<StringTableFile>,
    pub bsa_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub filename: String,
    pub is_master: bool,
    pub size: u64,
    pub is_localized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StringTableFile {
    pub path: String,
    pub language: String,
    pub table_type: String,
    pub plugin_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BsaEntry {
    pub path: String,
    pub size: u64,
    pub compressed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StringEntry {
    pub id: u32,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginStringEntry {
    pub form_id: u32,
    pub record_type: String,
    pub field_name: String,
    pub editor_id: String,
    pub value: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatchedStringEntry {
    pub id: u32,
    pub value: String,
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

fn read_u16_le(data: &[u8], offset: &mut usize) -> Result<u16, String> {
    if *offset + 2 > data.len() {
        return Err(format!("EOF reading u16 at offset {}", offset));
    }
    let v = u16::from_le_bytes([data[*offset], data[*offset + 1]]);
    *offset += 2;
    Ok(v)
}

fn read_u32_le(data: &[u8], offset: &mut usize) -> Result<u32, String> {
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
fn read_i32_le(data: &[u8], offset: &mut usize) -> Result<i32, String> {
    if *offset + 4 > data.len() {
        return Err(format!("EOF reading i32 at offset {}", offset));
    }
    let v = i32::from_le_bytes([
        data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3],
    ]);
    *offset += 4;
    Ok(v)
}

fn read_u64_le(data: &[u8], offset: &mut usize) -> Result<u64, String> {
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

fn read_bzstring(data: &[u8], offset: &mut usize) -> Result<String, String> {
    // Length-prefixed string: u8 length + chars (no null terminator counted in length)
    let len = read_u8(data, offset)? as usize;
    if *offset + len > data.len() {
        return Err(format!("EOF reading bzstring({}) at offset {}", len, offset));
    }
    let bytes = &data[*offset..*offset + len];
    *offset += len;
    // Remove trailing null if present
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    Ok(decode_lossy(&bytes[..end]))
}

fn read_zstring(data: &[u8], offset: &mut usize) -> Result<String, String> {
    // Null-terminated string
    let start = *offset;
    while *offset < data.len() && data[*offset] != 0 {
        *offset += 1;
    }
    let s = decode_lossy(&data[start..*offset]);
    if *offset < data.len() {
        *offset += 1; // skip null terminator
    }
    Ok(s)
}

#[allow(dead_code)]
fn read_wstring(data: &[u8], offset: &mut usize) -> Result<String, String> {
    // u16 length + chars
    let len = read_u16_le(data, offset)? as usize;
    if *offset + len > data.len() {
        return Err(format!("EOF reading wstring({}) at offset {}", len, offset));
    }
    let bytes = &data[*offset..*offset + len];
    *offset += len;
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    Ok(decode_lossy(&bytes[..end]))
}

fn read_bytes(data: &[u8], offset: &mut usize, count: usize) -> Result<Vec<u8>, String> {
    if *offset + count > data.len() {
        return Err(format!("EOF reading {} bytes at offset {}", count, offset));
    }
    let v = data[*offset..*offset + count].to_vec();
    *offset += count;
    Ok(v)
}

// ═══════════════════════════════════════════════════════════════════
// BSA INTERNAL STRUCTS
// ═══════════════════════════════════════════════════════════════════

const BSA_MAGIC: u32 = 0x00415342; // "BSA\0"
const BA2_MAGIC: u32 = 0x58445442; // "BTDX"

#[allow(dead_code)]
struct BsaHeader {
    version: u32,
    folder_record_offset: u32,
    archive_flags: u32,
    folder_count: u32,
    file_count: u32,
    total_folder_name_length: u32,
    total_file_name_length: u32,
    file_flags: u16,
}

#[allow(dead_code)]
struct BsaFolderRecord {
    name_hash: u64,
    count: u32,
    offset: u64, // u32 for v104, u64 for v105
}

#[allow(dead_code)]
struct BsaFileRecord {
    name_hash: u64,
    size: u32,
    offset: u32,
}

#[allow(dead_code)]
struct Ba2Header {
    version: u32,
    archive_type: [u8; 4], // "GNRL" or "DX10"
    file_count: u32,
    name_table_offset: u64,
}

#[allow(dead_code)]
struct Ba2FileEntry {
    name_hash: u32,
    ext: [u8; 4],
    dir_hash: u32,
    flags: u32,
    offset: u64,
    packed_size: u32,
    unpacked_size: u32,
}

// ═══════════════════════════════════════════════════════════════════
// BSA PARSER
// ═══════════════════════════════════════════════════════════════════

fn parse_bsa_header(data: &[u8]) -> Result<BsaHeader, String> {
    let mut off = 0usize;
    let magic = read_u32_le(data, &mut off)?;
    if magic != BSA_MAGIC {
        return Err(format!("Non valido BSA magic: 0x{:08X}", magic));
    }
    let version = read_u32_le(data, &mut off)?;
    let folder_record_offset = read_u32_le(data, &mut off)?;
    let archive_flags = read_u32_le(data, &mut off)?;
    let folder_count = read_u32_le(data, &mut off)?;
    let file_count = read_u32_le(data, &mut off)?;
    let total_folder_name_length = read_u32_le(data, &mut off)?;
    let total_file_name_length = read_u32_le(data, &mut off)?;
    let file_flags = read_u16_le(data, &mut off)?;
    let _padding = read_u16_le(data, &mut off)?;

    Ok(BsaHeader {
        version,
        folder_record_offset,
        archive_flags,
        folder_count,
        file_count,
        total_folder_name_length,
        total_file_name_length,
        file_flags,
    })
}

fn parse_bsa_contents(data: &[u8]) -> Result<Vec<BsaEntry>, String> {
    let header = parse_bsa_header(data)?;
    let is_v105 = header.version == 105;
    let has_directory_names = (header.archive_flags & 1) != 0;
    let has_file_names = (header.archive_flags & 2) != 0;
    let default_compressed = (header.archive_flags & 4) != 0;
    let _has_file_name_blobs = (header.archive_flags & 256) != 0;

    let mut entries = Vec::new();
    let mut off = header.folder_record_offset as usize;

    // Read folder records
    let mut folder_records = Vec::with_capacity(header.folder_count as usize);
    for _ in 0..header.folder_count {
        let name_hash = read_u64_le(data, &mut off)?;
        let count = read_u32_le(data, &mut off)?;
        let folder_offset = if is_v105 {
            let _padding = read_u32_le(data, &mut off)?;
            read_u64_le(data, &mut off)?
        } else {
            read_u32_le(data, &mut off)? as u64
        };
        folder_records.push(BsaFolderRecord {
            name_hash,
            count,
            offset: folder_offset,
        });
    }

    // Read folder names + file records
    let mut folder_names: Vec<String> = Vec::with_capacity(header.folder_count as usize);
    for folder in &folder_records {
        // Read folder name (bzstring)
        let folder_name = if has_directory_names {
            read_bzstring(data, &mut off)?
        } else {
            String::new()
        };
        folder_names.push(folder_name.clone());

        // Read file records for this folder
        for _ in 0..folder.count {
            let _file_name_hash = read_u64_le(data, &mut off)?;
            let raw_size = read_u32_le(data, &mut off)?;
            let _file_offset = read_u32_le(data, &mut off)?;

            // Bit 30 toggles compression
            let size_toggle = (raw_size & 0x40000000) != 0;
            let actual_size = raw_size & 0x3FFFFFFF;
            let is_compressed = if size_toggle { !default_compressed } else { default_compressed };

            entries.push(BsaEntry {
                path: folder_name.clone(), // Placeholder, will be combined with filename
                size: actual_size as u64,
                compressed: is_compressed,
            });
        }
    }

    // Read file names block
    if has_file_names {
        let mut file_idx = 0;
        for folder_idx in 0..folder_records.len() {
            for _ in 0..folder_records[folder_idx].count {
                let file_name = read_zstring(data, &mut off)?;
                if file_idx < entries.len() {
                    let folder_path = &folder_names[folder_idx];
                    entries[file_idx].path = if folder_path.is_empty() {
                        file_name
                    } else {
                        format!("{}\\{}", folder_path, file_name)
                    };
                }
                file_idx += 1;
            }
        }
    }

    Ok(entries)
}

// ═══════════════════════════════════════════════════════════════════
// BA2 PARSER (Fallout 4 / Starfield)
// ═══════════════════════════════════════════════════════════════════

fn parse_ba2_header(data: &[u8]) -> Result<Ba2Header, String> {
    let mut off = 0usize;
    let magic = read_u32_le(data, &mut off)?;
    if magic != BA2_MAGIC {
        return Err(format!("Non valido BA2 magic: 0x{:08X}", magic));
    }
    let version = read_u32_le(data, &mut off)?;
    let mut archive_type = [0u8; 4];
    archive_type.copy_from_slice(&read_bytes(data, &mut off, 4)?);
    let file_count = read_u32_le(data, &mut off)?;
    let name_table_offset = read_u64_le(data, &mut off)?;

    Ok(Ba2Header {
        version,
        archive_type,
        file_count,
        name_table_offset,
    })
}

fn parse_ba2_contents(data: &[u8]) -> Result<Vec<BsaEntry>, String> {
    let header = parse_ba2_header(data)?;
    let type_str = String::from_utf8_lossy(&header.archive_type).to_string();
    let is_gnrl = type_str == "GNRL";
    let is_dx10 = type_str == "DX10";

    if !is_gnrl && !is_dx10 {
        return Err(format!("Tipo BA2 non supportato: {}", type_str));
    }

    let mut entries = Vec::with_capacity(header.file_count as usize);
    let mut off = 24usize; // After header

    if is_gnrl {
        // GNRL file entries
        let mut file_entries = Vec::with_capacity(header.file_count as usize);
        for _ in 0..header.file_count {
            let name_hash = read_u32_le(data, &mut off)?;
            let mut ext = [0u8; 4];
            ext.copy_from_slice(&read_bytes(data, &mut off, 4)?);
            let dir_hash = read_u32_le(data, &mut off)?;
            let flags = read_u32_le(data, &mut off)?;
            let offset = read_u64_le(data, &mut off)?;
            let packed_size = read_u32_le(data, &mut off)?;
            let unpacked_size = read_u32_le(data, &mut off)?;
            let _align = read_u32_le(data, &mut off)?;

            file_entries.push(Ba2FileEntry {
                name_hash,
                ext,
                dir_hash,
                flags,
                offset,
                packed_size,
                unpacked_size,
            });
        }

        // Read name table
        if header.name_table_offset > 0 && (header.name_table_offset as usize) < data.len() {
            let mut name_off = header.name_table_offset as usize;
            for (i, fe) in file_entries.iter().enumerate() {
                let name = if name_off < data.len() {
                    let name_len = read_u16_le(data, &mut name_off)? as usize;
                    if name_off + name_len <= data.len() {
                        let name_bytes = &data[name_off..name_off + name_len];
                        name_off += name_len;
                        String::from_utf8_lossy(name_bytes).to_string()
                    } else {
                        format!("file_{}", i)
                    }
                } else {
                    format!("file_{}", i)
                };

                entries.push(BsaEntry {
                    path: name,
                    size: if fe.packed_size > 0 { fe.packed_size as u64 } else { fe.unpacked_size as u64 },
                    compressed: fe.packed_size > 0,
                });
            }
        } else {
            // No name table — use hashes
            for (_i, fe) in file_entries.iter().enumerate() {
                let ext_str = String::from_utf8_lossy(&fe.ext).trim_end_matches('\0').to_string();
                entries.push(BsaEntry {
                    path: format!("{:08X}_{:08X}.{}", fe.dir_hash, fe.name_hash, ext_str),
                    size: if fe.packed_size > 0 { fe.packed_size as u64 } else { fe.unpacked_size as u64 },
                    compressed: fe.packed_size > 0,
                });
            }
        }
    } else {
        // DX10 texture entries — simplified listing
        for _i in 0..header.file_count {
            let name_hash = read_u32_le(data, &mut off)?;
            let mut ext = [0u8; 4];
            ext.copy_from_slice(&read_bytes(data, &mut off, 4)?);
            let dir_hash = read_u32_le(data, &mut off)?;
            let _unk8 = read_u8(data, &mut off)?;
            let num_chunks = read_u8(data, &mut off)?;
            let _chunk_header_size = read_u16_le(data, &mut off)?;
            let _height = read_u16_le(data, &mut off)?;
            let _width = read_u16_le(data, &mut off)?;
            let _num_mips = read_u8(data, &mut off)?;
            let _format = read_u8(data, &mut off)?;
            let _tile_mode = read_u16_le(data, &mut off)?;

            // Skip chunk records
            let mut total_size: u64 = 0;
            let mut is_compressed = false;
            for _ in 0..num_chunks {
                let _chunk_offset = read_u64_le(data, &mut off)?;
                let chunk_packed = read_u32_le(data, &mut off)?;
                let chunk_unpacked = read_u32_le(data, &mut off)?;
                let _start_mip = read_u16_le(data, &mut off)?;
                let _end_mip = read_u16_le(data, &mut off)?;
                total_size += chunk_unpacked as u64;
                if chunk_packed > 0 { is_compressed = true; }
            }

            let ext_str = String::from_utf8_lossy(&ext).trim_end_matches('\0').to_string();
            entries.push(BsaEntry {
                path: format!("{:08X}_{:08X}.{}", dir_hash, name_hash, ext_str),
                size: total_size,
                compressed: is_compressed,
            });
        }

        // Try reading name table for DX10 too
        if header.name_table_offset > 0 && (header.name_table_offset as usize) < data.len() {
            let mut name_off = header.name_table_offset as usize;
            for entry in entries.iter_mut() {
                if name_off < data.len() {
                    if let Ok(name_len) = read_u16_le(data, &mut name_off) {
                        let len = name_len as usize;
                        if name_off + len <= data.len() {
                            let name = String::from_utf8_lossy(&data[name_off..name_off + len]).to_string();
                            name_off += len;
                            entry.path = name;
                        }
                    }
                }
            }
        }
    }

    Ok(entries)
}

// ═══════════════════════════════════════════════════════════════════
// BSA/BA2 FILE EXTRACTION
// ═══════════════════════════════════════════════════════════════════

fn extract_from_bsa(data: &[u8], target_path: &str) -> Result<Vec<u8>, String> {
    let header = parse_bsa_header(data)?;
    let is_v105 = header.version == 105;
    let has_directory_names = (header.archive_flags & 1) != 0;
    let has_file_names = (header.archive_flags & 2) != 0;
    let default_compressed = (header.archive_flags & 4) != 0;

    let target_lower = target_path.to_lowercase().replace('/', "\\");
    let mut off = header.folder_record_offset as usize;

    // Read folder records
    let mut folder_records = Vec::new();
    for _ in 0..header.folder_count {
        let _name_hash = read_u64_le(data, &mut off)?;
        let count = read_u32_le(data, &mut off)?;
        let _offset = if is_v105 {
            let _pad = read_u32_le(data, &mut off)?;
            read_u64_le(data, &mut off)?
        } else {
            read_u32_le(data, &mut off)? as u64
        };
        folder_records.push(count);
    }

    // Scan through folder names + file records to find matching file
    struct FileLocation {
        offset: u32,
        raw_size: u32,
    }

    let mut all_files: Vec<(String, FileLocation)> = Vec::new();

    for &count in &folder_records {
        let folder_name = if has_directory_names {
            read_bzstring(data, &mut off)?
        } else {
            String::new()
        };

        for _ in 0..count {
            let _hash = read_u64_le(data, &mut off)?;
            let raw_size = read_u32_le(data, &mut off)?;
            let file_offset = read_u32_le(data, &mut off)?;
            all_files.push((folder_name.clone(), FileLocation {
                offset: file_offset,
                raw_size,
            }));
        }
    }

    // Read file names and match
    if has_file_names {
        for file_info in all_files.iter_mut() {
            let file_name = read_zstring(data, &mut off)?;
            let full_path = if file_info.0.is_empty() {
                file_name.clone()
            } else {
                format!("{}\\{}", file_info.0, file_name)
            };
            file_info.0 = full_path;
        }
    }

    // Find the target file
    for (full_path, loc) in &all_files {
        if full_path.to_lowercase() == target_lower {
            let size_toggle = (loc.raw_size & 0x40000000) != 0;
            let actual_size = (loc.raw_size & 0x3FFFFFFF) as usize;
            let is_compressed = if size_toggle { !default_compressed } else { default_compressed };

            let file_off = loc.offset as usize;
            if is_compressed {
                // Read original size (first 4 bytes of data)
                let mut doff = file_off;
                let original_size = read_u32_le(data, &mut doff)? as usize;
                let compressed_data = &data[doff..doff + actual_size - 4];

                if is_v105 {
                    // LZ4 decompression
                    return lz4_flex::decompress(compressed_data, original_size)
                        .map_err(|e| format!("Errore decompressione LZ4: {}", e));
                } else {
                    // zlib decompression
                    use flate2::read::ZlibDecoder;
                    let mut decoder = ZlibDecoder::new(compressed_data);
                    let mut decompressed = Vec::with_capacity(original_size);
                    decoder.read_to_end(&mut decompressed)
                        .map_err(|e| format!("Errore decompressione zlib: {}", e))?;
                    return Ok(decompressed);
                }
            } else {
                return Ok(data[file_off..file_off + actual_size].to_vec());
            }
        }
    }

    Err(format!("File non trovato nell'archivio BSA: {}", target_path))
}

fn extract_from_ba2(data: &[u8], target_path: &str) -> Result<Vec<u8>, String> {
    let header = parse_ba2_header(data)?;
    let type_str = String::from_utf8_lossy(&header.archive_type).to_string();
    let target_lower = target_path.to_lowercase().replace('/', "\\");

    if type_str != "GNRL" {
        return Err("Estrazione da BA2 DX10 non supportata per file singoli".to_string());
    }

    let mut off = 24usize;
    let mut file_entries = Vec::new();

    for _ in 0..header.file_count {
        let _name_hash = read_u32_le(data, &mut off)?;
        let _ext = read_bytes(data, &mut off, 4)?;
        let _dir_hash = read_u32_le(data, &mut off)?;
        let _flags = read_u32_le(data, &mut off)?;
        let file_offset = read_u64_le(data, &mut off)?;
        let packed_size = read_u32_le(data, &mut off)?;
        let unpacked_size = read_u32_le(data, &mut off)?;
        let _align = read_u32_le(data, &mut off)?;

        file_entries.push((file_offset, packed_size, unpacked_size));
    }

    // Read name table
    let mut names = Vec::new();
    if header.name_table_offset > 0 && (header.name_table_offset as usize) < data.len() {
        let mut name_off = header.name_table_offset as usize;
        for _ in 0..header.file_count {
            if name_off < data.len() {
                let name_len = read_u16_le(data, &mut name_off)? as usize;
                if name_off + name_len <= data.len() {
                    let name = String::from_utf8_lossy(&data[name_off..name_off + name_len]).to_string();
                    name_off += name_len;
                    names.push(name);
                } else {
                    names.push(String::new());
                }
            } else {
                names.push(String::new());
            }
        }
    }

    // Find matching file
    for (i, (file_offset, packed_size, unpacked_size)) in file_entries.iter().enumerate() {
        let name = names.get(i).map(|s| s.as_str()).unwrap_or("");
        if name.to_lowercase().replace('/', "\\") == target_lower {
            let foff = *file_offset as usize;
            if *packed_size > 0 {
                // Compressed with zlib
                let compressed = &data[foff..foff + *packed_size as usize];
                use flate2::read::ZlibDecoder;
                let mut decoder = ZlibDecoder::new(compressed);
                let mut decompressed = Vec::with_capacity(*unpacked_size as usize);
                decoder.read_to_end(&mut decompressed)
                    .map_err(|e| format!("Errore decompressione BA2: {}", e))?;
                return Ok(decompressed);
            } else {
                let size = *unpacked_size as usize;
                if foff + size <= data.len() {
                    return Ok(data[foff..foff + size].to_vec());
                } else {
                    return Err("Offset file fuori dai limiti".to_string());
                }
            }
        }
    }

    Err(format!("File non trovato nell'archivio BA2: {}", target_path))
}

// ═══════════════════════════════════════════════════════════════════
// STRINGS / DLSTRINGS / ILSTRINGS PARSER
// ═══════════════════════════════════════════════════════════════════

fn parse_strings_file(data: &[u8], file_type: &str) -> Result<Vec<StringEntry>, String> {
    if data.len() < 8 {
        return Err("File STRINGS troppo piccolo".to_string());
    }

    let mut off = 0usize;
    let count = read_u32_le(data, &mut off)? as usize;
    let _data_size = read_u32_le(data, &mut off)? as usize;

    // Read directory: id + offset pairs
    let mut directory = Vec::with_capacity(count);
    for _ in 0..count {
        let id = read_u32_le(data, &mut off)?;
        let string_offset = read_u32_le(data, &mut off)?;
        directory.push((id, string_offset));
    }

    let data_start = off; // String data starts after directory
    let mut entries = Vec::with_capacity(count);

    for (id, string_offset) in &directory {
        let abs_offset = data_start + *string_offset as usize;
        if abs_offset >= data.len() {
            continue;
        }

        let value = match file_type {
            "strings" => {
                // Null-terminated UTF-8 string
                let mut soff = abs_offset;
                read_zstring(data, &mut soff)?
            }
            "dlstrings" | "ilstrings" => {
                // size(4) + null-terminated string
                let mut soff = abs_offset;
                let str_size = read_u32_le(data, &mut soff)? as usize;
                if soff + str_size > data.len() {
                    continue;
                }
                if str_size == 0 {
                    String::new()
                } else {
                    let bytes = &data[soff..soff + str_size];
                    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
                    decode_lossy(&bytes[..end])
                }
            }
            _ => {
                return Err(format!("Tipo string table sconosciuto: {}", file_type));
            }
        };

        entries.push(StringEntry {
            id: *id,
            value,
        });
    }

    Ok(entries)
}

fn build_strings_data(entries: &[PatchedStringEntry], format: &str) -> Result<Vec<u8>, String> {
    let count = entries.len();
    // Compute string data block
    let mut string_data = Vec::new();
    let mut offsets = Vec::with_capacity(count);

    for entry in entries {
        offsets.push(string_data.len() as u32);
        let bytes = entry.value.as_bytes();

        match format {
            "strings" => {
                // Null-terminated string
                string_data.extend_from_slice(bytes);
                string_data.push(0);
            }
            "dlstrings" | "ilstrings" => {
                // size(4) + null-terminated string
                let size = (bytes.len() + 1) as u32; // +1 for null terminator
                string_data.extend_from_slice(&size.to_le_bytes());
                string_data.extend_from_slice(bytes);
                string_data.push(0);
            }
            _ => {
                return Err(format!("Formato sconosciuto: {}", format));
            }
        }
    }

    // Build complete file
    let mut output = Vec::new();
    // Header: count + dataSize
    output.extend_from_slice(&(count as u32).to_le_bytes());
    output.extend_from_slice(&(string_data.len() as u32).to_le_bytes());

    // Directory: id + offset pairs
    for (i, entry) in entries.iter().enumerate() {
        output.extend_from_slice(&entry.id.to_le_bytes());
        output.extend_from_slice(&offsets[i].to_le_bytes());
    }

    // String data
    output.extend_from_slice(&string_data);

    Ok(output)
}

// ═══════════════════════════════════════════════════════════════════
// ESP/ESM PLUGIN PARSER
// ═══════════════════════════════════════════════════════════════════

/// Translatable field types by record type
const TRANSLATABLE_FIELDS: &[(&str, &[&str])] = &[
    ("BOOK", &["FULL", "DESC"]),
    ("NPC_", &["FULL"]),
    ("QUST", &["FULL", "NNAM", "CNAM"]),
    ("DIAL", &["FULL"]),
    ("INFO", &["NAM1", "RNAM"]),
    ("WEAP", &["FULL", "DESC"]),
    ("ARMO", &["FULL", "DESC"]),
    ("MISC", &["FULL", "DESC"]),
    ("ALCH", &["FULL", "DESC"]),
    ("AMMO", &["FULL", "DESC"]),
    ("INGR", &["FULL", "DESC"]),
    ("KEYM", &["FULL", "DESC"]),
    ("SCRL", &["FULL", "DESC"]),
    ("SLGM", &["FULL", "DESC"]),
    ("SPEL", &["FULL", "DESC"]),
    ("MESG", &["FULL", "DESC", "ITXT"]),
    ("PERK", &["FULL", "DESC"]),
    ("RACE", &["FULL", "DESC"]),
    ("CELL", &["FULL"]),
    ("WRLD", &["FULL"]),
    ("FACT", &["FULL"]),
];

fn is_translatable_record(rec_type: &str) -> bool {
    TRANSLATABLE_FIELDS.iter().any(|(rt, _)| *rt == rec_type)
}

fn is_translatable_field(rec_type: &str, field_type: &str) -> bool {
    TRANSLATABLE_FIELDS.iter().any(|(rt, fields)| {
        *rt == rec_type && fields.contains(&field_type)
    })
}

fn parse_plugin_strings(data: &[u8]) -> Result<Vec<PluginStringEntry>, String> {
    if data.len() < 24 {
        return Err("File plugin troppo piccolo".to_string());
    }

    let mut entries = Vec::new();
    let mut off = 0usize;

    // Read TES4 header record to check localized flag
    let rec_type_bytes = read_bytes(data, &mut off, 4)?;
    let rec_type = String::from_utf8_lossy(&rec_type_bytes).to_string();

    if rec_type != "TES4" {
        return Err(format!("Record header atteso TES4, trovato: {}", rec_type));
    }

    let data_size = read_u32_le(data, &mut off)? as usize;
    let flags = read_u32_le(data, &mut off)?;
    let _form_id = read_u32_le(data, &mut off)?;
    let _timestamp = read_u16_le(data, &mut off)?;
    let _version_control = read_u16_le(data, &mut off)?;
    let _internal_version = read_u16_le(data, &mut off)?;
    let _padding = read_u16_le(data, &mut off)?;

    let is_localized = (flags & 0x80) != 0; // Bit 7

    // Skip TES4 data
    let tes4_data_end = off + data_size;
    if tes4_data_end > data.len() {
        return Err("TES4 record data overflow".to_string());
    }
    off = tes4_data_end;

    // Parse remaining records
    while off + 4 <= data.len() {
        let _rec_start = off;
        let type_bytes = read_bytes(data, &mut off, 4)?;
        let rtype = String::from_utf8_lossy(&type_bytes).to_string();

        if rtype == "GRUP" {
            // Group record
            if off + 20 > data.len() {
                break;
            }
            let _group_size = read_u32_le(data, &mut off)? as usize;
            let _label = read_u32_le(data, &mut off)?;
            let _group_type = read_u32_le(data, &mut off)?;
            let _timestamp = read_u16_le(data, &mut off)?;
            let _vc = read_u16_le(data, &mut off)?;
            let _pad = read_u32_le(data, &mut off)?;

            // Don't skip — process records inside the group
            // off is now at the start of the group's children
            continue;
        }

        // Regular record
        if off + 20 > data.len() {
            break;
        }
        let rec_data_size = read_u32_le(data, &mut off)? as usize;
        let rec_flags = read_u32_le(data, &mut off)?;
        let form_id = read_u32_le(data, &mut off)?;
        let _timestamp = read_u16_le(data, &mut off)?;
        let _vc = read_u16_le(data, &mut off)?;
        let _internal_ver = read_u16_le(data, &mut off)?;
        let _pad = read_u16_le(data, &mut off)?;

        let rec_data_start = off;
        let rec_data_end = off + rec_data_size;

        if rec_data_end > data.len() {
            break;
        }

        if !is_translatable_record(&rtype) {
            off = rec_data_end;
            continue;
        }

        // Check if record is compressed (flag bit 18)
        let rec_data = if (rec_flags & 0x00040000) != 0 {
            // Compressed record: first 4 bytes = decompressed size, rest is zlib
            if rec_data_size < 4 {
                off = rec_data_end;
                continue;
            }
            let mut doff = rec_data_start;
            let decompressed_size = read_u32_le(data, &mut doff)? as usize;
            let compressed_data = &data[doff..rec_data_end];

            use flate2::read::ZlibDecoder;
            let mut decoder = ZlibDecoder::new(compressed_data);
            let mut decompressed = Vec::with_capacity(decompressed_size);
            if decoder.read_to_end(&mut decompressed).is_err() {
                off = rec_data_end;
                continue;
            }
            decompressed
        } else {
            data[rec_data_start..rec_data_end].to_vec()
        };

        // Parse fields within the record
        let mut editor_id = String::new();
        let mut field_off = 0usize;

        while field_off + 6 <= rec_data.len() {
            let field_type_bytes = &rec_data[field_off..field_off + 4];
            let field_type = String::from_utf8_lossy(field_type_bytes).to_string();
            field_off += 4;

            let field_size = if field_off + 2 <= rec_data.len() {
                u16::from_le_bytes([rec_data[field_off], rec_data[field_off + 1]]) as usize
            } else {
                break;
            };
            field_off += 2;

            if field_off + field_size > rec_data.len() {
                break;
            }

            let field_data = &rec_data[field_off..field_off + field_size];

            // Capture EDID for context
            if field_type == "EDID" && field_size > 0 {
                let end = field_data.iter().position(|&b| b == 0).unwrap_or(field_data.len());
                editor_id = decode_lossy(&field_data[..end]);
            }

            // Check if this is a translatable field
            if is_translatable_field(&rtype, &field_type) {
                let value = if is_localized {
                    // Localized: field contains a u32 string index
                    if field_size >= 4 {
                        let idx = u32::from_le_bytes([
                            field_data[0], field_data[1], field_data[2], field_data[3],
                        ]);
                        format!("[LOCALIZED:{}]", idx)
                    } else {
                        String::new()
                    }
                } else {
                    // Non-localized: null-terminated string
                    if field_size > 0 {
                        let end = field_data.iter().position(|&b| b == 0).unwrap_or(field_data.len());
                        decode_lossy(&field_data[..end])
                    } else {
                        String::new()
                    }
                };

                if !value.is_empty() {
                    let context = format!("{} > {} [0x{:08X}]", rtype, field_type, form_id);
                    entries.push(PluginStringEntry {
                        form_id,
                        record_type: rtype.clone(),
                        field_name: field_type.clone(),
                        editor_id: editor_id.clone(),
                        value,
                        context,
                    });
                }
            }

            field_off += field_size;
        }

        off = rec_data_end;
    }

    Ok(entries)
}

// ═══════════════════════════════════════════════════════════════════
// GAME DETECTION
// ═══════════════════════════════════════════════════════════════════

fn detect_game_type(data_path: &Path) -> (String, String) {
    let parent = data_path.parent().unwrap_or(data_path);

    // Check for known executables/files
    let checks: Vec<(&str, &str, &str)> = vec![
        ("SkyrimSE.exe", "skyrim_se", "The Elder Scrolls V: Skyrim Special Edition"),
        ("SkyrimSELauncher.exe", "skyrim_se", "The Elder Scrolls V: Skyrim Special Edition"),
        ("TESV.exe", "skyrim_le", "The Elder Scrolls V: Skyrim"),
        ("SkyrimLauncher.exe", "skyrim_le", "The Elder Scrolls V: Skyrim"),
        ("Fallout4.exe", "fallout4", "Fallout 4"),
        ("Fallout4Launcher.exe", "fallout4", "Fallout 4"),
        ("Starfield.exe", "starfield", "Starfield"),
        ("FalloutNV.exe", "falloutnv", "Fallout: New Vegas"),
        ("FalloutNVLauncher.exe", "falloutnv", "Fallout: New Vegas"),
        ("Fallout3.exe", "fallout3", "Fallout 3"),
        ("Fallout3Launcher.exe", "fallout3", "Fallout 3"),
        ("Oblivion.exe", "oblivion", "The Elder Scrolls IV: Oblivion"),
        ("OblivionLauncher.exe", "oblivion", "The Elder Scrolls IV: Oblivion"),
    ];

    for (exe, game_type, game_name) in &checks {
        if parent.join(exe).exists() {
            return (game_type.to_string(), game_name.to_string());
        }
    }

    // Fallback: detect by plugin files
    let has_skyrim_esm = data_path.join("Skyrim.esm").exists();
    let has_skyrim_se_bsa = data_path.join("Skyrim - Patch.bsa").exists();
    let has_fallout4_esm = data_path.join("Fallout4.esm").exists();
    let has_starfield_esm = data_path.join("Starfield.esm").exists();
    let has_falloutnv_esm = data_path.join("FalloutNV.esm").exists();
    let has_fallout3_esm = data_path.join("Fallout3.esm").exists();
    let has_oblivion_esm = data_path.join("Oblivion.esm").exists();

    if has_starfield_esm {
        ("starfield".into(), "Starfield".into())
    } else if has_fallout4_esm {
        ("fallout4".into(), "Fallout 4".into())
    } else if has_skyrim_esm && has_skyrim_se_bsa {
        ("skyrim_se".into(), "The Elder Scrolls V: Skyrim Special Edition".into())
    } else if has_skyrim_esm {
        ("skyrim_le".into(), "The Elder Scrolls V: Skyrim".into())
    } else if has_falloutnv_esm {
        ("falloutnv".into(), "Fallout: New Vegas".into())
    } else if has_fallout3_esm {
        ("fallout3".into(), "Fallout 3".into())
    } else if has_oblivion_esm {
        ("oblivion".into(), "The Elder Scrolls IV: Oblivion".into())
    } else {
        ("unknown".into(), "Gioco Bethesda sconosciuto".into())
    }
}

fn find_data_directory(game_path: &Path) -> PathBuf {
    let data = game_path.join("Data");
    if data.exists() {
        return data;
    }
    // Some installations have lowercase
    let data_lower = game_path.join("data");
    if data_lower.exists() {
        return data_lower;
    }
    // Might be pointing directly at the Data folder
    if game_path.join("Skyrim.esm").exists()
        || game_path.join("Fallout4.esm").exists()
        || game_path.join("Starfield.esm").exists()
        || game_path.join("Oblivion.esm").exists()
        || game_path.join("FalloutNV.esm").exists()
        || game_path.join("Fallout3.esm").exists()
    {
        return game_path.to_path_buf();
    }
    // Default
    game_path.join("Data")
}

fn scan_plugins(data_path: &Path) -> Vec<PluginInfo> {
    let mut plugins = Vec::new();

    if let Ok(dir) = fs::read_dir(data_path) {
        for entry in dir.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ext_lower == "esm" || ext_lower == "esp" || ext_lower == "esl" {
                        let filename = path.file_name()
                            .map(|f| f.to_string_lossy().to_string())
                            .unwrap_or_default();
                        let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                        let is_master = ext_lower == "esm" || ext_lower == "esl";

                        // Check if localized by reading flags from TES4 record
                        let is_localized = check_plugin_localized(&path);

                        plugins.push(PluginInfo {
                            filename,
                            is_master,
                            size,
                            is_localized,
                        });
                    }
                }
            }
        }
    }

    plugins.sort_by(|a, b| {
        // Masters first, then by name
        b.is_master.cmp(&a.is_master).then(a.filename.cmp(&b.filename))
    });

    plugins
}

fn check_plugin_localized(path: &Path) -> bool {
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut header = [0u8; 24];
    if file.read_exact(&mut header).is_err() {
        return false;
    }
    // Check TES4 magic
    if &header[0..4] != b"TES4" {
        return false;
    }
    // Flags at offset 8
    let flags = u32::from_le_bytes([header[8], header[9], header[10], header[11]]);
    (flags & 0x80) != 0
}

fn scan_string_tables(data_path: &Path) -> Vec<StringTableFile> {
    let tables = Vec::new();
    let strings_dir = data_path.join("Strings");

    if !strings_dir.exists() {
        // Try lowercase
        let strings_lower = data_path.join("strings");
        if !strings_lower.exists() {
            return tables;
        }
        return scan_string_tables_in_dir(&strings_lower);
    }

    scan_string_tables_in_dir(&strings_dir)
}

fn scan_string_tables_in_dir(dir: &Path) -> Vec<StringTableFile> {
    let mut tables = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let _filename = path.file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_default();

            // Format: PluginName_Language.TYPE
            // e.g. Skyrim_English.STRINGS, Skyrim_English.DLSTRINGS
            let ext = path.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_uppercase();

            let table_type = match ext.as_str() {
                "STRINGS" => "strings",
                "DLSTRINGS" => "dlstrings",
                "ILSTRINGS" => "ilstrings",
                _ => continue,
            };

            let stem = path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("");

            // Split stem by last underscore to get plugin name and language
            if let Some(underscore_pos) = stem.rfind('_') {
                let plugin_name = &stem[..underscore_pos];
                let language = &stem[underscore_pos + 1..];

                tables.push(StringTableFile {
                    path: path.to_string_lossy().to_string(),
                    language: language.to_string(),
                    table_type: table_type.to_string(),
                    plugin_name: plugin_name.to_string(),
                });
            }
        }
    }

    tables.sort_by(|a, b| {
        a.plugin_name.cmp(&b.plugin_name)
            .then(a.language.cmp(&b.language))
            .then(a.table_type.cmp(&b.table_type))
    });

    tables
}

fn scan_bsa_files(data_path: &Path) -> Vec<String> {
    let mut bsa_files = Vec::new();

    if let Ok(dir) = fs::read_dir(data_path) {
        for entry in dir.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ext_lower == "bsa" || ext_lower == "ba2" {
                        if let Some(path_str) = path.to_str() {
                            bsa_files.push(path_str.to_string());
                        }
                    }
                }
            }
        }
    }

    bsa_files.sort();
    bsa_files
}

// ═══════════════════════════════════════════════════════════════════
// TAURI COMMANDS
// ═══════════════════════════════════════════════════════════════════

/// Rileva il tipo di gioco Bethesda dalla cartella fornita
#[command]
pub fn detect_bethesda_game(game_path: String) -> Result<BethesdaGameInfo, String> {
    let path = Path::new(&game_path);

    if !path.exists() {
        return Err("Percorso non esistente".to_string());
    }

    let data_path = find_data_directory(path);
    if !data_path.exists() {
        return Err(format!("Cartella Data non trovata in: {}", game_path));
    }

    let (game_type, game_name) = detect_game_type(&data_path);
    let plugins = scan_plugins(&data_path);
    let string_tables = scan_string_tables(&data_path);
    let bsa_files = scan_bsa_files(&data_path);

    log::info!(
        "Rilevato gioco Bethesda: {} ({}) - {} plugin, {} string tables, {} archivi BSA/BA2",
        game_name, game_type, plugins.len(), string_tables.len(), bsa_files.len()
    );

    Ok(BethesdaGameInfo {
        game_type,
        game_name,
        data_path: data_path.to_string_lossy().to_string(),
        plugins,
        string_tables,
        bsa_files,
    })
}

/// Lista il contenuto di un archivio BSA o BA2 senza estrarre
#[command]
pub fn list_bsa_contents(bsa_path: String) -> Result<Vec<BsaEntry>, String> {
    let path = Path::new(&bsa_path);

    if !path.exists() {
        return Err(format!("File non trovato: {}", bsa_path));
    }

    let data = fs::read(&bsa_path)
        .map_err(|e| format!("Errore lettura archivio: {}", e))?;

    if data.len() < 4 {
        return Err("File archivio troppo piccolo".to_string());
    }

    let magic = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);

    match magic {
        BSA_MAGIC => parse_bsa_contents(&data),
        BA2_MAGIC => parse_ba2_contents(&data),
        _ => Err(format!("Formato archivio non riconosciuto (magic: 0x{:08X})", magic)),
    }
}

/// Estrae e parsa un file STRINGS/DLSTRINGS/ILSTRINGS
#[command]
pub fn extract_strings_file(strings_path: String) -> Result<Vec<StringEntry>, String> {
    let path = Path::new(&strings_path);

    if !path.exists() {
        return Err(format!("File non trovato: {}", strings_path));
    }

    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let file_type = match ext.as_str() {
        "strings" => "strings",
        "dlstrings" => "dlstrings",
        "ilstrings" => "ilstrings",
        _ => return Err(format!("Estensione non supportata: .{}", ext)),
    };

    let data = fs::read(&strings_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;

    parse_strings_file(&data, file_type)
}

/// Estrae tutte le stringhe traducibili da un plugin ESP/ESM
#[command]
pub fn extract_plugin_strings(plugin_path: String) -> Result<Vec<PluginStringEntry>, String> {
    let path = Path::new(&plugin_path);

    if !path.exists() {
        return Err(format!("File non trovato: {}", plugin_path));
    }

    let data = fs::read(&plugin_path)
        .map_err(|e| format!("Errore lettura plugin: {}", e))?;

    parse_plugin_strings(&data)
}

/// Costruisce un file STRINGS/DLSTRINGS/ILSTRINGS patchato con le traduzioni
#[command]
pub fn build_patched_strings(
    entries: Vec<PatchedStringEntry>,
    output_path: String,
    format: String,
) -> Result<String, String> {
    let format_lower = format.to_lowercase();
    let valid_formats = ["strings", "dlstrings", "ilstrings"];
    if !valid_formats.contains(&format_lower.as_str()) {
        return Err(format!("Formato non valido: {}. Usa: strings, dlstrings, ilstrings", format));
    }

    let data = build_strings_data(&entries, &format_lower)?;

    // Ensure parent directory exists
    if let Some(parent) = Path::new(&output_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Errore creazione directory: {}", e))?;
    }

    fs::write(&output_path, &data)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;

    log::info!(
        "File {} creato: {} entries, {} bytes",
        format_lower, entries.len(), data.len()
    );

    Ok(format!(
        "File {} creato con successo: {} entries ({} bytes)",
        format_lower, entries.len(), data.len()
    ))
}

/// Estrae un singolo file da un archivio BSA/BA2
#[command]
pub fn extract_file_from_bsa(
    bsa_path: String,
    file_path: String,
    output_path: String,
) -> Result<String, String> {
    let path = Path::new(&bsa_path);

    if !path.exists() {
        return Err(format!("Archivio non trovato: {}", bsa_path));
    }

    let data = fs::read(&bsa_path)
        .map_err(|e| format!("Errore lettura archivio: {}", e))?;

    if data.len() < 4 {
        return Err("Archivio troppo piccolo".to_string());
    }

    let magic = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);

    let extracted = match magic {
        BSA_MAGIC => extract_from_bsa(&data, &file_path)?,
        BA2_MAGIC => extract_from_ba2(&data, &file_path)?,
        _ => return Err(format!("Formato archivio non riconosciuto (magic: 0x{:08X})", magic)),
    };

    // Ensure parent directory exists
    if let Some(parent) = Path::new(&output_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Errore creazione directory: {}", e))?;
    }

    fs::write(&output_path, &extracted)
        .map_err(|e| format!("Errore scrittura file estratto: {}", e))?;

    log::info!(
        "File estratto da BSA/BA2: {} -> {} ({} bytes)",
        file_path, output_path, extracted.len()
    );

    Ok(format!(
        "File estratto con successo: {} ({} bytes)",
        output_path, extracted.len()
    ))
}

// ═══════════════════════════════════════════════════════════════════
// TESTS — Autoresearch harness for parser accuracy
// ═══════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ─────────────────────────────────────────────────────────────
    // Helper: build a synthetic STRINGS file (null-terminated strings)
    // ─────────────────────────────────────────────────────────────
    fn build_strings_fixture(entries: &[(u32, &str)]) -> Vec<u8> {
        let count = entries.len() as u32;
        let mut string_data = Vec::new();
        let mut offsets = Vec::new();

        for (_id, text) in entries {
            offsets.push(string_data.len() as u32);
            string_data.extend_from_slice(text.as_bytes());
            string_data.push(0); // null terminator
        }

        let mut buf = Vec::new();
        buf.extend_from_slice(&count.to_le_bytes());
        buf.extend_from_slice(&(string_data.len() as u32).to_le_bytes());
        for (i, (id, _)) in entries.iter().enumerate() {
            buf.extend_from_slice(&id.to_le_bytes());
            buf.extend_from_slice(&offsets[i].to_le_bytes());
        }
        buf.extend_from_slice(&string_data);
        buf
    }

    // ─────────────────────────────────────────────────────────────
    // Helper: build a synthetic DLSTRINGS/ILSTRINGS file (size-prefixed)
    // ─────────────────────────────────────────────────────────────
    fn build_dlstrings_fixture(entries: &[(u32, &str)]) -> Vec<u8> {
        let count = entries.len() as u32;
        let mut string_data = Vec::new();
        let mut offsets = Vec::new();

        for (_id, text) in entries {
            offsets.push(string_data.len() as u32);
            let bytes = text.as_bytes();
            let size = (bytes.len() + 1) as u32; // +1 for null
            string_data.extend_from_slice(&size.to_le_bytes());
            string_data.extend_from_slice(bytes);
            string_data.push(0);
        }

        let mut buf = Vec::new();
        buf.extend_from_slice(&count.to_le_bytes());
        buf.extend_from_slice(&(string_data.len() as u32).to_le_bytes());
        for (i, (id, _)) in entries.iter().enumerate() {
            buf.extend_from_slice(&id.to_le_bytes());
            buf.extend_from_slice(&offsets[i].to_le_bytes());
        }
        buf.extend_from_slice(&string_data);
        buf
    }

    // ─────────────────────────────────────────────────────────────
    // Helper: build a minimal BSA v104 archive
    // ─────────────────────────────────────────────────────────────
    fn build_bsa_v104_fixture(folders: &[(&str, &[&str])]) -> Vec<u8> {
        // BSA v104 layout:
        // Header (36 bytes)
        // Folder records (folder_count * 16 bytes each for v104)
        // For each folder: bzstring folder name + file records (count * 16 bytes each)
        // File names block: zstrings

        let folder_count = folders.len() as u32;
        let file_count: u32 = folders.iter().map(|(_, files)| files.len() as u32).sum();

        let mut total_folder_name_length = 0u32;
        for (name, _) in folders {
            total_folder_name_length += name.len() as u32 + 1; // +1 for length prefix byte in bzstring
        }

        let mut total_file_name_length = 0u32;
        for (_, files) in folders {
            for f in *files {
                total_file_name_length += f.len() as u32 + 1; // +1 for null
            }
        }

        let archive_flags: u32 = 1 | 2; // has directory names | has file names
        let folder_record_offset = 36u32; // header size

        let mut buf = Vec::new();

        // Header
        buf.extend_from_slice(&BSA_MAGIC.to_le_bytes());
        buf.extend_from_slice(&104u32.to_le_bytes()); // version
        buf.extend_from_slice(&folder_record_offset.to_le_bytes());
        buf.extend_from_slice(&archive_flags.to_le_bytes());
        buf.extend_from_slice(&folder_count.to_le_bytes());
        buf.extend_from_slice(&file_count.to_le_bytes());
        buf.extend_from_slice(&total_folder_name_length.to_le_bytes());
        buf.extend_from_slice(&total_file_name_length.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes()); // file_flags
        buf.extend_from_slice(&0u16.to_le_bytes()); // padding

        // Folder records (hash=0, count, offset=0 placeholder)
        // For v104: 8 (hash) + 4 (count) + 4 (offset) = 16 bytes each
        let folder_records_size = folder_count as usize * 16;
        let mut folder_data_offset = folder_record_offset as usize + folder_records_size;

        for (name, files) in folders {
            buf.extend_from_slice(&0u64.to_le_bytes()); // name_hash (0 for test)
            buf.extend_from_slice(&(files.len() as u32).to_le_bytes());
            buf.extend_from_slice(&(folder_data_offset as u32).to_le_bytes());
            // Advance: bzstring (1 + name.len() + 1 null) + file_records (count * 16)
            folder_data_offset += 1 + name.len() + 1 + files.len() * 16;
        }

        // Folder names (bzstring) + file records
        for (name, files) in folders {
            // bzstring: length byte (includes null) + chars + null
            let bz_len = (name.len() + 1) as u8;
            buf.push(bz_len);
            buf.extend_from_slice(name.as_bytes());
            buf.push(0);

            // File records
            for _ in *files {
                buf.extend_from_slice(&0u64.to_le_bytes()); // name_hash
                buf.extend_from_slice(&100u32.to_le_bytes()); // size (uncompressed)
                buf.extend_from_slice(&0u32.to_le_bytes()); // offset
            }
        }

        // File names block (zstrings)
        for (_, files) in folders {
            for f in *files {
                buf.extend_from_slice(f.as_bytes());
                buf.push(0);
            }
        }

        buf
    }

    // ─────────────────────────────────────────────────────────────
    // Helper: build a minimal ESP plugin with non-localized records
    // ─────────────────────────────────────────────────────────────
    fn build_esp_fixture(records: &[(&str, u32, &str, &[(&str, &str)])]) -> Vec<u8> {
        // records: [(record_type, form_id, editor_id, [(field_type, value)])]
        let mut buf = Vec::new();

        // TES4 header (minimal, non-localized: flags = 0)
        let tes4_type = b"TES4";
        let tes4_data: Vec<u8> = Vec::new(); // empty TES4 data
        buf.extend_from_slice(tes4_type);
        buf.extend_from_slice(&(tes4_data.len() as u32).to_le_bytes()); // data_size
        buf.extend_from_slice(&0u32.to_le_bytes()); // flags (not localized)
        buf.extend_from_slice(&0u32.to_le_bytes()); // form_id
        buf.extend_from_slice(&0u16.to_le_bytes()); // timestamp
        buf.extend_from_slice(&0u16.to_le_bytes()); // version_control
        buf.extend_from_slice(&0u16.to_le_bytes()); // internal_version
        buf.extend_from_slice(&0u16.to_le_bytes()); // padding
        buf.extend_from_slice(&tes4_data);

        // Add each record
        for (rec_type, form_id, editor_id, fields) in records {
            let mut rec_data = Vec::new();

            // EDID field
            if !editor_id.is_empty() {
                rec_data.extend_from_slice(b"EDID");
                let edid_bytes: Vec<u8> = editor_id.as_bytes().iter().copied().chain(std::iter::once(0)).collect();
                rec_data.extend_from_slice(&(edid_bytes.len() as u16).to_le_bytes());
                rec_data.extend_from_slice(&edid_bytes);
            }

            // Other fields
            for (field_type, value) in *fields {
                let ft_bytes = field_type.as_bytes();
                rec_data.extend_from_slice(&ft_bytes[..4]);
                let val_bytes: Vec<u8> = value.as_bytes().iter().copied().chain(std::iter::once(0)).collect();
                rec_data.extend_from_slice(&(val_bytes.len() as u16).to_le_bytes());
                rec_data.extend_from_slice(&val_bytes);
            }

            // Record header
            let mut rt = [0u8; 4];
            rt.copy_from_slice(rec_type.as_bytes());
            buf.extend_from_slice(&rt);
            buf.extend_from_slice(&(rec_data.len() as u32).to_le_bytes());
            buf.extend_from_slice(&0u32.to_le_bytes()); // flags
            buf.extend_from_slice(&form_id.to_le_bytes());
            buf.extend_from_slice(&0u16.to_le_bytes()); // timestamp
            buf.extend_from_slice(&0u16.to_le_bytes()); // vc
            buf.extend_from_slice(&0u16.to_le_bytes()); // internal_ver
            buf.extend_from_slice(&0u16.to_le_bytes()); // padding
            buf.extend_from_slice(&rec_data);
        }

        buf
    }

    // ─────────────────────────────────────────────────────────────
    // Helper: build ESP with localized flag set
    // ─────────────────────────────────────────────────────────────
    fn build_esp_localized_fixture(records: &[(&str, u32, &str, &[(&str, u32)])]) -> Vec<u8> {
        // fields contain (field_type, localized_string_index) instead of text
        let mut buf = Vec::new();

        // TES4 header with localized flag (0x80)
        let tes4_data: Vec<u8> = Vec::new();
        buf.extend_from_slice(b"TES4");
        buf.extend_from_slice(&(tes4_data.len() as u32).to_le_bytes());
        buf.extend_from_slice(&0x80u32.to_le_bytes()); // localized flag
        buf.extend_from_slice(&0u32.to_le_bytes()); // form_id
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&tes4_data);

        for (rec_type, form_id, editor_id, fields) in records {
            let mut rec_data = Vec::new();

            if !editor_id.is_empty() {
                rec_data.extend_from_slice(b"EDID");
                let edid_bytes: Vec<u8> = editor_id.as_bytes().iter().copied().chain(std::iter::once(0)).collect();
                rec_data.extend_from_slice(&(edid_bytes.len() as u16).to_le_bytes());
                rec_data.extend_from_slice(&edid_bytes);
            }

            for (field_type, string_idx) in *fields {
                let ft_bytes = field_type.as_bytes();
                rec_data.extend_from_slice(&ft_bytes[..4]);
                rec_data.extend_from_slice(&4u16.to_le_bytes()); // size = 4 (u32)
                rec_data.extend_from_slice(&string_idx.to_le_bytes());
            }

            let mut rt = [0u8; 4];
            rt.copy_from_slice(rec_type.as_bytes());
            buf.extend_from_slice(&rt);
            buf.extend_from_slice(&(rec_data.len() as u32).to_le_bytes());
            buf.extend_from_slice(&0u32.to_le_bytes()); // flags
            buf.extend_from_slice(&form_id.to_le_bytes());
            buf.extend_from_slice(&0u16.to_le_bytes());
            buf.extend_from_slice(&0u16.to_le_bytes());
            buf.extend_from_slice(&0u16.to_le_bytes());
            buf.extend_from_slice(&0u16.to_le_bytes());
            buf.extend_from_slice(&rec_data);
        }

        buf
    }

    // ═══════════════════════════════════════════════════════════════
    // STRINGS PARSER TESTS
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn test_strings_basic() {
        let fixture = build_strings_fixture(&[
            (1, "Hello World"),
            (2, "Iron Sword"),
            (3, "Healing Potion"),
        ]);
        let result = parse_strings_file(&fixture, "strings").unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].id, 1);
        assert_eq!(result[0].value, "Hello World");
        assert_eq!(result[1].id, 2);
        assert_eq!(result[1].value, "Iron Sword");
        assert_eq!(result[2].id, 3);
        assert_eq!(result[2].value, "Healing Potion");
    }

    #[test]
    fn test_strings_empty_string() {
        // A STRINGS entry with an empty string (just null terminator)
        let fixture = build_strings_fixture(&[
            (100, ""),
            (101, "Non-empty"),
        ]);
        let result = parse_strings_file(&fixture, "strings").unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].id, 100);
        assert_eq!(result[0].value, "");
        assert_eq!(result[1].value, "Non-empty");
    }

    #[test]
    fn test_strings_unicode() {
        let fixture = build_strings_fixture(&[
            (1, "Épée magique"),
            (2, "Schild der Stärke"),
            (3, "日本語テスト"),
        ]);
        let result = parse_strings_file(&fixture, "strings").unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].value, "Épée magique");
        assert_eq!(result[1].value, "Schild der Stärke");
        assert_eq!(result[2].value, "日本語テスト");
    }

    #[test]
    fn test_strings_single_entry() {
        let fixture = build_strings_fixture(&[(42, "Only one")]);
        let result = parse_strings_file(&fixture, "strings").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, 42);
        assert_eq!(result[0].value, "Only one");
    }

    #[test]
    fn test_strings_large_id() {
        let fixture = build_strings_fixture(&[(0xFFFFFFFF, "Max ID")]);
        let result = parse_strings_file(&fixture, "strings").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, 0xFFFFFFFF);
        assert_eq!(result[0].value, "Max ID");
    }

    #[test]
    fn test_strings_too_small() {
        let data = vec![0u8; 4]; // only 4 bytes, need at least 8
        let result = parse_strings_file(&data, "strings");
        assert!(result.is_err());
    }

    #[test]
    fn test_strings_unknown_type() {
        let fixture = build_strings_fixture(&[(1, "test")]);
        let result = parse_strings_file(&fixture, "badtype");
        assert!(result.is_err());
    }

    // ═══════════════════════════════════════════════════════════════
    // DLSTRINGS PARSER TESTS
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn test_dlstrings_basic() {
        let fixture = build_dlstrings_fixture(&[
            (10, "This is a dialogue line."),
            (20, "Another dialogue line."),
        ]);
        let result = parse_strings_file(&fixture, "dlstrings").unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].id, 10);
        assert_eq!(result[0].value, "This is a dialogue line.");
        assert_eq!(result[1].id, 20);
        assert_eq!(result[1].value, "Another dialogue line.");
    }

    #[test]
    fn test_dlstrings_empty() {
        // DLSTRINGS with empty string: size=1 (just null), then null byte
        let mut buf = Vec::new();
        buf.extend_from_slice(&1u32.to_le_bytes()); // count = 1
        // string data: size(4)=1 + null(1) = 5 bytes
        let string_data_size = 5u32;
        buf.extend_from_slice(&string_data_size.to_le_bytes());
        // directory entry
        buf.extend_from_slice(&99u32.to_le_bytes()); // id
        buf.extend_from_slice(&0u32.to_le_bytes()); // offset 0
        // string data
        buf.extend_from_slice(&1u32.to_le_bytes()); // size = 1 (just null)
        buf.push(0); // null terminator

        let result = parse_strings_file(&buf, "dlstrings").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, 99);
        assert_eq!(result[0].value, "");
    }

    #[test]
    fn test_ilstrings_basic() {
        let fixture = build_dlstrings_fixture(&[
            (5, "Item description text"),
        ]);
        let result = parse_strings_file(&fixture, "ilstrings").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].value, "Item description text");
    }

    // ═══════════════════════════════════════════════════════════════
    // ROUND-TRIP TESTS (build → parse → verify)
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn test_roundtrip_strings() {
        let original = vec![
            PatchedStringEntry { id: 1, value: "Hello".to_string() },
            PatchedStringEntry { id: 2, value: "World".to_string() },
            PatchedStringEntry { id: 3, value: "Test with spaces and symbols: @#$%".to_string() },
        ];
        let built = build_strings_data(&original, "strings").unwrap();
        let parsed = parse_strings_file(&built, "strings").unwrap();
        assert_eq!(parsed.len(), original.len());
        for (p, o) in parsed.iter().zip(original.iter()) {
            assert_eq!(p.id, o.id);
            assert_eq!(p.value, o.value);
        }
    }

    #[test]
    fn test_roundtrip_dlstrings() {
        let original = vec![
            PatchedStringEntry { id: 100, value: "Dialogue line one".to_string() },
            PatchedStringEntry { id: 200, value: "Dialogue line two".to_string() },
        ];
        let built = build_strings_data(&original, "dlstrings").unwrap();
        let parsed = parse_strings_file(&built, "dlstrings").unwrap();
        assert_eq!(parsed.len(), original.len());
        for (p, o) in parsed.iter().zip(original.iter()) {
            assert_eq!(p.id, o.id);
            assert_eq!(p.value, o.value);
        }
    }

    #[test]
    fn test_roundtrip_ilstrings() {
        let original = vec![
            PatchedStringEntry { id: 50, value: "Item text".to_string() },
        ];
        let built = build_strings_data(&original, "ilstrings").unwrap();
        let parsed = parse_strings_file(&built, "ilstrings").unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].id, 50);
        assert_eq!(parsed[0].value, "Item text");
    }

    #[test]
    fn test_roundtrip_unicode() {
        let original = vec![
            PatchedStringEntry { id: 1, value: "Épée enchantée".to_string() },
            PatchedStringEntry { id: 2, value: "火の剣".to_string() },
            PatchedStringEntry { id: 3, value: "Щит силы".to_string() },
        ];
        for format in &["strings", "dlstrings", "ilstrings"] {
            let built = build_strings_data(&original, format).unwrap();
            let parsed = parse_strings_file(&built, format).unwrap();
            assert_eq!(parsed.len(), original.len(), "format={}", format);
            for (p, o) in parsed.iter().zip(original.iter()) {
                assert_eq!(p.id, o.id, "format={}", format);
                assert_eq!(p.value, o.value, "format={}", format);
            }
        }
    }

    #[test]
    fn test_roundtrip_many_entries() {
        let original: Vec<PatchedStringEntry> = (0..500)
            .map(|i| PatchedStringEntry {
                id: i,
                value: format!("Entry number {} with text", i),
            })
            .collect();
        let built = build_strings_data(&original, "strings").unwrap();
        let parsed = parse_strings_file(&built, "strings").unwrap();
        assert_eq!(parsed.len(), 500);
        assert_eq!(parsed[0].value, "Entry number 0 with text");
        assert_eq!(parsed[499].value, "Entry number 499 with text");
    }

    // ═══════════════════════════════════════════════════════════════
    // BSA PARSER TESTS
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn test_bsa_v104_basic() {
        let fixture = build_bsa_v104_fixture(&[
            ("meshes", &["sword.nif", "shield.nif"]),
            ("textures", &["iron.dds"]),
        ]);
        let result = parse_bsa_contents(&fixture).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].path, "meshes\\sword.nif");
        assert_eq!(result[1].path, "meshes\\shield.nif");
        assert_eq!(result[2].path, "textures\\iron.dds");
    }

    #[test]
    fn test_bsa_v104_single_folder() {
        let fixture = build_bsa_v104_fixture(&[
            ("strings", &["skyrim_english.strings"]),
        ]);
        let result = parse_bsa_contents(&fixture).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "strings\\skyrim_english.strings");
        assert_eq!(result[0].compressed, false);
    }

    #[test]
    fn test_bsa_invalid_magic() {
        let mut data = vec![0u8; 100];
        data[0..4].copy_from_slice(&0xDEADBEEFu32.to_le_bytes());
        let result = parse_bsa_header(&data);
        assert!(result.is_err());
    }

    // ═══════════════════════════════════════════════════════════════
    // ESP/ESM PLUGIN PARSER TESTS
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn test_esp_nonlocalized_basic() {
        let fixture = build_esp_fixture(&[
            ("WEAP", 0x000D0001, "IronSword", &[
                ("FULL", "Iron Sword"),
                ("DESC", "A simple iron sword."),
            ]),
            ("ARMO", 0x000D0002, "IronShield", &[
                ("FULL", "Iron Shield"),
            ]),
        ]);
        let result = parse_plugin_strings(&fixture).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].record_type, "WEAP");
        assert_eq!(result[0].field_name, "FULL");
        assert_eq!(result[0].value, "Iron Sword");
        assert_eq!(result[0].editor_id, "IronSword");
        assert_eq!(result[1].field_name, "DESC");
        assert_eq!(result[1].value, "A simple iron sword.");
        assert_eq!(result[2].record_type, "ARMO");
        assert_eq!(result[2].value, "Iron Shield");
    }

    #[test]
    fn test_esp_nonlocalized_all_record_types() {
        let records: Vec<(&str, u32, &str, Vec<(&str, &str)>)> = vec![
            ("BOOK", 0x100, "TestBook", vec![("FULL", "Book Name"), ("DESC", "Book text")]),
            ("NPC_", 0x101, "TestNPC", vec![("FULL", "Guard")]),
            ("QUST", 0x102, "TestQuest", vec![("FULL", "The Quest"), ("NNAM", "Next obj"), ("CNAM", "Complete")]),
            ("MISC", 0x103, "TestMisc", vec![("FULL", "Gem"), ("DESC", "Shiny gem")]),
            ("ALCH", 0x104, "TestAlch", vec![("FULL", "Potion"), ("DESC", "Heals you")]),
            ("MESG", 0x105, "TestMsg", vec![("FULL", "Message"), ("DESC", "Info"), ("ITXT", "Button")]),
            ("CELL", 0x106, "TestCell", vec![("FULL", "Dungeon")]),
            ("WRLD", 0x107, "TestWorld", vec![("FULL", "Tamriel")]),
        ];

        let fixture_records: Vec<(&str, u32, &str, &[(&str, &str)])> = records
            .iter()
            .map(|(rt, fid, eid, fields)| {
                (*rt, *fid, *eid, fields.as_slice())
            })
            .collect();
        let fixture = build_esp_fixture(&fixture_records);
        let result = parse_plugin_strings(&fixture).unwrap();

        // Count expected: 2+1+3+2+2+3+1+1 = 15
        assert_eq!(result.len(), 15, "Expected 15 translatable fields, got {}", result.len());
    }

    #[test]
    fn test_esp_skips_nontranslatable() {
        // LIGH record is not in TRANSLATABLE_FIELDS
        let fixture = build_esp_fixture(&[
            ("LIGH", 0x200, "TestLight", &[
                ("FULL", "Torch"),
            ]),
        ]);
        let result = parse_plugin_strings(&fixture).unwrap();
        assert_eq!(result.len(), 0, "LIGH should not be translatable");
    }

    #[test]
    fn test_esp_skips_nontranslatable_field() {
        // DATA field on WEAP is not translatable (only FULL and DESC)
        let fixture = build_esp_fixture(&[
            ("WEAP", 0x300, "TestWeap", &[
                ("FULL", "Sword"),
                ("DATA", "some data"),
            ]),
        ]);
        let result = parse_plugin_strings(&fixture).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].value, "Sword");
    }

    #[test]
    fn test_esp_localized() {
        let fixture = build_esp_localized_fixture(&[
            ("WEAP", 0x400, "LocWeapon", &[
                ("FULL", 12345),
                ("DESC", 67890),
            ]),
        ]);
        let result = parse_plugin_strings(&fixture).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].value, "[LOCALIZED:12345]");
        assert_eq!(result[1].value, "[LOCALIZED:67890]");
    }

    #[test]
    fn test_esp_too_small() {
        let data = vec![0u8; 10];
        let result = parse_plugin_strings(&data);
        assert!(result.is_err());
    }

    #[test]
    fn test_esp_bad_header() {
        // Not starting with TES4
        let mut buf = Vec::new();
        buf.extend_from_slice(b"BADH");
        buf.extend_from_slice(&0u32.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        let result = parse_plugin_strings(&buf);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("TES4"));
    }

    #[test]
    fn test_esp_context_format() {
        let fixture = build_esp_fixture(&[
            ("WEAP", 0x000ABCDE, "TestSword", &[
                ("FULL", "My Sword"),
            ]),
        ]);
        let result = parse_plugin_strings(&fixture).unwrap();
        assert_eq!(result.len(), 1);
        assert!(result[0].context.contains("WEAP"));
        assert!(result[0].context.contains("FULL"));
        assert!(result[0].context.contains("000ABCDE"));
    }

    // ═══════════════════════════════════════════════════════════════
    // BINARY HELPERS TESTS
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn test_read_u32_le() {
        let data = vec![0x78, 0x56, 0x34, 0x12];
        let mut off = 0;
        assert_eq!(read_u32_le(&data, &mut off).unwrap(), 0x12345678);
        assert_eq!(off, 4);
    }

    #[test]
    fn test_read_u32_le_eof() {
        let data = vec![0x01, 0x02];
        let mut off = 0;
        assert!(read_u32_le(&data, &mut off).is_err());
    }

    #[test]
    fn test_read_zstring() {
        let data = b"Hello\0World\0";
        let mut off = 0;
        assert_eq!(read_zstring(data, &mut off).unwrap(), "Hello");
        assert_eq!(off, 6);
        assert_eq!(read_zstring(data, &mut off).unwrap(), "World");
    }

    #[test]
    fn test_read_bzstring() {
        // bzstring: length byte (includes null), then chars, then null
        let mut data = Vec::new();
        data.push(6); // length = 5 chars + 1 null
        data.extend_from_slice(b"Hello\0");
        let mut off = 0;
        assert_eq!(read_bzstring(&data, &mut off).unwrap(), "Hello");
    }

    #[test]
    fn test_read_wstring() {
        // wstring: u16 length, then chars
        let mut data = Vec::new();
        data.extend_from_slice(&5u16.to_le_bytes());
        data.extend_from_slice(b"Hello");
        let mut off = 0;
        assert_eq!(read_wstring(&data, &mut off).unwrap(), "Hello");
    }

    // ═══════════════════════════════════════════════════════════════
    // TRANSLATABLE FIELDS TESTS
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn test_is_translatable_record() {
        assert!(is_translatable_record("BOOK"));
        assert!(is_translatable_record("WEAP"));
        assert!(is_translatable_record("NPC_"));
        assert!(is_translatable_record("QUST"));
        assert!(is_translatable_record("MESG"));
        assert!(!is_translatable_record("LIGH"));
        assert!(!is_translatable_record("STAT"));
        assert!(!is_translatable_record("XXXX"));
    }

    #[test]
    fn test_is_translatable_field() {
        assert!(is_translatable_field("BOOK", "FULL"));
        assert!(is_translatable_field("BOOK", "DESC"));
        assert!(!is_translatable_field("BOOK", "DATA"));
        assert!(is_translatable_field("QUST", "NNAM"));
        assert!(is_translatable_field("QUST", "CNAM"));
        assert!(is_translatable_field("MESG", "ITXT"));
        assert!(!is_translatable_field("WEAP", "ITXT"));
    }

    // ═══════════════════════════════════════════════════════════════
    // SCORER — Precision / Recall metric for autoresearch
    // ═══════════════════════════════════════════════════════════════

    /// Run all parse tests against expected data and compute precision/recall.
    /// Returns (precision, recall, f1, total_tests, passed_tests)
    #[allow(dead_code)]
    fn compute_accuracy_score() -> (f64, f64, f64, usize, usize) {
        let mut total = 0usize;
        let mut passed = 0usize;

        // Test suite: (description, test_fn_passes)
        let tests: Vec<(&str, bool)> = vec![
            ("strings_basic", {
                let f = build_strings_fixture(&[(1, "Hello"), (2, "World")]);
                let r = parse_strings_file(&f, "strings");
                r.is_ok() && r.as_ref().unwrap().len() == 2
                    && r.as_ref().unwrap()[0].value == "Hello"
                    && r.as_ref().unwrap()[1].value == "World"
            }),
            ("strings_unicode", {
                let f = build_strings_fixture(&[(1, "Épée"), (2, "日本語")]);
                let r = parse_strings_file(&f, "strings");
                r.is_ok() && r.as_ref().unwrap()[0].value == "Épée"
                    && r.as_ref().unwrap()[1].value == "日本語"
            }),
            ("dlstrings_basic", {
                let f = build_dlstrings_fixture(&[(10, "Dialogue")]);
                let r = parse_strings_file(&f, "dlstrings");
                r.is_ok() && r.as_ref().unwrap()[0].value == "Dialogue"
            }),
            ("roundtrip_strings", {
                let orig = vec![
                    PatchedStringEntry { id: 1, value: "A".to_string() },
                    PatchedStringEntry { id: 2, value: "B".to_string() },
                ];
                let b = build_strings_data(&orig, "strings");
                if let Ok(built) = b {
                    let p = parse_strings_file(&built, "strings");
                    p.is_ok() && p.as_ref().unwrap().len() == 2
                        && p.as_ref().unwrap()[0].value == "A"
                } else { false }
            }),
            ("roundtrip_dlstrings", {
                let orig = vec![PatchedStringEntry { id: 1, value: "Test".to_string() }];
                let b = build_strings_data(&orig, "dlstrings");
                if let Ok(built) = b {
                    let p = parse_strings_file(&built, "dlstrings");
                    p.is_ok() && p.as_ref().unwrap()[0].value == "Test"
                } else { false }
            }),
            ("esp_nonloc", {
                let f = build_esp_fixture(&[("WEAP", 1, "Sw", &[("FULL", "Sword")])]);
                let r = parse_plugin_strings(&f);
                r.is_ok() && r.as_ref().unwrap().len() == 1
                    && r.as_ref().unwrap()[0].value == "Sword"
            }),
            ("esp_localized", {
                let f = build_esp_localized_fixture(&[("WEAP", 1, "Sw", &[("FULL", 42)])]);
                let r = parse_plugin_strings(&f);
                r.is_ok() && r.as_ref().unwrap()[0].value == "[LOCALIZED:42]"
            }),
            ("bsa_v104", {
                let f = build_bsa_v104_fixture(&[("meshes", &["test.nif"])]);
                let r = parse_bsa_contents(&f);
                r.is_ok() && r.as_ref().unwrap().len() == 1
                    && r.as_ref().unwrap()[0].path == "meshes\\test.nif"
            }),
            ("error_too_small", {
                parse_strings_file(&[0; 4], "strings").is_err()
            }),
            ("error_bad_type", {
                let f = build_strings_fixture(&[(1, "x")]);
                parse_strings_file(&f, "bad").is_err()
            }),
        ];

        for (_desc, pass) in &tests {
            total += 1;
            if *pass { passed += 1; }
        }

        let precision = if total > 0 { passed as f64 / total as f64 } else { 0.0 };
        let recall = precision; // In this context, precision == recall (all tests are "expected true")
        let f1 = if precision + recall > 0.0 { 2.0 * precision * recall / (precision + recall) } else { 0.0 };

        (precision, recall, f1, total, passed)
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTORESEARCH ITERATION 1 — Edge Cases
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn test_strings_windows1252_encoding() {
        // Windows-1252 bytes for "Stärke" where ä = 0xE4 in Win-1252
        // With encoding_utils integration, 0xE4 is properly decoded as ä
        let mut buf = Vec::new();
        buf.extend_from_slice(&1u32.to_le_bytes()); // count
        let text_bytes: &[u8] = &[0x53, 0x74, 0xE4, 0x72, 0x6B, 0x65, 0x00]; // "St\xE4rke\0"
        buf.extend_from_slice(&(text_bytes.len() as u32).to_le_bytes()); // data size
        buf.extend_from_slice(&1u32.to_le_bytes()); // id = 1
        buf.extend_from_slice(&0u32.to_le_bytes()); // offset = 0
        buf.extend_from_slice(text_bytes);

        let result = parse_strings_file(&buf, "strings").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, 1);
        // Windows-1252 byte 0xE4 is properly decoded as ä (U+00E4)
        assert_eq!(result[0].value, "Stärke");
    }

    #[test]
    fn test_strings_embedded_null() {
        // A string with a null byte in the middle: "Hello\0World"
        // For STRINGS format (zstring), parsing should stop at first null
        let mut buf = Vec::new();
        buf.extend_from_slice(&1u32.to_le_bytes()); // count
        let text_bytes: &[u8] = b"Hello\0World\0"; // embedded null + terminator
        buf.extend_from_slice(&(text_bytes.len() as u32).to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes()); // id
        buf.extend_from_slice(&0u32.to_le_bytes()); // offset
        buf.extend_from_slice(text_bytes);

        let result = parse_strings_file(&buf, "strings").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].value, "Hello"); // stops at first null
    }

    #[test]
    fn test_dlstrings_zero_size() {
        // DLSTRINGS entry where size field = 0 → should produce empty string
        let mut buf = Vec::new();
        buf.extend_from_slice(&1u32.to_le_bytes()); // count
        let string_data_size = 4u32; // just the size field (0)
        buf.extend_from_slice(&string_data_size.to_le_bytes());
        buf.extend_from_slice(&77u32.to_le_bytes()); // id
        buf.extend_from_slice(&0u32.to_le_bytes()); // offset
        buf.extend_from_slice(&0u32.to_le_bytes()); // size = 0

        let result = parse_strings_file(&buf, "dlstrings").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].value, "");
    }

    #[test]
    fn test_bsa_empty_archive() {
        // BSA with 0 folders and 0 files
        let fixture = build_bsa_v104_fixture(&[]);
        let result = parse_bsa_contents(&fixture).unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_bsa_many_files() {
        // BSA with many files in one folder
        let files: Vec<String> = (0..50).map(|i| format!("file_{}.nif", i)).collect();
        let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
        let fixture = build_bsa_v104_fixture(&[("data", &file_refs)]);
        let result = parse_bsa_contents(&fixture).unwrap();
        assert_eq!(result.len(), 50);
        assert_eq!(result[0].path, "data\\file_0.nif");
        assert_eq!(result[49].path, "data\\file_49.nif");
    }

    #[test]
    fn test_ba2_gnrl_basic() {
        // Build a minimal BA2 GNRL archive with a name table
        let mut buf = Vec::new();

        // Header (24 bytes)
        buf.extend_from_slice(&BA2_MAGIC.to_le_bytes()); // BTDX
        buf.extend_from_slice(&1u32.to_le_bytes()); // version
        buf.extend_from_slice(b"GNRL"); // archive_type
        buf.extend_from_slice(&1u32.to_le_bytes()); // file_count = 1

        // name_table_offset: header(24) + file_entry(36) = 60
        let name_table_offset = 24u64 + 36u64;
        buf.extend_from_slice(&name_table_offset.to_le_bytes());

        // GNRL file entry (36 bytes)
        buf.extend_from_slice(&0x12345678u32.to_le_bytes()); // name_hash
        buf.extend_from_slice(b"nif\0"); // ext
        buf.extend_from_slice(&0xABCDu32.to_le_bytes()); // dir_hash
        buf.extend_from_slice(&0u32.to_le_bytes()); // flags
        buf.extend_from_slice(&0u64.to_le_bytes()); // offset
        buf.extend_from_slice(&0u32.to_le_bytes()); // packed_size (0 = uncompressed)
        buf.extend_from_slice(&1024u32.to_le_bytes()); // unpacked_size
        buf.extend_from_slice(&0u32.to_le_bytes()); // align

        // Name table: u16 length + name bytes
        let name = b"meshes\\test.nif";
        buf.extend_from_slice(&(name.len() as u16).to_le_bytes());
        buf.extend_from_slice(name);

        let result = parse_ba2_contents(&buf).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "meshes\\test.nif");
        assert_eq!(result[0].size, 1024);
        assert_eq!(result[0].compressed, false);
    }

    #[test]
    fn test_ba2_gnrl_compressed() {
        let mut buf = Vec::new();

        // Header
        buf.extend_from_slice(&BA2_MAGIC.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(b"GNRL");
        buf.extend_from_slice(&1u32.to_le_bytes());
        let name_table_offset = 24u64 + 36u64;
        buf.extend_from_slice(&name_table_offset.to_le_bytes());

        // File entry with packed_size > 0 = compressed
        buf.extend_from_slice(&0u32.to_le_bytes()); // name_hash
        buf.extend_from_slice(b"dds\0"); // ext
        buf.extend_from_slice(&0u32.to_le_bytes()); // dir_hash
        buf.extend_from_slice(&0u32.to_le_bytes()); // flags
        buf.extend_from_slice(&0u64.to_le_bytes()); // offset
        buf.extend_from_slice(&512u32.to_le_bytes()); // packed_size > 0
        buf.extend_from_slice(&2048u32.to_le_bytes()); // unpacked_size
        buf.extend_from_slice(&0u32.to_le_bytes()); // align

        // Name table
        let name = b"textures\\iron.dds";
        buf.extend_from_slice(&(name.len() as u16).to_le_bytes());
        buf.extend_from_slice(name);

        let result = parse_ba2_contents(&buf).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].compressed, true);
        assert_eq!(result[0].size, 512); // packed_size when compressed
    }

    #[test]
    fn test_ba2_invalid_type() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&BA2_MAGIC.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(b"XXXX"); // invalid type
        buf.extend_from_slice(&0u32.to_le_bytes());
        buf.extend_from_slice(&0u64.to_le_bytes());

        let result = parse_ba2_contents(&buf);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("non supportato"));
    }

    #[test]
    fn test_ba2_no_name_table() {
        // BA2 with name_table_offset = 0 → should use hash-based names
        let mut buf = Vec::new();
        buf.extend_from_slice(&BA2_MAGIC.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(b"GNRL");
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&0u64.to_le_bytes()); // no name table

        // File entry
        buf.extend_from_slice(&0xDEADu32.to_le_bytes()); // name_hash
        buf.extend_from_slice(b"nif\0");
        buf.extend_from_slice(&0xBEEFu32.to_le_bytes()); // dir_hash
        buf.extend_from_slice(&0u32.to_le_bytes());
        buf.extend_from_slice(&0u64.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes()); // not compressed
        buf.extend_from_slice(&100u32.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes());

        let result = parse_ba2_contents(&buf).unwrap();
        assert_eq!(result.len(), 1);
        // Should contain hash-based name
        assert!(result[0].path.contains("DEAD"));
        assert!(result[0].path.contains("BEEF"));
        assert!(result[0].path.contains("nif"));
    }

    #[test]
    fn test_esp_multiple_records_same_type() {
        let fixture = build_esp_fixture(&[
            ("WEAP", 0x001, "Sword1", &[("FULL", "Iron Sword")]),
            ("WEAP", 0x002, "Sword2", &[("FULL", "Steel Sword")]),
            ("WEAP", 0x003, "Sword3", &[("FULL", "Daedric Sword")]),
        ]);
        let result = parse_plugin_strings(&fixture).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].value, "Iron Sword");
        assert_eq!(result[1].value, "Steel Sword");
        assert_eq!(result[2].value, "Daedric Sword");
    }

    #[test]
    fn test_esp_empty_editor_id() {
        let fixture = build_esp_fixture(&[
            ("WEAP", 0x500, "", &[("FULL", "Unnamed Weapon")]),
        ]);
        let result = parse_plugin_strings(&fixture).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].editor_id, "");
        assert_eq!(result[0].value, "Unnamed Weapon");
    }

    #[test]
    fn test_esp_form_id_preserved() {
        let fixture = build_esp_fixture(&[
            ("ARMO", 0x00ABCDEF, "TestArmor", &[("FULL", "Shield")]),
        ]);
        let result = parse_plugin_strings(&fixture).unwrap();
        assert_eq!(result[0].form_id, 0x00ABCDEF);
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTORESEARCH ITERATION 2 — Advanced Edge Cases
    // ═══════════════════════════════════════════════════════════════

    /// Build a minimal ESP with a GRUP containing records
    fn build_esp_with_grup(records: &[(&str, u32, &str, &[(&str, &str)])]) -> Vec<u8> {
        let mut buf = Vec::new();

        // TES4 header (non-localized)
        buf.extend_from_slice(b"TES4");
        buf.extend_from_slice(&0u32.to_le_bytes()); // data_size = 0
        buf.extend_from_slice(&0u32.to_le_bytes()); // flags
        buf.extend_from_slice(&0u32.to_le_bytes()); // form_id
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());

        // Build record data first to compute GRUP size
        let mut record_bytes = Vec::new();
        for (rec_type, form_id, editor_id, fields) in records {
            let mut rec_data = Vec::new();

            if !editor_id.is_empty() {
                rec_data.extend_from_slice(b"EDID");
                let edid_bytes: Vec<u8> = editor_id.as_bytes().iter().copied().chain(std::iter::once(0)).collect();
                rec_data.extend_from_slice(&(edid_bytes.len() as u16).to_le_bytes());
                rec_data.extend_from_slice(&edid_bytes);
            }

            for (field_type, value) in *fields {
                let ft_bytes = field_type.as_bytes();
                rec_data.extend_from_slice(&ft_bytes[..4]);
                let val_bytes: Vec<u8> = value.as_bytes().iter().copied().chain(std::iter::once(0)).collect();
                rec_data.extend_from_slice(&(val_bytes.len() as u16).to_le_bytes());
                rec_data.extend_from_slice(&val_bytes);
            }

            let mut rt = [0u8; 4];
            rt.copy_from_slice(rec_type.as_bytes());
            record_bytes.extend_from_slice(&rt);
            record_bytes.extend_from_slice(&(rec_data.len() as u32).to_le_bytes());
            record_bytes.extend_from_slice(&0u32.to_le_bytes()); // flags
            record_bytes.extend_from_slice(&form_id.to_le_bytes());
            record_bytes.extend_from_slice(&0u16.to_le_bytes());
            record_bytes.extend_from_slice(&0u16.to_le_bytes());
            record_bytes.extend_from_slice(&0u16.to_le_bytes());
            record_bytes.extend_from_slice(&0u16.to_le_bytes());
            record_bytes.extend_from_slice(&rec_data);
        }

        // GRUP header: "GRUP" + group_size(4) + label(4) + group_type(4) + timestamp(2) + vc(2) + pad(4) = 24 bytes
        let grup_total_size = 24 + record_bytes.len();
        buf.extend_from_slice(b"GRUP");
        buf.extend_from_slice(&(grup_total_size as u32).to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes()); // label
        buf.extend_from_slice(&0u32.to_le_bytes()); // group_type
        buf.extend_from_slice(&0u16.to_le_bytes()); // timestamp
        buf.extend_from_slice(&0u16.to_le_bytes()); // vc
        buf.extend_from_slice(&0u32.to_le_bytes()); // pad

        buf.extend_from_slice(&record_bytes);
        buf
    }

    #[test]
    fn test_esp_with_grup() {
        let fixture = build_esp_with_grup(&[
            ("WEAP", 0x100, "GrupSword", &[("FULL", "Sword in GRUP")]),
            ("ARMO", 0x101, "GrupArmor", &[("FULL", "Armor in GRUP")]),
        ]);
        let result = parse_plugin_strings(&fixture).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].value, "Sword in GRUP");
        assert_eq!(result[1].value, "Armor in GRUP");
    }

    #[test]
    fn test_esp_mixed_translatable_and_not() {
        // Mix of translatable and non-translatable records
        let fixture = build_esp_fixture(&[
            ("WEAP", 0x01, "Sword", &[("FULL", "My Sword")]),
            ("LIGH", 0x02, "Light", &[("FULL", "Torch")]),   // LIGH not translatable
            ("ARMO", 0x03, "Shield", &[("FULL", "My Shield")]),
            ("STAT", 0x04, "Rock", &[("FULL", "A Rock")]),    // STAT not translatable
            ("BOOK", 0x05, "Tome", &[("FULL", "Magic Book"), ("DESC", "Ancient text")]),
        ]);
        let result = parse_plugin_strings(&fixture).unwrap();
        // WEAP(1) + ARMO(1) + BOOK(2) = 4
        assert_eq!(result.len(), 4);
        assert_eq!(result[0].value, "My Sword");
        assert_eq!(result[1].value, "My Shield");
        assert_eq!(result[2].value, "Magic Book");
        assert_eq!(result[3].value, "Ancient text");
    }

    #[test]
    fn test_bsa_v105_fixture() {
        // BSA v105 (Skyrim SE) has different folder record size (24 bytes instead of 16)
        // v105: hash(8) + count(4) + padding(4) + offset(8) = 24
        let folder_name = "meshes";
        let file_name = "test.nif";

        let mut buf = Vec::new();

        // Header (36 bytes)
        buf.extend_from_slice(&BSA_MAGIC.to_le_bytes());
        buf.extend_from_slice(&105u32.to_le_bytes()); // version 105
        buf.extend_from_slice(&36u32.to_le_bytes()); // folder_record_offset
        let archive_flags: u32 = 1 | 2; // has_directory_names | has_file_names
        buf.extend_from_slice(&archive_flags.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes()); // folder_count
        buf.extend_from_slice(&1u32.to_le_bytes()); // file_count
        buf.extend_from_slice(&((folder_name.len() + 1) as u32).to_le_bytes()); // total_folder_name_length
        buf.extend_from_slice(&((file_name.len() + 1) as u32).to_le_bytes()); // total_file_name_length
        buf.extend_from_slice(&0u16.to_le_bytes()); // file_flags
        buf.extend_from_slice(&0u16.to_le_bytes()); // padding

        // Folder record v105 (24 bytes): hash(8) + count(4) + padding(4) + offset(8)
        let folder_data_offset = 36 + 24; // header + 1 folder record
        buf.extend_from_slice(&0u64.to_le_bytes()); // name_hash
        buf.extend_from_slice(&1u32.to_le_bytes()); // count = 1
        buf.extend_from_slice(&0u32.to_le_bytes()); // padding (v105)
        buf.extend_from_slice(&(folder_data_offset as u64).to_le_bytes()); // offset

        // Folder name (bzstring) + file record
        let bz_len = (folder_name.len() + 1) as u8;
        buf.push(bz_len);
        buf.extend_from_slice(folder_name.as_bytes());
        buf.push(0);

        // File record: hash(8) + size(4) + offset(4)
        buf.extend_from_slice(&0u64.to_le_bytes());
        buf.extend_from_slice(&200u32.to_le_bytes()); // size
        buf.extend_from_slice(&0u32.to_le_bytes()); // offset

        // File names
        buf.extend_from_slice(file_name.as_bytes());
        buf.push(0);

        let result = parse_bsa_contents(&buf).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "meshes\\test.nif");
        assert_eq!(result[0].size, 200);
    }

    #[test]
    fn test_ba2_dx10_basic() {
        // Build a minimal DX10 BA2 (texture archive)
        let mut buf = Vec::new();

        // Header (24 bytes)
        buf.extend_from_slice(&BA2_MAGIC.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(b"DX10");
        buf.extend_from_slice(&1u32.to_le_bytes()); // file_count = 1

        // DX10 entry starts at offset 24
        // name_table will be after the entry + 1 chunk
        // DX10 header: hash(4)+ext(4)+dirhash(4)+unk8(1)+numchunks(1)+chunkheadersize(2)
        //              +height(2)+width(2)+nummips(1)+format(1)+tilemode(2) = 24 bytes
        // Chunk: offset(8)+packed(4)+unpacked(4)+start_mip(2)+end_mip(2) = 20 bytes
        let name_table_offset = 24u64 + 24u64 + 20u64; // header + dx10 entry + 1 chunk
        buf.extend_from_slice(&name_table_offset.to_le_bytes());

        // DX10 file entry
        buf.extend_from_slice(&0xAAAAu32.to_le_bytes()); // name_hash
        buf.extend_from_slice(b"dds\0"); // ext
        buf.extend_from_slice(&0xBBBBu32.to_le_bytes()); // dir_hash
        buf.push(0); // unk8
        buf.push(1); // num_chunks = 1
        buf.extend_from_slice(&24u16.to_le_bytes()); // chunk_header_size
        buf.extend_from_slice(&512u16.to_le_bytes()); // height
        buf.extend_from_slice(&512u16.to_le_bytes()); // width
        buf.push(1); // num_mips
        buf.push(0); // format
        buf.extend_from_slice(&0u16.to_le_bytes()); // tile_mode

        // Chunk record
        buf.extend_from_slice(&0u64.to_le_bytes()); // chunk_offset
        buf.extend_from_slice(&0u32.to_le_bytes()); // chunk_packed (0 = uncompressed)
        buf.extend_from_slice(&4096u32.to_le_bytes()); // chunk_unpacked
        buf.extend_from_slice(&0u16.to_le_bytes()); // start_mip
        buf.extend_from_slice(&0u16.to_le_bytes()); // end_mip

        // Name table
        let name = b"textures\\sky.dds";
        buf.extend_from_slice(&(name.len() as u16).to_le_bytes());
        buf.extend_from_slice(name);

        let result = parse_ba2_contents(&buf).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "textures\\sky.dds");
        assert_eq!(result[0].size, 4096);
        assert_eq!(result[0].compressed, false);
    }

    #[test]
    fn test_bsa_multiple_folders() {
        let fixture = build_bsa_v104_fixture(&[
            ("meshes", &["a.nif", "b.nif"]),
            ("textures", &["c.dds", "d.dds"]),
            ("sound", &["e.wav"]),
        ]);
        let result = parse_bsa_contents(&fixture).unwrap();
        assert_eq!(result.len(), 5);
        assert_eq!(result[0].path, "meshes\\a.nif");
        assert_eq!(result[1].path, "meshes\\b.nif");
        assert_eq!(result[2].path, "textures\\c.dds");
        assert_eq!(result[3].path, "textures\\d.dds");
        assert_eq!(result[4].path, "sound\\e.wav");
    }

    #[test]
    fn test_roundtrip_empty_list() {
        let original: Vec<PatchedStringEntry> = vec![];
        let built = build_strings_data(&original, "strings").unwrap();
        let parsed = parse_strings_file(&built, "strings").unwrap();
        assert_eq!(parsed.len(), 0);
    }

    #[test]
    fn test_roundtrip_long_string() {
        let long_text = "A".repeat(10000);
        let original = vec![
            PatchedStringEntry { id: 1, value: long_text.clone() },
        ];
        let built = build_strings_data(&original, "strings").unwrap();
        let parsed = parse_strings_file(&built, "strings").unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].value, long_text);
    }

    #[test]
    fn test_strings_directory_offset_out_of_bounds() {
        // Create a strings file where an entry's offset points past end of data
        let mut buf = Vec::new();
        buf.extend_from_slice(&2u32.to_le_bytes()); // count = 2
        buf.extend_from_slice(&5u32.to_le_bytes()); // data_size = 5
        // Entry 1: valid
        buf.extend_from_slice(&1u32.to_le_bytes()); // id
        buf.extend_from_slice(&0u32.to_le_bytes()); // offset 0
        // Entry 2: offset way past end
        buf.extend_from_slice(&2u32.to_le_bytes()); // id
        buf.extend_from_slice(&9999u32.to_le_bytes()); // offset = 9999 (out of bounds)
        // String data: only "test\0"
        buf.extend_from_slice(b"test\0");

        let result = parse_strings_file(&buf, "strings").unwrap();
        // Entry 2 should be skipped (offset out of bounds)
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].value, "test");
    }

    #[test]
    fn test_accuracy_score() {
        let (precision, _recall, f1, total, passed) = compute_accuracy_score();
        println!("\n═══════════════════════════════════════════════");
        println!("AUTORESEARCH SCORER — Bethesda Patcher");
        println!("═══════════════════════════════════════════════");
        println!("Tests: {}/{} passed", passed, total);
        println!("Precision: {:.1}%", precision * 100.0);
        println!("F1 Score:  {:.1}%", f1 * 100.0);
        println!("═══════════════════════════════════════════════\n");
        assert_eq!(passed, total, "Not all accuracy tests passed: {}/{}", passed, total);
    }
}
