//! Lettore ad accesso casuale dei bundle UnityFS (`data.unity3d`).
//!
//! Molti giochi Unity non hanno file `.assets` sciolti: tutto sta in un solo
//! bundle, spesso di gigabyte (Lost Host Demo: 2,78 GB). Il decompressore di
//! `unity_localization.rs` carica il file intero e decomprime ogni blocco, cosa
//! impraticabile a quelle dimensioni. Questo lettore tiene in memoria solo
//! l'indice dei blocchi e decomprime, a richiesta, quelli che coprono i byte
//! chiesti.
//!
//! Sa anche SCRIVERE: `rewrite_node` produce un bundle nuovo in cui un file
//! interno è sostituito. Ricomprime solo i blocchi che toccano quel file; tutti
//! gli altri si copiano dal bundle originale così come sono, senza
//! decomprimerli. L'originale non viene mai modificato.
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
use std::io::{Read, Seek, SeekFrom, Write};
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
/// Dimensione dei blocchi che scriviamo: la stessa che usa Unity (128 KB).
const WRITE_BLOCK_SIZE: usize = 0x20000;

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
    /// Flag del blocco come scritti nel bundle (compressione + altri bit).
    flags: u16,
}

/// Un file interno al bundle (es. `resources.assets`, `level0`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Node {
    pub path: String,
    /// Posizione nel flusso decompresso.
    pub offset: u64,
    pub size: u64,
    /// Flag del nodo come scritti nel bundle (es. 4 = file serializzato).
    pub flags: u32,
}

