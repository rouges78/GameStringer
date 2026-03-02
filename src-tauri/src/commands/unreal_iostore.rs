//! Unreal Engine IoStore Reader (UTOC/UCAS)
//!
//! Parsa container IoStore per estrarre asset (.locres, .uasset, ecc.)
//! Supporta decompressione Oodle tramite caricamento dinamico della DLL.

use std::fs;
use std::path::{Path, PathBuf};
#[allow(unused_imports)]
use super::unreal_localization::ExtractionResult;

const UTOC_MAGIC: &[u8; 16] = b"-==--==--==--==-";
const INVALID_INDEX: u32 = 0xFFFFFFFF;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct UtocHeader {
    version: u8,
    header_size: u32,
    entry_count: u32,
    compressed_block_entry_count: u32,
    compressed_block_entry_size: u32,
    compression_method_name_count: u32,
    compression_method_name_length: u32,
    compression_block_size: u32,
    directory_index_size: u32,
    partition_count: u32,
    container_id: u64,
    encryption_key_guid: [u8; 16],
    container_flags: u8,
    perfect_hash_seeds_count: u32,
    chunks_without_ph_count: u32,
}

#[derive(Debug, Clone)]
struct IoOffsetAndLength {
    offset: u64,
    length: u64,
}

#[derive(Debug, Clone)]
struct CompressedBlockEntry {
    offset: u64,
    compressed_size: u32,
    uncompressed_size: u32,
    compression_method_index: u8,
}

#[derive(Debug, Clone)]
struct DirectoryIndexEntry {
    name: u32,
    first_child_entry: u32,
    next_sibling_entry: u32,
    first_file_entry: u32,
}

#[derive(Debug, Clone)]
struct FileIndexEntry {
    name: u32,
    next_file_entry: u32,
    user_data: u32, // TocEntry index
}

#[derive(Debug, Clone)]
struct IoStoreFile {
    path: String,
    toc_entry_index: u32,
}

// ═══════════════════════════════════════════════════════════════════
// BINARY READ HELPERS
// ═══════════════════════════════════════════════════════════════════

fn read_u8(data: &[u8], offset: &mut usize) -> Result<u8, String> {
    if *offset >= data.len() { return Err(format!("EOF@{}", offset)); }
    let v = data[*offset];
    *offset += 1;
    Ok(v)
}

fn read_u32(data: &[u8], offset: &mut usize) -> Result<u32, String> {
    if *offset + 4 > data.len() { return Err(format!("EOF@{}", offset)); }
    let v = u32::from_le_bytes([data[*offset], data[*offset+1], data[*offset+2], data[*offset+3]]);
    *offset += 4;
    Ok(v)
}

fn read_i32(data: &[u8], offset: &mut usize) -> Result<i32, String> {
    if *offset + 4 > data.len() { return Err(format!("EOF@{}", offset)); }
    let v = i32::from_le_bytes([data[*offset], data[*offset+1], data[*offset+2], data[*offset+3]]);
    *offset += 4;
    Ok(v)
}

fn read_u64(data: &[u8], offset: &mut usize) -> Result<u64, String> {
    if *offset + 8 > data.len() { return Err(format!("EOF@{}", offset)); }
    let v = u64::from_le_bytes([
        data[*offset], data[*offset+1], data[*offset+2], data[*offset+3],
        data[*offset+4], data[*offset+5], data[*offset+6], data[*offset+7],
    ]);
    *offset += 8;
    Ok(v)
}

fn read_fstring(data: &[u8], offset: &mut usize) -> Result<String, String> {
    let length = read_i32(data, offset)?;
    if length == 0 { return Ok(String::new()); }
    
    if length > 0 {
        let len = length as usize;
        if *offset + len > data.len() { return Err(format!("FString EOF@{}", offset)); }
        let bytes = &data[*offset..*offset + len];
        *offset += len;
        let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
        Ok(String::from_utf8_lossy(&bytes[..end]).to_string())
    } else {
        let char_count = (-length) as usize;
        let byte_count = char_count * 2;
        if *offset + byte_count > data.len() { return Err(format!("FString16 EOF@{}", offset)); }
        let mut chars = Vec::with_capacity(char_count);
        for _ in 0..char_count {
            let lo = data[*offset] as u16;
            let hi = data[*offset + 1] as u16;
            chars.push(lo | (hi << 8));
            *offset += 2;
        }
        if let Some(pos) = chars.iter().position(|&c| c == 0) { chars.truncate(pos); }
        String::from_utf16(&chars).map_err(|e| format!("UTF-16: {}", e))
    }
}

// ═══════════════════════════════════════════════════════════════════
// OODLE DECOMPRESSION
// ═══════════════════════════════════════════════════════════════════

type OodleDecompressFn = unsafe extern "C" fn(
    comp_buf: *const u8,
    comp_buf_size: i64,
    raw_buf: *mut u8,
    raw_len: i64,
    fuzz_safe: i32,
    check_crc: i32,
    verbosity: i32,
    dec_buf_base: *const u8,
    dec_buf_size: i64,
    fp_callback: *const u8,
    callback_user_data: *const u8,
    decoder_memory: *const u8,
    decoder_memory_size: i64,
    thread_phase: i32,
) -> i64;

struct OodleLib {
    _lib: libloading::Library,
    decompress: OodleDecompressFn,
}

impl OodleLib {
    fn load() -> Result<Self, String> {
        let dll_paths = find_oodle_dll();
        
        if dll_paths.is_empty() {
            return Err("DLL Oodle (oo2core_9_win64.dll) non trovata. Installa Unreal Engine o copia la DLL.".into());
        }
        
        for path in &dll_paths {
            log::info!("🔧 Tentativo caricamento Oodle: {}", path.display());
            
            unsafe {
                match libloading::Library::new(path) {
                    Ok(lib) => {
                        let decompress: libloading::Symbol<OodleDecompressFn> = lib.get(b"OodleLZ_Decompress")
                            .map_err(|e| format!("Simbolo OodleLZ_Decompress non trovato: {}", e))?;
                        let decompress_fn = *decompress;
                        
                        log::info!("✅ Oodle caricata da: {}", path.display());
                        return Ok(OodleLib {
                            _lib: lib,
                            decompress: decompress_fn,
                        });
                    }
                    Err(e) => {
                        log::warn!("⚠️ Impossibile caricare {}: {}", path.display(), e);
                        continue;
                    }
                }
            }
        }
        
        Err(format!("Impossibile caricare Oodle da nessun path: {:?}", dll_paths))
    }
    
    fn decompress(&self, compressed: &[u8], uncompressed_size: usize) -> Result<Vec<u8>, String> {
        let mut output = vec![0u8; uncompressed_size];
        
        let result = unsafe {
            (self.decompress)(
                compressed.as_ptr(),
                compressed.len() as i64,
                output.as_mut_ptr(),
                uncompressed_size as i64,
                1, // fuzz_safe
                0, // check_crc
                0, // verbosity
                std::ptr::null(),
                0,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                0,
                3, // thread_phase
            )
        };
        
        if result <= 0 {
            return Err(format!("Oodle decompression failed: returned {}", result));
        }
        
        Ok(output)
    }
}

/// Cerca oo2core DLL in varie posizioni
fn find_oodle_dll() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    
    // Cerca in UE installate
    let ue_bases = vec![
        "C:\\UE_5.7", "C:\\UE_5.5", "C:\\UE_5.4", "C:\\UE_5.3",
        "C:\\Program Files\\Epic Games\\UE_5.7",
        "C:\\Program Files\\Epic Games\\UE_5.5",
        "C:\\Program Files\\Epic Games\\UE_5.4",
    ];
    
    for base in &ue_bases {
        let p = PathBuf::from(base)
            .join("Engine").join("Binaries").join("Win64").join("oo2core_9_win64.dll");
        if p.exists() { paths.push(p.clone()); }
        
        // Anche in DotNET subdirs
        let p2 = PathBuf::from(base)
            .join("Engine").join("Binaries").join("DotNET")
            .join("UnrealBuildTool").join("oo2core_9_win64.dll");
        if p2.exists() { paths.push(p2); }
        
        let p3 = PathBuf::from(base)
            .join("Engine").join("Binaries").join("DotNET")
            .join("AutomationTool").join("oo2core_9_win64.dll");
        if p3.exists() { paths.push(p3); }
    }
    
    // Cerca nella directory di GameStringer
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()));
    
    if let Some(dir) = exe_dir {
        let p = dir.join("oo2core_9_win64.dll");
        if p.exists() { paths.push(p); }
    }
    
    paths
}

// ═══════════════════════════════════════════════════════════════════
// UTOC PARSER
// ═══════════════════════════════════════════════════════════════════

fn parse_utoc_header(data: &[u8]) -> Result<UtocHeader, String> {
    if data.len() < 144 {
        return Err("UTOC troppo piccolo".into());
    }
    
    // Verifica magic
    if &data[0..16] != UTOC_MAGIC {
        return Err("Magic UTOC non valido".into());
    }
    
    let mut off = 16usize;
    let version = read_u8(data, &mut off)?;
    let _reserved = [read_u8(data, &mut off)?, read_u8(data, &mut off)?, read_u8(data, &mut off)?];
    let header_size = read_u32(data, &mut off)?;
    let entry_count = read_u32(data, &mut off)?;
    let compressed_block_entry_count = read_u32(data, &mut off)?;
    let compressed_block_entry_size = read_u32(data, &mut off)?;
    let compression_method_name_count = read_u32(data, &mut off)?;
    let compression_method_name_length = read_u32(data, &mut off)?;
    let compression_block_size = read_u32(data, &mut off)?;
    let directory_index_size = read_u32(data, &mut off)?;
    let partition_count = read_u32(data, &mut off)?;
    let container_id = read_u64(data, &mut off)?;
    
    let mut encryption_key_guid = [0u8; 16];
    encryption_key_guid.copy_from_slice(&data[off..off + 16]);
    off += 16;
    
    let container_flags = read_u8(data, &mut off)?;
    
    // v5+ (PerfectHash): skip padding, read PerfectHashSeedsCount + PartitionSize
    let mut perfect_hash_seeds_count = 0u32;
    let mut chunks_without_ph_count = 0u32;
    
    if version >= 4 {
        // 3 bytes padding after container_flags to align to 4 bytes
        off += 3;
        perfect_hash_seeds_count = read_u32(data, &mut off)?;
        // PartitionSize (u64 per partition) - skip
        off += 8 * (partition_count as usize);
    }
    
    if version >= 5 {
        chunks_without_ph_count = read_u32(data, &mut off)?;
    }
    
    log::info!("📦 UTOC v{}: {} entry, {} compressed blocks, {} partitions, {} PH seeds",
        version, entry_count, compressed_block_entry_count, partition_count, perfect_hash_seeds_count);
    
    Ok(UtocHeader {
        version, header_size, entry_count,
        compressed_block_entry_count, compressed_block_entry_size,
        compression_method_name_count, compression_method_name_length,
        compression_block_size, directory_index_size, partition_count,
        container_id, encryption_key_guid, container_flags,
        perfect_hash_seeds_count, chunks_without_ph_count,
    })
}

