// Parser SerializedFile Unity — estrazione strutturata dei TextAsset.
//
// I file resources.assets / sharedassets*.assets / *.assets sono "SerializedFile":
// un header, una lista di tipi e una tabella di oggetti che punta a una sezione
// dati. Finora l'app faceva solo uno scan euristico a byte (unity_assets.rs,
// scan_assets_for_text): trova stringhe lunghe >= 40 caratteri e tira a indovinare.
// Quello scan PERDE le stringhe corte (voci di menu, battute brevi) e non sa da
// quale oggetto vengono.
//
// Qui leggiamo la struttura vera e estraiamo gli oggetti TextAsset (class id 49),
// che sono il contenitore standard dei testi importati nei giochi Unity:
// campo m_Name + campo m_Script (il testo). Nessuna euristica sulla lunghezza.
//
// COPERTURA: SerializedFile con type-tree DISABILITATO (il caso dei giochi
// pubblicati) versioni 16–22, cioè Unity 2019 → Unity 6 (6000.x), sia i86 header
// classico sia l'header a 64 bit della v22. NON coperti: type-tree abilitato
// (build di sviluppo) e bundle UnityFS compressi (quelli passano già da
// unity_localization.rs, che li decomprime).
//
// ATTENZIONE: il layout è stato validato su fixture derivate dalla specifica
// pubblica (AssetStudio/UnityPy) e da un port Python, MA non ancora su un file
// di un gioco reale. Prima di dichiararlo affidabile in produzione va provato su
// almeno un resources.assets vero per ciascuna fascia di versione. Vedi
// is_serialized_file() per il fallback difensivo.

use serde::{Deserialize, Serialize};
use tauri::command;

const CLASS_ID_TEXT_ASSET: i32 = 49;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SerializedTextAsset {
    /// m_Name dell'oggetto TextAsset (nome logico, es. "dialogue_en").
    pub name: String,
    /// m_Script: il contenuto testuale vero e proprio.
    pub content: String,
    /// path_id dell'oggetto nel file (utile per riscrittura futura).
    pub path_id: i64,
}

#[derive(Debug, Clone)]
struct Header {
    version: u32,
    data_offset: u64,
    /// true = big-endian per i metadati.
    big_endian: bool,
    /// offset del primo byte di metadati, subito dopo l'header.
    metadata_start: usize,
}

// ── letture endian-aware ────────────────────────────────────────────────────

struct Reader<'a> {
    data: &'a [u8],
    pos: usize,
    big: bool,
}

impl<'a> Reader<'a> {
    fn new(data: &'a [u8], pos: usize, big: bool) -> Self {
        Reader { data, pos, big }
    }

    fn need(&self, n: usize) -> Result<(), String> {
        if self.pos + n > self.data.len() {
            Err(format!("SerializedFile troncato a offset {}", self.pos))
        } else {
            Ok(())
        }
    }

    fn u8(&mut self) -> Result<u8, String> {
        self.need(1)?;
        let v = self.data[self.pos];
        self.pos += 1;
        Ok(v)
    }

    fn u32(&mut self) -> Result<u32, String> {
        self.need(4)?;
        let b = [self.data[self.pos], self.data[self.pos + 1], self.data[self.pos + 2], self.data[self.pos + 3]];
        self.pos += 4;
        Ok(if self.big { u32::from_be_bytes(b) } else { u32::from_le_bytes(b) })
    }

    fn i32(&mut self) -> Result<i32, String> {
        Ok(self.u32()? as i32)
    }

    fn i16(&mut self) -> Result<i16, String> {
        self.need(2)?;
        let b = [self.data[self.pos], self.data[self.pos + 1]];
        self.pos += 2;
        Ok(if self.big { i16::from_be_bytes(b) } else { i16::from_le_bytes(b) })
    }

    fn u64(&mut self) -> Result<u64, String> {
        self.need(8)?;
        let mut b = [0u8; 8];
        b.copy_from_slice(&self.data[self.pos..self.pos + 8]);
        self.pos += 8;
        Ok(if self.big { u64::from_be_bytes(b) } else { u64::from_le_bytes(b) })
    }

    fn i64(&mut self) -> Result<i64, String> {
        Ok(self.u64()? as i64)
    }

    fn skip(&mut self, n: usize) -> Result<(), String> {
        self.need(n)?;
        self.pos += n;
        Ok(())
    }