pub struct Bundle {
    file: File,
    blocks: Vec<Block>,
    pub nodes: Vec<Node>,
    pub unity_revision: String,
    version: u32,
    player_version: String,
    flags: u32,
    /// I 16 byte di hash in testa all'indice: si ricopiano tali e quali.
    info_hash: Vec<u8>,
    /// Dove cominciano i blocchi dati nel file.
    data_start: u64,
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
        let player_version = c.cstring()?;
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
        let mut c = Cursor { data: &info, pos: 0 };
        let info_hash = c.take(16)?.to_vec();

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
                flags: block_flags as u16,
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
            let node_flags = c.u32()?;
            let path = c.cstring()?;
            nodes.push(Node { path, offset, size, flags: node_flags });
        }

        Ok(Bundle { file, blocks, nodes, unity_revision, version, player_version, flags, info_hash, data_start, cache: None })
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

    /// Scrive in `dst` un bundle uguale a questo, ma con il file interno
    /// `node_index` sostituito da `new_content`. L'originale non si tocca.
    ///
    /// Si ricomprimono solo i blocchi che contengono byte di quel file; gli
    /// altri si copiano compressi come sono. I file interni successivi slittano
    /// di un multiplo di 16 byte, così conservano l'allineamento che avevano.
    pub fn rewrite_node(&mut self, dst: &Path, node_index: usize, new_content: &[u8]) -> Result<RewriteStats, String> {
        let node = self.nodes.get(node_index).cloned().ok_or("file interno inesistente")?;
        if node.size == 0 {
            return Err(format!("{} è vuoto: non si sa in quale blocco stia", node.path));
        }
        if self.blocks.iter().any(|b| b.compression == COMPRESSION_LZMA) {
            return Err("bundle compresso con LZMA: non supportato".to_string());
        }

        // Blocchi che contengono il primo e l'ultimo byte del file interno.
        let first = self.blocks.partition_point(|b| b.stream_offset + b.uncompressed_size as u64 <= node.offset);
        let last = self.blocks.partition_point(|b| b.stream_offset + b.uncompressed_size as u64 <= node.offset + node.size - 1);
        let span_start = self.blocks[first].stream_offset;
        let span_end = self.blocks[last].stream_offset + self.blocks[last].uncompressed_size as u64;

        // Nuovo contenuto del tratto: ciò che precede il file nel primo blocco,
        // il file nuovo, il riempimento, ciò che lo segue nell'ultimo blocco.
        let delta = new_content.len() as i64 - node.size as i64;
        let pad = (16 - delta.rem_euclid(16)) % 16;
        let shift = delta + pad;
        let mut span = self.read_stream(span_start, (node.offset - span_start) as usize)?;
        span.extend_from_slice(new_content);
        span.extend(std::iter::repeat(0u8).take(pad as usize));
        let node_end = node.offset + node.size;
        span.extend(self.read_stream(node_end, (span_end - node_end) as usize)?);

        // Ricompressione del tratto in blocchi da 128 KB. I bit non di
        // compressione si ereditano dal primo blocco sostituito.
        let other_bits = self.blocks[first].flags & !(FLAG_COMPRESSION_MASK as u16);
        let mut new_blocks: Vec<(Vec<u8>, u32, u16)> = Vec::new();
        for chunk in span.chunks(WRITE_BLOCK_SIZE) {
            let packed = lz4_flex::compress(chunk);
            if packed.len() < chunk.len() {
                new_blocks.push((packed, chunk.len() as u32, other_bits | 2));
            } else {
                // incomprimibile: si salva com'è
                new_blocks.push((chunk.to_vec(), chunk.len() as u32, other_bits));
            }
        }

        // Indice nuovo.
        let mut info = self.info_hash.clone();
        let block_count = first + new_blocks.len() + (self.blocks.len() - last - 1);
        info.extend((block_count as u32).to_be_bytes());
        let entry = |info: &mut Vec<u8>, uncompressed: u32, compressed: u32, flags: u16| {
            info.extend(uncompressed.to_be_bytes());
            info.extend(compressed.to_be_bytes());
            info.extend(flags.to_be_bytes());
        };
        for b in &self.blocks[..first] {
            entry(&mut info, b.uncompressed_size, b.compressed_size, b.flags);
        }
        for (data, uncompressed, flags) in &new_blocks {
            entry(&mut info, *uncompressed, data.len() as u32, *flags);
        }
        for b in &self.blocks[last + 1..] {
            entry(&mut info, b.uncompressed_size, b.compressed_size, b.flags);
        }
        info.extend((self.nodes.len() as u32).to_be_bytes());
        for (i, n) in self.nodes.iter().enumerate() {
            let offset = if n.offset > node.offset { (n.offset as i64 + shift) as u64 } else { n.offset };
            let size = if i == node_index { new_content.len() as u64 } else { n.size };
            info.extend((offset as i64).to_be_bytes());
            info.extend((size as i64).to_be_bytes());
            info.extend(n.flags.to_be_bytes());
            info.extend(n.path.as_bytes());
            info.push(0);
        }
        let info_compression = self.flags & FLAG_COMPRESSION_MASK;
        let info_packed = if info_compression == COMPRESSION_NONE { info.clone() } else { lz4_flex::compress(&info) };
        // se l'indice originale era LZMA lo riscriviamo LZ4
        let flags = if info_compression == COMPRESSION_LZMA { (self.flags & !FLAG_COMPRESSION_MASK) | 2 } else { self.flags };

        // Intestazione. La dimensione totale si sa solo alla fine: si scrive
        // un segnaposto e la si corregge dopo.
        let mut header = b"UnityFS\0".to_vec();
        header.extend(self.version.to_be_bytes());
        header.extend(self.player_version.as_bytes());
        header.push(0);
        header.extend(self.unity_revision.as_bytes());
        header.push(0);
        let size_field = header.len();
        header.extend(0i64.to_be_bytes());
        header.extend((info_packed.len() as u32).to_be_bytes());
        header.extend((info.len() as u32).to_be_bytes());
        header.extend(flags.to_be_bytes());
        if self.version >= 7 {
            header.resize(align16(header.len() as u64) as usize, 0);
        }
        let info_at_end = flags & FLAG_INFO_AT_END != 0;

        let mut out = std::io::BufWriter::new(File::create(dst).map_err(|e| format!("Errore scrittura: {e}"))?);
        let io = |e: std::io::Error| format!("Errore scrittura: {e}");
        out.write_all(&header).map_err(io)?;
        let mut written = header.len() as u64;
        if !info_at_end {
            out.write_all(&info_packed).map_err(io)?;
            written += info_packed.len() as u64;
        }
        if flags & FLAG_PADDING_AT_START != 0 {
            let aligned = align16(written);
            out.write_all(&vec![0u8; (aligned - written) as usize]).map_err(io)?;
            written = aligned;
        }

        // Blocchi: quelli prima e dopo il tratto si copiano dal file originale.
        let blocks_end = self.blocks.last().map(|b| b.file_offset + b.compressed_size as u64).unwrap_or(self.data_start);
        let copy = |file: &mut File, from: u64, to: u64, out: &mut std::io::BufWriter<File>| -> Result<u64, String> {
            file.seek(SeekFrom::Start(from)).map_err(|e| e.to_string())?;
            std::io::copy(&mut file.take(to - from), out).map_err(io)
        };
        let copied_before = copy(&mut self.file, self.data_start, self.blocks[first].file_offset, &mut out)?;
        let mut rewritten = 0u64;
        for (data, _, _) in &new_blocks {
            out.write_all(data).map_err(io)?;
            rewritten += data.len() as u64;
        }
        let after_from = self.blocks[last].file_offset + self.blocks[last].compressed_size as u64;
        let copied_after = copy(&mut self.file, after_from, blocks_end, &mut out)?;
        written += copied_before + rewritten + copied_after;
        if info_at_end {
            out.write_all(&info_packed).map_err(io)?;
            written += info_packed.len() as u64;
        }

        let mut file = out.into_inner().map_err(|e| format!("Errore scrittura: {e}"))?;
        file.seek(SeekFrom::Start(size_field as u64)).map_err(|e| e.to_string())?;
        file.write_all(&(written as i64).to_be_bytes()).map_err(io)?;
        file.flush().map_err(io)?;

        Ok(RewriteStats {
            blocks_total: block_count,
            blocks_recompressed: new_blocks.len(),
            bytes_copied: copied_before + copied_after,
            bytes_recompressed: rewritten,
            file_size: written,
        })
    }

    /// Vista ad accesso casuale su un file interno.
    pub fn node(&mut self, index: usize) -> NodeReader<'_> {
        let node = self.nodes[index].clone();
        NodeReader { bundle: self, node }
    }
}