fn parse_utoc_data(data: &[u8], header: &UtocHeader) -> Result<(
    Vec<IoOffsetAndLength>,
    Vec<CompressedBlockEntry>,
    Vec<String>,
    Vec<IoStoreFile>,
), String> {
    let hs = header.header_size as usize;
    let ec = header.entry_count as usize;
    
    // Skip ChunkIds (12 bytes each)
    let chunk_ids_offset = hs;
    let chunk_ids_size = ec * 12;
    
    // OffsetAndLengths (10 bytes each)
    let oal_offset = chunk_ids_offset + chunk_ids_size;
    let mut offset_lengths = Vec::with_capacity(ec);
    
    for i in 0..ec {
        let base = oal_offset + i * 10;
        if base + 10 > data.len() {
            return Err(format!("UTOC OffsetAndLength overflow at entry {}", i));
        }
        
        // 5 bytes offset (big-endian)
        let file_offset = ((data[base] as u64) << 32)
            | ((data[base + 1] as u64) << 24)
            | ((data[base + 2] as u64) << 16)
            | ((data[base + 3] as u64) << 8)
            | (data[base + 4] as u64);
        
        // 5 bytes length (big-endian)
        let file_length = ((data[base + 5] as u64) << 32)
            | ((data[base + 6] as u64) << 24)
            | ((data[base + 7] as u64) << 16)
            | ((data[base + 8] as u64) << 8)
            | (data[base + 9] as u64);
        
        offset_lengths.push(IoOffsetAndLength {
            offset: file_offset,
            length: file_length,
        });
    }
    
    // PerfectHashSeeds (4 bytes each, v5+)
    let phs_offset = oal_offset + ec * 10;
    let phs_count = header.perfect_hash_seeds_count as usize;
    let phs_size = phs_count * 4;
    
    // ChunkIndicesWithoutPerfectHash (4 bytes each, v6+)
    let cwph_offset = phs_offset + phs_size;
    let cwph_count = header.chunks_without_ph_count as usize;
    let cwph_size = cwph_count * 4;
    
    log::info!("📦 Sections: ChunkIds@{}, OAL@{}, PHS@{} ({}), CWPH@{} ({})",
        chunk_ids_offset, oal_offset, phs_offset, phs_count, cwph_offset, cwph_count);
    
    // CompressedBlockEntries (12 bytes each)
    let cbe_offset = cwph_offset + cwph_size;
    let cbe_count = header.compressed_block_entry_count as usize;
    let mut compressed_blocks = Vec::with_capacity(cbe_count);
    
    for i in 0..cbe_count {
        let base = cbe_offset + i * 12;
        if base + 12 > data.len() {
            return Err(format!("UTOC CompressedBlock overflow at {}", i));
        }
        
        // 5 bytes offset (LITTLE-endian per UE5 FIoStoreTocCompressedBlockEntry)
        let block_offset = (data[base] as u64)
            | ((data[base + 1] as u64) << 8)
            | ((data[base + 2] as u64) << 16)
            | ((data[base + 3] as u64) << 24)
            | ((data[base + 4] as u64) << 32);
        
        // 3 bytes compressed size (little-endian)
        let comp_size = (data[base + 5] as u32)
            | ((data[base + 6] as u32) << 8)
            | ((data[base + 7] as u32) << 16);
        
        // 3 bytes uncompressed size (little-endian)
        let uncomp_size = (data[base + 8] as u32)
            | ((data[base + 9] as u32) << 8)
            | ((data[base + 10] as u32) << 16);
        
        let method_index = data[base + 11];
        
        compressed_blocks.push(CompressedBlockEntry {
            offset: block_offset,
            compressed_size: comp_size,
            uncompressed_size: uncomp_size,
            compression_method_index: method_index,
        });
    }
    
    // CompressionMethodNames
    let cmn_offset = cbe_offset + cbe_count * 12;
    let cmn_count = header.compression_method_name_count as usize;
    let cmn_len = header.compression_method_name_length as usize;
    let mut compression_methods = Vec::with_capacity(cmn_count);
    
    for i in 0..cmn_count {
        let base = cmn_offset + i * cmn_len;
        if base + cmn_len > data.len() {
            return Err(format!("UTOC CompressionMethod overflow at {}", i));
        }
        let name_bytes = &data[base..base + cmn_len];
        let end = name_bytes.iter().position(|&b| b == 0).unwrap_or(cmn_len);
        let name = String::from_utf8_lossy(&name_bytes[..end]).to_string();
        compression_methods.push(name);
    }
    
    log::info!("📦 Compression methods: {:?}", compression_methods);
    
    // DirectoryIndex
    let dir_offset = cmn_offset + cmn_count * cmn_len;
    let dir_size = header.directory_index_size as usize;
    
    if dir_offset + dir_size > data.len() {
        return Err("UTOC DirectoryIndex overflow".into());
    }
    
    if dir_size == 0 {
        log::info!("📦 DirectoryIndex vuoto, skip");
        return Ok((offset_lengths, compressed_blocks, compression_methods, Vec::new()));
    }
    
    let dir_data = &data[dir_offset..dir_offset + dir_size];
    let files = parse_directory_index(dir_data)?;
    
    log::info!("📦 Files nel container: {}", files.len());
    
    // Debug: mostra primi 10 file trovati
    for (i, f) in files.iter().take(10).enumerate() {
        log::info!("📦 File[{}]: '{}' (entry {})", i, f.path, f.toc_entry_index);
    }
    
    // Debug: cerca .locres nei file trovati
    let locres_count = files.iter().filter(|f| f.path.ends_with(".locres")).count();
    log::info!("📦 .locres trovati nel container: {}", locres_count);
    
    Ok((offset_lengths, compressed_blocks, compression_methods, files))
}

fn parse_directory_index(data: &[u8]) -> Result<Vec<IoStoreFile>, String> {
    let mut off = 0usize;
    
    // MountPoint
    let mount_point = read_fstring(data, &mut off)?;
    log::info!("📦 Mount point: '{}'", mount_point);
    
    // Directory entries
    let dir_count = read_u32(data, &mut off)? as usize;
    let mut dir_entries = Vec::with_capacity(dir_count);
    
    for _ in 0..dir_count {
        dir_entries.push(DirectoryIndexEntry {
            name: read_u32(data, &mut off)?,
            first_child_entry: read_u32(data, &mut off)?,
            next_sibling_entry: read_u32(data, &mut off)?,
            first_file_entry: read_u32(data, &mut off)?,
        });
    }
    
    // File entries
    let file_count = read_u32(data, &mut off)? as usize;
    let mut file_entries = Vec::with_capacity(file_count);
    
    for _ in 0..file_count {
        file_entries.push(FileIndexEntry {
            name: read_u32(data, &mut off)?,
            next_file_entry: read_u32(data, &mut off)?,
            user_data: read_u32(data, &mut off)?,
        });
    }
    
    // String table
    let string_count = read_u32(data, &mut off)? as usize;
    let mut string_table = Vec::with_capacity(string_count);
    
    for _ in 0..string_count {
        string_table.push(read_fstring(data, &mut off)?);
    }
    
    log::info!("📦 DirIndex: {} dirs, {} files, {} strings", dir_entries.len(), file_entries.len(), string_table.len());
    if !string_table.is_empty() {
        log::info!("📦 First strings: {:?}", &string_table[..std::cmp::min(5, string_table.len())]);
    }
    if !dir_entries.is_empty() {
        let d = &dir_entries[0];
        log::info!("📦 Root dir[0]: name={}, child={}, sibling={}, files={}", d.name, d.first_child_entry, d.next_sibling_entry, d.first_file_entry);
    }
    
    // Build parent map (iterative — no recursion)
    let mut dir_parent: Vec<u32> = vec![INVALID_INDEX; dir_entries.len()];
    for (i, de) in dir_entries.iter().enumerate() {
        let mut child = de.first_child_entry;
        while child != INVALID_INDEX && (child as usize) < dir_entries.len() {
            dir_parent[child as usize] = i as u32;
            child = dir_entries[child as usize].next_sibling_entry;
        }
    }
    
    // Build path for a directory by walking up the parent chain
    let build_dir_path = |dir_idx: usize| -> String {
        let mut parts: Vec<&str> = Vec::new();
        let mut current = dir_idx;
        loop {
            let de = &dir_entries[current];
            if de.name != INVALID_INDEX && (de.name as usize) < string_table.len() {
                parts.push(&string_table[de.name as usize]);
            }
            let p = dir_parent[current];
            if p == INVALID_INDEX || p as usize >= dir_entries.len() {
                break;
            }
            current = p as usize;
        }
        parts.reverse();
        if parts.is_empty() {
            String::new()
        } else {
            format!("{}/", parts.join("/"))
        }
    };
    
    // Collect all files iteratively
    let mut files = Vec::new();
    let mut dirs_with_files = 0u32;
    
    for (dir_idx, de) in dir_entries.iter().enumerate() {
        if de.first_file_entry == INVALID_INDEX {
            continue;
        }
        
        dirs_with_files += 1;
        let dir_path = build_dir_path(dir_idx);
        
        let mut file_idx = de.first_file_entry;
        while file_idx != INVALID_INDEX && (file_idx as usize) < file_entries.len() {
            let fe = &file_entries[file_idx as usize];
            if (fe.name as usize) < string_table.len() {
                files.push(IoStoreFile {
                    path: format!("{}{}", dir_path, &string_table[fe.name as usize]),
                    toc_entry_index: fe.user_data,
                });
            }
            file_idx = fe.next_file_entry;
        }
    }
    
    log::info!("📦 Walker: {} dirs with files, {} total files collected", dirs_with_files, files.len());
    
    Ok(files)
}

// ═══════════════════════════════════════════════════════════════════
// FTEXT SCANNER (for proper .locres override)
// ═══════════════════════════════════════════════════════════════════

/// Tenta di leggere un FString a un dato offset.
/// FString = [i32 len (include null)] [bytes] [null]
/// len > 0 → UTF-8, len < 0 → UTF-16 (|len| chars * 2 bytes)
fn try_read_fstring_at(data: &[u8], off: &mut usize) -> Option<String> {
    if *off + 4 > data.len() { return None; }
    
    let len = i32::from_le_bytes([data[*off], data[*off+1], data[*off+2], data[*off+3]]);
    
    if len == 0 {
        *off += 4;
        return Some(String::new());
    }
    
    if len > 0 && len <= 10000 {
        // UTF-8
        let str_start = *off + 4;
        let str_end = str_start + len as usize;
        if str_end > data.len() { return None; }
        if data[str_end - 1] != 0 { return None; }
        
        let text_bytes = &data[str_start..str_end - 1];
        match std::str::from_utf8(text_bytes) {
            Ok(s) => {
                *off = str_end;
                Some(s.to_string())
            }
            Err(_) => None
        }
    } else if len < 0 && len >= -10000 {
        // UTF-16
        let char_count = (-len) as usize;
        let byte_count = char_count * 2;
        let str_start = *off + 4;
        let str_end = str_start + byte_count;
        if str_end > data.len() { return None; }
        
        let u16_slice: Vec<u16> = (0..char_count)
            .map(|j| u16::from_le_bytes([data[str_start + j*2], data[str_start + j*2 + 1]]))
            .collect();
        
        match String::from_utf16(&u16_slice[..u16_slice.len().saturating_sub(1)]) {
            Ok(s) => {
                *off = str_end;
                Some(s)
            }
            Err(_) => None
        }
    } else {
        None
    }
}

