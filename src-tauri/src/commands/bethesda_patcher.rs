// Bethesda Engine Patcher
// Supporto per BSA/BA2, STRINGS/DLSTRINGS/ILSTRINGS, ESP/ESM plugin
// Giochi: Skyrim, Fallout 4, Starfield, Oblivion, Fallout 3/NV

use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::command;

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
    Ok(String::from_utf8_lossy(&bytes[..end]).to_string())
}

fn read_zstring(data: &[u8], offset: &mut usize) -> Result<String, String> {
    // Null-terminated string
    let start = *offset;
    while *offset < data.len() && data[*offset] != 0 {
        *offset += 1;
    }
    let s = String::from_utf8_lossy(&data[start..*offset]).to_string();
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
    Ok(String::from_utf8_lossy(&bytes[..end]).to_string())
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
                    String::from_utf8_lossy(&bytes[..end]).to_string()
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
                editor_id = String::from_utf8_lossy(&field_data[..end]).to_string();
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
                        String::from_utf8_lossy(&field_data[..end]).to_string()
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