    /// Allinea la posizione al prossimo multiplo di 4.
    fn align4(&mut self) {
        self.pos = (self.pos + 3) & !3;
    }
}

/// Controllo difensivo: sembra un SerializedFile parsabile da noi?
/// Serve al chiamante per decidere se usare questo parser o il fallback
/// euristico. Guarda solo l'header, senza costi.
pub fn is_serialized_file(data: &[u8]) -> bool {
    if data.len() < 20 {
        return false;
    }
    // version è a offset 8, big-endian nell'header.
    let version = u32::from_be_bytes([data[8], data[9], data[10], data[11]]);
    // Copriamo 16..=22. Fuori da qui non ci fidiamo del layout.
    if !(16..=22).contains(&version) {
        return false;
    }
    // endianness plausibile (0 o 1).
    let endian = data[16];
    endian == 0 || endian == 1
}

fn parse_header(data: &[u8]) -> Result<Header, String> {
    if data.len() < 20 {
        return Err("File troppo piccolo per un header SerializedFile".to_string());
    }
    // I 4 campi u32 dell'header classico sono SEMPRE big-endian.
    let version = u32::from_be_bytes([data[8], data[9], data[10], data[11]]);
    if !(16..=22).contains(&version) {
        return Err(format!("Versione SerializedFile non supportata: {}", version));
    }
    let endian_byte = data[16];
    let big_endian = endian_byte == 1;

    let (data_offset, metadata_start) = if version >= 22 {
        // Header esteso a 64 bit: dopo endian(1)+reserved(3) a offset 20 seguono
        // metadata_size u32, file_size i64, data_offset i64, unknown i64.
        let mut r = Reader::new(data, 20, true); // i campi estesi sono big-endian
        let _metadata_size = r.u32()?;
        let _file_size = r.i64()?;
        let data_offset = r.i64()? as u64;
        let _unknown = r.i64()?;
        (data_offset, r.pos)
    } else {
        // Classico: metadata_size, file_size, version, data_offset già letti nei
        // primi 16 byte; poi endian(1)+reserved(3). Metadati da offset 20.
        let data_offset = u32::from_be_bytes([data[12], data[13], data[14], data[15]]) as u64;
        (data_offset, 20usize)
    };

    Ok(Header { version, data_offset, big_endian, metadata_start })
}

/// Un oggetto nella tabella, con gli offset ASSOLUTI nel file dei campi
/// byte_start e byte_size: servono al rewriter per ripatcharli senza ricostruire
/// tutta la metadata.
struct ParsedObject {
    path_id: i64,
    byte_start: u64,
    byte_size: u32,
    class_id: i32,
    field_off_byte_start: usize,
    field_off_byte_size: usize,
}

/// Parse condiviso: header + tabella oggetti. Usato sia dall'estrazione che
/// dalla riscrittura, così il layout è definito in un posto solo.
fn parse(data: &[u8]) -> Result<(Header, Vec<ParsedObject>), String> {
    let header = parse_header(data)?;
    let mut r = Reader::new(data, header.metadata_start, header.big_endian);

    // unity version (stringa null-terminated)
    while r.pos < data.len() && data[r.pos] != 0 {
        r.pos += 1;
    }
    if r.pos >= data.len() {
        return Err("unity version non terminata".to_string());
    }
    r.pos += 1; // salta il null

    let _target_platform = r.i32()?;
    let enable_type_tree = r.u8()?;
    if enable_type_tree != 0 {
        return Err("SerializedFile con type-tree abilitato non supportato (build di sviluppo)".to_string());
    }

    // Type list
    let type_count = r.u32()?;
    if type_count > 100_000 {
        return Err(format!("type_count implausibile: {}", type_count));
    }
    let mut class_ids: Vec<i32> = Vec::with_capacity(type_count as usize);
    for _ in 0..type_count {
        let class_id = r.i32()?;
        let _is_stripped = r.u8()?; // v>=16
        let _script_type_index = r.i16()?; // v>=17
        // old type hash: 16 byte per i tipi normali; per MonoBehaviour (114) e i
        // class id negativi Unity aggiunge un ulteriore hash script da 16 byte.
        if class_id == 114 || class_id < 0 {
            r.skip(16)?; // script id hash
        }
        r.skip(16)?; // old type hash
        class_ids.push(class_id);
    }

    // Object table
    let object_count = r.u32()?;
    if object_count > 5_000_000 {
        return Err(format!("object_count implausibile: {}", object_count));
    }
    let mut objects: Vec<ParsedObject> = Vec::with_capacity(object_count as usize);
    for _ in 0..object_count {
        r.align4(); // gli oggetti sono allineati a 4 da v>=14
        let path_id = r.i64()?;
        let field_off_byte_start = r.pos;
        let byte_start = if header.version >= 22 { r.u64()? } else { r.u32()? as u64 };
        let field_off_byte_size = r.pos;
        let byte_size = r.u32()?;
        let type_index = r.i32()?;
        let class_id = *class_ids
            .get(type_index as usize)
            .ok_or_else(|| format!("type_index {} fuori dalla type list ({})", type_index, class_ids.len()))?;
        objects.push(ParsedObject {
            path_id,
            byte_start,
            byte_size,
            class_id,
            field_off_byte_start,
            field_off_byte_size,
        });
    }

    Ok((header, objects))
}