/// Scansiona un .uasset per pattern FText Base: [flags:u32][0x00][ns][key][src]
/// Restituisce (namespace, key, source_text) per ogni FText trovato.
fn scan_ftext_entries(data: &[u8]) -> Vec<(String, String, String)> {
    let mut entries = Vec::new();
    let mut i = 0usize;
    
    while i + 9 < data.len() {
        // FText flags (4 bytes) + history_type Base (1 byte = 0x00)
        let history_type = data[i + 4] as i8;
        
        if history_type == 0 {
            let flags = u32::from_le_bytes([data[i], data[i+1], data[i+2], data[i+3]]);
            
            // Flags should be small (usually 0, sometimes 1-8 for various FText flags)
            if flags <= 0xFF {
                let mut off = i + 5;
                let saved_off = off;
                
                if let Some(ns) = try_read_fstring_at(data, &mut off) {
                    if let Some(key) = try_read_fstring_at(data, &mut off) {
                        if let Some(src) = try_read_fstring_at(data, &mut off) {
                            // Validate: ns e key non vuoti, src è testo significativo
                            if !ns.is_empty() && !key.is_empty() 
                                && src.len() >= 2
                                && src.chars().any(|c| c.is_alphabetic())
                                && !src.contains('\0')
                            {
                                entries.push((ns, key, src));
                                i = off;
                                continue;
                            }
                        }
                    }
                }
                
                // Reset se il pattern non era valido
                let _ = saved_off;
            }
        }
        
        i += 1;
    }
    
    entries
}

// ═══════════════════════════════════════════════════════════════════
// STRINGTABLE PARSER (proper namespace/key/value extraction)
// ═══════════════════════════════════════════════════════════════════

/// Parsa le entry di un UStringTable serializzato nel .uasset.
/// Formato UE5 StringTable (dopo UObject properties):
///   [FString TableNamespace][i32 NumEntries][FString Key, FString Value]...
/// Restituisce (namespace, key, value) per ogni entry.
fn scan_stringtable_entries(data: &[u8]) -> Vec<(String, String, String)> {
    let data_offset = find_uasset_data_offset(data);
    let mut best_result: Vec<(String, String, String)> = Vec::new();
    
    // Scansiona il data section cercando il pattern StringTable
    let mut i = data_offset;
    while i + 8 < data.len() {
        let mut off = i;
        
        // Prova a leggere un FString (potenziale namespace)
        if let Some(ns) = try_read_fstring_at(data, &mut off) {
            // Namespace valido: non vuoto, non troppo lungo, sembra un path o nome
            if ns.len() >= 2 && ns.len() <= 500 {
                // Prova a leggere il count
                if off + 4 <= data.len() {
                    let count = i32::from_le_bytes([data[off], data[off+1], data[off+2], data[off+3]]);
                    
                    // Count ragionevole per una StringTable
                    if count >= 2 && count <= 50000 {
                        let mut pairs_off = off + 4;
                        let mut pairs: Vec<(String, String)> = Vec::new();
                        let mut valid = true;
                        
                        for _ in 0..count {
                            let saved = pairs_off;
                            if let Some(key) = try_read_fstring_at(data, &mut pairs_off) {
                                if let Some(val) = try_read_fstring_at(data, &mut pairs_off) {
                                    // Key non vuota, value non vuota
                                    if !key.is_empty() && !val.is_empty() {
                                        pairs.push((key, val));
                                    } else if key.is_empty() && val.is_empty() {
                                        // Due stringhe vuote consecutive = probabilmente fine dati
                                        valid = false;
                                        break;
                                    } else {
                                        pairs.push((key, val));
                                    }
                                } else {
                                    pairs_off = saved;
                                    valid = false;
                                    break;
                                }
                            } else {
                                pairs_off = saved;
                                valid = false;
                                break;
                            }
                        }
                        
                        // Successo: abbiamo letto TUTTE le entry previste
                        if valid && pairs.len() == count as usize && pairs.len() >= 2 {
                            // Verifica che almeno alcune values siano testo leggibile (non binario)
                            let readable = pairs.iter()
                                .filter(|(_, v)| v.chars().any(|c| c.is_alphabetic()))
                                .count();
                            
                            if readable >= pairs.len() / 2 {
                                log::info!("📋 StringTable trovata! ns=\"{}\" count={} readable={}", 
                                    &ns[..std::cmp::min(ns.len(), 60)], pairs.len(), readable);
                                
                                // Se è meglio del risultato precedente, usala
                                if pairs.len() > best_result.len() {
                                    best_result = pairs.iter()
                                        .map(|(k, v)| (ns.clone(), k.clone(), v.clone()))
                                        .collect();
                                }
                                
                                // Salta oltre questa tabella e continua a cercare altre
                                i = pairs_off;
                                continue;
                            }
                        }
                    }
                }
            }
        }
        
        i += 1;
    }
    
    best_result
}

// ═══════════════════════════════════════════════════════════════════
// UASSET STRING SCANNER (for DataTable localization)
// ═══════════════════════════════════════════════════════════════════

/// Scansiona byte raw di un .uasset per estrarre stringhe FString leggibili.
/// Usato come fallback quando il gioco non ha .locres ma usa DataTable .uasset.
fn scan_uasset_strings(data: &[u8], source_name: &str) -> Vec<super::unreal_localization::LocEntry> {
    let mut raw_strings = Vec::new();
    let mut i = 0usize;
    
    while i + 4 < data.len() {
        let len = i32::from_le_bytes([data[i], data[i+1], data[i+2], data[i+3]]);
        
        if len >= 3 && len <= 2000 {
            let str_start = i + 4;
            let str_end = str_start + (len as usize);
            
            if str_end <= data.len() {
                let bytes = &data[str_start..str_end];
                
                if bytes[bytes.len() - 1] == 0 {
                    let text_bytes = &bytes[..bytes.len() - 1];
                    
                    if let Ok(text) = std::str::from_utf8(text_bytes) {
                        let trimmed = text.trim();
                        if trimmed.len() >= 3 {
                            raw_strings.push(trimmed.to_string());
                            i = str_end;
                            continue;
                        }
                    }
                }
            }
        }
        
        i += 1;
    }
    
    // Post-processing: pulisci e filtra
    let mut entries = Vec::new();
    let mut key_idx = 0u32;
    let mut seen = std::collections::HashSet::new();
    
    for raw in &raw_strings {
        for cleaned in clean_datatable_string(raw) {
            let trimmed = cleaned.trim();
            if trimmed.len() < 3 { continue; }
            if !is_translatable_text(trimmed) { continue; }
            if seen.contains(trimmed) { continue; }
            
            seen.insert(trimmed.to_string());
            entries.push(super::unreal_localization::LocEntry {
                namespace: source_name.to_string(),
                key: format!("dt_{}_{}", source_name.replace('/', "_"), key_idx),
                source_hash: 0,
                value: trimmed.to_string(),
            });
            key_idx += 1;
        }
    }
    
    entries
}

/// Controlla se una stringa è testo traducibile (non un ID tecnico)
fn is_translatable_text(s: &str) -> bool {
    let alpha_count = s.chars().filter(|c| c.is_alphabetic()).count();
    if alpha_count < 3 { return false; }
    
    // Escludi ID tecnici puri: TUTTO_MAIUSCOLO_CON_UNDERSCORE
    if s.chars().all(|c| c.is_ascii_uppercase() || c == '_' || c.is_ascii_digit()) {
        return false;
    }
    
    // Escludi nomi interni CamelCase_WithUnderscores senza spazi
    // Es: "LocalizationItemData", "SkillsNames_TEMP", "Chapt1_GameplayDialogs_Subs", "Generic_UI"
    if !s.contains(' ') && s.contains('_') {
        let parts: Vec<&str> = s.split('_').collect();
        let all_camel = parts.iter().all(|p| {
            p.is_empty() || p.chars().next().map(|c| c.is_ascii_uppercase() || c.is_ascii_digit()).unwrap_or(true)
        });
        if all_camel { return false; }
    }
    
    // Escludi nomi CamelCase singoli senza spazi (es: "LocalizationItemData", "GameplayDialogs")
    if !s.contains(' ') && !s.contains('_') && s.len() > 10 {
        let transitions = s.as_bytes().windows(2)
            .filter(|w| (w[0] as char).is_ascii_lowercase() && (w[1] as char).is_ascii_uppercase())
            .count();
        if transitions >= 2 { return false; }
    }
    
    // Escludi path/reference
    if s.contains("Content/") || s.starts_with('/') || s.contains("::") {
        return false;
    }
    
    // Escludi stringhe che iniziano con 0x (hex)
    if s.starts_with("0x") { return false; }
    
    // Deve avere almeno uno spazio, punteggiatura, o essere un nome proprio breve
    let has_space = s.contains(' ') || s.contains('.') || s.contains(',') 
        || s.contains('!') || s.contains('?') || s.contains(':') || s.contains('-');
    let is_short_name = s.len() <= 30 && s.chars().next().map(|c| c.is_uppercase()).unwrap_or(false)
        && s.chars().any(|c| c.is_lowercase());
    
    has_space || is_short_name
}

/// Pulisce una stringa DataTable: separa ID tecnici concatenati dal testo
fn clean_datatable_string(s: &str) -> Vec<String> {
    let mut results = Vec::new();
    
    // Splitta su caratteri separatore non-ASCII/control (es. ␦ o altri)
    let parts: Vec<&str> = s.split(|c: char| !c.is_ascii() && !c.is_alphanumeric() || c.is_control())
        .filter(|p| !p.is_empty())
        .collect();
    
    // Se la stringa originale non aveva separatori speciali, usa come singola parte
    let work_parts = if parts.is_empty() { vec![s] } else { parts };
    
    for part in work_parts {
        // Rimuovi prefissi ID tecnici: pattern XX_XX_... all'inizio
        let cleaned = strip_id_prefix(part);
        
        // Splitta ulteriormente se ci sono più ID+testo concatenati
        // Pattern: testo leggibileID_TECNICO_QUIaltro testo
        let sub_parts = split_on_id_boundaries(cleaned);
        
        for sp in sub_parts {
            let trimmed = sp.trim();
            if !trimmed.is_empty() {
                results.push(trimmed.to_string());
            }
        }
    }
    
    if results.is_empty() {
        results.push(s.to_string());
    }
    
    results
}

/// Rimuove prefisso ID tecnico da una stringa.
/// "GD_CH00_D13_L02_GAThanks to The Sun." → "Thanks to The Sun."
/// "IT_TO_BOLDCUTTERSBolt cutters" → "Bolt cutters"
fn strip_id_prefix(s: &str) -> &str {
    let bytes = s.as_bytes();
    let mut i = 0;
    let mut has_underscore = false;
    
    // Scansiona il prefisso: [A-Z0-9_]+
    while i < bytes.len() {
        let c = bytes[i] as char;
        if c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_' {
            if c == '_' { has_underscore = true; }
            i += 1;
        } else {
            break;
        }
    }
    
    // Se abbiamo trovato un prefisso di almeno 4 chars con almeno un underscore
    // e il char successivo è una lettera maiuscola seguita da minuscola (inizio parola)
    if i >= 4 && has_underscore && i < bytes.len() {
        // Il prefisso potrebbe finire con lettere che fanno parte della parola successiva
        // Es: "GAThanks" → "GA" è fine ID, "Thanks" è inizio testo
        // Torna indietro finché troviamo la transizione uppercase→lowercase
        let mut j = i;
        while j > 0 && (bytes[j-1] as char).is_ascii_uppercase() {
            j -= 1;
        }
        // j ora punta all'inizio della sequenza di uppercase alla fine del prefisso
        // Se c'è almeno una uppercase prima di lowercase, quella è l'inizio della parola
        if j < i && j > 2 {
            return &s[j..];
        }
        return &s[i..];
    }
    
    s
}