/// Cosa ha fatto `rewrite_node`.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct RewriteStats {
    pub blocks_total: usize,
    /// Blocchi ricompressi: quelli che toccavano il file sostituito.
    pub blocks_recompressed: usize,
    /// Byte copiati dall'originale senza decomprimerli.
    pub bytes_copied: u64,
    pub bytes_recompressed: u64,
    pub file_size: u64,
}

/// Dove sta il backup dell'originale: `data.unity3d.gs_backup`, accanto al bundle.
pub fn backup_path(bundle: &Path) -> std::path::PathBuf {
    let mut name = bundle.as_os_str().to_os_string();
    name.push(".gs_backup");
    std::path::PathBuf::from(name)
}

/// Sostituisce un file interno NEL GIOCO, tenendo l'originale come backup.
///
/// `transform` riceve il contenuto originale del file interno e restituisce
/// quello nuovo. La sorgente è sempre il bundle ORIGINALE: se un backup esiste
/// già si riparte da quello, così applicare due volte non accumula modifiche e
/// il backup resta l'originale vero.
///
/// Ordine delle operazioni, pensato per non lasciare mai il gioco senza
/// bundle: si scrive il nuovo in `<bundle>.gs_new`; solo se la scrittura è
/// riuscita si mette da parte l'originale (per RINOMINA, senza copiare
/// gigabyte) e si rinomina il nuovo al suo posto.
pub fn replace_node_in_place(
    bundle_path: &Path,
    node_path: &str,
    transform: impl FnOnce(&[u8]) -> Result<Vec<u8>, String>,
) -> Result<RewriteStats, String> {
    let backup = backup_path(bundle_path);
    let source = if backup.exists() { backup.clone() } else { bundle_path.to_path_buf() };
    let mut staged = bundle_path.as_os_str().to_os_string();
    staged.push(".gs_new");
    let staged = std::path::PathBuf::from(staged);

    let stats = {
        let mut bundle = Bundle::open(&source)?;
        let index = bundle
            .nodes
            .iter()
            .position(|n| n.path == node_path)
            .ok_or_else(|| format!("{node_path} non è nel bundle"))?;
        let size = bundle.nodes[index].size as usize;
        let original = bundle.node(index).read_at(0, size)?;
        let new_content = transform(&original)?;
        let result = bundle.rewrite_node(&staged, index, &new_content);
        if result.is_err() {
            let _ = std::fs::remove_file(&staged);
        }
        result?
        // qui `bundle` si chiude: su Windows un file aperto non si rinomina
    };

    // Il nuovo deve riaprirsi prima di sostituire qualunque cosa.
    if let Err(e) = Bundle::open(&staged) {
        let _ = std::fs::remove_file(&staged);
        return Err(format!("il bundle riscritto non si riapre: {e}"));
    }

    let io = |what: &str, e: std::io::Error| format!("{what}: {e}");
    if backup.exists() {
        // l'originale è già al sicuro: il bundle attuale è una versione modificata
        std::fs::remove_file(bundle_path).map_err(|e| io("rimozione del bundle modificato", e))?;
    } else {
        std::fs::rename(bundle_path, &backup).map_err(|e| io("backup dell'originale", e))?;
    }
    if let Err(e) = std::fs::rename(&staged, bundle_path) {
        // rimetti l'originale al suo posto: meglio niente patch che niente gioco
        let _ = std::fs::copy(&backup, bundle_path);
        return Err(io("installazione del bundle nuovo", e));
    }
    Ok(stats)
}