/// Estrae tutti i TextAsset da un SerializedFile in memoria.
/// Ritorna Err se il file non è un SerializedFile della fascia supportata o se
/// è troncato; il chiamante può allora ripiegare sullo scan euristico.
pub fn extract_text_assets(data: &[u8]) -> Result<Vec<SerializedTextAsset>, String> {
    let (header, objects) = parse(data)?;

    let mut out = Vec::new();
    for obj in objects.iter().filter(|o| o.class_id == CLASS_ID_TEXT_ASSET) {
        let base = header.data_offset as usize + obj.byte_start as usize;
        let end = base + obj.byte_size as usize;
        if end > data.len() {
            // Oggetto che punta fuori dai limiti: salta, non abortire tutto.
            continue;
        }
        match read_text_asset(&data[base..end]) {
            Some((name, content)) => out.push(SerializedTextAsset {
                name,
                content,
                path_id: obj.path_id,
            }),
            None => continue,
        }
    }
    Ok(out)
}

/// Riscrive il contenuto (m_Script) dei TextAsset indicati, restituendo un nuovo
/// SerializedFile. `replacements` mappa path_id → nuovo contenuto. Gli oggetti
/// non citati — TextAsset o no — restano identici byte a byte.
///
/// La stringa tradotta può avere lunghezza diversa dall'originale: in quel caso
/// tutti gli oggetti successivi slittano. metadata_size e data_offset NON
/// cambiano (la tabella oggetti è a campi fissi), quindi ripatchiamo in-place
/// byte_start/byte_size di ogni oggetto e file_size nell'header, poi riaccodiamo
/// la sezione dati ricostruita.
pub fn rewrite_text_assets(
    data: &[u8],
    replacements: &std::collections::HashMap<i64, String>,
) -> Result<Vec<u8>, String> {
    let (header, mut objects) = parse(data)?;
    let data_offset = header.data_offset as usize;

    // Ricostruisco la sezione dati nell'ordine FISICO (per byte_start), così gli
    // offset restano monotoni come li scrive Unity.
    let mut order: Vec<usize> = (0..objects.len()).collect();
    order.sort_by_key(|&i| objects[i].byte_start);

    let mut new_data: Vec<u8> = Vec::with_capacity(data.len().saturating_sub(data_offset));
    // (nuovo_byte_start, nuovo_byte_size) per ogni oggetto, indicizzato come objects
    let mut new_pos: Vec<(u64, u32)> = vec![(0, 0); objects.len()];

    for &i in &order {
        while new_data.len() % 4 != 0 {
            new_data.push(0);
        }
        let obj = &objects[i];
        let base = data_offset + obj.byte_start as usize;
        let end = base + obj.byte_size as usize;
        if end > data.len() {
            return Err(format!(
                "oggetto path_id {} punta fuori dai limiti del file",
                obj.path_id
            ));
        }
        let new_byte_start = new_data.len() as u64;

        if obj.class_id == CLASS_ID_TEXT_ASSET {
            if let Some(new_script) = replacements.get(&obj.path_id) {
                match rebuild_text_asset(&data[base..end], new_script) {
                    Some(body) => new_data.extend_from_slice(&body),
                    // corpo non riconosciuto: meglio conservare l'originale che
                    // corrompere il file
                    None => new_data.extend_from_slice(&data[base..end]),
                }
            } else {
                new_data.extend_from_slice(&data[base..end]);
            }
        } else {
            new_data.extend_from_slice(&data[base..end]);
        }

        let new_byte_size = (new_data.len() as u64 - new_byte_start) as u32;
        new_pos[i] = (new_byte_start, new_byte_size);
    }

    // Copia header+metadata (fino a data_offset), poi patcha i campi.
    let mut out = data[..data_offset].to_vec();

    for (i, obj) in objects.iter_mut().enumerate() {
        let (nbs, nsz) = new_pos[i];
        patch_uint(&mut out, obj.field_off_byte_start, nbs, header.version >= 22, header.big_endian)?;
        patch_uint(&mut out, obj.field_off_byte_size, nsz as u64, false, header.big_endian)?;
    }

    // file_size nell'header.
    let new_file_size = (data_offset + new_data.len()) as u64;
    if header.version >= 22 {
        // header esteso: file_size i64 big-endian a offset 24 (dopo i 20 byte base
        // + metadata_size u32).
        patch_uint(&mut out, 24, new_file_size, true, true)?;
    } else {
        // header classico: file_size u32 big-endian a offset 4.
        patch_uint(&mut out, 4, new_file_size, false, true)?;
    }

    out.extend_from_slice(&new_data);
    Ok(out)
}