/// Splitta una stringa dove un ID tecnico appare nel mezzo del testo.
/// "Bolt cuttersIT_TO_THANDLEWRENCH" → ["Bolt cutters"]
/// "NearUI_SETTINGS_FOOBar" → ["Near", "Bar"]
fn split_on_id_boundaries(s: &str) -> Vec<String> {
    let mut results = Vec::new();
    let chars: Vec<char> = s.chars().collect();
    let mut segment_start = 0;
    let mut i = 0;
    
    while i < chars.len() {
        // Cerca inizio di un potenziale ID nel mezzo: [A-Z][A-Z0-9_]{3,}
        if i > 0 && chars[i].is_ascii_uppercase() {
            let id_start = i;
            let mut j = i;
            let mut underscores = 0;
            while j < chars.len() && (chars[j].is_ascii_uppercase() || chars[j].is_ascii_digit() || chars[j] == '_') {
                if chars[j] == '_' { underscores += 1; }
                j += 1;
            }
            let id_len = j - id_start;
            
            // È un ID se ha 4+ chars E almeno un underscore
            if id_len >= 4 && underscores >= 1 {
                // Salva il testo prima dell'ID
                if id_start > segment_start {
                    let pre = &s[segment_start..id_start];
                    let trimmed = pre.trim();
                    if !trimmed.is_empty() {
                        results.push(trimmed.to_string());
                    }
                }
                
                // Controlla se dopo l'ID c'è testo (uppercase+lowercase = inizio parola)
                if j < chars.len() && chars[j].is_ascii_lowercase() && j > id_start + 1 {
                    // L'ultima uppercase fa parte della parola
                    let mut word_start = j - 1;
                    while word_start > id_start && chars[word_start].is_ascii_uppercase() {
                        word_start -= 1;
                    }
                    word_start += 1; // prima uppercase della parola
                    segment_start = word_start;
                } else {
                    segment_start = j;
                }
                i = j;
                continue;
            }
        }
        i += 1;
    }
    
    // Aggiungi il segmento finale
    if segment_start < s.len() {
        let rest = s[segment_start..].trim();
        if !rest.is_empty() {
            results.push(rest.to_string());
        }
    }
    
    if results.is_empty() && !s.trim().is_empty() {
        results.push(s.to_string());
    }
    
    results
}

// ═══════════════════════════════════════════════════════════════════
// UCAS READER (with decompression)
// ═══════════════════════════════════════════════════════════════════

fn extract_file_from_ucas(
    ucas_path: &Path,
    toc_entry_index: usize,
    offset_lengths: &[IoOffsetAndLength],
    compressed_blocks: &[CompressedBlockEntry],
    compression_methods: &[String],
    block_size: u32,
    oodle: &Option<OodleLib>,
) -> Result<Vec<u8>, String> {
    if toc_entry_index >= offset_lengths.len() {
        return Err(format!("TocEntry index {} fuori range ({})", toc_entry_index, offset_lengths.len()));
    }
    
    let oal = &offset_lengths[toc_entry_index];
    let file_offset = oal.offset;
    let file_length = oal.length;
    
    log::info!("📦 Estrazione file: offset={}, length={}", file_offset, file_length);
    
    // Trova i compressed blocks che contengono i dati di questo file
    let bs = block_size as u64;
    let first_block = (file_offset / bs) as usize;
    let last_block = ((file_offset + file_length - 1) / bs) as usize;
    
    let mut output = Vec::with_capacity(file_length as usize);
    
    // Apri il file UCAS con seek (NON caricare tutto in RAM — può essere 14GB+)
    use std::io::{Read, Seek, SeekFrom};
    let mut ucas_file = std::fs::File::open(ucas_path)
        .map_err(|e| format!("Errore apertura UCAS: {}", e))?;
    
    for block_idx in first_block..=last_block {
        if block_idx >= compressed_blocks.len() {
            return Err(format!("Block index {} fuori range ({})", block_idx, compressed_blocks.len()));
        }
        
        let block = &compressed_blocks[block_idx];
        let block_offset = block.offset;
        let comp_size = block.compressed_size as usize;
        let uncomp_size = block.uncompressed_size as usize;
        
        // Seek alla posizione del blocco e leggi solo i dati compressi
        ucas_file.seek(SeekFrom::Start(block_offset))
            .map_err(|e| format!("Seek UCAS failed @{}: {}", block_offset, e))?;
        
        let mut compressed_data = vec![0u8; comp_size];
        ucas_file.read_exact(&mut compressed_data)
            .map_err(|e| format!("Read UCAS block failed @{} ({}b): {}", block_offset, comp_size, e))?;
        
        let decompressed = if block.compression_method_index == 0 || comp_size == uncomp_size {
            // Non compresso
            compressed_data.to_vec()
        } else {
            // Determina metodo di compressione
            let method_idx = (block.compression_method_index - 1) as usize;
            let method_name = if method_idx < compression_methods.len() {
                &compression_methods[method_idx]
            } else {
                "Unknown"
            };
            
            match method_name.to_lowercase().as_str() {
                "zlib" => {
                    use std::io::Read;
                    let mut decoder = flate2::read::ZlibDecoder::new(&compressed_data[..]);
                    let mut buf = Vec::with_capacity(uncomp_size);
                    decoder.read_to_end(&mut buf)
                        .map_err(|e| format!("Zlib decompression failed: {}", e))?;
                    buf
                }
                "lz4" => {
                    lz4_flex::decompress(&compressed_data, uncomp_size)
                        .map_err(|e| format!("LZ4 decompression failed: {}", e))?
                }
                name if name.contains("oodle") || name == "mermaid" || name == "kraken" || name == "leviathan" || name == "selkie" => {
                    match oodle {
                        Some(lib) => lib.decompress(&compressed_data, uncomp_size)?,
                        None => return Err(format!(
                            "Compressione {} richiede Oodle DLL (oo2core_9_win64.dll). Non trovata sul sistema.",
                            method_name
                        )),
                    }
                }
                _ => {
                    return Err(format!("Metodo compressione non supportato: {}", method_name));
                }
            }
        };
        
        output.extend_from_slice(&decompressed);
    }
    
    // Trim to actual file length (remove padding from last block)
    let start_in_first_block = (file_offset % bs) as usize;
    let actual_length = file_length as usize;
    
    if start_in_first_block > 0 || output.len() > actual_length {
        let end = start_in_first_block + actual_length;
        if end <= output.len() {
            output = output[start_in_first_block..end].to_vec();
        }
    }
    
    Ok(output)
}

// ═══════════════════════════════════════════════════════════════════
// FILESYSTEM HELPERS
// ═══════════════════════════════════════════════════════════════════

/// Trova file .utoc nella directory del gioco
fn find_utoc_files(game_path: &Path) -> Vec<PathBuf> {
    let mut utocs = Vec::new();
    
    if let Ok(entries) = fs::read_dir(game_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // Cerca in sottodirectory/Content/Paks
                let paks = path.join("Content").join("Paks");
                if paks.exists() {
                    if let Ok(paks_entries) = fs::read_dir(&paks) {
                        for pe in paks_entries.flatten() {
                            if pe.path().extension().map(|e| e == "utoc").unwrap_or(false) {
                                utocs.push(pe.path());
                            }
                        }
                    }
                }
            }
        }
    }
    
    utocs
}

// ═══════════════════════════════════════════════════════════════════
// TAURI COMMANDS
// ═══════════════════════════════════════════════════════════════════

