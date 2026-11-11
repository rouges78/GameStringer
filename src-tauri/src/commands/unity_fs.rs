//! Lettore ad accesso casuale dei bundle UnityFS (`data.unity3d`).
//!
//! Molti giochi Unity non hanno file `.assets` sciolti: tutto sta in un solo
//! bundle, spesso di gigabyte (Lost Host Demo: 2,78 GB). Il decompressore di
//! `unity_localization.rs` carica il file intero e decomprime ogni blocco, cosa
//! impraticabile a quelle dimensioni. Questo lettore tiene in memoria solo
//! l'indice dei blocchi e decomprime, a richiesta, quelli che coprono i byte
//! chiesti. Sola lettura.
//!
//! Formato (campi big-endian):
//! - firma `UnityFS\0`, versione u32, due stringhe di versione, dimensione i64,
//!   dimensione compressa e non compressa dell'indice (u32 + u32), flag u32;
//! - dalla versione 7 l'intestazione è allineata a 16 byte;
//! - l'indice (`BlocksInfo`) è subito dopo l'intestazione, oppure in fondo al
//!   file se il flag 0x80 è acceso; contiene l'elenco dei blocchi e quello dei
//!   file interni (nodi);
//! - i blocchi dati seguono, allineati a 16 se il flag 0x200 è acceso.
//!
//! COPERTURA: blocchi non compressi e LZ4/LZ4HC. LZMA non è supportato (si
//! risponde con un errore chiaro): i `data.unity3d` dei giochi usano LZ4 a
//! blocchi, LZMA è il formato dei bundle scaricati dal web.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const FLAG_COMPRESSION_MASK: u32 = 0x3F;
const FLAG_INFO_AT_END: u32 = 0x80;
const FLAG_PADDING_AT_START: u32 = 0x200;

const COMPRESSION_NONE: u32 = 0;
const COMPRESSION_LZMA: u32 = 1;
// 2 = LZ4, 3 = LZ4HC: stesso formato di decompressione.

/// Limiti di buon senso: oltre questi il file è rotto o non è un bundle.
const MAX_INFO_SIZE: u32 = 256 * 1024 * 1024;
const MAX_BLOCK_SIZE: u32 = 256 * 1024 * 1024;

/// Qualunque cosa da cui si possano leggere byte a un offset: un file su disco
/// o un file interno a un bundle.
pub trait ReadAt {
    fn read_at(&mut self, offset: u64, len: usize) -> Result<Vec<u8>, String>;
    fn len(&self) -> u64;
}

impl ReadAt for File {
    fn read_at(&mut self, offset: u64, len: usize) -> Result<Vec<u8>, String> {
        let mut buf = vec![0u8; len];
        self.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
        self.read_exact(&mut buf).map_err(|e| format!("lettura a {offset}: {e}"))?;
        Ok(buf)
    }

    fn len(&self) -> u64 {
        self.metadata().map(|m| m.len()).unwrap_or(0)
    }
}

#[derive(Debug, Clone)]
struct Block {
    /// Posizione del blocco compresso nel file.
    file_offset: u64,
    compressed_size: u32,
    /// Posizione del blocco nel flusso decompresso.
    stream_offset: u64,
    uncompressed_size: u32,
    compression: u32,
}

/// Un file interno al bundle (es. `resources.assets`, `level0`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Node {
    pub path: String,
    /// Posizione nel flusso decompresso.
    pub offset: u64,
    pub size: u64,
}

pub struct Bundle {
    file: File,
    blocks: Vec<Block>,
    pub nodes: Vec<Node>,
    pub unity_revision: String,
    /// Ultimo blocco decompresso: le letture vicine cadono quasi sempre lì.
    cache: Option<(usize, Vec<u8>)>,
}