/// Scrive un intero senza segno (u32 o u64) a `off`, con l'endianness data.
/// `wide` = true → 8 byte, altrimenti 4.
fn patch_uint(buf: &mut [u8], off: usize, val: u64, wide: bool, big: bool) -> Result<(), String> {
    let n = if wide { 8 } else { 4 };
    if off + n > buf.len() {
        return Err(format!("patch fuori dai limiti a offset {}", off));
    }
    if wide {
        let b = if big { val.to_be_bytes() } else { val.to_le_bytes() };
        buf[off..off + 8].copy_from_slice(&b);
    } else {
        let b = if big { (val as u32).to_be_bytes() } else { (val as u32).to_le_bytes() };
        buf[off..off + 4].copy_from_slice(&b);
    }
    Ok(())
}

/// Ricostruisce il corpo di un TextAsset conservando m_Name e sostituendo
/// m_Script. Ritorna None se il corpo non ha il layout atteso (due aligned
/// string): in quel caso il chiamante conserva l'originale.
fn rebuild_text_asset(body: &[u8], new_script: &str) -> Option<Vec<u8>> {
    if body.len() < 4 {
        return None;
    }
    let name_len = u32::from_le_bytes([body[0], body[1], body[2], body[3]]) as usize;
    let name_end = 4 + name_len;
    if name_end > body.len() {
        return None;
    }
    let name = &body[4..name_end];

    let mut out: Vec<u8> = Vec::new();
    out.extend_from_slice(&(name_len as u32).to_le_bytes());
    out.extend_from_slice(name);
    while out.len() % 4 != 0 {
        out.push(0);
    }
    let s = new_script.as_bytes();
    out.extend_from_slice(&(s.len() as u32).to_le_bytes());
    out.extend_from_slice(s);
    while out.len() % 4 != 0 {
        out.push(0);
    }
    Some(out)
}

/// Legge il corpo di un TextAsset: m_Name (aligned string) + m_Script (aligned
/// string). I TextAsset serializzati non hanno type-tree per-oggetto qui, quindi
/// ci affidiamo al layout fisso del tipo. Little-endian: i campi interni di un
/// oggetto seguono l'endianness del file, ma i TextAsset dei giochi PC sono LE;
/// per sicurezza leggiamo la lunghezza e validiamo contro la size disponibile.
fn read_text_asset(body: &[u8]) -> Option<(String, String)> {
    if body.len() < 8 {
        return None;
    }
    let mut p = 0usize;

    let read_aligned_string = |data: &[u8], p: &mut usize| -> Option<String> {
        if *p + 4 > data.len() {
            return None;
        }
        let len = u32::from_le_bytes([data[*p], data[*p + 1], data[*p + 2], data[*p + 3]]) as usize;
        *p += 4;
        if len > data.len() || *p + len > data.len() {
            return None;
        }
        let s = String::from_utf8_lossy(&data[*p..*p + len]).to_string();
        *p += len;
        *p = (*p + 3) & !3; // allineamento a 4 dopo la stringa
        Some(s)
    };

    let name = read_aligned_string(body, &mut p)?;
    let content = read_aligned_string(body, &mut p)?;
    Some((name, content))
}