/// Estrae stringhe di localizzazione da un container IoStore (UTOC/UCAS)
#[tauri::command]
pub async fn extract_iostore_localization(game_path: String) -> Result<ExtractionResult, String> {
    let game_dir = Path::new(&game_path);
    
    if !game_dir.exists() {
        return Err(format!("Directory non trovata: {}", game_path));
    }
    
    log::info!("🔍 IoStore extraction da: {}", game_path);
    
    // Trova file .utoc
    let utoc_files = find_utoc_files(game_dir);
    if utoc_files.is_empty() {
        return Err("Nessun file .utoc trovato".into());
    }
    
    // Carica Oodle
    let oodle = match OodleLib::load() {
        Ok(lib) => {
            log::info!("✅ Oodle caricata con successo");
            Some(lib)
        }
        Err(e) => {
            log::warn!("⚠️ Oodle non disponibile: {}", e);
            None
        }
    };
    
    // Contesto per fallback .uasset DataTable
    struct LocAssetCtx {
        file: IoStoreFile,
        utoc_idx: usize,
    }
    let mut loc_asset_contexts: Vec<LocAssetCtx> = Vec::new();
    let mut utoc_contexts: Vec<(
        PathBuf, // ucas_path
        UtocHeader,
        Vec<IoOffsetAndLength>,
        Vec<CompressedBlockEntry>,
        Vec<String>, // compression_methods
        Vec<u8>,     // raw utoc_data (for ChunkID reading)
    )> = Vec::new();
    
    for utoc_path in &utoc_files {
        let utoc_name = utoc_path.file_name().unwrap_or_default().to_string_lossy();
        log::info!("📦 Analisi UTOC: {}", utoc_path.display());
        
        // Corrispondente .ucas
        let ucas_path = utoc_path.with_extension("ucas");
        if !ucas_path.exists() {
            log::warn!("⚠️ UCAS non trovato: {}", ucas_path.display());
            continue;
        }
        
        // Leggi e parsa UTOC (errori singoli non bloccano il loop)
        let utoc_data = match fs::read(utoc_path) {
            Ok(d) => d,
            Err(e) => {
                log::warn!("⚠️ Errore lettura UTOC {}: {}", utoc_name, e);
                continue;
            }
        };
        
        let header = match parse_utoc_header(&utoc_data) {
            Ok(h) => h,
            Err(e) => {
                log::warn!("⚠️ Header invalido in {}: {}", utoc_name, e);
                continue;
            }
        };
        let (offset_lengths, compressed_blocks, compression_methods, files) = 
            match parse_utoc_data(&utoc_data, &header) {
                Ok(r) => r,
                Err(e) => {
                    log::warn!("⚠️ Errore parsing dati {}: {}", utoc_name, e);
                    continue;
                }
            };
        
        // Cerca file .locres
        let locres_files: Vec<&IoStoreFile> = files.iter()
            .filter(|f| f.path.ends_with(".locres"))
            .collect();
        
        if locres_files.is_empty() {
            // Cerca .uasset di localizzazione come fallback
            let loc_assets: Vec<_> = files.iter()
                .filter(|f| {
                    let p = f.path.to_lowercase();
                    (p.contains("localization") || p.contains("localiz"))
                        && f.path.ends_with(".uasset")
                })
                .collect();
            if !loc_assets.is_empty() {
                log::info!("📦 {} .uasset di localizzazione trovati in {} (no .locres)", loc_assets.len(), utoc_name);
                let ctx_idx = utoc_contexts.len();
                utoc_contexts.push((ucas_path.clone(), header, offset_lengths, compressed_blocks, compression_methods, utoc_data));
                for a in &loc_assets {
                    loc_asset_contexts.push(LocAssetCtx {
                        file: (*a).clone(),
                        utoc_idx: ctx_idx,
                    });
                }
            } else {
                log::info!("📦 Nessun .locres né .uasset localization in {}", utoc_name);
            }
            continue;
        }
        
        log::info!("📝 Trovati {} file .locres", locres_files.len());
        for f in &locres_files {
            log::info!("  📄 {} (entry {})", f.path, f.toc_entry_index);
        }
        
        // Preferisci la versione English del gioco (non engine)
        let target = locres_files.iter()
            .find(|f| {
                let p = f.path.to_lowercase();
                (p.contains("/en/") || p.contains("\\en\\")) && !p.contains("engine")
            })
            .or_else(|| locres_files.iter().find(|f| {
                let p = f.path.to_lowercase();
                p.contains("/en/") || p.contains("\\en\\")
            }))
            .unwrap_or(&locres_files[0]);
        
        log::info!("📝 Estrazione: {}", target.path);
        
        // Estrai il file dal UCAS
        let locres_data = extract_file_from_ucas(
            &ucas_path,
            target.toc_entry_index as usize,
            &offset_lengths,
            &compressed_blocks,
            &compression_methods,
            header.compression_block_size,
            &oodle,
        )?;
        
        log::info!("📝 Dati .locres estratti: {} bytes", locres_data.len());
        
        // Parsa il .locres
        let (version, entries) = super::unreal_localization::parse_locres_pub(&locres_data)?;
        let count = entries.len();
        
        return Ok(ExtractionResult {
            success: true,
            entries,
            source_file: utoc_path.to_string_lossy().to_string(),
            pak_version: 0,
            locres_path: target.path.clone(),
            message: format!(
                "Estratte {} stringhe da IoStore {} (LocRes v{})",
                count, utoc_name, version
            ),
        });
    }
    
    // Fallback: estrai stringhe dai .uasset di localizzazione
    if !loc_asset_contexts.is_empty() {
        log::info!("📦 Fallback .uasset: analisi {} file di localizzazione", loc_asset_contexts.len());
        
        let mut stringtable_entries = Vec::new();
        let mut ftext_entries = Vec::new();
        let mut heuristic_entries = Vec::new();
        let mut extract_err_count = 0u32;
        let mut seen_st = std::collections::HashSet::new();
        let mut seen_ftext = std::collections::HashSet::new();
        
        let mut chunk_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        
        for ctx in &loc_asset_contexts {
            let (ref ucas_path, ref hdr, ref offsets, ref blocks, ref methods, ref utoc_raw) = utoc_contexts[ctx.utoc_idx];
            
            // Leggi ChunkID (12 bytes) dal raw UTOC
            let chunk_id_offset = hdr.header_size as usize + ctx.file.toc_entry_index as usize * 12;
            if chunk_id_offset + 12 <= utoc_raw.len() {
                let chunk_id_hex = utoc_raw[chunk_id_offset..chunk_id_offset + 12]
                    .iter().map(|b| format!("{:02x}", b)).collect::<String>();
                let safe_name = ctx.file.path.replace('/', "_").replace('\\', "_");
                chunk_map.insert(safe_name, chunk_id_hex.clone());
                log::info!("🔑 ChunkID per {}: {}", ctx.file.path, chunk_id_hex);
            }
            
            log::info!("📦 Estrazione .uasset: {} (entry {})", ctx.file.path, ctx.file.toc_entry_index);
            
            match extract_file_from_ucas(
                ucas_path,
                ctx.file.toc_entry_index as usize,
                offsets,
                blocks,
                methods,
                hdr.compression_block_size,
                &oodle,
            ) {
                Ok(uasset_data) => {
                    // 0) Prova StringTable parser (namespace/key/value reali per .locres)
                    let st_entries = scan_stringtable_entries(&uasset_data);
                    if !st_entries.is_empty() {
                        log::info!("📋 StringTable: {} entry trovate in {}", st_entries.len(), ctx.file.path);
                        for (idx, (ns, key, val)) in st_entries.iter().enumerate().take(3) {
                            log::info!("  📋 [{}] ns=\"{}\" key=\"{}\" val=\"{}\"", idx, ns, key,
                                &val[..std::cmp::min(60, val.len())]);
                        }
                        for (ns, key, val) in st_entries {
                            let dedup_key = format!("{}::{}", ns, key);
                            if !seen_st.contains(&dedup_key) && val.len() >= 1 {
                                seen_st.insert(dedup_key);
                                stringtable_entries.push(super::unreal_localization::LocEntry {
                                    namespace: ns,
                                    key,
                                    source_hash: 0,
                                    value: val,
                                });
                            }
                        }
                    }
                    
                    // 1) Prova FText scanner (namespace/key reali per .locres)
                    let ftexts = scan_ftext_entries(&uasset_data);
                    if !ftexts.is_empty() {
                        log::info!("✨ FText: {} entry trovate in {}", ftexts.len(), ctx.file.path);
                        for (ns, key, src) in &ftexts {
                            log::debug!("  FText: ns={} key={} src={}", ns, key, &src[..std::cmp::min(60, src.len())]);
                        }
                        // Log primi 3 per debug
                        for (idx, (ns, key, src)) in ftexts.iter().enumerate().take(3) {
                            log::info!("  📝 [{}] ns=\"{}\" key=\"{}\" text=\"{}\"", idx, ns, key, 
                                &src[..std::cmp::min(80, src.len())]);
                        }
                        
                        for (ns, key, src) in ftexts {
                            let dedup_key = format!("{}::{}", ns, key);
                            if !seen_ftext.contains(&dedup_key) && src.len() >= 2 {
                                seen_ftext.insert(dedup_key);
                                ftext_entries.push(super::unreal_localization::LocEntry {
                                    namespace: ns,
                                    key,
                                    source_hash: 0,
                                    value: src,
                                });
                            }
                        }
                    }
                    
                    // 2) Fallback: scan euristico FString (per binary patching)
                    let source = &ctx.file.path;
                    let strings = scan_uasset_strings(&uasset_data, source);
                    log::info!("📦 Heuristic: {} stringhe leggibili in {}", strings.len(), ctx.file.path);
                    
                    // Cache .uasset raw (serve per binary patching se FText non funziona)
                    let cache_dir = game_dir.join("GameStringer").join("uasset_cache");
                    let _ = fs::create_dir_all(&cache_dir);
                    let safe_name = ctx.file.path.replace('/', "_").replace('\\', "_");
                    let cache_path = cache_dir.join(&safe_name);
                    let _ = fs::write(&cache_path, &uasset_data);
                    
                    heuristic_entries.extend(strings);
                }
                Err(e) => {
                    log::warn!("⚠️ Errore estrazione {}: {}", ctx.file.path, e);
                    extract_err_count += 1;
                }
            }
        }
        
        // Salva chunk_map.json con metadata UTOC per IoStore writer
        if !chunk_map.is_empty() {
            let cache_dir = game_dir.join("GameStringer").join("uasset_cache");
            let _ = fs::create_dir_all(&cache_dir);
            let map_path = cache_dir.join("chunk_map.json");
            
            // Prendi metadata dal primo UTOC context
            let (utoc_ver, hdr_size, blk_size, cont_id) = if let Some((_, ref h, _, _, _, _)) = utoc_contexts.first() {
                (h.version as u32, h.header_size, h.compression_block_size, h.container_id)
            } else {
                (3u32, 144u32, 65536u32, 0u64)
            };
            
            let mut meta_map = serde_json::Map::new();
            meta_map.insert("utoc_version".into(), serde_json::Value::Number(utoc_ver.into()));
            meta_map.insert("header_size".into(), serde_json::Value::Number(hdr_size.into()));
            meta_map.insert("block_size".into(), serde_json::Value::Number(blk_size.into()));
            meta_map.insert("container_id".into(), serde_json::Value::Number(cont_id.into()));
            
            let mut root = serde_json::Map::new();
            root.insert("__meta".into(), serde_json::Value::Object(meta_map));
            for (k, v) in &chunk_map {
                root.insert(k.clone(), serde_json::Value::String(v.clone()));
            }
            
            match serde_json::to_string_pretty(&serde_json::Value::Object(root)) {
                Ok(json) => {
                    let _ = fs::write(&map_path, &json);
                    log::info!("💾 Chunk map salvato: {} ({} file, UTOC v{}, block={})", 
                        map_path.display(), chunk_map.len(), utoc_ver, blk_size);
                }
                Err(e) => log::warn!("⚠️ Errore serializzazione chunk_map: {}", e),
            }
        }
        
        // PRIORITÀ 1: StringTable entries (namespace/key/value reali dal parser StringTable)
        if !stringtable_entries.is_empty() {
            let count = stringtable_entries.len();
            log::info!("📋 Usando {} entry StringTable per .locres (nessun vincolo dimensione)", count);
            return Ok(ExtractionResult {
                success: true,
                entries: stringtable_entries,
                source_file: "IoStore DataTable".to_string(),
                pak_version: 0,
                locres_path: "StringTable .locres".to_string(),
                message: format!(
                    "Estratte {} stringhe StringTable da {} .uasset (con namespace/key per .locres)",
                    count, loc_asset_contexts.len()
                ),
            });
        }
        
        // PRIORITÀ 2: FText entries (namespace/key reali per .locres)
        if !ftext_entries.is_empty() {
            let count = ftext_entries.len();
            log::info!("✨ Usando {} entry FText per .locres (nessun vincolo dimensione, {} euristiche scartate)", 
                count, heuristic_entries.len());
            return Ok(ExtractionResult {
                success: true,
                entries: ftext_entries,
                source_file: "IoStore DataTable".to_string(),
                pak_version: 0,
                locres_path: "FText .locres".to_string(),
                message: format!(
                    "Estratte {} stringhe FText da {} .uasset (con namespace/key per .locres)",
                    count, loc_asset_contexts.len()
                ),
            });
        }
        
        // PRIORITÀ 3: heuristic entries → IoStore binary patching (vincolo same-size)
        if !heuristic_entries.is_empty() {
            let count = heuristic_entries.len();
            log::info!("📦 Fallback: usando {} entry euristiche (binary patching, no FText)", count);
            return Ok(ExtractionResult {
                success: true,
                entries: heuristic_entries,
                source_file: "IoStore DataTable".to_string(),
                pak_version: 0,
                locres_path: "DataTable .uasset".to_string(),
                message: format!(
                    "Estratte {} stringhe da {} .uasset DataTable (no .locres, no FText)",
                    count, loc_asset_contexts.len()
                ),
            });
        }
        
        Err(format!(
            "Trovati {} .uasset localizzazione, {} errori estrazione",
            loc_asset_contexts.len(), extract_err_count
        ))
    } else {
        Err("Nessun file .locres trovato nei container IoStore".into())
    }
}

// ═══════════════════════════════════════════════════════════════════
// BINARY PATCHING for DataTable .uasset
// ═══════════════════════════════════════════════════════════════════

