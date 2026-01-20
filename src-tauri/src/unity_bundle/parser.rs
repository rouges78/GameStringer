//! Parser per Unity Asset Bundle (UnityFS format)
//! Supporta Unity 5.x - Unity 6.x

use std::io::{Read, Cursor, Seek, SeekFrom};
use std::fs::File;
use std::path::Path;
use byteorder::{BigEndian, LittleEndian, ReadBytesExt};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnityBundle {
    pub header: BundleHeader,
    pub blocks: Vec<StorageBlock>,
    pub nodes: Vec<Node>,
    pub assets: Vec<SerializedFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleHeader {
    pub signature: String,
    pub format_version: u32,
    pub unity_version: String,
    pub generator_version: String,
    pub file_size: u64,
    pub compressed_size: u32,
    pub uncompressed_size: u32,
    pub flags: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageBlock {
    pub compressed_size: u32,
    pub uncompressed_size: u32,
    pub flags: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub offset: u64,
    pub size: u64,
    pub flags: u32,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedFile {
    pub name: String,
    pub header: SerializedFileHeader,
    pub types: Vec<SerializedType>,
    pub objects: Vec<ObjectInfo>,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedFileHeader {
    pub metadata_size: u32,
    pub file_size: u64,
    pub version: u32,
    pub data_offset: u64,
    pub endianness: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedType {
    pub class_id: i32,
    pub is_stripped_type: bool,
    pub script_type_index: i16,
    pub type_hash: Vec<u8>,
    pub script_id_hash: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectInfo {
    pub path_id: i64,
    pub byte_start: u64,
    pub byte_size: u32,
    pub type_id: i32,
    pub class_id: i16,
    pub serialized_type_index: i16,
}

const COMPRESSION_NONE: u32 = 0;
const COMPRESSION_LZMA: u32 = 1;
const COMPRESSION_LZ4: u32 = 2;
const COMPRESSION_LZ4HC: u32 = 3;

impl UnityBundle {
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let mut file = File::open(path.as_ref())
            .map_err(|e| format!("Impossibile aprire bundle: {}", e))?;
        
        let header = Self::read_header(&mut file)?;
        
        if header.signature != "UnityFS" {
            return Err(format!("Signature non valida: {}. Atteso: UnityFS", header.signature));
        }
        
        // Leggi metadata compressi
        let (blocks, nodes) = Self::read_blocks_info(&mut file, &header)?;
        
        // Decomprime e leggi i dati
        let decompressed_data = Self::decompress_blocks(&mut file, &blocks, &header)?;
        
        // Parsa i file serializzati
        let assets = Self::parse_serialized_files(&decompressed_data, &nodes)?;
        
        Ok(UnityBundle {
            header,
            blocks,
            nodes,
            assets,
        })
    }
    
    fn read_header<R: Read>(reader: &mut R) -> Result<BundleHeader, String> {
        // Leggi signature (null-terminated string)
        let signature = Self::read_null_string(reader)?;
        
        let format_version = reader.read_u32::<BigEndian>()
            .map_err(|e| format!("Errore lettura format_version: {}", e))?;
        
        let unity_version = Self::read_null_string(reader)?;
        let generator_version = Self::read_null_string(reader)?;
        
        let file_size = reader.read_u64::<BigEndian>()
            .map_err(|e| format!("Errore lettura file_size: {}", e))?;
        
        let compressed_size = reader.read_u32::<BigEndian>()
            .map_err(|e| format!("Errore lettura compressed_size: {}", e))?;
        
        let uncompressed_size = reader.read_u32::<BigEndian>()
            .map_err(|e| format!("Errore lettura uncompressed_size: {}", e))?;
        
        let flags = reader.read_u32::<BigEndian>()
            .map_err(|e| format!("Errore lettura flags: {}", e))?;
        
        Ok(BundleHeader {
            signature,
            format_version,
            unity_version,
            generator_version,
            file_size,
            compressed_size,
            uncompressed_size,
            flags,
        })
    }
    
    fn read_null_string<R: Read>(reader: &mut R) -> Result<String, String> {
        let mut bytes = Vec::new();
        loop {
            let byte = reader.read_u8().map_err(|e| format!("Errore lettura stringa: {}", e))?;
            if byte == 0 {
                break;
            }
            bytes.push(byte);
        }
        String::from_utf8(bytes).map_err(|e| format!("Stringa UTF8 non valida: {}", e))
    }
    
    fn read_blocks_info<R: Read + Seek>(reader: &mut R, header: &BundleHeader) -> Result<(Vec<StorageBlock>, Vec<Node>), String> {
        let compression = header.flags & 0x3F;
        let has_directory_info = (header.flags & 0x40) != 0;
        let blocks_at_end = (header.flags & 0x80) != 0;
        
        // Se i blocchi sono alla fine del file
        if blocks_at_end {
            let pos = header.file_size - header.compressed_size as u64;
            reader.seek(SeekFrom::Start(pos))
                .map_err(|e| format!("Errore seek: {}", e))?;
        }
        
        // Leggi dati compressi
        let mut compressed_data = vec![0u8; header.compressed_size as usize];
        reader.read_exact(&mut compressed_data)
            .map_err(|e| format!("Errore lettura blocchi compressi: {}", e))?;
        
        // Decomprimi metadata
        let metadata = Self::decompress_data(&compressed_data, header.uncompressed_size as usize, compression)?;
        let mut cursor = Cursor::new(metadata);
        
        // Leggi hash (16 bytes) se presente
        if has_directory_info {
            let mut _hash = [0u8; 16];
            cursor.read_exact(&mut _hash)
                .map_err(|e| format!("Errore lettura hash: {}", e))?;
        }
        
        // Leggi numero di blocchi
        let block_count = cursor.read_u32::<BigEndian>()
            .map_err(|e| format!("Errore lettura block_count: {}", e))?;
        
        let mut blocks = Vec::with_capacity(block_count as usize);
        for _ in 0..block_count {
            let uncompressed_size = cursor.read_u32::<BigEndian>()
                .map_err(|e| format!("Errore lettura uncompressed_size: {}", e))?;
            let compressed_size = cursor.read_u32::<BigEndian>()
                .map_err(|e| format!("Errore lettura compressed_size: {}", e))?;
            let flags = cursor.read_u16::<BigEndian>()
                .map_err(|e| format!("Errore lettura flags: {}", e))?;
            
            blocks.push(StorageBlock {
                compressed_size,
                uncompressed_size,
                flags,
            });
        }
        
        // Leggi numero di nodi
        let node_count = cursor.read_u32::<BigEndian>()
            .map_err(|e| format!("Errore lettura node_count: {}", e))?;
        
        let mut nodes = Vec::with_capacity(node_count as usize);
        for _ in 0..node_count {
            let offset = cursor.read_u64::<BigEndian>()
                .map_err(|e| format!("Errore lettura offset: {}", e))?;
            let size = cursor.read_u64::<BigEndian>()
                .map_err(|e| format!("Errore lettura size: {}", e))?;
            let flags = cursor.read_u32::<BigEndian>()
                .map_err(|e| format!("Errore lettura flags: {}", e))?;
            let path = Self::read_null_string(&mut cursor)?;
            
            nodes.push(Node {
                offset,
                size,
                flags,
                path,
            });
        }
        
        Ok((blocks, nodes))
    }
    
    fn decompress_data(data: &[u8], uncompressed_size: usize, compression: u32) -> Result<Vec<u8>, String> {
        match compression {
            COMPRESSION_NONE => Ok(data.to_vec()),
            COMPRESSION_LZ4 | COMPRESSION_LZ4HC => {
                // Unity usa LZ4 block format, non frame format
                // Prova decompress_size_prepended prima (formato con header dimensione)
                if let Ok(result) = lz4_flex::decompress_size_prepended(data) {
                    return Ok(result);
                }
                
                // Fallback: decompressione raw block con dimensione nota
                lz4_flex::decompress(data, uncompressed_size)
                    .map_err(|e| format!("Errore decompressione LZ4: {}", e))
            }
            COMPRESSION_LZMA => {
                Err("Compressione LZMA non ancora supportata".to_string())
            }
            _ => Err(format!("Compressione sconosciuta: {}", compression)),
        }
    }
    
    fn decompress_blocks<R: Read + Seek>(reader: &mut R, blocks: &[StorageBlock], header: &BundleHeader) -> Result<Vec<u8>, String> {
        // Calcola dimensione totale decompressa
        let total_size: usize = blocks.iter().map(|b| b.uncompressed_size as usize).sum();
        let mut result = Vec::with_capacity(total_size);
        
        // Posizionati all'inizio dei dati
        let blocks_at_end = (header.flags & 0x80) != 0;
        if blocks_at_end {
            // I dati iniziano dopo l'header
            // L'header ha dimensione variabile, dobbiamo calcolarla
            reader.seek(SeekFrom::Start(0))
                .map_err(|e| format!("Errore seek: {}", e))?;
            
            // Salta header
            let _ = Self::read_header(reader)?;
        }
        
        for block in blocks {
            let compression = block.flags & 0x3F;
            let mut compressed = vec![0u8; block.compressed_size as usize];
            reader.read_exact(&mut compressed)
                .map_err(|e| format!("Errore lettura blocco: {}", e))?;
            
            let decompressed = Self::decompress_data(&compressed, block.uncompressed_size as usize, compression as u32)?;
            result.extend_from_slice(&decompressed);
        }
        
        Ok(result)
    }
    
    fn parse_serialized_files(data: &[u8], nodes: &[Node]) -> Result<Vec<SerializedFile>, String> {
        let mut assets = Vec::new();
        
        for node in nodes {
            if node.path.ends_with(".resource") || node.path.ends_with(".resS") {
                continue; // Salta file di risorse
            }
            
            let start = node.offset as usize;
            let end = start + node.size as usize;
            
            if end > data.len() {
                return Err(format!("Node {} fuori dai limiti: {} > {}", node.path, end, data.len()));
            }
            
            let asset_data = &data[start..end];
            let asset = Self::parse_serialized_file(&node.path, asset_data)?;
            assets.push(asset);
        }
        
        Ok(assets)
    }
    
    fn parse_serialized_file(name: &str, data: &[u8]) -> Result<SerializedFile, String> {
        let mut cursor = Cursor::new(data);
        
        // Leggi header
        let metadata_size = cursor.read_u32::<BigEndian>()
            .map_err(|e| format!("Errore lettura metadata_size: {}", e))?;
        let file_size = cursor.read_u32::<BigEndian>()
            .map_err(|e| format!("Errore lettura file_size: {}", e))? as u64;
        let version = cursor.read_u32::<BigEndian>()
            .map_err(|e| format!("Errore lettura version: {}", e))?;
        let data_offset = cursor.read_u32::<BigEndian>()
            .map_err(|e| format!("Errore lettura data_offset: {}", e))? as u64;
        
        // Per versioni >= 9, c'è endianness e file_size/data_offset a 64 bit
        let (endianness, file_size, data_offset) = if version >= 9 {
            let endianness = cursor.read_u8()
                .map_err(|e| format!("Errore lettura endianness: {}", e))?;
            let _ = cursor.read_u8(); // reserved
            let _ = cursor.read_u8();
            let _ = cursor.read_u8();
            
            if version >= 22 {
                let _metadata_size = cursor.read_u32::<LittleEndian>()
                    .map_err(|e| format!("Errore lettura metadata_size v22: {}", e))?;
                let file_size = cursor.read_u64::<LittleEndian>()
                    .map_err(|e| format!("Errore lettura file_size v22: {}", e))?;
                let data_offset = cursor.read_u64::<LittleEndian>()
                    .map_err(|e| format!("Errore lettura data_offset v22: {}", e))?;
                let _ = cursor.read_u64::<LittleEndian>(); // unknown
                (endianness, file_size, data_offset)
            } else {
                (endianness, file_size, data_offset)
            }
        } else {
            (1, file_size, data_offset)
        };
        
        let header = SerializedFileHeader {
            metadata_size,
            file_size,
            version,
            data_offset,
            endianness,
        };
        
        // Per ora, salviamo i dati raw per l'estrazione successiva
        Ok(SerializedFile {
            name: name.to_string(),
            header,
            types: Vec::new(),
            objects: Vec::new(),
            data: data.to_vec(),
        })
    }
    
    /// Estrae le stringhe localizzabili dal bundle
    pub fn extract_strings(&self) -> Result<Vec<LocalizedString>, String> {
        let mut strings = Vec::new();
        
        for asset in &self.assets {
            // Cerca pattern di stringhe nel file serializzato
            let extracted = extract_strings_from_data(&asset.data)?;
            strings.extend(extracted);
        }
        
        Ok(strings)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalizedString {
    pub key: String,
    pub value: String,
    pub table_name: Option<String>,
    pub offset: usize,
}

/// Estrae stringhe da dati serializzati Unity cercando pattern comuni
fn extract_strings_from_data(data: &[u8]) -> Result<Vec<LocalizedString>, String> {
    let mut strings = Vec::new();
    let mut i = 0;
    
    while i + 4 < data.len() {
        // Cerca pattern: length (4 bytes LE) + string data
        let len = u32::from_le_bytes([data[i], data[i+1], data[i+2], data[i+3]]) as usize;
        
        // Verifica che la lunghezza sia ragionevole
        if len > 0 && len < 10000 && i + 4 + len <= data.len() {
            let str_data = &data[i + 4..i + 4 + len];
            
            // Verifica che sia UTF-8 valido e contenga caratteri stampabili
            if let Ok(s) = std::str::from_utf8(str_data) {
                if s.chars().all(|c| c.is_ascii_graphic() || c.is_ascii_whitespace() || !c.is_ascii()) {
                    if s.len() > 1 && !s.chars().all(|c| c.is_ascii_digit()) {
                        strings.push(LocalizedString {
                            key: format!("str_{:08x}", i),
                            value: s.to_string(),
                            table_name: None,
                            offset: i,
                        });
                    }
                }
            }
            i += 4 + len;
            // Allineamento a 4 bytes
            let padding = (4 - (len % 4)) % 4;
            i += padding;
        } else {
            i += 1;
        }
    }
    
    Ok(strings)
}
