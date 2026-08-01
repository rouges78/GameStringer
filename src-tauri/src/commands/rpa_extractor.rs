//! Ren'Py RPA Archive Extractor
//!
//! Estrae archivi .rpa (RPA-3.0 e RPA-2.0) su disco, senza dipendere da UnRPA/Python.
//!
//! Formato (da renpy/loader.py e rpatool):
//!   Riga 1 (ASCII): "RPA-3.0 <offset hex 16> <key hex 8>\n"   (RPA-2.0: senza key)
//!   A <offset>: indice = zlib(pickle(dict))
//!     dict: { nome_file: [ (offset, len, prefix), ... ] }
//!     In RPA-3.0 offset e len sono XOR-ati con <key>; prefix sono i primi byte
//!     del file salvati nell'indice: contenuto = prefix + file[offset .. offset+len-len(prefix)]
//!
//! L'indice è un pickle Python (protocollo 2): qui c'è un parser minimale che copre
//! solo gli opcode che pickle.dumps(dict[str, list[tuple]], 2) può produrre
//! (py2 e py3: stringhe, bytes, interi, tuple, liste, dict, memo). Opcode ignoto = errore
//! onesto, non garbage.

use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::Path;
use serde::{Deserialize, Serialize};
use flate2::read::ZlibDecoder;

// ═══════════════════════════════════════════════════════════════════
// MINI PICKLE PARSER
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Clone)]
enum PickleValue {
    None,
    Int(i64),
    Str(String),
    Bytes(Vec<u8>),
    List(Vec<PickleValue>),
    Tuple(Vec<PickleValue>),
    Dict(Vec<(PickleValue, PickleValue)>),
    Mark,
}

struct PickleReader<'a> {
    data: &'a [u8],
    pos: usize,
    stack: Vec<PickleValue>,
    memo: HashMap<u32, PickleValue>,
}