/// Cerca SerialSize + SerialOffset nell'export table del .uasset.
/// Restituisce (offset_del_campo_serial_size, serial_size, serial_offset).
fn find_serial_size_in_header(data: &[u8]) -> Option<(usize, i64, i64)> {
    let file_size = data.len() as i64;
    // L'export table è nella prima metà del file (header area)
    let search_end = data.len() / 2;
    
    for i in 0..search_end.saturating_sub(16) {
        if i + 16 > data.len() { break; }
        let serial_size = i64::from_le_bytes([
            data[i], data[i+1], data[i+2], data[i+3],
            data[i+4], data[i+5], data[i+6], data[i+7],
        ]);
        let serial_offset = i64::from_le_bytes([
            data[i+8], data[i+9], data[i+10], data[i+11],
            data[i+12], data[i+13], data[i+14], data[i+15],
        ]);
        
        // SerialOffset = header size (dove iniziano i dati export)
        // SerialSize + SerialOffset == file_size
        if serial_offset > 100 && serial_offset < file_size / 2
            && serial_size > 0 && serial_size < file_size
            && serial_size + serial_offset == file_size
        {
            return Some((i, serial_size, serial_offset));
        }
    }
    None
}

/// Trova TotalHeaderSize dal header UAsset per sapere dove inizia la sezione dati.
/// Il Name Map, Import/Export tables etc. sono PRIMA di TotalHeaderSize e NON devono
/// essere patchati — contengono nomi di classi, proprietà, path degli asset.
fn find_uasset_data_offset(data: &[u8]) -> usize {
    if data.len() < 28 { return 0; }
    
    // Tag UAsset: 0x9E2A83C1 (little-endian)
    let tag = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
    if tag != 0x9E2A83C1 {
        log::warn!("⚠️ UAsset magic non trovato, patching intero file");
        return 0;
    }
    
    let legacy_ver = i32::from_le_bytes([data[4], data[5], data[6], data[7]]);
    let mut off = 8usize;
    
    // LegacyUE3Version (sempre presente tranne -4, ma in pratica sempre c'è)
    if legacy_ver != -4 { off += 4; }
    
    // FileVersionUE4
    off += 4;
    
    // FileVersionUE5 (solo se LegacyFileVersion <= -8, cioè UE5+)
    if legacy_ver <= -8 { off += 4; }
    
    // FileVersionLicenseeUE
    off += 4;
    
    // CustomVersions: count (i32) + entries (20 bytes each: 16 GUID + 4 version)
    if off + 4 > data.len() { return 0; }
    let cv_count = i32::from_le_bytes([data[off], data[off+1], data[off+2], data[off+3]]);
    off += 4;
    if cv_count > 0 && cv_count < 500 {
        off += (cv_count as usize) * 20;
    }
    
    // TotalHeaderSize (i32)
    if off + 4 > data.len() { return 0; }
    let total_header_size = i32::from_le_bytes([data[off], data[off+1], data[off+2], data[off+3]]);
    
    if total_header_size > 0 && (total_header_size as usize) <= data.len() {
        log::info!("📐 UAsset header size: {} bytes (data starts at offset {}), LegacyVer={}, CustomVersions={}", 
            total_header_size, total_header_size, legacy_ver, cv_count);
        total_header_size as usize
    } else {
        log::warn!("⚠️ TotalHeaderSize invalido: {}, patching intero file", total_header_size);
        0
    }
}

/// Patcha un .uasset binario sostituendo le FString originali con le traduzioni.
/// SICUREZZA: salta l'header UAsset (Name Map, Import/Export tables) per evitare
/// di corrompere i dati strutturali. Patcha SOLO la sezione dati serializzati.
/// Le FString vengono sostituite con la lunghezza corretta (length prefix aggiornato).
/// La dimensione del file può cambiare — il container IoStore registrerà la nuova size.
/// Dopo il patching, aggiorna SerialSize nell'export table per riflettere la nuova dimensione.
fn patch_uasset_binary(data: &[u8], replacements: &std::collections::HashMap<String, String>) -> Vec<u8> {
    let mut result = Vec::with_capacity(data.len() + data.len() / 4);
    let mut patch_count = 0u32;
    let mut grown_count = 0u32;
    
    // Trova dove inizia la sezione dati (dopo header strutturale)
    let data_offset = find_uasset_data_offset(data);
    
    // Copia header verbatim (Name Map, Import/Export tables, etc.)
    result.extend_from_slice(&data[..data_offset]);
    
    let mut i = data_offset;
    
    while i < data.len() {
        if i + 4 < data.len() {
            let len = i32::from_le_bytes([data[i], data[i+1], data[i+2], data[i+3]]);
            
            // FString valida: lunghezza ragionevole (min 3 chars)
            if len >= 3 && len <= 2000 {
                let str_start = i + 4;
                let str_end = str_start + (len as usize);
                
                if str_end <= data.len() && data[str_end - 1] == 0 {
                    let text_bytes = &data[str_start..str_end - 1];
                    
                    if let Ok(text) = std::str::from_utf8(text_bytes) {
                        let trimmed = text.trim();
                        
                        // Salta stringhe che sembrano path/classi/proprietà UE
                        let is_structural = trimmed.contains('/')
                            || trimmed.contains('\\')
                            || trimmed.contains("::")
                            || trimmed.starts_with('/');
                        
                        if !is_structural {
                            // Match diretto (testo identico)
                            if let Some(translated) = replacements.get(trimmed) {
                                let new_bytes = translated.as_bytes();
                                let new_len = (new_bytes.len() + 1) as i32; // +1 per null terminator
                                
                                if new_bytes.len() > text_bytes.len() {
                                    grown_count += 1;
                                }
                                
                                // Scrivi nuovo length prefix e nuova stringa
                                result.extend_from_slice(&new_len.to_le_bytes());
                                result.extend_from_slice(new_bytes);
                                result.push(0); // null terminator
                                
                                i = str_end;
                                patch_count += 1;
                                continue;
                            }
                        }
                    }
                }
            }
        }
        
        result.push(data[i]);
        i += 1;
    }
    
    let size_delta = result.len() as i64 - data.len() as i64;
    
    // Aggiorna SerialSize nell'export table se la dimensione è cambiata.
    // IMPORTANTE: cerchiamo nei dati ORIGINALI dove serial_size + serial_offset == data.len(),
    // poi aggiorniamo il campo alla stessa posizione nel result (l'header è copiato verbatim).
    if size_delta != 0 {
        if let Some((ss_offset, old_serial_size, _serial_offset)) = find_serial_size_in_header(data) {
            let new_serial_size = old_serial_size + size_delta;
            if new_serial_size > 0 && ss_offset + 8 <= result.len() {
                let new_ss_bytes = new_serial_size.to_le_bytes();
                result[ss_offset..ss_offset + 8].copy_from_slice(&new_ss_bytes);
                log::info!("📐 SerialSize aggiornata: {} → {} (delta={}, offset_field={})", 
                    old_serial_size, new_serial_size, size_delta, ss_offset);
            }
        } else {
            log::warn!("⚠️ SerialSize non trovata nell'header — il file potrebbe non funzionare (delta={})", size_delta);
        }
    }
    
    if grown_count > 0 {
        log::info!("📏 {} stringhe cresciute (traduzione più lunga dell'originale), delta totale: {} bytes", 
            grown_count, size_delta);
    }
    log::info!("🔧 Patchate {} stringhe (sezione dati, offset {}+), size: {} → {} bytes (delta={})", 
        patch_count, data_offset, data.len(), result.len(), size_delta);
    
    result
}

// ═══════════════════════════════════════════════════════════════════
// CITYHASH64 (per ContainerId UE5)
// ═══════════════════════════════════════════════════════════════════

/// CityHash64 (Google, v1.0.3) — usato da UE5 per calcolare FIoContainerId.
/// Input: raw bytes del nome container come UTF-16LE.
fn city_hash_64(data: &[u8]) -> u64 {
    const K0: u64 = 0xc3a5c85c97cb3127;
    const K1: u64 = 0xb492b66fbe98f273;
    const K2: u64 = 0x9ae16a3b2f90404f;

    #[inline] fn f64(s: &[u8], i: usize) -> u64 { u64::from_le_bytes(s[i..i+8].try_into().unwrap()) }
    #[inline] fn f32(s: &[u8], i: usize) -> u64 { u32::from_le_bytes(s[i..i+4].try_into().unwrap()) as u64 }
    #[inline] fn rot(v: u64, s: u32) -> u64 { if s == 0 { v } else { (v >> s) | (v << (64 - s)) } }
    #[inline] fn smix(v: u64) -> u64 { v ^ (v >> 47) }
    #[inline] fn h16(u: u64, v: u64, mul: u64) -> u64 {
        let a = (u ^ v).wrapping_mul(mul); let a = a ^ (a >> 47);
        let b = (v ^ a).wrapping_mul(mul); let b = b ^ (b >> 47);
        b.wrapping_mul(mul)
    }

    let n = data.len();
    if n <= 16 {
        if n >= 8 {
            let mul = K2.wrapping_add((n as u64) * 2);
            let a = f64(data, 0).wrapping_add(K2);
            let b = f64(data, n - 8);
            return h16(rot(b, 37).wrapping_mul(mul).wrapping_add(a),
                       (rot(a, 25).wrapping_add(b)).wrapping_mul(mul), mul);
        }
        if n >= 4 {
            let mul = K2.wrapping_add((n as u64) * 2);
            return h16((n as u64).wrapping_add(f32(data, 0) << 3), f32(data, n - 4), mul);
        }
        if n > 0 {
            let y = (data[0] as u64).wrapping_add((data[n >> 1] as u64) << 8);
            let z = (n as u64).wrapping_add((data[n - 1] as u64) << 2);
            return smix(y.wrapping_mul(K2) ^ z.wrapping_mul(K0)).wrapping_mul(K2);
        }
        return K2;
    }
    if n <= 32 {
        let mul = K2.wrapping_add((n as u64) * 2);
        let a = f64(data, 0).wrapping_mul(K1);
        let b = f64(data, 8);
        let c = f64(data, n - 8).wrapping_mul(mul);
        let d = f64(data, n - 16).wrapping_mul(K2);
        return h16(rot(a.wrapping_add(b), 43).wrapping_add(rot(c, 30)).wrapping_add(d),
                   a.wrapping_add(rot(b.wrapping_add(K2), 18)).wrapping_add(c), mul);
    }
    if n <= 64 {
        let mul = K2.wrapping_add((n as u64) * 2);
        let a = f64(data, 0).wrapping_mul(K2);
        let b = f64(data, 8);
        let c = f64(data, n - 24);
        let d = f64(data, n - 32);
        let e = f64(data, 16).wrapping_mul(K2);
        let f = f64(data, 24).wrapping_mul(9);
        let g = f64(data, n - 8);
        let hh = f64(data, n - 16).wrapping_mul(mul);
        let u = rot(a.wrapping_add(g), 43).wrapping_add((rot(b, 30).wrapping_add(c)).wrapping_mul(9));
        let v = ((a.wrapping_add(g)) ^ d).wrapping_add(f).wrapping_add(1);
        let w = (u.wrapping_add(v)).wrapping_mul(mul).swap_bytes().wrapping_add(hh);
        let x = rot(e.wrapping_add(f), 42).wrapping_add(c);
        let y = ((v.wrapping_add(w)).wrapping_mul(mul).swap_bytes().wrapping_add(g)).wrapping_mul(mul);
        let z = e.wrapping_add(f).wrapping_add(c);
        let a2 = (x.wrapping_add(z)).wrapping_mul(mul).wrapping_add(y).swap_bytes().wrapping_add(b);
        let b2 = smix((z.wrapping_add(a2)).wrapping_mul(mul).wrapping_add(d).wrapping_add(hh)).wrapping_mul(mul);
        return b2.wrapping_add(x);
    }
    // >64 bytes: chunk-based (raro per nomi PAK)
    let mut x = f64(data, n - 40);
    let mut y = f64(data, n - 16).wrapping_add(f64(data, n - 56));
    let mut z = h16(f64(data, n - 48).wrapping_add(n as u64), f64(data, n - 24),
                    K2.wrapping_add((n as u64) * 2));
    // WeakHashLen32WithSeeds inlined for v,w
    fn weak32(s: &[u8], off: usize, mut a: u64, mut b: u64) -> (u64, u64) {
        let w = f64(s, off); let xx = f64(s, off+8);
        let yy = f64(s, off+16); let zz = f64(s, off+24);
        a = a.wrapping_add(w); b = rot(b.wrapping_add(a).wrapping_add(zz), 21);
        let c = a; a = a.wrapping_add(xx).wrapping_add(yy);
        b = b.wrapping_add(rot(a, 44)); (a.wrapping_add(zz), b.wrapping_add(c))
    }
    let mut v = weak32(data, n - 64, n as u64, z);
    let mut w = weak32(data, n - 32, y.wrapping_add(K1), x);
    x = x.wrapping_mul(K1).wrapping_add(f64(data, 0));
    let mut pos = 0;
    let chunks = (n - 1) / 64;
    for _ in 0..chunks {
        x = rot(x.wrapping_add(y).wrapping_add(v.0).wrapping_add(f64(data, pos + 8)), 37).wrapping_mul(K1);
        y = rot(y.wrapping_add(v.1).wrapping_add(f64(data, pos + 48)), 42).wrapping_mul(K1);
        x ^= w.1; y = y.wrapping_add(v.0).wrapping_add(f64(data, pos + 40));
        z = rot(z.wrapping_add(w.0), 33).wrapping_mul(K1);
        v = weak32(data, pos, v.1.wrapping_mul(K1), x.wrapping_add(w.0));
        w = weak32(data, pos + 32, z.wrapping_add(w.1), y.wrapping_add(f64(data, pos + 16)));
        std::mem::swap(&mut z, &mut x);
        pos += 64;
    }
    h16(h16(v.0, w.0, K2.wrapping_add((n as u64)*2)).wrapping_add(smix(y).wrapping_mul(K1)).wrapping_add(z),
        h16(v.1, w.1, K2.wrapping_add((n as u64)*2)).wrapping_add(x),
        K2.wrapping_add((n as u64)*2))
}