// ── comandi Tauri ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextAssetReplacement {
    pub path_id: i64,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewriteResult {
    pub replaced: u32,
    pub backup_path: String,
}

/// Legge un SerializedFile (.assets), estrae i TextAsset e li restituisce.
/// Percorso strutturato "in profondità": nessuna euristica sulla lunghezza.
#[command]
pub async fn extract_unity_text_assets(assets_file: String) -> Result<Vec<SerializedTextAsset>, String> {
    let data = std::fs::read(&assets_file).map_err(|e| format!("Errore lettura: {}", e))?;
    if !is_serialized_file(&data) {
        return Err("Non è un SerializedFile della fascia supportata (v16-22, type-tree disabilitato)".to_string());
    }
    extract_text_assets(&data)
}

/// Riscrive in-place i TextAsset tradotti dentro un .assets, dopo aver salvato
/// un backup `<file>.backup` (ripristinabile con restore_unity_assets). Tutto in
/// Rust: nessuna dipendenza da Python.
#[command]
pub async fn rewrite_unity_text_assets(
    assets_file: String,
    replacements: Vec<TextAssetReplacement>,
) -> Result<RewriteResult, String> {
    let data = std::fs::read(&assets_file).map_err(|e| format!("Errore lettura: {}", e))?;
    if !is_serialized_file(&data) {
        return Err("Non è un SerializedFile della fascia supportata (v16-22, type-tree disabilitato)".to_string());
    }

    let map: std::collections::HashMap<i64, String> =
        replacements.into_iter().map(|r| (r.path_id, r.content)).collect();
    let count = map.len() as u32;

    let new_data = rewrite_text_assets(&data, &map)?;

    // Backup solo se non esiste già, per non sovrascrivere l'originale con una
    // versione già tradotta a una seconda esecuzione.
    let backup_path = format!("{}.backup", assets_file);
    if !std::path::Path::new(&backup_path).exists() {
        std::fs::write(&backup_path, &data)
            .map_err(|e| format!("Errore scrittura backup: {}", e))?;
    }

    std::fs::write(&assets_file, &new_data)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;

    Ok(RewriteResult { replaced: count, backup_path })
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── builder di fixture, derivati dalla spec (AssetStudio/UnityPy) ─────────
    // Layout verificato con un port Python prima di scriverlo qui, per non
    // cadere nel test tautologico (fixture costruita dal parser che si testa).

    fn aligned_string(s: &str) -> Vec<u8> {
        let b = s.as_bytes();
        let mut r = (b.len() as u32).to_le_bytes().to_vec();
        r.extend_from_slice(b);
        while r.len() % 4 != 0 {
            r.push(0);
        }
        r
    }

    fn text_asset_body(name: &str, script: &str) -> Vec<u8> {
        let mut v = aligned_string(name);
        v.extend(aligned_string(script));
        v
    }

    /// objects: (class_id, payload). Costruisce un SerializedFile v16-21
    /// (header classico) o v22 (header a 64 bit) type-tree disabilitato, LE.
    fn build_serialized(version: u32, unity_ver: &str, objects: &[(i32, Vec<u8>)]) -> Vec<u8> {
        let mut meta: Vec<u8> = Vec::new();
        meta.extend_from_slice(unity_ver.as_bytes());
        meta.push(0);
        meta.extend_from_slice(&5i32.to_le_bytes()); // target_platform
        meta.push(0); // enable_type_tree = false

        // type list (class id unici in ordine di apparizione)
        let mut types: Vec<i32> = Vec::new();
        for (cid, _) in objects {
            if !types.contains(cid) {
                types.push(*cid);
            }
        }
        meta.extend_from_slice(&(types.len() as u32).to_le_bytes());
        for cid in &types {
            meta.extend_from_slice(&cid.to_le_bytes());
            meta.push(0); // is_stripped
            meta.extend_from_slice(&(-1i16).to_le_bytes()); // script_type_index
            if *cid == 114 || *cid < 0 {
                meta.extend_from_slice(&[0u8; 16]); // script id hash
            }
            meta.extend_from_slice(&[0u8; 16]); // old type hash
        }

        // sezione dati, con allineamento a 4 di ogni oggetto
        let mut blobs: Vec<u8> = Vec::new();
        let mut recs: Vec<(u64, u32, usize)> = Vec::new(); // byte_start, size, type_index
        for (cid, payload) in objects {
            while blobs.len() % 4 != 0 {
                blobs.push(0);
            }
            let byte_start = blobs.len() as u64;
            blobs.extend_from_slice(payload);
            let ti = types.iter().position(|c| c == cid).unwrap();
            recs.push((byte_start, payload.len() as u32, ti));
        }

        meta.extend_from_slice(&(objects.len() as u32).to_le_bytes());
        for (i, (byte_start, size, ti)) in recs.iter().enumerate() {
            while meta.len() % 4 != 0 {
                meta.push(0);
            }
            meta.extend_from_slice(&((i + 1) as i64).to_le_bytes()); // path_id
            if version >= 22 {
                meta.extend_from_slice(&byte_start.to_le_bytes()); // i64
            } else {
                meta.extend_from_slice(&(*byte_start as u32).to_le_bytes());
            }
            meta.extend_from_slice(&size.to_le_bytes());
            meta.extend_from_slice(&(*ti as i32).to_le_bytes());
        }
        meta.extend_from_slice(&0u32.to_le_bytes()); // script types count
        meta.extend_from_slice(&0u32.to_le_bytes()); // externals count
        meta.push(0);

        let metadata_size = meta.len() as u32;

        let mut buf: Vec<u8> = Vec::new();
        if version >= 22 {
            let small = 4 + 4 + 4 + 4 + 1 + 3;
            let big = 4 + 8 + 8 + 8;
            let hlen = small + big;
            let mut data_offset = hlen + meta.len();
            let pad = (16 - data_offset % 16) % 16;
            data_offset += pad;
            let file_size = data_offset + blobs.len();

            buf.extend_from_slice(&0u32.to_be_bytes()); // legacy metadata_size
            buf.extend_from_slice(&0u32.to_be_bytes()); // legacy file_size
            buf.extend_from_slice(&version.to_be_bytes());
            buf.extend_from_slice(&0u32.to_be_bytes()); // legacy data_offset
            buf.push(0); // endianness LE
            buf.extend_from_slice(&[0u8; 3]);
            buf.extend_from_slice(&metadata_size.to_be_bytes());
            buf.extend_from_slice(&(file_size as i64).to_be_bytes());
            buf.extend_from_slice(&(data_offset as i64).to_be_bytes());
            buf.extend_from_slice(&0i64.to_be_bytes()); // unknown
            buf.extend_from_slice(&meta);
            buf.extend(std::iter::repeat(0u8).take(pad));
            buf.extend_from_slice(&blobs);
        } else {
            let hlen = 4 + 4 + 4 + 4 + 1 + 3;
            let mut data_offset = hlen + meta.len();
            let pad = (16 - data_offset % 16) % 16;
            data_offset += pad;
            let file_size = data_offset + blobs.len();

            buf.extend_from_slice(&metadata_size.to_be_bytes());
            buf.extend_from_slice(&(file_size as u32).to_be_bytes());
            buf.extend_from_slice(&version.to_be_bytes());
            buf.extend_from_slice(&(data_offset as u32).to_be_bytes());
            buf.push(0); // endianness LE
            buf.extend_from_slice(&[0u8; 3]);
            buf.extend_from_slice(&meta);
            buf.extend(std::iter::repeat(0u8).take(pad));
            buf.extend_from_slice(&blobs);
        }
        buf
    }

    #[test]
    fn detects_serialized_file() {
        let buf = build_serialized(17, "2020.3.16f1", &[(49, text_asset_body("a", "b"))]);
        assert!(is_serialized_file(&buf));
        assert!(!is_serialized_file(b"UnityFS\0random")); // bundle: non è affar nostro
        assert!(!is_serialized_file(b"short"));
    }

    #[test]
    fn extracts_text_asset_v17() {
        let buf = build_serialized(
            17,
            "2020.3.16f1",
            &[(49, text_asset_body("dialogue_en", "Hello traveller. Welcome to our town."))],
        );
        let assets = extract_text_assets(&buf).unwrap();
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].name, "dialogue_en");
        assert_eq!(assets[0].content, "Hello traveller. Welcome to our town.");
        assert_eq!(assets[0].path_id, 1);
    }

    #[test]
    fn ignores_non_text_asset_objects() {
        // Un MonoBehaviour (114) e uno Sprite (213) in mezzo non devono comparire.
        let buf = build_serialized(
            18,
            "2021.3.5f1",
            &[
                (49, text_asset_body("story", "Chapter 1")),
                (114, vec![0x11, 0x22, 0x33, 0x44]),
                (213, vec![0xAA, 0xBB]),
                (49, text_asset_body("ui", "Play\nOptions\nQuit")),
            ],
        );
        let assets = extract_text_assets(&buf).unwrap();
        assert_eq!(assets.len(), 2, "solo i due TextAsset");
        assert_eq!(assets[0].name, "story");
        assert_eq!(assets[1].name, "ui");
    }

    #[test]
    fn keeps_short_strings_the_heuristic_would_drop() {
        // Il punto dell'intero lavoro: lo scan euristico scartava tutto sotto i
        // 40 caratteri. Qui una voce di menu di 4 caratteri deve arrivare intera.
        let buf = build_serialized(17, "2019.4.40f1", &[(49, text_asset_body("btn", "Play"))]);
        let assets = extract_text_assets(&buf).unwrap();
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].content, "Play");
    }

    #[test]
    fn extracts_text_asset_v22_unity6() {
        // Header a 64 bit, la fascia dei giochi IL2CPP recenti.
        let buf = build_serialized(
            22,
            "6000.0.23f1",
            &[
                (49, text_asset_body("story", "Chapter 1")),
                (28, vec![0xAA, 0xBB]), // Texture2D
                (49, text_asset_body("menu", "New Game")),
            ],
        );
        let assets = extract_text_assets(&buf).unwrap();
        assert_eq!(assets.len(), 2);
        assert_eq!(assets[0].content, "Chapter 1");
        assert_eq!(assets[1].name, "menu");
        assert_eq!(assets[1].content, "New Game");
    }

    #[test]
    fn extracts_multiple_text_assets_with_utf8() {
        let buf = build_serialized(
            20,
            "2022.3.10f1",
            &[
                (49, text_asset_body("it", "Benvenuto, viaggiatore! Città di Prova.")),
                (49, text_asset_body("jp", "ようこそ、旅人。")),
            ],
        );
        let assets = extract_text_assets(&buf).unwrap();
        assert_eq!(assets.len(), 2);
        assert_eq!(assets[0].content, "Benvenuto, viaggiatore! Città di Prova.");
        assert_eq!(assets[1].content, "ようこそ、旅人。");
    }

    #[test]
    fn rejects_unsupported_version() {
        let mut buf = build_serialized(17, "2020.3.16f1", &[(49, text_asset_body("a", "b"))]);
        // Forza version = 15 (fuori dalla fascia): deve rifiutare, non fingere.
        buf[8..12].copy_from_slice(&15u32.to_be_bytes());
        assert!(extract_text_assets(&buf).is_err());
        assert!(!is_serialized_file(&buf));
    }

    #[test]
    fn rejects_type_tree_enabled() {
        // Costruiamo un file valido e accendiamo enable_type_tree: non lo
        // gestiamo, deve dare errore esplicito (→ fallback del chiamante).
        let mut buf = build_serialized(17, "2020.3.16f1", &[(49, text_asset_body("a", "b"))]);
        // enable_type_tree è a: metadata_start(20) + len("2020.3.16f1")+1 + 4.
        let tt_pos = 20 + "2020.3.16f1".len() + 1 + 4;
        buf[tt_pos] = 1;
        let err = extract_text_assets(&buf).unwrap_err();
        assert!(err.contains("type-tree"), "errore inatteso: {}", err);
    }

    #[test]
    fn truncated_file_errors_gracefully() {
        let buf = build_serialized(17, "2020.3.16f1", &[(49, text_asset_body("a", "b"))]);
        let cut = &buf[..buf.len() / 2];
        assert!(extract_text_assets(cut).is_err()); // Err, niente panic
    }

    // ── riscrittura ─────────────────────────────────────────────────────────
    use std::collections::HashMap;

    fn extracted(buf: &[u8]) -> HashMap<String, String> {
        extract_text_assets(buf)
            .unwrap()
            .into_iter()
            .map(|a| (a.name, a.content))
            .collect()
    }

    #[test]
    fn rewrite_replaces_only_targeted_text_asset() {
        let buf = build_serialized(
            17,
            "2020.3.16f1",
            &[
                (49, text_asset_body("a", "Short original")),
                (28, vec![0xAA, 0xBB, 0xCC]), // oggetto opaco in mezzo
                (49, text_asset_body("b", "keep me too")),
                (49, text_asset_body("c", "keep me")),
            ],
        );
        // path_id 1 = a. Traduzione più LUNGA dell'originale → tutto slitta.
        let mut repl = HashMap::new();
        repl.insert(1i64, "Una traduzione molto più lunga dell'originale inglese!".to_string());
        let out = rewrite_text_assets(&buf, &repl).unwrap();

        let d = extracted(&out);
        assert_eq!(d["a"], "Una traduzione molto più lunga dell'originale inglese!");
        assert_eq!(d["b"], "keep me too", "i TextAsset non citati restano intatti");
        assert_eq!(d["c"], "keep me");
        // l'oggetto opaco è preservato byte a byte
        assert!(out.windows(3).any(|w| w == [0xAA, 0xBB, 0xCC]), "oggetto opaco perso");
    }

    #[test]
    fn rewrite_handles_shorter_and_longer_together() {
        let buf = build_serialized(
            18,
            "2021.3.5f1",
            &[
                (49, text_asset_body("grow", "x")),
                (49, text_asset_body("shrink", "una stringa iniziale piuttosto lunga")),
            ],
        );
        let mut repl = HashMap::new();
        repl.insert(1i64, "adesso molto più lungo di prima davvero".to_string());
        repl.insert(2i64, "corto".to_string());
        let out = rewrite_text_assets(&buf, &repl).unwrap();

        let d = extracted(&out);
        assert_eq!(d["grow"], "adesso molto più lungo di prima davvero");
        assert_eq!(d["shrink"], "corto");
    }

    #[test]
    fn rewrite_without_changes_is_idempotent() {
        let buf = build_serialized(
            17,
            "2020.3.16f1",
            &[(49, text_asset_body("a", "hello")), (28, vec![1, 2, 3, 4])],
        );
        let out = rewrite_text_assets(&buf, &HashMap::new()).unwrap();
        // Nessuna sostituzione: il contenuto ri-estratto deve combaciare.
        assert_eq!(extracted(&out), extracted(&buf));
        // e file_size resta coerente
        let fs = u32::from_be_bytes([out[4], out[5], out[6], out[7]]) as usize;
        assert_eq!(fs, out.len());
    }

    #[test]
    fn rewrite_v22_updates_64bit_file_size() {
        let buf = build_serialized(
            22,
            "6000.0.23f1",
            &[(49, text_asset_body("story", "Chapter 1")), (28, vec![0xEE])],
        );
        let mut repl = HashMap::new();
        repl.insert(1i64, "Capitolo Uno, molto più lungo dell'originale".to_string());
        let out = rewrite_text_assets(&buf, &repl).unwrap();

        assert_eq!(extracted(&out)["story"], "Capitolo Uno, molto più lungo dell'originale");
        // file_size è i64 BE a offset 24 nell'header esteso
        let fs = u64::from_be_bytes([
            out[24], out[25], out[26], out[27], out[28], out[29], out[30], out[31],
        ]) as usize;
        assert_eq!(fs, out.len(), "file_size a 64 bit deve riflettere la nuova dimensione");
    }

    #[test]
    fn rewrite_output_is_reparseable() {
        // Il file riscritto deve restare un SerializedFile valido e ri-riscrivibile.
        let buf = build_serialized(
            20,
            "2022.3.10f1",
            &[(49, text_asset_body("a", "one")), (49, text_asset_body("b", "two"))],
        );
        let mut repl = HashMap::new();
        repl.insert(2i64, "due tradotto".to_string());
        let once = rewrite_text_assets(&buf, &repl).unwrap();
        // seconda passata senza modifiche: identica a once
        let twice = rewrite_text_assets(&once, &HashMap::new()).unwrap();
        assert_eq!(once, twice, "una riscrittura a vuoto non deve cambiare il file");
        assert_eq!(extracted(&once)["b"], "due tradotto");
    }
}