/// Cursore big-endian su un buffer.
struct Cursor<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> Cursor<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        let end = self.pos.checked_add(n).filter(|&e| e <= self.data.len()).ok_or("indice del bundle troncato")?;
        let slice = &self.data[self.pos..end];
        self.pos = end;
        Ok(slice)
    }
    fn u16(&mut self) -> Result<u16, String> {
        Ok(u16::from_be_bytes(self.take(2)?.try_into().unwrap()))
    }
    fn u32(&mut self) -> Result<u32, String> {
        Ok(u32::from_be_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn i64(&mut self) -> Result<i64, String> {
        Ok(i64::from_be_bytes(self.take(8)?.try_into().unwrap()))
    }
    fn cstring(&mut self) -> Result<String, String> {
        let rest = &self.data[self.pos..];
        let end = rest.iter().position(|&b| b == 0).ok_or("stringa non terminata")?;
        let s = String::from_utf8_lossy(&rest[..end]).to_string();
        self.pos += end + 1;
        Ok(s)
    }
}

fn align16(pos: u64) -> u64 {
    (pos + 15) & !15
}

fn decompress(compression: u32, data: &[u8], uncompressed_size: usize) -> Result<Vec<u8>, String> {
    match compression {
        COMPRESSION_NONE => Ok(data.to_vec()),
        COMPRESSION_LZMA => Err("bundle compresso con LZMA: non supportato".to_string()),
        2 | 3 => lz4_flex::decompress(data, uncompressed_size).map_err(|e| format!("LZ4: {e}")),
        other => Err(format!("compressione sconosciuta: {other}")),
    }
}

/// È un bundle UnityFS? Guarda solo la firma.
pub fn is_unity_fs(head: &[u8]) -> bool {
    head.starts_with(b"UnityFS\0")
}

impl Bundle {
    pub fn open(path: &Path) -> Result<Self, String> {
        let mut file = File::open(path).map_err(|e| format!("Errore lettura: {e}"))?;
        let file_len = ReadAt::len(&file);

        // L'intestazione sta comodamente in 4 KB.
        let head_len = file_len.min(4096) as usize;
        let head = file.read_at(0, head_len)?;
        if !is_unity_fs(&head) {
            return Err("Non è un bundle UnityFS".to_string());
        }
        let mut c = Cursor { data: &head, pos: 8 };
        let version = c.u32()?;
        let _player_version = c.cstring()?;
        let unity_revision = c.cstring()?;
        let _size = c.i64()?;
        let compressed_info = c.u32()?;
        let uncompressed_info = c.u32()?;
        let flags = c.u32()?;
        if compressed_info > MAX_INFO_SIZE || uncompressed_info > MAX_INFO_SIZE {
            return Err("indice del bundle di dimensione implausibile".to_string());
        }

        let mut pos = c.pos as u64;
        if version >= 7 {
            pos = align16(pos);
        }
        let (info_offset, mut data_start) = if flags & FLAG_INFO_AT_END != 0 {
            (file_len.checked_sub(compressed_info as u64).ok_or("indice oltre l'inizio del file")?, pos)
        } else {
            (pos, pos + compressed_info as u64)
        };
        if flags & FLAG_PADDING_AT_START != 0 {
            data_start = align16(data_start);
        }

        let raw_info = file.read_at(info_offset, compressed_info as usize)?;
        let info = decompress(flags & FLAG_COMPRESSION_MASK, &raw_info, uncompressed_info as usize)?;
        let mut c = Cursor { data: &info, pos: 16 }; // salta l'hash

        let block_count = c.u32()?;
        if block_count as usize > info.len() / 10 {
            return Err(format!("numero di blocchi implausibile: {block_count}"));
        }
        let mut blocks = Vec::with_capacity(block_count as usize);
        let (mut file_offset, mut stream_offset) = (data_start, 0u64);
        for _ in 0..block_count {
            let uncompressed_size = c.u32()?;
            let compressed_size = c.u32()?;
            let block_flags = c.u16()? as u32;
            if uncompressed_size > MAX_BLOCK_SIZE || compressed_size > MAX_BLOCK_SIZE {
                return Err("blocco di dimensione implausibile".to_string());
            }
            blocks.push(Block {
                file_offset,
                compressed_size,
                stream_offset,
                uncompressed_size,
                compression: block_flags & FLAG_COMPRESSION_MASK,
            });
            file_offset += compressed_size as u64;
            stream_offset += uncompressed_size as u64;
        }

        let node_count = c.u32()?;
        if node_count as usize > info.len() / 20 {
            return Err(format!("numero di file interni implausibile: {node_count}"));
        }
        let mut nodes = Vec::with_capacity(node_count as usize);
        for _ in 0..node_count {
            let offset = c.i64()? as u64;
            let size = c.i64()? as u64;
            let _flags = c.u32()?;
            let path = c.cstring()?;
            nodes.push(Node { path, offset, size });
        }

        Ok(Bundle { file, blocks, nodes, unity_revision, cache: None })
    }

    /// Dimensione del flusso decompresso.
    pub fn stream_len(&self) -> u64 {
        self.blocks.last().map(|b| b.stream_offset + b.uncompressed_size as u64).unwrap_or(0)
    }

    fn block(&mut self, index: usize) -> Result<&[u8], String> {
        if self.cache.as_ref().map(|(i, _)| *i) != Some(index) {
            let b = self.blocks[index].clone();
            let raw = self.file.read_at(b.file_offset, b.compressed_size as usize)?;
            let data = decompress(b.compression, &raw, b.uncompressed_size as usize)?;
            if data.len() != b.uncompressed_size as usize {
                return Err(format!("blocco {index}: attesi {} byte, ottenuti {}", b.uncompressed_size, data.len()));
            }
            self.cache = Some((index, data));
        }
        Ok(&self.cache.as_ref().unwrap().1)
    }

    /// Legge `len` byte dal flusso decompresso a partire da `offset`,
    /// decomprimendo solo i blocchi che li contengono.
    pub fn read_stream(&mut self, offset: u64, len: usize) -> Result<Vec<u8>, String> {
        if offset + len as u64 > self.stream_len() {
            return Err(format!("lettura oltre la fine del bundle ({offset}+{len})"));
        }
        let mut out = Vec::with_capacity(len);
        // primo blocco che contiene `offset`
        let mut index = self.blocks.partition_point(|b| b.stream_offset + b.uncompressed_size as u64 <= offset);
        let mut pos = offset;
        while out.len() < len {
            let start = self.blocks[index].stream_offset;
            let data = self.block(index)?;
            let from = (pos - start) as usize;
            let take = (len - out.len()).min(data.len() - from);
            out.extend_from_slice(&data[from..from + take]);
            pos += take as u64;
            index += 1;
        }
        Ok(out)
    }

    /// Vista ad accesso casuale su un file interno.
    pub fn node(&mut self, index: usize) -> NodeReader<'_> {
        let node = self.nodes[index].clone();
        NodeReader { bundle: self, node }
    }
}