/// Calcola il ContainerId UE5 dal nome base del PAK (come UTF-16LE + CityHash64).
fn compute_container_id(base_name: &str) -> u64 {
    let utf16le: Vec<u8> = base_name.encode_utf16()
        .flat_map(|c| c.to_le_bytes())
        .collect();
    city_hash_64(&utf16le)
}

// ═══════════════════════════════════════════════════════════════════
// IOSTORE CONTAINER WRITER
// ═══════════════════════════════════════════════════════════════════

/// Crea un file .pak vuoto (0 entry) come companion per IoStore container.
/// UE5 scopre i container IoStore (.utoc/.ucas) solo se esiste un .pak con lo stesso basename.
/// Usa Version=8 nel footer per evitare il formato indice complesso v10+ (PathHashIndex ecc.)
/// che causa "Corrupt pak index" in alcuni build UE5.
/// Il footer ha comunque 221 bytes (stessa dimensione di v11) perché l'engine lo legge
/// sempre con il layout della versione più recente.
fn create_empty_pak_companion() -> Vec<u8> {
    use sha1::Digest;
    
    let mut pak = Vec::new();
    
    // === INDEX (v8 format: semplice MountPoint + NumEntries) ===
    // Mount point FString: i32 length (include null) + data
    let mount_point = b"../../../\0";
    pak.extend_from_slice(&(mount_point.len() as i32).to_le_bytes());
    pak.extend_from_slice(mount_point);
    // NumEntries: 0
    pak.extend_from_slice(&0i32.to_le_bytes());
    
    let index_size = pak.len() as u64; // 18 bytes
    
    // SHA1 of index data
    let index_hash: [u8; 20] = sha1::Sha1::digest(&pak).into();
    
    // === FOOTER (221 bytes, Version=8) ===
    // L'engine cerca il footer dalla fine del file con dimensione fissa 221.
    // EncryptionKeyGuid (16 zero bytes = no encryption)
    pak.extend_from_slice(&[0u8; 16]);
    // bEncryptedIndex: false
    pak.push(0u8);
    // Magic: 0x5A6F12E1
    pak.extend_from_slice(&0x5A6F12E1u32.to_le_bytes());
    // Version: 8 (evita il parser v10+ che richiede PathHashIndex/FullDirectoryIndex)
    pak.extend_from_slice(&8u32.to_le_bytes());
    // IndexOffset: 0
    pak.extend_from_slice(&0u64.to_le_bytes());
    // IndexSize
    pak.extend_from_slice(&index_size.to_le_bytes());
    // IndexHash (SHA1)
    pak.extend_from_slice(&index_hash);
    // CompressionMethods (v8+): 5 methods × 32 bytes, all zeros (= None)
    pak.extend_from_slice(&[0u8; 160]);
    
    log::info!("📦 PAK v8 companion creato: {} bytes (index={}, footer=221)", pak.len(), index_size);
    pak
}

/// Crea un container IoStore (.utoc + .ucas) con i file patchati.
/// I dati sono NON compressi per semplicità e compatibilità.
/// Restituisce (utoc_bytes, ucas_bytes).
fn create_iostore_container(
    entries: &[(&[u8; 12], &[u8])], // (chunk_id, file_data)
    utoc_version: u8,
    block_size: u32,
    original_header_size: u32,
    container_id: u64,
) -> (Vec<u8>, Vec<u8>) {
    let bs = block_size as u64;
    
    // === UCAS: concatena i dati dei file in blocchi ===
    let mut ucas = Vec::new();
    
    struct FileLayout {
        virtual_offset: u64,
        length: u64,
    }
    
    let mut file_layouts: Vec<FileLayout> = Vec::new();
    let mut block_entries: Vec<(u64, u32, u32)> = Vec::new(); // (ucas_offset, size, size)
    let mut current_block_index: u64 = 0;
    
    for (_, data) in entries {
        let file_virtual_offset = current_block_index * bs;
        let file_length = data.len() as u64;
        
        file_layouts.push(FileLayout {
            virtual_offset: file_virtual_offset,
            length: file_length,
        });
        
        if data.is_empty() {
            continue;
        }
        
        let mut remaining = data.len();
        let mut data_offset = 0;
        
        while remaining > 0 {
            let block_data_size = std::cmp::min(remaining, block_size as usize);
            let ucas_offset = ucas.len() as u64;
            
            ucas.extend_from_slice(&data[data_offset..data_offset + block_data_size]);
            
            block_entries.push((ucas_offset, block_data_size as u32, block_data_size as u32));
            
            data_offset += block_data_size;
            remaining -= block_data_size;
            current_block_index += 1;
        }
    }
    
    let _ucas_size = ucas.len() as u64;
    
    // === UTOC ===
    let entry_count = entries.len() as u32;
    let compressed_block_count = block_entries.len() as u32;
    
    // Usa header_size originale per compatibilità con versioni UTOC recenti (v6-v8)
    // I campi sconosciuti vengono paddati con zeri
    let header_size = if original_header_size >= 81 {
        original_header_size
    } else {
        let base: u32 = 16 + 1 + 3 + 4 * 9 + 8 + 16 + 1; // = 81
        match utoc_version {
            0..=3 => base,
            4 => base + 3 + 4 + 8,
            _ => base + 3 + 4 + 8 + 4,
        }
    };
    
    let mut utoc = Vec::with_capacity(header_size as usize + entries.len() * 22 + block_entries.len() * 12);
    
    // --- Header ---
    utoc.extend_from_slice(UTOC_MAGIC);
    utoc.push(utoc_version);
    utoc.extend_from_slice(&[0u8; 3]); // Reserved
    utoc.extend_from_slice(&header_size.to_le_bytes());
    utoc.extend_from_slice(&entry_count.to_le_bytes());
    utoc.extend_from_slice(&compressed_block_count.to_le_bytes());
    utoc.extend_from_slice(&12u32.to_le_bytes()); // CompressedBlockEntrySize
    utoc.extend_from_slice(&0u32.to_le_bytes()); // CompressionMethodNameCount = 0 (no compression)
    utoc.extend_from_slice(&32u32.to_le_bytes()); // CompressionMethodNameLength
    utoc.extend_from_slice(&block_size.to_le_bytes());
    utoc.extend_from_slice(&0u32.to_le_bytes()); // DirectoryIndexSize = 0
    utoc.extend_from_slice(&1u32.to_le_bytes()); // PartitionCount = 1
    utoc.extend_from_slice(&container_id.to_le_bytes()); // ContainerId = CityHash64 del basename
    utoc.extend_from_slice(&[0u8; 16]); // EncryptionKeyGuid = zeros
    utoc.push(0u8); // ContainerFlags = 0
    
    // v4+ extra fields
    if utoc_version >= 4 {
        utoc.extend_from_slice(&[0u8; 3]); // Alignment padding
        utoc.extend_from_slice(&0u32.to_le_bytes()); // PerfectHashSeedsCount = 0
        utoc.extend_from_slice(&(-1i64 as u64).to_le_bytes()); // PartitionSize[0] = -1 (unlimited, come originale)
    }
    if utoc_version >= 5 {
        utoc.extend_from_slice(&entry_count.to_le_bytes()); // ChunksWithoutPHCount = entry_count (no PH, use linear search)
    }
    
    // Verify header size
    if utoc.len() != header_size as usize {
        log::warn!("⚠️ UTOC header size mismatch: got {}, expected {}", utoc.len(), header_size);
        // Pad or truncate to match
        while utoc.len() < header_size as usize {
            utoc.push(0u8);
        }
        utoc.truncate(header_size as usize);
    }
    
    // --- ChunkIDs (12 bytes each) ---
    for (chunk_id, _) in entries {
        utoc.extend_from_slice(*chunk_id);
    }
    
    // --- OffsetAndLength (10 bytes each, 5+5 big-endian) ---
    for fl in &file_layouts {
        // 5 bytes offset (big-endian)
        utoc.push((fl.virtual_offset >> 32) as u8);
        utoc.push((fl.virtual_offset >> 24) as u8);
        utoc.push((fl.virtual_offset >> 16) as u8);
        utoc.push((fl.virtual_offset >> 8) as u8);
        utoc.push(fl.virtual_offset as u8);
        // 5 bytes length (big-endian)
        utoc.push((fl.length >> 32) as u8);
        utoc.push((fl.length >> 24) as u8);
        utoc.push((fl.length >> 16) as u8);
        utoc.push((fl.length >> 8) as u8);
        utoc.push(fl.length as u8);
    }
    
    // --- PerfectHashSeeds (0 entries) ---
    
    // --- ChunksWithoutPH (entry_count indices for linear search fallback) ---
    if utoc_version >= 5 {
        for i in 0..entry_count {
            utoc.extend_from_slice(&(i as u32).to_le_bytes());
        }
    }
    
    // --- CompressedBlockEntries (12 bytes each, little-endian) ---
    for (ucas_off, comp_sz, uncomp_sz) in &block_entries {
        // 5 bytes offset (little-endian)
        utoc.push(*ucas_off as u8);
        utoc.push((*ucas_off >> 8) as u8);
        utoc.push((*ucas_off >> 16) as u8);
        utoc.push((*ucas_off >> 24) as u8);
        utoc.push((*ucas_off >> 32) as u8);
        // 3 bytes compressed size (little-endian)
        utoc.push(*comp_sz as u8);
        utoc.push((*comp_sz >> 8) as u8);
        utoc.push((*comp_sz >> 16) as u8);
        // 3 bytes uncompressed size (little-endian)
        utoc.push(*uncomp_sz as u8);
        utoc.push((*uncomp_sz >> 8) as u8);
        utoc.push((*uncomp_sz >> 16) as u8);
        // 1 byte method_index = 0 (uncompressed)
        utoc.push(0u8);
    }
    
    // --- CompressionMethodNames (0 entries) ---
    // --- DirectoryIndex (0 bytes, no Indexed flag) ---
    
    // --- ChunkMetas (33 bytes each: 32-byte hash + 1-byte flags) ---
    // UE5 SEMPRE legge entry_count × sizeof(FIoStoreTocEntryMeta) dopo DirectoryIndex.
    // Senza questa sezione l'engine legge fuori range → crash AsyncLoading2.
    for _ in 0..entry_count {
        utoc.extend_from_slice(&[0u8; 32]); // ChunkHash = zeros (no integrity check)
        utoc.push(0u8); // Flags = None (data is uncompressed)
    }
    
    log::info!("📦 IoStore writer: UTOC {} bytes (hdr={}, metas={}×33), UCAS {} bytes, {} file, {} blocchi", 
        utoc.len(), header_size, entry_count, ucas.len(), entries.len(), block_entries.len());
    
    (utoc, ucas)
}