/// Rimette l'originale al posto del bundle modificato. `false` se non c'è
/// nessun backup da ripristinare.
pub fn restore_original(bundle_path: &Path) -> Result<bool, String> {
    let backup = backup_path(bundle_path);
    if !backup.exists() {
        return Ok(false);
    }
    if bundle_path.exists() {
        std::fs::remove_file(bundle_path).map_err(|e| format!("rimozione del bundle modificato: {e}"))?;
    }
    std::fs::rename(&backup, bundle_path).map_err(|e| format!("ripristino dell'originale: {e}"))?;
    Ok(true)
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

    /// Riscrive il file interno `index` e rilegge tutto dal bundle nuovo.
    fn rewrite_and_reread(files: &[(&str, Vec<u8>)], block_size: usize, info_at_end: bool, padding: bool, index: usize, new_content: &[u8]) -> (RewriteStats, Vec<Vec<u8>>) {
        let (dir, mut bundle) = open(&build_bundle(files, block_size, info_at_end, padding));
        let dst = dir.path().join("out.unity3d");
        let stats = bundle.rewrite_node(&dst, index, new_content).unwrap();
        assert_eq!(stats.file_size, std::fs::metadata(&dst).unwrap().len());

        let mut out = Bundle::open(&dst).unwrap();
        assert_eq!(out.unity_revision, bundle.unity_revision);
        let paths = |b: &Bundle| b.nodes.iter().map(|n| (n.path.clone(), n.flags)).collect::<Vec<_>>();
        assert_eq!(paths(&out), paths(&bundle));
        let contents = (0..out.nodes.len())
            .map(|i| {
                let size = out.nodes[i].size as usize;
                out.node(i).read_at(0, size).unwrap()
            })
            .collect();
        (stats, contents)
    }

    fn three_files() -> Vec<(&'static str, Vec<u8>)> {
        vec![
            ("globalgamemanagers", (0..5000u32).map(|i| (i % 251) as u8).collect()),
            ("sharedassets0.assets", (0..9000u32).map(|i| (i % 13) as u8).collect()),
            ("level0", (0..7000u32).map(|i| (i % 97) as u8).collect()),
        ]
    }

    #[test]
    fn rewriting_a_node_changes_only_that_node() {
        let files = three_files();
        let longer: Vec<u8> = (0..12345u32).map(|i| (i % 7) as u8).collect();
        let shorter = vec![42u8; 100];
        for (info_at_end, padding) in [(false, false), (false, true), (true, false), (true, true)] {
            for new_content in [&longer, &shorter, &files[1].1] {
                let (_, contents) = rewrite_and_reread(&files, 1024, info_at_end, padding, 1, new_content);
                assert_eq!(contents[0], files[0].1, "il file prima non deve cambiare");
                assert_eq!(&contents[1], new_content);
                assert_eq!(contents[2], files[2].1, "il file dopo non deve cambiare");
            }
        }
    }

    #[test]
    fn first_and_last_nodes_can_be_rewritten_too() {
        let files = three_files();
        let new_content = vec![9u8; 3333];
        let (_, first) = rewrite_and_reread(&files, 700, false, true, 0, &new_content);
        assert_eq!((&first[0], &first[1], &first[2]), (&new_content, &files[1].1, &files[2].1));
        let (_, last) = rewrite_and_reread(&files, 700, true, false, 2, &new_content);
        assert_eq!((&last[0], &last[1], &last[2]), (&files[0].1, &files[1].1, &new_content));
    }

    #[test]
    fn only_the_blocks_touching_the_node_are_recompressed() {
        let files = three_files(); // 21.000 byte in blocchi da 1.000
        let (dir, mut bundle) = open(&build_bundle(&files, 1000, false, false));
        let original_blocks = bundle.blocks.len();
        // il secondo file occupa i byte 5.000..14.000: esattamente 9 blocchi
        let stats = bundle.rewrite_node(&dir.path().join("out"), 1, &files[1].1).unwrap();
        assert_eq!(original_blocks, 21);
        assert!(stats.blocks_recompressed <= 9, "ricompressi {} blocchi", stats.blocks_recompressed);
        assert!(stats.bytes_copied > 0);
    }

    #[test]
    fn later_nodes_shift_by_a_multiple_of_16() {
        let files = three_files();
        let (dir, mut bundle) = open(&build_bundle(&files, 1024, false, false));
        let before = bundle.nodes[2].offset;
        let dst = dir.path().join("out");
        bundle.rewrite_node(&dst, 1, &vec![1u8; 9001]).unwrap(); // un byte in più
        let out = Bundle::open(&dst).unwrap();
        assert_eq!(out.nodes[2].offset - before, 16);
        assert_eq!(out.nodes[0].offset, 0);
        assert_eq!(out.nodes[1].size, 9001);
    }

    #[test]
    fn replacing_in_place_keeps_the_original_as_backup_and_restores_it() {
        let files = three_files();
        let original = build_bundle(&files, 1024, false, true);
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data.unity3d");
        std::fs::write(&path, &original).unwrap();
        let read_node = |index: usize| {
            let mut b = Bundle::open(&path).unwrap();
            let size = b.nodes[index].size as usize;
            b.node(index).read_at(0, size).unwrap()
        };

        // prima applicazione: il contenuto diventa "uno"
        replace_node_in_place(&path, "sharedassets0.assets", |old| {
            assert_eq!(old, files[1].1.as_slice());
            Ok(b"uno".to_vec())
        })
        .unwrap();
        assert_eq!(read_node(1), b"uno");
        assert_eq!(std::fs::read(backup_path(&path)).unwrap(), original, "il backup è l'originale");
        assert!(!dir.path().join("data.unity3d.gs_new").exists());

        // seconda applicazione: riparte dall'ORIGINALE, non da "uno"
        replace_node_in_place(&path, "sharedassets0.assets", |old| {
            assert_eq!(old, files[1].1.as_slice());
            Ok(b"due".to_vec())
        })
        .unwrap();
        assert_eq!(read_node(1), b"due");
        assert_eq!(read_node(2), files[2].1);
        assert_eq!(std::fs::read(backup_path(&path)).unwrap(), original);

        // ripristino: torna identico byte per byte, e il backup sparisce
        assert!(restore_original(&path).unwrap());
        assert_eq!(std::fs::read(&path).unwrap(), original);
        assert!(!backup_path(&path).exists());
        assert!(!restore_original(&path).unwrap(), "niente da ripristinare la seconda volta");
    }

    #[test]
    fn a_failed_replacement_leaves_the_game_untouched() {
        let original = build_bundle(&three_files(), 1024, false, false);
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data.unity3d");
        std::fs::write(&path, &original).unwrap();

        assert!(replace_node_in_place(&path, "non-esiste", |_| Ok(vec![1])).is_err());
        assert!(replace_node_in_place(&path, "level0", |_| Err("traduzione fallita".to_string())).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), original);
        assert!(!backup_path(&path).exists());
        assert!(!dir.path().join("data.unity3d.gs_new").exists());
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
                    // GS_UNITY_LIST=1: elenca i file interni.
                    for i in (0..bundle.nodes.len()).filter(|_| std::env::var("GS_UNITY_LIST").is_ok()) {
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

/// Riscrittura di un bundle VERO, scritta in una cartella a parte: il gioco non
/// si tocca. Sostituisce un TextAsset dentro un file interno e poi confronta
/// il bundle nuovo con l'originale, file interno per file interno.
///
/// ```bash
/// cd src-tauri && GS_UNITY_BUNDLE="E:/…/LostHost_Data/data.unity3d" \
///   GS_UNITY_NODE="sharedassets0.assets" GS_UNITY_ASSET="LOST_HOST - Italian" GS_UNITY_OUT="E:/tmp" \
///   cargo test --bin gamestringer real_bundle_rewrite -- --ignored --nocapture
/// ```
#[cfg(test)]
mod real_bundle_rewrite {
    use super::*;
    use crate::commands::unity_serialized::{extract_text_assets, rewrite_text_assets};

    /// Legge un file interno intero, a pezzi, e ne restituisce un'impronta.
    fn fingerprint(bundle: &mut Bundle, index: usize) -> (u64, u64) {
        use std::hash::Hasher;
        let size = bundle.nodes[index].size;
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        let mut node = bundle.node(index);
        let mut pos = 0u64;
        while pos < size {
            let take = (size - pos).min(8 * 1024 * 1024) as usize;
            hasher.write(&node.read_at(pos, take).unwrap());
            pos += take as u64;
        }
        (size, hasher.finish())
    }

    #[test]
    #[ignore]
    fn real_bundle_rewrite() {
        let var = |name: &str| std::env::var(name).unwrap_or_else(|_| panic!("{name} non impostata"));
        let (src, node_path, asset_name, out_dir) = (var("GS_UNITY_BUNDLE"), var("GS_UNITY_NODE"), var("GS_UNITY_ASSET"), var("GS_UNITY_OUT"));
        let dst = Path::new(&out_dir).join("gs-rewrite-test.unity3d");

        let mut bundle = Bundle::open(Path::new(&src)).unwrap();
        let index = bundle.nodes.iter().position(|n| n.path == node_path).expect("file interno non trovato");
        let size = bundle.nodes[index].size as usize;
        let original = bundle.node(index).read_at(0, size).unwrap();
        let assets = extract_text_assets(&original).unwrap();
        let target = assets.iter().find(|a| a.name == asset_name).expect("TextAsset non trovato");
        let new_text = format!("{}\nGS-PROVA,àèìòù prova di scrittura\n", target.content);
        let replaced = rewrite_text_assets(&original, &std::collections::HashMap::from([(target.path_id, new_text.clone())])).unwrap();

        let started = std::time::Instant::now();
        let stats = bundle.rewrite_node(&dst, index, &replaced).unwrap();
        println!("scrittura | {} ms | {:?}", started.elapsed().as_millis(), stats);
        println!("dimensione | originale {} | nuovo {}", std::fs::metadata(&src).unwrap().len(), stats.file_size);

        let started = std::time::Instant::now();
        let mut out = Bundle::open(&dst).unwrap();
        assert_eq!(out.nodes.len(), bundle.nodes.len());
        let (mut same, mut different) = (0, Vec::new());
        for i in 0..bundle.nodes.len() {
            if fingerprint(&mut bundle, i) == fingerprint(&mut out, i) { same += 1 } else { different.push(bundle.nodes[i].path.clone()) }
        }
        println!("confronto | {} ms | file interni identici {same} | diversi {:?}", started.elapsed().as_millis(), different);

        let size = out.nodes[index].size as usize;
        let after = extract_text_assets(&out.node(index).read_at(0, size).unwrap()).unwrap();
        let changed_ok = after.iter().any(|a| a.path_id == target.path_id && a.content == new_text);
        let others_ok = after.len() == assets.len() && after.iter().zip(&assets).all(|(a, b)| a.path_id == target.path_id || a == b);
        println!("textasset | modificato riletto giusto: {changed_ok} | altri {} invariati: {others_ok}", assets.len() - 1);

        drop(out);
        std::fs::remove_file(&dst).unwrap();
        assert_eq!(different, [node_path]);
        assert!(changed_ok && others_ok);
    }
}

/// Prova NEL GIOCO: copia il testo di un TextAsset in un altro dentro il
/// bundle installato, tenendo l'originale in `data.unity3d.gs_backup`.
/// SCRIVE nella cartella del gioco: si lancia solo a gioco chiuso e con il
/// consenso di chi possiede il gioco.
///
/// ```bash
/// cd src-tauri && GS_UNITY_BUNDLE="E:/…/LostHost_Data/data.unity3d" GS_UNITY_NODE="sharedassets0.assets" \
///   GS_UNITY_FROM="LOST_HOST - Italian" GS_UNITY_TO="LOST_HOST - Lithuanian" \
///   cargo test --bin gamestringer real_bundle_apply -- --ignored --nocapture
/// # per tornare all'originale:
/// cd src-tauri && GS_UNITY_BUNDLE="E:/…/LostHost_Data/data.unity3d" \
///   cargo test --bin gamestringer real_bundle_restore -- --ignored --nocapture
/// ```
#[cfg(test)]
mod real_bundle_apply {
    use super::*;
    use crate::commands::unity_serialized::{extract_text_assets, rewrite_text_assets};

    fn var(name: &str) -> String {
        std::env::var(name).unwrap_or_else(|_| panic!("{name} non impostata"))
    }

    #[test]
    #[ignore]
    fn real_bundle_apply() {
        let (bundle, node, from, to) = (var("GS_UNITY_BUNDLE"), var("GS_UNITY_NODE"), var("GS_UNITY_FROM"), var("GS_UNITY_TO"));
        let path = Path::new(&bundle);
        let started = std::time::Instant::now();
        let stats = replace_node_in_place(path, &node, |original| {
            let assets = extract_text_assets(original)?;
            let source = assets.iter().find(|a| a.name == from).ok_or("TextAsset sorgente non trovato")?;
            let target = assets.iter().find(|a| a.name == to).ok_or("TextAsset destinazione non trovato")?;
            println!("da | {} | {} byte    a | {} | {} byte", source.name, source.content.len(), target.name, target.content.len());
            rewrite_text_assets(original, &std::collections::HashMap::from([(target.path_id, source.content.clone())]))
        })
        .unwrap();
        println!("scritto nel gioco | {} ms | {:?}", started.elapsed().as_millis(), stats);
        println!("backup | {}", backup_path(path).display());

        // rilettura dal bundle installato
        let mut installed = Bundle::open(path).unwrap();
        let index = installed.nodes.iter().position(|n| n.path == node).unwrap();
        let size = installed.nodes[index].size as usize;
        let assets = extract_text_assets(&installed.node(index).read_at(0, size).unwrap()).unwrap();
        let text = |name: &str| assets.iter().find(|a| a.name == name).map(|a| a.content.clone());
        assert_eq!(text(&to), text(&from));
        println!("verifica | nel bundle installato «{to}» ora ha il testo di «{from}»");
    }

    #[test]
    #[ignore]
    fn real_bundle_restore() {
        let bundle = var("GS_UNITY_BUNDLE");
        let restored = restore_original(Path::new(&bundle)).unwrap();
        println!("ripristino | {}", if restored { "originale rimesso al suo posto" } else { "nessun backup trovato" });
    }
}

/// Cerca un testo in TUTTI i file interni di un bundle vero, in sola lettura:
/// dice in quali file compare e quante volte. Serve a capire se un testo sta
/// anche fuori dal TextAsset che si è sostituito.
///
/// ```bash
/// cd src-tauri && GS_UNITY_BUNDLE="E:/…/data.unity3d" GS_UNITY_GREP="Žaisti" \
///   cargo test --bin gamestringer real_bundle_grep -- --ignored --nocapture
/// ```
#[cfg(test)]
mod real_bundle_grep {
    use super::*;

    #[test]
    #[ignore]
    fn real_bundle_grep() {
        let var = |name: &str| std::env::var(name).unwrap_or_else(|_| panic!("{name} non impostata"));
        let (path, needle) = (var("GS_UNITY_BUNDLE"), var("GS_UNITY_GREP"));
        let needle = needle.as_bytes();
        let mut bundle = Bundle::open(Path::new(&path)).unwrap();
        println!("cerco {:?} in {path}", String::from_utf8_lossy(needle));
        for i in 0..bundle.nodes.len() {
            let node = bundle.nodes[i].clone();
            // texture e audio: niente testo, e sono gigabyte
            if node.path.ends_with(".resS") || node.path.ends_with(".resource") {
                continue;
            }
            const CHUNK: u64 = 8 * 1024 * 1024;
            let overlap = needle.len().saturating_sub(1) as u64;
            let (mut pos, mut hits, mut first) = (0u64, 0usize, None);
            while pos < node.size {
                let take = (node.size - pos).min(CHUNK + overlap) as usize;
                let data = bundle.node(i).read_at(pos, take).unwrap();
                for (off, window) in data.windows(needle.len()).enumerate() {
                    // le corrispondenze nella coda di sovrapposizione si contano nel pezzo dopo
                    if window == needle && ((off as u64) < CHUNK || pos + CHUNK >= node.size) {
                        hits += 1;
                        first.get_or_insert(pos + off as u64);
                    }
                }
                pos += CHUNK;
            }
            if hits > 0 {
                println!("    {} | {hits} volte | prima a {:?}", node.path, first);
            }
        }
    }
}