pub struct NodeReader<'a> {
    bundle: &'a mut Bundle,
    node: Node,
}

impl ReadAt for NodeReader<'_> {
    fn read_at(&mut self, offset: u64, len: usize) -> Result<Vec<u8>, String> {
        if offset + len as u64 > self.node.size {
            return Err(format!("lettura oltre la fine di {}", self.node.path));
        }
        self.bundle.read_stream(self.node.offset + offset, len)
    }

    fn len(&self) -> u64 {
        self.node.size
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    /// Costruisce un bundle UnityFS v7 con i file dati, spezzati in blocchi
    /// LZ4 da `block_size` byte. `info_at_end` e `padding` accendono i flag.
    pub(crate) fn build_bundle(files: &[(&str, Vec<u8>)], block_size: usize, info_at_end: bool, padding: bool) -> Vec<u8> {
        let stream: Vec<u8> = files.iter().flat_map(|(_, d)| d.clone()).collect();
        let chunks: Vec<&[u8]> = stream.chunks(block_size.max(1)).collect();
        let compressed: Vec<Vec<u8>> = chunks.iter().map(|c| lz4_flex::compress(c)).collect();

        let mut info = vec![0u8; 16];
        info.extend((chunks.len() as u32).to_be_bytes());
        for (chunk, comp) in chunks.iter().zip(&compressed) {
            info.extend((chunk.len() as u32).to_be_bytes());
            info.extend((comp.len() as u32).to_be_bytes());
            info.extend(2u16.to_be_bytes()); // LZ4
        }
        info.extend((files.len() as u32).to_be_bytes());
        let mut offset = 0i64;
        for (name, data) in files {
            info.extend(offset.to_be_bytes());
            info.extend((data.len() as i64).to_be_bytes());
            info.extend(4u32.to_be_bytes());
            info.extend(name.as_bytes());
            info.push(0);
            offset += data.len() as i64;
        }
        let info_comp = lz4_flex::compress(&info);

        let mut flags = 2u32 | 0x40;
        if info_at_end { flags |= FLAG_INFO_AT_END; }
        if padding { flags |= FLAG_PADDING_AT_START; }

        let mut out = b"UnityFS\0".to_vec();
        out.extend(7u32.to_be_bytes());
        out.extend(b"5.x.x\0");
        out.extend(b"2021.3.16f1\0");
        out.extend(0i64.to_be_bytes());
        out.extend((info_comp.len() as u32).to_be_bytes());
        out.extend((info.len() as u32).to_be_bytes());
        out.extend(flags.to_be_bytes());
        while out.len() % 16 != 0 { out.push(0); }
        if !info_at_end { out.extend(&info_comp); }
        if padding { while out.len() % 16 != 0 { out.push(0); } }
        for comp in &compressed { out.extend(comp); }
        if info_at_end { out.extend(&info_comp); }
        out
    }

    fn sample() -> Vec<(&'static str, Vec<u8>)> {
        vec![
            ("globalgamemanagers", (0..5000u32).map(|i| (i % 251) as u8).collect()),
            ("resources.assets", (0..9000u32).map(|i| (i % 13) as u8).collect()),
        ]
    }

    fn open(bytes: &[u8]) -> (tempfile::TempDir, Bundle) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data.unity3d");
        std::fs::write(&path, bytes).unwrap();
        let bundle = Bundle::open(&path).unwrap();
        (dir, bundle)
    }

    #[test]
    fn lists_nodes_and_reads_them_back_whole() {
        for (info_at_end, padding) in [(false, false), (false, true), (true, false), (true, true)] {
            let files = sample();
            let (_dir, mut bundle) = open(&build_bundle(&files, 1024, info_at_end, padding));
            assert_eq!(bundle.unity_revision, "2021.3.16f1");
            assert_eq!(bundle.nodes.iter().map(|n| n.path.as_str()).collect::<Vec<_>>(), ["globalgamemanagers", "resources.assets"]);
            for (i, (_, data)) in files.iter().enumerate() {
                let mut node = bundle.node(i);
                assert_eq!(node.len(), data.len() as u64);
                assert_eq!(&node.read_at(0, data.len()).unwrap(), data, "info_at_end={info_at_end} padding={padding}");
            }
        }
    }

    #[test]
    fn reads_a_range_that_crosses_block_boundaries() {
        let files = sample();
        let (_dir, mut bundle) = open(&build_bundle(&files, 700, false, false));
        let data = &files[1].1;
        let mut node = bundle.node(1);
        // parte a metà di un blocco e ne attraversa diversi
        assert_eq!(node.read_at(333, 4000).unwrap(), data[333..4333]);
        // letture piccole e vicine: stesso blocco in cache
        assert_eq!(node.read_at(10, 4).unwrap(), data[10..14]);
        assert_eq!(node.read_at(14, 4).unwrap(), data[14..18]);
    }

    #[test]
    fn reading_past_a_node_is_an_error_not_a_neighbour() {
        let files = sample();
        let (_dir, mut bundle) = open(&build_bundle(&files, 1024, false, false));
        let size = files[0].1.len() as u64;
        // senza il controllo leggerebbe l'inizio di resources.assets
        assert!(bundle.node(0).read_at(size - 2, 8).is_err());
        let total = bundle.stream_len();
        assert!(bundle.read_stream(total - 1, 2).is_err());
    }

    #[test]
    fn rejects_what_is_not_a_bundle_and_lzma() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("x");
        std::fs::write(&path, b"UnityWeb\0 nope").unwrap();
        assert!(Bundle::open(&path).is_err());
        assert!(decompress(COMPRESSION_LZMA, &[1, 2, 3], 10).unwrap_err().contains("LZMA"));
        assert!(is_unity_fs(b"UnityFS\0rest"));
        assert!(!is_unity_fs(b"UnityFS"));
    }

    #[test]
    fn a_truncated_index_is_an_error() {
        let mut bytes = build_bundle(&sample(), 1024, false, false);
        bytes.truncate(60);
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data.unity3d");
        std::fs::write(&path, &bytes).unwrap();
        assert!(Bundle::open(&path).is_err());
    }
}