impl<'a> PickleReader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 0, stack: Vec::new(), memo: HashMap::new() }
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        if self.pos + n > self.data.len() {
            return Err(format!("pickle: EOF a offset {}", self.pos));
        }
        let s = &self.data[self.pos..self.pos + n];
        self.pos += n;
        Ok(s)
    }

    fn u8(&mut self) -> Result<u8, String> { Ok(self.take(1)?[0]) }
    fn u16le(&mut self) -> Result<u16, String> {
        let b = self.take(2)?;
        Ok(u16::from_le_bytes([b[0], b[1]]))
    }
    fn u32le(&mut self) -> Result<u32, String> {
        let b = self.take(4)?;
        Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    }
    fn i32le(&mut self) -> Result<i32, String> {
        let b = self.take(4)?;
        Ok(i32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    }

    fn pop(&mut self) -> Result<PickleValue, String> {
        self.stack.pop().ok_or_else(|| "pickle: stack vuoto".into())
    }

    /// Estrae gli elementi sopra l'ultimo MARK (e rimuove il MARK).
    fn pop_to_mark(&mut self) -> Result<Vec<PickleValue>, String> {
        let mut items = Vec::new();
        loop {
            match self.pop()? {
                PickleValue::Mark => break,
                v => items.push(v),
            }
        }
        items.reverse();
        Ok(items)
    }

    /// LONG1/LONG4: intero little-endian signed di n byte.
    fn long_le(bytes: &[u8]) -> i64 {
        if bytes.is_empty() {
            return 0;
        }
        let mut v: i64 = 0;
        for (i, b) in bytes.iter().enumerate().take(8) {
            v |= (*b as i64) << (8 * i);
        }
        // sign-extend
        let nbits = 8 * bytes.len().min(8);
        if nbits < 64 && bytes[bytes.len() - 1] & 0x80 != 0 {
            v |= -1i64 << nbits;
        }
        v
    }

    fn parse(mut self) -> Result<PickleValue, String> {
        loop {
            let op = self.u8()?;
            match op {
                0x80 => { self.u8()?; } // PROTO n
                0x95 => { self.take(8)?; } // FRAME (proto 4+): 8 byte di lunghezza, solo hint — skip
                b'.' => return self.pop(), // STOP
                b'(' => self.stack.push(PickleValue::Mark),
                b'}' => self.stack.push(PickleValue::Dict(Vec::new())),
                b']' => self.stack.push(PickleValue::List(Vec::new())),
                b')' => self.stack.push(PickleValue::Tuple(Vec::new())),
                b'N' => self.stack.push(PickleValue::None),
                b'd' => { // DICT (from mark)
                    let items = self.pop_to_mark()?;
                    let mut d = Vec::new();
                    let mut it = items.into_iter();
                    while let (Some(k), Some(v)) = (it.next(), it.next()) {
                        d.push((k, v));
                    }
                    self.stack.push(PickleValue::Dict(d));
                }
                b'l' => { // LIST (from mark)
                    let items = self.pop_to_mark()?;
                    self.stack.push(PickleValue::List(items));
                }
                b't' => { // TUPLE (from mark)
                    let items = self.pop_to_mark()?;
                    self.stack.push(PickleValue::Tuple(items));
                }
                0x85 => { let a = self.pop()?; self.stack.push(PickleValue::Tuple(vec![a])); }
                0x86 => { let b = self.pop()?; let a = self.pop()?; self.stack.push(PickleValue::Tuple(vec![a, b])); }
                0x87 => { let c = self.pop()?; let b = self.pop()?; let a = self.pop()?; self.stack.push(PickleValue::Tuple(vec![a, b, c])); }
                b'K' => { let v = self.u8()?; self.stack.push(PickleValue::Int(v as i64)); } // BININT1
                b'M' => { let v = self.u16le()?; self.stack.push(PickleValue::Int(v as i64)); } // BININT2
                b'J' => { let v = self.i32le()?; self.stack.push(PickleValue::Int(v as i64)); } // BININT
                0x8a => { // LONG1
                    let n = self.u8()? as usize;
                    let b = self.take(n)?;
                    self.stack.push(PickleValue::Int(Self::long_le(b)));
                }
                0x8b => { // LONG4
                    let n = self.u32le()? as usize;
                    if n > 8 { return Err("pickle: LONG4 oltre 8 byte non supportato".into()); }
                    let b = self.take(n)?;
                    self.stack.push(PickleValue::Int(Self::long_le(b)));
                }
                b'X' => { // BINUNICODE
                    let n = self.u32le()? as usize;
                    let b = self.take(n)?;
                    self.stack.push(PickleValue::Str(String::from_utf8_lossy(b).into_owned()));
                }
                0x8c => { // SHORT_BINUNICODE (proto 4)
                    let n = self.u8()? as usize;
                    let b = self.take(n)?;
                    self.stack.push(PickleValue::Str(String::from_utf8_lossy(b).into_owned()));
                }
                b'U' => { // SHORT_BINSTRING (py2)
                    let n = self.u8()? as usize;
                    let b = self.take(n)?;
                    self.stack.push(PickleValue::Bytes(b.to_vec()));
                }
                b'T' => { // BINSTRING (py2)
                    let n = self.u32le()? as usize;
                    let b = self.take(n)?;
                    self.stack.push(PickleValue::Bytes(b.to_vec()));
                }
                b'C' => { // SHORT_BINBYTES (proto 3)
                    let n = self.u8()? as usize;
                    let b = self.take(n)?;
                    self.stack.push(PickleValue::Bytes(b.to_vec()));
                }
                b'B' => { // BINBYTES
                    let n = self.u32le()? as usize;
                    let b = self.take(n)?;
                    self.stack.push(PickleValue::Bytes(b.to_vec()));
                }
                b'q' => { let k = self.u8()? as u32; let v = self.stack.last().cloned().ok_or("pickle: BINPUT su stack vuoto")?; self.memo.insert(k, v); }
                b'r' => { let k = self.u32le()?; let v = self.stack.last().cloned().ok_or("pickle: LONG_BINPUT su stack vuoto")?; self.memo.insert(k, v); }
                0x94 => { let k = self.memo.len() as u32; let v = self.stack.last().cloned().ok_or("pickle: MEMOIZE su stack vuoto")?; self.memo.insert(k, v); } // MEMOIZE (proto 4)
                b'h' => { let k = self.u8()? as u32; let v = self.memo.get(&k).cloned().ok_or("pickle: BINGET chiave assente")?; self.stack.push(v); }
                b'j' => { let k = self.u32le()?; let v = self.memo.get(&k).cloned().ok_or("pickle: LONG_BINGET chiave assente")?; self.stack.push(v); }
                b'a' => { // APPEND
                    let v = self.pop()?;
                    match self.stack.last_mut() {
                        Some(PickleValue::List(l)) => l.push(v),
                        _ => return Err("pickle: APPEND su non-lista".into()),
                    }
                }
                b'e' => { // APPENDS
                    let items = self.pop_to_mark()?;
                    match self.stack.last_mut() {
                        Some(PickleValue::List(l)) => l.extend(items),
                        _ => return Err("pickle: APPENDS su non-lista".into()),
                    }
                }
                b's' => { // SETITEM
                    let v = self.pop()?;
                    let k = self.pop()?;
                    match self.stack.last_mut() {
                        Some(PickleValue::Dict(d)) => d.push((k, v)),
                        _ => return Err("pickle: SETITEM su non-dict".into()),
                    }
                }
                b'u' => { // SETITEMS
                    let items = self.pop_to_mark()?;
                    match self.stack.last_mut() {
                        Some(PickleValue::Dict(d)) => {
                            let mut it = items.into_iter();
                            while let (Some(k), Some(v)) = (it.next(), it.next()) {
                                d.push((k, v));
                            }
                        }
                        _ => return Err("pickle: SETITEMS su non-dict".into()),
                    }
                }
                other => {
                    return Err(format!(
                        "pickle: opcode 0x{:02X} non supportato a offset {} — indice RPA non standard",
                        other, self.pos - 1
                    ));
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// RPA READER
// ═══════════════════════════════════════════════════════════════════

struct RpaEntry {
    name: String,
    offset: u64,
    length: u64,
    prefix: Vec<u8>,
}

fn pickle_int(v: &PickleValue) -> Option<i64> {
    match v {
        PickleValue::Int(i) => Some(*i),
        _ => None,
    }
}

fn pickle_bytes(v: &PickleValue) -> Option<Vec<u8>> {
    match v {
        PickleValue::Bytes(b) => Some(b.clone()),
        PickleValue::Str(s) => Some(s.as_bytes().to_vec()),
        PickleValue::None => Some(Vec::new()),
        _ => None,
    }
}

fn parse_rpa_index(index: PickleValue, key: u64) -> Result<Vec<RpaEntry>, String> {
    let dict = match index {
        PickleValue::Dict(d) => d,
        _ => return Err("Indice RPA: atteso un dict al top-level".into()),
    };

    let mut entries = Vec::with_capacity(dict.len());
    for (k, v) in dict {
        let name = match k {
            PickleValue::Str(s) => s,
            PickleValue::Bytes(b) => String::from_utf8_lossy(&b).into_owned(),
            _ => return Err("Indice RPA: chiave non-stringa".into()),
        };
        let segs = match v {
            PickleValue::List(l) => l,
            PickleValue::Tuple(t) => t,
            _ => return Err(format!("Indice RPA: valore inatteso per {}", name)),
        };
        // Ren'Py usa sempre un solo segmento per file.
        let seg = match segs.first() {
            Some(PickleValue::Tuple(t)) | Some(PickleValue::List(t)) => t.clone(),
            _ => return Err(format!("Indice RPA: segmento mancante per {}", name)),
        };
        if seg.len() < 2 {
            return Err(format!("Indice RPA: segmento troppo corto per {}", name));
        }
        let raw_offset = pickle_int(&seg[0])
            .ok_or_else(|| format!("Indice RPA: offset non intero per {}", name))?;
        let raw_len = pickle_int(&seg[1])
            .ok_or_else(|| format!("Indice RPA: length non intera per {}", name))?;
        let prefix = if seg.len() >= 3 {
            pickle_bytes(&seg[2])
                .ok_or_else(|| format!("Indice RPA: prefix inatteso per {}", name))?
        } else {
            Vec::new()
        };

        // RPA-3.0: offset e length XOR-ati con la chiave (RPA-2.0: key = 0).
        let offset = (raw_offset as u64) ^ key;
        let length = (raw_len as u64) ^ key;

        entries.push(RpaEntry { name, offset, length, prefix });
    }
    Ok(entries)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RpaExtractResult {
    pub success: bool,
    pub output_path: String,
    pub files_count: usize,
    pub skipped_count: usize,
    pub message: String,
}

/// Estrae un archivio Ren'Py .rpa (RPA-3.0 / RPA-2.0) sotto `output_path`,
/// preservando la struttura delle cartelle (i nomi nell'indice sono relativi a game/).
/// Ogni nome è validato contro il path traversal.
#[tauri::command]
pub async fn extract_renpy_rpa(
    rpa_path: String,
    output_path: String,
) -> Result<RpaExtractResult, String> {
    let data = fs::read(Path::new(&rpa_path))
        .map_err(|e| format!("Errore lettura {}: {}", rpa_path, e))?;

    // Header: prima riga ASCII terminata da \n.
    let nl = data.iter().take(64).position(|&b| b == b'\n')
        .ok_or("Header RPA non trovato (nessun newline nei primi 64 byte)")?;
    let header = String::from_utf8_lossy(&data[..nl]);
    let parts: Vec<&str> = header.split_whitespace().collect();

    let (index_offset, key) = match parts.as_slice() {
        ["RPA-3.0", off, key_hex, ..] => {
            let off = u64::from_str_radix(off, 16)
                .map_err(|e| format!("Header RPA-3.0: offset non hex: {}", e))?;
            let key = u64::from_str_radix(key_hex, 16)
                .map_err(|e| format!("Header RPA-3.0: key non hex: {}", e))?;
            (off, key)
        }
        ["RPA-2.0", off, ..] => {
            let off = u64::from_str_radix(off, 16)
                .map_err(|e| format!("Header RPA-2.0: offset non hex: {}", e))?;
            (off, 0u64)
        }
        _ => {
            return Err(format!(
                "Formato non supportato (header: {:?}). Supportati: RPA-3.0, RPA-2.0",
                header.chars().take(20).collect::<String>()
            ));
        }
    };

    let idx_start = index_offset as usize;
    if idx_start >= data.len() {
        return Err(format!(
            "Offset indice ({}) oltre la fine del file ({} byte): archivio troncato?",
            idx_start, data.len()
        ));
    }

    // Indice: zlib → pickle.
    let mut decoder = ZlibDecoder::new(&data[idx_start..]);
    let mut pickled = Vec::new();
    decoder.read_to_end(&mut pickled)
        .map_err(|e| format!("Indice RPA: decompressione zlib fallita: {}", e))?;
    let index = PickleReader::new(&pickled).parse()?;
    let entries = parse_rpa_index(index, key)?;

    let out_root = Path::new(&output_path);
    fs::create_dir_all(out_root)
        .map_err(|e| format!("Impossibile creare {}: {}", output_path, e))?;

    let mut written = 0usize;
    let mut skipped = 0usize;

    for entry in &entries {
        // Anti-traversal.
        let unsafe_path = entry.name.is_empty()
            || Path::new(&entry.name).is_absolute()
            || entry.name.contains(':')
            || entry.name
                .split(['/', '\\'])
                .any(|c| c.is_empty() || c == ".." || c == ".");
        if unsafe_path {
            log::warn!("RPA extract: entry saltata per path sospetto: {:?}", entry.name);
            skipped += 1;
            continue;
        }

        // Contenuto = prefix + data[offset .. offset + length - len(prefix)].
        let body_len = (entry.length as usize).saturating_sub(entry.prefix.len());
        let span = (entry.offset as usize)
            .checked_add(body_len)
            .filter(|end| *end <= data.len())
            .map(|end| (entry.offset as usize, end));
        let (s, e) = match span {
            Some(se) => se,
            None => {
                log::warn!("RPA extract: entry oltre EOF, saltata: {:?}", entry.name);
                skipped += 1;
                continue;
            }
        };

        let dest = out_root.join(&entry.name);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e2| format!("Impossibile creare {}: {}", parent.display(), e2))?;
        }
        let mut content = Vec::with_capacity(entry.length as usize);
        content.extend_from_slice(&entry.prefix);
        content.extend_from_slice(&data[s..e]);
        fs::write(&dest, &content)
            .map_err(|e2| format!("Errore scrittura {}: {}", dest.display(), e2))?;
        written += 1;
    }

    log::info!(
        "📦 RPA extract: {} file scritti in {}, {} saltati",
        written, output_path, skipped
    );

    Ok(RpaExtractResult {
        success: written > 0,
        output_path,
        files_count: written,
        skipped_count: skipped,
        message: if skipped > 0 {
            format!("{} file estratti, {} saltati", written, skipped)
        } else {
            format!("{} file estratti", written)
        },
    })
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::write::ZlibEncoder;
    use flate2::Compression;
    use std::io::Write as _;

    /// Costruisce un pickle protocollo-2 minimale dell'indice, come farebbe
    /// pickle.dumps({name: [(offset, len, '')]}, 2) su py3.
    fn build_index_pickle(entries: &[(&str, u64, u64)], key: u64) -> Vec<u8> {
        let mut p = vec![0x80, 2, b'}']; // PROTO 2, EMPTY_DICT
        for (name, off, len) in entries {
            // BINUNICODE name
            p.push(b'X');
            p.extend_from_slice(&(name.len() as u32).to_le_bytes());
            p.extend_from_slice(name.as_bytes());
            // EMPTY_LIST, MARK… no: usiamo ] poi ( tuple ) APPEND
            p.push(b']');
            // TUPLE3: offset^key, len^key, ''
            for v in [*off ^ key, *len ^ key] {
                p.push(0x8a); // LONG1
                let bytes = v.to_le_bytes();
                let n = (8 - bytes.iter().rev().take_while(|b| **b == 0).count()).max(1);
                // assicura MSB non-segno: aggiungi un byte 0 se serve
                let mut cut: Vec<u8> = bytes[..n].to_vec();
                if cut[n - 1] & 0x80 != 0 {
                    cut.push(0);
                }
                p.push(cut.len() as u8);
                p.extend_from_slice(&cut);
            }
            p.push(b'X'); // prefix vuoto come BINUNICODE ""
            p.extend_from_slice(&0u32.to_le_bytes());
            p.push(0x87); // TUPLE3
            p.push(b'a'); // APPEND
            p.push(b's'); // SETITEM
        }
        p.push(b'.');
        p
    }

    fn build_rpa3(files: &[(&str, &[u8])], key: u64) -> Vec<u8> {
        let header = format!("RPA-3.0 {:016x} {:08x}\n", 0u64, key); // offset patchato dopo
        let mut body: Vec<u8> = header.as_bytes().to_vec();
        let mut index: Vec<(String, u64, u64)> = Vec::new();
        for (name, content) in files {
            index.push((name.to_string(), body.len() as u64, content.len() as u64));
            body.extend_from_slice(content);
        }
        let index_offset = body.len() as u64;
        let tuples: Vec<(&str, u64, u64)> = index
            .iter()
            .map(|(n, o, l)| (n.as_str(), *o, *l))
            .collect();
        let pickled = build_index_pickle(&tuples, key);
        let mut enc = ZlibEncoder::new(Vec::new(), Compression::default());
        enc.write_all(&pickled).unwrap();
        body.extend_from_slice(&enc.finish().unwrap());
        // Patch header con l'offset reale.
        let patched = format!("RPA-3.0 {:016x} {:08x}\n", index_offset, key);
        body[..patched.len()].copy_from_slice(patched.as_bytes());
        body
    }

    #[test]
    fn test_roundtrip_rpa3() {
        let dir = std::env::temp_dir().join(format!("gs_rpa_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let files: Vec<(&str, &[u8])> = vec![
            ("script.rpy", b"label start:\n    \"Ciao\"\n".as_slice()),
            ("tl/italian/dialogue.rpy", b"translate italian start_1:\n".as_slice()),
        ];
        let archive = build_rpa3(&files, 0xDEADBEEF);
        let rpa_path = dir.join("archive.rpa");
        fs::write(&rpa_path, &archive).unwrap();

        let out = dir.join("out");
        let res = tauri::async_runtime::block_on(extract_renpy_rpa(
            rpa_path.to_string_lossy().to_string(),
            out.to_string_lossy().to_string(),
        ))
        .unwrap();

        assert!(res.success);
        assert_eq!(res.files_count, 2);
        assert_eq!(res.skipped_count, 0);
        assert_eq!(fs::read(out.join("script.rpy")).unwrap(), files[0].1);
        assert_eq!(fs::read(out.join("tl/italian/dialogue.rpy")).unwrap(), files[1].1);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_traversal_rejected() {
        let dir = std::env::temp_dir().join(format!("gs_rpa_trav_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let files: Vec<(&str, &[u8])> = vec![("../evil.txt", b"x".as_slice())];
        let archive = build_rpa3(&files, 0);
        let rpa_path = dir.join("evil.rpa");
        fs::write(&rpa_path, &archive).unwrap();

        let out = dir.join("out");
        let res = tauri::async_runtime::block_on(extract_renpy_rpa(
            rpa_path.to_string_lossy().to_string(),
            out.to_string_lossy().to_string(),
        ))
        .unwrap();

        assert!(!res.success);
        assert_eq!(res.skipped_count, 1);
        assert!(!dir.join("evil.txt").exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_header_invalido() {
        let dir = std::env::temp_dir().join(format!("gs_rpa_bad_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let rpa_path = dir.join("bad.rpa");
        fs::write(&rpa_path, b"NOT-AN-RPA whatever\ndata").unwrap();

        let res = tauri::async_runtime::block_on(extract_renpy_rpa(
            rpa_path.to_string_lossy().to_string(),
            dir.join("out").to_string_lossy().to_string(),
        ));
        assert!(res.is_err());
        let _ = fs::remove_dir_all(&dir);
    }
}