/// Applica traduzioni a DataTable .uasset (binary patching) e crea un container IoStore override (.utoc/.ucas)
#[tauri::command]
pub async fn apply_datatable_translation(
    game_path: String,
    translations: Vec<super::unreal_localization::TranslatedEntry>,
    target_language: String,
) -> Result<super::unreal_localization::TranslationPakResult, String> {
    let game_dir = Path::new(&game_path);
    let cache_dir = game_dir.join("GameStringer").join("uasset_cache");
    
    if !cache_dir.exists() {
        return Err("Cache .uasset non trovata. Rieseguire l'estrazione.".into());
    }
    
    log::info!("📝 DataTable IoStore patching: {} traduzioni per lingua {}", translations.len(), target_language);
    
    // Leggi chunk_map.json con ChunkID e metadata UTOC
    let map_path = cache_dir.join("chunk_map.json");
    let chunk_map_json: serde_json::Value = {
        let data = fs::read_to_string(&map_path)
            .map_err(|e| format!("chunk_map.json non trovato: {}. Rieseguire l'estrazione.", e))?;
        serde_json::from_str(&data)
            .map_err(|e| format!("chunk_map.json invalido: {}", e))?
    };
    
    // Estrai metadata
    let meta = chunk_map_json.get("__meta").and_then(|m| m.as_object());
    let utoc_version = meta.and_then(|m| m.get("utoc_version"))
        .and_then(|v| v.as_u64()).unwrap_or(3) as u8;
    let block_size = meta.and_then(|m| m.get("block_size"))
        .and_then(|v| v.as_u64()).unwrap_or(65536) as u32;
    let original_header_size = meta.and_then(|m| m.get("header_size"))
        .and_then(|v| v.as_u64()).unwrap_or(144) as u32;
    
    log::info!("📦 UTOC metadata: version={}, block_size={}, header_size={}", utoc_version, block_size, original_header_size);
    
    // Diagnostica: quante traduzioni sono effettivamente diverse dall'originale?
    let actually_translated = translations.iter()
        .filter(|t| t.original != t.translated)
        .count();
    log::info!("📊 Diagnostica: {}/{} traduzioni effettivamente diverse dall'originale", 
        actually_translated, translations.len());
    
    // Se nessuna traduzione è diversa, inietta marker di test "[IT] " per verificare override
    let inject_test_markers = actually_translated == 0;
    if inject_test_markers {
        log::warn!("⚠️ Nessuna traduzione reale! Inietto marker '[IT] ' per test IoStore override");
    }
    
    // Costruisci lookup: original → translated per tutte le traduzioni
    let mut translation_lookup: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for t in &translations {
        let translated = if inject_test_markers && t.original.len() >= 5 {
            format!("[IT] {}", t.original)
        } else {
            t.translated.clone()
        };
        translation_lookup.insert(t.original.trim().to_string(), translated);
    }
    
    log::info!("📦 {} traduzioni nel lookup, {} file nel chunk_map", 
        translation_lookup.len(), 
        chunk_map_json.as_object().map(|m| m.len().saturating_sub(1)).unwrap_or(0));
    
    // Per ogni file cached nel chunk_map, cerca stringhe originali nel .uasset e applica traduzioni
    let mut iostore_entries: Vec<([u8; 12], Vec<u8>)> = Vec::new();
    let mut total_patched = 0usize;
    let mut skipped_no_chunk = 0usize;
    
    let chunk_map_obj = chunk_map_json.as_object()
        .ok_or("chunk_map.json non è un oggetto JSON")?;
    
    for (file_key, chunk_id_val) in chunk_map_obj {
        // Skip metadata
        if file_key == "__meta" { continue; }
        
        let chunk_id_hex = match chunk_id_val.as_str() {
            Some(hex) => hex,
            None => continue,
        };
        
        let cache_path = cache_dir.join(file_key);
        if !cache_path.exists() {
            log::warn!("⚠️ Cache non trovata per {}", file_key);
            continue;
        }
        
        // Leggi il .uasset cached
        let uasset_data = match fs::read(&cache_path) {
            Ok(d) => d,
            Err(e) => {
                log::warn!("⚠️ Errore lettura cache {}: {}", file_key, e);
                continue;
            }
        };
        
        // Scansiona le FString nel .uasset e cerca match nella translation_lookup
        // Questo è O(n+m) — scansioniamo il binary una volta e facciamo lookup diretto nel HashMap
        let mut replacements: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let data_offset = find_uasset_data_offset(&uasset_data);
        
        {
            let mut scan_i = data_offset;
            while scan_i + 4 < uasset_data.len() {
                let len = i32::from_le_bytes([
                    uasset_data[scan_i], uasset_data[scan_i+1], 
                    uasset_data[scan_i+2], uasset_data[scan_i+3]
                ]);
                if len >= 3 && len <= 2000 {
                    let str_start = scan_i + 4;
                    let str_end = str_start + (len as usize);
                    if str_end <= uasset_data.len() && uasset_data[str_end - 1] == 0 {
                        if let Ok(text) = std::str::from_utf8(&uasset_data[str_start..str_end - 1]) {
                            let trimmed = text.trim();
                            if let Some(translated) = translation_lookup.get(trimmed) {
                                replacements.insert(trimmed.to_string(), translated.clone());
                            }
                        }
                        scan_i = str_end;
                        continue;
                    }
                }
                scan_i += 1;
            }
        }
        
        if replacements.is_empty() {
            continue;
        }
        
        // Decodifica ChunkID hex → bytes
        let chunk_id_bytes: Vec<u8> = (0..chunk_id_hex.len())
            .step_by(2)
            .filter_map(|i| u8::from_str_radix(&chunk_id_hex[i..i+2], 16).ok())
            .collect();
        
        if chunk_id_bytes.len() != 12 {
            log::warn!("⚠️ ChunkID invalido per {} (len={}): {}", file_key, chunk_id_bytes.len(), chunk_id_hex);
            skipped_no_chunk += 1;
            continue;
        }
        
        let mut chunk_id = [0u8; 12];
        chunk_id.copy_from_slice(&chunk_id_bytes);
        
        log::info!("🔧 Patching {} ({} stringhe, {} bytes, chunk={})", 
            file_key, replacements.len(), uasset_data.len(), chunk_id_hex);
        
        let patched = patch_uasset_binary(&uasset_data, &replacements);
        
        total_patched += replacements.len();
        iostore_entries.push((chunk_id, patched));
    }
    
    if iostore_entries.is_empty() {
        return Err(format!(
            "Nessun file patchato (skipped {} senza ChunkID)", skipped_no_chunk
        ));
    }
    
    log::info!("📦 Creazione IoStore container: {} file patchati, {} skippati", 
        iostore_entries.len(), skipped_no_chunk);
    
    // Crea il container IoStore
    let entries_ref: Vec<(&[u8; 12], &[u8])> = iostore_entries.iter()
        .map(|(id, data)| (id, data.as_slice()))
        .collect();
    
    // Calcola base_name e ContainerId PRIMA di creare il container
    let paks_dir = super::unreal_localization::find_paks_dir(game_dir)
        .ok_or("Directory Content/Paks non trovata")?;
    let project_name = super::unreal_localization::find_project_name(game_dir)
        .unwrap_or_else(|| "Game".to_string());
    let base_name = format!("{}_GameStringer_{}_P", project_name, target_language);
    
    let container_id = compute_container_id(&base_name);
    log::info!("📦 ContainerId per '{}': 0x{:016X}", base_name, container_id);
    
    let (utoc_data, ucas_data) = create_iostore_container(&entries_ref, utoc_version, block_size, original_header_size, container_id);
    
    let utoc_path = paks_dir.join(format!("{}.utoc", base_name));
    let ucas_path = paks_dir.join(format!("{}.ucas", base_name));
    
    // Crea companion .pak vuoto (UE5 scopre IoStore solo se esiste .pak con stesso basename)
    let pak_path = paks_dir.join(format!("{}.pak", base_name));
    let pak_data = create_empty_pak_companion();
    fs::write(&pak_path, &pak_data)
        .map_err(|e| format!("Errore scrittura PAK companion: {}", e))?;
    log::info!("� PAK companion creato: {} ({} bytes)", pak_path.display(), pak_data.len());
    
    fs::write(&utoc_path, &utoc_data)
        .map_err(|e| format!("Errore scrittura UTOC: {}", e))?;
    fs::write(&ucas_path, &ucas_data)
        .map_err(|e| format!("Errore scrittura UCAS: {}", e))?;
    
    log::info!("✅ IoStore override salvato: {}.utoc ({} bytes) + .ucas ({} bytes), {} file, {} stringhe", 
        base_name, utoc_data.len(), ucas_data.len(), iostore_entries.len(), total_patched);
    
    Ok(super::unreal_localization::TranslationPakResult {
        success: true,
        pak_path: utoc_path.to_string_lossy().to_string(),
        entries_count: total_patched,
        message: format!(
            "Creato IoStore {}.utoc/.ucas con {} traduzioni da {} DataTable ({})", 
            base_name, total_patched, iostore_entries.len(), target_language
        ),
    })
}