/// Misura su bundle VERI, in sola lettura.
///
/// ```bash
/// cd src-tauri && GS_UNITY_BUNDLES="E:/…/LostHost_Data/data.unity3d" \
///   cargo test --bin gamestringer real_bundles -- --ignored --nocapture
/// ```
#[cfg(test)]
mod real_bundles {
    use super::*;

    #[test]
    #[ignore]
    fn real_bundles() {
        let paths = std::env::var("GS_UNITY_BUNDLES").expect("GS_UNITY_BUNDLES non impostata");
        for path in paths.split(';').filter(|p| !p.trim().is_empty()) {
            let started = std::time::Instant::now();
            match Bundle::open(Path::new(path)) {
                Err(e) => println!("{path} | ERRORE {e}"),
                Ok(mut bundle) => {
                    println!(
                        "{path} | unity={} | blocchi={} | flusso={} MB | file interni={} | apertura {} ms",
                        bundle.unity_revision,
                        bundle.blocks.len(),
                        bundle.stream_len() / 1_048_576,
                        bundle.nodes.len(),
                        started.elapsed().as_millis()
                    );
                    for i in 0..bundle.nodes.len() {
                        let node = bundle.nodes[i].clone();
                        let head = bundle.node(i).read_at(0, node.size.min(20) as usize);
                        let version = head.as_ref().ok().filter(|h| h.len() >= 12).map(|h| u32::from_be_bytes([h[8], h[9], h[10], h[11]]));
                        println!("    {} | {} KB | versione serializzata={:?}", node.path, node.size / 1024, version);
                    }
                }
            }
        }
    }
}
